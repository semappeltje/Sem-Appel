# -*- coding: utf-8 -*-
"""Genereert vier realistische mockups (HTML) voor de Simon Loos Control Tower.
Kaartdata: Natural Earth 10m (land, meren, provincies, wegen, stedelijk gebied, rivieren).
Alle operationele data (trucks, chauffeurs, ritten, kentekens) is gesimuleerd."""
import json, math, random, heapq, os
random.seed(2026)
HERE=os.path.dirname(os.path.abspath(__file__))
D='/home/user/Sem-Appel/demos/simonloos-live/src/data/'
land=json.load(open(D+'land.json')); prov=json.load(open(D+'provinces.json')); R=json.load(open(D+'roads.json'))
SP=json.load(open(HERE+'/places.json'))['SP']
URB=json.load(open(HERE+'/ne/ne_10m_urban_areas.geojson'))['features']
RIV=json.load(open(HERE+'/ne/ne_10m_rivers_lake_centerlines.geojson'))['features']
LOGO=open(HERE+'/../sl3d/logo_datauri.txt').read().strip()

# ---------- kleuren / status ----------
ST={'onderweg':('Onderweg','#22C55E','#86EFAC'),'klant':('Bij klant','#38BDF8','#BAE6FD'),'pauze':('Pauze','#F59E0B','#FDE68A'),
    'vertraagd':('Vertraagd','#EF4444','#FCA5A5'),'terrein':('Op terrein','#64748B','#CBD5E1')}
SHARE={'onderweg':.57,'klant':.21,'pauze':.08,'vertraagd':.03,'terrein':.11}

# ---------- wagenpark-verdeling over 42 standplaatsen (gesimuleerd, totaal 1.300) ----------
def weight(s): return s['vac']*4+6+(60 if s.get('hub') else 0)+(24 if s.get('wh') else 0)
tw=sum(weight(s) for s in SP)
for s in SP:
    s['fleet']=max(6,round(weight(s)/tw*1300))
diff=1300-sum(s['fleet'] for s in SP); SP[0]['fleet']+=diff
for s in SP:
    n=s['fleet']; mix={}
    rest=n
    for k,v in SHARE.items():
        c=round(n*v*random.uniform(.8,1.2)); mix[k]=c
    tot=sum(mix.values()); mix['onderweg']+=n-tot
    s['mix']=mix
# provincie per standplaats (point in polygon)
def pip(pt,ring):
    x,y=pt; inside=False; n=len(ring)
    for i in range(n):
        x1,y1=ring[i]; x2,y2=ring[(i+1)%n]
        if (y1>y)!=(y2>y):
            xi=x1+(y-y1)*(x2-x1)/(y2-y1)
            if xi>x: inside=not inside
    return inside
for s in SP:
    s['prov']=next((p['name'] for p in prov if any(pip((s['lon'],s['lat']),r) for r in p['rings'])),'?')
REGIO={'Noord-Holland':['Noord-Holland'],'Randstad Zuid':['Zuid-Holland','Utrecht','Flevoland'],'Oost':['Gelderland','Overijssel'],
       'Noord':['Groningen','Friesland','Drenthe'],'Zuid':['Noord-Brabant','Limburg','Zeeland']}
def regio_of(s): return next((k for k,v in REGIO.items() if s['prov'] in v),'Overig')
FLEET=sum(s['fleet'] for s in SP)
TOT={k:sum(s['mix'][k] for s in SP) for k in ST}

# ---------- projectie ----------
class View:
    def __init__(s,cx,cy,deg_h,w,h):
        s.w,s.h=w,h; s.cl=math.cos(math.radians(cy)); s.s=h/deg_h
        deg_w=w/(s.s*s.cl); s.bbox=(cx-deg_w/2,cy-deg_h/2,cx+deg_w/2,cy+deg_h/2)
    def xy(s,lon,lat): return ((lon-s.bbox[0])*s.cl*s.s,(s.bbox[3]-lat)*s.s)
    def inb(s,pts,m=0.3):
        b=s.bbox
        return any(b[0]-m<=x<=b[2]+m and b[1]-m<=y<=b[3]+m for x,y in pts)
    def km(s,px): return px/(s.s*s.cl)*111.32*s.cl  # grof: px -> km
def pd(V,ring,close=True):
    return 'M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in (V.xy(a,b) for a,b in ring))+(' Z' if close else '')
def polys(feat):
    g=feat['geometry']; return [g['coordinates']] if g['type']=='Polygon' else g['coordinates']
def lines(feat):
    g=feat['geometry']; return [g['coordinates']] if g['type']=='LineString' else g['coordinates']

CITIES=[('Amsterdam',52.37,4.90,1),('Rotterdam',51.92,4.48,1),('Utrecht',52.09,5.12,1),('Groningen',53.22,6.57,1),('Eindhoven',51.44,5.47,1),
 ('Zwolle',52.51,6.09,2),('Arnhem',51.98,5.90,2),('Breda',51.59,4.78,2),('Leeuwarden',53.20,5.80,2),('Maastricht',50.85,5.70,2),('Enschede',52.22,6.90,2),
 ('Den Haag',52.08,4.31,1),('Alkmaar',52.63,4.75,2),('Emmen',52.78,6.90,2),('Middelburg',51.50,3.61,2),('Apeldoorn',52.21,5.97,2),('Nijmegen',51.84,5.85,2),
 ('Den Helder',52.96,4.76,3),('Hoorn',52.64,5.06,3),('Lelystad',52.51,5.47,3),('Haarlem',52.38,4.64,3),('Antwerpen',51.22,4.40,2),('Düsseldorf',51.23,6.78,2),('Münster',51.96,7.63,2),('Brugge',51.21,3.22,3)]
NH_CITIES=[('Amsterdam',52.37,4.90,1),('Alkmaar',52.63,4.75,2),('Hoorn',52.64,5.06,2),('Haarlem',52.38,4.64,2),('Zaandam',52.44,4.83,2),('Purmerend',52.50,4.95,3),
 ('Den Helder',52.96,4.76,2),('Enkhuizen',52.70,5.29,3),('Medemblik',52.77,5.10,3),('Heerhugowaard',52.67,4.84,3),('Lelystad',52.51,5.47,2),('Almere',52.37,5.22,2),
 ('Schagen',52.79,4.80,3),('Beverwijk',52.48,4.66,3),('Edam',52.51,5.05,3),('Wervershoof',52.73,5.16,4),('Andijk',52.74,5.22,4),('Opmeer',52.71,4.95,4),('Nibbixwoud',52.70,5.03,4),('Zwaag',52.67,5.08,4),('Hoogkarspel',52.69,5.19,4),('Bovenkarspel',52.70,5.24,4)]
