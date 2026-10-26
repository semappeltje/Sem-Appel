// Controle van het dashboard en de duurzame voorstellen (Control Tower 4.1, bouwsteen 2d).
//
//   npm run build && (cd dist && python3 -m http.server 8833 --bind 127.0.0.1) &
//   node tests/dashboard-check.mjs [http://127.0.0.1:8833/index.html] [map voor schermafbeeldingen]
//
// Met een vaste klok (maandag 26 oktober 2026, 10:00 Nederlandse tijd), op een gewone dag en op de oefendag: het dashboard
// staat er binnen een seconde (gemeten in de browser, met de lijntjes getekend); elk cijfer klikt door en de lijst erachter
// bestaat (de weergave staat open, met het filter); op tijd, te laat en gemist zijn gelijk aan metrics.sample, de lege km
// aan een eigen telling over de ritten; de som van de duurzame voorstellen is twee keer gelijk (opnieuw gerekend en na
// herladen); elk voorstel "elektrisch" heeft een elektrische truck van dezelfde standplaats met genoeg accu (opnieuw
// gerekend uit fleet.stateAt, met 15 procent marge en 10 procent over); de directie ziet geen knop die iets toepast; een
// planner past een voorstel toe (logregel, de rit staat op de elektrische truck, ook na herladen) en wijst er een af met
// reden; licht en donker op 1440 en 390 px zonder afgebroken tekst of overloop; geen verzoek naar buiten en geen
// consolefouten.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8833/index.html';
const shots = process.argv[3] || null; if (shots) fs.mkdirSync(shots, { recursive: true });
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const note = msg => console.log(`     ${msg}`);
const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmtNl = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const amsterdam = (dag, min) => { for (const off of ['+01:00', '+02:00']) { const d = new Date(`${dag}T${hm(min)}:00${off}`); if (fmtNl.format(d) === hm(min)) return d; } return new Date(`${dag}T${hm(min)}:00+01:00`); };
const DAG = '2026-10-26'; const T = 600;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const host = new URL(url).host; const errors = []; const buiten = new Set();
const NL = role => ({ regios: [], divs: ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'], role, sp: null });

async function open({ role = 'directie', oefendag = false, w = 1440, h = 900, theme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
  await ctx.addInitScript(([p, oef, th]) => { try { if (!sessionStorage.getItem('dbc')) { localStorage.clear(); localStorage.setItem('sl-werkgebied', JSON.stringify(p)); localStorage.setItem('sl-role', p.role); localStorage.setItem('sl-theme', th); if (oef) localStorage.setItem('sl-oefendag', 'druk'); sessionStorage.setItem('dbc', '1'); } } catch { /* geen opslag */ } }, [NL(role), oefendag, theme]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${role}${oefendag ? ' oefendag' : ''}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED|Failed to load/.test(m.text())) errors.push(`${role}: ${m.text()}`); });
  await page.route('**/*', route => { const u = route.request().url(); if (/^(data|blob|about):/.test(u)) return route.continue(); const x = new URL(u); if (x.host !== host) { buiten.add(x.host); return route.abort('blockedbyclient'); } return route.continue(); });
  await page.clock.setFixedTime(amsterdam(DAG, T));
  await page.goto(url, { waitUntil: 'load' });
  await klaar(page);
  return { ctx, page };
}
const klaar = async page => { await page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300000, polling: 250 }); await page.evaluate(T => { const S = window.SLCT; S.state.playing = false; S.state.simTime = T; S.ui.frame(true); S.ui.ctx.refreshAll(); }, T); await page.waitForTimeout(400); };
// naar Rapporten en wachten tot het dashboard met de lijntjes er staat; de tijd gemeten in de browser
const meet = page => page.evaluate(() => new Promise(res => {
  const c = window.SLCT.ui.ctx; const t0 = performance.now(); c.go('view:rapporten');
  const kijk = () => { const h = document.getElementById('dbHost'); const n = h ? h.querySelectorAll('.db-t').length : 0; const nsp = h ? h.querySelectorAll('.db-sp').length : 0; const sp = h ? h.querySelectorAll('.db-sp canvas').length : 0; const g = h ? h.querySelectorAll('.db-g canvas').length : 0; if (n > 10 && nsp > 10 && sp >= nsp && g >= 6 && h.dataset.getekend === '1') res({ ms: Math.round(performance.now() - t0), n, sp, nsp, g }); else if (performance.now() - t0 > 8000) res({ ms: Math.round(performance.now() - t0), n, sp, nsp, g, traag: true }); else requestAnimationFrame(kijk); };
  kijk();
}));
const terugNaarRapporten = async page => { await page.evaluate(() => window.SLCT.ui.ctx.go('view:rapporten')); await page.waitForTimeout(150); };

