// Controles op Vrijgeven (Control Tower 4.1, bouwstenen C, D en E): de planning vrijgeven, het bericht aan de chauffeur en
// de ritopdracht naar de boordcomputer.
//
//   npm run build && (cd dist && python3 -m http.server 8832 --bind 127.0.0.1) &
//   node tests/vrijgeven-check.mjs [http://127.0.0.1:8832/index.html] [--schermen map]
//
// De klok van de browser staat vast (page.clock.setFixedTime, maandag 26 oktober 2026, Nederlandse tijd), de klok van de app
// op 01:00: de diensten van de dag zijn dan nog niet begonnen. Werkgebied Wognum, als planner. Wat er gecontroleerd wordt:
// - Planning vrijgeven zet elke dienst van de standplaats op vrijgegeven, met een logregel per dienst ("per app" of "per
//   mail") en een samenvatting.
// - Het bericht aan elke chauffeur heeft de begintijd, het voertuig, de ritten (met ritnummer) en een link #rit/<id>.
// - De bevestiging komt na een paar minuten simulatietijd (gezien, bevestigd) en blijft soms uit (wacht op bevestiging).
// - Een wijziging na vrijgeven (de tweede dienst van een voertuig een half uur later) toont alleen bij die dienst het verschil;
//   Wijzigingen vrijgeven stuurt alleen dat, met een logregel voor die dienst.
// - Elke rit van een vrijgegeven dienst heeft een geldige OTM5-ritopdracht (de export en het paneel per rit, gevalideerd
//   tegen OTM 5.9), zonder naam van een chauffeur; de verschoven ritten hebben versie 2.
// - Onderweg en afgerond volgen uit de simulatie; de directie en HR zien de knop niet; na herladen staat alles er nog.
// - De oefendag (?scenario=druk) heeft zijn eigen vrijgave.
// - Geen paginafouten, geen verzoek naar buiten, geen tel:, geen mailto.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { maakValidator } from './otm5/valideer.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const url = args.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8832/index.html';
const schermen = args.includes('--schermen') ? args[args.indexOf('--schermen') + 1] : null;
if (schermen) fs.mkdirSync(schermen, { recursive: true });
const SP = 'Wognum', DAG = '2026-10-26', T0 = 60;
let fail = 0, n = 0;
const check = (ok, msg) => { n++; console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const valideer = maakValidator();

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const host = new URL(url).host; const errors = []; const buiten = new Set();
async function open({ oefendag = false, vp = { width: 1440, height: 900 }, thema = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: vp, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL', acceptDownloads: true, isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  await ctx.addInitScript(([oef, sp, thema]) => { try { if (!sessionStorage.getItem('vg')) { localStorage.clear(); localStorage.setItem('sl-werkgebied', JSON.stringify({ regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role: 'planner', sp })); localStorage.setItem('sl-theme', thema); if (oef) localStorage.setItem('sl-oefendag', 'druk'); sessionStorage.setItem('vg', '1'); } } catch { /* geen opslag */ } }, [oefendag, SP, thema]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' && !/ERR_BLOCKED|Failed to load/.test(m.text())) || (m.type() === 'warning' && /^(weergave|route|actie)/.test(m.text()))) errors.push(m.text()); });
  await page.route('**/*', route => { const u = route.request().url(); if (/^(data|blob|about):/.test(u)) return route.continue(); const x = new URL(u); if (x.host !== host) { buiten.add(x.host); return route.abort('blockedbyclient'); } return route.continue(); });
  await page.clock.setFixedTime(new Date(`${DAG}T10:00:00+01:00`));
  await laad(page);
  return { ctx, page };
}
async function laad(page) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300000, polling: 250 });
  await page.evaluate(() => { window.SLCT.state.playing = false; });
}
const zet = async (page, T) => { await page.evaluate(T => { const S = window.SLCT; S.state.playing = false; S.state.simTime = T; S.ui.frame(true); S.ui.ctx.refreshAll(); }, T); await page.waitForTimeout(500); };
const naar = async (page, sp = SP) => { await page.evaluate(sp => { location.hash = `#vrijgeven/${sp}`; }, sp); await page.waitForTimeout(900); };
const rijen = page => page.evaluate(() => [...document.querySelectorAll('#v-vrijgeven .vg-d')].map(d => ({ k: d.dataset.k, st: d.dataset.st, wacht: d.dataset.wacht === '1', diff: d.dataset.diff === '1', tekst: (d.querySelector('.vg-diff') || {}).textContent || '' })));
const telSt = L => L.reduce((a, r) => (a[r.st] = (a[r.st] || 0) + 1, a), {});
const scherm = async (page, naam) => { if (schermen) await page.screenshot({ path: path.join(schermen, naam) }); };
const toets = async (page, sel) => { await page.click(sel); await page.waitForTimeout(400); };
const bevestig = async page => { await page.waitForSelector('#dialog [data-vgok]', { timeout: 5000 }); await page.click('#dialog [data-vgok]'); await page.waitForTimeout(900); };
// een download opvangen en als JSON lezen
async function download(page, sel) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(sel)]);
  const p = await d.path(); return { naam: d.suggestedFilename(), doc: JSON.parse(fs.readFileSync(p, 'utf8')) };
}

