"""De landsgrens van Nederland uit Overture (divisions/division_boundary, subtype country), voor de basiskaart.
gebruik: grens_get.py <release> <werkmap>   schrijft <werkmap>/grens.parquet (alle landsgrenzen die het kader raken).
"""
import os, sys, time, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq
from urllib.parse import urlparse
u = urlparse(os.environ.get('HTTPS_PROXY', 'http://127.0.0.1:37979'))
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options={'scheme': 'http', 'host': u.hostname, 'port': u.port}, request_timeout=180, connect_timeout=30)
rel, out = sys.argv[1], sys.argv[2]
bb = (2.5, 50.5, 7.5, 54.0)
d = ds.dataset(f'overturemaps-us-west-2/release/{rel}/theme=divisions/type=division_boundary/', filesystem=s3, format='parquet')
filt = (pc.field('bbox', 'xmax') > bb[0]) & (pc.field('bbox', 'xmin') < bb[2]) & (pc.field('bbox', 'ymax') > bb[1]) & (pc.field('bbox', 'ymin') < bb[3]) & (pc.field('subtype') == 'country')
t0 = time.time()
t = d.to_table(filter=filt, columns=['id', 'subtype', 'class', 'is_land', 'is_territorial', 'is_disputed', 'division_ids', 'country', 'sources', 'geometry'])
pq.write_table(t, f'{out}/grens.parquet')
print('grens rijen', t.num_rows, round(time.time() - t0, 1), 's')
