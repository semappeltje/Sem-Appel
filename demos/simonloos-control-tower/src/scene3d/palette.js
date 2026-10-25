// Kleurenpalet als textuur: elk onderdeel van een voertuig (of lantaarnpaal, slagboom, dock) verwijst met zijn UV naar
// één vakje van een smalle textuur met kleur, ruwheid, metaal en (voor de nacht) eigen licht. Zo tekent één materiaal
// een hele vloot in één keer, met glanzend rood, mat rubber, spiegelend glas en koplampen die 's nachts branden.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const N = 64;
// naam: [kleur (sRGB), ruwheid, metaal, eigen licht 's nachts of null]
const ENTRIES = {
  rood: [0xE3001F, 0.38, 0.0, null],          // Simon Loos-rood: cabine
  band: [0xD7001C, 0.45, 0.0, null],          // rode band en logo-strook op de kast
  inkt: [0x23272D, 0.72, 0.0, null],          // donkere onderkant: bumper, treden, spatborden
  glas: [0x1A2531, 0.08, 0.15, null],         // ruiten (spiegelen de lucht)
  glasNacht: [0x1A2531, 0.08, 0.15, 0x3A3324], // cabineruit met een vleugje binnenlicht 's nachts
  wit: [0xF3F4F5, 0.5, 0.0, null],            // kast van oplegger en bakwagen, bestelbus
  deur: [0xE1E4E8, 0.55, 0.0, null],          // achterdeuren
  chassis: [0x2D3137, 0.78, 0.15, null],
  band_: [0x17181B, 0.94, 0.0, null],         // rubber van de banden
  velg: [0xC9CED4, 0.32, 0.55, null],
  velgDonker: [0x7E848C, 0.42, 0.45, null],
  koplamp: [0xEEF2F6, 0.12, 0.2, 0xFFF1D2],
  achterlicht: [0xA0101B, 0.3, 0.0, 0xFF1F1F],
  oranje: [0xE09A12, 0.35, 0.0, 0xFFA21A],    // zijmarkeringslichten
  staal: [0xA4AAB2, 0.34, 0.6, null],         // scharnieren, sluitstangen, tank
  grille: [0x353A41, 0.55, 0.25, null],
  koel: [0xD4D8DD, 0.5, 0.1, null],           // koelmachine
  klep: [0x1A1E23, 0.55, 0.0, null],          // zonneklep
  rubber: [0x1D2024, 0.9, 0.0, null],         // dockafdichting, stootblokken, spatlappen
  kenteken: [0xF2C200, 0.4, 0.0, null],       // gele kentekenplaat
  paal: [0x8E959D, 0.4, 0.5, null],           // lantaarnpaal
  lamp: [0xE4E7EB, 0.3, 0.0, 0xFFE0A8],       // armatuur (brandt 's nachts)
  beton: [0xC8CBCF, 0.85, 0.0, null],
  dockdeur: [0xD0D5DB, 0.6, 0.1, null],
  dockdeurLijn: [0x9AA1A9, 0.6, 0.1, null],
  dockLamp: [0xD9DCE0, 0.3, 0.0, 0xFFD58A],
  kozijn: [0x3A3F47, 0.5, 0.2, null],
  hek: [0x5E656E, 0.5, 0.5, null],
  bord: [0xE3001F, 0.45, 0.0, null],
  witLijn: [0xF7F8F9, 0.6, 0.0, null],
  grijsLicht: [0xB9BEC5, 0.6, 0.0, null],
  dak: [0xBCC1C7, 0.9, 0.0, null],
  dakUnit: [0xA9AFB6, 0.55, 0.35, null],
  lichtstraat: [0xC9D6E0, 0.25, 0.1, null],
  // gevelband van een winkel: een kleur per formule (alleen een vlak, geen letters of logo)
  formBlauw: [0x0E8FD6, 0.45, 0.0, 0x0E8FD6],
  formGeel: [0xF5C400, 0.45, 0.0, 0xF5C400],
  formGroen: [0x2E8B3E, 0.45, 0.0, 0x2E8B3E],
  formDonkerblauw: [0x1D4E9E, 0.45, 0.0, 0x1D4E9E],
  formRood: [0xD7262E, 0.45, 0.0, 0xD7262E],
  formGrijs: [0x6B7380, 0.45, 0.0, 0x6B7380],
  luifel: [0xDDE1E5, 0.45, 0.2, null],
  dakrand: [0x8B929A, 0.6, 0.3, null],        // bovenkant van de borstwering (van boven een rand om het dak)
  autoLak: [0xFFFFFF, 0.3, 0.15, null],       // carrosserie van een auto (de kleur komt per exemplaar)
  winkelLicht: [0xE8EEF2, 0.2, 0.0, 0xFFF1D8],
};
export const P = {}; Object.keys(ENTRIES).forEach((k, i) => { P[k] = i; });

