import json, math, random, os
random.seed(2026)
V2='/home/user/Sem-Appel/demos/simonloos-live/src/data/'
OUT='../src/data/'
HERE=os.path.dirname(os.path.abspath(__file__))
BB=(3.0,50.6,7.6,53.8)
def inb(pts,m=0.0):
    return any(BB[0]-m<=x<=BB[2]+m and BB[1]-m<=y<=BB[3]+m for x,y in pts)
def dp(pts,tol):
    if len(pts)<3: return pts
    (x0,y0),(x1,y1)=pts[0],pts[-1]; dx,dy=x1-x0,y1-y0; L=math.hypot(dx,dy) or 1e-12
    best,bi=0,0
    for i in range(1,len(pts)-1):
        x,y=pts[i]; d=abs(dy*x-dx*y+x1*y0-y1*x0)/L
        if d>best: best,bi=d,i
    if best>tol: return dp(pts[:bi+1],tol)[:-1]+dp(pts[bi:],tol)
    return [pts[0],pts[-1]]
# land + provincies: ongewijzigd overnemen
for f in ('land.json','provinces.json'):
    json.dump(json.load(open(V2+f)),open(OUT+f,'w'),separators=(',',':'))
# wegen: regionale wegen West-Friesland en A7-gat toevoegen
R=json.load(open(V2+'roads.json'))
NODES=R['nodes']; EDGES=R['edges']
def kmd(a,b):
    cl=math.cos(math.radians((a[1]+b[1])/2)); return math.hypot((a[0]-b[0])*cl*111.32,(a[1]-b[1])*111.32)
def nearest(lon,lat):
    cl=math.cos(math.radians(lat)); return min(range(len(NODES)),key=lambda k:((NODES[k][0]-lon)*cl)**2+(NODES[k][1]-lat)**2)
EXTRA=[(1,[(4.84,52.671),(4.93,52.668),(5.00,52.668),(5.07,52.672),(5.10,52.672),(5.17,52.68),(5.19,52.69),(5.25,52.70),(5.29,52.70)]),
 (2,[(5.29,52.70),(5.25,52.725),(5.22,52.74),(5.16,52.735),(5.13,52.75),(5.105,52.77)]),
 (2,[(5.105,52.77),(5.07,52.745),(5.03,52.705),(5.021,52.672)]),
 (2,[(5.021,52.672),(5.03,52.66),(5.06,52.645)]),
 (1,[(5.29,52.70),(5.33,52.66),(5.38,52.60),(5.43,52.54),(5.47,52.51)])]
def add_poly(t,pts):
    ids=[]
    for p in pts:
        k=nearest(*p)
        if kmd(NODES[k],p)<=0.7: ids.append(k)
        else: NODES.append([round(p[0],4),round(p[1],4)]); ids.append(len(NODES)-1)
    for a,b in zip(ids,ids[1:]):
        if a!=b: EDGES.append([a,b,round(kmd(NODES[a],NODES[b]),2),t])
    R['roads'].append({'t':t,'l':'','p':[list(p) for p in pts]})
