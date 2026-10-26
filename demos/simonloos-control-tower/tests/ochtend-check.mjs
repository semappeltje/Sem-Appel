// Controles op de klok en de kalender van de planner (Control Tower 4.0, tweede eindcontrole).
//
//   npm run build && (cd dist && python3 -m http.server 8774 --bind 127.0.0.1) &
//   node tests/ochtend-check.mjs [http://127.0.0.1:8774/index.html]
//
// De andere controles draaien om 10:00 op de dag van vandaag; zo vielen de vroege ochtend en de zondag niet op. Hier staat de
// klok van de browser vast (page.clock.setFixedTime, Nederlandse tijd) op een maandag en een zondag, en de klok van de app
// op 04:00, 05:30 en 06:30: de uren waarin de planner van Wognum werkt en zijn eerste indruk krijgt.
// - Geen rit van vandaag met een vertrek na de klok staat op Afgerond (in de data en op de ritpagina); een nachtrit die het
//   voertuig nog rijdt, staat als onderweg.
// - Het planbord laat zo'n rit verplaatsen: het blok is niet vastgezet, "staat klaar" (niet "al begonnen"), en een pijltje
//   naar rechts schuift hem echt (getoetst).
// - Gisteren op maandag is niet leeg: de zondag in de historie, met minder diensten dan een werkdag. Ook op de maandag na
//   de zomertijd (de nacht van zondag heeft 23 uur; de historie telde eerst 24 uur terug en sloeg de zondag over).
// - Een zondag heeft minder diensten (35 tot 55 procent van de maandag, schatting) en zegt dat op het planbord.
// - De oefendag (?scenario=druk): P-8001 is om 06:20 nog open; om 06:45 is hij een zaak "Rit niet ingevuld" met één
//   hoofdknop, staat hij als gemist in Open ritten en telt hij als gemist naast Op tijd.
// - Geen paginafouten en geen verzoeken naar buiten.
// Andere data: CT_MAANDAG, CT_ZONDAG en CT_ZOMER (de maandag na de zomertijd), als JJJJ-MM-DD.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8774/index.html';
const MAANDAG = process.env.CT_MAANDAG || '2026-10-26', ZONDAG = process.env.CT_ZONDAG || '2026-11-01', ZOMER = process.env.CT_ZOMER || '2027-03-29';
const TIJDEN = [240, 330, 390];
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
// een datum en tijd in Nederlandse tijd als moment (zomer- of wintertijd)
const fmtNl = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const amsterdam = (dag, min) => { for (const off of ['+01:00', '+02:00']) { const d = new Date(`${dag}T${hm(min)}:00${off}`); if (fmtNl.format(d) === hm(min)) return d; } return new Date(`${dag}T${hm(min)}:00+01:00`); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const host = new URL(url).host; const errors = []; const buiten = new Set();
async function open(dag, min, { oefendag = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
  await ctx.addInitScript(oef => { try { if (!sessionStorage.getItem('och')) { localStorage.clear(); localStorage.setItem('sl-werkgebied', JSON.stringify({ regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role: 'planner', sp: 'Wognum' })); if (oef) localStorage.setItem('sl-oefendag', 'druk'); sessionStorage.setItem('och', '1'); } } catch { /* geen opslag */ } }, oefendag);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${dag} ${hm(min)}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED|Failed to load/.test(m.text())) errors.push(`${dag} ${hm(min)}: ${m.text()}`); });
  await page.route('**/*', route => { const u = route.request().url(); if (/^(data|blob|about):/.test(u)) return route.continue(); const x = new URL(u); if (x.host !== host) { buiten.add(x.host); return route.abort('blockedbyclient'); } return route.continue(); });
  await page.clock.setFixedTime(amsterdam(dag, min));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300000, polling: 250 });
  await page.evaluate(() => { window.SLCT.state.playing = false; });
  await page.waitForTimeout(500);
  return { ctx, page };
}
const zet = async (page, T) => { await page.evaluate(T => { const S = window.SLCT; S.state.playing = false; S.state.simTime = T; S.ui.frame(true); S.ui.ctx.refreshAll(); }, T); await page.waitForTimeout(400); };
const toasts = page => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent.trim()));
// de ritten van vandaag op T: hoeveel staan ten onrechte op afgerond, en hoeveel nachtritten rijdt het voertuig nog
const ritStand = page => page.evaluate(() => {
  const c = window.SLCT.ui.ctx; const T = c.state.simTime; let n = 0, fout = 0, nacht = 0; const vb = [];
  for (const r of c.R.all()) { n++; const s = c.R.stateOf(r, T, c.S); if (s.st === 'afgerond' && r.dep > T) { fout++; if (vb.length < 3) vb.push(`${r.id} (${r.t.id}, vertrek ${Math.floor(r.dep % 1440 / 60)}:${String(Math.floor(r.dep % 60)).padStart(2, '0')})`); } if (s.st !== 'gepland' && s.st !== 'afgerond' && r.dep >= T) nacht++; }
  const W = c.R.all().filter(r => r.t.base.n === 'Wognum'); const wG = W.filter(r => c.R.stateOf(r, T, c.S).st === 'gepland' && r.dep > T).length;
  return { T, n, fout, vb, nacht, wognum: W.length, wognumGepland: wG };
});

