// Controle van de echte plekken en ritten (Control Tower 4.0, data).
//
//   npm run build && (cd dist && python3 -m http.server 8771 --bind 127.0.0.1) &
//   node tests/data-check.mjs [http://127.0.0.1:8771/index.html]
//
// Bestanden: elke standplaats heeft een adres, een bron, een datum, een terrein en een knoop met toegangsroute; elke winkel
// en elk DC heeft een knoop; klanten.json onder 600 kB, buildings.json onder 2,5 MB en niet in de hoofdbundel.
// In de browser: vanaf elke standplaats een pad over het wegennet naar minstens tien winkels; elke rit van de dag stopt
// alleen bij echte winkels, DC's, fabrieken, groothandels, bezorgpunten of eigen vestigingen en is niet langer dan 650 km;
// een vrachtwagen bij een stop staat op de plek van die stop; geparkeerde voertuigen staan op het terrein; de kerngetallen
// blijven in de buurt (1.300 voertuigen, 1.681 opleggers, 1.800 diensten) en dezelfde seed geeft na een herlaad dezelfde dag.
import { createRequire } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] || 'http://127.0.0.1:8771/index.html';
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const data = f => JSON.parse(readFileSync(path.join(app, 'src', 'data', f), 'utf8'));
const P = data('places.json'), K = data('klanten.json'), TOE = data('toegang.json');
const km = (a, b) => { const c = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180); return Math.hypot((a[0] - b[0]) * c * 111.32, (a[1] - b[1]) * 111.32); };
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c; } return c; };
const distRing = (pt, ring) => inRing(pt, ring) ? 0 : Math.min(...ring.map((p, i) => { const q = ring[(i + 1) % ring.length]; const c = Math.cos(pt[1] * Math.PI / 180) * 111320; const ax = (p[0] - pt[0]) * c, ay = (p[1] - pt[1]) * 111320, bx = (q[0] - pt[0]) * c, by = (q[1] - pt[1]) * 111320; const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(ax + t * dx, ay + t * dy); }));
const dec = s => { const n = (s.split('.')[1] || '').length; return n; };

