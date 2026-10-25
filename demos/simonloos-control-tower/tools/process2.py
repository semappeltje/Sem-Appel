import pyarrow.parquet as pq, shapely.wkb, shapely, json, math, collections, time
from shapely.geometry import shape, Polygon, MultiPolygon, LineString
from shapely.prepared import prep
t0=time.time()
OUT='../src/data/'
# de vorm van Nederland (Natural Earth); sinds oktober 2026 in ct4/nl_ne.json (land.json is nu de echte kust)
land=json.load(open('ct4/nl_ne.json'))
nl=MultiPolygon([Polygon(p[0],p[1:]) for p in land['nl']]).buffer(0.03)
nlp=prep(nl)
def km(a,b):
    cl=math.cos(math.radians((a[1]+b[1])/2)); return math.hypot((a[0]-b[0])*cl*111.32,(a[1]-b[1])*111.32)
def dp(pts,tol):
    if len(pts)<3: return pts
    (x0,y0),(x1,y1)=pts[0],pts[-1]; dx,dy=x1-x0,y1-y0; L2=dx*dx+dy*dy
    best,bi=0,0
    for i in range(1,len(pts)-1):
        x,y=pts[i]
        if L2==0: d=math.hypot(x-x0,y-y0)
        else:
            t=((x-x0)*dx+(y-y0)*dy)/L2; t=max(0,min(1,t)); d=math.hypot(x-(x0+t*dx),y-(y0+t*dy))
        if d>best: best,bi=d,i
    if best>tol: return dp(pts[:bi+1],tol)[:-1]+dp(pts[bi:],tol)
    return [pts[0],pts[-1]]
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
CLS={'motorway':0,'trunk':1,'primary':2,'secondary':3,'tertiary':4}
T=pq.read_table('nl_segments.parquet').to_pylist(); print('segments',len(T),flush=True)
# ---------- stukjes tussen connectors, per segment ----------
pieces=[]  # [cidA,cidB,km,cls,link,coords]
for s in T:
    g=shapely.wkb.loads(s['geometry'])
    if g.geom_type!='LineString': continue
    coords=[(round(x,6),round(y,6)) for x,y in g.coords]
    if len(coords)<2: continue
    cum=[0.0]
    for i in range(1,len(coords)): cum.append(cum[-1]+km(coords[i-1],coords[i]))
    L=cum[-1]
    if L<=0: continue
    cons=sorted([(c['at'] if c.get('at') is not None else 0.0, c['connector_id']) for c in (s.get('connectors') or [])])
    if len(cons)<2: continue
    cls=CLS[s['class']]; link=1 if s.get('subclass')=='link' else 0
    def at(frac):
        d=frac*L; i=1
        while i<len(cum)-1 and cum[i]<d: i+=1
        seg=cum[i]-cum[i-1] or 1e-9; u=max(0,min(1,(d-cum[i-1])/seg)); a,b=coords[i-1],coords[i]
        return (round(a[0]+(b[0]-a[0])*u,6), round(a[1]+(b[1]-a[1])*u,6)), i, d
    prev=None
    for frac,cid in cons:
        pt,idx,d=at(frac)
        if prev is not None:
            ppt,pidx,pd,pcid=prev
            if pcid!=cid:
                mid=[c for k,c in enumerate(coords) if pidx<=k<idx and pd<cum[k]<d]
                geom=[ppt]+mid+[pt]; ln=sum(km(geom[i-1],geom[i]) for i in range(1,len(geom)))
                pieces.append([pcid,cid,ln,cls,link,geom])
        prev=(pt,idx,d,cid)
print('pieces',len(pieces),round(time.time()-t0,1),'s',flush=True)

def contract(pcs, same_class=True):
    """graad-2 contractie; geeft lijst [a,b,km,cls,link,coords] met connector-ids"""
    adj=collections.defaultdict(list); edges=[list(p) for p in pcs]; alive=[True]*len(edges)
    for ei,e in enumerate(edges): adj[e[0]].append(ei); adj[e[1]].append(ei)
    other=lambda e,n: e[1] if e[0]==n else e[0]
    for n in list(adj.keys()):
        es=[ei for ei in adj[n] if alive[ei]]
        if len(es)!=2: continue
        e1,e2=edges[es[0]],edges[es[1]]
        if same_class and (e1[3]!=e2[3] or e1[4]!=e2[4]): continue
        a=other(e1,n); b=other(e2,n)
        if a==n or b==n or a==b: continue
        g1=e1[5] if e1[1]==n else e1[5][::-1]; g2=e2[5] if e2[0]==n else e2[5][::-1]
        alive[es[0]]=False; alive[es[1]]=False
        edges.append([a,b,e1[2]+e2[2],e1[3],e1[4],g1+g2[1:]]); alive.append(True); ei=len(edges)-1
        adj[a]=[x for x in adj[a] if alive[x]]+[ei]; adj[b]=[x for x in adj[b] if alive[x]]+[ei]; adj[n]=[]
    return [e for e,al in zip(edges,alive) if al]

