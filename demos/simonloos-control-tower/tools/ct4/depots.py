# Standplaatsen van Simon Loos: adres uit de vacaturepagina's van werkenbijsimonloos.nl (JSON-LD jobLocation, 25-10-2026),
# geocodering op het adrespunt in Overture Addresses (release 2026-10-21.0).
import sys, json, re
import pyarrow.parquet as pq, pyarrow.compute as pc, shapely
OUT = sys.argv[2]
# n (zoals in places.json), straat, huisnummer, toevoeging, postcode, plaats (zoals op de vacature), vacature-voorbeeld
D = [
 ('Wognum', 'Tender', '2', None, '1687JB', 'Wognum', 'administratief-medewerker-wognum-723'),
 ('Zaandam', 'Hoofdtocht', '1', None, '1507CJ', 'Zaandam', 'avondchauffeur-ce-winkeldistributie-zaandam-499'),
 ('Oss', 'Keltenweg', '30', None, '5342LP', 'Oss', 'leerling-chauffeur-c-ce-oss-189'),
 ('Zwolle', 'Galvaniweg', '1', None, '8013RG', 'Zwolle', 'vrachtwagenchauffeur-ce-winkeldistributie-zwolle-629'),
 ('Geldermalsen', 'Poppenbouwing', '14', None, '4191NZ', 'Geldermalsen', 'nachtchauffeur-ce-netwerktransport-geldermalsen-644'),
 ('Aalsmeer', 'Japanlaan', '4', None, '1432DK', 'Aalsmeer', 'avondchauffeur-ce-brooddistributie-aalsmeer-697'),
 ('Tiel', 'De Passen', '1', None, '4004LV', 'Tiel', 'crossdockmanager-tiel-tiel-737'),
 ('Barneveld', 'Harselaarseweg', '133', None, '3771MA', 'Barneveld', 'leerling-chauffeur-c-ce-barneveld-748'),
 ('Raalte', 'Kotterstraat', '12', None, '8102HZ', 'Raalte', 'vrachtwagenchauffeur-ce-winkeldistributie-raalte-494'),
 ('Waalwijk', 'Zijlweg', '18', None, '5145NR', 'Waalwijk', 'vrachtwagenchauffeur-ce-winkeldistributie-waalwijk-699'),
 ('Utrecht', 'Atoomweg', '111', None, '3542AB', 'Utrecht', 'vrachtwagenchauffeur-ce-netwerk-utrecht-651'),
 ('Nieuwegein', 'Inundatiedok', '38', None, '3439JJ', 'Nieuwegein', 'vrachtwagenchauffeur-ce-nieuwegein-59'),
 ('Almere', 'Brigitten', '1', None, '1358CB', 'Almere', 'vrachtwagenchauffeur-ce-winkeldistributie-almere-264'),
 ('Waddinxveen', 'Louis Dobbelmannweg', '1', None, '2742JZ', 'Waddinxveen', 'vrachtwagenchauffeur-ce-winkeldistributie-waddinxveen-490'),
 ('Dinteloord', 'Oliemolen', '7', None, '4671HB', 'Dinteloord', 'chauffeur-bulktransport-dinteloord-717'),
 ('Amstelveen', 'Smederij', '13', None, '1185ZP', 'Amstelveen', 'vrachtwagenchauffeur-c-amstelveen-26'),
 ('Pijnacker (Delfgauw)', 'Laan van Ruyven', '1', None, '2645EE', 'Delfgauw', 'vrachtwagenchauffeur-ce-winkeldistributie-delfgauw-506'),
 ('Opmeer', 'De Veken', '27', None, '1716KE', 'Opmeer', 'leerling-monteur-opmeer-625'),
 ('Ede', 'Neonstraat', '29', None, '6718WX', 'Ede', 'vrachtwagenchauffeur-ce-netwerk-ede-641'),
 ('Maasdam', 'Lageweg', '4', None, '3299AL', 'Maasdam', 'vrachtwagenchauffeur-ce-netwerk-maasdam-708'),
 ('Veghel', 'Marshallweg', '1', None, '5466AH', 'Veghel', 'vrachtwagenchauffeur-ce-netwerk-veghel-660'),
 ('Etten-Leur', 'Zwarthoofd', '5', None, '4878AL', 'Etten-Leur', 'vrachtwagenchauffeur-ce-winkeldistributie-etten-leur-418'),
 ('Alkmaar', 'Opaalstraat', '5', None, '1812RH', 'Alkmaar', 'vrachtwagenchauffeur-ce-winkeldistributie-alkmaar-682'),
 ('Tilburg', 'Pegasusweg', '1', None, '5015BZ', 'Tilburg', 'vrachtwagenchauffeur-ce-winkeldistributie-tilburg-558'),
 ('Broek op Langedijk', 'Westelijke Randweg', '5', None, '1721CH', 'Broek op Langedijk', 'vrachtwagenchauffeur-lzv-netwerk-broek-op-langedijk-661'),
 ('Hoogeveen', 'Plesmanstraat', '22', None, '7903BE', 'Hoogeveen', 'vrachtwagenchauffeur-ce-winkeldistributie-hoogeveen-530'),
 ('Oostzaan', 'Zuideinde', '235', None, '1511GE', 'Oostzaan', 'avondchauffeur-c-oostzaan-752'),
 ('Nijkerk', 'Gildenstraat', '30', None, '3861TG', 'Nijkerk', 'chauffeur-netwerktransport-nijkerk-706'),
 ('Bunnik', 'Schoudermantel', '52', None, '3981AH', 'Bunnik', 'nachtchauffeur-ce-dranken-bunnik-757'),
 ('Heerenveen', 'Minerva', '36', None, '8448CS', 'Heerenveen', 'nachtchauffeur-lzv-winkeldistributie-heerenveen-535'),
 ('Amsterdam', 'Basisweg', '75', None, '1043AN', 'Amsterdam', 'vrachtwagenchauffeur-c-amsterdam-579'),
 ('Avenhorn', 'Koningsspil', '25', None, '1633GL', 'Avenhorn', 'vrachtwagenchauffeur-ce-brooddistributie-avenhorn-703'),
 ('Emmeloord', 'Nijverheidstraat', '3', None, '8301AD', 'Emmeloord', 'vrachtwagenchauffeur-ce-brooddistributie-nacht-emmeloord-441'),
 ('Den Bosch', 'Rietveldenweg', '15', None, '5222AL', "'s-Hertogenbosch", 'vrachtwagenchauffeur-ce-dranken-den-bosch-759'),
 ('Lieshout', 'De Stater', '1', None, '5737RV', 'Lieshout', 'vrachtwagenchauffeur-ce-dranken-lieshout-758'),
 ('Ridderkerk', 'Handelsweg', '20', None, '2988DB', 'Ridderkerk', 'vrachtwagenchauffeur-ce-netwerk-ridderkerk-667'),
 ('Beilen', 'Kanaalweg', '15', None, '9411KB', 'Beilen', 'vrachtwagenchauffeur-ce-winkeldistributie-beilen-551'),
 ('Beverwijk', 'Rijnland', '4', None, '1948RL', 'Beverwijk', 'vrachtwagenchauffeur-ce-winkeldistributie-beverwijk-554'),
 ('Bleiswijk', 'Dorpsstraat', '39', None, '2665BG', 'Bleiswijk', 'vrachtwagenchauffeur-ce-winkeldistributie-bleiswijk-430'),
 ('Heinenoord', 'Reedijk', '7', None, '3274KE', 'Heinenoord', 'vrachtwagenchauffeur-ce-winkeldistributie-heinenoord-505'),
 ('Oosterhout', 'Rietgraaf', '1', None, '6678PJ', 'Oosterhout', 'vrachtwagenchauffeur-ce-winkeldistributie-oosterhout-482'),
 ('Weert', 'Singelvenweg', '1', None, '6002SE', 'Weert', 'vrachtwagenchauffeur-ce-winkeldistributie-weert-557'),
 # tweede adressen (ter controle)
 ('Zwolle bulk', 'Mindenstraat', '20', None, '8028PK', 'Zwolle', 'chauffeur-bulktransport-zwolle-718'),
 ('Nieuwegein rangeer', 'Ravenswade', '14', None, '3439LW', 'Nieuwegein', 'rangeerder-b-nieuwegein-770'),
 ('Dinteloord weekend', 'Noordzeedijk', '113', None, '4671TL', 'Dinteloord', 'weekendchauffeur-dinteloord-725'),
 ('Tilburg operatie', 'Jules Verneweg', '76', None, '5015BH', 'Tilburg', 'teamleider-operatie-tilburg-730'),
]
pcs = sorted({d[4] for d in D})
t = pq.read_table(sys.argv[1], columns=['street', 'number', 'unit', 'postcode', 'address_levels', 'geometry'], filters=[('postcode', 'in', pcs)])
rows = t.to_pylist()
print('adressen in deze postcodes', len(rows))
res = {}
for n, street, num, unit, pc_, plaats, vac in D:
    cand = [r for r in rows if r['postcode'] == pc_]
    exact = [r for r in cand if (r['number'] or '') == num and (r['street'] or '').lower() == street.lower()]
    pick = None
    if exact:
        pick = sorted(exact, key=lambda r: (r['unit'] or ''))[0]
    else:
        same = [r for r in cand if (r['street'] or '').lower() == street.lower()]
        print('  GEEN EXACT', n, street, num, pc_, '| zelfde straat', [(r['number'], r['unit']) for r in same][:20], '| straten', sorted({r['street'] for r in cand}))
        if same:
            def k(r):
                try: return abs(int(re.sub(r'\D', '', r['number'] or '0')) - int(num))
                except: return 99
            pick = sorted(same, key=k)[0]
    if pick:
        g = shapely.from_wkb(pick['geometry'])
        lv = [a['value'] for a in (pick['address_levels'] or [])]
        res[n] = {'straat': pick['street'], 'nr': pick['number'] + (pick['unit'] or ''), 'postcode': pick['postcode'][:4] + ' ' + pick['postcode'][4:], 'plaats_bag': lv, 'lon': round(g.x, 6), 'lat': round(g.y, 6), 'exact': bool(exact), 'vacature': vac, 'plaats': plaats}
        print(n, '|', pick['street'], pick['number'], pick['unit'], pick['postcode'], lv, round(g.y, 6), round(g.x, 6), 'exact' if exact else 'BENADERING', len(cand))
    else:
        print('NIETS', n)
json.dump(res, open(OUT, 'w'), indent=1, ensure_ascii=False)
