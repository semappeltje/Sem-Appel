# Bouwt de routeergraaf van tools/process2.py precies na (zelfde invoer, zelfde volgorde) en bewaart erbij:
# per knoop de Overture-connector, per kant de segmenten (met naam en wegnummer) waaruit hij bestaat.
# Daarna dezelfde ketens voor roads_display (secundair en tertiair), ook met hun segmenten.
import sys, json, math, collections, time, pickle
import pyarrow.parquet as pq, shapely.wkb, shapely
segsrc, graphjson, dispjson, outpk = sys.argv[1:5]
t0 = time.time()
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
CLS = {'motorway': 0, 'trunk': 1, 'primary': 2, 'secondary': 3, 'tertiary': 4}
T = pq.read_table(segsrc).to_pylist(); print('segments', len(T), flush=True)
pieces = []  # [cidA, cidB, km, cls, link, coords, segidx]
for si, s in enumerate(T):
    g = shapely.wkb.loads(s['geometry'])
    if g.geom_type != 'LineString': continue
    coords = [(round(x, 6), round(y, 6)) for x, y in g.coords]
    if len(coords) < 2: continue
    cum = [0.0]
    for i in range(1, len(coords)): cum.append(cum[-1] + km(coords[i - 1], coords[i]))
    L = cum[-1]
    if L <= 0: continue
    cons = sorted([(c['at'] if c.get('at') is not None else 0.0, c['connector_id']) for c in (s.get('connectors') or [])])
    if len(cons) < 2: continue
    cls = CLS[s['class']]; link = 1 if s.get('subclass') == 'link' else 0
    def at(frac):
        d = frac * L; i = 1
        while i < len(cum) - 1 and cum[i] < d: i += 1
        seg = cum[i] - cum[i - 1] or 1e-9; u = max(0, min(1, (d - cum[i - 1]) / seg)); a, b = coords[i - 1], coords[i]
        return (round(a[0] + (b[0] - a[0]) * u, 6), round(a[1] + (b[1] - a[1]) * u, 6)), i, d
    prev = None
    for frac, cid in cons:
        pt, idx, d = at(frac)
        if prev is not None:
            ppt, pidx, pd, pcid = prev
            if pcid != cid:
                mid = [c for k, c in enumerate(coords) if pidx <= k < idx and pd < cum[k] < d]
                geom = [ppt] + mid + [pt]; ln = sum(km(geom[i - 1], geom[i]) for i in range(1, len(geom)))
                pieces.append([pcid, cid, ln, cls, link, geom, [(si, ln)], [(pcid, 0), (cid, len(geom) - 1)]])
        prev = (pt, idx, d, cid)
print('pieces', len(pieces), round(time.time() - t0, 1), 's', flush=True)
def contract(pcs, same_class=True):
    adj = collections.defaultdict(list); edges = [list(p) for p in pcs]; alive = [True] * len(edges)
    for ei, e in enumerate(edges): adj[e[0]].append(ei); adj[e[1]].append(ei)
    other = lambda e, n: e[1] if e[0] == n else e[0]
    for n in list(adj.keys()):
        es = [ei for ei in adj[n] if alive[ei]]
        if len(es) != 2: continue
        e1, e2 = edges[es[0]], edges[es[1]]
        if same_class and (e1[3] != e2[3] or e1[4] != e2[4]): continue
        a = other(e1, n); b = other(e2, n)
        if a == n or b == n or a == b: continue
        g1 = e1[5] if e1[1] == n else e1[5][::-1]; g2 = e2[5] if e2[0] == n else e2[5][::-1]
        s1 = e1[6] if e1[1] == n else e1[6][::-1]; s2 = e2[6] if e2[0] == n else e2[6][::-1]
        L1, L2 = len(e1[5]), len(e2[5])
        c1 = e1[7] if e1[1] == n else [(c, L1 - 1 - i) for c, i in e1[7][::-1]]
        c2 = e2[7] if e2[0] == n else [(c, L2 - 1 - i) for c, i in e2[7][::-1]]
        alive[es[0]] = False; alive[es[1]] = False
        edges.append([a, b, e1[2] + e2[2], e1[3], e1[4], g1 + g2[1:], s1 + s2, c1 + [(c, i + L1 - 1) for c, i in c2[1:]]]); alive.append(True); ei = len(edges) - 1
        adj[a] = [x for x in adj[a] if alive[x]] + [ei]; adj[b] = [x for x in adj[b] if alive[x]] + [ei]; adj[n] = []
    return [e for e, al in zip(edges, alive) if al]