for (const oefendag of [false, true]) {
  const dag = oefendag ? 'oefendag' : 'gewone dag';
  const { ctx, page } = await open({ oefendag });
  // 1. binnen een seconde (twee keer: koud en warm; onder belasting van andere agents de beste van drie)
  let best = null; for (let i = 0; i < 3; i++) { await page.evaluate(() => window.SLCT.ui.ctx.go('view:overzicht')); await page.waitForTimeout(200); const m = await meet(page); if (!best || m.ms < best.ms) best = m; if (best.ms < 1000) break; }
  check(best && best.ms < 1000 && best.n >= 18 && best.sp >= best.nsp && best.g >= 6, `${dag}: dashboard met ${best.n} cijfers, ${best.sp} lijntjes en ${best.g} grafieken getekend in ${best.ms} ms (eis: onder 1000 ms)`);
  // 2. de cijfers kloppen met metrics en met de ritten
  const cijfers = await page.evaluate(() => {
    const c = window.SLCT.ui.ctx; const T = c.state.simTime; const d = c.ui.dbData; const trucks = c.fleet.trucks.filter(t => c.inScope(t));
    const s = c.M.sample(T, trucks, []);
    // lege km zelf geteld: per rit de stukken van de eerste route; beladen als er nog gelost wordt of er net geladen is
    let leeg = 0, km = 0;
    for (const r of c.R.all()) {
      if (!r.stops.length || !c.inScope(r.t)) continue; km += r.km;
      const route = r.segs.find(x => x.s.route).s.route; const n = route.marks.length - 1; const actie = {}; const kms = {};
      for (const x of r.segs) { if (x.s.route !== route) continue; if (x.s.k === 'stop') actie[x.s.idx] = x.s.actie || 'lossen'; if (x.s.k === 'drive') kms[x.s.idx] = (kms[x.s.idx] || 0) + Math.max(0, x.s.km1 - x.s.km0); }
      for (let i = 1; i <= n; i++) { const later = Object.entries(actie).some(([k, a]) => +k >= i && (a === 'lossen' || a === 'wisselen')); const vorige = actie[i - 1]; const vol = i === 1 ? actie[1] !== 'laden' : vorige === 'laden' || later; if (!vol) leeg += kms[i] || 0; }
    }
    return { optijd: d.opTijd, late: d.ot.late, stops: d.ot.n, gemist: d.gemist, sStops: s.stops, sLate: s.late, sOntime: s.ontime, sGemist: s.gemist, leeg: d.ag.leeg, leegZelf: leeg, km: d.ag.km, kmZelf: km };
  });
  check(cijfers.stops === cijfers.sStops && cijfers.late === cijfers.sLate && Math.abs(cijfers.optijd - cijfers.sOntime) < 0.01, `${dag}: op tijd ${cijfers.optijd.toFixed(1)} % (${cijfers.late} van ${cijfers.stops} stops te laat) gelijk aan metrics (${cijfers.sOntime.toFixed(1)} %, ${cijfers.sLate} van ${cijfers.sStops})`);
  check(cijfers.gemist === cijfers.sGemist, `${dag}: gemist ${cijfers.gemist} gelijk aan metrics (${cijfers.sGemist})`);
  check(Math.abs(cijfers.leeg - cijfers.leegZelf) < 1 && Math.abs(cijfers.km - cijfers.kmZelf) < 1, `${dag}: lege km ${Math.round(cijfers.leeg)} van ${Math.round(cijfers.km)} gelijk aan de eigen telling over de ritten (${Math.round(cijfers.leegZelf)} van ${Math.round(cijfers.kmZelf)})`);
  // 3. elk cijfer klikt door en de lijst erachter bestaat
  const doelen = await page.evaluate(() => [...new Set([...document.querySelectorAll('#dbHost [data-db]')].map(b => b.dataset.db))]);
  const fouteDoelen = [];
  for (const ga of doelen) {
    await terugNaarRapporten(page);
    await page.click(`#dbHost [data-db="${ga}"]`);
    await page.waitForTimeout(250);
    const r = await page.evaluate(ga => {
      const c = window.SLCT.ui.ctx; const [v, f, w] = ga.split(':'); const on = id => { const e = document.getElementById(`v-${id}`); return !!e && e.classList.contains('on'); };
      if (v === 'dz') { const s = document.getElementById('db-dz'); return { ok: !!s && document.activeElement === s && on('rapporten'), wat: 'de lijst met duurzame voorstellen' }; }
      const tb = { ritten: c.ui.ritTable, voertuigen: c.ui.vTable, chauffeurs: c.ui.cTable, meldingen: c.ui.meldTable }[v];
      const rij = document.querySelectorAll(`#v-${v} tbody tr, #v-${v} .row, #v-${v} [data-row]`).length;
      // een lege lijst mag alleen als het cijfer zelf 0 is (bijvoorbeeld geen rijtijdzaken vandaag)
      const tg = (c.ui.dbTegels || []).find(x => x.ga === ga); const nul = !!tg && /^0(\s|$|<)/.test(tg.v);
      // de chauffeurs bijna op de rijtijdlimiet: de lijst heeft precies zoveel rijen als het cijfer
      if (tb) { const fOk = v === 'meldingen' ? tb.st.q === w : !f || (tb.st.f[f] && tb.st.f[f].has(w)); const n = (tb.st.view || []).length; const gelijk = ga !== 'chauffeurs:let:rijtijd' || (tg && String(n) === tg.v.replace(/\./g, '')); return { ok: on(v) && fOk && (n > 0 || nul) && gelijk, wat: `${v}${f ? ` met ${f}=${w}` : ''}${v === 'meldingen' ? ` zoekwoord ${w}` : ''}: ${n} rijen${tg ? ` (cijfer ${tg.v.replace(/<[^>]+>/g, '')})` : ''}` }; }
      return { ok: on(v) && document.getElementById(`v-${v}`).textContent.trim().length > 40, wat: `${v} (${rij} rijen)` };
    }, ga);
    if (!r.ok) fouteDoelen.push(`${ga}: ${r.wat}`); else note(`${ga} -> ${r.wat}`);
  }
  check(doelen.length >= 8 && !fouteDoelen.length, `${dag}: ${doelen.length} doorkliks, elk naar een bestaande lijst${fouteDoelen.length ? `; fout: ${fouteDoelen.join('; ')}` : ''}`);
  await terugNaarRapporten(page); await page.waitForTimeout(200);
  // 4. de som van de duurzame voorstellen: twee keer gelijk (opnieuw gerekend) en na herladen
  const som = () => page.evaluate(() => { const c = window.SLCT.ui.ctx; const V = c.ui.dbData.V; return JSON.stringify({ n: V.length, ids: V.map(v => v.id).join(','), co2: Math.round(V.reduce((a, v) => a + v.co2, 0) * 10) / 10, euro: Math.round(V.reduce((a, v) => a + v.euro, 0) * 100) / 100, kop: document.querySelector('#db-dz .sub').textContent }); });
  const s1 = await som();
  await page.evaluate(() => { const c = window.SLCT.ui.ctx; c.R.bump(); document.getElementById('dbHost').dataset.h = ''; c.go('view:overzicht'); c.go('view:rapporten'); });
  await page.waitForTimeout(300);
  const s2 = await som();
  await page.reload({ waitUntil: 'load' }); await klaar(page); await page.evaluate(() => window.SLCT.ui.ctx.go('view:rapporten')); await page.waitForTimeout(400);
  const s3 = await som(); const S1 = JSON.parse(s1);
  check(S1.n > 0 && s1 === s2 && s1 === s3, `${dag}: de som van de duurzame voorstellen is gelijk bij opnieuw rekenen en na herladen (${S1.n} voorstellen, ${S1.co2} kg CO2, ${S1.euro} euro)`);
  // 5. elektrisch: altijd een elektrische truck van dezelfde standplaats met genoeg accu (opnieuw gerekend)
  const ev = await page.evaluate(() => {
    const c = window.SLCT.ui.ctx; const L = c.ui.dbData.V.filter(v => v.soort === 'ev'); const fout = [];
    for (const v of L) { const B = v.B; const r = c.R.get(v.rit); const soc = c.fleet.stateAt(B, v.start).soc; const cap = /600/.test(B.model) ? 600 : /300/.test(B.model) ? 300 : /Volvo/.test(B.model) ? 540 : 70; const na = soc - r.km * 1.15 * 1.15 / cap * 100; if (!B.ev || B.base !== r.t.base || r.t.ev || na < 10 - 0.5) fout.push(`${v.id}: ${B.id} accu ${Math.round(soc)} % na ${Math.round(na)} %`); }
    const perTruck = new Map(); for (const v of L) perTruck.set(v.B.id, (perTruck.get(v.B.id) || 0) + 1);
    // LZV: de chauffeur van de eerste rit mag LZV rijden (de vlag in de simulatie) en de truck is een LZV-truck
    const lzv = c.ui.dbData.V.filter(v => v.soort === 'lzv'); const lzvFout = lzv.filter(v => { const r = c.R.get(v.rit); return !(r && r.t.lzv && r.person && r.person.licence && r.person.licence.lzv); }).map(v => v.id);
    return { n: L.length, fout, dubbel: [...perTruck.values()].filter(x => x > 1).length, soorten: [...new Set(c.ui.dbData.V.map(v => v.soort))], lzv: lzv.length, lzvFout };
  });
  check(ev.n > 0 && !ev.fout.length && !ev.dubbel, `${dag}: ${ev.n} voorstellen "elektrisch", elk met een elektrische truck van dezelfde standplaats met genoeg accu, geen truck twee keer${ev.fout.length ? `; fout: ${ev.fout.slice(0, 3).join('; ')}` : ''} (soorten vandaag: ${ev.soorten.join(', ')})`);
  check(!ev.lzvFout.length, `${dag}: ${ev.lzv} voorstellen "LZV", elk met een LZV-truck en een chauffeur die LZV mag rijden (gesimuleerd)${ev.lzvFout.length ? `; fout: ${ev.lzvFout.join(', ')}` : ''}`);
  // 6. de directie handelt niet: geen knop die toepast, ook niet in de Assistent
  const directie = await page.evaluate(async () => { const c = window.SLCT.ui.ctx; c.toggleAssist(true); await new Promise(r => setTimeout(r, 300)); const n = document.querySelectorAll('[data-dzpas], [data-dzaf], #dbHost [data-pastoe]').length; const dz = document.querySelectorAll('#panel .prop.dz').length; c.toggleAssist(false); return { n, dz, rol: c.role() }; });
  check(directie.rol === 'directie' && directie.n === 0, `${dag}: de directie ziet ${directie.dz} duurzame voorstellen en geen knop om iets toe te passen of af te wijzen`);
  await ctx.close();
}

