// Basiskaart in de geest van Google Maps, uit de eigen data (werkt zonder internet en in de ingebedde versie):
// zee en meren blauw, land licht, bebouwing iets warmer, snelwegen geel met een donkerder rand, autowegen en N-wegen wit
// met een grijze rand, de overige wegen wit, provinciegrenzen heel licht. Tekst (plaatsen, standplaatsen, wegnummers,
// straatnamen) staat in gewone symboollagen van MapLibre, met botsingsafhandeling en tekst langs de weg; de letters
// tekent MapLibre zelf in de browser uit de systeemletter (de stijl heeft geen glyphs-adres, dus er is geen glyph-server
// nodig). Met internet (losse versie) komen de tegels van CARTO Voyager eroverheen, in 3D ook gebouwen van OpenFreeMap.
import provinces from './data/provinces.json';
import urbanRings from './data/urban.json';
import water from './data/water.json';
import land from './data/land.json';
import display from './data/roads_display.json';
import { allEdges, edgeGeom, decode } from './roads.js';
import { SP, CITIES, TOWNS, DCS, WINKELS, BEZORG, toegangVan, laadGebouwen } from './places.js';

const fc = features => ({ type: 'FeatureCollection', features });
const line = (coords, props) => ({ type: 'Feature', properties: props || {}, geometry: { type: 'LineString', coordinates: coords } });
const Z = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
const ZE = (...stops) => ['interpolate', ['exponential', 1.6], ['zoom'], ...stops];

// Systeemletter (Inter als die lokaal staat); het gewicht staat in de eerste naam, daar leest MapLibre het uit.
const STACK = ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial'];
export const FONT = { reg: ['Inter', ...STACK], med: ['Inter Medium', ...STACK], semi: ['Inter Semibold', ...STACK], ital: ['Inter Italic', ...STACK] };

// ---------------------------------------------------------------------------------------------------------------------
// Kleuren. Licht: de Google-kleuren uit de brief; donker: dezelfde opbouw in donker; 3D: een zachter grondpalet.
export const PAL = {
  light: {
    sea: '#AADAFF', land: '#F2F3F0', urban: '#EDEBE6', bld: '#E6E3DC', bldC: '#D8D3C9', bld3d: '#DADCDF', site: '#E7E7E4', siteC: '#D3D4D0', hal: '#DCDAD4', halC: '#C5C2BA', poi: '#5F6368', poiBg: '#FFFFFF', dockText: '#FFFFFF', warnText: '#B45309',
    prov: '#C5CAC6', border: '#9EA4A9', mw: '#F6C343', mwC: '#E0A800', tr: '#FFFFFF', trC: '#D6D6D6', pr: '#FFFFFF', prC: '#D6D6D6', se: '#FFFFFF', seC: '#E1E1DD', te: '#FFFFFF',
    text: '#202124', text2: '#3C4043', text3: '#5F6368', halo: '#FFFFFF', waterText: '#3E77B0', sp: '#E3001F', spRing: '#FFFFFF',
    stroke: '#FFFFFF', done: '#A6AEBB', dim: '#9AA3B0', tiles: 'rastertiles/voyager',
  },
  dark: {
    sea: '#14273B', land: '#1B1F24', urban: '#21262C', bld: '#2A3037', bldC: '#353C45', bld3d: '#3A414B', site: '#22272D', siteC: '#2F353C', hal: '#2C3138', halC: '#3A414A', poi: '#AEB5BF', poiBg: '#22272D', dockText: '#14171B', warnText: '#F59E0B',
    prov: '#3A424C', border: '#5B6470', mw: '#8F7330', mwC: '#5E4A1A', tr: '#3B424C', trC: '#14181D', pr: '#353B44', prC: '#14181D', se: '#2E343C', seC: '#181C21', te: '#2A3037',
    text: '#E8EAED', text2: '#C9CED6', text3: '#A3AAB5', halo: '#15181D', waterText: '#7FA7CF', sp: '#FF3348', spRing: '#0F1216',
    stroke: '#0F1216', done: '#5F6775', dim: '#4A5260', tiles: 'dark_all',
  },
};
// in de 3D-stand: lichte grondtinten (zacht groen-grijs land, beige bebouwing, zacht water), passend bij de 3D-wereld
export const PAL3 = { light: { land: '#E6ECE1', urban: '#ECE6DA', sea: '#B4D8EE' }, dark: { land: '#161C18', urban: '#1D221E', sea: '#0D1A26' } };

