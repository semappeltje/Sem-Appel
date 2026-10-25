// Controle van de 3D-wereld (src/scene3d.js) in een echte browser: bouwtijd, beeldsnelheid in 2D en 3D, klikken en
// aanwijzen via de straal (pick), geen consolefouten, en geen geheugengroei na drie keer 3D uit en aan.
//
//   npm run build && (cd dist && python3 -m http.server 8773 --bind 127.0.0.1) &
//   node tests/3d-check.mjs [http://127.0.0.1:8773/index.html]
//
// Draait in Chromium met de software-GPU (swiftshader): beelden per seconde zeggen daar weinig (3 tot 8 is normaal) en
// worden alleen gemeld. Wat wel telt: tekenopdrachten en driehoeken per beeld op zoom 11, 13,6 en 16 (de LOD), en de
// bouwtijd. Playwright komt uit de app, de map erboven of de globale installatie.
import { createRequire } from 'node:module';
import path from 'node:path';
const tryReq = base => { try { return createRequire(base)('playwright'); } catch { return null; } };
const pw = tryReq(import.meta.url) || tryReq(path.join(process.cwd(), 'x.js')) || tryReq('/opt/node22/lib/node_modules/') || tryReq(path.join(process.env.NODE_PATH || '/', 'x.js'));
if (!pw) { console.error('playwright niet gevonden (npm i -D playwright, of NODE_PATH naar de globale installatie)'); process.exit(2); }
const url = process.argv[2] || 'http://127.0.0.1:8773/index.html';

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|cartocdn|openfreemap/.test(m.text())) errors.push(m.text().slice(0, 240)); });
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 240)));
// geen verzoeken naar buiten (zoals ingebed in SafeTail): de wereld moet zonder internet compleet zijn
await page.route('**/*', route => { const u = new URL(route.request().url()); return u.host && u.host !== new URL(url).host && !/^(data|blob):/.test(route.request().url()) ? route.abort('blockedbyclient') : route.continue(); });
await page.addInitScript(() => { try { localStorage.setItem('sl-theme', 'light'); localStorage.removeItem('sl-3d'); localStorage.setItem('sl-online', 'off'); } catch { /* geen opslag */ } });
await page.goto(url);
await page.waitForFunction(() => window.SLCT && window.SLCT.fleet && document.getElementById('loading').hidden, null, { timeout: 120000 });
for (let i = 0; i < 3; i++) { const b = await page.$('#wzNext'); if (b) { await b.click(); await page.waitForTimeout(150); } }
await page.waitForTimeout(800);

let fail = 0; const out = {};
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
// camera verzetten en wachten tot de 3D-laag (als die aan staat) minstens twee nieuwe beelden heeft getekend: op een
// drukke machine met de software-GPU duurt een beeld soms een seconde
const jump = async o => {
  const f0 = await page.evaluate(o => { const m = window.SLCT.map.map; if (m.getMaxZoom() < (o.zoom || 0)) m.setMaxZoom(o.zoom); m.jumpTo(o); window.SLCT.ui.frame && window.SLCT.ui.frame(true); const s = window.SLCT.map.scene3d && window.SLCT.map.scene3d(); return s && s.isOn() ? s.stats().frames : -1; }, o);
  if (f0 >= 0) await page.waitForFunction(f0 => { const s = window.SLCT.map.scene3d(); window.SLCT.map.map.triggerRepaint(); return s.stats().frames >= f0 + 2; }, f0, { timeout: 30000, polling: 100 }).catch(() => {});
};
const fps = (ms = 4000) => page.evaluate(ms => new Promise(r => { let n = 0; const t0 = performance.now(); const tick = () => { n++; window.SLCT.map.map.triggerRepaint(); if (performance.now() - t0 < ms) requestAnimationFrame(tick); else r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); }; requestAnimationFrame(tick); }), ms);
const s3 = () => page.evaluate(() => { const s = window.SLCT.map.scene3d && window.SLCT.map.scene3d(); return s ? s.stats() : null; });
const SP = await page.evaluate(() => { const t = window.SLCT.fleet.trucks.find(t => t.base.n === 'Wognum'); return t ? [t.base.lon, t.base.lat] : [5.021, 52.672]; });

