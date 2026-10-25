// Controle van de kaart (Control Tower 4.0, kaart en beweging): vloeiende beweging tussen twee simulatiestappen, volgen in
// 2D en 3D, de terugval zonder online tegels, geen verzoek naar buiten in de ingebedde versie, aanwijzen (handcursor en
// halo), klikken, vliegen alleen als het voertuig buiten beeld is, en "minder beweging" (niets glijdt, de camera springt).
// Dan het spoor van de gekozen rit (grijs gereden, blauw komend, de laatste 20 minuten vervagend), flyTo naar een plek,
// voertuig of oplegger met een korte markering, gebeurtenissen langs een rit, het anker voor een hoverkaartje, de docks
// (een voertuig springt naar het dock, de deuren op de gevel) en de labels bij de plekken van de gekozen rit.
// Daarna schermafbeeldingen van de ingebouwde kaart op zoom 7, 11, 14 en 16, licht en donker, 1440 en 390 px, en een
// meting van de framerate.
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
const errorsOf = page => { const e = []; page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|ERR_FAILED|ERR_TUNNEL|cartocdn|openfreemap/.test(m.text())) e.push(m.text().slice(0, 240)); }); page.on('pageerror', x => e.push('pageerror: ' + String(x).slice(0, 240))); return e; };

