import re, json, glob, collections, os, sys
src = sys.argv[1]
rows = collections.defaultdict(list)
for f in sorted(glob.glob(os.path.join(src, 'pages', '*.html'))):
    t = open(f, encoding='utf-8', errors='ignore').read()
    found = False
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', t, re.S):
        try:
            j = json.loads(m.group(1))
        except Exception:
            continue
        items = j if isinstance(j, list) else [j]
        for it in list(items):
            if isinstance(it, dict) and '@graph' in it:
                items += it['@graph']
        for it in items:
            if isinstance(it, dict) and it.get('@type') == 'JobPosting':
                jl = it.get('jobLocation')
                jls = jl if isinstance(jl, list) else [jl]
                for l in jls:
                    if not l:
                        continue
                    a = l.get('address', {})
                    geo = l.get('geo')
                    key = ((a.get('addressLocality') or '').strip(), (a.get('streetAddress') or '').strip(), (a.get('postalCode') or '').strip())
                    rows[key].append((os.path.basename(f)[:-5], (it.get('datePosted') or '')[:10], json.dumps(geo) if geo else ''))
                    found = True
    if not found:
        print('GEEN JSON-LD', f)
json.dump({'|'.join(k): v for k, v in rows.items()}, open(os.path.join(src, 'jobloc.json'), 'w'), indent=1, ensure_ascii=False)
for k, v in sorted(rows.items()):
    print(k, len(v), [x[0] for x in v][:3], v[0][2])