// 1. platte kaart als maatstaf
await jump({ center: SP, zoom: 13.6, pitch: 0, bearing: 0 }); await page.waitForTimeout(1500);
out.fps2d = await fps();
// 2. 3D aan: tijd tot het eerste beeld (bundel laden, wereld maken), daarna de wereld rond de standplaats
const t0 = await page.evaluate(() => { const t = performance.now(); window.SLCT.ui.ctx.set3dMode(true); return t; });
await page.waitForFunction(() => { const s = window.SLCT.map.scene3d && window.SLCT.map.scene3d(); return s && s.stats().frames > 0; }, null, { timeout: 60000 });
out.firstFrameMs = Math.round(await page.evaluate(t0 => { const s = window.SLCT.map.scene3d().stats(); return s.enabledAt - t0 + s.firstFrameMs; }, t0));
await jump({ center: SP, zoom: 13.6, pitch: 58, bearing: -18 }); await page.waitForTimeout(3000);
let st = await s3(); out.worldBuildMs = st.buildMs; out.depotsBuilt = st.depotsBuilt;
out.fps3d_136 = await fps(); st = await s3(); out.calls136 = st.info.calls; out.tris136 = st.info.triangles;
await jump({ center: SP, zoom: 16, pitch: 60, bearing: -18 }); await page.waitForTimeout(3000);
out.fps3d_16 = await fps(); st = await s3(); out.calls16 = st.info.calls; out.tris16 = st.info.triangles; out.renderMs16 = +st.renderMs.toFixed(1);
out.times = { createMs: st.createMs, rendererMs: st.rendererMs, layoutMs: st.layoutMs, ownMeshMs: st.buildMs, neighbourMs: st.nbMs, assetMs: st.assetMs, pieceMs: st.pieceMs, firstRenderMs: st.firstRenderMs, firstFrameMs: out.firstFrameMs, prepared: st.prepared };
// de wereld bouwen = vaste meshes, texturen en materialen (createScene3d zonder de WebGL-renderer) + de indeling van de
// plekken in beeld (terrein, gebouwen, rijen, docks, poort, bomen) + hun eigen meshes. De buurt komt een beeld later en
// de CC0-modellen laden tegelijk met de gebouwenbundel; die staan erbij. Het eerste beeld (shaders vertalen) staat los.
const worldMs = st.createMs - st.rendererMs + st.layoutMs + st.buildMs;
// 300 ms is het budget op een laptop; op een gedeelde machine zonder GPU (SwiftShader, andere processen) rekken we tot 450 ms.
check(worldMs < 450, `wereld gebouwd in ${worldMs} ms (vaste meshes ${st.createMs - st.rendererMs}, indeling ${st.layoutMs} voor ${st.prepared} plekken, ${out.depotsBuilt} standplaatsen ${st.buildMs}); daarna de buurt ${st.nbMs} ms; CC0-bomen ${st.assetMs} ms en fabrieksdetails ${st.pieceMs} ms, tegelijk met de gebouwen; renderer ${st.rendererMs} ms, eerste beeld ${st.firstRenderMs} ms`);
check(out.firstFrameMs < 15000, `eerste 3D-beeld na ${out.firstFrameMs} ms vanaf de klik (swiftshader; incl. wachten op beelden van de kaart)`);
await jump({ center: [4.95, 52.5], zoom: 11, pitch: 55, bearing: 0 }); await page.waitForTimeout(3000);
out.fps3d_11 = await fps(3000); st = await s3(); out.calls11 = st.info.calls; out.tris11 = st.info.triangles;
check(out.calls11 <= 90 && out.tris11 <= 250000, `zoom 11 (overzicht): ${out.calls11} tekenopdrachten, ${out.tris11} driehoeken (hooguit 90 en 250.000)`);
check(out.calls136 <= 120 && out.tris136 <= 450000, `zoom 13,6 (Wognum): ${out.calls136} tekenopdrachten, ${out.tris136} driehoeken (hooguit 120 en 450.000)`);
check(out.calls16 <= 150 && out.tris16 <= 450000, `zoom 16 (Wognum): ${out.calls16} tekenopdrachten, ${out.tris16} driehoeken (hooguit 150 en 450.000)`);
console.log(`INFO beeldsnelheid (software-GPU, alleen ter informatie): 2D ${out.fps2d}, 3D op 11 ${out.fps3d_11}, op 13,6 ${out.fps3d_136}, op 16 ${out.fps3d_16}`);

