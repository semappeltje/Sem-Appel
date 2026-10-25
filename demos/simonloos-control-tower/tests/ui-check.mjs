// Functionele controle van de interface (Control Tower 4.0), met Playwright tegen de gebouwde app.
//
//   cd dist && python3 -m http.server 8774 --bind 127.0.0.1      (of een andere poort)
//   node tests/ui-check.mjs 8774 [gl|nogl] [plain|embedded]
//
// Opvolger van fn-check.mjs (ronde 4, 37 gedragingen). Elk oud gedrag staat er nog in, aangepast aan de nieuwe indeling;
// waar de 4.0-interface het anders doet, staat de reden bij de check ("4.0:"). Daarna de nieuwe delen: zoeken op
// MiniSearch, meldingen als zaken (sleutel, deadline, wacht op, bord), detailpagina's (statusbalk, slimme knoppen,
// logboek), planbord (slepen, toetsen, pool, docks, toetsenbord), contextmenu, kaartje, bevestigen, overzicht, ritten,
// rapporten (uPlot), instellingen, sneltoetsen en de telefoon (390 px). Stopt met code 1 bij een fout.
// Met de kaart van 4.0 (alleen met WebGL): volgen doet de kaart (mapApi.follow), een treffer van buiten de kaart vliegt
// erheen met een ring (mapApi.flyTo), een klik op een voertuig in beeld laat de kaart staan, een DC opent zijn paneel.
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , port = '8774', mode = 'gl', variant = 'plain'] = process.argv;
const url = /^\d+$/.test(port) ? `http://127.0.0.1:${port}/index.html` : port;
const args = mode === 'gl' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--disable-gpu', '--disable-software-rasterizer', '--disable-3d-apis'];
const browser = await chromium.launch({ args });
let fail = 0, n = 0; const tag = `${mode}-${variant}`;
const check = (ok, msg) => { n++; console.log(`${ok ? 'OK ' : 'FOUT'} ${tag} ${msg}`); if (!ok) fail++; };
const note = msg => console.log(`--  ${tag} ${msg}`);
const errors = [];
const nieuwePagina = async (vp = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 500, hasTouch: vp.width < 500, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', route => { const u = new URL(route.request().url()); if (u.host !== new URL(url).host) return route.abort('blockedbyclient'); return route.continue(); });
  if (variant === 'embedded') await page.route(url, async route => { const res = await route.fetch(); const body = (await res.text()).replace('class="app slct"', 'class="app slct" data-tiles="off" data-embedded'); await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/html; charset=utf-8' } }); });
  return { ctx, page };
};
const { page } = await nieuwePagina();
const klaar = () => page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300_000, polling: 500 });
const load = async () => {
  await page.goto(url, { waitUntil: 'load' }); await klaar(); await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) { const b = await page.$('#wzNext'); if (b && await b.isVisible()) { await b.click(); await page.waitForTimeout(150); } }
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.SLCT.state.playing = false; document.getElementById('app').focus(); });
};
await page.goto(url, { waitUntil: 'load' }); await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
await load();
const setT = T => page.evaluate(T => { window.SLCT.state.simTime = T; window.SLCT.ui.frame(true); window.SLCT.ui.ctx.refreshAll(); }, T);
const hashIs = () => page.evaluate(() => decodeURIComponent(location.hash));
const go = async (h, w = 450) => { await page.evaluate(h => { location.hash = '#' + h; }, h); await page.waitForTimeout(w); };
const toast = () => page.evaluate(() => [...document.querySelectorAll('#toasts .toast span')].map(x => x.textContent.trim()).slice(-1)[0] || '');
const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(150); };

// ======================= A. routes en terugknop (fn-check 1–10) =======================
await go('opleggers');
check(await page.evaluate(() => document.getElementById('v-opleggers').classList.contains('on')), 'hash #opleggers opent de weergave Opleggers');
await go('voertuig/T-1002', 600);
check(await page.evaluate(() => window.SLCT.ui.ctx.selTruck() && window.SLCT.ui.ctx.selTruck().id === 'T-1002' && document.getElementById('panel').classList.contains('open') && !!document.getElementById('openSheet')), 'hash #voertuig/T-1002: geselecteerd op de kaart met voertuigpaneel');
await go('voertuig/T-1002/onderhoud', 500);
check(await page.evaluate(() => !document.getElementById('sheet').hidden && (document.querySelector('#sheet .tabs [aria-selected="true"]') || {}).textContent === 'Onderhoud'), 'hash #voertuig/T-1002/onderhoud: pagina op tab Onderhoud');
await page.goBack(); await page.waitForTimeout(600);
check(await page.evaluate(() => document.getElementById('sheet').hidden && window.SLCT.ui.ctx.selTruck() && window.SLCT.ui.ctx.selTruck().id === 'T-1002'), `terugknop: pagina dicht, voertuig nog geselecteerd (${await hashIs()})`);
await go('oplegger/O-5150', 600);
check(await page.evaluate(() => window.SLCT.ui.ctx.selTrailer() && window.SLCT.ui.ctx.selTrailer().id === 'O-5150' && !!document.getElementById('trlMap')), 'hash #oplegger/O-5150: opleggerpaneel met knop Toon op kaart');
await go('persoon/P-0001', 500);
check(await page.evaluate(() => !document.getElementById('sheet').hidden && /Chauffeurs/.test(document.querySelector('#sheet .crumbs').textContent)), 'hash #persoon/P-0001: persoonspagina (4.0: kruimelpad Chauffeurs in plaats van Mensen)');
await go('standplaats/Wognum', 600);
check(await page.evaluate(() => document.getElementById('sheet').hidden && !!document.querySelector('#panel .yard') && /^Wognum/.test(document.querySelector('#panel .pnl-h h2').textContent.trim())), 'hash #standplaats/Wognum: standplaatspaneel met terreinlijst');
await page.evaluate(() => { window.SLCT.ui.ctx.clearSps(); window.SLCT.ui.ctx.closePanel(); window.SLCT.ui.frame(true); });
await go('onzin/x/y', 300); await go('planbord', 900);
check(await page.evaluate(() => document.getElementById('v-planbord').classList.contains('on')), 'onbekende hash doet niets; #planbord daarna werkt');
await page.evaluate(() => window.SLCT.ui.setView('mensen')); await page.waitForTimeout(250);
check((await hashIs()) === '#chauffeurs', `setView zet de hash (${await hashIs()}; 4.0: de oude naam "mensen" leidt naar Chauffeurs)`);
await go('hal/Wognum', 700);
const halRows = await page.evaluate(() => [...document.querySelectorAll('#hal .halline time small')].map(x => x.textContent));
check(halRows.length > 0 && halRows.every(x => /^(over \d+ min|nu|vertrokken|te laat \+\d+)$/.test(x)), `hal-aftelling per rij: ${halRows.slice(0, 4).join(' · ')}`);
const halDock = await page.evaluate(() => [...document.querySelectorAll('#hal .halline em')].map(x => x.textContent));
check(halDock.length > 0 && halDock.every(x => /^(\d+|–)$/.test(x)), `hal: dock uit het plan, of – bij een vertrek van de parkeerplek (${[...new Set(halDock)].slice(0, 6).join(', ')})`);
await page.evaluate(() => window.SLCT.ui.ctx.hashTo('')); await page.waitForTimeout(400);