// ---------------------------------------------------------------------------------------------------------------------
// Gegevens (een keer opgebouwd)
const km = (a, b) => { const k = Math.cos((a[1] + b[1]) * Math.PI / 360); return Math.hypot((a[0] - b[0]) * k * 111.32, (a[1] - b[1]) * 111.32); };
function segDist(p, a, b) {
  const k = Math.cos(p[1] * Math.PI / 180) * 111.32, ax = a[0] * k, ay = a[1] * 111.32, bx = b[0] * k, by = b[1] * 111.32, px = p[0] * k, py = p[1] * 111.32;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
// lijnstukken aan elkaar rijgen tot lijnen
function stitch(edges) {
  const key = p => p[0] + ',' + p[1]; const adj = new Map(); const used = new Set();
  edges.forEach((e, i) => { for (const p of e) { const k = key(p); if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
  const out = [];
  for (let i = 0; i < edges.length; i++) {
    if (used.has(i)) continue; used.add(i); const pts = [edges[i][0], edges[i][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const end = dir ? pts[pts.length - 1] : pts[0]; const nb = (adj.get(key(end)) || []).find(j => !used.has(j)); if (nb === undefined) break;
        used.add(nb); const e = edges[nb]; const nxt = key(e[0]) === key(end) ? e[1] : e[0]; if (dir) pts.push(nxt); else pts.unshift(nxt);
      }
    }
    out.push(pts);
  }
  return out;
}
// Provinciegrenzen: alleen de randen die twee provincies delen (geen kustlijnen). Landsgrens: de randen van Nederland die
// dicht bij een buurland liggen. Naad: de rand van de buurlanden bij Nederland, breed in de landkleur getekend, zodat er
// tussen de (grovere) buurlanden en Nederland geen zee-kleurige spleet zichtbaar is.
function borders() {
  const k = p => p[0].toFixed(4) + ',' + p[1].toFixed(4); const ek = (a, b) => { const A = k(a), B = k(b); return A < B ? A + '|' + B : B + '|' + A; };
  const cnt = new Map(), seg = new Map();
  for (const p of provinces) for (const r of p.rings) for (let i = 1; i < r.length; i++) { const key = ek(r[i - 1], r[i]); cnt.set(key, (cnt.get(key) || 0) + 1); seg.set(key, [r[i - 1], r[i]]); }
  const inner = []; for (const [key, n] of cnt) if (n >= 2) inner.push(seg.get(key));
  const ctx = []; for (const poly of land.ctx) for (const r of poly) for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i]; if (Math.max(a[0], b[0]) < 2.8 || Math.min(a[0], b[0]) > 7.6 || Math.max(a[1], b[1]) < 50.5 || Math.min(a[1], b[1]) > 53.9) continue; ctx.push([a, b]); }
  const nlEdges = []; for (const poly of land.nl) for (const r of poly) for (let i = 1; i < r.length; i++) nlEdges.push([r[i - 1], r[i]]);
  const near = (p, list, d) => list.some(([a, b]) => segDist(p, a, b) < d);
  const nat = nlEdges.filter(([a, b]) => near([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ctx, 3.2) && near(a, ctx, 4) && near(b, ctx, 4));
  const seam = ctx.filter(([a, b]) => near([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], nlEdges, 4.5));
  return { inner: stitch(inner), nat: stitch(nat), seam: stitch(seam) };
}
// Wegen voor namen en nummers: roads_display.json mag per weg een naam (n) en wegnummer (ref) hebben. De vorm van een
// item is een polyline-tekst, of een object/array met de polyline (of coördinaten) plus n en ref. Zonder die velden: geen tekst.
function geomOf(e) {
  if (typeof e === 'string') return decode(e);
  if (Array.isArray(e)) { if (typeof e[0] === 'string') return decode(e[0]); if (Array.isArray(e[0]) && typeof e[0][0] === 'number') return e; return null; }
  if (e && typeof e === 'object') {
    for (const k of ['p', 'g', 'geom', 'line', 'l', 's', 'poly', 'polyline', 'enc', 'c', 'coords', 'coordinates']) { const v = e[k]; if (typeof v === 'string' && v.length > 1) return decode(v); if (Array.isArray(v) && v.length > 1 && Array.isArray(v[0])) return v; }
    if (e.geometry && e.geometry.coordinates) return e.geometry.coordinates;
  }
  return null;
}
const nameOf = e => (e && !Array.isArray(e) && typeof e === 'object' ? e.n || e.name || null : Array.isArray(e) && typeof e[1] === 'string' ? e[1] : null);
const refOf = e => (e && !Array.isArray(e) && typeof e === 'object' ? e.ref || e.r || null : Array.isArray(e) && typeof e[2] === 'string' ? e[2] : null);
// Lijnstukken met dezelfde naam en hetzelfde nummer aan elkaar rijgen (via gedeelde eindpunten), zodat een schildje of
// straatnaam over de hele weg verdeeld wordt in plaats van per kort stuk.
function stitchLines(lines) {
  const key = p => Math.round(p[0] * 1e5) + ',' + Math.round(p[1] * 1e5); const ends = new Map(); const used = new Uint8Array(lines.length);
  lines.forEach((l, i) => { for (const p of [l[0], l[l.length - 1]]) { const k = key(p); let a = ends.get(k); if (!a) ends.set(k, a = []); a.push(i); } });
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue; used[i] = 1; let pts = lines[i].slice();
    for (const fwd of [true, false]) {
      for (;;) {
        const end = fwd ? pts[pts.length - 1] : pts[0]; const j = (ends.get(key(end)) || []).find(x => !used[x]); if (j === undefined) break;
        used[j] = 1; let l = lines[j]; if (key(l[0]) !== key(end)) l = l.slice().reverse();
        pts = fwd ? pts.concat(l.slice(1)) : l.slice(0, -1).concat(pts);
      }
    }
    out.push(pts);
  }
  return out;
}
const normRef = r => (r ? String(r).split(/[;,/]/)[0].trim().toUpperCase() : '');
// lab = { s: [teksten], g: [[kant, ref, naam]], sec: [[lijn, ref, naam]], ter: [[lijn, ref, naam]] } (indexen in s, -1 = geen)
function labelLines(sec, ter) {
  const lab = display && display.lab; if (!lab || !Array.isArray(lab.s)) return [];
  const S = lab.s, txt = i => (i >= 0 && i < S.length ? String(S[i]) : ''), E = allEdges(), groups = new Map();
  const add = (coords, c, ref, n) => { if (!coords || coords.length < 2 || (!ref && !n)) return; const k = c + '\u0001' + ref + '\u0001' + n; let g = groups.get(k); if (!g) groups.set(k, g = { c, ref, n, lines: [] }); g.lines.push(coords); };
  for (const [i, r, n] of lab.g || []) if (E[i] && !E[i][4]) add(edgeGeom(i), ['mw', 'tr', 'pr'][E[i][3]] || 'pr', normRef(txt(r)), txt(n));
  for (const [i, r, n] of lab.sec || []) add(sec[i], 'se', normRef(txt(r)), txt(n));
  for (const [i, r, n] of lab.ter || []) add(ter[i], 'te', normRef(txt(r)), txt(n));
  const out = [];
  for (const g of groups.values()) for (const coords of stitchLines(g.lines)) out.push(line(coords, { c: g.c, ref: g.ref, n: g.n }));
  return out;
}
function roadLines() {
  const draw = { se: [], te: [] }; const labels = [];
  const geo = { sec: [], ter: [] };
  for (const [key, list] of Object.entries(display || {})) {
    if (!Array.isArray(list)) continue;
    const cls = key === 'sec' ? 'se' : key === 'ter' ? 'te' : key;
    for (const e of list) {
      const g = geomOf(e); if (key === 'sec' || key === 'ter') geo[key].push(g); if (!g || g.length < 2) continue;
      if (cls === 'se' || cls === 'te') draw[cls].push(line(g));
      const n = nameOf(e), ref = refOf(e);
      if (n || ref) labels.push(line(g, { n: n || '', ref: normRef(ref), c: cls }));
    }
  }
  labels.push(...labelLines(geo.sec, geo.ter));
  return { draw, labels };
}
// Water: polygonen (meren, rivieren en de stukken zee die in de data zitten); de rest van de zee is de achtergrond.
function waterFeatures() {
  return water.map(([t, rings]) => ({ type: 'Feature', properties: { t }, geometry: { type: 'Polygon', coordinates: rings.map(r => { const c = decode(r); if (c.length && (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1])) c.push(c[0]); return c; }) } }));
}
// namen van grote wateren (vaste plekken), schuin en blauw zoals op een gewone kaart
const WATERS = [['Noordzee', 3.55, 52.75, 5], ['Waddenzee', 5.25, 53.24, 7.5], ['IJsselmeer', 5.33, 52.83, 7.5], ['Markermeer', 5.27, 52.55, 9], ['Oosterschelde', 3.93, 51.6, 9.5], ['Westerschelde', 3.78, 51.43, 9.5]];

// Terreinen van standplaatsen en DC's (rustig vlak zoals een bedrijfsterrein), het hoofdgebouw, de poort, en de
// toegangsroutes over echte straten (van de routeergraaf tot de poort of de deur) als straten op de kaart.
const ring = r => { const c = r.map(p => [p[0], p[1]]); if (c.length && (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1])) c.push(c[0]); return c; };
const point = (c, props) => ({ type: 'Feature', properties: props || {}, geometry: { type: 'Point', coordinates: c } });
function sites() {
  const ter = [], hal = [], poort = [], toegang = [], docks = [];
  const plek = (p, kind) => {
    if (Array.isArray(p.terrein) && p.terrein.length > 2) ter.push({ type: 'Feature', properties: { k: kind }, geometry: { type: 'Polygon', coordinates: [ring(p.terrein)] } });
    if (Array.isArray(p.hal) && p.hal.length > 2) hal.push({ type: 'Feature', properties: { k: kind }, geometry: { type: 'Polygon', coordinates: [ring(p.hal)] } });
    if (Array.isArray(p.poort)) poort.push(point(p.poort, { k: kind }));
    // docks: de deur in de gevel van de hal, dock 1, 2, ... (dockPlek: [lon, lat, koers] per dock)
    if (Array.isArray(p.dockPlek)) p.dockPlek.forEach((d, i) => { if (Array.isArray(d) && typeof d[0] === 'number' && typeof d[1] === 'number') docks.push(point([d[0], d[1]], { n: String(i + 1), r: +d[2] || 0 })); });
  };
  for (const s of SP) plek(s, 'sp');
  for (const d of DCS) plek(d, 'dc');
  for (const p of [...SP, ...DCS, ...WINKELS, ...BEZORG]) { const a = toegangVan(p); if (a && a.length > 1) toegang.push(line(a)); }
  return { ter, hal, poort, toegang, docks };
}

