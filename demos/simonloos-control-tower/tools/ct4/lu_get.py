# Landgebruik (Overture base/land_use) rond elke plek: voor het terrein van een standplaats of DC.
import os, sys, json, math, time, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq, pyarrow as pa
from urllib.parse import urlparse
rel, sitesf, out = sys.argv[1:4]
u = urlparse(os.environ.get('HTTPS_PROXY', 'http://127.0.0.1:37979'))
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options={'scheme': 'http', 'host': u.hostname, 'port': u.port}, request_timeout=120, connect_timeout=30)
d = ds.dataset(f'overturemaps-us-west-2/release/{rel}/theme=base/type=land_use/', filesystem=s3, format='parquet')
sites = json.load(open(sitesf)); tabs = []
for key, (lon, lat) in sites.items():
    R = 0.8; dy = R / 111.32; dx = R / (111.32 * math.cos(math.radians(lat)))
    f = (pc.field('bbox', 'xmax') > lon - dx) & (pc.field('bbox', 'xmin') < lon + dx) & (pc.field('bbox', 'ymax') > lat - dy) & (pc.field('bbox', 'ymin') < lat + dy)
    tb = d.to_table(filter=f, columns=['id', 'subtype', 'class', 'geometry'])
    tb = tb.append_column('site', pa.array([key] * tb.num_rows))
    tabs.append(tb); print(key, tb.num_rows, flush=True)
pq.write_table(pa.concat_tables(tabs), out)
