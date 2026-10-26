// Controle van de voorstellen en de oefendag (Control Tower 4.0, herstel na de eindcontrole).
//
//   npm run build && (cd dist && python3 -m http.server 8802 --bind 127.0.0.1) &
//   node tests/voorstel-check.mjs [http://127.0.0.1:8802/index.html]
//
// Op een gewone dag en op de oefendag (?scenario=druk): een vertraging is pas een zaak als een stop daardoor na zijn venster
// aankomt (geen zaak met +0 of binnen het venster); elk getoond voorstel bij een vertraging heeft winst in minuten per
// geraakte stop, of is een bericht aan de klant; bij de andere soorten staat wat het oplevert; nergens "1 ... stops".
// Toepassen doet wat het voorstel zegt: na Pas toe heeft elke stop de beloofde ETA en het beloofde venster, de zaak is
// dicht, en na herladen is dat nog zo. Op tijd telt een stop bij aankomst. Open ritten: het vertrek hangt af van wie
// rijdt (aanrijtijd). De oefendag: chip in de topbalk en schakelaar onder Instellingen, vier verstoringen (ziek, file,
// dock, koeling) die elke keer hetzelfde lopen, de zieke diensten bij de open ritten, het dock buiten gebruik leeg in die
// uren, de koelstoring als zaak, en na het uitzetten weer precies de gewone dag.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8802/index.html';
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const note = msg => console.log(`     ${msg}`);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const NL = { regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role: 'planner', sp: null };
const WOGNUM = { ...NL, sp: 'Wognum' };

async function nieuw(profiel) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
  await ctx.addInitScript(p => { try { if (!sessionStorage.getItem('vc-init')) { localStorage.clear(); localStorage.setItem('sl-werkgebied', JSON.stringify(p)); sessionStorage.setItem('vc-init', '1'); } } catch { /* geen opslag */ } }, profiel);
  const page = await ctx.newPage(); const errors = []; const ext = new Set();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED|Failed to load/.test(m.text())) errors.push(m.text()); });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (/^(data|blob|about):/.test(r.request().url())) return r.continue(); if (u.host !== new URL(url).host) { ext.add(u.host); return r.abort('blockedbyclient'); } return r.continue(); });
  return { ctx, page, errors, ext };
}
const klaar = page => page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300000, polling: 500 });
async function laad(page, adres) { await page.goto(adres, { waitUntil: 'load' }); await klaar(page); await page.waitForTimeout(600); }
async function herlaad(page) { await page.reload({ waitUntil: 'load' }); await klaar(page); await page.waitForTimeout(600); }
const setT = (page, T) => page.evaluate(T => { const S = window.SLCT; S.state.playing = false; S.state.simTime = T; S.ui.frame(true); S.ui.ctx.refreshAll && S.ui.ctx.refreshAll(); }, T);
// een vingerafdruk van het plan van de dag (tijden en docks van elk segment, de pool): gelijk = dezelfde dag
const vinger = page => page.evaluate(() => { const f = window.SLCT.fleet; let h = 2166136261; const add = s => { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); }; for (const t of f.trucks) add(t.plan.map(s => `${s.k}${Math.round(s.t0 * 10)}${s.dock || ''}`).join(',')); add(f.pool.map(p => p.id).join(',')); return { h: h >>> 0, pool: f.pool.length, diensten: f.trucks.reduce((n, t) => n + t.diensten.length, 0), scenario: f.scenario ? f.scenario.id : null }; });