// ======================= gewone dag =======================
const { ctx: c1, page } = await open();
await zet(page, T0); await naar(page);
const voor = await page.evaluate(() => { const v = document.getElementById('v-vrijgeven'); return { on: v.classList.contains('on'), hash: decodeURIComponent(location.hash), knop: (v.querySelector('[data-vg="vrij"]') || {}).textContent || '', nav: !!document.querySelector('#side [data-nav="vrijgeven"]') }; });
const R0 = await rijen(page); const S0 = telSt(R0);
check(voor.on && voor.hash === `#vrijgeven/${SP}` && voor.nav, `#vrijgeven/${SP} opent de weergave Vrijgeven (menu onder Planbord: ${voor.nav ? 'ja' : 'nee'})`);
check(R0.length > 10 && S0.concept === R0.length && new RegExp(`Planning vrijgeven \\(${R0.length}\\)`).test(voor.knop), `01:00: ${R0.length} diensten van ${SP}, alle concept; de knop "${voor.knop.trim()}"`);
await scherm(page, 'vrijgeven-1440-licht-voor.png');
const logVoor = await page.evaluate(() => window.SLCT.ui.ctx.A.acts.log.length);
await toets(page, '#v-vrijgeven [data-vg="vrij"]');
const dlgTxt = await page.evaluate(() => (document.querySelector('#dialog .dlg-b') || {}).textContent || '');
check(/per app/.test(dlgTxt) && /per mail/.test(dlgTxt) && /ritopdracht/.test(dlgTxt), `vrijgeven vraagt om bevestiging: "${dlgTxt.trim().slice(0, 120)}…"`);
await bevestig(page);
const R1 = await rijen(page); const S1 = telSt(R1);
const log1 = await page.evaluate(n0 => { const L = window.SLCT.ui.ctx.A.acts.log; return L.slice(0, L.length - n0).map(l => ({ txt: l.txt, v: l.vrijgave || null })); }, logVoor);
const perDienst = log1.filter(l => l.v && R0.some(r => r.k === l.v));
const samen = log1.filter(l => l.v === SP && /gaf de planning van/.test(l.txt));
check(S1.vrijgegeven === R0.length, `na Planning vrijgeven: ${S1.vrijgegeven || 0} van ${R0.length} diensten op vrijgegeven`);
check(perDienst.length === R0.length && new Set(perDienst.map(l => l.v)).size === R0.length && perDienst.every(l => /per (app|mail)/.test(l.txt)) && samen.length === 1,
  `logboek: een regel per dienst (${perDienst.length}, elk "per app" of "per mail": ${perDienst.filter(l => /per app/.test(l.txt)).length} per app, ${perDienst.filter(l => /per mail/.test(l.txt)).length} per mail) en een samenvatting: "${(samen[0] || {}).txt || ''}"`);

