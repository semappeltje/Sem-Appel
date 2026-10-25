# Schrijft de databestanden van de app: places.json (standplaatsen aangevuld), klanten.json, toegang.json, graph.json,
# buildings.json. Alle bronnen staan in de kladmap; zie src/data/BRONNEN.md.
import sys, json, math, pickle, collections
D = sys.argv[1]  # src/data van de app
K = sys.argv[2]  # kladmap data/
P = json.load(open(f'{K}/base/demos/simonloos-control-tower/src/data/places.json'))  # altijd vanaf de oorspronkelijke versie (HEAD)
SPF = json.load(open(f'{K}/sp_final.json')); TER = json.load(open(f'{K}/ter/terrain.json'))
ACC = pickle.load(open(f'{K}/acc/toegang.pk', 'rb'))['acc']
G = json.load(open(f'{K}/acc/graph_new.json'))
NODES = G['nodes']
S = json.load(open(f'{K}/stores.json')); DC = json.load(open(f'{K}/dcs.json')); BZ = json.load(open(f'{K}/bezorg.json'))
SITE = json.load(open(f'{K}/site_of.json'))
r4 = lambda v: round(v, 4); r6 = lambda v: round(v, 6)
# rasterindex voor de dichtstbijzijnde knoop (alleen voor plekken zonder wegverbinding: de Waddeneilanden)
CELL = 0.05; grid = collections.defaultdict(list)
for i, (x, y) in enumerate(NODES): grid[(math.floor(x / CELL), math.floor(y / CELL))].append(i)
def km(a, b):
    cl = math.cos(math.radians((a[1] + b[1]) / 2)); return math.hypot((a[0] - b[0]) * cl * 111.32, (a[1] - b[1]) * 111.32)
def nearest(lon, lat):
    cx, cy = math.floor(lon / CELL), math.floor(lat / CELL); best, bd = -1, 1e9
    for r in range(0, 13):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r: continue
                for i in grid.get((cx + dx, cy + dy), []):
                    d = km(NODES[i], (lon, lat))
                    if d < bd: bd, best = d, i
        if best >= 0 and bd < r * CELL * 111: break
    return best
# ---------- standplaatsen ----------
FORM = {  # formules waar de winkelritten heen gaan (naar de klant uit de vacature)
 'Wognum': ['Albert Heijn'], 'Zaandam': ['Albert Heijn'], 'Oss': ['Plus'], 'Zwolle': ['Albert Heijn'], 'Geldermalsen': ['Albert Heijn'],
 'Aalsmeer': ['Albert Heijn', 'Jumbo'], 'Barneveld': ['Plus'], 'Raalte': ['Jumbo'], 'Waalwijk': ['SPAR'], 'Nieuwegein': ['Jumbo', 'Albert Heijn'],
 'Almere': ['Lidl'], 'Waddinxveen': ['Lidl'], 'Amstelveen': ['Albert Heijn', 'Jumbo'], 'Pijnacker (Delfgauw)': ['Albert Heijn'], 'Etten-Leur': ['Lidl'],
 'Alkmaar': ['Vomar'], 'Tilburg': ['Albert Heijn'], 'Hoogeveen': ['Albert Heijn'], 'Oostzaan': ['Albert Heijn'], 'Heerenveen': ['SPAR'],
 'Amsterdam': ['Albert Heijn'], 'Beilen': ['Jumbo'], 'Beverwijk': ['Etos'], 'Bleiswijk': ['Jumbo'], 'Heinenoord': ['Plus'], 'Oosterhout': ['Lidl'],
 'Weert': ['Lidl'], 'Avenhorn': ['Albert Heijn'], 'Emmeloord': ['Albert Heijn', 'Jumbo', 'Plus'],
}
LAAD = {'Heinenoord': 'pl-oss'}  # eerst laden bij een DC elders (vacaturetekst)
PENDEL = {'Heerenveen': 'sp-waalwijk'}  # LZV-pendel naar een DC elders (vacaturetekst)
DIVFIX = {'Avenhorn': ['winkel'], 'Emmeloord': ['winkel']}  # broodritten naar supermarkten (vacaturetekst), geen netwerk
KLANT = {k: v['klantVacature'] for k, v in SPF.items() if v.get('klantVacature')}
def eind(s):  # laatste punt van een polyline: de poort
    i = 0; lat = lon = 0
    while i < len(s):
        for which in (0, 1):
            r = sh = 0
            while True:
                b = ord(s[i]) - 63; i += 1; r |= (b & 31) << sh; sh += 5
                if b < 32: break
            d = ~(r >> 1) if r & 1 else r >> 1
            if which == 0: lat += d
            else: lon += d
    return (round(lon / 1e5, 5), round(lat / 1e5, 5))
spout = []
for s in P['SP']:
    n = s['n']; f = SPF[n]; t = TER['sp:' + n]; a = ACC['sp:' + n]
    o = dict(s)
    o['lat'], o['lon'] = r6(f['lat']), r6(f['lon'])
    if n in KLANT: o['klant'] = KLANT[n]
    if n in DIVFIX: o['div'] = DIVFIX[n]
    if n == 'Oosterhout': o['prov'], o['regio'] = 'Gelderland', 'Oost'
    o['adres'] = f['adres']; o['bron'] = f['bron']; o['datum'] = f['datum']
    if f['opm']: o['adresNoot'] = f['opm']
    o['node'] = a[0]; o['toegang'] = a[1]; o['poort'] = list(eind(a[1]))
    o['terrein'] = t['terrein']; o['terreinBron'] = t['terreinBron']; o['hal'] = t['hoofd']
    o['rijen'] = t['rijen']
    if n in FORM and any(d in o['div'] for d in ('winkel', 'bezorg')): o['formules'] = FORM[n]
    if n in LAAD: o['laad'] = LAAD[n]
    if n in PENDEL: o['pendel'] = PENDEL[n]
    spout.append(o)
