#!/usr/bin/env node
// Voertuigportretten: renders van onze eigen 3D-modellen (src/scene3d/varianten.js en vehicles.js), geen foto's. Elk
// portret op dezelfde camera: driekwart van voren, links, ooghoogte iets boven de cabine, doorzichtige achtergrond met
// een zachte schaduw op de grond. 640 x 400 px, WebP van hooguit 25 KB, in src/assets/portretten/. src/portretten.js
// kiest per voertuig en oplegger het beeld.
//
//   node tools/render-portretten.mjs                     # alle portretten opnieuw
//   node tools/render-portretten.mjs --blad <map>        # en een contactvel (licht en donker) als PNG in <map>
//   node tools/render-portretten.mjs --alleen id,id      # alleen deze
//
// Playwright met Chromium en de software-GPU (SwiftShader): elke keer dezelfde pixels en dezelfde bestanden. De pagina
// laadt three.js en de modules uit src/scene3d rechtstreeks (import map), niets van buiten. Het kenteken is fictief
// (met een C, die Nederlandse kentekens niet gebruiken) en in een eigen lijnletter getekend, zodat het niet van de
// lettertypes van de machine afhangt. De app zet het echte kenteken er als tekst naast.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tryReq = base => { try { return createRequire(base)('playwright'); } catch { return null; } };
const pw = tryReq(import.meta.url) || tryReq(path.join(app, 'x.js')) || tryReq('/opt/node22/lib/node_modules/') || tryReq(path.join(process.env.NODE_PATH || '/', 'x.js'));
if (!pw) { console.error('playwright niet gevonden (npm i -D playwright, of NODE_PATH naar de globale installatie)'); process.exit(2); }
const args = process.argv.slice(2); const flag = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const blad = flag('--blad'), alleen = flag('--alleen') ? new Set(flag('--alleen').split(',')) : null;
const MAX = 25 * 1024, DOEL = 24 * 1024;
const uit = path.join(app, 'src', 'assets', 'portretten');

// id, soort en model; de alt-teksten en de keuze per voertuig staan in src/portretten.js
const T = (cabine, ev) => [{ id: `trekker-${cabine}-${ev ? 'elektrisch' : 'diesel'}`, spec: { soort: 'trekker', cabine, ev } }, { id: `trekker-${cabine}-${ev ? 'elektrisch' : 'diesel'}-oplegger`, spec: { soort: 'trekker', cabine, ev, oplegger: true } }];
const LIJST = [
  ...T('daf', false), ...T('scania', false), ...T('volvo', false), ...T('volvo', true), ...T('mercedes', false), ...T('mercedes', true), ...T('mercedes600', true),
  { id: 'bakwagen-daf-diesel', spec: { soort: 'bakwagen', cabine: 'daf' } },
  { id: 'bakwagen-mercedes-diesel', spec: { soort: 'bakwagen', cabine: 'mercedes' } },
  { id: 'bakwagen-mercedes-elektrisch', spec: { soort: 'bakwagen', cabine: 'mercedes', ev: true } },
  { id: 'bus-elektrisch', spec: { soort: 'bus' } },
  ...['koel', 'vries', 'droog', 'huif', 'city', 'silo', 'drank', 'lzv'].map(type => ({ id: `oplegger-${type}`, spec: { soort: 'oplegger', type } })),
].filter(x => !alleen || alleen.has(x.id));

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/examples/jsm/":"/node_modules/three/examples/jsm/"}}</script>
<style>html,body{margin:0;background:transparent}canvas{display:block}</style></head><body>
<canvas id="c" width="1280" height="800"></canvas>
<script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { paletteMaterial, paletteTextures, P } from '/src/scene3d/palette.js';
import { wheelGeometry, buildModels } from '/src/scene3d/vehicles.js';
import { portraitModel } from '/src/scene3d/varianten.js';
const W = 1280, H = 800, OW = 640, OH = 400;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const pmrem = new THREE.PMREMGenerator(renderer); const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const pal = paletteMaterial(); pal.emissiveIntensity = 0.4;   // dagrijverlichting, achterlichten en markeringen branden zacht
// ruiten in het portret: lichter en spiegelend, zodat ze de studio weerkaatsen (alleen in deze pagina; de wereld houdt zijn palet)
{ const t = paletteTextures(); const i = P.glas * 4; t.color.image.data.set([0x34, 0x45, 0x57, 255], i); t.rm.image.data.set([255, 13, 178, 255], i); t.color.needsUpdate = true; t.rm.needsUpdate = true; }
const wheelGeo = wheelGeometry(28); const models = buildModels();

