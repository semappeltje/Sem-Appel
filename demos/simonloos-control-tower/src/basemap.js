// Basiskaart in de geest van Google Maps, uit de eigen data (werkt zonder internet en in de ingebedde versie):
// zee en meren blauw, land licht, bebouwing iets warmer, snelwegen geel met een donkerder rand, autowegen en N-wegen wit
// met een grijze rand, de overige wegen wit, provinciegrenzen heel licht. Tekst (plaatsen, standplaatsen, wegnummers,
// straatnamen) staat in gewone symboollagen van MapLibre, met botsingsafhandeling en tekst langs de weg; de letters
// tekent MapLibre zelf in de browser uit de systeemletter (de stijl heeft geen glyphs-adres, dus er is geen glyph-server
// nodig). Met internet (losse versie) kan in plaats daarvan OpenStreetMap (OpenFreeMap, in hetzelfde palet), de luchtfoto of
// de BRT-achtergrondkaart van PDOK de basiskaart zijn (zie onderaan).
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
    text: '#202124', text2: '#3C4043', text3: '#5F6368', halo: '#FFFFFF', waterText: '#3E77B0', sp: '#E3001F', spRing: '#FFFFFF', afd: '#70757A',
    stroke: '#FFFFFF', done: '#A6AEBB', dim: '#9AA3B0', brt: 'pastel',
    // de online kaart (OpenFreeMap): groen, industrie, voorzieningen, vliegveld, spoor
    park: '#CDE7D2', wood: '#D3E8CD', grass: '#E1EFD9', wetland: '#D6EAE1', sand: '#F2EBD9', industrial: '#E6E4EB', commercial: '#EFE8E5', hospital: '#F8E2E2', school: '#F2EDE1', cemetery: '#D8E7D4', pitch: '#D2EBD3', aero: '#E8E7EE', runway: '#D9DBE2', rail: '#BEC2C8',
  },
  dark: {
    sea: '#14273B', land: '#1B1F24', urban: '#21262C', bld: '#2A3037', bldC: '#353C45', bld3d: '#3A414B', site: '#22272D', siteC: '#2F353C', hal: '#2C3138', halC: '#3A414A', poi: '#AEB5BF', poiBg: '#22272D', dockText: '#14171B', warnText: '#F59E0B',
    prov: '#3A424C', border: '#5B6470', mw: '#8F7330', mwC: '#5E4A1A', tr: '#3B424C', trC: '#14181D', pr: '#353B44', prC: '#14181D', se: '#2E343C', seC: '#181C21', te: '#2A3037',
    text: '#E8EAED', text2: '#C9CED6', text3: '#A3AAB5', halo: '#15181D', waterText: '#7FA7CF', sp: '#FF3348', spRing: '#0F1216', afd: '#9AA0A6',
    stroke: '#0F1216', done: '#5F6775', dim: '#4A5260', brt: 'grijs',
    park: '#1E2B23', wood: '#1D2921', grass: '#202A21', wetland: '#1C2827', sand: '#2A271F', industrial: '#24232B', commercial: '#272326', hospital: '#2D2124', school: '#28251F', cemetery: '#1E2920', pitch: '#1E2A21', aero: '#24252C', runway: '#30333B', rail: '#4A515B',
  },
};
// in de 3D-stand: lichte grondtinten (zacht groen-grijs land, beige bebouwing, zacht water), passend bij de 3D-wereld
export const PAL3 = { light: { land: '#E6ECE1', urban: '#ECE6DA', sea: '#B4D8EE' }, dark: { land: '#161C18', urban: '#1D221E', sea: '#0D1A26' } };

// ---------------------------------------------------------------------------------------------------------------------
// Gegevens (een keer opgebouwd)
const km = (a, b) => { const k = Math.cos((a[1] + b[1]) * Math.PI / 360); return Math.hypot((a[0] - b[0]) * k * 111.32, (a[1] - b[1]) * 111.32); };
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
// Provinciegrenzen: alleen de randen die twee provincies delen (geen kustlijnen). Landsgrens: de grens van Nederland met
// België en Duitsland over land, uit OpenStreetMap (land.json, veld grens; zie tools/ct4/kust_water.py).
function borders() {
  const k = p => p[0].toFixed(4) + ',' + p[1].toFixed(4); const ek = (a, b) => { const A = k(a), B = k(b); return A < B ? A + '|' + B : B + '|' + A; };
  const cnt = new Map(), seg = new Map();
  for (const p of provinces) for (const r of p.rings) for (let i = 1; i < r.length; i++) { const key = ek(r[i - 1], r[i]); cnt.set(key, (cnt.get(key) || 0) + 1); seg.set(key, [r[i - 1], r[i]]); }
  const inner = []; for (const [key, n] of cnt) if (n >= 2) inner.push(seg.get(key));
  return { inner: stitch(inner), nat: (land.grens || []).map(decode) };
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
// Land en water uit OpenStreetMap (via Overture; tools/ct4/kust_water.py). De zee is de achtergrond. Het land is het land
// binnen de kustlijn (land.json, veld land), daarbuiten de grove kust van Natural Earth (veld ctx). Het water ligt erover:
// meren, rivieren, kanalen, havens en het IJ. water.json heeft per vlak [z, ringen] of [z, ringen, zx]: de kaart tekent
// het vlak vanaf zoom z tot zoom zx. Ver weg (tot zoom 10) een grove versie van de grote wateren (de IJssel- en
// randmeren, de rivieren, de Zeeuwse wateren); vanaf zoom 10 het fijne water met de havens, het IJ en de kanalen, kleine
// vlakken vanaf zoom 11. Elke ring is een polyline-tekst.
const ringOf = r => { const c = decode(r); if (c.length && (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1])) c.push(c[0]); return c; };
const vlak = (rings, props) => ({ type: 'Feature', properties: props || {}, geometry: { type: 'Polygon', coordinates: rings.map(ringOf) } });
function waterFeatures() { return water.map(([z, rings, zx]) => vlak(rings, { z, zx: zx || 99 })); }
function landFeatures() { return [...(land.ctx || []).map(p => vlak(p, { a: 1 })), ...(land.land || []).map(p => vlak(p, { a: 0 }))]; }
// namen van wateren (vaste plekken op het water, de naam uit OpenStreetMap; de laatste waarde is de zoom vanaf waar de
// naam er staat), schuin en blauw zoals op een gewone kaart: de grote wateren ver weg, de rivieren, kanalen en het IJ
// dichterbij
const WATERS = [['Noordzee', 3.55, 52.75, 5], ['Waddenzee', 5.25, 53.24, 7.5], ['IJsselmeer', 5.33, 52.83, 7.5], ['Markermeer', 5.27, 52.55, 9], ['Oosterschelde', 3.93, 51.6, 9.5], ['Westerschelde', 3.78, 51.43, 9.5],
  ['Hollands Diep', 4.52, 51.69, 9.5], ['Haringvliet', 4.22, 51.795, 9.5], ['Grevelingenmeer', 3.98, 51.745, 9.5], ['Eems', 6.952, 53.42, 9.5], ['Dollard', 7.19, 53.27, 9.5],
  ['Waal', 5.8704, 51.8512, 11], ['Nederrijn', 5.8979, 51.9805, 11], ['Lek', 4.8747, 51.9384, 11], ['IJssel', 6.15, 52.253, 11], ['Maas', 5.7417, 51.7639, 11], ['Veerse Meer', 3.6574, 51.5627, 11], ['Lauwersmeer', 6.21, 53.36, 11], ['Gooimeer', 5.17, 52.33, 11], ['Veluwemeer', 5.7096, 52.3996, 11], ['Ketelmeer', 5.7745, 52.6016, 11],
  ['Noordzeekanaal', 4.7211, 52.434, 11], ['Nieuwe Waterweg', 4.2314, 51.9204, 11], ['Nieuwe Maas', 4.484, 51.907, 12.5], ['Oude Maas', 4.3424, 51.8571, 12.5], ['IJ', 4.8989, 52.3826, 12.5]];

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