// ======================= B. planbord (fn-check 11–14, plus slepen, pool, docks) =======================
await page.evaluate(() => window.SLCT.ui.setView('planbord')); await setT(600); await page.waitForTimeout(1200);
// rijen op het bord: de teller boven het bord ("225 van 225 voertuigen · ..."); svelte-gantt tekent alleen wat in beeld is
const rijen = () => page.evaluate(() => +(((document.querySelector('#v-planbord [data-pb=cnt]') || {}).textContent || '').match(/^(\d+)/) || [0, 0])[1]);
const pb0 = await rijen();
// 4.0, rustiger: divisie, soort en status zitten achter de knop Filters; de uitleg voor de eerste keer staat boven het bord
const hint = await page.evaluate(() => { const h = document.querySelector('#v-planbord [data-pb=hint]'); return h && !h.hidden ? h.textContent : ''; });
check(/Planning aanpassen/.test(hint) && /Sleep een rit/.test(hint) && /Rit inplannen/.test(hint), 'planbord: de eerste keer een korte uitleg (slepen, pijltjes, Rit inplannen)');
await page.click('#v-planbord [data-pbfilters]'); await page.waitForTimeout(300);
const soorten = await page.$$eval('#pbKind option', x => x.map(o => o.value));
await page.selectOption('#pbKind', soorten.find(v => v !== 'alle')); await page.waitForTimeout(1200);
const pb1 = await rijen();
check(pb1 > 0 && pb1 < pb0, `planbordfilter soort (${soorten.find(v => v !== 'alle')}): ${pb1} van ${pb0} rijen`);
await page.selectOption('#pbKind', 'alle'); const divs = await page.$$eval('#pbDiv option', x => x.map(o => o.value)); await page.selectOption('#pbDiv', divs.find(v => v !== 'alle')); await page.waitForTimeout(1200);
const pb2 = await rijen();
check(pb2 > 0 && pb2 <= pb0, `planbordfilter divisie (${divs.find(v => v !== 'alle')}): ${pb2} rijen`);
await page.selectOption('#pbDiv', 'alle'); await page.waitForTimeout(1200);
await esc();
// klik op een blok: uitleg in een popover; "Bekijk dit moment" zet de klok op het begin van de rit (4.0: de klik opent eerst
// de uitleg, het tijdstip kiezen is een knop daarin)
// een punt op een blok dat echt bovenaan ligt (niet onder de tabel links of de bak onderaan)
const opBlok = sel => page.evaluate(sel => { for (const x of document.querySelectorAll(sel)) { const r = x.getBoundingClientRect(); if (r.width < 24) continue; const px = r.left + Math.min(16, r.width / 2), py = r.top + r.height / 2; const h = document.elementFromPoint(px, py); if (h && h.closest('.sg-task') === x) return { id: x.getAttribute('data-task-id'), x: px, y: py }; } return null; }, sel);
const bp = await opBlok('#v-planbord .sg-task.pb-rit'); const blok = bp && bp.id;
if (blok) {
  await page.mouse.click(bp.x, bp.y); await page.waitForTimeout(500);
  const pop = await page.evaluate(() => !document.getElementById('popover').hidden && !!document.querySelector('#popover [data-pbopen^="rit/"]'));
  const start = await page.evaluate(id => { const r = window.SLCT.ui.ctx.R.get(id); return r.t.dayStart + r.t.plan[r.i0].t0; }, blok);
  await page.click('#popover [data-pbreplay]'); await page.waitForTimeout(400);
  const T = await page.evaluate(() => window.SLCT.state.simTime);
  check(pop && Math.abs(T - (((start % 1440) + 1440) % 1440)) < 0.6, `klik op blok ${blok}: uitleg met Open rit; "Bekijk dit moment" zet de klok op ${T.toFixed(1)} (begin ${start.toFixed(1)})`);
} else check(false, 'geen ritblok in beeld op het planbord');
await setT(600); await page.waitForTimeout(600);
const nl = () => page.evaluate(() => { const x = document.querySelector('#v-planbord .sg-time-range.pb-nu'); return x ? x.getBoundingClientRect().left : null; });
const nl1 = await nl(); await page.evaluate(() => { window.SLCT.state.simTime += 20; window.SLCT.ui.frame(); window.SLCT.ui.ctx.refreshAll(); }); await page.waitForTimeout(500); const nl2 = await nl();
check(nl1 !== null && nl2 !== null && nl2 > nl1, `nu-lijn loopt mee met de klok (${nl1 && nl1.toFixed(0)} → ${nl2 && nl2.toFixed(0)} px)`);
await setT(600); await page.waitForTimeout(800);
// slepen naar een ongeldige plek: de rit gaat terug en het bord zegt waarom
const sleep = await page.evaluate(() => {
  const c = window.SLCT.ui.ctx;
  for (const x of document.querySelectorAll('#v-planbord .sg-task.pb-rit:not(.vast)')) { const r = x.getBoundingClientRect(); if (r.width < 40 || r.bottom > innerHeight - 300) continue; const px = r.left + Math.min(30, r.width / 2), py = r.top + r.height / 2; const h = document.elementFromPoint(px, py); if (!h || h.closest('.sg-task') !== x) continue; const rit = c.R.get(x.getAttribute('data-task-id')); if (!rit) continue; return { id: rit.id, t: rit.t.id, x: px, y: py }; }
  return null;
});
if (sleep) {
  await page.mouse.move(sleep.x, sleep.y); await page.mouse.down(); await page.mouse.move(sleep.x + 6, sleep.y + 4, { steps: 3 }); await page.mouse.move(sleep.x + 30, sleep.y + 44 * 2, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(1300);
  const na = await page.evaluate(id => { const r = window.SLCT.ui.ctx.R.get(id); return r ? r.t.id : null; }, sleep.id); const t1 = await toast();
  check((na === sleep.t && /kan niet naar|al werk|begonnen/.test(t1)) || (na !== sleep.t && /Rit .* naar /.test(t1)), `slepen: rit ${sleep.id} ${na === sleep.t ? 'terug met de reden' : `naar ${na}`} (${t1.slice(0, 110)})`);
} else note('geen sleepbare rit in beeld');
// toetsenbord: pijl rechts schuift 5 minuten of zegt waarom niet
const kb = await page.evaluate(() => { const c = window.SLCT.ui.ctx; for (const x of document.querySelectorAll('#v-planbord .sg-task.pb-rit:not(.vast)')) { const rit = c.R.get(x.getAttribute('data-task-id')); if (rit && c.state.simTime < rit.t.dayStart + rit.t.plan[rit.i0].t0 - 30) return { id: rit.id, s: rit.t.dayStart + rit.t.plan[rit.i0].t0 }; } return null; });
if (kb) {
  await page.focus(`#v-planbord [data-task-id="${kb.id}"]`); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200);
  const s2 = await page.evaluate(id => { const r = window.SLCT.ui.ctx.R.get(id); return r ? r.t.dayStart + r.t.plan[r.i0].t0 : null; }, kb.id); const t2 = await toast();
  check(Math.abs(s2 - kb.s - 5) < 0.6 || /kan niet|al werk/.test(t2), `pijl rechts op rit ${kb.id}: ${Math.abs(s2 - kb.s - 5) < 0.6 ? '5 minuten later' : `niet verschoven: ${t2.slice(0, 80)}`}`);
} else note('geen rit om met het toetsenbord te schuiven');
// "Waar past hij?" vanuit de bak Niet ingepland
const pool0 = await page.$$eval('#v-planbord [data-pk]', x => x.length);
const pk = await page.$('#v-planbord [data-pkwaar]');
if (pk) {
  await pk.click(); await page.waitForTimeout(1500);
  const K = await page.$$eval('#dialog .kd-i', x => x.length); const mag = await page.$$eval('#dialog [data-kies^="eigen:"]', x => x.length);
  check(K > 0, `poolrit: ${K} kandidaten, ${mag} mogen (getoetst op de regels)`);
  if (mag) { await page.click('#dialog [data-kies^="eigen:"]'); await page.waitForTimeout(1500); const t3 = await toast(); const pool1 = await page.$$eval('#v-planbord [data-pk]', x => x.length); check(/Gevraagd aan|Ingepland op/.test(t3) && pool1 === pool0 - 1, `poolrit toegewezen (4.0: de vraag gaat uit, de rit wacht op een ja): ${t3.slice(0, 90)} (bak ${pool0} → ${pool1})`); }
  else await esc();
} else note('de bak Niet ingepland is leeg op dit moment');
await page.selectOption('#pbPer', 'dock'); await page.waitForTimeout(1500);
check(await page.$$eval('#v-planbord .sg-task.pb-dock', x => x.length) > 0, 'planbord per dock: koppelen, laden en retouren per dock (fleet.dockPlan)');
await page.selectOption('#pbPer', 'voertuig'); await page.waitForTimeout(800);
// "Verplaats deze rit" (zaak, ritpagina, ritten): #planbord/R-... zet het bord van die standplaats klaar, met het blok gekozen
const vr = await page.evaluate(() => { const c = window.SLCT.ui.ctx; const T = c.state.simTime; const r = c.R.all().find(x => x.t.base.n !== 'Wognum' && c.R.stateOf(x, T, c.S).st === 'gepland' && x.dep > T + 60 && x.dep < T + 300); return r ? { id: r.id, sp: r.t.base.n } : null; });
if (vr) {
  await page.evaluate(id => { location.hash = '#planbord/' + id; }, vr.id); await page.waitForTimeout(1800);
  const fs = await page.evaluate(id => { const n = document.querySelector(`#v-planbord [data-task-id="${id}"]`); return { sel: !!(n && (n.classList.contains('sg-task-selected') || n.classList.contains('pb-focus'))), focus: document.activeElement && document.activeElement.getAttribute('data-task-id'), sp: (document.getElementById('pbSel') || {}).value, view: document.querySelector('#views > .view.on').id }; }, vr.id);
  const tv = await toast();
  check(fs.view === 'v-planbord' && fs.sp === vr.sp && fs.sel && fs.focus === vr.id && /staat klaar/.test(tv), `Verplaats deze rit: #planbord/${vr.id} opent het bord van ${fs.sp}, het blok gekozen en met de focus (${tv.slice(0, 60)})`);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200);
  const tv2 = await toast();
  check(/verschoven|kan niet|al werk/.test(tv2), `en meteen met de pijltjes te schuiven (${tv2.slice(0, 70)})`);
  await page.evaluate(() => { const c = window.SLCT.ui.ctx; c.setPbSp(window.SLCT.fleet.trucks.find(t => t.base.n === 'Wognum').base); });
} else note('geen geplande rit buiten Wognum in de komende uren');

