# plaatsen (Overture Places) binnen een straal rond punten; ook zoeken op naam
import sys, json, math, re
import pyarrow.parquet as pq, pyarrow.compute as pc, shapely, numpy as np
src, mode = sys.argv[1], sys.argv[2]
t = pq.read_table(src, columns=['id', 'names', 'brand', 'basic_category', 'taxonomy', 'addresses', 'geometry', 'operating_status', 'confidence'])
names = t.column('names').combine_chunks().field('primary').to_numpy(zero_copy_only=False)
geom = shapely.from_wkb(t.column('geometry').to_numpy(zero_copy_only=False))
X = shapely.get_x(geom); Y = shapely.get_y(geom)
cat = t.column('basic_category').to_numpy(zero_copy_only=False)
tax = t.column('taxonomy').combine_chunks().field('primary').to_numpy(zero_copy_only=False)
ops = t.column('operating_status').to_numpy(zero_copy_only=False)
addr = t.column('addresses').to_pylist()
def show(i, d=None):
    a = addr[i][0] if addr[i] else {}
    print(f"   {d if d is not None else '':>6} {names[i]!s:50.50} | {cat[i]!s:28.28} | {tax[i]!s:28.28} | {ops[i]!s:10.10} | {a.get('freeform')} {a.get('postcode')} {a.get('locality')} | {Y[i]:.6f},{X[i]:.6f}")
if mode == 'near':
    pts = json.load(open(sys.argv[3])); R = float(sys.argv[4])
    for n, p in pts.items():
        cl = math.cos(math.radians(p['lat']))
        d = np.hypot((X - p['lon']) * cl * 111320, (Y - p['lat']) * 111320)
        idx = np.where(d < R)[0]
        idx = idx[np.argsort(d[idx])]
        print('==', n, p.get('straat'), p.get('nr'), p.get('postcode'), len(idx))
        for i in idx[:25]: show(i, int(d[i]))
elif mode == 'name':
    pat = re.compile(sys.argv[3], re.I)
    hits = [i for i, n in enumerate(names) if n and pat.search(n)]
    print('hits', len(hits))
    for i in hits[:int(sys.argv[4]) if len(sys.argv) > 4 else 200]: show(i)