// ---------- maandag: de ochtend van de planner ----------
const M = await open(MAANDAG, 330);
const maandag = await M.page.evaluate(() => { const f = window.SLCT.fleet; return { dag: f.vandaag.getDay(), diensten: f.trucks.reduce((n, t) => n + t.diensten.length, 0), rijdt: f.trucks.filter(t => t.diensten.length).length }; });
check(maandag.dag === 1, `maandag ${MAANDAG}: de app rekent met die dag (${maandag.diensten} diensten, ${maandag.rijdt} voertuigen rijden)`);
for (const T of [330, 240, 390]) {
  await zet(M.page, T); const s = await ritStand(M.page);
  check(!s.fout, `maandag ${hm(T)}: geen rit van vandaag met vertrek na ${hm(T)} op Afgerond (${s.n} ritten${s.fout ? `; fout: ${s.vb.join(', ')}` : ''}); Wognum ${s.wognumGepland} van ${s.wognum} ritten nog gepland`);
}
// 04:00: nachtritten van gisteren die nog lopen, staan als onderweg (het voertuig rijdt ze), niet als gepland of afgerond
await zet(M.page, 240);
const nacht = await M.page.evaluate(() => { const c = window.SLCT.ui.ctx; const T = c.state.simTime; let rijdt = 0, ok = 0; for (const t of c.fleet.trucks) { const s = c.S.get(t.id); if (!s || !(s.st === 'onderweg' || s.st === 'vertraagd' || s.st === 'klant') || T >= t.dayStart) continue; const r = c.R.ritOf(t, T); if (!r) continue; rijdt++; const st = c.R.stateOf(r, T, c.S).st; if (st !== 'gepland' && st !== 'afgerond') ok++; } return { rijdt, ok }; });
check(nacht.rijdt > 0 && nacht.ok === nacht.rijdt, `maandag 04:00: ${nacht.rijdt} voertuigen rijden nog de nachtdienst van gisteren, ${nacht.ok} van hun ritten staan als onderweg of bij klant`);
// 05:30: de ritpagina van de eerste rit van Wognum die na de klok begint (ook het laden of koppelen aan het dock: een rit
// waarvan dat al loopt, is begonnen en blijft op zijn voertuig)
await zet(M.page, 330);
const eerste = await M.page.evaluate(() => { const c = window.SLCT.ui.ctx; const T = c.state.simTime; const L = c.R.all().filter(r => r.t.base.n === 'Wognum' && r.t.dayStart + r.t.plan[r.i0].t0 > T + 5 && r.dep < T + 120 && r.stops.length).sort((a, b) => a.dep - b.dep); return L.slice(0, 6).map(r => r.id); });
check(eerste.length > 0, `maandag 05:30: ${eerste.length} ritten van Wognum beginnen tussen 05:35 en 07:30 (${eerste.slice(0, 3).join(', ')})`);
if (eerste.length) {
  await M.page.evaluate(id => { location.hash = `rit/${id}`; }, eerste[0]); await M.page.waitForTimeout(1500);
  const pg = await M.page.evaluate(() => { const s = document.getElementById('sheet'); const h = s && s.querySelector('h1'); return { h: h ? h.textContent.replace(/\s+/g, ' ').trim() : '', knop: !!(s && s.querySelector('[data-open^="planbord/"]')), mijl: s ? [...s.querySelectorAll('table.mp tbody tr.done')].length : -1 }; });
  check(/Gepland/.test(pg.h) && !/Afgerond/.test(pg.h) && pg.knop && pg.mijl === 0, `maandag 05:30: de ritpagina van ${eerste[0]} zegt "${pg.h}", heeft "Verplaats deze rit" en nog geen gereden mijlpaal (${pg.mijl})`);
}
// het planbord: het blok staat klaar, is niet vastgezet, en een pijltje naar rechts schuift hem (getoetst)
let verschoven = null; const pbUit = [];
for (const id of eerste) {
  await M.page.evaluate(x => { location.hash = `planbord/${x}`; }, id); await M.page.waitForTimeout(3200);
  const blok = await M.page.evaluate(x => { const n = document.querySelector(`#v-planbord [data-task-id="${CSS.escape(x)}"]`); return n ? { vast: n.classList.contains('vast'), gepland: n.classList.contains('st-gepland'), focus: document.activeElement === n } : null; }, id);
  const t0 = await toasts(M.page);
  pbUit.push(`${id}: ${blok ? `${blok.vast ? 'vast' : 'los'}, ${blok.gepland ? 'gepland' : 'niet gepland'}` : 'geen blok'}; ${t0.slice(-1)[0] || ''}`);
  if (!blok || blok.vast || !blok.gepland || t0.some(x => /al begonnen/.test(x))) continue;
  await M.page.focus(`#v-planbord [data-task-id="${id}"]`); await M.page.keyboard.press('ArrowRight'); await M.page.waitForTimeout(1500);
  const t1 = await toasts(M.page);
  if (t1.some(x => /verschoven naar/.test(x))) { verschoven = { id, toast: t1.find(x => /verschoven naar/.test(x)) }; break; }
}
check(!pbUit.some(x => /vast|al begonnen/.test(x)), `maandag 05:30: op het planbord staan de ritten die na de klok vertrekken los en klaar (${pbUit.slice(0, 3).join(' | ')})`);
check(!!verschoven, `maandag 05:30: het planbord verplaatst zo'n rit echt, getoetst${verschoven ? ` (${verschoven.toast})` : ''}`);
// Gisteren op maandag: de zondag uit de historie, niet leeg en minder dan een werkdag
await M.page.evaluate(() => { location.hash = 'planbord'; }); await M.page.waitForTimeout(1500);
await M.page.click('#v-planbord [data-pbdag="gisteren"]'); await M.page.waitForTimeout(2500);
const gisteren = await M.page.evaluate(() => {
  const rows = [...document.querySelectorAll('#v-planbord .sg-table-body .sg-table-row, #v-planbord .sg-table-row')].map(r => r.textContent);
  const leeg = rows.filter(t => /gisteren niet ingezet/.test(t)).length; const blokken = document.querySelectorAll('#v-planbord .pb-hist').length;
  const P = window.SLCT.people; const g = new Date(); g.setHours(0, 0, 0, 0); g.setDate(g.getDate() - 1);
  const W = window.SLCT.fleet.trucks.filter(t => t.base.n === 'Wognum'); const met = W.filter(t => P.forTruck.get(t.id).history.some(h => h.date.toDateString() === g.toDateString())).length;
  return { rows: rows.length, leeg, blokken, met, n: W.length, zondag: g.getDay() === 0, note: (document.querySelector('#v-planbord [data-pb=dagnote]') || {}).textContent || '' };
});
check(gisteren.zondag && gisteren.met > 0 && gisteren.met / gisteren.n >= 0.3 && gisteren.met / gisteren.n <= 0.6, `Gisteren op maandag (zondag): ${gisteren.met} van de ${gisteren.n} voertuigen van Wognum reden een dienst (${Math.round(gisteren.met / gisteren.n * 100)} %, verwacht 30 tot 60), niet leeg`);
check(gisteren.blokken > 0 && gisteren.leeg < gisteren.rows && /zondag/.test(gisteren.note), `het planbord toont Gisteren met ${gisteren.blokken} diensten in beeld en zegt dat het zondag was ("${gisteren.note.slice(0, 90)}")`);
await M.ctx.close();

