import sys, time, pyarrow as pa, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq
rel = sys.argv[1]; theme, typ = sys.argv[2], sys.argv[3]; out = sys.argv[4]
bbox = (3.2, 50.7, 7.3, 53.6)
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options={'scheme': 'http', 'host': '127.0.0.1', 'port': 41787})
path = f'overturemaps-us-west-2/release/{rel}/theme={theme}/type={typ}/'
t0 = time.time(); dataset = ds.dataset(path, filesystem=s3, format='parquet'); print('files', len(dataset.files), 'in', round(time.time() - t0, 1), 's', flush=True)
print([f.name for f in dataset.schema][:40], flush=True)
filt = (pc.field('bbox', 'xmin') > bbox[0]) & (pc.field('bbox', 'xmax') < bbox[2]) & (pc.field('bbox', 'ymin') > bbox[1]) & (pc.field('bbox', 'ymax') < bbox[3])
if typ == 'segment':
    filt = filt & (pc.field('subtype') == 'road') & pc.field('class').isin(['motorway', 'trunk', 'primary', 'secondary', 'tertiary'])
    cols = [c for c in ['id', 'class', 'subclass', 'names', 'connectors', 'geometry', 'speed_limits', 'routes'] if c in dataset.schema.names]
elif typ == 'water':
    filt = filt & pc.field('subtype').isin(['ocean', 'sea', 'lake', 'reservoir', 'river'])
    cols = [c for c in ['id', 'subtype', 'class', 'names', 'geometry'] if c in dataset.schema.names]
else:
    cols = None
t0 = time.time(); table = dataset.to_table(filter=filt, columns=cols); print('rows', table.num_rows, 'in', round(time.time() - t0, 1), 's', flush=True)
pq.write_table(table, out); print('written', out, flush=True)
