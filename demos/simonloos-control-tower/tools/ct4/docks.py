# Docks per standplaats (schatting): het aantal laaddocks en hun plek in de gevel van de hoofdhal.
# Aantal: hub 30, warehouse 16, depot ongeveer één dock per zes voertuigen plus één (3 tot 9). Plek: langs de gevels van de hal die
# op vrije terreinruimte uitkijken (een strook van 28 m voor de gevel binnen het terrein en niet in een ander gebouw),
# deuren 4,5 m uit elkaar, de beste gevel eerst. Parkeerplekken in de strook direct voor de docks (20 m) vervallen, zodat
# een voertuig aan het dock niet op een geparkeerde oplegger staat.
#
#   python3 -I tools/ct4/docks.py src/data [qa-map]
#
# Schrijft in places.json per standplaats: docks (aantal), dockPlek [[lon, lat, koers], ...] (de deur in de gevel en de
# richting waarin een voertuig aan het dock staat, graden vanaf noord) en, als er plekken vervallen, rijen opnieuw.
import sys, json, math
import shapely
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
D = sys.argv[1]; QA = sys.argv[2] if len(sys.argv) > 2 else None
P = json.load(open(f'{D}/places.json')); B = json.load(open(f'{D}/buildings.json'))
GAP, EDGE_MIN, APRON, CLEAR, END = 4.5, 9.0, 28.0, 20.0, 4.0
def aantal(s):
    if s.get('hub'): return 30
    if s.get('wh'): return 16
    return max(3, min(9, round(s['fleet'] / 6) + 1))
