// Rij- en rusttijden over de week, het rooster en de directie op het planbord (Control Tower 4.1, ronde 1).
//
//   npm run build && (cd dist && python3 -m http.server 8774 --bind 127.0.0.1) &
//   node tests/week-check.mjs [http://127.0.0.1:8774/index.html]
//
// Met een vaste klok (zoals ochtend-check): maandag en zondag, 05:30 en 10:00, de gewone dag en de oefendag.
// - Geen kandidaat voor een open rit (heel Nederland) die met de rit boven 56 uur in de week, 90 in twee weken of over de
//   uiterlijke start van zijn weekrust komt, en niemand met vakantie, ziek of een rustdag volgens het rooster. Dat is ook de
//   grens van de toewijzing over alle open ritten (verdeel.js krijgt alleen deze kandidaten, en neemt rijMin en ruimte mee).
// - De teller op de chauffeurspagina is gelijk aan de som van het rijden op het planbord (per chauffeur), voor iedereen met
//   een dienst op Wognum, en op de pagina zelf voor drie chauffeurs.
// - Een sleep over de weekrust gaat niet (de toets zegt waarom, geen vraag om een reden); buiten het rooster vraagt het bord
//   een reden, en met de reden gaat de rit door en staat de afwijking met de reden in het logboek.
// - De directie opent het planbord alleen-lezen: de melding, geen sleepbare blokken, geen Rit inplannen, een pijltje
//   verschuift niets.
// - De chauffeurspagina toont de teller en het rooster, de kandidaatkaart van een open rit de teller of het rooster.
// - Geen paginafouten en geen verzoeken naar buiten.
// SHOTS=<map> bewaart schermafbeeldingen (1440 en 390 px) van de chauffeurspagina, de kandidaatkaart, het rustblok en de directie.
// Andere data: CT_MAANDAG en CT_ZONDAG (JJJJ-MM-DD).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8774/index.html';
const MAANDAG = process.env.CT_MAANDAG || '2026-10-26', ZONDAG = process.env.CT_ZONDAG || '2026-11-01';
const SHOTS = process.env.SHOTS || '';
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmtNl = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const amsterdam = (dag, min) => { for (const off of ['+01:00', '+02:00']) { const d = new Date(`${dag}T${hm(min)}:00${off}`); if (fmtNl.format(d) === hm(min)) return d; } return new Date(`${dag}T${hm(min)}:00+01:00`); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const host = new URL(url).host; const errors = []; const buiten = new Set();
async function open(dag, min, { oefendag = false, sp = 'Wognum', role = 'planner', breed = 1440 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breed, height: breed < 600 ? 844 : 900 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
  await ctx.addInitScript(([oef, sp, role]) => { try { if (!sessionStorage.getItem('wk')) { localStorage.clear(); localStorage.setItem('sl-werkgebied', JSON.stringify({ regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role, sp })); if (oef) localStorage.setItem('sl-oefendag', 'druk'); sessionStorage.setItem('wk', '1'); } } catch { /* geen opslag */ } }, [oefendag, sp, role]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${dag} ${hm(min)}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED|Failed to load/.test(m.text())) errors.push(`${dag} ${hm(min)}: ${m.text()}`); });
  await page.route('**/*', route => { const u = route.request().url(); if (/^(data|blob|about):/.test(u)) return route.continue(); const x = new URL(u); if (x.host !== host) { buiten.add(x.host); return route.abort('blockedbyclient'); } return route.continue(); });
  await page.clock.setFixedTime(amsterdam(dag, min));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300000, polling: 250 });
  await page.evaluate(T => { const S = window.SLCT; S.state.playing = false; S.state.simTime = T; S.ui.frame(true); S.ui.ctx.refreshAll(); }, min);
  await page.waitForTimeout(500);
  return { ctx, page };
}
const naar = async (page, hash, ms = 1500) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(ms); };
const shot = async (page, naam) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${naam}.png` }); console.log(`     schermafbeelding ${SHOTS}/${naam}.png`); };

// ---------- A: de week als harde grens bij de kandidaten (heel Nederland) ----------
const kandidatenWeek = page => page.evaluate(() => {
  const c = window.SLCT.ui.ctx; const T = c.state.simTime; const P = c.people;
  const wd = (P.vandaag.getDay() + 6) % 7; const L = c.fleet.poolAt(T, []).filter(x => !x.gepland);
  let ritten = 0, eigen = 0, fout = 0, uitgesloten = 0, buitenRooster = 0; const vb = [];
  const pastNiet = (tl, a, b, rij) => { const nieuw = a >= (7 - wd) * 1440; const w = (nieuw ? 0 : tl.week.totaal) + rij, w2 = (nieuw ? tl.week.totaal : tl.tweeWeken.totaal) + rij; return w > 3360 || w2 > 5400 || (b > tl.weekrust.uiterlijk && !(tl.laatsteEind !== null && a - tl.laatsteEind >= 1439.5)); };
  for (const it of L) {
    ritten++; const off = it.dag === 'morgen' ? 1440 : 0; const a = it.venster[0] + off, b = a + it.duur;
    const K = c.fleet.kandidaten(it, { T, people: P });
    for (const k of K) {
      if (k.soort !== 'eigen') continue; eigen++; const p = P.byId.get(k.id); const tl = P.tellerVan(p, 0);
      if (pastNiet(tl, a, b, it.rij)) { fout++; if (vb.length < 3) vb.push(`${it.id} ${k.id}`); }
      const d = new Date(P.vandaag.getFullYear(), P.vandaag.getMonth(), P.vandaag.getDate() + (off ? 1 : 0)); const st = p.rooster ? window.SLCT.ui.ctx.people && (k.rooster || '') : '';
      if (/vakantie|ziek|rustdag/.test(st)) { fout++; if (vb.length < 3) vb.push(`${it.id} ${k.id} ${st}`); }
      if ((k.waarschuwingen || []).includes('rooster')) buitenRooster++;
    }
    // wie de week tegenhoudt: eigen chauffeurs van de standplaats die zonder de weekregel mee hadden kunnen doen
    for (const p of P.persons) if (p.base.n === it.sp && pastNiet(P.tellerVan(p, 0), a, b, it.rij)) uitgesloten++;
  }
  return { ritten, eigen, fout, vb, uitgesloten, buitenRooster };
});

// ---------- teller tegen planbord: per chauffeur de som van het rijden in de ritten op het bord ----------
async function tellerTegenBord(page, label) {
  await naar(page, 'planbord', 2500);
  await page.selectOption('#pbPer', 'chauffeur'); await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const c = window.SLCT.ui.ctx; const rows = [...document.querySelectorAll('#v-planbord [data-pbp][data-pbrij]')]; let gelijk = 0; const anders = [];
    for (const el of rows) { const p = c.people.byId.get(el.dataset.pbp); const tl = c.people.tellerVan(p, c.state.simTime); if (Math.abs(tl.vandaag.gepland - +el.dataset.pbrij) <= 1) gelijk++; else if (anders.length < 3) anders.push(`${p.id}: bord ${el.dataset.pbrij}, teller ${tl.vandaag.gepland}`); }
    // het bord tekent alleen de rijen in beeld; de rest rekent de test na uit dezelfde ritten (R.ofTruck, de rijstukken per rit)
    let alle = 0, alleGelijk = 0;
    for (const p of c.people.persons.filter(p => p.base.n === 'Wognum' && p.dienst)) { const { t, d } = p.dienst; let som = 0; for (const r of c.R.ofTruck(t).filter(r => r.d === d.i)) for (let k = r.i0; k <= r.i1; k++) { const sg = t.plan[k]; if (sg && sg.k === 'drive' && sg.d === d.i) som += sg.t1 - sg.t0 - (sg.delay || 0); } alle++; if (Math.abs(Math.round(som) - c.people.tellerVan(p, c.state.simTime).vandaag.gepland) <= 1) alleGelijk++; else if (anders.length < 3) anders.push(`${p.id}: ritten ${Math.round(som)}, teller ${c.people.tellerVan(p, c.state.simTime).vandaag.gepland}`); }
    const rust = document.querySelectorAll('#v-planbord [data-task-id^="rust-"]').length;
    const rustVast = [...document.querySelectorAll('#v-planbord [data-task-id^="rust-"]')].every(n => n.classList.contains('vast'));
    return { rows: rows.length, gelijk, anders, rust, rustVast, alle, alleGelijk, ids: rows.slice(0, 3).map(x => [x.dataset.pbp, +x.dataset.pbrij]) };
  });
  check(r.rows >= 6 && r.gelijk === r.rows && r.alle >= 50 && r.alleGelijk === r.alle, `${label}: de som van het planbord is de teller: ${r.gelijk} van ${r.rows} rijen in beeld, ${r.alleGelijk} van ${r.alle} chauffeurs met een dienst op Wognum${r.anders.length ? `; ${r.anders.join(', ')}` : ''}`);
  check(r.rust >= r.rows && r.rustVast, `${label}: elke chauffeur in beeld heeft een rustblok na zijn dienst (${r.rust}), vast`);
  return r;
}
async function tellerOpPagina(page, ids, label) {
  for (const [id, bord] of ids) {
    await naar(page, `persoon/${id}`, 1500);
    const p = await page.evaluate(() => { const s = document.querySelector('[data-sec=teller]'); const r = document.querySelector('[data-sec=rooster]'); return s ? { v: +s.dataset.tellerVandaag, zin: (s.querySelector('[data-teller-zin]') || {}).textContent || '', rooster: r ? r.querySelectorAll('[data-rdag]').length : 0, vandaag: r ? (r.querySelector('[data-rooster-vandaag]') || {}).textContent || '' : '' } : null; });
    check(!!p && p.v === bord, `${label}: de teller op de chauffeurspagina van ${id} (${p ? p.v : '?'} min rijden vandaag) is de som van het planbord (${bord})`);
    check(!!p && /^Kan vandaag (nog|niet)/.test(p.zin) && /weekrust/.test(p.zin) && p.rooster === 7 && /Vandaag: /.test(p.vandaag), `${label}: ${id} heeft de zin en een rooster van zeven dagen ("${p ? p.zin : ''}")`);
  }
}

// ---------- een sleep (pijltje) over de weekrust en buiten het rooster ----------
async function sleepTests(page, label) {
  // een geplande rit op Wognum die nog niet begon, met een eigen dienst en chauffeur, die vandaag eindigt
  const kies = () => page.evaluate(() => {
    const c = window.SLCT.ui.ctx; const T = c.state.simTime;
    const L = c.R.all().filter(r => r.t.base.n === 'Wognum' && r.t.kind !== 'bus' && c.R.stateOf(r, T, c.S).st === 'gepland' && r.t.dayStart + r.t.plan[r.i0].t0 > T + 60 && r.t.diensten[r.d] && r.t.diensten[r.d].person && r.t.dayStart + r.t.plan[r.i1].t1 < 1380);
    const r = L[Math.floor(L.length / 2)]; if (!r) return null; const p = r.t.diensten[r.d].person;
    return { id: r.id, p: p.id, naam: p.name, a: r.t.dayStart + r.t.plan[r.i0].t0, e: r.t.dayStart + r.t.plan[r.i1].t1 };
  });
  const x = await kies(); check(!!x, `${label}: een geplande rit om mee te slepen`); if (!x) return;
  // 1. de weekrust: zes diensten op rij in de historie, de laatste weekrust eindigt zes dagen voor het eind van de rit
  await page.evaluate(x => {
    const c = window.SLCT.ui.ctx; const p = c.people.byId.get(x.p); const V = c.people.vandaag; const tod = ((x.e % 1440) + 1440) % 1440;
    p._historie = p.history; p._rooster = p.rooster;
    p.history = [6, 5, 4, 3, 2, 1].map(k => ({ date: new Date(V.getFullYear(), V.getMonth(), V.getDate() - k), start: tod, end: tod + 480, rij: 240, km: 0, truck: { id: 'T-test' } }));
    c.people.tellersOpnieuw();
  }, x);
  await naar(page, `planbord/${x.id}`, 3000);
  const voor = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const r = c.R.get(id); return r.t.dayStart + r.t.plan[r.i0].t0; }, x.id);
  await page.focus(`#v-planbord [data-task-id="${x.id}"]`).catch(() => {}); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200);
  const w = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const r = c.R.get(id); return { start: r.t.dayStart + r.t.plan[r.i0].t0, toast: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join(' | '), dlg: !!document.querySelector('[data-pbafwijk]') }; }, x.id);
  check(w.start === voor && /weekrust/i.test(w.toast) && !w.dlg, `${label}: een sleep van ${x.id} over de weekrust van ${x.naam} gaat niet, zonder vraag om een reden ("${w.toast.slice(0, 140)}")`);
  // 2. het rooster: weer een gewone historie, een halve dag die eindigt op het eind van de rit; vijf minuten later is buiten het rooster
  await page.evaluate(x => {
    const c = window.SLCT.ui.ctx; const p = c.people.byId.get(x.p); p.history = p._historie;
    const R = JSON.parse(JSON.stringify(p._rooster)); const wd = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'][(c.people.vandaag.getDay() + 6) % 7];
    R.week[wd] = ['nacht']; R.halveDagTot = ((x.e % 1440) + 1440) % 1440; R.afwezig = []; p.rooster = R; c.people.tellersOpnieuw();
    document.querySelectorAll('#toasts .toast').forEach(t => t.remove());
  }, x);
  await page.focus(`#v-planbord [data-task-id="${x.id}"]`).catch(() => {}); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1000);
  const d1 = await page.evaluate(() => ({ dlg: !!document.querySelector('[data-pbafwijk]'), tekst: (document.querySelector('[data-pbafwijk]') || { closest: () => null }).closest ? ((document.querySelector('[data-pbafwijk]').closest('[role=dialog], .dlg, dialog') || document.body).textContent || '') : '' }));
  check(d1.dlg && /rooster/i.test(d1.tekst), `${label}: buiten het rooster vraagt het bord een reden`);
  if (SHOTS && label.includes('maandag 10:00 gewone dag')) await shot(page, 'reden-1440');
  // zonder reden ("Anders" leeg) gaat het niet; met de eerste reden wel
  await page.evaluate(() => { const r = document.querySelector('input[name=pbReden][value=""]'); if (r) r.checked = true; });
  await page.click('[data-pbafwijk]'); await page.waitForTimeout(500);
  const zonder = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const r = c.R.get(id); return { start: r.t.dayStart + r.t.plan[r.i0].t0, open: !!document.querySelector('[data-pbafwijk]'), toast: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join(' | ') }; }, x.id);
  check(zonder.start === voor && zonder.open && /reden/i.test(zonder.toast), `${label}: zonder reden blijft de rit staan`);
  await page.evaluate(() => { const r = document.querySelector('input[name=pbReden]'); if (r) r.checked = true; });
  await page.click('[data-pbafwijk]'); await page.waitForTimeout(1500);
  const na = await page.evaluate(x => { const c = window.SLCT.ui.ctx; const r = c.R.get(x.id); const log = c.A.acts.log.find(l => /week bewust af van het rooster/.test(l.txt)); return { start: r.t.dayStart + r.t.plan[r.i0].t0, log: log ? log.txt : '' }; }, x);
  check(na.start === voor + 5 && /Reden: De chauffeur heeft ja gezegd/.test(na.log) && na.log.includes(x.naam), `${label}: met de reden gaat de rit 5 minuten later en staat de afwijking in het logboek ("${na.log.slice(0, 160)}")`);
  await page.evaluate(x => { const c = window.SLCT.ui.ctx; const p = c.people.byId.get(x.p); p.rooster = p._rooster; c.people.tellersOpnieuw(); }, x);
}