// 3. klikken en aanwijzen: een rijdend voertuig dichtbij, op zoom 16,5 recht in beeld
const tgt = await page.evaluate(() => {
  const f = window.SLCT.fleet, T = window.SLCT.state.simTime; window.SLCT.state.playing = false;
  for (const t of f.trucks) { const s = f.stateAt(t, T); if (s.st === 'onderweg' && t.kind === 'trekker' && s.tr) return { id: t.id, lon: s.pos.lon, lat: s.pos.lat }; }
  return null;
});
if (tgt) {
  await jump({ center: [tgt.lon, tgt.lat], zoom: 16.5, pitch: 55, bearing: 0 }); await page.waitForTimeout(1500);
  // De kaart tekent een rijdend voertuig tussen twee simulatiestappen in (vloeiend rijden, sinds de kaartronde van 4.0); neem dus
  // de getekende positie (mapApi.vehiclePos) en val alleen zonder die functie terug op de simulatiestand.
  const p = await page.evaluate(id => { const m = window.SLCT.map.map; const v = window.SLCT.map.vehiclePos && window.SLCT.map.vehiclePos(id); const s = v || window.SLCT.fleet.stateAt(window.SLCT.fleet.byId.get ? window.SLCT.fleet.byId.get(id) : window.SLCT.fleet.trucks.find(t => t.id === id), window.SLCT.state.simTime).pos; const q = m.project([s.lon, s.lat]); return { x: q.x, y: q.y }; }, tgt.id);
  // Een simulatiestap die nog onderweg was toen playing op false ging, kan het voertuig een stuk verder zetten dan de camera
  // verwacht; zet de camera dan opnieuw op het voertuig en zoek in een kleine straal, zoals bij de oplegger hieronder.
  const off = Math.hypot(p.x - 682, p.y - 400) > 120;
  if (off) { const v = await page.evaluate(id => window.SLCT.map.vehiclePos(id), tgt.id); if (v) { await jump({ center: [v.lon, v.lat], zoom: 16.5, pitch: 55, bearing: 0 }); await page.waitForTimeout(800); const q = await page.evaluate(w => { const q = window.SLCT.map.map.project([w.lon, w.lat]); return { x: q.x, y: q.y }; }, v); p.x = q.x; p.y = q.y; } }
  const hits = await page.evaluate(([p]) => { const sc = window.SLCT.map.scene3d(); const r = []; for (const dy of [0, -6, -12, 6]) { const h = sc.pick({ x: p.x, y: p.y + dy }); r.push(h ? h.id : '-'); } if (!r.some(Boolean)) return r; for (let rad = 5; rad <= 30 && !r.includes(window.__tgt); rad += 5) for (let a = 0; a < 6.28; a += 0.5) { const h = sc.pick({ x: p.x + Math.cos(a) * rad, y: p.y + Math.sin(a) * rad }); if (h && !r.includes(h.id)) r.push(h.id); } return r; }, [p]);
  check(hits.includes(tgt.id), `pick op ${tgt.id}: ${hits.join(' ')}`);
  const box = await page.evaluate(() => { const r = window.SLCT.map.map.getCanvas().getBoundingClientRect(); return { x: r.left, y: r.top }; });
  const at = hits.indexOf(tgt.id); const dy = [0, -6, -12, 6][Math.max(0, at)];
  await page.mouse.move(box.x + p.x, box.y + p.y + dy); await page.waitForTimeout(400);
  await page.mouse.click(box.x + p.x, box.y + p.y + dy); await page.waitForTimeout(600);
  const sel = await page.evaluate(() => { const t = window.SLCT.ui.ctx.selTruck(); return t && t.id; });
  check(sel === tgt.id, `klik selecteert ${tgt.id} (geselecteerd: ${sel})`);
  await page.evaluate(() => { window.SLCT.state.playing = true; });
} else check(false, 'geen rijdend voertuig gevonden voor de klik');
// en een losse oplegger bij een klant
const tr = await page.evaluate(() => { const f = window.SLCT.fleet, T = window.SLCT.state.simTime; for (const tr of f.trailers) { const s = f.trailerStateAt(tr, T); if (s.st === 'wacht' || s.st === 'geladen') return { id: tr.id, lon: s.pos.lon, lat: s.pos.lat }; } return null; });
if (tr) {
  await jump({ center: [tr.lon, tr.lat], zoom: 16.5, pitch: 55, bearing: 10 }); await page.waitForTimeout(1500);
  const h = await page.evaluate(w => { const m = window.SLCT.map.map; const p = m.project([w.lon, w.lat]); const sc = window.SLCT.map.scene3d(); for (let r = 0; r <= 60; r += 6) for (let a = 0; a < 6.28; a += r ? 0.5 : 7) { const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; const q = sc.pick({ x, y }); if (q && q.trailer) return q.id; } return null; }, tr);
  check(!!h, `pick op een losse oplegger bij de klant (${tr.id}): ${h || '-'}`);
}

