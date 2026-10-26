// Controle van de kaart (Control Tower 4.0, kaart en beweging): vloeiende beweging tussen twee simulatiestappen, volgen in
// 2D en 3D, de terugval zonder online kaart, geen verzoek naar buiten in de ingebedde versie, aanwijzen (handcursor en
// halo), klikken, vliegen alleen als het voertuig buiten beeld is, en "minder beweging" (niets glijdt, de camera springt).
// Dan het spoor van de gekozen rit (grijs gereden, blauw komend, de laatste 20 minuten vervagend), flyTo naar een plek,
// voertuig of oplegger met een korte markering, gebeurtenissen langs een rit, het anker voor een hoverkaartje, de docks
// (een voertuig springt naar het dock, de deuren op de gevel) en de labels bij de plekken van de gekozen rit. Dan rechts
// rijden: elk rijdend voertuig op de rechterstrook van de rijbaan van zijn eigen rijrichting (de A7 bij Wognum in beide richtingen, alle
// rijdende voertuigen, de route van een gekozen voertuig op zijn rijbaan), met een schermafbeelding van de A7 op zoom 16.
// De online basiskaarten nagebootst (OpenFreeMap met een echte vectortegel, de luchtfoto en de BRT-achtergrondkaart van
// PDOK) met hun terugval, land en zee onder elke standplaats, elk DC, elke fabriek en elke winkel, water op het beeld op
// ruim twintig bekende plekken (het IJ, de havens, de grote rivieren en meren, de Eems, de Westerschelde; licht en donker)
// en land vlak ernaast, en de afdelingen op het terrein.
// Daarna schermafbeeldingen van de ingebouwde kaart op zoom 7, 11, 14 en 16, licht en donker, 1440 en 390 px, en een
// meting van de framerate. Ook: de demosite (data-basiskaart="online") en de bezorgbussen aan en uit.
//
// Gebruik: npm run build, dan in dist/ een webserver (python3 -m http.server 8772 --bind 127.0.0.1), dan
//   node tests/map-check.mjs [url] [map voor schermafbeeldingen] [snel]
// Chromium draait met SwiftShader (software-WebGL): daar zijn 5 tot 8 beelden per seconde normaal.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , url = 'http://127.0.0.1:8772/index.html', shots = '', quick = ''] = process.argv;
const host = new URL(url).host;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const errorsOf = page => { const e = []; page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|ERR_FAILED|ERR_TUNNEL|ERR_CONNECTION_REFUSED|pdok|openfreemap/.test(m.text())) e.push(m.text().slice(0, 240)); }); page.on('pageerror', x => e.push('pageerror: ' + String(x).slice(0, 240))); return e; };

