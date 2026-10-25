// 3D-wereld: de kaart als speelgoedlandschap in de stijl van Simon Loos (rood, wit, zachte grijzen en groenen),
// getekend met three.js in een eigen laag van MapLibre (CustomLayerInterface, renderingMode "3d"). Alles is
// procedureel uit boxen, cilinders en kegels; geen modellen of texturen van buiten, geen enkel verzoek naar buiten.
// Posities komen uit de simulatie (voertuigen met hun koers, losse opleggers), de depots uit places.json, de bomen
// staan op vaste plekken (eigen seed) rond de depots en in de bebouwde vlakken. De maten groeien mee met uitzoomen,
// zoals de iconen op de 2D-kaart, zodat de wereld op elk zoomniveau leesbaar blijft.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// Geen imports uit de app zelf: de standplaatsen, statuskleuren en bebouwing komen mee via opts.data. Zo blijft deze
// module (met three.js) een eigen, pas bij de eerste klik geladen bundel, zonder dat app.js er statisch aan hangt.

const C = {
  rood: 0xE3001F, wit: 0xF7F8F9, glas: 0xB9CFE3, chassis: 0x343A42, wiel: 0x1F2327, asfalt: 0xC7CCD2, muur: 0xE9EBEE,
  dak: 0xE6E9ED, dock: 0x5B6471, stam: 0x7A5C40, boom: [0x3F8F5C, 0x5CAA6E, 0x2E7A4A], lamp: 0xFFFFFF,
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// vaste toevalsreeks per plek (los van de simulatie): twee getallen in, een getal 0..1 uit
const hash = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const mpp = (lat, z) => 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** z;   // meters per pixel

// ---------- bouwstenen met vertexkleuren (één materiaal per mesh) ----------
function colored(g, hex) { const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const box = (w, h, d, x, y, z, hex) => colored(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
const cone = (r, h, x, y, z, hex) => colored(new THREE.ConeGeometry(r, h, 6).translate(x, y, z), hex);
const cyl = (r, h, x, y, z, hex) => colored(new THREE.CylinderGeometry(r, r * 1.15, h, 7).translate(x, y, z), hex);
const merge = parts => mergeGeometries(parts, false);
const wheels = (zs, w) => zs.flatMap(z => [box(0.45, 1.0, 1.0, -w / 2, 0.5, z, C.wiel), box(0.45, 1.0, 1.0, w / 2, 0.5, z, C.wiel)]);
// een cabine met de neus naar het noorden (−z): rood, met een lichte ruit
const cab = zFront => [box(2.5, 2.3, 2.3, 0, 2.35, zFront + 1.15, C.rood), box(2.2, 0.75, 0.25, 0, 2.75, zFront, C.glas), box(2.3, 0.5, 2.3, 0, 1.0, zFront + 1.15, C.chassis)];
const trailerBody = z0 => [box(2.55, 2.75, 13.6, 0, 2.6, z0, C.wit), box(2.62, 0.38, 13.5, 0, 2.25, z0, C.rood), box(2.2, 0.45, 7, 0, 1.0, z0 + 3.2, C.chassis), ...wheels([z0 + 3.2, z0 + 4.5, z0 + 5.8], 2.3)];
// voertuigsoorten: geometrie, hoogte en plek van het statuslampje
const MODELS = {
  trekker: { g: () => merge([...cab(-8.25), ...wheels([-6.7, -4.3], 2.3), box(2.2, 0.5, 4.2, 0, 0.95, -5.9, C.chassis), ...trailerBody(1.1)]), lamp: [0, 3.8, -7.1] },
  solo: { g: () => merge([...cab(-3.0), ...wheels([-1.5, 1.6], 2.3), box(2.2, 0.5, 4.8, 0, 0.95, -0.2, C.chassis), box(1.4, 0.25, 1.4, 0, 1.3, 1.2, C.chassis)]), lamp: [0, 3.8, -1.85] },
  bakwagen: { g: () => merge([...cab(-5.0), ...wheels([-3.4, 2.9, 4.2], 2.3), box(2.2, 0.5, 8, 0, 0.95, 1.0, C.chassis), box(2.5, 2.6, 7.2, 0, 2.5, 1.4, C.wit), box(2.56, 0.36, 7.1, 0, 2.2, 1.4, C.rood)]), lamp: [0, 3.8, -3.85] },
  bus: { g: () => merge([box(2.1, 1.9, 5.9, 0, 1.55, 0, C.wit), box(2.16, 0.32, 5.8, 0, 1.25, 0, C.rood), box(1.9, 0.7, 0.25, 0, 1.95, -2.9, C.glas), box(2.0, 0.3, 1.2, 0, 2.55, -1.8, C.rood), ...wheels([-1.8, 1.8], 1.9)]), lamp: [0, 2.9, 0.4] },
};
const LOOSE = { g: () => merge([...trailerBody(0), box(0.25, 1.25, 0.25, -0.8, 0.62, -4.8, C.chassis), box(0.25, 1.25, 0.25, 0.8, 0.62, -4.8, C.chassis)]), lamp: [0, 4.3, -5.5] };
const TREE = hex => merge([cyl(0.35, 2.2, 0, 1.1, 0, C.stam), cone(2.4, 6.2, 0, 5.1, 0, hex)]);
// een huis: lichte muren, donker zadeldak (een platte kegel met vier zijden), iets variatie in grootte per instantie
const HOUSE = () => { const roof = new THREE.ConeGeometry(6.3, 3.0, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 7.0, 0); return merge([box(9, 5.5, 9, 0, 2.75, 0, 0xF4F1EA), colored(roof, 0x9C928A)]); };

// een depot in meters rond zijn ankerpunt: loods met rode daklijst en docks aan de zuidkant, kantoor, terrein;
// het hoofdkantoor krijgt een toren. Grootte naar het aantal voertuigen van de standplaats.
function depotGeometry(s) {
  const f = s.fleet || 20; const W = clamp(44 + f * 0.34, 56, 120), D = clamp(30 + f * 0.1, 34, 56); const parts = [];
  parts.push(box(W, 10, D, 0, 5, 0, C.muur), box(W + 1.6, 1.3, D + 1.6, 0, 10.4, 0, C.rood), box(W - 1.5, 0.5, D - 1.5, 0, 11.3, 0, C.dak));
  const n = Math.max(3, Math.floor(W / 9)); for (let i = 0; i < n; i++) parts.push(box(4.2, 4.6, 0.7, -W / 2 + 6 + i * (W - 12) / (n - 1), 2.3, D / 2 + 0.35, C.dock));
  parts.push(box(W, 0.6, 5, 0, 5.2, D / 2 + 2.5, C.rood));
  const ox = -W / 2 - 16, oz = -D / 2 + 8;
  parts.push(box(20, 8, 14, ox, 4, oz, C.wit), box(20.4, 1.1, 14.4, ox, 3.0, oz, C.glas), box(20.4, 1.1, 14.4, ox, 6.2, oz, C.glas), box(12, 1.6, 0.5, ox, 9, oz + 7.2, C.rood));
  if (s.hub) { const tx = -W / 2 - 34, tz = -D / 2 - 14; parts.push(box(16, 36, 16, tx, 18, tz, C.wit)); for (let y = 3; y < 34; y += 4) parts.push(box(16.5, 1.3, 16.5, tx, y, tz, C.glas)); parts.push(box(17.5, 1.8, 17.5, tx, 36.5, tz, C.rood)); }
  return { geom: merge(parts), W, D };
}
// bomen rond een depot: vaste plekken (seed per standplaats), in een ring rond het terrein
function depotTrees(i, W, D) { const out = []; const n = 12 + Math.floor(hash(i, 7) * 8); for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + hash(i, k) * 0.5; const rx = W / 2 + 40 + hash(i, k + 100) * 50, rz = D / 2 + 60 + hash(i, k + 300) * 70; out.push([Math.cos(a) * rx, Math.sin(a) * rz + 12, Math.floor(hash(i, k + 200) * 3)]); } return out; }
// bomen in de bebouwing: een raster van ongeveer 600 m met een vaste verschuiving per punt, binnen de vlakken van urban.json
function urbanTrees(urban) {
  const out = []; const inside = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; };
  urban.forEach((ring, ri) => {
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90; for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const dx = 0.0088, dy = 0.0054; let gi = 0;
    for (let y = y0; y <= y1; y += dy) for (let x = x0; x <= x1; x += dx, gi++) { const jx = (hash(ri, gi) - 0.5) * dx * 0.9, jy = (hash(ri, gi + 9999) - 0.5) * dy * 0.9; if (inside(ring, x + jx, y + jy)) out.push([x + jx, y + jy, Math.floor(hash(ri, gi + 777) * 3)]); }
  });
  return out;
}

export function createScene3d(map, maplibregl, opts) {
  const { SP, ST, TRST, urban } = opts.data;
  const scene = new THREE.Scene(); const camera = new THREE.Camera(); camera.matrixAutoUpdate = false;
  const hemi = new THREE.HemisphereLight(0xFFFFFF, 0xD2D8DF, 2.2); const sun = new THREE.DirectionalLight(0xFFFFFF, 2.4); sun.position.set(-0.55, 1, -0.65);
  scene.add(hemi, sun);
  const matLit = () => new THREE.MeshLambertMaterial({ vertexColors: true });
  const matLamp = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const MAXV = 1400, MAXT = 1800, MAXTREE = 2600;
  const veh = {}; for (const [k, m] of Object.entries(MODELS)) { const mesh = new THREE.InstancedMesh(m.g(), matLit(), MAXV); mesh.count = 0; mesh.frustumCulled = false; mesh.userData.kind = k; scene.add(mesh); veh[k] = { mesh, lamp: m.lamp, ids: [] }; }
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), matLamp, MAXV); lamps.count = 0; lamps.frustumCulled = false; scene.add(lamps);
  const loose = new THREE.InstancedMesh(LOOSE.g(), matLit(), MAXT); loose.count = 0; loose.frustumCulled = false; loose.userData.kind = 'oplegger'; scene.add(loose);
  const tlamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), matLamp, MAXT); tlamps.count = 0; tlamps.frustumCulled = false; scene.add(tlamps);
  const trees = C.boom.map(hex => { const m = new THREE.InstancedMesh(TREE(hex), matLit(), MAXTREE); m.count = 0; m.frustumCulled = false; scene.add(m); return m; });
  const houses = new THREE.InstancedMesh(HOUSE(), matLit(), 1600); houses.count = 0; houses.frustumCulled = false; scene.add(houses);
  const depots = SP.map((s, i) => { const { geom, W, D } = depotGeometry(s); const mesh = new THREE.Mesh(geom, matLit()); mesh.frustumCulled = false; scene.add(mesh); return { s, mesh, W, D, trees: depotTrees(i, W, D), local: [0, 0] }; });
  const depotByName = new Map(depots.map(d => [d.s.n, d]));
  const yards = new THREE.InstancedMesh(colored(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), C.asfalt), matLit(), SP.length); yards.count = SP.length; yards.frustumCulled = false; scene.add(yards);
  let urbanPts = null;

  let on = false, renderer = null, O = null, kV = 1, kB = 1, kT = 1, zoom = 0, theme = opts.theme || 'light';
  let vehicles = [], trailers = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), TMP = new THREE.Vector3();
  const ROTX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);

  // oorsprong van de scene: de kaartpositie, in Mercator; alles ligt in meters rond dat punt (precies genoeg voor WebGL)
  function setOrigin() { const c = map.getCenter(); const mc = maplibregl.MercatorCoordinate.fromLngLat([c.lng, c.lat]); O = { x: mc.x, y: mc.y, mpu: mc.meterInMercatorCoordinateUnits(), lon: c.lng, lat: c.lat }; }
  const local = (lon, lat) => { const mc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat]); return [(mc.x - O.x) / O.mpu, (mc.y - O.y) / O.mpu]; };
  function needsOrigin() { if (!O) return true; const c = map.getCenter(); const [x, z] = local(c.lng, c.lat); return Math.hypot(x, z) > 2500; }
  // schaal per zoomniveau: voertuigen houden ongeveer dezelfde grootte op het scherm (zoals de iconen op de platte
  // kaart); gebouwen en bomen schalen mee maar kleiner, zodat een loods zo'n vier trucks breed blijft
  function scales() { const z = map.getZoom(); const m = mpp(map.getCenter().lat, z); const kV = clamp(3.3 * m, 1, 40); return { kV, kB: Math.max(1, kV * 0.5), kT: Math.max(1, Math.min(kV * 0.9, 26)), z }; }
  // voertuigen iets breder en hoger dan echt: dat leest beter van bovenaf (speelgoedverhouding)
  const put = (mesh, i, x, z, bearing, k, chunky) => { P.set(x, 0, z); Q.setFromAxisAngle(UP, -bearing * Math.PI / 180); if (chunky) S.set(k * 1.3, k * 1.2, k); else S.set(k, k, k); M.compose(P, Q, S); mesh.setMatrixAt(i, M); };
  const putLamp = (mesh, i, x, z, bearing, k, off, hex) => { const a = -bearing * Math.PI / 180; const lx = off[0] * k * 1.3, ly = off[1] * k * 1.2, lz = off[2] * k; P.set(x + lx * Math.cos(a) + lz * Math.sin(a), ly, z - lx * Math.sin(a) + lz * Math.cos(a)); Q.identity(); S.set(k * 1.2, k * 1.2, k * 1.2); M.compose(P, Q, S); mesh.setMatrixAt(i, M); mesh.setColorAt(i, TMP_COLOR.set(hex)); };
  const TMP_COLOR = new THREE.Color();

  // parkeerplekken op het terrein: voertuigen in rijen ten zuiden van de loods, opleggers ten noorden; in meters maal de voertuigschaal
  // plek van de loods in gebouwschaal, afstand tussen de rijen in voertuigschaal
  const slotV = (d, i) => [(-d.W / 2 + 4) * kB + (2.2 + (i % 5) * 4.6) * kV, (d.D / 2 + 14) * kB + (10 + Math.floor(i / 5) * 21) * kV];
  const slotT = (d, i) => [(-d.W / 2 + 2) * kB + (2.2 + (i % 7) * 4.6) * kV, (-d.D / 2 - 8) * kB - (8 + Math.floor(i / 7) * 19) * kV];

  function rebuildVehicles() {
    if (!on || !O) return;
    for (const v of Object.values(veh)) { v.mesh.count = 0; v.ids.length = 0; } let nl = 0; const parked = new Map();
    for (const f of vehicles) {
      const v = veh[f.k] || veh.trekker; if (v.mesh.count >= MAXV) continue;
      let x, z, b = f.b || 0;
      if (f.st === 'terrein') { if (zoom < 12 || !depotByName.has(f.base)) continue; const d = depotByName.get(f.base); const n = parked.get(d) || 0; if (n >= 25) continue; parked.set(d, n + 1); const [sx, sz] = slotV(d, n); x = d.local[0] + sx; z = d.local[1] + sz; b = 0; }
      else { [x, z] = local(f.lon, f.lat); }
      const i = v.mesh.count++; v.ids[i] = f.id; put(v.mesh, i, x, z, b, kV, true);
      if (nl < MAXV) { putLamp(lamps, nl++, x, z, b, kV, v.lamp, (ST[f.st] || ST.terrein).color); }
    }
    for (const v of Object.values(veh)) v.mesh.instanceMatrix.needsUpdate = true;
    lamps.count = nl; lamps.instanceMatrix.needsUpdate = true; if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
  }
  function rebuildTrailers() {
    if (!on || !O) return;
    loose.count = 0; loose.userData.ids = []; let nl = 0; const parked = new Map();
    for (const f of trailers) {
      if (loose.count >= MAXT) break; let x, z, b = 0;
      if (f.st === 'klaar' || f.st === 'leeg') { if (zoom < 12 || !depotByName.has(f.base)) continue; const d = depotByName.get(f.base); const n = parked.get(d) || 0; if (n >= 28) continue; parked.set(d, n + 1); const [sx, sz] = slotT(d, n); x = d.local[0] + sx; z = d.local[1] + sz; }
      else { [x, z] = local(f.lon, f.lat); let hs = 0; for (let c = 0; c < f.id.length; c++) hs = (hs * 31 + f.id.charCodeAt(c)) | 0; b = hash(hs, 3) * 50 - 25; x += (hash(hs, 5) - 0.5) * 9 * kV; z += (hash(hs, 6) - 0.5) * 9 * kV; }
      const i = loose.count++; loose.userData.ids[i] = f.id; put(loose, i, x, z, b, kV, true);
      putLamp(tlamps, nl++, x, z, b, kV, LOOSE.lamp, (TRST[f.st] || TRST.leeg).color);
    }
    loose.instanceMatrix.needsUpdate = true; tlamps.count = nl; tlamps.instanceMatrix.needsUpdate = true; if (tlamps.instanceColor) tlamps.instanceColor.needsUpdate = true;
  }
  function rebuildStatic() {
    if (!on || !O) return;
    depots.forEach((d, i) => {
      d.local = local(d.s.lon, d.s.lat); d.mesh.position.set(d.local[0], 0, d.local[1]); d.mesh.scale.setScalar(kB); d.mesh.updateMatrix();
      const rows = zoom >= 12; const left = (-d.W / 2 - 10) * kB, right = Math.max((d.W / 2 + 10) * kB, left + 6 * kB + 7.2 * 4.6 * kV); const top = -(d.D / 2 + 8) * kB - (rows ? (8 + 3 * 19 + 8) * kV : 6 * kB), bottom = (d.D / 2 + 14) * kB + (rows ? (10 + 4 * 21 + 10) * kV : 8 * kB);
      P.set(d.local[0] + (left + right) / 2, 0, d.local[1] + (top + bottom) / 2); Q.identity(); S.set(right - left, 0.6 * kB, bottom - top); M.compose(P, Q, S); yards.setMatrixAt(i, M);
      d.yard = [d.local[0] + left - 60 * kB, d.local[0] + right + 60 * kB, d.local[1] + top - 60 * kB, d.local[1] + bottom + 60 * kB];
    });
    yards.instanceMatrix.needsUpdate = true;
    const counts = [0, 0, 0]; const b = map.getBounds(); const pad = 0.15; const x0 = b.getWest() - pad, x1 = b.getEast() + pad, y0 = b.getSouth() - pad, y1 = b.getNorth() + pad;
    const place = (x, z, v) => { const m = trees[v]; if (m.count >= MAXTREE) return; put(m, m.count++, x, z, hash(Math.round(x), Math.round(z)) * 360, kT); };
    for (const m of trees) m.count = 0;
    if (zoom >= 10.5) for (const d of depots) { if (d.s.lon < x0 || d.s.lon > x1 || d.s.lat < y0 || d.s.lat > y1) continue; for (const [tx, tz, v] of d.trees) place(d.local[0] + tx * kB, d.local[1] + tz * kB, v); }
    houses.count = 0;
    if (zoom >= 11.2) { if (!urbanPts) urbanPts = urbanTrees(urban); const step = zoom < 12.5 ? 3 : 1; for (let i = 0; i < urbanPts.length; i += step) { const [lon, lat, v] = urbanPts[i]; if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue; const [x, z] = local(lon, lat); if (depots.some(d => d.yard && x > d.yard[0] && x < d.yard[1] && z > d.yard[2] && z < d.yard[3])) continue; if (zoom >= 12.5 && i % 3 === 1) { if (houses.count < 1600) { const g = hash(i, 11); const kh = kT * 0.62; P.set(x, 0, z); Q.setFromAxisAngle(UP, Math.floor(hash(i, 12) * 4) * Math.PI / 2 + (hash(i, 13) - 0.5) * 0.4); S.set(kh * (0.8 + g * 0.5), kh * (0.8 + g * 0.3), kh * (0.8 + hash(i, 14) * 0.6)); M.compose(P, Q, S); houses.setMatrixAt(houses.count++, M); } } else place(x, z, v); } }
    for (const m of trees) m.instanceMatrix.needsUpdate = true; houses.instanceMatrix.needsUpdate = true;
    counts.length = 0;
  }
  // bij elke verplaatsing van de kaart: nieuwe schaal of oorsprong nodig? Dan alles opnieuw plaatsen.
  function refresh(force) {
    if (!on) return; const sc = scales(); const kChanged = Math.abs(Math.log2(sc.kV / kV)) > 0.03 || Math.abs(Math.log2(sc.kB / kB)) > 0.03; const zChanged = Math.abs(sc.z - zoom) > 0.25;
    if (force || kChanged || needsOrigin() || zChanged) { if (force || needsOrigin()) setOrigin(); kV = sc.kV; kB = sc.kB; kT = sc.kT; zoom = sc.z; rebuildStatic(); rebuildVehicles(); rebuildTrailers(); }
  }
  const layer = {
    id: 'scene3d', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) { renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true }); renderer.autoClear = false; },
    render(gl, args) {
      if (!on || !O) return;
      // MapLibre 5+ geeft een object met de projectie (Mercator-eenheden naar het scherm); oudere versies de matrix zelf
      const matrix = args && args.defaultProjectionData ? args.defaultProjectionData.mainMatrix : args && args.modelViewProjectionMatrix ? args.modelViewProjectionMatrix : args;
      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4().makeTranslation(O.x, O.y, 0).scale(new THREE.Vector3(O.mpu, -O.mpu, O.mpu)).multiply(ROTX);
      camera.projectionMatrix = m.multiply(l); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState(); renderer.render(scene, camera);
    },
  };
  map.addLayer(layer);
  map.on('move', () => refresh(false));

  // klik en aanwijzen: een straal door de scene (de projectiematrix van de kaart teruggerekend), raak de voertuigen en opleggers
  const ray = new THREE.Raycaster(); const pickable = [...Object.values(veh).map(v => v.mesh), loose];
  function pick(pt) {
    if (!on || !O) return null; const el = map.getCanvas(); const w = el.clientWidth || el.width, h = el.clientHeight || el.height;
    const nx = (pt.x / w) * 2 - 1, ny = -(pt.y / h) * 2 + 1;
    const a = new THREE.Vector3(nx, ny, -1).applyMatrix4(camera.projectionMatrixInverse), b = new THREE.Vector3(nx, ny, 1).applyMatrix4(camera.projectionMatrixInverse);
    ray.set(a, b.sub(a).normalize()); const hits = ray.intersectObjects(pickable, false); if (!hits.length) return null;
    const hit = hits[0]; const mesh = hit.object; const kind = mesh.userData.kind; const id = kind === 'oplegger' ? mesh.userData.ids[hit.instanceId] : veh[kind].ids[hit.instanceId];
    return id ? { id, trailer: kind === 'oplegger' } : null;
  }
  let hoverT = 0;
  map.on('click', e => { if (!on) return; const hit = pick(e.point); if (hit) { e.preventDefault(); if (hit.trailer) opts.onSelectTrailer && opts.onSelectTrailer(hit.id); else opts.onSelectTruck && opts.onSelectTruck(hit.id); } });
  map.on('mousemove', e => { if (!on) return; const now = Date.now(); if (now - hoverT < 70) return; hoverT = now; const hit = pick(e.point); map.getCanvas().style.cursor = hit ? 'pointer' : ''; opts.onHover && opts.onHover(hit && !hit.trailer ? hit.id : null, e.point); });

  function setTheme(t) { theme = t; const dark = t === 'dark'; hemi.color.set(dark ? 0x9FB0C6 : 0xFFFFFF); hemi.groundColor.set(dark ? 0x1E242B : 0xD2D8DF); hemi.intensity = dark ? 1.3 : 2.2; sun.intensity = dark ? 1.3 : 2.4; const mul = dark ? 0x9AA3AE : 0xFFFFFF; for (const d of depots) d.mesh.material.color.set(mul); yards.material.color.set(dark ? 0x7F8893 : 0xFFFFFF); for (const m of trees) m.material.color.set(dark ? 0x8E99A6 : 0xFFFFFF); houses.material.color.set(dark ? 0x8A929D : 0xFFFFFF); if (on) map.triggerRepaint(); }
  function enable(v) { on = v; if (v) { refresh(true); } map.triggerRepaint(); }
  function setVehicles(list) { vehicles = list; if (on) { rebuildVehicles(); map.triggerRepaint(); } }
  function setTrailers(list) { trailers = list; if (on) { rebuildTrailers(); map.triggerRepaint(); } }
  setTheme(theme);
  return { enable, isOn: () => on, setVehicles, setTrailers, setTheme, pick, refresh: () => refresh(true) };
}
