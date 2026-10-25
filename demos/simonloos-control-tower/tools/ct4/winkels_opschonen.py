"""Winkels die geen winkel zijn uit klanten.json (en hun toegangsroute uit toegang.json) halen.

Overture Places heeft hier en daar een winkel op het adres van een standplaats, een DC of een hoofdkantoor: "Etos Wognum -
Tender 2" is het hoofdkantoor van Simon Loos (Tender 2, Wognum), "Albert Heijn Pegasusweg Tilburg" is AH DC Tilburg (de
standplaats Tilburg), "AH Pijnacker Delfgauw" ligt op het terrein van AH DC Pijnacker, "Aldi Holding Bv Culemborg" is het
DC en kantoor van Aldi. Een winkel valt af als
  - de naam "Tender" (de straat van het hoofdkantoor), "holding" of "hoofdkantoor" bevat;
  - hij binnen 25 m van het adrespunt van een standplaats of DC ligt (de plek is dan het BAG-adrespunt van hetzelfde adres);
  - hij op het terrein van een standplaats ligt.
De nummers van de andere winkels blijven gelijk (ah1011 blijft ah1011), zodat dit hetzelfde geeft als build_data.py
opnieuw draaien: build_data.py roept dit script aan nadat het klanten.json en toegang.json schreef.
gebruik: winkels_opschonen.py <src/data van de app>
"""
import sys, json, math, re
D = sys.argv[1]
P = json.load(open(f'{D}/places.json')); K = json.load(open(f'{D}/klanten.json')); T = json.load(open(f'{D}/toegang.json'))
NAAM = re.compile(r'\b(tender|holding|hoofdkantoor)\b', re.I)
def m(a, b):
    k = math.cos(math.radians((a[1] + b[1]) / 2)); return math.hypot((a[0] - b[0]) * k * 111320, (a[1] - b[1]) * 111320)
def binnen(x, y, r):
    c = False; j = len(r) - 1
    for i in range(len(r)):
        yi, yj = r[i][1], r[j][1]
        if (yi > y) != (yj > y) and x < r[i][0] + (y - yi) / (yj - yi) * (r[j][0] - r[i][0]): c = not c
        j = i
    return c
adres = [(s['n'], (s['lon'], s['lat'])) for s in P['SP']] + [(d['naam'], (d['lon'], d['lat'])) for d in K['dcs'] if d.get('soort') == 'dc']
terrein = [(s['n'], s['terrein']) for s in P['SP'] if isinstance(s.get('terrein'), list) and len(s['terrein']) > 2]
def reden(w):
    if NAAM.search(w.get('naam') or ''): return 'naam'
    p = (w['lon'], w['lat'])
    for n, q in adres:
        if m(p, q) <= 25: return f'adres van {n}'
    for n, r in terrein:
        if binnen(p[0], p[1], r): return f'terrein van {n}'
    return None
weg = []
for w in K['stores']:
    r = reden(w)
    if r: weg.append((w, r))
ids = {w['id'] for w, _ in weg}
K['stores'] = [w for w in K['stores'] if w['id'] not in ids]
for i in ids: T.pop(i, None)
open(f'{D}/klanten.json', 'w').write(json.dumps(K, ensure_ascii=False, separators=(',', ':')))
open(f'{D}/toegang.json', 'w').write(json.dumps(T, ensure_ascii=False, separators=(',', ':')))
for w, r in weg: print('weg:', w['id'], w['naam'], '|', w.get('plaats'), '|', r)
print('winkels', len(K['stores']), '| weggehaald', len(weg))
