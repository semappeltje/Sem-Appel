# Schrijft src/data/charters.json: de charters van de flexibele schil (gesimuleerd).
#   python3 -I tools/ct4/charters.py src/data
# Verzonnen vervoerders (namen van planten en vogels, zodat ze niet op een bestaand bedrijf lijken), verzonnen
# contactpersonen, fictieve nummers en adressen: mobiel 06 9... (de reeks 069 is niet uitgegeven), vast 0229 0... (een
# abonneenummer begint niet met 0) en e-mail op .example (gereserveerd, komt nooit aan). De plaats is echt (voor de
# afstand tot een standplaats, coordinaten uit places.json). Capaciteit, tarief, betrouwbaarheid en beschikbaarheid zijn
# schattingen uit een vaste seed. Deterministisch: dezelfde invoer geeft hetzelfde bestand.
import sys, json, random
D = sys.argv[1]
P = json.load(open(f'{D}/places.json'))
PLAATS = {t['n']: (t['lon'], t['lat']) for t in P['TOWNS']}
PLAATS.update({c['n']: (c['lon'], c['lat']) for c in P['CITIES'] if c['n'] not in PLAATS})
R = random.Random(20261025)

# naam, plaats, regio, opleggers (welke soorten de charter trekt of levert), voertuigen, trekkers, contactpersoon, opmerking
LIJST = [
    ('Zeekraal Koeltransport', 'Hoorn', 'Noord-Holland', ['koel', 'vries', 'droog'], ['trekker'], 8, 'Anja Hofstede', "Koel en vries, ook 's nachts"),
    ('Kalmoes Vervoer', 'Zwaag', 'Noord-Holland', ['droog', 'huif', 'city', 'koel'], ['trekker', 'bakwagen'], 5, 'Erwin Verkerk', 'Ook bakwagens voor de stad'),
    ('Lamsoor Logistiek', 'Purmerend', 'Noord-Holland', ['droog', 'huif', 'lzv', 'koel'], ['trekker'], 6, 'Monique Lindeman', 'LZV-ontheffing, chauffeurs met LZV-opleiding'),
    ('Krabbenscheer Charters', 'Heerhugowaard', 'Noord-Holland', ['silo', 'droog', 'huif'], ['trekker'], 4, 'Ruben Oosterhuis', 'Trekkers met compressor voor silo-opleggers'),
    ('Pijlkruid Transport', 'Gouda', 'Randstad Zuid', ['koel', 'vries', 'droog', 'drank'], ['trekker'], 7, 'Saskia Bremer', 'Ervaring met drankenopleggers'),
    ('Fonteinkruid Koelvervoer', 'Zoetermeer', 'Randstad Zuid', ['koel', 'vries'], ['trekker'], 5, 'Gerard Kooistra', 'Alleen geconditioneerd vervoer'),
    ('Wilgenroos Distributie', 'Dordrecht', 'Randstad Zuid', ['droog', 'huif', 'city', 'lzv', 'drank'], ['trekker', 'bakwagen'], 6, 'Ilona Terpstra', 'LZV-ontheffing; ook bakwagens'),
    ('Helmgras Logistiek', 'Deventer', 'Oost', ['droog', 'huif', 'lzv', 'koel'], ['trekker'], 9, 'Johan Wesseling', 'Grote charter met eigen planning, ook in het weekend'),
    ('Ratelaar Vervoer', 'Nijmegen', 'Oost', ['koel', 'vries', 'droog'], ['trekker'], 4, 'Wendy van Gils', 'Klein bedrijf, snel ter plaatse in de regio'),
    ('Kraaiheide Transport', 'Apeldoorn', 'Oost', ['silo', 'droog', 'huif'], ['trekker'], 5, 'Michiel Mulders', 'Bulk en silo, trekkers met compressor'),
    ('Veenpluis Transport', 'Assen', 'Noord', ['koel', 'vries', 'droog', 'huif'], ['trekker'], 6, 'Petra Ploeg', 'Rijdt ook voor DC\'s in het noorden'),
    ('Kievitsbloem Koeltransport', 'Drachten', 'Noord', ['koel', 'vries', 'city'], ['trekker', 'bakwagen'], 4, 'Arno Siebers', 'Koel en vries; bakwagens met laadklep'),
    ('Zwanebloem Logistiek', 'Eindhoven', 'Zuid', ['droog', 'huif', 'drank', 'koel'], ['trekker'], 7, 'Esther Tjalsma', 'Ervaring met dranken en emballage'),
    ('Duizendknoop Transport', 'Roosendaal', 'Zuid', ['silo', 'droog', 'huif', 'lzv'], ['trekker'], 5, 'Hugo Brinkhuis', 'Bulk en LZV, dicht bij de suikerfabrieken'),
    ('Moerasvaren Charters', 'Venlo', 'Zuid', ['koel', 'vries', 'droog'], ['trekker'], 6, 'Nathalie Rietkamp', "Koel en vries, ook 's nachts"),
]