for t,pts in EXTRA: add_poly(t,pts)
a,b=nearest(5.044,52.688),nearest(5.033,52.651); EDGES.append([a,b,round(kmd(NODES[a],NODES[b]),2),0])
json.dump(R,open(OUT+'roads.json','w'),separators=(',',':'))
# stedelijk gebied
U=json.load(open('../../../scratchpad/ne/ne_10m_urban_areas.geojson'))['features']
urb=[]
for f in U:
    g=f['geometry']; polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    for poly in polys:
        ring=[tuple(c[:2]) for c in poly[0]]
        if inb(ring[::max(1,len(ring)//30)] or ring):
            h=len(ring)//2; s=dp(ring[:h+1],0.0015)[:-1]+dp(ring[h:],0.0015)
            if len(s)>=4: urb.append([[round(x,4),round(y,4)] for x,y in s])
json.dump(urb,open(OUT+'urban.json','w'),separators=(',',':'))
# rivieren
RV=json.load(open('../../../scratchpad/ne/ne_10m_rivers_lake_centerlines.geojson'))['features']
riv=[]
for f in RV:
    g=f['geometry']; lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
    for L in lines:
        pts=[tuple(c[:2]) for c in L if BB[0]-0.3<=c[0]<=BB[2]+0.3 and BB[1]-0.3<=c[1]<=BB[3]+0.3]
        if len(pts)>=2:
            s=dp(pts,0.002); riv.append({'n':f['properties'].get('name') or '','p':[[round(x,4),round(y,4)] for x,y in s]})
json.dump(riv,open(OUT+'rivers.json','w'),separators=(',',':'))
# plaatsen: standplaatsen met vlootverdeling, provincie en regio; steden
P=json.load(open(HERE+'/places.json')); SP=P['SP']; TOWNS=P['TOWNS']
prov=json.load(open(V2+'provinces.json'))
def pip(pt,ring):
    x,y=pt; inside=False; n=len(ring)
    for i in range(n):
        x1,y1=ring[i]; x2,y2=ring[(i+1)%n]
        if (y1>y)!=(y2>y):
            xi=x1+(y-y1)*(x2-x1)/(y2-y1)
            if xi>x: inside=not inside
    return inside
REGIO={'Noord-Holland':['Noord-Holland'],'Randstad Zuid':['Zuid-Holland','Utrecht','Flevoland'],'Oost':['Gelderland','Overijssel'],'Noord':['Groningen','Friesland','Drenthe'],'Zuid':['Noord-Brabant','Limburg','Zeeland']}
def weight(s): return s['vac']*4+6+(60 if s.get('hub') else 0)+(24 if s.get('wh') else 0)
tw=sum(weight(s) for s in SP)
for s in SP: s['fleet']=max(6,round(weight(s)/tw*1300))
SP[0]['fleet']+=1300-sum(s['fleet'] for s in SP)
out=[]
for s in SP:
    pv=next((p['name'] for p in prov if any(pip((s['lon'],s['lat']),r) for r in p['rings'])),'?')
    rg=next((k for k,v in REGIO.items() if pv in v),'Overig')
    out.append({'n':s['n'],'lat':s['lat'],'lon':s['lon'],'div':s['div'],'klant':s.get('klant',''),'vac':s['vac'],'hub':bool(s.get('hub')),'wh':bool(s.get('wh')),'note':s.get('note',''),'fleet':s['fleet'],'prov':pv,'regio':rg})
CL=math.cos(math.radians(52.2))
towns=[{'n':t['n'],'lat':round(t['y']/100+52.2,4),'lon':round(t['x']/(CL*100)+5.3,4),'big':t.get('big',0)} for t in TOWNS]
CITIES=[('Amsterdam',52.37,4.90,1),('Rotterdam',51.92,4.48,1),('Utrecht',52.09,5.12,1),('Groningen',53.22,6.57,1),('Eindhoven',51.44,5.47,1),('Den Haag',52.08,4.31,1),
 ('Zwolle',52.51,6.09,2),('Arnhem',51.98,5.90,2),('Breda',51.59,4.78,2),('Leeuwarden',53.20,5.80,2),('Maastricht',50.85,5.70,2),('Enschede',52.22,6.90,2),('Alkmaar',52.63,4.75,2),('Emmen',52.78,6.90,2),('Middelburg',51.50,3.61,2),('Apeldoorn',52.21,5.97,2),('Nijmegen',51.84,5.85,2),('Antwerpen',51.22,4.40,2),('Düsseldorf',51.23,6.78,2),('Münster',51.96,7.63,2),('Tilburg',51.56,5.09,2),('Almere',52.37,5.22,2),('Haarlem',52.38,4.64,2),('Amersfoort',52.16,5.39,2),('Den Bosch',51.70,5.30,2),('Venlo',51.37,6.17,2),('Assen',52.99,6.56,2),('Lelystad',52.51,5.47,2),
 ('Den Helder',52.96,4.76,3),('Hoorn',52.64,5.06,3),('Zaandam',52.44,4.83,3),('Purmerend',52.50,4.95,3),('Enkhuizen',52.70,5.29,3),('Medemblik',52.77,5.10,3),('Heerhugowaard',52.67,4.84,3),('Schagen',52.79,4.80,3),('Beverwijk',52.48,4.66,3),('Edam',52.51,5.05,3),('Gouda',52.01,4.71,3),('Dordrecht',51.81,4.67,3),('Roosendaal',51.53,4.46,3),('Oss',51.77,5.52,3),('Deventer',52.25,6.16,3),('Hengelo',52.27,6.79,3),('Heerenveen',52.96,5.92,3),('Hoogeveen',52.72,6.48,3),('Ede',52.04,5.66,3),('Amstelveen',52.30,4.86,3),('Hilversum',52.22,5.17,3),('Leiden',52.16,4.49,3),('Delft',52.01,4.36,3),('Vlissingen',51.44,3.57,3),('Goes',51.50,3.89,3),('Terneuzen',51.33,3.83,3),('Bergen op Zoom',51.49,4.29,3),('Helmond',51.48,5.66,3),('Weert',51.25,5.70,3),('Roermond',51.19,5.99,3),('Sittard',51.00,5.87,3),('Doetinchem',51.96,6.29,3),('Zutphen',52.14,6.20,3),('Harderwijk',52.35,5.62,3),('Emmeloord',52.71,5.75,3),('Sneek',53.03,5.66,3),('Drachten',53.11,6.10,3),('Winschoten',53.14,7.03,3),('Delfzijl',53.33,6.92,3),('Meppel',52.70,6.19,3),('Kampen',52.56,5.91,3),('Almelo',52.36,6.66,3),('Tiel',51.89,5.43,3),('Geldermalsen',51.88,5.29,3),('Barneveld',52.14,5.58,3),('Veghel',51.62,5.55,3),('Waalwijk',51.69,5.07,3),('Etten-Leur',51.57,4.64,3),('Wervershoof',52.73,5.16,4),('Andijk',52.74,5.22,4),('Opmeer',52.71,4.95,4),('Nibbixwoud',52.70,5.03,4),('Zwaag',52.67,5.08,4),('Hoogkarspel',52.69,5.19,4),('Bovenkarspel',52.70,5.24,4),('Wognum',52.672,5.021,4),('Obdam',52.68,4.91,4),('Avenhorn',52.62,4.95,4)]
json.dump({'SP':out,'TOWNS':towns,'CITIES':[{'n':n,'lat':a,'lon':b,'r':r} for n,a,b,r in CITIES]},open(OUT+'places.json','w'),ensure_ascii=False,separators=(',',':'))
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(OUT+f)//1024,'kB')
print('fleet',sum(s['fleet'] for s in out),'nodes',len(NODES),'urban',len(urb),'rivers',len(riv))
