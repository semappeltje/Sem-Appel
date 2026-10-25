// Voertuigen van Simon Loos, procedureel en op ware grootte (meters), neus naar het noorden (−z), midden in de oorsprong:
// trekker met oplegger (16,5 m, 4 m hoog), trekker solo met zichtbare koppelschotel, bakwagen (9,75 m) en elektrische
// bestelbus (5,95 m), plus de losse oplegger op zijn steunpoten. Drie detailniveaus: dichtbij alles (ruiten, spiegels,
// grille, koplampen, zonneklep, achterdeuren met scharnieren en sluitstangen, onderrijbeveiliging, steunpoten, wielen die
// apart draaien), middenafstand de vorm met ruiten en wielen, veraf alleen de blokken in de juiste kleuren.
import * as THREE from 'three';
import { P, box, span, cyl, profile, merge, panel, paint } from './palette.js';

// ---------- maten ----------
const CAB_W = 2.5;            // breedte cabine
const TR_W = 2.6;             // breedte koeloplegger
const TR_L = 13.6;            // lengte oplegger
const TR_FLOOR = 1.2, TR_TOP = 4.0;

// ---------- trekker (lokaal: neus op z = 0, naar achteren +z) ----------
function tractorParts(detail, spoiler) {
  const p = [];
  // cabine: zijprofiel met een licht hellende voorruit, over de breedte uitgetrokken met afgeronde randen
  p.push(profile([[0.02, 1.05], [0.0, 2.0], [0.12, 3.06], [0.32, 3.22], [2.3, 3.22], [2.3, 1.05]], CAB_W, P.rood, detail ? 0.07 : 0));
  if (spoiler) p.push(profile([[0.55, 3.2], [2.22, 3.94], [2.3, 3.94], [2.3, 3.2]], 2.36, P.rood, detail ? 0.04 : 0));
  // voorruit (schuin), zonneklep, zijruiten
  const tilt = Math.atan2(0.115, 0.95);
  p.push(panel(2.2, 0.95, 0.04, 0, 2.53, 0.048, tilt, P.glas));
  if (detail) {
    p.push(span(-1.18, 3.02, -0.14, 1.18, 3.1, 0.22, P.klep));
    for (const s of [-1, 1]) p.push(span(s * 1.245, 2.06, 0.28, s * 1.262, 2.88, 1.42, P.glas));
    // grille met drie lamellen, bumper, koplampen, kenteken
    p.push(span(-0.82, 1.12, -0.03, 0.82, 1.86, 0.02, P.grille));
    for (const y of [1.3, 1.5, 1.7]) p.push(span(-0.78, y - 0.025, -0.05, 0.78, y + 0.025, -0.02, P.staal));
    p.push(span(-1.25, 0.36, -0.08, 1.25, 0.95, 0.32, P.inkt));
    for (const s of [-1, 1]) p.push(span(s * 0.78, 0.7, -0.1, s * 1.16, 0.9, -0.07, P.koplamp));
    p.push(span(-0.26, 0.48, -0.1, 0.26, 0.59, -0.08, P.kenteken));
    // spiegels: arm en spiegelkop aan beide kanten
    for (const s of [-1, 1]) { p.push(span(s * 1.24, 2.7, 0.12, s * 1.6, 2.75, 0.18, P.inkt)); p.push(span(s * 1.56, 2.2, 0.05, s * 1.68, 2.82, 0.32, P.inkt)); }
    // treden onder de deur, oranje markeringen op het dak
    for (const s of [-1, 1]) p.push(span(s * 1.06, 0.38, 0.4, s * 1.24, 1.02, 1.3, P.inkt));
    if (spoiler) for (const s of [-1, 1]) p.push(span(s * 1.02, 3.93, 2.18, s * 1.14, 3.99, 2.26, P.oranje));
  } else {
    p.push(span(-1.25, 0.36, -0.08, 1.25, 0.95, 0.32, P.inkt));
    for (const s of [-1, 1]) p.push(span(s * 0.78, 0.7, -0.1, s * 1.16, 0.9, -0.07, P.koplamp));
  }
  // chassis: twee langsliggers, tank rechts, accubak links, spatborden boven de aandrijfas
  p.push(span(-0.5, 0.72, 0.3, 0.5, 1.06, 5.85, P.chassis));
  if (detail) {
    const tank = cyl(0.33, 0.33, 1.5, 10, P.staal); tank.rotateX(Math.PI / 2); tank.translate(0.92, 0.8, 2.92); p.push(tank);
    p.push(span(-1.18, 0.5, 2.2, -0.62, 1.05, 3.5, P.inkt));
    for (const s of [-1, 1]) { p.push(span(s * 0.62, 1.12, 4.2, s * 1.26, 1.18, 5.62, P.inkt)); p.push(span(s * 0.62, 0.42, 5.6, s * 1.26, 1.14, 5.64, P.rubber)); }
    for (const s of [-1, 1]) p.push(span(s * 0.72, 0.82, 5.82, s * 1.1, 0.98, 5.88, P.achterlicht));
  }
  return p;
}
// koppelschotel (zichtbaar bij de trekker solo): plaat met een V-sleuf naar achteren
function fifthWheel() {
  const s = new THREE.Shape(); const R = 0.46; const a0 = Math.PI / 2 + 0.32, a1 = Math.PI / 2 + 2 * Math.PI - 0.32;
  s.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
  for (let k = 1; k <= 16; k++) { const a = a0 + (a1 - a0) * k / 16; s.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
  s.lineTo(0, 0.05);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(Math.PI / 2); g.translate(0, 1.24, 4.55);
  return [paint(g, P.velgDonker), span(-0.55, 1.06, 4.05, 0.55, 1.14, 5.05, P.chassis)];
}

// ---------- oplegger (lokaal: voorkant op z = 0, naar achteren +z); legY: hoogte van de voetjes van de steunpoten ----------
function trailerParts(detail, legY, reefer = true) {
  const p = []; const hw = TR_W / 2, L = TR_L;
  p.push(span(-hw, TR_FLOOR, 0, hw, TR_TOP, L, P.wit));
  // rode band onderaan rondom, dunne logo-strook zonder letters, onderrand
  for (const s of [-1, 1]) p.push(span(s * hw, TR_FLOOR + 0.04, 0.08, s * (hw + 0.012), TR_FLOOR + 0.36, L - 0.08, P.band));
  p.push(span(-hw, TR_FLOOR + 0.04, -0.012, hw, TR_FLOOR + 0.36, 0, P.band));
  p.push(span(-hw + 0.05, TR_FLOOR - 0.1, 0, hw - 0.05, TR_FLOOR, L, P.inkt));
  if (detail) {
    for (const s of [-1, 1]) { p.push(span(s * hw, 3.36, 1.1, s * (hw + 0.012), 3.47, 8.4, P.band)); p.push(span(s * hw, 3.12, 0.55, s * (hw + 0.012), 3.47, 0.98, P.band)); }
    // hoekprofielen en dakranden in aluminium
    for (const sx of [-1, 1]) for (const z of [0.03, L - 0.03]) p.push(span(sx * (hw - 0.05), TR_FLOOR, z - 0.035, sx * (hw + 0.016), TR_TOP, z + 0.035, P.grijsLicht));
    for (const sx of [-1, 1]) p.push(span(sx * (hw - 0.04), TR_TOP - 0.06, 0, sx * (hw + 0.014), TR_TOP + 0.01, L, P.grijsLicht));
    // zijmarkeringslichten
    for (const z of [2.2, 5.0, 7.8, 10.6]) for (const s of [-1, 1]) p.push(span(s * hw, 1.1, z - 0.04, s * (hw + 0.03), 1.18, z + 0.04, P.oranje));
  }
  // koelmachine op de voorkant
  if (reefer) {
    p.push(span(-1.0, 2.42, -0.42, 1.0, 3.82, 0, P.koel));
    if (detail) for (const y of [2.82, 3.28]) p.push(span(-0.78, y - 0.06, -0.43, 0.78, y + 0.06, -0.41, P.grille));
  }
  // achterkant: twee deuren met naad, scharnieren, sluitstangen met handgrepen, lichtbalk, kenteken
  if (detail) {
    for (const s of [-1, 1]) p.push(span(s * 0.013, TR_FLOOR + 0.07, L, s * (hw - 0.07), TR_TOP - 0.07, L + 0.025, P.deur));
    p.push(span(-0.013, TR_FLOOR + 0.07, L, 0.013, TR_TOP - 0.07, L + 0.03, P.inkt));
    for (const s of [-1, 1]) for (const y of [1.55, 2.25, 2.95, 3.65]) p.push(span(s * (hw - 0.12), y - 0.06, L + 0.02, s * (hw + 0.005), y + 0.06, L + 0.07, P.staal));
    for (const x of [-0.92, -0.32, 0.32, 0.92]) { p.push(span(x - 0.02, TR_FLOOR + 0.12, L + 0.025, x + 0.02, TR_TOP - 0.12, L + 0.065, P.staal)); p.push(span(x - 0.035, 2.0, L + 0.06, x + 0.035, 2.2, L + 0.1, P.staal)); }
  } else {
    p.push(span(-hw + 0.07, TR_FLOOR + 0.07, L, hw - 0.07, TR_TOP - 0.07, L + 0.02, P.deur));
  }
  p.push(span(-1.25, 0.94, L - 0.14, 1.25, 1.1, L - 0.02, P.inkt));
  for (const s of [-1, 1]) p.push(span(s * 0.78, 0.95, L - 0.02, s * 1.2, 1.08, L + 0.01, P.achterlicht));
  if (detail) p.push(span(-0.26, 0.92, L - 0.03, 0.26, 1.03, L, P.kenteken));
  // onderrijbeveiliging achter en opzij, chassis, spatborden, steunpoten
  p.push(span(-1.18, 0.42, L - 0.42, 1.18, 0.58, L - 0.26, P.chassis));
  if (detail) {
    for (const s of [-1, 1]) p.push(span(s * 0.7, 0.55, L - 0.4, s * 0.8, 0.98, L - 0.3, P.chassis));
    for (const y of [0.56, 0.86]) for (const s of [-1, 1]) p.push(span(s * 1.2, y - 0.05, 3.8, s * 1.26, y + 0.05, 8.75, P.staal));
  }
  p.push(span(-0.55, 0.86, 0.5, 0.55, TR_FLOOR - 0.1, 12.7, P.chassis));
  for (const s of [-1, 1]) { p.push(span(s * 0.72, 1.02, 8.75, s * 1.3, 1.1, 12.65, P.inkt)); if (detail) { p.push(span(s * 0.72, 0.52, 8.73, s * 1.3, 1.06, 8.77, P.rubber)); p.push(span(s * 0.72, 0.4, 12.62, s * 1.3, 1.06, 12.66, P.rubber)); } }
  for (const s of [-1, 1]) { p.push(span(s * 0.88, legY + 0.04, 3.28, s * 1.02, TR_FLOOR - 0.1, 3.42, detail ? P.staal : P.chassis)); if (detail) p.push(span(s * 0.8, legY, 3.21, s * 1.1, legY + 0.06, 3.49, P.chassis)); }
  if (detail) p.push(span(-0.88, (legY + TR_FLOOR) / 2 - 0.03, 3.32, 0.88, (legY + TR_FLOOR) / 2 + 0.03, 3.38, P.staal));
  return p;
}
const TR_AXLES = [9.38, 10.69, 12.0];

// ---------- bakwagen (lokaal: neus op z = 0) ----------
function rigidParts(detail) {
  const p = [];
  p.push(profile([[0.02, 1.0], [0.0, 1.9], [0.12, 2.86], [0.3, 3.02], [1.95, 3.02], [1.95, 1.0]], 2.45, P.rood, detail ? 0.07 : 0));
  p.push(profile([[0.55, 3.0], [1.9, 3.5], [1.95, 3.5], [1.95, 3.0]], 2.3, P.rood, detail ? 0.03 : 0));
  p.push(panel(2.15, 0.9, 0.04, 0, 2.38, 0.05, Math.atan2(0.115, 0.92), P.glas));
  p.push(span(-1.225, 0.36, -0.08, 1.225, 0.92, 0.3, P.inkt));
  for (const s of [-1, 1]) p.push(span(s * 0.76, 0.68, -0.1, s * 1.13, 0.87, -0.07, P.koplamp));
  const bz0 = 2.12, bz1 = 9.75, top = 3.62, fl = 1.16, hw = 1.275;
  p.push(span(-hw, fl, bz0, hw, top, bz1, P.wit));
  for (const s of [-1, 1]) p.push(span(s * hw, fl + 0.04, bz0 + 0.06, s * (hw + 0.012), fl + 0.32, bz1 - 0.06, P.band));
  p.push(span(-1.2, 0.72, 0.3, 1.2, fl, bz1 - 0.1, P.chassis));
  if (detail) {
    for (const s of [-1, 1]) { p.push(span(s * hw, 3.08, 2.9, s * (hw + 0.012), 3.17, 7.6, P.band)); p.push(span(s * 1.22, 2.06, 0.26, s * 1.24, 2.82, 1.3, P.glas)); }
    p.push(span(-1.1, 2.9, -0.13, 1.1, 2.97, 0.2, P.klep));
    p.push(span(-0.78, 1.08, -0.03, 0.78, 1.76, 0.02, P.grille));
    for (const s of [-1, 1]) { p.push(span(s * 1.2, 2.6, 0.12, s * 1.55, 2.65, 0.18, P.inkt)); p.push(span(s * 1.5, 2.12, 0.05, s * 1.62, 2.72, 0.3, P.inkt)); p.push(span(s * 1.04, 0.38, 0.35, s * 1.22, 0.98, 1.2, P.inkt)); }
    // rolluik met groeven, laadklep onder de achterkant
    p.push(span(-1.18, fl + 0.08, bz1, 1.18, top - 0.1, bz1 + 0.025, P.deur));
    for (let y = fl + 0.35; y < top - 0.2; y += 0.34) p.push(span(-1.17, y - 0.012, bz1 + 0.02, 1.17, y + 0.012, bz1 + 0.04, P.dockdeurLijn));
    p.push(span(-1.18, 0.78, bz1 - 0.55, 1.18, 0.92, bz1 + 0.02, P.staal));
    const tank = cyl(0.3, 0.3, 1.3, 10, P.staal); tank.rotateX(Math.PI / 2); tank.translate(0.9, 0.78, 3.4); p.push(tank);
    for (const y of [0.55, 0.85]) for (const s of [-1, 1]) p.push(span(s * 1.2, y - 0.05, 4.2, s * 1.26, y + 0.05, 6.2, P.staal));
    p.push(span(-0.26, 0.6, bz1 - 0.04, 0.26, 0.71, bz1 - 0.01, P.kenteken));
  } else {
    p.push(span(-1.18, fl + 0.08, bz1, 1.18, top - 0.1, bz1 + 0.02, P.deur));
  }
  for (const s of [-1, 1]) { p.push(span(s * 0.72, 1.0, 6.3, s * 1.26, 1.08, 7.8, P.inkt)); p.push(span(s * 0.76, 0.66, bz1 - 0.04, s * 1.18, 0.8, bz1 + 0.01, P.achterlicht)); }
  p.push(span(-1.12, 0.4, bz1 - 0.35, 1.12, 0.55, bz1 - 0.2, P.chassis));
  return p;
}
const RIGID_AXLES = [1.25, 7.05];

// ---------- elektrische bestelbus (lokaal: neus op z = 0) ----------
function vanParts(detail) {
  const p = [];
  p.push(profile([[0.0, 0.44], [0.0, 0.8], [0.42, 1.05], [0.86, 1.17], [1.55, 2.32], [1.86, 2.6], [5.95, 2.6], [5.95, 0.46]], 2.02, P.wit, detail ? 0.1 : 0));
  const tilt = Math.atan2(0.69, 1.15);
  p.push(panel(1.78, 1.32, 0.04, 0, 1.745, 1.2, tilt, P.glas));
  p.push(span(-1.0, 0.36, -0.06, 1.0, 0.66, 0.42, P.inkt));
  p.push(span(-1.0, 0.36, 5.6, 1.0, 0.62, 6.0, P.inkt));
  for (const s of [-1, 1]) { p.push(span(s * 0.98, 0.36, 0.6, s * 1.015, 0.6, 5.4, P.inkt)); p.push(span(s * 1.0, 0.86, 0.5, s * 1.016, 1.02, 5.85, P.band)); }
  for (const s of [-1, 1]) p.push(span(s * 0.62, 0.88, 0.2, s * 0.92, 1.02, 0.3, P.koplamp));
  for (const s of [-1, 1]) p.push(span(s * 0.84, 0.82, 5.93, s * 0.98, 1.56, 5.98, P.achterlicht));
  if (detail) {
    for (const s of [-1, 1]) { p.push(span(s * 1.0, 1.42, 1.62, s * 1.018, 2.22, 2.42, P.glas)); p.push(span(s * 1.0, 1.75, 1.15, s * 1.15, 1.95, 1.3, P.inkt)); }
    for (const s of [-1, 1]) p.push(span(s * 0.1, 1.55, 5.94, s * 0.82, 2.3, 5.99, P.glas));
    p.push(span(-0.012, 0.5, 5.94, 0.012, 2.52, 6.0, P.inkt));
    p.push(span(-0.26, 0.42, -0.08, 0.26, 0.52, -0.06, P.kenteken));
    p.push(span(-0.26, 0.66, 5.99, 0.26, 0.76, 6.01, P.kenteken));
    p.push(span(-0.5, 0.72, 0.36, 0.5, 0.86, 0.52, P.grille));
  }
  return p;
}
const VAN_AXLES = [1.0, 4.665];

// ---------- wielen ----------
// Een wiel ligt met zijn as langs x, de velg aan de +x-kant: band, velg met vijf spaken (zodat je het draaien ziet) en naaf.
export function wheelGeometry(seg = 16) {
  const parts = [];
  const tire = new THREE.CylinderGeometry(1, 1, 1, seg, 1, true); tire.rotateZ(Math.PI / 2); parts.push(paint(tire, P.band_));
  // zijkant buiten: ring band, velg in tien taartpunten (licht en donker om en om), naaf
  const disc = (r0, r1, x, a0, a1, i) => { const pos = []; const n = Math.max(2, Math.round(seg * (a1 - a0) / (2 * Math.PI))); for (let k = 0; k < n; k++) { const t0 = a0 + (a1 - a0) * k / n, t1 = a0 + (a1 - a0) * (k + 1) / n; const P0 = [x, Math.cos(t0) * r0, Math.sin(t0) * r0], P1 = [x, Math.cos(t0) * r1, Math.sin(t0) * r1], P2 = [x, Math.cos(t1) * r1, Math.sin(t1) * r1], P3 = [x, Math.cos(t1) * r0, Math.sin(t1) * r0]; pos.push(...P0, ...P1, ...P2, ...P0, ...P2, ...P3); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
  const facing = (g, sign) => { const n = g.attributes.normal; for (let k = 0; k < n.count; k++) n.setXYZ(k, sign, 0, 0); return g; };
  // driehoeken moeten naar buiten wijzen: draai ze om waar de normaal de verkeerde kant op staat
  const orient = (g, sign) => { const p = g.attributes.position.array; for (let k = 0; k < p.length; k += 9) { const ay = p[k + 1], az = p[k + 2]; const by = p[k + 4] - ay, bz = p[k + 5] - az, cy = p[k + 7] - ay, cz = p[k + 8] - az; const nx = by * cz - bz * cy; if (nx * sign < 0) { for (let c = 0; c < 3; c++) { const t = p[k + 3 + c]; p[k + 3 + c] = p[k + 6 + c]; p[k + 6 + c] = t; } } } g.attributes.position.needsUpdate = true; return facing(g, sign); };
  parts.push(paint(orient(disc(1, 0.74, 0.5, 0, Math.PI * 2), 1), P.band_));
  for (let k = 0; k < 10; k++) parts.push(paint(orient(disc(0.74, 0.22, 0.47, k * Math.PI / 5, (k + 1) * Math.PI / 5), 1), k % 2 ? P.velgDonker : P.velg));
  parts.push(paint(orient(disc(0.22, 0.0, 0.44, 0, Math.PI * 2), 1), P.staal));
  parts.push(paint(orient(disc(1, 0.0, -0.5, 0, Math.PI * 2), -1), P.band_));
  return merge(parts);
}
// statische wielen (middenafstand): een zeshoekige cilinder per wiel
function staticWheels(list, seg) {
  const p = [];
  for (const [x, z, r, w] of list) { const t = cyl(r, r, w, seg, P.band_); t.rotateZ(Math.PI / 2); t.translate(x, r, z); p.push(t); }
  return p;
}
const blockWheels = list => list.map(([x, z, r, w]) => span(x - w / 2, 0.06, z - r * 0.85, x + w / 2, r * 1.7, z + r * 0.85, P.band_));

// ---------- personenauto (geparkeerd bij kantoren en winkels): carrosserie in autoLak, de kleur komt per exemplaar ----------
export function carGeometry() {
  const p = [];
  p.push(profile([[0.0, 0.3], [0.0, 0.72], [0.25, 0.86], [1.1, 0.95], [1.75, 1.42], [3.35, 1.45], [4.05, 1.0], [4.4, 0.92], [4.4, 0.32]], 1.8, P.autoLak, 0.08));
  const tilt = Math.atan2(0.65, 0.47);
  p.push(panel(1.55, 0.78, 0.03, 0, 1.19, 1.46, tilt, P.glas));
  for (const s of [-1, 1]) p.push(span(s * 0.895, 1.0, 1.75, s * 0.91, 1.36, 3.3, P.glas));
  p.push(panel(1.5, 0.55, 0.03, 0, 1.22, 3.72, -Math.atan2(0.45, 0.7), P.glas));
  for (const s of [-1, 1]) { p.push(span(s * 0.55, 0.62, -0.02, s * 0.82, 0.74, 0.02, P.koplamp)); p.push(span(s * 0.55, 0.78, 4.38, s * 0.82, 0.9, 4.42, P.achterlicht)); }
  p.push(span(-0.9, 0.18, 0.15, 0.9, 0.36, 4.25, P.inkt));
  for (const [x, z] of [[-0.78, 0.85], [0.78, 0.85], [-0.78, 3.55], [0.78, 3.55]]) { const w = cyl(0.31, 0.31, 0.22, 8, P.band_); w.rotateZ(Math.PI / 2); w.translate(x, 0.31, z); p.push(w); }
  return merge(shift(p, -2.2));
}

// ---------- samenstellen ----------
const shift = (parts, dz) => parts.map(g => g.translate(0, 0, dz));
function wheelSet(axles, x, r, w, dz) { const out = []; for (const z of axles) for (const s of [-1, 1]) out.push([s * x, z + dz, r, w]); return out; }

// Per soort: de drie modellen, de wielen, het statuslampje, de omtrek (voor schaduw, rand en klik) en de lichten.
export function buildModels() {
  const M = {};
  // trekker met oplegger: neus op −8,25, kast tot +8,25
  {
    const TZ = -8.25, OZ = -5.35;
    const wheels = [...wheelSet([1.3], 1.04, 0.53, 0.32, TZ), ...wheelSet([4.9], 0.89, 0.53, 0.62, TZ), ...wheelSet(TR_AXLES, 1.07, 0.48, 0.36, OZ)];
    const hi = merge([...shift(tractorParts(true, true), TZ), ...shift(trailerParts(true, 0.32), OZ)]);
    const mid = merge([...shift(tractorParts(false, true), TZ), ...shift(trailerParts(false, 0.32), OZ), ...staticWheels(wheels, 6)]);
    const lo = merge([span(-1.25, 1.0, TZ, 1.25, 3.9, TZ + 2.3, P.rood), span(-1.3, TR_FLOOR, OZ, 1.3, TR_TOP, OZ + TR_L, P.wit), span(-1.3, TR_FLOOR + 0.04, OZ + 0.1, 1.31, TR_FLOOR + 0.42, OZ + TR_L - 0.1, P.band), span(-1.2, 0.1, TZ + 0.2, 1.2, 1.12, OZ + TR_L - 0.4, P.inkt)]);
    M.trekker = { hi, mid, lo, wheels, half: [1.3, 8.25], height: 4.0, lamp: [0, 3.97, -6.2], front: -8.25, rear: 8.25 };
  }
  // trekker solo: 5,85 m, koppelschotel zichtbaar
  {
    const TZ = -2.925;
    const wheels = [...wheelSet([1.3], 1.04, 0.53, 0.32, TZ), ...wheelSet([4.9], 0.89, 0.53, 0.62, TZ)];
    const hi = merge([...shift([...tractorParts(true, true), ...fifthWheel()], TZ)]);
    const mid = merge([...shift([...tractorParts(false, true), ...fifthWheel()], TZ), ...staticWheels(wheels, 6)]);
    const lo = merge([span(-1.25, 1.0, TZ, 1.25, 3.9, TZ + 2.3, P.rood), span(-0.6, 0.3, TZ + 2.3, 0.6, 1.2, -TZ, P.inkt), span(-1.2, 0.1, TZ + 0.2, 1.2, 1.0, TZ + 2.3, P.inkt)]);
    M.solo = { hi, mid, lo, wheels, half: [1.3, 2.95], height: 3.95, lamp: [0, 3.97, TZ + 2.05], front: TZ, rear: -TZ };
  }
  // bakwagen: 9,75 m
  {
    const TZ = -4.875;
    const wheels = [...wheelSet([RIGID_AXLES[0]], 1.0, 0.5, 0.3, TZ), ...wheelSet([RIGID_AXLES[1]], 0.87, 0.5, 0.58, TZ)];
    const hi = merge(shift(rigidParts(true), TZ));
    const mid = merge([...shift(rigidParts(false), TZ), ...staticWheels(wheels, 6)]);
    const lo = merge([span(-1.22, 1.0, TZ, 1.22, 3.45, TZ + 1.95, P.rood), span(-1.28, 1.16, TZ + 2.12, 1.28, 3.62, -TZ, P.wit), span(-1.29, 1.2, TZ + 2.2, 1.29, 1.48, -TZ - 0.1, P.band), span(-1.15, 0.1, TZ + 0.2, 1.15, 1.1, -TZ - 0.3, P.inkt)]);
    M.bakwagen = { hi, mid, lo, wheels, half: [1.3, 4.9], height: 3.62, lamp: [0, 3.68, TZ + 2.6], front: TZ, rear: -TZ };
  }
  // bestelbus: 5,95 m
  {
    const TZ = -2.975;
    const wheels = wheelSet(VAN_AXLES, 0.86, 0.36, 0.24, TZ);
    const hi = merge(shift(vanParts(true), TZ));
    const mid = merge([...shift(vanParts(false), TZ), ...staticWheels(wheels, 6)]);
    const lo = merge([profile([[0.0, 0.3], [0.0, 0.8], [0.86, 1.17], [1.55, 2.32], [1.86, 2.6], [5.95, 2.6], [5.95, 0.3]], 2.02, P.wit).translate(0, 0, TZ), span(-1.0, 0.86, TZ + 0.5, 1.012, 1.02, -TZ - 0.1, P.band)]);
    M.bus = { hi, mid, lo, wheels, half: [1.05, 3.0], height: 2.6, lamp: [0, 2.64, TZ + 2.3], front: TZ, rear: -TZ };
  }
  // losse oplegger op de steunpoten
  {
    const OZ = -6.8;
    const wheels = wheelSet(TR_AXLES, 1.07, 0.48, 0.36, OZ);
    const hi = merge(shift(trailerParts(true, 0.0), OZ));
    const mid = merge([...shift(trailerParts(false, 0.0), OZ), ...staticWheels(wheels, 6)]);
    const lo = merge([span(-1.3, TR_FLOOR, OZ, 1.3, TR_TOP, -OZ, P.wit), span(-1.31, TR_FLOOR + 0.04, OZ + 0.1, 1.31, TR_FLOOR + 0.42, -OZ - 0.1, P.band), ...blockWheels(wheels)]);
    M.oplegger = { hi, mid, lo, wheels, half: [1.32, 7.0], height: 4.0, lamp: [0, 4.06, OZ + 0.9], front: OZ, rear: -OZ };
  }
  return M;
}
