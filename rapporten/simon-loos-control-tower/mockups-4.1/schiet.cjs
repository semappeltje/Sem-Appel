// Schiet de mockups van 4.1 met Playwright: 1440 × 900, en van Bezetting en Vrijgeven ook 390 × 844.
// PNG naast de HTML; een JPEG-kopie voor de pdf in de map van het document (plan-4.1/img).
// Gebruik: node schiet.cjs   (vanuit deze map; Playwright en Chromium moeten er zijn)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const dir = __dirname;
const img = path.join(dir, '..', 'plan-4.1', 'img');
fs.mkdirSync(img, { recursive: true });
const SCHERMEN = [
  ['01-bezetting', 1440, 900], ['01-bezetting-390', 390, 844], ['02-vrijgeven', 1440, 900], ['02-vrijgeven-390', 390, 844],
  ['03-bericht-chauffeur', 1440, 900], ['04-chauffeursprofiel', 1440, 900], ['05-kandidaatkaart', 1440, 900],
  ['06-ritopdracht', 1440, 900], ['07-dashboard', 1440, 900], ['08-voorstel-elektrisch', 1440, 900],
];
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of SCHERMEN) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const fouten = [];
    p.on('console', m => { if (m.type() === 'error') fouten.push(m.text()); else if (n === '01-bezetting') console.log('  data', m.text()); });
    p.on('pageerror', e => fouten.push(String(e)));
    await p.goto('file://' + path.join(dir, n + '.html'), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const over = await p.evaluate(() => {
      const uit = [];
      for (const el of document.querySelectorAll('.page,.m-page,.card,.card-b,.body,.det,.lst')) {
        if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflow !== 'visible') uit.push(`${el.className} ${el.scrollHeight}>${el.clientHeight}`);
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) uit.push('breed ' + document.documentElement.scrollWidth);
      return uit;
    });
    await p.screenshot({ path: path.join(dir, n + '.png') });
    if (w === 1440 || n.endsWith('390')) await p.screenshot({ path: path.join(img, n + '.jpg'), type: "jpeg", quality: 80 });
    const kb = Math.round(fs.statSync(path.join(dir, n + '.png')).size / 1024);
    console.log(n, w + 'x' + h, kb + ' kB', fouten.length ? 'FOUTEN ' + fouten.join(' | ') : '', over.length ? 'OVERLOOP ' + over.join(' ; ') : '');
    await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
