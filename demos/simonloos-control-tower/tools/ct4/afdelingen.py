# Afdelingen per standplaats: wat er op het terrein staat, zoals Google Maps de gebouwen van een bedrijf toont.
#
#   python3 -I tools/ct4/afdelingen.py src/data [qa-map]
#
# Schrijft in places.json per standplaats `afdelingen`:
#   [{ naam, soort, p: [lon, lat], gebouw?, bron }]
#   soort: 'loods' | 'kantoor' | 'garage' | 'wasstraat' | 'laadplein' | 'opleggers' | 'docks' | 'poort'
#   gebouw: index in buildings.json[standplaats] (alleen gebouwen met d: 1), als de afdeling een eigen gebouw is
#   bron: 'vacature' als de vacaturetekst of de notitie van de standplaats de afdeling noemt (zie VACATURE hieronder),
#         anders 'afgeleid'. Welk gebouw welke functie heeft, staat niet in open data en is altijd afgeleid:
#   - loods: het hoofdgebouw op het adres (de hal uit terrain.py; bijna altijd het grootste gebouw met d: 1); de naam is
#     het DC dat er volgens klanten.json staat, "Warehouse" als de notitie dat zegt, anders "Loods"; een tweede grote hal
#     op het terrein (vanaf 5.000 m2 en 40 % van de hoofdhal) is ook een loods;
#   - kantoor: een klein gebouw (40 tot 3.000 m2, minstens 2,5 m hoog, niet langer dan drie keer de breedte) dicht bij de
#     poort (binnen 120 m); noemt de vacature het kantoor, dan eerst een gebouw vanaf 150 m2 binnen 250 m van de poort,
#     en zonder geschikt gebouw een punt in de hal aan de kant van de poort;
#   - wasstraat: een smal lang gebouw (4,5 tot 16 m breed, minstens 18 m lang, minstens twee keer zo lang als breed);
#   - garage: het grootste overgebleven middelgrote gebouw (vanaf 150 m2, minstens 10 m breed), alleen als genoemd;
#   - docks: het midden van de deuren van een rij docks in de gevel (tools/ct4/docks.py), "Docks 1 tot n";
#   - poort: het eind van de toegangsroute (`poort`);
#   - opleggers: de parkeerplekken waar opleggers staan (van achteren in de rijen, zoals in src/fleet.js);
#   - laadplein: de laadpunten (laadpunten(sp): hub 24, warehouse 12, depot 4) aan de rand van de rijen: de eerste
#     parkeerplek van de eerste rij, de kant waar de voertuigen staan.
# Elk punt ligt op het terrein of binnen 40 m ervan (tests/data-check.mjs).
import sys, json, math
from shapely.geometry import Polygon, Point, LineString
D = sys.argv[1]; QA = sys.argv[2] if len(sys.argv) > 2 else None
P = json.load(open(f'{D}/places.json')); B = json.load(open(f'{D}/buildings.json')); K = json.load(open(f'{D}/klanten.json'))

