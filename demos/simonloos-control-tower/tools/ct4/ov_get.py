"""Overture-data ophalen via S3 door de proxy.
gebruik: ov_get.py <release> <theme> <type> <uit.parquet> <xmin,ymin,xmax,ymax> <kolom,kolom,...> [extra]
extra: 'roads' (alle wegklassen voor auto's), 'nl' (alleen country == NL, voor addresses)
"""
import os, sys, time, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq
from urllib.parse import urlparse
u = urlparse(os.environ.get('HTTPS_PROXY', 'http://127.0.0.1:37979'))
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options={'scheme': 'http', 'host': u.hostname, 'port': u.port}, request_timeout=120, connect_timeout=30)
rel, theme, typ, out, bb, cols = sys.argv[1:7]
extra = sys.argv[7] if len(sys.argv) > 7 else ''
bbox = tuple(map(float, bb.split(',')))
d = ds.dataset(f'overturemaps-us-west-2/release/{rel}/theme={theme}/type={typ}/', filesystem=s3, format='parquet')
filt = (pc.field('bbox', 'xmin') > bbox[0]) & (pc.field('bbox', 'xmax') < bbox[2]) & (pc.field('bbox', 'ymin') > bbox[1]) & (pc.field('bbox', 'ymax') < bbox[3])
if extra == 'roads':
    filt = filt & (pc.field('subtype') == 'road')
if extra == 'nl':
    filt = filt & (pc.field('country') == 'NL')
cols = [c for c in cols.split(',') if c in d.schema.names]
t0 = time.time()
sc = d.scanner(filter=filt, columns=cols, batch_size=65536, use_threads=True)
w = None; n = 0
for b in sc.to_batches():
    if b.num_rows == 0:
        continue
    if w is None:
        w = pq.ParquetWriter(out, b.schema)
    w.write_batch(b); n += b.num_rows
if w: w.close()
print(theme, typ, 'rows', n, round(time.time() - t0, 1), 's', flush=True)
