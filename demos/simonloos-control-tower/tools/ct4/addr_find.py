# zoek adressen op straatnaam (en optioneel huisnummer) in Overture Addresses NL
import sys, json
import pyarrow.parquet as pq, pyarrow.compute as pc, shapely
src = sys.argv[1]
qs = [q.split('|') for q in sys.argv[2:]]   # straat|nummer|plaatsfragment
streets = sorted({q[0] for q in qs})
t = pq.read_table(src, columns=['street', 'number', 'unit', 'postcode', 'address_levels', 'geometry'], filters=[('street', 'in', streets)])
rows = t.to_pylist()
for q in qs:
    st, num = q[0], q[1] if len(q) > 1 else ''
    pl = q[2].lower() if len(q) > 2 else ''
    m = [r for r in rows if r['street'] == st and (not pl or any(pl in a['value'].lower() for a in (r['address_levels'] or [])))]
    print('==', st, num, pl, len(m))
    if num:
        mm = [r for r in m if r['number'] == num]
        for r in (mm or m[:30]):
            g = shapely.from_wkb(r['geometry'])
            print('  ', r['street'], r['number'], r['unit'], r['postcode'], [a['value'] for a in r['address_levels']], round(g.y, 6), round(g.x, 6))
    else:
        pcs = sorted({(r['postcode'], r['number']) for r in m})
        print('  ', pcs[:60])
