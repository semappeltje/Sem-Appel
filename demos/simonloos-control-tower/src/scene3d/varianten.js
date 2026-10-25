// Varianten van de voertuigen voor de portretten (tools/render-portretten.mjs, src/portretten.js). De trekker in vijf
// cabinevormen: DAF XF-, Scania R-, Volvo FH-, Mercedes Actros- en eActros 600-achtig. Zonder merktekens: het verschil
// zit in de vorm (dak, voorruit, grille, koplampen, zonneklep, spiegels of camera's). Diesel of elektrisch (accupakketten
// en een laadklep in plaats van de tank), solo of met een koeloplegger. De bakwagen in drie vormen, de bestelbus, en de
// oplegger per soort (koel, vries, droog, schuifzeil, city, silo, dranken, LZV op een dolly), los op de steunpoten.
// Zelfde maten, palet en opbouw als vehicles.js (meters, neus naar -z), alleen in het volle detail. De 3D-wereld zelf
// gebruikt deze varianten niet. De huisstijl (wit boven, rood onder, de goudgele band, het beeldmerk) komt uit vehicles.js.
import * as THREE from 'three';
import { P, span, cyl, profile, merge, panel, paint } from './palette.js';
import { fifthWheel, cabineLak, merkOpzij, merkVoor, sierstreep, bumperLak, tredenLak } from './vehicles.js';

const CAB_W = 2.5, TR_W = 2.6, TR_FLOOR = 1.2;
const shift = (parts, dz) => parts.map(g => g.translate(0, 0, dz));
// gedraaid blok: maten, midden en draaiing om x, y en z
function rbox(w, h, d, x, y, z, rx, ry, rz, i) { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return paint(g, i); }
const axleSet = (axles, x, r, w, dz = 0) => { const out = []; for (const z of axles) for (const s of [-1, 1]) out.push([s * x, z + dz, r, w]); return out; };

// ---------- cabines (lokaal: neus op z = 0, naar achteren +z) ----------
// zijprofiel [[z, y]], de lijn van de voorruit [z0, y0, z1, y1], de hoogte waar een dakspoiler begint (of geen), de
// bovenkant van de gele band aan de voorkant (yg), het beeldmerk boven de voorruit [midden, helling naar achteren] en de
// hoogte van de sierstreep op de zijkant
const opSpoiler = F => [[0, F + 0.4 * (3.94 - F), 0.55 + 0.4 * 1.67], Math.atan2(1.67, 3.94 - F)];
const CAB = {
  daf: { pts: [[0.02, 1.05], [0.0, 2.05], [0.2, 3.06], [0.52, 3.88], [0.9, 3.98], [2.3, 3.98], [2.3, 1.05]], ws: [0.0, 2.05, 0.2, 3.06], fairing: 0, yg: 1.98, merk: [[0, 3.5, 0.2 + 0.44 / 0.82 * 0.32], Math.atan2(0.32, 0.82)], streep: 3.62 },
  scania: { pts: [[0.02, 1.05], [0.0, 2.12], [0.14, 3.1], [0.34, 3.27], [2.3, 3.27], [2.3, 1.05]], ws: [0.0, 2.12, 0.14, 3.1], fairing: 3.27, yg: 1.98, merk: opSpoiler(3.27), streep: 3.06 },
  volvo: { pts: [[0.02, 1.05], [0.0, 2.02], [0.18, 3.16], [0.4, 3.32], [2.3, 3.32], [2.3, 1.05]], ws: [0.0, 2.02, 0.18, 3.16], fairing: 3.32, yg: 1.98, merk: opSpoiler(3.32), streep: 3.08 },
  mercedes: { pts: [[0.02, 1.05], [0.0, 2.0], [0.16, 3.08], [0.42, 3.26], [2.3, 3.26], [2.3, 1.05]], ws: [0.0, 2.0, 0.16, 3.08], fairing: 3.26, yg: 1.98, merk: opSpoiler(3.26), streep: 3.05 },
  mercedes600: { pts: [[0.32, 1.0], [0.1, 1.32], [0.03, 1.92], [0.34, 2.94], [0.86, 3.58], [1.42, 3.86], [2.35, 3.92], [2.35, 1.0]], ws: [0.03, 1.92, 0.34, 2.94], fairing: 0, yg: 1.93, merk: [[0, 3.26, 0.6], Math.atan2(0.52, 0.64)], streep: 3.45 },
};
function windscreen(p, ws, w) {
  const [z0, y0, z1, y1] = ws; const len = Math.hypot(z1 - z0, y1 - y0);
  p.push(panel(w, len * 0.9, 0.04, 0, (y0 + y1) / 2, (z0 + z1) / 2 - 0.012, Math.atan2(z1 - z0, y1 - y0), P.glas));
}
const mirrors = p => { for (const s of [-1, 1]) { p.push(span(s * 1.24, 2.7, 0.12, s * 1.6, 2.75, 0.18, P.inkt)); p.push(span(s * 1.56, 2.2, 0.05, s * 1.68, 2.82, 0.32, P.inkt)); } };
// camera's in plaats van spiegels (Mercedes): korte armen boven aan de cabine
const cameras = (p, z = 0.18) => { for (const s of [-1, 1]) { p.push(span(s * 1.22, 2.96, z, s * 1.46, 3.02, z + 0.08, P.inkt)); p.push(span(s * 1.42, 2.9, z - 0.06, s * 1.53, 3.05, z + 0.12, P.inkt)); } };
const bumper = (p, z0 = -0.08) => p.push(...bumperLak(1.25, z0, 0.97));

