# Stap 2 voor de winkels: ontdubbelen op adres, positie op het BAG-adrespunt (Overture Addresses), namen netjes.
import sys, json, re, math, collections
import pyarrow.parquet as pq, shapely
raw, addrsrc, out = sys.argv[1], sys.argv[2], sys.argv[3]
S = json.load(open(raw))
def npc(p): return re.sub(r'\s', '', (p or '')).upper()
def nnum(a):
    m = re.search(r'(\d+)\s*([a-zA-Z](?![a-zA-Z]))?', re.sub(r'^[^\d]*?(?=\d)', '', a or '', count=1) if a else '')
    return (m.group(1), (m.group(2) or '').upper()) if m else ('', '')
def street(a):
    s = re.split(r'\s\d', (a or '').strip())[0].strip(' ,')
    return s
pcs = sorted({npc(s['postcode']) for s in S if re.match(r'^\d{4}[A-Z]{2}$', npc(s['postcode']))})
t = pq.read_table(addrsrc, columns=['street', 'number', 'unit', 'postcode', 'address_levels', 'geometry'], filters=[('postcode', 'in', pcs)])
A = collections.defaultdict(list)
for r in t.to_pylist():
    A[(r['postcode'], r['number'])].append(r)
print('BAG-adressen in deze postcodes', t.num_rows)
def km(a, b):
    cl = math.cos(math.radians((a[1] + b[1]) / 2)); return math.hypot((a[0] - b[0]) * cl * 111.32, (a[1] - b[1]) * 111.32)
stat = collections.Counter(); res = []
for s in S:
    pc = npc(s['postcode']); num, let = nnum(s['adres'])
    s['pc'] = pc; s['nr'] = num
    hit = None
    if pc and num and (pc, num) in A:
        rows = A[(pc, num)]
        rows = sorted(rows, key=lambda r: (0 if (r['unit'] or '').upper() == let else 1, r['unit'] or ''))
        hit = rows[0]
    if hit:
        g = shapely.from_wkb(hit['geometry']); bag = (round(g.x, 6), round(g.y, 6))
        d = km(bag, (s['lon'], s['lat']))
        s['bag'] = bag; s['bagd'] = d; s['straat'] = hit['street']
        s['plaatsbag'] = (hit['address_levels'] or [{}])[0].get('value')
        if d > 1.5: stat['bag-ver-weg'] += 1
        s['lon'], s['lat'] = bag; stat['bag'] += 1
    else:
        s['straat'] = street(s['adres']); s['plaatsbag'] = None
        stat['geen-bag'] += 1
        if (s['conf'] or 0) < 0.9: stat['weg-lage-conf'] += 1; continue
    res.append(s)
print(stat)
# ontdubbelen: per formule zelfde postcode+nummer, of binnen 70 m
res.sort(key=lambda s: (-(s['conf'] or 0), -len(s['naam'] or '')))
seen = set(); grid = collections.defaultdict(list); out_ = []
for s in res:
    k = (s['code'], s['pc'], s['nr'])
    if s['pc'] and s['nr'] and k in seen: stat['dubbel-adres'] += 1; continue
    gx, gy = int(s['lon'] / 0.002), int(s['lat'] / 0.002)
    if any(km((s['lon'], s['lat']), (o['lon'], o['lat'])) < 0.07 for dx in (-1, 0, 1) for dy in (-1, 0, 1) for o in grid[(s['code'], gx + dx, gy + dy)]):
        stat['dubbel-plek'] += 1; continue
    seen.add(k); grid[(s['code'], gx, gy)].append(s); out_.append(s)
print(stat)
FN = {'AH': 'Albert Heijn', 'JU': 'Jumbo', 'PL': 'Plus', 'LI': 'Lidl', 'SP': 'SPAR', 'VO': 'Vomar', 'AL': 'Aldi', 'DI': 'Dirk', 'DE': 'Deen', 'CO': 'Coop', 'ET': 'Etos'}
def tc(x):
    if not x: return x
    if x.isupper() or x.islower(): x = ' '.join(w if w in ("'s",) else w[:1].upper() + w[1:].lower() for w in x.split(' '))
    return x
def clean(s):
    n = (s['naam'] or '').strip(); fn = FN[s['code']]
    n = re.sub(r'\s+', ' ', n)
    n = re.sub(r'^(albert ?heijn|ah)\b', lambda m: 'AH' if m.group(0).lower() == 'ah' else 'Albert Heijn', n, flags=re.I)
    n = re.sub(r'^plus\b( supermarkt)?', 'Plus', n, flags=re.I)
    n = re.sub(r'^spar\b', 'SPAR', n, flags=re.I)
    n = re.sub(r'^jumbo\b( supermarkten?)?', 'Jumbo', n, flags=re.I)
    n = re.sub(r'^lidl\b', 'Lidl', n, flags=re.I); n = re.sub(r'^vomar\b', 'Vomar', n, flags=re.I); n = re.sub(r'^aldi\b', 'Aldi', n, flags=re.I)
    n = re.sub(r'^dirk\b', 'Dirk', n, flags=re.I); n = re.sub(r'^deen\b', 'Deen', n, flags=re.I); n = re.sub(r'^coop\b', 'Coop', n, flags=re.I); n = re.sub(r'^etos\b', 'Etos', n, flags=re.I)
    if n.isupper() and len(n) > 6: n = tc(n)
    base = n.lower().replace('albert heijn', '').replace('ah', '', 1).strip() if s['code'] == 'AH' else n.lower().replace(fn.lower(), '', 1).strip()
    st = tc(s.get('straat') or '')
    if len(base) < 2 and st:
        n = f"{'Albert Heijn' if s['code'] == 'AH' else fn} {st}"
    return n
fin = []
for s in out_:
    pl = tc(s.get('plaatsbag') or s.get('plaats') or '')
    fin.append({'code': s['code'], 'formule': FN[s['code']], 'naam': clean(s), 'plaats': pl, 'lon': s['lon'], 'lat': s['lat'], 'oid': s['id'], 'straat': tc(s.get('straat') or ''), 'conf': s['conf']})
json.dump(fin, open(out, 'w'), ensure_ascii=False)
print('winkels', len(fin), collections.Counter(f['code'] for f in fin))
import random
random.seed(1)
for f in random.sample(fin, 40): print('  ', f['naam'], '|', f['plaats'], '|', f['straat'])
