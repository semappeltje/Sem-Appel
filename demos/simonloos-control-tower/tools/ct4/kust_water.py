"""Land en water voor de ingebouwde kaart: src/data/land.json en src/data/water.json, uit Overture base/land en base/water
(OpenStreetMap, ODbL), release 2026-10-21.0. Vervangt tools/water2.py (water uit een selectie van soorten, zonder kanalen
en havens) en de grove kust van Natural Earth met de ronde "stukjes land onder plekken" in basemap.js.

Werkwijze
  1. Land: de vlakken van base/land met subtype land en class land. Dat is het land binnen de kustlijn van OpenStreetMap
     (Overture knipt het in vakken van een graad); samengevoegd binnen het kader KADER. De havens van Rotterdam, het IJ en
     het Noordzeekanaal liggen binnen de kustlijn (achter sluizen of binnendijks): daar maakt het water hieronder het water.
     De Eems, de Westerschelde, de Oosterschelde en de Waddenzee liggen erbuiten: daar is het de zee (de achtergrond).
  2. Water: alle vlakken van base/water behalve zee en oceaan (de achtergrond), benoemde gebieden (subtype physical) en wat
     water_get.py al wegliet (sloten, beken, zwembaden, bronnen). Per vlak eerst een opening van OPEN m (krimpen en weer
     groeien): wat smaller is dan 2 x OPEN m (sloten, greppels) valt weg. Dan samengevoegd, alleen het deel binnen het land,
     en per samengevoegd vlak gesloten met SLUIT m (smalle stukken land in het water, zoals kribben in de rivieren, gaan
     dicht) en geopend met OPEN2 m (vaarten smaller dan 2 x OPEN2 m vallen weg). Buiten Nederland (de provincies, 3 km
     ruim) alleen water vanaf MIN_BUITEN.
  3. Waar het water binnen MOND m van de kust komt (riviermondingen, havenmonden), gaat het ook uit het land, zodat het
     vereenvoudigde land daar geen streep over de monding legt.
  4. Vereenvoudigd met behoud van topologie: land TOL_LAND m, water TOL_WATER m (buiten Nederland TOL_BUITEN m); stukken
     water onder MIN_WATER vallen weg, behalve stukken vanaf MIN_BRUG binnen BRUG m van een groter watervlak (door een brug
     gescheiden: een gracht, een havenmond, het water voor Amsterdam Centraal), en eilanden (gaten) onder MIN_GAT ook.
     Gecodeerd als polyline (1e-5 graad), zoals de wegen, op een raster van 1e-5 graad zodat elk vlak geldig blijft. Per
     watervlak de zoom vanaf waar de kaart het tekent (z): het fijne water vanaf zoom 10 (kleine vlakken vanaf 11). Waar de
     bebouwing van Natural Earth (urban.json) in zee steekt, een stuk zee erover met de kustlijn van het land.
  5. Ver weg (tot zoom 10) een grove versie: alleen water vanaf 1 km2, geopend met 100 m (havens, het IJ en smalle vaarten
     vallen weg) en vereenvoudigd op 60 m (z 0, zx 10: tot zoom 10).
  6. Buiten het kader: de grove kust van Natural Earth 10m (veld ctx van de vorige land.json), zonder het kader.
  7. De landsgrens van Nederland: Overture divisions/division_boundary (subtype country, is_land), vereenvoudigd op 12 m.
Daarna een controle: elke standplaats, elk DC, elke winkel en elk bezorgpunt ligt op het land en in geen fijn watervlak.
Een plek die door het vereenvoudigen in of tegen het water kwam, krijgt in een venster van 300 m om de plek de vorm van
voor het vereenvoudigen terug (de echte rand, geen cirkel).

gebruik: kust_water.py <werkmap met land.parquet, water.parquet en grens.parquet> <src/data van de app> [a]
  werkmap: van water_get.py en grens_get.py; 'a' rekent alleen het samenvoegen, sluiten en openen (traag: ruim vijf
  minuten, bewaard in de werkmap); zonder 'a' ook de rest (een minuut als stap a er al is).
"""
import sys, os, json, math, time, pickle, collections
import pyarrow.parquet as pq, shapely, numpy as np