// 4. geheugen: drie keer 3D uit en aan, daarna even rust en een opruimbeurt
const mem = () => page.evaluate(async () => { if (window.gc) { window.gc(); window.gc(); } await new Promise(r => setTimeout(r, 300)); const s = window.SLCT.map.scene3d().stats(); return { heap: performance.memory ? performance.memory.usedJSHeapSize : 0, geo: s.info ? s.info.geometries : 0, tex: s.info ? s.info.textures : 0, ownGeo: s.owned.geometries, ownTex: s.owned.textures, depots: s.depotsBuilt + s.sitesBuilt + (s.nbBuilt || 0) }; });
// eerst één keer uit en aan (wat dan voor het eerst getekend wordt, komt eenmalig op de GPU; dat is geen lek)
const cycle = async () => { await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(false)); await page.waitForTimeout(1200); await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(true)); await page.waitForTimeout(1200); await jump({ center: SP, zoom: 15, pitch: 58, bearing: -18 }); await page.waitForTimeout(1500); };
await jump({ center: SP, zoom: 15, pitch: 58, bearing: -18 }); await page.waitForTimeout(2000); await cycle();
const m0 = await mem();
for (let i = 0; i < 3; i++) await cycle();
const m1 = await mem();
out.memory = { voor: m0, na: m1 };
// op de GPU nooit meer geometrieën dan de wereld zelf bezit (een standplaats die onderweg voor het eerst in beeld komt,
// wordt gebouwd en hoort er dan bij; dat is geen lek), en het bezit groeit alleen met nieuw gebouwde standplaatsen
check(m1.geo <= m1.ownGeo + 2 && m1.ownGeo <= m0.ownGeo + 10 * (m1.depots - m0.depots) && m1.tex <= m1.ownTex + 6, `GPU-geheugen na 3x uit/aan: geometrieën ${m0.geo} → ${m1.geo} (in bezit ${m0.ownGeo} → ${m1.ownGeo}; plekken en buurten gebouwd ${m0.depots} → ${m1.depots}), texturen ${m0.tex} → ${m1.tex} (in bezit ${m1.ownTex})`);
check(!m0.heap || m1.heap < m0.heap * 1.25 + 8e6, `JS-heap ${(m0.heap / 1e6).toFixed(1)} → ${(m1.heap / 1e6).toFixed(1)} MB`);

// 5. uit: terug naar de platte kaart zonder fouten
await page.evaluate(() => window.SLCT.ui.ctx.set3dMode(false)); await page.waitForTimeout(1200);
check(!(await page.evaluate(() => window.SLCT.map.scene3d().isOn())), '3D uit');
check(errors.length === 0, `consolefouten: ${errors.length}${errors.length ? '\n   ' + errors.slice(0, 6).join('\n   ') : ''}`);
console.log(JSON.stringify(out));
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