// kenteken: geel met een zwarte rand, links de blauwe band met NL; letters in een eigen lijnletter
const G = {
  '0': [[[0.1,0],[0.5,0],[0.6,0.1],[0.6,0.9],[0.5,1],[0.1,1],[0,0.9],[0,0.1],[0.1,0]]],
  '1': [[[0.12,0.22],[0.36,0],[0.36,1]]],
  '2': [[[0,0.12],[0.1,0],[0.5,0],[0.6,0.12],[0.6,0.38],[0,1],[0.6,1]]],
  '3': [[[0,0.08],[0.08,0],[0.52,0],[0.6,0.1],[0.6,0.38],[0.5,0.47],[0.2,0.47]],[[0.5,0.47],[0.6,0.56],[0.6,0.9],[0.52,1],[0.08,1],[0,0.92]]],
  'S': [[[0.6,0.12],[0.5,0],[0.1,0],[0,0.12],[0,0.36],[0.1,0.46],[0.5,0.54],[0.6,0.64],[0.6,0.88],[0.5,1],[0.1,1],[0,0.88]]],
  'L': [[[0,0],[0,1],[0.58,1]]], 'C': [[[0.6,0.12],[0.5,0],[0.1,0],[0,0.12],[0,0.88],[0.1,1],[0.5,1],[0.6,0.88]]],
  'T': [[[0,0],[0.6,0]],[[0.3,0],[0.3,1]]], 'V': [[[0,0],[0.3,1],[0.6,0]]], 'N': [[[0,1],[0,0],[0.6,1],[0.6,0]]],
  'B': [[[0,0],[0,1],[0.48,1],[0.6,0.88],[0.6,0.6],[0.48,0.48],[0,0.48]],[[0,0],[0.44,0],[0.56,0.1],[0.56,0.36],[0.46,0.48]]],
  '-': [[[0.08,0.5],[0.42,0.5]]],
};
function letters(g, text, x, y, h, color, lw) {
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const ch of text) { const w = ch === '-' ? 0.5 : 0.6; for (const line of G[ch] || []) { g.beginPath(); line.forEach(([u, v], k) => k ? g.lineTo(x + u * h, y + v * h) : g.moveTo(x + u * h, y + v * h)); g.stroke(); } x += (w + 0.2) * h; }
  return x;
}
const widthOf = (text, h) => [...text].reduce((a, ch) => a + ((ch === '-' ? 0.5 : 0.6) + 0.2) * h, -0.2 * h);
function plateTexture(text) {
  const c = document.createElement('canvas'); c.width = 520; c.height = 112; const g = c.getContext('2d');
  g.fillStyle = '#1A1A1A'; g.beginPath(); g.roundRect(0, 0, 520, 112, 10); g.fill();
  g.fillStyle = '#F5C800'; g.beginPath(); g.roundRect(5, 5, 510, 102, 7); g.fill();
  g.fillStyle = '#0B3D91'; g.beginPath(); g.roundRect(5, 5, 54, 102, [7, 0, 0, 7]); g.fill();
  letters(g, 'NL', 13, 66, 30, '#FFFFFF', 5);
  const h = 66, tw = widthOf(text, h); letters(g, text, 59 + (456 - tw) / 2, 23, h, '#141414', 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const PLAAT = { trekker: 'SL-01-CT', bakwagen: 'SL-02-CB', bus: 'SL-03-CV' };
// zachte contactschaduw onder het voertuig (radiaal verloop in een textuur)
const contact = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 8, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,0.9)'); r.addColorStop(0.55, 'rgba(0,0,0,0.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();

const AZ = 38 * Math.PI / 180;                                   // driekwart van voren, links
const EYE = { trekker: 4.9, bakwagen: 4.5, bus: 3.25, oplegger: 5.0 };   // ooghoogte iets boven de cabine (m)
const sheet = [];
window.render = async (id, spec) => {
  const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xF2F6FB, 0x8E8A80, 0.85));
  const key = new THREE.DirectionalLight(0xFFF3E4, 2.5); key.position.set(-8, 15, -10); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); const sc = key.shadow.camera; sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 1; sc.far = 60; sc.updateProjectionMatrix();
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xDCE6FF, 0.65); fill.position.set(12, 6, -6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xFFFFFF, 0.9); rim.position.set(6, 10, 14); scene.add(rim);
  let geo, wheels, plate;
  if (spec.soort === 'bus') { const m = models.bus; geo = m.hi; wheels = m.wheels; plate = { x0: -0.26, x1: 0.26, y0: 0.42, y1: 0.52, z: -2.975 - 0.08 - 0.006 }; }
  else { const r = portraitModel(spec); geo = r.geometry; wheels = r.wheels; plate = r.plate; }
  const body = new THREE.Mesh(geo, pal); body.castShadow = true; body.receiveShadow = true; scene.add(body);
  const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
  for (const [x, z, r, w] of wheels) { const m = new THREE.Mesh(wheelGeo, pal); m.position.set(x, r, z); m.scale.set(w, r, r); m.rotation.y = x < 0 ? Math.PI : 0; m.castShadow = true; m.receiveShadow = true; scene.add(m); box.expandByPoint(new THREE.Vector3(x - w / 2, 0, z - r)); box.expandByPoint(new THREE.Vector3(x + w / 2, 2 * r, z + r)); }
  box.min.y = 0;
  if (plate) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(plate.x1 - plate.x0, plate.y1 - plate.y0), new THREE.MeshStandardMaterial({ map: plateTexture(PLAAT[spec.soort] || PLAAT.trekker), roughness: 0.45, metalness: 0 })); pm.position.set((plate.x0 + plate.x1) / 2, (plate.y0 + plate.y1) / 2, plate.z); pm.rotation.y = Math.PI; scene.add(pm); }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x1B2230, opacity: 0.3 })); ground.receiveShadow = true; scene.add(ground);
  const sx = box.max.x - box.min.x, sz = box.max.z - box.min.z;
  const cm = new THREE.Mesh(new THREE.PlaneGeometry(sx * 1.45, sz * 1.18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: contact, color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }));
  cm.position.set((box.min.x + box.max.x) / 2, 0.005, (box.min.z + box.max.z) / 2); cm.renderOrder = 1; scene.add(cm);
  // camera: vaste richting en ooghoogte, de afstand zo dat het voertuig het beeld vult; daarna gecentreerd
  const cam = new THREE.PerspectiveCamera(22, W / H, 0.5, 500);
  const target = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y * 0.42, (box.min.z + box.max.z) / 2);
  const corners = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const place = D => { cam.position.set(target.x - Math.sin(AZ) * D, EYE[spec.soort] || 4.9, target.z - Math.cos(AZ) * D); cam.lookAt(target); cam.updateMatrixWorld(); cam.clearViewOffset(); cam.updateProjectionMatrix(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const c of corners) { const p = c.clone().project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } return { x0, x1, y0, y1 }; };
  let lo = 4, hi = 300; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; const e = place(m); if ((e.x1 - e.x0) / 2 <= 0.9 && (e.y1 - e.y0) / 2 <= 0.84) hi = m; else lo = m; }
  const e = place(hi); cam.setViewOffset(W, H, ((e.x0 + e.x1) / 2) * W / 2, -((e.y0 + e.y1) / 2 - 0.03) * H / 2, W, H); cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const small = document.createElement('canvas'); small.width = OW; small.height = OH; const g = small.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(canvas, 0, 0, OW, OH);
  const enc = q => new Promise(r => small.toBlob(b => r(b), 'image/webp', q));
  let q = 0.9, blob = await enc(q); while (blob.size > ${DOEL} && q > 0.31) { q = Math.round((q - 0.04) * 100) / 100; blob = await enc(q); }
  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  // opruimen (alleen wat per portret nieuw is; palet, wielen en modellen blijven)
  scene.traverse(o => { if (o.isMesh && o !== body && o.geometry !== wheelGeo && o.geometry !== geo) o.geometry.dispose(); if (o.isMesh && o.material !== pal) { if (o.material.map && o.material.map !== contact) o.material.map.dispose(); o.material.dispose(); } });
  if (spec.soort !== 'bus') geo.dispose(); key.shadow.map && key.shadow.map.dispose();
  sheet.push({ id, small });
  return { b64: btoa(s), q, bytes: buf.length };
};
window.contactSheet = async (bg, fg) => {
  const cols = 4, tw = 400, th = 250, pad = 16, lab = 30; const rows = Math.ceil(sheet.length / cols);
  const c = document.createElement('canvas'); c.width = cols * (tw + pad) + pad; c.height = rows * (th + lab + pad) + pad; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.font = '15px sans-serif'; g.fillStyle = fg;
  sheet.forEach(({ id, small }, i) => { const x = pad + (i % cols) * (tw + pad), y = pad + Math.floor(i / cols) * (th + lab + pad); g.drawImage(small, x, y, tw, th); g.fillText(id, x + 4, y + th + 20); });
  const blob = await new Promise(r => c.toBlob(b => r(b), 'image/png')); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s);
};
window.klaar = true;
</script></body></html>`;

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html' };
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
const fouten = []; page.on('pageerror', e => fouten.push(String(e))); page.on('console', m => { if (m.type() === 'error') fouten.push(m.text()); });
await page.route('http://portret.local/**', async route => {
  const u = new URL(route.request().url());
  if (u.pathname === '/' || u.pathname === '/index.html') return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
  const f = path.join(app, decodeURIComponent(u.pathname)); const ok = (f.startsWith(path.join(app, 'src') + path.sep) || f.startsWith(path.join(app, 'node_modules', 'three') + path.sep)) && existsSync(f);
  return ok ? route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: readFileSync(f) }) : route.fulfill({ status: 404, body: 'niet gevonden' });
});
await page.goto('http://portret.local/');
await page.waitForFunction(() => window.klaar === true, null, { timeout: 60000 }).catch(() => {});
if (fouten.length) { console.error(fouten.join('\n')); await browser.close(); process.exit(1); }
mkdirSync(uit, { recursive: true });
let totaal = 0; const rijen = [];
for (const { id, spec } of LIJST) {
  const r = await page.evaluate(([id, spec]) => window.render(id, spec), [id, spec]);
  const buf = Buffer.from(r.b64, 'base64'); writeFileSync(path.join(uit, `${id}.webp`), buf); totaal += buf.length;
  rijen.push(`${id.padEnd(40)} ${String(buf.length).padStart(6)} bytes  kwaliteit ${r.q.toFixed(2)}${buf.length > MAX ? '  TE GROOT' : ''}`);
}
if (blad) {
  mkdirSync(blad, { recursive: true });
  writeFileSync(path.join(blad, 'portretten-licht.png'), Buffer.from(await page.evaluate(() => window.contactSheet('#F2F3F5', '#2A2F36')), 'base64'));
  writeFileSync(path.join(blad, 'portretten-donker.png'), Buffer.from(await page.evaluate(() => window.contactSheet('#16191E', '#D6DAE0')), 'base64'));
}
await browser.close();
for (const r of rijen) console.log(r);
console.log(`${rijen.length} portretten, samen ${(totaal / 1024).toFixed(1)} KB${fouten.length ? `; fouten: ${fouten.join(' | ')}` : ''}`);
if (fouten.length || rijen.some(r => r.includes('TE GROOT'))) process.exit(1);