// de maandag na de zomertijd: ook dan is Gisteren de zondag uit de historie, niet leeg
{
  const Zm = await open(ZOMER, 330);
  const z = await Zm.page.evaluate(() => { const P = window.SLCT.people; const g = new Date(); g.setHours(0, 0, 0, 0); g.setDate(g.getDate() - 1); const W = window.SLCT.fleet.trucks.filter(t => t.base.n === 'Wognum'); return { zondag: g.getDay() === 0, met: W.filter(t => P.forTruck.get(t.id).history.some(h => h.date.toDateString() === g.toDateString())).length, n: W.length }; });
  check(z.zondag && z.met / z.n >= 0.3 && z.met / z.n <= 0.6, `maandag ${ZOMER}, na de zomertijd: Gisteren is de zondag, ${z.met} van de ${z.n} voertuigen van Wognum reden een dienst (niet leeg)`);
  await Zm.ctx.close();
}

// ---------- zondag: minder diensten ----------
const Z = await open(ZONDAG, 330);
const zondag = await Z.page.evaluate(() => { const f = window.SLCT.fleet; return { dag: f.vandaag.getDay(), diensten: f.trucks.reduce((n, t) => n + t.diensten.length, 0), rijdt: f.trucks.filter(t => t.diensten.length).length, vrij: f.trucks.filter(t => t.zondagVrij).length, poolVandaag: f.pool.filter(p => p.dag === 'vandaag').length, poolMorgen: f.pool.filter(p => p.dag === 'morgen').length }; });
const deel = zondag.diensten / maandag.diensten;
check(zondag.dag === 0 && deel >= 0.35 && deel <= 0.55, `zondag ${ZONDAG}: ${zondag.diensten} diensten tegen ${maandag.diensten} op maandag (${Math.round(deel * 100)} %, schatting 35 tot 55), ${zondag.vrij} voertuigen vrij op het terrein`);
check(zondag.poolVandaag < zondag.poolMorgen, `zondag: minder open ritten vandaag (${zondag.poolVandaag}) dan voor maandag (${zondag.poolMorgen})`);
for (const T of TIJDEN) { await zet(Z.page, T); const s = await ritStand(Z.page); check(!s.fout, `zondag ${hm(T)}: geen rit van vandaag met vertrek na ${hm(T)} op Afgerond (${s.n} ritten${s.fout ? `; fout: ${s.vb.join(', ')}` : ''})`); }
await Z.page.evaluate(() => { location.hash = 'planbord'; }); await Z.page.waitForTimeout(2500);
// de vrije voertuigen staan onderaan het bord: scroll naar beneden (de rijen buiten beeld tekent het bord niet)
await Z.page.evaluate(() => { for (const s of document.querySelectorAll('#v-planbord .sg-timeline-body, #v-planbord .pb-gantt, #v-planbord .sg-table-body')) s.scrollTop = s.scrollHeight; }); await Z.page.waitForTimeout(1200);
const zNote = await Z.page.evaluate(() => ({ note: (document.querySelector('#v-planbord [data-pb=dagnote]') || {}).textContent || '', vrij: [...document.querySelectorAll('#v-planbord .sg-table-row')].filter(r => /zondag, vrij/.test(r.textContent)).length, data: window.SLCT.fleet.trucks.filter(t => t.base.n === 'Wognum' && t.zondagVrij).length }));
check(/Zondag/.test(zNote.note) && zNote.vrij > 0, `zondag: het planbord zegt het ("${zNote.note.slice(0, 80)}") en onderaan staan de vrije voertuigen als "zondag, vrij" (${zNote.vrij} in beeld, ${zNote.data} op Wognum)`);
await Z.ctx.close();