// ======================= C. voorstellen passen het plan echt aan (fn-check 15–25) =======================
const TIMES = [690, 540, 840, 420, 990, 1110, 600, 750, 480, 900, 1200, 360];
const opZaak = (L, id) => `${L}:${id}`;
async function vindVoorstel(kind) { for (const T of TIMES) { await setT(T); const p = await page.evaluate(k => { const P = window.SLCT.ui.ctx.voorstellen().find(x => x.kind === k); return P ? { id: P.id, key: P.key } : null; }, kind); if (p) return { T, ...p }; } return null; }
// de knop Pas toe in het assistentpaneel (dat ververst elke beurt: klikken in de pagina zelf)
const pasToe = async id => { await page.evaluate(() => window.SLCT.ui.ctx.toggleAssist(true)); await page.waitForTimeout(400); const ok2 = await page.evaluate(id => { const b = document.querySelector(`#panel [data-pastoe="${id}"]`); if (b) { b.click(); return true; } return false; }, id); if (!ok2) await page.evaluate(id => window.SLCT.ui.ctx.applyProposal(window.SLCT.ui.ctx.voorstelById(id)), id); await page.waitForTimeout(500); };
const nogOpen = (L, id) => page.evaluate(([L, id]) => window.SLCT.ui.ctx.Z.list().some(z => z.key.startsWith(`${L}:${id}`) && z.open), [L, id]);
const applied0 = await page.evaluate(() => window.SLCT.ui.ctx.applied.length);
const planOf = id => page.evaluate(id => { const t = window.SLCT.fleet.byId.get(id); return t.plan.map(s => [s.k, +s.t0.toFixed(2), +s.t1.toFixed(2), !!s.ingevoegd]); }, id);
const summaries = {};
const aaneen = id => page.evaluate(id => { const t = window.SLCT.fleet.byId.get(id); return t.plan.every((s, i) => i === 0 || Math.abs(t.plan[i - 1].t1 - s.t0) < 1e-6); }, id);
// Rijtijd: sinds de tweede dataronde zeldzaam (de planning plant de pauze na 3:45 tot 4:25 rijden); is er geen voorstel,
// dan de actie zelf op een rijdend voertuig
{
  const pr = await vindVoorstel('Rijtijd'); let tid;
  if (pr) { tid = pr.id.slice(1); await pasToe(pr.id); }
  else { await setT(690); tid = await page.evaluate(() => { const f = window.SLCT.fleet; const t = f.trucks.find(x => x.kind !== 'bus' && x.vandaag === 'inzet' && f.stateAt(x, 690).seg.k === 'drive' && f.stateAt(x, 690).drive > 90); window.SLCT.ui.runAction({ k: 'pauze', t: t.id, T: 690, place: null }, true); window.SLCT.ui.frame(true); return t.id; }); note(`geen voorstel Rijtijd op de testtijden (zeldzaam sinds de geijkte dag); actie pauze direct op ${tid}`); }
  const a = await page.evaluate(id => { const f = window.SLCT.fleet; const t = f.byId.get(id); const seg = t.plan.find(s => s.k === 'pauze' && s.ingevoegd); const st = seg && f.stateAt(t, t.dayStart + seg.t0 + 1); const later = seg && f.stateAt(t, t.dayStart + seg.t1 + 3); return { seg: !!seg, at: seg && seg.at, st: st && st.st, drive: later && later.drive, msgs: (t.msgs || []).length }; }, tid);
  check(a.seg && a.st === 'pauze' && a.drive < 10 && !(await nogOpen('R', tid)) && a.msgs >= 1 && await aaneen(tid), `Rijtijd ${tid}: pauze ingevoegd (${a.at || 'binnen 8 km'}), status pauze, rijtijd daarna ${a.drive && a.drive.toFixed(0)} min, melding dicht, bericht verstuurd, plan aaneengesloten`);
  summaries[tid] = await planOf(tid);
}
{
  const pa = await vindVoorstel('Accu'); let tid;
  if (pa) { tid = pa.id.slice(1); await pasToe(pa.id); }
  else { await setT(690); tid = await page.evaluate(() => { const f = window.SLCT.fleet; const t = f.trucks.find(x => x.ev && x.vandaag === 'inzet' && f.stateAt(x, 690).seg.k === 'drive'); window.SLCT.ui.runAction({ k: 'laden', t: t.id, T: 690, sp: null }, true); window.SLCT.ui.frame(true); return t.id; }); note(`geen voorstel Accu op de testtijden; actie laden direct op ${tid}`); }
  const a = await page.evaluate(id => { const f = window.SLCT.fleet; const t = f.byId.get(id); const seg = t.plan.find(s => s.k === 'laden' && s.ingevoegd); const s0 = seg && f.stateAt(t, t.dayStart + seg.t0 - 1); const s1 = seg && f.stateAt(t, t.dayStart + seg.t1 + 2); return { seg: !!seg, soc0: s0 && s0.soc, soc1: s1 && s1.soc }; }, tid);
  check(a.seg && a.soc1 > a.soc0 + 20 && !(await nogOpen('A', tid)) && await aaneen(tid), `Accu ${tid}: laadblok ingevoegd, accu ${a.soc0 && a.soc0.toFixed(0)} % → ${a.soc1 && a.soc1.toFixed(0)} %, melding dicht`);
  summaries[tid] = await planOf(tid);
}
{
  const po = await vindVoorstel('Oplegger');
  if (!po) note('geen voorstel Oplegger op de testtijden');
  else {
    const trid = po.id.slice(1); await pasToe(po.id);
    const a = await page.evaluate(trid => { const f = window.SLCT.fleet; const tr = f.trailerById.get(trid); const T = window.SLCT.state.simTime; const s = f.trailerStateAt(tr, T); const t = tr.pickupBy && tr.pickupBy.t; const later = t && f.trailerStateAt(tr, tr.pickupBy.at + 1); return { st: s.st, by: t && t.id, laterSt: later && later.st, laterVeh: later && later.vehicle && later.vehicle.id, msgs: t && (t.msgs || []).length }; }, trid);
    check(a.st === 'ophalen' && a.laterSt === 'gekoppeld' && a.laterVeh === a.by && !(await nogOpen('O', trid)) && a.msgs >= 1, `Oplegger ${trid}: wordt opgehaald door ${a.by}, daarna gekoppeld achter ${a.laterVeh}, melding dicht`);
    if (a.by) summaries[a.by] = await planOf(a.by);
  }
}
{
  const pt = await vindVoorstel('Techniek');
  if (!pt) check(false, 'geen voorstel Techniek gevonden op de testtijden');
  else {
    const tid = pt.id.slice(1); await pasToe(pt.id);
    const a = await page.evaluate(id => { const t = window.SLCT.fleet.byId.get(id); const r = t.reserveFor && t.reserveFor.r; return { wo: t.workorder && typeof t.workorder === 'object' && !!t.workorder.gepland, reserve: r && r.id }; }, tid);
    check(a.wo && !(await nogOpen('T', tid)), `Techniek ${tid}: werkorder gepland, melding dicht${a.reserve ? `, dienst naar reserve ${a.reserve}` : ''}`);
    await go(`voertuig/${tid}/onderhoud`, 500);
    check(await page.evaluate(() => /gepland/.test((document.querySelector('#sheet [data-sec="werkorder"]') || {}).textContent || '')), 'voertuigpagina Onderhoud toont de werkorder als gepland');
    await page.evaluate(() => window.SLCT.ui.ctx.closePage());
    summaries[tid] = await planOf(tid);
  }
}
{
  const pv = await vindVoorstel('Vertraging');
  if (!pv) check(false, 'geen voorstel Vertraging gevonden op de testtijden');
  else {
    const tid = pv.id.slice(1); await pasToe(pv.id);
    const a = await page.evaluate(id => { const f = window.SLCT.fleet; const t = f.byId.get(id); const s = f.stateAt(t, window.SLCT.state.simTime); return { st: s.st, shifted: t.diensten.map(d => d.shifted || 0), resolved: !!t.delayResolved || t.diensten.some(d => d.shifted) }; }, tid);
    check(a.resolved && !(await nogOpen('V', tid)) && a.st !== 'vertraagd' && await aaneen(tid), `Vertraging ${tid}: ${a.shifted.some(x => x) ? 'dienst schuift op' : 'ETA geaccepteerd, venster bijgesteld'}, status ${a.st}, melding dicht`);
    summaries[tid] = await planOf(tid);
  }
}
{
  const pk2 = await vindVoorstel('Koeling');
  if (pk2) { const trid = pk2.id.slice(1); await pasToe(pk2.id); check(await page.evaluate(trid => !!window.SLCT.fleet.trailerById.get(trid).workorder, trid) && !(await nogOpen('K', trid)), `Koeling ${trid}: werkorder, melding dicht`); }
  else note('geen voorstel Koeling op de testtijden (hangt van de vriesoplegger af)');
}
await setT(540);
const sh = await page.evaluate(() => { const f = window.SLCT.fleet; const T = 540; const t = f.trucks.find(x => x.diensten.length === 2 && x.diensten[1].start > T + 60 && x.kind === 'trekker' && !x.diensten[1].shifted); if (!t) return null; const d = t.diensten[1]; const before = { start: d.start, n: t.plan.length }; window.SLCT.ui.runAction({ k: 'schuif', t: t.id, d: 1, min: 15, T }, true); window.SLCT.ui.frame(true); return { id: t.id, before, after: { start: d.start, n: t.plan.length, shifted: d.shifted } }; });
check(sh && sh.after.start === sh.before.start + 15 && sh.after.shifted === 15 && await aaneen(sh.id), `dienst opschuiven ${sh && sh.id}: start ${sh && sh.before.start.toFixed(0)} → ${sh && sh.after.start.toFixed(0)}, plan aaneengesloten`);
if (sh) summaries[sh.id] = await planOf(sh.id);
const mv = await page.evaluate(() => { const f = window.SLCT.fleet; const T = 540; const t = f.trucks.find(x => x.diensten.length === 2 && x.diensten[1].start > T + 60 && !x.diensten[1].shifted && f.trucks.some(r => r.base === x.base && r.kind === x.kind && r.vandaag === 'reserve')); if (!t) return null; const r = f.trucks.find(r => r.base === t.base && r.kind === t.kind && r.vandaag === 'reserve'); const d = t.diensten[1]; const p = d.person; t.storing = t.storing || 'Melding uitlaatgasnabehandeling, vermogen begrensd'; window.SLCT.ui.runAction({ k: 'werkorder', t: t.id, T, gepland: 'na de dienst in garage Wognum', reserve: r.id, dienst: 1 }, true); window.SLCT.ui.frame(true); const mid = r.dayStart + d.t0 + 40; const sr = f.stateAt(r, mid); return { t: t.id, r: r.id, tD: t.diensten.length, rD: r.diensten.length, rVandaag: r.vandaag, pDienst: p && p.dienst && p.dienst.t === r, rSt: sr.st, rDriver: sr.driver, replaces: !!(r.replaces && r.replaces.t === t) }; });
check(mv && mv.tD === 1 && mv.rD === 1 && mv.rVandaag === 'inzet' && mv.pDienst && mv.rSt !== 'terrein' && !!mv.rDriver && mv.replaces, `dienst naar reserve: ${mv && mv.t} → ${mv && mv.r} (${mv && mv.rSt} met ${mv && mv.rDriver})`);
if (mv) { summaries[mv.t] = await planOf(mv.t); summaries[mv.r] = await planOf(mv.r); }
await setT(990);
const rp = await page.evaluate(() => { const f = window.SLCT.fleet; const T = 990; const c = window.SLCT.ui.ctx; const P = window.SLCT.people; const e = c.exceptions().find(x => x.kind === 'Oplegger' && f.trucks.some(r => r.base === x.tr.base && r.kind === 'trekker' && r.vandaag === 'reserve') && P.persons.some(p => p.base === x.tr.base && !p.dienst && p.div !== 'bezorg')); if (!e) return null; const tr = e.tr; const r = f.trucks.find(r => r.base === tr.base && r.kind === 'trekker' && r.vandaag === 'reserve'); const p = P.persons.find(p => p.base === tr.base && !p.dienst && p.div !== 'bezorg'); window.SLCT.ui.runAction({ k: 'ophalen', t: r.id, tr: tr.id, person: p.id, T }, true); window.SLCT.ui.frame(true); const s = f.trailerStateAt(tr, T); const sr = f.stateAt(r, T + 2); return { tr: tr.id, r: r.id, st: s.st, rSt: sr.st, rDriver: sr.driver, pDienst: !!(p.dienst && p.dienst.t === r), deps: f.departures(tr.base, T, 240).some(d => d.t === r) }; });
if (rp) { check(rp.st === 'ophalen' && rp.rSt === 'onderweg' && !!rp.rDriver && rp.pDienst && rp.deps, `ophalen door reserve: ${rp.r} haalt ${rp.tr} op, staat op het vertrekbord, chauffeur ${rp.rDriver}`); summaries[rp.r] = await planOf(rp.r); }
else note('om 16:30 geen oplegger die te laat is met een reserve en een vrije chauffeur ernaast');
await page.evaluate(() => window.SLCT.ui.ctx.toggleAssist(true)); await page.waitForTimeout(400);
const tellers = await page.evaluate(() => { const c = window.SLCT.ui.ctx; const z = c.Z.counts(); const bell = document.getElementById('bellCnt'); const sub = (document.querySelector('#panel .pnl-h .sub') || {}).textContent || ''; return { open: z.open, bell: bell && !bell.hidden ? +bell.textContent : 0, props: document.querySelectorAll('#panel [data-pastoe]').length, voorstellen: c.voorstellen().length, sub, applied: c.applied.length, subN: +(sub.match(/(\d+) voorstellen/) || [0, -1])[1], subA: +(sub.match(/(\d+) vandaag toegepast/) || [0, -1])[1] }; });
check(tellers.bell === tellers.open && tellers.subN === tellers.voorstellen && tellers.subA === tellers.applied && tellers.applied > applied0, `tellers gelijk: bel ${tellers.bell}/${tellers.open} open, voorstellen ${tellers.subN}/${tellers.voorstellen}, toegepast ${tellers.subA}/${tellers.applied}`);
await page.evaluate(() => window.SLCT.ui.ctx.closePanel());