P2 = {'SP': spout, 'TOWNS': P['TOWNS'], 'CITIES': P['CITIES']}
open(f'{D}/places.json', 'w').write(json.dumps(P2, ensure_ascii=False, separators=(',', ':')))
# plaats leeg (Overture zonder plaats, geen BAG-nummer): de woonplaats van het dichtstbijzijnde BAG-adres
def leeg(lst): return [x for x in lst if not (x.get('plaats') or '').strip()]
_rev = None
def plaats_bij(lon, lat):
    global _rev
    if _rev is None:
        import pyarrow.parquet as pq, shapely, numpy as np
        t = pq.read_table(f'{K}/ov/nl_addresses.parquet', columns=['address_levels', 'geometry'])
        g = shapely.from_wkb(t.column('geometry').to_numpy(zero_copy_only=False))
        _rev = (np, shapely.get_x(g), shapely.get_y(g), t.column('address_levels'))
    np, X, Y, LV = _rev
    i = int(np.argmin((X - lon) ** 2 * 0.37 + (Y - lat) ** 2))
    lv = LV[i].as_py() or [{}]
    return lv[0].get('value') or ''
for x in leeg(S) + leeg(DC):
    x['plaats'] = plaats_bij(x['lon'], x['lat']); print('plaats aangevuld', x.get('naam'), '->', x['plaats'])
# ---------- klanten ----------
CODE = {'AH': 'ah', 'JU': 'ju', 'PL': 'pl', 'LI': 'li', 'SP': 'sp', 'VO': 'vo', 'AL': 'al', 'DI': 'di', 'DE': 'de', 'CO': 'co', 'ET': 'et'}
order = sorted(range(len(S)), key=lambda i: (S[i]['code'], S[i]['plaats'], S[i]['naam'], S[i]['lat']))
cnt = collections.Counter(); stores = []; toe = {}; eil = 0
for i in order:
    if S[i]['code'] in ('DE', 'CO'): continue  # Deen en Coop bestaan niet meer als formule (omgebouwd); oude vermeldingen weg
    s = S[i]; cnt[s['code']] += 1; sid = f"{CODE[s['code']]}{cnt[s['code']]:04d}"
    a = ACC.get(f'st:{i}')
    o = {'id': sid, 'formule': s['formule'], 'naam': s['naam'], 'plaats': s['plaats'], 'lon': r4(s['lon']), 'lat': r4(s['lat'])}
    if a: o['node'] = a[0]; toe[sid] = a[1]
    else: o['node'] = nearest(s['lon'], s['lat']); o['eiland'] = 1; eil += 1
    stores.append(o)
dcs = []
for d in DC:
    k = 'dc:' + d['id']; a = ACC.get(k)
    o = {'id': d['id'], 'naam': d['naam'], 'formule': d['formule'], 'plaats': d['plaats'], 'lon': r4(d['lon']), 'lat': r4(d['lat']), 'soort': d['soort']}
    if a: o['node'] = a[0]; toe[d['id']] = a[1]
    else: o['node'] = nearest(d['lon'], d['lat']); o['eiland'] = 1
    st = SITE.get(k)
    if st and st.startswith('sp:'): o['sp'] = st[3:]
    elif st and st in TER: o['terrein'] = [[r6(x), r6(y)] for x, y in TER[st]['terrein']]
    if a and (o.get('terrein') or o.get('sp')): o['poort'] = list(eind(a[1]))
    if d.get('adres'): o['adres'] = d['adres']
    dcs.append(o)
bz = []
for b in BZ:
    a = ACC.get('bz:' + b['id'])
    if not a: continue
    bz.append({'id': b['id'], 'naam': b['naam'], 'plaats': b['plaats'], 'lon': r4(b['lon']), 'lat': r4(b['lat']), 'node': a[0], 'sp': b['sp']}); toe[b['id']] = a[1]
KL = {'stores': stores, 'dcs': dcs}
P2['BEZORG'] = bz
open(f'{D}/places.json', 'w').write(json.dumps(P2, ensure_ascii=False, separators=(',', ':')))
open(f'{D}/klanten.json', 'w').write(json.dumps(KL, ensure_ascii=False, separators=(',', ':')))
open(f'{D}/toegang.json', 'w').write(json.dumps(toe, ensure_ascii=False, separators=(',', ':')))
open(f'{D}/graph.json', 'w').write(json.dumps(G, separators=(',', ':')))
# ---------- gebouwen ----------
B = json.load(open(f'{K}/ter/buildings.json'))
BO = {}
for key, lst in B.items():
    BO[key[3:] if key.startswith('sp:') else key[3:]] = lst
open(f'{D}/buildings.json', 'w').write(json.dumps(BO, separators=(',', ':')))
import os, subprocess
# docks per standplaats (aantal en plek in de gevel; vervallen parkeerplekken voor de docks): na places.json en buildings.json
subprocess.run([sys.executable, '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docks.py'), D], check=True, stdout=subprocess.DEVNULL)
# afdelingen per standplaats (loods, kantoor, garage, wasstraat, laadplein, opleggers, docks, poort): na de docks
subprocess.run([sys.executable, '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'afdelingen.py'), D], check=True, stdout=subprocess.DEVNULL)
for f in ('places.json', 'klanten.json', 'toegang.json', 'graph.json', 'buildings.json'):
    print(f, os.path.getsize(f'{D}/{f}') // 1024, 'kB')
print('winkels', len(stores), dict(collections.Counter(s['formule'] for s in stores)), 'eiland', eil, '| dcs', len(dcs), dict(collections.Counter(d['soort'] for d in dcs)), '| bezorg', len(bz))
