// Bomen, hagen en huizen: laagpolygonaal maar met variatie. Drie boomsoorten (loofboom met een kroon uit drie bollen,
// conifeer uit gestapelde kegels, populier smal en hoog), elk in een paar tinten en hoogtes; woonhuizen met een
// zadeldak, baksteen of pleister en pannen in een paar kleuren.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const prep = g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const tint = (g, hex) => { const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
// facetten: elke driehoek zijn eigen normaal (laagpolygonaal), en een lichte schaduw onderin de kroon
function faceted(g, shadeBottom) {
  const p = g.attributes.position; const nrm = new Float32Array(p.count * 3); const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), E = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) { A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2); N.subVectors(B, A).cross(E.subVectors(C, A)).normalize(); for (let k = 0; k < 3; k++) nrm.set([N.x, N.y, N.z], (i + k) * 3); }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (shadeBottom && g.attributes.color) { const c = g.attributes.color; g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y; for (let i = 0; i < p.count; i++) { const t = (p.getY(i) - y0) / Math.max(0.01, y1 - y0); const f = 0.72 + 0.28 * Math.min(1, t * 1.3); c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f); } }
  return g;
}
// een bol met een vaste, licht onregelmatige vorm
function blob(r, x, y, z, detail, seed) {
  const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + 0.12 * Math.sin(p.getX(i) * 3.1 + seed) * Math.cos(p.getZ(i) * 2.7 + seed * 1.7); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.92, p.getZ(i) * k); }
  return g.translate(x, y, z);
}

// Kroon (getint per exemplaar) en stam apart, zodat de tint alleen het blad kleurt. Maten van volgroeide bomen, gelijk
// aan die van de CC0-modellen (assets.js), zodat de wissel naar meer detail bij inzoomen niet verspringt; per exemplaar
// geschaald (0,7 tot 1,3). Met kenney (de bomen uit loadAssets) komen die modellen in het volle detail.
export const TREE_SIZE = { loof: [11, 6.6], eik: [13, 10.5], populier: [22, 4.6], conifer: [14, 5.4] };
function fit(t, H, W) {
  const box = new THREE.Box3().setFromBufferAttribute(t.crown.attributes.position).union(new THREE.Box3().setFromBufferAttribute(t.trunk.attributes.position));
  const cb = new THREE.Box3().setFromBufferAttribute(t.crown.attributes.position);
  const sy = H / (box.max.y - box.min.y), sxz = W / Math.max(cb.max.x - cb.min.x, cb.max.z - cb.min.z);
  for (const g of [t.crown, t.trunk]) { g.translate(0, -box.min.y, 0); g.scale(sxz, sy, sxz); g.computeBoundingSphere(); }
  return t;
}
export function treeGeometries(detail, kenney) {
  const trunk = (h, r) => prep(new THREE.CylinderGeometry(r * 0.75, r, h, detail ? 6 : 4).translate(0, h / 2, 0));
  const crownCol = 0xFFFFFF;
  const loofCrown = () => detail
    ? mergeGeometries([blob(2.5, 0, 6.0, 0, 0, 1), blob(2.0, 1.5, 5.0, 0.8, 0, 2), blob(1.9, -1.3, 5.2, -0.9, 0, 3), blob(1.7, 0.3, 7.6, -0.4, 0, 4)].map(g => tint(prep(g), crownCol)))
    : tint(prep(blob(2.8, 0, 6.0, 0, 0, 1)), crownCol);
  const conifer = detail
    ? mergeGeometries([[2.6, 3.8, 3.6], [2.05, 3.2, 5.6], [1.4, 2.8, 7.5]].map(([r, h, y]) => tint(prep(new THREE.ConeGeometry(r, h, 7).translate(0, y, 0)), crownCol)))
    : tint(prep(new THREE.ConeGeometry(2.4, 7.4, 6).translate(0, 5.1, 0)), crownCol);
  const populier = detail
    ? mergeGeometries([blob(1.6, 0, 9.0, 0, 0, 5).scale(1, 2.7, 1).translate(0, -14.4, 0), blob(1.1, 0.2, 13.6, 0.1, 0, 6)].map(g => tint(prep(g), crownCol)))
    : tint(prep(blob(1.6, 0, 9.0, 0, 0, 5).scale(1, 2.7, 1).translate(0, -14.4, 0)), crownCol);
  const out = {
    loof: fit({ crown: faceted(loofCrown(), true), trunk: trunk(4.2, 0.26) }, ...TREE_SIZE.loof),
    eik: fit({ crown: faceted(loofCrown(), true), trunk: trunk(4.0, 0.32) }, ...TREE_SIZE.eik),
    conifer: fit({ crown: faceted(conifer, true), trunk: trunk(2.2, 0.22) }, ...TREE_SIZE.conifer),
    populier: fit({ crown: faceted(populier, true), trunk: trunk(5.0, 0.2) }, ...TREE_SIZE.populier),
  };
  // de Kenney-bomen (CC0) in het volle detail: linde, eik, populier en den
  if (detail && kenney) for (const [k, src] of [['loof', kenney.loof], ['eik', kenney.eik], ['populier', kenney.populier], ['conifer', kenney.conifeer]]) if (src) out[k] = src;
  for (const v of Object.values(out)) { v.crown.computeBoundingSphere(); v.trunk.computeBoundingSphere(); }
  return out;
}
export const TREE_TINTS = [0x5E9A55, 0x76AD5E, 0x4C8550, 0x8DB86A, 0x3F7449];
export const TRUNK = 0x6E5440;

// Woonhuis: een eenheidsblok (1 x 1 x 1, voet op y = 0) met gevels, en een eenheidszadeldak (nok langs x, van y 0 tot 1).
// Per exemplaar geschaald naar breedte, diepte en goothoogte; de kleur van muur en dak komt uit de instantie.
export function houseGeometries() {
  const body = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  // UV per zijde: de gevel herhaalt ongeveer om de 6 m bij een huis van 8 m breed en 5,6 m hoog
  const uv = body.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.35, uv.getY(i));
  const roof = new THREE.BufferGeometry();
  const v = [
    // twee dakvlakken (nok langs x op y = 1, goten op z = ±0,5)
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
    -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0, -0.5, 0, -0.5, 0.5, 1, 0, 0.5, 0, -0.5,
    // topgevels
    0.5, 0, -0.5, 0.5, 1, 0, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 1, 0, -0.5, 0, -0.5,
  ];
  const t = [0, 0, 2, 0, 2, 1, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 2, 1, 0, 0, 2, 1, 2, 0, 0, 0, 0.5, 1, 1, 0, 0, 0, 0.5, 1, 1, 0];
  roof.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); roof.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2)); roof.computeVertexNormals();
  // de topgevels krijgen de muurkleur niet (het dak is één tint); ze zijn klein en vallen weg onder de overstek
  return { body: prep(body), roof };
}
export const WALLS = [0x9A5A44, 0x8A4E3C, 0xB06A4E, 0xE9E3D6, 0xD8CDB8, 0xF2EFE8, 0x7C4A3A];
export const ROOFS = [0x3E4349, 0x4A4F56, 0x8B4A3A, 0xA0563F, 0x5A3D33, 0x2F3338];

// Haag: een blok met een iets lichtere bovenkant, per exemplaar geschaald naar de lengte van het stuk
export function hedgeGeometry() {
  const g = prep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const p = g.attributes.position; const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0.99; const base = new THREE.Color(top ? 0x6FA25C : 0x4E8749); c.set([base.r, base.g, base.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