// alle open zaken en voorstellen op een reeks tijden: wat er mis kan zijn, en de eerste voorstellen van elke soort
const EEN_STOPS = /(^|[^\d,])1 (?:[a-z]+ )?stops\b/;
async function rondgang(page, tijden) {
  const uit = { zaken: 0, vertragingen: 0, voorstellen: 0, fouten: [], soorten: {}, eerste: {} };
  for (const T of tijden) {
    await setT(page, T);
    const r = await page.evaluate(T => {
      const c = window.SLCT.ui.ctx; const f = c.fleet; const fout = []; const L = [];
      for (const z of c.Z.open()) {
        const p = c.voorstelVoor(z.key);
        if (z.kind === 'Vertraging') {
          const v = z.t ? f.vertraging(z.t, T) : null;
          if (!v || !(v.eerste.laat > 0) || !(v.eerste.eta > v.eerste.venster[1] + 0.5)) fout.push(`${z.id}: vertraging zonder stop na het venster`);
          if (/\(\+0 min\)|, 0 min te laat/.test(z.text)) fout.push(`${z.id}: +0 in de tekst (${z.text})`);
        }
        // een vertraging heeft altijd een voorstel (minstens de klant de nieuwe ETA); bij een andere soort mag het ontbreken
        // (geen voertuig of chauffeur in de buurt: dan zegt de zaakpagina dat er geen voorstel is)
        if (!p) { if (z.kind === 'Vertraging') fout.push(`${z.id}: geen voorstel`); continue; }
        const tekst = [p.kort, p.title, p.action, p.why, ...(p.effect || []).map(e => e.t)].join(' | ');
        if (/(^|[^\d,])1 (?:[a-z]+ )?stops\b/.test(tekst)) fout.push(`${p.id}: enkelvoud fout (${tekst.match(/.{0,30}1 (?:[a-z]+ )?stops.{0,10}/)[0]})`);
        const w = p.winst || {};
        if (p.kind === 'Vertraging') { if (!((w.soort === 'minuten' && w.min > 0 && (w.stops || []).length && w.stops.every(s => s.winst > 0)) || w.soort === 'bericht')) fout.push(`${p.id}: geen winst en geen bericht (${p.kort})`); }
        else if (!(w.soort && (w.tekst || w.min > 0))) fout.push(`${p.id}: ${p.kind} zonder opbrengst`);
        if (p.kind === 'Vertraging' && w.soort === 'minuten') for (const s of w.stops) if (!(Math.round(s.voor - s.na) === s.winst)) fout.push(`${p.id}: winst ${s.winst} klopt niet met ${s.voor} en ${s.na}`);
        L.push({ id: p.id, key: z.key, zaak: z.id, kind: p.kind, kort: p.kort.replace(/[A-Z]-\d+/g, 'X'), soort: w.soort, min: w.min || 0 });
      }
      return { fout, L, zaken: c.Z.open().length };
    }, T);
    uit.zaken += r.zaken; uit.fouten.push(...r.fout);
    for (const x of r.L) { uit.voorstellen++; if (x.kind === 'Vertraging') uit.vertragingen++; const k = `${x.kind}: ${x.kort}`; uit.soorten[k] = (uit.soorten[k] || 0) + 1; const s = `${x.kind}|${x.soort}`; if (!uit.eerste[s]) uit.eerste[s] = { T, ...x }; }
  }
  return uit;
}
// Een voorstel toepassen via de knop op de zaakpagina en controleren dat het doet wat het beloofde (ook na herladen)
async function pasToeEnMeet(page, T, zaakId, voorstelId) {
  await setT(page, T);
  const belofte = await page.evaluate(id => { const p = window.SLCT.ui.ctx.voorstelById(id); if (!p) return null; return { t: p.t.id, kort: p.kort, winst: JSON.parse(JSON.stringify(p.winst)), acts: JSON.parse(JSON.stringify(p.acts || [p.act])) }; }, voorstelId);
  if (!belofte) return { belofte: null };
  await page.evaluate(id => { location.hash = `melding/${id}`; }, zaakId); await page.waitForTimeout(1200);
  // de zaakpagina kan na het openen nog een keer tekenen (de frame-lus, een melding die binnenkomt): de knop bij elke poging
  // opnieuw opzoeken (een locator), geen element van voor het tekenen vasthouden
  const knop = page.locator('#zaakPasToe');
  if (await knop.count()) await knop.click({ timeout: 15000 }); else await page.evaluate(id => window.SLCT.ui.ctx.applyProposal(window.SLCT.ui.ctx.voorstelById(id)), voorstelId);
  await page.waitForTimeout(700);
  const meet = () => page.evaluate(([b, T]) => {
    const f = window.SLCT.fleet; const c = window.SLCT.ui.ctx; const t = f.byId.get(b.t);
    // een stop op naam en geplande ETA terugvinden, op dit voertuig of op het voertuig waar de rit naartoe ging
    const naar = (b.acts.find(a => a.k === 'ritNaar') || {}).naar; const wie = [t, naar ? f.byId.get(naar) : null].filter(Boolean);
    const zoek = (naam, eta) => { for (const x of wie) for (let j = 0; j < x.plan.length; j++) { const s = x.plan[j]; if (s.k === 'stop' && s.stop === naam && Math.abs(x.dayStart + s.t0 - eta) < 1.5) { const st = f.stopOp([x], s.route, s.idx); return st ? { op: x.id, eta: st.eta, laat: st.laat, venster: st.venster } : null; } } return null; };
    const stops = (b.winst.stops || []).map(s => ({ ...s, nu: zoek(s.naam, s.na) }));
    const klant = (b.winst.klant || []).map(s => ({ ...s, nu: zoek(s.naam, s.eta) }));
    const zaak = c.Z.list().find(z => z.key.startsWith(`V:${b.t}`) && z.present && !z.done);
    return { stops, klant, vertraging: !!f.vertraging(t, T), zaakOpen: !!zaak, naar, ritOp: naar ? (c.R.get((b.acts.find(a => a.k === 'ritNaar') || {}).rit) || { t: {} }).t.id : null };
  }, [belofte, T]);
  const na = await meet();
  await herlaad(page); await setT(page, T);
  const naHerladen = await meet();
  return { belofte, na, naHerladen };
}
const winstKlopt = m => m.stops.every(s => s.nu && Math.abs(s.nu.eta - s.na) < 1 && (s.gehaald ? s.nu.laat === 0 : true)) && m.klant.every(s => s.nu && s.nu.laat === 0 && s.nu.venster && s.nu.venster[1] >= s.eta - 0.5);

