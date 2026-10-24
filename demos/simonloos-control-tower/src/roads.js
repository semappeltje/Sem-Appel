// Echt wegennet uit Overture Maps (OpenStreetMap): snelwegen, autowegen en N-wegen als routeergraaf met geometrie.
// Knopen zijn de kruispunten (Overture-connectors), kanten dragen hun lengte, klasse en een polyline-gecodeerde geometrie.
import G from './data/graph.json';

export const nodes = G.nodes;                 // [lon, lat]
const E = G.edges;                            // [a, b, meter, klasse (0 snelweg, 1 autoweg, 2 N-weg), link, polyline]
const SPEED = [85, 80, 70];                   // km/u per klasse; afritten en verbindingswegen 50
export const edgeCount = E.length;
export const edgeClass = i => E[i][3];
export const edgeLink = i => E[i][4] === 1;

// buurlijst: per knoop afwisselend [buur, kant-index, buur, kant-index, ...]
export const adj = nodes.map(() => []);
for (let i = 0; i < E.length; i++) { const e = E[i]; adj[e[0]].push(e[1], i); adj[e[1]].push(e[0], i); }

export function decode(s) {
  let idx = 0, lat = 0, lon = 0; const out = [];
  while (idx < s.length) {
    let b, shift = 0, res = 0;
    do { b = s.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (res & 1) ? ~(res >> 1) : (res >> 1); shift = 0; res = 0;
    do { b = s.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += (res & 1) ? ~(res >> 1) : (res >> 1);
    out.push([lon / 1e5, lat / 1e5]);
  }
  return out;
}
const geomCache = new Map();
export function edgeGeom(i) { let g = geomCache.get(i); if (!g) { g = decode(E[i][5]); geomCache.set(i, g); } return g; }
export function allEdges() { return E; }

const cl = lat => Math.cos(lat * Math.PI / 180);
export function kmBetween(a, b) { const c = cl((a[1] + b[1]) / 2); return Math.hypot((a[0] - b[0]) * c * 111.32, (a[1] - b[1]) * 111.32); }

// dichtstbijzijnde knoop via een rasterindex (cellen van 0,05 graad)
const CELL = 0.05; const grid = new Map();
const key = (lon, lat) => `${Math.floor(lon / CELL)}:${Math.floor(lat / CELL)}`;
nodes.forEach(([lon, lat], i) => { const k = key(lon, lat); let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(i); });
export function nearestNode(lon, lat) {
  const cx = Math.floor(lon / CELL), cy = Math.floor(lat / CELL); let best = -1, bd = Infinity;
  for (let r = 0; r <= 12; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const a = grid.get(`${cx + dx}:${cy + dy}`); if (!a) continue;
      for (const i of a) { const d = kmBetween(nodes[i], [lon, lat]); if (d < bd) { bd = d; best = i; } }
    }
    if (best >= 0 && bd < r * CELL * 111) break;
  }
  return best < 0 ? 0 : best;
}

class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}
const costOf = i => { const e = E[i]; return e[2] / 1000 / (e[4] ? 50 : SPEED[e[3]]); };

// Snelste route op reistijd; per startknoop wordt de hele boom gecachet (de vloot gebruikt ~100 startpunten).
const treeCache = new Map();
function tree(a) {
  let tr = treeCache.get(a); if (tr) return tr;
  const dist = new Float64Array(nodes.length).fill(Infinity), prev = new Int32Array(nodes.length).fill(-1), prevE = new Int32Array(nodes.length).fill(-1);
  dist[a] = 0; const h = new Heap(); h.push(0, a);
  while (h.size) {
    const [d, u] = h.pop(); if (d > dist[u]) continue; const nb = adj[u];
    for (let k = 0; k < nb.length; k += 2) { const v = nb[k], ei = nb[k + 1]; const nd = d + costOf(ei); if (nd < dist[v]) { dist[v] = nd; prev[v] = u; prevE[v] = ei; h.push(nd, v); } }
  }
  tr = { dist, prev, prevE }; treeCache.set(a, tr); return tr;
}
// Pad als lijst knoop-ids (zoals voorheen); de kanten worden in buildPath weer opgezocht.
export function shortestPath(a, b) {
  const { dist, prev } = tree(a);
  if (dist[b] === Infinity) return [a, b];
  const path = []; for (let c = b; c !== -1; c = prev[c]) path.unshift(c); return path;
}
function edgeBetween(u, v) { const nb = adj[u]; let best = -1, bl = Infinity; for (let k = 0; k < nb.length; k += 2) if (nb[k] === v && E[nb[k + 1]][2] < bl) { bl = E[nb[k + 1]][2]; best = nb[k + 1]; } return best; }

// Pad van knoop-ids naar aaneengesloten geometrie met cumulatieve kilometers.
export function buildPath(ids) {
  const pts = []; const cum = []; const nodeKm = [];
  const push = p => { if (pts.length) { const d = kmBetween(pts[pts.length - 1], p); if (d < 0.0005) return; cum.push(cum[cum.length - 1] + d); } else cum.push(0); pts.push(p); };
  push(nodes[ids[0]]); nodeKm.push(0);
  for (let i = 1; i < ids.length; i++) {
    const u = ids[i - 1], v = ids[i]; const ei = edgeBetween(u, v);
    if (ei < 0) { push(nodes[v]); } else { let g = edgeGeom(ei); if (E[ei][0] !== u) g = g.slice().reverse(); for (const p of g) push(p); }
    nodeKm.push(cum[cum.length - 1]);
  }
  return { pts, cum, nodeKm, total: cum[cum.length - 1] };
}

// Positie en koers (graden, 0 = noord, met de klok mee) op km langs het pad.
export function posAt(path, km) {
  const { pts, cum } = path; if (pts.length === 1) return { lon: pts[0][0], lat: pts[0][1], bearing: 0 };
  let lo = 1, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < km) lo = mid + 1; else hi = mid; }
  const i = Math.max(1, Math.min(lo, cum.length - 1));
  const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, t = Math.min(1, Math.max(0, (km - cum[i - 1]) / seg));
  const lon = a[0] + (b[0] - a[0]) * t, lat = a[1] + (b[1] - a[1]) * t;
  return { lon, lat, bearing: Math.atan2((b[0] - a[0]) * cl(lat), b[1] - a[1]) * 180 / Math.PI };
}
