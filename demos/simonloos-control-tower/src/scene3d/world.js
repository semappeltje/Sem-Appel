// De vaste wereld: standplaatsen op hun echte terrein (de ring uit places.json als verhard vlak, de hal en de eigen
// gebouwen uit buildings.js met d: 1, de buurt eromheen in minder detail), DC's en fabrieken (silo's, schoorsteen, tanks), de
// parkeerrijen met hun vakken, genummerde docks aan de lange zijde van de hal waar de rijen staan, de poort waar de
// toegangsroute het terrein op komt (slagboom, portiersloge, lantaarnpalen, populieren langs de weg), lichtmasten, hagen en
// bomen, geparkeerde auto's, winkels bij de stops en woonhuizen in de bebouwing van urban.json waar geen echte gebouwen
// zijn. Zonder gegevens een procedurele loods met kantoor.
// Alles in meters; elke plek heeft een eigen vlak rond zijn ankerpunt en wordt pas gebouwd als hij in beeld komt.
import * as THREE from 'three';
import { P, paletteMaterial } from './palette.js';
import { Builder, walls, flat, parapet, gable, gableEnds, hip, line, obox, skirt } from './geom.js';
import { clamp, hash, hashStr, rng, mercX, mercY, mpuAt, ringArea, cleanRing, centroid, inRing, bbox, nearestOnRing, edgeNormal, mainAxis, rot, offsetRing, rectHitsRing, rectInRing, hull, readRing, decodeRing } from './util.js';
import { treeGeometries, TREE_TINTS, TRUNK, houseGeometries, WALLS, ROOFS, hedgeGeometry } from './nature.js';
import { carGeometry } from './vehicles.js';
import { warehouseTextures, officeTextures, houseTextures, roofTexture, yardTexture, flatRoofTexture, apronTexture, dockNumberTexture } from './fx.js';
import { loadTrees, loadPieces } from './assets.js';

const PU = i => [(i + 0.5) / 64, 0.5];
const TR_HALF = 6.8;                         // halve lengte van een losse oplegger
const SLOT_W = 4.0, SLOT_L = 18.0, AISLE = 15.0;
const lonLat = (mx, my) => [mx * 360 - 180, 360 / Math.PI * Math.atan(Math.exp((180 - my * 360) * Math.PI / 180)) - 90];

// ---------- invoer lezen (verdraagzaam: ring, polygoon, GeoJSON of gecodeerde tekst) ----------
// { "<plek>": [{ p: [[lon, lat], ...], h: meters, d?: 1 }, ...] }, of per plek een FeatureCollection; ook als functie.
// d: 1 = op het terrein van de plek zelf (hal, kantoor, werkplaats).
export function readBuildings(mod) {
  let src = mod && (mod.default || mod.BUILDINGS || mod.buildings || mod.data || mod); if (typeof src === 'function') src = src();
  const out = new Map(); if (!src || typeof src !== 'object') return out;
  // i: de plek in de oorspronkelijke lijst (sp.afdelingen verwijst met gebouw naar die index)
  const item = (b, i) => {
    const r = readRing(b); if (!r) return null; const pr = b && typeof b === 'object' && !Array.isArray(b) ? b : null; const pp = pr && pr.properties;
    const h = pr ? +(pr.h ?? pr.height ?? (pp && (pp.h ?? pp.height ?? pp.render_height)) ?? 0) : 0; const own = !!(pr && (pr.d === 1 || pr.d === true || (pp && pp.d)));
    return { p: r, h: h > 0 ? h : 0, own, i };
  };
  for (const [k, v] of Object.entries(src)) {
    const list = Array.isArray(v) ? v : v && v.type === 'FeatureCollection' ? v.features : v && Array.isArray(v.buildings) ? v.buildings : null; if (!list) continue;
    const items = list.map(item).filter(Boolean); if (items.length) out.set(k.toLowerCase(), { key: k, items });
  }
  return out;
}

