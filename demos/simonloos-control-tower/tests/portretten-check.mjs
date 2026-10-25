// Controle van de voertuigportretten (src/portretten.js en src/assets/portretten/): elk bestand bestaat, is een WebP
// van 640 x 400 px en hooguit 25 KB, samen hooguit 600 KB, geen losse bestanden zonder portret; de lijst klopt (unieke
// namen, een alt-tekst per beeld); en portretVan en portretVanOplegger geven voor elk voertuig en elke oplegger uit de
// simulatie een beeld, met de juiste cabinevorm per model.
//
//   npm run build && (cd dist && python3 -m http.server 8773 --bind 127.0.0.1) &
//   node tests/portretten-check.mjs [http://127.0.0.1:8773/index.html]
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] || 'http://127.0.0.1:8773/index.html';
let fail = 0; const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FOUT'} ${msg}`); if (!ok) fail++; };

// ---------- bestanden ----------
const src = readFileSync(path.join(app, 'src', 'portretten.js'), 'utf8');
const imports = [...src.matchAll(/^import\s+(\w+)\s+from\s+'\.\/assets\/portretten\/([\w-]+\.webp)\?inline';$/gm)].map(m => ({ name: m[1], file: m[2] }));
check(imports.length > 0, `${imports.length} beelden geïmporteerd met ?inline`);
check(!/^\s*import[^;]*from\s*['"][^'"]*(three|scene3d)[^'"]*['"]/m.test(src), 'portretten.js importeert niets uit three of scene3d');
const dir = path.join(app, 'src', 'assets', 'portretten'); const op = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.webp')) : [];
function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return null;
}
let total = 0; const bad = [];
for (const { file } of imports) {
  const f = path.join(dir, file); if (!existsSync(f)) { bad.push(`${file} ontbreekt`); continue; }
  const buf = readFileSync(f); total += buf.length; const wh = webpSize(buf);
  if (buf.length > 25 * 1024) bad.push(`${file} ${buf.length} bytes`);
  if (!wh || wh[0] !== 640 || wh[1] !== 400) bad.push(`${file} ${wh ? wh.join('x') : 'geen WebP'}`);
}
check(!bad.length, `elk beeld bestaat, is een WebP van 640 x 400 en hooguit 25 KB${bad.length ? ': ' + bad.join('; ') : ''}`);
check(total <= 600 * 1024, `samen ${(total / 1024).toFixed(1)} KB (hooguit 600 KB; in de bundel als base64 ongeveer ${(total * 4 / 3 / 1024).toFixed(0)} KB)`);
const los = op.filter(f => !imports.some(i => i.file === f));
check(!los.length, `geen bestanden zonder portret in src/assets/portretten${los.length ? ': ' + los.join(', ') : ''}`);

// ---------- de module zelf, in Node: de ?inline-imports vervangen door de bestandsnaam ----------
const tmp = mkdtempSync(path.join(tmpdir(), 'portretten-'));
// de foto's van de schaalmodellen (src/assets/fotos): 960 x 640, elk hooguit 60 KB, samen hooguit 200 KB
const fotos = [...src.matchAll(/^import\s+(\w+)\s+from\s+'\.\/assets\/fotos\/([\w-]+\.webp)\?inline';$/gm)].map(m => ({ name: m[1], file: m[2] }));
const fdir = path.join(app, 'src', 'assets', 'fotos'); let ftotal = 0; const fbad = [];
for (const { file } of fotos) {
  const f = path.join(fdir, file); if (!existsSync(f)) { fbad.push(`${file} ontbreekt`); continue; }
  const buf = readFileSync(f); ftotal += buf.length; const wh = webpSize(buf);
  if (buf.length > 60 * 1024) fbad.push(`${file} ${buf.length} bytes`);
  if (!wh || wh[0] !== 960 || wh[1] !== 640) fbad.push(`${file} ${wh ? wh.join('x') : 'geen WebP'}`);
}
check(fotos.length > 0 && !fbad.length, `${fotos.length} foto's van schaalmodellen, elk een WebP van 960 x 640 en hooguit 60 KB${fbad.length ? ': ' + fbad.join('; ') : ''}`);
check(ftotal <= 200 * 1024, `foto's samen ${(ftotal / 1024).toFixed(1)} KB (hooguit 200 KB)`);
const body = src.replace(/^import\s+(\w+)\s+from\s+'\.\/assets\/(?:portretten|fotos)\/([\w-]+\.webp)\?inline';$/gm, (_, n, f) => `const ${n} = 'data:image/webp;${f}';`);
writeFileSync(path.join(tmp, 'portretten.mjs'), body);
const M = await import(pathToFileURL(path.join(tmp, 'portretten.mjs')).href);
const ids = M.PORTRETTEN.map(p => p.id);
check(new Set(ids).size === ids.length && M.PORTRETTEN.every(p => p.alt && p.alt.length > 10 && p.w === 640 && p.h === 400 && p.src.endsWith(`${p.id}.webp`)), `PORTRETTEN: ${ids.length} unieke namen, elk met alt-tekst, maat en het eigen bestand`);
const vorm = [['DAF XF 480', 'trekker-daf-diesel'], ['Scania R 450', 'trekker-scania-diesel'], ['Scania 460 R Super', 'trekker-scania-diesel'], ['Volvo FH 460', 'trekker-volvo-diesel'], ['Mercedes-Benz Actros 1845', 'trekker-mercedes-diesel']];
const vormEv = [['Volvo FH Electric', 'trekker-volvo-elektrisch'], ['Mercedes-Benz eActros 300', 'trekker-mercedes-elektrisch'], ['Mercedes-Benz eActros 600', 'trekker-mercedes600-elektrisch']];
const mis = [...vorm.map(([m, id]) => [M.portretVan({ kind: 'trekker', ev: false, model: m }), id]), ...vormEv.map(([m, id]) => [M.portretVan({ kind: 'trekker', ev: true, model: m }), id]), ...vormEv.map(([m, id]) => [M.portretVan({ kind: 'trekker', ev: true, model: m }, true), id + '-oplegger'])].filter(([p, id]) => !p || p.id !== id);
const fids = M.FOTOS.map(f => f.id);
check(new Set(fids).size === fids.length && M.FOTOS.every(f => f.alt && f.bron && f.w === 960 && f.h === 640), `FOTOS: ${fids.length} unieke namen, elk met alt-tekst, bron en maat`);
const fDaf = M.fotoVan({ kind: 'trekker', ev: false, model: 'DAF XF 480' }), fActros = M.fotoVan({ kind: 'bakwagen', ev: false, model: 'Mercedes-Benz Actros 2545' }), fEv = M.fotoVan({ kind: 'trekker', ev: true, model: 'Volvo FH Electric' }), fKoel = M.fotoVanOplegger('koel'), fSilo = M.fotoVanOplegger('silo');
check(fDaf && fDaf.zicht === 'voor' && fActros && fActros.soort === 'bakwagen' && fEv === null && fKoel && fKoel.zicht === 'zij' && fSilo === null, `fotoVan: DAF XF → ${fDaf && fDaf.id}, Actros bakwagen → ${fActros && fActros.id}, elektrische Volvo → ${fEv}, koeloplegger → ${fKoel && fKoel.id}, silo → ${fSilo}`);
check(!mis.length, `cabinevorm per model, met en zonder oplegger${mis.length ? ': ' + mis.map(([p, id]) => `${id} → ${p && p.id}`).join('; ') : ''}`);

// ---------- elk voertuig en elke oplegger uit de simulatie ----------
const tryReq = base => { try { return createRequire(base)('playwright'); } catch { return null; } };
const pw = tryReq(import.meta.url) || tryReq(path.join(app, 'x.js')) || tryReq('/opt/node22/lib/node_modules/') || tryReq(path.join(process.env.NODE_PATH || '/', 'x.js'));
if (!pw) { check(false, 'playwright niet gevonden: de simulatie is niet nagelopen'); }
else {
  const browser = await pw.chromium.launch(); const page = await browser.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('sl-online', 'off'); } catch { /* geen opslag */ } });
  let sim = null;
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.SLCT && window.SLCT.fleet && document.getElementById('loading').hidden, null, { timeout: 120000 });
    sim = await page.evaluate(() => { const f = window.SLCT.fleet; const T = window.SLCT.state.simTime; return { trucks: f.trucks.map(t => ({ id: t.id, kind: t.kind, ev: t.ev, model: t.model, tr: !!(f.stateAt(t, T).tr) })), trailers: f.trailers.map(tr => ({ id: tr.id, type: tr.type })) }; });
  } catch (e) { check(false, `de app niet geopend op ${url}: ${String(e).slice(0, 120)}`); }
  await browser.close();
  if (sim) {
    const used = new Set(); const geen = [];
    for (const t of sim.trucks) { for (const p of [M.portretVan(t), M.portretVan(t, true), M.portretVan(t, false)]) { if (!p || !p.src) geen.push(t.id); else used.add(p.id); } if (t.kind !== 'trekker' && M.portretVan(t, true) !== M.portretVan(t, false)) geen.push(`${t.id} (oplegger bij een ${t.kind})`); }
    check(!geen.length, `portretVan geeft een beeld voor elk voertuig, met en zonder oplegger (${sim.trucks.length} voertuigen)${geen.length ? ': ' + [...new Set(geen)].slice(0, 6).join(', ') : ''}`);
    const geenO = sim.trailers.filter(tr => { const p = M.portretVanOplegger(tr); return !p || !p.src || p.id !== `oplegger-${tr.type}`; });
    for (const tr of sim.trailers) { const p = M.portretVanOplegger(tr); if (p) used.add(p.id); }
    check(!geenO.length, `portretVanOplegger geeft voor elke oplegger het beeld van zijn soort (${sim.trailers.length} opleggers, soorten: ${[...new Set(sim.trailers.map(t => t.type))].join(', ')})${geenO.length ? ': ' + geenO.slice(0, 6).map(t => `${t.id} ${t.type}`).join(', ') : ''}`);
    const ongebruikt = ids.filter(id => !used.has(id));
    check(!ongebruikt.length, `elk portret wordt door de vloot gebruikt${ongebruikt.length ? '; niet: ' + ongebruikt.join(', ') : ''}`);
  }
}
console.log(fail ? `\n${fail} FOUT(EN)` : '\nalles in orde');
process.exit(fail ? 1 : 0);
