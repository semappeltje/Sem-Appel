import pyarrow.parquet as pq, shapely.wkb, shapely, json, math, collections
from shapely.geometry import Polygon, MultiPolygon
from shapely.prepared import prep
OUT='../src/data/'
land=json.load(open(OUT+'land.json')); nlp=prep(MultiPolygon([Polygon(p[0],p[1:]) for p in land['nl']]).buffer(0.03))
def enc(pts):
    out=[]; plat=plon=0
    for lon,lat in pts:
        la,lo=round(lat*1e5),round(lon*1e5)
        for v,p in ((la,plat),(lo,plon)):
            d=v-p; d=~(d<<1) if d<0 else d<<1
            while d>=0x20: out.append(chr((0x20|(d&0x1f))+63)); d>>=5
            out.append(chr(d+63))
        plat,plon=la,lo
    return ''.join(out)
W=pq.read_table('nl_water.parquet').to_pylist(); out=[]; cnt=collections.Counter(); dropped=0
KM=111.32*111.32*math.cos(math.radians(52.2))
for w in W:
    g=shapely.wkb.loads(w['geometry']); st=w.get('subtype')
    polys=list(g.geoms) if g.geom_type=='MultiPolygon' else ([g] if g.geom_type=='Polygon' else [])
    for p in polys:
        area=p.area*KM; per=p.length*111.32*0.78; comp=4*math.pi*area/(per*per) if per>0 else 0
        big=st in ('ocean','sea')
        if not big:
            if area<0.03: continue
            if area<1.5 and comp<0.03: dropped+=1; continue   # slotenpatronen en smalle vaarten
            if not nlp.intersects(p): continue
        ps=p.simplify(0.00006, preserve_topology=True)
        if ps.is_empty: continue
        for q in (list(ps.geoms) if ps.geom_type=='MultiPolygon' else [ps]):
            rings=[enc([(round(x,6),round(y,6)) for x,y in q.exterior.coords])]+[enc([(round(x,6),round(y,6)) for x,y in r.coords]) for r in q.interiors if len(r.coords)>8 and Polygon(r).area*KM>0.02]
            out.append(['o' if big else 'r' if st=='river' else 'l', rings]); cnt[st]+=1
sw=json.dumps(out,separators=(',',':')); open(OUT+'water.json','w').write(sw)
print('water.json',len(sw)//1024,'kB',dict(cnt),'gefilterd',dropped)