function frontDaf(p) {
  // grote grille onder de band, met vier chromen lamellen en een chromen rand, smalle koplampen in de hoeken; de
  // zonneklep wit, zoals het dak
  p.push(span(-0.94, 1.1, -0.04, 0.94, 1.69, 0.01, P.grille));
  p.push(span(-0.98, 1.67, -0.055, 0.98, 1.72, -0.02, P.chroom));
  for (const s of [-1, 1]) p.push(span(s * 0.94, 1.1, -0.055, s * 0.98, 1.71, -0.02, P.chroom));
  for (const y of [1.2, 1.32, 1.44, 1.56]) p.push(span(-0.9, y - 0.028, -0.06, 0.9, y + 0.028, -0.03, P.chroom));
  for (const s of [-1, 1]) { p.push(span(s * 0.99, 0.98, -0.085, s * 1.23, 1.13, -0.03, P.koplamp)); p.push(span(s * 1.0, 1.135, -0.075, s * 1.22, 1.165, -0.04, P.koplamp)); }
  for (const s of [-1, 1]) p.push(span(s * 0.82, 0.5, -0.095, s * 1.02, 0.6, -0.07, P.koplamp));
  p.push(span(-1.22, 3.0, -0.2, 1.22, 3.09, 0.3, P.cabineWit));
}
function frontScania(p) {
  // grille in twee delen met een chromen balk ertussen (zonder naam of embleem) onder de band, koplampen in de bumper,
  // zonneklep wit, zoals het dak, met vier oranje lampen
  p.push(span(-1.0, 1.47, -0.04, 1.0, 1.72, 0.01, P.grille));
  for (const y of [1.54, 1.61, 1.68]) p.push(span(-0.96, y - 0.018, -0.055, 0.96, y + 0.018, -0.03, P.chroom));
  p.push(span(-1.0, 1.02, -0.04, 1.0, 1.35, 0.01, P.grille));
  for (const y of [1.1, 1.18, 1.26]) p.push(span(-0.96, y - 0.016, -0.055, 0.96, y + 0.016, -0.03, P.staal));
  p.push(span(-1.05, 1.37, -0.055, 1.05, 1.45, -0.015, P.chroom));
  for (const s of [-1, 1]) p.push(span(s * 0.7, 0.6, -0.1, s * 1.18, 0.86, -0.06, P.koplamp));
  p.push(span(-1.24, 3.06, -0.22, 1.24, 3.15, 0.28, P.cabineWit));
  for (const x of [-0.66, -0.22, 0.22, 0.66]) p.push(span(x - 0.07, 3.0, -0.2, x + 0.07, 3.06, -0.12, P.oranje));
}
function frontVolvo(p, ev) {
  // hoge, smallere grille onder de band met lamellen (elektrisch: dicht, in het rood van de cabine), koplampen met een
  // V-vormige dagrijverlichting, kleine witte zonneklep
  p.push(span(-0.8, 1.1, -0.04, 0.8, 1.72, 0.01, ev ? P.rood : P.grille));
  for (let y = 1.2; y < 1.68; y += 0.13) p.push(span(-0.76, y - 0.022, -0.055, 0.76, y + 0.022, -0.03, ev ? P.grille : P.chroom));
  for (const s of [-1, 1]) p.push(span(s * 0.8, 1.1, -0.06, s * 0.86, 1.72, -0.02, P.chroom));
  for (const s of [-1, 1]) {
    p.push(span(s * 0.9, 0.9, -0.09, s * 1.22, 1.1, -0.04, P.koplamp));
    p.push(rbox(0.34, 0.035, 0.03, s * 1.05, 1.19, -0.065, 0, 0, s * 0.5, P.koplamp));
    p.push(rbox(0.34, 0.035, 0.03, s * 1.05, 0.81, -0.1, 0, 0, -s * 0.5, P.koplamp));
  }
  p.push(span(-1.18, 3.13, -0.14, 1.18, 3.21, 0.26, P.cabineWit));
  for (const s of [-1, 1]) p.push(span(s * 0.84, 0.5, -0.095, s * 1.04, 0.6, -0.07, P.koplamp));
}
function frontMercedes(p, ev) {
  // brede grille onder de band met drie dikke chromen balken (elektrisch: een dicht zwart paneel met twee lijnen), lage
  // koplampen, zwarte zonneklep boven de voorruit
  p.push(span(-1.04, 1.1, -0.04, 1.04, 1.72, 0.01, ev ? P.inkt : P.grille));
  if (ev) for (const y of [1.36, 1.54]) p.push(span(-1.0, y - 0.012, -0.05, 1.0, y + 0.012, -0.035, P.staal));
  else for (const y of [1.27, 1.43, 1.59]) p.push(span(-1.0, y - 0.05, -0.065, 1.0, y + 0.05, -0.025, P.chroom));
  for (const s of [-1, 1]) p.push(span(s * 0.66, 0.5, -0.1, s * 1.18, 0.66, -0.06, P.koplamp));
  p.push(span(-1.2, 3.03, -0.1, 1.2, 3.11, 0.22, P.klep));
}
function frontMercedes600(p) {
  // ronde, dichte neus met een lichtband over de hele breedte, smalle koplampen en een luchtinlaat onderin
  p.push(span(-1.12, 1.62, 0.02, 1.12, 1.67, 0.09, P.koplamp));
  for (const s of [-1, 1]) p.push(span(s * 0.78, 1.28, 0.05, s * 1.16, 1.4, 0.14, P.koplamp));
  p.push(span(-1.0, 1.06, 0.12, 1.0, 1.24, 0.3, P.grille));
}