// het bericht: de eerste dienst open
const eerste = R1[0].k;
await page.click(`#v-vrijgeven [data-vgs="${eerste}"]`); await page.waitForTimeout(600);
const msg = await page.evaluate(k => {
  const c = window.SLCT.ui.ctx; const el = document.querySelector(`[data-bericht="${k}"]`); const D = c.ui.vgData.X.find(x => x.key === k);
  const hh = m => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`; };
  return { tekst: el ? el.textContent : '', begin: hh(D.start), t: D.t.id, ritten: D.ritten.map(r => r.id), link: !!(el && el.querySelector(`[data-open="rit/${D.ritten[0] && D.ritten[0].id}"]`)) };
}, eerste);
check(msg.tekst.includes(`Begin: ${msg.begin}`) && msg.tekst.includes(`Voertuig: ${msg.t}`) && msg.ritten.length && msg.ritten.every(id => msg.tekst.includes(id)) && msg.tekst.includes(`#rit/${msg.ritten[0]}`) && msg.link && /Pauze:/.test(msg.tekst),
  `het bericht aan ${eerste}: begintijd ${msg.begin}, voertuig ${msg.t}, ${msg.ritten.length} ritten (${msg.ritten.join(', ')}), de pauze en de link #rit/${msg.ritten[0]} (een knop in de app)`);
await scherm(page, 'vrijgeven-1440-licht-bericht.png');
// de link opent de rit, Terug komt terug op Vrijgeven
await page.click(`[data-bericht="${eerste}"] [data-open^="rit/"]`); await page.waitForTimeout(800);
const opRit = await page.evaluate(() => decodeURIComponent(location.hash));
await page.goBack(); await page.waitForTimeout(800);
check(opRit === `#rit/${msg.ritten[0]}` && await page.evaluate(sp => decodeURIComponent(location.hash) === `#vrijgeven/${sp}` && document.getElementById('v-vrijgeven').classList.contains('on'), SP), `de link in het bericht opent ${opRit}; Terug brengt je weer op Vrijgeven`);

// de bevestiging: 45 minuten later
await zet(page, T0 + 45);
const R2 = await rijen(page); const S2 = telSt(R2); const wacht = R2.filter(r => r.wacht).length;
const chipWacht = await page.evaluate(() => +((document.querySelector('[data-vgf="wacht"] .n') || {}).textContent || -1));
check((S2.bevestigd || 0) > R2.length / 2 && wacht > 0 && wacht < R2.length / 4 && chipWacht === wacht, `01:45: ${S2.bevestigd || 0} bevestigd, ${S2.gezien || 0} gezien, ${S2.vrijgegeven || 0} nog niet gezien; ${wacht} wachten op bevestiging (het filter zegt ${chipWacht})`);
const wachtRij = R2.find(r => r.wacht);
if (wachtRij) { await page.click(`#v-vrijgeven [data-vgs="${wachtRij.k}"]`); await page.waitForTimeout(500); }
const belt = await page.evaluate(k => { const d = document.querySelector(`.vg-d[data-k="${k}"]`); return d ? { bel: !!d.querySelector('[data-bel]'), note: /Nog geen akkoord/.test(d.textContent) } : null; }, wachtRij && wachtRij.k);
check(!!belt && belt.bel && belt.note, `een dienst zonder akkoord (${wachtRij && wachtRij.k}) zegt "Nog geen akkoord" met een belknop (demo: er wordt niet gebeld)`);
await scherm(page, 'vrijgeven-1440-licht-na.png');

// een wijziging na vrijgeven: de tweede dienst van een voertuig een half uur later
const doel = await page.evaluate(sp => { const c = window.SLCT.ui.ctx; const t = c.fleet.trucks.find(t => t.base.n === sp && t.diensten.length === 2 && t.diensten[1].person && c.R.all().some(r => r.dienst === t.diensten[1])); return t ? { t: t.id, k: t.diensten[1].person.id, a: t.diensten[1].start } : null; }, SP);
await page.evaluate(d => { const S = window.SLCT; S.ui.runAction({ k: 'schuif', t: d.t, d: 1, min: 30, T: S.state.simTime }, true); S.ui.frame(true); S.ui.ctx.refreshAll(); }, doel);
await page.waitForTimeout(800);
const R3 = await rijen(page); const met = R3.filter(r => r.diff);
const knopW = await page.evaluate(() => (document.querySelector('#v-vrijgeven [data-vg="verschil"]') || {}).textContent || '');
check(met.length === 1 && met[0].k === doel.k && /Begin \d\d:\d\d wordt \d\d:\d\d/.test(met[0].tekst) && /Wijzigingen vrijgeven \(1\)/.test(knopW), `na het verschuiven van de tweede dienst van ${doel.t}: alleen ${doel.k} toont een verschil ("${(met[0] || {}).tekst.trim()}"), knop "${knopW.trim()}"`);
await page.click('[data-vgf="gewijzigd"]'); await page.waitForTimeout(400);
await scherm(page, 'vrijgeven-1440-licht-verschil.png');
const logW0 = await page.evaluate(() => window.SLCT.ui.ctx.A.acts.log.length);
await toets(page, '#v-vrijgeven [data-vg="verschil"]'); await bevestig(page);
const logW = await page.evaluate(n0 => { const L = window.SLCT.ui.ctx.A.acts.log; return L.slice(0, L.length - n0).map(l => ({ txt: l.txt, v: l.vrijgave || null })); }, logW0);
await page.click('[data-vgf="alle"]'); await page.waitForTimeout(400);
const R4 = await rijen(page); const na = R4.find(r => r.k === doel.k);
check(logW.length === 2 && logW.some(l => l.v === doel.k && /een wijziging in de dienst: Begin/.test(l.txt)) && !R4.some(r => r.diff) && na && na.st === 'vrijgegeven', `Wijzigingen vrijgeven: twee logregels (de dienst van ${doel.k} en de samenvatting), geen verschil meer, de dienst weer op vrijgegeven tot de chauffeur bevestigt`);

// de ritopdrachten: de export van de standplaats en het paneel van een rit
const ex = await download(page, '#v-vrijgeven [data-vg="export"]');
const v1 = valideer(ex.doc);
const namen = await page.evaluate(() => [...new Set(window.SLCT.ui.ctx.ui.vgData.X.map(x => x.naam).filter(Boolean))]);
const json = JSON.stringify(ex.doc);
const nRit = await page.evaluate(() => window.SLCT.ui.ctx.ui.vgData.X.filter(x => x.rec).reduce((a, x) => a + x.ritten.length, 0));
const ritnr = ex.doc.trips.map(t => (t.externalIdentifiers.find(x => x.scheme === 'simonloos:ritnummer') || {}).id);
const versie2 = ex.doc.trips.filter(t => t.externalAttributes.simonloos.ritopdracht.dienst === doel.k).map(t => t.externalAttributes.simonloos.ritopdracht.versie);
check(ex.doc.trips.length === nRit && ritnr.every(Boolean) && new Set(ritnr).size === nRit, `export ${ex.naam}: ${ex.doc.trips.length} ritopdrachten, een per rit van een vrijgegeven dienst (${nRit}), elk met zijn ritnummer`);
check(!v1.fout.length && v1.refs > 0 && !v1.los, `elke entiteit in de export valideert tegen OTM 5.9 (${v1.n} entiteiten) en elke verwijzing (${v1.refs}) wijst naar iets in het bestand${v1.fout.length ? `: ${v1.fout.join(' | ')}` : ''}${v1.los ? `; ${v1.los} los` : ''}`);
check(versie2.length > 0 && versie2.every(v => v === 2), `de ritten van de verschoven dienst gingen opnieuw, als versie 2 (${versie2.join(', ')})`);
const trip0 = ex.doc.trips[0];
const heeft = { stops: trip0.actions.filter(a => a.entity.actionType === 'stop').length, venster: ex.doc.trips.some(t => t.actions.some(a => a.entity.constraint)), oplegger: ex.doc.trips.some(t => JSON.stringify(t).includes('attachTransportEquipment')), chauffeur: ex.doc.trips.every(t => t.actors.some(a => a.roles.includes('driver'))), adres: ex.doc.locations.some(l => l.administrativeReference && l.administrativeReference.street) };
check(heeft.stops >= 3 && heeft.venster && heeft.oplegger && heeft.chauffeur && heeft.adres && !namen.some(nm => json.includes(nm)), `een ritopdracht heeft stops met tijden (${heeft.stops} in de eerste), vensters, de oplegger (koppelen bij vertrek), de chauffeur als nummer en het laadadres met straat; geen van de ${namen.length} namen van chauffeurs staat in het bestand`);
const ritKnop = await page.evaluate(k => { const d = document.querySelector(`.vg-d[data-k="${k}"]`); const b = d && d.querySelector('[data-vgro]'); return b ? b.dataset.vgro : null; }, eerste);
await page.click(`.vg-d[data-k="${eerste}"] [data-vgro="${ritKnop}"]`); await page.waitForTimeout(900);
const paneel = await page.evaluate(() => { const pre = document.querySelector('#dialog pre[data-ritopdracht]'); return pre ? pre.textContent : null; });
let pdoc = null; try { pdoc = JSON.parse(paneel); } catch { pdoc = null; }
const v2 = pdoc ? valideer(pdoc) : { fout: ['geen JSON'], n: 0, los: 0, refs: 0 };
await scherm(page, 'vrijgeven-1440-licht-ritopdracht.png');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
const dicht = await page.evaluate(id => ({ dicht: document.getElementById('dialog').hidden, focus: document.activeElement && document.activeElement.dataset.vgro === id }), ritKnop);
check(pdoc && pdoc.rit === ritKnop && pdoc.trips.length === 1 && !v2.fout.length && !v2.los && dicht.dicht && dicht.focus, `het paneel van ${ritKnop}: een geldige OTM5-ritopdracht (${v2.n} entiteiten, alle verwijzingen in het bericht); Esc sluit het en de focus staat weer op de knop`);

// onderweg en afgerond volgen uit de simulatie
await zet(page, 13 * 60);
const R5 = await rijen(page); const S5 = telSt(R5);
const sim = await page.evaluate(() => { const c = window.SLCT.ui.ctx; const T = c.state.simTime; let fout = 0; for (const x of c.ui.vgData.X) { const Td = ((T % 1440) + 1440) % 1440; const rel = Td - x.t.dayStart; const s = Td < x.t.dayStart || rel < x.d.t0 ? 'komt' : rel < x.d.t1 ? 'onderweg' : 'afgerond'; if (s !== 'komt' && s !== x.st) fout++; } return fout; });
check((S5.onderweg || 0) > 0 && (S5.afgerond || 0) > 0 && !sim, `13:00: ${S5.onderweg || 0} onderweg en ${S5.afgerond || 0} afgerond, gelijk aan de simulatie (${sim} anders)`);

// rollen: de directie en HR zien de knop niet
await zet(page, T0);
await page.evaluate(() => window.SLCT.ui.ctx.setRole('directie')); await page.waitForTimeout(600);
const dir = await page.evaluate(() => ({ vrij: !!document.querySelector('#v-vrijgeven [data-vg="vrij"]'), versch: !!document.querySelector('#v-vrijgeven [data-vg="verschil"]'), uitleg: /Alleen planners en regiomanagers geven vrij/.test(document.querySelector('#v-vrijgeven .vg-uitleg').textContent) }));
await page.evaluate(() => window.SLCT.ui.ctx.setRole('hr')); await page.waitForTimeout(600);
const hr = await page.evaluate(() => !!document.querySelector('#v-vrijgeven [data-vg="vrij"], #v-vrijgeven [data-vg="verschil"]'));
await page.evaluate(() => window.SLCT.ui.ctx.setRole('planner')); await page.waitForTimeout(400);
check(!dir.vrij && !dir.versch && dir.uitleg && !hr, 'de directie en HR zien Planning vrijgeven en Wijzigingen vrijgeven niet, en lezen dat alleen planners en regiomanagers vrijgeven');

// na herladen staat alles er nog (dezelfde klok)
await zet(page, T0 + 45);
const voorH = await rijen(page); const logH = await page.evaluate(() => window.SLCT.ui.ctx.A.acts.log.filter(l => l.vrijgave).length);
await laad(page); await zet(page, T0 + 45); await naar(page);
const naH = await rijen(page); const logH2 = await page.evaluate(() => window.SLCT.ui.ctx.A.acts.log.filter(l => l.vrijgave).length);
check(naH.length === voorH.length && naH.every((r, i) => r.k === voorH[i].k && r.st === voorH[i].st && r.wacht === voorH[i].wacht) && logH2 === logH, `na herladen: dezelfde ${naH.length} diensten met dezelfde status en wachtrijen (${JSON.stringify(telSt(naH))}), en de ${logH} logregels van het vrijgeven`);

// geen tel: en geen mailto in de app
const links = await page.evaluate(() => [...document.querySelectorAll('[href]')].map(a => a.getAttribute('href')).filter(h => /^(tel|mailto):/i.test(h)).length);
check(!links && !json.includes('mailto:'), 'geen tel:- of mailto-link in de app en niets daarvan in de ritopdrachten');
await c1.close();

// ======================= de telefoon en het donkere thema: schermafbeeldingen en de rij =======================
for (const [vp, thema] of [[{ width: 390, height: 844 }, 'light'], [{ width: 390, height: 844 }, 'dark'], [{ width: 1440, height: 900 }, 'dark']]) {
  const { ctx: c, page: p } = await open({ vp, thema });
  await zet(p, T0); await naar(p);
  const w = vp.width; const tn = thema === 'dark' ? 'donker' : 'licht';
  await scherm(p, `vrijgeven-${w}-${tn}-voor.png`);
  await toets(p, '#v-vrijgeven [data-vg="vrij"]'); await bevestig(p); await zet(p, T0 + 45);
  await p.waitForTimeout(4500); await scherm(p, `vrijgeven-${w}-${tn}-na.png`);
  const L = await rijen(p); const k = (L.find(r => r.wacht) || L[0]).k;
  await p.click(`#v-vrijgeven [data-vgs="${k}"]`); await p.waitForTimeout(600);
  await p.evaluate(k => { const d = document.querySelector(`.vg-d[data-k="${k}"]`); if (d) d.scrollIntoView({ block: 'start' }); }, k); await p.waitForTimeout(300);
  await scherm(p, `vrijgeven-${w}-${tn}-bericht.png`);
  // de ritopdracht van de eerste rit van die dienst, en een verschil na een wijziging
  const id = await p.evaluate(k => { const b = document.querySelector(`.vg-d[data-k="${k}"] [data-vgro]`); return b ? b.dataset.vgro : null; }, k);
  if (id) { await p.click(`.vg-d[data-k="${k}"] [data-vgro="${id}"]`); await p.waitForTimeout(900); await scherm(p, `vrijgeven-${w}-${tn}-ritopdracht.png`); await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const d2 = await p.evaluate(sp => { const c = window.SLCT.ui.ctx; const t = c.fleet.trucks.find(t => t.base.n === sp && t.diensten.length === 2 && t.diensten[1].person && c.R.all().some(r => r.dienst === t.diensten[1])); return t ? t.id : null; }, SP);
  await p.evaluate(t => { const S = window.SLCT; S.ui.runAction({ k: 'schuif', t, d: 1, min: 30, T: S.state.simTime }, true); S.ui.frame(true); S.ui.ctx.refreshAll(); }, d2);
  await p.click('[data-vgf="gewijzigd"]'); await p.waitForTimeout(600);
  const g = (await rijen(p)).filter(r => r.diff).length;
  await scherm(p, `vrijgeven-${w}-${tn}-verschil.png`);
  const ov = await p.evaluate(() => { const v = document.getElementById('v-vrijgeven'); const pg = v.querySelector('.page'); return { breed: document.documentElement.scrollWidth - innerWidth, pagina: pg.scrollWidth - pg.clientWidth, thema: document.getElementById('app').dataset.theme }; });
  check(ov.breed <= 0 && ov.pagina <= 1 && ov.thema === thema && g === 1, `${w} px ${tn}: niets breder dan het scherm (document ${ov.breed}, pagina ${ov.pagina}), het paneel van ${id} en een verschil bij precies een dienst (${g})`);
  await c.close();
}

// ======================= oefendag =======================
const { ctx: c2, page: po } = await open({ oefendag: true });
await zet(po, T0); await naar(po);
const O0 = await rijen(po);
await toets(po, '#v-vrijgeven [data-vg="vrij"]'); await bevestig(po);
const O1 = telSt(await rijen(po));
const opslag = await po.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('sl-vrijgave')).dagen); } catch { return []; } });
check(O0.length > 10 && O1.vrijgegeven === O0.length && opslag.some(k => /:druk$/.test(k)), `oefendag: ${O0.length} diensten vrijgegeven, apart bewaard (${opslag.join(', ')})`);
await po.evaluate(() => { const L = [...document.querySelectorAll('#v-vrijgeven [data-vgs]')]; if (L[0]) L[0].click(); }); await po.waitForTimeout(500);
const om = await po.evaluate(() => (document.querySelector('[data-bericht]') || {}).textContent || '');
check(/Begin: \d\d:\d\d/.test(om) && /#rit\/R-/.test(om), 'oefendag: het bericht heeft de begintijd en de link naar de rit');
await c2.close();

check(!buiten.size, `geen verzoeken naar buiten${buiten.size ? `: ${[...buiten].join(', ')}` : ''}`);
check(!errors.length, `geen paginafouten${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
console.log(fail ? `\n${fail} van ${n} FOUT` : `\nalles in orde (${n} checks)`);
process.exit(fail ? 1 : 0);
