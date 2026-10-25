// Rekenhulp voor de 3D-wereld: vaste toevalsreeksen, Mercator, en vlakken (contouren) in meters.
// Alles in het lokale vlak van de scene: x naar het oosten, z naar het zuiden (zoals Mercator-y), y omhoog.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// vaste toevalsreeks per plek (los van de simulatie): twee gehele getallen in, een getal 0..1 uit
export const hash = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
// een kleine reeks op basis van een startgetal (voor bouwsels die vast moeten liggen per standplaats of per vak)
export function rng(seed) { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Mercator zoals MapLibre die rekent (0..1 over de wereld) en meters per Mercator-eenheid op een breedtegraad
export const mercX = lon => (180 + lon) / 360;
export const mercY = lat => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360;
export const mpuAt = lat => 1 / (2 * Math.PI * 6371008.8) / Math.cos(lat * Math.PI / 180);
// meters per pixel zoals MapLibre die rekent (tegels van 512 pixels)
export const metersPerPixel = (lat, z) => 78271.517 * Math.cos(lat * Math.PI / 180) / 2 ** z;

// ---------- contouren: [[x, z], ...] in meters ----------
// open ring (zonder herhaald eindpunt), tegen de klok in gezien van boven (positieve oppervlakte in x/z)
export function ringArea(r) { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
export function cleanRing(r) {
  const out = [];
  for (const p of r) { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.05) out.push([p[0], p[1]]); }
  if (out.length > 2) { const a = out[0], b = out[out.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05) out.pop(); }
  if (out.length > 2 && ringArea(out) < 0) out.reverse();
  return out;
}
export function centroid(r) { let x = 0, z = 0, a = 0; for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n]; const c = p[0] * q[1] - q[0] * p[1]; a += c; x += (p[0] + q[0]) * c; z += (p[1] + q[1]) * c; } if (Math.abs(a) < 1e-6) { let sx = 0, sz = 0; for (const p of r) { sx += p[0]; sz += p[1]; } return [sx / r.length, sz / r.length]; } return [x / (3 * a), z / (3 * a)]; }
export function inRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; }
export function bbox(r) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } return [x0, z0, x1, z1]; }
// afstand van een punt tot een ring (de rand), en het dichtstbijzijnde punt met de rand-index
export function nearestOnRing(x, z, r) {
  let best = { d: Infinity, x: 0, z: 0, i: 0, t: 0 };
  for (let i = 0, n = r.length; i < n; i++) {
    const a = r[i], b = r[(i + 1) % n]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1); const px = a[0] + dx * t, pz = a[1] + dz * t; const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, x: px, z: pz, i, t };
  }
  return best;
}
// buitenwaartse normaal van rand i van een ring tegen de klok in
export function edgeNormal(r, i) { const a = r[i], b = r[(i + 1) % r.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; return [dz / L, -dx / L]; }
// hoofdrichting van een contour: de richting van de langste rand van de omhullende (in radialen, 0 = oost)
export function mainAxis(r) {
  const h = hull(r); let best = 0, ang = 0;
  for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > best) { best = L; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); } }
  return ang;
}
export function hull(pts) {
  const p = pts.map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
// draai punten om de oorsprong (in het x/z-vlak)
export const rot = (x, z, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - z * s, x * s + z * c]; };
// ring een paar meter naar buiten (positief) of binnen (negatief) schuiven: per hoekpunt langs de halve hoek
export function offsetRing(r, d) {
  const n = r.length; const out = [];
  for (let i = 0; i < n; i++) {
    const n0 = edgeNormal(r, (i - 1 + n) % n), n1 = edgeNormal(r, i); let mx = n0[0] + n1[0], mz = n0[1] + n1[1]; const L = Math.hypot(mx, mz);
    if (L < 1e-3) { mx = n1[0]; mz = n1[1]; } else { mx /= L; mz /= L; }
    const cos = mx * n1[0] + mz * n1[1]; const k = d / Math.max(0.35, cos);
    out.push([r[i][0] + mx * k, r[i][1] + mz * k]);
  }
  return out;
}
// raakt een rechthoek (middelpunt, halve maten, hoek) een ring? Hoekpunten en randpunten van de rechthoek in de
// ring, of hoekpunten van de ring in de rechthoek.
export function rectCorners(cx, cz, hw, hl, a) { const out = []; for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [x, z] = rot(sx * hw, sz * hl, a); out.push([cx + x, cz + z]); } return out; }
export function rectHitsRing(cx, cz, hw, hl, a, ring, rb) {
  if (rb && (cx + hw + hl < rb[0] || cx - hw - hl > rb[2] || cz + hw + hl < rb[1] || cz - hw - hl > rb[3])) return false;
  const c = rectCorners(cx, cz, hw, hl, a);
  for (const p of c) if (inRing(p[0], p[1], ring)) return true;
  if (inRing(cx, cz, ring)) return true;
  for (const p of ring) { const dx = p[0] - cx, dz = p[1] - cz; const u = dx * Math.cos(-a) - dz * Math.sin(-a), v = dx * Math.sin(-a) + dz * Math.cos(-a); if (Math.abs(u) <= hw && Math.abs(v) <= hl) return true; }
  return false;
}
export function rectInRing(cx, cz, hw, hl, a, ring) { for (const p of rectCorners(cx, cz, hw, hl, a)) if (!inRing(p[0], p[1], ring)) return false; return inRing(cx, cz, ring); }

