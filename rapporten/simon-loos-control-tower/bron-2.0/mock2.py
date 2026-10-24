# -*- coding: utf-8 -*-
"""Mockups Control Tower 2.0: echte landkaart (Overture/OSM), truckhistorie, persoonsprofiel per rol,
werkgebied-wizard, beheer van rollen, en de chauffeursapp. Alle operationele data is gesimuleerd."""
import json, math, os, random
import pyarrow.parquet as pq, shapely.wkb
random.seed(7)
HERE = os.path.dirname(os.path.abspath(__file__)); OV = HERE + '/../overture/'
CSS = open(HERE + '/mock2.css').read()
LOGO = open(HERE + '/../sl3d/logo_datauri.txt').read().strip()
ICON = {
 'map': '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
 'cal': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 'truck': '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
 'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 'chart': '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/>',
 'bell': '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
 'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 'search': '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
 'filter': '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
 'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 'msg': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
 'home': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 'chev': '<path d="M9 18l6-6-6-6"/>', 'check': '<path d="M20 6L9 17l-5-5"/>', 'x': '<path d="M18 6L6 18M6 6l12 12"/>',
 'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
 'pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
 'bolt': '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>', 'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
 'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', 'euro': '<path d="M4 10h12M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
}
def ic(n, s=18, cls=''): return f'<svg class="ic {cls}" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{ICON[n]}</svg>'
def esc(s): return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def rail(active):
    items = [('map', 'Kaart'), ('cal', 'Planbord'), ('truck', 'Trucks'), ('users', 'Mensen'), ('chart', 'Cijfers'), ('settings', 'Beheer')]
    return '<nav class="rail"><img src="' + LOGO + '" alt="Simon Loos" class="rl">' + ''.join(f'<a class="{"on" if k == active else ""}" title="{n}">{ic(k, 20)}<span>{n}</span></a>' for k, n in items) + '<div class="rail-foot"><span class="av">PA</span></div></nav>'
def topbar(title, sub='', right=''):
    return f'<header class="tb"><div class="tt"><b>{title}</b>{f"<span>{sub}</span>" if sub else ""}</div><div class="tr">{right}<div class="srch">{ic("search", 16)}<span>Zoek truck, persoon, standplaats</span><kbd>⌘K</kbd></div><button class="ib">{ic("bell", 17)}<i></i></button><div class="who"><b>P. Appel</b><span>Directie</span></div></div></header>'
def page(title, body, extra=''):
    return f'<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>{title}</title><style>{CSS}{extra}</style></head><body>{body}</body></html>'

# ---------------------------------------------------------------- echte landkaart
class View:
    def __init__(s, cx, cy, deg_h, w, h):
        s.w, s.h = w, h; s.cl = math.cos(math.radians(cy)); s.s = h / deg_h; dw = w / (s.s * s.cl)
        s.bbox = (cx - dw / 2, cy - deg_h / 2, cx + dw / 2, cy + deg_h / 2)
    def xy(s, lon, lat): return ((lon - s.bbox[0]) * s.cl * s.s, (s.bbox[3] - lat) * s.s)
    def inb(s, g): b = g.bounds; return not (b[2] < s.bbox[0] or b[0] > s.bbox[2] or b[3] < s.bbox[1] or b[1] > s.bbox[3])
def rows(f): return pq.read_table(f).to_pylist()
def geom(r):
    try: return shapely.wkb.loads(r['geometry'])
    except Exception: return None
def pd_ring(V, coords): return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in (V.xy(a, b) for a, b in coords)) + ' Z'
def pd_line(V, coords): return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in (V.xy(a, b) for a, b in coords))
def polys(g): return list(g.geoms) if g.geom_type == 'MultiPolygon' else ([g] if g.geom_type == 'Polygon' else [])
def lines(g): return list(g.geoms) if g.geom_type == 'MultiLineString' else ([g] if g.geom_type == 'LineString' else [])