let BASE = null;
export function baseData() {
  if (BASE) return BASE;
  const E = allEdges(); const roads = { mw: [], tr: [], pr: [] };
  for (let i = 0; i < E.length; i++) roads[E[i][3] === 0 ? 'mw' : E[i][3] === 1 ? 'tr' : 'pr'].push(line(edgeGeom(i), { l: E[i][4] ? 1 : 0 }));
  const rl = roadLines(); const b = borders(); const st = sites();
  const cityNames = new Set(CITIES.map(c => c.n.toLowerCase()));
  // een plaats met een standplaats van dezelfde naam vlakbij: vanaf zoom 7,8 noemt het label van de standplaats de plaats al
  const dep = (n, lon, lat) => SP.some(s => s.n.toLowerCase() === n.toLowerCase() && km([s.lon, s.lat], [lon, lat]) < 10) ? 1 : 0;
  const places = [
    ...CITIES.map(c => ({ type: 'Feature', properties: { n: c.n, r: c.r, dep: dep(c.n, c.lon, c.lat) }, geometry: { type: 'Point', coordinates: [c.lon, c.lat] } })),
    ...TOWNS.filter(t => !cityNames.has(t.n.toLowerCase())).map(t => ({ type: 'Feature', properties: { n: t.n, r: t.big ? 4 : 5, dep: dep(t.n, t.lon, t.lat) }, geometry: { type: 'Point', coordinates: [t.lon, t.lat] } })),
  ];
  BASE = {
    // Nederland zonder gaten: het gat in de vorm van Natural Earth beslaat IJsselmeer, Markermeer en ook heel Flevoland,
    // dat dan (vanaf zoom 9 of zo) als zee getekend werd. De meren tekent de waterlaag (Overture) er zelf overheen.
    land: fc([...land.ctx.map(p => ({ type: 'Feature', properties: { a: 1 }, geometry: { type: 'Polygon', coordinates: p } })), ...land.nl.map(p => ({ type: 'Feature', properties: { a: 0 }, geometry: { type: 'Polygon', coordinates: [p[0]] } }))]),
    seam: fc(b.seam.map(c => line(c))), prov: fc(b.inner.map(c => line(c))), nat: fc(b.nat.map(c => line(c))),
    water: fc(waterFeatures()), urban: fc(urbanRings.map(r => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [r] } }))),
    mw: fc(roads.mw), tr: fc(roads.tr), pr: fc(roads.pr), se: fc(rl.draw.se), te: fc(rl.draw.te), labels: fc(rl.labels),
    places: fc(places), waters: fc(WATERS.map(([n, lon, lat, mz]) => ({ type: 'Feature', properties: { n, mz }, geometry: { type: 'Point', coordinates: [lon, lat] } }))),
    sp: fc(SP.map(s => ({ type: 'Feature', properties: { n: s.n, hub: !!s.hub, k: s.hub ? -100000 : -(s.fleet || 0) }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } }))),
    site: fc(st.ter), hal: fc(st.hal), poort: fc(st.poort), toegang: fc(st.toegang), docks: fc(st.docks),
    // DC's, fabrieken en groothandels; DC's op het terrein van een standplaats lager in rang (de standplaats gaat voor)
    dcs: fc(DCS.map(d => point([d.lon, d.lat], { id: d.id, n: d.naam || d.id, s: d.soort || 'dc', k: (d.sp ? 2 : 0) + (d.soort === 'dc' ? 0 : 1) }))),
    winkels: fc(WINKELS.map(w => point([w.lon, w.lat], { id: w.id, f: w.formule || '', n: w.naam || w.formule || '' }))),
  };
  return BASE;
}