G = contract([p for p in pieces if p[3] <= 2])
par = {}
def find(x):
    while par.setdefault(x, x) != x: par[x] = par[par[x]]; x = par[x]
    return x
for e in G:
    ra, rb = find(e[0]), find(e[1])
    if ra != rb: par[ra] = rb
comp = collections.Counter(find(e[0]) for e in G); big = comp.most_common(1)[0][0]
G = [e for e in G if find(e[0]) == big]
cids = sorted({e[0] for e in G} | {e[1] for e in G}); remap = {c: i for i, c in enumerate(cids)}
nodes = [None] * len(cids)
for e in G:
    nodes[remap[e[0]]] = e[5][0]; nodes[remap[e[1]]] = e[5][-1]
gedges = []
for e in G:
    s = dp(e[5], 0.00003)
    gedges.append([remap[e[0]], remap[e[1]], round(e[2] * 1000), e[3], e[4], enc(s)])
graph = {'nodes': [[round(x, 5), round(y, 5)] for x, y in nodes], 'edges': gedges}
cur = json.load(open(graphjson))
same_nodes = cur['nodes'] == graph['nodes']; same_edges = cur['edges'] == graph['edges']
print('graaf nagebouwd: nodes', len(nodes), 'edges', len(gedges), '| gelijk aan graph.json: nodes', same_nodes, 'edges', same_edges, round(time.time() - t0, 1), 's', flush=True)
if not (same_nodes and same_edges):
    print('  huidige graaf', len(cur['nodes']), len(cur['edges']))
    for i, (a, b) in enumerate(zip(cur['edges'], gedges)):
        if a != b: print('  eerste verschil kant', i, a[:5], b[:5]); break
# weergave: secundair en tertiair
land = json.load(open(graphjson.replace('graph.json', 'land.json')))
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.prepared import prep
nlp = prep(MultiPolygon([Polygon(p[0], p[1:]) for p in land['nl']]).buffer(0.03))
disp = {3: [], 4: []}; dsegs = {3: [], 4: []}
for cls in (3, 4):
    ch = contract([p for p in pieces if p[3] == cls], same_class=False)
    for e in ch:
        g = e[5]; mid = g[len(g) // 2]
        if not nlp.contains(Point(mid)): continue
        s = dp(g, 0.00004 if cls == 3 else 0.00005)
        disp[cls].append(enc(s)); dsegs[cls].append((e[6], e[2], g))
dcur = json.load(open(dispjson))
print('weergave gelijk: sec', dcur['sec'] == disp[3], len(dcur['sec']), len(disp[3]), '| ter', dcur['ter'] == disp[4], len(dcur['ter']), len(disp[4]), round(time.time() - t0, 1), 's', flush=True)
meta = [{'id': s['id'], 'class': s['class'], 'names': (s.get('names') or {}).get('primary'), 'routes': [(r.get('ref'), r.get('network'), r.get('name')) for r in (s.get('routes') or [])]} for s in T]
pickle.dump({'cids': cids, 'G': [(e[0], e[1], e[2], e[3], e[4], e[6]) for e in G], 'gedges_geom': [e[5] for e in G], 'chains': [e[7] for e in G], 'disp': dsegs, 'meta': meta}, open(outpk, 'wb'))
print('klaar', round(time.time() - t0, 1), 's')