// trekker: cabine, voorkant, zijkant, chassis met tank (diesel) of accupakketten en laadklep (elektrisch)
function tractor(cab, ev, solo) {
  const p = []; const C = CAB[cab] || CAB.daf; const e600 = cab === 'mercedes600';
  // cabine in de huisstijl: wit boven, de goudgele band net onder de voorruit, rood onder; de dakspoiler wit
  p.push(...cabineLak(profile(C.pts, CAB_W, P.rood, 0.07), C.yg));
  if (C.fairing) p.push(profile([[0.55, C.fairing], [2.22, 3.94], [2.3, 3.94], [2.3, C.fairing]], 2.36, P.cabineWit, 0.04));
  windscreen(p, C.ws, e600 ? 2.3 : 2.2);
  if (cab === 'daf') frontDaf(p); else if (cab === 'scania') frontScania(p); else if (cab === 'volvo') frontVolvo(p, ev); else if (e600) frontMercedes600(p); else frontMercedes(p, ev);
  bumper(p, e600 ? 0.06 : -0.08);
  if (cab === 'mercedes' || e600) cameras(p, e600 ? 0.62 : 0.18); else mirrors(p);
  // het beeldmerk boven de voorruit (op het hoge dak of op de dakspoiler), de sierstreep met het kleine beeldmerk
  p.push(...merkVoor(C.merk[0], C.merk[1], 0.17, 0.13));
  p.push(...sierstreep(CAB_W / 2, C.streep, e600 ? 2.27 : 2.22, e600 ? 1.15 : 1.0, 0.07));
  // zijruiten, deurnaad, treden; Volvo: het lage raampje voor in de deur
  for (const s of [-1, 1]) {
    p.push(span(s * 1.245, e600 ? 2.12 : 2.06, e600 ? 0.62 : 0.28, s * 1.262, e600 ? 2.98 : 2.88, e600 ? 1.55 : 1.42, P.glas));
    if (cab === 'volvo') p.push(span(s * 1.245, 1.62, 0.32, s * 1.262, 2.07, 0.74, P.glas));
    p.push(span(s * 1.252, 1.1, 1.46, s * 1.266, 2.95, 1.49, P.grille));
  }
  p.push(...tredenLak(1.06, 1.24, 0.42, 1.3));
  if (C.fairing) for (const s of [-1, 1]) p.push(span(s * 1.02, 3.93, 2.18, s * 1.14, 3.99, 2.26, P.oranje));
  // chassis
  p.push(span(-0.5, 0.72, 0.3, 0.5, 1.06, 5.85, P.chassis));
  if (!ev) {
    const tank = cyl(0.36, 0.36, 1.55, 16, P.velg); tank.rotateX(Math.PI / 2); tank.translate(-0.88, 0.82, 2.95); p.push(tank);
    for (const z of [2.35, 3.55]) p.push(span(-1.255, 0.44, z - 0.03, -0.5, 0.5, z + 0.03, P.chassis));
    const ad = cyl(0.2, 0.2, 0.42, 12, P.wit); ad.rotateX(Math.PI / 2); ad.translate(-0.92, 0.72, 3.98); p.push(ad);
    p.push(span(0.62, 0.5, 2.2, 1.18, 1.05, 3.5, P.inkt));
  } else {
    for (const s of [-1, 1]) { p.push(span(s * 0.56, 0.46, 2.15, s * 1.22, 1.06, 4.05, P.accu)); p.push(span(s * 0.56, 1.06, 2.15, s * 1.225, 1.1, 4.05, P.inkt)); for (const z of [2.6, 3.1, 3.6]) p.push(span(s * 1.22, 0.5, z - 0.015, s * 1.23, 1.02, z + 0.015, P.inkt)); }
    // laadklep links op het accupakket, met een witte ledstrip erboven
    p.push(span(-1.238, 0.6, 2.62, -1.222, 0.98, 3.04, P.staal)); p.push(span(-1.246, 0.64, 2.66, -1.23, 0.94, 3.0, P.inkt));
    p.push(span(-1.248, 0.955, 2.7, -1.236, 0.972, 2.96, P.koplamp));
  }
  for (const s of [-1, 1]) { p.push(span(s * 0.62, 1.12, 4.2, s * 1.26, 1.18, 5.62, P.inkt)); p.push(span(s * 0.62, 0.42, 5.6, s * 1.26, 1.14, 5.64, P.rubber)); }
  for (const s of [-1, 1]) p.push(span(s * 0.72, 0.82, 5.82, s * 1.1, 0.98, 5.88, P.achterlicht));
  // voorspatborden (rood, zoals de cabine) en de lijnen naar de oplegger achter de cabine
  for (const s of [-1, 1]) p.push(span(s * 1.0, 1.08, 0.72, s * 1.27, 1.14, 1.95, P.rood));
  if (solo) p.push(...fifthWheel());
  else for (const [x, c] of [[-0.14, P.achterlicht], [0.14, P.kenteken]]) { const l = cyl(0.03, 0.03, 0.9, 6, c); l.translate(x, 1.7, 2.45); p.push(l); }
  return p;
}
const TRACTOR_WHEELS = (dz) => [...axleSet([1.3], 1.04, 0.53, 0.32, dz), ...axleSet([4.9], 0.89, 0.53, 0.62, dz)];