W, D = sys.argv[1], sys.argv[2]; STAP = sys.argv[3] if len(sys.argv) > 3 else ''
KADER = (1.8, 50.0, 8.6, 54.3)          # het gebied met de echte kust (de rest: Natural Earth)
OPEN, SLUIT, OPEN2 = 6.0, 15.0, 8.0      # m: opening per bronvlak, sluiten en openen per samengevoegd vlak
MOND = 80.0                              # m: water zo dicht bij de kust gaat ook uit het land
TOL_LAND, TOL_WATER, TOL_BUITEN = 8.0, 10.0, 20.0  # m: vereenvoudiging
MIN_LAND = 4000.0                        # m2: kleinste stuk land dat blijft
MIN_WATER, MIN_GAT = 40000.0, 25000.0    # m2: kleinste watervlak, kleinste eiland in het water
MIN_BRUG, BRUG = 5000.0, 25.0            # m2, m: een kleiner stuk (vanaf 0,5 ha) blijft als het binnen 25 m van een groter
                                         # watervlak ligt: een gracht of havenmond die een brug van de rest scheidt
MIN_BUITEN = 500000.0                    # m2: kleinste watervlak buiten Nederland
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f} s]', *a, flush=True)
# eigen vlakke projectie in meters rond 52,2 graden noord (genoeg voor opening, vereenvoudiging en oppervlak)
LAT0 = 52.2; MX, MY = 111320.0 * math.cos(math.radians(LAT0)), 111132.0
tom = lambda g: shapely.transform(g, lambda c: c * [MX, MY])
todeg = lambda g: shapely.transform(g, lambda c: c / [MX, MY])

def enc(pts):
    out = []; plat = plon = 0
    for lon, lat in pts:
        la, lo = round(lat * 1e5), round(lon * 1e5)
        for v, p in ((la, plat), (lo, plon)):
            d = v - p; d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20: out.append(chr((0x20 | (d & 0x1f)) + 63)); d >>= 5
            out.append(chr(d + 63))
        plat, plon = la, lo
    return ''.join(out)
def dec(s):
    i = 0; lat = lon = 0; out = []
    while i < len(s):
        for k in (0, 1):
            r = sh = 0
            while True:
                b = ord(s[i]) - 63; i += 1; r |= (b & 31) << sh; sh += 5
                if b < 32: break
            d = ~(r >> 1) if r & 1 else r >> 1
            if k == 0: lat += d
            else: lon += d
        out.append((lon / 1e5, lat / 1e5))
    return out