// ---------------------------------------------------------------------------------------------------------------------
// Iconen voor de stijl: het merkteken van een standplaats (rood, witte rand) en de wegschildjes (A rood, N geel, E groen)
function img(w, h, draw, ratio = 2) { const c = document.createElement('canvas'); c.width = w * ratio; c.height = h * ratio; const g = c.getContext('2d'); g.scale(ratio, ratio); draw(g); return g.getImageData(0, 0, w * ratio, h * ratio); }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function addStyleImages(map, P) {
  const put = (id, data, o) => { if (map.hasImage(id)) map.removeImage(id); map.addImage(id, data, { pixelRatio: 2, ...(o || {}) }); };
  const mark = (size, ring) => img(size + 8, size + 8, g => {
    g.translate((size + 8) / 2, (size + 8) / 2);
    if (ring) { g.beginPath(); g.arc(0, 0, size / 2 + 3.5, 0, Math.PI * 2); g.fillStyle = 'rgba(227,0,31,.22)'; g.fill(); }
    g.rotate(Math.PI / 4); g.shadowColor = 'rgba(17,20,28,.35)'; g.shadowBlur = 3; g.shadowOffsetY = 1;
    const s = size * 0.72; rrect(g, -s / 2, -s / 2, s, s, 2.2); g.fillStyle = P.spRing; g.fill(); g.shadowColor = 'transparent';
    const t = s - 3.2; rrect(g, -t / 2, -t / 2, t, t, 1.6); g.fillStyle = P.sp; g.fill();
  });
  put('sp', mark(13)); put('sp-hub', mark(16)); put('sp-on', mark(16, true));
  // schildjes: 9-delig, rekt mee met de tekst (icon-text-fit)
  const shield = (fill, edge) => img(24, 20, g => { rrect(g, 1.5, 1.5, 21, 17, 3.5); g.fillStyle = fill; g.fill(); g.lineWidth = 1.5; g.strokeStyle = edge; g.stroke(); });
  const o = { stretchX: [[6 * 2, 18 * 2]], stretchY: [[6 * 2, 14 * 2]], content: [5 * 2, 4 * 2, 19 * 2, 16 * 2] };
  put('shield-a', shield('#D8232A', '#FFFFFF'), o); put('shield-n', shield('#F4C81B', '#FFFFFF'), o); put('shield-e', shield('#1F8A4C', '#FFFFFF'), o); put('shield-o', shield('#FFFFFF', '#9AA0A6'), o); put('dock', shield(P.poi, P.poiBg), o);
  // DC: een donker vierkantje met een loods; winkel: een rondje met een tasje (rustig, geen merkkleuren: die kleuren
  // zijn voor de status van de voertuigen)
  put('dc', img(20, 20, g => { g.shadowColor = 'rgba(17,20,28,.3)'; g.shadowBlur = 2; g.shadowOffsetY = 0.6; rrect(g, 2, 2, 16, 16, 4); g.fillStyle = P.poiBg; g.fill(); g.shadowColor = 'transparent'; rrect(g, 3.4, 3.4, 13.2, 13.2, 3); g.fillStyle = P.poi; g.fill(); g.fillStyle = P.poiBg; g.beginPath(); g.moveTo(6, 9.6); g.lineTo(10, 6.6); g.lineTo(14, 9.6); g.lineTo(14, 14); g.lineTo(6, 14); g.closePath(); g.fill(); g.fillStyle = P.poi; g.fillRect(8.4, 11, 3.2, 3); }));
  put('winkel', img(18, 18, g => { g.shadowColor = 'rgba(17,20,28,.28)'; g.shadowBlur = 2; g.shadowOffsetY = 0.6; g.beginPath(); g.arc(9, 9, 7.2, 0, Math.PI * 2); g.fillStyle = P.poiBg; g.fill(); g.shadowColor = 'transparent'; g.beginPath(); g.arc(9, 9, 6, 0, Math.PI * 2); g.fillStyle = P.poi; g.fill(); g.fillStyle = P.poiBg; rrect(g, 6, 7.6, 6, 5, 1); g.fill(); g.lineWidth = 1.1; g.strokeStyle = P.poiBg; g.beginPath(); g.arc(9, 7.6, 1.6, Math.PI, 0); g.stroke(); }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Lagen. De ondergrond (ground) en de tekst (labels) worden apart toegevoegd, zodat map.js er de route, de voertuigen en
// de standplaatsen tussen kan leggen.
export const GROUND = ['land', 'seam', 'water', 'urban', 'site', 'site-line', 'hal', 'prov', 'nat', 'toegang', 'te', 'sec', 'se', 'prc', 'pr', 'trc', 'tr', 'mwc', 'mw', 'dock-door', 'dock', 'poort'];
export const LABELS = ['water-lbl', 'road-name', 'road-shield', 'pl-5', 'pl-4', 'pl-3', 'pl-2', 'pl-1'];

export function addGround(map, P) {
  const B = baseData();
  map.addSource('land', { type: 'geojson', data: B.land, tolerance: 0.4 });
  map.addSource('seam', { type: 'geojson', data: B.seam });
  map.addSource('water', { type: 'geojson', data: B.water, tolerance: 0.3, maxzoom: 14, buffer: 16 });
  map.addSource('urban', { type: 'geojson', data: B.urban });
  map.addSource('prov', { type: 'geojson', data: B.prov });
  map.addSource('nat', { type: 'geojson', data: B.nat });
  for (const k of ['mw', 'tr', 'pr', 'se', 'te']) map.addSource(k, { type: 'geojson', data: B[k], tolerance: 0.3, maxzoom: 14, buffer: 16 });
  map.addLayer({ id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': P.land } });
  // de naad heeft een vaste breedte op de grond (ongeveer 6 km): dikker in pixels bij inzoomen
  map.addLayer({ id: 'seam', type: 'line', source: 'seam', paint: { 'line-color': P.land, 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 5, 4, 10, 128, 14, 2048] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  map.addLayer({ id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': P.sea, 'fill-antialias': true, 'fill-outline-color': P.sea } });
  map.addLayer({ id: 'urban', type: 'fill', source: 'urban', maxzoom: 15, paint: { 'fill-color': P.urban, 'fill-opacity': Z(7, 0.85, 10, 0.75, 12, 0.5, 13.5, 0.15, 14.5, 0) } });
  map.addSource('site', { type: 'geojson', data: B.site }); map.addSource('hal', { type: 'geojson', data: B.hal });
  map.addSource('toegang', { type: 'geojson', data: B.toegang, tolerance: 0.3, buffer: 16 }); map.addSource('poort', { type: 'geojson', data: B.poort });
  map.addLayer({ id: 'site', type: 'fill', source: 'site', minzoom: 11.5, paint: { 'fill-color': P.site, 'fill-opacity': Z(11.5, 0, 12.5, 1) } });
  map.addLayer({ id: 'site-line', type: 'line', source: 'site', minzoom: 12.5, paint: { 'line-color': P.siteC, 'line-width': Z(12.5, 0.6, 16, 1.2) } });
  map.addLayer({ id: 'hal', type: 'fill', source: 'hal', minzoom: 12.5, paint: { 'fill-color': P.hal, 'fill-outline-color': P.halC, 'fill-opacity': Z(12.5, 0, 13.2, 1) } });
  map.addLayer({ id: 'prov', type: 'line', source: 'prov', maxzoom: 13, paint: { 'line-color': P.prov, 'line-width': Z(6, 0.7, 10, 1.1, 13, 1.3), 'line-dasharray': [3, 2.2], 'line-opacity': Z(6, 0.8, 12, 0.6) } });
  map.addLayer({ id: 'nat', type: 'line', source: 'nat', paint: { 'line-color': P.border, 'line-width': Z(5, 1, 10, 1.6, 14, 2.2), 'line-opacity': 0.75 }, layout: { 'line-join': 'round' } });
  const link = (w) => ['case', ['==', ['get', 'l'], 1], w * 0.62, w];
  const road = (id, minzoom, casing, fill, wc, wf, linkable) => {
    const W = (stops) => { const o = ['interpolate', ['exponential', 1.5], ['zoom']]; for (let i = 0; i < stops.length; i += 2) o.push(stops[i], linkable ? link(stops[i + 1]) : stops[i + 1]); return o; };
    if (casing) map.addLayer({ id: id + 'c', type: 'line', source: id, minzoom, paint: { 'line-color': casing, 'line-width': W(wc) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id, type: 'line', source: id, minzoom, paint: { 'line-color': fill, 'line-width': W(wf) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  };
  // dunne lijnen ver weg, de echte breedte (ongeveer) dichtbij; de rand is de vulling plus anderhalve pixel per kant
  // de toegangsstraten naar standplaatsen, DC's en winkels: echte straten, getekend als de kleinste wegen
  map.addLayer({ id: 'toegang', type: 'line', source: 'toegang', minzoom: 11.5, paint: { 'line-color': P.te, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11.5, 0.6, 14, 2.6, 16, 7, 18, 16] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  road('te', 12, null, P.te, null, [12, 0.6, 14, 2.6, 16, 7, 18, 16], false);
  road('se', 9.5, P.seC, P.se, [9.5, 1.2, 12, 2.6, 14, 5.8, 16, 11.5, 18, 22], [9.5, 0.5, 12, 1.5, 14, 4.2, 16, 9.5, 18, 19.5], false);
  road('pr', 7.5, P.prC, P.pr, [7.5, 1, 9, 2, 11, 3.6, 13, 6, 15, 10.4, 17, 18], [7.5, 0.4, 9, 1, 11, 2.2, 13, 4.2, 15, 8, 17, 15], true);
  road('tr', 6.5, P.trC, P.tr, [6.5, 1.1, 9, 2.5, 11, 4.2, 13, 6.9, 15, 11.6, 17, 20], [6.5, 0.5, 9, 1.4, 11, 2.8, 13, 5, 15, 9.2, 17, 17], true);
  road('mw', 5, P.mwC, P.mw, [5, 1.4, 7, 2.1, 9, 3.3, 11, 5.2, 13, 8.2, 15, 13.4, 17, 23], [5, 0.7, 7, 1.2, 9, 2.1, 11, 3.6, 13, 6.2, 15, 10.8, 17, 19.5], true);
  // ver uitgezoomd is de rand van de snelweg bijna even breed als de vulling: dan iets lichter
  map.setPaintProperty('mwc', 'line-opacity', Z(5, 0.55, 8, 0.9));
  // de overige wegen: dichtbij wit zonder rand (de lichte rand helpt alleen ver weg)
  map.setPaintProperty('sec', 'line-opacity', Z(12.5, 1, 14.5, 0));
  // docks: de laaddeuren in de gevel van de hal, vanaf zoom 16 als een rij kleine deuren (4,5 m uit elkaar), het nummer
  // pas vanaf zoom 18 (daaronder staan de nummers te dicht op elkaar)
  map.addSource('docks', { type: 'geojson', data: B.docks });
  map.addLayer({ id: 'dock-door', type: 'circle', source: 'docks', minzoom: 15.5, paint: { 'circle-radius': ZE(15.5, 0.8, 18, 3.2), 'circle-color': P.poi, 'circle-stroke-color': P.poiBg, 'circle-stroke-width': Z(15.5, 0.4, 18, 1), 'circle-opacity': Z(15.5, 0, 16, 1), 'circle-stroke-opacity': Z(15.5, 0, 16, 1) } });
  map.addLayer({ id: 'dock', type: 'symbol', source: 'docks', minzoom: 17.6, layout: { 'icon-image': 'dock', 'icon-text-fit': 'both', 'icon-text-fit-padding': [1, 2, 1, 2], 'text-field': ['get', 'n'], 'text-font': FONT.semi, 'text-size': 9.5, 'icon-allow-overlap': false, 'text-allow-overlap': false, 'text-padding': 1 }, paint: { 'text-color': P.dockText, 'icon-opacity': Z(17.6, 0, 18, 1), 'text-opacity': Z(17.6, 0, 18, 1) } });
  // de poort: waar de toegangsroute het terrein op gaat
  map.addLayer({ id: 'poort', type: 'circle', source: 'poort', minzoom: 14, paint: { 'circle-radius': Z(14, 2.4, 17, 4.6), 'circle-color': P.poi, 'circle-stroke-color': P.poiBg, 'circle-stroke-width': 1.4, 'circle-opacity': Z(14, 0, 14.5, 1), 'circle-stroke-opacity': Z(14, 0, 14.5, 1) } });
}

export function addLabels(map, P) {
  const B = baseData();
  map.addSource('places', { type: 'geojson', data: B.places });
  map.addSource('waters', { type: 'geojson', data: B.waters });
  map.addSource('road-labels', { type: 'geojson', data: B.labels, tolerance: 0.5, maxzoom: 14, buffer: 64 });
  const halo = { 'text-halo-color': P.halo, 'text-halo-width': 1.6, 'text-halo-blur': 0.4 };
  map.addLayer({ id: 'water-lbl', type: 'symbol', source: 'waters', layout: { 'text-field': ['step', ['zoom'], ['case', ['<=', ['get', 'mz'], 5.5], ['get', 'n'], ''], 7.4, ['case', ['<=', ['get', 'mz'], 7.5], ['get', 'n'], ''], 8.9, ['get', 'n']], 'text-font': FONT.ital, 'text-size': Z(5, 12, 9, 14, 12, 16), 'text-letter-spacing': 0.06, 'text-max-width': 7 }, paint: { 'text-color': P.waterText, 'text-halo-color': P.sea, 'text-halo-width': 0.8 } });
  // straatnamen langs de weg (alleen waar de data een naam heeft)
  map.addLayer({ id: 'road-name', type: 'symbol', source: 'road-labels', minzoom: 12.5, filter: ['!=', ['get', 'n'], ''], layout: { 'symbol-placement': 'line', 'text-field': ['get', 'n'], 'text-font': FONT.reg, 'text-size': Z(12.5, 10.5, 15, 12, 18, 14), 'text-max-angle': 32, 'symbol-spacing': 320, 'text-padding': 4, 'text-letter-spacing': 0.01, 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'map' }, paint: { 'text-color': P.text3, ...halo, 'text-opacity': ['step', ['zoom'], ['case', ['==', ['get', 'c'], 'te'], 0, 1], 14, 1] } });
  // wegnummers als schildje: A rood, N geel, E groen; ver uitgezoomd alleen snelwegen
  const refKind = ['slice', ['get', 'ref'], 0, 1];
  map.addLayer({ id: 'road-shield', type: 'symbol', source: 'road-labels', minzoom: 7, filter: ['!=', ['get', 'ref'], ''], layout: { 'symbol-placement': 'line', 'symbol-spacing': ['step', ['zoom'], 300, 10, 460, 12, 560, 14, 680], 'text-field': ['get', 'ref'], 'text-font': FONT.semi, 'text-size': Z(7, 9.5, 12, 11), 'icon-image': ['match', refKind, 'A', 'shield-a', 'E', 'shield-e', ['N', 'B'], 'shield-n', 'shield-o'], 'icon-text-fit': 'both', 'icon-text-fit-padding': [1, 2, 1, 2], 'text-rotation-alignment': 'viewport', 'icon-rotation-alignment': 'viewport', 'text-padding': 26, 'symbol-sort-key': ['match', refKind, 'A', 0, 'E', 1, 2], 'text-letter-spacing': 0.02 }, paint: { 'text-color': ['match', refKind, ['N', 'B'], '#1F1F1F', ['A', 'E'], '#FFFFFF', '#3C4043'], 'icon-opacity': ['step', ['zoom'], ['match', refKind, 'A', 1, 0], 10.4, ['match', refKind, ['A', 'E', 'N', 'B'], 1, 0], 11.5, 1], 'text-opacity': ['step', ['zoom'], ['match', refKind, 'A', 1, 0], 10.4, ['match', refKind, ['A', 'E', 'N', 'B'], 1, 0], 11.5, 1] } });
  // plaatsen: grote steden eerst (bovenste laag wint bij een botsing), dorpen pas dichterbij
  const place = (id, r, minzoom, font, size, color) => map.addLayer({ id, type: 'symbol', source: 'places', minzoom, filter: r === 5 ? ['>=', ['get', 'r'], 5] : ['==', ['get', 'r'], r], layout: { 'text-field': ['step', ['zoom'], ['get', 'n'], 7.8, ['case', ['==', ['get', 'dep'], 1], '', ['get', 'n']]], 'text-font': font, 'text-size': size, 'text-max-width': 8, 'text-padding': 3, 'text-letter-spacing': 0.01, 'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'], 'text-radial-offset': 0 }, paint: { 'text-color': color, ...halo } });
  place('pl-5', 5, 11, FONT.reg, Z(11, 11, 14, 12.5, 17, 14), P.text3);
  place('pl-4', 4, 10, FONT.reg, Z(10, 11.5, 13, 13, 16, 14.5), P.text3);
  place('pl-3', 3, 8.3, FONT.med, Z(8.3, 11.5, 11, 13.5, 14, 15.5), P.text2);
  place('pl-2', 2, 6.6, FONT.med, Z(6.6, 12, 9, 14, 12, 16.5), P.text2);
  place('pl-1', 1, 5, FONT.semi, Z(5, 12.5, 8, 15.5, 11, 18.5), P.text);
}

// winkels (vanaf zoom 12,5, de naam vanaf 15) en DC's (vanaf zoom 8,5, de naam vanaf 10,5)
export function addPois(map, P) {
  const B = baseData();
  map.addSource('winkels', { type: 'geojson', data: B.winkels }); map.addSource('dcs', { type: 'geojson', data: B.dcs });
  map.addLayer({ id: 'winkel', type: 'symbol', source: 'winkels', minzoom: 12.5, layout: { 'icon-image': 'winkel', 'icon-size': Z(12.5, 0.62, 15, 0.9, 18, 1.05), 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'icon-padding': 0, 'text-field': ['step', ['zoom'], '', 15, ['get', 'f'], 16.5, ['get', 'n']], 'text-font': FONT.med, 'text-size': Z(15, 10.5, 18, 12), 'text-anchor': 'left', 'text-offset': [0.85, 0], 'text-optional': true, 'text-max-width': 12, 'text-padding': 2 }, paint: { 'text-color': P.text3, 'text-halo-color': P.halo, 'text-halo-width': 1.5, 'icon-opacity': Z(12.5, 0, 13, 1) } });
  map.addLayer({ id: 'dc', type: 'symbol', source: 'dcs', minzoom: 8.5, layout: { 'icon-image': 'dc', 'icon-size': Z(8.5, 0.62, 12, 0.9, 16, 1.05), 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'text-field': ['step', ['zoom'], '', 10.5, ['get', 'n']], 'text-font': FONT.med, 'text-size': Z(10.5, 10.5, 14, 12), 'text-anchor': 'left', 'text-offset': [0.85, 0], 'text-optional': true, 'text-max-width': 12, 'text-padding': 2, 'symbol-sort-key': ['get', 'k'] }, paint: { 'text-color': P.text2, 'text-halo-color': P.halo, 'text-halo-width': 1.6, 'icon-opacity': Z(8.5, 0, 9, 1) } });
}

// standplaatsen: het merkteken altijd, de naam waar plek is (grote standplaatsen gaan voor)
export function addDepots(map, P) {
  const B = baseData();
  map.addSource('sp', { type: 'geojson', data: B.sp });
  const on = ['==', ['get', 'n'], ''];
  map.addLayer({ id: 'sp', type: 'symbol', source: 'sp', minzoom: 6, layout: { 'icon-image': ['case', ['get', 'hub'], 'sp-hub', 'sp'], 'icon-size': Z(6, 0.7, 8, 0.9, 12, 1.05), 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'icon-padding': 1, 'text-field': ['step', ['zoom'], '', 7.8, ['get', 'n']], 'text-font': FONT.semi, 'text-size': Z(7.8, 11, 12, 12.5, 16, 13.5), 'text-anchor': 'left', 'text-offset': [0.85, 0], 'text-optional': true, 'text-padding': 2, 'symbol-sort-key': ['get', 'k'], 'text-max-width': 12 }, paint: { 'text-color': P.text, 'text-halo-color': P.halo, 'text-halo-width': 1.8, 'text-halo-blur': 0.3 } });
  map.addLayer({ id: 'sp-on', type: 'symbol', source: 'sp', filter: on, layout: { 'icon-image': 'sp-on', 'icon-size': Z(6, 0.9, 12, 1.15), 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
}
export function highlightDepot(map, name) { if (map.getLayer('sp-on')) map.setFilter('sp-on', ['==', ['get', 'n'], name || '']); }

// ---------------------------------------------------------------------------------------------------------------------
// Thema of 3D: alle kleuren opnieuw zetten
export function applyPalette(map, theme, three) {
  const P = PAL[theme], Q = three ? PAL3[theme] : P; const set = (id, k, v) => { if (map.getLayer(id)) map.setPaintProperty(id, k, v); };
  set('bg', 'background-color', Q.sea); set('land', 'fill-color', Q.land); set('seam', 'line-color', Q.land); set('water', 'fill-color', Q.sea); set('water', 'fill-outline-color', Q.sea); set('urban', 'fill-color', Q.urban);
  set('prov', 'line-color', P.prov); set('nat', 'line-color', P.border);
  for (const k of ['mw', 'tr', 'pr', 'se', 'te']) { set(k, 'line-color', P[k]); set(k + 'c', 'line-color', P[k + 'C']); }
  set('bld', 'fill-color', ['case', ['==', ['get', 'd'], 1], P.hal, P.bld]); set('bld-line', 'line-color', ['case', ['==', ['get', 'd'], 1], P.halC, P.bldC]); set('ofm-3d', 'fill-extrusion-color', P.bld3d);
  set('site', 'fill-color', P.site); set('site-line', 'line-color', P.siteC); set('hal', 'fill-color', P.hal); set('hal', 'fill-outline-color', P.halC); set('toegang', 'line-color', P.te);
  set('poort', 'circle-color', P.poi); set('poort', 'circle-stroke-color', P.poiBg); set('dock', 'text-color', P.dockText); set('dock-door', 'circle-color', P.poi); set('dock-door', 'circle-stroke-color', P.poiBg);
  for (const id of ['winkel', 'dc']) set(id, 'text-halo-color', P.halo); set('winkel', 'text-color', P.text3); set('dc', 'text-color', P.text2);
  const halo = P.halo;
  for (const id of ['pl-1', 'pl-2', 'pl-3', 'pl-4', 'pl-5', 'road-name']) set(id, 'text-halo-color', halo);
  set('pl-1', 'text-color', P.text); set('pl-2', 'text-color', P.text2); set('pl-3', 'text-color', P.text2); set('pl-4', 'text-color', P.text3); set('pl-5', 'text-color', P.text3); set('road-name', 'text-color', P.text3);
  set('water-lbl', 'text-color', P.waterText); set('water-lbl', 'text-halo-color', Q.sea);
  set('sp', 'text-color', P.text); set('sp', 'text-halo-color', halo);
}

// ---------------------------------------------------------------------------------------------------------------------
// Gebouwen in 2D (vanaf zoom 14, rond de standplaatsen), uit src/data/buildings*.js van de data: pas geladen als de kaart
// voor het eerst op zoom 13,5 of dichterbij komt. Zonder dat bestand gebeurt er niets.
// de gebouwen komen uit src/buildings.js van de data (laadGebouwen in places.js, alleen dynamisch geladen)
function ringsOf(x) {
  if (!x) return null;
  if (typeof x === 'string') return [decode(x)];
  if (Array.isArray(x) && x.length && typeof x[0] === 'string') return x.map(decode);
  if (Array.isArray(x) && Array.isArray(x[0]) && typeof x[0][0] === 'number') return [x];
  if (Array.isArray(x) && Array.isArray(x[0]) && Array.isArray(x[0][0])) return typeof x[0][0][0] === 'number' ? x : x[0];
  return null;
}
function close(r) { if (r.length > 2 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]); return r; }
export function buildingFeatures(mod) {
  let d = mod && mod.default !== undefined ? mod.default : mod;
  if (typeof d === 'function') d = d();
  const out = [];
  const add = (rings, props) => { if (!rings || !rings.length || rings[0].length < 3) return; out.push({ type: 'Feature', properties: props || {}, geometry: { type: 'Polygon', coordinates: rings.map(close) } }); };
  const walk = x => {
    if (!x) return;
    if (x.type === 'FeatureCollection') return x.features.forEach(walk);
    if (x.type === 'Feature' && x.geometry) { if (x.geometry.type === 'Polygon') add(x.geometry.coordinates, x.properties); else if (x.geometry.type === 'MultiPolygon') x.geometry.coordinates.forEach(c => add(c, x.properties)); return; }
    if (Array.isArray(x)) { const r = ringsOf(x); if (r && Array.isArray(x[0]) && typeof x[0][0] === 'number') return add(r); if (r && typeof x[0] === 'string' && x.length === 1) return add(r); return x.forEach(walk); }
    if (typeof x === 'string') return add(ringsOf(x));
    if (typeof x === 'object') {
      const g = x.rings || x.p || x.g || x.poly || x.polygon || x.geom || x.c || x.coords;
      if (g) { const h = x.h ?? x.height; return add(ringsOf(g), { h: h != null ? +h : 6, d: x.d ? 1 : 0 }); }
      for (const v of Object.values(x)) if (v && typeof v === 'object') walk(v);
    }
  };
  walk(d);
  return out;
}
export function createBuildings2d(map, getP, onAdded) {
  let state = typeof laadGebouwen === 'function' ? 'idle' : 'none';
  function check() {
    if (state !== 'idle' || map.getZoom() < 13.5) return; state = 'loading';
    laadGebouwen().then(mod => {
      const feats = buildingFeatures(mod); if (!feats.length) { state = 'none'; return; }
      const P = getP(); const before = map.getLayer('prov') ? 'prov' : undefined;
      map.addSource('bld', { type: 'geojson', data: fc(feats), tolerance: 0.2, buffer: 16 });
      map.addLayer({ id: 'bld', type: 'fill', source: 'bld', minzoom: 14, paint: { 'fill-color': ['case', ['==', ['get', 'd'], 1], P.hal, P.bld], 'fill-opacity': Z(14, 0, 14.6, 1) } }, before);
      map.addLayer({ id: 'bld-line', type: 'line', source: 'bld', minzoom: 14.5, paint: { 'line-color': ['case', ['==', ['get', 'd'], 1], P.halC, P.bldC], 'line-width': Z(14.5, 0.5, 17, 1), 'line-opacity': Z(14.5, 0, 15, 1) } }, before);
      if (onAdded) onAdded();
      state = 'done';
    }).catch(err => { console.warn('gebouwen niet geladen', err); state = 'none'; });
  }
  map.on('zoomend', check); map.on('moveend', check);
  return { check, state: () => state };
}

// ---------------------------------------------------------------------------------------------------------------------
// Online: CARTO Voyager (licht) of Dark Matter (donker) als rastertegels, @2x op een scherm met hoge dichtheid; in 3D
// daarbij de gebouwen van OpenFreeMap (OpenMapTiles, laag building) als grijze blokken.
export const tileUrls = theme => { const r = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) > 1 ? '@2x' : ''; return ['a', 'b', 'c', 'd'].map(h => `https://${h}.basemaps.cartocdn.com/${PAL[theme].tiles}/{z}/{x}/{y}${r}.png`); };
export const OFM_URL = 'https://tiles.openfreemap.org/planet';
