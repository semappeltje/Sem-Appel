# DC's, fabrieken en groothandels: posities op het BAG-adrespunt (Overture Addresses), anders het punt uit Overture Places.
import sys, json, re, math, collections
import pyarrow.parquet as pq, shapely
addrsrc, placesrc, out = sys.argv[1], sys.argv[2], sys.argv[3]
# id, naam, formule, soort, straat, nummer, postcode, plaats, terugval (lat, lon uit Overture Places)
H = [
 ('ah-zaandam', 'AH DC Zaandam', 'Albert Heijn', 'dc', 'Hoofdtocht', '1', '1507CJ', 'Zaandam', None),
 ('ah-pijnacker', 'AH DC Pijnacker', 'Albert Heijn', 'dc', 'Laan van Ruyven', '1', '2645EE', 'Delfgauw', None),
 ('ah-geldermalsen', 'AH DC Geldermalsen', 'Albert Heijn', 'dc', 'Randweg', '2', '4191NN', 'Geldermalsen', (51.872670, 5.305468)),
 ('ah-tilburg', 'AH DC Tilburg', 'Albert Heijn', 'dc', 'Pegasusweg', '1', '5015BZ', 'Tilburg', None),
 ('ah-zwolle', 'AH DC Zwolle', 'Albert Heijn', 'dc', 'Galvaniweg', '1', '8013RG', 'Zwolle', None),
 ('ah-hoorn', 'AH DC Hoorn', 'Albert Heijn', 'dc', 'Neutronweg', '7', '1627LG', 'Hoorn', (52.640557, 5.098512)),
 ('ah-nieuwegein', 'AH DC Nieuwegein', 'Albert Heijn', 'dc', 'Inundatiedok', '38', '3439JJ', 'Nieuwegein', None),
 ('ah-hoogeveen', 'AH diepvries-DC Hoogeveen', 'Albert Heijn', 'dc', 'Plesmanstraat', '22', '7903BE', 'Hoogeveen', None),
 ('ju-raalte', 'Jumbo DC Raalte', 'Jumbo', 'dc', 'Kotterstraat', '12', '8102HZ', 'Raalte', None),
 ('ju-beilen', 'Jumbo DC Beilen', 'Jumbo', 'dc', 'Kanaalweg', '15', '9411KB', 'Beilen', None),
 ('ju-veghel', 'Jumbo DC Veghel', 'Jumbo', 'dc', 'De Amert', '409', '5462GH', 'Veghel', (51.622077, 5.511488)),
 ('ju-breda', 'Jumbo DC Breda', 'Jumbo', 'dc', 'IABC', '5104', None, 'Breda', (51.585284, 4.728387)),
 ('ju-woerden', 'Jumbo DC Woerden', 'Jumbo', 'dc', 'Finse Golf', '7', '3446CK', 'Woerden', (52.076972, 4.911248)),
 ('ju-denbosch', "Jumbo DC 's-Hertogenbosch", 'Jumbo', 'dc', 'Balkweg', None, None, "'s-Hertogenbosch", (51.708079, 5.331645)),
 ('ju-nieuwegein', 'Jumbo DC Nieuwegein', 'Jumbo', 'dc', 'Ravenswade', '14', '3439LD', 'Nieuwegein', None),
 ('ju-bleiswijk', 'Jumbo DC Bleiswijk', 'Jumbo', 'dc', 'Laan van Mathenesse', '9', '2665MZ', 'Bleiswijk', None),
 ('pl-oss', 'Plus DC Oss', 'Plus', 'dc', 'Keltenweg', '30', '5342LP', 'Oss', None),
 ('pl-barneveld', 'Plus diepvries-DC Barneveld', 'Plus', 'dc', 'Harselaarseweg', '133', '3771MA', 'Barneveld', None),
 ('li-almere', 'Lidl DC Almere', 'Lidl', 'dc', 'Brigitten', '1', '1358CE', 'Almere', None),
 ('li-waddinxveen', 'Lidl DC Waddinxveen', 'Lidl', 'dc', 'Louis Dobbelmannweg', '1', '2742JZ', 'Waddinxveen', None),
 ('li-ettenleur', 'Lidl DC Etten-Leur', 'Lidl', 'dc', 'Zwarthoofd', '5', '4878AL', 'Etten-Leur', None),
 ('li-oosterhout', 'Lidl DC Oosterhout', 'Lidl', 'dc', 'Rietgraaf', '1', '6678PJ', 'Oosterhout', None),
 ('li-weert', 'Lidl DC Weert', 'Lidl', 'dc', 'Singelvenweg', '1', None, 'Weert', (51.247797, 5.670523)),
 ('li-heerenveen', 'Lidl DC Heerenveen', 'Lidl', 'dc', 'Minerva', '1', '8448CT', 'Heerenveen', (52.975795, 5.949538)),
 ('li-oudgastel', 'Lidl DC Oud Gastel', 'Lidl', 'dc', 'De Ruif', '1', '4751XH', 'Oud Gastel', (51.584984, 4.462049)),
 ('li-breda', 'Lidl DC Breda', 'Lidl', 'dc', 'IABC', '5325', '4814RB', 'Breda', (51.587731, 4.731762)),
 ('sp-waalwijk', 'SPAR DC Waalwijk', 'SPAR', 'dc', 'Zijlweg', '16', '5145NR', 'Waalwijk', None),
 ('vo-alkmaar', 'Vomar DC Alkmaar', 'Vomar', 'dc', 'Opaalstraat', '15', '1812RH', 'Alkmaar', None),
 ('al-culemborg', 'Aldi DC Culemborg', 'Aldi', 'dc', 'Pascalweg', '21', '4104BE', 'Culemborg', (51.938291, 5.201961)),
 ('al-roosendaal', 'Aldi DC Roosendaal', 'Aldi', 'dc', 'Tussenriemer', '40', '4704SR', 'Roosendaal', (51.550253, 4.452810)),
 ('al-deventer', 'Aldi DC Deventer', 'Aldi', 'dc', 'Birnieweg', '13', '7418HH', 'Deventer', (52.233845, 6.202900)),
 ('di-sassenheim', 'Dirk DC Sassenheim', 'Dirk', 'dc', 'Edisonstraat', None, None, 'Sassenheim', (52.209879, 4.493464)),
 ('et-beverwijk', 'Etos DC Beverwijk', 'Etos', 'dc', 'Rijnland', '4', '1948RL', 'Beverwijk', None),
 # producenten en klanten uit de vacatures
 ('hei-denbosch', "Heineken Brouwerij 's-Hertogenbosch", 'Heineken', 'fabriek', 'Rietveldenweg', '25', '5222AP', "'s-Hertogenbosch", (51.698744, 5.280452)),
 ('hei-zoeterwoude', 'Heineken Brouwerij Zoeterwoude', 'Heineken', 'fabriek', 'Burgemeester Smeetsweg', '1', '2382PH', 'Zoeterwoude', (52.137543, 4.534042)),
 ('bav-lieshout', 'Bavaria Lieshout', 'Bavaria', 'fabriek', 'De Stater', '1', '5737RV', 'Lieshout', None),
 ('vru-bunnik', 'Vrumona Bunnik', 'Vrumona', 'fabriek', 'Vrumonaweg', '2', '3981HT', 'Bunnik', (52.062981, 5.204788)),
 ('bor-aalsmeer', 'Bakkersland Aalsmeer (Borgesius)', 'Borgesius', 'fabriek', 'Japanlaan', '4', '1432DK', 'Aalsmeer', None),
 ('bor-tholen', 'Borgesius Tholen', 'Borgesius', 'fabriek', 'Energieweg', '32', '4691SG', 'Tholen', (51.547534, 4.224287)),
 ('bor-arnhem', 'Borgesius Nieuw Amsterdam Arnhem', 'Borgesius', 'fabriek', 'P. Calandweg', '5', '6827BJ', 'Arnhem', (51.978195, 5.941337)),
 ('bcl-ridderkerk', 'Bakker Barendrecht Ridderkerk', 'Bakker Centraal Inkoop', 'fabriek', 'Handelsweg', '20', '2988DB', 'Ridderkerk', None),
 ('pep-broek', "PepsiCo (Lay's) Broek op Langedijk", 'PepsiCo', 'fabriek', 'Westelijke Randweg', '5', '1721CH', 'Broek op Langedijk', None),
 ('fc-maasdam', 'FrieslandCampina Maasdam', 'FrieslandCampina', 'fabriek', 'Zuivelstraat', '1', '3299XZ', 'Maasdam', (51.793071, 4.549196)),
 ('fc-veghel', 'FrieslandCampina Veghel', 'FrieslandCampina', 'fabriek', 'NCB-laan', '80', '5462GE', 'Veghel', (51.616160, 5.523929)),
 ('fc-rotterdam', 'FrieslandCampina Rotterdam', 'FrieslandCampina', 'fabriek', 'Industrieweg', '84', '3044CC', 'Rotterdam', (51.929709, 4.416089)),
 ('fc-lochem', 'FrieslandCampina Lochem', 'FrieslandCampina', 'fabriek', 'Kanaalstraat', '4', '7241DA', 'Lochem', (52.164249, 6.424471)),
 ('fc-steenderen', 'FrieslandCampina Steenderen', 'FrieslandCampina', 'fabriek', 'Toldijkseweg', '21', '7221DB', 'Steenderen', (52.059653, 6.196884)),
 ('fc-balkbrug', 'FrieslandCampina Balkbrug', 'FrieslandCampina', 'fabriek', 'Coevorderweg', '40', '7707AR', 'Balkbrug', (52.602225, 6.397209)),
 ('fc-lutjewinkel', 'FrieslandCampina Lutjewinkel', 'FrieslandCampina', 'fabriek', 'Mientweg', '20', '1732LE', 'Lutjewinkel', (52.764573, 4.881929)),
 ('fc-workum', 'FrieslandCampina Workum', 'FrieslandCampina', 'fabriek', 'Spoardyk', '21', '8711CK', 'Workum', (52.975048, 5.456443)),
 ('fc-wolvega', 'FrieslandCampina Wolvega', 'FrieslandCampina', 'fabriek', 'Frisaxstraat', '4', '8471ZW', 'Wolvega', (52.884567, 5.997050)),
 ('fc-beilen', 'FrieslandCampina Domo Beilen', 'FrieslandCampina', 'fabriek', 'De Perk', '30', '9411PZ', 'Beilen', (52.856151, 6.518946)),
 ('fc-marum', 'FrieslandCampina Marum', 'FrieslandCampina', 'fabriek', 'Noorderringweg', '33', '9363HA', 'Marum', (53.145294, 6.255065)),
 ('fc-leeuwarden', 'FrieslandCampina Leeuwarden', 'FrieslandCampina', 'fabriek', 'Pieter Stuyvesantweg', '1', '8937AC', 'Leeuwarden', (53.198904, 5.820175)),
 ('fc-bedum', 'FrieslandCampina Domo Bedum', 'FrieslandCampina', 'fabriek', 'Boterdiep WZ', '45', '9781EL', 'Bedum', (53.309260, 6.597175)),
 ('fc-noordwijk', 'FrieslandCampina Noordwijk', 'FrieslandCampina', 'fabriek', 'Noorderweg', '27', '9824PA', 'Noordwijk', (53.171088, 6.257141)),
 ('cos-dinteloord', 'Suiker Unie Dinteloord (Cosun)', 'Cosun', 'fabriek', 'Noordzeedijk', '113', '4671TL', 'Dinteloord', (51.618909, 4.431538)),
 ('cos-protein', 'Cosun Protein Dinteloord', 'Cosun', 'fabriek', 'Kreekweg', '1', '4671VA', 'Dinteloord', (51.614186, 4.427941)),
 ('cos-puttershoek', 'Suiker Unie DC Puttershoek', 'Cosun', 'fabriek', 'Rustenburgstraat', '8', '3297LG', 'Puttershoek', (51.809987, 4.561211)),
 ('cos-roosendaal', 'Cosun Roosendaal', 'Cosun', 'fabriek', 'Borchwerf', '7', '4704RG', 'Roosendaal', (51.543957, 4.455269)),
 ('epp-amstelveen', 'Euro Pizza Products Amstelveen', 'Euro Pizza Products', 'fabriek', 'Smederij', '13', '1185ZR', 'Amstelveen', None),
 ('ruig-oostzaan', 'Koninklijke Ruig Oostzaan', 'Ruig', 'fabriek', 'Zuideinde', '235', '1511GE', 'Oostzaan', None),
 ('pat-avenhorn', 'Bakkerij Pater Avenhorn', 'Pater', 'fabriek', 'Koningsspil', '25', '1633GL', 'Avenhorn', None),
 ('goe-emmeloord', 'Bakkerij Goedhart Emmeloord', 'Goedhart', 'fabriek', 'Nijverheidstraat', '3', '8301AD', 'Emmeloord', None),
 ('kn-utrecht', 'Kuehne + Nagel Utrecht', 'Kuehne + Nagel', 'dc', 'Atoomweg', '111', '3542AB', 'Utrecht', None),
 ('tu-alphen', 'Technische Unie DC Alphen aan den Rijn', 'Technische Unie', 'dc', 'Bedrijfsweg', '12', '2404CB', 'Alphen aan den Rijn', (52.136620, 4.638940)),
]
pcs = sorted({h[6] for h in H if h[6]})
t = pq.read_table(addrsrc, columns=['street', 'number', 'unit', 'postcode', 'address_levels', 'geometry'], filters=[('postcode', 'in', pcs)])
A = collections.defaultdict(list)
for r in t.to_pylist(): A[(r['postcode'], r['number'])].append(r)
def km(a, b):
    cl = math.cos(math.radians((a[1] + b[1]) / 2)); return math.hypot((a[0] - b[0]) * cl * 111.32, (a[1] - b[1]) * 111.32)