def realmap(V):
    o = [f'<rect width="{V.w}" height="{V.h}" fill="#F3F1EC"/>']
    LU = {'farmland': '#EEEEE0', 'meadow': '#EAF0DC', 'grass': '#DDEFD0', 'orchard': '#D9E9C7', 'garden': '#E3EED6', 'pitch': '#CFE6CC', 'playground': '#E0ECD9', 'residential': '#EBE9E6', 'static_caravan': '#EBE9E6', 'retail': '#EDE4E6', 'industrial': '#ECE6EA', 'commercial': '#EDE4E6', 'school': '#F1ECDC', 'cemetery': '#DDE6D4', 'highway': '#F3F1EC', 'parking': '#EDEBE7'}
    lu = []
    for r in rows(OV + 'mock_landuse.parquet'):
        g = geom(r); c = LU.get(r.get('class')) or LU.get(r.get('subtype'))
        if g is None or not c or not V.inb(g): continue
        for p in polys(g): lu.append(f'<path d="{pd_ring(V, p.exterior.coords)}" fill="{c}"/>')
    o.append('<g>' + ''.join(lu) + '</g>')
    LC = {'forest': '#C5DDB4', 'wood': '#C5DDB4', 'tree': '#C5DDB4', 'scrub': '#D7E7C6', 'shrubbery': '#D7E7C6', 'grass': '#DDEFD0', 'grassland': '#DDEFD0', 'wetland': '#D4E6DA', 'sand': '#F2EBD2', 'beach': '#F5EDD3', 'tree_row': '#C5DDB4'}
    lc = []
    for r in rows(OV + 'mock_land.parquet'):
        g = geom(r); c = LC.get(r.get('class'))
        if g is None or not c or not V.inb(g): continue
        if g.geom_type in ('Point', 'LineString'): continue
        for p in polys(g): lc.append(f'<path d="{pd_ring(V, p.exterior.coords)}" fill="{c}"/>')
    o.append('<g>' + ''.join(lc) + '</g>')
    wa = []
    for r in rows(OV + 'mock_water.parquet'):
        g = geom(r)
        if g is None or not V.inb(g): continue
        if g.geom_type in ('LineString', 'MultiLineString'):
            for l in lines(g): wa.append(f'<path d="{pd_line(V, l.coords)}" fill="none" stroke="#B9D5EC" stroke-width="1.2"/>')
        else:
            for p in polys(g): wa.append(f'<path d="{pd_ring(V, p.exterior.coords)}{"".join(pd_ring(V, i.coords) for i in p.interiors)}" fill="#BCD8EE" fill-rule="evenodd"/>')
    o.append('<g>' + ''.join(wa) + '</g>')
    bu = []
    for r in rows(OV + 'mock_buildings.parquet'):
        g = geom(r)
        if g is None or not V.inb(g): continue
        for p in polys(g): bu.append(f'<path d="{pd_ring(V, p.exterior.coords)}"/>')
    o.append('<g fill="#DED9D1" stroke="#CCC5BA" stroke-width="0.45">' + ''.join(bu) + '</g>')
    # wegen
    segs = [(r, geom(r)) for r in rows(OV + 'mock_segments.parquet')]
    segs = [(r, g) for r, g in segs if g is not None and V.inb(g)]
    W = {'motorway': (8.5, '#F2CB7A', '#D7A74B'), 'trunk': (7.5, '#F7E0A6', '#DCBE78'), 'primary': (7, '#FFFFFF', '#CFC9BE'), 'secondary': (6, '#FFFFFF', '#D5D0C6'), 'tertiary': (4.8, '#FFFFFF', '#DAD5CC'), 'residential': (3.2, '#FFFFFF', '#DFDBD3'), 'unclassified': (3.2, '#FFFFFF', '#DFDBD3'), 'living_street': (3, '#F7F5F0', '#E2DED6'), 'service': (1.8, '#F9F8F5', '#E4E0D8'), 'track': (1.2, '#EDE7D6', None), 'unknown': (1.4, '#F4F2EC', None)}
    DASH = {'footway': ('#CFC8BC', '3 3'), 'path': ('#CFC8BC', '3 3'), 'cycleway': ('#C9CFDF', '4 3'), 'steps': ('#CFC8BC', '2 2')}
    for cls, (col, dash) in DASH.items():
        o.append(f'<g fill="none" stroke="{col}" stroke-width="0.9" stroke-dasharray="{dash}">' + ''.join(f'<path d="{pd_line(V, l.coords)}"/>' for r, g in segs if r.get('class') == cls for l in lines(g)) + '</g>')
    rail_ = [l for r, g in segs if r.get('subtype') == 'rail' for l in lines(g)]
    o.append('<g fill="none" stroke="#9A948B" stroke-width="2">' + ''.join(f'<path d="{pd_line(V, l.coords)}"/>' for l in rail_) + '</g><g fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-dasharray="6 6">' + ''.join(f'<path d="{pd_line(V, l.coords)}"/>' for l in rail_) + '</g>')
    order = ['unknown', 'track', 'service', 'living_street', 'unclassified', 'residential', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']
    for cls in order:  # eerst alle casings, dan vullingen per klasse (van klein naar groot)
        w, fill, cas = W[cls]; L = [l for r, g in segs if r.get('class') == cls for l in lines(g)]
        if cas: o.append(f'<g fill="none" stroke="{cas}" stroke-width="{w + 1.6}" stroke-linecap="round" stroke-linejoin="round">' + ''.join(f'<path d="{pd_line(V, l.coords)}"/>' for l in L) + '</g>')
    for cls in order:
        w, fill, cas = W[cls]; L = [l for r, g in segs if r.get('class') == cls for l in lines(g)]
        o.append(f'<g fill="none" stroke="{fill}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">' + ''.join(f'<path d="{pd_line(V, l.coords)}"/>' for l in L) + '</g>')
    # wegnamen op langere stukken
    labels = []; used = []
    for r, g in segs:
        if r.get('class') not in ('primary', 'secondary', 'tertiary', 'residential', 'motorway', 'trunk'): continue
        nm = (r.get('names') or {}).get('primary')
        if not nm: continue
        for l in lines(g):
            pts = [V.xy(a, b) for a, b in l.coords]; L = sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts)))
            if L < 150 or len(nm) * 6.5 > L * 0.8: continue
            m = len(pts) // 2; (x0, y0), (x1, y1) = pts[max(0, m - 1)], pts[min(len(pts) - 1, m + 1)]
            ang = math.degrees(math.atan2(y1 - y0, x1 - x0));
            if ang > 90 or ang < -90: ang += 180
            cx, cy = pts[m]
            if any(math.hypot(cx - ux, cy - uy) < 120 for ux, uy in used): continue
            used.append((cx, cy)); big = r.get('class') in ('motorway', 'trunk')
            labels.append(f'<text transform="translate({cx:.0f} {cy:.0f}) rotate({ang:.0f})" class="rn {"big" if big else ""}" dy="{-5 if big else 3}">{esc(nm)}</text>')
    o.append('<g>' + ''.join(labels) + '</g>')
    places = [('Wognum', 52.672, 5.021, 1), ('Hoorn', 52.642, 5.06, 1), ('Zwaag', 52.665, 5.085, 2), ('Nibbixwoud', 52.698, 5.03, 2), ('Opmeer', 52.71, 4.95, 2), ('Avenhorn', 52.62, 4.95, 2), ('Blokker', 52.66, 5.11, 2), ('Hoogkarspel', 52.69, 5.19, 2), ('Westwoud', 52.68, 5.13, 2), ('Berkhout', 52.64, 4.99, 2), ('Oosterblokker', 52.66, 5.13, 3), ('Wijdenes', 52.63, 5.16, 3), ('Spierdijk', 52.66, 4.93, 3), ('Zuidermeer', 52.67, 4.96, 3)]
    for n, lat, lon, r in places:
        x, y = V.xy(lon, lat)
        if 0 < x < V.w and 0 < y < V.h: o.append(f'<text x="{x:.0f}" y="{y:.0f}" class="pl r{r}">{n}</text>')
    o.append(f'<text x="{V.w - 24}" y="{V.h - 10}" class="water">Markermeer</text>')
    return '\n'.join(o), segs

