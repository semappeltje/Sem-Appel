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
// blijven in de buurt (1.300 voertuigen, 1.700 opleggers, rond 1.600 diensten) en dezelfde seed geeft na een herlaad dezelfde dag.
// De geijkte dag (ronde 2): winkeldiensten van 8,5 tot 11 uur (mediaan rond 9,5), netwerk en bulk langer, 45 tot 60 procent
// rijden, eerste dienst tussen 02:00 en 07:00, een tweede dienst voor 25 tot 35 procent van de vloot, om 10:00 minder dan
// een derde op het terrein; EU 561 (4,5 uur rijden, dan 45 of 15 + 30 minuten pauze; 9 of 10 uur rijden per dienst) en
// de accu; wachttijd (35 tot 60 minuten per truck per dag); docks zonder overlap en gelijk op hal-scherm en dockplanning;
// gebeurtenissen per voertuig op volgorde; de pool met 2 tot 5 procent van de ritten per dag, nooit leeg, nooit vol.
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
// ronde 2: een tweede dienst voor 25 tot 35 procent van de vloot (was de helft), dus rond 1.600 diensten in plaats van 1.800
check(stats.v === 1300 && Math.abs(stats.o - 1700) <= 40 && stats.d >= 1500 && stats.d <= 1700, `kerngetallen: ${stats.v} voertuigen, ${stats.o} opleggers, ${stats.d} diensten`);
// ---------- de geijkte dag (ronde 2) ----------
const dag = await page.evaluate(() => {
  const f = window.SLCT.fleet; const L = []; let gaten = 0, evOver = 0, teLaat = 0, zonderPauze = 0;
  for (const t of f.trucks) {
    for (let i = 1; i < t.plan.length; i++) if (Math.abs(t.plan[i].t0 - t.plan[i - 1].t1) > 1e-6) gaten++;
    for (const d of t.diensten) {
      const segs = t.plan.filter(s => s.d === d.i); let drv = 0, deel = false, maxDrv = 0, rij = 0, rust = 0;
      for (const s of segs) {
        if (s.k === 'drive') { const n = s.t1 - s.t0 - (s.delay || 0); drv += n; rij += n; maxDrv = Math.max(maxDrv, drv); continue; }
        const len = s.t1 - s.t0;
        if (s.k === 'pauze' || s.k === 'laden' || (s.k === 'terrein' && !s.dockSoort)) { if (len >= 30 - 1e-6) rust++; if (len >= 45 - 1e-6 || (len >= 30 - 1e-6 && deel)) { drv = 0; deel = false; } else if (len >= 15 - 1e-6) deel = true; }
      }
      if (d.t1 - d.t0 > 330 && !rust) zonderPauze++;
      L.push({ div: t.div, i: d.i, start: ((t.dayStart + d.t0) % 1440 + 1440) % 1440, dur: d.t1 - d.t0, rijdt: segs.reduce((a, s) => a + (s.k === 'drive' ? s.t1 - s.t0 : 0), 0), maxDrv, rij, maxRij: d.maxRij });
    }
    if (t.diensten.length && t.plan[t.plan.length - 1].t0 > 1440) teLaat++;
    if (t.ev && t.diensten.length) { let k = 0; for (const s of t.plan) { if (s.k === 'laden' && !s.partial) k = 0; else if (s.k === 'drive') { k += s.km1 - s.km0; if (k > t.range * 0.8) { evOver++; break; } } } }
  }
  const wacht = f.trucks.filter(t => t.diensten.length).map(t => t.plan.reduce((a, s) => a + (s.k === 'stop' ? s.wacht || 0 : 0), 0));
  return { L, gaten, evOver, teLaat, zonderPauze, terrein10: f.trucks.filter(t => f.stateAt(t, 600).st === 'terrein').length, twee: f.trucks.filter(t => t.diensten.length > 1).length, n: f.trucks.length, wachtGem: wacht.reduce((a, b) => a + b, 0) / wacht.length };
});
const q = (a, p) => { const x = a.slice().sort((u, v) => u - v); return x[Math.round((x.length - 1) * p)] / 60; };
const per = div => dag.L.filter(x => x.div === div);
const W = per('winkel'), wMed = q(W.map(x => x.dur), 0.5), wP10 = q(W.map(x => x.dur), 0.1), wP90 = q(W.map(x => x.dur), 0.9);
check(wMed >= 9 && wMed <= 10 && wP10 >= 8.25 && wP90 <= 11, `winkeldienst: mediaan ${wMed.toFixed(2)} uur, p10 ${wP10.toFixed(2)}, p90 ${wP90.toFixed(2)} (8,5 tot 11 uur, mediaan rond 9,5)`);
const nMed = q(per('netwerk').map(x => x.dur), 0.5), bMed = q(per('bulk').map(x => x.dur), 0.5);
check(nMed > wMed && bMed > wMed, `netwerk (${nMed.toFixed(2)} uur) en bulk (${bMed.toFixed(2)} uur) langer dan winkel`);
const rijPct = L => L.reduce((a, x) => a + x.rijdt, 0) / L.reduce((a, x) => a + x.dur, 0) * 100;
const rAll = rijPct(dag.L), rW = rijPct(W);
check(rAll >= 45 && rAll <= 60 && rW >= 45 && rW <= 60, `rijden ${rAll.toFixed(1)} % van de diensttijd (winkel ${rW.toFixed(1)} %; doel 45 tot 60)`);
const s1 = dag.L.filter(x => x.i === 0), s2 = dag.L.filter(x => x.i === 1);
check(s1.every(x => x.start >= 120 && x.start <= 420) && s2.every(x => x.start >= 720), `eerste dienst start tussen 02:00 en 07:00 (${s1.length}), tweede dienst 's middags of 's avonds (${s2.length})`);
const tw = dag.twee / dag.n * 100;
check(tw >= 25 && tw <= 35, `tweede dienst voor ${tw.toFixed(1)} % van de vloot (25 tot 35)`);
check(dag.terrein10 < dag.n / 3, `om 10:00 op het terrein: ${dag.terrein10} van ${dag.n} (minder dan een derde)`);
const maxAan = Math.max(...dag.L.map(x => x.maxDrv)), teVeel = dag.L.filter(x => x.rij > x.maxRij + 0.5 || x.rij > 600.5).length, verl = dag.L.filter(x => x.maxRij > 540).length / dag.L.length * 100;
check(maxAan <= 270 + 1e-6 && !teVeel && verl <= 30 && !dag.zonderPauze, `EU 561: hoogstens ${Math.round(maxAan)} min rijden zonder pauze (≤ 270), ${teVeel} diensten boven 9 of 10 uur rijden, ${verl.toFixed(0)} % mag vandaag 10 uur rijden, ${dag.zonderPauze} lange diensten zonder pauze`);
check(!dag.evOver, `accu: geen elektrisch voertuig rijdt meer dan 80 % van zijn bereik tussen twee laadbeurten (${dag.evOver})`);
check(!dag.gaten && !dag.teLaat, `plannen aaneengesloten (${dag.gaten} gaten) en klaar voor de volgende dag (${dag.teLaat} te laat)`);
check(dag.wachtGem >= 35 && dag.wachtGem <= 60, `wachttijd bij stops ${dag.wachtGem.toFixed(1)} min per truck per dag (35 tot 60)`);
// wachttijd per plek, docks, gebeurtenissen en pool
const rest = await page.evaluate(() => {
  const f = window.SLCT.fleet; const SP = [...new Set(f.trucks.map(t => t.base))];
  const W = f.wachtPerPlek(); const vorm = W.every(w => w.id && w.naam && w.soort && w.n > 0 && typeof w.gem === 'number' && typeof w.p90 === 'number' && w.dagdeel && 'ochtend' in w.dagdeel);
  const gem = s => { const L = W.filter(w => w.soort === s); const n = L.reduce((a, w) => a + w.n, 0); return n ? L.reduce((a, w) => a + w.gem * w.n, 0) / n : 0; };
  const dcOchtend = W.filter(w => w.soort === 'dc').every(w => w.dagdeel.ochtend >= w.dagdeel.avond);
  // docks: geen overlap (ook rond middernacht), vertrekken met een dock dat in de dockplanning staat, voertuig op het terrein
  const raak = (x, y) => [-1440, 0, 1440].some(o => x[0] + o < y[1] && y[0] < x[1] + o);
  let overlap = 0, docksFout = 0, vertrekZonder = 0, vertrekNiet = 0, vertrekken = 0, buiten = 0, aanDock = 0;
  const inRing = (pt, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c; } return c; };
  for (const sp of SP) {
    const plan = f.dockPlan(sp.n); if (plan.length !== sp.docks || (sp.dockPlek || []).length !== sp.docks || sp.docks < 3) docksFout++;
    for (const row of plan) { const iv = row.blokken.map(b => [((b.t0 % 1440) + 1440) % 1440, ((b.t0 % 1440) + 1440) % 1440 + (b.t1 - b.t0)]); for (let i = 0; i < iv.length; i++) for (let j = i + 1; j < iv.length; j++) if (raak(iv[i], iv[j])) overlap++; }
    for (const d of f.departures(sp, 0, 1440)) {
      vertrekken++; if (!d.dock) { vertrekZonder++; continue; }
      const ok = (plan[d.dock - 1] || { blokken: [] }).blokken.some(b => b.voertuig === d.t.id && Math.abs((((b.t1 - d.at) % 1440) + 1440 + 720) % 1440 - 720) < 0.01);
      if (!ok) vertrekNiet++;
    }
  }
  for (const t of f.trucks) for (const s of t.plan) if (s.dockSoort && s.dock) { aanDock++; const st = f.stateAt(t, t.dayStart + (s.t0 + s.t1) / 2); if (st.dock !== s.dock || !inRing([st.pos.lon, st.pos.lat], t.base.terrein)) buiten++; }
  // gebeurtenissen
  const OK = new Set(['vertrek', 'aankomst', 'los_start', 'los_eind', 'wacht', 'koppel', 'ontkoppel', 'laad_start', 'laad_eind', 'pauze_start', 'pauze_eind']);
  let evFout = 0, evN = 0, vert = 0, aank = 0, losS = 0, losE = 0;
  for (const t of f.trucks) { const E = f.eventsOf(t.id); evN += E.length; for (let i = 0; i < E.length; i++) { const e = E[i]; if (!OK.has(e.soort) || typeof e.t !== 'number' || !('plek' in e) || typeof e.naam !== 'string' || (i && E[i - 1].t > e.t)) evFout++; if (e.soort === 'vertrek') vert++; if (e.soort === 'aankomst') aank++; if (e.soort === 'los_start' || e.soort === 'laad_start') losS++; if (e.soort === 'los_eind' || e.soort === 'laad_eind') losE++; } }
  // pool
  const P = f.pool; const ritten = f.trucks.reduce((a, t) => a + t.routes.length, 0);
  const pvorm = P.every(p => /^P-\d{4}$/.test(p.id) && p.sp && p.div && p.klant && Array.isArray(p.stops) && p.stops.length && p.stops.every(s => s.place && typeof s.km === 'number' && s.name) && Array.isArray(p.venster) && p.venster[1] > p.venster[0] && p.duur > 0 && p.km > 0 && (p.oplegger === null || typeof p.oplegger === 'string') && (p.dag === 'vandaag' || p.dag === 'morgen') && ['ziek', 'uitval voertuig', 'extra rit klant', 'nieuw uit OTM5'].includes(p.reden));
  const morgenLaat = P.filter(p => p.dag === 'morgen' && (p.bekend < 780 || p.bekend > 990)).length;
  let leeg = 0, maxZicht = 0; for (let T = 0; T < 1440; T += 15) { const Z = f.poolAt(T); maxZicht = Math.max(maxZicht, Z.length); for (const sp of SP) if (!Z.some(p => p.sp === sp.n)) leeg++; }
  return { plekken: W.length, vorm, winkel: gem('winkel'), dc: gem('dc'), dcOchtend, overlap, docksFout, vertrekken, vertrekZonder, vertrekNiet, aanDock, buiten, evN, evFout, vert, aank, losS, losE, pool: P.length, vandaag: P.filter(p => p.dag === 'vandaag').length, morgen: P.filter(p => p.dag === 'morgen').length, ritten, pvorm, morgenLaat, leeg, maxZicht };
});
check(rest.plekken > 500 && rest.vorm && rest.dc > 2 * rest.winkel && rest.dcOchtend, `wachttijd per plek: ${rest.plekken} plekken, DC gem. ${rest.dc.toFixed(1)} min, winkel ${rest.winkel.toFixed(1)} min, DC's 's ochtends langer`);
check(!rest.docksFout && !rest.overlap, `docks: elke standplaats heeft zijn docks met een plek in de gevel, nooit twee voertuigen tegelijk aan één dock (${rest.overlap} overlappen)`);
check(rest.vertrekken > 2500 && !rest.vertrekZonder && !rest.vertrekNiet, `elk vertrek heeft een dock dat ook in de dockplanning staat (${rest.vertrekken} vertrekken, ${rest.vertrekZonder} zonder, ${rest.vertrekNiet} anders)`);
check(rest.aanDock > 3000 && !rest.buiten, `een voertuig aan een dock staat aan dat dock op het terrein (${rest.aanDock} blokken, ${rest.buiten} fout)`);
check(rest.evN > 20000 && !rest.evFout && rest.vert === rest.aank && rest.losS === rest.losE, `gebeurtenissen: ${rest.evN}, op volgorde en van een bekende soort (${rest.evFout} fout), vertrek = aankomst (${rest.vert}), lossen/laden begint en eindigt (${rest.losS})`);
const pv = rest.vandaag / rest.ritten * 100, pm = rest.morgen / rest.ritten * 100;
check(rest.pvorm && pv >= 2 && pv <= 5 && pm >= 2 && pm <= 5 && !rest.morgenLaat, `pool: ${rest.vandaag} ritten vandaag (${pv.toFixed(1)} %), ${rest.morgen} voor morgen (${pm.toFixed(1)} %, 's middags bekend) bij ${rest.ritten} ritten`);
check(!rest.leeg && rest.maxZicht <= rest.ritten * 0.06, `pool nooit leeg (elke standplaats elk kwartier minstens één rit) en nooit vol (hoogstens ${rest.maxZicht} tegelijk)`);
await load();
const fp2 = await page.evaluate(() => { const f = window.SLCT.fleet; return f.trucks.map(t => (t.routes || []).map(r => Math.round(r.total * 10) + r.marks.map(m => m.name).join('|')).join('/')).join(';'); });
check(fp2 === stats.fp, 'dezelfde seed geeft na een herlaad precies dezelfde ritten');
check(!errors.length, `geen paginafouten${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
