import os, sys, pyarrow.fs as fs
from urllib.parse import urlparse
u = urlparse(os.environ.get('HTTPS_PROXY', 'http://127.0.0.1:37979'))
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options={'scheme': 'http', 'host': u.hostname, 'port': u.port})
path = sys.argv[1] if len(sys.argv) > 1 else 'overturemaps-us-west-2/release/'
for f in s3.get_file_info(fs.FileSelector(path, recursive=False)):
    print(f.path, f.type, f.size)