export function createWorld({ scene, SP, urban, buildingsLoader, pal, theme, shops: shopPoints, dcs }) {
  // ---------- materialen (gedeeld) ----------
  const wh = warehouseTextures(true), whN = warehouseTextures(false), of = officeTextures(), ho = houseTextures();
  const M = {
    yard: new THREE.MeshStandardMaterial({ map: yardTexture(), roughness: 0.93, metalness: 0 }),
    apron: new THREE.MeshStandardMaterial({ map: apronTexture(), roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    wallSL: new THREE.MeshStandardMaterial({ map: wh.map, emissiveMap: wh.emissive, emissive: 0xFFFFFF, emissiveIntensity: 0, roughness: 0.62, metalness: 0.05 }),
    wallN: new THREE.MeshStandardMaterial({ map: whN.map, emissiveMap: whN.emissive, emissive: 0xFFFFFF, emissiveIntensity: 0, roughness: 0.66, metalness: 0.05 }),
    office: new THREE.MeshStandardMaterial({ map: of.map, emissiveMap: of.emissive, emissive: 0xFFFFFF, emissiveIntensity: 0, roughness: 0.4, metalness: 0.1 }),
    houseVC: new THREE.MeshStandardMaterial({ map: ho.map, emissiveMap: ho.emissive, emissive: 0xFFFFFF, emissiveIntensity: 0, vertexColors: true, roughness: 0.85 }),
    roofFlat: new THREE.MeshStandardMaterial({ map: flatRoofTexture(), roughness: 0.95 }),
    tilesVC: new THREE.MeshStandardMaterial({ map: roofTexture(), vertexColors: true, roughness: 0.8 }),
    crown: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
    trunk: new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.95 }),
    hedge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    house: new THREE.MeshStandardMaterial({ map: ho.map, emissiveMap: ho.emissive, emissive: 0xFFFFFF, emissiveIntensity: 0, roughness: 0.85 }),
    houseRoof: new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.8 }),
    ao: new THREE.MeshBasicMaterial({ color: 0x0B1220, vertexColors: true, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // dockborden: een wit bord met het nummer boven elke deur (1 tot n langs de dockzijde, zoals hal-scherm en planbord)
    plate: new THREE.MeshStandardMaterial({ map: dockNumberTexture(), roughness: 0.55, metalness: 0, emissive: 0xFFFFFF, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  };
  M.plate.emissiveMap = M.plate.map;
  // markeringen (vakken, dockvakken, rijbanen): het palet, iets naar de camera geschoven, zodat ze ook op het betonnen
  // dockschort (dat zelf al naar voren is geschoven) altijd boven liggen
  M.marks = paletteMaterial({ polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  // de buurt: dezelfde texturen met een kleur per pand
  M.wallNV = M.wallN.clone(); M.wallNV.vertexColors = true; M.officeV = M.office.clone(); M.officeV.vertexColors = true; M.roofV = M.roofFlat.clone(); M.roofV.vertexColors = true;
  litWindows(M.office, 0.62); litWindows(M.houseVC, 0.42); litWindows(M.house, 0.42, true); litWindows(M.wallSL, 0.9); litWindows(M.wallN, 0.6); litWindows(M.wallNV, 0.5); litWindows(M.officeV, 0.55);

  const root = new THREE.Group(); root.name = 'wereld'; scene.add(root);
  let O = null; let buildings = new Map(); let ready = false; let prepMs = 0;
  const depots = SP.map((s, i) => ({ s, i, kind: 'depot', name: s.n, built: false }));
  const byName = new Map(depots.map(d => [d.name, d]));
  const DCS = (dcs || []).filter(x => x && isFinite(+x.lon) && isFinite(+x.lat));
  const dcById = new Map(DCS.map(x => [String(x.id).toLowerCase(), x]));
  let sites = [];
  // gebouwen (eigen bundel) en de CC0-modellen tegelijk laden
  const assets = {}; let assetMs = 0, pieceMs = 0;
  const buildingsP = buildingsLoader ? buildingsLoader().then(m => { buildings = readBuildings(m); }).catch(() => { buildings = new Map(); }) : Promise.resolve();
  const treesP = loadTrees().then(a => { assets.trees = a.trees; assetMs = a.ms; }).catch(err => console.warn('3D-bomen niet geladen', err));
  const piecesP = loadPieces().then(a => { assets.tank = a.tank; assets.chimney = a.chimney; pieceMs = a.ms; }).catch(err => console.warn('3D-modellen niet geladen', err));
  // de wereld wacht alleen op de gebouwen; komen de modellen later binnen, dan wisselen de bomen en komen de
  // fabrieksdetails erbij (upgrade)
  let treesIn = false, piecesIn = false;
  treesP.then(() => { treesIn = true; if (ready) upgradeTrees(); });
  piecesP.then(() => { piecesIn = true; if (ready) upgradePieces(); });
  const loading = buildingsP.then(() => {
    initTrees(); if (piecesIn) initPieces();
    // DC's en fabrieken uit buildings.js (onder hun id) die geen standplaats zijn: eigen plekken, met hun terrein als dat bekend is
    const names = new Set(depots.map(d => d.name.toLowerCase()));
    sites = [...buildings.entries()].filter(([k]) => !names.has(k)).map(([k, v], i) => ({ kind: 'site', name: v.key, i: 1000 + i, items: v.items, s: dcById.get(k) || null, built: false }));
    const t0 = performance.now(); for (const d of [...depots, ...sites]) anchor(d); prepMs = performance.now() - t0;
    // stond de oorsprong al (3D ging aan voordat dit klaar was), dan nu de plekken plaatsen
    ready = true; if (O) setOrigin(O);
  });
  // ankerpunt en een grove straal van elke plek; de rest (gebouwen, rijen, docks, poort, bomen) pas als hij in de buurt
  // van het beeld komt (ensure), zodat het laden niet op 78 plekken met samen 16.000 gebouwen wacht
  function anchor(d) {
    const s = d.s || {}; const terrLL = readRing(s.terrein || s.terrain || s.yard); const items = d.items || (buildings.get(d.name.toLowerCase()) || {}).items || [];
    const own = items.filter(b => b.own);
    if (terrLL) frame(d, ...meanLL(terrLL)); else if (items.length) frame(d, ...meanLL((own.length ? own : items).flatMap(b => b.p))); else if (isFinite(+s.lon)) frame(d, +s.lon, +s.lat); else return;
    let r = 150; for (const [lo, la] of terrLL || []) { const [x, z] = d.toLocal(lo, la); r = Math.max(r, Math.hypot(x, z)); }
    d.rough = r + 300;
  }
  function ensure(d) {
    if (d.prepared) return true; if (d.lon0 == null || !ready) return false;
    const t = performance.now(); prepare(d); d.prepared = true; prepMs += performance.now() - t; coverCache = null; natureKey = '';
    if (O) { d.gx = (d.mx0 - O.x) / O.mpu; d.gz = (d.my0 - O.y) / O.mpu; d.sc = d.mpu0 / O.mpu; }
    return true;
  }

  // ---------- voorbereiden: ankerpunt, contouren in meters, terrein, gebouwen, rijen, docks, poort ----------
  function frame(d, lon, lat) { d.lon0 = lon; d.lat0 = lat; d.mx0 = mercX(lon); d.my0 = mercY(lat); d.mpu0 = mpuAt(lat); d.toLocal = (lo, la) => [(mercX(lo) - d.mx0) / d.mpu0, (mercY(la) - d.my0) / d.mpu0]; }
  const meanLL = ring => { let sx = 0, sy = 0; for (const [lo, la] of ring) { sx += lo; sy += la; } return [sx / ring.length, sy / ring.length]; };
  function prepare(d) {
    d.seed = hashStr(d.name); const s = d.s || {};
    const terrLL = readRing(s.terrein || s.terrain || s.yard);
    const items = d.items || (buildings.get(d.name.toLowerCase()) || {}).items || [];
    if (d.lon0 == null) anchor(d);
    d.terrain = terrLL ? cleanRing(terrLL.map(([lo, la]) => d.toLocal(lo, la))) : null; if (d.terrain && (d.terrain.length < 3 || ringArea(d.terrain) < 400)) d.terrain = null;
    d.addr = isFinite(+s.lon) ? d.toLocal(+s.lon, +s.lat) : [0, 0];
    // gebouwen: eigen (d: 1) en de buurt; zonder die vlag bepaalt de ligging op het terrein (of bij het adres) wat eigen is
    d.rows = readRows(d, s.rijen);
    const hasFlags = items.some(b => b.own);
    d.buildings = items.map(b => { const o = building(d, b.p.map(([lo, la]) => d.toLocal(lo, la)), b.h, b.own); if (o) o.src = b.i; return o; }).filter(b => b && !looseObject(d, b));
    if (!hasFlags) for (const b of d.buildings) b.own = d.terrain ? inRing(b.c[0], b.c[1], d.terrain) || ringFrac(b.ring, d.terrain) > 0.5 : Math.hypot(b.c[0] - d.addr[0], b.c[1] - d.addr[1]) < 160 && b.area > 300;
    // de hal (hoofdgebouw) uit places.json; staat hij niet tussen de gebouwen, dan erbij
    const halLL = readRing(s.hal);
    if (halLL) { const hr = cleanRing(halLL.map(([lo, la]) => d.toLocal(lo, la))); const hc = centroid(hr); let hb = null, best = 0; for (const b of d.buildings) { const f = inRing(b.c[0], b.c[1], hr) ? 1 : inRing(hc[0], hc[1], b.ring) ? 0.8 : 0; if (f && b.area > best) { best = b.area; hb = b; } } if (!hb) { hb = building(d, hr, 0, true); if (hb) d.buildings.push(hb); } if (hb) { hb.hal = true; hb.own = true; } }
    classify(d);
    if (d.kind === 'depot' && !d.buildings.some(b => b.own)) proceduralDepot(d);
    if (d.axis == null) { const big = d.buildings.find(b => b.hal) || d.buildings.filter(b => b.own).sort((a, b) => b.area - a.area)[0]; d.axis = big ? mainAxis(big.ring) : d.terrain ? mainAxis(d.terrain) : 0; }
    layoutDocks(d);
    if (d.kind === 'depot' && !d.terrain) d.terrain = terrainAround(d);
    // rijen die buiten de terreinring vallen (bij een rechthoek om de gebouwen kan dat tot 40 m zijn) krijgen hun eigen verharding
    d.siteYard = d.terrain ? rowYards(d) : d.aprons.map(r => cleanRing(r));
    d.entrance = d.terrain ? entranceOf(d, s) : null;
    d.slots = []; d.aisles = [];
    if (d.kind === 'depot' && !d.rows.length && d.terrain) layoutSlots(d);
    const yardPts = [...(d.terrain || []), ...d.buildings.filter(b => b.own).flatMap(b => b.ring), ...(d.siteYard || []).flat()];
    d.radius = radiusOf(yardPts.length ? yardPts : [[0, 0]]); d.rAll = Math.max(d.radius, radiusOf(d.buildings.flatMap(b => b.ring)));
    d.factory = s.soort === 'fabriek' && d.terrain ? factoryLayout(d) : null;
    d.hedges = d.kind === 'depot' && d.terrain ? hedgesAround(d) : []; d.lamps = d.kind === 'depot' && d.terrain ? lampsFor(d) : []; d.floods = d.kind === 'depot' && d.terrain ? floodsFor(d) : [];
    d.trees = [...treesAround(d), ...(d.kind === 'depot' ? poplarsAlong(d, s.toegang) : [])]; d.cars = carsAtOffices(d);
    // afdelingen (borden), laadplein en de spullen op het terrein
    d.afd = readAfdelingen(d, s.afdelingen);
    d.laad = d.kind === 'depot' && d.terrain ? chargerPlaza(d, s) : null;
    d.spul = d.kind === 'depot' && d.terrain ? yardItems(d, s) : null;
  }
  // verharding voor de parkeerrijen die (deels) buiten het terrein liggen: een rechthoek om de vakken van zo'n rij
  function rowYards(d) {
    const out = [];
    for (const r of d.rows) {
      const at = (along, fwd) => [r.p0[0] + r.dir[0] * along + r.nose[0] * fwd, r.p0[1] + r.dir[1] * along + r.nose[1] * fwd];
      const a0 = -r.sp / 2 - 1.5, a1 = (r.n - 0.5) * r.sp + 1.5; const ring = [at(a0, -10.5), at(a1, -10.5), at(a1, 10.5), at(a0, 10.5)];
      if (ring.every(p => inRing(p[0], p[1], d.terrain)) && inRing(r.mid[0], r.mid[1], d.terrain)) continue;
      out.push(cleanRing(ring));
    }
    return out;
  }
  // populieren langs de toegangsweg (de echte straat van de routeergraaf naar de poort): de laatste 450 m voor het
  // terrein, aan beide kanten om de 9 m, 10 m uit het midden van de weg, met hier en daar een gat
  function poplarsAlong(d, enc) {
    let tg = null; try { tg = typeof enc === 'string' ? decodeRing(enc) : Array.isArray(enc) ? enc : null; } catch { tg = null; }
    if (!tg || tg.length < 2) return [];
    const pts = tg.map(([lo, la]) => d.toLocal(lo, la)); const out = []; const r = rng(d.seed ^ 0x9091); const Tin = d.terrain ? offsetRing(d.terrain, 4) : null; let walked = 0;
    for (let i = pts.length - 1; i > 0 && walked < 450; i--) {
      const a = pts[i], b = pts[i - 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue; const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (let s = (9 - (walked % 9)) % 9; s < L && walked + s < 450; s += 9) {
        for (const side of [-1, 1]) {
          if (r() < 0.16) continue; const x = a[0] + ux * s - uz * side * 10, z = a[1] + uz * s + ux * side * 10;
          if ((Tin && inRing(x, z, Tin)) || nearBuilding(d, x, z, 5) || nearRow(d, x, z, 3) || (d.entrance && Math.hypot(x - d.entrance.x, z - d.entrance.z) < 22)) continue;
          if ((d.siteYard || []).some(q => inRing(x, z, q))) continue;
          out.push([x, z, 2, 0.88 + r() * 0.24, 1 + Math.floor(r() * 2)]);
        }
      }
      walked += L;
    }
    return out;
  }
  // fabriek (melk, suiker, bier): silo's naast het grootste eigen gebouw, een schoorsteen en een paar liggende tanks op
  // het terrein, waar plaats is (niet in een gebouw, niet voor de docks)
  function factoryLayout(d) {
    const big = d.buildings.filter(b => b.own).sort((a, b) => b.area - a.area)[0]; if (!big) return null; const r = rng(d.seed ^ 0xFAB);
    const dockAt = (x, z, m) => d.docks.some(k => Math.hypot(x - k.x, z - k.z) < m) || (d.aprons || []).some(q => inRing(x, z, q));
    const okAt = (x, z, m) => free(d, x, z) && !nearBuilding(d, x, z, m) && !dockAt(x, z, 26) && !nearRow(d, x, z, m);
    const out = { silos: [], chimney: null, tanks: [] };
    // silo's: een blok van twee rijen langs de langste vrije gevel
    let best = null;
    for (let i = 0; i < big.ring.length; i++) { const a = big.ring[i], c = big.ring[(i + 1) % big.ring.length]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 16) continue; const n = edgeNormal(big.ring, i); let ok = 0; for (const t of [0.25, 0.5, 0.75]) if (okAt(a[0] + (c[0] - a[0]) * t + n[0] * 6, a[1] + (c[1] - a[1]) * t + n[1] * 6, 3)) ok++; if (ok >= 2 && (!best || L * ok > best.s)) best = { a, c, L, n, s: L * ok }; }
    if (best) {
      const { a, c, L, n } = best; const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L; const R = 2.4 + r() * 0.5, gap = 2 * R + 0.8; const cols = clamp(Math.floor((L * 0.6) / gap), 2, 5); const H = 17 + r() * 7; const s0 = L / 2 - (cols - 1) * gap / 2;
      for (let row = 0; row < 2; row++) for (let k = 0; k < cols; k++) { const x = a[0] + ux * (s0 + k * gap) + n[0] * (R + 1.5 + row * gap), z = a[1] + uz * (s0 + k * gap) + n[1] * (R + 1.5 + row * gap); if (!free(d, x, z) || dockAt(x, z, 20) || nearRow(d, x, z, R)) continue; out.silos.push([x, z, R, H + (hash(d.seed, k + row * 7) - 0.5) * 2]); }
    }
    // schoorsteen bij een hoek van het grootste gebouw, liggende tanks verderop op het terrein
    for (let i = 0; i < big.ring.length && !out.chimney; i++) { const p = big.ring[i]; const n = edgeNormal(big.ring, i); const x = p[0] + n[0] * 14, z = p[1] + n[1] * 14; if (okAt(x, z, 9) && !out.silos.some(s => Math.hypot(x - s[0], z - s[1]) < 14)) out.chimney = [x, z]; }
    const want = 1 + Math.floor(r() * 2);
    for (let tries = 0; tries < 40 && out.tanks.length < want; tries++) { const t = r() * big.ring.length; const i = Math.floor(t); const p = big.ring[i], q = big.ring[(i + 1) % big.ring.length]; const f = t - i; const n = edgeNormal(big.ring, i); const off = 12 + r() * 14; const x = p[0] + (q[0] - p[0]) * f + n[0] * off, z = p[1] + (q[1] - p[1]) * f + n[1] * off; if (!okAt(x, z, 8) || out.silos.some(s => Math.hypot(x - s[0], z - s[1]) < 12) || (out.chimney && Math.hypot(x - out.chimney[0], z - out.chimney[1]) < 16) || out.tanks.some(s => Math.hypot(x - s[0], z - s[1]) < 10)) continue; out.tanks.push([x, z, Math.atan2(q[1] - p[1], q[0] - p[0])]); }
    return out.silos.length || out.chimney || out.tanks.length ? out : null;
  }
  // In de gegevens staan soms opleggers, containers of overkappingen als gebouw (lang en smal, of klein midden in een
  // parkeerrij). Die laten we weg: de echte opleggers staan er al, op hun plek in de rij.
  function looseObject(d, b) {
    if (b.area > 150) return false;
    const a = mainAxis(b.ring); const rr = b.ring.map(p => rot(p[0] - b.c[0], p[1] - b.c[1], -a)); const bb = bbox(rr);
    const len = Math.max(bb[2] - bb[0], bb[3] - bb[1]), wid = Math.min(bb[2] - bb[0], bb[3] - bb[1]);
    if (len > 7.5 && len < 21 && wid < 6 && len / wid > 2.4) return true;
    return nearRow(d, b.c[0], b.c[1], 0);
  }
  function ringFrac(r, T) { let n = 0; for (const p of r) if (inRing(p[0], p[1], T)) n++; return n / r.length; }
  function radiusOf(pts) { let r = 0; for (const [x, z] of pts) r = Math.max(r, Math.hypot(x, z)); return r + 30; }
  function building(d, ring, h, own) {
    ring = cleanRing(ring); if (ring.length < 3) return null; const area = ringArea(ring); if (area < 12) return null;
    const c = centroid(ring);
    return { ring, area, c, kind: 'kantoor', h0: h || 0, h: h || 0, own: !!own, bb: bbox(ring), seed: hashStr(d.name) ^ Math.round(c[0] * 7 + c[1] * 13) };
  }
  // soort en hoogte: de bron geeft vaak geen hoogte (dan 6 m); een loods is dan 11 m, een kantoor drie lagen, een huis
  // twee lagen met een kap. De buurt: kleine panden worden woonhuizen, grote bedrijfshallen.
  function classify(d) {
    const own = d.buildings.filter(b => b.own && !b.hal); const ent = d.addr;
    // het kantoor: het grootste eigen gebouw tot 4000 m² dat het dichtst bij het adres of de poort ligt
    let office = null, od = Infinity; for (const b of own) if (b.area >= 150 && b.area < 4000) { const dd = Math.hypot(b.c[0] - ent[0], b.c[1] - ent[1]) - Math.sqrt(b.area); if (dd < od) { od = dd; office = b; } }
    for (const b of d.buildings) {
      const unknown = !b.h0 || Math.abs(b.h0 - 6) < 0.01;
      if (b.own) {
        if (b.hal || b.area >= 1800) { b.kind = 'loods'; if (unknown) b.h = b.hal ? 11.5 : 10.5; }
        else if (b === office) { b.kind = 'kantoor'; if (unknown) b.h = b.area > 600 ? 9.6 : 6.6; }
        else if (b.area >= 90) { b.kind = 'bedrijf'; if (unknown) b.h = 6.5; }
        else { b.kind = 'schuur'; if (unknown) b.h = 3.4; }
      } else {
        if (b.area >= 1800) { b.kind = 'loods'; if (unknown) b.h = 9.5; }
        else if (b.area < 260) { b.kind = 'huis'; if (unknown) b.h = 8.6; }
        else { b.kind = hash(b.seed, 9) < 0.42 ? 'kantoor' : 'bedrijf'; if (unknown) b.h = b.kind === 'kantoor' ? 9.6 : 7; }
      }
      if (b.h < 2.5) b.h = 2.5;
    }
  }
  // parkeerrijen: [[lon0, lat0, lon1, lat1, n, koers], ...] naar meters, met de plekken en de neusrichting
  function readRows(d, rijen) {
    const out = []; if (!Array.isArray(rijen)) return out;
    for (const r of rijen) {
      if (!Array.isArray(r) || r.length < 6) continue; const [lo0, la0, lo1, la1, n, koers] = r; const p0 = d.toLocal(+lo0, +la0), p1 = d.toLocal(+lo1, +la1); const h = (+koers || 0) * Math.PI / 180;
      const nose = [Math.sin(h), -Math.cos(h)]; const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); const dir = L > 0.2 ? [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L] : [-nose[1], nose[0]];
      const k = Math.max(1, Math.round(+n || 1)); const sp = k > 1 ? L / (k - 1) : SLOT_W;
      out.push({ p0, p1, n: k, h, nose, dir, sp, mid: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] });
    }
    return out;
  }
  // Zonder echte gebouwen: een loods met docks en een kantoor, op het terrein (als dat er is) of rond het adres.
  function proceduralDepot(d) {
    const f = d.s.fleet || 20; const hub = !!d.s.hub;
    const W = hub ? 110 : clamp(52 + f * 0.36, 60, 100), D = hub ? 40 : clamp(30 + f * 0.04, 30, 36), H = hub ? 11 : 10;
    let a = 0, cx = 0, cz = -30, dockSide = 1;
    if (d.terrain) {
      a = mainAxis(d.terrain); const Tax = d.terrain.map(p => rot(p[0], p[1], -a)); const tb = bbox(Tax);
      const [, av] = rot(d.addr[0], d.addr[1], -a); const mid = (tb[1] + tb[3]) / 2;
      const w = Math.min(W, (tb[2] - tb[0]) * 0.7), dd = Math.min(D, (tb[3] - tb[1]) * 0.32);
      const back = av > mid ? tb[1] + dd / 2 + 10 : tb[3] - dd / 2 - 10; dockSide = av > mid ? 1 : -1;
      const [x, z] = rot((tb[0] + tb[2]) / 2 + 8, back, a); cx = x; cz = z;
      pushBox(d, cx, cz, w, dd, a, H, 'loods');
      const [ox, oz] = rot((tb[0] + tb[2]) / 2 + 8 - w / 2 - 13.5, back + dockSide * (dd / 2 - 7), a); pushBox(d, ox, oz, 25, 14, a, hub ? 11.5 : 8, 'kantoor');
    } else {
      pushBox(d, 0, cz, W, D, 0, H, 'loods'); pushBox(d, -W / 2 - 13.5, cz + D / 2 - 7, 25, 14, 0, hub ? 11.5 : 8, 'kantoor');
    }
    d.procedural = true; d.dockSide = dockSide; d.axis = a;
  }
  function pushBox(d, cx, cz, w, dd, a, h, kind) { const ring = [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2]].map(([u, v]) => { const [x, z] = rot(u, v, a); return [cx + x, cz + z]; }); const b = building(d, ring, h, true); b.kind = kind; b.own = true; if (kind === 'loods') b.hal = true; d.buildings.push(b); }
  // terrein rond de eigen gebouwen als er geen contour is: omhullende plus de schortjes voor de docks en ruimte om te parkeren
  function terrainAround(d) {
    const own = d.buildings.filter(b => b.own); const pts = own.flatMap(b => b.ring);
    for (const ap of d.aprons) pts.push(...ap);
    for (const r of d.rows) pts.push([r.p0[0] - r.nose[0] * 10, r.p0[1] - r.nose[1] * 10], [r.p1[0] + r.nose[0] * 10, r.p1[1] + r.nose[1] * 10]);
    if (d.procedural) { const a = d.axis; const big = own.slice().sort((x, y) => y.area - x.area)[0]; const rows = (d.s.fleet || 20) >= 60 ? 2 : 1; const depth = 34 + rows * (AISLE + 2 * SLOT_L) + 8; const sgn = d.dockSide || 1; const bb = bbox(big.ring.map(p => rot(p[0], p[1], -a))); const vEdge = sgn > 0 ? bb[3] : bb[1]; for (const uu of [bb[0] - 30, bb[2] + 22]) { pts.push(rot(uu, vEdge + sgn * depth, a)); pts.push(rot(uu, (sgn > 0 ? bb[1] : bb[3]) - sgn * 12, a)); } }
    return cleanRing(offsetRing(hull(pts), 10));
  }
  // ---------- docks: deuren aan de lange zijde van de hal waar de rijen staan (en aan grote loodsen met ruimte ervoor) ----------
  function free(d, x, z) { if (d.terrain && !inRing(x, z, d.terrain)) return false; for (const b of d.buildings) if (x > b.bb[0] - 1 && x < b.bb[2] + 1 && z > b.bb[1] - 1 && z < b.bb[3] + 1 && inRing(x, z, b.ring)) return false; return true; }
  // Het aantal docks komt uit de gegevens (sp.docks) als dat er is, anders uit de lengte van de gevel. Nummering 1 tot n
  // langs de dockzijde, van links naar rechts gezien vanaf het terrein: hetzelfde nummer als op het hal-scherm en het
  // planbord (blok.dock), zodat een voertuig dat laadt of lost aan zijn eigen deur staat.
  function layoutDocks(d) {
    d.docks = []; d.aprons = [];
    // De gegevens geven de deuren zelf (sp.dockPlek: [lon, lat, koers] voor dock 1, 2, ..., de deur in de gevel van de
    // hal, de koers van de gevel af): dan staan ze precies daar, in die volgorde genummerd. Anders zelf indelen.
    if (dataDocks(d)) return;
    const want = Math.max(0, Math.round(+((d.s && d.s.docks) || 0)) || 0);
    const lo = d.buildings.filter(b => b.own && b.kind === 'loods' && (b.hal || b.area >= 2500)).sort((a, b) => (b.hal - a.hal) || (b.area - a.area));
    const edges = [];
    lo.forEach((b, bi) => {
      const cand = [];
      for (let i = 0; i < b.ring.length; i++) {
        const a = b.ring[i], c = b.ring[(i + 1) % b.ring.length]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 22) continue; const n = edgeNormal(b.ring, i);
        let ok = 0; for (const t of [0.15, 0.32, 0.5, 0.68, 0.85]) { const x = a[0] + (c[0] - a[0]) * t + n[0] * 22, z = a[1] + (c[1] - a[1]) * t + n[1] * 22; if (free(d, x, z)) ok++; }
        if (d.procedural && d.dockSide) { const [, nv] = rot(n[0], n[1], -d.axis); if (Math.sign(nv) !== d.dockSide || Math.abs(nv) < 0.7) ok = 0; }
        // rijen voor deze gevel (binnen 70 m ervoor, niet ver opzij): daar staan de opleggers en trekkers, daar zitten de docks
        const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L; let rows = 0;
        for (const r of d.rows) { const vx = r.mid[0] - mx, vz = r.mid[1] - mz; const fwd = vx * n[0] + vz * n[1], side = Math.abs(vx * ux + vz * uz); if (fwd > 2 && fwd < 70 && side < L / 2 + 8) rows++; }
        if (ok >= 3 || rows) cand.push({ b, i, L, n, a, c, score: L * Math.max(ok, 2) * (1 + rows * 1.5), rows });
      }
      cand.sort((x, y) => y.score - x.score);
      // de hal: de beste gevel en, als die ook rijen voor zich heeft of er meer docks nodig zijn, de tweede; andere loodsen één
      const take = cand.filter((e, k) => k === 0 || (bi === 0 && k < (want ? 3 : 2) && (e.rows || !d.rows.length || want) && e.score > cand[0].score * 0.3)).slice(0, bi === 0 ? (want ? 3 : 2) : 1);
      edges.push(...take);
    });
    let left = want || Infinity;
    for (const e of edges) {
      if (left <= 0) break;
      const ux = (e.c[0] - e.a[0]) / e.L, uz = (e.c[1] - e.a[1]) / e.L; const room = e.L - 10;
      // Staat er een parkeerrij vlak voor deze gevel (evenwijdig, de neus van de gevel af, binnen 30 m), dan komen de
      // deuren precies achter de plekken van die rij: wie daar staat, staat aan een dock.
      let at = [];
      for (const r of d.rows) {
        if (Math.abs(r.dir[0] * ux + r.dir[1] * uz) < 0.97 || r.nose[0] * e.n[0] + r.nose[1] * e.n[1] < 0.8) continue;
        const dist = (r.p0[0] - e.a[0]) * e.n[0] + (r.p0[1] - e.a[1]) * e.n[1]; if (dist < 3 || dist > 30) continue;
        r.dock = true; for (let j = 0; j < r.n; j++) { const s = (r.p0[0] + r.dir[0] * j * r.sp - e.a[0]) * ux + (r.p0[1] + r.dir[1] * j * r.sp - e.a[1]) * uz; if (s >= 4 && s <= e.L - 4) at.push(s); }
      }
      at.sort((p, q) => p - q); at = at.filter((s, i) => i === 0 || s - at[i - 1] > 2.5);
      if (at.length >= 2) {
        // een opgegeven aantal: zo nodig aanvullen om de 4,4 m buiten het stuk met rijen, of inkorten
        if (want && at.length < left) { for (let s = at[0] - 4.4; s >= 5 && at.length < left; s -= 4.4) at.unshift(s); for (let s = at[at.length - 1] + 4.4; s <= e.L - 5 && at.length < left; s += 4.4) at.push(s); }
        if (want && at.length > left) at = at.slice(0, left);
      } else {
        // om de 4,4 m; bij een opgegeven aantal zo nodig dichter op elkaar (tot 3,8 m)
        let k = Math.floor(room / 4.4) + 1, sp = 4.4;
        if (want) { k = Math.min(left, Math.floor(room / 3.8) + 1); sp = k > 1 ? Math.min(4.4, room / (k - 1)) : 0; }
        if (k < (want ? 1 : 2)) continue;
        const s0 = (e.L - (k - 1) * sp) / 2; at = Array.from({ length: k }, (_, j) => s0 + j * sp);
      }
      const doors = [];
      for (const s of at) { const x = e.a[0] + ux * s, z = e.a[1] + uz * s; if (!free(d, x + e.n[0] * 6, z + e.n[1] * 6)) continue; doors.push({ x, z, s, nx: e.n[0], nz: e.n[1], ux, uz, b: e.b }); }
      if (!doors.length || (!want && doors.length < 2)) continue;
      // van links naar rechts, gezien vanaf het terrein met het gezicht naar de gevel (rechts = (nz, −nx))
      const rx = e.n[1], rz = -e.n[0]; doors.sort((p, q) => (p.x * rx + p.z * rz) - (q.x * rx + q.z * rz));
      d.docks.push(...doors); left -= doors.length;
      let sMin = Infinity, sMax = -Infinity; for (const p of doors) { sMin = Math.min(sMin, p.s); sMax = Math.max(sMax, p.s); }
      const ex = 3, depth = 22; const A = [e.a[0] + ux * (sMin - ex), e.a[1] + uz * (sMin - ex)], B = [e.a[0] + ux * (sMax + ex), e.a[1] + uz * (sMax + ex)];
      d.aprons.push([A, B, [B[0] + e.n[0] * depth, B[1] + e.n[1] * depth], [A[0] + e.n[0] * depth, A[1] + e.n[1] * depth]]);
    }
    d.docks.forEach((k, i) => { k.no = i + 1; });
  }
  function dataDocks(d) {
    const plek = d.s && Array.isArray(d.s.dockPlek) ? d.s.dockPlek.filter(q => Array.isArray(q) && isFinite(+q[0]) && isFinite(+q[1])) : [];
    if (!plek.length) return false;
    const own = d.buildings.filter(b => b.own);
    plek.forEach(([lo, la, k], i) => {
      const [x, z] = d.toLocal(+lo, +la); const h = (+k || 0) * Math.PI / 180; const nx = Math.sin(h), nz = -Math.cos(h);
      let b = null, bd = 12; for (const o of own) { const e = nearestOnRing(x, z, o.ring); if (e.d < bd) { bd = e.d; b = o; } }
      d.docks.push({ x, z, nx, nz, ux: nz, uz: -nx, b, no: i + 1 });
    });
    // schort voor elke rij deuren met dezelfde koers (een gat van meer dan 12 m begint een nieuwe rij)
    const groups = new Map();
    for (const k of d.docks) { const key = Math.round(Math.atan2(k.nx, -k.nz) * 36 / Math.PI); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(k); }
    for (const list of groups.values()) {
      const u = [list[0].ux, list[0].uz], n = [list[0].nx, list[0].nz]; const along = k => k.x * u[0] + k.z * u[1];
      list.sort((a, b) => along(a) - along(b)); let run = [list[0]];
      const flush = () => { const f = run[0], l = run[run.length - 1]; const ex = 3, depth = 22; const A = [f.x - u[0] * ex, f.z - u[1] * ex], B = [l.x + u[0] * ex, l.z + u[1] * ex]; d.aprons.push([A, B, [B[0] + n[0] * depth, B[1] + n[1] * depth], [A[0] + n[0] * depth, A[1] + n[1] * depth]]); };
      for (let i = 1; i < list.length; i++) { if (along(list[i]) - along(list[i - 1]) > 12) { flush(); run = []; } run.push(list[i]); }
      flush();
    }
    d.dataDocks = true; return true;
  }
  // houding van een voertuig met halve lengte hl dat achteruit aan dock k (1 tot n) van zijn standplaats staat; bij docks
  // uit de gegevens (sp.dockPlek) niet nodig: daar komt het voertuig al met zijn plek en koers aan de deur
  function dockPose(base, k, hl) {
    const d = byName.get(base); if (!d || !ensure(d) || d.dataDocks || !d.docks.length || d.gx == null) return null;
    const door = d.docks[(Math.max(1, Math.round(k)) - 1) % d.docks.length];
    const [x, z] = toScene(d, door.x + door.nx * (hl + 0.6), door.z + door.nz * (hl + 0.6)); return { x, z, ang: Math.atan2(-door.nx, -door.nz) };
  }
  // ---------- poort: waar de toegangsroute het terrein op komt; anders het randpunt bij de poort of het adres ----------
  function entranceOf(d, s) {
    const T = d.terrain; let tg = null;
    try { tg = typeof s.toegang === 'string' ? decodeRing(s.toegang) : Array.isArray(s.toegang) ? s.toegang : null; } catch { tg = null; }
    if (tg && tg.length >= 2) {
      const pts = tg.map(([lo, la]) => d.toLocal(lo, la));
      // van de poort terug naar de weg: het laatste stuk dat van buiten naar binnen gaat
      for (let i = pts.length - 1; i > 0; i--) {
        const a = pts[i - 1], b = pts[i]; if (inRing(a[0], a[1], T) || !inRing(b[0], b[1], T)) continue;
        let hit = null, ht = -1;
        for (let k = 0; k < T.length; k++) { const p = T[k], q = T[(k + 1) % T.length]; const t = segHit(a, b, p, q); if (t != null && t > ht) { ht = t; hit = { t, k }; } }
        if (hit) { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return { x: a[0] + dx * hit.t, z: a[1] + dz * hit.t, nx: dx / L, nz: dz / L, i: hit.k }; }
      }
    }
    const pt = Array.isArray(s.poort) ? d.toLocal(+s.poort[0], +s.poort[1]) : d.addr;
    const e = nearestOnRing(pt[0], pt[1], T); const n = edgeNormal(T, e.i);
    return { x: e.x, z: e.z, nx: -n[0], nz: -n[1], i: e.i };
  }
  // snijpunt van lijnstuk a-b met p-q: de fractie langs a-b, of null
  function segHit(a, b, p, q) { const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = q[0] - p[0], s1 = q[1] - p[1]; const den = r0 * s1 - r1 * s0; if (Math.abs(den) < 1e-9) return null; const t = ((p[0] - a[0]) * s1 - (p[1] - a[1]) * s0) / den, u = ((p[0] - a[0]) * r1 - (p[1] - a[1]) * r0) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null; }
  // ---------- parkeervakken zonder rijen in de gegevens: dubbele rijen langs de hoofdrichting ----------
  function layoutSlots(d) {
    const T = d.terrain, a = d.axis; const toAx = p => rot(p[0], p[1], -a);
    const Tax = T.map(toAx); const tb = bbox(Tax);
    const bl = d.buildings.map(b => { const r = offsetRing(b.ring, 3).map(toAx); return { r, bb: bbox(r) }; });
    const ap = d.aprons.map(r => { const rr = r.map(toAx); return { r: rr, bb: bbox(rr) }; });
    const ent = d.entrance; const [eu, ev] = toAx([ent.x + ent.nx * 12, ent.z + ent.nz * 12]);
    const period = AISLE + 2 * SLOT_L;
    for (let base = tb[1] + 2; base + AISLE + SLOT_L <= tb[3]; base += period) {
      d.aisles.push(base + AISLE / 2);
      for (const [vc, face] of [[base + AISLE + SLOT_L / 2, -1], [base + AISLE + 1.5 * SLOT_L, 1]]) {
        for (let u = tb[0] + 2 + SLOT_W / 2; u <= tb[2] - 2 - SLOT_W / 2; u += SLOT_W) {
          if (!rectInRing(u, vc, SLOT_W / 2 - 0.1, SLOT_L / 2 - 0.1, 0, Tax)) continue;
          if (bl.some(b => rectHitsRing(u, vc, SLOT_W / 2, SLOT_L / 2, 0, b.r, b.bb))) continue;
          if (ap.some(b => rectHitsRing(u, vc, SLOT_W / 2, SLOT_L / 2, 0, b.r, b.bb))) continue;
          if (Math.hypot(u - eu, vc - ev) < 26) continue;
          const [x, z] = rot(u, vc, a); d.slots.push({ x, z, u, v: vc, face });
        }
      }
    }
  }
  // de koers van de parkeerplek op dit punt (voor een oplegger die zonder koers binnenkomt): de dichtstbijzijnde plek in de rijen
  function rowHeading(base, lon, lat) {
    const d = byName.get(base); if (!d || !d.prepared || !d.rows.length) return null; const [x, z] = d.toLocal(lon, lat); let best = null, bd = 6;
    for (const r of d.rows) { const vx = x - r.p0[0], vz = z - r.p0[1]; const along = clamp(vx * r.dir[0] + vz * r.dir[1], -r.sp, (r.n - 1) * r.sp + r.sp); const px = r.p0[0] + r.dir[0] * along, pz = r.p0[1] + r.dir[1] * along; const dd = Math.hypot(x - px, z - pz); if (dd < bd) { bd = dd; best = r; } }
    return best ? -best.h : null;
  }
  // ---------- hagen, bomen, lantaarnpalen en auto's rond het terrein ----------
  function nearBuilding(d, x, z, m) { for (const b of d.buildings) { if (x < b.bb[0] - m || x > b.bb[2] + m || z < b.bb[1] - m || z > b.bb[3] + m) continue; if (inRing(x, z, b.ring)) return true; if (m > 0 && nearestOnRing(x, z, b.ring).d < m) return true; } return false; }
  function nearRow(d, x, z, m) { for (const r of d.rows) { const vx = x - r.p0[0], vz = z - r.p0[1]; const along = vx * r.dir[0] + vz * r.dir[1], across = vx * r.nose[0] + vz * r.nose[1]; if (along > -r.sp / 2 - m && along < (r.n - 0.5) * r.sp + m && Math.abs(across) < 9.5 + m) return true; } return false; }
  // autokleuren zoals op een Nederlandse parkeerplaats: veel wit, zwart, grijs en zilver, een enkele kleur
  const CAR_COLORS = [[0xF2F3F4, 25], [0x1C1F24, 20], [0x6E7378, 18], [0xB8BDC2, 15], [0x1F3E6B, 9], [0x9A1B1F, 6], [0x2F5D3A, 3], [0x8A6A3A, 4]];
  function carColor(r) { let x = r() * 100; for (const [c, w] of CAR_COLORS) { x -= w; if (x <= 0) return c; } return CAR_COLORS[0][0]; }
  function carsAtOffices(d) {
    const out = []; const r = rng(d.seed ^ 0xCA2); const a = d.axis || 0; const slotsAx = (d.slots || []).map(s => [s.u, s.v]);
    const freeCar = (x, z) => { if (d.terrain && !inRing(x, z, d.terrain)) return false; if (nearBuilding(d, x, z, 1.6)) return false; if (nearRow(d, x, z, 1.5)) return false; const [u, v] = rot(x, z, -a); for (const [su, sv] of slotsAx) if (Math.abs(u - su) < 3.4 && Math.abs(v - sv) < 10.5) return false; for (const ap of d.aprons || []) if (inRing(x, z, ap)) return false; if (d.entrance && Math.hypot(x - d.entrance.x, z - d.entrance.z) < 18) return false; return true; };
    for (const b of d.buildings.filter(b => b.own && b.kind === 'kantoor')) {
      let best = null; for (let i = 0; i < b.ring.length; i++) { const p = b.ring[i], q = b.ring[(i + 1) % b.ring.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 10) continue; const n = edgeNormal(b.ring, i); let ok = 0; for (const t of [0.2, 0.5, 0.8]) if (freeCar(p[0] + (q[0] - p[0]) * t + n[0] * 7, p[1] + (q[1] - p[1]) * t + n[1] * 7)) ok++; if (ok >= 2 && (!best || L * ok > best.score)) best = { p, q, L, n, score: L * ok }; }
      if (!best) continue; const { p, q, L, n } = best; const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L;
      for (const off of [6.5, 12.2]) for (let s = 2; s < L + 6; s += 2.7) { const x = p[0] + ux * s + n[0] * off, z = p[1] + uz * s + n[1] * off; if (!freeCar(x, z) || r() < 0.18) continue; out.push([x, z, Math.atan2(n[0], n[1]) + (off > 9 ? Math.PI : 0), carColor(r)]); }
    }
    return out;
  }
  function hedgesAround(d) {
    const out = []; const R = offsetRing(d.terrain, 1.4); const e = d.entrance;
    for (let i = 0; i < R.length; i++) {
      const a = R[i], b = R[(i + 1) % R.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 12));
      for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0, x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1; const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; if (e && Math.hypot(mx - e.x, mz - e.z) < 11 + L / n / 2) continue; if (nearBuilding(d, mx, mz, 3) || nearRow(d, mx, mz, 0)) continue; out.push([mx, mz, Math.hypot(x1 - x0, z1 - z0) + 0.3, Math.atan2(z1 - z0, x1 - x0), hash(d.seed, i * 31 + k)]); }
    }
    return out;
  }
  function treesAround(d) {
    const out = []; const R = d.terrain ? offsetRing(d.terrain, 5) : null; const r = rng(d.seed ^ 0x51ED); const e = d.entrance; const Tin = d.terrain ? offsetRing(d.terrain, 3) : null;
    const okAt = (x, z, m) => !nearBuilding(d, x, z, m) && !(Tin && inRing(x, z, Tin)) && !(e && Math.hypot(x - e.x, z - e.z) < 24) && !nearRow(d, x, z, 2);
    if (R && d.kind === 'depot') for (let i = 0; i < R.length; i++) {
      const a = R[i], b = R[(i + 1) % R.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 4 + r() * 5; s < L - 3; s += 10 + r() * 4) { const t = s / L; const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; if (okAt(x, z, 3)) { const t2 = r(); out.push([x, z, t2 < 0.55 ? 0 : t2 < 0.82 ? 3 : 2, 0.85 + r() * 0.3, Math.floor(r() * TREE_TINTS.length)]); } }
    }
    // groepjes bomen in een band rond het terrein (bosjes, tuinen, groenstroken): elk groepje één soort, wisselende maat
    const rad = d.radius || 120; const groups = Math.round(clamp(rad * 0.06, 5, 16));
    for (let g = 0; g < groups; g++) {
      const ang = r() * Math.PI * 2, dist = rad * (0.85 + r() * 0.7); const gx = Math.cos(ang) * dist, gz = Math.sin(ang) * dist; const tt = r(); const type = tt < 0.42 ? 0 : tt < 0.64 ? 3 : tt < 0.84 ? 1 : 2; const n = 3 + Math.floor(r() * 7); const tint = Math.floor(r() * TREE_TINTS.length);
      for (let k = 0; k < n; k++) { const a2 = r() * Math.PI * 2, d2 = Math.sqrt(r()) * (type === 2 ? 6 : 14); const x = gx + Math.cos(a2) * d2 * (type === 2 ? 3 : 1), z = gz + Math.sin(a2) * d2; if (!okAt(x, z, 4)) continue; out.push([x, z, type, 0.72 + r() * 0.6, (tint + (r() < 0.3 ? 1 : 0)) % TREE_TINTS.length]); }
    }
    return out;
  }
  function lampsFor(d) {
    const out = []; const T = d.terrain; const e = d.entrance; const In = offsetRing(T, -3);
    for (let i = 0; i < In.length; i++) { const a = In[i], b = In[(i + 1) % In.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = edgeNormal(In, i); for (let s = 20; s < L - 10; s += 46) { const x = a[0] + (b[0] - a[0]) * s / L, z = a[1] + (b[1] - a[1]) * s / L; if (nearBuilding(d, x, z, 4) || nearRow(d, x, z, 0.5)) continue; out.push([x, z, Math.atan2(-n[1], -n[0])]); } }
    // langs de inrit: aan beide kanten om de 18 m
    if (e) for (let s = 8; s < 70; s += 18) for (const side of [-1, 1]) { const x = e.x + e.nx * s - e.nz * side * 8, z = e.z + e.nz * s + e.nx * side * 8; if (!inRing(x, z, T) || nearBuilding(d, x, z, 3) || nearRow(d, x, z, 0.5)) continue; out.push([x, z, Math.atan2(-side * e.nx, side * e.nz)]); }
    return out;
  }

  // ---------- afdelingen, laadplein en spullen op het terrein ----------
  // Afdelingen uit de gegevens (sp.afdelingen: [{ naam, soort, p: [lon, lat], gebouw?, bron }]): een naambord op het dak
  // van het gebouw (gebouw: de index in de gebouwen van de plek), boven de dockdeuren of boven het gebied. Zonder dat
  // veld geen borden. prio: wat voorgaat als twee borden elkaar op het scherm raken.
  const AFD_PRIO = { kantoor: 0, loods: 1, garage: 2, wasstraat: 2, docks: 3, laadplein: 4, opleggers: 5, poort: 6 };
  function readAfdelingen(d, list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const a of list) {
      if (!a || !a.naam || !Array.isArray(a.p) || !isFinite(+a.p[0]) || !isFinite(+a.p[1])) continue;
      let [x, z] = d.toLocal(+a.p[0], +a.p[1]); const b = a.gebouw != null ? d.buildings.find(o => o.src === +a.gebouw) : null; let y;
      if (b) y = b.h + (b.kind === 'loods' ? 1.6 : 1.2);
      else if (a.soort === 'docks' && d.docks.length) {
        // boven de deuren, iets van de gevel af (het punt uit de gegevens ligt vaak op de gevel zelf)
        let k = d.docks[0], kd = Infinity; for (const q of d.docks) { const dd = Math.hypot(q.x - x, q.z - z); if (dd < kd) { kd = dd; k = q; } }
        x = k.x + k.nx * 2.5 + (x - k.x) * 0.3; z = k.z + k.nz * 2.5 + (z - k.z) * 0.3; y = 7.4;
      } else y = a.soort === 'opleggers' ? 5.6 : 4.6;
      out.push({ naam: String(a.naam).slice(0, 40), soort: String(a.soort || ''), x, z, y, prio: AFD_PRIO[a.soort] ?? 7 });
    }
    return out;
  }
  // Laadplein: laadpalen voor de elektrische trekkers op een betonnen eiland langs een rij, één paal per twee plekken,
  // met een trafokast en gele paaltjes aan de koppen. Waar: het laadplein uit de afdelingen (soort laadplein), anders de
  // rij die het dichtst bij het kantoor ligt. Hoeveel: sp.laadpunten, anders zoals laadpunten() in places.js (hub 24,
  // warehouse 12, anders 4). Het eiland komt achter de rij, of voor de neuzen als daar een andere rij staat.
  const LAADPUNTEN = s => Math.max(0, Math.round(+s.laadpunten || (s.hub ? 24 : s.wh ? 12 : 4)));
  function nearRowOne(r, x, z, m) { const vx = x - r.p0[0], vz = z - r.p0[1]; const along = vx * r.dir[0] + vz * r.dir[1], across = vx * r.nose[0] + vz * r.nose[1]; return along > -r.sp / 2 - m && along < (r.n - 0.5) * r.sp + m && Math.abs(across) < 9.5 + m; }
  function chargerPlaza(d, s) {
    const n = LAADPUNTEN(s); if (!n || !d.rows.length) return null;
    const a = Array.isArray(s.afdelingen) ? s.afdelingen.find(q => q && q.soort === 'laadplein' && Array.isArray(q.p)) : null;
    const office = d.buildings.find(b => b.own && b.kind === 'kantoor') || d.buildings.find(b => b.hal);
    const target = a ? d.toLocal(+a.p[0], +a.p[1]) : office ? office.c : d.addr;
    // de rijen bij het doel (hun dichtstbijzijnde plek binnen 160 m), dichtstbij eerst; hooguit drie eilanden
    const cand = [];
    for (const r of d.rows) { if (r.dock || r.n < 2) continue; let bj = 0, bd = Infinity; for (let j = 0; j < r.n; j++) { const dd = Math.hypot(r.p0[0] + r.dir[0] * j * r.sp - target[0], r.p0[1] + r.dir[1] * j * r.sp - target[1]); if (dd < bd) { bd = dd; bj = j; } } if (bd < 160) cand.push({ r, j: bj, dist: bd }); }
    cand.sort((p, q) => p.dist - q.dist);
    const islands = [], posts = []; let left = Math.ceil(n / 2);
    for (const { r, j } of cand) {
      if (left <= 0 || islands.length >= 3) break;
      const k = Math.min(left, Math.floor(r.n / 2)); if (k < 1) continue;
      const j0 = clamp(j - k + 1, 0, Math.max(0, r.n - 2 * k));
      const at = (along, fwd) => [r.p0[0] + r.dir[0] * along + r.nose[0] * fwd, r.p0[1] + r.dir[1] * along + r.nose[1] * fwd];
      const others = d.rows.filter(q => q !== r);
      const clear = fwd => { for (let q = 0; q <= 2 * k; q++) { const [x, z] = at((j0 + q - 0.5) * r.sp, fwd); if (!free(d, x, z) || nearBuilding(d, x, z, 1) || others.some(o => nearRowOne(o, x, z, 0.3)) || posts.some(p => Math.hypot(p[0] - x, p[1] - z) < 3)) return false; } return true; };
      const fwd = clear(-10.2) ? -10.2 : clear(9.4) ? 9.4 : null; if (fwd == null) continue;
      const own = []; for (let q = 0; q < k; q++) own.push(at((j0 + 2 * q + 0.5) * r.sp, fwd));
      islands.push({ r, posts: own, fwd, from: (j0 - 0.5) * r.sp, to: (j0 + 2 * k - 0.5) * r.sp }); posts.push(...own); left -= k;
    }
    return islands.length ? { islands, posts, n: Math.min(n, posts.length * 2) } : null;
  }
  // Spullen op het terrein: stapels pallets langs een gevel van de hal zonder docks, een paar zeecontainers langs de rand
  // van het terrein (gedekte kleuren, geen merk) en een tankstation als de notitie of de afdelingen dat noemen. Vaste
  // plekken per standplaats (een toevalsreeks op de naam); nooit op een rij, een schort, de inrit of tegen een lamp.
  const CONT = [P.contBlauw, P.contRood, P.contGroen, P.contGrijs];
  function yardItems(d, s) {
    const r = rng(d.seed ^ 0x5A11); const out = { pallets: [], containers: [], tank: null }; const taken = [];
    const lamps = [...(d.lamps || []), ...(d.floods || [])];
    const okAt = (x, z, m) => free(d, x, z) && !nearBuilding(d, x, z, m) && !nearRow(d, x, z, m) && !(d.aprons || []).some(q => inRing(x, z, q) || nearestOnRing(x, z, q).d < m)
      && !(d.entrance && Math.hypot(x - d.entrance.x, z - d.entrance.z) < 32) && !(d.cars || []).some(c => Math.hypot(x - c[0], z - c[1]) < 3 + m)
      && !lamps.some(l => Math.hypot(x - l[0], z - l[1]) < 1.5 + m) && !taken.some(t => Math.hypot(x - t[0], z - t[1]) < t[2] + m)
      && !(d.laad && d.laad.posts.some(p => Math.hypot(x - p[0], z - p[1]) < 5 + m));
    // pallets: hooguit drie groepjes van twee tot zes stapels, 2,2 m van een gevel van de hal waar geen docks zitten
    const hal = d.buildings.find(b => b.hal) || d.buildings.filter(b => b.own && b.kind === 'loods').sort((p, q) => q.area - p.area)[0];
    if (hal) {
      const edges = [];
      for (let i = 0; i < hal.ring.length; i++) {
        const a = hal.ring[i], c = hal.ring[(i + 1) % hal.ring.length]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 14) continue; const nn = edgeNormal(hal.ring, i);
        const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
        if (d.docks.some(k => { const u = (k.x - a[0]) * ux + (k.z - a[1]) * uz, v = (k.x - a[0]) * nn[0] + (k.z - a[1]) * nn[1]; return u > -6 && u < L + 6 && Math.abs(v) < 5; })) continue;
        edges.push({ a, L, nn, ux, uz });
      }
      for (let t = 0; t < 36 && out.pallets.length < 14 && edges.length; t++) {
        const e = edges[Math.floor(r() * edges.length)]; const s0 = 3 + r() * Math.max(1, e.L - 14); const cnt = 2 + Math.floor(r() * 5); const cells = [];
        for (let q = 0; q < cnt; q++) { const along = s0 + q * 1.5; if (along > e.L - 2) break; const x = e.a[0] + e.ux * along + e.nn[0] * 2.2, z = e.a[1] + e.uz * along + e.nn[1] * 2.2; if (!okAt(x, z, 0.6)) break; cells.push([x, z]); }
        if (cells.length < 2) continue;
        for (const [x, z] of cells) out.pallets.push([x, z, Math.atan2(e.uz, e.ux), 4 + Math.floor(r() * 9)]);
        const m = cells[Math.floor(cells.length / 2)]; taken.push([m[0], m[1], cells.length * 0.9 + 1]);
      }
    }
    // zeecontainers: 20 of 40 voet, evenwijdig aan de rand, 5,5 m binnen het terrein; op een hub soms twee hoog
    const want = s.hub ? 4 : s.wh ? 3 : 1 + Math.floor(r() * 2); const In = offsetRing(d.terrain, -5.5);
    for (let t = 0; t < 80 && out.containers.length < want && In.length > 2; t++) {
      const i = Math.floor(r() * In.length); const a = In[i], c = In[(i + 1) % In.length]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const len = r() < 0.45 ? 6.06 : 12.19; if (L < len + 6) continue; const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
      const along = len / 2 + 3 + r() * (L - len - 6); const x = a[0] + ux * along, z = a[1] + uz * along;
      if (![[0, 0], [len / 2 - 0.3, 0], [-len / 2 + 0.3, 0], [0, 1.0], [0, -1.0]].every(([u, v]) => okAt(x + ux * u - uz * v, z + uz * u + ux * v, 0.8))) continue;
      out.containers.push([x, z, Math.atan2(uz, ux), len, CONT[Math.floor(r() * CONT.length)], s.hub && r() < 0.35 ? CONT[Math.floor(r() * CONT.length)] : null]);
      taken.push([x, z, len / 2 + 1.5]);
    }
    // tankstation (notitie of afdeling): een overkapping van 12 bij 7 m met twee pompeilanden, bij de afdeling of bij de inrit
    const tk = Array.isArray(s.afdelingen) ? s.afdelingen.find(q => q && /tank/i.test(q.soort || '') && Array.isArray(q.p)) : null;
    if (tk || /tankstation|brandstof|dieselpomp|\btank\b|\bpomp\b/i.test(s.note || '')) {
      const pts = []; if (tk) pts.push(d.toLocal(+tk.p[0], +tk.p[1]));
      if (d.entrance) { const e = d.entrance; for (let q = 0; q < 24; q++) { const ang = q * 0.785, rr = 34 + (q >> 3) * 12; pts.push([e.x + e.nx * 30 + Math.cos(ang) * rr, e.z + e.nz * 30 + Math.sin(ang) * rr]); } }
      for (const [x, z] of pts) { const a = d.axis || 0; if ([[0, 0], [6, 3.5], [-6, 3.5], [6, -3.5], [-6, -3.5]].every(([u, v]) => { const [ox, oz] = rot(u, v, a); return okAt(x + ox, z + oz, 1.5); })) { out.tank = [x, z, a]; break; } }
    }
    return out;
  }
  // laadpalen, eiland, trafokast en paaltjes (per eiland)
  function chargerGeo(Bd, d) {
    if (!d.laad) return;
    for (const Lp of d.laad.islands) {
      const r = Lp.r; const a = Math.atan2(r.dir[1], r.dir[0]);
      const at = (along, fwd) => [r.p0[0] + r.dir[0] * along + r.nose[0] * fwd, r.p0[1] + r.dir[1] * along + r.nose[1] * fwd];
      const [ix, iz] = at((Lp.from + Lp.to) / 2, Lp.fwd); obox(Bd, ix, 0.08, iz, Lp.to - Lp.from + 1.2, 0.16, 1.5, a, PU(P.beton));
      for (const [x, z] of Lp.posts) {
        obox(Bd, x, 1.1, z, 0.55, 1.9, 0.32, a, PU(P.wit)); obox(Bd, x, 1.75, z, 0.42, 0.42, 0.34, a, PU(P.laadLed));
        obox(Bd, x, 2.1, z, 0.58, 0.08, 0.36, a, PU(P.grijsLicht)); obox(Bd, x, 1.15, z, 0.12, 0.5, 0.42, a, PU(P.inkt));
      }
      for (const end of [Lp.from - 0.4, Lp.to + 0.4]) for (const off of [-0.45, 0.45]) { const [x, z] = at(end, Lp.fwd + off); obox(Bd, x, 0.66, z, 0.16, 1.0, 0.16, a, PU(P.veiligGeel)); }
      const [tx, tz] = at(Lp.to + 2.4, Lp.fwd); if (free(d, tx, tz) && !nearRow(d, tx, tz, 0)) { obox(Bd, tx, 1.12, tz, 2.6, 2.1, 1.4, a, PU(P.grijsLicht)); obox(Bd, tx, 2.24, tz, 2.8, 0.14, 1.6, a, PU(P.hek)); }
    }
  }
  function yardItemsGeo(Bd, d) {
    const S = d.spul; if (!S) return;
    for (const [x, z, a, k] of S.pallets) { const h = k * 0.144; obox(Bd, x, h / 2, z, 1.2, h, 0.8, a, PU(P.hout)); obox(Bd, x, 0.05, z, 1.22, 0.1, 0.82, a, PU(P.rubber)); }
    for (const [x, z, a, len, col, top] of S.containers) {
      for (const [y0, cc] of [[0, col], ...(top ? [[2.59, top]] : [])]) {
        obox(Bd, x, y0 + 1.295, z, len, 2.59, 2.44, a, PU(cc));
        // ribbels op de zijwanden en de deuren aan de kop
        for (let u = -len / 2 + 0.9; u < len / 2 - 0.5; u += 1.1) for (const sd of [-1, 1]) { const [ox, oz] = rot(u, sd * 1.23, a); obox(Bd, x + ox, y0 + 1.3, z + oz, 0.12, 2.3, 0.04, a, PU(P.hek)); }
        const [dx, dz] = rot(len / 2 + 0.01, 0, a); for (const v of [-0.6, 0.6]) { const [vx, vz] = rot(0, v, a); obox(Bd, x + dx + vx, y0 + 1.3, z + dz + vz, 0.04, 2.3, 0.07, a, PU(P.staal)); }
      }
    }
    if (S.tank) {
      const [x, z, a] = S.tank; const P0 = (u, v) => { const [ox, oz] = rot(u, v, a); return [x + ox, z + oz]; };
      for (const [u, v] of [[-5, -2.6], [5, -2.6], [-5, 2.6], [5, 2.6]]) { const [cx, cz] = P0(u, v); obox(Bd, cx, 2.7, cz, 0.35, 5.4, 0.35, a, PU(P.grijsLicht)); }
      obox(Bd, x, 5.6, z, 12, 0.5, 7, a, PU(P.wit)); obox(Bd, x, 5.3, z, 12.1, 0.12, 7.1, a, PU(P.dakrand));
      for (const v of [-1.6, 1.6]) { const [cx, cz] = P0(0, v); obox(Bd, cx, 0.12, cz, 4.4, 0.24, 1.2, a, PU(P.beton)); for (const u of [-1.2, 1.2]) { const [px, pz] = P0(u, v); obox(Bd, px, 1.1, pz, 0.6, 1.8, 0.45, a, PU(P.grijsLicht)); obox(Bd, px, 1.55, pz, 0.44, 0.36, 0.47, a, PU(P.inkt)); } }
    }
  }
  // dockstrook: gele wielgeleiders bij elke deur en betonblokken langs de koppen van het schort (1 tot 11 m van de gevel)
  function dockGuardsGeo(Bd, d) {
    for (const k of d.docks) { const a = Math.atan2(k.nz, k.nx); for (const sd of [-1, 1]) obox(Bd, k.x + k.ux * sd * 1.62 + k.nx * 2.4, 0.16, k.z + k.uz * sd * 1.62 + k.nz * 2.4, 3.6, 0.32, 0.12, a, PU(P.veiligGeel)); }
    for (const ap of d.aprons || []) {
      for (const [P0, P1] of [[ap[0], ap[3]], [ap[1], ap[2]]]) {
        const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]); if (L < 3) continue; const ux = (P1[0] - P0[0]) / L, uz = (P1[1] - P0[1]) / L; const a = Math.atan2(uz, ux);
        for (let t = 1.0; t + 1.6 <= Math.min(L, 11.5); t += 1.75) { const x = P0[0] + ux * (t + 0.8), z = P0[1] + uz * (t + 0.8); if (!free(d, x, z) || nearBuilding(d, x, z, 0.3)) continue; obox(Bd, x, 0.4, z, 1.6, 0.8, 0.8, a, PU(P.beton)); }
      }
    }
  }

  // ---------- meshes van een standplaats of DC ----------
  // Eigen gebouwen in vol detail (vanaf zoom 11), de buurt eenvoudiger en pas vanaf 13,2.
  // Eerst de eigen plek (terrein, eigen gebouwen, docks, poort), een beeld later de buurt (veel kleine panden).
  function addTo(g, geo, mat, minZ, cast = true, recv = true) { if (!geo) return null; const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; m.userData.minZoom = minZ; m.matrixAutoUpdate = false; m.updateMatrix(); g.add(m); return m; }
  const mkB = () => ({ sl: new Builder(), n: new Builder(), of: new Builder(), roof: new Builder(), hw: new Builder(), ht: new Builder(), det: new Builder() });
  function addStyles(g, S, z0, neighbours) {
    addTo(g, S.sl.empty ? null : S.sl.geometry(), M.wallSL, z0);
    if (neighbours) {
      addTo(g, S.n.empty ? null : withColors(S.n), M.wallNV, z0);
      addTo(g, S.of.empty ? null : withColors(S.of), M.officeV, z0);
      addTo(g, S.roof.empty ? null : withColors(S.roof), M.roofV, z0);
    } else {
      addTo(g, S.n.empty ? null : S.n.geometry(), M.wallN, z0);
      addTo(g, S.of.empty ? null : S.of.geometry(), M.office, z0);
      addTo(g, S.roof.empty ? null : S.roof.geometry(), M.roofFlat, z0);
    }
    addTo(g, S.hw.empty ? null : withColors(S.hw), M.houseVC, Math.max(z0, 13.5));
    addTo(g, S.ht.empty ? null : withColors(S.ht), M.tilesVC, Math.max(z0, 13.5));
    if (neighbours) addTo(g, S.det.empty ? null : S.det.geometry(), pal, 14.5);
  }
  // zachte schaduw rondom aan de voet van elk gebouw (zoals in een maquette met zacht licht)
  function addSkirts(g, list, z0) {
    const ao = { pos: [], alpha: [] }; for (const b of list) skirt(ao, b.ring, 0.09, clamp(b.h * 0.42, 1.6, 6), b.kind === 'huis' ? 0.3 : 0.38);
    if (!ao.pos.length) return;
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(ao.pos, 3));
    const col = new Float32Array(ao.alpha.length * 4); ao.alpha.forEach((a, i) => { col[i * 4 + 3] = a; col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = 1; }); g2.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g2.computeBoundingSphere(); const m = addTo(g, g2, M.ao, z0, false, false); m.renderOrder = 1;
  }
  function build(d) {
    if (d.built) return; d.built = true; const t0 = performance.now();
    const g = new THREE.Group(); g.name = d.name; d.group = g;
    const own = d.buildings.filter(b => b.own || d.shop);
    // terrein (asfalt en beton) met markeringen
    const yard = new Builder(); if (d.terrain) flat(yard, d.terrain, 0.04, 40); for (const r of d.siteYard || []) flat(yard, r, 0.04, 40);
    addTo(g, yard.empty ? null : yard.geometry(), M.yard, 11.4, false, true);
    const apron = new Builder(); for (const r of d.aprons || []) flat(apron, cleanRing(r), 0.055, 6); addTo(g, apron.empty ? null : apron.geometry(), M.apron, 14, false, true);
    const mk = new Builder(), mkSlots = new Builder(); marks(d, mk, mkSlots); addTo(g, mk.empty ? null : mk.geometry(), M.marks, 15, false, true); addTo(g, mkSlots.empty ? null : mkSlots.geometry(), M.marks, 16.2, false, true);
    // eigen gebouwen in vol detail
    const B = mkB(); for (const b of own) buildingGeo(d, b, B); addStyles(g, B, 11, false);
    // docks, slagboom, portiersloge, bord, lantaarnpalen, dakdetails, silo's (een palet)
    for (const k of d.docks) dockGeo(B.det, k);
    if (d.entrance && d.kind === 'depot') gateGeo(d, B.det);
    if (!d.shop) dockGuardsGeo(B.det, d);
    chargerGeo(B.det, d); yardItemsGeo(B.det, d);
    for (const [x, z, a] of d.lamps || []) lampGeo(B.det, x, z, a);
    for (const [x, z, a] of d.floods || []) floodGeo(B.det, x, z, a);
    if (d.factory) for (const [x, z, r, h] of d.factory.silos) siloGeo(B.det, x, z, r, h);
    addTo(g, B.det.empty ? null : B.det.geometry(), pal, 13.2);
    // dockborden met het nummer (vanaf zoom 16, daarvoor zijn ze te klein om te lezen)
    if (d.docks.length && !d.shop) addTo(g, plateGeo(d.docks), M.plate, 16, false, true);
    // fabriek: schoorsteen en liggende tanks (CC0-modellen)
    if (d.factory) addPieces(d);
    addSkirts(g, own, 13.4);
    root.add(g); place(d);
    d.pools = [...(d.lamps || []).map(([x, z, a]) => [x + Math.cos(a) * 1.1, z + Math.sin(a) * 1.1, 9]), ...(d.floods || []).map(([x, z]) => [x, z, 24]), ...d.docks.map(k => [k.x + k.nx * 4.5, k.z + k.nz * 4.5, 6.5])];
    d.nbDone = !d.buildings.some(b => !b.own && !d.shop);
    d.buildMs = performance.now() - t0;
  }
  // de buurt: omliggende panden zonder d (lager detail, pas vanaf zoom 13,2 in beeld)
  function buildNeighbours(d) {
    if (!d.group || d.nbDone) return; d.nbDone = true; const t0 = performance.now();
    const list = d.buildings.filter(b => !b.own && !d.shop); const BN = mkB();
    for (const b of list) buildingGeo(d, b, BN);
    const g = new THREE.Group(); g.name = d.name + ' buurt'; g.matrixAutoUpdate = false; addStyles(g, BN, 13.2, true); addSkirts(g, list, 14.2);
    d.group.add(g); d.nbGroup = g; d.group.updateMatrixWorld(true);
    d.nbMs = performance.now() - t0;
  }
  function addPieces(d) {
    if (d.piecesDone || !d.group || !(PIECE.chimney || PIECE.tank)) return; d.piecesDone = true; const g = d.group;
    if (d.factory.chimney && PIECE.chimney) { const [x, z] = d.factory.chimney; const m = addTo(g, PIECE.chimney.geometry, PIECE.chimney.material, 12.5); m.position.set(x, 0, z); m.rotation.y = hash(d.seed, 3) * 6.28; m.updateMatrix(); }
    if (PIECE.tank) for (const [x, z, a] of d.factory.tanks) { const m = addTo(g, PIECE.tank.geometry, PIECE.tank.material, 13.5); m.position.set(x, 0, z); m.rotation.y = -a; m.updateMatrix(); }
    g.updateMatrixWorld(true);
  }
  // silo: staande cilinder met een kegeldak, een rand en een trap (staal)
  function siloGeo(Bd, x, z, r, h) {
    const seg = 18; const uv = PU(P.staal), uvR = PU(P.grijsLicht);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2; const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const n = [Math.cos(am), 0, Math.sin(am)];
      Bd.quad([x + c0 * r, 0, z + s0 * r], [x + c1 * r, 0, z + s1 * r], [x + c1 * r, h, z + s1 * r], [x + c0 * r, h, z + s0 * r], n, uv, uv, uv, uv);
      const top = [x, h + r * 0.45, z]; const p0 = [x + c0 * r, h, z + s0 * r], p1 = [x + c1 * r, h, z + s1 * r];
      Bd.tri(p0, p1, top, [Math.cos(am) * 0.4, 0.9, Math.sin(am) * 0.4], uvR, uvR, uvR);
    }
    obox(Bd, x, h + 0.3, z, r * 2 + 0.3, 0.25, r * 2 + 0.3, 0, PU(P.hek));
    obox(Bd, x + r + 0.35, h / 2, z, 0.5, h, 0.5, 0, PU(P.hek));
  }
  // dockborden: een wit bord boven elke deur met het nummer, de tekst leesbaar van buiten (links naar rechts = (nz, -nx))
  function plateGeo(docks) {
    const Bd = new Builder();
    for (const k of docks) {
      const i = (k.no - 1) % 100; const col = i % 10, row = Math.floor(i / 10); const e = 0.006;
      const u0 = col / 10 + e, u1 = (col + 1) / 10 - e, v1 = 1 - row / 10 - e, v0 = 1 - (row + 1) / 10 + e;
      const rx = k.nz, rz = -k.nx; const cx = k.x + k.nx * 0.08, cz = k.z + k.nz * 0.08; const hw = 0.47, y0 = 5.5, y1 = 6.44;
      Bd.quad([cx - rx * hw, y0, cz - rz * hw], [cx + rx * hw, y0, cz + rz * hw], [cx + rx * hw, y1, cz + rz * hw], [cx - rx * hw, y1, cz - rz * hw], [k.nx, 0, k.nz], [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
    }
    return Bd.geometry();
  }
  const BRICK = WALLS, TILE = ROOFS; const FLAT_ROOF = new THREE.Color(0x55595D);
  function buildingGeo(d, b, B) {
    const r = b.ring;
    if (b.kind === 'huis') {
      // woonhuis: muren tot de goot, zadeldak over de omsluitende rechthoek langs de lange zijde
      const a = mainAxis(r); const rr = r.map(p => rot(p[0] - b.c[0], p[1] - b.c[1], -a)); const bb = bbox(rr); const len = bb[2] - bb[0], wid = bb[3] - bb[1];
      const fill = b.area / Math.max(1, len * wid); const eave = clamp(b.h * 0.62, 2.8, 7); const ridge = Math.max(eave + 1.5, Math.min(b.h, eave + wid * 0.6));
      const col = new THREE.Color(BRICK[Math.floor(hash(b.seed, 1) * BRICK.length)]); const tile = new THREE.Color(TILE[Math.floor(hash(b.seed, 2) * TILE.length)]);
      const n0 = B.hw.pos.length; walls(B.hw, r, 0, eave, 6, 5.6); B.hw.col = (B.hw.col || []).concat(colorRun(col, (B.hw.pos.length - n0) / 3));
      // dak: zadeldak (zes op de tien), schilddak of plat (een donker vlak op de goot); vaste keuze per huis
      const rk = hash(b.seed, 3);
      if (fill > 0.72 && rk < 0.9) {
        const [ccx, ccz] = rot((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, a); const cx = b.c[0] + ccx, cz = b.c[1] + ccz;
        const along = len >= wid; const hl = (along ? len : wid) / 2, hw = (along ? wid : len) / 2; const ang = along ? a : a + Math.PI / 2;
        const m0 = B.ht.pos.length; (rk < 0.62 ? gable : hip)(B.ht, cx, cz, hl, hw, ang, eave, ridge, 0.35, 4); B.ht.col = (B.ht.col || []).concat(colorRun(tile, (B.ht.pos.length - m0) / 3));
        if (rk < 0.62) { const m1 = B.hw.pos.length; gableEnds(B.hw, cx, cz, hl, hw, ang, eave, ridge, 6, 5.6); B.hw.col = B.hw.col.concat(colorRun(col, (B.hw.pos.length - m1) / 3)); }
      } else { const m0 = B.ht.pos.length; flat(B.ht, r, eave, 4); B.ht.col = (B.ht.col || []).concat(colorRun(rk >= 0.9 ? FLAT_ROOF : tile, (B.ht.pos.length - m0) / 3)); }
      // een lage haag langs de voortuin (de langste gevel), in twee stukken met het pad ertussen; niet bij elk huis
      if (B.det && hash(b.seed, 5) < 0.45) {
        let bi = 0, bl = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > bl) { bl = L; bi = i; } }
        const p = r[bi], q = r[(bi + 1) % r.length]; const nn = edgeNormal(r, bi); const ux = (q[0] - p[0]) / bl, uz = (q[1] - p[1]) / bl; const seg = bl / 2 - 0.7;
        if (seg > 1) for (const sd of [-1, 1]) { const t = bl / 2 + sd * (0.7 + seg / 2); const x = p[0] + ux * t + nn[0] * 2.6, z = p[1] + uz * t + nn[1] * 2.6; if (!nearBuilding(d, x, z, 0.8)) obox(B.det, x, 0.5, z, seg, 1.0, 0.6, Math.atan2(uz, ux), PU(P.haag)); }
      }
      return;
    }
    if (b.kind === 'winkel') {
      const n = r.length; const a = r[0], c = r[1]; const fa = Math.atan2(c[1] - a[1], c[0] - a[0]); const fn = edgeNormal(r, 0);
      // voorgevel (rand 0) van glas, de andere drie dicht
      wallEdge(B.of, a, c, fn, 0, b.h, 6, 3.4);
      for (let i = 1; i < n; i++) wallEdge(B.n, r[i], r[(i + 1) % n], edgeNormal(r, i), 0, b.h + 0.6, 8, 'rel');
      wallEdge(B.n, a, c, fn, b.h, b.h + 0.6, 8, 'rel');
      flat(B.roof, r, b.h, 12); parapet(B.roof, r, b.h, 0.6, 0.3, 12, B.det, PU(P.dakrand));
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]); const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      obox(B.det, mx + fn[0] * 0.18, b.h - 0.2, mz + fn[1] * 0.18, L * 0.92, 0.9, 0.3, fa, PU(b.form));
      obox(B.det, mx + fn[0] * 1.4, 3.6, mz + fn[1] * 1.4, L * 0.62, 0.22, 2.8, fa, PU(b.form));
      for (const s of [-0.28, 0.28]) obox(B.det, mx + fn[0] * 0.2 + Math.cos(fa) * s * L, 1.4, mz + fn[1] * 0.2 + Math.sin(fa) * s * L, 3.2, 2.8, 0.25, fa, PU(P.winkelLicht));
      roofDetails(B.det, b);
      return;
    }
    const detail = b.own || d.shop;
    const target = b.kind === 'loods' ? (b.own && d.kind === 'depot' ? B.sl : B.n) : b.kind === 'kantoor' ? B.of : B.n;
    const par = b.kind === 'schuur' ? 0 : b.kind === 'loods' ? 0.7 : detail ? 0.9 : 0.5;
    const w0 = target.pos.length, r0 = B.roof.pos.length;
    if (b.kind === 'kantoor') walls(target, r, 0, b.h + par, 6, b.h / Math.max(1, Math.round(b.h / 3.4))); else walls(target, r, 0, b.h + par, 8, 'rel');
    flat(B.roof, r, b.h, 12); if (par) { if (detail || b.kind === 'loods') parapet(B.roof, r, b.h, par, 0.35, 12, B.det, PU(target === B.sl ? P.rood : P.dakrand)); else parapet(B.roof, r, b.h, par, 0.3, 12); }
    if (detail || b.area > 2500) roofDetails(B.det, b);
    // de buurt in de kleuren van een Nederlands bedrijventerrein: lichtgrijze, zilveren, antraciet, blauwgrijze en
    // zandkleurige gevelplaten, een enkel bakstenen pand; daken licht- tot donkergrijs of grind
    if (!detail) { tintRun(target, w0, pickW(b, target === B.of)); tintRun(B.roof, r0, pickR(b)); }
  }
  const NB_WALL = [[0xDADDE0, 28], [0xEDEEEF, 14], [0x5C636B, 16], [0x7D8894, 12], [0xD3CBB9, 12], [0xA5674F, 8], [0x8C9A8A, 5], [0x6D7F99, 5]];
  const NB_OFFICE = [[0xF2F2F0, 35], [0xD9D2C3, 25], [0xB97A5E, 25], [0xC9CED3, 15]];
  const NB_ROOF = [[0xC4C8CC, 42], [0x9CA2A8, 28], [0x6E747A, 16], [0xBDB5A4, 14]];
  const pickC = (list, x) => { let t = x * list.reduce((a, [, w]) => a + w, 0); for (const [c, w] of list) { t -= w; if (t <= 0) return c; } return list[0][0]; };
  const pickW = (b, office) => { let c = pickC(office ? NB_OFFICE : NB_WALL, hash(b.seed, 11)); if (!office && c === 0xA5674F && b.area > 1500) c = 0xDADDE0; return c; };
  const pickR = b => pickC(NB_ROOF, hash(b.seed, 12));
  const _tc = new THREE.Color();
  function tintRun(Bd, from, hex) { Bd.col = Bd.col || []; while (Bd.col.length < from) Bd.col.push(1); _tc.setHex(hex); const n = (Bd.pos.length - from) / 3; for (let i = 0; i < n; i++) Bd.col.push(_tc.r, _tc.g, _tc.b); }
  // één gevelvlak (rand a-b met buitennormaal n), UV in meters zoals walls()
  function wallEdge(Bd, a, b, n, y0, y1, uM, vMode) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) return; const v0 = vMode === 'rel' ? 0 : y0 / vMode, v1 = vMode === 'rel' ? 1 : y1 / vMode; Bd.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [n[0], 0, n[1]], [0, v0], [L / uM, v0], [L / uM, v1], [0, v1]); }
  const colorRun = (c, n) => { const a = new Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } return a; };
  function withColors(Bd) { const g = Bd.geometry(); const c = Bd.col || []; while (c.length < Bd.pos.length) c.push(1); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; }
  // dakdetails: lichtstraten op loodsen (rijen langs de lange zijde), installaties op kantoren en loodsen
  function roofDetails(Bd, b) {
    if (b.area < 220) return; const r = b.ring; const a = mainAxis(r); const In = offsetRing(r, -4); const rr = In.map(p => rot(p[0], p[1], -a)); const bb = bbox(rr); const rand = rng(b.seed);
    if (b.kind === 'loods' && b.area > 2500) {
      for (let v = bb[1] + 8; v < bb[3] - 6; v += 14) { const u0 = bb[0] + 8, u1 = bb[2] - 8; if (u1 - u0 < 12) continue; for (let u = u0; u < u1 - 6; u += 18) { const uu = Math.min(u + 12, u1); const [x0, z0] = rot(u, v, a), [x1, z1] = rot(uu, v, a); const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; if (!inRing(x0, z0, In) || !inRing(x1, z1, In)) continue; obox(Bd, mx, b.h + 0.25, mz, uu - u, 0.5, 2.0, a, PU(P.lichtstraat)); } }
    }
    const n = clamp(Math.round(b.area / 900), 1, 6);
    for (let k = 0; k < n; k++) { const u = bb[0] + (bb[2] - bb[0]) * (0.15 + rand() * 0.7), v = bb[1] + (bb[3] - bb[1]) * (0.15 + rand() * 0.7); const [x, z] = rot(u, v, a); if (!inRing(x, z, In)) continue; const w = 2 + rand() * 2.5, dd = 1.4 + rand() * 1.2, hh = 1.1 + rand() * 0.8; obox(Bd, x, b.h + hh / 2, z, w, hh, dd, a, PU(P.dakUnit)); }
  }
  // dock: afdichting (rubber kader), sectionaaldeur met lijnen, stootblokken en een lamp erboven
  function dockGeo(Bd, k) {
    const a = Math.atan2(k.uz, k.ux); const ox = k.nx, oz = k.nz; const at = (out, y, w, h, dep, pal) => obox(Bd, k.x + ox * out, y, k.z + oz * out, w, h, dep, a, PU(pal));
    at(0.04, 2.75, 3.0, 3.1, 0.08, P.dockdeur);
    for (let y = 1.6; y < 4.2; y += 0.52) at(0.09, y, 2.96, 0.04, 0.03, P.dockdeurLijn);
    at(0.35, 4.55, 3.6, 0.35, 0.7, P.rubber); for (const s of [-1, 1]) obox(Bd, k.x + ox * 0.35 + k.ux * s * 1.68, 2.85, k.z + oz * 0.35 + k.uz * s * 1.68, 0.26, 3.75, 0.7, a, PU(P.rubber));
    for (const s of [-1, 1]) obox(Bd, k.x + ox * 0.22 + k.ux * s * 1.25, 1.1, k.z + oz * 0.22 + k.uz * s * 1.25, 0.3, 0.32, 0.44, a, PU(P.rubber));
    at(0.18, 1.05, 2.4, 0.2, 0.36, P.beton);
    at(0.25, 5.05, 0.5, 0.14, 0.45, P.dockLamp);
  }
  // poort: twee slagbomen (rood-wit) over de inrit, een portiersloge en een rood bord naast de weg
  function gateGeo(d, Bd) {
    const e = d.entrance; const a = Math.atan2(e.nx, -e.nz); const ux = -e.nz, uz = e.nx; const px = e.x + e.nx * 6, pz = e.z + e.nz * 6;
    for (const side of [-1, 1]) {
      const bx = px + ux * side * 7.2, bz = pz + uz * side * 7.2; obox(Bd, bx, 0.55, bz, 0.4, 1.1, 0.4, a, PU(P.grijsLicht));
      for (let s = 0; s < 6; s++) { const t = 0.4 + s * 0.6; obox(Bd, bx - ux * side * t, 1.0, bz - uz * side * t, 0.6, 0.14, 0.12, a, PU(s % 2 ? P.witLijn : P.rood)); }
    }
    const gx = px + ux * 10.5 + e.nx * 4, gz = pz + uz * 10.5 + e.nz * 4;
    if (!nearBuilding(d, gx, gz, 3) && !nearRow(d, gx, gz, 1) && inRing(gx, gz, d.terrain)) { obox(Bd, gx, 1.45, gz, 3.4, 2.9, 3.4, a, PU(P.wit)); obox(Bd, gx, 2.0, gz, 3.46, 1.0, 3.46, a, PU(P.glas)); obox(Bd, gx, 3.0, gz, 3.9, 0.2, 3.9, a, PU(P.grijsLicht)); }
    const sx = e.x - e.nx * 5 + ux * 13, sz = e.z - e.nz * 5 + uz * 13;
    if (!nearBuilding(d, sx, sz, 2)) { for (const s of [-1, 1]) obox(Bd, sx + ux * s * 1.3, 1.1, sz + uz * s * 1.3, 0.12, 2.2, 0.12, a, PU(P.paal)); obox(Bd, sx, 2.6, sz, 3.2, 1.3, 0.16, a, PU(P.bord)); obox(Bd, sx, 2.25, sz, 2.6, 0.08, 0.18, a, PU(P.witLijn)); }
  }
  // lantaarnpaal: mast, arm en armatuur (brandt 's nachts)
  // Lichtmasten op het terrein (18 m, vier schijnwerpers): een raster van ongeveer 60 m langs de hoofdrichting, elke mast
  // in de strook tussen twee parkeerrijen of op een vrij stuk, niet in een gebouw of op de inrit
  function floodsFor(d) {
    const out = []; const a = d.axis || 0; const T = d.terrain; const tb = bbox(T.map(p => rot(p[0], p[1], -a))); const In = offsetRing(T, -6);
    const rowAt = (x, z) => { for (const r of d.rows) { const vx = x - r.p0[0], vz = z - r.p0[1]; const along = vx * r.dir[0] + vz * r.dir[1], across = vx * r.nose[0] + vz * r.nose[1]; if (along > -r.sp / 2 - 1 && along < (r.n - 0.5) * r.sp + 1 && Math.abs(across) < 9.6) return { r, across }; } return null; };
    for (let u = tb[0] + 30; u < tb[2] - 20; u += 60) for (let v = tb[1] + 30; v < tb[3] - 20; v += 60) {
      let [x, z] = rot(u, v, a);
      const hit = rowAt(x, z); if (hit) { const shift = (hit.across >= 0 ? 10 : -10) - hit.across; x += hit.r.nose[0] * shift; z += hit.r.nose[1] * shift; if (rowAt(x, z)) continue; }
      if (!inRing(x, z, In) || nearBuilding(d, x, z, 4) || (d.aprons || []).some(q => inRing(x, z, q)) || (d.entrance && Math.hypot(x - d.entrance.x, z - d.entrance.z) < 30)) continue;
      if (out.some(([px, pz]) => Math.hypot(px - x, pz - z) < 35)) continue;
      out.push([x, z, a]);
    }
    return out;
  }
  function floodGeo(Bd, x, z, a) {
    obox(Bd, x, 9, z, 0.36, 18, 0.36, a, PU(P.paal)); obox(Bd, x, 0.4, z, 0.8, 0.8, 0.8, a, PU(P.beton));
    obox(Bd, x, 17.9, z, 3.2, 0.16, 0.16, a, PU(P.paal));
    for (const s of [-1.3, -0.45, 0.45, 1.3]) { const [ox, oz] = rot(s, 0, a); obox(Bd, x + ox, 17.7, z + oz, 0.62, 0.22, 0.5, a, PU(P.lamp)); }
  }
  function lampGeo(Bd, x, z, a) {
    obox(Bd, x, 4.0, z, 0.16, 8.0, 0.16, a, PU(P.paal));
    const ax = x + Math.cos(a) * 0.6, az = z + Math.sin(a) * 0.6; obox(Bd, ax, 7.95, az, 1.3, 0.1, 0.1, a, PU(P.paal));
    obox(Bd, x + Math.cos(a) * 1.15, 7.85, z + Math.sin(a) * 1.15, 0.7, 0.16, 0.32, a, PU(P.lamp));
  }
  // markeringen: de vakken van de parkeerrijen (of van de eigen indeling), geleidelijnen voor de docks, stopstreep bij de poort
  function marks(d, mk, mkSlots) {
    const W = PU(P.witLijn); const y = 0.07;
    // rijen uit de gegevens: scheidingslijnen tussen de plekken (langs de neusrichting) en een achterlijn
    for (const r of d.rows) {
      if (r.dock) continue;   // een rij aan de docks heeft de gele geleidelijnen van de docks
      const at = (along, fwd) => [r.p0[0] + r.dir[0] * along + r.nose[0] * fwd, r.p0[1] + r.dir[1] * along + r.nose[1] * fwd];
      for (let k = 0; k <= r.n; k++) { const s = (k - 0.5) * r.sp; const [x0, z0] = at(s, -9), [x1, z1] = at(s, 8.5); line(mkSlots, x0, z0, x1, z1, 0.15, y, W); }
      const [x0, z0] = at(-0.5 * r.sp, -9), [x1, z1] = at((r.n - 0.5) * r.sp, -9); line(mk, x0, z0, x1, z1, 0.16, y, W);
    }
    // eigen indeling (alleen zonder rijen in de gegevens)
    const a = d.axis || 0;
    if (d.slots && d.slots.length && d.terrain) {
      const key = s => `${Math.round(s.u / SLOT_W)}:${Math.round(s.v)}`; const has = new Set(d.slots.map(key));
      for (const s of d.slots) {
        for (const side of [-1, 1]) { if (side === 1 && has.has(`${Math.round(s.u / SLOT_W) + 1}:${Math.round(s.v)}`)) continue; const u = s.u + side * SLOT_W / 2; const [x0, z0] = rot(u, s.v - SLOT_L / 2 + 0.3, a), [x1, z1] = rot(u, s.v + SLOT_L / 2 - 4.5, a); line(mkSlots, x0, z0, x1, z1, 0.15, y, W); }
        const bv = s.v - s.face * (SLOT_L / 2 - 0.2); const [x0, z0] = rot(s.u - SLOT_W / 2, bv, a), [x1, z1] = rot(s.u + SLOT_W / 2, bv, a); line(mk, x0, z0, x1, z1, 0.16, y, W);
      }
      const T = d.terrain; const tb = bbox(T.map(p => rot(p[0], p[1], -a)));
      for (const v of d.aisles || []) for (let u = tb[0] + 4; u < tb[2] - 6; u += 7) { const [x0, z0] = rot(u, v, a), [x1, z1] = rot(u + 3, v, a); if (!inRing(x0, z0, T) || !inRing(x1, z1, T) || nearBuilding(d, (x0 + x1) / 2, (z0 + z1) / 2, 4)) continue; if ((d.aprons || []).some(r => inRing((x0 + x1) / 2, (z0 + z1) / 2, r))) continue; line(mk, x0, z0, x1, z1, 0.16, y, W); }
    }
    // dockvakken: twee witte lijnen per deur, van de gevel tot 17 m het terrein op
    for (const k of d.docks) for (const s of [-1, 1]) { const bx = k.x + k.ux * s * 1.75, bz = k.z + k.uz * s * 1.75; line(mk, bx + k.nx * 1.2, bz + k.nz * 1.2, bx + k.nx * 17, bz + k.nz * 17, 0.14, 0.095, W); }
    // rijbanen: een onderbroken middenlijn in het gangpad voor elke rij (15,5 m voor de lijn van de plekken); niet waar al
    // een streep ligt, niet in een rij, op een schort of tegen een gebouw
    const dashes = [];
    if (d.terrain) for (const r of d.rows) {
      if (r.n < 3) continue;
      for (let along = -r.sp / 2; along < (r.n - 0.5) * r.sp - 3; along += 9) {
        const x0 = r.p0[0] + r.dir[0] * along + r.nose[0] * 15.5, z0 = r.p0[1] + r.dir[1] * along + r.nose[1] * 15.5, x1 = x0 + r.dir[0] * 3, z1 = z0 + r.dir[1] * 3; const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        if (!inRing(x0, z0, d.terrain) || !inRing(x1, z1, d.terrain) || nearRow(d, mx, mz, 1) || nearBuilding(d, mx, mz, 3) || (d.aprons || []).some(q => inRing(mx, mz, q))) continue;
        if (dashes.some(([px, pz]) => Math.hypot(px - mx, pz - mz) < 5)) continue;
        dashes.push([mx, mz]); line(mk, x0, z0, x1, z1, 0.15, y, W);
      }
    }
    if (d.entrance && d.kind === 'depot') { const e = d.entrance; const ux = -e.nz, uz = e.nx; const cx = e.x + e.nx * 9, cz = e.z + e.nz * 9; line(mk, cx - ux * 6.5, cz - uz * 6.5, cx + ux * 6.5, cz + uz * 6.5, 0.4, y, W); for (let s = 12; s < 40; s += 6) { const mx = e.x + e.nx * (s + 1.5), mz = e.z + e.nz * (s + 1.5); if (nearRow(d, mx, mz, 0) || nearBuilding(d, mx, mz, 1)) break; line(mk, e.x + e.nx * s, e.z + e.nz * s, e.x + e.nx * (s + 3), e.z + e.nz * (s + 3), 0.15, y, W); } }
  }

  // ---------- plaatsen in de scene (bij een nieuwe oorsprong) ----------
  function place(d) { if (!d.group || !O) return; const sc = d.mpu0 / O.mpu; d.gx = (d.mx0 - O.x) / O.mpu; d.gz = (d.my0 - O.y) / O.mpu; d.sc = sc; d.group.position.set(d.gx, 0, d.gz); d.group.scale.setScalar(sc); d.group.updateMatrixWorld(true); }
  const toScene = (d, x, z) => [d.gx + x * d.sc, d.gz + z * d.sc];
  function setOrigin(o) { O = o; for (const d of [...depots, ...sites]) if (d.lon0 != null) { d.gx = (d.mx0 - O.x) / O.mpu; d.gz = (d.my0 - O.y) / O.mpu; d.sc = d.mpu0 / O.mpu; if (d.group) place(d); } natureKey = ''; }

  // na elke ronde: plekken bij winkels van wie er niet meer staat weer vrijgeven
  function endParking() { for (const d of shopMap.values()) { if (!d.assign.size) continue; for (const [id, k] of d.assign) if (!d.seen.has(id)) { d.occ[k] = null; d.assign.delete(id); } d.seen.clear(); } }
  // een voertuig of oplegger bij een klant: als er een gebouw (DC) op die plek staat, achteruit tegen de dichtstbijzijnde gevel
  // (bij voorkeur van de eigen gebouwen van die plek)
  function dockAt(lon, lat, n, hl = TR_HALF) {
    if (!ready) return null; let best = null, bd = 600;
    for (const d of [...sites, ...depots]) { if (d.lon0 == null || d.shop || !d.buildings || !d.buildings.length) continue; const [x, z] = d.toLocal(lon, lat); const r = Math.hypot(x, z); if (r < (d.radius || 300) + 50 && r < bd) { bd = r; best = d; } }
    if (!best || !best.built) return null; const d = best; const [x, z] = d.toLocal(lon, lat);
    const pool = d.buildings.some(b => b.own) ? d.buildings.filter(b => b.own) : d.buildings;
    let hit = null, hd = 60; for (const b of pool) { if (x < b.bb[0] - 60 || x > b.bb[2] + 60 || z < b.bb[1] - 60 || z > b.bb[3] + 60) continue; const inside = inRing(x, z, b.ring); const e = nearestOnRing(x, z, b.ring); const dist = inside ? 0 : e.d; if (dist < hd && b.area > 300) { hd = dist; hit = { b, e }; } }
    if (!hit) return null; const { b, e } = hit; const nrm = edgeNormal(b.ring, e.i); const a = b.ring[e.i], c = b.ring[(e.i + 1) % b.ring.length]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1; const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
    const off = ((n % 5) - 2) * 4.4; const px = e.x + ux * off + nrm[0] * (hl + 0.6), pz = e.z + uz * off + nrm[1] * (hl + 0.6);
    const [sx, sz] = toScene(d, px, pz); return { x: sx, z: sz, ang: Math.atan2(-nrm[0], -nrm[1]) };
  }

  // ---------- klanten: winkels en DC's ----------
  // Een voertuig of oplegger bij een klant staat met de achterkant tegen een dock: van een echt gebouw (DC uit
  // buildings.js) als dat er staat, anders van een generiek pand naast de stopplek: een supermarkt (40 tot 54 m, 6 tot 7 m
  // hoog, glazen pui, gevelband en luifel in de kleur van de formule, docks aan de zijkant, klantenparkeerplaats), of bij
  // een DC uit de klantenlijst zonder gebouwgegevens een distributiehal met een rij docks. Zijn er echte winkelpunten
  // (opts.data.shops of WINKELS), dan staat het pand op dat punt. Niet als de online kaart zelf gebouwen laat zien.
  const shopMap = new Map(); const SHOPS = (shopPoints || []).map(s => ({ lon: +s.lon, lat: +s.lat, f: s.f || s.formule || s.formula || s.k || s.n || '' })).filter(s => isFinite(s.lon) && isFinite(s.lat));
  const FORM = [[/albert|\bah\b/i, 'formBlauw'], [/jumbo/i, 'formGeel'], [/plus|spar|coop/i, 'formGroen'], [/lidl|aldi/i, 'formDonkerblauw'], [/vomar|dirk|deka|hoogvliet|etos/i, 'formRood']];
  const formOf = name => { for (const [re, k] of FORM) if (re.test(name || '')) return P[k]; return P.formGrijs; };
  function makeShop(key, lon, lat, ang, form, dc) {
    const d = { kind: 'site', shop: true, prepared: true, name: (dc ? 'dc ' : 'winkel ') + key, i: 5000 + shopMap.size, built: false, seed: hashStr(key), rows: [] };
    frame(d, lon, lat); d.addr = [0, 0]; d.terrain = null; d.entrance = null; d.lamps = []; d.hedges = []; d.slots = [];
    const r = rng(d.seed); const W = dc ? 120 + r() * 60 : 40 + r() * 14, D = dc ? 70 + r() * 30 : 26 + r() * 8, H = dc ? 11 + r() * 2 : 6.2 + r() * 1.0;
    const ring = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]].map(([u, v]) => rot(u, v, ang));
    const b = building(d, ring, H, true); b.kind = dc ? 'loods' : 'winkel'; b.form = form; d.buildings = [b];
    const side = dc ? 0 : 1; const a = ring[side], c = ring[(side + 1) % 4]; const n = edgeNormal(ring, side); const L = Math.hypot(c[0] - a[0], c[1] - a[1]); const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
    const ts = dc ? Array.from({ length: Math.floor((L - 12) / 4.4) }, (_, k) => (6 + k * 4.4) / L) : [0.4, 0.68];
    d.docks = ts.map(t => ({ x: a[0] + (c[0] - a[0]) * t, z: a[1] + (c[1] - a[1]) * t, nx: n[0], nz: n[1], ux, uz, b }));
    const apron = (e, depth, t0, t1) => { const p = ring[e], q = ring[(e + 1) % 4]; const m = edgeNormal(ring, e); const P0 = [p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0], P1 = [p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1]; return cleanRing([P0, P1, [P1[0] + m[0] * depth, P1[1] + m[1] * depth], [P0[0] + m[0] * depth, P0[1] + m[1] * depth]]); };
    d.aprons = [apron(side, dc ? 36 : 24, -0.05, 1.05)]; d.siteYard = dc ? [d.aprons[0]] : [d.aprons[0], apron(0, 18, -0.05, 1.05)];
    d.radius = radiusOf([...ring, ...d.siteYard.flat()]); d.rAll = d.radius; d.trees = treesAround(d).slice(0, 8); d.assign = new Map(); d.seen = new Set(); d.occ = [];
    // klantenparkeerplaats: twee rijen auto's op het voorplein, haaks op de pui, niet elk vak bezet
    d.cars = []; if (!dc) { const p0 = ring[0], p1 = ring[1]; const n2 = edgeNormal(ring, 0); const L2 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); const vx = (p1[0] - p0[0]) / L2, vz = (p1[1] - p0[1]) / L2; const rr = rng(d.seed ^ 77);
      for (const off of [7.5, 13.5]) for (let s = 3; s < L2 - 3; s += 2.7) { if (rr() < 0.42) continue; d.cars.push([p0[0] + vx * s + n2[0] * off, p0[1] + vz * s + n2[1] * off, Math.atan2(n2[0], n2[1]) + (off > 10 ? Math.PI : 0), carColor(rr)]); } }
    if (O) { d.gx = (d.mx0 - O.x) / O.mpu; d.gz = (d.my0 - O.y) / O.mpu; d.sc = d.mpu0 / O.mpu; }
    shopMap.set(key, d); sites.push(d); natureKey = ''; return d;
  }
  // de winkel bij een stopplek: een bekend winkelpunt binnen 150 m, een DC uit de klantenlijst binnen 400 m (zonder
  // gebouwgegevens), anders een pand naast de weg (rechts van de rijrichting, de voorgevel naar de weg)
  function shopFor(lon, lat, bearing, form) {
    let best = null, bd = 150;
    for (const s of SHOPS) { const dx = (s.lon - lon) * 67000, dz = (s.lat - lat) * 111000; const dd = Math.hypot(dx, dz); if (dd < bd) { bd = dd; best = s; } }
    if (best) {
      // de voorgevel naar de stopplek (de weg voor de deur); zonder stop (vooraf neergezet) een vaste richting
      const key = best.lon.toFixed(5) + ',' + best.lat.toFixed(5); if (shopMap.has(key)) return shopMap.get(key);
      const close = shopNear(best.lon, best.lat, 60); if (close) { shopMap.set(key, close); return close; }
      const sx = (lon - best.lon) * Math.cos(best.lat * Math.PI / 180), sz = -(lat - best.lat); const ang = Math.hypot(sx, sz) > 1e-5 ? Math.atan2(sx, -sz) : hash(hashStr(key), 1) * Math.PI;
      return makeShop(key, best.lon, best.lat, ang, formOf(best.f) || form);
    }
    let dc = null, dd2 = 400; for (const x of DCS) { const dx = (+x.lon - lon) * 67000, dz = (+x.lat - lat) * 111000; const dd = Math.hypot(dx, dz); if (dd < dd2) { dd2 = dd; dc = x; } }
    const key = dc ? 'dc:' + dc.id : lon.toFixed(4) + ',' + lat.toFixed(4); if (shopMap.has(key)) return shopMap.get(key);
    const ang = Math.atan2(Math.sin(bearing), Math.cos(bearing)); const ax = Math.cos(ang), az = Math.sin(ang); const off = dc ? 70 : 38;
    const cx = -az * off, cz = ax * off; const [lon2, lat2] = lonLat(mercX(lon) + cx * mpuAt(lat), mercY(lat) + cz * mpuAt(lat));
    const close = shopNear(lon2, lat2, dc ? 110 : 60); if (close) { shopMap.set(key, close); return close; }
    return makeShop(key, lon2, lat2, dc ? ang + Math.PI : ang, dc ? P.formGrijs : form, !!dc);
  }
  // een winkel of hal die er al staat binnen r meter (twee winkels in hetzelfde centrum delen dan een pand, ze schuiven
  // niet door elkaar heen)
  function shopNear(lon, lat, r) {
    let best = null, bd = r; const ky = 111320, kx = ky * Math.cos(lat * Math.PI / 180);
    for (const d of shopMap.values()) { const dd = Math.hypot((d.lon0 - lon) * kx, (d.lat0 - lat) * ky); if (dd < bd) { bd = dd; best = d; } }
    return best;
  }
  // houding van een voertuig (halve lengte hl) of oplegger bij een klant; null als er niets passends is (dan blijft hij op zijn punt)
  function customer(lon, lat, bearing, id, hl, base) {
    if (!ready || !O) return null;
    const real = dockAt(lon, lat, hashStr(id) & 7, hl); if (real) return real;
    if (ofm) return null;
    const s = byName.get(base); const d = shopFor(lon, lat, bearing, formOf(s && s.s.klant));
    if (!d.built) build(d);
    d.seen.add(id); let k = d.assign.get(id); if (k == null) { k = 0; while (d.occ[k]) k++; d.occ[k] = id; d.assign.set(id, k); }
    const door = d.docks[k % d.docks.length]; const extra = Math.floor(k / d.docks.length) * 4.6; const px = door.x + door.ux * extra + door.nx * (hl + 0.5), pz = door.z + door.uz * extra + door.nz * (hl + 0.5);
    const [x, z] = toScene(d, px, pz); return { x, z, ang: Math.atan2(-door.nx, -door.nz) };
  }

  // ---------- natuur en huizen (instanced, opnieuw gevuld als het beeld genoeg verschuift) ----------
  const HG = houseGeometries(); const hedgeGeo = hedgeGeometry();
  const MAXT = 7000, MAXH = 3500, MAXHE = 4000;
  // Elke soort twee keer: dichtbij (in het gebied van de schaduwkaart, werpt schaduw) en verder weg (werpt geen schaduw;
  // anders tekent de schaduwstap duizenden bomen die nergens een schaduw achterlaten).
  const mk = (geo, mat, max, cast) => { const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; m.visible = false; root.add(m); return m; };
  // Bomen: dichtbij (zoom 16,3 en verder) de Kenney-modellen (linde, eik, populier, den), daarvoor de eenvoudige
  // procedurele vormen in dezelfde maten. Soorten: 0 loof, 1 conifeer, 2 populier, 3 eik.
  const KINDS_T = ['loof', 'conifer', 'populier', 'eik'];
  const treeMeshes = {}; let kenneyTrees = false;
  function initTrees() {
    const kt = treesIn ? assets.trees : null; kenneyTrees = !!(kt && kt.loof);
    const TG = { hi: treeGeometries(true, kt), lo: treeGeometries(false) };
    for (const lod of ['hi', 'lo']) for (const k of KINDS_T) { const g = TG[lod][k]; for (const near of [true, false]) { const crown = mk(g.crown, M.crown, MAXT, near), trunk = mk(g.trunk, M.trunk, MAXT, near); crown.setColorAt(0, new THREE.Color()); treeMeshes[lod + k + (near ? '' : '_ver')] = { crown, trunk }; } }
  }
  // de modellen kwamen na de gebouwen binnen: de bomen in het volle detail wisselen, fabrieken krijgen hun details
  function upgradeTrees() {
    const kt = assets.trees;
    if (kt && kt.loof && !kenneyTrees) {
      kenneyTrees = true; const map = { loof: kt.loof, eik: kt.eik, populier: kt.populier, conifer: kt.conifeer };
      for (const k of KINDS_T) { const src = map[k]; if (!src) continue; for (const suf of ['', '_ver']) { const t = treeMeshes['hi' + k + suf]; if (!t) continue; const oc = t.crown.geometry, ot = t.trunk.geometry; t.crown.geometry = src.crown; t.trunk.geometry = src.trunk; if (suf === '_ver') { oc.dispose(); ot.dispose(); } } }
      natureKey = '';
    }
  }
  function upgradePieces() { initPieces(); for (const d of [...depots, ...sites]) if (d.built && d.factory) addPieces(d); }
  // fabrieksdetails uit de CC0-modellen, met hun eigen textuur
  const PIECE = {};
  function initPieces() {
    for (const k of ['tank', 'chimney']) { if (PIECE[k]) continue; const a = assets[k]; if (!a) continue; PIECE[k] = { geometry: a.geometry, material: new THREE.MeshStandardMaterial({ map: a.map, color: 0xFFFFFF, roughness: k === 'tank' ? 0.5 : 0.8, metalness: k === 'tank' ? 0.15 : 0 }) }; }
  }
  // huizen: muren, zadeldaken en schilddaken (een plat dak is een schilddak van 35 cm hoog), elk een eigen tekening
  const houseSet = near => { const body = mk(HG.body, M.house, MAXH, near), roof = mk(HG.roof, M.houseRoof, MAXH, near), hip = mk(HG.hip, M.houseRoof, MAXH, near); for (const m of [body, roof, hip]) m.setColorAt(0, new THREE.Color()); return { body, roof, hip }; };
  const houses = [houseSet(true), houseSet(false)];
  const hedges = mk(hedgeGeo, M.hedge, MAXHE, true);
  // geparkeerde auto's: palet zonder eigen licht (hun lampen branden niet), de lakkleur per exemplaar
  const palCars = paletteMaterial(); const CG = carGeometry(); const MAXC = 3000;
  const cars = [mk(CG, palCars, MAXC, true), mk(CG, palCars, MAXC, false)]; for (const m of cars) m.setColorAt(0, new THREE.Color());
  let natureKey = ''; let lastNature = 0;
  // punten in de bebouwde vlakken van urban.json (een raster van ongeveer 420 m met een vaste verschuiving per punt);
  // per vlak pas uitgerekend als dat vlak voor het eerst in de buurt van het beeld komt
  const urbanBoxes = urban.map(ring => { let x0 = 180, x1 = -180, y0 = 90, y1 = -90; for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; });
  const urbanCache = new Map();
  function urbanPoints(ri) {
    if (urbanCache.has(ri)) return urbanCache.get(ri);
    const ring = urban[ri]; const [x0, y0, x1, y1] = urbanBoxes[ri]; const out = []; const dx = 0.0062, dy = 0.0038; let gi = 0;
    for (let y = y0; y <= y1; y += dy) for (let x = x0; x <= x1; x += dx, gi++) { const jx = (hash(ri, gi) - 0.5) * dx * 0.9, jy = (hash(ri, gi + 9999) - 0.5) * dy * 0.9; if (inRing(x + jx, y + jy, ring)) out.push([x + jx, y + jy, (ri * 100003 + gi) | 0]); }
    urbanCache.set(ri, out); return out;
  }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  function setInst(mesh, i, x, y, z, a, sx, sy, sz) { V.set(x, y, z); Q.setFromAxisAngle(UP, a); S.set(sx, sy, sz); M4.compose(V, Q, S); mesh.setMatrixAt(i, M4); }
  // view: { focus: [x, z] (scene), R (meters), zoom }
  function updateNature(view, force) {
    if (!O || !ready) return;
    const z = view.zoom; const tier = z >= 16.3 ? 3 : z >= 14.3 ? 2 : z >= 13.2 ? 1 : 0;
    const key = `${tier}`; const moved = !natureKey || natureKey !== key || Math.hypot(view.focus[0] - lastNature.fx, view.focus[1] - lastNature.fz) > lastNature.R * 0.22 || Math.abs(Math.log(view.R / lastNature.R)) > 0.3;
    if (!force && !moved) return false;
    const now = performance.now(); if (!force && natureKey === key && now - lastNature.t < 180) return false;
    natureKey = key; lastNature = { fx: view.focus[0], fz: view.focus[1], R: view.R, t: now };
    for (const t of Object.values(treeMeshes)) { t.crown.count = 0; t.trunk.count = 0; }
    for (const h of houses) { h.body.count = 0; h.roof.count = 0; h.hip.count = 0; } hedges.count = 0; for (const m of cars) m.count = 0;
    if (tier === 0) { for (const t of Object.values(treeMeshes)) t.crown.visible = t.trunk.visible = false; for (const h of houses) h.body.visible = h.roof.visible = h.hip.visible = false; hedges.visible = false; for (const m of cars) m.visible = false; return true; }
    const lod = tier >= 3 ? 'hi' : 'lo'; const kinds = KINDS_T;
    const R = view.R * 1.25, R2 = R * R; const fx = view.focus[0], fz = view.focus[1]; const S2 = (view.shadowR || 1300) ** 2;
    const isNear = (x, z) => (x - fx) * (x - fx) + (z - fz) * (z - fz) < S2;
    const addTree = (x, z, type, sc, tint, rotA) => { const t = treeMeshes[lod + kinds[type] + (isNear(x, z) ? '' : '_ver')]; const i = t.crown.count; if (i >= MAXT) return; const s = sc; setInst(t.crown, i, x, 0, z, rotA, s, s, s); t.trunk.setMatrixAt(i, M4); t.crown.setColorAt(i, C.setHex(TREE_TINTS[tint % TREE_TINTS.length])); t.crown.count = t.trunk.count = i + 1; };
    // bomen, auto's en hagen van de standplaatsen, DC's en winkels in de buurt
    for (const d of [...depots, ...sites]) {
      if (d.lon0 == null) continue; const dx = d.gx - fx, dz = d.gz - fz; const rr = (d.radius || 200) * 1.5; if (dx * dx + dz * dz > (R + rr) * (R + rr)) continue;
      if (d.shop && ofm) continue;
      for (const [x, z, type, sc, tint] of d.trees || []) { const [sx, sz] = toScene(d, x, z); addTree(sx, sz, type, sc, tint, hash(Math.round(x), Math.round(z)) * 6.28); }
      if (tier >= 2) for (const [x, z, a, col] of d.cars || []) { const [sx, sz] = toScene(d, x, z); const m = cars[isNear(sx, sz) ? 0 : 1]; const i = m.count; if (i >= MAXC) break; setInst(m, i, sx, 0, sz, a, d.sc, d.sc, d.sc); m.setColorAt(i, C.setHex(col)); m.count = i + 1; }
      if (tier >= 2) for (const [x, z, len, a, v] of d.hedges || []) { const i = hedges.count; if (i >= MAXHE) break; const [sx, sz] = toScene(d, x, z); setInst(hedges, i, sx, 0, sz, -a, len * d.sc, 1.35 * d.sc, 1.1 * d.sc); hedges.setColorAt(i, C.setRGB(0.9 + v * 0.2, 0.9 + v * 0.2, 0.9 + v * 0.15)); hedges.count = i + 1; }
    }
    // bebouwing uit urban.json: groepjes huizen (rijtjes of vrijstaand) en groepjes bomen. Niet op een terrein of gebouw;
    // geen verzonnen huizen binnen 320 m van een plek met echte gebouwen (daar staan ook de kleine panden in de gegevens)
    const fLon = (fx * O.mpu + O.x) * 360 - 180, fLat = 360 / Math.PI * Math.atan(Math.exp((180 - (fz * O.mpu + O.y) * 360) * Math.PI / 180)) - 90;
    const dLon = R * O.mpu * 360, dLat = dLon * Math.cos(fLat * Math.PI / 180); const urbanPts = [];
    urbanBoxes.forEach((bb, ri) => { if (bb[2] < fLon - dLon || bb[0] > fLon + dLon || bb[3] < fLat - dLat || bb[1] > fLat + dLat) return; for (const p of urbanPoints(ri)) urbanPts.push(p); });
    const near = [...depots, ...sites].filter(d => d.prepared && d.lon0 != null && Math.hypot(d.gx - fx, d.gz - fz) < R + (d.rAll || d.radius || 200) + 100);
    const blocked = (x, z, house) => {
      for (const d of near) {
        const lx = (x - d.gx) / d.sc, lz = (z - d.gz) / d.sc; const rr = (d.rAll || d.radius || 200) + 20; if (lx * lx + lz * lz > rr * rr) continue;
        if (house && d.buildings && d.buildings.length > 3 && !d.shop && Math.hypot(lx - d.addr[0], lz - d.addr[1]) < 320) return true;
        if (d.terrain && inRing(lx, lz, d.terrain)) return true; if (nearBuilding(d, lx, lz, house ? 8 : 3)) return true; if (d.siteYard && d.siteYard.some(r => inRing(lx, lz, r))) return true;
      }
      return false;
    };
    for (const [lon, lat, seed] of urbanPts) {
      const x = (mercX(lon) - O.x) / O.mpu, z = (mercY(lat) - O.y) / O.mpu; const ddx = x - fx, ddz = z - fz; if (ddx * ddx + ddz * ddz > R2) continue;
      const r = rng(seed); const a = r() * Math.PI;
      if (r() < 0.6) {
        if (tier < 2 || ofm) { for (let k = 0; k < 3; k++) { const ox = (r() - 0.5) * 50, oz = (r() - 0.5) * 50; if (!blocked(x + ox, z + oz, false)) addTree(x + ox, z + oz, 0, 0.8 + r() * 0.5, Math.floor(r() * 5), r() * 6.28); } continue; }
        // rijtjes (één gevel en één dak voor de hele rij, meestal een zadeldak, soms plat) of vrijstaande huizen (elk een
        // eigen gevel en dak: zadeldak, schilddak of plat); voortuinen met een lage haag (met een opening voor het pad)
        const rows = 1 + Math.floor(r() * 3); const terr = r() < 0.55; const wall = Math.floor(r() * WALLS.length), roof = Math.floor(r() * ROOFS.length); const rowRoof = r() < 0.8 ? 0 : 2;
        for (let row = 0; row < rows; row++) {
          const n = terr ? 4 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3); const depth = terr ? 9 : 9 + r() * 3; const eave = terr ? 5.8 : 3.0 + r() * 3.2; const off = (row - (rows - 1) / 2) * (depth + 16);
          const front = off > 0.1 ? -1 : 1;   // de voorkant naar de straat tussen de rijen
          let u = -n * (terr ? 3.2 : 7);
          for (let k = 0; k < n; k++) {
            const w = terr ? 5.8 + r() * 0.8 : 8 + r() * 3; const cu = u + w / 2; u += w + (terr ? 0 : 5 + r() * 6);
            const [ox, oz] = rot(cu, off, a); const hx = x + ox, hz = z + oz; if (blocked(hx, hz, true)) continue; const H = houses[isNear(hx, hz) ? 0 : 1]; const i = H.body.count; if (i >= MAXH) break;
            const wc = terr ? wall : Math.floor(r() * WALLS.length), rc = terr ? roof : Math.floor(r() * ROOFS.length); const rh = (terr ? depth : Math.min(w, depth)) * 0.55;
            const rt = r(); const kind = terr ? rowRoof : rt < 0.6 ? 0 : rt < 0.88 ? 1 : 2; const RM = kind === 0 ? H.roof : H.hip; const j = RM.count;
            setInst(H.body, i, hx, 0, hz, -a, w, eave, depth); H.body.setColorAt(i, C.setHex(WALLS[wc])); H.body.count = i + 1;
            if (j < MAXH) { setInst(RM, j, hx, eave, hz, -a, w + (terr ? 0.02 : 0.7), kind === 2 ? 0.35 : rh, depth + 0.8); RM.setColorAt(j, C.setHex(kind === 2 ? 0x55595D : ROOFS[rc])); RM.count = j + 1; }
            if (tier >= 3 && r() < (terr ? 0.4 : 0.5)) {
              // een haag langs de voortuin, 2,6 m voor de gevel, in twee stukken met het pad ertussen
              const hh = 0.85 + r() * 0.35, half = (w + (terr ? 0 : 2.4)) / 2;
              for (const sd of [-1, 1]) { const segL = half - 0.7; if (segL < 0.8) continue; const [qx, qz] = rot(cu + sd * (0.7 + segL / 2), off + front * (depth / 2 + 2.6), a); if (blocked(x + qx, z + qz, false)) continue; const hi = hedges.count; if (hi >= MAXHE) break; setInst(hedges, hi, x + qx, 0, z + qz, -a, segL, hh, 0.6); const v = r(); hedges.setColorAt(hi, C.setRGB(0.88 + v * 0.2, 0.9 + v * 0.18, 0.86 + v * 0.14)); hedges.count = hi + 1; }
            }
          }
        }
        for (let k = 0; k < 2 + Math.floor(r() * 4); k++) { const [ox, oz] = rot((r() - 0.5) * 70, (r() < 0.5 ? -1 : 1) * (14 + r() * 16), a); if (!blocked(x + ox, z + oz, false)) addTree(x + ox, z + oz, r() < 0.55 ? 0 : r() < 0.6 ? 3 : 1, 0.75 + r() * 0.45, Math.floor(r() * 5), r() * 6.28); }
      } else {
        const n = 4 + Math.floor(r() * 7); const tt = r(); const type = tt < 0.45 ? 0 : tt < 0.66 ? 3 : tt < 0.84 ? 2 : 1;
        for (let k = 0; k < n; k++) { const ang = r() * 6.28, dist = Math.sqrt(r()) * 28; const tx = x + Math.cos(ang) * dist, tz = z + Math.sin(ang) * dist; if (!blocked(tx, tz, false)) addTree(tx, tz, r() < 0.8 ? type : 0, 0.75 + r() * 0.6, Math.floor(r() * 5), r() * 6.28); }
      }
    }
    for (const [k, t] of Object.entries(treeMeshes)) { const on = k.startsWith(lod) && t.crown.count > 0; t.crown.visible = t.trunk.visible = on; t.crown.instanceMatrix.needsUpdate = t.trunk.instanceMatrix.needsUpdate = true; if (t.crown.instanceColor) t.crown.instanceColor.needsUpdate = true; }
    for (const h of houses) { for (const m of [h.body, h.roof, h.hip]) { m.visible = tier >= 2 && m.count > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
    hedges.instanceMatrix.needsUpdate = true; if (hedges.instanceColor) hedges.instanceColor.needsUpdate = true;
    for (const m of cars) { m.visible = tier >= 2 && m.count > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    hedges.visible = tier >= 2 && hedges.count > 0;
    return true;
  }
  // per beeld: plekken in de buurt bouwen (één grote per beeld), en wat te klein is verbergen
  function update(view) {
    if (!O || !ready) return;
    const z = view.zoom; let spent = 0;
    // bekende winkelpunten in de buurt alvast neerzetten (alleen dichtbij)
    if (SHOPS.length && z >= 15 && !ofm) { const rr = Math.min(view.R, 1200); for (const s of SHOPS) { const x = (mercX(s.lon) - O.x) / O.mpu, zz = (mercY(s.lat) - O.y) / O.mpu; if (Math.abs(x - view.focus[0]) < rr && Math.abs(zz - view.focus[1]) < rr && Math.hypot(x - view.focus[0], zz - view.focus[1]) < rr) shopFor(s.lon, s.lat, 0, formOf(s.f)); } }
    // Werk in volgorde van afstand: eerst voorbereiden, dan de eigen meshes, dan de buurt; hooguit ongeveer 14 ms per
    // beeld (een grote plek kan dat in zijn eentje overschrijden; de rest volgt dan in de volgende beelden).
    const reach = Math.min(view.R * 1.25, (view.camDist || 5000) * 3.2, 25000); const todo = [];
    for (const d of [...depots, ...sites]) {
      if (d.lon0 == null) continue; const dist = Math.hypot(d.gx - view.focus[0], d.gz - view.focus[1]); const near = dist < reach + (d.prepared ? d.rAll || d.radius || 200 : d.rough);
      const minZ = d.shop ? 14 : 11;
      if (near && z >= minZ - 0.4 && (!d.prepared || !d.built || (!d.nbDone && z >= 13.2))) todo.push([dist, d]);
      if (d.group) showGroup(d, z, near && z >= minZ && !(d.shop && ofm));
    }
    todo.sort((a, b) => a[0] - b[0]);
    for (const [, d] of todo) {
      if (spent >= 14) break; const t = performance.now(); const minZ = d.shop ? 14 : 11;
      if (!d.prepared) ensure(d); else if (!d.built && z >= minZ) { build(d); if (d.group) showGroup(d, z, !(d.shop && ofm)); } else if (d.built && !d.nbDone && z >= 13.2) { buildNeighbours(d); showGroup(d, z, true); }
      spent += performance.now() - t;
    }
    updateNature(view, false);
  }
  // zichtbaarheid van een plek en van elk deel naar de zoom (de buurt is een eigen groep)
  function showGroup(d, z, vis) {
    d.group.visible = vis; if (!vis) return;
    for (const m of d.group.children) { if (m.isGroup) { m.visible = z >= 13.2; for (const c of m.children) c.visible = z >= (c.userData.minZoom || 0); } else m.visible = z >= (m.userData.minZoom || 0); }
  }
  // gebieden waar deze wereld echte gebouwcontouren tekent, als GeoJSON (voor het filter op de OFM-laag van de kaart)
  let coverCache = null;
  function coverage() {
    if (coverCache !== null) return coverCache || null;
    const polys = [];
    for (const d of [...depots, ...sites]) {
      if (d.lon0 == null || !d.buildings || d.procedural || d.shop || !d.buildings.length) continue;
      const pts = [...(d.terrain || []), ...d.buildings.flatMap(b => b.ring)]; if (pts.length < 3) continue;
      const h = offsetRing(cleanRing(hull(pts)), 12); if (h.length < 3) continue;
      const ring = h.map(([x, z]) => lonLat(d.mx0 + x * d.mpu0, d.my0 + z * d.mpu0)); ring.push(ring[0]);
      polys.push([ring]);
    }
    coverCache = polys.length ? { type: 'MultiPolygon', coordinates: polys } : false; return coverCache || null;
  }
  let ofm = false; function setOfm(v) { if (v !== ofm) { ofm = v; natureKey = ''; } }
  // het thema van de interface verandert de wereld niet: het licht komt uit de klok van de simulatie (setLicht)
  function setTheme(t) { theme = t; }
  // licht uit de klok (scene3d.js, licht.js): ramen en dockborden branden vanaf de schemer, en 's nachts is het terrein
  // donkerder, zodat de lichtpoelen en de verlichte gevels eruit springen
  const WIT = new THREE.Color(0xFFFFFF), YARD_N = new THREE.Color(0x737B85), APRON_N = new THREE.Color(0x646B74);
  function setLicht(L) {
    const k = L.lampen;
    M.yard.color.copy(WIT).lerp(YARD_N, L.donker); M.apron.color.copy(WIT).lerp(APRON_N, L.donker);
    for (const m of [M.office, M.officeV, M.houseVC, M.house, M.wallSL, M.wallN, M.wallNV]) m.emissiveIntensity = k * (m === M.wallSL || m === M.wallN || m === M.wallNV ? 0.9 : 1.15);
    M.plate.emissiveIntensity = k * 0.32;
  }
  function stats() { let tris = 0; root.traverseVisible(o => { if (o.isMesh && o.visible) { const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; tris += o.isInstancedMesh ? n * o.count : n; } }); return { depotsBuilt: depots.filter(d => d.built).length, sitesBuilt: sites.filter(d => d.built).length, nbBuilt: [...depots, ...sites].filter(d => d.nbGroup).length, sites: sites.length, realDepots: depots.filter(d => d.buildings && d.buildings.some(b => b.own) && !d.procedural).length, layoutMs: Math.round(prepMs), prepared: [...depots, ...sites].filter(d => d.prepared && !d.shop).length, assetMs, pieceMs, kenneyTrees, docks: depots.reduce((a, d) => a + (d.docks ? d.docks.length : 0), 0), tris: Math.round(tris), buildMs: Math.round([...depots, ...sites].reduce((a, d) => a + (d.buildMs || 0), 0)), nbMs: Math.round([...depots, ...sites].reduce((a, d) => a + (d.nbMs || 0), 0)) }; }
  function dispose() { root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } }); for (const m of Object.values(M)) { for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].dispose(); m.dispose(); } for (const pc of Object.values(PIECE)) { if (pc.material.map) pc.material.map.dispose(); pc.material.dispose(); pc.geometry.dispose(); } palCars.dispose(); scene.remove(root); }
  setTheme(theme);
  // de naamborden van de afdelingen in beeld (zichtbare plekken met sp.afdelingen), in scene-meters
  const signList = [];
  function signs() { signList.length = 0; for (const d of depots) { if (!d.group || !d.group.visible || !d.afd || !d.afd.length) continue; for (const a of d.afd) { const [x, z] = toScene(d, a.x, a.z); signList.push({ naam: a.naam, prio: a.prio, x, y: a.y * d.sc, z }); } } return signList; }
  // de naam van de standplaats die de kaart zelf bij het adres zet (een ruit met de naam rechts ervan): daar geen bord
  const freeList = [];
  function signsFree() { freeList.length = 0; for (const d of depots) { if (!d.group || !d.group.visible || !d.afd || !d.afd.length || !isFinite(+d.s.lon)) continue; const [lx, lz] = d.toLocal(+d.s.lon, +d.s.lat); const [x, z] = toScene(d, lx, lz); freeList.push([x, 0, z, 12, 18 + 8 * d.name.length, 12, 12]); } return freeList; }
  return { loading, update, updateNature, setOrigin, endParking, dockAt, dockPose, customer, rowHeading, setTheme, setLicht, signs, signsFree, stats, dispose, coverage, setOfm, depots, sites: () => sites, ready: () => ready, root, pools: () => { const out = []; for (const d of [...depots, ...sites]) if (d.group && d.group.visible && d.pools) for (const [x, z, r] of d.pools) { const [sx, sz] = toScene(d, x, z); out.push([sx, sz, r * d.sc]); } return out; } };
}

// verlichte ramen 's nachts: niet elk raam brandt (vaste toevalsreeks per raam), zodat gevels levendig ogen
function litWindows(mat, frac, instanced) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + (instanced ? '\nvarying float vInst;' : '')).replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nwp = instanceMatrix * wp;\n#endif\nvWPos = (modelMatrix * wp).xyz; }' + (instanced ? '\nvInst = float(gl_InstanceID);' : ''));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + (instanced ? '\nvarying float vInst;' : '') + '\nfloat litHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 cell = floor(vWPos / vec3(1.5, 3.4, 1.5)); float h = litHash(cell${instanced ? ' + vec3(vInst * 0.37)' : ''}); totalEmissiveRadiance *= step(1.0 - ${frac.toFixed(2)}, h) * (0.65 + 0.35 * fract(h * 7.0)); }`);
  };
  mat.customProgramCacheKey = () => 'lit' + frac + (instanced ? 'i' : '');
}
