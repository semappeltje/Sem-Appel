import roadsData from './data/roads.json';
import { toXY, KM_PER_UNIT } from './geo.js';

export const nodes = roadsData.nodes.map(([lon, lat]) => toXY(lon, lat));
export const adj = nodes.map(() => []);
const SPEED = [85, 70, 60]; // km/h per wegtype: snelweg, hoofdweg, weg
for (const [i, j, km, t] of roadsData.edges) { adj[i].push([j, km, t]); adj[j].push([i, km, t]); }
export const roads = roadsData.roads.map(r => ({ t: r.t, l: r.l, pts: r.p.map(([lon, lat]) => toXY(lon, lat)) }));

export function nearestNode(x, y) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) { const d = (nodes[i].x - x) ** 2 + (nodes[i].y - y) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}

class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

// snelste route (op tijd, dus snelwegen hebben voorrang)
export function shortestPath(a, b) {
  const dist = new Float64Array(nodes.length).fill(Infinity), prev = new Int32Array(nodes.length).fill(-1);
  dist[a] = 0; const h = new Heap(); h.push(0, a);
  while (h.size) { const [d, u] = h.pop(); if (u === b) break; if (d > dist[u]) continue; for (const [v, km, t] of adj[u]) { const nd = d + km / SPEED[t]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(nd, v); } } }
  if (dist[b] === Infinity) return [a, b];
  const path = []; for (let c = b; c !== -1; c = prev[c]) path.unshift(c); return path;
}

// pad van knoop-ids naar punten met cumulatieve kilometers
export function buildPath(ids) {
  const pts = ids.map(i => nodes[i]); const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) * KM_PER_UNIT);
  return { pts, cum, total: cum[cum.length - 1] };
}
export function posAt(path, km) {
  const { pts, cum } = path; let i = 1; while (i < cum.length - 1 && cum[i] < km) i++;
  const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, t = Math.min(1, Math.max(0, (km - cum[i - 1]) / seg));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, hx: b.x - a.x, hy: b.y - a.y };
}
