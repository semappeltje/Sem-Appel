import os, sys, time, pyarrow.dataset as ds, pyarrow.fs as fs
from urllib.parse import urlparse
u = urlparse(os.environ.get('HTTPS_PROXY', 'http://127.0.0.1:37979'))
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options={'scheme': 'http', 'host': u.hostname, 'port': u.port})
rel, theme, typ = sys.argv[1:4]
t0 = time.time()
d = ds.dataset(f'overturemaps-us-west-2/release/{rel}/theme={theme}/type={typ}/', filesystem=s3, format='parquet')
print('files', len(d.files), round(time.time() - t0, 1), 's')
print(d.schema.to_string(show_schema_metadata=False))
