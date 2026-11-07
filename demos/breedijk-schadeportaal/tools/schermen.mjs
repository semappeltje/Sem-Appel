// Neemt de schermafbeeldingen voor het rapport opnieuw op (rapporten/breedijk-schadeportaal/schermen).
// Gebruik: npm run build, serveer dist (bijvoorbeeld: python3 -m http.server 8791 -d dist), dan
//   node tools/schermen.mjs 8791
// De dossiers worden op hun soort en toestand gekozen, niet op een vast nummer, zodat het blijft werken als de
// gesimuleerde data verandert. Oude afbeeldingen in de map worden eerst verwijderd.
import { createRequire } from 'node:module';
import { readdirSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const poort = process.argv[2] || '8791';
const url = `http://127.0.0.1:${poort}/`;
const map = join(dirname(fileURLToPath(import.meta.url)), '../../../rapporten/breedijk-schadeportaal/schermen');
mkdirSync(map, { recursive: true });
for (const f of readdirSync(map)) if (f.endsWith('.png')) rmSync(join(map, f));

// Kiest een dossier in de pagina; elke kiezer krijgt de lijst claims en geeft een id.
const KIEZERS = {
  lading: cs => (cs.filter(c => c.categorie === 'lading' && c.status === 'nieuw' && c.rit).sort((a, b) => b.ontvangen - a.ontvangen)[0] || {}).id,
  eigen: cs => (cs.filter(c => c.categorie === 'eigen' && c.status !== 'gesloten').sort((a, b) => b.bedragGevraagd - a.bedragGevraagd)[0] || {}).id,
  derde: cs => (cs.filter(c => c.categorie === 'derde' && c.gps && c.gps.gevonden && c.status !== 'gesloten')[0] || {}).id,
  derdeNiet: cs => (cs.filter(c => c.categorie === 'derde' && c.gps && !c.gps.gevonden)[0] || {}).id,
  divers: cs => (cs.filter(c => c.categorie === 'divers')[0] || {}).id,
};
const SCHERMEN = [
  ['overzicht', 'overzicht'], ['schades', 'schades'], ['wagenpark', 'wagenpark'], ['voertuig', 'voertuig/BT-23'],
  ['dashboard', 'dashboard'], ['dashboard-derde', 'dashboard?cat=derde'], ['chauffeurs', 'chauffeurs'],
  ['opdrachtgevers', 'opdrachtgevers'], ['rapporten', 'rapporten'], ['instellingen', 'instellingen'],
  ['dossier-lading', 'lading'], ['dossier-eigen', 'eigen'], ['dossier-derde', 'derde'], ['dossier-derde-niet-van-ons', 'derdeNiet'], ['dossier-divers', 'divers'],
];
const OP_390 = new Set(['overzicht', 'schades', 'wagenpark', 'dashboard', 'dossier-lading', 'dossier-eigen', 'dossier-derde']);

const browser = await chromium.launch();
let n = 0;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(400);
  for (const [naam, doel] of SCHERMEN) {
    if (w === 390 && !OP_390.has(naam)) continue;
    let hash = doel;
    if (KIEZERS[doel]) { const id = await page.evaluate(`(${KIEZERS[doel]})(window.BSP.D.claims)`); if (!id) { console.log('geen dossier voor', doel); continue; } hash = `schade/${id}`; }
    await page.evaluate(x => { location.hash = '#' + x; }, hash); await page.waitForTimeout(350);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(map, `${w}-${naam}.png`) }); n++;
  }
  if (w === 1440) {
    await page.evaluate(() => window.BSP.ui.ctx.setInst({ thema: 'donker' })); await page.evaluate(() => { location.hash = '#dashboard'; }); await page.waitForTimeout(350);
    await page.screenshot({ path: join(map, '1440-dashboard-donker.png') }); n++;
    await page.evaluate(() => window.BSP.ui.ctx.setInst({ thema: 'licht' }));
    await page.evaluate(() => window.BSP.ui.ctx.nieuweMelding({ tab: 'mail' })); await page.waitForTimeout(350);
    await page.screenshot({ path: join(map, '1440-nieuwe-melding.png') }); n++;
  }
  await page.close();
}
await browser.close();
console.log(`${n} schermafbeeldingen in ${map}`);