// ---------- de rondes ----------
const RONDES = [[MAANDAG, 330, false], [MAANDAG, 600, false], [ZONDAG, 330, false], [ZONDAG, 600, false], [MAANDAG, 600, true], [ZONDAG, 330, true]];
let ids0 = null;
for (const [dag, min, oef] of RONDES) {
  const label = `${dag === MAANDAG ? 'maandag' : 'zondag'} ${hm(min)} ${oef ? 'oefendag' : 'gewone dag'}`;
  const M = await open(dag, min, { oefendag: oef });
  const k = await kandidatenWeek(M.page);
  check(k.ritten > 10 && k.eigen > 10 && k.fout === 0, `${label}: ${k.eigen} eigen kandidaten voor ${k.ritten} open ritten, geen boven 56 uur, 90 uur of over de weekrust, niemand met vakantie, ziek of rustdag${k.vb.length ? ` (${k.vb.join(', ')})` : ''}; ${k.uitgesloten} keer hield de week iemand tegen, ${k.buitenRooster} keer buiten het rooster als waarschuwing`);
  const r = await tellerTegenBord(M.page, label);
  if (!ids0 || min === 600) ids0 = r.ids;
  if (min === 600 && !oef) await tellerOpPagina(M.page, r.ids, label);
  if (SHOTS && dag === MAANDAG && min === 600 && !oef) { await naar(M.page, 'planbord', 2000); await M.page.selectOption('#pbPer', 'chauffeur'); await M.page.waitForTimeout(2500); await shot(M.page, 'planbord-rustblok-1440'); }
  if (min === 600) await sleepTests(M.page, label);
  await M.ctx.close();
}

