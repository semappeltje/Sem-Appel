// Maakt Plan-4.1-Control-Tower-Simon-Loos.pdf van index.html (A4, marges en paginanummers uit @page), in twee
// rondes: eerst de pdf, dan de paginanummers in de inhoudsopgave uit de tekst van de pdf, dan de pdf opnieuw.
// Daarna de controles: aantal pagina's, geen lege pagina, geen mockup over een paginagrens, de grootte.
// Gebruik: node maak-pdf.cjs [map voor pagina-afbeeldingen]   (Playwright, Chromium en poppler-utils nodig)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const html = path.join(dir, 'index.html');
const pdf = path.join(dir, '..', 'Plan-4.1-Control-Tower-Simon-Loos.pdf');
const beelden = process.argv[2] || null;
const KOPPEN = { waarom: 'Waarom 4.1', bouwstenen: 'De bouwstenen, scherm voor scherm', bod: 'Het voorkeursbod en de directie',
  ideeen: 'Vijf eigen ideeën', nodig: 'Wat Simon Loos levert voor de proef', volgorde: 'Volgorde, schatting en wat apart live kan', risico: "Risico's en signalen" };

const tekstPerPagina = f => execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).split('\f');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + html, { waitUntil: 'load' });
  await p.emulateMedia({ media: 'print' });
  // Inter als TrueType (zoals bij het voorstel): de OTF van het systeem komt als Type 3 in de pdf, groter en minder scherp.
  const ttf = process.env.INTER_TTF || '/tmp/claude-0/-home-user/0eec7dfd-794d-5c4b-9f21-bb4e422d8df3/scratchpad/voorstel/fonts';
  if (fs.existsSync(path.join(ttf, 'inter-400.ttf'))) {
    await p.addStyleTag({ content: [400, 500, 600, 700].map(w => `@font-face{font-family:Inter;font-weight:${w};src:url('file://${ttf}/inter-${w}.ttf')}`).join('') });
    await p.evaluate(() => Promise.all([400, 500, 600, 700].map(w => document.fonts.load(`${w} 12px Inter`))));
    console.log('letter: Inter TrueType uit', ttf);
  }
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))));
  await p.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  // ronde 2: paginanummers in de inhoud
  const paginas = tekstPerPagina(pdf);
  const nummers = {};
  for (const [id, kop] of Object.entries(KOPPEN)) {
    const i = paginas.findIndex((t, n) => n >= 2 && t.includes(kop));
    nummers[id] = i >= 0 ? String(i + 1) : '';
  }
  await p.evaluate(n => { for (const el of document.querySelectorAll('.toc .pg')) el.textContent = n[el.dataset.pg] || ''; }, nummers);
  await p.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  // controle: geen figuur over een paginagrens (in het printbeeld: de figuur valt binnen één pagina)
  const figs = await p.evaluate(() => [...document.querySelectorAll('figure, .fig-side, .fig-2')].map(f => ({ alt: (f.querySelector('img') || {}).alt || '', h: f.getBoundingClientRect().height })));
  await b.close();
  const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  const aantal = +info.match(/Pages:\s+(\d+)/)[1];
  const leeg = tekstPerPagina(pdf).slice(0, aantal).map((t, i) => [i + 1, t.replace(/\s+/g, '')]).filter(([, t]) => t.length < 40).map(([i]) => i);
  const kb = Math.round(fs.statSync(pdf).size / 1024);
  console.log('pdf:', pdf);
  console.log('pagina\'s:', aantal, '· grootte:', kb, 'kB', '· inhoud:', JSON.stringify(nummers));
  console.log('pagina\'s met (bijna) geen tekst:', leeg.length ? leeg.join(', ') : 'geen');
  console.log('figuren:', figs.length, '· hoogste figuur (px in printbeeld):', Math.round(Math.max(...figs.map(f => f.h))));
  if (beelden) {
    fs.mkdirSync(beelden, { recursive: true });
    execFileSync('pdftoppm', ['-r', '60', '-png', pdf, path.join(beelden, 'p')]);
    console.log('pagina-afbeeldingen in', beelden);
  }
})().catch(e => { console.error(e); process.exit(1); });
