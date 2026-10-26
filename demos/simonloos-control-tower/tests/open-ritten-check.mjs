// Controle van de vraagkant (Control Tower 4.0): open ritten, de flexibele schil, voorkeuren en de Assistent met de API.
//
//   npm run build && (cd dist && python3 -m http.server 8774 --bind 127.0.0.1) &
//   node tests/open-ritten-check.mjs [http://127.0.0.1:8774/index.html]
//
// Open ritten op de data (fleet.poolAt, fleet.prognose, fleet.kandidaten, fleet.wijsToe): de lijst op urgentie met reden en
// kans op invulling, één rit uitgeklapt met de kans op invulling en de kans op tijd, het advies van de data in één zin en
// de kandidaten van fleet.kandidaten in drie groepen; Vraag tegelijk uit; toewijzen aan een eigen chauffeur (wacht op een
// ja, dan bevestigd), aan een oproepkracht ("Kan niet" zet hem terug) en aan een charter (een eigen rij op het planbord);
// na herladen dezelfde toewijzingen. Bellen belt niet (geen tel:-link): de knop toont het nummer met een melding.
// Charters en oproepkrachten: twee tabbladen met een tabel, de pagina's, een afgeschermd nummer van een persoon, het
// signaal over de Wet DBA alleen op de pagina van een zzp'er. Voorkeuren en tevredenheid op de chauffeurspagina, de
// stille markering op het planbord, de rapporten (invulling per week, roosterfit per standplaats). De Assistent met data-ai: drie ingangen; het verzoek gaat door de echte
// serverfunctie (netlify/functions/assistent.mts, met een nagebootste Claude API), zodat het contract klopt: geen 400, en
// naar de API geen namen, telefoonnummers of e-mailadressen; het antwoord met textContent en nummers als verwijzing; een
// 429, een half antwoord en een 404 (de vaste antwoorden); zonder data-ai geen verzoek.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
// de serverfunctie zelf (Node 22.18 of nieuwer laadt .mts met type stripping)
let F = null; try { F = await import('../netlify/functions/assistent.mts'); } catch (e) { console.log(`LET OP serverfunctie niet geladen (${e.code || e.message}); de AI-controles gebruiken een vast antwoord`); }
const url = process.argv[2] || 'http://127.0.0.1:8774/index.html';
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { if (!localStorage.getItem('sl-werkgebied')) localStorage.setItem('sl-werkgebied', JSON.stringify({ regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role: 'planner', sp: 'Wognum' })); } catch { /* geen opslag */ } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED|Failed to load/.test(m.text())) errors.push(m.text()); });
let aiReq = null, aiN = 0, aiMode = 'ok', aiType = '', naarApi = null, aiStatus = 0;
const AI = { antwoord: 'Wat speelt: de open rit P-9016 laadt al.\n\n- <b>Geen HTML</b> hier.\n- T-1001 rijdt.\n\nWat jij beslist: wie P-9016 rijdt.', acties: [{ titel: 'Wijs P-9016 toe', waarom: 'Laden loopt al.', effect: 'Op tijd weg (schatting).' }, { titel: 'Bel een charter', waarom: 'Kans is laag.', effect: 'Een terugvaloptie (schatting).' }], letOp: ['Twee chauffeurs zitten bijna op hun rijtijd.'] };
await page.route('**/*', async route => {
  const u = new URL(route.request().url());
  if (u.pathname === '/api/assistent') {
    aiN++; aiReq = route.request().postDataJSON(); aiType = route.request().headers()['content-type'] || '';
    if (aiMode === '429') return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '600' }, body: '{"ok":false,"fout":"Even wachten."}' });
    if (aiMode === 'half') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"antwoord":' });
    if (aiMode === '404') return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Niet gevonden' });
    if (!F) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, soort: aiReq.soort, ...AI }) });
    // de echte functie met een nagebootste Claude API: wat zij naar de API stuurt, bewaren we om te controleren
    const req = new Request('https://controltower-demo.netlify.app/api/assistent', { method: 'POST', headers: { 'content-type': aiType, 'sec-fetch-site': 'same-origin', 'x-nf-client-connection-ip': '192.0.2.10' }, body: route.request().postData() });
    const api = async (adres, init) => { naarApi = init.body; return new Response(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(AI) }], usage: { input_tokens: 4000, output_tokens: 300 } }), { status: 200, headers: { 'content-type': 'application/json' } }); };
    const res = await F.handle(req, { fetch: api, getEnv: k => ({ ANTHROPIC_API_KEY: 'sk-test-nep' })[k], log: () => {}, now: () => Date.now() });
    aiStatus = res.status;
    return route.fulfill({ status: res.status, headers: { 'content-type': 'application/json' }, body: await res.text() });
  }
  if (u.host !== new URL(url).host) return route.abort('blockedbyclient');
  return route.continue();
});
const load = async () => {
  await page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300000, polling: 500 });
  await page.evaluate(() => { window.SLCT.state.playing = false; window.SLCT.state.simTime = 600; window.SLCT.ui.frame(true); });
};
const go = async (h, ms = 1500) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms); };
await page.goto(url, { waitUntil: 'load' }); await load();