res = []
for i, (id_, naam, form, soort, st, nr, pc, pl, fb) in enumerate(H):
    rows = A.get((pc, nr), []) if pc and nr else []
    rows = sorted(rows, key=lambda r: (r['unit'] or ''))
    src = None
    if rows:
        g = shapely.from_wkb(rows[0]['geometry']); lon, lat = g.x, g.y; src = 'bag'
        if fb and km((lon, lat), (fb[1], fb[0])) > 1.0: print('  LET OP afstand BAG-place', id_, round(km((lon, lat), (fb[1], fb[0])), 2))
    elif fb:
        lat, lon = fb; src = 'places'
    else:
        print('GEEN POSITIE', id_); continue
    res.append({'id': id_, 'naam': naam, 'formule': form, 'soort': soort, 'plaats': pl, 'adres': f"{st} {nr or ''}".strip() + (f", {pc[:4]} {pc[4:]}" if pc else ''), 'lon': round(lon, 6), 'lat': round(lat, 6), 'src': src})
    print(id_, src, round(lat, 6), round(lon, 6))
# groothandels uit Overture Places
pt = pq.read_table(placesrc, columns=['names', 'basic_category', 'taxonomy', 'addresses', 'geometry', 'operating_status', 'confidence'])
names = pt.column('names').combine_chunks().field('primary').to_pylist()
basic = pt.column('basic_category').to_pylist(); tax = pt.column('taxonomy').combine_chunks().field('primary').to_pylist()
ops = pt.column('operating_status').to_pylist(); addr = pt.column('addresses').to_pylist(); conf = pt.column('confidence').to_pylist()
geom = shapely.from_wkb(pt.column('geometry').to_numpy(zero_copy_only=False)); X = shapely.get_x(geom); Y = shapely.get_y(geom)
pat = re.compile(r'^(sligro|hanos|makro|bidfood)\b', re.I)
bad = re.compile(r'tank|kerst|parkeren|research|holding|food group|nederland|hoofdkantoor|kantoor|ispc|non-food|logistiek|vers distributie|bezorg|shop$', re.I)
okcat = {'wholesaler', 'warehouse_club_store', 'restaurant_wholesale', 'food_and_beverage_store', 'grocery_store', 'superstore', 'professional_service', 'b2b_office_and_professional_', 'b2b_business_management_services', 'shopping', 'warehouse', 'b2b_transportation_and_storage_service', 'food_beverage_distributor', 'supplier_or_distributor'}
G = []
for i, n in enumerate(names):
    if not n or not pat.search(n) or bad.search(n): continue
    a = (addr[i] or [{}])[0] if addr[i] else {}
    if (a.get('country') or '') != 'NL' or ops[i] == 'permanently_closed': continue
    if not ({basic[i], tax[i]} & okcat): continue
    G.append((pat.search(n).group(1).capitalize().replace('Hanos', 'HANOS'), n, a.get('locality'), float(X[i]), float(Y[i]), conf[i] or 0))
G.sort(key=lambda g: -g[5]); kept = []
for g in G:
    if any(k[0] == g[0] and km((k[3], k[4]), (g[3], g[4])) < 1.0 for k in kept): continue
    kept.append(g)
cnt = collections.Counter()
for f, n, loc, x, y, c in kept:
    pl = (loc or '').strip()
    if pl.isupper(): pl = pl.title()
    pl = re.sub(r'^Amsterdam-Duivendrecht$', 'Duivendrecht', pl)
    nm = f"{f} {pl}" if pl and pl.lower() not in n.lower() else re.sub(r'^(sligro|hanos|makro|bidfood)', f, n, flags=re.I)
    nm = re.sub(r'\s+(Horeca Groothandel|Bezorgservice)\b', '', nm)
    cnt[f] += 1
    res.append({'id': f"{f.lower()}-{re.sub(r'[^a-z]', '', pl.lower())[:12]}{cnt[f]}", 'naam': nm, 'formule': f, 'soort': 'groothandel', 'plaats': pl, 'adres': '', 'lon': round(x, 6), 'lat': round(y, 6), 'src': 'places'})
print('groothandels', len(kept), cnt)
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=0)
print('totaal', len(res), collections.Counter(r['soort'] for r in res))