// kleur uit een CSS-string (#rrggbb, rgb(), hsl()) naar een getal; terugval als het geen kleur is
export function cssColor(THREE, v, fallback) { if (typeof v !== 'string') return fallback; try { const c = new THREE.Color(); c.setStyle(v); return c.getHex(); } catch { return fallback; } }

// ---------- invoer uit de data (verdraagzaam) ----------
// Een gecodeerde lijn (Google polyline, zoals de wegen van de app) naar [[lon, lat], ...]; precisie 1e5, of 1e6 als 1e5
// buiten Nederland en omgeving uitkomt.
export function decodeRing(s) {
  const run = f => { let idx = 0, lat = 0, lon = 0; const out = []; while (idx < s.length) { let b, shift = 0, res = 0; do { b = s.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && idx < s.length); lat += (res & 1) ? ~(res >> 1) : (res >> 1); shift = 0; res = 0; do { b = s.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && idx < s.length); lon += (res & 1) ? ~(res >> 1) : (res >> 1); out.push([lon / f, lat / f]); } return out; };
  const a = run(1e5); const ok = a.length && a.every(([x, y]) => x > -10 && x < 20 && y > 45 && y < 60); return ok ? a : run(1e6);
}
// een contour in lengte- en breedtegraden uit wat de data ook geeft: ring, polygoon, GeoJSON, gecodeerde tekst of een object
export function readRing(v) {
  if (!v) return null;
  if (typeof v === 'string') { const r = decodeRing(v); return r.length >= 3 ? r : null; }
  if (v.type === 'Feature') return readRing(v.geometry);
  if (v.type && v.coordinates) return readRing(v.type === 'MultiPolygon' ? v.coordinates[0] : v.coordinates);
  if (Array.isArray(v)) {
    if (!v.length) return null;
    if (typeof v[0] === 'string') return readRing(v[0]);
    if (Array.isArray(v[0]) && typeof v[0][0] === 'number') return v.length >= 3 ? v : null;
    if (Array.isArray(v[0])) return readRing(v[0]);
    return null;
  }
  if (typeof v === 'object') { const g = v.p ?? v.ring ?? v.rings ?? v.g ?? v.poly ?? v.polygon ?? v.geom ?? v.geometry ?? v.c ?? v.coords ?? v.contour; return g ? readRing(g) : null; }
  return null;
}
