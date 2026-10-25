// Maakt van een Markdown-memo een pdf in de huisstijl van het voorstel (A4, Inter, beeldmerk, gele en rode band).
// Gebruik: node maak-pdf.mjs <memo.md> <uit.pdf> "<ondertitel>"
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { marked } from 'marked';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const [, , mdPath, pdfPath, ondertitel = 'Voorstel van Sem Appel', titelArg = ''] = process.argv;
const fonts = '/tmp/claude-0/-home-user/0eec7dfd-794d-5c4b-9f21-bb4e422d8df3/scratchpad/voorstel/fonts';
let md = readFileSync(mdPath, 'utf8');
// titel uit de eerste regel; de rest als body
const m = md.match(/^# (.+)\n/);
const titel = titelArg || (m ? m[1] : path.basename(mdPath, '.md'));
if (m) md = md.slice(m[0].length);
// voor de lezer buiten de repo: bestandsnamen in de inleiding in gewone woorden, nadruk vet in plaats van cursief (huisstijl)
md = md.replace(/Vervolg op `planning-visie-en-plan\.md`,/, 'Vervolg op het stuk over planning als werkproces,');
const body = marked.parse(md, { gfm: true }).replace(/<em>/g, '<strong>').replace(/<\/em>/g, '</strong>');
const css = `
@font-face { font-family: Inter; font-weight: 400; src: url('file://${fonts}/inter-400.ttf'); }
@font-face { font-family: Inter; font-weight: 500; src: url('file://${fonts}/inter-500.ttf'); }
@font-face { font-family: Inter; font-weight: 600; src: url('file://${fonts}/inter-600.ttf'); }
@font-face { font-family: Inter; font-weight: 700; src: url('file://${fonts}/inter-700.ttf'); }
@page { size: A4; margin: 18mm 18mm 20mm 18mm; }
:root { --ink: #15181E; --muted: #5F6775; --line: #E3E6EA; --rood: #E3001F; --geel: #F0A526; --vlak: #F6F7F9; }
html { font-family: Inter, system-ui, sans-serif; color: var(--ink); font-size: 10.2pt; line-height: 1.5; }
body { margin: 0; }
.kop { display: flex; align-items: center; gap: 8px; font-size: 9pt; font-weight: 600; margin-bottom: 26mm; }
.merk { display: grid; grid-template-columns: 7px 7px; gap: 2px; transform: skewX(-10deg); }
.merk i { width: 7px; height: 7px; display: block; } .merk i.g { background: var(--geel); } .merk i.r { background: var(--rood); }
.kop .rechts { margin-left: auto; color: var(--muted); font-weight: 400; }
h1.titel { font-size: 24pt; line-height: 1.15; font-weight: 700; margin: 0 0 6mm; letter-spacing: -0.01em; max-width: 150mm; }
.onder { color: var(--muted); font-size: 11pt; margin-bottom: 4mm; }
.datum { font-size: 9pt; color: var(--muted); margin-bottom: 8mm; }
.band { height: 3mm; background: linear-gradient(var(--geel) 0 50%, var(--rood) 50% 100%); margin: 0 0 10mm; }
h2 { font-size: 14pt; font-weight: 700; margin: 9mm 0 3mm; break-after: avoid; display: flex; gap: 6px; align-items: center; }
h2::before { content: ''; width: 9px; height: 9px; background: linear-gradient(90deg, var(--geel) 50%, var(--rood) 50%); flex: none; }
h3 { font-size: 11pt; font-weight: 600; margin: 6mm 0 2mm; break-after: avoid; }
p { margin: 0 0 3mm; max-width: 165mm; }
ul, ol { margin: 0 0 3mm; padding-left: 5mm; } li { margin: 0 0 1.2mm; }
strong { font-weight: 600; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 8.6pt; background: var(--vlak); padding: 0 3px; border-radius: 3px; }
table { border-collapse: collapse; width: 100%; font-size: 8.4pt; margin: 2mm 0 5mm; break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { text-align: left; font-weight: 600; color: var(--muted); border-bottom: 1.2px solid var(--ink); padding: 1.6mm 2mm 1.6mm 0; vertical-align: bottom; }
td { border-bottom: 0.6px solid var(--line); padding: 1.6mm 2mm 1.6mm 0; vertical-align: top; }
td:first-child { font-weight: 600; }
hr { border: 0; border-top: 0.6px solid var(--line); margin: 6mm 0; }
`;
const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${titel}</title><style>${css}</style></head><body>
<div class="kop"><span class="merk"><i class="g"></i><i class="g"></i><i class="r"></i><i class="r"></i></span>Simon Loos<span class="rechts">Control Tower</span></div>
<h1 class="titel">${titel}</h1>
<div class="onder">${ondertitel}</div>
<div class="datum">25 oktober 2026</div>
<div class="band"></div>
${body}
</body></html>`;
const htmlPath = pdfPath.replace(/\.pdf$/, '.html');
writeFileSync(htmlPath, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + htmlPath, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="font-family: Inter, sans-serif; font-size: 7pt; color: #5F6775; width: 100%; padding: 0 18mm; display: flex;"><span>${titel.replace(/:.*/, '')} · Sem Appel · 25 oktober 2026</span><span style="margin-left: auto;"><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` });
// elke pagina als PNG om na te kijken
await page.emulateMedia({ media: 'print' });
await browser.close();
console.log('pdf:', pdfPath);