// een effen PNG (voor nagebootste kaarttegels)
function crc32(b) { let crc = 0xFFFFFFFF; for (let n = 0; n < b.length; n++) { let c = (crc ^ b[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function png(w, h, [r, g, bl]) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = bl; }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, [233, 229, 220]);

// opent de app; block: externe hosts tegenhouden (zoals een omgeving zonder bereik); embedded: data-tiles="off";
// online: de tegels van CARTO nabootsen, ofm: 'ok' (TileJSON en lege tegels) of 'fout' (OpenFreeMap onbereikbaar)
async function open({ w = 1280, h = 800, dark = false, reduced = false, embedded = false, block = true, online = false, ofm = 'fout' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: w < 500 ? 2 : 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errors = errorsOf(page); const ext = new Set();
  page.on('request', r => { if (/^(data|blob|about):/.test(r.url())) return; const u = new URL(r.url()); if (u.host !== host) ext.add(u.host); });
  if (block) await page.route('**/*', route => {
    const u = new URL(route.request().url()); if (u.host === host) return route.continue();
    if (online && /cartocdn\.com$/.test(u.host)) return route.fulfill({ status: 200, contentType: 'image/png', body: TILE });
    if (online && ofm === 'ok' && u.host === 'tiles.openfreemap.org') return /\.pbf$/.test(u.pathname) ? route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) }) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tilejson: '3.0.0', tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, vector_layers: [{ id: 'building', fields: {} }] }) });
    return route.abort('blockedbyclient');
  });
  if (embedded) await page.route(url, async route => { const res = await route.fetch(); const body = (await res.text()).replace('class="app slct"', 'class="app slct" data-tiles="off" data-embedded'); await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/html; charset=utf-8' } }); });
  await page.addInitScript(d => { try { localStorage.clear(); localStorage.setItem('sl-theme', d ? 'dark' : 'light'); } catch { /* geen opslag */ } }, dark);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SLCT && window.SLCT.fleet && document.getElementById('loading').hidden, null, { timeout: 120_000 });
  for (let i = 0; i < 3; i++) { const b = await page.$('#wzNext'); if (b) { await b.click(); await page.waitForTimeout(150); } }
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

// ======================================================================================================================
// 1. Losse versie zonder bereik: terugval, interpolatie, aanwijzen, klikken, volgen (2D en 3D), vliegen
{
  const { page, ctx, errors, ext } = await open();
  const d0 = await page.evaluate(() => ({ ...window.SLCT.map.debug(), land: window.SLCT.map.map.getLayoutProperty('land', 'visibility'), mw: window.SLCT.map.map.getLayoutProperty('mw', 'visibility'), pl: window.SLCT.map.map.getLayoutProperty('pl-1', 'visibility'), notice: document.getElementById('notice').classList.contains('on') ? document.getElementById('notice').textContent : '' }));
  check(d0.onlineFailed && !d0.online && d0.land !== 'none' && d0.mw !== 'none' && d0.pl !== 'none', `terugval: online tegels geprobeerd (${[...ext].filter(h => /carto/.test(h)).length ? 'carto' : 'geen verzoek'}), onlineFailed=${d0.onlineFailed}, ingebouwde kaart zichtbaar`);
  check(!/Online kaartlaag/.test(d0.notice), `terugval zonder melding als niemand de laag aanzette (${d0.notice || 'geen melding'})`);
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
    const target = S.fleet.stateAt(S.fleet.byId.get(id), S.state.simTime).pos;
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
    m.on('move', on); await new Promise(r => setTimeout(r, 2200)); m.off('move', on);
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
  // de draaisnelheid in de pagina meten: bij elke camerabeweging de tijd van het beeld (de tijd die requestAnimationFrame
  // meegeeft, waarmee ook de volgcamera rekent), de richting en waar het voertuig op het scherm staat
  await page.evaluate(id => {
    if (!window.__rafT) { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf(ts => { window.__frameT = ts; cb(ts); }); window.__rafT = true; }
    const S = window.SLCT, m = S.map.map; window.__rot = [];
    window.__onMove = () => { const q = S.map.vehiclePos(id), s = q && m.project([q.lon, q.lat]), c = m.getContainer(); window.__rot.push([window.__frameT || performance.now(), m.getBearing(), s ? s.x - c.clientWidth / 2 : 0, s ? s.y - c.clientHeight / 2 : 0]); };
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
  const endOk = !!fa && Math.hypot(fa.x - fa.w / 2, fa.y - fa.h / 2) < 30;
  check(endOk && (dipped || !mid.length), `vliegen naar ${far} (ver weg): ${dipped ? `eerst uit- dan inzoomen (laagste zoom ${minZ.toFixed(1)})` : mid.length ? `geen uitzoomen te zien (laagste zoom ${minZ.toFixed(1)})` : 'geen beeld midden in de vlucht (machine overbelast)'}, ${vl.rec.length} beelden, ${endOk ? 'eindigt op het voertuig' : `eindigt ${fa ? Math.round(Math.hypot(fa.x - fa.w / 2, fa.y - fa.h / 2)) + ' px' : 'buiten beeld'} naast het voertuig`}`);
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
  const d = await page.evaluate(() => ({ tiles: window.SLCT.map.hasTiles(), carto: !!window.SLCT.map.map.getSource('carto'), ofm: !!window.SLCT.map.map.getSource('ofm') }));
  check(!d.tiles && !d.carto && !d.ofm && ext.size === 0, `ingebed: geen tegelbron, externe hosts: ${[...ext].join(', ') || 'geen'}`);
  check(errors.length === 0, `ingebed: consolefouten ${errors.length}`);
  await ctx.close();
}

// ======================================================================================================================
// 3. Minder beweging: geen tussenstanden, de camera springt
{
  const { page, ctx, errors } = await open({ reduced: true });
  await manual(page); const id = await pickMover(page, 12.5); await page.waitForTimeout(600);
  for (let i = 0; i < 3; i++) { await step(page, 0.1); await page.waitForTimeout(700); }
  const r = await page.evaluate(async id => {
    const S = window.SLCT; const pos = []; const t0 = performance.now(); S.state.simTime += 0.1; S.__frame();
    const target = S.fleet.stateAt(S.fleet.byId.get(id), S.state.simTime).pos;
    await new Promise(res => { const tick = () => { const p = S.map.vehiclePos(id); pos.push([p.lon, p.lat]); if (performance.now() - t0 < 700) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    return { distinct: new Set(pos.map(p => p[0].toFixed(7) + ',' + p[1].toFixed(7))).size, first: Math.hypot(pos[0][0] - target.lon, pos[0][1] - target.lat) };
  }, id);
  check(r.distinct === 1 && r.first < 1e-7, `minder beweging: het voertuig springt meteen naar de nieuwe stap (${r.distinct} stand)`);
  const far = await page.evaluate(() => { const S = window.SLCT, m = S.map.map, f = S.fleet, T = S.state.simTime; const c = m.getCenter(); const t = f.trucks.find(t => { const s = f.stateAt(t, T); return s.st === 'onderweg' && Math.hypot(s.pos.lon - c.lng, s.pos.lat - c.lat) > 1; }); return t.id; });
  await page.evaluate(id => window.SLCT.ui.selectTruck(id), far); await page.waitForTimeout(150);
  const j = await screenOf(page, far);
  check(j && Math.hypot(j.x - j.w / 2, j.y - j.h / 2) < 3, `minder beweging: de camera springt naar ${far} (na 150 ms ${j && Math.hypot(j.x - j.w / 2, j.y - j.h / 2).toFixed(1)} px van het midden)`);
  check(errors.length === 0, `minder beweging: consolefouten ${errors.length}`);
  await ctx.close();
}

// ======================================================================================================================
// 4. Online (nagebootst, want tegelservers zijn hier niet bereikbaar): de tegels van CARTO bovenop, de eigen namen en wegen
// weg, de bronvermelding noemt CARTO; in 3D de gebouwen van OpenFreeMap; is OpenFreeMap onbereikbaar, dan stil zonder.
for (const ofm of ['ok', 'fout']) {
  const { page, ctx, errors } = await open({ online: true, ofm });
  await page.waitForTimeout(800);
  const o = await page.evaluate(() => { const m = window.SLCT.map.map; return { d: window.SLCT.map.debug(), carto: m.getLayoutProperty('carto', 'visibility'), pl: m.getLayoutProperty('pl-1', 'visibility'), mw: m.getLayoutProperty('mw', 'visibility'), sp: m.getLayoutProperty('sp', 'visibility'), attr: (document.querySelector('#map .maplibregl-ctrl-attrib') || {}).textContent || '' }; });
  if (ofm === 'ok') check(o.d.tilesOk && o.d.online && o.carto === 'visible' && o.pl === 'none' && o.mw === 'none' && o.sp !== 'none' && /CARTO/.test(o.attr), `online: tegels geladen, eigen plaatsnamen en wegen uit, standplaatsen blijven, bronvermelding "${o.attr.slice(0, 60)}…"`);
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(true)); await page.waitForTimeout(3000);
  const t = await page.evaluate(() => { const m = window.SLCT.map.map; return { src: !!m.getSource('ofm'), layer: !!m.getLayer('ofm-3d'), vis: m.getLayer('ofm-3d') ? m.getLayoutProperty('ofm-3d', 'visibility') : null, notice: document.getElementById('notice').classList.contains('on') ? document.getElementById('notice').textContent : '' }; });
  if (ofm === 'ok') check(t.src && t.layer && t.vis === 'visible', `online 3D: gebouwen van OpenFreeMap als laag (zichtbaar: ${t.vis})`);
  else check(!t.src && !t.layer && !/OpenFreeMap|gebouwen/i.test(t.notice), `online 3D zonder OpenFreeMap: laag stil weggehaald, geen melding`);
  await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(false)); await page.waitForTimeout(1500);
  const t2 = await page.evaluate(() => { const m = window.SLCT.map.map; return m.getLayer('ofm-3d') ? m.getLayoutProperty('ofm-3d', 'visibility') : 'geen'; });
  if (ofm === 'ok') check(t2 === 'none', `terug naar 2D: gebouwen van OpenFreeMap uit (${t2})`);
  check(errors.length === 0, `online (${ofm === 'ok' ? 'met' : 'zonder'} OpenFreeMap): consolefouten ${errors.length}${errors.length ? '\n     ' + errors.slice(0, 4).join('\n     ') : ''}`);
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
// 6. Framerate (SwiftShader: software, dus laag) en schermafbeeldingen
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
