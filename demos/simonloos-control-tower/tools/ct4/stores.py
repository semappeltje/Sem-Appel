# Winkels van de formules uit Overture Places (release 2026-10-21.0), alleen Nederland, ontdubbeld.
import sys, json, re, math, collections
import pyarrow.parquet as pq, shapely, numpy as np
src, out = sys.argv[1], sys.argv[2]
t = pq.read_table(src, columns=['id', 'names', 'brand', 'basic_category', 'taxonomy', 'addresses', 'geometry', 'operating_status', 'confidence'])
N = t.num_rows
names = t.column('names').combine_chunks().field('primary').to_pylist()
bnames = t.column('brand').combine_chunks().field('names').field('primary').to_pylist()
basic = t.column('basic_category').to_pylist()
tax = t.column('taxonomy').combine_chunks().field('primary').to_pylist()
ops = t.column('operating_status').to_pylist()
conf = t.column('confidence').to_pylist()
addr = t.column('addresses').to_pylist()
ids = t.column('id').to_pylist()
geom = shapely.from_wkb(t.column('geometry').to_numpy(zero_copy_only=False))
X = shapely.get_x(geom); Y = shapely.get_y(geom)

F = [  # code, formule (weergave), naampatroon, uitsluiten
    ('AH', 'Albert Heijn', r'^(albert ?heijn|ah)(\b|$)'),
    ('JU', 'Jumbo', r'^jumbo(\b|$)'),
    ('PL', 'Plus', r'^plus(\b|$)'),
    ('LI', 'Lidl', r'^lidl(\b|$)'),
    ('SP', 'SPAR', r'^spar(\b|$)'),
    ('VO', 'Vomar', r'^vomar(\b|$)'),
    ('AL', 'Aldi', r'^aldi(\b|$)'),
    ('DI', 'Dirk', r'^dirk( van den broek)?(\b|$)'),
    ('DE', 'Deen', r'^deen(\b|$)'),
    ('CO', 'Coop', r'^coop(\b|$)'),
    ('ET', 'Etos', r'^etos(\b|$)'),
]
EXCL = re.compile(r'distrib|\bdc\b|centrale|hoofdkantoor|kantoor|logist|vershal|warehouse|magazijn|pick ?up|ophaalpunt|afhaalpunt|online|hub\b|bezorg|home ?service|bloemencentrale|bakkerij\b|nederland\b|retail|parkeer|parking|tankstation|vacature|werken bij|adecco|randstad|olympia|uitzend|\bdepot\b|servicedesk|klantenservice|hq\b|head ?office|recruit|bulgaria', re.I)
GROCER = {'grocery_store', 'supermarket', 'convenience_store', 'organic_grocery_store', 'korean_grocery_store', 'international_grocery_store', 'asian_grocery_store', 'food_and_beverage_store', 'specialty_foods_store', 'health_food_store', 'ethical_grocery_store', 'indian_grocery_store', 'frozen_foods_store', 'discount_store', 'shopping', 'shopping_center', 'warehouse_club_store'}
DRUG = {'drugstore', 'pharmacy', 'pharmacy_and_drug_store', 'cosmetic_and_beauty_supplies', 'beauty_and_personal_care_store', 'health_and_beauty_store', 'shopping'}
cand = collections.defaultdict(list); rej = collections.Counter()
for i in range(N):
    n = (names[i] or '').strip(); b = (bnames[i] or '').strip()
    if not n and not b: continue
    a = (addr[i] or [{}])[0] if addr[i] else {}
    country = (a.get('country') or '').upper()
    if country and country != 'NL': continue
    if not country: continue
    if ops[i] == 'permanently_closed': continue
    for code, fn, pat in F:
        p = re.compile(pat, re.I)
        if p.search(n) or (p.search(b) and not n):
            if EXCL.search(n):
                rej[(code, 'excl')] += 1; break
            cats = {basic[i], tax[i]}
            ok = bool(cats & (DRUG if code == 'ET' else GROCER))
            if not ok:
                rej[(code, 'cat:' + str(tax[i]))] += 1; break
            cand[code].append(i); break
print({k: len(v) for k, v in cand.items()})
print(sorted(rej.items(), key=lambda x: -x[1])[:60])
# ontdubbelen per formule: binnen 70 m dezelfde winkel; hoogste confidence wint, dan de langste naam
def km(i, j):
    cl = math.cos(math.radians(Y[i])); return math.hypot((X[i] - X[j]) * cl * 111.32, (Y[i] - Y[j]) * 111.32)
keep = {}
for code, lst in cand.items():
    lst = sorted(lst, key=lambda i: (-(conf[i] or 0), -len(names[i] or '')))
    grid = collections.defaultdict(list); kept = []
    for i in lst:
        gx, gy = int(X[i] / 0.002), int(Y[i] / 0.002); dup = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j in grid[(gx + dx, gy + dy)]:
                    if km(i, j) < 0.07: dup = True; break
                if dup: break
            if dup: break
        if not dup: grid[(gx, gy)].append(i); kept.append(i)
    keep[code] = kept
print('na ontdubbelen', {k: len(v) for k, v in keep.items()})
# oude formules (Deen, Coop) die op een winkel van een andere formule staan: omgebouwd, weg
cur = [i for c in keep if c not in ('DE', 'CO', 'ET') for i in keep[c]]
cg = collections.defaultdict(list)
for i in cur: cg[(int(X[i] / 0.002), int(Y[i] / 0.002))].append(i)
for code in ('DE', 'CO'):
    nk = []
    for i in keep.get(code, []):
        gx, gy = int(X[i] / 0.002), int(Y[i] / 0.002)
        near = any(km(i, j) < 0.08 for dx in (-1, 0, 1) for dy in (-1, 0, 1) for j in cg[(gx + dx, gy + dy)])
        if not near: nk.append(i)
    print(code, 'op dezelfde plek als een andere formule (omgebouwd):', len(keep.get(code, [])) - len(nk))
    keep[code] = nk
res = []
for code, lst in keep.items():
    for i in lst:
        a = (addr[i] or [{}])[0]
        res.append({'code': code, 'id': ids[i], 'naam': names[i], 'brand': bnames[i], 'cat': tax[i], 'ops': ops[i], 'conf': conf[i], 'adres': a.get('freeform'), 'postcode': a.get('postcode'), 'plaats': a.get('locality'), 'lon': round(float(X[i]), 6), 'lat': round(float(Y[i]), 6)})
json.dump(res, open(out, 'w'), ensure_ascii=False)
print('totaal', len(res))
c = collections.Counter(r['code'] for r in res); print(c)
