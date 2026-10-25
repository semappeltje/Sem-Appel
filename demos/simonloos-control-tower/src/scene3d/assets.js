// CC0-modellen van Kenney (assets-3d/, herkomst en bewerking in de README daar) voor de 3D-wereld: vier bomen en twee
// fabrieksdetails. Ze komen met ?url als data-URL in de three-bundel (geen los bestand, geen verzoek naar buiten; het
// opnieuw klaarzetten van een model: tools/build-assets.mjs) en worden hier één keer ontleed met GLTFLoader.
// Alles wordt gewone geometrie in meters: na het kwantiseren staat de terugschaling in de node, dus matrixWorld gaat
// erin. De bomen tekent de wereld als InstancedMesh met de eigen materialen (tint per exemplaar, kroon onderin
// donkerder); lukt het laden niet, dan blijven de procedurele bomen uit nature.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TREE_SIZE } from './nature.js';
import treeDefaultUrl from '../../assets-3d/kenney-nature-kit/tree_default.glb?url';
import treeOakUrl from '../../assets-3d/kenney-nature-kit/tree_oak.glb?url';
import treeTallUrl from '../../assets-3d/kenney-nature-kit/tree_tall.glb?url';
import treePineUrl from '../../assets-3d/kenney-nature-kit/tree_pineTallA.glb?url';
import tankUrl from '../../assets-3d/kenney-city-kit-industrial/detail-tank.glb?url';
import chimneyUrl from '../../assets-3d/kenney-city-kit-industrial/chimney-large.glb?url';

// data-URL rechtstreeks naar bytes (geen fetch: werkt ook onder een strenge connect-src); anders gewoon laden (dev-server)
function bytesOf(url) {
  if (!url.startsWith('data:')) return null; const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out.buffer;
}
const load = (loader, url) => { const buf = bytesOf(url); return buf ? loader.parseAsync(buf, '') : loader.loadAsync(url); };
// een attribuut als float32 (gekwantiseerde int16/int8 met normalized: getX geeft de echte waarde)
function toFloat(a, n) { const out = new Float32Array(a.count * n); for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = a.getComponent(i, k); return new THREE.BufferAttribute(out, n); }
function bake(mesh) {
  const s = mesh.geometry; const g = new THREE.BufferGeometry();
  g.setAttribute('position', toFloat(s.attributes.position, 3));
  if (s.attributes.normal) g.setAttribute('normal', toFloat(s.attributes.normal, 3));
  if (s.attributes.uv) g.setAttribute('uv', toFloat(s.attributes.uv, 2));
  if (s.index) g.setIndex(s.index.clone());
  g.applyMatrix4(mesh.matrixWorld); if (!s.attributes.normal) g.computeVertexNormals();
  return g.index ? g.toNonIndexed() : g;
}
const boxOf = g => new THREE.Box3().setFromBufferAttribute(g.attributes.position);
// kroon en stam van een Kenney-boom: voet van de stam op (0, 0, 0), hoogte H en kroonbreedte W in meters; de kroon krijgt
// een kleurverloop (onderin donkerder, zoals in de schaduw van het eigen blad), de tint komt per exemplaar
function tree(gltf, H, W) {
  gltf.scene.updateMatrixWorld(true); const crown = [], trunk = [];
  gltf.scene.traverse(o => { if (!o.isMesh) return; const n = (o.material && o.material.name) || ''; if (/leaf/i.test(n)) crown.push(bake(o)); else if (/wood|bark/i.test(n)) trunk.push(bake(o)); });
  if (!crown.length || !trunk.length) return null;
  const c = crown.length > 1 ? mergeGeometries(crown) : crown[0], t = trunk.length > 1 ? mergeGeometries(trunk) : trunk[0];
  const all = boxOf(c).union(boxOf(t)), cb = boxOf(c), tb = boxOf(t);
  const sy = H / (all.max.y - all.min.y), sxz = W / Math.max(cb.max.x - cb.min.x, cb.max.z - cb.min.z);
  const ox = (tb.min.x + tb.max.x) / 2, oz = (tb.min.z + tb.max.z) / 2;
  for (const g of [c, t]) { g.translate(-ox, -all.min.y, -oz); g.scale(sxz, sy, sxz); g.deleteAttribute('uv'); }
  const p = c.attributes.position; const col = new Float32Array(p.count * 3); const y0 = cb.min.y * sy - all.min.y * sy, y1 = cb.max.y * sy - all.min.y * sy;
  for (let i = 0; i < p.count; i++) { const k = (p.getY(i) - y0) / Math.max(0.01, y1 - y0); const f = 0.7 + 0.3 * Math.min(1, k * 1.25); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f; }
  c.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const g of [c, t]) { g.computeBoundingSphere(); g.computeBoundingBox(); }
  return { crown: c, trunk: t };
}
// een los model (tank, schoorsteen) met zijn eigen textuur, op de grond gezet en naar een lengte in meters geschaald
function piece(gltf, size, axis) {
  gltf.scene.updateMatrixWorld(true); const parts = []; let map = null;
  gltf.scene.traverse(o => { if (!o.isMesh) return; parts.push(bake(o)); if (!map && o.material && o.material.map) map = o.material.map; });
  if (!parts.length) return null; const g = parts.length > 1 ? mergeGeometries(parts) : parts[0];
  const b = boxOf(g); const len = axis === 'y' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z); const s = size / len;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(s, s, s); g.computeBoundingSphere(); g.computeBoundingBox();
  if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; map.needsUpdate = true; }
  return { geometry: g, map };
}

// Laadt alles; geeft { trees: { loof, eik, populier, conifeer }, tank, chimney, ms } (wat niet lukt is null)
// De bomen (zonder textuur, snel) en de fabrieksdetails (met textuur) laden apart, zodat de bomen niet op het uitpakken
// van een afbeelding wachten.
export async function loadTrees() {
  const t0 = performance.now(); const loader = new GLTFLoader();
  const get = url => load(loader, url).catch(err => { console.warn('3D-model niet geladen', err); return null; });
  const [d, o, t, p] = await Promise.all([treeDefaultUrl, treeOakUrl, treeTallUrl, treePineUrl].map(get));
  // maten van volgroeide bomen langs Nederlandse wegen en erven: linde of es 11 m, eik 13 m breed uitgegroeid,
  // populier 22 m smal, den of spar 14 m
  const S = TREE_SIZE; const trees = { loof: d && tree(d, ...S.loof), eik: o && tree(o, ...S.eik), populier: t && tree(t, ...S.populier), conifeer: p && tree(p, ...S.conifer) };
  return { trees, ms: Math.round(performance.now() - t0) };
}
export async function loadPieces() {
  const t0 = performance.now(); const loader = new GLTFLoader();
  const get = url => load(loader, url).catch(err => { console.warn('3D-model niet geladen', err); return null; });
  const [tk, ch] = await Promise.all([tankUrl, chimneyUrl].map(get));
  return { tank: tk && piece(tk, 12, 'x'), chimney: ch && piece(ch, 30, 'y'), ms: Math.round(performance.now() - t0) };
}
