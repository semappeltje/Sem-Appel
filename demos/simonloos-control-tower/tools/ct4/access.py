# Toegangsroutes (de laatste kilometers) van elke standplaats, winkel, DC en elk bezorgpunt naar de routeergraaf.
# Over het volledige wegennet van Overture (alle wegklassen voor auto's), met een Dijkstra vanuit alle connectors van de
# routeergraaf tegelijk. Komt een toegangsroute uit op een punt midden op een kant van de graaf (een kruising die bij het
# samenvoegen van de graaf is weggevallen), dan wordt die kant daar gesplitst: een nieuwe knoop, de rest van de kant als
# nieuwe kant achteraan. Bestaande knoop- en kantnummers veranderen niet.
import sys, json, math, time, pickle, heapq, collections
import numpy as np, pyarrow.parquet as pq, pyarrow.compute as pc, shapely
from shapely import STRtree
roads, pk, graphjson, targetsf, outdir = sys.argv[1:6]
T0 = time.time()
def log(*a): print(*a, round(time.time() - T0, 1), 's', flush=True)
DRIVE = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service']
SPD = {'motorway': 25.0, 'trunk': 22.0, 'primary': 19.0, 'secondary': 16.0, 'tertiary': 13.5, 'unclassified': 12.0, 'residential': 8.5, 'living_street': 4.0, 'service': 5.0}
t = pq.read_table(roads, columns=['id', 'class', 'subclass', 'connectors', 'geometry'], filters=[('class', 'in', DRIVE)])
N = t.num_rows; log('segmenten', N)
cls = t.column('class').to_numpy(zero_copy_only=False); sub = t.column('subclass').to_numpy(zero_copy_only=False)
geoms = shapely.from_wkb(t.column('geometry').to_numpy(zero_copy_only=False))
coords, gi = shapely.get_coordinates(geoms, return_index=True)
same = gi[1:] == gi[:-1]
cl = np.cos(np.radians((coords[1:, 1] + coords[:-1, 1]) / 2))
d = np.hypot(np.diff(coords[:, 0]) * cl * 111320, np.diff(coords[:, 1]) * 111320) * same
seglen = np.bincount(gi[1:], weights=d, minlength=N)
log('lengtes')
conn = t.column('connectors').combine_chunks()
parent = pc.list_parent_indices(conn).to_numpy()
flat = pc.list_flatten(conn)
cidstr = flat.field('connector_id')
at = pc.fill_null(flat.field('at'), 0.0).to_numpy(zero_copy_only=False)
uniq = pc.unique(cidstr)
cint = pc.index_in(cidstr, value_set=uniq).to_numpy(zero_copy_only=False).astype(np.int64)
M = len(uniq); log('connectors', M)
order = np.lexsort((at, parent))
P, A_, AT = parent[order], cint[order], at[order]
ok = (P[:-1] == P[1:]) & (A_[:-1] != A_[1:])
pseg = P[:-1][ok]; pa_ = A_[:-1][ok]; pb_ = A_[1:][ok]; pat0 = AT[:-1][ok]; pat1 = AT[1:][ok]
plen = np.maximum(0.0, (pat1 - pat0)) * seglen[pseg]
spd = np.array([SPD[c] for c in cls])[pseg]
slow = np.isin(sub[pseg], ['driveway', 'parking_aisle'])
spd = np.where(slow, 3.0, spd)
pw = plen / spd
NP = len(pseg); log('stukken', NP)
# stukken per segment (gesorteerd op at0)
pstart = np.searchsorted(pseg, np.arange(N + 1))
# bronnen: connectors van de graaf (knopen en tussenpunten van kanten)
G = pickle.load(open(pk, 'rb'))
gc = G['cids']; chains = G['chains']
src_n = pc.index_in(np.array(gc, dtype=object), value_set=uniq).to_numpy(zero_copy_only=False)
print('graafknopen zonder connector in het wegennet:', int(np.sum(np.isnan(src_n.astype(float)))) if src_n.dtype == object else 0)
srcinfo = {}  # connector-int -> ('n', knoop) of ('e', kant, pos)
for i, c in enumerate(src_n):
    if c is None or (isinstance(c, float) and math.isnan(c)): continue
    srcinfo[int(c)] = ('n', i)