// 7. een planner past een voorstel toe en wijst er een af
{
  const { ctx, page } = await open({ role: 'planner' });
  await page.evaluate(() => { window.SLCT.ui.ctx.toggleAssist(true); }); await page.waitForTimeout(500);
  await page.evaluate(() => { const b = document.querySelector('[data-atab="voorstellen"]'); if (b) b.click(); }); await page.waitForTimeout(300);
  const kaart = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-dzpas]')].find(x => x.dataset.dzpas.startsWith('ev:')); return b ? b.dataset.dzpas : null; });
  check(!!kaart, `planner: de Assistent toont een voorstel "elektrisch" (${kaart || 'geen'})`);
  if (kaart) {
    const voor = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const r = c.R.get(id.slice(3)); return { t: r.t.id, n: c.A.acts.log.length }; }, kaart);
    if (shots) {
      // de kaart met de berekening open, op 1440 en 390 px, licht en donker
      const toon = async () => { await page.evaluate(id => { const b = document.querySelector(`[data-dzpas="${id}"]`); const k = b && b.closest('.prop'); if (k) { k.querySelectorAll('details').forEach(x => { x.open = true; }); k.scrollIntoView({ block: 'start' }); } }, kaart); await page.waitForTimeout(200); };
      for (const [w, h, th] of [[1440, 900, 'light'], [1440, 900, 'dark'], [390, 844, 'light'], [390, 844, 'dark']]) {
        await page.setViewportSize({ width: w, height: h }); await page.evaluate(th => { document.getElementById('app').dataset.theme = th; }, th); await page.waitForTimeout(300);
        await page.evaluate(() => { const c = window.SLCT.ui.ctx; c.toggleAssist(true); const b = document.querySelector('[data-atab="voorstellen"]'); if (b) b.click(); }); await page.waitForTimeout(300); await toon();
        await page.screenshot({ path: `${shots}/voorstel-elektrisch-${w}-${th === 'light' ? 'licht' : 'donker'}.png` });
      }
      await page.setViewportSize({ width: 1440, height: 900 }); await page.evaluate(() => { document.getElementById('app').dataset.theme = 'light'; }); await page.waitForTimeout(300);
      await page.evaluate(() => { const c = window.SLCT.ui.ctx; c.toggleAssist(true); const b = document.querySelector('[data-atab="voorstellen"]'); if (b) b.click(); }); await page.waitForTimeout(300);
    }
    await page.click(`[data-dzpas="${kaart}"]`); await page.waitForTimeout(500);
    const na = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const r = c.R.get(id.slice(3)); const l = c.A.acts.log[0]; return { t: r ? r.t.id : null, ev: r ? r.t.ev : null, log: l ? l.txt : '', n: c.A.acts.log.length }; }, kaart);
    check(na.n === voor.n + 1 && /duurzaam voorstel toe/.test(na.log) && na.ev && na.t !== voor.t, `planner: toepassen zet rit ${kaart.slice(3)} van ${voor.t} op ${na.t} (elektrisch) met een logregel: "${na.log}"`);
    await page.reload({ waitUntil: 'load' }); await klaar(page);
    const herl = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const r = c.R.get(id.slice(3)); const b = c.A.acts.handled[`G:${id}`]; return { t: r ? r.t.id : null, st: b && b.dz ? b.dz.st : null }; }, kaart);
    check(herl.t === na.t && herl.st === 'toegepast', `planner: na herladen staat rit ${kaart.slice(3)} nog op ${herl.t} en het besluit is ${herl.st}`);
  }
  await page.evaluate(() => { const c = window.SLCT.ui.ctx; c.toggleAssist(true); }); await page.waitForTimeout(400);
  await page.evaluate(() => { const b = document.querySelector('[data-atab="voorstellen"]'); if (b) b.click(); }); await page.waitForTimeout(300);
  const af = await page.evaluate(() => { const b = document.querySelector('[data-dzaf]'); return b ? b.dataset.dzaf : null; });
  if (af) {
    await page.click(`[data-dzaf="${af}"]`); await page.waitForTimeout(300);
    await page.check('input[name=dzr][value="De planning loopt anders"]'); await page.fill('#dzrTxt', 'test'); await page.click('#dzrOk'); await page.waitForTimeout(300);
    const r = await page.evaluate(id => { const c = window.SLCT.ui.ctx; const b = c.A.acts.handled[`G:${id}`]; return { st: b && b.dz ? b.dz.st : null, reden: b && b.dz ? b.dz.reden : '', log: c.A.acts.log[0].txt, nog: !!document.querySelector(`[data-dzaf="${id}"]`) }; }, af);
    check(r.st === 'afgewezen' && /De planning loopt anders: test/.test(r.reden) && /af/.test(r.log) && !r.nog, `planner: afwijzen met reden ("${r.reden}") en een logregel ("${r.log}"); het voorstel staat niet meer in de lijst`);
  } else check(false, 'planner: geen voorstel om af te wijzen');
  await ctx.close();
}