// ---------- bakwagen (lokaal: neus op z = 0) ----------
function rigid(cab, ev) {
  const p = [];
  // cabine in de huisstijl (zoals de trekker), de dakspoiler wit
  p.push(...cabineLak(profile([[0.02, 1.0], [0.0, 1.9], [0.12, 2.86], [0.3, 3.02], [1.95, 3.02], [1.95, 1.0]], 2.45, P.rood, 0.07), 1.9));
  p.push(profile([[0.55, 3.0], [1.9, 3.5], [1.95, 3.5], [1.95, 3.0]], 2.3, P.cabineWit, 0.03));
  p.push(panel(2.15, 0.9, 0.04, 0, 2.38, 0.05, Math.atan2(0.115, 0.92), P.glas));
  p.push(...bumperLak(1.225, -0.08, 0.92));
  if (cab === 'daf') {
    // grille onder de band, witte zonneklep
    p.push(span(-0.82, 1.04, -0.04, 0.82, 1.62, 0.01, P.grille));
    for (const y of [1.14, 1.27, 1.4, 1.53]) p.push(span(-0.78, y - 0.026, -0.055, 0.78, y + 0.026, -0.03, P.chroom));
    for (const s of [-1, 1]) p.push(span(s * 0.9, 0.95, -0.085, s * 1.2, 1.1, -0.03, P.koplamp));
    p.push(span(-1.16, 2.84, -0.18, 1.16, 2.92, 0.24, P.cabineWit));
  } else {
    // grille onder de band, zwarte zonneklep (zoals de Actros van Sems model)
    p.push(span(-0.84, 1.06, -0.04, 0.84, 1.62, 0.01, ev ? P.inkt : P.grille));
    for (const y of (ev ? [1.3, 1.46] : [1.26, 1.48])) p.push(span(-0.8, y - (ev ? 0.012 : 0.045), -0.06, 0.8, y + (ev ? 0.012 : 0.045), -0.03, ev ? P.staal : P.chroom));
    for (const s of [-1, 1]) p.push(span(s * 0.64, 0.5, -0.095, s * 1.15, 0.66, -0.06, P.koplamp));
    p.push(span(-1.12, 2.84, -0.1, 1.12, 2.92, 0.2, P.klep));
  }
  for (const s of [-1, 1]) { p.push(span(s * 1.2, 2.6, 0.12, s * 1.55, 2.65, 0.18, P.inkt)); p.push(span(s * 1.5, 2.12, 0.05, s * 1.62, 2.72, 0.3, P.inkt)); p.push(span(s * 1.22, 2.06, 0.26, s * 1.24, 2.82, 1.3, P.glas)); p.push(span(s * 1.23, 1.05, 1.36, s * 1.242, 2.86, 1.39, P.grille)); }
  p.push(...tredenLak(1.04, 1.22, 0.35, 1.2));
  // het beeldmerk op de dakspoiler en de sierstreep met het kleine beeldmerk op de cabine
  p.push(...merkVoor([0, 3.19, 0.55 + 0.38 * 1.35], Math.atan2(1.35, 0.5), 0.15, 0.12));
  p.push(...sierstreep(1.225, 2.9, 1.88, 0.95, 0.05));
  // laadbak in licht gebroken wit met een aluminium onderrand, het beeldmerk groot midden op de zijkant
  const bz0 = 2.12, bz1 = 9.75, top = 3.62, fl = 1.16, hw = 1.275;
  p.push(span(-hw, fl, bz0, hw, top, bz1, P.kast));
  for (const s of [-1, 1]) p.push(span(s * hw, fl, bz0 + 0.04, s * (hw + 0.014), fl + 0.12, bz1 - 0.04, P.alu));
  p.push(...merkOpzij(hw, (fl + top) / 2, (bz0 + bz1) / 2, 0.4, 0.5));
  for (const sx of [-1, 1]) for (const z of [bz0 + 0.03, bz1 - 0.03]) p.push(span(sx * (hw - 0.05), fl, z - 0.035, sx * (hw + 0.016), top, z + 0.035, P.grijsLicht));
  p.push(span(-1.2, 0.72, 0.3, 1.2, fl, bz1 - 0.1, P.chassis));
  p.push(span(-1.18, fl + 0.08, bz1, 1.18, top - 0.1, bz1 + 0.025, P.deur));
  for (let y = fl + 0.35; y < top - 0.2; y += 0.34) p.push(span(-1.17, y - 0.012, bz1 + 0.02, 1.17, y + 0.012, bz1 + 0.04, P.dockdeurLijn));
  p.push(span(-1.18, 0.78, bz1 - 0.55, 1.18, 0.92, bz1 + 0.02, P.staal));
  if (!ev) { const tank = cyl(0.3, 0.3, 1.3, 14, P.velg); tank.rotateX(Math.PI / 2); tank.translate(-0.9, 0.78, 3.4); p.push(tank); }
  else { for (const s of [-1, 1]) p.push(span(s * 0.56, 0.46, 2.6, s * 1.2, 1.02, 4.6, P.accu)); p.push(span(-1.215, 0.6, 3.0, -1.2, 0.95, 3.4, P.staal)); p.push(span(-1.222, 0.64, 3.04, -1.207, 0.91, 3.36, P.inkt)); }
  for (const y of [0.55, 0.85]) for (const s of [-1, 1]) p.push(span(s * 1.2, y - 0.05, 4.7, s * 1.26, y + 0.05, 6.2, P.staal));
  for (const s of [-1, 1]) { p.push(span(s * 0.72, 1.0, 6.3, s * 1.26, 1.08, 7.8, P.inkt)); p.push(span(s * 0.76, 0.66, bz1 - 0.04, s * 1.18, 0.8, bz1 + 0.01, P.achterlicht)); p.push(span(s * 1.0, 1.04, 0.62, s * 1.24, 1.1, 1.85, P.rood)); }
  p.push(span(-1.12, 0.4, bz1 - 0.35, 1.12, 0.55, bz1 - 0.2, P.chassis));
  p.push(span(-0.26, 0.6, bz1 - 0.04, 0.26, 0.71, bz1 - 0.01, P.kenteken));
  return p;
}