// ---------------------------------------------------------------------------------------------------------------------
// Rijbanen: rechts rijden. In het wegennet (graph.json, uit Overture/OpenStreetMap) is een gescheiden weg getekend als
// twee lijnen, één per rijbaan: 91 procent van de snelwegkanten heeft een evenwijdige tweede rijbaan binnen 45 m (bij
// Wognum ligt de A7 als twee lijnen 13,6 m uit elkaar), nog eens 4 procent binnen 160 m (een brede middenberm, zoals de A1
// op de Veluwe). De routes kiezen niet op rijrichting, dus een voertuig kan op de verkeerde rijbaan liggen. De richting
// van een lijn in de data is bovendien niet altijd de rijrichting (bij het samenvoegen van stukjes tot één kant kan een
// lijn omgedraaid zijn), dus de regel hangt daar niet van af: de andere rijbaan hoort links van het voertuig te liggen.
// laneShift(lon, lat, koers) geeft de verschuiving (in graden) naar waar een rijdend voertuig hoort: het midden van de
// rechterstrook van zijn eigen rijbaan, op ware maat (een rijstrook is 3,5 m; zo tekent de kaart de wegen ook):
//   - op een rijbaan van een gescheiden weg (een kant met een evenwijdige lijn van dezelfde klasse ernaast) is de lijn in
//     de data het midden van de rijbaan, met twee stroken: de rechterstrook ligt 1,75 m rechts van de lijn. Ligt de andere
//     rijbaan (de dichtstbijzijnde evenwijdige lijn die de andere kant op wijst) links, dan 1,75 m naar rechts; ligt hij
//     rechts, dan rijdt het voertuig op de verkeerde rijbaan en gaat het naar de rechterstrook van die andere. De breedte
//     van de middenberm hoeft niet bekend te zijn: die zit in de afstand tussen de twee lijnen (13,6 m bij Wognum, tot 160 m
//     op de Veluwe);
//   - op een snelweg met één lijn voor beide richtingen (getekend als twee rijbanen van 7,5 m met 4 m berm): 2 + 3,5 + 1,75
//     = 7,25 m rechts van de hartlijn; op een autoweg of N-weg met één lijn (één strook per richting): 1,75 m;
//   - buiten de graaf (toegangsstraten en terreinen, getekend als straat van 5,5 m): 1,4 m; op een afrit (één strook): niets.
// Of een kant een rijbaan is, staat per kant vast (drie punten, de meerderheid telt), zodat een voertuig onderweg niet
// heen en weer springt. Bij autowegen en N-wegen tellen korte kanten (onder 60 m: rotondes, kruispunten) niet als
// rijbaan, en mag de andere rijbaan niet verder dan 46 m (autoweg) of 30 m (N-weg) liggen: anders zou een voertuig dat
// verkeerd om een rotonde rijdt aan de overkant getekend worden, of op een andere weg die toevallig evenwijdig loopt.
export const LANE = { rijbaan: 1.75, mw: 7.25, n: 1.75, overig: 1.4 };
const TWIN_R = [160, 46, 30], MIN_EDGE = [0, 60, 60]; // per klasse: hoe ver de andere rijbaan mag liggen, kortste kant
const KM = 111320, LC = 0.0015, OX = 5, OY = 52; // cellen van ongeveer 100 bij 170 m; punten ten opzichte van (5, 52)
let LX = null;
// wat de rijbaanindex bij het opstarten kost (voor debug() van de kaart)
export const laneStats = { indexMs: 0, dualMs: 0 };
// De index: alle stukjes van de graaf (223.000), per cel van het rooster de stukjes waarvan de omsluitende rechthoek de
// cel raakt, in getypte arrays: de paren (cel, stukje) gesorteerd op kolom en rij (twee keer tellend sorteren, geen
// vergelijkingen), zodat de cellen van een kolom achter elkaar liggen en een zoekgebied per kolom één keer binair zoeken
// is. Per stukje één record van 24 bytes: de twee punten als Float32 ten opzichte van (5, 52) (op een paar centimeter
// nauwkeurig) en de eerste cel van zijn rechthoek (een stukje in meer cellen telt bij het zoeken alleen in de eerste cel
// van het zoekgebied die het raakt, dus zonder lijst van al geziene stukjes).
function laneIndex() {
  if (LX) return LX;
  const t0 = performance.now();
  const E = allEdges(); let n = 0; for (let i = 0; i < E.length; i++) n += Math.max(0, edgeGeom(i).length - 1);
  const buf = new ArrayBuffer(24 * n), sf = new Float32Array(buf), si = new Int32Array(buf), ed = new Int32Array(n);
  const c0 = new Int32Array(n), c1 = new Int32Array(n), r0 = new Int32Array(n), r1 = new Int32Array(n);
  let k = 0, gx = Infinity, gy = Infinity, nx = 0, ny = 0;
  for (let i = 0; i < E.length; i++) {
    const g = edgeGeom(i);
    for (let j = 1; j < g.length; j++) {
      const a = g[j - 1], b = g[j]; sf[6 * k] = a[0] - OX; sf[6 * k + 1] = a[1] - OY; sf[6 * k + 2] = b[0] - OX; sf[6 * k + 3] = b[1] - OY; ed[k] = i;
      c0[k] = Math.floor(Math.min(a[0], b[0]) / LC); c1[k] = Math.floor(Math.max(a[0], b[0]) / LC); r0[k] = Math.floor(Math.min(a[1], b[1]) / LC); r1[k] = Math.floor(Math.max(a[1], b[1]) / LC);
      if (c0[k] < gx) gx = c0[k]; if (r0[k] < gy) gy = r0[k]; k++;
    }
  }
  let m = 0;
  for (let j = 0; j < n; j++) { c0[j] -= gx; c1[j] -= gx; r0[j] -= gy; r1[j] -= gy; si[6 * j + 4] = c0[j]; si[6 * j + 5] = r0[j]; if (c1[j] >= nx) nx = c1[j] + 1; if (r1[j] >= ny) ny = r1[j] + 1; m += (c1[j] - c0[j] + 1) * (r1[j] - r0[j] + 1); }
  const eRow = new Int32Array(m), eCol = new Int32Array(m), eSeg = new Int32Array(m); m = 0;
  for (let j = 0; j < n; j++) for (let c = c0[j]; c <= c1[j]; c++) for (let r = r0[j]; r <= r1[j]; r++) { eRow[m] = r; eCol[m] = c; eSeg[m] = j; m++; }
  const cnt = new Int32Array(Math.max(nx, ny) + 1), o1 = new Int32Array(m), o2 = new Int32Array(m);
  for (let q = 0; q < m; q++) cnt[eRow[q] + 1]++;
  for (let r = 0; r < ny; r++) cnt[r + 1] += cnt[r];
  for (let q = 0; q < m; q++) o1[cnt[eRow[q]]++] = q;
  cnt.fill(0);
  for (let q = 0; q < m; q++) cnt[eCol[q] + 1]++;
  for (let c = 0; c < nx; c++) cnt[c + 1] += cnt[c];
  for (let i = 0; i < m; i++) { const q = o1[i]; o2[cnt[eCol[q]]++] = q; }
  const list = new Int32Array(m), keys = new Int32Array(m), starts = new Int32Array(m + 1); let nk = 0, prev = -1;
  for (let i = 0; i < m; i++) { const q = o2[i], key = eCol[q] * ny + eRow[q]; list[i] = eSeg[q]; if (key !== prev) { keys[nk] = key; starts[nk++] = i; prev = key; } }
  starts[nk] = m;
  LX = { sf, si, ed, gx, gy, ny, keys: keys.slice(0, nk), starts: starts.slice(0, nk + 1), list, E, cand: new Float64Array(5 * 4096) };
  laneStats.indexMs = Math.round(performance.now() - t0);
  return LX;
}
// de eerste cel met een sleutel van minstens key
function laneFirst(keys, key) { let lo = 0, hi = keys.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (keys[mid] < key) lo = mid + 1; else hi = mid; } return lo; }
// de lijn waar een punt op ligt (het dichtstbijzijnde evenwijdige stukje binnen 2,5 m) en de evenwijdige stukjes op 6 tot
// r meter, ten opzichte van richting (ux, uy). De kandidaten staan in L.cand, per stuk vijf getallen: stukje, afstand,
// het voetpunt (dx, dy in meters vanaf het punt) en de cosinus met de richting. Eerst de goedkope toetsen (evenwijdig,
// voetpunt binnen het stukje), pas dan een wortel; het resultaatobject wordt hergebruikt.
const SCAN = { L: null, kx: 0, cur: -1, curCos: 0, nc: 0 };
function laneScan(lon, lat, ux, uy, r) {
  const L = laneIndex(); const kx = KM * Math.cos(lat * Math.PI / 180); const C = L.cand, ny = L.ny, sf = L.sf, si = L.si, keys = L.keys, starts = L.starts, list = L.list, X = lon - OX, Y = lat - OY, r2 = r * r;
  const c0 = Math.max(0, Math.floor((lon - r / kx) / LC) - L.gx), c1 = Math.floor((lon + r / kx) / LC) - L.gx;
  const r0 = Math.max(0, Math.floor((lat - r / KM) / LC) - L.gy), r1 = Math.min(ny - 1, Math.floor((lat + r / KM) / LC) - L.gy);
  let cur = -1, curD = 2.5, curCos = 0, nc = 0;
  for (let c = c0; c <= c1 && r0 <= r1; c++) {
    const k1 = c * ny + r1;
    for (let p = laneFirst(keys, c * ny + r0); p < keys.length && keys[p] <= k1; p++) {
      const r = keys[p] - c * ny;
      for (let q = starts[p]; q < starts[p + 1]; q++) {
      const j = list[q], o = 6 * j;
      // in meer cellen: alleen in de eerste cel van het zoekgebied die het stukje raakt
      if ((si[o + 4] > c0 ? si[o + 4] : c0) !== c || (si[o + 5] > r0 ? si[o + 5] : r0) !== r) continue;
      const ax = sf[o], ay = sf[o + 1], sx = (sf[o + 2] - ax) * kx, sy = (sf[o + 3] - ay) * KM, len2 = sx * sx + sy * sy; if (len2 < 0.25) continue;
      const dot = sx * ux + sy * uy; if (dot * dot < 0.81 * len2) continue; // niet evenwijdig (meer dan 26 graden)
      // het voetpunt hooguit 1,5 m voorbij een eind van het stukje: anders schuift een voertuig ook in de rijrichting
      const px = (X - ax) * kx, py = (Y - ay) * KM, pd = px * sx + py * sy, len = Math.sqrt(len2); if (pd < -1.5 * len || pd > len2 + 1.5 * len) continue;
      const t = pd <= 0 ? 0 : pd >= len2 ? 1 : pd / len2;
      const qx = t * sx - px, qy = t * sy - py, d2 = qx * qx + qy * qy; if (d2 > r2) continue;
      const d = Math.sqrt(d2), cs = dot / len;
      if (d < curD) { curD = d; cur = j; curCos = cs; }
      if (d >= 6 && nc < C.length) { C[nc] = j; C[nc + 1] = d; C[nc + 2] = qx; C[nc + 3] = qy; C[nc + 4] = cs; nc += 5; }
      }
    }
  }
  SCAN.L = L; SCAN.kx = kx; SCAN.cur = cur; SCAN.curCos = curCos; SCAN.nc = nc; return SCAN;
}
// een evenwijdige lijn die als andere rijbaan telt: zelfde klasse, geen afrit, een andere kant, lang genoeg, dichtbij genoeg
function twinOk(L, q, cls, self) {
  const C = L.cand, j = C[q], ei = L.ed[j], e = L.E[ei];
  return e[3] === cls && !e[4] && ei !== self && e[2] >= MIN_EDGE[cls] && C[q + 1] <= TWIN_R[cls];
}
// punt en richting op een fractie van de lengte van een kant
function alongEdge(g, f) {
  let total = 0; for (let j = 1; j < g.length; j++) total += Math.hypot((g[j][0] - g[j - 1][0]) * KM * Math.cos(g[j][1] * Math.PI / 180), (g[j][1] - g[j - 1][1]) * KM);
  let want = total * f;
  for (let j = 1; j < g.length; j++) {
    const a = g[j - 1], b = g[j], kx = KM * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180), sx = (b[0] - a[0]) * kx, sy = (b[1] - a[1]) * KM, len = Math.hypot(sx, sy);
    if (len < 3 || (want > len && j < g.length - 1)) { want -= len; continue; }
    const t = Math.min(1, want / len); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, sx / len, sy / len];
  }
  return null;
}
// per kant: 1 een weg met één lijn, 2 een rijbaan van een gescheiden weg, 3 een afrit (eenmaal berekend, dan onthouden);
// bij een rijbaan ook hoe ver de andere rijbaan (de andere kant op) bij de proefpunten lag, in hele meters (ETD), zodat
// laneShift niet verder hoeft te zoeken dan nodig
let EK = null, ETD = null;
function edgeKind(i) {
  const E = allEdges(); if (!EK) { EK = new Int8Array(E.length); ETD = new Uint8Array(E.length); } if (EK[i]) return EK[i];
  const e = E[i], cls = e[3]; let k = 1;
  if (e[4]) k = 3;
  else if (e[2] >= MIN_EDGE[cls]) {
    const g = edgeGeom(i); let hits = 0, tries = 0, td = 0;
    for (const f of [0.5, 0.25, 0.75]) {
      const pt = alongEdge(g, f); if (!pt) continue; tries++; let ok = false;
      for (const r of TWIN_R[cls] > 46 ? [46, TWIN_R[cls]] : [TWIN_R[cls]]) {
        const { L, nc } = laneScan(pt[0], pt[1], pt[2], pt[3], r); const C = L.cand; let opp = 0;
        for (let q = 0; q < nc; q += 5) if (twinOk(L, q, cls, i)) { ok = true; if (C[q + 4] < 0 && (!opp || C[q + 1] < opp)) opp = C[q + 1]; }
        if (opp > td) td = opp;
        if (ok) break;
      }
      if (ok) hits++;
      if (hits >= 2 || tries - hits >= 2) break; // de meerderheid van drie staat vast
    }
    k = tries && hits * 2 >= tries ? 2 : 1;
    if (k === 2) ETD[i] = Math.min(255, Math.ceil(td));
  }
  return (EK[i] = k);
}
// de andere rijbaan bij een punt: de dichtstbijzijnde geschikte lijn die de andere kant op wijst dan de eigen lijn
function nearestTwin(L, nc, cls, self, curCos) {
  const C = L.cand; let bq = -1, bd = 1e9;
  for (let q = 0; q < nc; q += 5) if (C[q + 4] * curCos < 0 && C[q + 1] < bd && twinOk(L, q, cls, self)) { bd = C[q + 1]; bq = q; }
  return bq;
}
// Een zuivere functie van plek en koers: dezelfde stand geeft altijd dezelfde verschuiving (het voertuig en de punten van
// zijn route komen dus precies overeen). Eerst de lijn onder het voertuig (een zoekgebied van 2,5 m), dan alleen bij een
// rijbaan van een gescheiden weg de andere rijbaan: eerst tot net voorbij waar hij bij deze kant lag, anders tot de grens
// van de klasse. Samen ongeveer een microseconde.
export function laneShift(lon, lat, bearing) {
  const br = bearing * Math.PI / 180, ux = Math.sin(br), uy = Math.cos(br), rx = uy, ry = -ux;
  const S = laneScan(lon, lat, ux, uy, 2.5), L = S.L, kx = S.kx, cur = S.cur, curCos = S.curCos;
  const by = m => [rx * m / kx, ry * m / KM];
  if (cur < 0) return by(LANE.overig);
  const ei = L.ed[cur], cls = L.E[ei][3], kind = edgeKind(ei);
  if (kind === 3) return null;
  if (kind === 1) return by(cls === 0 ? LANE.mw : LANE.n);
  const near = ETD[ei] ? Math.min(TWIN_R[cls], ETD[ei] + 12) : TWIN_R[cls];
  let q = nearestTwin(L, laneScan(lon, lat, ux, uy, near).nc, cls, ei, curCos);
  if (q < 0 && near < TWIN_R[cls]) q = nearestTwin(L, laneScan(lon, lat, ux, uy, TWIN_R[cls]).nc, cls, ei, curCos);
  const strook = by(LANE.rijbaan);
  if (q < 0) return strook;
  const C = L.cand; return C[q + 2] * rx + C[q + 3] * ry > 0 ? [C[q + 2] / kx + strook[0], C[q + 3] / KM + strook[1]] : strook;
}