// ======================= D. meldingen als zaken (fn-check 26–29, plus sleutel, deadline, bord) =======================
let Tm = null; for (const T of [600, 540, 690, 450, 840, 990, 400, 720, 780, 1080]) { await setT(T); const k = await page.evaluate(() => window.SLCT.ui.ctx.Z.open().length); if (k >= 2) { Tm = T; break; } }
check(Tm !== null, `tijd met minstens twee open zaken: ${Tm} (4.0: de geijkte dag heeft minder uitzonderingen)`);
const zk = await page.evaluate(() => window.SLCT.ui.ctx.Z.open().map(z => ({ key: z.key, id: z.id, kind: z.kind, rit: z.rit, deadline: z.deadline, since: z.since, norm: z.norm })));
check(zk.length && zk.every(z => /^[A-Z]:[A-Z]-\d+(:R-.+)?$/.test(z.key) && (z.kind === 'Koeling' || z.kind === 'Oplegger' || z.rit === null || z.key.endsWith(':' + z.rit)) && z.deadline === z.since + z.norm), `zaken hebben een vaste sleutel (soort, object, rit) en een deadline: ${zk.slice(0, 2).map(z => z.key).join(', ')}`);
const [za, zb] = zk;
await page.evaluate(([a, b]) => { const Z = window.SLCT.ui.ctx.Z; Z.setStatus([Z.get(a)], 'wacht', 30, 'chauffeur'); Z.assign([Z.get(b)], 'Anouk Groot'); }, [za.key, zb.key]); await page.waitForTimeout(300);
const zs1 = await page.evaluate(([a, b]) => { const Z = window.SLCT.ui.ctx.Z; const h = JSON.parse(localStorage.getItem('sl-acties')).handled; return { a: Z.get(a).status, wachtOp: Z.get(a).wachtOp, until: h[a] && h[a].until, b: Z.get(b).status, who: h[b] && h[b].who }; }, [za.key, zb.key]);
check(zs1.a === 'wacht' && zs1.wachtOp === 'chauffeur' && zs1.until > Tm && zs1.b === 'behandeling' && zs1.who === 'Anouk Groot', `wacht op chauffeur tot ${zs1.until && zs1.until.toFixed(0)}, toegewezen aan Anouk Groot, bewaard in sl-acties (${za.key}: ${zs1.a}/${zs1.wachtOp}; ${zb.key}: ${zs1.b}/${zs1.who})`);
await setT(Tm + 35);
check(await page.evaluate(k => { const z = window.SLCT.ui.ctx.Z.get(k); return !z || z.status !== 'wacht'; }, za.key), 'een zaak die wacht, komt na 30 minuten terug (of is vanzelf opgelost)');
await setT(Tm);
// bord: vier kolommen, slepen en Alt met pijl
await go('meldingen', 700);
await page.click('[data-mview="bord"]'); await page.waitForTimeout(600);
const kol = await page.$$eval('#v-meldingen .kb-col', x => x.map(c => c.dataset.kcol).join(','));
check(kol === 'nieuw,behandeling,wacht,opgelost', `meldingen als bord per status: ${kol}`);
const kaartKey = await page.evaluate(() => { const c = document.querySelector('#v-meldingen .kb-col[data-kcol="nieuw"] [data-kz]'); return c ? c.dataset.kz : null; });
if (kaartKey) {
  await page.locator(`#v-meldingen [data-kz="${kaartKey}"]`).dragTo(page.locator('#v-meldingen .kb-col[data-kcol="behandeling"] .kb-l')); await page.waitForTimeout(800);
  const s1 = await page.evaluate(k => window.SLCT.ui.ctx.Z.get(k).status, kaartKey);
  await page.focus(`#v-meldingen [data-kz="${kaartKey}"]`); await page.keyboard.press('Alt+ArrowRight'); await page.waitForTimeout(800);
  const s2 = await page.evaluate(k => window.SLCT.ui.ctx.Z.get(k).status, kaartKey);
  check(s1 === 'behandeling' && s2 === 'wacht', `bord: slepen zet de zaak in behandeling (${s1}), Alt met pijl rechts op wacht (${s2})`);
} else note('geen nieuwe zaak om te slepen');
await page.click('[data-mview="lijst"]'); await page.waitForTimeout(400);
const tabs = await page.evaluate(() => { const c = window.SLCT.ui.ctx.Z.counts(); const t = [...document.querySelectorAll('#v-meldingen [data-mtab] .n')].map(x => +x.textContent.replace(/\D/g, '')); return { c, t }; });
check(tabs.t.join(',') === [tabs.c.open, tabs.c.wacht, tabs.c.opgelost, tabs.c.alle].join(','), `tabtellers gelijk aan de zaken: ${tabs.t.join(', ')}`);
// zaakpagina: statusbalk, slimme knoppen, logboek
const zaakId = await page.evaluate(() => { const z = window.SLCT.ui.ctx.Z.open()[0] || window.SLCT.ui.ctx.Z.list()[0]; return z && z.id; });
if (zaakId) {
  await go(`melding/${zaakId}`, 700);
  const zp = await page.evaluate(() => ({ bar: document.querySelectorAll('#sheet .sbar li').length, cur: (document.querySelector('#sheet .sbar li.cur') || {}).textContent, sb: document.querySelectorAll('#sheet .smart .sb').length, log: document.querySelectorAll('#sheet .tline .tli').length, veh: document.querySelectorAll('#sheet .tline .tli.veh').length }));
  check(zp.bar === 4 && zp.sb >= 2 && zp.log >= 2, `zaakpagina: statusbalk (${zp.cur}), ${zp.sb} slimme knoppen, logboek met ${zp.log} regels waarvan ${zp.veh} van het voertuig (fleet.eventsOf)`);
  const knop = await page.$('#sheet .sbar [data-zset="behandeling"]');
  if (knop) { await knop.click(); await page.waitForTimeout(500); check(await page.evaluate(() => (document.querySelector('#sheet .sbar li.cur') || {}).textContent === 'In behandeling'), 'statusbalk: klik op In behandeling zet de status'); }
  const lijst = await page.$('#sheet .smart [data-open^="lijst:meldingen"]');
  if (lijst) { await lijst.click(); await page.waitForTimeout(800); const q = await page.evaluate(() => (document.querySelector('#v-meldingen [data-tv=q]') || {}).value || ''); check(/^[A-Z]-\d+$/.test(q) && await page.evaluate(() => document.getElementById('v-meldingen').classList.contains('on')), `slimme knop "meldingen vandaag" opent de lijst gefilterd op ${q}`); await page.evaluate(() => window.SLCT.ui.ctx.ui.meldTable.setSearch('')); }
}
// herladen geeft dezelfde toestand: ook het zoekwoord van een tabel en de statusfilter van de kaart (acceptatie E)
await go('voertuigen', 900); await page.fill('#v-voertuigen [data-tv=q]', 'Wognum'); await page.waitForTimeout(500);
await page.evaluate(() => { const c = window.SLCT.ui.ctx; c.F.sts = new Set(['vertraagd', 'onderweg']); c.frame(true); }); await page.waitForTimeout(700);
// herladen: dezelfde plannen, zaken, sleutels en berichten
const keysVoor = await page.evaluate(() => window.SLCT.ui.ctx.Z.list().map(z => z.key).sort());
const applied1 = await page.evaluate(() => window.SLCT.ui.ctx.applied.length);
await page.reload({ waitUntil: 'load' }); await klaar(); await page.waitForTimeout(800); await page.evaluate(() => { window.SLCT.state.playing = false; }); await setT(Tm); await page.waitForTimeout(1500);
const st2 = await page.evaluate(([a, b, sums]) => { const c = window.SLCT.ui.ctx; const same = Object.entries(sums).map(([id, plan]) => { const t = window.SLCT.fleet.byId.get(id); return JSON.stringify(t.plan.map(s => [s.k, +s.t0.toFixed(2), +s.t1.toFixed(2), !!s.ingevoegd])) === JSON.stringify(plan); }); const zb = c.Z.get(b); return { who: zb && zb.who, applied: c.applied.length, same, wizard: document.getElementById('wizard').hidden, msgs: window.SLCT.fleet.trucks.filter(t => t.msgs && t.msgs.length).length, keys: c.Z.list().map(z => z.key).sort() }; }, [za.key, zb.key, summaries]);
const gedeeld = keysVoor.filter(k => st2.keys.includes(k)).length;
check(st2.wizard && st2.who === 'Anouk Groot' && st2.applied === applied1 && st2.same.every(Boolean) && st2.same.length >= 3 && st2.msgs >= 1, `na herlaad: toegewezen zaak terug, ${st2.applied} toegepast, ${st2.same.filter(Boolean).length}/${st2.same.length} plannen identiek, berichten terug`);
check(gedeeld >= Math.min(keysVoor.length, st2.keys.length) * 0.8, `zaaksleutels na herlaad dezelfde (${gedeeld} van ${keysVoor.length})`);
await go('voertuigen', 900);
const stand = await page.evaluate(() => ({ q: (document.querySelector('#v-voertuigen [data-tv=q]') || {}).value, sts: [...window.SLCT.ui.ctx.F.sts].sort().join() }));
check(stand.q === 'Wognum' && stand.sts === 'onderweg,vertraagd', `na herlaad: het zoekwoord van Voertuigen ("${stand.q}") en de statusfilter van de kaart (${stand.sts}) staan er nog`);
await page.evaluate(() => { const c = window.SLCT.ui.ctx; if (c.ui.vTable) c.ui.vTable.resetFilters(); c.F.sts = new Set(['vertraagd', 'onderweg', 'klant', 'pauze', 'terrein']); c.frame(true); });
await page.fill('#v-voertuigen [data-tv=q]', ''); await page.waitForTimeout(400);