# Wat de vacatureteksten (werkenbijsimonloos.nl, oktober 2026) en de notitie per standplaats noemen. Per afdeling: de naam
# (None: de naam volgt uit de afleiding) en het bewijs (de vacature met het zinsdeel). Algemene teksten ("van dock naar
# dock", "distributiecentra, fabrieken en warehouses", het menu van de site, tankstations als klant) tellen niet mee.
VACATURE = {
    'Wognum': {'kantoor': ('Hoofdkantoor', 'notitie "Hoofdkantoor"; administratief-medewerker-wognum-723 ("Wognum (Kantoor)")'),
               'loods': ('Warehouse', 'notitie "warehouse (85.000 m2 samen met Geldermalsen en Tiel)"'),
               'garage': ('Garage en werkplaats', 'notitie "garage"'), 'wasstraat': ('Wasstraat', 'notitie "wasstraat"')},
    'Zaandam': {'loods': (None, 'avondchauffeur-ce-winkeldistributie-zaandam-499 ("vanaf het distributiecentrum van Albert Heijn")')},
    'Oss': {'kantoor': ('Kantoor', 'teamleider-oss-en-waalwijk-oss-734 ("Oss (Kantoor)")'),
            'loods': (None, 'leerling-chauffeur-c-ce-oss-189 ("vanuit het distributiecentrum in Oss")')},
    'Zwolle': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-zwolle-629 ("bij het distributiecentrum van Albert Heijn")')},
    'Geldermalsen': {'loods': ('Warehouse', 'notitie "Warehouse"'),
                     'garage': ('Garage en werkplaats', 'notitie "garage"; monteur-geldermalsen-598 ("Geldermalsen (Garage)")')},
    'Tiel': {'loods': ('Warehouse en crossdock', 'notitie "Warehouse en crossdock"; crossdockmanager-tiel-tiel-737'),
             'docks': (None, 'combi-chauffeur-netwerktransport-tiel-749 ("manoeuvreer jij de combinatie weer behendig tot het Dock")')},
    'Barneveld': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-barneveld-607 ("bij het distributiecentrum van PLUS in Barneveld")'),
                  'laadplein': ('Laadplein', 'laadcoordinator-barneveld-678 ("het overzicht op het laadplein")')},
    'Raalte': {'loods': (None, 'vrachtwagenchauffeur-ce-met-overnachtingen-raalte-700 ("bij het distributiecentrum van Jumbo in Raalte")')},
    'Waalwijk': {'kantoor': ('Kantoor', 'teamleider-waalwijk-en-oss-waalwijk-733 ("Waalwijk (Kantoor)")'),
                 'loods': (None, 'combichauffeur-winkeldistributie-waalwijk-684 ("op het distributiecentrum in Waalwijk")'),
                 'docks': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-waalwijk-699 ("staat al geladen klaar aan het dock")')},
    'Nieuwegein': {'loods': (None, 'vrachtwagenchauffeur-ce-nieuwegein-59 ("Je start je dag bij het distributiecentrum")')},
    'Almere': {'loods': (None, 'weekendchauffeur-ce-winkeldistributie-almere-567 ("vanaf het distributiecentrum (DC) van Lidl")')},
    'Waddinxveen': {'loods': (None, 'avondchauffeur-ce-winkeldistributie-waddinxveen-528 ("ons distributiecentrum van Lidl in Waddinxveen")')},
    'Pijnacker (Delfgauw)': {'loods': (None, 'leerling-chauffeur-c-ce-delfgauw-190 ("bij het distributiecentrum van Albert Heijn in Pijnacker")')},
    'Opmeer': {'garage': ('Garage en truckspuiterij', 'leerling-monteur-opmeer-625 ("Opmeer (Truckspuiterij)")')},
    'Etten-Leur': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-etten-leur-418 ("op het distributiecentrum van Lidl in Etten-Leur")')},
    'Alkmaar': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-alkmaar-682 ("bij het distributiecentrum van Vomar in Alkmaar")')},
    'Tilburg': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-tilburg-558 ("bij het distributiecentrum van Albert Heijn in Tilburg")')},
    'Hoogeveen': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-hoogeveen-530 ("op het distributiecentrum in Hoogeveen")')},
    'Avenhorn': {'kantoor': ('Kantoor', 'vrachtwagenchauffeur-ce-brooddistributie-avenhorn-703 ("welkom op ons kantoor")')},
    'Beilen': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-beilen-551 ("Je dag begint in het distributiecentrum")')},
    'Bleiswijk': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-bleiswijk-430 ("bij het distributiecentrum in Bleiswijk")')},
    'Oosterhout': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-oosterhout-482 ("vanaf het distributiecentrum in Oosterhout")')},
    'Weert': {'loods': (None, 'vrachtwagenchauffeur-ce-winkeldistributie-weert-557 ("op het distributiecentrum (DC) van Lidl in Weert")')},
}
LAADPUNTEN = lambda s: 24 if s.get('hub') else 12 if s.get('wh') else 4   # zoals laadpunten(sp) in src/places.js
GROOT = {'loods': 0, 'docks': 1, 'kantoor': 2, 'garage': 3, 'wasstraat': 4, 'laadplein': 5, 'opleggers': 6, 'poort': 7}
stat = []; bewijs = {}
for s in P['SP']:
    n = s['n']; V = VACATURE.get(n, {})
    lon0, lat0 = s['lon'], s['lat']; KX = math.cos(math.radians(lat0)) * 111320; KY = 111320.0
    fw = lambda p: ((p[0] - lon0) * KX, (p[1] - lat0) * KY)
    bw = lambda x, y: [round(x / KX + lon0, 6), round(y / KY + lat0, 6)]
    terr = Polygon([fw(p) for p in s['terrein']]).buffer(0)
    hal = Polygon([fw(p) for p in s['hal']]).buffer(0)
    L = B.get(n, [])
    d1 = []
    for i, b in enumerate(L):
        if not b.get('d') or len(b['p']) < 3: continue
        g = Polygon([fw(p) for p in b['p']]).buffer(0)
        if g.is_empty or g.area <= 0: continue
        if g.geom_type != 'Polygon': g = max(g.geoms, key=lambda x: x.area)
        r = g.minimum_rotated_rectangle; xs = list(r.exterior.coords); e1, e2 = math.dist(xs[0], xs[1]), math.dist(xs[1], xs[2])
        d1.append({'i': i, 'g': g, 'a': g.area, 'lang': max(e1, e2), 'kort': min(e1, e2), 'h': b.get('h', 6)})
    poort = Point(fw(s['poort']))
    def labelpunt(g):
        c = g.centroid
        return c if g.contains(c) else g.representative_point()
    afd = []; gebruikt = set()
    def voeg(soort, naam, pt, gebouw=None, bron='afgeleid'):
        o = {'naam': naam, 'soort': soort, 'p': bw(pt.x, pt.y)}
        if gebouw is not None: o['gebouw'] = gebouw; gebruikt.add(gebouw)
        o['bron'] = bron; afd.append(o)
    # loods: de hal (hoofdgebouw op het adres)
    hb = max(d1, key=lambda x: x['g'].intersection(hal).area) if d1 else None
    if hb is not None and hb['g'].intersection(hal).area < 0.5 * hal.area: hb = None
    dcs = [d for d in K['dcs'] if d.get('sp') == n]
    halnaam = V['loods'][0] if 'loods' in V and V['loods'][0] else None
    for dc in dcs:   # een DC op hetzelfde terrein: het gebouw waar het DC-punt in ligt (of de hal)
        pt = Point(fw((dc['lon'], dc['lat'])))
        in_b = min(d1, key=lambda x: x['g'].distance(pt)) if d1 else None
        # het punt in een andere grote hal (minstens 40 % van de hoofdhal): die hal is het DC; anders is de hoofdhal het DC
        # (het punt van een DC ligt vaak bij het kantoor of de ingang)
        if in_b is not None and in_b['g'].distance(pt) <= 25 and hb is not None and in_b['i'] != hb['i'] and in_b['a'] >= 0.4 * hb['a']:
            voeg('loods', dc['naam'], labelpunt(in_b['g']), in_b['i'], 'afgeleid')
        elif not halnaam: halnaam = dc['naam']
    lb = 'vacature' if 'loods' in V else 'afgeleid'
    if hb is not None: voeg('loods', halnaam or 'Loods', labelpunt(hb['g']), hb['i'], lb)
    else: voeg('loods', halnaam or 'Loods', labelpunt(hal), None, lb)
    halpunt = labelpunt(hb['g'] if hb is not None else hal)
    # nog een grote hal op het terrein (vanaf 5.000 m2 en 40 % van de hoofdhal): ook een loods
    for x in d1:
        if x['i'] not in gebruikt and hb is not None and x['a'] >= max(5000, 0.4 * hb['a']): voeg('loods', 'Loods', labelpunt(x['g']), x['i'], 'afgeleid')
    # docks: per rij deuren in een gevel (zelfde koers, hoogstens 6 m tussen twee deuren)
    plek = s.get('dockPlek') or []
    groepen = []
    for k, (x, y, koers) in enumerate(plek):
        q = fw((x, y))
        if groepen:
            g0 = groepen[-1]; px, py, pk = g0[-1][1:]
            if abs((koers - pk + 180) % 360 - 180) <= 10 and math.dist(q, (px, py)) <= 6.0: g0.append((k + 1, q[0], q[1], koers)); continue
        groepen.append([(k + 1, q[0], q[1], koers)])
    db = 'vacature' if 'docks' in V else 'afgeleid'
    for gr in groepen:
        a, b_ = gr[0][0], gr[-1][0]
        mx = sum(x for _, x, _, _ in gr) / len(gr); my = sum(y for _, _, y, _ in gr) / len(gr)
        voeg('docks', f'Docks {a} tot {b_}' if b_ > a else f'Dock {a}', Point(mx, my), hb['i'] if hb is not None else None, db)
    # poort
    voeg('poort', 'Poort', poort, None, 'afgeleid')
    # parkeerplekken zoals src/fleet.js (yardSlots): voertuigen van voren, opleggers van achteren
    slots = []
    for x0, y0, x1, y1, m, kr in s.get('rijen') or []:
        a0, a1 = fw((x0, y0)), fw((x1, y1))
        for k in range(m): f = k / (m - 1) if m > 1 else 0; slots.append(Point(a0[0] + (a1[0] - a0[0]) * f, a0[1] + (a1[1] - a0[1]) * f))
    def opterrein(pt, reserve):
        if terr.distance(pt) <= 5: return pt
        for alt in reserve:
            if terr.distance(alt) <= 5: return alt
        return pt
    if slots:
        nopl = min(len(slots) // 2, max(8, round(s['fleet'] * 1.2)))
        achter = slots[len(slots) - nopl:]
        cx = sum(p.x for p in achter) / len(achter); cy = sum(p.y for p in achter) / len(achter)
        opl = min(achter, key=lambda p: p.distance(Point(cx, cy)))
        voeg('opleggers', 'Opleggers', opterrein(opl, sorted(achter, key=lambda p: p.distance(Point(cx, cy))) + slots[::-1]), None, 'afgeleid')
        # laadplein: de eerste plek van de eerste rij (het begin van de rijen, de kant van de voertuigen)
        lbron = 'vacature' if 'laadplein' in V else 'afgeleid'
        voeg('laadplein', 'Laadplein', opterrein(slots[0], slots), None, lbron)
    else:
        voeg('opleggers', 'Opleggers', terr.representative_point(), None, 'afgeleid')
    # kantoor, garage en wasstraat uit de overige gebouwen met d: 1
    rest = [x for x in d1 if x['i'] not in gebruikt and x['a'] >= 30]
    if 'wasstraat' in V:
        c = [x for x in rest if 4.5 <= x['kort'] <= 16 and x['lang'] >= 18 and x['lang'] / x['kort'] >= 2]
        w = max(c, key=lambda x: (x['lang'] / x['kort'], x['lang'])) if c else None
        if w: voeg('wasstraat', V['wasstraat'][0], labelpunt(w['g']), w['i'], 'vacature'); rest.remove(w)
        else: voeg('wasstraat', V['wasstraat'][0], halpunt, None, 'vacature')
    if 'garage' in V:
        c = [x for x in rest if x['a'] >= 150 and x['kort'] >= 10 and x['h'] >= 2.5]
        w = max(c, key=lambda x: x['a']) if c else None
        if w: voeg('garage', V['garage'][0], labelpunt(w['g']), w['i'], 'vacature'); rest.remove(w)
        else: voeg('garage', V['garage'][0], halpunt, None, 'vacature')
    kan = [x for x in rest if 40 <= x['a'] <= 3000 and x['kort'] >= 5 and x['lang'] / x['kort'] <= 3 and x['h'] >= 2.5]
    if 'kantoor' in V:
        c = [x for x in kan if x['a'] >= 150 and x['g'].distance(poort) <= 250] or [x for x in kan if x['g'].distance(poort) <= 120]
        w = min(c, key=lambda x: x['g'].distance(poort)) if c else None
        if w: voeg('kantoor', V['kantoor'][0], labelpunt(w['g']), w['i'], 'vacature')
        else:   # geen apart gebouw: het kantoor zit in de hal, aan de kant van de poort
            hg = hb['g'] if hb is not None else hal; q = hg.exterior.interpolate(hg.exterior.project(poort))
            voeg('kantoor', V['kantoor'][0], Point(q.x + (halpunt.x - q.x) * 0.08, q.y + (halpunt.y - q.y) * 0.08), hb['i'] if hb is not None else None, 'vacature')
    else:
        c = [x for x in kan if x['g'].distance(poort) <= 120]
        w = min(c, key=lambda x: x['g'].distance(poort)) if c else None
        if w: voeg('kantoor', 'Kantoor', labelpunt(w['g']), w['i'], 'afgeleid')
    afd.sort(key=lambda o: GROOT[o['soort']])
    s['afdelingen'] = afd
    far = [o['naam'] for o in afd if terr.distance(Point(fw(o['p']))) > 40]
    stat.append((n, ' · '.join(f"{o['naam']}{'*' if o['bron'] == 'vacature' else ''}{'' if o.get('gebouw') is None else ' #' + str(o['gebouw'])}" for o in afd), far))
    if QA:
        from PIL import Image, ImageDraw
        S = 1000; R = max(150.0, max(math.dist((0, 0), fw(p)) for p in s['terrein']) * 1.12)
        px = lambda x, y: (S / 2 + x / R * S / 2, S / 2 - y / R * S / 2)
        im = Image.new('RGB', (S, S), (246, 247, 249)); dr = ImageDraw.Draw(im)
        for b in L:
            g2 = Polygon([fw(p) for p in b['p']])
            dr.polygon([px(*p) for p in g2.exterior.coords], fill=(215, 218, 224) if b.get('d') else (235, 236, 239), outline=(150, 155, 162))
        dr.polygon([px(*p) for p in terr.exterior.coords], outline=(37, 99, 235), width=3)
        for p_ in slots: dr.ellipse([px(p_.x, p_.y)[0] - 1.5, px(p_.x, p_.y)[1] - 1.5, px(p_.x, p_.y)[0] + 1.5, px(p_.x, p_.y)[1] + 1.5], fill=(22, 163, 74))
        for k, (x, y, kr) in enumerate(plek): q = fw((x, y)); dr.ellipse([px(*q)[0] - 2, px(*q)[1] - 2, px(*q)[0] + 2, px(*q)[1] + 2], fill=(124, 58, 237))
        KL = {'loods': (180, 20, 40), 'kantoor': (37, 99, 235), 'garage': (217, 119, 6), 'wasstraat': (14, 116, 144), 'laadplein': (22, 163, 74), 'opleggers': (90, 90, 90), 'docks': (124, 58, 237), 'poort': (0, 0, 0)}
        for o in afd:
            q = fw(o['p']); c = px(*q); col = KL[o['soort']]
            dr.ellipse([c[0] - 5, c[1] - 5, c[0] + 5, c[1] + 5], fill=col); dr.text((c[0] + 7, c[1] - 6), o['naam'] + (f" #{o['gebouw']}" if 'gebouw' in o else ''), fill=col)
        dr.text((10, 10), f"{n}: {len(afd)} afdelingen", fill=(20, 20, 20))
        im.save(f"{QA}/afd_{n.replace(' ', '_').replace('(', '').replace(')', '')}.png")
open(f'{D}/places.json', 'w').write(json.dumps(P, ensure_ascii=False, separators=(',', ':')))
for n, t, far in stat: print(f'{n:22} {t}' + (f'   BUITEN 40 m: {far}' if far else ''))
