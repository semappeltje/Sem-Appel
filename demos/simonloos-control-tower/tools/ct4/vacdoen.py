# per vacature: kop (standplaats en klant) en de alinea "Dit ga je doen" / "Wat ga je doen"
import sys, re, html, glob, os
src = sys.argv[1]
out = []
for f in sorted(glob.glob(os.path.join(src, 'pages', '*.html'))):
    t = open(f, encoding='utf-8', errors='ignore').read()
    t = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', t, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = html.unescape(re.sub(r'\s+', ' ', t))
    head = re.search(r'Solliciteer op deze vacature (.{0,80}?) (CE|C|B|BE|Chauffeur|Planner|Logistiek|Kantoor|Techniek|Overig)', t)
    m = re.search(r'(Dit ga je doen|Wat ga je doen\??|Wat ga je doen)(.{0,900})', t)
    out.append((os.path.basename(f)[:-5], head.group(1) if head else '?', (m.group(2) if m else '').split(' Dit neem je mee')[0].split(' Wat neem je mee')[0][:700]))
for n, h, d in out:
    print('##', n, '|', h)
    print('  ', d.replace("event.target.parentNode.classList.toggle('open'))()\">", ''))