// een effen PNG (voor nagebootste kaarttegels)
function crc32(b) { let crc = 0xFFFFFFFF; for (let n = 0; n < b.length; n++) { let c = (crc ^ b[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function png(w, h, [r, g, bl]) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = bl; }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PHOTO = png(256, 256, [104, 122, 88]), BRT = png(256, 256, [236, 232, 220]);
// een vectortegel (Mapbox Vector Tile 2.1, protobuf) met lagen van OpenMapTiles: water, landuse, transportation (een
// snelweg en een straat), transportation_name, building en place; om OpenFreeMap na te bootsen
function mvt() {
  const varint = n => { const o = []; n >>>= 0; while (n > 127) { o.push((n & 127) | 128); n >>>= 7; } o.push(n); return o; };
  const key = (f, wt) => varint((f << 3) | wt), len = (f, b) => [...key(f, 2), ...varint(b.length), ...b], str = (f, t) => len(f, [...Buffer.from(t, 'utf8')]), uint = (f, n) => [...key(f, 0), ...varint(n)];
  const zz = n => ((n << 1) ^ (n >> 31)) >>> 0;
  const geom = (rings, close) => { const out = []; let x = 0, y = 0; for (const r of rings) { out.push(9, zz(r[0][0] - x), zz(r[0][1] - y)); x = r[0][0]; y = r[0][1]; if (r.length > 1) out.push(2 | ((r.length - 1) << 3)); for (let i = 1; i < r.length; i++) { out.push(zz(r[i][0] - x), zz(r[i][1] - y)); x = r[i][0]; y = r[i][1]; } if (close) out.push(15); } return out; };
  const layer = (name, feats) => {
    const keys = [], vals = [], ki = k => (keys.includes(k) ? keys.indexOf(k) : keys.push(k) - 1), vi = v => (vals.includes(v) ? vals.indexOf(v) : vals.push(v) - 1);
    const fs = feats.map((f, n) => { const tags = []; for (const [k, v] of Object.entries(f.tags)) tags.push(ki(k), vi(v)); return len(2, [...uint(1, n + 1), ...len(2, tags.flatMap(varint)), ...uint(3, f.type), ...len(4, geom(f.rings, f.type === 3).flatMap(varint))]); });
    const value = v => (typeof v === 'number' ? [...key(5, 0), ...varint(v)] : str(1, String(v)));
    return len(3, [...uint(15, 2), ...str(1, name), ...fs.flat(), ...keys.flatMap(k => str(3, k)), ...vals.flatMap(v => len(4, value(v))), ...uint(5, 4096)]);
  };
  const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return Buffer.from([
    ...layer('water', [{ type: 3, rings: [sq(0, 0, 1200, 1200)], tags: { class: 'lake' } }]), ...layer('landuse', [{ type: 3, rings: [sq(2400, 2400, 4096, 4096)], tags: { class: 'industrial' } }]),
    ...layer('transportation', [{ type: 2, rings: [[[0, 2048], [4096, 2100]]], tags: { class: 'motorway' } }, { type: 2, rings: [[[2048, 0], [2000, 4096]]], tags: { class: 'minor' } }]),
    ...layer('transportation_name', [{ type: 2, rings: [[[0, 2048], [4096, 2100]]], tags: { class: 'motorway', ref: 'A7' } }]),
    ...layer('building', [{ type: 3, rings: [sq(2600, 2600, 3000, 3000)], tags: { render_height: 9 } }]), ...layer('place', [{ type: 1, rings: [[[1500, 3000]]], tags: { class: 'town', name: 'Proefdorp', rank: 10 } }]),
  ]);
}
const VTILE = mvt();

// opent de app; block: externe hosts tegenhouden (zoals een omgeving zonder bereik); embedded: data-tiles="off";
// ofm (OpenFreeMap): 'ok' (TileJSON en een echte vectortegel), 'leeg' (antwoordt, maar een lege tegel), 'png' (een plaatje
// in plaats van een vectortegel, zoals een tegel met een watermerk) of 'fout' (onbereikbaar); pdok (luchtfoto en BRT):
// 'ok', 'hr-fout' (de luchtfoto van 8 cm onbereikbaar, die van 25 cm wel) of 'fout'; base: de bewaarde basiskaart;
// attrs: extra attributen op #app (de demosite: data-basiskaart="online"); prefs: andere bewaarde sleutels vooraf
async function open({ w = 1280, h = 800, dark = false, reduced = false, embedded = false, block = true, ofm = 'fout', pdok = 'fout', base = null, attrs = '', prefs = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: w < 500 ? 2 : 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errors = errorsOf(page); const ext = new Set();
  page.on('request', r => { if (/^(data|blob|about):/.test(r.url())) return; const u = new URL(r.url()); if (u.host !== host) ext.add(u.host); });
  if (block) await page.route('**/*', route => {
    const u = new URL(route.request().url()); if (u.host === host) return route.continue();
    if (u.host === 'tiles.openfreemap.org' && ofm !== 'fout') {
      if (/\/planet$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tilejson: '3.0.0', tiles: ['https://tiles.openfreemap.org/planet/20261020_001001_pt/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, vector_layers: ['water', 'landuse', 'transportation', 'transportation_name', 'building', 'place'].map(id => ({ id, fields: {} })) }) });
      return route.fulfill(ofm === 'ok' ? { status: 200, contentType: 'application/x-protobuf', body: VTILE } : ofm === 'png' ? { status: 200, contentType: 'image/png', body: BRT } : { status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) });
    }
    if (u.host === 'service.pdok.nl' && pdok !== 'fout' && !(pdok === 'hr-fout' && /orthoHR/.test(u.pathname))) return route.fulfill({ status: 200, contentType: 'image/png', body: /luchtfoto/.test(u.pathname) ? PHOTO : BRT });
    if (u.host === 'tiles.openfreemap.org' || u.host === 'service.pdok.nl') return route.abort('connectionrefused');
    return route.abort('blockedbyclient');
  });
  const extra = [embedded ? 'data-tiles="off" data-embedded' : '', attrs].filter(Boolean).join(' ');
  if (extra) await page.route(url, async route => { const res = await route.fetch(); const body = (await res.text()).replace('class="app slct"', `class="app slct" ${extra}`); await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/html; charset=utf-8' } }); });
  // elke melding die in beeld komt, onthouden (een melding verdwijnt na een paar seconden; onder belasting is die al weg
  // voordat de test kijkt)
  // (sinds de interface 4.0 is een melding een toast in #toasts: elke nieuwe toast telt)
  await page.addInitScript(() => { window.__notices = []; document.addEventListener('DOMContentLoaded', () => { const el = document.getElementById('toasts'); if (!el) return; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { const t = (n.textContent || '').trim(); if (t && window.__notices[window.__notices.length - 1] !== t) window.__notices.push(t); } }).observe(el, { childList: true }); }); });
  await page.addInitScript(([d, b, pr]) => { try { localStorage.clear(); localStorage.setItem('sl-theme', d ? 'dark' : 'light'); if (b) localStorage.setItem('sl-kaartlaag', b); for (const [k, v] of Object.entries(pr || {})) localStorage.setItem(k, v); } catch { /* geen opslag */ } }, [dark, base, prefs]);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SLCT && window.SLCT.fleet && document.getElementById('loading').hidden, null, { timeout: 120_000 });
  for (let i = 0; i < 3; i++) { const b = await page.$('#wzNext'); if (b) { await b.click(); await page.waitForTimeout(150); } }
  // sinds de interface 4.0 opent de app op het Overzicht; de kaart krijgt de voertuigen pas als hij in beeld is
  await page.evaluate(() => window.SLCT.ui.setView && window.SLCT.ui.setView('kaart'));
  await page.waitForTimeout(900);
  return { page, ctx, errors, ext };
}
// de simulatie zelf laten stappen: de klok stil en de automatische stappen uit; step() zet de klok verder en rekent een stap
const manual = page => page.evaluate(() => { const S = window.SLCT; if (!S.__frame) { S.__frame = S.ui.frame; S.ui.frame = () => {}; } S.state.playing = false; });
const auto = page => page.evaluate(() => { const S = window.SLCT; if (S.__frame) { S.ui.frame = S.__frame; delete S.__frame; } S.state.playing = true; });
const step = (page, min) => page.evaluate(min => { const S = window.SLCT; S.state.simTime += min; (S.__frame || S.ui.frame)(); }, min);
// een voertuig dat de komende minuten rijdt (niet aankomt), met de kaart erop; liefst een zonder ander voertuig binnen
// 800 m, zodat aanwijzen en klikken niet op een buurman uitkomen
const pickMover = (page, zoom) => page.evaluate(zoom => {
  const S = window.SLCT, f = S.fleet, T = S.state.simTime;
  const pos = new Map(f.trucks.map(t => [t, f.stateAt(t, T).pos]));
  const alone = t => { const p = pos.get(t); for (const [u, q] of pos) if (u !== t && Math.abs(q.lon - p.lon) < 0.012 && Math.abs(q.lat - p.lat) < 0.0072) return false; return true; };
  const mover = t => { const a = f.stateAt(t, T), b = f.stateAt(t, T + 3); return a.st === 'onderweg' && b.st === 'onderweg' && a.seg === b.seg && Math.hypot(a.pos.lon - b.pos.lon, a.pos.lat - b.pos.lat) > 0.01; };
  const t = f.trucks.find(t => mover(t) && alone(t)) || f.trucks.find(mover);
  const s = f.stateAt(t, T); S.map.map.jumpTo({ center: [s.pos.lon, s.pos.lat], zoom, pitch: 0, bearing: 0 }); (S.__frame || S.ui.frame)(true); return t.id;
}, zoom);
const screenOf = (page, id) => page.evaluate(id => { const m = window.SLCT.map.map, p = window.SLCT.map.vehiclePos(id); if (!p) return null; const q = m.project([p.lon, p.lat]); const r = document.getElementById('map').getBoundingClientRect(); return { x: q.x, y: q.y, px: r.left + q.x, py: r.top + q.y, w: m.getContainer().clientWidth, h: m.getContainer().clientHeight, lon: p.lon, lat: p.lat, b: p.bearing }; }, id);
const angle = (a, b) => Math.abs(((b - a + 540) % 360) - 180);
// wachten tot de tegels er zijn en de namen geplaatst (onder belasting duurt dat langer), dan nog even voor het infaden
const settle = async page => { await page.waitForFunction(() => { const m = window.SLCT.map.map, st = m.style; return m.areTilesLoaded() && !m.isMoving() && !!st && (!st.pauseablePlacement || st.pauseablePlacement.isDone()) && !(st.placement && st.placement.hasTransitions(performance.now())); }, null, { timeout: 15000, polling: 200 }).catch(() => {}); await page.waitForTimeout(1200); };

// ======================================================================================================================
// 1. Losse versie zonder bereik: terugval, interpolatie, aanwijzen, klikken, volgen (2D en 3D), vliegen
{
  const { page, ctx, errors, ext } = await open();
  const d0 = await page.evaluate(() => ({ ...window.SLCT.map.debug(), land: window.SLCT.map.map.getLayoutProperty('land', 'visibility'), mw: window.SLCT.map.map.getLayoutProperty('mw', 'visibility'), pl: window.SLCT.map.map.getLayoutProperty('pl-1', 'visibility'), notice: (window.__notices || []).join(' | ') }));
  // sinds 4.0 is zonder keuze de ingebouwde kaart de standaard: de losse versie vraagt niets van buiten tot de kijker zelf
  // een online laag kiest (acceptatie-eis E); de terugval van een gekozen online laag toetsen de secties hieronder
  check(!d0.online && d0.base === 'kaart' && !d0.onlineFailed && ![...ext].some(h => /openfreemap|pdok|cartocdn/.test(h)) && d0.land !== 'none' && d0.mw !== 'none' && d0.pl !== 'none', `zonder keuze de ingebouwde kaart: geen verzoek naar buiten (${[...ext].filter(h => /openfreemap|pdok|cartocdn/.test(h)).join(', ') || 'geen'}), ingebouwde kaart zichtbaar`);
  check(!/niet bereikbaar/.test(d0.notice), `terugval zonder melding als niemand de online kaart koos (${d0.notice || 'geen melding'})`);
  check(d0.vehicles > 1000 && d0.drawn >= d0.vehicles && !d0.fallback, `voertuiglaag (WebGL): ${d0.drawn} iconen voor ${d0.vehicles} voertuigen`);

  // --- interpolatie. SwiftShader tekent hier maar een paar beelden per seconde, dus: een klein venster en stappen van
  // 2 s (12 s simulatie per stap). Gemeten wordt (a) de getoonde stand op vaste momenten (elke 60 ms) tussen twee stappen
  // en (b) per getekend beeld: elk beeld een nieuwe stand en een nieuwe vulling van de voertuiglaag.
  await page.setViewportSize({ width: 560, height: 420 }); await page.waitForTimeout(600);
  await manual(page); const id = await pickMover(page, 12.5); await page.waitForTimeout(800);
  for (let i = 0; i < 4; i++) { await step(page, 0.2); await page.waitForTimeout(2000); }
  const ip = await page.evaluate(async id => {
    const S = window.SLCT; const b0 = S.map.debug().builds; const timed = [], frames = []; const t0 = performance.now();
    S.state.simTime += 0.2; S.__frame();
    // het doel: de nieuwe stap, op de rijbaan van het voertuig (rechts rijden: de kaart verschuift een rijdend voertuig)
    const p0 = S.map.vehiclePos(id), target = { lon: p0.tlon, lat: p0.tlat };
    const timer = setInterval(() => { const p = S.map.vehiclePos(id); timed.push([p.lon, p.lat]); }, 60);
    await new Promise(res => { const tick = () => { const p = S.map.vehiclePos(id); frames.push([p.lon, p.lat]); if (performance.now() - t0 < 2300) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    clearInterval(timer);
    const key = p => p[0].toFixed(7) + ',' + p[1].toFixed(7); const dist = p => Math.hypot(p[0] - target.lon, p[1] - target.lat);
    const moving = frames.filter(p => dist(p) > 1e-9);
    return { timed: new Set(timed.map(key)).size, nTimed: timed.length, frames: frames.length, framesMoving: moving.length, framesDistinct: new Set(moving.map(key)).size, builds: S.map.debug().builds - b0, heavy: S.map.debug().heavy, end: dist(frames[frames.length - 1]), interval: S.map.debug().interval, mono: timed.every((p, i) => i === 0 || dist(p) <= dist(timed[i - 1]) + 1e-9) };
  }, id);
  check(ip.timed >= 10 && ip.end < 1e-7 && ip.mono, `interpolatie ${id}: ${ip.timed} verschillende standen tussen twee stappen (${ip.nTimed} metingen, stapduur ${ip.interval} ms), steeds dichter bij het doel, eindigt precies op de stap`);
  // elk beeld een nieuwe stand; de voertuiglaag elk beeld opnieuw gevuld, behalve met het plafond van 30 beelden per
  // seconde als het zwaar wordt (debug().heavy): dan hoogstens om het andere beeld
  const minBuilds = ip.heavy ? Math.floor(ip.framesMoving / 2) - 1 : ip.framesMoving - 1;
  check(ip.framesMoving >= 2 && ip.framesDistinct === ip.framesMoving && ip.builds >= minBuilds, `per getekend beeld een nieuwe stand: ${ip.framesDistinct} van ${ip.framesMoving} beelden onderweg (van ${ip.frames}), voertuiglaag ${ip.builds} keer gevuld${ip.heavy ? ' (zwaar: plafond van 30 beelden per seconde)' : ''}`);
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(600);
  await page.evaluate(id => { const S = window.SLCT; const p = S.map.vehiclePos(id); S.map.map.jumpTo({ center: [p.lon, p.lat], zoom: 12.5 }); }, id); await page.waitForTimeout(900);

  // --- aanwijzen: handcursor, halo onder het voertuig, de tip van ui.js
  const sp = await screenOf(page, id);
  await page.mouse.move(sp.px - 40, sp.py - 40); await page.mouse.move(sp.px, sp.py, { steps: 5 }); await page.waitForTimeout(500);
  const hv = await page.evaluate(() => ({ cursor: window.SLCT.map.map.getCanvas().style.cursor, d: window.SLCT.map.debug(), tip: getComputedStyle(document.getElementById('tip')).display }));
  check(hv.cursor === 'pointer' && hv.d.hover === id && hv.d.drawn === hv.d.vehicles + 1 && hv.tip === 'block', `aanwijzen: cursor ${hv.cursor}, halo onder ${hv.d.hover} (${hv.d.drawn - hv.d.vehicles} extra icoon), tip ${hv.tip}`);
  await page.mouse.move(sp.px + 200, sp.py + 160, { steps: 3 }); await page.waitForTimeout(400);
  const hv2 = await page.evaluate(() => ({ cursor: window.SLCT.map.map.getCanvas().style.cursor, d: window.SLCT.map.debug(), tip: getComputedStyle(document.getElementById('tip')).display }));
  check(!hv2.d.hover && hv2.cursor !== 'pointer' && hv2.tip === 'none', `weg van het voertuig: geen halo, gewone cursor, tip weg`);

  // --- klikken: geselecteerd met een ring; de kaart blijft staan (het voertuig is al in beeld)
  const c0 = await page.evaluate(() => { const c = window.SLCT.map.map.getCenter(); return [c.lng, c.lat, window.SLCT.map.map.getZoom()]; });
  await page.mouse.move(sp.px, sp.py, { steps: 3 }); await page.mouse.click(sp.px, sp.py); await page.waitForTimeout(1300);
  const cl = await page.evaluate(() => { const c = window.SLCT.map.map.getCenter(); return { sel: window.SLCT.ui.ctx.selTruck() && window.SLCT.ui.ctx.selTruck().id, d: window.SLCT.map.debug(), c: [c.lng, c.lat, window.SLCT.map.map.getZoom()] }; });
  check(cl.sel === id && cl.d.sel === id && cl.d.drawn >= cl.d.vehicles + 1, `klik: ${cl.sel} geselecteerd, ring om het voertuig`);
  check(Math.abs(cl.c[0] - c0[0]) < 1e-6 && Math.abs(cl.c[1] - c0[1]) < 1e-6 && Math.abs(cl.c[2] - c0[2]) < 1e-6, 'het voertuig was al in beeld: de kaart vliegt niet');

  // --- volgen in 2D: de camera schuift per beeld mee, zonder draaien. Gemeten bij elke camerabeweging (elk getekend
  // beeld); tussen twee beelden rijdt het voertuig verder, en op een overbelaste machine zitten die ver uit elkaar.
  await auto(page); await page.evaluate(() => document.getElementById('app').focus());
  await page.keyboard.press('f'); await page.waitForTimeout(3200);
  const f2 = await page.evaluate(async id => {
    const S = window.SLCT, m = S.map.map, rec = []; const p0 = S.map.vehiclePos(id);
    const on = () => { const q = S.map.vehiclePos(id); if (!q) return; const s = m.project([q.lon, q.lat]), c = m.getContainer(); rec.push({ d: Math.hypot(s.x - c.clientWidth / 2, s.y - c.clientHeight / 2), b: m.getBearing() }); };
    // 2,2 s meten; tekent de machine zo traag dat er minder dan drie beelden vallen, dan langer (tot 8 s)
    m.on('move', on); const t0 = performance.now(); while (performance.now() - t0 < 2200 || (rec.length < 3 && performance.now() - t0 < 8000)) await new Promise(r => setTimeout(r, 100)); m.off('move', on);
    const p1 = S.map.vehiclePos(id);
    return { n: rec.length, off: rec.length ? Math.max(...rec.map(x => x.d)) : null, rot: rec.some(x => Math.abs(x.b) > 0.01), moved: Math.hypot((p1.lon - p0.lon) * 68000, (p1.lat - p0.lat) * 111000), fl: S.map.following() };
  }, id);
  check(f2.fl === id && f2.n >= 2 && f2.off < 3 && !f2.rot && f2.moved > 20, `volgen 2D: camera op ${f2.fl} terwijl die ${f2.moved.toFixed(0)} m reed, bij ${f2.n} beelden hoogstens ${f2.off == null ? '-' : f2.off.toFixed(1)} px naast het midden, kaart draait niet`);
  // ui.js volgt door elke ~900 ms een camera-opdracht te geven; zonder nieuwe opdracht stopt het volgen na 1,6 s (op een
  // overbelaste machine, waar de opdrachten later komen, na hoogstens 1,7 keer de gemeten tussentijd)
  await page.keyboard.press('f'); const tOff = Date.now(); let still = true;
  while (still && Date.now() - tOff < 7000) { await page.waitForTimeout(250); still = !!(await page.evaluate(() => window.SLCT.map.following())); }
  check(!still, `volgen uit: de camera staat weer stil (na ${((Date.now() - tOff) / 1000).toFixed(1)} s)`);

  // --- volgen in 3D: schuin achter het voertuig, de kaart draait langzaam mee met de koers. Gemeten bij een voertuig op
  // een rechte weg (koers de komende tweeënhalve simulatieminuut binnen 15 graden): in een bocht ijlt de camera bewust na
  // (hoogstens 60 graden per seconde), en dan hangt de uitkomst af van de bocht op het moment van meten.
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(true)); await page.waitForTimeout(2600);
  const id3 = await page.evaluate(id => {
    const S = window.SLCT, f = S.fleet, T = S.state.simTime, ang = (a, b) => Math.abs(((b - a + 540) % 360) - 180);
    const straight = t => { const a = f.stateAt(t, T); if (a.st !== 'onderweg') return false; for (let k = 1; k <= 10; k++) { const b = f.stateAt(t, T + k * 0.25); if (b.st !== 'onderweg' || b.seg !== a.seg || ang(a.pos.bearing, b.pos.bearing) > 15) return false; } return true; };
    const t = f.trucks.find(straight); return t ? t.id : id;
  }, id);
  await page.evaluate(id => window.SLCT.ui.selectTruck(id), id3); await page.waitForTimeout(400);
  // de draaisnelheid in de pagina meten met de klok van de volgcamera zelf: alleen de sprongen van de cameralus tellen
  // (followJump geeft tijdens zo'n sprong de tijd van die lus, en anders null), de richting en waar het voertuig op het
  // scherm staat. Een beeld van een easeTo ertussen (bij het kiezen van het voertuig) telt niet mee: dat gaf onder
  // belasting een sprong van de lus gedeeld door een paar milliseconden, en zo 200 tot 1175 graden per seconde
  await page.evaluate(id => {
    const S = window.SLCT, m = S.map.map; window.__rot = [];
    window.__onMove = () => { const tj = S.map.followJump && S.map.followJump(); if (tj == null) return; const q = S.map.vehiclePos(id), s = q && m.project([q.lon, q.lat]), c = m.getContainer(); window.__rot.push([tj, m.getBearing(), s ? s.x - c.clientWidth / 2 : 0, s ? s.y - c.clientHeight / 2 : 0]); };
    m.on('move', window.__onMove);
  }, id3);
  await page.evaluate(() => document.getElementById('app').focus()); await page.keyboard.press('f');
  const bs = []; const t3 = Date.now(); for (let i = 0; i < 14; i++) { await page.waitForTimeout(450); bs.push(await page.evaluate(id => ({ t: performance.now(), b: window.SLCT.map.map.getBearing(), p: window.SLCT.map.map.getPitch(), v: window.SLCT.map.vehiclePos(id), f: window.SLCT.map.following() }), id3)); }
  const rot = await page.evaluate(() => { window.SLCT.map.map.off('move', window.__onMove); return window.__rot; });
  // per beeld de draaiing gedeeld door de tijd sinds het vorige beeld
  const frames = []; for (const r of rot) { if (frames.length && frames[frames.length - 1][0] === r[0]) frames[frames.length - 1] = r; else frames.push(r); }
  let rate = 0; for (let i = 1; i < frames.length; i++) { const dt = (frames[i][0] - frames[i - 1][0]) / 1000; if (dt > 0) rate = Math.max(rate, angle(frames[i - 1][1], frames[i][1]) / dt); }
  const lastB = bs[bs.length - 1], tail = bs.slice(-4);
  const off3 = Math.max(...tail.map(b => angle(b.b, b.v.bearing)));
  // waar het voertuig staat bij de laatste beelden: midden, onder het midden
  const lastF = frames.slice(-3); const s3 = lastF.length ? { dx: Math.max(...lastF.map(r => Math.abs(r[2]))), dy: Math.min(...lastF.map(r => r[3])) } : null;
  check(lastB.f === id3 && lastB.p >= 55 && off3 < 25, `volgen 3D (${id3}): pitch ${lastB.p.toFixed(0)}, kaartrichting ${lastB.b.toFixed(0)} bij koers ${lastB.v.bearing.toFixed(0)}, de laatste 1,8 s hoogstens ${off3.toFixed(0)} graden ernaast (na ${((Date.now() - t3) / 1000).toFixed(1)} s)`);
  check(frames.length >= 3 && rate <= 62, `draaisnelheid van de camera hoogstens ${rate.toFixed(0)} graden per seconde (grens 60; ${frames.length} beelden)`);
  check(!!s3 && s3.dx < 6 && s3.dy > 0, `3D: het voertuig staat midden onder het midden van het beeld (${s3 ? `${s3.dx.toFixed(1)} px opzij, ${s3.dy.toFixed(0)} px lager` : 'geen beeld'})`);
  await page.keyboard.press('f'); await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(false)); await page.waitForTimeout(1600);

  // --- vliegen naar een voertuig buiten beeld: de kaart vliegt (flyTo) en eindigt erop
  await manual(page);
  const far = await page.evaluate(() => { const S = window.SLCT, m = S.map.map, f = S.fleet, T = S.state.simTime; const c = m.getCenter(); const t = f.trucks.find(t => { const s = f.stateAt(t, T); return s.st === 'onderweg' && Math.hypot(s.pos.lon - c.lng, s.pos.lat - c.lat) > 1; }); return t.id; });
  // de zoom bij elk getekend beeld van de vlucht, in de pagina gemeten
  const vl = await page.evaluate(async id => {
    const S = window.SLCT, m = S.map.map, z0 = m.getZoom(), rec = [], on = () => rec.push([performance.now(), m.getZoom()]);
    m.on('move', on); const t0 = performance.now(); S.ui.selectTruck(id);
    // tot de vlucht klaar is (de camera staat stil), hoogstens 8 s
    await new Promise(res => { const f = () => { const dt = performance.now() - t0; if (dt < 8000 && (dt < 1000 || m.isMoving())) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    m.off('move', on); return { z0, z1: m.getZoom(), rec: rec.map(([t, z]) => [Math.round(t - t0), z]) };
  }, far);
  await page.waitForTimeout(300);
  const fa = await screenOf(page, far);
  // midden in de vlucht ligt de zoom ruim onder begin en eind; tekent een overbelaste machine daar geen enkel beeld, dan
  // valt het uit- en inzoomen niet te zien en telt alleen dat de kaart op het voertuig eindigt
  const mid = vl.rec.filter(([t]) => t > 135 && t < 765), minZ = Math.min(vl.z0, ...vl.rec.map(r => r[1])), dipped = minZ < Math.min(vl.z0, vl.z1) - 0.5;
  // het midden van het vrije deel naast het paneel (de interface 4.0 houdt ruimte vrij voor het paneel: padding)
  const vm = await page.evaluate(() => { const m = window.SLCT.map.map, p = m.getPadding(), c = m.getContainer(); return { x: p.left + (c.clientWidth - p.left - p.right) / 2, y: p.top + (c.clientHeight - p.top - p.bottom) / 2 }; });
  const endOk = !!fa && Math.hypot(fa.x - vm.x, fa.y - vm.y) < 30;
  // met minder dan drie beelden midden in de vlucht (machine overbelast) is het dieptepunt van de boog niet te zien
  check(endOk && (dipped || mid.length < 3), `vliegen naar ${far} (ver weg): ${dipped ? `eerst uit- dan inzoomen (laagste zoom ${minZ.toFixed(1)})` : mid.length >= 3 ? `geen uitzoomen te zien (laagste zoom ${minZ.toFixed(1)})` : 'geen beeld midden in de vlucht (machine overbelast)'}, ${vl.rec.length} beelden, ${endOk ? 'eindigt op het voertuig' : `eindigt ${fa ? Math.round(Math.hypot(fa.x - vm.x, fa.y - vm.y)) + ' px' : 'buiten beeld'} naast het voertuig`}`);
  await auto(page);
  check(errors.length === 0, `consolefouten: ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 5).join('\n     ') : ''}`);
  await ctx.close();
}

// ======================================================================================================================
// 2. Ingebed (data-tiles="off"): geen enkel verzoek naar buiten, ook niet in 3D
{
  const { page, ctx, errors, ext } = await open({ embedded: true, block: false });
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(true)); await page.waitForTimeout(2500);
  await page.evaluate(() => window.SLCT.map.map.jumpTo({ zoom: 14.5 })); await page.waitForTimeout(1500);
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(false)); await page.waitForTimeout(1200);
  const d = await page.evaluate(() => { const m = window.SLCT.map.map; return { tiles: window.SLCT.map.hasTiles(), src: ['ofm', 'luchtfoto', 'brt'].filter(id => m.getSource(id)), keuze: (() => { const b = document.getElementById('layersBtn'); b.click(); const k = !!document.getElementById('baseSeg'); if (document.getElementById('popover') && !document.getElementById('popover').hidden) b.click(); return k; })(), base: window.SLCT.map.base() }; });
  check(!d.tiles && !d.src.length && !d.keuze && d.base === 'kaart' && ext.size === 0, `ingebed: geen online bron, geen keuze voor de basiskaart, externe hosts: ${[...ext].join(', ') || 'geen'}`);
  check(errors.length === 0, `ingebed: consolefouten ${errors.length}`);
  await ctx.close();
}

// ======================================================================================================================
// 2b. Het eerste beeld (tweede eindcontrole, N4): de zee is de achtergrond en het land ligt er als vlakken over. Tot land en
// water getegeld zijn, ligt er een vlak in de kleur van het land over de kaart (.kaart-wacht), dus nooit een beeld met
// alleen zee. Gemeten bij elk getekend beeld vanaf het openen: is de kaart zichtbaar (het vlak weg of aan het wegvagen),
// dan zijn land en water geladen. Direct op #kaart (licht, donker, 390 px, ingebed) en vanaf het Overzicht naar de kaart;
// met minder beweging gaat het vlak in een keer weg (geen overgang). Met een map voor schermafbeeldingen ook een beeld kort
// na het openen en een als het vlak weg is.
{
  const URL0 = url.split('#')[0];
  const gevallen = [['direct, licht', { hash: '#kaart' }], ['direct, donker', { hash: '#kaart', dark: true }], ['direct, 390 px', { hash: '#kaart', w: 390, h: 844 }], ['direct, ingebed', { hash: '#kaart', embedded: true }], ['vanaf het Overzicht', { via: true }], ['vanaf het Overzicht, minder beweging', { via: true, reduced: true }]];
  const res = [];
  for (const [lab, o] of gevallen) {
    const w = o.w || 1440, h = o.h || 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage(); const errors = errorsOf(page);
    // een trage machine nabootsen (ronde 4): de processor vier keer trager, zodat de test het ook op een snelle machine vangt
    try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); } catch { /* geen CDP */ }
    await page.route('**/*', route => { const u = new URL(route.request().url()); return u.host === host ? route.continue() : route.abort('blockedbyclient'); });
    if (o.embedded) await page.route(URL0, async route => { const r0 = await route.fetch(); const body = (await r0.text()).replace('class="app slct"', 'class="app slct" data-tiles="off" data-embedded'); await route.fulfill({ response: r0, body, headers: { ...r0.headers(), 'content-type': 'text/html; charset=utf-8' } }); });
    await page.addInitScript(([d]) => { try { if (!sessionStorage.getItem('eb')) { localStorage.clear(); localStorage.setItem('sl-werkgebied', JSON.stringify({ regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role: 'planner', sp: null })); if (d) localStorage.setItem('sl-theme', 'dark'); sessionStorage.setItem('eb', '1'); } } catch { /* geen opslag */ } }, [!!o.dark]);
    // per getekend beeld: ligt het vlak er nog helemaal over? Zo niet, dan moeten land en water geladen zijn
    await page.addInitScript(() => {
      window.__eb = { beelden: 0, zicht: 0, zonderLand: 0, zonderBeeld: 0, vaagt: false, start: null, weg: null };
      const hang = () => { const S = window.SLCT; if (!S || !S.map || !S.map.map || !S.map.map.on) { setTimeout(hang, 5); return; } const m = S.map.map;
        m.on('render', () => { const E = window.__eb; if (E.start === null) return; const c = m.getContainer(); if (!c.clientWidth) return; E.beelden++; const v = c.querySelector('.kaart-wacht'); if (v && v.classList.contains('weg')) E.vaagt = true; if (v && !v.classList.contains('weg') && +getComputedStyle(v).opacity > 0.99) return; E.zicht++; if (E.weg === null) E.weg = Math.round(performance.now() - E.start); const ok = id => !m.getSource(id) || m.getLayoutProperty(id, 'visibility') === 'none' || m.isSourceLoaded(id); if (!ok('land') || !ok('water')) E.zonderLand++; let land = 0; try { land = m.getLayer('land') ? m.queryRenderedFeatures({ layers: ['land'] }).length : 0; } catch { land = 0; } if (!land) E.zonderBeeld++; }); };
      hang();
    });
    await page.goto(URL0 + (o.hash || ''), { waitUntil: 'load' });
    await page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 120_000, polling: 25 });
    if (o.via) { await page.waitForTimeout(1200); await page.evaluate(() => { window.__eb.start = performance.now(); window.SLCT.ui.ctx.go('view:kaart'); }); }
    else await page.evaluate(() => { window.__eb.start = performance.now(); });
    if (shots && !o.via) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/kaart-openen-${lab.replace(/[^a-z0-9]+/gi, '-')}-direct.png` }); }
    // met de processor vier keer trager en andere tests ernaast kan land en water verwerken meer dan 30 s duren: dan
    // staat het vlak er terecht nog (het net telt alleen terwijl iemand kijkt); tot 70 s wachten
    await page.waitForFunction(() => !document.querySelector('.kaart-wacht'), null, { timeout: 70000, polling: 100 }).catch(() => {});
    await page.waitForTimeout(400);
    const E = await page.evaluate(() => ({ ...window.__eb, vlak: !!document.querySelector('.kaart-wacht') }));
    if (shots) await page.screenshot({ path: `${shots}/kaart-openen-${lab.replace(/[^a-z0-9]+/gi, '-')}-klaar.png` });
    res.push({ lab, ...E, errors: errors.length, reduced: !!o.reduced });
    await ctx.close();
  }
  const fout = res.filter(r => r.zonderLand > 0 || r.zonderBeeld > 0 || r.vlak || r.zicht === 0 || r.errors || (r.reduced && r.vaagt));
  check(!fout.length, `het eerste beeld: nooit alleen zee, met de processor vier keer trager (${res.map(r => `${r.lab}: het vlak weg na ${r.weg} ms, daarna ${r.zicht} beelden, ${r.zonderLand} zonder land of water, ${r.zonderBeeld} zonder land in beeld${r.reduced ? `, ${r.vaagt ? 'met' : 'zonder'} overgang` : ''}`).join('; ')})${fout.length ? `; FOUT bij ${fout.map(r => r.lab).join(', ')}` : ''}`);
}

// ======================================================================================================================
// 3. Minder beweging: geen tussenstanden, de camera springt
{
  const { page, ctx, errors } = await open({ reduced: true });
  await manual(page); const id = await pickMover(page, 12.5); await page.waitForTimeout(600);
  for (let i = 0; i < 3; i++) { await step(page, 0.1); await page.waitForTimeout(700); }
  const r = await page.evaluate(async id => {
    const S = window.SLCT; const pos = []; const t0 = performance.now(); S.state.simTime += 0.1; S.__frame();
    const p0 = S.map.vehiclePos(id), target = { lon: p0.tlon, lat: p0.tlat };
    await new Promise(res => { const tick = () => { const p = S.map.vehiclePos(id); pos.push([p.lon, p.lat]); if (performance.now() - t0 < 700) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    return { distinct: new Set(pos.map(p => p[0].toFixed(7) + ',' + p[1].toFixed(7))).size, first: Math.hypot(pos[0][0] - target.lon, pos[0][1] - target.lat) };
  }, id);
  check(r.distinct === 1 && r.first < 1e-7, `minder beweging: het voertuig springt meteen naar de nieuwe stap (${r.distinct} stand)`);
  const far = await page.evaluate(() => { const S = window.SLCT, m = S.map.map, f = S.fleet, T = S.state.simTime; const c = m.getCenter(); const t = f.trucks.find(t => { const s = f.stateAt(t, T); return s.st === 'onderweg' && Math.hypot(s.pos.lon - c.lng, s.pos.lat - c.lat) > 1; }); return t.id; });
  await page.evaluate(id => window.SLCT.ui.selectTruck(id), far); await page.waitForTimeout(150);
  const j = await screenOf(page, far);
  // sinds de interface 4.0 houdt de kaart ruimte vrij voor het paneel (padding): het midden is dat van het vrije deel
  const pc = await page.evaluate(() => { const m = window.SLCT.map.map, p = m.getPadding(), c = m.getContainer(); return { x: p.left + (c.clientWidth - p.left - p.right) / 2, y: p.top + (c.clientHeight - p.top - p.bottom) / 2 }; });
  check(j && Math.hypot(j.x - pc.x, j.y - pc.y) < 3, `minder beweging: de camera springt naar ${far} (na 150 ms ${j && Math.hypot(j.x - pc.x, j.y - pc.y).toFixed(1)} px van het midden van het vrije deel naast het paneel)`);
  check(errors.length === 0, `minder beweging: consolefouten ${errors.length}`);
  await ctx.close();
}

// ======================================================================================================================
// 4. Online basiskaarten, nagebootst (de bronnen zijn hier niet bereikbaar): OpenFreeMap (TileJSON en een echte
// vectortegel; een lege tegel of een plaatje telt niet als werkend), de luchtfoto en de BRT-achtergrondkaart van PDOK, en
// de terugval naar de ingebouwde kaart: stil als niemand de stand koos, met een melding als iemand hem zelf koos.
const baseState = page => page.evaluate(() => { const S = window.SLCT, m = S.map.map, v = id => (m.getLayer(id) ? m.getLayoutProperty(id, 'visibility') || 'visible' : 'geen'), d = S.map.debug(); return { base: d.base, src: d.src, mw: v('mw'), pl: v('pl-1'), land: v('land'), site: v('site'), siteLine: v('site-line'), sp: v('sp'), oroad: v('o-road'), foto: v('luchtfoto'), brt: v('brt'), attr: (m.getContainer().querySelector('.maplibregl-ctrl-attrib-inner') || {}).textContent || '', notice: (window.__notices || []).join(' | '), keuze: (() => { const b = document.getElementById('layersBtn'), dicht = !document.getElementById('baseSeg'); if (dicht) b.click(); const k = [...document.querySelectorAll('#baseSeg [data-base].on')].map(x => x.dataset.base).join(); if (dicht && document.getElementById('baseSeg')) b.click(); return k; })() }; });
// sinds de interface 4.0 staat de keuze in het menu Kaartlagen, een popover die pas bij het openen ontstaat: openen,
// kiezen, sluiten (zoals een kijker het doet)
const pickBase = (page, k) => page.evaluate(k => { const b = document.getElementById('layersBtn'); if (!document.getElementById('baseSeg')) b.click(); document.querySelector(`#baseSeg [data-base="${k}"]`).click(); if (document.getElementById('baseSeg')) b.click(); }, k);
// wachten tot een bron beslist is: hij werkt (bij de luchtfoto eventueel pas op de tweede laag, tier) of de kaart is
// terug op ingebouwd; onder belasting duurt de eerste tegel langer dan de vaste wachttijd
const decided = (page, k, tier = 0) => page.waitForFunction(([k, tier]) => { const s = window.SLCT.map.debug().src[k]; return !!s && (s.failed || (s.ok && (s.tier || 0) >= tier)); }, [k, tier], { timeout: 20000, polling: 200 }).catch(() => {});
const toSp = (page, z, name = 'Wognum') => page.evaluate(([z, name]) => { const sp = window.SLCT.fleet.trucks.find(t => t.base.n === name).base; window.SLCT.map.map.jumpTo({ center: [sp.lon, sp.lat], zoom: z, pitch: 0, bearing: 0 }); }, [z, name]);
{
  const { page, ctx, errors, ext } = await open({ ofm: 'ok', base: 'online' }); // de kijker koos eerder OpenStreetMap
  await toSp(page, 14); await page.waitForTimeout(2500); await decided(page, 'online');
  const o = await baseState(page);
  check(o.base === 'online' && o.src.online.ok && o.oroad === 'visible' && o.mw === 'none' && o.pl === 'none' && o.land === 'none' && o.site === 'visible' && o.sp === 'visible', 'online (OpenFreeMap): de vectortegel klopt; eigen land, wegen en namen uit, eigen terreinen en standplaatsen blijven');
  const rf = await page.evaluate(() => [...new Set(window.SLCT.map.map.queryRenderedFeatures().map(f => f.layer.id).filter(id => /^o-/.test(id)))]);
  check(['o-water', 'o-road', 'o-building'].every(id => rf.includes(id)), `online: de eigen stijl tekent de tegel (${rf.join(', ')})`);
  check(/OpenStreetMap-bijdragers · OpenFreeMap/.test(o.attr) && !/CARTO/i.test(o.attr), `online: bronvermelding "${o.attr}"`);
  check([...ext].every(h => h === 'tiles.openfreemap.org'), `online: alleen OpenFreeMap gevraagd (${[...ext].join(', ')})`);
  // donker: dezelfde stijl in de donkere kleuren van de ingebouwde kaart
  await page.click('#themeBtn'); await page.waitForTimeout(900);
  const dk = await page.evaluate(() => { const m = window.SLCT.map.map; return { bg: m.getPaintProperty('o-bg', 'background-color'), water: m.getPaintProperty('o-water', 'fill-color') }; });
  check(/1B1F24/i.test(String(dk.bg)) && /14273B/i.test(String(dk.water)), `online donker: de stijl kleurt mee (land ${dk.bg}, water ${dk.water})`);
  await page.click('#themeBtn'); await page.waitForTimeout(600);
  // 3D: de gebouwen uit dezelfde tegels als blokken; terug in 2D weg
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(true)); await page.waitForTimeout(3000);
  const t = await page.evaluate(() => { const m = window.SLCT.map.map; return m.getLayer('ofm-3d') ? m.getLayoutProperty('ofm-3d', 'visibility') : 'geen'; });
  check(t === 'visible', `online 3D: gebouwen van OpenFreeMap als blokken (${t})`);
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(false)); await page.waitForTimeout(1500);
  const t2 = await page.evaluate(() => { const m = window.SLCT.map.map; return m.getLayer('ofm-3d') ? m.getLayoutProperty('ofm-3d', 'visibility') : 'geen'; });
  check(t2 === 'none', `terug naar 2D: gebouwen van OpenFreeMap uit (${t2})`);
  check(errors.length === 0, `online (OpenFreeMap): consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}
for (const ofm of ['leeg', 'png', 'fout']) {
  const { page, ctx, errors } = await open({ ofm, base: 'online' }); // een eerder gekozen online laag die nu niet werkt: stil terug
  await toSp(page, 12); await page.waitForTimeout(3000); await decided(page, 'online');
  const o = await baseState(page);
  check(o.base === 'kaart' && o.src.online.failed && o.mw === 'visible' && o.land === 'visible' && o.pl === 'visible' && !/niet bereikbaar/.test(o.notice) && /Natural Earth/.test(o.attr), `online ${ofm === 'leeg' ? 'met lege tegels' : ofm === 'png' ? 'met een plaatje als tegel (zoals een watermerk)' : 'onbereikbaar'}: telt niet als werkend, stil terug naar de ingebouwde kaart`);
  check(errors.length === 0, `online ${ofm}: consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}
{
  const { page, ctx } = await open({ base: 'kaart', ofm: 'fout' });
  await pickBase(page, 'online'); await page.waitForTimeout(2500); await decided(page, 'online');
  const o = await baseState(page);
  check(o.base === 'kaart' && /niet bereikbaar/.test(o.notice) && o.keuze === 'kaart', `online zelf gekozen en onbereikbaar: melding "${o.notice}", de keuze terug op ingebouwd`);
  await ctx.close();
}
{
  // luchtfoto: onder de eigen wegen (dun en halfdoorzichtig), het terrein als rand, de voertuigen op ware grootte
  const { page, ctx, errors, ext } = await open({ base: 'kaart', pdok: 'ok' });
  await pickBase(page, 'luchtfoto'); await toSp(page, 17); await page.waitForTimeout(3000); await decided(page, 'luchtfoto');
  const o = await baseState(page);
  const st = await page.evaluate(() => { const m = window.SLCT.map.map; return { op: m.getPaintProperty('mw', 'line-opacity'), halo: m.getPaintProperty('pl-1', 'text-halo-color') }; });
  const okFoto = o.base === 'luchtfoto' && o.src.luchtfoto.ok && o.foto === 'visible' && o.site === 'none' && o.siteLine === 'visible' && o.mw === 'visible' && st.op < 1;
  check(okFoto, `luchtfoto: de foto onder de eigen wegen (dun, ${st.op} dekkend), het terrein als rand, namen met een lichte halo (${st.halo})${okFoto ? '' : ` (${o.base}, ${JSON.stringify(o.src.luchtfoto)}, foto ${o.foto}, terrein ${o.site}, rand ${o.siteLine}, wegen ${o.mw})`}`);
  check(/Luchtfoto: Kadaster, PDOK, CC BY 4\.0/.test(o.attr), `luchtfoto: bronvermelding "${o.attr}"`);
  check([...ext].every(h => h === 'service.pdok.nl'), `luchtfoto: alleen PDOK gevraagd (${[...ext].join(', ')})`);
  // ware grootte: een rijdende trekker met oplegger op zoom 16 is 16,5 m lang (zonder luchtfoto: het grotere icoon)
  await manual(page);
  const tg = await page.evaluate(() => { const S = window.SLCT, f = S.fleet, T = S.state.simTime; const t = f.trucks.find(t => { const s = f.stateAt(t, T); return s.st === 'onderweg' && t.kind === 'trekker' && s.tr; }); const s = f.stateAt(t, T); S.map.map.jumpTo({ center: [s.pos.lon, s.pos.lat], zoom: 16 }); S.__frame(true); return t.id; });
  await page.waitForTimeout(800);
  const sz = await page.evaluate(id => { const S = window.SLCT, m = S.map.map, a = S.map.anchor(id), mpp = 40075016.686 * Math.cos(m.getCenter().lat * Math.PI / 180) / (512 * Math.pow(2, m.getZoom())); return { r: a && a.r, half: 16.5 / mpp / 2 }; }, tg);
  check(sz.r && Math.abs(sz.r - sz.half) < 1.5, `luchtfoto: ${tg} op ware grootte (halve lengte ${sz.r && sz.r.toFixed(1)} px, 16,5 m is ${sz.half.toFixed(1)} px op zoom 16)`);
  await auto(page);
  if (shots) { mkdirSync(shots, { recursive: true }); await toSp(page, 17); await settle(page); await page.screenshot({ path: `${shots}/luchtfoto-nagebootst-z17.png` }); }
  await pickBase(page, 'kaart'); await page.waitForTimeout(900);
  const b = await baseState(page); const op = await page.evaluate(() => window.SLCT.map.map.getPaintProperty('mw', 'line-opacity'));
  check(b.base === 'kaart' && b.site === 'visible' && b.foto === 'none' && (op === undefined || op === 1) && /Natural Earth/.test(b.attr), 'terug naar ingebouwd: wegen, terrein en bronvermelding weer gewoon');
  check(errors.length === 0, `luchtfoto: consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}
for (const pdok of ['hr-fout', 'fout']) {
  const { page, ctx } = await open({ base: 'kaart', pdok });
  await pickBase(page, 'luchtfoto'); await toSp(page, 15); await page.waitForTimeout(3500); await decided(page, 'luchtfoto', pdok === 'hr-fout' ? 1 : 0);
  const o = await baseState(page);
  if (pdok === 'hr-fout') check(o.base === 'luchtfoto' && o.src.luchtfoto.tier === 1 && o.src.luchtfoto.ok && !/niet bereikbaar/.test(o.notice), `luchtfoto: de foto van 8 cm onbereikbaar, dan die van 25 cm (Actueel_ortho25)${o.base === 'luchtfoto' && o.src.luchtfoto.ok && !/niet bereikbaar/.test(o.notice) ? '' : ` (${o.base}, ${JSON.stringify(o.src.luchtfoto)}, "${o.notice}")`}`);
  else check(o.base === 'kaart' && o.src.luchtfoto.failed && o.mw === 'visible' && /luchtfoto is niet bereikbaar/i.test(o.notice) && o.keuze === 'kaart', `luchtfoto onbereikbaar: terug naar ingebouwd, melding "${o.notice}"${o.base === 'kaart' && o.src.luchtfoto.failed ? '' : ` (${o.base}, ${JSON.stringify(o.src.luchtfoto)})`}`);
  await ctx.close();
}
{
  // BRT-achtergrondkaart: de officiële kaart, eigen wegen en namen uit, terreinen en standplaatsen erbovenop
  const { page, ctx, ext } = await open({ base: 'brt', pdok: 'ok' });
  await toSp(page, 15); await page.waitForTimeout(3000); await decided(page, 'brt');
  const o = await baseState(page);
  check(o.base === 'brt' && o.src.brt.ok && o.brt === 'visible' && o.mw === 'none' && o.pl === 'none' && o.site === 'visible' && o.sp === 'visible' && /Kaart: Kadaster, PDOK, CC BY 4\.0/.test(o.attr), `BRT: zichtbaar, eigen wegen en namen uit, terreinen erboven, bronvermelding "${o.attr}"`);
  await page.click('#themeBtn'); await page.waitForTimeout(1500);
  check([...ext].length === 1 && ext.has('service.pdok.nl'), `BRT: alleen PDOK gevraagd (${[...ext].join(', ')})`);
  await ctx.close();
}
// De demosite (data-basiskaart="online" op #app, dist/demosite.html): zonder eigen keuze opent hij met OpenStreetMap en
// bewaart hij niets; een eigen keuze gaat voor; een onbereikbare online kaart valt stil terug; ingebed blijft het altijd
// de ingebouwde kaart, zonder een enkel verzoek naar buiten.
const bewaard = page => page.evaluate(() => { try { return localStorage.getItem('sl-kaartlaag'); } catch { return 'geen opslag'; } });
{
  const { page, ctx, errors, ext } = await open({ ofm: 'ok', attrs: 'data-basiskaart="online"' });
  await toSp(page, 13); await page.waitForTimeout(2500); await decided(page, 'online');
  const o = await baseState(page); const k = await bewaard(page);
  check(o.base === 'online' && o.src.online.ok && o.oroad === 'visible' && o.keuze === 'online' && ext.size === 1 && ext.has('tiles.openfreemap.org') && !/niet bereikbaar/.test(o.notice), `demosite zonder eigen keuze: opent met OpenStreetMap, de keuze staat zo in Kaartlagen (${o.base}, ${[...ext].join(', ') || 'geen verzoek'})`);
  check(k === null, `demosite: de standaard wordt niet bewaard, alleen een eigen keuze (sl-kaartlaag ${k})`);
  check(errors.length === 0, `demosite: consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}
{
  const { page, ctx, errors } = await open({ ofm: 'fout', attrs: 'data-basiskaart="online"' });
  await toSp(page, 12); await page.waitForTimeout(3000); await decided(page, 'online');
  const o = await baseState(page);
  check(o.base === 'kaart' && o.src.online.failed && o.mw === 'visible' && o.keuze === 'kaart' && !/niet bereikbaar/.test(o.notice), `demosite zonder bereik: stil terug naar de ingebouwde kaart, zonder melding (${o.base}${o.notice ? `, melding "${o.notice}"` : ''})`);
  check(errors.length === 0, `demosite zonder bereik: consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}
{
  const { page, ctx, ext } = await open({ ofm: 'ok', base: 'kaart', attrs: 'data-basiskaart="online"' });
  await toSp(page, 12); await page.waitForTimeout(2000);
  const o = await baseState(page);
  check(o.base === 'kaart' && ![...ext].some(h => /openfreemap|pdok/.test(h)), `demosite met een eigen keuze (ingebouwd): die gaat voor, niets van buiten (${o.base}, ${[...ext].join(', ') || 'geen verzoek'})`);
  await ctx.close();
}
{
  const { page, ctx, ext } = await open({ ofm: 'ok', embedded: true, attrs: 'data-basiskaart="online"' });
  await toSp(page, 12); await page.waitForTimeout(2000);
  const o = await baseState(page);
  check(o.base === 'kaart' && ext.size === 0, `ingebed met data-basiskaart="online": toch de ingebouwde kaart, geen verzoek naar buiten (${o.base}, ${[...ext].join(', ') || 'geen verzoek'})`);
  await ctx.close();
}

// ======================================================================================================================
// 5. Spoor van de gekozen rit, flyTo met markering, gebeurtenissen langs een rit, anker voor een hoverkaartje
{
  const { page, ctx, errors } = await open({ w: 1280, h: 800 });
  const id = await pickMover(page, 12);
  await page.evaluate(id => window.SLCT.ui.selectTruck(id), id); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const m = window.SLCT.map.map; const f = m.getSource('route').serialize().data.features || []; return { layers: ['route-casing', 'route-done', 'route-trail', 'route-todo'].every(l => !!m.getLayer(l)), n: f.length, todo: JSON.stringify(m.getPaintProperty('route-todo', 'line-gradient')), trail: JSON.stringify(m.getPaintProperty('route-trail', 'line-gradient')) }; });
  check(r.layers && r.n === 1, `spoor: vier lagen op één lijn (${r.n} lijn)`);
  check(/^\["step"/.test(r.todo) && /#1A73E8/.test(r.todo), 'spoor: het komende stuk blauw, met een scherpe overgang bij het voertuig');
  // het spoor: een verloop dat langs de rit oploopt tot 0,95 bij het voertuig en daarna meteen weer weg is (begon de rit
  // minder dan 20 minuten geleden, dan begint het spoor aan het begin van de rit al iets zichtbaar)
  const tr = JSON.parse(r.trail), alphas = []; for (let i = 3; i < tr.length; i += 2) alphas.push(+(String(tr[i + 1]).match(/,\s*([\d.]+)\)$/) || [0, -1])[1]);
  const top = alphas.indexOf(0.95), rise = alphas.slice(0, top + 1), after = alphas.slice(top + 1);
  check(tr[0] === 'interpolate' && top >= 1 && Math.min(...rise) < 0.95 && rise.every((a, i) => i === 0 || a >= rise[i - 1] - 1e-9) && after.every(a => a === 0), `spoor: de laatste 20 minuten vervagend, oplopend tot bijna dekkend bij het voertuig en daar afgelopen (${alphas.join(' → ')})`);
  await page.waitForTimeout(1500);
  const g2 = await page.evaluate(() => JSON.stringify(window.SLCT.map.map.getPaintProperty('route-todo', 'line-gradient')));
  check(g2 !== r.todo, 'spoor: de overgang schuift mee met het voertuig');
  const f1 = await page.evaluate(async () => {
    const S = window.SLCT, M = S.map, m = M.map, sp = S.fleet.trucks.find(t => t.base.n === 'Wognum').base; const o = { none: M.flyTo('bestaat-niet') };
    const t0 = performance.now(); o.sp = M.flyTo('Wognum'); o.mark = M.debug().mark; let last = t0; o.gap = 0;
    await new Promise(res => { const f = () => { const now = performance.now(); o.gap = Math.max(o.gap, now - last); last = now; if (m.isMoving() && now - t0 < 6000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    o.ms = performance.now() - t0; const c = m.getCenter(); o.z = m.getZoom(); o.d = Math.hypot(c.lng - sp.lon, c.lat - sp.lat);
    let last2 = performance.now(); o.gap2 = 0;
    await new Promise(res => { const f = () => { const now = performance.now(); o.gap2 = Math.max(o.gap2, now - last2); last2 = now; if (M.debug().mark && now - t0 < 12000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    o.markMs = performance.now() - t0; return o;
  });
  check(f1.none === false && f1.sp === true && f1.mark === true, 'flyTo: een onbekend doel geeft false, een standplaats true en een markering');
  // de animatie loopt op de klok: klaar bij het eerste beeld na 800 ms (onder belasting komt dat beeld later)
  check(Math.abs(f1.z - 15) < 0.05 && f1.d < 1e-4 && f1.ms < 800 + f1.gap + 150, `flyTo: op de standplaats, zoom 15, na ${Math.round(f1.ms)} ms (800 ms gevraagd; langste beeld ${Math.round(f1.gap)} ms)`);
  // de markering begint op 70 procent van de vlucht en duurt 1,9 s: weg na zo'n 2,5 s, plus het langste beeld onder belasting
  check(f1.markMs > 1500 && f1.markMs < 2460 + Math.max(f1.gap, f1.gap2) + 400, `flyTo: de markering is na ${(f1.markMs / 1000).toFixed(1)} s weer weg (langste beeld ${Math.round(Math.max(f1.gap, f1.gap2))} ms)`);
  const f3 = await page.evaluate(id => {
    const S = window.SLCT, M = S.map, T = S.state.simTime, at = q => { const c = M.map.getCenter(); return !!q && Math.hypot(c.lng - q.lon, c.lat - q.lat) < 0.01; };
    const o = { truck: M.flyTo(id, { duration: 0 }) && at(M.vehiclePos(id)) };
    const coupled = S.fleet.trailers.find(tr => { const s = S.fleet.trailerStateAt(tr, T); return s.st === 'gekoppeld' && s.vehicle && M.vehiclePos(s.vehicle.id); });
    o.coupled = coupled ? M.flyTo(coupled.id, { duration: 0 }) && at(M.vehiclePos(S.fleet.trailerStateAt(coupled, T).vehicle.id)) : 'geen';
    o.point = M.flyTo([5.1, 52.1], { zoom: 9, duration: 0 }) && Math.abs(M.map.getZoom() - 9) < 0.01;
    return o;
  }, id);
  check(f3.truck === true && f3.coupled !== false && f3.point === true, `flyTo: voertuig, gekoppelde oplegger (via het voertuig) en punt met zoom (${JSON.stringify(f3)})`);
  const dur = await page.evaluate(async () => {
    const M = window.SLCT.map; M.map.jumpTo({ center: [6.5, 53.2], zoom: 12 }); const t0 = performance.now(); let last = t0, gap = 0; M.flyTo([4.4, 51.9], { zoom: 12 });
    await new Promise(res => { const f = () => { const now = performance.now(); gap = Math.max(gap, now - last); last = now; if (M.map.isMoving()) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { ms: performance.now() - t0, gap };
  });
  check(dur.ms > 500 && dur.ms < 900 + dur.gap + 150, `flyTo: van Groningen naar Rotterdam in ${Math.round(dur.ms)} ms (900 ms gevraagd; langste beeld ${Math.round(dur.gap)} ms)`);
  const ev = await page.evaluate(() => { const M = window.SLCT.map; M.setEvents([{ k: 'vertrek', t: 365, lon: 5.05, lat: 52.7 }, { k: 'lossen-start', t: 512.4, pos: { lon: 4.9, lat: 52.4 } }, { kind: 'wachten', plek: [4.8, 52.3], label: 'Wachten bij DC' }, { k: 'zonder plek' }]); const f = M.map.getSource('events').serialize().data.features.map(x => x.properties.label); M.setEvents([]); return f; });
  check(JSON.stringify(ev) === JSON.stringify(['Vertrek 06:05', 'Lossen 08:32', 'Wachten bij DC']), `setEvents: ${JSON.stringify(ev)}`);
  const an = await page.evaluate(id => { const M = window.SLCT.map, p = M.vehiclePos(id); M.map.jumpTo({ center: [p.lon, p.lat], zoom: 13 }); const a = M.anchor(id); if (!a) return null; const b = a.getBoundingClientRect(), box = M.map.getContainer().getBoundingClientRect(); return { dx: Math.round(b.left + b.width / 2 - (box.left + box.width / 2)), dy: Math.round(b.top + b.height / 2 - (box.top + box.height / 2)), w: Math.round(b.width) }; }, id);
  check(!!an && Math.abs(an.dx) < 30 && Math.abs(an.dy) < 30 && an.w > 8, `anchor: een rechthoek om het voertuig, voor een hoverkaartje (${an && JSON.stringify(an)})`);
  // docks: een voertuig springt naar een dock (de simulatie rijdt daar niet; een rechte lijn kan door de hal gaan)
  await manual(page);
  const dk = await page.evaluate(async () => {
    const S = window.SLCT, f = S.fleet, T = S.state.simTime; let pick = null;
    for (let dt = 0.5; dt <= 15 && !pick; dt += 0.5) for (const t of f.trucks) { const a = f.stateAt(t, T + dt - 0.5), b = f.stateAt(t, T + dt); if (!a.dock && b.dock && Math.hypot((a.pos.lon - b.pos.lon) * 68000, (a.pos.lat - b.pos.lat) * 111000) > 20) { pick = { t, dt }; break; } }
    if (!pick) return null;
    S.state.simTime = T + pick.dt - 0.5; S.__frame(true); await new Promise(r => setTimeout(r, 1200));
    S.state.simTime = T + pick.dt; S.__frame(); const target = f.stateAt(pick.t, S.state.simTime).pos; const seen = [];
    await new Promise(res => { let n = 0; const g = () => { const q = S.map.vehiclePos(pick.t.id); seen.push(Math.hypot((q.lon - target.lon) * 68000, (q.lat - target.lat) * 111000)); if (++n < 8) requestAnimationFrame(g); else res(); }; requestAnimationFrame(g); });
    return { id: pick.t.id, base: pick.t.base.n, dock: f.stateAt(pick.t, S.state.simTime).dock, max: Math.max(...seen) };
  });
  await auto(page);
  check(!!dk && dk.max < 0.5, dk ? `dock: ${dk.id} staat meteen aan dock ${dk.dock} in ${dk.base}, zonder tussenstanden (hoogstens ${dk.max.toFixed(1)} m ernaast)` : 'dock: geen voertuig dat binnen 15 minuten aan een dock komt');
  // de deuren op de gevel van de hal (Wognum, zoom 18)
  await page.evaluate(() => { const S = window.SLCT; const sp = S.fleet.trucks.find(t => t.base.n === 'Wognum').base; const d = sp.dockPlek[Math.floor(sp.dockPlek.length / 2)]; S.map.map.jumpTo({ center: [d[0], d[1]], zoom: 18, pitch: 0, bearing: 0 }); });
  await page.waitForFunction(() => window.SLCT.map.map.queryRenderedFeatures({ layers: ['dock-door'] }).length > 0, null, { timeout: 15000, polling: 250 }).catch(() => {});
  const nDoor = await page.evaluate(() => window.SLCT.map.map.queryRenderedFeatures({ layers: ['dock-door'] }).length);
  check(nDoor >= 5, `dock: ${nDoor} deuren in beeld op de gevel van de hal in Wognum (zoom 18)`);
  // wat er op de plekken van de gekozen rit gebeurt: labels met tijden bij de stops
  const te = await page.evaluate(async () => {
    const S = window.SLCT, f = S.fleet, T = S.state.simTime;
    const t = f.trucks.find(t => { const s = f.stateAt(t, T); return s.st === 'onderweg' && f.eventsOf(t.id).some(e => e.soort === 'los_start'); }); if (!t) return null;
    S.ui.selectTruck(t.id); await new Promise(r => setTimeout(r, 2000));
    return { id: t.id, labels: (S.map.map.getSource('trip-events').serialize().data.features || []).map(x => x.properties.label) };
  });
  check(!!te && te.labels.length >= 1 && te.labels.some(l => /\d\d:\d\d/.test(l)), te ? `rit van ${te.id}: ${te.labels.length} plekken met wat er gebeurt (${te.labels.slice(0, 2).join(' | ')})` : 'rit: geen rijdend voertuig met lossen in zijn rit');
  check(errors.length === 0, `spoor en flyTo: consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}

// ======================================================================================================================
// 6. Rechts rijden. Sem op de A7: "de een kwam van de ene kant en de ander van de andere, dan reden ze nog op dezelfde
// baan". De A7 bij Wognum ligt in de data als twee lijnen, één per rijbaan, 13,6 m uit elkaar. De hartlijn is hier het
// midden tussen de buitenste twee evenwijdige snelweglijnen bij het voertuig (op een snelweg met één lijn: die lijn);
// rechts is gezien in de rijrichting van het voertuig.
{
  const { page, ctx, errors } = await open({ w: 1440, h: 900 });
  await manual(page);
  await page.evaluate(() => {
    const F = window.SLCT.map.map.getSource('mw').serialize().data.features.filter(f => !f.properties.l); const KM = 111320;
    // de snelweglijnen binnen r meter, evenwijdig aan de koers, met hun afstand opzij (side > 0: rechts van het punt)
    window.__mwNear = (lon, lat, bearing, r) => {
      const kx = KM * Math.cos(lat * Math.PI / 180), br = bearing * Math.PI / 180, ux = Math.sin(br), uy = Math.cos(br); const out = [];
      for (const f of F) {
        const g = f.geometry.coordinates; let best = null;
        for (let j = 1; j < g.length; j++) {
          const a = g[j - 1], b = g[j], sx = (b[0] - a[0]) * kx, sy = (b[1] - a[1]) * KM, L = Math.hypot(sx, sy); if (L < 1 || Math.abs((sx * ux + sy * uy) / L) < 0.9) continue;
          const px = (lon - a[0]) * kx, py = (lat - a[1]) * KM, t = (px * sx + py * sy) / (L * L); if (t < -0.01 || t > 1.01) continue;
          const qx = t * sx - px, qy = t * sy - py, d = Math.hypot(qx, qy); if (d <= r && (!best || d < best.d)) best = { d, side: qx * uy - qy * ux };
        }
        if (best) out.push(best);
      }
      return out.sort((a, b) => a.side - b.side);
    };
    // hoe ver een punt rechts van de hartlijn ligt
    window.__right = (lon, lat, bearing) => { const L = window.__mwNear(lon, lat, bearing, 30); return L.length ? -(L[0].side + L[L.length - 1].side) / 2 : null; };
    // hoe ver een punt rechts van de lijn van zijn eigen rijbaan ligt (de dichtstbijzijnde evenwijdige snelweglijn binnen
    // 5 m): op de rechterstrook van een rijbaan met twee stroken van 3,5 m is dat 1,75 m
    window.__lane = (lon, lat, bearing) => { const L = window.__mwNear(lon, lat, bearing, 5); const o = L.reduce((a, x) => (!a || Math.abs(x.side) < Math.abs(a.side) ? x : a), null); return o ? -o.side : null; };
  });
  // --- één punt, twee richtingen: twee voertuigen op hetzelfde punt van een rijbaan van de A7, de een in de richting van
  // die lijn, de ander ertegenin (zo stonden ze in de melding allebei op dezelfde helft)
  const syn = await page.evaluate(() => {
    const S = window.SLCT; const F = S.map.map.getSource('mw').serialize().data.features.filter(f => !f.properties.l && f.properties.d === 1); let pt = null;
    for (const f of F) { const g = f.geometry.coordinates; for (let j = 1; j < g.length && !pt; j++) { const a = g[j - 1], b = g[j]; if ((a[1] - 52.685) * (b[1] - 52.685) <= 0 && a[1] !== b[1] && a[0] > 4.99 && a[0] < 5.08) { const t = (52.685 - a[1]) / (b[1] - a[1]); pt = { lon: a[0] + t * (b[0] - a[0]), lat: 52.685, b: (Math.atan2((b[0] - a[0]) * Math.cos(52.685 * Math.PI / 180), b[1] - a[1]) * 180 / Math.PI + 360) % 360 }; } } if (pt) break; }
    if (!pt) return null;
    const feat = (id, b) => ({ type: 'Feature', properties: { id, st: 'onderweg', b: Math.round(b), mv: true, k: 'trekker', base: 'Wognum' }, geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] } });
    S.map.setTrucks([feat('TEST-1', pt.b), feat('TEST-2', (pt.b + 180) % 360)], []);
    const v = ['TEST-1', 'TEST-2'].map(id => { const q = S.map.vehiclePos(id); return { b: Math.round(q.bearing), lon: q.lon, lat: q.lat, right: window.__right(q.lon, q.lat, Math.round(q.bearing)), lane: window.__lane(q.lon, q.lat, Math.round(q.bearing)) }; });
    S.__frame(true); // de echte voertuigen terug
    const kx = 111320 * Math.cos(52.685 * Math.PI / 180); return { d: Math.hypot((v[0].lon - v[1].lon) * kx, (v[0].lat - v[1].lat) * 111320), v };
  });
  check(!!syn && syn.d > 8 && syn.v.every(x => x.right > 0), syn ? `A7 bij Wognum, één punt in twee richtingen: ${syn.d.toFixed(1)} m uit elkaar, elk rechts van de hartlijn (${syn.v.map(x => `koers ${x.b}: ${x.right == null ? '-' : x.right.toFixed(1)} m`).join(', ')})` : 'A7 bij Wognum: geen rijbaan gevonden');
  // Sem in 4.0: "tegenliggers lijken allebei op de binnenste strook bij de middenberm te rijden". Op ware maat: elk in het
  // midden van de rechterstrook van zijn eigen rijbaan, 1,75 m rechts van de lijn (een rijstrook is 3,5 m)
  check(!!syn && syn.v.every(x => x.lane != null && x.lane > 1.5 && x.lane < 2.0), syn ? `A7 bij Wognum: elk op de rechterstrook van zijn eigen rijbaan (${syn.v.map(x => `koers ${x.b}: ${x.lane == null ? '-' : x.lane.toFixed(2)} m rechts van de lijn`).join(', ')}; een rijstrook is 3,5 m)` : 'A7 bij Wognum: geen rijbaan gevonden');
  // --- echt verkeer: een moment met twee voertuigen in tegengestelde richting op de A7 bij Wognum, hoogstens 400 m uit
  // elkaar (allebei op een snelweglijn in de data)
  const pair = await page.evaluate(() => {
    const S = window.SLCT, f = S.fleet, T0 = Math.floor(S.state.simTime), box = [4.99, 52.645, 5.08, 52.72];
    for (let dt = 0; dt < 1440; dt++) {
      const T = T0 + dt, here = [];
      for (const t of f.trucks) { const s = f.stateAt(t, T), q = s.pos; if ((s.st !== 'onderweg' && s.st !== 'vertraagd') || q.lon < box[0] || q.lon > box[2] || q.lat < box[1] || q.lat > box[3]) continue; if (window.__mwNear(q.lon, q.lat, Math.round(q.bearing), 1).length) here.push({ id: t.id, lon: q.lon, lat: q.lat, b: q.bearing }); }
      for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) { const a = here[i], c = here[j]; if (Math.abs(((a.b - c.b + 540) % 360) - 180) > 150 && Math.hypot((a.lon - c.lon) * 68000, (a.lat - c.lat) * 111320) < 400) return { T, a, c }; }
    }
    return null;
  });
  if (pair) {
    const r = await page.evaluate(async pair => {
      const S = window.SLCT; S.state.simTime = pair.T; S.__frame(true);
      S.map.map.jumpTo({ center: [(pair.a.lon + pair.c.lon) / 2, (pair.a.lat + pair.c.lat) / 2], zoom: 16, pitch: 0, bearing: 0 });
      await new Promise(r => setTimeout(r, 500));
      const v = [pair.a.id, pair.c.id].map(id => { const q = S.map.vehiclePos(id); return { id, b: Math.round(q.bearing), lon: q.lon, lat: q.lat, right: window.__right(q.lon, q.lat, Math.round(q.bearing)), lane: window.__lane(q.lon, q.lat, Math.round(q.bearing)) }; });
      // zijdelings: elk ter plekke gemeten vanaf de hartlijn en opgeteld (twee voertuigen tot 400 m uit elkaar op een
      // bocht meet je niet langs de koers van een van beide)
      return { v, side: (v[0].right || 0) + (v[1].right || 0) };
    }, pair);
    for (const x of r.v) check(x.right > 0 && x.lane != null && x.lane > 1.5 && x.lane < 2.0, `${x.id} (koers ${x.b}) op de A7 bij Wognum: ${x.right == null ? '-' : x.right.toFixed(1)} m rechts van de hartlijn, op de rechterstrook (${x.lane == null ? '-' : x.lane.toFixed(2)} m rechts van de lijn van zijn rijbaan)`);
    check(r.side > 8, `A7 bij Wognum, verkeer in beide richtingen (${r.v.map(x => x.id).join(' en ')}): zijdelings ${r.side.toFixed(1)} m uit elkaar, elk aan zijn eigen kant van de hartlijn`);
    if (shots) {
      mkdirSync(shots, { recursive: true });
      await settle(page); await page.screenshot({ path: `${shots}/a7-wognum-z16-licht.png` });
      await page.click('#themeBtn'); await settle(page); await page.screenshot({ path: `${shots}/a7-wognum-z16-donker.png` }); await page.click('#themeBtn');
    }
  } else check(false, 'A7 bij Wognum: geen moment met verkeer in beide richtingen binnen een dag');
  // --- alle voertuigen, na een sprong in de tijd (dan staan ze meteen op hun plek): rijdende rechts verschoven (of op hun
  // eigen rijbaan), geen enkele naar links; stilstaande (terrein, dock, klant, pauze) helemaal niet
  const all = await page.evaluate(async () => {
    const S = window.SLCT, f = S.fleet; S.state.simTime += 3; S.__frame(true); await new Promise(r => setTimeout(r, 3000));
    const T = S.state.simTime, KM = 111320; let n = 0, left = 0, still = 0, moved = 0, shifted = 0;
    for (const t of f.trucks) {
      const s = f.stateAt(t, T), q = S.map.vehiclePos(t.id); if (!q) continue; const mv = s.st === 'onderweg' || s.st === 'vertraagd';
      const kx = KM * Math.cos(s.pos.lat * Math.PI / 180), ox = (q.lon - s.pos.lon) * kx, oy = (q.lat - s.pos.lat) * KM, m = Math.hypot(ox, oy);
      if (!mv) { still++; if (m > 0.05) moved++; continue; }
      n++; const br = Math.round(s.pos.bearing) * Math.PI / 180; if (m > 0.3) { shifted++; if (ox * Math.cos(br) - oy * Math.sin(br) < 0) left++; }
    }
    const mw = S.map.map.getSource('mw').serialize().data.features.filter(x => !x.properties.l);
    return { n, left, still, moved, shifted, single: mw.filter(x => x.properties.d === 0).length, mw: mw.length, lane: S.map.debug().lane, stepMs: S.map.debug().stepMs };
  });
  check(all.left === 0 && all.shifted > all.n * 0.3, `rechts rijden: ${all.shifted} van ${all.n} rijdende voertuigen verschoven (de rest rijdt al op de lijn van zijn rijbaan), geen enkele naar links`);
  check(all.moved === 0, `stilstaande voertuigen niet verschoven: ${all.moved} van ${all.still}`);
  check(all.single < all.mw * 0.05, `snelwegkanten met één lijn voor beide richtingen (breder getekend, met middenberm): ${all.single} van ${all.mw}; rijbaanindex ${all.lane.indexMs} ms, indeling ${all.lane.dualMs} ms, stap ${all.stepMs} ms`);
  // --- de route van een gekozen voertuig ligt op dezelfde rijbaan als het voertuig (stilstaande klok)
  const rt = await page.evaluate(async () => {
    const S = window.SLCT, f = S.fleet, T = S.state.simTime, KM = 111320, out = [];
    const list = f.trucks.filter(t => f.stateAt(t, T).st === 'onderweg'), stride = Math.max(1, Math.floor(list.length / 12));
    for (let i = 0; i < list.length && out.length < 12; i += stride) {
      const id = list[i].id; S.ui.selectTruck(id); await new Promise(r => setTimeout(r, 400));
      const q = S.map.vehiclePos(id), src = S.map.map.getSource('route').serialize().data.features || []; if (!q || !src.length) continue;
      const g = src[0].geometry.coordinates, kx = KM * Math.cos(q.lat * Math.PI / 180); let best = 1e9;
      for (let j = 1; j < g.length; j++) { const a = g[j - 1], b = g[j], sx = (b[0] - a[0]) * kx, sy = (b[1] - a[1]) * KM, L2 = sx * sx + sy * sy, px = (q.lon - a[0]) * kx, py = (q.lat - a[1]) * KM, t = L2 > 0 ? Math.max(0, Math.min(1, (px * sx + py * sy) / L2)) : 0; best = Math.min(best, Math.hypot(t * sx - px, t * sy - py)); }
      out.push(best);
    }
    return out;
  });
  await page.keyboard.press('Escape');
  check(rt.length >= 8 && rt.every(d => d < 1.5), `de route van een gekozen voertuig ligt op zijn rijbaan: ${rt.length} voertuigen, hoogstens ${rt.length ? Math.max(...rt).toFixed(2) : '-'} m van hun route`);
  check(errors.length === 0, `rechts rijden: consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}

// ======================================================================================================================
// 7. Land en zee. Sem in 3.2: "dan komt een plaats ineens in de zee"; in 4.0: "dan komt Hendriks ineens in de zee". Sinds
// het herstel van het water (tools/ct4/kust_water.py) is het land de echte kust uit OpenStreetMap, zonder naad langs de
// buurlanden en zonder ronde stukjes land onder plekken. Elke standplaats, elk DC en elke fabriek ligt op land: in de vorm
// die de kaart tekent (het punt ligt in een landvlak en in geen watervlak) en zoals de kaart hem tekent (met alles behalve
// de ondergrond uit is de kleur onder het punt op zoom 10 en op zoom 14 geen water). Ook elke winkel ligt op land en in
// geen watervlak, en geen winkel ligt op het adres of het terrein van een standplaats of DC (Overture had daar winkels die
// er niet zijn, zoals "Etos Wognum - Tender 2" op het hoofdkantoor).
// alleen de ondergrond tekenen (land, bebouwing, water) en de kleur onder een lijst punten uitlezen: per beeld springen,
// wachten tot de kaart klaar is ('idle': alles geladen en getekend; wie eerder leest, ziet de achtergrond, en die is zee) en
// dan in het volgende beeld uitlezen
const groundView = page => page.evaluate(() => {
  const m = window.SLCT.map.map, keep = new Set(['bg', 'land', 'water', 'urban']);
  const ground = () => { for (const id of (m.getLayersOrder ? m.getLayersOrder() : m.style._order)) if (!keep.has(id) && m.getLayoutProperty(id, 'visibility') !== 'none') m.setLayoutProperty(id, 'visibility', 'none'); };
  const read = list => { const gl = m.painter.context.gl, c = m.getCanvas(), k = c.width / c.clientWidth; return list.map(p => { const q = m.project(p), b = new Uint8Array(4); gl.readPixels(Math.round(q.x * k), Math.round(c.height - q.y * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return [b[0], b[1], b[2]]; }); };
  window.__inView = (center, z, list) => { m.jumpTo({ center, zoom: z, pitch: 0, bearing: 0 }); const W = m.getContainer(); return list.filter(([, p]) => { const q = m.project(p); return q.x > 12 && q.y > 12 && q.x < W.clientWidth - 12 && q.y < W.clientHeight - 12; }).map(([j]) => j); };
  window.__view = (center, z, list) => new Promise(res => {
    ground(); let over = false;
    const done = idle => { if (over) return; over = true; m.off('idle', onIdle); m.once('render', () => res({ cols: read(list), idle })); m.triggerRepaint(); };
    const onIdle = () => done(true);
    m.once('idle', onIdle); m.jumpTo({ center, zoom: z, pitch: 0, bearing: 0 }); m.triggerRepaint();
    setTimeout(() => done(false), 30000);
  });
});
// alle punten van een lijst [naam, [lon, lat]] op zoom z uitlezen, per beeld alle punten die erin vallen
async function readAll(page, pl, z) {
  const cols = new Array(pl.length), done = new Set(), stuck = []; let views = 0;
  for (let i = 0; i < pl.length; i++) {
    if (done.has(i)) continue;
    const inView = await page.evaluate(([c, z, list]) => window.__inView(c, z, list), [pl[i][1], z, pl.map((o, j) => [j, o[1]]).filter(([j]) => !done.has(j))]);
    if (!inView.includes(i)) inView.push(i);
    const r = await page.evaluate(([c, z, list]) => window.__view(c, z, list), [pl[i][1], z, inView.map(j => pl[j][1])]); views++;
    if (!r.idle) stuck.push(`${pl[i][0]} (zoom ${z})`);
    inView.forEach((j, k) => { done.add(j); cols[j] = r.cols[k]; });
  }
  return { cols, views, stuck };
}
// de kleur van het water (P.sea in basemap.js), licht en donker
const SEA = { licht: [170, 218, 255], donker: [20, 39, 59] };
const like = (c, ref, tol) => !!c && Math.abs(c[0] - ref[0]) < tol && Math.abs(c[1] - ref[1]) < tol && Math.abs(c[2] - ref[2]) < tol;
{
  const { page, ctx, errors } = await open({ w: 1280, h: 800 });
  await manual(page);
  const pts = await page.evaluate(() => {
    const m = window.SLCT.map.map, src = id => (m.getSource(id) ? m.getSource(id).serialize().data.features : []);
    const ring = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const yi = r[i][1], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < r[i][0] + (y - yi) / (yj - yi) * (r[j][0] - r[i][0])) c = !c; } return c; };
    const poly = (c, x, y) => ring(c[0], x, y) && !c.slice(1).some(h => ring(h, x, y));
    // per vlak vooraf de omsluitende rechthoek (ruim 4.500 winkels tegen een paar duizend vlakken)
    const idx = fs => fs.map(f => { const cs = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of cs) for (const [x, y] of c[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { cs, b: [x0, y0, x1, y1] }; });
    const inAny = (L, [x, y]) => L.some(({ cs, b }) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && cs.some(c => poly(c, x, y)));
    const land = idx(src('land')), water = idx(src('water'));
    const list = [...src('sp').map(f => ({ n: f.properties.n, s: 'standplaats', p: f.geometry.coordinates })), ...src('dcs').map(f => ({ n: f.properties.n, s: f.properties.s, p: f.geometry.coordinates }))];
    const winkels = src('winkels').map(f => ({ id: f.properties.id, n: f.properties.n, p: f.geometry.coordinates }));
    const wBad = winkels.filter(w => !inAny(land, w.p) || inAny(water, w.p));
    // een winkel op een standplaats of DC: binnen 25 m van het adrespunt, op het terrein van een standplaats, of het
    // hoofdkantoor (Tender 2, Wognum) of een holding in de naam
    const m25 = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * 111320) <= 25;
    const adr = [...src('sp').map(f => f.geometry.coordinates), ...src('dcs').filter(f => f.properties.s === 'dc').map(f => f.geometry.coordinates)];
    const ter = idx(src('site').filter(f => f.properties.k === 'sp'));
    const nep = winkels.filter(w => /\b(tender|holding|hoofdkantoor)\b/i.test(w.n) || adr.some(a => m25(w.p, a)) || inAny(ter, w.p));
    return { list: list.map(o => ({ ...o, land: inAny(land, o.p), water: inAny(water, o.p) })), winkels: winkels.length, wBad: wBad.slice(0, 8).map(w => `${w.n} (${w.p.map(v => v.toFixed(4)).join(', ')})`), wBadN: wBad.length, nep: nep.map(w => `${w.id} ${w.n}`), patches: src('land').filter(f => f.properties && f.properties.patch).length, naad: !!m.getLayer('seam'), landN: src('land').length, waterN: src('water').length };
  });
  const soorten = Object.entries(pts.list.reduce((a, o) => ({ ...a, [o.s]: (a[o.s] || 0) + 1 }), {})).map(([k, v]) => `${v} ${k}`).join(', ');
  const bad = pts.list.filter(o => !o.land || o.water);
  check(pts.list.length > 150 && bad.length === 0, `land en zee (vorm): ${pts.list.length} plekken (${soorten}) op land en in geen watervlak${bad.length ? `; niet: ${bad.slice(0, 8).map(o => `${o.n} (${o.water ? 'in water' : 'buiten land'})`).join(', ')}` : ''}`);
  check(pts.wBadN === 0, `land en zee (vorm): ook de ${pts.winkels} winkels op land en in geen watervlak${pts.wBadN ? `; niet: ${pts.wBadN}, o.a. ${pts.wBad.join(', ')}` : ''}`);
  check(pts.patches === 0 && !pts.naad && pts.landN > 0 && pts.waterN > 100, `land en zee (vorm): de echte kust (${pts.landN} landvlakken, ${pts.waterN} watervlakken), zonder ronde stukjes land onder plekken (${pts.patches}) en zonder naad langs de buurlanden`);
  check(pts.nep.length === 0, `geen winkel op het adres of het terrein van een standplaats of DC, en geen hoofdkantoor als winkel${pts.nep.length ? `: ${pts.nep.join(', ')}` : ''}`);
  // de kleur onder het punt, met alles behalve de ondergrond uit; een klein venster (snel tekenen)
  await groundView(page);
  await page.setViewportSize({ width: 560, height: 420 }); await page.waitForTimeout(800);
  const t0 = Date.now(), pl = pts.list.map(o => [o.n, o.p]), wet = [], stuck = [], views = {};
  for (const z of [10, 14]) {
    const r = await readAll(page, pl, z); views[z] = r.views; stuck.push(...r.stuck);
    r.cols.forEach((c, j) => { if (like(c, SEA.licht, 16)) wet.push(`${pl[j][0]} (zoom ${z}, ${c.join('/')})`); });
  }
  check(wet.length === 0 && stuck.length === 0, `land en zee (beeld): onder geen van de ${pl.length} plekken water, op zoom 10 (${views[10]} beelden) en 14 (${views[14]} beelden), ${((Date.now() - t0) / 1000).toFixed(0)} s${wet.length ? `; water onder: ${wet.slice(0, 8).join(', ')}` : ''}${stuck.length ? `; niet klaar binnen 30 s: ${stuck.slice(0, 5).join(', ')}` : ''}`);
  check(errors.length === 0, `land en zee: consolefouten ${errors.length}`);
  await ctx.close();
}

// ======================================================================================================================
// 7b. Water op het beeld. De eindcontrole van 4.0 vond het IJ achter Amsterdam Centraal, het Westelijk Havengebied en de
// bekkens van Europoort als land getekend, en ronde vlekken land in de Eems en bij Breskens. Op bekende plekken op het
// water tekent de kaart water (licht en donker), op de zoom waarop een planner er kijkt: het IJ en de havens op zoom 13,
// de rivieren en kanalen op 12, de grote wateren op 10. Op een paar plekken vlak naast het water tekent hij land (geen
// waterkleur). Elk punt ligt minstens 40 m van de oever in de data (tools/ct4/kust_water.py meet het bij het maken).
const WATERPUNTEN = [
  ['het IJ bij Centraal', 4.899, 52.3826, 13],
  ['het IJ bij de Houthavens', 4.8853, 52.3971, 13],
  ['het Noordzeekanaal bij IJmuiden', 4.65, 52.463, 12],
  ['het Noordzeekanaal bij Zaandam', 4.783, 52.4255, 12],
  ['een bekken in Westpoort', 4.8195, 52.4057, 13],
  ['de Beneluxhaven (Europoort)', 4.12841, 51.95131, 13],
  ['de 7e Petroleumhaven (Europoort)', 4.20806, 51.91875, 13],
  ['de Dintelhaven (Europoort)', 4.11815, 51.94949, 13],
  ['het Calandkanaal', 4.1292, 51.9606, 12],
  ['de Yangtzehaven (Maasvlakte)', 4.0411, 51.9702, 13],
  ['de Prinses Amaliahaven (Maasvlakte 2)', 3.9989, 51.977, 13],
  ['de Maasmond', 4.06398, 51.98537, 12],
  ['de Nieuwe Maas bij de Erasmusbrug', 4.484, 51.907, 13],
  ['de Waal bij Nijmegen', 5.8704, 51.8512, 12],
  ['het IJsselmeer', 5.3, 52.85, 10],
  ['het Markermeer', 5.2, 52.55, 10],
  ['de Eems bij Delfzijl', 6.97, 53.33, 11],
  ['de Dollard', 7.15, 53.27, 10],
  ['de Westerschelde bij Breskens', 3.56, 51.41, 11],
  ['de Westerschelde bij Vlissingen', 3.58, 51.435, 11],
  ['het Hollands Diep', 4.55, 51.69, 10],
  ['het Haringvliet', 4.25, 51.79, 10],
  ['de Oosterschelde', 3.95, 51.6, 10],
  ['de Waddenzee bij Harlingen', 5.38, 53.18, 10],
  ['het IJsselmeer, ver weg', 5.3, 52.85, 8],
  ['het Hollands Diep, ver weg', 4.52, 51.69, 9],
];
const LANDPUNTEN = [
  ['Amsterdam Centraal', 4.9002, 52.3789, 14],
  ['de Dam', 4.8932, 52.3731, 14],
  ['de ECT-terminal (Maasvlakte)', 4.033, 51.955, 14],
  ['de APM-terminal (Maasvlakte 2)', 4.005, 51.97, 14],
  ['Delfzijl', 6.9236, 53.3317, 14],
  ['Breskens', 3.553, 51.396, 14],
  ['Vlissingen', 3.575, 51.444, 14],
  ['IJmuiden', 4.623, 52.46, 14],
];
for (const thema of ['licht', 'donker']) {
  const { page, ctx, errors } = await open({ w: 1280, h: 800, dark: thema === 'donker' });
  await manual(page);
  await groundView(page);
  await page.setViewportSize({ width: 560, height: 420 }); await page.waitForTimeout(800);
  const zee = SEA[thema], t0 = Date.now(), fout = [], stuck = []; let views = 0;
  for (const [lijst, water] of [[WATERPUNTEN, true], [LANDPUNTEN, false]]) {
    for (const z of [...new Set(lijst.map(p => p[3]))]) {
      const pl = lijst.filter(p => p[3] === z).map(([n, lon, lat]) => [n, [lon, lat]]);
      const r = await readAll(page, pl, z); views += r.views; stuck.push(...r.stuck);
      r.cols.forEach((c, j) => { if (like(c, zee, 12) !== water) fout.push(`${pl[j][0]} (zoom ${z}: ${water ? 'geen water' : 'water'}, ${c ? c.join('/') : '-'})`); });
    }
  }
  check(fout.length === 0 && stuck.length === 0, `water op het beeld (${thema}): ${WATERPUNTEN.length} plekken op het water getekend als water (${WATERPUNTEN.map(p => p[0]).join(', ')}), ${LANDPUNTEN.length} plekken vlak ernaast als land (${LANDPUNTEN.map(p => p[0]).join(', ')}); ${views} beelden, ${((Date.now() - t0) / 1000).toFixed(0)} s${fout.length ? `; niet: ${fout.join(', ')}` : ''}${stuck.length ? `; niet klaar binnen 30 s: ${stuck.join(', ')}` : ''}`);
  check(errors.length === 0, `water op het beeld (${thema}): consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}

// ======================================================================================================================
// 8. Afdelingen op het terrein (sp.afdelingen, van de data). Zonder het veld geen namen; met het veld rustige namen vanaf
// zoom 16, bij een gebouw midden in de contour, in 3D weg (daar staan ze op bordjes). Zolang de data er niet is, nagebootst
// voor Wognum.
{
  const { page, ctx, errors } = await open({ w: 1440, h: 900 });
  await manual(page);
  const echt = await page.evaluate(() => window.SLCT.fleet.trucks.some(t => Array.isArray(t.base.afdelingen) && t.base.afdelingen.length));
  const n0 = await page.evaluate(() => window.SLCT.map.map.getSource('afd').serialize().data.features.length);
  if (!echt) check(n0 === 0, `afdelingen: zonder sp.afdelingen geen namen op de kaart (${n0})`);
  await page.evaluate(() => {
    const sp = window.SLCT.fleet.trucks.find(t => t.base.n === 'Wognum').base; if (Array.isArray(sp.afdelingen) && sp.afdelingen.length) return;
    const d = sp.dockPlek && sp.dockPlek.length ? sp.dockPlek[Math.floor(sp.dockPlek.length / 2)] : [sp.lon, sp.lat];
    sp.afdelingen = [
      { naam: 'Warehouse', soort: 'loods', p: [sp.lon, sp.lat], gebouw: 0, bron: 'afgeleid' }, { naam: 'Kantoor', soort: 'kantoor', p: [sp.lon + 0.0005, sp.lat], bron: 'afgeleid' },
      { naam: 'Docks 1 tot 30', soort: 'docks', p: [d[0], d[1]], bron: 'afgeleid' },
      { naam: 'Opleggers', soort: 'opleggers', p: sp.poort ? [sp.poort[0], sp.poort[1]] : [sp.lon + 0.001, sp.lat], bron: 'afgeleid' },
    ];
  });
  await toSp(page, 17); await page.waitForFunction(() => window.SLCT.map.debug().buildings === 'done', null, { timeout: 30000, polling: 200 }).catch(() => {}); await settle(page);
  // na het laden van de gebouwen krijgt de bron de namen opnieuw (midden in de gebouwen); even wachten tot ze geplaatst zijn
  await page.waitForFunction(() => window.SLCT.map.map.queryRenderedFeatures({ layers: ['afd'] }).length > 0, null, { timeout: 20000, polling: 250 }).catch(() => {}); await settle(page);
  const r = await page.evaluate(() => {
    const m = window.SLCT.map.map, f = m.getSource('afd').serialize().data.features, sp = window.SLCT.fleet.trucks.find(t => t.base.n === 'Wognum').base;
    const ring = (rr, x, y) => { let c = false; for (let i = 0, j = rr.length - 1; i < rr.length; j = i++) { const yi = rr[i][1], yj = rr[j][1]; if ((yi > y) !== (yj > y) && x < rr[i][0] + (y - yi) / (yj - yi) * (rr[j][0] - rr[i][0])) c = !c; } return c; };
    const own = m.getSource('bld') ? m.getSource('bld').serialize().data.features.filter(x => x.properties && x.properties.d === 1) : [];
    // de afdelingen in een gebouw (loods, kantoor, garage, wasstraat, met gebouw in de data), op alle standplaatsen: de
    // naam staat in een eigen gebouw van een terrein (d: 1)
    const want = window.SLCT.fleet.trucks.map(t => t.base).filter((b, i, a) => a.indexOf(b) === i).reduce((n, b) => n + (b.afdelingen || []).filter(a => Number.isInteger(a.gebouw) && ['loods', 'kantoor', 'garage', 'wasstraat'].includes(a.soort)).length, 0);
    const inside = f.filter(x => x.properties.g === 1);
    const outside = inside.filter(x => !own.some(b => ring(b.geometry.coordinates[0], x.geometry.coordinates[0], x.geometry.coordinates[1]))).map(x => x.properties.n);
    return { n: f.length, wognum: (sp.afdelingen || []).length, rendered: [...new Set(m.queryRenderedFeatures({ layers: ['afd'] }).map(x => x.properties.n))], tt: m.getLayoutProperty('afd', 'text-transform'), min: m.getLayer('afd').minzoom, want, inside: inside.length, outside, own: own.length };
  });
  check(r.n >= 3 && r.rendered.length >= Math.min(r.wognum, 6) - 1 && r.tt === 'uppercase' && r.min >= 16, `afdelingen: ${r.n} op de kaart${echt ? ' (uit de data)' : ' (nagebootst)'}, ${r.rendered.length} van de ${r.wognum} van Wognum in beeld op zoom 17 (${r.rendered.join(', ')}), in kleine kapitalen, vanaf zoom ${r.min}`);
  check(r.own === 0 || (r.inside > 0 && r.inside >= r.want && r.outside.length === 0), `afdelingen: ${r.inside} van de ${r.want} afdelingen met een gebouw staan midden in dat gebouw${r.want > r.inside ? ` (de rest staat op zijn punt: geen bruikbare contour bij die index in buildings.json)` : ''}${r.outside.length ? `; niet: ${r.outside.slice(0, 6).join(', ')}` : ''}`);
  if (shots) { await page.screenshot({ path: `${shots}/afdelingen-wognum-z17.png` }); }
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(true)); await page.waitForTimeout(2500);
  const v3 = await page.evaluate(() => window.SLCT.map.map.getLayoutProperty('afd', 'visibility'));
  check(v3 === 'none', `afdelingen: in 3D weg van de platte kaart (${v3})`);
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(false)); await page.waitForTimeout(1200);
  check(errors.length === 0, `afdelingen: consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}

// ======================================================================================================================
// 9. Bezorgbussen aan en uit (Sem: "laten staan, gewoon als keuze kunnen aanklikken"): standaard op de kaart; uit via
// Kaartlagen, Instellingen, de toets b of de chip in de filterbalk; alleen de kaart (en daarmee de 3D-wereld), in lijsten
// en tellers tellen ze mee; een gekozen bus blijft zichtbaar; de keuze blijft na herladen staan.
{
  const { page, ctx, errors } = await open({});
  await manual(page);
  const tel = () => page.evaluate(() => { const S = window.SLCT; (S.__frame || S.ui.frame)(true); let bus = 0, rest = 0, scope = 0; for (const t of S.fleet.trucks) { if (t.kind === 'bus' && S.ui.ctx.inScope(t)) scope++; if (!S.map.vehiclePos(t.id)) continue; if (t.kind === 'bus') bus++; else rest++; } return { bus, rest, scope, chip: !!document.querySelector('#mapbar [data-clear="bussen"]'), kf: (() => { try { return JSON.parse(localStorage.getItem('sl-kaartfilter') || 'null'); } catch { return null; } })(), c: { ...S.ui.ctx.counts() } }; });
  // het werkgebied heel Nederland, zodat er bussen in beeld zijn
  await page.evaluate(() => { const S = window.SLCT; if (S.ui.ctx.F.sps.size) S.ui.ctx.clearSps(); S.map.map.jumpTo({ center: [5.25, 52.25], zoom: 7, pitch: 0, bearing: 0 }); });
  const a = await tel();
  check(a.scope > 0 && a.bus > 0 && !a.chip && a.kf === null, `bezorgbussen standaard aan: ${a.bus} bussen op de kaart, geen chip, niets bewaard`);
  await page.click('#layersBtn'); await page.waitForTimeout(200);
  const sub = await page.evaluate(() => { const x = document.getElementById('busTog'); return x ? { on: x.checked, txt: x.closest('label').textContent } : null; });
  check(!!sub && sub.on && /Bezorgbussen/.test(sub.txt) && /toets b/.test(sub.txt), `Kaartlagen: schakelaar Bezorgbussen, aan (${sub && sub.txt.trim()})`);
  // de schakelaar zelf ligt onder zijn getekende baan: klikken op het label, zoals een kijker doet
  await page.locator('label.tgl', { has: page.locator('#busTog') }).click(); await page.waitForTimeout(250);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const b = await tel();
  check(b.bus === 0 && b.rest === a.rest && b.chip && b.kf && b.kf.bussen === false, `uit: geen bus op de kaart, de andere ${b.rest} voertuigen blijven, de chip "Bezorgbussen verborgen" staat er, bewaard`);
  check(JSON.stringify(b.c) === JSON.stringify(a.c), `uit: de tellers van de statussen tellen de bussen gewoon mee (${JSON.stringify(b.c)})`);
  // een gekozen bus blijft zichtbaar, de andere niet
  const bid = await page.evaluate(() => { const S = window.SLCT, T = S.state.simTime; const t = S.fleet.trucks.find(t => t.kind === 'bus' && S.ui.ctx.inScope(t) && S.fleet.stateAt(t, T).st === 'onderweg') || S.fleet.trucks.find(t => t.kind === 'bus' && S.ui.ctx.inScope(t)); S.ui.selectTruck(t.id); return t.id; });
  await page.waitForTimeout(400);
  const c = await tel(); const zicht = await page.evaluate(id => !!window.SLCT.map.vehiclePos(id), bid);
  check(zicht && c.bus === 1, `uit, maar ${bid} gekozen: die ene bus blijft zichtbaar (${c.bus} bus op de kaart)`);
  await page.evaluate(() => window.SLCT.ui.ctx.clearSel()); await page.waitForTimeout(200);
  // de toets b zet ze terug
  await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('b'); await page.waitForTimeout(300);
  const d = await tel();
  check(d.bus > 0 && !d.chip && d.kf && d.kf.bussen === true, `toets b: de bussen weer op de kaart (${d.bus}), de chip weg`);
  // de chip in de filterbalk zet ze ook terug
  await page.keyboard.press('b'); await page.waitForTimeout(300);
  await page.click('#mapbar [data-clear="bussen"]'); await page.waitForTimeout(300);
  const e = await tel();
  check(e.bus > 0 && !e.chip, `de chip "Bezorgbussen verborgen" zet ze terug (${e.bus})`);
  check(errors.length === 0, `bezorgbussen: consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
  await ctx.close();
}
{
  // na herladen: de bewaarde keuze (sl-kaartfilter met bussen uit) geldt meteen, ook in Instellingen
  const { page, ctx } = await open({ prefs: { 'sl-kaartfilter': JSON.stringify({ sts: ['vertraagd', 'onderweg', 'klant', 'pauze', 'terrein'], dim: true, bussen: false }) } });
  await page.evaluate(() => { const S = window.SLCT; if (S.ui.ctx.F.sps.size) S.ui.ctx.clearSps(); S.map.map.jumpTo({ center: [5.25, 52.25], zoom: 7 }); S.ui.frame(true); }); await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const S = window.SLCT; let bus = 0; for (const t of S.fleet.trucks) if (t.kind === 'bus' && S.map.vehiclePos(t.id)) bus++; return { bus, chip: !!document.querySelector('#mapbar [data-clear="bussen"]') }; });
  check(r.bus === 0 && r.chip, `na herladen: de bussen blijven van de kaart (${r.bus}), met de chip`);
  await page.evaluate(() => window.SLCT.ui.navTo ? window.SLCT.ui.navTo('instellingen') : window.SLCT.ui.ctx.navTo('instellingen')); await page.waitForTimeout(500);
  const set = await page.evaluate(() => { const x = document.getElementById('setBus'); return x ? x.checked : null; });
  check(set === false, `Instellingen: de schakelaar Bezorgbussen staat uit (${set})`);
  await ctx.close();
}

