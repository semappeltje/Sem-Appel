# Bezorgpunten voor de boodschappenbezorging (alleen standplaatsen met divisie bezorg): per plaats binnen 40 km een paar
# woonstraten (BAG-adressen, Overture Addresses), als middelpunt van de straat; nooit een huisnummer.
import sys, json, math, collections
import pyarrow.parquet as pq, pyarrow.compute as pc, shapely, numpy as np
addrsrc, out = sys.argv[1], sys.argv[2]
centers = {'Wognum': (5.035636, 52.693504)}
R = 40.0
res = []
for sp, (lon, lat) in centers.items():
    dy = R / 111.32; dx = R / (111.32 * math.cos(math.radians(lat)))
    t = pq.read_table(addrsrc, columns=['street', 'postcode', 'address_levels', 'geometry'])
    g = shapely.from_wkb(t.column('geometry').to_numpy(zero_copy_only=False)); X = shapely.get_x(g); Y = shapely.get_y(g)
    m = (np.abs(X - lon) < dx) & (np.abs(Y - lat) < dy)
    idx = np.where(m)[0]
    st = t.column('street').to_pylist(); lv = t.column('address_levels').to_pylist(); pcs = t.column('postcode').to_pylist()
    grp = collections.defaultdict(list)
    for i in idx:
        d = math.hypot((X[i] - lon) * math.cos(math.radians(lat)) * 111.32, (Y[i] - lat) * 111.32)
        if d > R: continue
        city = (lv[i] or [{}])[0].get('value') if lv[i] else None
        if not city or not st[i]: continue
        grp[(city, st[i])].append((X[i], Y[i], (pcs[i] or '')[:4]))
    bycity = collections.defaultdict(list)
    for (city, s), pts in grp.items():
        if len(pts) < 40: continue
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        spread = max(math.hypot((x - cx) * 68, (y - cy) * 111) for x, y in zip(xs, ys))
        if spread > 0.9: continue  # lange linten en doorgaande wegen niet
        bycity[city].append((len(pts), s, cx, cy))
    tot = collections.Counter({c: sum(n for n, *_ in v) for c, v in bycity.items()})
    for city, v in bycity.items():
        if tot[city] < 600: continue
        v.sort(key=lambda x: (-x[0], x[1]))
        k = 3 if tot[city] > 8000 else 2
        for n, s, cx, cy in v[:k]:
            res.append({'id': f"bz-{len(res) + 1}", 'sp': sp, 'naam': f"Bezorgronde {city} ({s})", 'plaats': city, 'straat': s, 'lon': round(cx, 6), 'lat': round(cy, 6), 'adressen': n})
print(len(res), 'bezorgpunten in', len({r['plaats'] for r in res}), 'plaatsen')
for r in res[:12]: print('  ', r['naam'], r['adressen'])
json.dump(res, open(out, 'w'), ensure_ascii=False)