// ---------- bestanden ----------
const SP = P.SP;
check(SP.length === 42, `42 standplaatsen (${SP.length})`);
const spBad = SP.filter(s => !(s.adres && s.adres.straat && s.adres.nr && s.adres.postcode && s.adres.plaats && /^https:\/\/werkenbijsimonloos\.nl\/vacatures\//.test(s.bron || '') && s.datum && Number.isInteger(s.node) && s.node >= 0 && typeof s.toegang === 'string' && Array.isArray(s.terrein) && s.terrein.length >= 4 && Array.isArray(s.rijen) && s.rijen.length && dec(String(s.lat)) >= 4 && dec(String(s.lon)) >= 4));
check(!spBad.length, `elke standplaats: adres, bron (vacature), datum, knoop, toegangsroute, terrein, parkeerrijen, positie op ≥ 4 decimalen${spBad.length ? ': ' + spBad.map(s => s.n).join(', ') : ''}`);
const outside = SP.filter(s => !inRing([s.lon, s.lat], s.terrein) && distRing([s.lon, s.lat], s.terrein) > 60);
check(!outside.length, `adrespunt van elke standplaats op of naast (≤ 60 m) zijn terrein${outside.length ? ': ' + outside.map(s => s.n).join(', ') : ''}`);
const nodeCount = data('graph.json').nodes.length;
const kBad = [...K.stores, ...K.dcs].filter(p => !(Number.isInteger(p.node) && p.node >= 0 && p.node < nodeCount && p.naam && p.plaats && p.formule));
check(!kBad.length, `elke winkel en elk DC heeft naam, plaats, formule en een knoop in de graaf (${K.stores.length} winkels, ${K.dcs.length} DC's)${kBad.length ? ': ' + kBad.slice(0, 5).map(p => p.id).join(', ') : ''}`);
const noAcc = K.stores.filter(s => !s.eiland && !TOE[s.id]);
check(!noAcc.length, `elke winkel met wegverbinding heeft een toegangsroute (${K.stores.filter(s => s.eiland).length} op de Waddeneilanden zonder)`);
const kSize = statSync(path.join(app, 'src/data/klanten.json')).size, bSize = statSync(path.join(app, 'src/data/buildings.json')).size;
check(kSize < 600 * 1024, `klanten.json ${Math.round(kSize / 1024)} kB (< 600 kB)`);
check(bSize < 2.5 * 1024 * 1024, `buildings.json ${Math.round(bSize / 1024)} kB (< 2,5 MB)`);
const appSrc = ['main.js', 'map.js', 'ui.js', 'views.js', 'fleet.js', 'places.js', 'roads.js', 'tables.js', 'sheets.js', 'people.js'].map(f => { try { return readFileSync(path.join(app, 'src', f), 'utf8'); } catch { return ''; } }).join('\n');
check(!/^\s*import[^;]*from\s*['"]\.\/(buildings\.js|data\/buildings\.json)['"]/m.test(appSrc), 'buildings.js en buildings.json worden nergens statisch geïmporteerd');

// ---------- in de browser ----------
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route('**/*', r => new URL(r.request().url()).host === new URL(url).host ? r.continue() : r.abort('blockedbyclient'));
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
async function load() { await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 120000 }); }
await load();
// paden vanaf elke standplaats naar de tien dichtstbijzijnde winkels
const targets = SP.map(s => ({ sp: 'sp:' + s.n, ids: K.stores.filter(w => !w.eiland).map(w => [w.id, km([s.lon, s.lat], [w.lon, w.lat])]).sort((a, b) => a[1] - b[1]).slice(0, 10).map(x => x[0]) }));
const pad = await page.evaluate(T => T.map(({ sp, ids }) => ({ sp, ok: ids.filter(id => { const r = window.SLCT.fleet.routeBetween(sp, id); return r && r.verbonden && r.km > 0 && r.km < 120; }).length })), targets);
const padBad = pad.filter(x => x.ok < 10);
check(!padBad.length, `vanaf elke standplaats een pad over het wegennet naar minstens tien winkels${padBad.length ? ': ' + padBad.map(x => `${x.sp} (${x.ok})`).join(', ') : ''}`);
// ritten van de dag
const ids = { winkel: new Set(K.stores.map(s => s.id)), dc: new Set(K.dcs.map(d => d.id)), bz: new Set((P.BEZORG || []).map(b => b.id)) };
const day = await page.evaluate(() => {
  const f = window.SLCT.fleet; const out = [];
  for (const t of f.trucks) for (const r of t.routes || []) out.push({ t: t.id, base: t.base.n, div: t.div, total: r.total, stops: r.marks.slice(1, -1).map(m => ({ id: m.place.id || (m.place.fleet !== undefined ? 'sp:' + m.place.n : null), name: m.name, plaats: m.place.plaats || m.place.n })), first: r.marks[0].place.n, last: r.marks[r.marks.length - 1].place.n });
  return out;
});
const real = s => s.id && (ids.winkel.has(s.id) || ids.dc.has(s.id) || ids.bz.has(s.id) || s.id.startsWith('sp:'));
const notReal = day.flatMap(r => r.stops.filter(s => !real(s)).map(s => `${r.t}: ${s.name}`));
check(day.length > 2000 && !notReal.length, `elke stop van de dag is een echte winkel, DC, fabriek, groothandel, bezorgstraat of eigen vestiging (${day.length} ritten, ${day.reduce((n, r) => n + r.stops.length, 0)} stops)${notReal.length ? ': ' + notReal.slice(0, 5).join('; ') : ''}`);
const homeBad = day.filter(r => r.first !== r.base || r.last !== r.base);
check(!homeBad.length, 'elke rit begint en eindigt op de eigen standplaats');
const named = day.flatMap(r => r.stops).filter(s => s.plaats && !s.name.toLowerCase().includes(String(s.plaats).toLowerCase()));
check(!named.length, `elke stopnaam bevat de plaats (${named.length ? named.slice(0, 3).map(s => s.name).join('; ') : 'alle'})`);
const maxKm = Math.max(...day.map(r => r.total));
check(maxKm <= 650, `langste rit ${Math.round(maxKm)} km (≤ 650 km)`);
const byDiv = {}; for (const r of day) { const d = (byDiv[r.div] = byDiv[r.div] || { n: 0, km: 0, stores: new Set() }); d.n++; d.km += r.total; for (const s of r.stops) d.stores.add(s.id); }
console.log('     per divisie: ' + Object.entries(byDiv).map(([k, v]) => `${k} ${v.n} ritten, gem. ${Math.round(v.km / v.n)} km, ${v.stores.size} verschillende stops`).join(' · '));
// een vrachtwagen bij een stop staat bij die stop; geparkeerd staat hij op het terrein
const pos = await page.evaluate(() => {
  const f = window.SLCT.fleet; const stop = []; const yard = [];
  for (const t of f.trucks) {
    const seg = t.plan.find(s => s.k === 'stop'); if (seg) { const s = f.stateAt(t, t.dayStart + (seg.t0 + seg.t1) / 2); const p = seg.place; stop.push({ t: t.id, pos: [s.pos.lon, s.pos.lat], place: p && p.id ? p.id : p && p.n, lon: p && p.lon, lat: p && p.lat }); }
    const ter = t.plan.find(s => s.k === 'terrein'); if (ter) { const s = f.stateAt(t, t.dayStart + ter.t0 + 0.5); if (s.st === 'terrein') yard.push({ t: t.id, base: t.base.n, pos: [s.pos.lon, s.pos.lat] }); }
  }
  return { stop, yard };
});
const toeEnd = id => { const s = TOE[id] || (SP.find(x => 'sp:' + x.n === id) || {}).toegang; if (!s) return null; let i = 0, lat = 0, lon = 0, last = null; while (i < s.length) { let b, sh = 0, r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); lat += r & 1 ? ~(r >> 1) : r >> 1; sh = 0; r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); lon += r & 1 ? ~(r >> 1) : r >> 1; last = [lon / 1e5, lat / 1e5]; } return last; };
const far = pos.stop.filter(s => { const d = toeEnd(typeof s.place === 'string' && ids.winkel.has(s.place) || ids.dc.has(s.place) || ids.bz.has(s.place) ? s.place : 'sp:' + s.place); return d && km(s.pos, d) * 1000 > 25; });
check(pos.stop.length > 800 && !far.length, `vrachtwagen bij een stop staat op de stopplek (${pos.stop.length} gecontroleerd)${far.length ? ': ' + far.slice(0, 3).map(s => s.t).join(', ') : ''}`);
const spRing = new Map(SP.map(s => [s.n, s.terrein]));
const offYard = pos.yard.filter(y => distRing(y.pos, spRing.get(y.base)) > 45);
check(pos.yard.length > 500 && offYard.length <= pos.yard.length * 0.02, `geparkeerde voertuigen op het terrein of de rand ervan (≤ 45 m): ${pos.yard.length - offYard.length} van ${pos.yard.length}${offYard.length ? ', buiten: ' + offYard.slice(0, 3).map(y => `${y.t} (${y.base})`).join(', ') : ''}`);
// kerngetallen en herhaalbaarheid
const stats = await page.evaluate(() => { const f = window.SLCT.fleet; return { v: f.trucks.length, o: f.trailers.length, d: f.trucks.reduce((n, t) => n + t.diensten.length, 0), fp: f.trucks.map(t => (t.routes || []).map(r => Math.round(r.total * 10) + r.marks.map(m => m.name).join('|')).join('/')).join(';') }; });
check(stats.v === 1300 && Math.abs(stats.o - 1681) <= 40 && Math.abs(stats.d - 1800) <= 60, `kerngetallen: ${stats.v} voertuigen, ${stats.o} opleggers, ${stats.d} diensten`);
await load();
const fp2 = await page.evaluate(() => { const f = window.SLCT.fleet; return f.trucks.map(t => (t.routes || []).map(r => Math.round(r.total * 10) + r.marks.map(m => m.name).join('|')).join('/')).join(';'); });
check(fp2 === stats.fp, 'dezelfde seed geeft na een herlaad precies dezelfde ritten');
check(!errors.length, `geen paginafouten${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
