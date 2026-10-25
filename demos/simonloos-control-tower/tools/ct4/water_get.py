"""Land en water van Overture (base/land en base/water) voor de basiskaart: alle vlakken die het kader raken (niet alleen
die er helemaal in liggen, zoals ov_get.py doet), zodat ook de stukken kust, zee en rivier op de rand meekomen.
gebruik: water_get.py <release> <werkmap> [xmin,ymin,xmax,ymax]
schrijft <werkmap>/land.parquet (base/land, subtype land: de kust uit de OpenStreetMap-kustlijn, eilanden) en
<werkmap>/water.parquet (base/water zonder sloten, beken, zwembaden en bronnen; lijnen vallen er later uit).
"""
import os, sys, time, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq
from urllib.parse import urlparse
u = urlparse(os.environ.get('HTTPS_PROXY', 'http://127.0.0.1:37979'))
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options={'scheme': 'http', 'host': u.hostname, 'port': u.port}, request_timeout=180, connect_timeout=30)
rel, out = sys.argv[1], sys.argv[2]
bb = tuple(map(float, sys.argv[3].split(','))) if len(sys.argv) > 3 else (1.8, 50.0, 8.6, 54.3)
os.makedirs(out, exist_ok=True)
hit = (pc.field('bbox', 'xmax') > bb[0]) & (pc.field('bbox', 'xmin') < bb[2]) & (pc.field('bbox', 'ymax') > bb[1]) & (pc.field('bbox', 'ymin') < bb[3])
SKIP = ['ditch', 'drain', 'stream', 'swimming_pool', 'reflecting_pool', 'fish_pass', 'spring', 'hot_spring', 'waterfall', 'sewage', 'wastewater', 'salt_pond', 'cape', 'peak']
for typ, filt, cols in (
    ('land', hit & (pc.field('subtype') == 'land'), ['id', 'subtype', 'class', 'names', 'sources', 'geometry']),
    ('water', hit & ~pc.field('class').isin(SKIP), ['id', 'subtype', 'class', 'names', 'is_salt', 'is_intermittent', 'sources', 'geometry']),
):
    d = ds.dataset(f'overturemaps-us-west-2/release/{rel}/theme=base/type={typ}/', filesystem=s3, format='parquet')
    cols = [c for c in cols if c in d.schema.names]
    t0 = time.time(); w = None; n = 0
    for b in d.scanner(filter=filt, columns=cols, batch_size=65536, use_threads=True).to_batches():
        if b.num_rows == 0: continue
        if w is None: w = pq.ParquetWriter(f'{out}/{typ}.parquet', b.schema)
        w.write_batch(b); n += b.num_rows
    if w: w.close()
    print(typ, 'rijen', n, round(time.time() - t0, 1), 's', flush=True)