let BASE = null;
export function baseData() {
  if (BASE) return BASE;
  const E = allEdges(); const roads = { mw: [], tr: [], pr: [] };
  // d: een snelwegkant die één rijbaan is (de gewone situatie) of één lijn voor beide richtingen (d = 0, breder getekend)
  laneIndex(); const td = performance.now();
  for (let i = 0; i < E.length; i++) roads[E[i][3] === 0 ? 'mw' : E[i][3] === 1 ? 'tr' : 'pr'].push(line(edgeGeom(i), { l: E[i][4] ? 1 : 0, d: E[i][3] === 0 && edgeKind(i) === 1 ? 0 : 1 }));
  laneStats.dualMs = Math.round(performance.now() - td);
  const rl = roadLines(); const b = borders(); const st = sites();
  const cityNames = new Set(CITIES.map(c => c.n.toLowerCase()));
  // een plaats met een standplaats van dezelfde naam vlakbij: vanaf zoom 7,8 noemt het label van de standplaats de plaats al
  const dep = (n, lon, lat) => SP.some(s => s.n.toLowerCase() === n.toLowerCase() && km([s.lon, s.lat], [lon, lat]) < 10) ? 1 : 0;
  const places = [
    ...CITIES.map(c => ({ type: 'Feature', properties: { n: c.n, r: c.r, dep: dep(c.n, c.lon, c.lat) }, geometry: { type: 'Point', coordinates: [c.lon, c.lat] } })),
    ...TOWNS.filter(t => !cityNames.has(t.n.toLowerCase())).map(t => ({ type: 'Feature', properties: { n: t.n, r: t.big ? 4 : 5, dep: dep(t.n, t.lon, t.lat) }, geometry: { type: 'Point', coordinates: [t.lon, t.lat] } })),
  ];
  BASE = {
    land: fc(landFeatures()), prov: fc(b.inner.map(c => line(c))), nat: fc(b.nat.map(c => line(c))),
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
export const GROUND = ['land', 'urban', 'water', 'site', 'site-line', 'hal', 'prov', 'nat', 'toegang', 'te', 'sec', 'se', 'prc', 'pr', 'trc', 'tr', 'mwc', 'mw', 'mwb', 'dock-door', 'dock', 'poort'];
export const LABELS = ['water-lbl', 'road-name', 'road-shield', 'pl-5', 'pl-4', 'pl-3', 'pl-2', 'pl-1'];

export function addGround(map, P) {
  const B = baseData();
  map.addSource('land', { type: 'geojson', data: B.land, tolerance: 0.3, maxzoom: 14, buffer: 16 });
  map.addSource('water', { type: 'geojson', data: B.water, tolerance: 0.3, maxzoom: 14, buffer: 16 });
  map.addSource('urban', { type: 'geojson', data: B.urban });
  map.addSource('prov', { type: 'geojson', data: B.prov });
  map.addSource('nat', { type: 'geojson', data: B.nat });
  for (const k of ['mw', 'tr', 'pr', 'se', 'te']) map.addSource(k, { type: 'geojson', data: B[k], tolerance: 0.3, maxzoom: 14, buffer: 16 });
  map.addLayer({ id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': P.land } });
  // de bebouwing (grove vlekken van Natural Earth) onder het water, zodat het IJ en de havens in de stad water blijven
  map.addLayer({ id: 'urban', type: 'fill', source: 'urban', maxzoom: 15, paint: { 'fill-color': P.urban, 'fill-opacity': Z(7, 0.85, 10, 0.75, 12, 0.5, 13.5, 0.15, 14.5, 0) } });
  // per vlak de zoom vanaf waar (z) en tot waar (zx) het getekend wordt: ver weg de grove vorm van de grote wateren,
  // dichtbij het fijne water met de havens, het IJ en de kanalen
  map.addLayer({ id: 'water', type: 'fill', source: 'water', filter: ['all', ['>=', ['zoom'], ['get', 'z']], ['<', ['zoom'], ['get', 'zx']]], paint: { 'fill-color': P.sea, 'fill-antialias': true, 'fill-outline-color': P.sea } });
  map.addSource('site', { type: 'geojson', data: B.site }); map.addSource('hal', { type: 'geojson', data: B.hal });
  map.addSource('toegang', { type: 'geojson', data: B.toegang, tolerance: 0.3, buffer: 16 }); map.addSource('poort', { type: 'geojson', data: B.poort });
  map.addLayer({ id: 'site', type: 'fill', source: 'site', minzoom: 11.5, paint: { 'fill-color': P.site, 'fill-opacity': Z(11.5, 0, 12.5, 1) } });
  map.addLayer({ id: 'site-line', type: 'line', source: 'site', minzoom: 12.5, paint: { 'line-color': P.siteC, 'line-width': Z(12.5, 0.6, 16, 1.2) } });
  map.addLayer({ id: 'hal', type: 'fill', source: 'hal', minzoom: 12.5, paint: { 'fill-color': P.hal, 'fill-outline-color': P.halC, 'fill-opacity': Z(12.5, 0, 13.2, 1) } });
  map.addLayer({ id: 'prov', type: 'line', source: 'prov', maxzoom: 13, paint: { 'line-color': P.prov, 'line-width': Z(6, 0.7, 10, 1.1, 13, 1.3), 'line-dasharray': [3, 2.2], 'line-opacity': Z(6, 0.8, 12, 0.6) } });
  map.addLayer({ id: 'nat', type: 'line', source: 'nat', paint: { 'line-color': P.border, 'line-width': Z(5, 1, 10, 1.6, 14, 2.2), 'line-opacity': 0.75 }, layout: { 'line-join': 'round' } });
  const link = (w) => ['case', ['==', ['get', 'l'], 1], w * 0.62, w];
  // een breedte is een getal, of [rijbaan, één lijn] voor de snelweg: een snelweg is bijna overal getekend als twee lijnen
  // (één per rijbaan, d = 1); is hij één lijn voor beide richtingen (d = 0), dan is die lijn beide rijbanen met de berm
  const road = (id, minzoom, casing, fill, wc, wf, linkable) => {
    const W = (stops) => { const o = ['interpolate', ['exponential', 1.5], ['zoom']]; for (let i = 0; i < stops.length; i += 2) { const v = stops[i + 1]; o.push(stops[i], Array.isArray(v) ? ['case', ['==', ['get', 'd'], 0], v[1], linkable ? link(v[0]) : v[0]] : linkable ? link(v) : v); } return o; };
    if (casing) map.addLayer({ id: id + 'c', type: 'line', source: id, minzoom, paint: { 'line-color': casing, 'line-width': W(wc) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id, type: 'line', source: id, minzoom, paint: { 'line-color': fill, 'line-width': W(wf) }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  };
  // Dunne lijnen ver weg; vanaf zoom 15 à 16 de ware breedte, zoals Google Maps: een rijbaan van een snelweg 7,5 m (twee
  // lijnen 11 tot 22 m uit elkaar geven de twee rijbanen met de berm ertussen), een snelweg op één lijn 19 m (2 x 7,5 m met
  // 4 m berm), een autoweg en N-weg 7 m, een gewone weg 6 m, een straat 5,5 m, een afrit 0,62 keer de rijbaan. Pixels per
  // meter op 52,2 graden noord: 1,366 op zoom 16, 2,733 op 17, 5,466 op 18. Tussen zoom 13 en 15 groeit een weg nauwelijks,
  // zodat hij bij het inzoomen nooit smaller wordt; de rand is een smalle lijn langs de vulling.
  // de toegangsstraten naar standplaatsen, DC's en winkels: echte straten, getekend als de kleinste wegen
  const STRAAT = [11.5, 0.6, 14, 2.6, 15, 4, 16, 7.52, 17, 15.04, 18, 30.06, 18.5, 42.5];
  map.addLayer({ id: 'toegang', type: 'line', source: 'toegang', minzoom: 11.5, paint: { 'line-color': P.te, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], ...STRAAT] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  road('te', 12, null, P.te, null, [12, 0.6, ...STRAAT.slice(2)], false);
  road('se', 9.5, P.seC, P.se, [9.5, 1.2, 12, 2.6, 14, 5.8, 15, 6.8, 16, 10.2, 17, 18.6, 18, 35.3, 18.5, 49.2], [9.5, 0.5, 12, 1.5, 14, 4.2, 15, 5.2, 16, 8.2, 17, 16.4, 18, 32.8, 18.5, 46.4], false);
  road('pr', 7.5, P.prC, P.pr, [7.5, 1, 9, 2, 11, 3.6, 13, 6, 15, 7.6, 16, 11.8, 17, 21.8, 18, 41.5, 18.5, 57.6], [7.5, 0.4, 9, 1, 11, 2.2, 13, 4.2, 15, 5.8, 16, 9.56, 17, 19.13, 18, 38.26, 18.5, 54.1], true);
  road('tr', 6.5, P.trC, P.tr, [6.5, 1.1, 9, 2.5, 11, 4.2, 13, 6.9, 15, 8.2, 16, 11.8, 17, 21.8, 18, 41.5, 18.5, 57.6], [6.5, 0.5, 9, 1.4, 11, 2.8, 13, 5, 15, 6.2, 16, 9.56, 17, 19.13, 18, 38.26, 18.5, 54.1], true);
  road('mw', 5, P.mwC, P.mw,
    [5, 1.4, 7, 2.1, 9, 3.3, 11, 5.2, 13, 8.2, 15, [8.8, 13.4], 16, [12.5, 28.5], 17, [23.2, 54.6], 18, [44.2, 107], 18.5, [61.5, 150.4]],
    [5, 0.7, 7, 1.2, 9, 2.1, 11, 3.6, 13, 6.2, 15, [6.6, 10.8], 16, [10.25, 25.96], 17, [20.5, 51.92], 18, [41, 103.85], 18.5, [58, 146.9]], true);
  // de berm van een snelweg op één lijn (op een snelweg met twee lijnen is de berm de ruimte ertussen)
  map.addLayer({ id: 'mwb', type: 'line', source: 'mw', minzoom: 15, filter: ['all', ['==', ['get', 'd'], 0], ['==', ['get', 'l'], 0]], paint: { 'line-color': P.land, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 15, 0, 15.5, 2.4, 16, 5.47, 17, 10.93, 18, 21.86, 18.5, 30.9] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
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
  // de afdelingen op het terrein (sp.afdelingen): rustige namen vanaf zoom 16, in kleine kapitalen (hoofdletters, klein
  // en ruim gespatieerd), grijs, zonder pin; de plek bij een gebouw volgt zodra de gebouwen er zijn (createBuildings2d).
  // De poort heeft al een stip: de naam staat eronder. Vanaf zoom 10 legt map.js de namen boven de voertuigen, zodat een
  // geparkeerde wagen een naam niet afdekt (de halo houdt de wagen eronder zichtbaar).
  map.addSource('afd', { type: 'geojson', data: afdelingFeatures(null) });
  const gate = ['==', ['get', 's'], 'poort'];
  map.addLayer({ id: 'afd', type: 'symbol', source: 'afd', minzoom: 16, layout: { 'text-field': ['get', 'n'], 'text-font': FONT.semi, 'text-size': Z(16, 9.5, 18, 11), 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 9, 'text-padding': 2, 'text-anchor': ['case', gate, 'top', 'center'], 'text-offset': ['case', gate, ['literal', [0, 0.7]], ['literal', [0, 0]]] }, paint: { 'text-color': P.afd, 'text-halo-color': P.halo, 'text-halo-width': 1.4, 'text-halo-blur': 0.3, 'text-opacity': Z(16, 0, 16.3, 1) } });
}

// Afdelingen op het terrein van een standplaats, van de data: sp.afdelingen = [{ naam, soort, p: [lon, lat], gebouw?,
// bron }]. Een afdeling in een gebouw (loods, kantoor, garage, wasstraat; gebouw: de index in buildings.json[sp.n], een
// gebouw met d: 1) staat midden in de contour van dat gebouw; wat buiten is (docks aan de gevel, laadplein, opleggers,
// poort) op p, ook als het bij een gebouw hoort. Een afgeleide afdeling (bron 'afgeleid') ziet er hetzelfde uit; de bron
// staat op de pagina van de standplaats. Zonder het veld: niets. bldOf(naam) geeft de gebouwen van een standplaats (niets
// zolang ze niet geladen zijn).
const BUITEN = new Set(['docks', 'laadplein', 'opleggers', 'poort']);
export function afdelingFeatures(bldOf) {
  const out = [];
  for (const sp of SP) {
    const list = Array.isArray(sp.afdelingen) ? sp.afdelingen : null; if (!list || !list.length) continue;
    const all = (bldOf && bldOf(sp.n)) || [];
    for (const a of list) {
      if (!a || !a.naam) continue;
      let pt = Array.isArray(a.p) && Number.isFinite(+a.p[0]) && Number.isFinite(+a.p[1]) ? [+a.p[0], +a.p[1]] : null, g = 0;
      if (Number.isInteger(a.gebouw) && a.gebouw >= 0 && !BUITEN.has(a.soort)) {
        const b = all[a.gebouw];
        const ring = b && Array.isArray(b.p) && b.p.length >= 3 && Array.isArray(b.p[0]) ? b.p : null;
        const c = ring && labelPoint(ring); if (c) { pt = c; g = 1; }
      }
      // g: 1 als de naam midden in zijn gebouw staat (voor de controle; het uiterlijk is hetzelfde)
      if (pt) out.push({ type: 'Feature', properties: { n: String(a.naam), s: String(a.soort || ''), g }, geometry: { type: 'Point', coordinates: pt } });
    }
  }
  return fc(out);
}
// een punt midden in een contour: het zwaartepunt, of (bij een L- of U-vorm, waar dat erbuiten valt) het midden van het
// breedste stuk van de lijn door het zwaartepunt dat binnen de contour ligt
function labelPoint(r) {
  // gerekend vanaf het eerste punt: met lengte en breedte zelf (5 en 52 graden) vallen de producten weg tegen elkaar en
  // ligt het zwaartepunt van een klein gebouw (10 m) meters verkeerd
  const n = r.length, x0 = r[0][0], y0 = r[0][1]; let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) { const xj = r[j][0] - x0, yj = r[j][1] - y0, xi = r[i][0] - x0, yi = r[i][1] - y0, f = xj * yi - xi * yj; a += f; cx += (xj + xi) * f; cy += (yj + yi) * f; }
  if (Math.abs(a) < 1e-14) return null;
  cx = x0 + cx / (3 * a); cy = y0 + cy / (3 * a);
  if (ringHas(r, cx, cy)) return [cx, cy];
  const xs = []; for (let i = 0, j = n - 1; i < n; j = i++) { const yi = r[i][1], yj = r[j][1]; if ((yi > cy) !== (yj > cy)) xs.push(r[i][0] + (cy - yi) / (yj - yi) * (r[j][0] - r[i][0])); }
  xs.sort((p, q) => p - q); let best = null, bw = -1;
  for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > bw) { bw = xs[k + 1] - xs[k]; best = [(xs[k] + xs[k + 1]) / 2, cy]; }
  return best;
}
function ringHas(r, x, y) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const yi = r[i][1], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < r[i][0] + (y - yi) / (yj - yi) * (r[j][0] - r[i][0])) c = !c; } return c; }

export function addLabels(map, P) {
  const B = baseData();
  map.addSource('places', { type: 'geojson', data: B.places });
  map.addSource('waters', { type: 'geojson', data: B.waters });
  map.addSource('road-labels', { type: 'geojson', data: B.labels, tolerance: 0.5, maxzoom: 14, buffer: 64 });
  const halo = { 'text-halo-color': P.halo, 'text-halo-width': 1.6, 'text-halo-blur': 0.4 };
  const naamTot = mz => ['case', ['<=', ['get', 'mz'], mz], ['get', 'n'], ''];
  map.addLayer({ id: 'water-lbl', type: 'symbol', source: 'waters', layout: { 'text-field': ['step', ['zoom'], naamTot(5.5), 7.4, naamTot(7.5), 8.9, naamTot(9.5), 10.9, naamTot(11), 12.4, ['get', 'n']], 'text-font': FONT.ital, 'text-size': Z(5, 12, 9, 14, 12, 16), 'text-letter-spacing': 0.06, 'text-max-width': 7 }, paint: { 'text-color': P.waterText, 'text-halo-color': P.sea, 'text-halo-width': 0.8 } });
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
  // op de luchtfoto: wegen en namen in de lichte kleuren, ook in het donkere thema (zoals Google Maps op een satellietbeeld)
  const P0 = PAL[theme], P = photoOn ? { ...P0, ...PHOTO_PAL } : P0, Q = three ? PAL3[theme] : P0; const set = (id, k, v) => { if (map.getLayer(id)) map.setPaintProperty(id, k, v); };
  set('bg', 'background-color', Q.sea); set('land', 'fill-color', Q.land); set('water', 'fill-color', Q.sea); set('water', 'fill-outline-color', Q.sea); set('urban', 'fill-color', Q.urban);
  set('prov', 'line-color', P.prov); set('nat', 'line-color', P.border);
  for (const k of ['mw', 'tr', 'pr', 'se', 'te']) { set(k, 'line-color', P[k]); set(k + 'c', 'line-color', P[k + 'C']); }
  set('mwb', 'line-color', Q.land);
  set('bld', 'fill-color', ['case', ['==', ['get', 'd'], 1], P.hal, P.bld]); set('bld-line', 'line-color', ['case', ['==', ['get', 'd'], 1], P.halC, P.bldC]); set('ofm-3d', 'fill-extrusion-color', P.bld3d);
  set('site', 'fill-color', P.site); set('site-line', 'line-color', P.siteC); set('hal', 'fill-color', P.hal); set('hal', 'fill-outline-color', P.halC); set('toegang', 'line-color', P.te);
  set('poort', 'circle-color', P.poi); set('poort', 'circle-stroke-color', P.poiBg); set('dock', 'text-color', P.dockText); set('dock-door', 'circle-color', P.poi); set('dock-door', 'circle-stroke-color', P.poiBg);
  for (const id of ['winkel', 'dc']) set(id, 'text-halo-color', P.halo); set('winkel', 'text-color', P.text3); set('dc', 'text-color', P.text2);
  const halo = P.halo;
  for (const id of ['pl-1', 'pl-2', 'pl-3', 'pl-4', 'pl-5', 'road-name']) set(id, 'text-halo-color', halo);
  set('pl-1', 'text-color', P.text); set('pl-2', 'text-color', P.text2); set('pl-3', 'text-color', P.text2); set('pl-4', 'text-color', P.text3); set('pl-5', 'text-color', P.text3); set('road-name', 'text-color', P.text3);
  set('water-lbl', 'text-color', P.waterText); set('water-lbl', 'text-halo-color', photoOn ? halo : Q.sea);
  set('sp', 'text-color', P.text); set('sp', 'text-halo-color', halo);
  set('afd', 'text-color', P.afd); set('afd', 'text-halo-color', halo);
  onlinePalette(map, P0);
  // luchtfoto: de wegen dun en halfdoorzichtig (de echte weg staat op de foto), het terrein als witte rand; uit: terug
  for (const id of Object.keys(PHOTO_W)) {
    if (!map.getLayer(id)) continue;
    if (photoOn) { if (!(id in photoWidths)) photoWidths[id] = map.getPaintProperty(id, 'line-width'); map.setPaintProperty(id, 'line-width', PHOTO_W[id]); map.setPaintProperty(id, 'line-opacity', id === 'mw' ? 0.7 : 0.6); }
    else if (id in photoWidths) { map.setPaintProperty(id, 'line-width', photoWidths[id]); map.setPaintProperty(id, 'line-opacity', 1); delete photoWidths[id]; }
  }
  set('site-line', 'line-width', photoOn ? Z(12.5, 1, 16, 1.8, 18, 2.6) : Z(12.5, 0.6, 16, 1.2));
}

// ---------------------------------------------------------------------------------------------------------------------
// Luchtfoto (alleen de losse versie; de ingebedde vraagt niets van buiten): de luchtfoto van het Kadaster via PDOK, vrij
// en zonder sleutel, CC BY 4.0. Eerst de actuele foto van 8 cm (Actueel_orthoHR); laden die tegels niet, dan die van
// 25 cm (Actueel_ortho25). Rastertegels in EPSG:3857 (de tegels van Google Maps en OpenStreetMap), tot zoom 19.
export const PHOTO_LAYERS = ['Actueel_orthoHR', 'Actueel_ortho25'];
export const photoUrl = tier => `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/${PHOTO_LAYERS[tier] || PHOTO_LAYERS[0]}/EPSG:3857/{z}/{x}/{y}.jpeg`;
export const PHOTO_ATTR = 'Luchtfoto: <a href="https://www.pdok.nl/" target="_blank" rel="noopener">Kadaster, PDOK</a>, <a href="https://creativecommons.org/licenses/by/4.0/deed.nl" target="_blank" rel="noopener">CC BY 4.0</a>';
// Wat op de luchtfoto weg kan, omdat de foto het zelf laat zien: bebouwing, het vlak van het terrein en de hallen (het
// terrein blijft als rand), de randen van de wegen en de middenberm, de eigen gebouwen.
export const PHOTO_HIDE = new Set(['urban', 'site', 'hal', 'sec', 'prc', 'trc', 'mwc', 'mwb', 'bld', 'bld-line']);
const PHOTO_PAL = { ...PAL.light, siteC: 'rgba(255,255,255,0.92)', halo: 'rgba(255,255,255,0.88)' };
const ZX = (...stops) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops];
const PHOTO_W = {
  mw: ZX(5, 0.7, 9, 1.4, 12, 2.2, 15, 3, 17, 3.8, 19, 4.6), tr: ZX(6.5, 0.5, 10, 1.1, 14, 2, 17, 2.8, 19, 3.4), pr: ZX(7.5, 0.4, 10, 1, 14, 1.8, 17, 2.6, 19, 3.2),
  se: ZX(9.5, 0.4, 14, 1.4, 17, 2, 19, 2.6), te: ZX(12, 0.4, 15, 1.1, 17, 1.6, 19, 2.2), toegang: ZX(11.5, 0.4, 15, 1.1, 17, 1.6, 19, 2.2),
};
let photoOn = false; const photoWidths = {};
export function setPhotoStyle(map, on, theme, three) { photoOn = !!on; applyPalette(map, theme, three); }

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
      let raw = mod && mod.default !== undefined ? mod.default : mod; if (typeof raw === 'function') raw = raw();
      const afd = map.getSource('afd'); if (afd && raw && typeof raw === 'object') afd.setData(afdelingFeatures(key => raw[key]));
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
// Online (alleen de losse versie; de ingebedde vraagt niets van buiten). Drie bronnen, alle drie vrij en zonder sleutel:
//   - OpenFreeMap: OpenStreetMap als vectortegels (OpenMapTiles-schema), met een eigen stijl in het palet van de
//     ingebouwde kaart (lichte vlakken, witte wegen met grijze rand, snelwegen geel, zacht blauw water, groen, grijze
//     industrie, gebouwen vanaf zoom 14, straat- en plaatsnamen uit de tegels). De letters tekent MapLibre zelf uit de
//     systeemletter, net als bij de ingebouwde kaart (geen glyph-server), en de schildjes zijn die van de ingebouwde kaart
//     (geen sprite). In 3D komen de gebouwen uit dezelfde tegels als blokken.
//   - de luchtfoto en de BRT-achtergrondkaart van het Kadaster via PDOK, als rastertegels (zie verderop).
export const OFM_URL = 'https://tiles.openfreemap.org/planet';
// de lagen van de tegels die we kennen: een tegel met een van deze lagen is echt een tegel van OpenFreeMap (een bron die
// wel antwoordt maar iets anders stuurt, zoals een tegel met alleen een watermerk, telt niet)
export const OFM_LAYERS = ['water', 'transportation', 'landcover', 'landuse', 'building', 'place', 'boundary', 'waterway', 'park', 'transportation_name', 'water_name', 'aeroway', 'housenumber', 'poi'];
export const OFM_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>';
const RZ = [5, 7, 9, 11, 13, 15, 16, 17, 18, 18.5];
// breedte van de wegen per klasse, op de zoomniveaus van RZ; vanaf zoom 16 de ware breedte, zoals de ingebouwde kaart
// (een rijbaan van een snelweg 7,5 m, autoweg en N-weg 7 m, gewone weg 6 m, straat 5,5 m, ventweg 3 m)
const RW = {
  motorway: [0.7, 1.2, 2.1, 3.6, 6.2, 6.6, 10.25, 20.5, 41, 58], trunk: [0.5, 0.9, 1.4, 2.8, 5, 6.2, 9.56, 19.13, 38.26, 54.1], primary: [0.4, 0.6, 1, 2.2, 4.2, 5.8, 9.56, 19.13, 38.26, 54.1],
  secondary: [0, 0.3, 0.6, 1.5, 3.2, 5.2, 8.2, 16.4, 32.8, 46.4], tertiary: [0, 0, 0.4, 1, 2.6, 4.4, 7.52, 15.04, 30.06, 42.5], minor: [0, 0, 0, 0.5, 1.6, 3.6, 7.52, 15.04, 30.06, 42.5], service: [0, 0, 0, 0, 0.8, 2, 4.1, 8.2, 16.4, 23.2],
};
const RCX = [0.7, 0.9, 1.2, 1.6, 2, 2.4, 2.6, 2.8, 3.2, 3.6]; // de rand: zoveel pixels breder dan de vulling
const ROADS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'];
const KL = ['get', 'class'];
const roadW = casing => { const e = ['interpolate', ['exponential', 1.5], ['zoom']]; RZ.forEach((z, i) => { const m = ['match', KL]; for (const k of ROADS) m.push(k, casing && RW[k][i] > 0 ? RW[k][i] + RCX[i] : RW[k][i]); m.push(0); e.push(z, ['*', m, ['case', ['==', ['get', 'ramp'], 1], 0.62, 1]]); }); return e; };
const nameNl = ['coalesce', ['get', 'name:nl'], ['get', 'name']];
// kleuren van de online lagen uit het palet (ook voor het wisselen van thema)
function onlinePaint(P) {
  return {
    'o-bg': { 'background-color': P.land },
    'o-landcover': { 'fill-color': ['match', KL, 'wood', P.wood, 'grass', P.grass, 'wetland', P.wetland, 'sand', P.sand, P.grass] },
    'o-landuse': { 'fill-color': ['match', KL, 'residential', P.urban, ['industrial', 'garages', 'railway', 'quarry', 'military'], P.industrial, ['commercial', 'retail'], P.commercial, 'hospital', P.hospital, ['school', 'university', 'college', 'kindergarten'], P.school, 'cemetery', P.cemetery, ['stadium', 'pitch', 'playground', 'track'], P.pitch, P.urban] },
    'o-park': { 'fill-color': P.park }, 'o-water': { 'fill-color': P.sea }, 'o-waterway': { 'line-color': P.sea },
    'o-aero': { 'fill-color': P.aero }, 'o-runway': { 'line-color': P.runway },
    'o-building': { 'fill-color': P.bld, 'fill-outline-color': P.bldC },
    'o-boundary': { 'line-color': ['match', ['get', 'admin_level'], 2, P.border, P.prov] },
    'o-rail': { 'line-color': P.rail }, 'o-path': { 'line-color': P.text3 },
    'o-road-c': { 'line-color': ['match', KL, 'motorway', P.mwC, 'trunk', P.trC, 'primary', P.prC, P.seC] },
    'o-road': { 'line-color': ['match', KL, 'motorway', P.mw, 'trunk', P.tr, 'primary', P.pr, ['secondary', 'tertiary'], P.se, P.te] },
    'o-ferry': { 'line-color': P.waterText },
    'o-road-name': { 'text-color': P.text3, 'text-halo-color': P.halo },
    'o-water-name': { 'text-color': P.waterText, 'text-halo-color': P.sea }, 'o-waterway-name': { 'text-color': P.waterText, 'text-halo-color': P.sea },
    'o-country': { 'text-color': P.text2, 'text-halo-color': P.halo }, 'o-city': { 'text-color': P.text, 'text-halo-color': P.halo }, 'o-town': { 'text-color': P.text2, 'text-halo-color': P.halo },
    'o-village': { 'text-color': P.text3, 'text-halo-color': P.halo }, 'o-suburb': { 'text-color': P.text3, 'text-halo-color': P.halo }, 'o-hamlet': { 'text-color': P.text3, 'text-halo-color': P.halo },
    'o-housenumber': { 'text-color': P.text3, 'text-halo-color': P.halo },
  };
}
export const OFM_IDS = Object.keys(onlinePaint(PAL.light)).concat('o-shield');
// De lagen van de online kaart, onder alle eigen lagen (before: de eerste eigen laag na de achtergrond). Zolang de tegels
// niet bevestigd zijn, dekt het eigen land ze af; daarna gaan de eigen wegen, namen, land en water uit (map.js).
export function addOnline(map, P, before, visible) {
  if (!map.getSource('ofm')) map.addSource('ofm', { type: 'vector', url: OFM_URL });
  const paint = onlinePaint(P), vis = visible ? 'visible' : 'none';
  const add = l => map.addLayer({ ...l, paint: { ...(l.paint || {}), ...(paint[l.id] || {}) }, layout: { visibility: vis, ...(l.layout || {}) } }, before);
  const S = { source: 'ofm' };
  add({ id: 'o-bg', type: 'background' });
  add({ ...S, id: 'o-landcover', type: 'fill', 'source-layer': 'landcover', filter: ['match', KL, ['wood', 'grass', 'wetland', 'sand'], true, false], paint: { 'fill-opacity': Z(5, 0.6, 10, 0.8, 14, 0.9) } });
  add({ ...S, id: 'o-landuse', type: 'fill', 'source-layer': 'landuse', filter: ['match', KL, ['residential', 'industrial', 'garages', 'railway', 'quarry', 'military', 'commercial', 'retail', 'hospital', 'school', 'university', 'college', 'kindergarten', 'cemetery', 'stadium', 'pitch', 'playground', 'track'], true, false], paint: { 'fill-opacity': Z(8, ['case', ['==', KL, 'residential'], 0.85, 0.95], 12, ['case', ['==', KL, 'residential'], 0.6, 0.95], 15, ['case', ['==', KL, 'residential'], 0.35, 0.95]) } });
  add({ ...S, id: 'o-park', type: 'fill', 'source-layer': 'park', paint: { 'fill-opacity': 0.75 } });
  add({ ...S, id: 'o-water', type: 'fill', 'source-layer': 'water', filter: ['!=', ['get', 'brunnel'], 'tunnel'] });
  add({ ...S, id: 'o-waterway', type: 'line', 'source-layer': 'waterway', minzoom: 8, filter: ['!=', ['get', 'brunnel'], 'tunnel'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, ['match', KL, ['river', 'canal'], 0.6, 0.2], 12, ['match', KL, ['river', 'canal'], 1.6, 0.6], 16, ['match', KL, ['river', 'canal'], 6, 1.6], 18, ['match', KL, ['river', 'canal'], 16, 3]] } });
  add({ ...S, id: 'o-aero', type: 'fill', 'source-layer': 'aeroway', minzoom: 10, filter: ['==', ['geometry-type'], 'Polygon'] });
  add({ ...S, id: 'o-runway', type: 'line', 'source-layer': 'aeroway', minzoom: 10, filter: ['all', ['==', ['geometry-type'], 'LineString'], ['match', KL, ['runway', 'taxiway'], true, false]], paint: { 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, ['match', KL, 'runway', 1, 0.4], 14, ['match', KL, 'runway', 8, 2], 17, ['match', KL, 'runway', 40, 10]] } });
  add({ ...S, id: 'o-building', type: 'fill', 'source-layer': 'building', minzoom: 14, paint: { 'fill-opacity': Z(14, 0, 14.6, 1) } });
  add({ ...S, id: 'o-boundary', type: 'line', 'source-layer': 'boundary', filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], layout: { 'line-join': 'round' }, paint: { 'line-width': ((m) => Z(5, m(1, 0.7), 6, m(1.12, 0.7), 10, m(1.6, 1.1), 13, m(2.05, 1.3), 14, m(2.2, 1.3)))((a, b) => ['match', ['get', 'admin_level'], 2, a, b]), 'line-dasharray': [3, 2.2], 'line-opacity': ['match', ['get', 'admin_level'], 2, 0.75, 0.6] } });
  add({ ...S, id: 'o-rail', type: 'line', 'source-layer': 'transportation', minzoom: 9, filter: ['all', ['match', KL, ['rail', 'transit'], true, false], ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'line-width': Z(9, 0.5, 13, 0.9, 16, 1.6, 18, 2.4) } });
  add({ ...S, id: 'o-path', type: 'line', 'source-layer': 'transportation', minzoom: 14.5, filter: ['match', KL, ['path', 'track'], true, false], paint: { 'line-width': Z(14.5, 0.6, 18, 1.6), 'line-opacity': 0.35, 'line-dasharray': [2, 1.6] } });
  const roads = ['all', ['==', ['geometry-type'], 'LineString'], ['match', KL, ROADS, true, false]];
  const sort = ['match', KL, 'motorway', 7, 'trunk', 6, 'primary', 5, 'secondary', 4, 'tertiary', 3, 'minor', 2, 1];
  const tunnel = ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 1];
  add({ ...S, id: 'o-road-c', type: 'line', 'source-layer': 'transportation', minzoom: 5, filter: roads, layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': sort }, paint: { 'line-width': roadW(true), 'line-opacity': Z(12, ['*', tunnel, ['match', KL, ['minor', 'service'], 0, 1]], 13.5, tunnel) } });
  add({ ...S, id: 'o-road', type: 'line', 'source-layer': 'transportation', minzoom: 5, filter: roads, layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': sort }, paint: { 'line-width': roadW(false), 'line-opacity': tunnel } });
  add({ ...S, id: 'o-ferry', type: 'line', 'source-layer': 'transportation', minzoom: 9, filter: ['==', KL, 'ferry'], paint: { 'line-width': Z(9, 0.8, 14, 1.4), 'line-dasharray': [3, 2], 'line-opacity': 0.7 } });
  const halo = { 'text-halo-width': 1.6, 'text-halo-blur': 0.4 };
  add({ ...S, id: 'o-waterway-name', type: 'symbol', 'source-layer': 'waterway', minzoom: 13, filter: ['has', 'name'], layout: { 'symbol-placement': 'line', 'text-field': nameNl, 'text-font': FONT.ital, 'text-size': Z(13, 11, 17, 13), 'symbol-spacing': 360, 'text-letter-spacing': 0.04 }, paint: { 'text-halo-width': 1 } });
  add({ ...S, id: 'o-road-name', type: 'symbol', 'source-layer': 'transportation_name', minzoom: 13, filter: ['all', ['has', 'name'], ['match', KL, ['trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'], true, false]], layout: { 'symbol-placement': 'line', 'text-field': ['step', ['zoom'], ['match', KL, ['minor', 'service'], '', nameNl], 15, nameNl], 'text-font': FONT.reg, 'text-size': Z(13, 10.5, 15, 12, 18, 14), 'text-max-angle': 32, 'symbol-spacing': 320, 'text-padding': 4, 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'map' }, paint: { ...halo } });
  const refKind = ['slice', ['get', 'ref'], 0, 1];
  add({ ...S, id: 'o-shield', type: 'symbol', 'source-layer': 'transportation_name', minzoom: 7, filter: ['all', ['has', 'ref'], ['match', KL, ['motorway', 'trunk', 'primary'], true, false]], layout: { 'symbol-placement': 'line', 'symbol-spacing': ['step', ['zoom'], 300, 10, 460, 12, 560, 14, 680], 'text-field': ['get', 'ref'], 'text-font': FONT.semi, 'text-size': Z(7, 9.5, 12, 11), 'icon-image': ['match', refKind, 'A', 'shield-a', 'E', 'shield-e', ['N', 'B'], 'shield-n', 'shield-o'], 'icon-text-fit': 'both', 'icon-text-fit-padding': [1, 2, 1, 2], 'text-rotation-alignment': 'viewport', 'icon-rotation-alignment': 'viewport', 'text-padding': 26, 'symbol-sort-key': ['match', refKind, 'A', 0, 'E', 1, 2], 'text-letter-spacing': 0.02 }, paint: { 'text-color': ['match', refKind, ['N', 'B'], '#1F1F1F', ['A', 'E'], '#FFFFFF', '#3C4043'], 'icon-opacity': ['step', ['zoom'], ['match', refKind, 'A', 1, 0], 10.4, ['match', refKind, ['A', 'E', 'N', 'B'], 1, 0], 11.5, 1], 'text-opacity': ['step', ['zoom'], ['match', refKind, 'A', 1, 0], 10.4, ['match', refKind, ['A', 'E', 'N', 'B'], 1, 0], 11.5, 1] } });
  add({ ...S, id: 'o-water-name', type: 'symbol', 'source-layer': 'water_name', minzoom: 6, filter: ['has', 'name'], layout: { 'text-field': nameNl, 'text-font': FONT.ital, 'text-size': Z(6, 11, 10, 13, 14, 15), 'text-letter-spacing': 0.06, 'text-max-width': 7 }, paint: { 'text-halo-width': 0.8 } });
  const place = (id, classes, minzoom, maxzoom, font, size) => add({ ...S, id, type: 'symbol', 'source-layer': 'place', minzoom, ...(maxzoom ? { maxzoom } : {}), filter: ['match', KL, classes, true, false], layout: { 'text-field': nameNl, 'text-font': font, 'text-size': size, 'text-max-width': 8, 'text-padding': 3, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99], 'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'], 'text-radial-offset': 0 }, paint: { ...halo } });
  place('o-hamlet', ['hamlet', 'neighbourhood', 'isolated_dwelling'], 13.5, 0, FONT.reg, Z(13.5, 10.5, 17, 12.5));
  place('o-suburb', ['suburb', 'quarter'], 12, 0, FONT.med, Z(12, 11, 15, 13));
  place('o-village', ['village'], 10.5, 0, FONT.reg, Z(10.5, 11, 14, 13, 17, 14.5));
  place('o-town', ['town'], 8, 0, FONT.med, Z(8, 11.5, 11, 13.5, 14, 15.5));
  place('o-city', ['city'], 5, 0, FONT.semi, Z(5, 12.5, 8, 15, 11, 18.5));
  place('o-country', ['country'], 5, 8, FONT.semi, Z(5, 12, 8, 14));
  add({ ...S, id: 'o-housenumber', type: 'symbol', 'source-layer': 'housenumber', minzoom: 17.5, layout: { 'text-field': ['get', 'housenumber'], 'text-font': FONT.reg, 'text-size': 10, 'text-padding': 2 }, paint: { 'text-halo-width': 1.2 } });
}
// thema: de kleuren van de online lagen opnieuw zetten (de schildjes houden hun eigen kleuren)
export function onlinePalette(map, P) { for (const [id, props] of Object.entries(onlinePaint(P))) if (map.getLayer(id)) for (const [k, v] of Object.entries(props)) map.setPaintProperty(id, k, v); }

// PDOK (Kadaster), vrij en zonder sleutel, CC BY 4.0: de BRT-achtergrondkaart (de officiële topografische kaart, licht in
// de stijl pastel, in het donkere thema grijs) als rastertegels in EPSG:3857
export const brtUrl = theme => `https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/${PAL[theme].brt}/EPSG:3857/{z}/{x}/{y}.png`;
export const BRT_ATTR = 'Kaart: <a href="https://www.pdok.nl/" target="_blank" rel="noopener">Kadaster, PDOK</a>, <a href="https://creativecommons.org/licenses/by/4.0/deed.nl" target="_blank" rel="noopener">CC BY 4.0</a>';