def polys(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    if hasattr(g, 'geoms'): return [p for x in g.geoms for p in polys(x)]
    return []
def vlakken(arr): return np.array([p for g in arr for p in polys(g)], dtype=object)
def open_(arr, r): return vlakken(shapely.buffer(shapely.buffer(arr, -r, quad_segs=2), r, quad_segs=2))
def sluit(arr, r): return vlakken(shapely.buffer(shapely.buffer(arr, r, quad_segs=2), -r, quad_segs=2))
def schoon(g, amin, gmin):
    out = []
    for p in polys(g):
        if p.area < amin: continue
        out.append(shapely.Polygon(p.exterior, [r for r in p.interiors if shapely.Polygon(r).area >= gmin]))
    return out

# Nederland (de provincies van Natural Earth, 3 km ruim): binnen dit gebied ook klein water
prov = json.load(open(f'{D}/provinces.json'))
NL = tom(shapely.union_all([shapely.Polygon(r) for p in prov for r in p['rings'] if len(r) > 3]).buffer(0)).buffer(3000)
shapely.prepare(NL)
BOX = tom(shapely.box(*KADER))

A = f'{W}/kust_water_a.pk'
if STAP == 'a' or not os.path.exists(A):
    # ---------- 1. land ----------
    L = pq.read_table(f'{W}/land.parquet', columns=['class', 'geometry'])
    lg = shapely.from_wkb(L.column('geometry').to_numpy(zero_copy_only=False))[np.array(L.column('class').to_pylist()) == 'land']
    land = shapely.intersection(shapely.union_all(tom(lg)), BOX)
    log('land: vlakken', len(lg), 'punten', shapely.get_num_coordinates(land))
    # ---------- 2. water ----------
    T = pq.read_table(f'{W}/water.parquet', columns=['subtype', 'class', 'geometry'])
    st = np.array(T.column('subtype').to_pylist()); cl = np.array(T.column('class').to_pylist())
    g = shapely.from_wkb(T.column('geometry').to_numpy(zero_copy_only=False))
    ok = np.isin(shapely.get_type_id(g), [3, 6]) & ~np.isin(st, ['ocean', 'physical']) & ~np.isin(cl, ['shoal'])
    g = tom(g[ok]); log('water: vlakken', int(ok.sum()))
    ar = shapely.area(g); per = shapely.length(g); inNL = shapely.intersects(g, NL)
    # sloten en smalle vaarten (dikte 2 x oppervlak / omtrek onder 1,6 x OPEN) en kleine vijvers vallen al weg
    keep = (ar >= 1500) & (2 * ar / np.maximum(per, 1) >= 1.6 * OPEN) & (inNL | (ar >= 300000))
    g = g[keep]; log('water: na de eerste schifting', len(g))
    g = shapely.buffer(shapely.buffer(g, -OPEN, quad_segs=2), OPEN, quad_segs=2)
    g = g[~shapely.is_empty(g)]; log('water: na de opening', len(g), 'punten', int(shapely.get_num_coordinates(g).sum()))
    water = shapely.union_all(g); log('water: samengevoegd, punten', shapely.get_num_coordinates(water))
    water = shapely.intersection(water, land); log('water: binnen het land, punten', shapely.get_num_coordinates(water))
    # per vlak apart verder (sneller dan één groot vlak); eerst de overbodige punten van de opening eruit (1 m)
    parts = shapely.simplify(vlakken([water]), 1.0, preserve_topology=True)
    parts = parts[shapely.area(parts) >= MIN_BRUG]
    parts = sluit(parts, SLUIT); log('water: gesloten', len(parts), 'vlakken')
    parts = open_(parts, OPEN2); parts = parts[shapely.area(parts) >= MIN_BRUG]
    parts = vlakken(shapely.simplify(parts, 1.0, preserve_topology=True)); log('water: geopend', len(parts), 'vlakken, punten', int(shapely.get_num_coordinates(parts).sum()))
    pickle.dump({'land': shapely.to_wkb(land), 'water': shapely.to_wkb(parts)}, open(A, 'wb'))
    if STAP == 'a': sys.exit(0)
S = pickle.load(open(A, 'rb')); land = shapely.from_wkb(S['land']); parts = shapely.from_wkb(S['water'])
log('stap a geladen: land', shapely.get_num_coordinates(land), 'punten; water', len(parts), 'vlakken', int(shapely.get_num_coordinates(parts).sum()), 'punten')
# buiten Nederland alleen de grote wateren
binnen = shapely.intersects(parts, NL)
parts = parts[binnen | (shapely.area(parts) >= MIN_BUITEN)]; binnen = shapely.intersects(parts, NL)

# ---------- 3. monden: water dicht bij de kust gaat ook uit het land ----------
kust = shapely.difference(shapely.boundary(land), shapely.buffer(shapely.boundary(BOX), 50))
bij = np.unique(shapely.STRtree(parts).query(kust, predicate='dwithin', distance=MOND))
monden = [shapely.intersection(parts[i], shapely.buffer(shapely.intersection(kust, shapely.buffer(shapely.envelope(parts[i]), MOND)), MOND, quad_segs=2)) for i in bij]
mond = shapely.union_all(monden) if monden else shapely.Polygon()
land2 = shapely.difference(land, mond)
log('monden:', len(bij), 'watervlakken raken de kust;', round(shapely.area(mond) / 1e6, 2), 'km2 uit het land')

# ---------- 4. vereenvoudigen ----------
LS = shapely.simplify(land2, TOL_LAND, preserve_topology=True)
WS = np.array([shapely.simplify(p, TOL_WATER if b else TOL_BUITEN, preserve_topology=True) for p, b in zip(parts, binnen)], dtype=object)
# kleine stukken (0,5 tot 4 ha) alleen als ze binnen BRUG m van een groot watervlak liggen (door een brug afgesneden)
groot_ = shapely.area(parts) >= MIN_WATER
klein_ok = np.zeros(len(parts), bool)
if groot_.any():
    i, j = shapely.STRtree(parts[groot_]).query(parts[~groot_], predicate='dwithin', distance=BRUG)
    klein_ok[np.where(~groot_)[0][np.unique(i)]] = True
log('kleine stukken bij een groot watervlak (een brug ertussen):', int(klein_ok.sum()), 'van', int((~groot_).sum()))
def lijsten():
    ws = [g for g, k in zip(WS, groot_ | klein_ok) if k and not g.is_empty]
    return schoon(LS, MIN_LAND, MIN_GAT), schoon(shapely.GeometryCollection(ws), MIN_BRUG, MIN_GAT)
LP, WP = lijsten()
log('vereenvoudigd: land', len(LP), 'vlakken', sum(shapely.get_num_coordinates(p) for p in LP), 'punten; water', len(WP), 'vlakken', sum(shapely.get_num_coordinates(p) for p in WP), 'punten')

# ---------- controle: elke plek op het land en in geen watervlak; anders daar de echte vorm terug ----------
P = json.load(open(f'{D}/places.json')); K = json.load(open(f'{D}/klanten.json'))
PL = [('standplaats', s['n'], s['lon'], s['lat']) for s in P['SP']] + [(d.get('soort') or 'dc', d['naam'], d['lon'], d['lat']) for d in K['dcs']] \
   + [('winkel', w['naam'], w['lon'], w['lat']) for w in K['stores']] + [('bezorg', b['naam'], b['lon'], b['lat']) for b in P.get('BEZORG', [])]
PT = tom(shapely.points([(x, y) for _, _, x, y in PL]))
def fout(LP, WP, marge):
    opl = np.zeros(len(PL), bool); inw = np.zeros(len(PL), bool)
    i, _ = shapely.STRtree(LP).query(PT, predicate='within'); opl[i] = True
    i, _ = (shapely.STRtree(WP).query(PT, predicate='dwithin', distance=marge) if marge else shapely.STRtree(WP).query(PT, predicate='within')); inw[i] = True
    return [k for k in range(len(PL)) if not opl[k] or inw[k]]
# een plek op minder dan 3 m van het water telt ook (de rand is vereenvoudigd en straks op 1e-5 graad afgerond)
bad = fout(LP, WP, 3.0); wtree = shapely.STRtree(parts); hersteld = []
for k in bad:
    soort, naam, x, y = PL[k]; p = PT[k]; win = p.buffer(150, cap_style='square')
    echt = ('land' if land2.contains(p) else 'zee') + (', water' if any(parts[i].contains(p) for i in wtree.query(p)) else '')
    # in een venster van 300 m om de plek de vorm van voor het vereenvoudigen terug (de echte rand)
    LS = shapely.union(shapely.difference(LS, win), shapely.intersection(land2, win))
    for i in wtree.query(win): WS[i] = shapely.union(shapely.difference(WS[i], win), shapely.intersection(parts[i], win))
    hersteld.append(f'{soort} {naam} (in de bron: {echt})')
LP, WP = lijsten()
bad2 = fout(LP, WP, 0)
log('plekken', len(PL), '| tegen of in het water na vereenvoudigen', len(bad), '| hersteld', len(hersteld), '| nog in het water of buiten het land', len(bad2))
for h in hersteld: log('  hersteld:', h)
for k in bad2: log('  NOG FOUT:', PL[k])

# ---------- 5. grof water voor ver weg ----------
groot = np.array([p for p in WP if p.area >= 1e6], dtype=object)
grof = [p for p in schoon(shapely.GeometryCollection(list(shapely.simplify(open_(groot, 100.0), 60.0, preserve_topology=True))), 1e6, 5e5)]
log('grof water (tot zoom 10):', len(grof), 'vlakken', sum(shapely.get_num_coordinates(p) for p in grof), 'punten')

# ---------- 6. buiten het kader: Natural Earth (uit de vorige land.json) ----------
oud = json.load(open(f'{D}/land.json'))
def ring_deg(r): return dec(r) if isinstance(r, str) else [tuple(c) for c in r]
ctx = [shapely.Polygon(ring_deg(p[0]), [ring_deg(r) for r in p[1:]]) for p in oud['ctx']]
ctx = polys(shapely.difference(shapely.union_all([shapely.make_valid(c) for c in ctx]), shapely.box(*KADER)))
log('buiten het kader (Natural Earth):', len(ctx), 'vlakken', sum(shapely.get_num_coordinates(c) for c in ctx), 'punten')

# ---------- 7. de landsgrens van Nederland ----------
G = pq.read_table(f'{W}/grens.parquet').to_pylist()
grens = []
for r in G:
    if not r['is_land']: continue
    gm = tom(shapely.from_wkb(r['geometry']))
    if shapely.length(shapely.intersection(gm, NL)) < 0.8 * shapely.length(gm): continue
    for l in (gm.geoms if hasattr(gm, 'geoms') else [gm]):
        l = shapely.simplify(l, 12.0)
        if l.length >= 300: grens.append(l)
log('landsgrens:', len(grens), 'lijnen', sum(shapely.get_num_coordinates(l) for l in grens), 'punten', round(sum(l.length for l in grens) / 1000), 'km')

# ---------- schrijven ----------
# in graden op het raster van 1e-5 graad gelegd (zoals de codering), zodat elk vlak na het afronden geldig blijft (geen
# rand die zichzelf snijdt); een vlak dat daarbij in stukken valt, wordt meer vlakken
def raster(p, deg=False):
    g = shapely.set_precision(p if deg else todeg(p), 1e-5)
    return [q for q in polys(g) if q.area > 0]
def rings(q): return [enc(q.exterior.coords)] + [enc(r.coords) for r in q.interiors]
WP.sort(key=lambda p: -p.area)
# water.json: per vlak [z, ringen] (fijn, vanaf zoom z) of [z, ringen, zx] (grof, tot zoom zx)
WF = [(10 if p.area >= 250000 else 11, q) for p in WP for q in raster(p)]
GF = [q for p in sorted(grof, key=lambda p: -p.area) for q in raster(p)]
LF = [q for p in sorted(LP, key=lambda p: -p.area) for q in raster(p)]
CF = [q for c in ctx for q in raster(c, True)]
# de bebouwing van Natural Earth (urban.json, onder het water getekend) steekt hier en daar in zee (Maasvlakte, IJmuiden,
# Scheveningen): daar een stuk zee in de waterkleur erover, met precies de kustlijn van het land (geen naad)
urb = shapely.union_all([shapely.make_valid(shapely.Polygon(r)) for r in json.load(open(f'{D}/urban.json')) if len(r) > 3])
ZF = [q for q in raster(shapely.difference(urb, shapely.union_all(LF + CF)), True) if q.area > 1e-8]
log('bebouwing in zee:', len(ZF), 'stukken zee erover,', sum(shapely.get_num_coordinates(q) for q in ZF), 'punten')
WJ = [[0, rings(q), 10] for q in GF] + [[z, rings(q)] for z, q in WF] + [[0, rings(q)] for q in ZF]
LJ = {'land': [rings(q) for q in LF], 'ctx': [rings(q) for q in CF], 'grens': [enc(todeg(l).coords) for l in grens]}
# nog een keer de plekken, nu op de vlakken zoals de app ze leest
def terug(lst): return [shapely.Polygon(dec(r[0]), [dec(x) for x in r[1:]]) for r in lst]
LD, WD = terug(LJ['land'] + LJ['ctx']), terug([e[1] for e in WJ if len(e) == 2])
ongeldig = sum(1 for g in LD + WD if not g.is_valid)
pt = shapely.points([(x, y) for _, _, x, y in PL]); opl = np.zeros(len(PL), bool); inw = np.zeros(len(PL), bool)
i, _ = shapely.STRtree(LD).query(pt, predicate='within'); opl[i] = True
i, _ = shapely.STRtree(WD).query(pt, predicate='within'); inw[i] = True
eind = [PL[k] for k in range(len(PL)) if not opl[k] or inw[k]]
log('na het afronden:', len(LD), 'landvlakken,', len(WD), 'fijne watervlakken,', len(GF), 'grove; ongeldig', ongeldig, '| plekken niet op land of in het water:', len(eind), eind[:6])
sl = json.dumps(LJ, separators=(',', ':')); sw = json.dumps(WJ, separators=(',', ':'))
open(f'{D}/land.json', 'w').write(sl); open(f'{D}/water.json', 'w').write(sw)
log('land.json', len(sl) // 1024, 'kB | water.json', len(sw) // 1024, 'kB | water per zoom', dict(collections.Counter(x[0] for x in WJ)))
