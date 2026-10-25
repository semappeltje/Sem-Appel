// Controle van de gebouwde app (Control Tower 4.0): zonder fouten laden, thema en kiosk op de app-root, geen horizontale
// overloop op 1440 en 390 px, de kaart met en zonder WebGL, de ingebedde opties (data-tiles="off" data-embedded) en
// minder beweging. Elke weergave van de nieuwe indeling wordt kort geopend.
//
//   cd dist && python3 -m http.server 8774 --bind 127.0.0.1      (of een andere poort)
//   node tests/verify.mjs 8774 [gl|nogl] [plain|embedded] [map voor schermafbeeldingen]
//
// Aangepast van verify.mjs uit ronde 4: de weergaven heten nu zoals in het menu (overzicht, ritten, meldingen, ...),
// de lettergrootte van de app is 13,5 px (typeschaal van ONTWERP-4) en het assistentpaneel opent rechts.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , port = '8774', mode = 'gl', variant = 'plain', shots = ''] = process.argv;
const url = /^\d+$/.test(port) ? `http://127.0.0.1:${port}/index.html` : port;
const args = mode === 'gl' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--disable-gpu', '--disable-software-rasterizer', '--disable-3d-apis'];
const browser = await chromium.launch({ args });
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; };
// alle zestien onderdelen van het menu, ook Open ritten en Charters en oproepkrachten
const VIEWS = ['overzicht', 'kaart', 'ritten', 'meldingen', 'openritten', 'planbord', 'voertuigen', 'opleggers', 'chauffeurs', 'charters', 'standplaatsen', 'laden', 'lostijden', 'pauze', 'rapporten', 'instellingen'];
for (const vp of [{ w: 1440, h: 900 }, { w: 390, h: 844 }, { w: 1440, h: 900, rm: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.w < 500, hasTouch: vp.w < 500, reducedMotion: vp.rm ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = []; const ext = new Set();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => { const u = new URL(r.url()); if (!/^(data|blob|about):/.test(r.url()) && u.host !== new URL(url).host) ext.add(u.host); });
  await page.route('**/*', route => { const u = new URL(route.request().url()); if (u.host !== new URL(url).host) return route.abort('blockedbyclient'); return route.continue(); });
  if (variant === 'embedded') await page.route(url, async route => { const res = await route.fetch(); const body = (await res.text()).replace('class="app slct"', 'class="app slct" data-tiles="off" data-embedded'); await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/html; charset=utf-8' } }); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SLCT && document.getElementById('loading').hidden, null, { timeout: 300_000, polling: 500 });
  await page.waitForTimeout(1500);
  // wizard doorlopen (standaard: alle regio's, alle divisies, planner)
  for (let i = 0; i < 3; i++) { const b = await page.$('#wzNext'); if (b && await b.isVisible()) { await b.click(); await page.waitForTimeout(150); } }
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => ({
    theme: document.getElementById('app').dataset.theme, htmlTheme: document.documentElement.dataset.theme, wizard: document.getElementById('wizard').hidden,
    sw: document.documentElement.scrollWidth, iw: window.innerWidth, noWebGL: !!window.SLCT.map.noWebGL, nomap: !!document.querySelector('.nomap'),
    canvas: !!document.querySelector('#map canvas'), tiles: window.SLCT.map.hasTiles(), online: !!document.getElementById('onlineTog'), cfg: window.SLCT.cfg,
    rootFont: getComputedStyle(document.getElementById('app')).fontSize, trans: getComputedStyle(document.querySelector('.btn') || document.body).transitionDuration,
  }));
  const tag = `${vp.w}${vp.rm ? '-rm' : ''}-${mode}-${variant}`;
  check(st.wizard, `${tag} wizard doorlopen`);
  check(st.theme === 'light' && st.htmlTheme === undefined, `${tag} thema op app-root (${st.theme}), niet op <html>`);
  check(st.sw <= st.iw, `${tag} geen horizontale overflow (${st.sw} <= ${st.iw})`);
  check(mode === 'gl' ? st.canvas && !st.noWebGL : st.noWebGL && st.nomap, `${tag} kaart: canvas=${st.canvas} noWebGL=${st.noWebGL} melding=${st.nomap}`);
  check(variant === 'embedded' ? !st.tiles && !st.online : (mode === 'gl' ? st.tiles : true), `${tag} tegels: hasTiles=${st.tiles} toggle=${st.online} cfg=${JSON.stringify(st.cfg)}`);
  check(st.rootFont === '13.5px', `${tag} app-lettergrootte ${st.rootFont}`);
  if (vp.rm) check(/^0s/.test(st.trans), `${tag} minder beweging: overgangen uit (${st.trans})`);
  if (shots) await page.screenshot({ path: `${shots}/verify-${tag}-licht.png` });
  // thema wisselen
  const tb = await page.$('#themeBtn'); if (tb) { await page.evaluate(() => document.getElementById('themeBtn').click()); await page.waitForTimeout(400); }
  const th = await page.evaluate(() => ({ root: document.getElementById('app').dataset.theme, html: document.documentElement.dataset.theme, bg: getComputedStyle(document.getElementById('app')).backgroundColor }));
  check(tb ? th.root === 'dark' && th.html === undefined && th.bg !== 'rgb(255, 255, 255)' : true, `${tag} donker thema op root: ${JSON.stringify(th)}`);
  if (shots && tb) await page.screenshot({ path: `${shots}/verify-${tag}-donker.png` });
  if (tb) { await page.evaluate(() => document.getElementById('themeBtn').click()); await page.waitForTimeout(300); }
  // hal-scherm via hash: kiosk-klasse op de root
  await page.evaluate(() => { location.hash = '#hal/Wognum'; });
  await page.waitForTimeout(700);
  const hal = await page.evaluate(() => ({ kiosk: document.getElementById('app').classList.contains('kiosk'), bodyKiosk: document.body.classList.contains('kiosk'), halVis: !document.getElementById('hal').hidden, rows: document.querySelectorAll('#hal .halline').length }));
  check(hal.kiosk && !hal.bodyKiosk && hal.halVis && hal.rows > 0, `${tag} hal-scherm: ${JSON.stringify(hal)}`);
  if (shots && vp.w > 500 && !vp.rm) await page.screenshot({ path: `${shots}/verify-${tag}-hal.png` });
  await page.evaluate(() => window.SLCT.ui.ctx.hashTo(''));
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ kiosk: document.getElementById('app').classList.contains('kiosk'), halVis: !document.getElementById('hal').hidden }));
  check(!back.kiosk && !back.halVis, `${tag} hal gesloten`);
  // alle weergaven van het menu kort openen, en het assistentpaneel; geen overloop
  const over = [];
  for (const v of VIEWS) { await page.evaluate(n => window.SLCT.ui.setView(n), v); await page.waitForTimeout(350); const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (sw > 0) over.push(`${v} +${sw}`); }
  await page.evaluate(() => window.SLCT.ui.ctx.toggleAssist(true)); await page.waitForTimeout(400); await page.evaluate(() => window.SLCT.ui.ctx.closePanel());
  await page.evaluate(() => window.SLCT.ui.setView('kaart')); await page.waitForTimeout(600);
  check(over.length === 0, `${tag} geen overloop in de ${VIEWS.length} weergaven${over.length ? `: ${over.join(', ')}` : ''}`);
  const realErrors = errors.filter(e => !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|ERR_FAILED/.test(e));
  check(realErrors.length === 0, `${tag} console-fouten: ${realErrors.length}${realErrors.length ? '\n   ' + realErrors.slice(0, 5).join('\n   ') : ''}`);
  check(variant === 'embedded' ? ext.size === 0 : true, `${tag} externe hosts: ${[...ext].join(', ') || 'geen'}`);
  await ctx.close();
}
await browser.close();
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