// ---------- de oefendag: een open rit die niet ingevuld wordt ----------
const O = await open(MAANDAG, 330, { oefendag: true });
await zet(O.page, 380);
const voor = await O.page.evaluate(() => { const c = window.SLCT.ui.ctx; const p = c.fleet.pool.find(x => x.id === 'P-8001'); return { p: p ? { venster: p.venster, bekend: p.bekend } : null, open: c.fleet.poolAt(c.state.simTime).some(x => x.id === 'P-8001'), zaak: !!c.Z.list().find(z => z.key === 'N:P-8001') }; });
check(!!voor.p && voor.open && !voor.zaak, `oefendag 06:20: P-8001 (laden ${voor.p ? `${hm(voor.p.venster[0])} tot ${hm(voor.p.venster[1])}` : '?'}) staat nog open, geen zaak`);
await zet(O.page, 405); await O.page.waitForTimeout(600);
const na = await O.page.evaluate(() => { const c = window.SLCT.ui.ctx; const z = c.Z.list().find(x => x.key === 'N:P-8001'); const T = c.state.simTime; const g = c.M.sample(T, c.fleet.trucks.filter(t => c.inScope(t)), []).gemist; return { zaak: z ? { kind: z.kind, open: z.open, first: z.first, text: z.text, scoped: c.Z.scoped().includes(z) } : null, open: c.fleet.poolAt(T).some(x => x.id === 'P-8001'), gemist: g }; });
check(!!na.zaak && na.zaak.kind === 'Rit niet ingevuld' && na.zaak.open && na.zaak.scoped && na.zaak.first === 390, `oefendag 06:45: P-8001 is een open zaak "Rit niet ingevuld" sinds ${na.zaak ? hm(na.zaak.first) : '?'} in het werkgebied ("${na.zaak ? na.zaak.text : ''}")`);
check(!na.open && na.gemist >= 1, `oefendag 06:45: P-8001 is niet meer open in te plannen en telt als gemist naast Op tijd (${na.gemist} gemist in het werkgebied)`);
await O.page.evaluate(() => { location.hash = 'openritten'; }); await O.page.waitForTimeout(1800);
const or = await O.page.evaluate(() => { const b = document.querySelector('#v-openritten [data-or="P-8001"]'); const g = b && b.closest('.or-g'); return { rij: b ? b.textContent.replace(/\s+/g, ' ').trim() : '', groep: g ? (g.querySelector('h3') || {}).textContent || '' : '' }; });
check(/gemist/.test(or.rij) && /Gemist vandaag/.test(or.groep), `oefendag 06:45: P-8001 staat in Open ritten onder "${or.groep.replace(/\s+/g, ' ').trim()}" ("${or.rij.slice(0, 80)}")`);
await O.page.evaluate(() => { location.hash = 'melding/N-P-8001'; }); await O.page.waitForTimeout(1800);
const zp = await O.page.evaluate(() => { const s = document.getElementById('sheet'); return { h: (s.querySelector('h1') || {}).textContent || '', pri: [...s.querySelectorAll('.btn.pri')].map(b => b.textContent.trim()), keuzes: [...s.querySelectorAll('.prop .prop-h')].map(x => x.textContent.trim()), tel: !!s.querySelector('a[href^="tel:"]') }; });
check(/Rit niet ingevuld/.test(zp.h) && zp.pri.length === 1 && zp.keuzes.some(k => /Morgen als eerste/.test(k)) && zp.keuzes.some(k => /klant/.test(k)) && !zp.tel, `oefendag 06:45: de zaakpagina "${zp.h.replace(/\s+/g, ' ').trim()}" met de keuzes (${zp.keuzes.join(', ')}) en één hoofdknop (${zp.pri.join(', ')}), geen tel:-link`);
// morgen als eerste: de zaak is daarna door de planner opgelost, de rit staat bij morgen en blijft vandaag gemist
const knop = await O.page.$('#sheet [data-nmorgen]');
if (knop) await knop.click(); await O.page.waitForTimeout(1500);
const morgen = await O.page.evaluate(() => { const c = window.SLCT.ui.ctx; const T = c.state.simTime; const z = c.Z.list().find(x => x.key === 'N:P-8001'); const p = c.fleet.pool.find(x => x.id === 'P-8001'); return { status: z ? z.status : null, door: z ? z.closedBy : null, dag: p.dag, morgen: c.fleet.poolAt(T).some(x => x.id === 'P-8001' && x.dag === 'morgen'), gemist: c.M.sample(T, c.fleet.trucks.filter(t => c.inScope(t)), []).gemist }; });
check(morgen.status === 'opgelost' && morgen.door === 'planner' && morgen.morgen && morgen.gemist >= 1, `oefendag: morgen als eerste zet P-8001 bij de open ritten van morgen (${morgen.morgen}); de zaak is opgelost door de ${morgen.door}; vandaag telt hij als gemist (${morgen.gemist})`);
await O.ctx.close();

check(!errors.length, `geen paginafouten${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
check(!buiten.size, `geen verzoeken naar buiten${buiten.size ? `: ${[...buiten].join(', ')}` : ''}`);
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
