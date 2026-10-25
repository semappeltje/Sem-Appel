#!/usr/bin/env node
// Zet CC0-modellen klaar voor de 3D-wereld (assets-3d/): elk model dezelfde stappen, zodat een nieuw model niet anders
// uitvalt dan de rest.
//
//   npm install                                   # glTF-Transform staat in de devDependencies
//   node tools/build-assets.mjs <bronmap> [assets-3d] [--alleen kenney-nature-kit/tree_oak,...]
//
// <bronmap> heeft per pakket een map met de oorspronkelijke GLB's (met hun losse textuur ernaast) en License.txt, zoals
// Kenney ze uitlevert: <bronmap>/kenney-nature-kit/tree_oak.glb, .../License.txt. Welke modellen meegaan staat in
// SELECTIE hieronder; voeg een model daar toe.
//
// Stappen per model: inlezen (de losse textuur wordt ingebed), dubbele data samenvoegen (dedup), hoekpunten lassen
// (weld), ongebruikte data weg (prune), kwantiseren (KHR_mesh_quantization: posities 14 bit, normalen 10, UV 12) en
// alles in één buffer (unpartition). KHR_texture_transform gaat eruit als elke transformatie een identiteit is (bij
// Kenney altijd; anders blijft hij en zegt het script het), net als ongebruikte extensie-verklaringen. three.js leest
// het resultaat met GLTFLoader zonder extra decoder. Let op: na het kwantiseren staat de terugschaling in de node, niet
// in de geometrie; src/scene3d/assets.js bakt daarom matrixWorld in de geometrie.
//
// Daarna: het model in src/scene3d/assets.js importeren met ?url (dan komt het als data-URL in de three-bundel en
// blijft de bestandslijst van de sitebuild gelijk), npm run build:site, en kijken of alleen three.js gegroeid is.
// Licentie en herkomst horen in assets-3d/README.md; alleen CC0 (of een even ruime licentie zonder naamsvermelding).
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, unpartition } from '@gltf-transform/functions';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELECTIE = {
  'kenney-car-kit': ['delivery', 'van'],
  'kenney-nature-kit': ['tree_default', 'tree_oak', 'tree_detailed', 'tree_fat', 'tree_tall', 'tree_cone', 'tree_simple', 'tree_small', 'tree_pineTallA', 'tree_plateau'],
  'kenney-city-kit-industrial': ['building-e', 'building-h', 'building-i', 'building-k', 'building-m', 'building-p', 'building-q', 'building-s', 'detail-tank', 'chimney-large'],
};

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const flags = new Map(); const pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) flags.set(args[i].slice(2), args[i + 1]), i++; else pos.push(args[i]); }
const [bron, doel = path.join(app, 'assets-3d')] = pos;
if (!bron || !existsSync(bron)) { console.error('Gebruik: node tools/build-assets.mjs <bronmap met de oorspronkelijke modellen> [doelmap, standaard assets-3d] [--alleen pakket/model,...]'); process.exit(1); }
const alleen = flags.get('alleen') ? new Set(flags.get('alleen').split(',')) : null;

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const isIdentity = tt => { const o = tt.getOffset(), s = tt.getScale(); return o[0] === 0 && o[1] === 0 && s[0] === 1 && s[1] === 1 && tt.getRotation() === 0 && !tt.getTexCoord(); };
const rijen = []; let fouten = 0;
for (const [pakket, namen] of Object.entries(SELECTIE)) {
  for (const n of namen) {
    if (alleen && !alleen.has(`${pakket}/${n}`)) continue;
    const inp = path.join(bron, pakket, `${n}.glb`); const out = path.join(doel, pakket, `${n}.glb`);
    if (!existsSync(inp)) { console.error(`ontbreekt: ${inp}`); fouten++; continue; }
    mkdirSync(path.dirname(out), { recursive: true });
    const lic = path.join(bron, pakket, 'License.txt'); if (existsSync(lic)) copyFileSync(lic, path.join(doel, pakket, 'License.txt'));
    const doc = await io.read(inp);
    await doc.transform(dedup(), weld(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), unpartition());
    const root = doc.getRoot();
    const tt = root.listExtensionsUsed().find(e => e.extensionName === 'KHR_texture_transform');
    if (tt) {
      const alle = root.listMaterials().flatMap(m => [m.getBaseColorTextureInfo(), m.getNormalTextureInfo(), m.getEmissiveTextureInfo(), m.getOcclusionTextureInfo(), m.getMetallicRoughnessTextureInfo()]).filter(Boolean).map(i => i.getExtension('KHR_texture_transform')).filter(Boolean);
      if (alle.every(isIdentity)) tt.dispose(); else console.log(`${pakket}/${n}: textuurtransformatie is geen identiteit, blijft staan`);
    }
    const unlit = root.listExtensionsUsed().find(e => e.extensionName === 'KHR_materials_unlit');
    if (unlit && !root.listMaterials().some(m => m.getExtension('KHR_materials_unlit'))) unlit.dispose();
    await io.write(out, doc);
    let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const idx = p.getIndices(); tris += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
    rijen.push({ model: `${pakket}/${n}.glb`, inKB: statSync(inp).size / 1024, uitKB: statSync(out).size / 1024, tris, ext: root.listExtensionsUsed().map(e => e.extensionName).join(', ') });
  }
}
for (const r of rijen) console.log(`${r.model.padEnd(46)} ${r.inKB.toFixed(1).padStart(7)} KB -> ${r.uitKB.toFixed(1).padStart(6)} KB  ${String(r.tris).padStart(5)} driehoeken  ${r.ext}`);
if (fouten) { console.error(`${fouten} model(len) niet gevonden`); process.exit(1); }
