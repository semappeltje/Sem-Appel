# Splitst kanten van de routeergraaf waar een toegangsroute halverwege een kant uitkomt, en codeert de toegangsroutes.
# Uit: graph.json (nieuw, knopen en kanten alleen achteraan toegevoegd), toegang.pk {sleutel: (knoop, polyline, meters)}.
import sys, json, math, pickle, collections
graphjson, pk, accpk, outgraph, outacc, sitef = sys.argv[1:7]
SITE = json.load(open(sitef))
g = json.load(open(graphjson)); G = pickle.load(open(pk, 'rb')); R = pickle.load(open(accpk, 'rb'))
nodes, edges = g['nodes'], g['edges']
n0, e0 = len(nodes), len(edges)
chains, geoms = G['chains'], G['gedges_geom']
def km(a, b):
    cl = math.cos(math.radians((a[1] + b[1]) / 2)); return math.hypot((a[0] - b[0]) * cl * 111.32, (a[1] - b[1]) * 111.32)
def dp(pts, tol):
    if len(pts) < 3: return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]; dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy
    best, bi = 0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        if L2 == 0: d = math.hypot(x - x0, y - y0)
        else:
            t = ((x - x0) * dx + (y - y0) * dy) / L2; t = max(0, min(1, t)); d = math.hypot(x - (x0 + t * dx), y - (y0 + t * dy))
        if d > best: best, bi = d, i
    if best > tol: return dp(pts[:bi + 1], tol)[:-1] + dp(pts[bi:], tol)
    return [pts[0], pts[-1]]
def enc(pts):
    out = []; plat = plon = 0
    for lon, lat in pts:
        la, lo = round(lat * 1e5), round(lon * 1e5)
        for v, p in ((la, plat), (lo, plon)):
            d = v - p; d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20: out.append(chr((0x20 | (d & 0x1f)) + 63)); d >>= 5
            out.append(chr(d + 63))
        plat, plon = la, lo
    return ''.join(out)
splits = collections.defaultdict(set)
for k, v in R.items():
    if v and v['src'][0] == 'e': splits[v['src'][1]].add(v['src'][2])
newnode = {}; parent = {}  # nieuwe kant -> oorspronkelijke kant
dl = []
for E in sorted(splits):
    ks = sorted(splits[E]); C = chains[E]; Gm = geoms[E]
    a, b, m, cls, link, _ = edges[E]
    bnd = [0] + [C[k][1] for k in ks] + [len(Gm) - 1]
    ids = [a]
    for k in ks:
        x, y = Gm[C[k][1]]; nodes.append([round(x, 5), round(y, 5)]); newnode[(E, k)] = len(nodes) - 1; ids.append(len(nodes) - 1)
    ids.append(b)
    parts = []
    for j in range(len(bnd) - 1):
        seg = Gm[bnd[j]:bnd[j + 1] + 1]
        mm = round(sum(km(seg[i - 1], seg[i]) for i in range(1, len(seg))) * 1000)
        parts.append([ids[j], ids[j + 1], mm, cls, link, enc(dp(seg, 0.00003))])
    dl.append(sum(p[2] for p in parts) - m)
    edges[E] = parts[0]
    for p in parts[1:]: edges.append(p); parent[len(edges) - 1] = E
print('gesplitste kanten', len(splits), 'nieuwe knopen', len(nodes) - n0, 'nieuwe kanten', len(edges) - e0, '| lengteverschil (m) min/max', min(dl), max(dl))
json.dump({'nodes': nodes, 'edges': edges}, open(outgraph, 'w'), separators=(',', ':'))
out = {}; dmax = 0
for k, v in R.items():
    if not v: out[k] = None; continue
    s = v['src']; node = s[1] if s[0] == 'n' else newnode[(s[1], s[2])]
    pts = [tuple(nodes[node])] + [tuple(p) for p in v['pts'][1:]]
    # winkels, bezorgpunten en groothandels: de route eindigt op de weg (het klikpunt), niet in het gebouw
    # elke route eindigt op de weg (het klikpunt bij het adres), niet in het gebouw; bij een standplaats of DC is dat de poort
    if len(pts) > 2: pts = pts[:-1]
    dmax = max(dmax, km(v['pts'][0], nodes[node]) * 1000)
    sp = dp(pts, 0.00004)
    out[k] = (node, enc(sp), v['m'], len(sp))
print('max afstand bron-knoop (m)', round(dmax, 2))
pickle.dump({'acc': out, 'parent': parent, 'n0': n0, 'e0': e0}, open(outacc, 'wb'))
print('punten per toegangsroute gemiddeld', round(sum(v[3] for v in out.values() if v) / sum(1 for v in out.values() if v), 1), 'tekens', sum(len(v[1]) for v in out.values() if v))