// ---------- opleggers (lokaal: voorkant op z = 0, naar achteren +z) ----------
const SOORT = {
  koel: { L: 13.6, top: 4.0, axles: [9.38, 10.69, 12.0], reefer: 1 },
  vries: { L: 13.6, top: 4.0, axles: [9.38, 10.69, 12.0], reefer: 2 },
  droog: { L: 13.6, top: 4.0, axles: [9.38, 10.69, 12.0], reefer: 0 },
  huif: { L: 13.6, top: 4.0, axles: [9.38, 10.69, 12.0], reefer: 0, zeil: true },
  drank: { L: 13.6, top: 4.0, axles: [9.38, 10.69, 12.0], reefer: 0, rolluik: true },
  city: { L: 10.4, top: 3.85, axles: [7.0, 8.3], reefer: 1 },
  lzv: { L: 13.6, top: 4.0, axles: [9.38, 10.69, 12.0], reefer: 0, dolly: true },
};
function boxTrailer(o, legY) {
  const p = []; const hw = TR_W / 2, L = o.L, top = o.top, fl = TR_FLOOR;
  // kast in licht gebroken wit (of het zeil), aluminium onderrand, smalle zwarte onderbalk, en het beeldmerk groot midden
  // op de zijkant (op het zeil gedrukt; bij de dranken op het middelste rolluik); het woordmerk ernaast laten we weg
  p.push(span(-hw, fl, 0, hw, top, L, o.zeil ? P.zeil : P.kast));
  for (const s of [-1, 1]) p.push(span(s * hw, fl, 0.04, s * (hw + 0.014), fl + 0.13, L - 0.04, P.alu));
  p.push(span(-hw + 0.05, fl - 0.1, 0, hw - 0.05, fl, L, P.inkt));
  p.push(...merkOpzij(hw + (o.rolluik ? 0.016 : 0), (fl + top) / 2, L / 2, 0.46, 0.6));
  for (const sx of [-1, 1]) for (const z of [0.03, L - 0.03]) p.push(span(sx * (hw - 0.05), fl, z - 0.035, sx * (hw + 0.016), top, z + 0.035, P.grijsLicht));
  for (const sx of [-1, 1]) p.push(span(sx * (hw - 0.04), top - 0.06, 0, sx * (hw + 0.014), top + 0.01, L, P.grijsLicht));
  if (o.zeil) {
    // schuifzeil: spanbanden om de 0,62 m en een onderrail
    for (let z = 0.45; z < L - 0.3; z += 0.62) for (const s of [-1, 1]) p.push(span(s * hw, fl + 0.38, z - 0.022, s * (hw + 0.02), top - 0.1, z + 0.022, P.hek));
    for (const s of [-1, 1]) p.push(span(s * hw, fl - 0.02, 0, s * (hw + 0.025), fl + 0.04, L, P.grijsLicht));
  }
  if (o.rolluik) {
    // dranken: drie rolluiken in elke zijkant, met lamellen
    for (const [a, b] of [[1.0, 4.9], [5.2, 9.1], [9.4, 12.9]]) for (const s of [-1, 1]) {
      p.push(span(s * hw, fl + 0.45, a, s * (hw + 0.008), top - 0.95, b, P.grijsLicht));
      for (let y = fl + 0.55; y < top - 1.0; y += 0.16) p.push(span(s * (hw + 0.008), y - 0.012, a, s * (hw + 0.016), y + 0.012, b, P.dockdeurLijn));
    }
  }
  for (const z of [2.2, 5.0, 7.8, 10.6]) if (z < L - 1) for (const s of [-1, 1]) p.push(span(s * hw, 1.1, z - 0.04, s * (hw + 0.03), 1.18, z + 0.04, P.oranje));
  // koelmachine op de voorkant, wit met grijze roosters; vries: groter, met drie roosters en een oranje controlelamp
  if (o.reefer) {
    const y0 = o.reefer === 2 ? 2.25 : 2.42; p.push(span(-1.0, y0, -0.44, 1.0, top - 0.18, 0, P.koel));
    for (const y of (o.reefer === 2 ? [2.62, 3.02, 3.42] : [2.82, 3.28])) if (y < top - 0.3) p.push(span(-0.78, y - 0.06, -0.45, 0.78, y + 0.06, -0.43, P.rooster));
    if (o.reefer === 2) p.push(span(-0.3, y0 + 0.08, -0.46, 0.3, y0 + 0.2, -0.44, P.oranje));
  }
  // achterkant: deuren, scharnieren, sluitstangen, lichtbalk, kenteken
  for (const s of [-1, 1]) p.push(span(s * 0.013, fl + 0.07, L, s * (hw - 0.07), top - 0.07, L + 0.025, P.deur));
  p.push(span(-0.013, fl + 0.07, L, 0.013, top - 0.07, L + 0.03, P.inkt));
  for (const s of [-1, 1]) for (const y of [1.55, 2.25, 2.95, 3.65]) if (y < top - 0.2) p.push(span(s * (hw - 0.12), y - 0.06, L + 0.02, s * (hw + 0.005), y + 0.06, L + 0.07, P.staal));
  for (const x of [-0.92, -0.32, 0.32, 0.92]) p.push(span(x - 0.02, fl + 0.12, L + 0.025, x + 0.02, top - 0.12, L + 0.065, P.staal));
  p.push(span(-1.25, 0.94, L - 0.14, 1.25, 1.1, L - 0.02, P.inkt));
  for (const s of [-1, 1]) p.push(span(s * 0.78, 0.95, L - 0.02, s * 1.2, 1.08, L + 0.01, P.achterlicht));
  p.push(span(-0.26, 0.92, L - 0.03, 0.26, 1.03, L, P.kenteken));
  under(p, o.axles, L, legY, fl);
  return p;
}
// onderstel: onderrijbeveiliging achter en opzij, chassis, spatborden, steunpoten en koningspen
function under(p, axles, L, legY, fl) {
  const a0 = axles[0], a1 = axles[axles.length - 1];
  p.push(span(-1.18, 0.42, L - 0.42, 1.18, 0.58, L - 0.26, P.chassis));
  for (const s of [-1, 1]) p.push(span(s * 0.7, 0.55, L - 0.4, s * 0.8, 0.98, L - 0.3, P.chassis));
  for (const y of [0.56, 0.86]) for (const s of [-1, 1]) p.push(span(s * 1.2, y - 0.05, 3.8, s * 1.26, y + 0.05, a0 - 0.65, P.staal));
  p.push(span(-0.55, 0.86, 0.5, 0.55, fl - 0.1, L - 0.9, P.chassis));
  for (const s of [-1, 1]) { p.push(span(s * 0.72, 1.02, a0 - 0.63, s * 1.3, 1.1, a1 + 0.65, P.inkt)); p.push(span(s * 0.72, 0.52, a0 - 0.65, s * 1.3, 1.06, a0 - 0.61, P.rubber)); p.push(span(s * 0.72, 0.4, a1 + 0.62, s * 1.3, 1.06, a1 + 0.66, P.rubber)); }
  for (const s of [-1, 1]) { p.push(span(s * 0.88, legY + 0.04, 3.28, s * 1.02, fl - 0.1, 3.42, P.staal)); p.push(span(s * 0.8, legY, 3.21, s * 1.1, legY + 0.06, 3.49, P.chassis)); }
  p.push(span(-0.88, (legY + fl) / 2 - 0.03, 3.32, 0.88, (legY + fl) / 2 + 0.03, 3.38, P.staal));
  const pen = cyl(0.05, 0.05, 0.12, 8, P.staal); pen.translate(0, fl - 0.16, 0.9); p.push(pen);
}
// silo-oplegger: een liggende tank van roestvrij staal op een chassis, mangaten en een loopbrug bovenop, ladder voor
function siloTrailer(legY) {
  const p = []; const L = 12.8, R = 1.18, yc = 2.62, z0 = 0.55, z1 = L - 0.6, fl = TR_FLOOR;
  const tank = cyl(R, R, z1 - z0, 40, P.rvs); tank.rotateX(Math.PI / 2); tank.translate(0, yc, (z0 + z1) / 2); p.push(tank);
  const kop = cyl(R, R * 0.78, 0.34, 40, P.rvs); kop.rotateX(-Math.PI / 2); kop.translate(0, yc, z0 - 0.17); p.push(kop);
  const staart = cyl(R * 0.78, R, 0.34, 40, P.rvs); staart.rotateX(-Math.PI / 2); staart.translate(0, yc, z1 + 0.17); p.push(staart);
  for (const z of [1.2, 4.6, 8.0, 11.2]) { const ring = cyl(R + 0.015, R + 0.015, 0.06, 40, P.staal); ring.rotateX(Math.PI / 2); ring.translate(0, yc, z); p.push(ring); }
  for (const z of [2.9, 6.3, 9.7]) { const m = cyl(0.3, 0.3, 0.16, 20, P.staal); m.translate(0, yc + R + 0.02, z); p.push(m); }
  p.push(span(-0.32, yc + R - 0.02, 1.6, 0.32, yc + R + 0.03, L - 2.2, P.grijsLicht));
  for (const s of [-1, 1]) p.push(span(s * 0.28, yc + R + 0.03, 2.0, s * 0.31, yc + R + 0.75, 2.04, P.grijsLicht));
  // ladder voor tegen de tank, zadels en chassis, losleiding links
  for (const s of [-1, 1]) p.push(span(s * 0.26, 1.25, z0 - 0.42, s * 0.3, yc + R + 0.1, z0 - 0.38, P.staal));
  for (let y = 1.45; y < yc + R; y += 0.32) p.push(span(-0.26, y - 0.02, z0 - 0.42, 0.26, y + 0.02, z0 - 0.38, P.staal));
  for (const z of [1.6, 6.3, 10.6]) p.push(span(-0.95, fl, z - 0.16, 0.95, yc - R * 0.7, z + 0.16, P.chassis));
  const pijp = cyl(0.09, 0.09, L - 2.0, 12, P.staal); pijp.rotateX(Math.PI / 2); pijp.translate(-1.0, 1.3, L / 2); p.push(pijp);
  p.push(span(-0.55, 0.86, 0.5, 0.55, fl, L - 0.9, P.chassis));
  for (const s of [-1, 1]) p.push(span(s * 0.78, 0.95, L - 0.02, s * 1.2, 1.08, L + 0.01, P.achterlicht));
  p.push(span(-1.25, 0.94, L - 0.14, 1.25, 1.1, L - 0.02, P.inkt)); p.push(span(-0.26, 0.92, L - 0.03, 0.26, 1.03, L, P.kenteken));
  for (const z of [3.0, 6.2]) for (const s of [-1, 1]) p.push(span(s * 1.08, 1.1, z - 0.04, s * 1.12, 1.18, z + 0.04, P.oranje));
  under(p, [9.3, 10.6, 11.9], L, legY, fl);
  return p;
}
// dolly (voor een LZV): een onderstel met twee assen, koppelschotel en een dissel naar voren
function dollyParts() {
  const p = [];
  p.push(span(-0.5, 0.62, -0.6, 0.5, 0.92, 2.3, P.chassis));
  const plaat = cyl(0.5, 0.5, 0.1, 24, P.velgDonker); plaat.translate(0, 1.0, 0.9); p.push(plaat);
  for (const s of [-1, 1]) { p.push(span(s * 0.72, 1.0, -0.15, s * 1.3, 1.08, 2.15, P.inkt)); p.push(rbox(0.1, 0.1, 2.9, s * 0.3, 0.68, -2.0, 0, -s * 0.1, 0, P.chassis)); }
  const oog = cyl(0.11, 0.11, 0.08, 16, P.staal); oog.translate(0, 0.68, -3.42); p.push(oog);
  for (const s of [-1, 1]) p.push(span(s * 0.78, 0.66, 2.24, s * 1.2, 0.78, 2.3, P.achterlicht));
  return p;
}

