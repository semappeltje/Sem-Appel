# QA-plaatje per plek: gebouwen, terrein, parkeerplekken, toegangsroute en wegen (PIL).
import sys, json, math, pickle
from PIL import Image, ImageDraw
import pyarrow.parquet as pq, shapely, numpy as np
terr = json.load(open(sys.argv[1])); bld = json.load(open(sys.argv[2])); acc = pickle.load(open(sys.argv[3], 'rb'))['acc']
roads = sys.argv[4]; outdir = sys.argv[5]; keys = sys.argv[6:]
def dec(s):
    i = 0; lat = lon = 0; out = []
    while i < len(s):
        r = sh = 0
        while True:
            b = ord(s[i]) - 63; i += 1; r |= (b & 31) << sh; sh += 5
            if b < 32: break
        lat += ~(r >> 1) if r & 1 else r >> 1
        r = sh = 0
        while True:
            b = ord(s[i]) - 63; i += 1; r |= (b & 31) << sh; sh += 5
            if b < 32: break
        lon += ~(r >> 1) if r & 1 else r >> 1
        out.append((lon / 1e5, lat / 1e5))
    return out
RD = pq.read_table(roads, columns=['class', 'geometry'], filters=[('class', 'in', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service'])])
rg = shapely.from_wkb(RD.column('geometry').to_numpy(zero_copy_only=False)); rc = RD.column('class').to_numpy(zero_copy_only=False)
tree = shapely.STRtree(rg)
for key in keys:
    T = terr[key]; ring = T['terrein']
    cx = sum(p[0] for p in ring) / len(ring); cy = sum(p[1] for p in ring) / len(ring)
    S = 1000; R = 700.0
    KX = math.cos(math.radians(cy)) * 111320; KY = 111320
    def px(lon, lat): return ((lon - cx) * KX / R * S / 2 + S / 2, S / 2 - (lat - cy) * KY / R * S / 2)
    im = Image.new('RGB', (S, S), (246, 247, 249)); d = ImageDraw.Draw(im)
    dlon = R / KX; dlat = R / KY
    for j in tree.query(shapely.box(cx - dlon, cy - dlat, cx + dlon, cy + dlat)):
        w = {'motorway': 6, 'trunk': 5, 'primary': 4, 'secondary': 3, 'tertiary': 3}.get(rc[j], 1)
        d.line([px(x, y) for x, y in shapely.get_coordinates(rg[j])], fill=(200, 204, 210), width=w)
    for b in bld.get(key, []):
        d.polygon([px(*p) for p in b['p']], fill=(255, 205, 210) if b.get('d') else (215, 218, 224), outline=(150, 40, 50) if b.get('d') else (170, 175, 182))
    d.line([px(*p) for p in ring + ring[:1]], fill=(37, 99, 235), width=3)
    d.polygon([px(*p) for p in T['hoofd']], outline=(227, 0, 31), width=3)
    for r in T['rijen']:
        n = r[4]
        for k in range(n):
            f = k / max(1, n - 1); x = r[0] + (r[2] - r[0]) * f; y = r[1] + (r[3] - r[1]) * f
            br = math.radians(r[5]); ex = math.sin(br) * 8.25 / KX; ey = math.cos(br) * 8.25 / KY
            d.line([px(x - ex, y - ey), px(x + ex, y + ey)], fill=(22, 163, 74), width=2)
    a = acc.get(key.replace('sp:', 'sp:'))
    if a:
        pts = dec(a[1]); d.line([px(*p) for p in pts], fill=(217, 119, 6), width=4)
        d.ellipse([px(*pts[0])[0] - 6, px(*pts[0])[1] - 6, px(*pts[0])[0] + 6, px(*pts[0])[1] + 6], fill=(0, 0, 0))
    d.text((10, 10), f"{key}  terrein {T['terreinM2']} m2 ({T['terreinBron']})  plekken {T['plekken']}  verruimd {T['verruimd']} m", fill=(20, 20, 20))
    im.save(f"{outdir}/qa_{key.replace(':', '_').replace(' ', '_')}.png")
    print('ok', key)