gebruikt = set()
def nummer(soort):
    while True:
        if soort == '0229': n = f"0229 0{R.randint(1, 9)} {R.randint(10, 99)} {R.randint(10, 99)}"
        else: n = f"06 9{R.randint(0, 9)} {R.randint(10, 99)} {R.randint(10, 99)} {R.randint(10, 99)}"
        if n not in gebruikt: gebruikt.add(n); return n

out = []
for i, (naam, plaats, regio, opl, voert, trek, contact, opm) in enumerate(LIJST, 1):
    lon, lat = PLAATS[plaats]
    koel = any(o in ('koel', 'vries') for o in opl)
    per_dag = max(1, min(trek - 1, round(trek * R.uniform(0.25, 0.45))))
    ritten = R.randint(6, 14) * per_dag
    out.append({
        'id': f'CH-{i:02d}', 'naam': naam, 'plaats': plaats, 'regio': regio, 'lon': round(lon, 4), 'lat': round(lat, 4),
        'tel': nummer('0229' if plaats in ('Hoorn', 'Zwaag') else '06'),
        'email': 'planning@' + naam.lower().replace(' ', '-') + '.example',
        'contactpersoon': contact,
        'opleggers': opl, 'voertuigen': voert,
        'capaciteit': {'trekkers': trek, 'perDag': per_dag},
        'tarief': {'perUur': round(R.uniform(47, 57) + (3 if koel else 0), 1), 'perKm': round(R.uniform(0.52, 0.72), 2), 'schatting': True},
        'betrouwbaarheid': {'opTijd': round(R.uniform(86, 99), 1), 'ritten': ritten, 'annuleringen': R.choice([0, 0, 1, 1, 1, 2, 3])},
        'beschikbaar': {'vandaag': R.choice([0] + list(range(1, per_dag + 1)) * 2), 'morgen': R.choice(list(range(1, per_dag + 1)))},
        'opmerking': opm,
        'gesimuleerd': True,
    })

doc = {
    '_toelichting': 'Gesimuleerd: verzonnen vervoerders voor de flexibele schil van de demo. Namen, contactpersonen, telefoonnummers '
                    '(06 9..., 0229 0...: reeksen die niet zijn uitgegeven) en e-mailadressen (.example) zijn fictief. De plaats is echt. '
                    'Capaciteit (trekkers in totaal, per dag voor ons), tarief (per uur en per km, schatting), betrouwbaarheid '
                    '(op tijd in procent, ritten en annuleringen in acht weken) en beschikbaarheid (trekkers vandaag en morgen) zijn '
                    'schattingen. opleggers: welke soorten de charter trekt of levert (koel, vries, droog, huif, lzv, silo, drank, city).',
    'datum': '2026-10-25',
    'charters': out,
}
with open(f'{D}/charters.json', 'w') as f:
    f.write('{\n')
    f.write(f'  "_toelichting": {json.dumps(doc["_toelichting"], ensure_ascii=False)},\n')
    f.write(f'  "datum": {json.dumps(doc["datum"])},\n')
    f.write('  "charters": [\n')
    f.write(',\n'.join('    ' + json.dumps(c, ensure_ascii=False) for c in out))
    f.write('\n  ]\n}\n')
print(len(out), 'charters')
