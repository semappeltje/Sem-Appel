// Bouwgeometrie voor de 3D-wereld: gevels met UV in meters (ramen per verdieping), daken, borstweringen, zadeldaken,
// vlakken op de grond en lijnen. Alles als losse driehoeken met positie, normaal en UV, zodat het samen te voegen is.
import * as THREE from 'three';
import { edgeNormal, offsetRing, ringArea } from './util.js';

export class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  tri(a, b, c, n, ua, ub, uc) {
    // zorg dat de driehoek tegen de klok in draait, gezien vanaf de kant waar n naartoe wijst (de voorkant voor three.js)
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { const t = b; b = c; c = t; const w = ub; ub = uc; uc = w; }
    // losse waarden in plaats van spreiden (...a): dezelfde getallen in dezelfde volgorde, twee tot drie keer zo snel; dit
    // is de drukste regel van het bouwen van de wereld
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.nor.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }
  quad(a, b, c, d, n, ua, ub, uc, ud) { this.tri(a, b, c, n, ua, ub, uc); this.tri(a, c, d, n, ua, uc, ud); }
  get empty() { return this.pos.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}

// gevels van een contour (ring tegen de klok in) van hoogte y0 tot y1. uMeters: meters per textuurbreedte;
// vMode 'rel' (0 onder, 1 boven) of een getal (meters per textuurhoogte, bijvoorbeeld 3,4 per verdieping)
export function walls(B, ring, y0, y1, uMeters, vMode, inward = false) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
    const nn = edgeNormal(ring, i); const nrm = inward ? [-nn[0], 0, -nn[1]] : [nn[0], 0, nn[1]];
    const u0 = s / uMeters, u1 = (s + L) / uMeters; s += L;
    const v0 = vMode === 'rel' ? 0 : y0 / vMode, v1 = vMode === 'rel' ? 1 : y1 / vMode;
    B.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], nrm, [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
  }
}
// plat vlak (dak of terrein) op hoogte y, UV in meters / uvM
export function flat(B, ring, y, uvM, down = false) {
  const pts = ring.map(p => new THREE.Vector2(p[0], p[1]));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(pts, []); } catch { faces = []; }
  const n = down ? [0, -1, 0] : [0, 1, 0];
  for (const [i, j, k] of faces) { const a = ring[i], b = ring[j], c = ring[k]; B.tri([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], n, [a[0] / uvM, a[1] / uvM], [b[0] / uvM, b[1] / uvM], [c[0] / uvM, c[1] / uvM]); }
}
// borstwering: binnenkant en bovenkant van een rand van dikte t en hoogte hp boven het dak (op hoogte h)
// (capB/capUV: de bovenkant in een eigen kleur uit het palet, zodat het dak van boven een duidelijke rand heeft)
export function parapet(B, ring, h, hp, t, uvM, capB, capUV) {
  if (ringArea(ring) < 60) return;
  const inner = offsetRing(ring, -t);
  walls(B, inner, h, h + hp, uvM, uvM, true);
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], c = inner[(i + 1) % n], d = inner[i]; const y = h + hp;
    if (capB) capB.quad([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]], [0, 1, 0], capUV, capUV, capUV, capUV);
    else B.quad([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]], [0, 1, 0], [a[0] / uvM, a[1] / uvM], [b[0] / uvM, b[1] / uvM], [c[0] / uvM, c[1] / uvM], [d[0] / uvM, d[1] / uvM]);
  }
}
// zadeldak over een rechthoek (midden cx/cz, halve lengte hl langs de nok, halve breedte hw, hoek a): van goot e tot nok r
export function gable(B, cx, cz, hl, hw, a, e, r, over, uvM) {
  const c = Math.cos(a), s = Math.sin(a); const P = (u, v, y) => [cx + u * c - v * s, y, cz + u * s + v * c];
  const L = hl + over, Wd = hw + over;
  const r0 = P(-L, 0, r), r1 = P(L, 0, r);
  for (const side of [-1, 1]) {
    const e0 = P(-L, side * Wd, e - over * 0.5), e1 = P(L, side * Wd, e - over * 0.5);
    const nx = -s * side, nz = c * side; const slope = (Wd) / Math.max(0.1, r - e + over * 0.5); const ny = slope; const k = Math.hypot(nx, ny, nz);
    B.quad(e0, e1, r1, r0, [nx / k, ny / k, nz / k], [0, 0], [2 * L / uvM, 0], [2 * L / uvM, Wd / uvM], [0, Wd / uvM]);
  }
}
// schilddak over dezelfde rechthoek: de nok aan beide koppen ingekort, met schuine dakvlakken aan de koppen
export function hip(B, cx, cz, hl, hw, a, e, r, over, uvM) {
  const c = Math.cos(a), s = Math.sin(a); const P = (u, v, y) => [cx + u * c - v * s, y, cz + u * s + v * c];
  const L = hl + over, Wd = hw + over, ye = e - over * 0.5, H = Math.max(0.1, r - ye), k = Math.min(Wd, L * 0.45);
  const r0 = P(-L + k, 0, r), r1 = P(L - k, 0, r);
  for (const side of [-1, 1]) {
    const nx = -s * side, nz = c * side, ny = Wd / H, q = Math.hypot(nx, ny, nz);
    B.quad(P(-L, side * Wd, ye), P(L, side * Wd, ye), r1, r0, [nx / q, ny / q, nz / q], [0, 0], [2 * L / uvM, 0], [(2 * L - k) / uvM, Wd / uvM], [k / uvM, Wd / uvM]);
  }
  for (const end of [-1, 1]) {
    const nx = c * end, nz = s * end, ny = k / H, q = Math.hypot(nx, ny, nz);
    B.tri(P(end * L, -Wd, ye), P(end * L, Wd, ye), end < 0 ? r0 : r1, [nx / q, ny / q, nz / q], [0, 0], [2 * Wd / uvM, 0], [Wd / uvM, k / uvM]);
  }
}
// topgevels (de driehoeken onder het zadeldak) van een rechthoekig huis
export function gableEnds(B, cx, cz, hl, hw, a, e, r, uMeters, vMeters) {
  const c = Math.cos(a), s = Math.sin(a); const P = (u, v, y) => [cx + u * c - v * s, y, cz + u * s + v * c];
  for (const end of [-1, 1]) {
    const p0 = P(end * hl, -hw, e), p1 = P(end * hl, hw, e), p2 = P(end * hl, 0, r);
    B.tri(p0, p1, p2, [c * end, 0, s * end], [0, e / vMeters], [2 * hw / uMeters, e / vMeters], [hw / uMeters, r / vMeters]);
  }
}
// zachte donkere rand op de grond rond een contour (schijnbare omgevingsschaduw aan de voet van een gebouw): dekking a
// tegen de gevel, naar buiten over w meter uitlopend naar nul. Geeft { pos, alpha } terug om samen te voegen.
export function skirt(out, ring, y, w, a) {
  const n = ring.length; const N = i => edgeNormal(ring, (i + n) % n);
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n]; const e = N(i); const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.3) continue;
    const P0 = [p[0], y, p[1]], Q0 = [q[0], y, q[1]], P1 = [p[0] + e[0] * w, y, p[1] + e[1] * w], Q1 = [q[0] + e[0] * w, y, q[1] + e[1] * w];
    out.pos.push(...P0, ...P1, ...Q1, ...P0, ...Q1, ...Q0); out.alpha.push(a, 0, 0, a, 0, 0);
    // hoek naar de volgende rand: een waaier (alleen aan de buitenkant van een bolle hoek)
    const f = N(i + 1); const cross = e[0] * f[1] - e[1] * f[0];
    if (cross > 0.01) { const R1 = [q[0] + f[0] * w, y, q[1] + f[1] * w]; out.pos.push(...Q0, ...Q1, ...R1); out.alpha.push(a, 0, 0); }
  }
}