def mock_map():
    W, H = 1544, 944; V = View(5.055, 52.657, 0.085, W, H)
    svg, segs = realmap(V)
    # trucks als stippen op de A7 en de N307
    dots = []; col = {'onderweg': '#16A34A', 'klant': '#2563EB', 'vertraagd': '#DC2626', 'pauze': '#D97706'}
    big = [(r, g) for r, g in segs if r.get('class') in ('motorway', 'primary', 'secondary')]
    random.shuffle(big)
    for k, (r, g) in enumerate(big[:34]):
        l = lines(g)[0]; p = l.interpolate(random.random(), normalized=True); x, y = V.xy(p.x, p.y)
        st = 'onderweg' if k % 6 else ('vertraagd' if k == 12 else 'klant'); dots.append((x, y, st))
    sel = dots[12] if len(dots) > 12 else dots[0]
    svg += '<g>' + ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="{col[st]}" stroke="#FFFFFF" stroke-width="1.6"/>' for x, y, st in dots) + '</g>'
    svg += f'<circle cx="{sel[0]:.1f}" cy="{sel[1]:.1f}" r="13" fill="none" stroke="#DC2626" stroke-width="2"/>'
    card = f'''<div class="fcard" style="left:{sel[0]+22:.0f}px;top:{sel[1]-30:.0f}px"><div class="fh"><b>W-0412</b><span class="st bad">Vertraagd +7</span></div><div class="fl">J. de Vries · eActros 600 · Wognum</div><div class="fl">→ AH Hoorn, Grote Noord · ETA 15:07 · venster tot 15:00</div><div class="fa"><a>Open rit</a><a>Bericht</a><a>Deel ETA</a></div></div>'''
    body = f'''<div class="app">{rail('map')}<div class="main">{topbar('Kaart', 'Noord-Holland · winkeldistributie · 61 trucks', '<button class="btn">' + ic('filter', 15) + 'Filters <em>2</em></button>')}
    <div class="mapwrap"><svg width="{W}" height="{H}" viewBox="0 0 {W} {H}">{svg}</svg>
      <div class="line"><span class="bad"><i></i>Vertraagd 2</span><span><i class="g"></i>Onderweg 46</span><span><i class="b"></i>Bij klant 13</span><a>Alle cijfers</a></div>
      {card}
      <div class="zoom"><span>+</span><span>−</span></div><div class="attr">© OpenStreetMap-bijdragers · Overture Maps</div>
    </div></div></div>'''
    return page('Control Tower 2.0 · kaart', body)