function dataTex(fn, srgb) {
  const d = new Uint8Array(N * 4);
  Object.values(ENTRIES).forEach((e, i) => { const [r, g, b] = fn(e); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, N, 1, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
const rgb = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
let shared = null;
export function paletteTextures() {
  if (shared) return shared;
  shared = {
    color: dataTex(e => rgb(e[0]), true),
    rm: dataTex(e => [255, Math.round(e[1] * 255), Math.round(e[2] * 255)], false),
    emissive: dataTex(e => e[3] == null ? [0, 0, 0] : rgb(e[3]), true),
  };
  return shared;
}
export function disposePalette() { if (!shared) return; for (const t of Object.values(shared)) t.dispose(); shared = null; }
export function paletteMaterial(extra) {
  const t = paletteTextures();
  return new THREE.MeshStandardMaterial({ map: t.color, roughnessMap: t.rm, metalnessMap: t.rm, roughness: 1, metalness: 1, emissiveMap: t.emissive, emissive: 0xFFFFFF, emissiveIntensity: 0, ...extra });
}

// ---------- bouwstenen met een palet-UV ----------
const U = i => (i + 0.5) / N;
export function paint(g, i) { const g2 = g.index ? g.toNonIndexed() : g; const n = g2.attributes.position.count; const uv = new Float32Array(n * 2); const u = U(i); for (let k = 0; k < n; k++) { uv[k * 2] = u; uv[k * 2 + 1] = 0.5; } g2.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); for (const name of Object.keys(g2.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g2.deleteAttribute(name); return g2; }
export const box = (w, h, d, x, y, z, i) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), i);
// doos tussen twee hoekpunten (makkelijker voor onderdelen die je in maten van een tekening opgeeft)
export const span = (x0, y0, z0, x1, y1, z1, i) => box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, i);
export const cyl = (r0, r1, h, seg, i) => paint(new THREE.CylinderGeometry(r0, r1, h, seg), i);
// zijprofiel [[z, y], ...] (neus naar −z) over de breedte w uitgetrokken, met afgeronde randen (afschuining b)
export function profile(pts, w, i, b = 0) {
  const s = new THREE.Shape(); pts.forEach(([z, y], k) => k ? s.lineTo(z, y) : s.moveTo(z, y));
  const depth = Math.max(0.01, w - 2 * b);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.9, bevelOffset: -b * 0.9, bevelSegments: b > 0 ? 2 : 1, curveSegments: 1 });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0);
  return paint(g, i);
}
export const merge = parts => { const g = mergeGeometries(parts, false); g.computeBoundingSphere(); g.computeBoundingBox(); return g; };
// een vlak paneel (ruit, streep) op een schuin vlak: midden, breedte, hoogte, dikte en kanteling om x
export function panel(w, h, t, x, y, z, tilt, i) { const g = new THREE.BoxGeometry(w, h, t); g.rotateX(tilt); g.translate(x, y, z); return paint(g, i); }
