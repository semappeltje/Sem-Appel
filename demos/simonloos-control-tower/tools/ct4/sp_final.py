# De 42 standplaatsen: adres, positie (BAG-adrespunt) en bron, met de correcties uit het nazoeken.
import sys, json
geo = json.load(open(sys.argv[1])); out = sys.argv[2]; NAMES = [x['n'] for x in json.load(open(sys.argv[3]))['SP']]
V = 'https://werkenbijsimonloos.nl/vacatures/'
# naam: (straat, nr, postcode, plaats, vacature, lon, lat, opmerking, klant van de vacature)
FIX = {
 'Almere': ('Brigitten', '1', '1358 CE', 'Almere', None, 5.311747, 52.314597, 'De vacature noemt postcode 1358 CB; de BAG kent Brigitten 1 onder 1358 CE (Lidl DC Almere).'),
 'Amstelveen': ('Smederij', '13', '1185 ZR', 'Amstelveen', None, 4.83625, 52.283038, 'De vacature noemt postcode 1185 ZP; de BAG kent Smederij 13 onder 1185 ZR (Euro Pizza Products).'),
 'Nijkerk': ('Gildenstraat', '30', '3861 RG', 'Nijkerk', None, 5.478553, 52.236603, 'De vacature noemt postcode 3861 TG; de BAG kent Gildenstraat 30 onder 3861 RG.'),
 'Den Bosch': ('Rietveldenweg', '15', '5222 AP', "'s-Hertogenbosch", None, 5.283208, 51.698115, "De vacature noemt postcode 5222 AL; de BAG kent Rietveldenweg 15 onder 5222 AP (bij de Heineken-brouwerij, Rietveldenweg 25)."),
 'Alkmaar': ('Opaalstraat', '15', '1812 RH', 'Alkmaar', None, 4.75049, 52.604715, 'De vacature noemt Opaalstraat 5; dat nummer bestaat niet in de BAG. Het Vomar DC staat op Opaalstraat 15 (Overture Places), dat adres is gebruikt.'),
 'Bleiswijk': ('Laan van Mathenesse', '9', '2665 MZ', 'Bleiswijk', None, 4.53557, 52.034334, 'De vacature (JSON-LD) noemt Dorpsstraat 39, het adres van de Jumbo-winkel; de tekst zegt dat je begint bij het distributiecentrum in Bleiswijk. Het Jumbo DC Bleiswijk staat op Laan van Mathenesse 9 (nieuwsbericht dils.com, september 2025). Benadering: het DC-adres in plaats van het vacature-adres.'),
 'Weert': ('Singelvenweg', '1', '6002 SE', 'Weert', None, 5.670523, 51.247797, 'De BAG in Overture kent de Singelvenweg niet; positie van het Lidl DC Weert uit Overture Places (Singelvenweg 1). Benadering op ongeveer 50 m.'),
}
NOTE = {
 'Heinenoord': 'Bedrijfsverzamelgebouw Reedijk 7 (veel units); volgens de vacature laden de chauffeurs bij het Plus DC in Oss.',
 'Oosterhout': 'Oosterhout in Gelderland (gemeente Overbetuwe, Park15), niet Oosterhout in Noord-Brabant: provincie en regio aangepast.',
 'Bunnik': 'Vrumona zelf zit op Vrumonaweg 2 (1,2 km); de standplaats volgt het vacature-adres Schoudermantel 52.',
 'Zwolle': 'Tweede adres voor bulk: Mindenstraat 20, 8028 PK Zwolle (vacature chauffeur-bulktransport-zwolle-718).',
 'Dinteloord': 'Tweede adres (weekend): Noordzeedijk 113-14, 4671 TL Dinteloord, bij Cosun Beet Company.',
 'Nieuwegein': 'Tweede adres (rangeerder, Jumbo): Ravenswade 14, 3439 LD Nieuwegein.',
 'Tilburg': 'Tweede adres (teamleider operatie): Jules Verneweg 76, 5015 BH Tilburg (BAG kent 79 en 81, niet 76).',
}
KLANT = {  # klant zoals de vacaturetitel die noemt (25-10-2026), waar die afwijkt van places.json
 'Amstelveen': 'Euro Pizza Products', 'Beverwijk': 'Etos', 'Oostzaan': 'Ruig (pluimvee)', 'Amsterdam': 'Technische Unie',
 'Avenhorn': 'Bakkerij Pater (brood)', 'Emmeloord': 'Bakkerij Goedhart (brood)', 'Maasdam': 'Netwerk (FrieslandCampina)',
 'Veghel': 'Netwerk (Kuehne + Nagel)', 'Broek op Langedijk': "Netwerk (LZV, Lay's)", 'Dinteloord': 'Bulk (Cosun)',
}
VAC = {'Almere': 'vrachtwagenchauffeur-ce-winkeldistributie-almere-264', 'Amstelveen': 'vrachtwagenchauffeur-c-amstelveen-26', 'Nijkerk': 'chauffeur-netwerktransport-nijkerk-706', 'Den Bosch': 'vrachtwagenchauffeur-ce-dranken-den-bosch-759', 'Weert': 'vrachtwagenchauffeur-ce-winkeldistributie-weert-557'}
res = {}
for n in NAMES:
    v = geo.get(n) or {'vacature': VAC[n]}
    if n in FIX:
        st, nr, pc, pl, _, lon, lat, note = FIX[n]
    else:
        st, nr, pc, pl, lon, lat, note = v['straat'], v['nr'], v['postcode'], (v['plaats_bag'] or [v['plaats']])[0], v['lon'], v['lat'], ''
        if n == 'Maasdam': nr = '4-8'
    if n in NOTE: note = (note + ' ' + NOTE[n]).strip()
    res[n] = {'adres': {'straat': st, 'nr': nr, 'postcode': pc, 'plaats': pl}, 'lon': lon, 'lat': lat, 'bron': V + v['vacature'], 'datum': '2026-10-25', 'opm': note, 'klantVacature': KLANT.get(n)}
for n in FIX:
    if n not in res: print('ontbreekt', n)
print(len(res))
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