// ======================= E. panelen, volgen (fn-check 30–32) =======================
await page.evaluate(() => window.SLCT.ui.selectTrailer('O-5150')); await page.waitForTimeout(500);
await page.click('#trlMap'); await page.waitForTimeout(500);
check(await page.evaluate(() => window.SLCT.ui.ctx.trailersOnMap() && document.querySelector('#views > .view.on').id === 'v-kaart'), 'opleggerpaneel: Toon op kaart zet de laag aan en gaat naar de kaart');
await page.evaluate(() => window.SLCT.ui.selectSp(window.SLCT.fleet.trucks[0].base)); await page.waitForTimeout(500);
const spp = await page.evaluate(() => ({ yard: document.querySelectorAll('#panel .yard').length, deps: !!document.querySelector('#panel .deps'), hash: decodeURIComponent(location.hash) }));
check(spp.yard >= 1 && spp.deps && /^#standplaats\//.test(spp.hash), `standplaatspaneel: vertrekken en terrein, hash ${spp.hash}`);
await page.evaluate(() => window.SLCT.ui.ctx.clearSps());
await page.evaluate(() => window.SLCT.ui.selectTruck('T-1002')); await page.waitForTimeout(300);
await page.evaluate(() => document.getElementById('app').focus());
await page.keyboard.press('f'); await page.waitForTimeout(200);
check(await page.evaluate(() => window.SLCT.ui.ctx.follow()), 'toets f zet volgen aan');
if (mode === 'gl') { await page.waitForTimeout(300); const fv = await page.evaluate(() => window.SLCT.map.following()); check(fv === 'T-1002', `volgen doet de kaart zelf (mapApi.follow): ${fv}`); }
await page.keyboard.press('f'); await page.waitForTimeout(250);
if (mode === 'gl') check(await page.evaluate(() => window.SLCT.map.following() === null && !window.SLCT.ui.ctx.follow()), 'nog een keer f: de kaart volgt niet meer');
await page.evaluate(() => window.SLCT.ui.ctx.clearSel());
// een treffer van buiten de kaart (zoeken, een lijst, een pagina) vliegt erheen met een ring; een klik op de kaart niet
if (mode === 'gl') {
  await page.evaluate(() => { const S = window.SLCT; const p = S.map.vehiclePos('T-1005'); if (p) S.map.map.jumpTo({ center: [p.lon + 1.5, p.lat], zoom: 11 }); }); await page.waitForTimeout(400);
  await page.evaluate(() => window.SLCT.ui.ctx.go('kaart:truck:T-1005')); await page.waitForTimeout(300);
  const mk = await page.evaluate(() => window.SLCT.map.debug().mark); await page.waitForTimeout(1200);
  const zicht = await page.evaluate(() => { const S = window.SLCT; const p = S.map.vehiclePos('T-1005'); return p ? S.map.inView(p.lon, p.lat, 40) : false; });
  check(mk && zicht, `vanuit een lijst of zoeken vliegt de kaart naar T-1005 met een ring (mapApi.flyTo; ring ${mk}, in beeld ${zicht})`);
  // pas meten als de camera stilstaat (met SwiftShader loopt de vlucht soms langer dan 1,2 s)
  await page.waitForFunction(() => !window.SLCT.map.map.isMoving(), null, { timeout: 20000, polling: 200 }).catch(() => {});
  const c0 = await page.evaluate(() => { const c = window.SLCT.map.map.getCenter(); return [c.lng, c.lat]; });
  await page.evaluate(() => window.SLCT.ui.selectTruck('T-1005')); await page.waitForTimeout(700);
  const c1 = await page.evaluate(() => { const c = window.SLCT.map.map.getCenter(); return [c.lng, c.lat]; });
  check(Math.abs(c0[0] - c1[0]) < 1e-6 && Math.abs(c0[1] - c1[1]) < 1e-6, 'een klik op een voertuig dat al in beeld is: de kaart blijft staan');
  await page.evaluate(() => window.SLCT.ui.ctx.clearSel());
}
const plekId = await page.evaluate(() => { for (const t of window.SLCT.fleet.trucks) for (const s of t.plan) if (s.k === 'stop' && s.place && s.place.id && s.place.soort) return s.place.id; return null; });
if (plekId) {
  await page.evaluate(id => window.SLCT.ui.selectPlace({ type: 'dc', id }), plekId); await page.waitForTimeout(500);
  const pp = await page.evaluate(() => ({ mode: window.SLCT.ui.ctx.panelMode(), open: window.SLCT.ui.ctx.panelOpen(), hash: decodeURIComponent(location.hash) }));
  check(pp.mode === 'winkel' && pp.open && pp.hash === `#winkel/${plekId}`, `klik op een DC op de kaart (onSelectPlace): paneel van de plek, ${pp.hash}`);
  await page.evaluate(() => window.SLCT.ui.ctx.clearSel());
} else note('geen DC in de stops gevonden');

// ======================= F. zoeken (fn-check 33–36, plus MiniSearch) =======================
const zoek = async q => { await page.evaluate(() => { const i = document.getElementById('zoekIn'); i.value = ''; }); await page.focus('#zoekIn'); await page.fill('#zoekIn', q); await page.waitForTimeout(300); return page.evaluate(() => [...document.querySelectorAll('#zoekL .sg-item')].map(x => `${x.querySelector('.sg-type').textContent} ${x.querySelector('b').textContent}`)); };
const z1 = await zoek('werkorder');
check(z1.some(x => x.startsWith('Werkorder')), `zoeken "werkorder": ${z1.filter(x => x.startsWith('Werkorder')).length} werkorders`);
// (sinds de acceptatie-eisen van 4.0: een voertuig of oplegger uit zoeken opent als pagina, met de kaart erin die erheen
// vliegt; eerder opende hij op de kaart met het paneel)
const z2 = await zoek('O-5150'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
const z2p = await page.evaluate(() => ({ h: location.hash, kaart: !!document.querySelector('#sheet [data-mapslot] #map') || !!window.SLCT.map.noWebGL }));
check(z2.some(x => /O-5150/.test(x)) && /^#oplegger\/O-5150/.test(z2p.h) && z2p.kaart, `zoeken: O-5150 gevonden, Enter opent de opleggerpagina met de kaart erin (${z2p.h})`);
await page.evaluate(() => window.SLCT.ui.ctx.closePage()); await page.waitForTimeout(300);
// binnen 100 ms na typen de juiste treffer bovenaan: de lijst wordt bij elke toets direct opnieuw opgebouwd (MiniSearch)
const zt = await page.evaluate(() => { const i = document.getElementById('zoekIn'); i.focus(); const t = window.SLCT.fleet.trucks[7]; const q = t.plate.replace(/-/g, ''); const t0 = performance.now(); i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); const dt = performance.now() - t0; const top = document.querySelector('#zoekL .sg-item b'); return { dt, top: top ? top.textContent : '', id: t.id, q }; });
check(zt.dt < 100 && zt.top.includes(zt.id), `zoeken: kenteken ${zt.q} geeft ${zt.id} bovenaan in ${zt.dt.toFixed(1)} ms (hooguit 100)`);
const z3 = await zoek('Wognum');
check(z3.some(x => x.startsWith('Standplaats Wognum')), 'zoeken: standplaats vindbaar');
const trPlate = await page.evaluate(() => window.SLCT.fleet.trailers[5].plate);
const z4 = await zoek(trPlate);
check(z4.some(x => x.includes('O-')), `zoeken: opleggerkenteken ${trPlate} vindbaar`);
const z5 = await zoek('67JQZ'); const z6 = await zoek('67-JQZ'); const want = await page.evaluate(() => { const t = window.SLCT.fleet.trucks.find(x => x.plate === '67-JQZ-7' || x.plate.replace(/-/g, '').startsWith('67JQZ')); return t ? t.id : null; });
check(want && z5[0] && z5[0].includes(want) && z6[0] && z6[0].includes(want), `zoeken: kenteken met en zonder streepjes (${want}: ${z5[0]} / ${z6[0]})`);
const z7 = await zoek('wognm');
check(z7[0] && /Wognum/.test(z7[0]), `zoeken met een tikfout: "wognm" → ${z7[0]}`);
await zoek('lidl'); const g = await page.evaluate(() => (document.querySelector('#zoekL .zoek-g') || {}).textContent);
check(g === 'Standplaatsen', `zoeken op een klant: "lidl" geeft eerst de standplaatsen die ervoor rijden (${g})`);
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
check(await page.evaluate(() => document.getElementById('zoekIn').getAttribute('aria-activedescendant') === 'sg1' && document.getElementById('zoekIn').getAttribute('aria-expanded') === 'true'), 'zoeken: combobox met pijltjes (aria-activedescendant)');
await esc(); await esc();

// ======================= G. overzicht, ritten, rapporten, instellingen =======================
await page.evaluate(() => { window.SLCT.ui.ctx.Z.list(); }); await go('overzicht', 800);
const ov = await page.evaluate(() => ({ kpi: document.querySelectorAll('#v-overzicht .kpi').length, att: document.querySelectorAll('#v-overzicht [data-ov="att"] .att-i').length, open: window.SLCT.ui.ctx.Z.open().length, dag: (document.querySelector('#v-overzicht [data-ov="dag"]') || {}).textContent || '', dep: !!document.querySelector('#v-overzicht [data-ov="dep"] table, #v-overzicht [data-ov="dep"] .empty, #v-overzicht [data-ov="dep"] .ml') }));
check(ov.kpi === 3 && ov.att === Math.min(6, ov.open) && /diensten/.test(ov.dag) && /open rit|Geen open ritten/.test(ov.dag) && ov.dep, `overzicht: 3 kerngetallen (op tijd, vertraagd, open ritten), ${ov.att} zaken in Nu aandacht nodig (${ov.open} open), de dag in een regel (fleet.dagcijfers) en de open ritten`);
// de briefing bovenaan: speelt, open, risico, beslissen (en de overdracht als die er is), hooguit vijf regels, elk naar
// een zaak, een rit of de lijst erachter; de eerste regel opent zijn doel
const br = await page.evaluate(() => { const card = document.querySelector('#v-overzicht .brief'); const first = card && document.querySelector('#v-overzicht .page-in').firstElementChild === card; return { first, L: [...document.querySelectorAll('#v-overzicht .brief-i')].map(b => ({ k: b.querySelector('.brief-k').textContent.trim(), open: b.dataset.open || (b.dataset.ovover ? 'overdracht' : ''), t: b.querySelector('.brief-t').textContent.trim() })) }; });
const brK = br.L.map(x => x.k);
check(br.first && br.L.length >= 4 && br.L.length <= 5 && brK.slice(0, 4).join() === 'Speelt,Open,Risico,Beslissen' && br.L.every(x => x.open && x.t.length > 10), `overzicht: de briefing staat bovenaan, ${br.L.length} regels in de volgorde ${brK.join(', ')}, elk klikbaar (${br.L.map(x => x.open).join(', ')})`);
if (br.L[1] && br.L[1].open) { await page.click('#v-overzicht .brief-l li:nth-child(2) .brief-i'); await page.waitForTimeout(900); const h = await page.evaluate(() => location.hash); check(h === `#${br.L[1].open.replace(/^view:/, '')}`, `overzicht: de regel Open opent ${h}`); await go('overzicht', 600); }
await go('ritten', 800);
const rt = await page.evaluate(() => ({ rows: document.querySelectorAll('#v-ritten .tv-scroll tr[data-row]').length, cnt: (document.querySelector('#v-ritten [data-tv=cnt]') || {}).textContent }));
check(rt.rows > 0, `ritten: tabel met ${rt.rows} zichtbare rijen (${rt.cnt})`);
await page.click('#v-ritten .tv-scroll tr[data-row]', { button: 'right' }); await page.waitForTimeout(400);
const menu = await page.evaluate(() => [...document.querySelectorAll('#popover .menu-i')].map(b => b.textContent.trim()));
check(menu.some(x => /Open rit/.test(x)), `ritten: rechtermuisklik geeft acties (${menu.slice(0, 3).join(', ')})`);
await esc();
const hv = await page.$('#v-ritten .tv-scroll .plate[data-hc]');
if (hv) { await hv.hover(); await page.waitForTimeout(1200); const hc = await page.evaluate(() => { const c = document.getElementById('hcard'); const img = c && c.querySelector('.hc-foto img'); return c && !c.hidden ? { t: c.textContent, kt: !!c.querySelector('.kenteken'), beeld: img ? img.naturalWidth : -1, alt: img ? img.alt : '' } : { t: '', kt: false, beeld: -1, alt: '' }; }); check(/T-|B-|V-/.test(hc.t) && hc.kt && hc.beeld >= 320 && hc.alt.length > 10, `kaartje bij een voertuignummer: kenteken en beeld (${hc.t.slice(0, 40)}; ${hc.alt.slice(0, 40)})`); await page.mouse.move(2, 2); }
const ritId = await page.evaluate(() => { const c = window.SLCT.ui.ctx; const r = c.R.all().find(x => c.R.stateOf(x, c.state.simTime, c.S).st === 'gepland' && c.state.simTime < x.t.dayStart + x.t.plan[x.i0].t0 - 30); return r && r.id; });
await go(`rit/${ritId}`, 700);
const rpg = await page.evaluate(() => ({ bar: document.querySelectorAll('#sheet .sbar li').length, sb: document.querySelectorAll('#sheet .smart .sb').length, waar: !!document.querySelector('#sheet [data-ritwaar]') }));
check(rpg.bar === 4 && rpg.sb >= 3 && rpg.waar, `ritpagina ${ritId}: statusbalk, ${rpg.sb} slimme knoppen, knop Waar past hij?`);
await page.click('#sheet [data-ritwaar]'); await page.waitForTimeout(1500);
const kn = await page.$$eval('#dialog .wp-i', x => x.length);
check(kn > 0, `Waar past rit ${ritId}? ${kn} kandidaten, elk getoetst`);
const kies = await page.$('#dialog [data-kies]');
if (kies) { await kies.click(); await page.waitForTimeout(1500); const tt = await toast(); check(/Rit .*(naar|verschoven)/.test(tt), `Zet hier voert uit en stuurt een bericht (${tt.slice(0, 100)})`); } else await esc();
await go('rapporten', 1500);
const rap = await page.evaluate(() => ({ canvas: document.querySelectorAll('#v-rapporten .uplot canvas').length, wacht: !!document.querySelector('#v-rapporten #rp-wacht'), dag: (document.querySelector('#v-rapporten .dagc') || {}).textContent || '' }));
check(rap.canvas >= 1 && rap.wacht && /diensten/.test(rap.dag), `rapporten: op tijd per dag op uPlot (${rap.canvas} canvas), wachttijd per DC, de dag in cijfers`);
await page.click('#v-rapporten [data-rptbl="wacht"]'); await page.waitForTimeout(400);
check(await page.$$eval('#v-rapporten [data-chart="wacht"] tbody tr', x => x.length) > 0, 'rapporten: de tabel als tweeling van de grafiek');
await page.click('#v-rapporten [data-rptbl="wacht"]');
await go('laden', 1500);
check(await page.$$eval('#v-laden .uplot canvas', x => x.length) >= 2, 'laden: dagprijs en laadvermogen per kwartier op uPlot');
await go('instellingen', 700);
await page.fill('#setNaam', 'Kees Planner').catch(() => {}); await page.dispatchEvent('#setNaam', 'change').catch(() => {}); await page.waitForTimeout(300);
check(await page.evaluate(() => window.SLCT.ui.ctx.A.settings.naam() === 'Kees Planner'), 'instellingen: je naam wordt bewaard (ook in de zaken als "Aan mij")');
// wachten op de dialoog in plaats van een vaste 300 ms (met software-WebGL is de app soms trager)
await page.click('[data-wisalles]');
const dlg = await page.waitForSelector('dialog.cfm[open]', { timeout: 5000 }).then(() => true).catch(() => false);
await esc(); await page.waitForFunction(() => !document.querySelector('dialog.cfm'), null, { timeout: 5000 }).catch(() => {});
check(dlg && await page.evaluate(() => !document.querySelector('dialog.cfm') && !!localStorage.getItem('sl-werkgebied')), 'Alles wissen vraagt eerst om bevestiging (native dialog); Esc annuleert');
// kentekens als Nederlandse plaat en het beeld van het voertuig of de oplegger in de kop van de pagina
await go('voertuig/T-1014/vandaag', 1600);
// het beeld in de kop: een foto van het schaalmodel als die er is (afgeronde hoek, geen schaduw, "Foto: schaalmodel",
// bij twee foto's miniaturen om te wisselen), anders de render van het 3D-model ("Beeld: 3D-model")
const kopBeeld = () => page.evaluate(() => { const f = document.querySelector('#sheet .pg-h figure.pg-foto'); const box = f && f.querySelector('.pf-b'); const img = box && box.querySelector('img'); const b = f && f.querySelector('.pf-bron'); const cs = box ? getComputedStyle(box) : null; return { px: img ? img.naturalWidth : -1, alt: img ? img.alt : '', bron: b ? b.textContent : '', soort: f ? (f.classList.contains('is-foto') ? 'foto' : f.classList.contains('is-render') ? 'render' : '?') : '', mini: f ? f.querySelectorAll('.pf-t').length : 0, rond: cs ? parseFloat(cs.borderTopLeftRadius) : 0, schaduw: cs ? cs.boxShadow : '' }; });
const beeldKlopt = b => b.px >= 320 && (b.soort === 'foto' ? /schaalmodel/.test(b.alt) && b.bron === 'Foto: schaalmodel' && b.rond > 0 && b.schaduw === 'none' : b.soort === 'render' && /Trekker|Bakwagen|bestelbus|oplegger|Voertuig|Oplegger/i.test(b.alt) && b.bron === 'Beeld: 3D-model');
const vp = await page.evaluate(() => { const t = window.SLCT.fleet.byId.get('T-1014'); const k = document.querySelector('#sheet .pg-h .kenteken'); return { plaat: t.plate, kt: k ? k.textContent.replace(/^NL/, '') : '', geel: k ? getComputedStyle(k).backgroundColor : '' }; });
const vb = await kopBeeld();
check(vp.kt === vp.plaat && /247, 198, 0/.test(vp.geel) && beeldKlopt(vb), `voertuigpagina: kenteken ${vp.kt} als gele plaat, ${vb.soort} ${vb.px} px breed, "${vb.bron}" (${vb.alt.slice(0, 40)})`);
const metFoto = await page.evaluate(() => { const t = [...window.SLCT.fleet.byId.values()].find(x => x.kind === 'trekker' && !x.ev && /\bDAF\b/.test(x.model)); return t && t.id; });
const zonderFoto = await page.evaluate(() => { const t = [...window.SLCT.fleet.byId.values()].find(x => x.kind === 'trekker' && x.ev); return t && t.id; });
if (metFoto) {
  await go(`voertuig/${metFoto}/vandaag`, 1600);
  const fb = await kopBeeld();
  await page.click('#sheet .pg-foto .pf-t[data-i="1"]').catch(() => {}); await page.waitForTimeout(300);
  const zij = await page.evaluate(() => { const f = document.querySelector('#sheet .pg-foto'); const t = f && f.querySelector('.pf-t[data-i="1"]'); return { alt: f ? f.querySelector('.pf-b img').alt : '', aan: t ? t.getAttribute('aria-pressed') : '' }; });
  check(fb.soort === 'foto' && fb.px === 960 && /van voren/.test(fb.alt) && beeldKlopt(fb) && fb.mini === 2 && /van opzij/.test(zij.alt) && zij.aan === 'true', `voertuigpagina ${metFoto} (DAF): de voorfoto van het schaalmodel, "${fb.bron}", ${fb.mini} miniaturen, wisselen naar de zijfoto werkt (hoek ${fb.rond} px, schaduw ${fb.schaduw})`);
} else check(false, 'geen DAF-trekker in de vloot gevonden voor de foto');
if (zonderFoto) {
  await go(`voertuig/${zonderFoto}/vandaag`, 1600);
  const rb = await kopBeeld();
  check(rb.soort === 'render' && beeldKlopt(rb) && rb.mini === 0, `voertuigpagina ${zonderFoto} (elektrisch, geen foto): de render, "${rb.bron}", geen miniaturen`);
}
await go('oplegger/O-5001/vandaag', 1600);
const op = await page.evaluate(() => { const k = document.querySelector('#sheet .pg-h .kenteken.opl'); const tr = window.SLCT.fleet.trailerById.get('O-5001'); return { kt: k ? k.textContent.replace(/^NL/, '') : '', wit: k ? getComputedStyle(k).backgroundColor : '', type: tr ? tr.type : '' }; });
const ob = await kopBeeld();
check(/^O?[A-Z]{2}-\d{2}-[A-Z]{2}$|-/.test(op.kt) && /255, 255, 255/.test(op.wit) && beeldKlopt(ob) && (ob.soort === 'foto') === (op.type === 'koel' || op.type === 'vries'), `opleggerpagina: kenteken ${op.kt} als witte plaat, ${op.type}: ${ob.soort} ${ob.px} px breed, "${ob.bron}"`);
await page.evaluate(() => window.SLCT.ui.ctx.closePage && window.SLCT.ui.ctx.closePage());

// ======================= H. sneltoetsen =======================
await go('overzicht', 500); await page.evaluate(() => document.getElementById('app').focus());
await page.keyboard.press('/'); await page.waitForTimeout(200);
check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'zoekIn'), 'toets / zet de focus in het zoekveld');
await esc(); await esc(); await page.evaluate(() => document.getElementById('app').focus());
await page.keyboard.press('?'); await page.waitForTimeout(300);
check(await page.evaluate(() => !document.getElementById('dialog').hidden && /Sneltoetsen/.test(document.getElementById('dialog').textContent)), 'toets ? toont de sneltoetsen');
await esc(); await page.evaluate(() => { document.getElementById('dialog').hidden = true; document.getElementById('app').focus(); });
await page.keyboard.press('2'); await page.waitForTimeout(300);
const v2 = await page.evaluate(() => document.querySelector('#views > .view.on').id);
await page.keyboard.press('m'); await page.waitForTimeout(300);
const vm = await page.evaluate(() => document.querySelector('#views > .view.on').id);
check(v2 === 'v-kaart' && vm === 'v-meldingen', `cijfertoetsen en m wisselen van weergave (${v2}, ${vm})`);