# ---------- routeergraaf: snelweg, autoweg, N-weg ----------
G=contract([p for p in pieces if p[3]<=2])
par={}
def find(x):
    while par.setdefault(x,x)!=x: par[x]=par[par[x]]; x=par[x]
    return x
for e in G:
    ra,rb=find(e[0]),find(e[1])
    if ra!=rb: par[ra]=rb
comp=collections.Counter(find(e[0]) for e in G); big=comp.most_common(1)[0][0]
G=[e for e in G if find(e[0])==big]
cids=sorted({e[0] for e in G}|{e[1] for e in G}); remap={c:i for i,c in enumerate(cids)}
nodes=[None]*len(cids)
for e in G:
    nodes[remap[e[0]]]=e[5][0]; nodes[remap[e[1]]]=e[5][-1]
pb=pa=0; gedges=[]
for e in G:
    s=dp(e[5],0.00003); pb+=len(e[5]); pa+=len(s)
    gedges.append([remap[e[0]],remap[e[1]],round(e[2]*1000),e[3],e[4],enc(s)])
graph={'nodes':[[round(x,5),round(y,5)] for x,y in nodes],'edges':gedges}
sg=json.dumps(graph,separators=(',',':')); open(OUT+'graph.json','w').write(sg)
print('graaf: nodes',len(nodes),'edges',len(gedges),'punten',pb,'->',pa,'|',len(sg)//1024,'kB',round(time.time()-t0,1),'s',flush=True)
# ---------- weergave: secundaire en tertiaire wegen in NL, als ketens ----------
disp={3:[],4:[]}
for cls in (3,4):
    ch=contract([p for p in pieces if p[3]==cls], same_class=False)
    n=0; pts=0
    for e in ch:
        g=e[5]; mid=g[len(g)//2]
        if not nlp.contains(shapely.geometry.Point(mid)): continue
        s=dp(g,0.00004 if cls==3 else 0.00005); pts+=len(s); n+=1
        disp[cls].append(enc(s))
    print('weergave klasse',cls,'ketens',n,'punten',pts,flush=True)
sd=json.dumps({'sec':disp[3],'ter':disp[4]},separators=(',',':')); open(OUT+'roads_display.json','w').write(sd); print('roads_display.json',len(sd)//1024,'kB',flush=True)
# ---------- water ----------
# sinds oktober 2026 maakt tools/ct4/kust_water.py water.json (en land.json); dit oude deel schrijft niets meer
import sys; sys.exit(0)
W=pq.read_table('nl_water.parquet').to_pylist(); print('water polygons',len(W),flush=True)
out=[]; cnt=collections.Counter()
for w in W:
    try: g=shapely.wkb.loads(w['geometry'])
    except Exception: continue
    st=w.get('subtype')
    polys=list(g.geoms) if g.geom_type=='MultiPolygon' else ([g] if g.geom_type=='Polygon' else [])
    for p in polys:
        area_km2=p.area*111.32*111.32*math.cos(math.radians(52.2))
        if st in ('lake','reservoir') and area_km2<0.08: continue
        if st=='river' and area_km2<0.03: continue
        if not nlp.intersects(p) and st not in ('ocean','sea'): continue
        ps=p.simplify(0.00006, preserve_topology=True)
        if ps.is_empty: continue
        pp=list(ps.geoms) if ps.geom_type=='MultiPolygon' else [ps]
        for q in pp:
            rings=[enc([(round(x,6),round(y,6)) for x,y in q.exterior.coords])]+[enc([(round(x,6),round(y,6)) for x,y in r.coords]) for r in q.interiors if len(r.coords)>8]
            out.append([ 'o' if st in ('ocean','sea') else 'r' if st=='river' else 'l', rings]); cnt[st]+=1
sw=json.dumps(out,separators=(',',':')); open(OUT+'water.json','w').write(sw)
print('water.json',len(sw)//1024,'kB',dict(cnt),round(time.time()-t0,1),'s',flush=True)