inner = [(c, e, k) for e, ch in enumerate(chains) for k, (c, ci) in enumerate(ch) if 0 < k < len(ch) - 1]
ic = pc.index_in(np.array([x[0] for x in inner], dtype=object), value_set=uniq).to_numpy(zero_copy_only=False)
for (c, e, k), v in zip(inner, ic):
    if v is None or (isinstance(v, float) and math.isnan(v)): continue
    v = int(v)
    if v not in srcinfo: srcinfo[v] = ('e', e, k)
log('bronnen', len(srcinfo), 'waarvan knopen', sum(1 for v in srcinfo.values() if v[0] == 'n'))
# CSR
src = np.concatenate([pa_, pb_]); dst = np.concatenate([pb_, pa_]); w = np.concatenate([pw, pw]); pid = np.concatenate([np.arange(NP), np.arange(NP)])
o = np.argsort(src, kind='stable'); dst = dst[o]; w = w[o]; pid = pid[o]
indptr = np.zeros(M + 1, dtype=np.int64); np.add.at(indptr, src[o] + 1, 1); indptr = np.cumsum(indptr)
log('csr')
dist = [math.inf] * M; pred = [-1] * M; srcof = [-1] * M
h = []
for c in srcinfo:
    dist[c] = 0.0; srcof[c] = c; h.append((0.0, c))
heapq.heapify(h)
IP = indptr.tolist(); DS = dst.tolist(); WL = w.tolist(); PI = pid.tolist()
pop, push = heapq.heappop, heapq.heappush
n_pop = 0
while h:
    du, u = pop(h)
    if du > dist[u]: continue
    n_pop += 1
    s_ = srcof[u]
    for k in range(IP[u], IP[u + 1]):
        v = DS[k]; nd = du + WL[k]
        if nd < dist[v]:
            dist[v] = nd; pred[v] = PI[k]; srcof[v] = s_; push(h, (nd, v))
log('dijkstra klaar, bezocht', n_pop)
# projectie in meters (lokaal vlak), voor het vastklikken en voor deelstukken
LON0, LAT0 = 5.3, 52.2; KX = math.cos(math.radians(LAT0)) * 111320; KY = 111320.0
def fwd(xy): return np.column_stack([(xy[:, 0] - LON0) * KX, (xy[:, 1] - LAT0) * KY])
def inv(xy): return np.column_stack([xy[:, 0] / KX + LON0, xy[:, 1] / KY + LAT0])
snapcls = np.isin(cls, ['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service']) & (sub != 'link')
snapidx = np.where(snapcls)[0]
gp = shapely.transform(geoms[snapidx], fwd)
tree = STRtree(gp); log('strtree', len(snapidx))
targets = json.load(open(targetsf))
keys = list(targets.keys())
tp = fwd(np.array([targets[k] for k in keys], dtype=float))
pts = shapely.points(tp)
qi, qd = tree.query_nearest(pts, max_distance=1500.0, return_distance=True, all_matches=False)
near = {}
for (ti, gj), dd in zip(qi.T, qd): near.setdefault(int(ti), (int(gj), float(dd)))
log('vastgeklikt', len(near), 'van', len(keys))
def piece_geom(p, frm_at, to_at):
    s = pseg[p]; L = shapely.transform(geoms[s], fwd)
    a, b = min(frm_at, to_at), max(frm_at, to_at)
    g = shapely.ops.substring(L, a, b, normalized=True) if hasattr(shapely, 'ops') else None
    return g
import shapely.ops as sops
def sub_xy(s, a0, a1):
    L = shapely.transform(geoms[s], fwd); lo, hi = (a0, a1) if a0 <= a1 else (a1, a0)
    g = sops.substring(L, lo, hi, normalized=True)
    xy = shapely.get_coordinates(g)
    if a0 > a1: xy = xy[::-1]
    return xy