// ======================= I. telefoon (390 px) =======================
{
  const { ctx: c2, page: p2 } = await nieuwePagina({ width: 390, height: 844 });
  await p2.goto(url, { waitUntil: 'load' }); await p2.evaluate(() => { try { localStorage.setItem('sl-werkgebied', JSON.stringify({ regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role: 'planner', sp: 'Wognum' })); } catch { /* */ } });
  await p2.reload({ waitUntil: 'load' }); await p2.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300_000, polling: 500 }); await p2.waitForTimeout(800);
  const res = [];
  for (const h of ['overzicht', 'ritten', 'meldingen', 'planbord', 'voertuigen', 'rapporten', 'instellingen']) { await p2.evaluate(h => { location.hash = '#' + h; }, h); await p2.waitForTimeout(700); res.push(await p2.evaluate(h => ({ h, sw: document.documentElement.scrollWidth, iw: innerWidth, bb: getComputedStyle(document.querySelector('.bottombar')).display !== 'none' }), h)); }
  check(res.every(r => r.sw <= r.iw && r.bb), `390 px: onderbalk en geen horizontale overloop in ${res.map(r => `${r.h}${r.sw > r.iw ? `(+${r.sw - r.iw})` : ''}`).join(', ')}`);
  await p2.evaluate(() => { location.hash = '#meldingen'; }); await p2.waitForTimeout(600);
  check(await p2.evaluate(() => !!document.querySelector('#v-meldingen .ml, #v-meldingen .empty')), '390 px: meldingen als lijst met twee regels per zaak');
  await c2.close();
}