// ======================================================================================================================
// 10. Framerate (SwiftShader: software, dus laag) en schermafbeeldingen
if (!quick) {
  const { page, ctx } = await open({ w: 1440, h: 900 });
  const fps = () => page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); }));
  for (const [c, z] of [[[5.25, 52.25], 7], [[4.93, 52.37], 11], [[5.0356, 52.6935], 13]]) {
    await page.evaluate(([c, z]) => window.SLCT.map.map.jumpTo({ center: c, zoom: z }), [c, z]); await page.waitForTimeout(1200);
    const v = []; for (let i = 0; i < 3; i++) v.push(await fps()); v.sort((a, b) => a - b);
    console.log(`--   framerate zoom ${z}, simulatie op 12x: ${v[1].toFixed(1)} beelden/s (SwiftShader; ${JSON.stringify(await page.evaluate(() => { const d = window.SLCT.map.debug(); return { stapduur: d.interval, beeld: d.frameMs, zwaar: d.heavy }; }))})`);
  }
  await ctx.close();
}
if (shots) {
  mkdirSync(shots, { recursive: true });
  // zoom 14 en 16: de standplaats Wognum (225 voertuigen; terrein, hal, poort en de parkeerrijen op ware grootte)
  const VIEWS = [{ z: 7, c: [5.25, 52.25] }, { z: 11, c: [4.93, 52.37] }, { z: 14, sp: 'Wognum' }, { z: 16, sp: 'Wognum' }];
  for (const [w, h] of [[1440, 900], [390, 844]]) for (const dark of [false, true]) {
    const { page, ctx } = await open({ w, h, dark });
    for (const v of VIEWS) { await page.evaluate(v => { const S = window.SLCT; const b = v.sp && S.fleet.trucks.find(t => t.base.n === v.sp).base; S.map.map.jumpTo({ center: v.c || [b.lon, b.lat], zoom: v.z, pitch: 0, bearing: 0 }); S.ui.frame(true); }, v);
      // wachten tot de tegels er zijn en de namen geplaatst (onder belasting duurt dat langer), dan nog even voor het infaden
      await page.waitForFunction(() => { const m = window.SLCT.map.map, st = m.style; return m.areTilesLoaded() && !m.isMoving() && !!st && (!st.pauseablePlacement || st.pauseablePlacement.isDone()) && !(st.placement && st.placement.hasTransitions(performance.now())); }, null, { timeout: 15000, polling: 200 }).catch(() => {});
      await page.waitForTimeout(1200); await page.screenshot({ path: `${shots}/kaart-z${v.z}-${dark ? 'donker' : 'licht'}-${w}.png` }); }
    await ctx.close();
  }
  console.log(`--   schermafbeeldingen in ${shots}`);
}
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