// ---------- samenstellen ----------
// Geeft { geometry, wheels: [[x, z, r, breedte]], plate: { x0, x1, y0, y1, z } (voorkant, of null), size }. Het model
// staat met de onderkant op y = 0 en de neus naar -z; het midden van de lengte ligt in de oorsprong.
export function portraitModel(spec) {
  const kind = spec.soort; let parts = [], wheels = [], plate = null, L = 0;
  if (kind === 'trekker') {
    const cab = spec.cabine || 'daf', ev = !!spec.ev;
    if (spec.oplegger) {
      const TZ = -8.25, OZ = -5.35; const o = SOORT.koel;
      parts = [...shift(tractor(cab, ev, false), TZ), ...shift(boxTrailer(o, 0.32), OZ)];
      wheels = [...TRACTOR_WHEELS(TZ), ...axleSet(o.axles, 1.07, 0.48, 0.36, OZ)]; L = 16.5;
      plate = frontPlate(cab, TZ);
    } else {
      const TZ = -2.925; parts = shift(tractor(cab, ev, true), TZ); wheels = TRACTOR_WHEELS(TZ); L = 5.85; plate = frontPlate(cab, TZ);
    }
  } else if (kind === 'bakwagen') {
    const TZ = -4.875; parts = shift(rigid(spec.cabine || 'mercedes', !!spec.ev), TZ);
    wheels = [...axleSet([1.25], 1.0, 0.5, 0.3, TZ), ...axleSet([7.05], 0.87, 0.5, 0.58, TZ)]; L = 9.75;
    plate = { x0: -0.26, x1: 0.26, y0: 0.48, y1: 0.59, z: TZ - 0.085 };
    parts.push(span(-0.27, 0.47, TZ - 0.09, 0.27, 0.6, TZ - 0.08, P.inkt));
  } else if (kind === 'bus') {
    return null;   // de bestelbus komt uit vehicles.js (buildModels().bus), zie tools/render-portretten.mjs
  } else {
    const type = spec.type || 'koel';
    if (type === 'silo') { const OZ = -6.4; parts = shift(siloTrailer(0), OZ); wheels = axleSet([9.3, 10.6, 11.9], 1.07, 0.48, 0.36, OZ); L = 12.8; }
    else {
      const o = SOORT[type] || SOORT.droog; const OZ = -o.L / 2;
      if (o.dolly) { parts = [...shift(boxTrailer(o, 0.62), OZ), ...shift(dollyParts(), OZ)]; wheels = [...axleSet(o.axles, 1.07, 0.48, 0.36, OZ), ...axleSet([0.3, 1.6], 1.07, 0.48, 0.36, OZ)]; }
      else { parts = shift(boxTrailer(o, 0.0), OZ); wheels = axleSet(o.axles, 1.07, 0.48, 0.36, OZ); }
      L = o.L;
    }
  }
  const geometry = merge(parts); geometry.computeBoundingBox();
  return { geometry, wheels, plate, size: { L, H: geometry.boundingBox.max.y } };
}
// het voorste kenteken van een trekker (geel, op de bumper), met de plek waar de app het beeld met de letters legt
function frontPlate(cab, TZ) { const z = cab === 'mercedes600' ? 0.05 : -0.085; return { x0: -0.26, x1: 0.26, y0: 0.47, y1: 0.58, z: TZ + z - 0.006 }; }
