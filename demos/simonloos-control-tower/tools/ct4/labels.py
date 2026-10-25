# Wegnummers en straatnamen voor de kaart (verzoek kaart-agent): per lijn van de routeergraaf (snelweg, autoweg, N-weg) en
# van roads_display (secundair, tertiair) het wegnummer (ref) en de straatnaam (n), uit Overture segments (release
# 2026-10-21.0, dezelfde invoer als de graaf). Bestaande velden van roads_display.json blijven ongewijzigd; erbij komt
#   "lab": { "s": [tekst, ...], "g": [[kant, ref, n], ...], "sec": [[lijn, ref, n], ...], "ter": [[lijn, ref, n], ...] }
# met ref en n als index in lab.s (-1 = geen). Alleen lijnen van minstens 300 m; geen labels op afritten; namen alleen
# bij N-wegen (primary), secundaire wegen en tertiaire wegen in bebouwd gebied; een waarde moet minstens de helft van de lijn dekken.
import sys, json, re, pickle, collections
import shapely
from shapely.geometry import Polygon, Point
from shapely.prepared import prep
pk, accpk, graphjson, dispjson, urbanjson, out = sys.argv[1:7]
G = pickle.load(open(pk, 'rb')); A = pickle.load(open(accpk, 'rb'))
meta = G['meta']; parent = A['parent']; e0 = A['e0']
graph = json.load(open(graphjson)); disp = json.load(open(dispjson))
urban = prep(shapely.union_all([Polygon(r) for r in json.load(open(urbanjson)) if len(r) >= 4]).buffer(0.002))
PRIO = {'NL:A': 0, 'BAB': 1, 'BE:A-road': 1, 'NL:N': 2, 'BE:N-road': 3, 'BE:R-road': 3, 'DE:national': 3, 'NL:S': 4}
def prio(net):
    if not net: return 8
    for k, v in PRIO.items():
        if net.startswith(k): return v
    return 9
REFOK = re.compile(r'^(A|N|S|R|B) ?\d{1,3}[a-z]?$')
def seg_ref(m):
    best = None
    for ref, net, name in m['routes']:
        if not ref or not REFOK.match(ref) or (net and net.startswith('e-road')): continue
        p = prio(net)
        if best is None or p < best[0]: best = (p, ref)
    if best: return best[1]
    nm = m['names'] or ''
    if m['class'] in ('motorway', 'trunk', 'primary'):
        mm = re.search(r'\b([AN]\d{1,3})\b', nm)
        if mm: return mm.group(1)
    return None
BAD = re.compile(r'^(rijksweg|provincialeweg)\b|^[AN] ?\d{1,3}$|^(A|N)\d+\s*-|^ring$', re.I)
def seg_name(m):
    nm = (m['names'] or '').strip()
    if not nm or BAD.search(nm): return None
    return nm
def pick(segs, fn):
    tot = sum(l for _, l in segs) or 1e-9; c = collections.Counter()
    for si, l in segs:
        v = fn(meta[si])
        if v: c[v] += l
    if not c: return None
    v, l = c.most_common(1)[0]
    return v if l >= 0.5 * tot else None
S = []; SI = {}
def sid(v):
    if v is None: return -1
    if v not in SI: SI[v] = len(S); S.append(v)
    return SI[v]
# graafkanten: originele kanten 0..e0-1 (deels ingekort door splitsen), daarna de nieuwe delen (ouder in parent)
lab_g = []; cnt = collections.Counter()
GE = G['G']
glab = {}
for i, (a, b, kmL, cls, link, segs) in enumerate(GE):
    if link: continue
    ref = pick(segs, seg_ref); n = pick(segs, seg_name) if cls == 2 else None
    if ref or n: glab[i] = (ref, n)
E = graph['edges']
for i, e in enumerate(E):
    src = parent.get(i, i) if i >= e0 else i
    if src not in glab or e[2] < 300: continue
    ref, n = glab[src]
    lab_g.append([i, sid(ref), sid(n)]); cnt['g_ref'] += bool(ref); cnt['g_n'] += bool(n)
# weergavelijnen
lab = {}
for key, cls in (('sec', 3), ('ter', 4)):
    L = []
    for i, (segs, kmL, geom) in enumerate(G['disp'][cls]):
        if kmL < 0.3: continue
        ref = pick(segs, seg_ref)
        n = pick(segs, seg_name)
        if cls == 4 and n:
            mid = geom[len(geom) // 2]
            if not urban.contains(Point(mid)): n = None
        if ref or n:
            L.append([i, sid(ref), sid(n)]); cnt[key + '_ref'] += bool(ref); cnt[key + '_n'] += bool(n)
    lab[key] = L
assert len(G['disp'][3]) == len(disp['sec']) and len(G['disp'][4]) == len(disp['ter'])
disp['lab'] = {'s': S, 'g': lab_g, 'sec': lab['sec'], 'ter': lab['ter']}
txt = json.dumps(disp, ensure_ascii=False, separators=(',', ':'))
open(out, 'w').write(txt)
print('lijnen met label: graaf', len(lab_g), 'van', len(E), '| sec', len(lab['sec']), 'van', len(disp['sec']), '| ter', len(lab['ter']), 'van', len(disp['ter']))
print(dict(cnt), 'teksten', len(S), '| roads_display.json', len(txt.encode()) // 1024, 'kB')
