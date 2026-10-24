// Wegennet (Natural Earth 10m + regionale aanvullingen) als graaf in lon/lat.
import R from './data/roads.json';

export const nodes = R.nodes;            // [lon, lat]
export const roads = R.roads;            // { t: 0 snelweg | 1 hoofdweg | 2 weg, l: naam, p: [[lon,lat],...] }
export const adj = nodes.map(() => []);
const SPEED = [85, 70, 60];              // km/u per wegtype
for (const [i, j, km, t] of R.edges) { adj[i].push([j, km, t]); adj[j].push([i, km, t]); }

const cl = lat => Math.cos(lat * Math.PI / 180);
export function kmBetween(a, b) { const c = cl((a[1] + b[1]) / 2); return Math.hypot((a[0] - b[0]) * c * 111.32, (a[1] - b[1]) * 111.32); }

export function nearestNode(lon, lat) {
  const c = cl(lat); let best = 0, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) { const d = ((nodes[i][0] - lon) * c) ** 2 + (nodes[i][1] - lat) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}

class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

// Snelste route op reistijd (snelwegen krijgen voorrang). Per startknoop wordt de volledige boom gecachet,
// zodat 1.300 trucks met dezelfde standplaatsen en bestemmingen maar ~100 keer Dijkstra kosten.
const treeCache = new Map();
function tree(a) {
  let tr = treeCache.get(a); if (tr) return tr;
  const dist = new Float64Array(nodes.length).fill(Infinity), prev = new Int32Array(nodes.length).fill(-1);
  dist[a] = 0; const h = new Heap(); h.push(0, a);
  while (h.size) { const [d, u] = h.pop(); if (d > dist[u]) continue; for (const [v, km, t] of adj[u]) { const nd = d + km / SPEED[t]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(nd, v); } } }
  tr = { dist, prev }; treeCache.set(a, tr); return tr;
}
export function shortestPath(a, b) {
  const { dist, prev } = tree(a);
  if (dist[b] === Infinity) return [a, b];
  const path = []; for (let c = b; c !== -1; c = prev[c]) path.unshift(c); return path;
}

// Pad van knoop-ids naar punten met cumulatieve kilometers.
export function buildPath(ids) {
  const pts = ids.map(i => nodes[i]); const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + kmBetween(pts[i - 1], pts[i]));
  return { pts, cum, total: cum[cum.length - 1] };
}

// Positie en koers (graden, 0 = noord, met de klok mee) op km langs het pad.
export function posAt(path, km) {
  const { pts, cum } = path;
  let lo = 1, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < km) lo = mid + 1; else hi = mid; }
  const i = Math.max(1, Math.min(lo, cum.length - 1));
  const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, t = Math.min(1, Math.max(0, (km - cum[i - 1]) / seg));
  const lon = a[0] + (b[0] - a[0]) * t, lat = a[1] + (b[1] - a[1]) * t;
  const bearing = Math.atan2((b[0] - a[0]) * cl(lat), b[1] - a[1]) * 180 / Math.PI;
  return { lon, lat, bearing };
}
