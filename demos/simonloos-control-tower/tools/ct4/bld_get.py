# Gebouwen (Overture Buildings, release 2026-10-21.0) binnen ~1 km rond elke plek; één parquet per plek.
import os, sys, json, math, time, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq
from urllib.parse import urlparse
rel, sitesf, outdir = sys.argv[1:4]
u = urlparse(os.environ.get('HTTPS_PROXY', 'http://127.0.0.1:37979'))
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options={'scheme': 'http', 'host': u.hostname, 'port': u.port}, request_timeout=120, connect_timeout=30)
d = ds.dataset(f'overturemaps-us-west-2/release/{rel}/theme=buildings/type=building/', filesystem=s3, format='parquet')
cols = ['id', 'height', 'num_floors', 'subtype', 'class', 'is_underground', 'min_height', 'roof_shape', 'geometry', 'bbox']
sites = json.load(open(sitesf))
os.makedirs(outdir, exist_ok=True)
for key, (lon, lat) in sites.items():
    out = os.path.join(outdir, key.replace('/', '_').replace(' ', '_') + '.parquet')
    if os.path.exists(out): continue
    R = 1.0  # km
    dy = R / 111.32; dx = R / (111.32 * math.cos(math.radians(lat)))
    f = (pc.field('bbox', 'xmax') > lon - dx) & (pc.field('bbox', 'xmin') < lon + dx) & (pc.field('bbox', 'ymax') > lat - dy) & (pc.field('bbox', 'ymin') < lat + dy)
    t0 = time.time()
    tb = d.to_table(filter=f, columns=cols)
    pq.write_table(tb, out)
    print(key, tb.num_rows, round(time.time() - t0, 1), 's', flush=True)