// ======================= J. eindcontrole 4.0: kaart vanuit elke weergave, belmenu, zoeken, planbord, herladen =======================
// Een eigen pagina met het werkgebied Wognum (zoals de planner van Wognum om 05:30), zodat niets afhangt van wat hierboven
// gebeurde. De kaart wordt gemeten op het moment dat de camera landt (moveend), met lopende klok (12x): het doel moet dan
// in het midden van het vrije deel staan (onder de filterbalk, boven de tijdbalk, links van of boven het paneel).
const WOGNUM = { regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role: 'planner', sp: 'Wognum' };
async function paginaWognum(vp = { width: 1440, height: 900 }) {
  const r = await nieuwePagina(vp); const p = r.page;
  await p.goto(url, { waitUntil: 'load' });
  await p.evaluate(w => { try { localStorage.clear(); localStorage.setItem('sl-werkgebied', JSON.stringify(w)); } catch { /* geen opslag */ } }, WOGNUM);
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300_000, polling: 500 }); await p.waitForTimeout(1200);
  // de meting: het vrije deel uit de opmaak en waar het doel (voertuig-id of [lon, lat]) daarin staat (0 tot 1, 0,5 is het midden)
  await p.evaluate(() => {
    window.__vrij = () => {
      const m = window.SLCT.map.map; const C = m.getCanvas().getBoundingClientRect(); const tb = document.getElementById('timebar').getBoundingClientRect();
      let top = C.top; for (const k of document.getElementById('mapbar').children) { const b = k.getBoundingClientRect(); if (b.width && b.height) top = Math.max(top, b.bottom); }
      const pn = document.getElementById('panel'); const P = pn.classList.contains('open') ? pn.getBoundingClientRect() : null; const nar = document.getElementById('app').clientWidth <= 760;
      const V = { l: C.left, t: top, r: C.right, b: Math.min(C.bottom, tb.height ? tb.top : C.bottom) }; if (P) { if (nar) V.b = Math.min(V.b, P.top); else V.r = Math.min(V.r, P.left); }
      return { V, C };
    };
    window.__meet = () => { const d = window.__doel; const { V, C } = window.__vrij(); const m = window.SLCT.map.map; let ll = d; if (typeof d === 'string') { const v = window.SLCT.map.vehiclePos(d); ll = v ? [v.lon, v.lat] : null; } if (!ll) return null; const q = m.project(ll); return { fx: +((q.x + C.left - V.l) / (V.r - V.l)).toFixed(2), fy: +((q.y + C.top - V.t) / (V.b - V.t)).toFixed(2), zoom: +m.getZoom().toFixed(1) }; };
    window.__lnd = []; window.SLCT.map.map.on('moveend', () => { try { const x = window.__meet(); if (x) window.__lnd.push(x); } catch { /* geen doel */ } });
  });
  return { ...r, p };
}
const klokLoopt = p => p.evaluate(() => { const S = window.SLCT; S.state.simTime = 330; S.state.speed = 12; S.state.playing = true; S.ui.frame(true); S.ui.ctx.refreshAll(); });
const stilKaart = async p => { await p.waitForTimeout(250); await p.waitForFunction(() => !window.SLCT.map.map.isMoving(), null, { timeout: 20000, polling: 150 }).catch(() => {}); await p.waitForTimeout(250); };
const landing = p => p.evaluate(() => window.__lnd[window.__lnd.length - 1] || null);
const inMidden = x => !!x && x.fx > 0.35 && x.fx < 0.65 && x.fy > 0.35 && x.fy < 0.65;
// J15. de paginatitel in de topbalk: waar de zichtbare tekst eindigt tegen het begin van het zoekveld (op een telefoon de
// zoekknop), of hij met een ellips afbreekt als hij niet past, en of er rechts iets van de topbalk af valt
const titelMeet = () => {
  const top = document.getElementById('topbar').getBoundingClientRect(); const h = document.getElementById('vtitle'); const z = document.getElementById('zoek');
  const fs = z.querySelector('.fsearch'); const zl = (fs && fs.offsetParent ? fs : z).getBoundingClientRect().left;
  const hr = h.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(h); const tr = rg.getBoundingClientRect();
  const cs = getComputedStyle(h); const knipt = cs.overflowX === 'hidden'; const zicht = knipt ? Math.min(tr.right, hr.right) : tr.right;
  let rechts = 0; for (const k of document.querySelectorAll('.top-r *')) { const r = k.getBoundingClientRect(); if (r.width) rechts = Math.max(rechts, r.right); }
  return { t: h.textContent, onder: zicht > zl + 0.5, afgekapt: h.scrollWidth > h.clientWidth + 1, ellips: knipt && cs.textOverflow === 'ellipsis', breed: Math.round(Math.max(0, Math.min(hr.right, zl) - hr.left)), buiten: Math.round(rechts - top.right), a: decodeURIComponent(location.hash) };
};
// alle weergaven, vier zaken, een rit en een voertuigpagina; gewoon, krap (de chip van een oefendag zoals de werkstroom van
// de voorstellen hem in de topbalk zet, en de rol regiomanager met het langere label) en krap in het donker
async function titelToets(p, w) {
  const adressen = await p.evaluate(() => { const c = window.SLCT.ui.ctx; return [...document.querySelectorAll('#views > .view')].map(v => 'view:' + v.id.replace(/^v-/, '')).concat(c.Z.list().slice(0, 4).map(z => 'melding/' + z.id), [`rit/${c.R.all()[0].id}`, 'voertuig/T-1068/vandaag']); });
  const ronde = async () => {
    const fout = []; let n = 0, kort = 0, smalst = Infinity;
    for (const a of adressen) {
      await p.evaluate(a => window.SLCT.ui.ctx.go(a), a); await p.waitForTimeout(150);
      const m = await p.evaluate(titelMeet); n++; if (m.afgekapt) kort++; smalst = Math.min(smalst, m.breed);
      if (m.onder || m.buiten > 0 || (m.afgekapt && !m.ellips)) fout.push(`"${m.t}" (${m.a}${m.onder ? ', onder het zoekveld' : ''}${m.buiten > 0 ? `, ${m.buiten} px rechts eraf` : ''}${m.afgekapt && !m.ellips ? ', afgekapt zonder ellips' : ''})`);
    }
    return { n, kort, smalst, fout };
  };
  const gewoon = await ronde();
  await p.evaluate(() => { document.getElementById('clockBtn').insertAdjacentHTML('beforebegin', '<button class="badge b-info" type="button" id="oefenChipToets">Oefendag</button>'); window.SLCT.ui.ctx.setRole('regiomanager'); });
  await p.waitForTimeout(300);
  const krap = await ronde();
  await p.evaluate(() => window.SLCT.ui.ctx.toggleTheme()); await p.waitForTimeout(400);
  const donker = await ronde();
  await p.evaluate(() => { window.SLCT.ui.ctx.toggleTheme(); document.getElementById('oefenChipToets').remove(); window.SLCT.ui.ctx.setRole('planner'); });
  await p.waitForTimeout(300);
  const fout = [...gewoon.fout, ...krap.fout, ...donker.fout];
  // op 1440 past elke titel gewoon helemaal; krap houdt de titel minstens 120 px (op een telefoon 80 px)
  const min = w >= 1000 ? 120 : 80;
  check(!fout.length && (w < 1000 || gewoon.kort === 0) && krap.smalst >= min && donker.smalst >= min,
    `${w} px: de paginatitel valt nooit onder het zoekveld en rechts valt niets van de topbalk af (${gewoon.n} titels gewoon, ${gewoon.kort} afgekapt; krap met een chip en de rol regiomanager ${krap.kort} afgekapt met een ellips, de titel minstens ${krap.smalst} px; donker ${donker.kort} afgekapt)${fout.length ? `: ${fout.slice(0, 3).join('; ')}` : ''}`);
}
// een PNG van Playwright uitpakken (8 bits, RGB of RGBA, zonder interlace), voor de pixeltoets van de arcering
function pngPixels(buf) {
  let o = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o); const type = buf.toString('ascii', o + 4, o + 8); const data = buf.subarray(o + 8, o + 8 + len); if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; } else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break; o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3; const raw = zlib.inflateSync(Buffer.concat(idat)); const st = w * bpp; const out = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)]; const src = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); const row = out.subarray(y * st, (y + 1) * st); const prev = y ? out.subarray((y - 1) * st, y * st) : null;
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0; let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 255;
    }
  }
  return { w, h, px: (x, y) => { const i = y * st + x * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}
// kleurwissels langs een paar rijen: een arcering geeft er veel, een egaal blok weinig
const wissels = img => { let n = 0; for (const y of [Math.round(img.h * 0.3), Math.round(img.h * 0.5), Math.round(img.h * 0.7)]) { let prev = img.px(2, y); for (let x = 3; x < img.w - 2; x++) { const c = img.px(x, y); if (Math.abs(c[0] - prev[0]) + Math.abs(c[1] - prev[1]) + Math.abs(c[2] - prev[2]) > 45) n++; prev = c; } } return n; };
{
  const { ctx: cj, p } = await paginaWognum();
  // J1. vanaf het Overzicht (niet vanaf de kaart) naar de kaart: een gebeurtenis opent het voertuig midden in het vrije deel
  if (mode === 'gl') {
    await klokLoopt(p); await p.waitForTimeout(1500);
    // zoeken en klikken in een stap: met lopende klok tekent de lijst steeds opnieuw
    const id = await p.evaluate(() => { const b = document.querySelector('#v-overzicht [data-ov="log"] [data-open^="kaart:truck:"]'); if (!b) return null; const id = b.dataset.open.split(':')[2]; window.__doel = id; window.__lnd = []; b.click(); return id; });
    if (id) {
      await stilKaart(p);
      const l = await landing(p); const st = await p.evaluate(() => ({ h: decodeURIComponent(location.hash), view: document.querySelector('#views > .view.on').id, loopt: window.SLCT.state.playing }));
      check(inMidden(l) && st.view === 'v-kaart' && st.h === `#voertuig/${id}` && st.loopt, `vanaf het Overzicht naar de kaart (gebeurtenis, klok loopt): ${id} landt op ${l ? `${l.fx}, ${l.fy}` : 'niets'} van het vrije deel (0,5 is het midden), ${st.h}`);
    } else note('geen gebeurtenis met een voertuig op het Overzicht');
    // J3. zoeken op een plaats vanaf het Overzicht: de plaats bovenaan, Enter zet de kaart erop en het adres op #plaats/...
    await p.evaluate(() => window.SLCT.ui.ctx.go('view:overzicht')); await p.waitForTimeout(600);
    await p.evaluate(() => { window.__doel = null; const i = document.getElementById('zoekIn'); i.focus(); i.value = ''; });
    await p.keyboard.type('purmrend', { delay: 15 }); await p.waitForTimeout(250);
    const topPl = await p.evaluate(() => { const x = document.querySelector('#zoekL .sg-item'); return x ? `${x.querySelector('.sg-type').textContent}: ${x.querySelector('b').textContent}` : ''; });
    const plek = await p.evaluate(async () => { const d = await window.SLCT.map.map.getSource('places').getData(); const f = d.features.find(x => x.properties.n === 'Purmerend'); return f ? f.geometry.coordinates : null; });
    await p.evaluate(ll => { window.__doel = ll; window.__lnd = []; }, plek);
    await p.keyboard.press('Enter'); await stilKaart(p);
    const lp = await landing(p); const hp = await p.evaluate(() => decodeURIComponent(location.hash));
    check(topPl === 'Plaats: Purmerend' && hp === '#plaats/Purmerend' && inMidden(lp), `zoeken "purmrend" vanaf het Overzicht: ${topPl} bovenaan, Enter zet de kaart erop (${lp ? `${lp.fx}, ${lp.fy}` : 'niets'}) en het adres op ${hp}`);
    // J4. Route op de kaart vanuit Open ritten: de hele route in het vrije deel, het midden in het midden, adres #route/...
    await p.evaluate(() => window.SLCT.ui.ctx.go('view:openritten')); await p.waitForTimeout(1200);
    const rk = await p.evaluate(() => { const b = document.querySelector('#v-openritten [data-orkaart]'); if (!b) return false; b.click(); return true; });
    await stilKaart(p);
    if (rk) {
      const rt = await p.evaluate(async () => { const m = window.SLCT.map.map; const { V, C } = window.__vrij(); const d = await m.getSource('route').getData(); const pts = d.features.flatMap(f => f.geometry.type === 'LineString' ? f.geometry.coordinates : []); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of pts) { const s = m.project(q); x0 = Math.min(x0, s.x + C.left); x1 = Math.max(x1, s.x + C.left); y0 = Math.min(y0, s.y + C.top); y1 = Math.max(y1, s.y + C.top); } return { n: pts.length, past: x0 >= V.l && x1 <= V.r && y0 >= V.t && y1 <= V.b, cx: +(((x0 + x1) / 2 - V.l) / (V.r - V.l)).toFixed(2), cy: +(((y0 + y1) / 2 - V.t) / (V.b - V.t)).toFixed(2), z: +m.getZoom().toFixed(1), h: decodeURIComponent(location.hash) }; });
      check(rt.n > 1 && rt.past && Math.abs(rt.cx - 0.5) < 0.1 && Math.abs(rt.cy - 0.5) < 0.1 && /^#route\//.test(rt.h), `Route op de kaart: de route past in het vrije deel (midden ${rt.cx}, ${rt.cy}; zoom ${rt.z}), adres ${rt.h}`);
    } else note('geen open rit met een route');
  }
  // J5. het belmenu: een keuze opent de zaak, met de muis en met Enter
  await p.evaluate(() => window.SLCT.ui.ctx.go('view:overzicht')); await p.waitForTimeout(500);
  const heeftZaak = await p.evaluate(() => window.SLCT.ui.ctx.Z.open().length > 0);
  if (heeftZaak) {
    await p.click('#bellBtn'); await p.waitForTimeout(300);
    const z1 = await p.evaluate(() => { const b = document.querySelector('#popover [data-open^="melding/"]'); return b ? b.dataset.open : null; });
    await p.click('#popover [data-open^="melding/"]'); await p.waitForTimeout(700);
    const s1 = await p.evaluate(() => ({ h: decodeURIComponent(location.hash), pagina: !document.getElementById('sheet').hidden, pop: !document.getElementById('popover').hidden }));
    check(z1 && s1.h === `#${z1}` && s1.pagina && !s1.pop, `belmenu met de muis: ${z1} opent als pagina (${s1.h}), het menu is dicht`);
    await p.evaluate(() => window.SLCT.ui.ctx.closePage()); await p.waitForTimeout(300);
    await p.focus('#bellBtn'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const z2 = await p.evaluate(() => { const a = document.activeElement; return a && a.closest('#popover') && a.dataset.open ? a.dataset.open : null; });
    await p.keyboard.press('Enter'); await p.waitForTimeout(700);
    const s2 = await p.evaluate(() => ({ h: decodeURIComponent(location.hash), pagina: !document.getElementById('sheet').hidden }));
    check(z2 && s2.h === `#${z2}` && s2.pagina, `belmenu met het toetsenbord: Enter op de bel, Enter op ${z2} opent de zaak (${s2.h})`);
    await p.evaluate(() => window.SLCT.ui.ctx.closePage()); await p.waitForTimeout(300);
  } else note('geen open zaak voor het belmenu');
  // J6. zoeken: een kenteken met twee omgewisselde tekens, een plaats bovenaan, en snel na een wijziging in het plan
  await p.evaluate(() => window.SLCT.ui.ctx.go('view:overzicht')); await p.waitForTimeout(400);
  const zk = await p.evaluate(() => {
    const t = window.SLCT.fleet.trucks.find(x => x.base.n === 'Wognum' && x.kind === 'trekker'); const k = t.plate.replace(/-/g, ''); const wissel = k.slice(0, 2) + k[3] + k[2] + k.slice(4);
    const i = document.getElementById('zoekIn'); i.focus(); const vraag = q => { i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); const x = document.querySelector('#zoekL .sg-item'); return x ? `${x.querySelector('.sg-type').textContent}: ${x.querySelector('b').textContent}` : ''; };
    const a = vraag(wissel); const b = vraag('purmerend');
    window.SLCT.ui.ctx.R.bump(); const t0 = performance.now(); const c = vraag('purmrend'); const ms = performance.now() - t0;
    i.value = ''; i.blur(); return { id: t.id, wissel, a, b, c, ms: +ms.toFixed(1) };
  });
  // de zoekvraag wachtte niet op het bijwerken; de index is direct daarna bij
  await p.waitForTimeout(400); const zkBij = await p.evaluate(() => window.SLCT.ui.ctx.search.bijgewerkt());
  check(zk.a.includes(zk.id) && zk.b === 'Plaats: Purmerend' && zk.c === 'Plaats: Purmerend' && zk.ms < 100 && zkBij.bij, `zoeken: "${zk.wissel}" (twee tekens omgewisseld) geeft ${zk.a}; "purmerend" en "purmrend" geven de plaats bovenaan; eerste zoekvraag na een nieuwe planversie ${zk.ms} ms (hooguit 100), de index daarna bijgewerkt in ${zkBij.ms} ms`);
  await p.evaluate(() => window.SLCT.ui.ctx.search.close(false));
  // J9. "Naar de inhoud": de eerste tab-stop, en daarna de briefing
  await p.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 0); }); await p.waitForTimeout(200);
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '#'; a.id = '__start'; document.body.prepend(a); a.focus(); }); await p.evaluate(() => document.getElementById('__start').remove());
  await p.keyboard.press('Tab'); const sk1 = await p.evaluate(() => ({ cls: document.activeElement.className, txt: document.activeElement.textContent, top: Math.round(document.activeElement.getBoundingClientRect().top) }));
  await p.keyboard.press('Enter'); await p.waitForTimeout(200); const sk2 = await p.evaluate(() => document.activeElement.id);
  await p.keyboard.press('Tab'); const sk3 = await p.evaluate(() => document.activeElement.className);
  check(sk1.cls === 'skip' && sk1.txt === 'Naar de inhoud' && sk1.top >= 0 && sk2 === 'ovBrief' && /brief-i/.test(sk3), `"Naar de inhoud" is de eerste tab-stop (zichtbaar op ${sk1.top} px), Enter gaat naar de briefing (${sk2}), de volgende Tab is de eerste regel (${sk3})`);
  // J11. het Overzicht: een begrip voor onderweg, de dag van het werkgebied, en geen twee briefingregels naar dezelfde zaak
  await klokLoopt(p); await p.evaluate(() => { window.SLCT.state.playing = false; window.SLCT.ui.ctx.go('view:overzicht'); }); await p.waitForTimeout(900);
  const ovz = await p.evaluate(() => { const L = [...document.querySelectorAll('#v-overzicht .brief-i')].map(b => ({ k: b.querySelector('.brief-k').textContent.trim(), open: b.dataset.open || '', t: b.textContent })); const sp = L.find(x => x.k === 'Speelt'); const kpi = [...document.querySelectorAll('#v-overzicht .kpi')].map(k => k.textContent).join(' | '); return { L, onderwegBrief: sp ? (sp.t.match(/(\d[\d.]*) voertuig(?:en)? onderweg/) || [])[1] : null, onderwegKpi: (kpi.match(/van (\d[\d.]*) onderweg/) || [])[1], dag: (document.querySelector('#v-overzicht [data-ov="dag"]') || {}).textContent || '' }; });
  const doelen = ovz.L.map(x => x.open).filter(x => /^(melding|openritten)\//.test(x));
  check(ovz.onderwegBrief && ovz.onderwegBrief === ovz.onderwegKpi && /^De dag in Wognum:/.test(ovz.dag) && new Set(doelen).size === doelen.length, `Overzicht om 05:30: onderweg ${ovz.onderwegBrief} in de briefing en ${ovz.onderwegKpi} bij Vandaag, "${ovz.dag.split(':')[0]}", ${doelen.length} briefingregels naar ${new Set(doelen).size} verschillende zaken of ritten`);
  // J13. Rit inplannen: het voertuig van de rit heet zo ("met T-1007 (vrij)"), niet "op T-1007"
  await p.evaluate(() => window.SLCT.ui.ctx.go('view:openritten')); await p.waitForTimeout(1200);
  const kd = await p.evaluate(() => [...document.querySelectorAll('#v-openritten .kd-n small')].map(x => x.textContent));
  check(kd.length > 0 && !kd.some(x => / op [TBV]-\d/.test(x)) && (kd.some(x => /met [TBV]-\d+ \(vrij\)/.test(x)) || kd.every(x => !/[TBV]-\d/.test(x))), `Rit inplannen: kandidaten zeggen "${(kd.find(x => /met /.test(x)) || kd[0] || '').trim()}" in plaats van "op T-..."`);
  // J7. een aangevraagde rit op het planbord: zichtbaar gearceerd (pixels, licht en donker) met "gevraagd" erbij
  // een open rit van vandaag met een eigen chauffeur en een vrij voertuig (dan komt hij op het voertuig, niet in een eigen rij)
  const ritten = await p.evaluate(() => [...document.querySelectorAll('#v-openritten .or-list [data-or]')].map(b => b.dataset.or).slice(0, 8));
  let kies = null;
  for (const rid of ritten) {
    await p.evaluate(rid => window.SLCT.ui.ctx.go(`openritten/${rid}`), rid); await p.waitForTimeout(700);
    kies = await p.evaluate(() => { const b = [...document.querySelectorAll('#v-openritten [data-kies^="eigen:"]')].find(x => /met [TBV]-\d/.test((x.closest('.kd-i') || x).textContent)); if (!b) return null; const id = window.SLCT.ui.ctx.ui.or.cur; b.click(); return id; });
    if (kies) break;
  }
  await p.waitForTimeout(900);
  if (kies) {
    await p.evaluate(id => { location.hash = `#planbord/R-${id}`; }, kies); await p.waitForTimeout(2500);
    const sel = `.sg-task.aangevraagd[data-task-id="R-${kies}"]`;
    const st = await p.evaluate(s => { const t = document.querySelector(s); if (!t) return null; const a = t.querySelector('.sg-arc'); const av = t.querySelector('.sg-av'); const cs = a ? getComputedStyle(a) : null; const r = t.getBoundingClientRect(), ra = a ? a.getBoundingClientRect() : null; return { arc: !!a && cs.display !== 'none' && /repeating-linear-gradient/.test(cs.backgroundImage) && Math.abs(ra.width - r.width) < 2, av: av ? av.textContent : '', avZicht: !!av && av.offsetWidth > 0, w: Math.round(r.width) }; }, sel);
    if (st) {
      const vgl = await p.evaluate(s => { const t = document.querySelector(s); const row = t.closest('.sg-row') ? null : null; const L = [...document.querySelectorAll('.sg-task.pb-rit.st-gepland:not(.aangevraagd)')].filter(x => { const r = x.getBoundingClientRect(); return r.width > 60 && r.left >= 0 && r.right <= innerWidth && r.top > 0 && r.bottom < innerHeight; }); return L[0] ? L[0].dataset.taskId : null; }, sel);
      const meetPx = async () => { await p.addStyleTag({ content: '.slct .sg-task .sg-l{visibility:hidden!important}' }).catch(() => {}); const a = await (await p.$(sel)).screenshot(); const b = vgl ? await (await p.$(`.sg-task[data-task-id="${vgl}"]`)).screenshot() : null; await p.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.includes('.sg-l{visibility:hidden!important}')) s.remove(); }); return { av: wissels(pngPixels(a)), gewoon: b ? wissels(pngPixels(b)) : null }; };
      const licht = await meetPx();
      await p.evaluate(() => window.SLCT.ui.ctx.toggleTheme()); await p.waitForTimeout(900);
      const donker = await meetPx();
      await p.evaluate(() => window.SLCT.ui.ctx.toggleTheme()); await p.waitForTimeout(300);
      const ok = px => px.av >= 12 && (px.gewoon === null || px.av > px.gewoon * 2);
      check(st.arc && st.av === 'gevraagd' && st.avZicht && ok(licht) && ok(donker), `planbord: R-${kies} wacht op een ja en is gearceerd boven de segmenten (kleurwissels licht ${licht.av} tegen ${licht.gewoon} bij een gewone rit, donker ${donker.av} tegen ${donker.gewoon}), met "${st.av}" erbij`);
    } else check(false, `planbord: R-${kies} staat niet als aangevraagde rit op het bord`);
  } else note('geen kandidaat om toe te wijzen');
  // J8. herladen: de stand van het planbord (per chauffeur, zoom, morgen) en de dag van Open ritten komen terug
  await p.evaluate(() => window.SLCT.ui.ctx.go('view:planbord')); await p.waitForTimeout(1500);
  await p.selectOption('#pbPer', 'chauffeur'); await p.waitForTimeout(500); await p.selectOption('#pbZoom', '6'); await p.waitForTimeout(400);
  await p.click('#v-planbord [data-pbdag="morgen"]'); await p.waitForTimeout(900);
  await p.evaluate(() => window.SLCT.ui.ctx.go('view:openritten')); await p.waitForTimeout(800);
  await p.click('#v-openritten [data-ordag="morgen"]'); await p.waitForTimeout(500);
  await p.evaluate(() => window.SLCT.ui.ctx.go('view:planbord')); await p.waitForTimeout(800);
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300_000, polling: 500 }); await p.waitForTimeout(1500);
  const pbna = await p.evaluate(() => ({ view: document.querySelector('#views > .view.on').id, per: (document.getElementById('pbPer') || {}).value, zoom: (document.getElementById('pbZoom') || {}).value, dag: (document.querySelector('#v-planbord [data-pbdag][aria-pressed="true"]') || {}).textContent }));
  await p.evaluate(() => window.SLCT.ui.ctx.go('view:openritten')); await p.waitForTimeout(800);
  const orna = await p.evaluate(() => (document.querySelector('#v-openritten [data-ordag][aria-pressed="true"]') || {}).dataset.ordag);
  check(pbna.view === 'v-planbord' && pbna.per === 'chauffeur' && pbna.zoom === '6' && pbna.dag === 'Morgen' && orna === 'morgen', `herladen: het planbord staat weer per ${pbna.per}, ${pbna.zoom} uur, ${pbna.dag}; Open ritten weer op ${orna}`);
  // J10. het hal-scherm toont geen hele namen: voornaam en de eerste letter van de achternaam
  await p.evaluate(() => { location.hash = '#hal/Wognum'; }); await p.waitForTimeout(800);
  const hal = await p.evaluate(() => [...document.querySelectorAll('#hal .halline .drv')].map(x => x.textContent));
  check(hal.length > 0 && hal.every(x => x === '–' || /^\S+( \S+)* [A-ZÀ-Ý]\.$/.test(x)), `hal-scherm: alleen voornaam en eerste letter van de achternaam (${[...new Set(hal)].slice(0, 3).join(', ')})`);
  await p.evaluate(() => window.SLCT.ui.ctx.hashTo('')); await p.waitForTimeout(400);
  // J12. het vertrekbord op Standplaatsen past in zijn vak: geen afgesneden status
  await p.evaluate(() => { location.hash = '#standplaatsen/Wognum'; }); await p.waitForTimeout(1200);
  const vb = await p.evaluate(() => { const t = document.querySelector('#v-standplaatsen .vb-t'); if (!t) return null; const box = t.parentElement; const bx = box.getBoundingClientRect(); const st = [...t.querySelectorAll('tbody td.c-st .badge')]; return { tabel: Math.round(t.getBoundingClientRect().width), vak: Math.round(box.clientWidth), uit: st.filter(x => x.getBoundingClientRect().right > bx.right + 0.5 || x.scrollWidth > x.clientWidth + 1).length, n: st.length }; });
  check(vb && vb.tabel <= vb.vak && vb.uit === 0 && vb.n > 0, `vertrekbord: tabel ${vb && vb.tabel} px in een vak van ${vb && vb.vak} px, ${vb && vb.uit} van ${vb && vb.n} statussen afgesneden`);
  // J14. de regiomanager ziet geen rijgedrag per chauffeur (een prestatiebeeld kan alleen met de OR)
  await p.evaluate(() => window.SLCT.ui.ctx.setRole('regiomanager')); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#persoon/P-0001/rijden'; }); await p.waitForTimeout(900);
  const rm = await p.evaluate(() => ({ lock: !!document.querySelector('#sheet .locked'), kpi: /Harde remmingen/.test(document.getElementById('sheet').textContent) }));
  check(rm.lock && !rm.kpi, 'regiomanager: het tabblad Rijden van een chauffeur is afgeschermd (geen harde remmingen of overtredingen per chauffeur)');
  await p.evaluate(() => window.SLCT.ui.ctx.setRole('planner'));
  // J15. de paginatitel op 1440 px, licht en donker
  await titelToets(p, 1440);
  await cj.close();
}
// J2. vanaf het Overzicht naar de kaart op een telefoon (390 px): het voertuig midden in het deel boven het paneel
if (mode === 'gl') {
  const { ctx: c3, p } = await paginaWognum({ width: 390, height: 844 });
  await klokLoopt(p); await p.waitForTimeout(1500);
  const id = await p.evaluate(() => { const b = document.querySelector('#v-overzicht [data-ov="log"] [data-open^="kaart:truck:"]'); if (!b) return null; const id = b.dataset.open.split(':')[2]; window.__doel = id; window.__lnd = []; b.click(); return id; });
  if (id) {
    await stilKaart(p);
    const l = await landing(p); const top = await p.evaluate(() => { const { V } = window.__vrij(); return { t: Math.round(V.t), b: Math.round(V.b), topbalk: Math.round(document.getElementById('topbar').getBoundingClientRect().bottom) }; });
    check(inMidden(l) && top.t > top.topbalk, `390 px: vanaf het Overzicht naar de kaart landt ${id} op ${l ? `${l.fx}, ${l.fy}` : 'niets'} van het deel tussen de filterbalk (${top.t} px) en het paneel (${top.b} px), niet tegen de topbalk`);
  } else note('390 px: geen gebeurtenis met een voertuig');
  await c3.close();
}
// J15 op een telefoon (390 px), ook zonder WebGL
{
  const { ctx: c4, p } = await paginaWognum({ width: 390, height: 844 });
  await titelToets(p, 390);
  await c4.close();
}

const realErrors = errors.filter(e => !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|ERR_FAILED/.test(e));
check(realErrors.length === 0, `console-fouten: ${realErrors.length}${realErrors.length ? '\n   ' + realErrors.slice(0, 6).join('\n   ') : ''}`);
await browser.close();
console.log(fail ? `\n${fail} van ${n} FOUT` : `\nalles in orde (${n} checks)`);
process.exit(fail ? 1 : 0);