stat = []
for s in P['SP']:
    lon0, lat0 = s['lon'], s['lat']; KX = math.cos(math.radians(lat0)) * 111320; KY = 111320.0
    fw = lambda p: (( p[0] - lon0) * KX, (p[1] - lat0) * KY)
    bw = lambda x, y: (round(x / KX + lon0, 6), round(y / KY + lat0, 6))
    hall = shapely.make_valid(Polygon([fw(p) for p in s['hal']]))
    if hall.geom_type != 'Polygon': hall = max(getattr(hall, 'geoms', [hall]), key=lambda g: g.area)
    terr = shapely.make_valid(Polygon([fw(p) for p in s['terrein']]))
    others = [shapely.make_valid(Polygon([fw(p) for p in b['p']])) for b in B.get(s['n'], []) if len(b['p']) >= 3]
    others = [g for g in others if g.is_valid and g.area > 0 and g.intersection(hall).area < 0.5 * min(g.area, hall.area)]
    blocked = unary_union([g.buffer(1.0) for g in others]) if others else Polygon()
    free = terr.difference(blocked).difference(hall.buffer(0.5))
    ring = list(hall.simplify(0.6).exterior.coords)[:-1]
    cand = []
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]; L = math.dist(a, b)
        if L < EDGE_MIN: continue
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L; nx, ny = uy, -ux
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        if hall.contains(Point(mid[0] + nx * 1.5, mid[1] + ny * 1.5)): nx, ny = -nx, -ny
        p0 = (a[0] + ux * END, a[1] + uy * END); p1 = (b[0] - ux * END, b[1] - uy * END)
        apron = Polygon([p0, p1, (p1[0] + nx * APRON, p1[1] + ny * APRON), (p0[0] + nx * APRON, p0[1] + ny * APRON)])
        if apron.area <= 0: continue
        fr = apron.intersection(free).area / apron.area
        if fr < 0.62: continue
        cand.append({'a': a, 'u': (ux, uy), 'n': (nx, ny), 'L': L, 'fr': fr, 'score': fr * fr * L})
    cand.sort(key=lambda c: -c['score'])
    want = aantal(s); docks = []
    for c in cand:
        k = 0; room = c['L'] - 2 * END
        if room < 3: continue
        n_here = int(room // GAP) + 1
        off = (room - (n_here - 1) * GAP) / 2 + END
        for k in range(n_here):
            if len(docks) >= want: break
            t = off + k * GAP; x = c['a'][0] + c['u'][0] * t; y = c['a'][1] + c['u'][1] * t
            # voor de deur moet een hele combinatie op vrij terrein passen (punten op 4, 9 en 17 m van de gevel)
            if not all(free.buffer(0.5).contains(Point(x + c['n'][0] * m, y + c['n'][1] * m)) for m in (4, 9, 17)): continue
            if any(math.dist((x, y), (d[0], d[1])) < GAP - 0.1 for d in docks): continue
            koers = (math.degrees(math.atan2(c['n'][0], c['n'][1])) + 360) % 360
            docks.append((x, y, koers, c['n']))
        if len(docks) >= want: break
    if len(docks) < 2 and cand == []:
        # geen bruikbare gevel (kleine hal of volle omgeving): docks langs de langste gevel, ongeacht de ruimte
        i = max(range(len(ring)), key=lambda i: math.dist(ring[i], ring[(i + 1) % len(ring)]))
        a, b = ring[i], ring[(i + 1) % len(ring)]; L = math.dist(a, b); ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L; nx, ny = uy, -ux
        if hall.contains(Point((a[0] + b[0]) / 2 + nx * 1.5, (a[1] + b[1]) / 2 + ny * 1.5)): nx, ny = -nx, -ny
        for k in range(min(want, max(2, int((L - 2) // GAP)))):
            t = L / 2 + (k - (want - 1) / 2) * GAP; docks.append((a[0] + ux * t, a[1] + uy * t, (math.degrees(math.atan2(nx, ny)) + 360) % 360, (nx, ny)))
    # parkeerplekken direct voor de docks vervallen (een strook van 20 m diep, 6,4 m breed per deur)
    zones =[Polygon([(x + n[1] * 3.2, y - n[0] * 3.2), (x - n[1] * 3.2, y + n[0] * 3.2), (x - n[1] * 3.2 + n[0] * CLEAR, y + n[0] * 3.2 + n[1] * CLEAR), (x + n[1] * 3.2 + n[0] * CLEAR, y - n[0] * 3.2 + n[1] * CLEAR)]) for x, y, _, n in docks]
    zone = unary_union(zones) if zones else Polygon()
    if s.get('dockPlek') and not zone.is_empty: zone = zone.buffer(-0.25)  # tweede keer draaien: afronding laat geen plekken meer vallen
    rows = []; dropped = 0; kept = 0
    for r in s['rijen']:
        x0, y0 = fw((r[0], r[1])); x1, y1 = fw((r[2], r[3])); n = r[4]; br = math.radians(r[5])
        ex, ey = math.sin(br) * 8.25, math.cos(br) * 8.25
        keep = []
        for k in range(n):
            f = k / (n - 1) if n > 1 else 0; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
            spot = LineString([(x - ex, y - ey), (x + ex, y + ey)]).buffer(1.8)
            if spot.intersects(zone): dropped += 1; keep.append(None)
            else: kept += 1; keep.append((x, y))
        # aaneengesloten stukken van de rij blijven rijen (zelfde vorm: [lon0, lat0, lon1, lat1, n, koers])
        run = []
        for p in keep + [None]:
            if p is not None: run.append(p); continue
            if run:
                a2 = bw(*run[0]); b2 = bw(*run[-1]); rows.append([a2[0], a2[1], b2[0], b2[1], len(run), r[5]]); run = []
    s['docks'] = len(docks)
    s['dockPlek'] = [[*bw(x, y), round(k)] for x, y, k, _ in docks]
    if dropped: s['rijen'] = rows
    stat.append((s['n'], aantal(s), len(docks), dropped, kept, len(cand)))
    if QA:
        from PIL import Image, ImageDraw
        S = 900; R = max(160.0, max(math.dist((0, 0), fw(p)) for p in s['terrein']) * 1.15)
        px = lambda x, y: (S / 2 + x / R * S / 2, S / 2 - y / R * S / 2)
        im = Image.new('RGB', (S, S), (246, 247, 249)); d = ImageDraw.Draw(im)
        d.polygon([px(*p) for p in terr.exterior.coords], outline=(37, 99, 235), width=3)
        for g in others:
            for part in getattr(g, 'geoms', [g]):
                if part.geom_type == 'Polygon': d.polygon([px(*p) for p in part.exterior.coords], fill=(215, 218, 224), outline=(170, 175, 182))
        d.polygon([px(*p) for p in hall.exterior.coords], fill=(255, 225, 228), outline=(227, 0, 31), width=2)
        for z in zones: d.polygon([px(*p) for p in z.exterior.coords], outline=(217, 119, 6))
        for r in s['rijen']:
            x0, y0 = fw((r[0], r[1])); x1, y1 = fw((r[2], r[3])); n = r[4]; br = math.radians(r[5]); ex, ey = math.sin(br) * 8.25, math.cos(br) * 8.25
            for k in range(n):
                f = k / (n - 1) if n > 1 else 0; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
                d.line([px(x - ex, y - ey), px(x + ex, y + ey)], fill=(22, 163, 74), width=2)
        for i, (x, y, k, n) in enumerate(docks):
            d.line([px(x, y), px(x + n[0] * 16, y + n[1] * 16)], fill=(124, 58, 237), width=3); d.text(px(x + n[0] * 19, y + n[1] * 19), str(i + 1), fill=(60, 20, 120))
        d.text((10, 10), f"{s['n']}: {len(docks)} docks (gevraagd {aantal(s)}), {dropped} parkeerplekken vervallen", fill=(20, 20, 20))
        im.save(f"{QA}/dock_{s['n'].replace(' ', '_').replace('(', '').replace(')', '')}.png")
open(f'{D}/places.json', 'w').write(json.dumps(P, ensure_ascii=False, separators=(',', ':')))
for row in stat: print('%-22s gevraagd %2d  geplaatst %2d  vervallen %3d  over %4d  gevels %d' % row)