// ---------- open ritten ----------
await go('#openritten', 2500);
const lijst = await page.evaluate(() => {
  const c = window.SLCT.ui.ctx; const rows = [...document.querySelectorAll('#v-openritten .or-g:not(.or-klaar):not(.or-gemist) .or-i:not(.wacht)')];
  const ids = rows.map(r => r.dataset.or); const P = ids.map(id => c.fleet.pool.find(p => p.id === id));
  const u = P.map(p => (p.dag === 'morgen' ? 9999 : p.venster[0] - c.state.simTime));
  return { n: rows.length, sorted: u.every((x, i) => i === 0 || x >= u[i - 1]), kans: rows.every(r => /kans \d+ %/.test(r.textContent)), reden: rows.every(r => r.querySelector('.or-r') && r.querySelector('.or-r').textContent.trim()), detail: !!document.querySelector('#v-openritten .or-d h2'), groepen: [...document.querySelectorAll('#v-openritten .kd-g h3')].map(h => h.firstChild.textContent.trim()), pg: !!document.querySelector('#v-openritten .or-pg .or-pk b'), nav: (document.querySelector('[data-nav="openritten"] .nc') || {}).textContent, prim: document.querySelectorAll('#v-openritten .kd .btn.pri').length };
});
check(lijst.n > 0 && lijst.sorted && lijst.kans && lijst.reden, `open ritten: ${lijst.n} op urgentie, elk met reden en kans op invulling`);
check(lijst.detail && lijst.pg && lijst.groepen.join('|') === "Eigen chauffeurs|Oproepkrachten en zzp'ers|Charters" && lijst.prim === 1, `één rit uitgeklapt: prognose en drie groepen (${lijst.groepen.join(', ')}), één aanbevolen knop`);
// de prognose en de kandidaten komen uit de data
const data1 = await page.evaluate(() => {
  const c = window.SLCT.ui.ctx; const id = c.ui.or.cur; const it = c.fleet.pool.find(p => p.id === id); const T = c.state.simTime;
  const pg = c.fleet.prognose(it, T); const zonder = c.fleet.pool.filter(p => p.gepland).map(p => p.id);
  const tw = c.fleet.pool.filter(p => p.gepland && p.toegewezen && p.toegewezen.uit).map(p => p.toegewezen.uit);
  const K = c.fleet.kandidaten(it, { T, people: c.people, toegewezen: tw, max: { eigen: 5, oproep: 4, charter: 4 } });
  const ui = [...document.querySelectorAll('#v-openritten .kd-i [data-open]')].map(b => b.dataset.open.split('/')[1]);
  const pk = [...document.querySelectorAll('#v-openritten .or-pk b')].map(b => b.textContent.trim()); const lab = [...document.querySelectorAll('#v-openritten .or-pk span')].map(b => b.textContent.trim());
  const note = (document.querySelector('#v-openritten .or-d > .note') || {}).textContent || '';
  return { pk, lab, kans: Math.round(pg.kans * 100), opTijd: Math.round(pg.opTijd * 100), advies: pg.advies, note: note.trim(), uitleg: (document.querySelector('#v-openritten .or-pt p') || {}).textContent || '', ids: K.map(k => k.id).join(','), ui: ui.join(','), inPool: c.fleet.poolAt(T, zonder).some(p => p.id === id) };
});
check(data1.pk[0] === `${data1.kans} %` && data1.pk[1] === `${data1.opTijd} %` && data1.lab.join('|') === 'kans op invulling|kans op tijd weg' && data1.note === data1.advies && data1.uitleg.includes('vergelijkbare ritten'), `prognose uit fleet.prognose: ${data1.pk.join(' en ')} (invulling, op tijd); advies: "${data1.advies}"`);
check(data1.ids && data1.ids === data1.ui && data1.inPool, `kandidaten uit fleet.kandidaten (met people en wat al is toegewezen), in dezelfde volgorde (${data1.ui.split(',').length})`);
// geen echte tel:-links; Bel toont het nummer met een melding
check(!(await page.$('#app a[href^="tel:"]')), 'open ritten: geen tel:-link');
const belK = await page.$('#v-openritten .kd [data-bel]');
if (belK) {
  await belK.click(); await page.waitForTimeout(500);
  const t = await page.evaluate(() => ({ toast: [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | '), log: window.SLCT.ui.ctx.A.acts.log[0].txt, nr: document.querySelector('#v-openritten .kd [data-bel]') ? document.querySelector('#v-openritten .kd [data-bel]').dataset.bel : '' }));
  check(/Demo: er wordt niet gebeld, het nummer is gesimuleerd/.test(t.toast) && t.toast.includes(t.nr || '@@') && /^belde /.test(t.log), `Bel toont het nummer (${t.nr}) en "Demo: er wordt niet gebeld, het nummer is gesimuleerd"; het gesprek staat in het logboek`);
} else check(false, 'geen Bel-knop bij de kandidaten');
// Vraag tegelijk uit (de kleinste groep met samen minstens 90 procent kans op een ja)
let samenOk = null;
for (const id of await page.evaluate(() => [...document.querySelectorAll('#v-openritten .or-g:not(.or-klaar) .or-i:not(.wacht)')].map(b => b.dataset.or))) {
  await page.click(`#v-openritten .or-i[data-or="${id}"]`); await page.waitForTimeout(700);
  const b = await page.$('#v-openritten [data-samen]'); if (!b) continue;
  const voor = await page.evaluate(() => (document.querySelector('#v-openritten .kd-samen p') || {}).textContent || '');
  await b.click(); await page.waitForTimeout(700);
  samenOk = await page.evaluate(([rid, v]) => { const c = window.SLCT.ui.ctx; const it = c.fleet.pool.find(p => p.id === rid); const n = (it.contact || []).filter(x => x.soort === 'samen').length; return { v, n, log: c.A.acts.log[0].txt, al: !!document.querySelector('#v-openritten .kd-samen.al .kd-msg'), toast: [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | ') }; }, [id, voor]);
  break;
}
check(samenOk && samenOk.n >= 2 && /tegelijk/.test(samenOk.log) && samenOk.al && /Demo: er gaat geen bericht de deur uit/.test(samenOk.toast) && /samen \d+ % kans/.test(samenOk.v), `Vraag tegelijk uit: ${samenOk ? `${samenOk.n} mensen, één bericht (${samenOk.v.slice(0, 90)}...)` : 'niet gevonden'}`);
await go('#openritten', 1200);
check(+lijst.nav === lijst.n, `teller bij Open ritten in de linkerbalk (${lijst.nav})`);
// eigen chauffeur: de vraag gaat uit (wacht op een ja), dan bevestigd
let sel1 = null;
for (const id of await page.evaluate(() => [...document.querySelectorAll('#v-openritten .or-g:not(.or-klaar) .or-i:not(.wacht)')].map(b => b.dataset.or))) {
  await page.click(`#v-openritten .or-i[data-or="${id}"]`); await page.waitForTimeout(700);
  const k = await page.$('#v-openritten [data-kies^="eigen:"]'); if (!k) continue;
  await k.click(); await page.waitForTimeout(1500); sel1 = id; break;
}
const e1 = sel1 ? await page.evaluate(id => { const c = window.SLCT.ui.ctx; const it = c.fleet.pool.find(p => p.id === id); return { g: it.gepland, tw: it.toegewezen && { ...it.toegewezen, uit: !!it.toegewezen.uit, seg: it.toegewezen.uit && it.toegewezen.uit.segment ? it.toegewezen.uit.segment.rit : null }, rit: !!c.R.get(`R-${id}`), open: [...document.querySelectorAll('#v-openritten .or-g:not(.or-klaar) .or-i:not(.wacht)')].some(x => x.dataset.or === id), wacht: !!document.querySelector(`#v-openritten .or-i.wacht[data-or="${id}"]`), msg: !!document.querySelector('#v-openritten .or-msg p'), log: c.A.acts.log[0].txt }; }, sel1) : null;
check(e1 && e1.g && e1.tw && e1.tw.soort === 'eigen' && e1.tw.status === 'aangevraagd' && e1.tw.uit && e1.tw.seg === sel1 && (e1.g.t ? e1.rit : e1.g.rij) && !e1.open && e1.wacht && e1.msg && /^vroeg /.test(e1.log), `eigen chauffeur: ${sel1} gevraagd aan ${e1 && e1.tw && e1.tw.naam} (${e1 && e1.g && e1.g.t ? `op ${e1.g.t}` : 'eigen rij'}), het bericht van fleet.wijsToe, wacht op een ja`);
if (sel1) { await go(`#openritten/${sel1}`, 1000); await page.click('#v-openritten [data-orbev]'); await page.waitForTimeout(800); }
check(sel1 && await page.evaluate(id => window.SLCT.ui.ctx.fleet.pool.find(p => p.id === id).toegewezen.status === 'bevestigd', sel1), 'eigen chauffeur zei ja: bevestigd');
await go('#openritten', 1200);
// oproepkracht, kan niet
let sel2 = null, op = null;
for (const id of await page.evaluate(() => [...document.querySelectorAll('#v-openritten .or-g:not(.or-klaar) .or-i:not(.wacht)')].map(b => b.dataset.or))) {
  await page.click(`#v-openritten .or-i[data-or="${id}"]`); await page.waitForTimeout(700);
  op = await page.$('#v-openritten [data-kies^="oproep:"]'); if (op) { sel2 = id; break; }
}
if (!op) { await page.click('#v-openritten [data-ordag="morgen"]'); await page.waitForTimeout(800);
  for (const id of await page.evaluate(() => [...document.querySelectorAll('#v-openritten .or-g:not(.or-klaar) .or-i:not(.wacht)')].map(b => b.dataset.or))) {
    await page.click(`#v-openritten .or-i[data-or="${id}"]`); await page.waitForTimeout(700);
    op = await page.$('#v-openritten [data-kies^="oproep:"]'); if (op) { sel2 = id; break; }
  } }
if (op) {
  await op.click(); await page.waitForTimeout(1500);
  const e2 = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const it = c.fleet.pool.find(p => p.id === id); const t = it.gepland && it.gepland.t && c.fleet.byId.get(it.gepland.t); const d = t && t.diensten.find(x => x.flex && x.flex.id === it.toegewezen.id); return { tw: it.toegewezen, g: it.gepland, drv: d ? d.driver : null, wacht: !!document.querySelector(`#v-openritten .or-i.wacht[data-or="${id}"]`) }; }, sel2);
  check(e2.tw && e2.tw.soort === 'oproep' && e2.tw.status === 'aangevraagd' && (e2.g.t ? e2.drv === e2.tw.naam : e2.g.rij) && e2.wacht, `oproepkracht: ${e2.tw && e2.tw.naam} (${e2.g && e2.g.t ? `eigen dienst op ${e2.g.t}` : 'eigen rij'}), wacht op een ja`);
  const wid = e2.tw && e2.tw.id;
  await page.click(`#v-openritten .or-i.wacht[data-or="${sel2}"]`); await page.waitForTimeout(700);
  await page.click('#v-openritten [data-orterug]'); await page.waitForTimeout(1200);
  const e3 = await page.evaluate(([id, w]) => { const c = window.SLCT.ui.ctx; const it = c.fleet.pool.find(p => p.id === id); return { g: it.gepland, rit: !!c.R.get(`R-${id}`), flex: c.fleet.trucks.some(t => t.diensten.some(d => d.flex && d.flex.id === w && (d.routes || []).length)) }; }, [sel2, wid]);
  check(!e3.g && !e3.rit && !e3.flex, 'kan niet: de rit staat weer open, de dienst van de oproepkracht is weg');
} else check(false, 'geen oproepkracht om toe te wijzen');
// charter
let ch = null;
for (const id of await page.evaluate(() => [...document.querySelectorAll('#v-openritten .or-g:not(.or-klaar) .or-i:not(.wacht)')].map(b => b.dataset.or))) {
  await page.click(`#v-openritten .or-i[data-or="${id}"]`); await page.waitForTimeout(900);
  const k = await page.$('#v-openritten [data-kies^="charter:"]'); if (!k) continue;
  await k.click(); await page.waitForTimeout(1200); ch = id; break;
}
if (ch) {
  const c1 = await page.evaluate(id => { const it = window.SLCT.ui.ctx.fleet.pool.find(p => p.id === id); return it.toegewezen; }, ch);
  check(c1 && c1.soort === 'charter' && c1.status === 'aangevraagd', `charter: ${c1 && c1.naam}, aangevraagd`);
  await go('#planbord', 2500);
  const rij = await page.evaluate(() => ({ n: document.querySelectorAll('.sg-task.pb-charter.aangevraagd').length, cnt: (document.querySelector('[data-pb=cnt]') || {}).textContent || '' }));
  check(rij.n >= 1 && !/22[6-9] van 225/.test(rij.cnt), `planbord: de charterrit gearceerd in een eigen rij bovenaan (${rij.n})`);
  // de data telt de charter mee: zijn vrije trekkers van vandaag gaan omlaag
  const ch2 = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const it = c.fleet.pool.find(p => p.id === id); const cid = it.toegewezen.id; const x = c.fleet.CHARTERS.find(z => z.id === cid); const n = c.fleet.pool.filter(p => p.gepland && p.toegewezen && p.toegewezen.id === cid && p.dag === it.dag).length; return { cid, voor: x.beschikbaar[it.dag === 'morgen' ? 'morgen' : 'vandaag'], n }; }, ch);
  check(ch2.n >= 1, `toegewezen gaat terug naar de data (${ch2.cid}: ${ch2.n} van ${ch2.voor} trekkers in gebruik)`);
  await go(`#openritten/${ch}`, 1200); await page.click('#v-openritten [data-orbev]'); await page.waitForTimeout(800);
  check(await page.evaluate(id => window.SLCT.ui.ctx.fleet.pool.find(p => p.id === id).toegewezen.status === 'bevestigd', ch), 'charter bevestigd na het bellen');
} else check(false, 'geen rit met een charter gevonden');
// herladen
const fp = () => page.evaluate(() => window.SLCT.ui.ctx.fleet.pool.filter(p => p.gepland).map(p => `${p.id}:${p.toegewezen ? `${p.toegewezen.soort}/${p.toegewezen.status}` : ''}`).sort().join(','));
const voor = await fp(); await page.reload({ waitUntil: 'load' }); await load(); await page.waitForTimeout(800);
const na = await fp();
check(voor && voor === na, `na herladen dezelfde toewijzingen (${na})`);
// bellen komt in het logboek
await go('#openritten', 1500);
const gevraagd = await page.evaluate(() => { const c = window.SLCT.ui.ctx; return c.fleet.pool.filter(p => (p.contact || []).length).length; });
check(gevraagd >= 1, `na herladen weet de app wie al gebeld of gevraagd is (${gevraagd} ${gevraagd === 1 ? 'rit' : 'ritten'})`);

// ---------- charters en oproepkrachten ----------
await go('#charters', 1500);
const t1 = await page.evaluate(() => ({ rijen: document.querySelectorAll('#v-charters [data-pl=charters] .tv-scroll [data-row]').length, tabs: [...document.querySelectorAll('#v-charters [data-pl=charters] [data-pltab]')].map(b => b.textContent.trim()), bel: document.querySelectorAll('#v-charters [data-pl=charters] [data-bel]').length, tel: document.querySelectorAll('#app a[href^="tel:"]').length, n: window.SLCT.ui.ctx.fleet.CHARTERS.length }));
check(t1.rijen > 0 && t1.tabs.length === 2 && t1.bel > 0 && !t1.tel, `charters: ${t1.rijen} van de ${t1.n} uit de data in je werkgebied, met een Bel-knop en geen tel:-link; tabbladen ${t1.tabs.join(' en ')}`);
await go('#charters/oproep', 1500);
const t2 = await page.evaluate(() => ({ rijen: document.querySelectorAll('#v-charters [data-pl=oproep] .tv-scroll [data-row]').length, sort: [...document.querySelectorAll('#v-charters [data-pl=oproep] th')].some(th => /Op tijd/.test(th.textContent) && !th.querySelector('[data-sort]')), dba: /Wet DBA|schijnzelfstandig/i.test(document.getElementById('v-charters').textContent + document.getElementById('v-openritten').textContent) }));
check(t2.rijen > 0 && t2.sort && !t2.dba, `oproepkrachten en zzp'ers: ${t2.rijen}, op tijd zonder sorteerknop (geen ranglijst), geen signaal over de Wet DBA in de lijst of bij de kandidaten`);
await go('#charter/CH-01', 1300);
const p1 = await page.evaluate(() => ({ h1: (document.querySelector('#sheet h1') || {}).textContent || '', kpi: document.querySelectorAll('#sheet .pg-kpis > div').length, ritten: document.querySelectorAll('#sheet .tbl tbody tr').length }));
const pc = await page.evaluate(() => { const c = window.SLCT.ui.ctx.fleet.CHARTERS.find(x => x.id === 'CH-01'); return { naam: c.naam, ritten: c.betrouwbaarheid.ritten, tel: document.querySelectorAll('#sheet a[href^="tel:"]').length, bel: document.querySelectorAll('#sheet [data-bel]').length }; });
check(p1.h1.includes(pc.naam) && /Charter/.test(p1.h1) && p1.kpi === 3 && p1.ritten === pc.ritten && !pc.tel && pc.bel >= 1, `charterpagina: ${pc.naam}, drie cijfers, ${p1.ritten} ritten voor ons (zoals de data), Bel zonder tel:-link`);
const zzp = await page.evaluate(() => (window.SLCT.ui.ctx.fleet.OPROEP.find(o => o.soort === 'zzp') || {}).id);
await go(`#oproep/${zzp}`, 1300);
const p2 = await page.evaluate(() => ({ masker: !!document.querySelector('#sheet [data-opreveal]'), grid: document.querySelectorAll('#sheet .bk-r').length, dba: /Wet DBA/.test(document.getElementById('sheet').textContent), tel: document.querySelectorAll('#sheet a[href^="tel:"]').length }));
await page.click('#sheet [data-opreveal]').catch(() => {}); await page.waitForTimeout(500);
const p3 = await page.evaluate(() => /bekeek het telefoonnummer/.test(window.SLCT.ui.ctx.A.acts.log[0].txt));
check(p2.masker && p2.grid === 8 && p3 && p2.dba && !p2.tel, `zzp'er (${zzp}): nummer afgeschermd tot een klik (vastgelegd), beschikbaarheid per dag en dagdeel, het signaal over de Wet DBA op de pagina`);

// ---------- voorkeuren, planbord, rapporten, zoeken ----------
await go('#persoon/P-0001/overzicht', 1300);
const vk = await page.evaluate(() => ({ sec: !!document.querySelector('#sheet .vk'), dots: document.querySelectorAll('#sheet .vk-dots i').length, score: (document.querySelector('#sheet .vk-s b') || {}).textContent }));
check(vk.sec && vk.dots > 0 && /\d,\d/.test(vk.score || ''), `chauffeur: voorkeuren en tevredenheid (${vk.score}, ${vk.dots} diensten)`);
await go('#planbord', 2500);
const pb = await page.evaluate(() => ({ kaart: document.querySelectorAll('.pk').length, kans: document.querySelectorAll('.pk .kans').length, titel: (document.querySelector('.pk-tg b') || {}).textContent }));
check(pb.titel === 'Open ritten' && pb.kaart > 0 && pb.kans === pb.kaart, `planbord: de bak heet Open ritten, elke kaart met urgentie en kans (${pb.kaart})`);
await go('#rapporten', 2000);
const rp = await page.evaluate(() => { const card = document.querySelector('#rp-roosterfit'); const t = card ? card.closest('.card').textContent : ''; const c = window.SLCT.ui.ctx; const H = c.fleet.poolHistorie(); return { inv: !!document.querySelector('#rp-invulling'), fit: !!card, namen: c.people.persons.filter(p => t.includes(p.name)).length, ko: !!document.querySelector('#rp-charterkosten'), slot: !!document.querySelector('#rp-charterkosten') && !!document.querySelector('#rp-charterkosten').closest('.card').querySelector('.locked'), sc: document.querySelectorAll('.vcol.sc .cols > button').length, weken: H.perWeek.length }; });
check(rp.inv && rp.fit && !rp.namen && rp.ko && rp.slot && rp.sc === rp.weken, `rapporten: invulling per week uit fleet.poolHistorie (${rp.sc} weken), roosterfit per standplaats zonder namen, kosten charters afgeschermd voor een planner`);
const zoekNaam = await page.evaluate(() => window.SLCT.ui.ctx.fleet.CHARTERS[0].naam);
await page.fill('#zoekIn', zoekNaam.split(' ')[0].toLowerCase()); await page.waitForTimeout(700);
const zk = await page.evaluate(() => [...document.querySelectorAll('#zoekL [role=option]')].map(o => o.textContent).join(' | '));
await page.keyboard.press('Escape');
check(zk.includes(zoekNaam), `zoeken vindt een charter (${zoekNaam})`);

// ---------- de Assistent met de API ----------
await page.evaluate(() => { window.SLCT.ui.ctx.toggleAssist(true); }); await page.waitForTimeout(500);
check(!(await page.$('#panel .ai')) && aiN === 0, 'zonder data-ai: de eigen Assistent en geen verzoek');
await page.evaluate(() => { document.getElementById('app').dataset.ai = '/api/assistent'; window.SLCT.ui.ctx.ui.assistTab = null; window.SLCT.ui.ctx.renderPanel(true); }); await page.waitForTimeout(500);
const kn = await page.evaluate(() => [...document.querySelectorAll('#panel .ai-k button')].map(b => b.textContent.trim()).join('|'));
check(kn === 'Ochtendbriefing|Overdracht schrijven' && !!(await page.$('#panel #aiIn')), 'met data-ai: Ochtendbriefing, Overdracht schrijven en het vraagveld bovenaan');
await page.click('#panel [data-ai-soort="briefing"]'); await page.waitForTimeout(2000);
const dagJson = JSON.stringify((aiReq || {}).dag || {}); const d0 = (aiReq || {}).dag || {}; const zonderSleutel = JSON.stringify({ ...d0, personen: undefined, kandidaten: Object.fromEntries(Object.entries(d0.kandidaten || {}).map(([k, L]) => [k, L.map(x => ({ ...x, naam: undefined }))])) });
const namen = await page.evaluate(j => window.SLCT.ui.ctx.people.persons.filter(p => j.includes(p.name)).length, zonderSleutel);
check(aiReq && aiReq.soort === 'briefing' && /^application\/json/.test(aiType) && aiReq.dag.tijd && aiReq.dag.cijfers && Array.isArray(aiReq.dag.zaken) && Array.isArray(aiReq.dag.openRitten) && Array.isArray(aiReq.dag.personen) && dagJson.length < 40000, `verzoek: briefing, Content-Type JSON, de dag (${dagJson.length} tekens) met ${(aiReq.dag.personen || []).length} personen als sleutel`);
check(!namen && !/@/.test(dagJson) && !/06[\s-]?\d{2}[\s-]?\d{2}/.test(dagJson), 'namen alleen in de sleutel personen en bij een kandidaat (zoals het contract vraagt); vrije tekst met nummers; geen telefoonnummers of e-mailadressen');
if (F) {
  const api = String(naarApi || ''); const nApi = await page.evaluate(j => window.SLCT.ui.ctx.people.persons.filter(p => j.includes(p.name)).length, api);
  check(aiStatus === 200 && api.length > 0 && !nApi && !/@/.test(api), `de echte serverfunctie aanvaardt het verzoek (${aiStatus}) en stuurt de API geen namen of contactgegevens (${api.length} tekens)`);
}
const a1 = await page.evaluate(() => { const o = document.querySelector('#panel [data-ai-out]'); return { tekst: o.textContent, li: o.querySelectorAll('.ai-ul li').length, acties: o.querySelectorAll('.ai-prop').length, let: o.querySelectorAll('.ai-let li').length, b: o.querySelectorAll('.ai-txt b').length, open: [...o.querySelectorAll('[data-open]')].map(x => x.dataset.open) }; });
check(a1.tekst.includes('<b>Geen HTML</b>') && !a1.b && a1.li === 2 && a1.acties === 2 && a1.let >= 1 && /jij beslist/.test(a1.tekst) && a1.open.includes('openritten/P-9016') && a1.open.some(x => /^voertuig\/T-1001/.test(x)), `antwoord met textContent: ${a1.li} punten, ${a1.acties} acties, ${a1.let} let op; nummers als verwijzing (${[...new Set(a1.open)].join(', ')})`);
await page.click('#panel [data-ai-log="0"]'); await page.waitForTimeout(300);
check(await page.evaluate(() => /voorstel van de assistent/.test(window.SLCT.ui.ctx.A.acts.log[0].txt)), 'Zet in logboek werkt');
aiMode = '429'; await page.fill('#panel #aiIn', 'Wie bel ik eerst?'); await page.press('#panel #aiIn', 'Enter'); await page.waitForTimeout(1200);
const t429 = await page.evaluate(() => document.querySelector('#panel [data-ai-out]').textContent);
check(/dertig vragen per uur/.test(t429) && /10 minuten/.test(t429) && aiReq.soort === 'vraag' && aiReq.vraag === 'Wie bel ik eerst?', `429: "${t429.trim()}"; Enter stuurt de vraag`);
aiMode = 'half'; await page.click('#panel [data-ai-soort="overdracht"]'); await page.waitForTimeout(1200);
check(/onvolledig/.test(await page.evaluate(() => document.querySelector('#panel [data-ai-out]').textContent)), 'een half antwoord wordt niet getoond');
aiMode = '404'; await page.fill('#panel #aiIn', 'Welke voertuigen halen hun tijdvenster niet?'); await page.press('#panel #aiIn', 'Enter'); await page.waitForTimeout(1200);
const t404 = await page.evaluate(() => document.querySelector('#panel [data-ai-out]').textContent);
check(/vaste antwoorden/.test(t404) && /tijdvenster|voertuigen/.test(t404), '404: de vaste antwoorden van de Assistent');
await page.evaluate(() => { delete document.getElementById('app').dataset.ai; });

check(!errors.length, `geen paginafouten${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