# ---------------------------------------------------------------- truck met historie
def mock_truck():
    hist = [('vr 24 okt', 'J. de Vries', '06:00–15:00', 318, 'Winkeldistributie · AH West-Friesland', ''), ('do 23 okt', 'J. de Vries', '06:00–15:00', 294, 'Winkeldistributie · AH Alkmaar', ''), ('wo 22 okt', 'S. Blokker', '14:00–23:00', 212, 'Winkeldistributie · AH Purmerend', 'storing koelunit gemeld'),
            ('di 21 okt', 'J. de Vries', '06:00–15:00', 301, 'Winkeldistributie · AH Hoorn', ''), ('ma 20 okt', 'M. Visser', '05:00–14:00', 287, 'Netwerk · DC Zaandam', 'schade: spiegel rechts (€ 480)'), ('za 18 okt', 'K. Ruiter', '07:00–16:00', 176, 'Winkeldistributie · AH Den Helder', ''),
            ('vr 17 okt', 'J. de Vries', '06:00–15:00', 322, 'Winkeldistributie · AH West-Friesland', ''), ('do 16 okt', 'J. de Vries', '06:00–15:00', 309, 'Winkeldistributie · AH Enkhuizen', 'rijtijdwaarschuwing 4:21'), ('wo 15 okt', 'R. Kooijman', '13:00–22:00', 198, 'Home Service · Hoorn', ''), ('di 14 okt', 'J. de Vries', '06:00–15:00', 296, 'Winkeldistributie · AH Alkmaar', '')]
    rows_ = ''.join(f'<tr><td>{d}</td><td><a class="lnk">{n}</a></td><td>{s}</td><td class="r">{k}</td><td>{r}</td><td class="{"note" if x else ""}">{x or "–"}</td></tr>' for d, n, s, k, r, x in hist)
    body = f'''<div class="app">{rail('truck')}<div class="main">{topbar('Trucks', 'W-0412')}
    <div class="rec">
      <div class="rh"><div><span class="plate">W-0412</span><span class="kent">BZ-487-F</span></div><div class="rt"><b>Mercedes-Benz eActros 600</b><span>trekker + koeltrailer · bouwjaar 2025 · standplaats Wognum · winkeldistributie</span></div><span class="st ok">Onderweg · J. de Vries</span></div>
      <div class="tabs2"><a class="on">Historie</a><a>Vandaag</a><a>Cijfers</a><a>Onderhoud</a><a>Documenten</a></div>
      <div class="cols">
        <div class="col-main">
          <div class="nums"><div><b>9.812</b><span>km in 30 dagen</span></div><div><b>1,12</b><span>kWh per km</span></div><div><b>84 %</b><span>inzet</span></div><div><b>1</b><span>schade in 12 maanden</span></div><div class="lock"><b>{ic('lock', 14)} € 0,91</b><span>kosten per km · regiomanager en directie</span></div></div>
          <h3>Wie reed erop <small>laatste 10 diensten</small></h3>
          <table class="t2"><thead><tr><th>Dag</th><th>Chauffeur</th><th>Dienst</th><th class="r">km</th><th>Rit</th><th>Bijzonderheden</th></tr></thead><tbody>{rows_}</tbody></table>
          <div class="more2">Toon alle 214 diensten sinds levering</div>
        </div>
        <aside class="col-side">
          <h3>Kerngegevens</h3>
          <dl><dt>Kenteken</dt><dd>BZ-487-F <small>RDW: APK tot 12-05-2027, geen open terugroepactie</small></dd><dt>Kilometerstand</dt><dd>61.420 km</dd><dt>Accu</dt><dd>600 kWh · 500 km bereik · 2 laadsessies per dag</dd><dt>Vaste chauffeur</dt><dd><a class="lnk">J. de Vries</a> (72 % van de diensten)</dd><dt>Laatste onderhoud</dt><dd>3 okt 2026 · garage Wognum · banden as 2</dd><dt>Open werkorder</dt><dd>Koelunit controleren (gemeld 22 okt)</dd></dl>
          <h3>Verbruik per chauffeur <small>kWh per km, 30 dagen</small></h3>
          <div class="bars2"><div><span>J. de Vries</span><i style="width:72%"></i><b>1,08</b></div><div><span>S. Blokker</span><i style="width:88%"></i><b>1,31</b></div><div><span>M. Visser</span><i style="width:80%"></i><b>1,19</b></div><div><span>K. Ruiter</span><i style="width:76%"></i><b>1,14</b></div></div>
          <div class="hint2">Verbruik hangt sterk af van de rit; vergelijk alleen chauffeurs op dezelfde ritten.</div>
        </aside>
      </div>
    </div></div></div>'''
    return page('Control Tower 2.0 · truck', body)