res = {}; stat = collections.Counter()
def reach(gj):
    s = int(snapidx[gj]); return any(math.isfinite(dist[pa_[p]]) or math.isfinite(dist[pb_[p]]) for p in range(pstart[s], pstart[s + 1]))
for ti, k in enumerate(keys):
    if ti not in near: stat['niet vastgeklikt'] += 1; continue
    gj, dd = near[ti]
    if not reach(gj):
        cand = tree.query(shapely.buffer(pts[ti], 600.0))
        cand = sorted(cand, key=lambda j: shapely.distance(gp[j], pts[ti]))
        alt = next((j for j in cand if reach(j)), None)
        if alt is not None: gj = int(alt); dd = float(shapely.distance(gp[gj], pts[ti])); stat['tweede keus'] += 1
    s = int(snapidx[gj])
    Lp = gp[gj]; f = Lp.project(pts[ti], normalized=True) if Lp.length > 0 else 0.0
    ps = range(pstart[s], pstart[s + 1])
    if not len(ps): stat['segment zonder stukken'] += 1; continue
    best = None
    for p in ps:
        a0, a1 = pat0[p], pat1[p]
        if a0 - 1e-9 <= f <= a1 + 1e-9 or best is None:
            ff = min(max(f, a0), a1)
            ca = dist[pa_[p]] + (ff - a0) * seglen[s] / spd[p]; cb = dist[pb_[p]] + (a1 - ff) * seglen[s] / spd[p]
            cand = (ca, p, 'a', ff) if ca <= cb else (cb, p, 'b', ff)
            if a0 - 1e-9 <= f <= a1 + 1e-9:
                best = cand; break
            if best is None or cand[0] < best[0]: best = cand
    cost, p, side, ff = best
    if not math.isfinite(cost): stat['onbereikbaar'] += 1; res[k] = None; continue
    # pad: doel -> klikpunt -> langs het stuk naar zijn eind -> terug via pred naar de bron
    xy = [tp[ti], np.array(shapely.get_coordinates(shapely.ops.substring(Lp, ff, ff, normalized=True))[0]) if False else None]
    snap = shapely.get_coordinates(Lp.interpolate(ff, normalized=True))[0]
    path = [tp[ti], snap]
    c = int(pa_[p]) if side == 'a' else int(pb_[p])
    part = sub_xy(s, ff, pat0[p] if side == 'a' else pat1[p]); path.extend(part[1:])
    guard = 0
    while srcof[c] != c or c not in srcinfo:
        q = pred[c]
        if q < 0: break
        if pb_[q] == c: nxt = int(pa_[q]); part = sub_xy(int(pseg[q]), pat1[q], pat0[q])
        else: nxt = int(pb_[q]); part = sub_xy(int(pseg[q]), pat0[q], pat1[q])
        path.extend(part[1:]); c = nxt; guard += 1
        if guard > 5000: break
    if c not in srcinfo: stat['geen bron bereikt'] += 1; res[k] = None; continue
    P2 = np.array(path); m = float(np.sum(np.hypot(*np.diff(P2, axis=0).T))) if len(P2) > 1 else 0.0
    ll = inv(P2[::-1])  # van de bron naar het doel
    res[k] = {'src': srcinfo[c], 'pts': ll.tolist(), 'm': round(m), 'snap': round(dd), 'cost': round(cost)}
    stat['ok'] += 1
log('toegangsroutes', dict(stat))
pickle.dump(res, open(outdir + '/access_raw.pk', 'wb'))
ms = sorted(v['m'] for v in res.values() if v)
print('lengte toegangsroute (m): mediaan', ms[len(ms) // 2], 'p90', ms[int(len(ms) * 0.9)], 'max', ms[-1])
print('vastklikafstand (m) p90', sorted(v['snap'] for v in res.values() if v)[int(len(ms) * 0.9)])
print('splitsingen nodig', len({(v['src'][1], v['src'][2]) for v in res.values() if v and v['src'][0] == 'e'}))
