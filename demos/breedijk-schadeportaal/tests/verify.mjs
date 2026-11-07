// Controle van de gebouwde app in een echte browser: laden zonder fouten, geen enkel verzoek naar buiten, geen
// horizontale overloop op 1440 en 390 px, elke weergave, het donkere thema, minder beweging, het toetsenbord, een
// besluit dat na een herlaad nog staat, een nieuwe melding die de rit vindt, en de ingebedde variant.
//
//   cd dist && python3 -m http.server 8791 --bind 127.0.0.1
//   node tests/verify.mjs 8791 [map voor schermafbeeldingen]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , port = '8791', shots = ''] = process.argv;
const url = /^\d+$/.test(port) ? `http://127.0.0.1:${port}/index.html` : port;
const browser = await chromium.launch();
let fail = 0; const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
const VIEWS = ['overzicht', 'schades', 'schades?status=alle', 'schades?status=alle&cat=eigen', 'chauffeurs', 'chauffeur/C-08', 'opdrachtgevers', 'opdrachtgever/K-01', 'wagenpark', 'voertuig/BT-23', 'dashboard', 'dashboard?p=365', 'dashboard?cat=derde', 'rapporten', 'rapporten?periode=jaar', 'instellingen'];
for (const vp of [{ w: 1440, h: 900 }, { w: 390, h: 844 }, { w: 1440, h: 900, rm: true }, { w: 1024, h: 768, embedded: true }]) {
  const tag = `${vp.w}${vp.rm ? '-rm' : ''}${vp.embedded ? '-embedded' : ''}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.w < 500, hasTouch: vp.w < 500, reducedMotion: vp.rm ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errors = []; const ext = new Set();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => { const u = new URL(r.url()); if (!/^(data|blob|about):/.test(r.url()) && u.host !== new URL(url).host) ext.add(u.host); });
  await page.route('**/*', route => { const u = new URL(route.request().url()); if (u.host !== new URL(url).host) return route.abort('blockedbyclient'); return route.continue(); });
  if (vp.embedded) await page.route(url, async route => { const res = await route.fetch(); const body = (await res.text()).replace('class="app bsp"', 'class="app bsp" data-embedded'); await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/html; charset=utf-8' } }); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BSP && document.getElementById('loading').hidden, null, { timeout: 30000 });
  const st = await page.evaluate(() => ({ theme: document.getElementById('app').dataset.theme, sw: document.documentElement.scrollWidth, iw: innerWidth, font: getComputedStyle(document.getElementById('app')).fontSize, trans: getComputedStyle(document.querySelector('.btn')).transitionDuration, claims: window.BSP.D.claims.length, ms: Math.round(window.BSP.D.bouwMs) }));
  check(st.theme === 'light', `${tag} thema op de app-root (${st.theme})`);
  check(st.sw <= st.iw, `${tag} geen horizontale overloop (${st.sw} <= ${st.iw})`);
  check(st.font === '14px', `${tag} lettergrootte ${st.font}`);
  check(st.ms < 3000, `${tag} wereld gebouwd in ${st.ms} ms (${st.claims} claims)`);
  if (vp.rm) check(/^0s/.test(st.trans), `${tag} minder beweging: overgangen uit (${st.trans})`);
  const over = [];
  for (const v of VIEWS) { await page.evaluate(h => { location.hash = '#' + h; }, v); await page.waitForTimeout(250); const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth - innerWidth, h1: !!document.querySelector('.view.on h1'), on: document.querySelectorAll('.view.on').length })); if (r.sw > 0) over.push(`${v} +${r.sw}`); if (!r.h1 || r.on !== 1) over.push(`${v} zonder kop of met ${r.on} weergaven`); }
  check(over.length === 0, `${tag} alle ${VIEWS.length} weergaven heel${over.length ? ': ' + over.join(', ') : ''}`);
  // een dossier: de drie kolommen (of tabs op een telefoon), de signalen, het advies
  const id = await page.evaluate(() => window.BSP.D.claims.filter(c => c.status === 'nieuw' && c.rit).sort((a, b) => b.ontvangen - a.ontvangen)[0].id);
  await page.evaluate(h => { location.hash = '#' + h; }, `schade/${id}`); await page.waitForTimeout(300);
  const dos = await page.evaluate(() => ({ signs: document.querySelectorAll('.sign').length, advies: !!document.querySelector('.advies'), cols: [...document.querySelectorAll('.dos .col')].filter(c => getComputedStyle(c).display !== 'none').length, tabs: getComputedStyle(document.querySelector('.dos-tabs')).display, diagram: !!document.querySelector('.diag svg'), fotos: document.querySelectorAll('.foto').length, sw: document.documentElement.scrollWidth - innerWidth }));
  check(dos.signs >= 6 && dos.advies && dos.diagram && dos.fotos >= 6 && dos.sw <= 0, `${tag} dossier ${id}: ${dos.signs} signalen, advies, diagram, ${dos.fotos} foto's`);
  check(vp.w >= 1200 ? dos.cols === 3 && dos.tabs === 'none' : dos.cols === 1 && dos.tabs !== 'none', `${tag} dossier: ${dos.cols} kolom(men), tabs ${dos.tabs}`);
  if (shots) await page.screenshot({ path: `${shots}/verify-${tag}-dossier.png` });
  if (vp.w >= 1200 && !vp.rm && !vp.embedded) {
    // besluit vastleggen, herladen, en het staat er nog; dan de handelingen wissen
    await page.click('[data-act="besluit"]'); await page.waitForTimeout(300);
    const na = await page.evaluate(id => { const c = window.BSP.D.claims.find(x => x.id === id); return { status: c.status, log: c.log.length, toast: !!document.querySelector('.toast'), dialoog: !document.getElementById('dialog').hidden }; }, id);
    check(na.status !== 'nieuw' && (na.toast || na.dialoog), `${tag} besluit vastgelegd: status ${na.status}, ${na.dialoog ? 'de vraag aan de chauffeur open' : 'melding getoond'}`);
    if (na.dialoog) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.BSP && document.getElementById('loading').hidden);
    const herladen = await page.evaluate(id => { const c = window.BSP.D.claims.find(x => x.id === id); return { status: c.status, log: c.log.length, hash: location.hash, acties: window.BSP.acties.aantal() }; }, id);
    check(herladen.status === na.status && herladen.log === na.log && herladen.hash === `#schade/${id}`, `${tag} na herladen dezelfde toestand (${herladen.status}, ${herladen.log} logregels, ${herladen.acties} handelingen)`);
    // conceptantwoord: opent, heeft tekst met het dossiernummer, Esc sluit
    await page.click('.dos-h [data-act="concept"]'); await page.waitForTimeout(250);
    const ct = await page.evaluate(id => ({ open: !document.getElementById('dialog').hidden, tekst: (document.querySelector('#ct') || {}).value || '' }), id);
    check(ct.open && ct.tekst.includes(id) && ct.tekst.length > 200, `${tag} conceptantwoord met het dossiernummer (${ct.tekst.length} tekens)`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check(await page.evaluate(() => document.getElementById('dialog').hidden), `${tag} Esc sluit de dialoog`);
    // nieuwe melding met toets n, een kenteken uit de ritten, de rit wordt gevonden, het dossier opent
    const kent = await page.evaluate(() => window.BSP.D.ritten[500].kenteken);
    await page.keyboard.press('n'); await page.waitForTimeout(250); await page.keyboard.type(kent); await page.waitForTimeout(200);
    const gevonden = await page.evaluate(() => (document.getElementById('ritUit') || {}).className);
    check(gevonden === 'tok', `${tag} nieuwe melding: rit gevonden op kenteken ${kent}`);
    await page.click('#nf ~ .dlg-f button[type=submit], button[form=nf]'); await page.waitForTimeout(400);
    const nieuw = await page.evaluate(() => ({ hash: location.hash, rit: (window.BSP.D.claims[window.BSP.D.claims.length - 1] || {}).rit }));
    check(/#schade\/S-2026-9/.test(nieuw.hash) && !!nieuw.rit, `${tag} eigen dossier aangemaakt en geopend (${nieuw.hash}, rit ${nieuw.rit})`);
    // een mail plakken: de lezer vult de velden
    await page.keyboard.press('Escape'); await page.evaluate(() => window.BSP.ui.ctx.nieuweMelding({ tab: 'mail' })); await page.waitForTimeout(250);
    await page.fill('#mailTekst', 'Hoi,\n\nJullie hebben 14 okt 2026 een Volkswagen Polo bij ons opgehaald, kenteken RV-743-J. Er zit een stoeprandschade op de velg rechtsvoor. Offerte: € 215.\n\nGroet,\nvestigingsmanager, Verhuur Kustlijn');
    await page.click('#leesMail'); await page.waitForTimeout(200); await page.click('#naarVelden'); await page.waitForTimeout(200);
    const gelezen = await page.evaluate(() => { const f = document.getElementById('nf'); return { k: f.elements.kenteken.value, b: f.elements.bedrag.value, g: f.elements.gebied.value, s: f.elements.soort.value, o: f.elements.opdrachtgever.value }; });
    check(gelezen.k === 'RV-743-J' && gelezen.b === '215' && gelezen.g === 'velg_rv' && gelezen.s === 'stoeprand' && gelezen.o === 'K-13', `${tag} mail gelezen: ${JSON.stringify(gelezen)}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    // een rittenexport inlezen via de instellingen
    await page.evaluate(h => { location.hash = '#' + h; }, 'instellingen'); await page.waitForTimeout(250);
    await page.setInputFiles('input[data-chg="csv"]', { name: 'export.csv', mimeType: 'text/csv', buffer: Buffer.from('rit;kenteken;merk;model;ophaal;aflever;chauffeur;van;naar;opdrachtgever\nR-IMP-9;ZZ-999-Z;Testmerk;Model;2026-11-03 09:00;2026-11-03 15:00;Test C.;Hoorn;Barneveld;Testklant\n') }); await page.waitForTimeout(400);
    const imp = await page.evaluate(() => ({ n: window.BSP.importen.aantal, rit: window.BSP.D.ritMap.has('R-IMP-9'), uit: (document.getElementById('importUit') || {}).textContent || '' }));
    check(imp.n >= 1 && imp.rit && /ingelezen/.test(imp.uit), `${tag} rittenexport ingelezen (${imp.n})`);
    await page.evaluate(() => window.BSP.importen.wis());
    // per soort: een dossier van elke soort opent zonder fouten, met zijn eigen middenkolom
    for (const cat of ['eigen', 'derde', 'divers']) {
      const cid = await page.evaluate(k => (window.BSP.D.claims.filter(c => c.categorie === k && c.status !== 'gesloten' && (k !== 'derde' || c.gps.gevonden))[0] || window.BSP.D.claims.find(c => c.categorie === k)).id, cat);
      await page.evaluate(h => { location.hash = '#' + h; }, `schade/${cid}`); await page.waitForTimeout(300);
      const dd = await page.evaluate(() => ({ h1: (document.querySelector('#v-dossier h1') || {}).textContent || '', cat: (document.querySelector('.catlbl') || {}).textContent || '', truck: !!document.querySelector('#v-dossier .truckw svg'), gps: !!document.querySelector('#v-dossier .gpsz'), pakket: document.querySelectorAll('#v-dossier .pakket li').length, signs: document.querySelectorAll('#v-dossier .sign').length }));
      check(dd.signs >= 3 && dd.cat && (cat !== 'eigen' || dd.truck) && (cat !== 'derde' || (dd.gps && dd.pakket >= 5)), `${tag} dossier ${cid} (${cat}): ${dd.cat}, ${dd.signs} signalen${dd.truck ? ', zijaanzicht' : ''}${dd.gps ? ', telematica' : ''}${dd.pakket ? `, pakket ${dd.pakket}` : ''}`);
    }
    // een mail met het kenteken van ons eigen voertuig wordt een aanrijschade derde
    const eigenK = await page.evaluate(() => window.BSP.D.vloot.find(v => v.id === 'BT-23').kenteken);
    await page.evaluate(() => window.BSP.ui.ctx.nieuweMelding({ tab: 'mail' })); await page.waitForTimeout(250);
    await page.fill('#mailTekst', `Goedemiddag,\n\nOp 3 november rond 14:10 heeft een vrachtwagen van Breedijk bij het achteruitrijden mijn geparkeerde auto geraakt. Op de beelden zie ik het kenteken ${eigenK.slice(0, 2)}-${eigenK.slice(2, 5)}-${eigenK.slice(5)}. Deuk in de voorbumper, offerte € 1.240.\n\nGroet,\nde eigenaar`);
    await page.click('#leesMail'); await page.waitForTimeout(200);
    const derde = await page.evaluate(() => ({ cat: (document.querySelector('#catSeg .on') || {}).dataset?.cat, voertuig: document.querySelector('#nf').elements.eigenVoertuig.value, bedrag: document.querySelector('#nf').elements.bedrag.value }));
    check(derde.cat === 'derde' && derde.voertuig === 'BT-23' && derde.bedrag === '1240', `${tag} mail met ons kenteken: soort ${derde.cat}, voertuig ${derde.voertuig}, ${derde.bedrag}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    // zoeken met / en pijltjes
    await page.keyboard.press('Escape'); await page.keyboard.press('/'); await page.keyboard.type('polder'); await page.waitForTimeout(250);
    const pop = await page.evaluate(() => ({ open: !document.getElementById('popover').hidden, n: document.querySelectorAll('#popover .pi').length }));
    check(pop.open && pop.n >= 1, `${tag} zoeken: ${pop.n} treffer(s) voor "polder"`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(250);
    check(/#opdrachtgever\/K-05/.test(await page.evaluate(() => location.hash)), `${tag} Enter opent de opdrachtgever`);
    // sneltoetsen 1 en 5
    await page.keyboard.press('7'); await page.waitForTimeout(200); check(/#rapporten/.test(await page.evaluate(() => location.hash)), `${tag} toets 7 opent Rapporten`);
    await page.keyboard.press('5'); await page.waitForTimeout(200); check(/#wagenpark/.test(await page.evaluate(() => location.hash)) && await page.evaluate(() => document.querySelectorAll('#v-wagenpark tbody tr').length >= 36), `${tag} toets 5 opent het wagenpark`);
    await page.keyboard.press('6'); await page.waitForTimeout(200); check(/#dashboard/.test(await page.evaluate(() => location.hash)) && await page.evaluate(() => document.querySelectorAll('.dk').length === 5 && !!document.querySelector('.diag.heat svg')), `${tag} toets 6 opent het dashboard met vijf tegels en de warmtekaart`);
    // thema
    await page.click('#themeBtn'); await page.waitForTimeout(200);
    const th = await page.evaluate(() => ({ root: document.getElementById('app').dataset.theme, html: document.documentElement.dataset.theme, bg: getComputedStyle(document.getElementById('app')).backgroundColor }));
    check(th.root === 'dark' && th.html === undefined && th.bg !== 'rgb(255, 255, 255)', `${tag} donker thema op de root (${th.bg})`);
    if (shots) await page.screenshot({ path: `${shots}/verify-${tag}-donker.png` });
    await page.click('#themeBtn');
    // de rol planner ziet het besluit niet en het chauffeursbeeld niet
    await page.evaluate(() => window.BSP.ui.ctx.setInst({ rol: 'planner' })); await page.evaluate(h => { location.hash = '#' + h; }, 'chauffeurs'); await page.waitForTimeout(250);
    const pl = await page.evaluate(() => ({ lock: !!document.querySelector('#v-chauffeurs .note .ic'), tbl: !!document.querySelector('#v-chauffeurs table') }));
    check(pl.lock && !pl.tbl, `${tag} planner ziet het chauffeursbeeld niet`);
    await page.evaluate(() => window.BSP.ui.ctx.setInst({ rol: 'behandelaar' }));
    // alles wissen: terug naar de uitgangstoestand
    await page.evaluate(() => { window.BSP.acties.wis(); });
    check(await page.evaluate(() => window.BSP.acties.aantal() === 0), `${tag} handelingen gewist`);
  }
  if (vp.embedded) {
    const sb = await page.evaluate(() => ({ w: Math.round(document.getElementById('side').getBoundingClientRect().width), lbl: getComputedStyle(document.querySelector('.side .nav a .n')).display }));
    check(sb.w <= 72 && sb.lbl === 'none', `${tag} zijbalk ingeklapt op 1024 px (${sb.w} px, labels ${sb.lbl})`);
    // ingebed: sneltoetsen alleen met de focus in de app
    await page.evaluate(() => { location.hash = '#overzicht'; }); await page.waitForTimeout(200);
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); }); // de focus ligt buiten de app
    await page.keyboard.press('7'); await page.waitForTimeout(150);
    check(/#overzicht/.test(await page.evaluate(() => location.hash)), `${tag} ingebed: toets zonder focus doet niets`);
    await page.evaluate(() => document.querySelector('#v-overzicht .ph').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await page.waitForTimeout(100); await page.keyboard.press('7'); await page.waitForTimeout(150);
    check(/#rapporten/.test(await page.evaluate(() => location.hash)), `${tag} ingebed: toets met focus werkt`);
  }
  if (vp.w < 500) {
    const m = await page.evaluate(() => { location.hash = '#schades'; return new Promise(r => setTimeout(() => { const bar = document.getElementById('bottombar'); const bb = bar.getBoundingClientRect(); const v = document.getElementById('views').getBoundingClientRect(); r({ bar: getComputedStyle(bar).display, barH: Math.round(bb.height), barTop: Math.round(bb.top), vin: innerHeight, side: Math.round(document.getElementById('side').getBoundingClientRect().width), labels: [...bar.querySelectorAll('a span:not(.cnt)')].filter(s => s.getBoundingClientRect().height > 0).length, lijst: document.querySelectorAll('.ml .ml-i').length, tabel: getComputedStyle(document.querySelector('.tbl.m-list')).display, pad: parseInt(getComputedStyle(document.getElementById('views')).paddingBottom) }); }, 250)); });
    check(m.bar === 'flex' && m.barH >= 50 && m.barTop + m.barH <= m.vin && m.labels >= 5 && m.side === 0 && m.pad >= 50 && m.lijst > 0 && m.tabel === 'none', `${tag} onderbalk ${m.barH} px hoog met ${m.labels} labels, zijbalk ${m.side} px, lijst in plaats van tabel (${m.lijst} rijen)`);
    if (shots) await page.screenshot({ path: `${shots}/verify-${tag}-schades.png` });
  }
  const realErrors = errors.filter(e => !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|ERR_FAILED/.test(e));
  check(realErrors.length === 0, `${tag} console-fouten: ${realErrors.length}${realErrors.length ? '\n   ' + realErrors.slice(0, 5).join('\n   ') : ''}`);
  check(ext.size === 0, `${tag} externe hosts: ${[...ext].join(', ') || 'geen'}`);
  await ctx.close();
}
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