// ======================= A. de gewone dag =======================
const TIJDEN = [300, 330, 360, 390, 420, 450, 480, 510, 540, 570, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140];
const A = await nieuw(NL);
await laad(A.page, url);
const gewoon0 = await vinger(A.page);
check(gewoon0.scenario === null && !(await A.page.$('#oefenChip')), `gewone dag: geen oefendag, geen chip in de topbalk (${gewoon0.diensten} diensten, ${gewoon0.pool} open ritten)`);
const ga = await rondgang(A.page, TIJDEN);
check(ga.vertragingen > 0 && !ga.fouten.length, `gewone dag: ${ga.vertragingen} vertragingen en ${ga.voorstellen - ga.vertragingen} andere voorstellen op ${TIJDEN.length} tijden; elke vertraging heeft een stop na het venster en een voorstel met winst of een bericht aan de klant; nergens "1 ... stops"${ga.fouten.length ? ': ' + ga.fouten.slice(0, 4).join('; ') : ''}`);
note(`soorten: ${JSON.stringify(ga.soorten)}`);
// toepassen: de klant krijgt de nieuwe ETA, het venster gaat mee, de zaak is dicht, ook na herladen
{
  const v1 = ga.eerste['Vertraging|bericht'];
  if (!v1) check(false, 'gewone dag: geen voorstel "Nieuwe ETA aan de klant" gevonden');
  else {
    const m = await pasToeEnMeet(A.page, v1.T, v1.zaak, v1.id);
    check(m.belofte && m.belofte.winst.klant.length && winstKlopt(m.na) && !m.na.vertraging && !m.na.zaakOpen, `toepassen "${m.belofte && m.belofte.kort}" om ${v1.T}: ${m.belofte ? m.belofte.winst.klant.map(s => `${s.naam} ETA ${Math.round(s.eta)}`).join(', ') : ''}; daarna binnen het (verlegde) venster, geen vertraging meer, zaak dicht`);
    check(winstKlopt(m.naHerladen) && !m.naHerladen.vertraging, 'en na herladen nog steeds (de actie wordt opnieuw uitgevoerd)');
  }
}
// Op tijd telt een stop bij aankomst (niet pas bij vertrek): Wognum om 10:00 tegen een eigen telling uit de ritten
{
  await A.page.evaluate(p => { localStorage.setItem('sl-werkgebied', JSON.stringify(p)); }, WOGNUM); await herlaad(A.page);
  await A.page.evaluate(() => { location.hash = 'overzicht'; }); await setT(A.page, 600); await A.page.waitForTimeout(900); await setT(A.page, 600); await A.page.waitForTimeout(500);
  const r = await A.page.evaluate(() => {
    const c = window.SLCT.ui.ctx; const T = 600; let n = 0, laat = 0, voorbeeld = null;
    // de dag is rond: een stop na middernacht (nachtrit van een tweede dienst) hoort bij vandaag, zoals in metrics.js
    for (const r of c.R.all()) { if (r.t.base.n !== 'Wognum') continue; for (const s of r.stops) { if (s.pickup || !(s.arr <= T || (s.arr >= 1440 && s.arr - 1440 <= T))) continue; n++; if (s.win && s.arr > s.win[1] + 0.5) { laat++; if (!voorbeeld) voorbeeld = `${r.id} ${s.name} ${Math.round(s.arr)} na ${s.win[1]}`; } } }
    const kpi = [...document.querySelectorAll('[data-ov="kpi"] .kpi')].map(k => k.textContent.replace(/\s+/g, ' ').trim())[0] || '';
    const m = kpi.match(/(\d+) stops vandaag, (\d+) na het tijdvenster/); return { n, laat, voorbeeld, kpi, kn: m ? +m[1] : -1, kl: m ? +m[2] : -1 };
  });
  check(r.kn === r.n && r.kl === r.laat && r.laat >= 1, `Op tijd om 10:00 (Wognum) telt bij aankomst: ${r.kn} stops en ${r.kl} na het venster, gelijk aan de ritten (${r.n}, ${r.laat}; ${r.voorbeeld || 'geen'})`);
}
// Open ritten: het vertrek hangt af van wie rijdt (wie thuis is, moet eerst naar de standplaats)
{
  const r = await A.page.evaluate(() => {
    const f = window.SLCT.fleet; const P = window.SLCT.people;
    for (const T of [330, 420, 480, 540, 600, 660, 720, 780, 840]) {
      for (const p of f.poolAt(T)) {
        if (p.dag !== 'vandaag' || p.venster[0] - T > 25 || p.venster[1] <= T) continue;
        const K = f.kandidaten(p, { T, people: P }).filter(k => k.beschikbaar);
        const thuis = K.find(k => k.soort === 'eigen' && /^Vrij vandaag/.test(k.redenen[0])) || K.find(k => k.soort === 'oproep');
        if (!thuis) continue;
        const u = f.wijsToe(p, thuis, { T, people: P });
        const vertrekken = [...new Set(K.map(k => k.vertrek))];
        return { T, rit: p.id, venster: p.venster, wie: thuis.naam, soort: thuis.soort, aanrij: thuis.aanrij, vertrek: thuis.vertrek, seg: u && u.segment.a, regel: thuis.redenen[1] || '', waarsch: thuis.waarschuwingen, alle: K.every(k => typeof k.vertrek === 'number' && k.vertrek >= p.venster[0]), verschil: vertrekken.length, bericht: u ? u.bericht.tekst : '' };
      }
    }
    return null;
  });
  if (!r) check(false, 'open ritten: geen rit gevonden waarvan het venster al loopt of bijna begint');
  else check(r.alle && r.vertrek >= r.T + r.aanrij - 0.5 && r.vertrek >= r.venster[0] && r.seg === r.vertrek && /vertrekt op zijn vroegst/.test(r.regel) && r.waarsch.includes('aanrijtijd') && r.verschil >= 2 && /Vertrek vanaf/.test(r.bericht),
    `open ritten: ${r.rit} om ${r.T} (venster ${r.venster.join('-')}): ${r.soort} ${r.wie} vertrekt om ${r.vertrek} (aanrijden ${r.aanrij} min), het blok op het planbord ook; ${r.verschil} verschillende vertrektijden over de kandidaten ("${r.regel}")`);
}
check(!A.errors.length && !A.ext.size, `gewone dag: geen paginafouten, geen verzoeken naar buiten${A.errors.length ? ': ' + A.errors.slice(0, 2).join(' | ') : ''}`);
await A.ctx.close();