# ---------------------------------------------------------------- persoon per rol
def mock_person(role):
    rm = role != 'planner'
    def locked(title, who):
        return f'<section class="sec2 locked"><h3>{ic("lock", 14)} {title}</h3><p>Niet zichtbaar voor jouw rol (planner). Zichtbaar voor {who}.</p></section>'
    rijden = f'''<section class="sec2"><h3>Rijden <small>laatste 90 dagen</small><em class="vis">zichtbaar voor regiomanager, directie</em></h3>
      <div class="nums small"><div><b>8,4</b><span>rij-score van 10</span></div><div><b>1,08</b><span>kWh per km (gem. 1,15)</span></div><div><b>0</b><span>rijtijdovertredingen</span></div><div><b>2</b><span>harde remmingen per 1.000 km</span></div></div>
      <div class="hint2">Rij-score komt uit de boordcomputer (remmen, optrekken, bochten, snelheid). Alleen voor coaching, niet voor beoordeling zonder gesprek.</div></section>''' if rm else locked('Rijden', 'regiomanager en directie')
    schades = f'''<section class="sec2"><h3>Schades <small>3 in 24 maanden</small><em class="vis">zichtbaar voor regiomanager, directie</em></h3>
      <table class="t2"><thead><tr><th>Datum</th><th>Truck</th><th>Wat</th><th>Schuld</th><th class="r">Kosten</th></tr></thead><tbody>
      <tr><td>20 okt 2026</td><td>W-0412</td><td>Spiegel rechts, manoeuvreren op dock AH Zaandam</td><td>Eigen</td><td class="r">€ 480</td></tr>
      <tr><td>3 mrt 2026</td><td>W-0388</td><td>Krasschade trailer, laadperron Hoorn</td><td>Derde</td><td class="r">€ 1.250</td></tr>
      <tr><td>11 nov 2024</td><td>W-0210</td><td>Achteruitrijden tegen paal, Wognum</td><td>Eigen</td><td class="r">€ 2.100</td></tr></tbody></table></section>''' if rm else locked('Schades', 'regiomanager en directie')
    contract = f'''<section class="sec2"><h3>Contract en kosten<em class="vis">zichtbaar voor directie en HR</em></h3>
      <dl><dt>Contract</dt><dd>Onbepaalde tijd · 40 uur · sinds 2015</dd><dt>Uurtarief (loonkosten)</dt><dd>€ 31,40 incl. werkgeverslasten</dd><dt>Toeslagen</dt><dd>Avond en zaterdag volgens cao Beroepsgoederenvervoer</dd><dt>Verzuim 12 maanden</dt><dd>2,1 % (bedrijf 4,8 %)</dd></dl></section>''' if role == 'directie' else (locked('Contract en kosten', 'directie en HR') if role == 'planner' else '<section class="sec2 locked"><h3>' + ic('lock', 14) + ' Contract en kosten</h3><p>Niet zichtbaar voor jouw rol (regiomanager). Zichtbaar voor directie en HR.</p></section>')
    body = f'''<div class="app">{rail('users')}<div class="main">{topbar('Mensen', 'J. de Vries', f'<div class="seg2"><span>Bekijk als</span><a class="{"on" if role == "planner" else ""}">Planner</a><a class="{"on" if role == "regiomanager" else ""}">Regiomanager</a><a class="{"on" if role == "directie" else ""}">Directie</a></div>')}
    <div class="rec">
      <div class="rh"><span class="av big">JV</span><div class="rt"><b>Jan de Vries</b><span>chauffeur C/CE · standplaats Wognum · winkeldistributie · in dienst sinds 2015</span></div><span class="st ok">Onderweg · W-0412</span></div>
      <div class="tabs2"><a class="on">Overzicht</a><a>Diensten</a><a>Rijden</a><a>Schades</a><a>Documenten</a></div>
      <div class="cols">
        <div class="col-main">
          <section class="sec2"><h3>Vandaag</h3><dl><dt>Dienst</dt><dd>06:00 – 15:00 · W-0412 · rit AH West-Friesland, 5 stops</dd><dt>Nu</dt><dd>Onderweg naar AH Medemblik, ETA 15:07 (+7 min)</dd><dt>Rijtijd</dt><dd>3:12 van 4:30 · pauze uiterlijk 15:50</dd><dt>Bericht</dt><dd><a class="lnk">Stuur een bericht</a> · wordt voorgelezen in de cabine</dd></dl></section>
          {rijden}
          {schades}
          {contract}
        </div>
        <aside class="col-side">
          <h3>Bevoegdheden <small>uit het personeelssysteem</small></h3>
          <dl><dt>Rijbewijs CE</dt><dd>geldig tot 03-2029</dd><dt>Code 95</dt><dd>geldig tot 11-2027 <small>nascholing 14 uur van 35 gedaan</small></dd><dt>Bestuurderskaart</dt><dd>geldig tot 06-2028</dd><dt>ADR</dt><dd>geen</dd><dt>LZV-certificaat</dt><dd>ja, sinds 2021</dd></dl>
          <h3>Vaste trucks</h3><dl><dt>W-0412</dt><dd>eActros 600 · 72 % van de diensten</dd><dt>W-0388</dt><dd>Actros 1845 · 18 %</dd></dl>
          <h3>Contact</h3><dl><dt>Telefoon</dt><dd>06 •• •• 41 82 <small>zichtbaar na klik, wordt gelogd</small></dd><dt>Noodcontact</dt><dd>{'M. de Vries (partner)' if rm else '<i class="mut">alleen regiomanager en HR</i>'}</dd></dl>
          <div class="hint2">Wie welke persoonsgegevens bekijkt, wordt vastgelegd (AVG). Chauffeurs zien hun eigen profiel in de app.</div>
        </aside>
      </div>
    </div></div></div>'''
    return page('Control Tower 2.0 · persoon', body)