# Handmatig toegevoegde regionale wegen in West-Friesland (ontbreken in Natural Earth 10m): N307 Westfrisiaweg en de dijkroute Enkhuizen-Medemblik.
EXTRA_ROADS=[
 (1,[(4.84,52.671),(4.93,52.668),(5.00,52.668),(5.07,52.672),(5.10,52.672),(5.17,52.68),(5.19,52.69),(5.25,52.70),(5.29,52.70)]),   # N307 Heerhugowaard - Hoorn - Enkhuizen
 (2,[(5.29,52.70),(5.25,52.725),(5.22,52.74),(5.16,52.735),(5.13,52.75),(5.105,52.77)]),                                           # Enkhuizen - Andijk - Medemblik
 (2,[(5.105,52.77),(5.07,52.745),(5.03,52.705),(5.021,52.672)]),                                                                   # Medemblik - Nibbixwoud - Wognum
 (2,[(5.021,52.672),(5.03,52.66),(5.06,52.645)]),                                                                                  # Wognum - Hoorn
 (1,[(5.29,52.70),(5.33,52.66),(5.38,52.60),(5.43,52.54),(5.47,52.51)]),                                                           # N302 Houtribdijk Enkhuizen - Lelystad
]

def basemap(V,level):
    """level: 'nl' | 'regio' | 'detail'"""
    o=[]
    o.append(f'<rect width="{V.w}" height="{V.h}" fill="#0A0E17"/>')
    # buurlanden
    o.append('<g fill="#10151F">'+''.join(f'<path d="{pd(V,p[0])}"/>' for p in land['ctx'] if V.inb(p[0][::20] or p[0])) +'</g>')
    for poly in land['nl']:
        d=pd(V,poly[0])+''.join(pd(V,h) for h in poly[1:])
        o.append(f'<path d="{d}" fill="#171E2B" fill-rule="evenodd"/>')
    # stedelijk gebied
    ub=[]
    for f in URB:
        for poly in polys(f):
            if V.inb(poly[0][::max(1,len(poly[0])//25)] or poly[0]): ub.append(f'<path d="{pd(V,poly[0])}"/>')
    o.append('<g fill="#1F2736" opacity="0.9">'+''.join(ub)+'</g>')
    # rivieren
    rv=[]
    for f in RIV:
        for L in lines(f):
            if V.inb(L[::max(1,len(L)//30)] or L): rv.append(f'<path d="{pd(V,L,False)}"/>')
    rw={'nl':1.1,'regio':1.8,'detail':2.6}[level]
    o.append(f'<g fill="none" stroke="#14233A" stroke-width="{rw}" stroke-linejoin="round">'+''.join(rv)+'</g>')
    # provinciegrenzen
    pw={'nl':0.8,'regio':1.0,'detail':1.2}[level]
    o.append(f'<g fill="none" stroke="#2B3447" stroke-width="{pw}" stroke-dasharray="4 3">'+''.join(f'<path d="{pd(V,r)}"/>' for p in prov for r in p['rings'] if V.inb(r[::10] or r))+'</g>')
    # wegen (casing + fill)
    W={'nl':(1.8,1.0,0.6),'regio':(3.4,2.2,1.4),'detail':(6.0,4.2,2.8)}[level]
    roads=[(r['t'],r['p']) for r in R['roads'] if V.inb(r['p'][::5] or r['p'])]
    if level=='detail' or level=='regio': roads+=EXTRA_ROADS
    def grp(t,col,w,extra=''):
        return f'<g fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}>'+''.join(f'<path d="{pd(V,p,False)}"/>' for tt,p in roads if tt==t)+'</g>'
    o.append(grp(2,'#262E3E',W[2])); o.append(grp(1,'#333C4F',W[1])); o.append(grp(0,'#0A0E17',W[0]+1.6)); o.append(grp(0,'#4C5569',W[0]))
    o.append(grp(0,'#857B52',max(0.6,W[0]*0.38)))   # warme kern = snelweg
    if level!='nl':
        o.append(grp(1,'#0A0E17',W[1]+1.2,'opacity="0.0"'))
    # plaatsnamen
    cities={'nl':CITIES,'regio':NH_CITIES,'detail':NH_CITIES}[level]
    for n,lat,lon,rank in cities:
        if not V.inb([(lon,lat)],0): continue
        if level=='nl' and rank>2: continue
        if level=='regio' and rank>3: continue
        x,y=V.xy(lon,lat)
        if level=='nl':
            fs=13 if rank==1 else 11; o.append(f'<text x="{x:.0f}" y="{y+4:.0f}" class="city r{rank}" font-size="{fs}">{n.upper() if rank==1 else n}</text>')
        else:
            fs={1:15,2:13,3:12,4:11}[rank]
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{2.6 if rank<=2 else 2}" fill="#8B94A7"/>')
            o.append(f'<text x="{x+7:.0f}" y="{y+4:.0f}" class="city r{rank}" font-size="{fs}" text-anchor="start">{n.upper() if rank<=2 else n}</text>')
    if level=='nl':
        for n,lat,lon in (('Noordzee',52.9,3.9),('IJsselmeer',52.78,5.35)):
            x,y=V.xy(lon,lat); o.append(f'<text x="{x:.0f}" y="{y:.0f}" class="water" font-size="12">{n}</text>')
    if level=='regio':
        for n,lat,lon in (('Noordzee',52.75,4.45),('IJsselmeer',52.86,5.28),('Markermeer',52.55,5.20)):
            x,y=V.xy(lon,lat); o.append(f'<text x="{x:.0f}" y="{y:.0f}" class="water" font-size="13">{n}</text>')
    if level=='detail':
        for n,lat,lon in (('IJsselmeer',52.79,5.30),('Markermeer',52.60,5.22)):
            x,y=V.xy(lon,lat); o.append(f'<text x="{x:.0f}" y="{y:.0f}" class="water" font-size="14">{n}</text>')
    return '\n'.join(o)

# ---------- routering over het wegennet ----------
NODES=R['nodes']; ADJ={}
for i,j,km,t in R['edges']:
    ADJ.setdefault(i,[]).append((j,km)); ADJ.setdefault(j,[]).append((i,km))
def nearest(lon,lat):
    cl=math.cos(math.radians(lat))
    return min(range(len(NODES)),key=lambda k:((NODES[k][0]-lon)*cl)**2+(NODES[k][1]-lat)**2)
def kmd(a,b):
    cl=math.cos(math.radians((a[1]+b[1])/2)); return math.hypot((a[0]-b[0])*cl*111.32,(a[1]-b[1])*111.32)
def add_edge(i,j):
    d=kmd(NODES[i],NODES[j]); ADJ.setdefault(i,[]).append((j,d)); ADJ.setdefault(j,[]).append((i,d))
def add_polyline(pts,join_km=0.7):
    ids=[]
    for p in pts:
        k=nearest(*p)
        if kmd(NODES[k],p)<=join_km: ids.append(k)
        else: NODES.append(list(p)); ids.append(len(NODES)-1)
    for a,b in zip(ids,ids[1:]):
        if a!=b: add_edge(a,b)
for _t,_pts in EXTRA_ROADS: add_polyline(_pts)
add_edge(nearest(5.044,52.688),nearest(5.033,52.651))   # A7 tussen afrit Wognum en Hoorn ontbreekt in de NE-graaf
def dijkstra(a,b):
    dist={a:0}; prev={}; pq=[(0,a)]
    while pq:
        d,u=heapq.heappop(pq)
        if u==b: break
        if d>dist.get(u,1e9): continue
        for v,w in ADJ.get(u,[]):
            nd=d+w
            if nd<dist.get(v,1e9): dist[v]=nd; prev[v]=u; heapq.heappush(pq,(nd,v))
    if b not in dist: return None
    p=[b]
    while p[-1]!=a: p.append(prev[p[-1]])
    return p[::-1]
def route(a,b):
    na,nb=nearest(*a),nearest(*b); ids=dijkstra(na,nb)
    pts=[a]+([NODES[i] for i in ids] if ids else [])+[b]
    return pts
def polylen(pts):
    cum=[0]
    for (x1,y1),(x2,y2) in zip(pts,pts[1:]):
        cl=math.cos(math.radians((y1+y2)/2)); cum.append(cum[-1]+math.hypot((x2-x1)*cl*111.32,(y2-y1)*111.32))
    return cum
def pos_at(pts,cum,frac):
    t=frac*cum[-1]
    for k in range(1,len(cum)):
        if cum[k]>=t:
            a,b=pts[k-1],pts[k]; seg=cum[k]-cum[k-1]; u=0 if seg==0 else (t-cum[k-1])/seg
            return (a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u),(b[0]-a[0],b[1]-a[1])
    return pts[-1],(1,0)

def truck_svg(V,lon,lat,heading_vec,status,sel=False,scale=1.0,dim=False):
    x,y=V.xy(lon,lat); dx,dy=heading_vec
    ang=math.degrees(math.atan2(-dy,dx*V.cl))  # schermhoek (y omlaag)
    body,cab=ST[status][1],ST[status][2]
    op=' opacity="0.28"' if dim else ''
    ring=f'<circle r="14" fill="none" stroke="#FFFFFF" stroke-width="2"/><circle r="22" fill="none" stroke="#FFFFFF" stroke-width="1" opacity=".35"/>' if sel else ''
    return (f'<g transform="translate({x:.1f} {y:.1f}) rotate({ang:.0f}) scale({scale})"{op}>{ring}'
            f'<rect x="-9" y="-4.2" width="12.5" height="8.4" rx="1.6" fill="{body}" stroke="#0A0E17" stroke-width="1"/>'
            f'<rect x="3.6" y="-3.6" width="5.6" height="7.2" rx="1.4" fill="{cab}" stroke="#0A0E17" stroke-width="1"/>'
            f'<rect x="7.6" y="-2.6" width="1.4" height="5.2" rx=".5" fill="#0A0E17" opacity=".55"/></g>')

def donut(cx,cy,r,mix,sw=4):
    tot=sum(mix.values()); a0=-90; out=[]
    for k in ('onderweg','klant','pauze','vertraagd','terrein'):
        v=mix.get(k,0)
        if v<=0: continue
        a1=a0+360*v/tot
        if v==tot: out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="none" stroke="{ST[k][1]}" stroke-width="{sw}"/>'); break
        x0,y0=cx+r*math.cos(math.radians(a0)),cy+r*math.sin(math.radians(a0)); x1,y1=cx+r*math.cos(math.radians(a1)),cy+r*math.sin(math.radians(a1))
        large=1 if a1-a0>180 else 0
        out.append(f'<path d="M{x0:.1f} {y0:.1f} A{r} {r} 0 {large} 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{ST[k][1]}" stroke-width="{sw}" stroke-linecap="butt"/>')
        a0=a1
    return ''.join(out)

def fmt(n): return f'{n:,}'.replace(',','.')

# ---------- gedeelde chrome ----------
CSS=open(HERE+'/mock.css').read()
def chrome(title,active,body,extra_css=''):
    return f'''<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>{title}</title><style>{CSS}{extra_css}</style></head><body>
<header class="top">
 <div class="brand"><img src="{LOGO}" alt="Simon Loos"><span class="sep"></span><span class="prod">Control Tower</span></div>
 <nav class="tabs">{''.join(f'<a class="{"on" if t==active else ""}">{t}</a>' for t in ("Kaart","Planbord","Standplaatsen","Chauffeurs","Rapportages"))}</nav>
 <div class="right">
  <div class="live"><i></i>LIVE <b>vr 24 okt 2026 · 14:32</b></div>
  <div class="search">🔍 <span>Zoek truck, chauffeur, rit of klant…</span><kbd>⌘K</kbd></div>
  <div class="bell">🔔<b>14</b></div>
  <div class="user"><span class="av">PA</span><span>P. Appel<small>Directie</small></span></div>
 </div>
</header>
{body}
</body></html>'''

def sidebar(sel_regio='Alle regio\'s',checked=None,only_sel=False,sel_div=None,status_filter=None,sp_list=None):
    checked=checked or set()
    regios=["Alle regio's"]+list(REGIO.keys())
    rch=''.join(f'<span class="chip {"on" if r==sel_regio else ""}">{r}{"" if r=="Alle regio\'s" else f" <small>{sum(s[chr(102)+chr(108)+chr(101)+chr(101)+chr(116)] for s in SP if regio_of(s)==r)}</small>"}</span>' for r in regios)
    lst=sp_list if sp_list is not None else sorted(SP,key=lambda s:-s['fleet'])[:8]
    rows=''.join(f'<label class="row {"on" if s["n"] in checked else ""}"><i class="cb {"on" if s["n"] in checked else ""}"></i><span>{s["n"]}{"<small> · hoofdkantoor</small>" if s.get("hub") else ""}</span><b>{s["fleet"]}</b></label>' for s in lst)
    more='' if sp_list is not None else f'<div class="more">+ nog {len(SP)-len(lst)} standplaatsen…</div>'
    divs=[('winkel','Winkeldistributie'),('netwerk','Netwerktransport'),('bulk','Bulktransport'),('dranken','Drankenlogistiek'),('bezorg','Boodschappenbezorging')]
    dch=''.join(f'<span class="chip {"on" if (sel_div is None or d in sel_div) else ""}">{n}</span>' for d,n in divs)
    sch=''.join(f'<span class="chip st {"on" if (status_filter is None or k in status_filter) else ""}"><i style="background:{v[1]}"></i>{v[0]} <small>{fmt(TOT[k])}</small></span>' for k,v in ST.items())
    tog=f'<label class="toggle {"on" if only_sel else ""}"><i></i>Alleen trucks van geselecteerde standplaats{"<small>Trucks van andere standplaatsen worden gedimd</small>" if only_sel else ""}</label>'
    return f'''<aside class="side">
 <div class="sec"><h4>Regio</h4><div class="chips">{rch}</div></div>
 <div class="sec"><h4>Standplaats <small>{len(checked) if checked else "alle"} geselecteerd</small></h4>
  <div class="search sm">🔍 <span>Zoek standplaats…</span></div>
  <div class="list">{rows}{more}</div>{tog}</div>
 <div class="sec"><h4>Divisie</h4><div class="chips">{dch}</div></div>
 <div class="sec"><h4>Status</h4><div class="chips col">{sch}</div></div>
 <div class="sec foot"><h4>Weergave</h4><div class="seg"><span class="on">Kaart</span><span>Lijst</span><span>Tabel</span></div>
  <div class="hint">Uitgezoomd: clusters per standplaats · Ingezoomd: losse trucks · Truck geselecteerd: rit en ETA</div></div>
</aside>'''

def kpis(items):
    return '<div class="kpis">'+''.join(f'<div class="kpi {c}"><small>{l}</small><b>{v}</b><span>{s}</span></div>' for l,v,s,c in items)+'</div>'

def mapcontrols(scale_km,scale_px):
    return f'''<div class="mapctl"><span>+</span><span>−</span><span class="ico">⌖</span><span class="ico">2D</span></div>
<div class="scale"><i style="width:{scale_px}px"></i>{scale_km} km</div>
<div class="legend">{''.join(f'<span><i style="background:{v[1]}"></i>{v[0]}</span>' for v in ST.values())}</div>
<div class="timebar"><span class="lbl">Vandaag</span><div class="bar"><i style="width:60.5%"></i><b style="left:60.5%"></b></div><span class="now">LIVE 14:32</span><span class="ctl">⏮ ◀ ❚❚ ▶ ⏭</span><span class="spd">1× · Replay 24 u</span></div>'''

# ===================================================================== MOCKUP 1: landelijk
def mock1():
    W,H=980,944; V=View(5.42,52.17,3.08,W,H)
    svg=[basemap(V,'nl')]
    # clusters per standplaats met samenvoegen bij overlap
    cl=[]
    for s in SP:
        x,y=V.xy(s['lon'],s['lat']); r=9+math.sqrt(s['fleet'])*1.9
        cl.append({'x':x,'y':y,'r':r,'n':s['fleet'],'names':[s['n']],'mix':dict(s['mix']),'hub':s.get('hub',False)})
    merged=True
    while merged:
        merged=False
        cl.sort(key=lambda c:-c['n'])
        for i in range(len(cl)):
            for j in range(i+1,len(cl)):
                a,b=cl[i],cl[j]
                if math.hypot(a['x']-b['x'],a['y']-b['y'])<a['r']+b['r']+4:
                    n=a['n']+b['n']; a['x']=(a['x']*a['n']+b['x']*b['n'])/n; a['y']=(a['y']*a['n']+b['y']*b['n'])/n
                    a['n']=n; a['r']=9+math.sqrt(n)*1.9; a['names']+=b['names']
                    for k in a['mix']: a['mix'][k]+=b['mix'][k]
                    cl.pop(j); merged=True; break
            if merged: break
    for c in sorted(cl,key=lambda c:c['n']):
        x,y,r=c['x'],c['y'],c['r']
        svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r+9}" fill="#FFFFFF" opacity=".035"/>')
        svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="#0F1521" stroke="#0A0E17" stroke-width="2"/>')
        svg.append(donut(x,y,r-2,c['mix'],4.5))
        fs=15 if c['n']>=100 else (13 if c['n']>=40 else 11)
        svg.append(f'<text x="{x:.1f}" y="{y+fs*.36:.1f}" class="cnt" font-size="{fs}">{c["n"]}</text>')
        label=c['names'][0]+(f' +{len(c["names"])-1}' if len(c['names'])>1 else '')
        svg.append(f'<text x="{x:.1f}" y="{y+r+13:.1f}" class="splbl {"hub" if c["hub"] else ""}" font-size="{11 if c["n"]>=40 else 10}">{label}</text>')
    # tooltip op cluster Wognum
    w=next(c for c in cl if 'Wognum' in c['names']); tx,ty=w['x']-w['r']-14-280,w['y']-70
    mix=w['mix']
    tip=f'''<div class="tip left" style="left:{tx:.0f}px;top:{ty:.0f}px"><h5>Cluster Wognum <small>{len(w['names'])} standplaatsen · {w['n']} trucks</small></h5><p class="names">{', '.join(w['names'])}</p>
    <div class="bars">{''.join(f'<div><i style="background:{ST[k][1]};width:{mix[k]/w["n"]*100:.0f}%"></i><span>{ST[k][0]}</span><b>{mix[k]}</b></div>' for k in ST)}</div>
    <div class="act"><span>Zoom naar standplaats</span><span>Alleen deze trucks</span></div></div>'''
    kp=kpis([('Trucks actief',fmt(FLEET-TOT['terrein']),f'van {fmt(FLEET)} · {fmt(TOT["terrein"])} op terrein',''),
             ('Ritten vandaag','3.912','2.604 afgerond · 1.308 bezig',''),
             ('Op tijd bij klant','94,1 %','tijdvenster gehaald · doel 95 %','warn'),
             ('Uitzonderingen','14','7 vertraging · 4 rijtijd · 3 techniek','bad'),
             ('Rijtijd-risico','6','chauffeurs binnen 30 min op limiet','warn'),
             ('Laadpunten','41 / 88','bezet · 12 eActros laden nu','')])
    alerts=[('bad','W-0412','Wognum → AH Medemblik','Tijdvenster 14:30–15:00 in gevaar · ETA 15:07 (+7)','2 min'),
            ('bad','W-1188','Zaandam → AH Purmerend','File A7 Purmerend-Noord · +18 min','4 min'),
            ('warn','W-0931','Geldermalsen → AH Tiel','Chauffeur J. Bakker: 4:12 van 4:30 rijtijd','6 min'),
            ('warn','W-0277','Oss → Plus Nijmegen','Rijtijd: pauze verplicht binnen 25 min','9 min'),
            ('bad','W-0655','Raalte → Jumbo Deventer','Storing koelunit · −12 °C (doel −20 °C)','11 min'),
            ('warn','W-0049','Wognum (eActros)','Accu 14 % · 38 km tot laadpunt Wognum','13 min'),
            ('info','W-0820','Barneveld → Plus Apeldoorn','Lossen 25 min langer dan gepland','16 min'),
            ('bad','W-1104','Waalwijk → SPAR Breda','Stilstand 22 min op N261 zonder melding','19 min'),
            ('warn','W-0362','Almere → Lidl Lelystad','Omleiding N302 · +9 min','23 min'),
            ('info','W-0718','Den Bosch → Heineken','Dock 7 bezet · wacht sinds 14:02','30 min'),
            ('warn','W-0533','Tilburg → AH Eindhoven','Chauffeur S. Yilmaz: rijtijd 4:05 / 4:30','34 min'),
            ('bad','W-0093','Bunnik → Vrumona Utrecht','Bandenspanning as 2 laag · melding boordcomputer','41 min'),
            ('info','W-0999','Lieshout → Bavaria','Tankniveau 11 % · tanken gepland Lieshout','48 min'),
            ('info','W-0151','Aalsmeer → Borgesius','Vertrek 12 min later dan planbord','55 min')]
    al=''.join(f'<div class="al {c}"><i></i><div><b>{t}</b><span>{r}</span><p>{m}</p></div><time>{a}</time></div>' for c,t,r,m,a in alerts)
    panel=f'''<section class="panel"><div class="ph"><h3>Uitzonderingen <b>14</b></h3><div class="seg sm"><span class="on">Open</span><span>Afgehandeld 31</span></div></div>
    <div class="pf"><span class="chip on sm">Alle</span><span class="chip sm">Vertraging 7</span><span class="chip sm">Rijtijd 4</span><span class="chip sm">Techniek 3</span></div>
    <div class="als">{al}</div></section>'''
    body=f'''<main class="app">{sidebar()}
 <div class="map"><svg width="{W}" height="{H}" viewBox="0 0 {W} {H}">{''.join(svg)}</svg>
  <div class="crumb"><b>Nederland</b> · alle standplaatsen · {fmt(FLEET)} trucks <span class="pill">Clusters per standplaats</span><span class="pill ghost">Zoom in voor losse trucks</span></div>
  {kp}{tip}{mapcontrols(50,round(V.xy(5.5+50/(111.32*V.cl),52)[0]-V.xy(5.5,52)[0]))}
 </div>{panel}</main>'''
    return chrome('Simon Loos Control Tower · Nederland','Kaart',body)

# ===================================================================== MOCKUP 2: regio Noord-Holland, standplaats Wognum
def mock2():
    W,H=980,944; V=View(4.98,52.62,0.80,W,H)
    svg=[basemap(V,'regio')]
    WOG=(5.021,52.672)
    dests=[('Zaandam (AH DC)',(4.83,52.44),14),('Amsterdam',(4.90,52.37),9),('Alkmaar',(4.75,52.63),8),('Den Helder',(4.76,52.96),5),('Hoorn',(5.06,52.64),7),
           ('Purmerend',(4.95,52.50),6),('Haarlem',(4.64,52.38),5),('Heerhugowaard',(4.84,52.67),4),('Almere',(5.22,52.37),5),('Schagen',(4.80,52.79),3),('Enkhuizen',(5.29,52.70),4),('Medemblik',(5.105,52.77),3)]
    # bij klant: cijfers per bestemming
    trucks=[]; kl=[]
    for name,pt,k in dests:
        pts=route(WOG,pt); cum=polylen(pts)
        for i in range(k):
            fr=random.uniform(.06,.94); outb=random.random()<.5
            (lon,lat),(dx,dy)=pos_at(pts,cum,fr)
            if not outb: dx,dy=-dx,-dy
            st='onderweg'
            r=random.random()
            if r<.07: st='vertraagd'
            elif r<.17: st='pauze'
            trucks.append((lon,lat,(dx,dy),st))
        for i in range(max(1,k//3)):
            kl.append((pt[0]+random.uniform(-.012,.012),pt[1]+random.uniform(-.008,.008),(random.uniform(-1,1),random.uniform(-1,1)),'klant'))
    # op terrein Wognum
    yard=[(WOG[0]+random.uniform(-.006,.006),WOG[1]+random.uniform(-.004,.004),(1,0),'terrein') for _ in range(8)]
    allt=trucks+kl+yard
    counts={k:sum(1 for t in allt if t[3]==k) for k in ST}
    n_tot=len(allt)
    # andere standplaatsen in beeld, gedimd
    for s in SP:
        if s['n']=='Wognum' or not V.inb([(s['lon'],s['lat'])],0): continue
        x,y=V.xy(s['lon'],s['lat']); r=9+math.sqrt(s['fleet'])*1.6
        svg.append(f'<g opacity=".35"><circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="#0F1521" stroke="#3A4356" stroke-width="1.5" stroke-dasharray="3 3"/><text x="{x:.1f}" y="{y+4:.1f}" class="cnt" font-size="11">{s["fleet"]}</text><text x="{x:.1f}" y="{y+r+12:.1f}" class="splbl" font-size="10">{s["n"]}</text></g>')
    # standplaats Wognum marker
    x,y=V.xy(*WOG)
    svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="34" fill="#E3001F" opacity=".10"/><circle cx="{x:.1f}" cy="{y:.1f}" r="20" fill="#E3001F" opacity=".14"/>')
    svg.append(f'<rect x="{x-9:.1f}" y="{y-9:.1f}" width="18" height="18" rx="4" fill="#E3001F" stroke="#FFFFFF" stroke-width="1.5"/><text x="{x:.1f}" y="{y+4:.1f}" class="cnt" font-size="11">SL</text>')
    svg.append(f'<text x="{x+16:.1f}" y="{y-14:.1f}" class="splbl hub" font-size="12" text-anchor="start">Wognum · hoofdkantoor</text>')
    for lon,lat,hv,st in allt:
        svg.append(truck_svg(V,lon,lat,hv,st,scale=1.0))
    # geselecteerde truck (richting Hoorn)
    lon,lat=5.175,52.736; dx,dy=-0.03,0.015
    svg.append(truck_svg(V,lon,lat,(dx,dy),'vertraagd',sel=True,scale=1.15))
    sx,sy=V.xy(lon,lat)
    tip=f'''<div class="tip trk below" style="left:{sx+24:.0f}px;top:{sy+22:.0f}px"><h5><span class="plate">W-0412</span> Mercedes-Benz eActros 600 <small>koeltrailer</small></h5>
    <div class="kv"><span>Chauffeur</span><b>J. de Vries</b><span>Rit</span><b>AH West-Friesland · stop 4 van 5 → AH Medemblik</b><span>ETA</span><b class="bad">15:07 · venster tot 15:00 (+7 min)</b><span>Accu</span><b>61 % · 190 km</b><span>Rijtijd</span><b>3:12 / 4:30</b></div>
    <div class="act"><span>Open rit</span><span>Bel chauffeur</span><span>Deel ETA</span></div></div>'''
    WF=next(s['fleet'] for s in SP if s['n']=='Wognum')
    kp=kpis([('Trucks Wognum',str(WF),f'{n_tot} in beeld · {WF-n_tot} buiten Noord-Holland',''),
             ('Chauffeurs in dienst','128','14 starten binnen 2 uur',''),
             ('Op tijd vandaag','96,3 %','3 tijdvensters gemist','good'),
             ('Uitzonderingen','3','2 vertraging · 1 accu','bad'),
             ('Laadpunten Wognum','18 / 24','bezet · 6 vrij','')])
    deps=[('14:40','W-0212','R. Kooijman','AH Home Service · Hoorn / Zwaag','Dock 3'),('14:45','W-0588','M. Visser','AH Alkmaar · 4 stops','Dock 1'),('14:55','W-0107','D. Smit','Netwerk · DC Zaandam (LZV)','Dock 6'),
          ('15:10','W-0335','A. Groot','AH Den Helder · 3 stops','Dock 2'),('15:20','W-0463','S. Blokker','Bulk · Beverwijk','Terrein'),('15:30','W-0071','K. Ruiter','AH Home Service · Heerhugowaard','Dock 4'),('15:45','W-0819','F. Appelman','Netwerk · Geldermalsen','Dock 5')]
    dp=''.join(f'<div class="dep"><time>{t}</time><div><b>{w} <small>{c}</small></b><span>{r}</span></div><em>{d}</em></div>' for t,w,c,r,d in deps)
    panel=f'''<section class="panel"><div class="ph"><h3>Wognum <small>hoofdkantoor · warehouse · garage</small></h3><span class="x">✕</span></div>
    <div class="stat3"><div><b>{WF}</b><span>trucks</span></div><div><b>{n_tot}</b><span>in regio</span></div><div><b>{WF-n_tot}</b><span>buiten regio</span></div><div><b>{counts['klant']}</b><span>bij klant</span></div><div><b>{counts['terrein']}</b><span>op terrein</span></div></div>
    <div class="mix">{''.join(f'<i style="background:{ST[k][1]};flex:{max(counts[k],1)}"></i>' for k in ST)}</div>
    <h4 class="sub">Volgende vertrekken <small>komend uur · 9</small></h4><div class="deps">{dp}</div>
    <h4 class="sub">Klanten vanuit Wognum</h4><div class="chips wrap"><span class="chip sm on">Albert Heijn 61</span><span class="chip sm on">AH Home Service 23</span><span class="chip sm on">Netwerk 19</span><span class="chip sm on">Bulk 9</span></div>
    <div class="btns"><span class="btn">Standplaats-scherm (hal)</span><span class="btn pri">Open planbord Wognum</span></div></section>'''
    nh=[s for s in sorted(SP,key=lambda s:-s['fleet']) if regio_of(s)=='Noord-Holland']
    body=f'''<main class="app">{sidebar('Noord-Holland',{'Wognum'},True,sp_list=nh)}
 <div class="map"><svg width="{W}" height="{H}" viewBox="0 0 {W} {H}">{''.join(svg)}</svg>
  <div class="crumb"><b>Noord-Holland</b> · standplaats Wognum · {n_tot} van {WF} trucks in beeld <span class="pill red">Alleen Wognum ✕</span><span class="pill ghost">Andere standplaatsen gedimd</span></div>
  {kp}{tip}{mapcontrols(10,round(V.xy(5+10/(111.32*V.cl),52)[0]-V.xy(5,52)[0]))}
 </div>{panel}</main>'''
    return chrome('Simon Loos Control Tower · Noord-Holland · Wognum','Kaart',body)

# ===================================================================== MOCKUP 3: truckdetail
def mock3():
    W,H=1010,944; V=View(5.15,52.675,0.33,W,H)
    svg=[basemap(V,'detail')]
    WOG=(5.021,52.672); HOORN=(5.062,52.645); ENK=(5.29,52.70); MED=(5.105,52.77)
    # geplande route (handmatig over de regionale wegen): Wognum -> A7 -> Hoorn -> N307 -> Enkhuizen -> dijkroute -> Medemblik -> Wognum
    leg1=[WOG,(5.03,52.66),HOORN]
    leg2=[HOORN,(5.075,52.66),(5.10,52.672),(5.17,52.68),(5.19,52.69),(5.25,52.70),ENK]
    leg3=[ENK,(5.25,52.725),(5.22,52.74),(5.16,52.735),(5.13,52.75),MED]
    leg4=[MED,(5.07,52.745),(5.03,52.705),WOG]
    full=leg1+leg2[1:]+leg3[1:]+leg4[1:]
    done=leg1+leg2[1:]+leg3[1:3]           # afgelegd tot ergens tussen Enkhuizen en Medemblik
    cur_seg=(leg3[2],leg3[3]); u=.75
    cur=(cur_seg[0][0]+(cur_seg[1][0]-cur_seg[0][0])*u,cur_seg[0][1]+(cur_seg[1][1]-cur_seg[0][1])*u)
    done=done+[cur]; todo=[cur]+leg3[3:]+leg4[1:]
    svg.append(f'<path d="{pd(V,full,False)}" fill="none" stroke="#0A0E17" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>')
    svg.append(f'<path d="{pd(V,done,False)}" fill="none" stroke="#5B6474" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')
    svg.append(f'<path d="{pd(V,todo,False)}" fill="none" stroke="#38BDF8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')
    svg.append(f'<path d="{pd(V,todo,False)}" fill="none" stroke="#E0F2FE" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/>')
    stops=[(WOG,'S','Vertrek Wognum','06:10',True),(HOORN,'1','AH Hoorn · Grote Noord','07:05 · gelost 07:41',True),(ENK,'2','AH Enkhuizen · Flosbeugel','08:20 · gelost 08:52',True),
           ((5.22,52.74),'3','AH Andijk','13:40 · gelost 14:14',True),(MED,'4','AH Medemblik · Nieuwstraat','ETA 15:07 · venster 14:30–15:00',False),(WOG,'E','Terug Wognum · laden accu','ETA 16:05',False)]
    for (lon,lat),n,label,t,ok in stops:
        x,y=V.xy(lon,lat)
        if n in('S','E'):
            svg.append(f'<rect x="{x-10:.1f}" y="{y-10:.1f}" width="20" height="20" rx="5" fill="#E3001F" stroke="#FFFFFF" stroke-width="1.5"/><text x="{x:.1f}" y="{y+4:.1f}" class="cnt" font-size="11">SL</text>')
            continue
        col='#5B6474' if ok else '#38BDF8'
        svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="12" fill="{col}" stroke="#FFFFFF" stroke-width="2"/><text x="{x:.1f}" y="{y+4.5:.1f}" class="cnt" font-size="12">{n}</text>')
        if not ok:
            svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="22" fill="none" stroke="{col}" stroke-width="2" opacity=".5"/>')
    # eindlabel voor Wognum (start en einde)
    svg.append(truck_svg(V,cur[0],cur[1],(cur_seg[1][0]-cur_seg[0][0],cur_seg[1][1]-cur_seg[0][1]),'vertraagd',sel=True,scale=1.4))
    cx,cy=V.xy(*cur)
    # stop-labels als HTML
    labels=''
    for (lon,lat),n,label,t,ok in stops:
        x,y=V.xy(lon,lat)
        if n=='E': continue
        dx,dy=(18,-14)
        if n=='3': dx,dy=(18,-14)
        if n=='S': dx,dy=(18,4)
        cls='done' if ok else 'next'
        if n=='S': cls='start'
        labels+=f'<div class="stoplbl {cls}" style="left:{x+dx:.0f}px;top:{y+dy:.0f}px;{"transform:translateX(-100%);" if dx<0 else ""}"><b>{label}</b><span>{t}</span></div>'
    labels+=f'<div class="stoplbl live" style="left:{cx:.0f}px;top:{cy-64:.0f}px;transform:translateX(-50%)"><b>W-0412 · 78 km/u · richting Medemblik</b><span>nog 9,8 km · ETA 15:07 · tijdvenster tot 15:00</span></div>'
    # verkeersmelding op route
    tx,ty=V.xy(5.235,52.73)
    svg.append(f'<g transform="translate({tx:.1f} {ty:.1f})"><path d="M0 -11 L11 9 L-11 9 Z" fill="#F59E0B" stroke="#0A0E17" stroke-width="1.5"/><text y="6" class="cnt dark" font-size="11">!</text></g>')
    labels+=f'<div class="stoplbl warn" style="left:{tx+16:.0f}px;top:{ty+6:.0f}px"><b>Wegwerkzaamheden N302</b><span>NDW-melding · +6 min op dit deel</span></div>'
    # paneel rechts
    tl=[('06:10','Vertrek Wognum','14 rolcontainers · voorgekoeld −20 °C','done'),('07:05 – 07:41','Stop 1 · AH Hoorn, Grote Noord','gelost · handtekening P. Kok','done'),
        ('08:20 – 08:52','Stop 2 · AH Enkhuizen, Flosbeugel','gelost · 2 retouremballage','done'),('09:30 – 10:15','Pauze · P+R Enkhuizen','45 min · rijtijd gereset','done'),
        ('10:40 – 13:10','Retour DC Zaandam · herladen','2e lading · 12 rolcontainers','done'),('13:40 – 14:14','Stop 3 · AH Andijk','gelost · 34 min (gepland 25)','done'),
        ('ETA 15:07','Stop 4 · AH Medemblik, Nieuwstraat','tijdvenster 14:30 – 15:00 · <b class="bad">+7 min</b>','next'),('ETA 16:05','Terug Wognum · laden accu','laadpunt 7 gereserveerd · 16:10 – 17:40','todo'),('17:45','Einde dienst J. de Vries','dienst 06:00 – 18:00','todo')]
    tlh=''.join(f'<div class="tl {c}"><i></i><time>{t}</time><div><b>{h}</b><span>{s}</span></div></div>' for t,h,s,c in tl)
    panel=f'''<section class="detail">
 <div class="dh"><div><span class="plate big">W-0412</span><span class="kent">BZ-487-F</span></div><div class="dt"><b>Mercedes-Benz eActros 600</b><span>trekker + koeltrailer Schmitz · 2025 · standplaats Wognum · Winkeldistributie</span></div><span class="badge bad">Vertraagd +7</span></div>
 <div class="tiles">
  <div class="tile"><small>Snelheid</small><b>78 <em>km/u</em></b><span>N302 richting Medemblik</span></div>
  <div class="tile"><small>Accu</small><b>61 <em>%</em></b><div class="bar"><i style="width:61%;background:#22C55E"></i></div><span>190 km bereik · 37 km nodig</span></div>
  <div class="tile"><small>Koeling</small><b>−19,5 <em>°C</em></b><span>instelling −20 °C · ok</span></div>
  <div class="tile"><small>Rijtijd</small><b>3:12 <em>/ 4:30</em></b><div class="bar"><i style="width:71%;background:#F59E0B"></i></div><span>pauze uiterlijk 15:50</span></div>
 </div>
 <div class="drv"><span class="av">JV</span><div><b>J. de Vries</b><span>chauffeur · dienst 06:00 – 18:00 · 11 jaar bij Simon Loos</span></div><div class="btns"><span class="btn">📞 Bellen</span><span class="btn">💬 Bericht</span></div></div>
 <div class="ph2"><h4>Rit 24-10 · AH West-Friesland <small>5 stops · 118 km · 2 ladingen</small></h4><span class="link">Toon planbord</span></div>
 <div class="tls">{tlh}</div>
 <div class="btns row"><span class="btn pri">Deel ETA met AH Medemblik</span><span class="btn">Herplan stop 4</span><span class="btn">Rit-replay</span></div>
</section>'''
    body=f'''<main class="app two">
 <div class="map"><svg width="{W}" height="{H}" viewBox="0 0 {W} {H}">{''.join(svg)}</svg>{labels}
  <div class="crumb"><span class="back">‹ Noord-Holland · Wognum</span><b>W-0412</b> · rit AH West-Friesland <span class="pill">Live volgen</span><span class="pill ghost">Route uit TMS + ETA (Valhalla)</span></div>
  {mapcontrols(5,round(V.xy(5+5/(111.32*V.cl),52)[0]-V.xy(5,52)[0]))}
 </div>{panel}</main>'''
    return chrome('Simon Loos Control Tower · W-0412','Kaart',body)

# ===================================================================== MOCKUP 4: planbord
def mock4():
    T0,T1=4,22; span=T1-T0
    def pct(h): return (h-T0)/span*100
    KL={'ah':('#3B82F6','Albert Heijn'),'hs':('#06B6D4','AH Home Service'),'nw':('#8B5CF6','Netwerk'),'bk':('#F59E0B','Bulk'),'pz':('#3A4356','Pauze'),'ld':('#22C55E','Laden accu'),'ol':('#64748B','Onderhoud')}
    rows=[]
    names=['J. de Vries','R. Kooijman','M. Visser','D. Smit','A. Groot','S. Blokker','K. Ruiter','F. Appelman','L. Schouten','T. Beemster','N. Koning','B. Zwaan','E. Mol','H. Bos','P. Wit','G. Jong']
    plans=[
     ('W-0412','eActros 600',[(6.1,9.5,'ah','AH Hoorn · Enkhuizen',''),(9.5,10.25,'pz','',''),(10.6,13.2,'ah','DC Zaandam → Andijk',''),(13.2,16.1,'ah','Medemblik','late'),(16.15,17.7,'ld','Laden',''),]),
     ('W-0212','Actros 1845',[(5.0,9.0,'hs','Home Service Hoorn',''),(9.0,9.75,'pz','',''),(9.9,14.3,'hs','Home Service Zwaag',''),(14.65,18.5,'hs','Home Service Heerhugowaard','')]),
     ('W-0588','eActros 300',[(6.5,10.8,'ah','AH Alkmaar · 4 stops',''),(10.8,11.55,'pz','',''),(11.7,14.5,'ld','Laden',''),(14.75,19.2,'ah','AH Alkmaar · avond','')]),
     ('W-0107','LZV Actros',[(4.5,8.0,'nw','DC Zaandam',''),(8.0,8.75,'pz','',''),(9.0,13.5,'nw','Geldermalsen',''),(14.9,19.0,'nw','DC Zaandam','')]),
     ('W-0335','Actros 1845',[(7.0,12.0,'ah','AH Den Helder · 3 stops',''),(12.0,12.75,'pz','',''),(13.0,17.5,'ah','AH Schagen · Anna Paulowna','conf')]),
     ('W-0463','Actros 2545',[(6.0,10.5,'bk','Bulk Beverwijk',''),(10.5,11.25,'pz','',''),(11.5,15.0,'bk','Bulk Beverwijk',''),(15.3,18.8,'bk','Bulk Velsen','')]),
     ('W-0071','eActros 600',[(5.5,9.8,'hs','Home Service Heerhugowaard',''),(9.8,10.55,'pz','',''),(10.7,12.4,'ld','Laden',''),(15.5,19.5,'hs','Home Service Hoorn','')]),
     ('W-0819','Actros 1845',[(4.2,8.8,'nw','Geldermalsen',''),(8.8,9.55,'pz','',''),(9.7,14.2,'nw','Tiel → Wognum',''),(15.75,20.0,'nw','Geldermalsen','')]),
     ('W-0266','Actros 1845',[(7.5,12.5,'ah','AH Purmerend · 5 stops',''),(12.5,13.25,'pz','',''),(13.4,17.9,'ah','AH Edam · Volendam','')]),
     ('W-0341','eActros 300',[(6.0,10.0,'ah','AH Hoorn centrum',''),(10.0,10.75,'pz','',''),(11.0,12.6,'ld','Laden',''),(12.8,16.9,'ah','AH Hoogkarspel · Bovenkarspel','')]),
     ('W-0498','Actros 1845',[(8.0,11.0,'ol','Onderhoud garage Wognum',''),(11.5,16.0,'ah','AH Enkhuizen · 3 stops',''),(16.0,16.75,'pz','',''),(17.0,20.5,'ah','AH Hoorn avond','')]),
     ('W-0150','LZV Actros',[(4.0,8.5,'nw','DC Zaandam',''),(8.5,9.25,'pz','',''),(9.5,14.0,'nw','DC Zaandam',''),(14.3,15.05,'pz','',''),(15.2,19.7,'nw','Geldermalsen','rt')]),
     ('W-0377','Actros 2545',[(6.3,11.0,'bk','Bulk Amsterdam Westpoort',''),(11.0,11.75,'pz','',''),(12.0,16.5,'bk','Bulk Amsterdam Westpoort','')]),
     ('W-0602','eActros 600',[(5.8,10.3,'ah','AH Alkmaar · Heiloo',''),(10.3,11.05,'pz','',''),(11.2,12.9,'ld','Laden',''),(13.0,17.6,'ah','AH Castricum · Limmen','')]),
     ('W-0733','Actros 1845',[(7.2,11.7,'hs','Home Service Alkmaar',''),(11.7,12.45,'pz','',''),(12.6,17.2,'hs','Home Service Alkmaar','')]),
     ('W-0888','Actros 1845',[(9.0,13.5,'ah','AH Medemblik · Wervershoof',''),(13.5,14.25,'pz','',''),(14.4,18.9,'ah','AH Opmeer · Spanbroek','')]),
    ]
    grid=''.join(f'<i style="left:{pct(h):.3f}%"><span>{h:02d}:00</span></i>' for h in range(T0,T1+1,1))
    body_rows=''
    for k,(wid,typ,blocks) in enumerate(plans):
        nm=names[k]
        bl=''
        for a,b,kl,lab,flag in blocks:
            col=KL[kl][0]; cls=f'blk {kl} {flag}'
            icon='⚡ ' if kl=='ld' else ('🔧 ' if kl=='ol' else '')
            txt='' if kl=='pz' else f'{icon}{lab}'
            dur=f'<small>{int(a):02d}:{int((a%1)*60):02d}–{int(b):02d}:{int((b%1)*60):02d}</small>'
            bl+=f'<div class="{cls}" style="left:{pct(a):.3f}%;width:{pct(b)-pct(a):.3f}%;--c:{col}"><b>{txt}</b>{dur if kl!="pz" else ""}{"<em>⚠ ETA +7 · venster 15:00</em>" if flag=="late" else ""}{"<em>⚠ chauffeur: rijtijd 4:30 overschreden</em>" if flag=="conf" else ""}{"<em>⚠ rusttijd 9 u niet haalbaar</em>" if flag=="rt" else ""}</div>'
        status='Onderweg' if k not in (10,) else 'Garage'
        body_rows+=f'<div class="prow {"sel" if k==0 else ""}"><div class="who"><span class="plate">{wid}</span><div><b>{nm}</b><span>{typ} · 06:00–18:00</span></div></div><div class="lane">{bl}</div></div>'
    unassigned=[('AH Hoorn · avondlevering 18:30–20:00','3 stops · 46 km','ah'),('Home Service Zwaag · 19:00','1 rit · 8 adressen','hs'),('Netwerk Geldermalsen · 21:00','LZV · 1 rit','nw')]
    un=''.join(f'<div class="ucard" style="--c:{KL[c][0]}"><b>{t}</b><span>{s}</span><em>Sleep naar een truck</em></div>' for t,s,c in unassigned)
    body=f'''<main class="board">
 <div class="bh"><div class="bf"><span class="dd"><small>Standplaats</small><b>Wognum ▾</b></span><span class="dd"><small>Datum</small><b>vr 24 okt 2026 ▾</b></span><span class="dd"><small>Weergave</small><b>Trucks ▾</b></span><div class="seg"><span class="on">Dag</span><span>Week</span></div><div class="search sm">🔍 <span>Filter op chauffeur, klant, truck…</span></div></div>
  <div class="bs"><span class="pill">112 trucks · 98 gepland · 3 niet toegewezen</span><span class="pill bad">3 conflicten</span><span class="btn">Exporteer</span><span class="btn pri">✦ Voorstel: automatisch herplannen</span></div></div>
 <div class="legend2">{''.join(f'<span><i style="background:{v[0]}"></i>{v[1]}</span>' for v in KL.values())}<span class="now2"><i></i>Nu 14:32</span></div>
 <div class="gantt"><div class="ghead"><div class="who"><b>Truck / chauffeur</b><span>16 van 112</span></div><div class="lane hd">{grid}</div></div>
  <div class="gbody">{body_rows}<div class="nowline" style="left:calc(280px + (100% - 280px) * {pct(14.53)/100:.4f})"><span>14:32</span></div></div></div>
 <div class="tray"><h4>Niet toegewezen <b>3</b></h4><div class="ucards">{un}</div><div class="hint">Sleep een rit op een truck. Het systeem controleert rijtijd, rusttijd, accu en laadtijd en geeft direct een waarschuwing.</div></div>
</main>'''
    return chrome('Simon Loos Control Tower · Planbord Wognum','Planbord',body)

if __name__=='__main__':
    for name,fn in (('m1_landelijk',mock1),('m2_regio_wognum',mock2),('m3_truck_detail',mock3),('m4_planbord',mock4)):
        html=fn(); open(f'{HERE}/{name}.html','w').write(html); print(name,len(html)//1024,'kB')
    print('fleet',FLEET,TOT)
    print({k:regio_of(s) for s in SP for k in [s['n']]})