// een lijn op de grond (markering) van a naar b met breedte w
export function line(B, x0, z0, x1, z1, w, y, uv) {
  const dx = x1 - x0, dz = z1 - z0; const L = Math.hypot(dx, dz) || 1; const nx = -dz / L * w / 2, nz = dx / L * w / 2;
  B.quad([x0 + nx, y, z0 + nz], [x1 + nx, y, z1 + nz], [x1 - nx, y, z1 - nz], [x0 - nx, y, z0 - nz], [0, 1, 0], uv, uv, uv, uv);
}
// doos in een draaiend vlak (voor docks, hagen, lantaarnpalen): midden (x, y, z), maten (w langs u, h, d langs v), hoek a
export function obox(B, x, y, z, w, h, d, a, uv) {
  const c = Math.cos(a), s = Math.sin(a); const P = (u, yy, v) => [x + u * c - v * s, yy, z + u * s + v * c];
  const hw = w / 2, hd = d / 2, y0 = y - h / 2, y1 = y + h / 2;
  const nU = [c, 0, s], nV = [-s, 0, c];
  B.quad(P(-hw, y1, -hd), P(hw, y1, -hd), P(hw, y1, hd), P(-hw, y1, hd), [0, 1, 0], uv, uv, uv, uv);
  B.quad(P(hw, y0, -hd), P(hw, y0, hd), P(hw, y1, hd), P(hw, y1, -hd), nU, uv, uv, uv, uv);
  B.quad(P(-hw, y0, -hd), P(-hw, y1, -hd), P(-hw, y1, hd), P(-hw, y0, hd), [-c, 0, -s], uv, uv, uv, uv);
  B.quad(P(-hw, y0, hd), P(-hw, y1, hd), P(hw, y1, hd), P(hw, y0, hd), nV, uv, uv, uv, uv);
  B.quad(P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y1, -hd), P(-hw, y1, -hd), [s, 0, -c], uv, uv, uv, uv);
}