# ---------------------------------------------------------------- werkgebied-wizard
def mock_wizard():
    types = [('Winkeldistributie', 'Albert Heijn, Jumbo, Plus, Lidl, SPAR, Vomar', True), ('Netwerktransport', 'DC naar DC, crossdock Tiel en Geldermalsen, LZV', True), ('Bulktransport', 'Poeders, granulaat, suiker', False), ('Drankenlogistiek', 'Heineken, Bavaria, Vrumona', False), ('Boodschappenbezorging', 'AH Home Service, bestelbussen', True)]
    cards = ''.join(f'<label class="tcard {"on" if on else ""}"><i class="cb2 {"on" if on else ""}">{ic("check", 12) if on else ""}</i><b>{n}</b><span>{d}</span></label>' for n, d, on in types)
    body = f'''<div class="app blur">{rail('map')}<div class="main">{topbar('Kaart')}<div class="mapwrap mapblur"></div></div></div>
    <div class="modal"><div class="wiz">
      <div class="steps"><span class="done">{ic('check', 12)} Regio's <small>Noord-Holland, Randstad Zuid</small></span><span class="cur">2 Ritten</span><span>3 Klaar</span></div>
      <h2>Welke ritten wil je zien?</h2><p>Je werkgebied bepaalt wat je standaard ziet. Je past het later aan onder <b>Mijn werkgebied</b>; het wordt niet elke keer opnieuw gevraagd.</p>
      <div class="tcards">{cards}</div>
      <div class="wf"><span class="mut">Voorgesteld op basis van je rol: planner, standplaats Wognum</span><div><button class="btn">Terug</button><button class="btn pri">Verder</button></div></div>
    </div></div>'''
    return page('Control Tower 2.0 · werkgebied', body)