// ======================= B. de oefendag =======================
const B = await nieuw(WOGNUM);
const druk = url + (url.includes('?') ? '&' : '?') + 'scenario=druk';
await laad(B.page, druk);
const oef1 = await vinger(B.page);
const sc = await B.page.evaluate(() => JSON.parse(JSON.stringify(window.SLCT.fleet.scenario, (k, v) => (k === 'geraakt' ? undefined : v))));
const chip = await B.page.evaluate(() => { const b = document.getElementById('oefenChip'); return b ? { tekst: b.textContent.trim(), titel: b.title } : null; });
check(sc && sc.id === 'druk' && chip && chip.tekst === 'Oefendag' && /gesimuleerd/.test(chip.titel), `oefendag aan met ?scenario=druk: chip "${chip && chip.tekst}" in de topbalk ("${chip && chip.titel}")`);
const V = soort => (sc ? sc.verstoringen.find(v => v.soort === soort) : null) || {};
check(V('ziek').diensten && V('ziek').diensten.length === 2 && V('ziek').ritten.length >= 2, `ziek: ${V('ziek').diensten ? V('ziek').diensten.length : 0} diensten van Wognum (om 04:30), ${V('ziek').ritten ? V('ziek').ritten.join(', ') : ''} bij de open ritten`);
const files = await B.page.evaluate(() => { const f = window.SLCT.fleet; const L = []; for (const t of f.trucks) for (const s of t.plan) if (s.file) L.push(s.file); return { n: L.length, min: Math.min(...L), max: Math.max(...L), wognum: f.trucks.filter(t => t.base.n === 'Wognum' && t.plan.some(s => s.file)).length }; });
check(V('file').ritten >= 20 && files.n === V('file').ritten && files.min >= 25 && files.max <= 40, `file op de A7 (06:30 tot 08:45, richting Purmerend): ${files.n} ritten ${files.min} tot ${files.max} min later, ${files.wognum} van Wognum`);
const dock = await B.page.evaluate(d => { const f = window.SLCT.fleet; const row = f.dockPlan('Wognum').find(r => r.dock === d); const in4 = row ? row.blokken.filter(k => k.t0 < 660 && k.t1 > 420) : null; return { buiten: row && row.buiten, bezet: in4 ? in4.length : -1, verzet: f.trucks.reduce((n, t) => n + t.plan.filter(s => s.dockOud === d).length, 0) }; }, V('dock').dock);
check(V('dock').dock && dock.buiten && dock.bezet === 0 && dock.verzet === V('dock').verzet && dock.verzet > 0, `dock ${V('dock').dock} van Wognum buiten gebruik 07:00 tot 11:00: leeg in die uren, ${dock.verzet} blokken naar een ander dock`);
const koel = await B.page.evaluate(id => { const tr = window.SLCT.fleet.trailerById.get(id); return tr ? { storing: tr.storing, temp: window.SLCT.fleet.trailerTemp(tr, 480) } : null; }, V('koeling').oplegger);
check(koel && /Koelunit/.test(koel.storing) && koel.temp > 6, `koelstoring: ${V('koeling').oplegger} achter ${V('koeling').voertuig} (${koel && koel.storing}, ${koel && koel.temp.toFixed(1)} °C)`);
// elke keer hetzelfde
await herlaad(B.page); const oef2 = await vinger(B.page);
check(oef1.h === oef2.h && oef1.pool === oef2.pool && oef1.diensten === oef2.diensten, `de oefendag loopt elke keer hetzelfde (vingerafdruk ${oef1.h} = ${oef2.h}, ${oef1.diensten} diensten, ${oef1.pool} open ritten)`);
check(oef1.h !== gewoon0.h && oef1.diensten === gewoon0.diensten - 2 && oef1.pool === gewoon0.pool + V('ziek').ritten.length, `en is anders dan de gewone dag: 2 diensten minder, ${V('ziek').ritten.length} open ritten meer`);
// de zaken, voorstellen, briefing en open ritten om 07:30
await setT(B.page, 450);
const zk = await B.page.evaluate(() => { const c = window.SLCT.ui.ctx; const L = c.Z.open(); const tel = k => L.filter(z => z.kind === k).length; return { v: tel('Vertraging'), d: tel('Dock'), k: tel('Koeling'), oorzaak: L.filter(z => z.kind === 'Vertraging' && z.data && /A7/.test(z.data.oorzaak || '')).length }; });
check(zk.v >= 5 && zk.d >= 1 && zk.k >= 1 && zk.oorzaak >= 1, `om 07:30 op Wognum: ${zk.v} vertragingen (${zk.oorzaak} door de file op de A7), ${zk.d} dockwissels, ${zk.k} koelstoring`);
const ob = await rondgang(B.page, [330, 390, 420, 450, 480, 510, 540, 600, 660, 720, 840, 960]);
check(ob.vertragingen > ga.vertragingen && !ob.fouten.length, `oefendag: ${ob.vertragingen} vertragingen en ${ob.voorstellen - ob.vertragingen} andere voorstellen; elk met winst of een bericht; nergens "1 ... stops"${ob.fouten.length ? ': ' + ob.fouten.slice(0, 4).join('; ') : ''}`);
note(`soorten: ${JSON.stringify(ob.soorten)}`);
check(!!ob.eerste['Vertraging|minuten'], `oefendag: er is een voorstel met winst in minuten (${ob.eerste['Vertraging|minuten'] ? `${ob.eerste['Vertraging|minuten'].kort}, ${ob.eerste['Vertraging|minuten'].min} min` : 'geen'})`);
// de briefing en de open ritten reageren erop
await setT(B.page, 450); await B.page.evaluate(() => { location.hash = 'overzicht'; }); await B.page.waitForTimeout(1200); await setT(B.page, 450); await B.page.waitForTimeout(600);
const brief = await B.page.evaluate(() => (document.querySelector('[data-ov="brief"]') || {}).textContent || '');
check(/te laat/.test(brief) && /open rit/.test(brief) && /voorstel/.test(brief), `briefing om 07:30 noemt de vertraging, de open ritten en de voorstellen ("${brief.replace(/\s+/g, ' ').slice(0, 160)}…")`);
await B.page.evaluate(() => { location.hash = 'openritten'; }); await B.page.waitForTimeout(1500);
const or = await B.page.evaluate(ids => { const rows = [...document.querySelectorAll('#v-openritten [data-or]')]; const zie = rows.filter(r => ids.includes(r.dataset.or)); return { n: zie.length, tekst: zie.slice(0, 1).map(r => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 120))[0] || '' }; }, V('ziek').ritten || []);
check(or.n >= 1 && /ziek/i.test(or.tekst), `open ritten om 07:30: ${or.n} ritten van de zieke chauffeurs in de lijst ("${or.tekst}")`);
// toepassen van een voorstel met winst: de beloofde ETA's kloppen, ook na herladen
{
  const v2 = ob.eerste['Vertraging|minuten'];
  if (v2) {
    const m = await pasToeEnMeet(B.page, v2.T, v2.zaak, v2.id);
    const s = m.belofte ? m.belofte.winst.stops : [];
    check(m.belofte && s.length && winstKlopt(m.na) && m.na.ritOp === m.na.naar && !m.na.zaakOpen, `toepassen "${m.belofte && m.belofte.kort}" om ${v2.T}: ${s.map(x => `${x.naam} ${Math.round(x.na)} in plaats van ${Math.round(x.voor)} (${x.winst} min winst)`).join(', ')}; na toepassen precies zo, de rit staat op ${m.na.ritOp}, zaak dicht`);
    check(winstKlopt(m.naHerladen) && m.naHerladen.ritOp === m.naHerladen.naar, 'en na herladen nog steeds');
  }
}
// dock: het nieuwe dock doorgeven sluit de zaak
{
  const dz = ob.eerste['Dock|chauffeur'];
  if (!dz) check(false, 'oefendag: geen voorstel bij een dock buiten gebruik');
  else {
    await setT(B.page, dz.T);
    const r = await B.page.evaluate(id => { const c = window.SLCT.ui.ctx; const p = c.voorstelById(id); if (!p) return null; const t = p.t; const w = c.fleet.dockWissel(t, c.state.simTime); c.applyProposal(p); return { t: t.id, oud: w && w.oud, nieuw: w && w.nieuw, na: !!c.fleet.dockWissel(t, c.state.simTime), bericht: (t.msgs || []).slice(-1).map(m => m.text)[0] || '' }; }, dz.id);
    check(r && !r.na && new RegExp(`dock ${r.nieuw}`).test(r.bericht), `dock: ${r && r.t} hoort dat het dock ${r && r.nieuw} wordt in plaats van ${r && r.oud} ("${r && r.bericht}"), zaak dicht`);
  }
}
// de schakelaar onder Instellingen: aan, en uit zetten geeft weer precies de gewone dag
{
  await B.page.evaluate(() => { location.hash = 'instellingen'; }); await B.page.waitForSelector('#setOefen', { state: 'attached', timeout: 15000 }).catch(() => null); await B.page.waitForTimeout(400);
  const aan = await B.page.evaluate(() => { const i = document.getElementById('setOefen'); return i ? i.checked : null; });
  check(aan === true, 'Instellingen: de schakelaar "Oefendag: een drukke dag" staat aan');
  await B.page.click('label.tgl:has(#setOefen)');
  await B.page.waitForTimeout(400);
  const jaKnop = B.page.locator('dialog.cfm[open] button[value="ja"]'); const knop = (await jaKnop.count()) > 0;
  if (knop) { await Promise.all([B.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }).catch(() => null), jaKnop.click({ timeout: 15000 })]); }
  await klaar(B.page); await B.page.waitForTimeout(800);
  const terug = await vinger(B.page); const zonderParam = await B.page.evaluate(() => !/scenario=/.test(location.search));
  check(!!knop && terug.scenario === null && terug.h === gewoon0.h && terug.diensten === gewoon0.diensten && terug.pool === gewoon0.pool && zonderParam && !(await B.page.$('#oefenChip')), `uit zetten: na de bevestiging weer de gewone dag, precies gelijk (vingerafdruk ${terug.h} = ${gewoon0.h}, ${terug.diensten} diensten, ${terug.pool} open ritten), zonder chip en zonder ?scenario in de adresbalk`);
  const opslag = await B.page.evaluate(() => ({ uit: localStorage.getItem('sl-oefendag'), acties: !!localStorage.getItem('sl-acties-oefendag') }));
  check(!opslag.uit && opslag.acties, 'de schakelaar is bewaard (uit) en de acties van de oefendag staan apart (sl-acties-oefendag)');
}
check(!B.errors.length && !B.ext.size, `oefendag: geen paginafouten, geen verzoeken naar buiten${B.errors.length ? ': ' + B.errors.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
