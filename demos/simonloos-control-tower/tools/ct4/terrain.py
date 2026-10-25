# Terrein, parkeerrijen en gebouwen per standplaats en DC.
# Terrein: het landgebruiksvlak (Overture base/land_use) waarin het hoofdgebouw ligt, als dat de maat van één bedrijf
# heeft; anders de kleinste gedraaide rechthoek om het hoofdgebouw en de aangrenzende gebouwen, 30 m ruimer.
# Parkeerrijen: rijen evenwijdig aan de lange kant van het hoofdgebouw, plekken van 4 m breed en 16,5 m diep, binnen het
# terrein en 4 m van elk gebouw. Gebouwen: Overture Buildings binnen 900 m, vereenvoudigd op 1 m.
import sys, os, json, math, collections
import numpy as np, pyarrow.parquet as pq, shapely
from shapely.geometry import Point, Polygon, MultiPolygon, LineString, box
sitesf, blddir, luf, out_t, out_b = sys.argv[1:6]
budget = int(sys.argv[6]); SMALLR = float(sys.argv[8]); sites_need = json.load(open(sys.argv[9]))
sites = json.load(open(sitesf))
LU = pq.read_table(luf)
lu_site = LU.column('site').to_pylist(); lu_sub = LU.column('subtype').to_pylist(); lu_cls = LU.column('class').to_pylist()
lu_geom = shapely.from_wkb(LU.column('geometry').to_numpy(zero_copy_only=False))
bysite = collections.defaultdict(list)
for i, s in enumerate(lu_site): bysite[s].append(i)
SITECLS = {'industrial', 'commercial', 'retail', 'warehouse', 'logistics', 'depot', 'yard', 'garages', 'brownfield', 'construction', None}
T = {}; B = {}; stat = collections.Counter()
RD = pq.read_table(sys.argv[7], columns=['class', 'subclass', 'geometry'], filters=[('class', 'in', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service'])])
rd_cls = RD.column('class').to_numpy(zero_copy_only=False); rd_sub = RD.column('subclass').to_numpy(zero_copy_only=False)
rd_g = shapely.from_wkb(RD.column('geometry').to_numpy(zero_copy_only=False)); rd_tree = shapely.STRtree(rd_g)
RW = {'motorway': 14, 'trunk': 12, 'primary': 10, 'secondary': 8, 'tertiary': 7, 'unclassified': 5.5, 'residential': 5, 'living_street': 4, 'service': 3.5}
def rnd(v, k=6): return round(float(v), k)
for key, (lon, lat) in sites.items():
    KX = math.cos(math.radians(lat)) * 111320; KY = 111320.0
    fwd = lambda xy: np.column_stack([(xy[:, 0] - lon) * KX, (xy[:, 1] - lat) * KY])
    inv = lambda xy: np.column_stack([xy[:, 0] / KX + lon, xy[:, 1] / KY + lat])
    f = os.path.join(blddir, key.replace('/', '_').replace(' ', '_') + '.parquet')
    t = pq.read_table(f)
    g = shapely.from_wkb(t.column('geometry').to_numpy(zero_copy_only=False))
    und = t.column('is_underground').to_pylist()
    keep = np.array([not u for u in und]) & np.isin(shapely.get_type_id(g), [3, 6])
    t = t.filter(keep); g = g[keep]
    gp = shapely.make_valid(shapely.transform(g, fwd))
    area = shapely.area(gp); pt = Point(0, 0)
    dist = shapely.distance(gp, pt)
    h = t.column('height').to_pylist(); fl = t.column('num_floors').to_pylist(); bcls = t.column('class').to_pylist()
    # hoofdgebouw
    inside = np.where(dist == 0)[0]
    if len(inside): main = int(inside[np.argmax(area[inside])])
    else:
        c = np.where(dist < 150)[0]
        main = int(c[np.argmax(area[c] / (1 + dist[c] / 20))]) if len(c) else None
    if main is None: stat['geen hoofdgebouw'] += 1; continue
    if area[main] < 6000:
        big = [i for i in np.where(dist < 200)[0] if area[i] >= 3 * area[main] and area[i] >= 2500 and gp[i].distance(gp[main]) < 40]
        if big:
            main = int(max(big, key=lambda i: area[i] / (1 + gp[i].distance(gp[main]) / 10))); stat['hal naast het adres'] += 1
    mg = gp[main]; ma = area[main]
    # terrein uit landgebruik
    best = None
    for i in bysite.get(key, []):
        lg = lu_geom[i]
        if lg.geom_type not in ('Polygon', 'MultiPolygon'): continue
        lgp = shapely.make_valid(shapely.transform(lg, fwd))
        if not lgp.contains(mg.representative_point()): continue
        a = lgp.area
        if a < ma * 1.08 or a > 250000 or ma / a < 0.18: continue
        if lu_sub[i] not in ('developed', None) and lu_cls[i] not in SITECLS: continue
        if best is None or a < best[0]: best = (a, lgp, lu_sub[i], lu_cls[i])
    if best:
        terr = best[1]
        if terr.geom_type == 'MultiPolygon': terr = max(terr.geoms, key=lambda q: q.area)
        terr = Polygon(terr.exterior).simplify(1.5); src = f'landgebruik {best[2]}/{best[3]}'; stat['terrein uit landgebruik'] += 1
    else:
        near = [i for i in np.where(dist < 300)[0] if area[i] >= 60 and gp[i].distance(mg) < 8]
        cl = shapely.union_all([gp[i] for i in near] + [mg])
        terr = cl.buffer(30, join_style='mitre').minimum_rotated_rectangle; src = 'rechthoek om de gebouwen + 30 m'; stat['terrein als rechthoek'] += 1
    if not terr.is_valid or terr.is_empty: terr = mg.buffer(30).minimum_rotated_rectangle
    ring = np.array(terr.exterior.coords)
    if Polygon(ring).exterior.is_ccw is False: ring = ring[::-1]
    # gebouwen op het terrein
    onsite = [i for i in np.where(dist < 1200)[0] if gp[i].intersection(terr).area > 0.5 * area[i]]
    # parkeerrijen
    mr = mg.minimum_rotated_rectangle; c = np.array(mr.exterior.coords)[:4]
    e1, e2 = c[1] - c[0], c[2] - c[1]
    ax = e1 if np.hypot(*e1) >= np.hypot(*e2) else e2; ang = math.atan2(ax[1], ax[0])
    u = np.array([math.cos(ang), math.sin(ang)]); v = np.array([-u[1], u[0]])
    R_ = 0.012; qi = rd_tree.query(box(lon - R_ * 1.6, lat - R_, lon + R_ * 1.6, lat + R_))
    pub = [shapely.transform(rd_g[j], fwd).buffer(RW.get(rd_cls[j], 4)) for j in qi if not (rd_cls[j] == 'service' and rd_sub[j] in ('parking_aisle', 'driveway', None))]
    roads_u = shapely.union_all(pub) if pub else Polygon()
    blds = shapely.union_all([gp[i] for i in np.where(dist < 1500)[0] if gp[i].intersects(terr.buffer(120))]).buffer(4)
    need = int(sites_need.get(key, 60))
    mc = np.array(mg.centroid.coords)[0]
    def find_rows(area_):
        free = area_.difference(blds).difference(roads_u)
        out = []
        if free.is_empty: return out
        P = np.array(area_.exterior.coords); pu = P @ u; pv = P @ v
        for vv in np.arange(pv.min() + 9, pv.max() - 8, 20.0):
            run = []
            us = list(np.arange(pu.min() + 2, pu.max() - 2, 4.0))
            for j, uu in enumerate(us):
                cen = u * uu + v * vv
                fp = Polygon([cen - u * 1.6 - v * 8.25, cen + u * 1.6 - v * 8.25, cen + u * 1.6 + v * 8.25, cen - u * 1.6 + v * 8.25])
                ok = free.contains(fp)
                if ok: run.append(cen)
                if (not ok or j == len(us) - 1):
                    if len(run) >= 3: out.append((run[0], run[-1], len(run)))
                    run = []
        return out
    rows = find_rows(terr.buffer(-3)); ext = 0
    while sum(r[2] for r in rows) < need and ext < 1:
        ext += 1; rows = find_rows(terr.buffer(40 * ext, join_style='mitre'))
    if ext: stat['terrein voor parkeren verruimd'] += 1
    rows.sort(key=lambda r: mg.distance(Point((r[0] + r[1]) / 2)))
    def rbear(r):
        mid = (r[0] + r[1]) / 2; side = 1 if (mid - mc) @ v >= 0 else -1; d_ = v * side
        return round((math.degrees(math.atan2(d_[0], d_[1])) + 360) % 360, 1)
    nslots = sum(r[2] for r in rows)
    # poort: midden van de parkeerrij die het dichtst bij het hoofdgebouw ligt (daar komt de toegangsroute uit)
    if rows: gate = (rows[0][0] + rows[0][1]) / 2
    else:
        bp = mg.exterior.interpolate(mg.exterior.project(Point(0, 0))); vv_ = np.array(bp.coords[0]) - np.array(mg.centroid.coords[0])
        gate = np.array(bp.coords[0]) + vv_ / (np.hypot(*vv_) or 1) * 12
    T[key] = {'terrein': [[rnd(x), rnd(y)] for x, y in inv(ring)], 'terreinBron': src, 'hoofd': [[rnd(x), rnd(y)] for x, y in inv(np.array(shapely.simplify(mg, 1.0).exterior.coords if mg.geom_type == 'Polygon' else max(mg.geoms, key=lambda q: q.area).exterior.coords))],
              'hoofdM2': round(ma), 'terreinM2': round(terr.area), 'gebouwenOpTerrein': len(onsite),
              'rijen': [[rnd(a), rnd(b), rnd(c_), rnd(d_), n, rbear((p0, p1))] for (p0, p1, n) in rows for (a, b), (c_, d_) in [tuple(map(tuple, inv(np.array([p0, p1]))))]],
              'plekken': nslots, 'verruimd': ext * 40, 'poort': [rnd(x) for x in inv(np.array([gate]))[0]]}
    # gebouwen binnen 900 m
    onset = set(onsite)
    sel = [i for i in np.where(dist < 900)[0] if i in onset or area[i] >= 400 or dist[i] < SMALLR]
    sel.sort(key=lambda i: (0 if i in onset else 1, dist[i] if area[i] < 400 else dist[i] * 0.6))
    lst = []
    for i in sel[:budget]:
        q = shapely.simplify(gp[i], 1.0)
        if q.is_empty: continue
        if q.geom_type == 'MultiPolygon': q = max(q.geoms, key=lambda z: z.area)
        if q.geom_type != 'Polygon' or q.area < 4: continue
        xy = np.array(q.exterior.coords)[:-1]
        if len(xy) < 3: continue
        ll = inv(xy)
        hh = h[i] if h[i] and h[i] > 0.5 else (fl[i] * 3.2 if fl[i] else 6.0)
        hh = round(float(hh) * 2) / 2; hh = int(hh) if hh == int(hh) else hh
        o = {'p': [[round(float(x), 5), round(float(y), 5)] for x, y in ll], 'h': hh}
        if i in onsite: o['d'] = 1
        lst.append(o)
    B[key] = lst
    stat['gebouwen'] += len(lst)
    print(key, src, 'hoofd', round(ma), 'm2 terrein', round(terr.area), 'm2 plekken', nslots, 'gebouwen', len(lst), flush=True)
json.dump(T, open(out_t, 'w'), ensure_ascii=False)
s = json.dumps(B, separators=(',', ':')); open(out_b, 'w').write(s)
print(dict(stat), 'buildings.json', len(s) // 1024, 'kB')