# ---------------------------------------------------------------- beheer: rollen en rechten
def mock_admin():
    roles = ['Chauffeur', 'Planner', 'Hal', 'Regiomanager', 'Directie', 'HR', 'Beheerder']
    R = [('Live posities en ritten', [1, 1, 1, 1, 1, 0, 1]), ('Planbord bewerken', [0, 1, 0, 1, 0, 0, 0]), ('Berichten met chauffeurs', [1, 1, 0, 1, 0, 0, 0]), ('Truck: wie reed erop, km, verbruik', [0, 1, 0, 1, 1, 0, 0]), ('Truck: kosten per km', [0, 0, 0, 1, 1, 0, 0]),
         ('Persoon: diensten en bevoegdheden', [2, 1, 0, 1, 1, 1, 0]), ('Persoon: rij-score en schades', [2, 0, 0, 1, 1, 1, 0]), ('Persoon: uurtarief, contract, verzuim', [2, 0, 0, 0, 1, 1, 0]), ('Rapportages per klant en standplaats', [0, 0, 0, 1, 1, 0, 0]), ('Gebruikers, rollen en koppelingen', [0, 0, 0, 0, 0, 0, 1]), ('Audit-log inzien', [0, 0, 0, 0, 1, 1, 1])]
    def cell(v): return '<td class="c y">' + ic('check', 13) + '</td>' if v == 1 else ('<td class="c s">eigen</td>' if v == 2 else '<td class="c n">–</td>')
    rows_ = ''.join(f'<tr><th>{n}</th>' + ''.join(cell(v) for v in vs) + '</tr>' for n, vs in R)
    users = [('Sanne Vlaar', 'Planner', 'Wognum', 'vandaag 13:58'), ('Ruud Koning', 'Planner', 'Wognum', 'vandaag 14:20'), ('Anouk Groot', 'Regiomanager', 'Noord-Holland', 'vandaag 09:12'), ('Peter Appel', 'Directie', 'alle', 'vandaag 08:40'), ('Marco de Boer', 'Hal', 'Wognum', 'gisteren'), ('Ilse Bakker', 'Planner', 'Geldermalsen', 'vandaag 11:03'), ('Daan Smit', 'Planner', 'Zaandam', 'vandaag 07:55'), ('Fatima el Idrissi', 'HR', 'alle', '21 okt')]
    ul = ''.join(f'<tr><td><b>{n}</b></td><td><span class="dd2">{r} ▾</span></td><td>{s}</td><td class="mut">{l}</td></tr>' for n, r, s, l in users)
    body = f'''<div class="app">{rail('settings')}<div class="main">{topbar('Beheer', 'Rollen en rechten')}
    <div class="rec"><div class="tabs2"><a>Gebruikers</a><a class="on">Rollen en rechten</a><a>Koppelingen</a><a>Audit-log</a></div>
      <div class="cols">
        <div class="col-main"><h3>Wat mag welke rol zien en doen</h3>
          <table class="t2 matrix"><thead><tr><th></th>{''.join(f'<th>{r}</th>' for r in roles)}</tr></thead><tbody>{rows_}</tbody></table>
          <div class="hint2">"eigen" = alleen de eigen gegevens. Een rol kan per persoon worden beperkt tot standplaatsen of regio's. Elke inzage van persoonsgegevens wordt gelogd met wie, wat en wanneer.</div></div>
        <aside class="col-side"><h3>Gebruikers <small>112</small></h3><table class="t2"><thead><tr><th>Naam</th><th>Rol</th><th>Gebied</th><th>Laatst actief</th></tr></thead><tbody>{ul}</tbody></table><button class="btn pri wide">Gebruiker toevoegen</button>
          <h3>Koppelingen</h3><dl><dt>Boordcomputers</dt><dd><span class="st ok">verbonden</span> rFMS, 1.238 trucks</dd><dt>TMS</dt><dd><span class="st ok">verbonden</span> elke 5 min</dd><dt>Personeelssysteem</dt><dd><span class="st warn">alleen lezen</span> bevoegdheden en roosters</dd><dt>RDW</dt><dd><span class="st ok">dagelijks 03:00</span></dd></dl></aside>
      </div></div></div></div>'''
    return page('Control Tower 2.0 · beheer', body)