// ---------- de chauffeurspagina en de kandidaatkaart in beeld, op 1440 en 390 px ----------
for (const breed of [1440, 390]) {
  const M = await open(MAANDAG, 600, { breed });
  const pid = ids0 && ids0[0] ? ids0[0][0] : 'P-0001';
  await naar(M.page, `persoon/${pid}`, 1800);
  const z = await M.page.evaluate(() => { const s = document.querySelector('[data-sec=teller]'); const r = document.querySelector('[data-sec=rooster]'); const vis = el => !!el && el.getBoundingClientRect().width > 0; return { teller: vis(s), rooster: vis(r), breed: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
  check(z.teller && z.rooster && z.breed, `${breed} px: de chauffeurspagina toont de teller en het rooster, zonder overloop`);
  if (SHOTS) { await M.page.evaluate(() => { const s = document.querySelector('[data-sec=teller]'); if (s) s.scrollIntoView({ block: 'start' }); }); await M.page.waitForTimeout(300); await shot(M.page, `chauffeurspagina-${breed}`); }
  // een open rit met eigen kandidaten: de kandidaatkaart zegt de teller of het rooster
  const rid = await M.page.evaluate(() => { const c = window.SLCT.ui.ctx; const T = c.state.simTime; const L = c.fleet.poolAt(T, []).filter(x => !x.gepland && x.sp === 'Wognum'); for (const it of L) { const K = c.fleet.kandidaten(it, { T, people: c.people }); if (K.some(k => k.soort === 'eigen' && k.teller)) return it.id; } return null; });
  if (rid) {
    await naar(M.page, `openritten/${rid}`, 2000);
    const kd = await M.page.evaluate(() => { const L = [...document.querySelectorAll('#v-openritten [data-kdteller]')]; return { n: L.length, tekst: L[0] ? L[0].textContent : '' }; });
    check(kd.n >= 1 && /(kan vandaag|weekrust)/.test(kd.tekst), `${breed} px: de kandidaatkaart van ${rid} noemt teller en rooster ("${kd.tekst.slice(0, 120)}")`);
    if (SHOTS) { await M.page.evaluate(() => { const s = document.querySelector('#v-openritten [data-kdteller]'); if (s) s.scrollIntoView({ block: 'center' }); }); await M.page.waitForTimeout(300); await shot(M.page, `kandidaatkaart-${breed}`); }
  } else check(false, `${breed} px: een open rit op Wognum met een eigen kandidaat`);
  // het rustblok op het planbord (Per chauffeur), ook op een telefoon
  if (SHOTS && breed === 390) { await naar(M.page, 'planbord', 2500); await M.page.selectOption('#pbPer', 'chauffeur'); await M.page.waitForTimeout(2500); await M.page.evaluate(() => { const n = document.querySelector('#v-planbord [data-task-id^="rust-"]'); if (n) n.scrollIntoView({ block: 'center', inline: 'center' }); }); await M.page.waitForTimeout(400); await shot(M.page, 'planbord-rustblok-390'); }
  await M.ctx.close();
}

// ---------- de directie op het planbord: alleen-lezen ----------
for (const breed of [1440, 390]) {
  const D = await open(MAANDAG, 600, { role: 'directie', breed });
  const nav = await D.page.evaluate(() => { const b = document.querySelector('[data-nav=planbord]'); return b ? b.getAttribute('aria-disabled') : 'geen'; });
  await naar(D.page, 'planbord', 3000);
  const r = await D.page.evaluate(() => {
    const ro = document.querySelector('#v-planbord [data-pb=ro]'); const taken = [...document.querySelectorAll('#v-planbord .sg-task.pb-rit')];
    return { view: !!document.querySelector('#v-planbord .sg-task'), ro: !!ro && !ro.hidden && /Alleen-lezen: je kijkt mee/.test(ro.textContent), taken: taken.length, los: taken.filter(n => !n.classList.contains('vast')).length, inplannen: document.querySelectorAll('#v-planbord [data-pkwaar]').length, hint: (document.querySelector('#v-planbord [data-pb=hint]') || { hidden: true }).hidden };
  });
  check(nav !== 'true' && r.view && r.ro && r.taken > 5 && r.los === 0 && r.inplannen === 0 && r.hint, `${breed} px: de directie opent het planbord alleen-lezen (menu open, de melding, ${r.taken} ritten, ${r.los} sleepbaar, ${r.inplannen} keer Rit inplannen)`);
  if (breed === 1440) {
    const x = await D.page.evaluate(() => { const c = window.SLCT.ui.ctx; const T = c.state.simTime; const r = c.R.all().find(r => r.t.base.n === 'Wognum' && c.R.stateOf(r, T, c.S).st === 'gepland' && r.t.dayStart + r.t.plan[r.i0].t0 > T + 60); return r ? { id: r.id, a: r.t.dayStart + r.t.plan[r.i0].t0 } : null; });
    if (x) {
      await naar(D.page, `planbord/${x.id}`, 2500);
      await D.page.focus(`#v-planbord [data-task-id="${x.id}"]`).catch(() => {}); await D.page.keyboard.press('ArrowRight'); await D.page.waitForTimeout(800);
      const na = await D.page.evaluate(id => { const c = window.SLCT.ui.ctx; const r = c.R.get(id); return r.t.dayStart + r.t.plan[r.i0].t0; }, x.id);
      const t = await D.page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join(' | '));
      check(na === x.a && /Alleen-lezen: je kijkt mee/.test(t) && !/staat klaar|al begonnen/.test(t), `de directie: een pijltje op rit ${x.id} verschuift niets, en het bord zegt waarom ("${t.slice(0, 120)}")`);
    }
  }
  if (SHOTS) await shot(D.page, `directie-planbord-${breed}`);
  await D.ctx.close();
}

check(!errors.length, `geen paginafouten${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
check(!buiten.size, `geen verzoeken naar buiten${buiten.size ? `: ${[...buiten].join(', ')}` : ''}`);
await browser.close();
console.log(fail ? `\n${fail} FOUT` : '\nAlles in orde.');
process.exit(fail ? 1 : 0);