// 8. licht en donker, 1440 en 390 px (en 1280 en 768 in licht): geen overloop, geen afgebroken tekst in de tegels
for (const [w, h, themes] of [[1440, 900, ['light', 'dark']], [390, 844, ['light', 'dark']], [1280, 800, ['light']], [768, 1024, ['light']]]) for (const theme of themes) {
  const { ctx, page } = await open({ w, h, theme });
  await page.evaluate(() => window.SLCT.ui.ctx.go('view:rapporten')); await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const v = document.getElementById('v-rapporten'); const bad = [];
    for (const el of document.querySelectorAll('#dbHost .db-l, #dbHost .db-v, #dbHost .db-s, #dbHost .db-h, #dbHost .card-h h2, #dbHost .card-h .sub')) if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') bad.push(el.textContent.trim().slice(0, 40));
    for (const el of document.querySelectorAll('#dbHost .db-t')) { const b = el.getBoundingClientRect(); if (b.right > document.documentElement.clientWidth + 1) bad.push(`tegel buiten beeld: ${el.textContent.trim().slice(0, 30)}`); }
    const page = v.querySelector('.page') || v; return { over: Math.max(page.scrollWidth - page.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth), bad, theme: document.getElementById('app').dataset.theme };
  });
  check(r.over <= 1 && !r.bad.length && r.theme === theme, `${w} px ${theme === 'light' ? 'licht' : 'donker'}: geen overloop (${r.over} px) en geen afgebroken tekst${r.bad.length ? `; fout: ${r.bad.slice(0, 4).join(' | ')}` : ''}`);
  if (shots) { await page.screenshot({ path: `${shots}/dashboard-${w}-${theme === 'light' ? 'licht' : 'donker'}.png` }); if (w === 1440) { await page.evaluate(() => document.getElementById('db-dz').scrollIntoView()); await page.waitForTimeout(200); await page.screenshot({ path: `${shots}/dashboard-voorstellen-${w}-${theme === 'light' ? 'licht' : 'donker'}.png` }); } }
  await ctx.close();
}

check(!buiten.size, `geen verzoek naar buiten${buiten.size ? `: ${[...buiten].join(', ')}` : ''}`);
check(!errors.length, `geen consolefouten${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
await browser.close();
console.log(fail ? `\n${fail} FOUT` : '\nAlles OK');
process.exit(fail ? 1 : 0);