# ---------------------------------------------------------------- chauffeursapp
def mock_mobile():
    stops = [('07:05', 'AH Hoorn, Grote Noord', 'gelost 07:41', 'done'), ('08:20', 'AH Enkhuizen, Flosbeugel', 'gelost 08:52', 'done'), ('13:40', 'AH Andijk', 'gelost 14:14', 'done'), ('15:07', 'AH Medemblik, Nieuwstraat', 'venster tot 15:00 · +7 min', 'next'), ('16:05', 'Terug Wognum · laadpunt 7', '', 'todo')]
    sl = ''.join(f'<div class="ms {c}"><i></i><time>{t}</time><div><b>{n}</b><span>{s}</span></div></div>' for t, n, s, c in stops)
    phone1 = f'''<div class="phone"><div class="pstat"><span>14:32</span><span>●●● 5G</span></div>
      <div class="ph1"><span class="small">Mijn dag · W-0412</span><h2>Jan de Vries</h2><span class="st bad">Vertraagd +7 min</span></div>
      <div class="pnext"><small>VOLGENDE STOP</small><b>AH Medemblik, Nieuwstraat</b><span>11,2 km · ETA 15:07 · venster tot 15:00</span><div class="pbtn"><button class="btn pri">Ik ben er</button><button class="btn">Navigeer</button></div></div>
      <div class="pmsg">{ic('msg', 15)}<div><b>Planning</b><span>Dock 5 in Medemblik, niet 3. Klant weet van de 7 minuten.</span></div><em>14:28</em></div>
      <div class="pstops">{sl}</div>
      <div class="pfoot"><a class="on">{ic('home', 18)}Vandaag</a><a>{ic('msg', 18)}Berichten</a><a>{ic('camera', 18)}Schade</a><a>{ic('users', 18)}Ik</a></div></div>'''
    phone2 = f'''<div class="phone"><div class="pstat"><span>14:32</span><span>●●● 5G</span></div>
      <div class="ph1"><span class="small">Schade melden · W-0412</span><h2>Wat is er gebeurd?</h2></div>
      <div class="photo">{ic('camera', 26)}<span>Maak 2 tot 4 foto's</span><div class="thumbs"><i></i><i></i><i class="add">+</i></div></div>
      <div class="pfield"><small>Plaats</small><b>{ic('pin', 13)} AH Andijk, laadperron · automatisch</b></div>
      <div class="pfield"><small>Soort</small><div class="chips3"><span class="on">Spiegel</span><span>Trailer</span><span>Cabine</span><span>Lading</span><span>Derde</span></div></div>
      <div class="pfield"><small>Kort wat er gebeurde</small><p class="ta">Bij achteruitrijden spiegel rechts geraakt tegen de dockpaal. Niemand gewond, truck rijdt.</p></div>
      <div class="pfield"><small>Rijdt de truck veilig door?</small><div class="chips3"><span class="on">Ja</span><span>Nee, hulp nodig</span></div></div>
      <button class="btn pri wide">Verstuur naar planning en garage</button>
      <div class="pfoot"><a>{ic('home', 18)}Vandaag</a><a>{ic('msg', 18)}Berichten</a><a class="on">{ic('camera', 18)}Schade</a><a>{ic('users', 18)}Ik</a></div></div>'''
    body = f'<div class="phones">{phone1}{phone2}</div>'
    return page('Control Tower 2.0 · chauffeursapp', body, 'html,body{width:1100px;height:1000px;background:#F3F4F6}')

if __name__ == '__main__':
    for name, fn in (('ct2_kaart', mock_map), ('ct2_truck', mock_truck), ('ct2_persoon_regiomanager', lambda: mock_person('regiomanager')), ('ct2_persoon_planner', lambda: mock_person('planner')), ('ct2_werkgebied', mock_wizard), ('ct2_beheer', mock_admin), ('ct2_app', mock_mobile)):
        html = fn(); open(f'{HERE}/{name}.html', 'w').write(html); print(name, len(html) // 1024, 'kB')
