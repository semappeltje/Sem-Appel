// Echte foto's voor de demo, van Wikimedia Commons (vrije licenties), gebundeld in de app.
//
//   node tools/fotos.mjs zoek [groep] [cachemap]   kandidaten zoeken, downloaden, contactvellen maken
//   node tools/fotos.mjs bouw [cachemap]           de keuze (SELECTIE) downloaden, naar WebP, manifest + BRONNEN.md
//
// Nodig: Node 22 (fetch; achter een proxy NODE_USE_ENV_PROXY=1) en Python 3 met Pillow (pip install pillow).
// Commons is streng met het aantal verzoeken: het script wacht tussen verzoeken en volgt Retry-After.
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HIER = dirname(fileURLToPath(import.meta.url));
const DEMO = join(HIER, '..');
const UIT = join(DEMO, 'src', 'assets', 'fotos');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'BreedijkSchadeportaalDemo/1.0 (demo; contact info@safetail.nl)';
const LICENTIES = ['CC0', 'Public domain', 'CC BY 2.0', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 2.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0'];
const BREEDTE = { auto: 640, schade: 560, overzicht: 640 };
const MAX_BYTES = 55 * 1024;

// ---------- zoekopdrachten (fase "zoek") ----------
export const ZOEK = {
  auto: [
    ['volkswagen-polo', 'Volkswagen', 'Polo', ['Volkswagen Polo VI', 'VW Polo AW']],
    ['volkswagen-golf', 'Volkswagen', 'Golf', ['Volkswagen Golf VIII', 'VW Golf 8']],
    ['volkswagen-id3', 'Volkswagen', 'ID.3', ['Volkswagen ID.3']],
    ['toyota-yaris', 'Toyota', 'Yaris', ['Toyota Yaris XP210', 'Toyota Yaris 2020 hybrid']],
    ['toyota-corolla', 'Toyota', 'Corolla', ['Toyota Corolla E210 hatchback', 'Toyota Corolla Touring Sports E210']],
    ['kia-picanto', 'Kia', 'Picanto', ['Kia Picanto JA']],
    ['peugeot-208', 'Peugeot', '208', ['Peugeot 208 II', 'Peugeot e-208']],
    ['peugeot-2008', 'Peugeot', '2008', ['Peugeot 2008 II', 'Peugeot e-2008']],
    ['renault-clio', 'Renault', 'Clio', ['Renault Clio V']],
    ['opel-corsa', 'Opel', 'Corsa', ['Opel Corsa F', 'Opel Corsa-e']],
    ['ford-focus', 'Ford', 'Focus', ['Ford Focus IV', 'Ford Focus 2018']],
    ['ford-transit-custom', 'Ford', 'Transit Custom', ['Ford Transit Custom']],
    ['volkswagen-transporter', 'Volkswagen', 'Transporter', ['Volkswagen Transporter T6', 'VW T6 Transporter']],
    ['mercedes-benz-vito', 'Mercedes-Benz', 'Vito', ['Mercedes-Benz Vito W447']],
    ['tesla-model-3', 'Tesla', 'Model 3', ['Tesla Model 3']],
    ['tesla-model-y', 'Tesla', 'Model Y', ['Tesla Model Y']],
    ['hyundai-kona', 'Hyundai', 'Kona', ['Hyundai Kona', 'Hyundai Kona Electric']],
    ['skoda-octavia', 'Skoda', 'Octavia', ['Skoda Octavia IV', 'Škoda Octavia IV']],
    ['bmw-3-serie', 'BMW', '3-serie', ['BMW G20', 'BMW 3 Series G20']],
    ['audi-a3', 'Audi', 'A3', ['Audi A3 8Y', 'Audi A3 Sportback 8Y']],
    ['volvo-xc40', 'Volvo', 'XC40', ['Volvo XC40']],
    ['mercedes-benz-a-klasse', 'Mercedes-Benz', 'A-klasse', ['Mercedes-Benz W177', 'Mercedes-Benz A-Class W177']],
    ['fiat-500', 'Fiat', '500', ['Fiat 500 2016', 'Fiat 500 hybrid', 'Fiat 500e 2020']],
    ['mini-cooper', 'Mini', 'Cooper', ['Mini F56', 'Mini Cooper F56']],
    ['nissan-qashqai', 'Nissan', 'Qashqai', ['Nissan Qashqai J12', 'Nissan Qashqai 2021']],
    ['lynk-co-01', 'Lynk & Co', '01', ['Lynk & Co 01']],
    ['polestar-2', 'Polestar', '2', ['Polestar 2']],
    ['renault-kangoo', 'Renault', 'Kangoo', ['Renault Kangoo III', 'Renault Kangoo 2021']],
    ['citroen-c3', 'Citroën', 'C3', ['Citroën C3 III', 'Citroen C3 2017']],
  ].map(([slug, merk, model, q]) => ({ id: slug, merk, model, q: [...q, `${merk} ${model} 2021`, `${merk} ${model} 2019`] })),
  // intitle: zoekt in de bestandsnaam; de volle tekst van Commons levert hier vooral gewone autofoto's op
  schade: [
    ['bumper', ['intitle:bumper intitle:damage', 'intitle:bumper intitle:scratch']],
    ['deuk', ['intitle:dent intitle:car', 'intitle:dented']],
    ['velg', ['intitle:curb intitle:rash', 'intitle:damaged intitle:rim']],
    ['ruit', ['intitle:windshield intitle:crack', 'intitle:windscreen intitle:chip']],
    ['spiegel', ['intitle:broken intitle:mirror car']],
    ['lak', ['intitle:car intitle:scratch', 'intitle:peeling intitle:paint car']],
    ['overig', ['intitle:car intitle:damage close', 'intitle:cracked intitle:bumper']],
  ].map(([id, q]) => ({ id, q })),
  overzicht: [
    ['hoek', ['car front corner', 'car headlight close up', 'car rear corner taillight', 'car side profile parked']],
  ].map(([id, q]) => ({ id, q })),
};

// ---------- de keuze (fase "bouw"), na het bekijken van de contactvellen ----------
// auto: [slug, merk, model, kleur, Commons-bestand, kentekenLeesbaar]
// schade: [Commons-bestand, gebied, soort, ernst, omschrijving]
// overzicht: [Commons-bestand, zijde]
export const SELECTIE = {
  auto: [
    ['volkswagen-polo', 'Volkswagen', 'Polo', 'rood', 'File:2018 Volkswagen Polo SE 1.0 Front.jpg', false],
    ['volkswagen-golf', 'Volkswagen', 'Golf', 'zilver', 'File:2020 Volkswagen Golf Style 1.5 Front.jpg', true],
    ['volkswagen-id3', 'Volkswagen', 'ID.3', 'wit', 'File:2020 Volkswagen ID.3 1st Front.jpg', false],
    ['toyota-yaris', 'Toyota', 'Yaris', 'wit', 'File:Toyota Yaris Hybrid (XP210) 1X7A0354.jpg', false],
    ['toyota-corolla', 'Toyota', 'Corolla', 'zilver', 'File:Toyota Corolla Hybrid no lago das Pontes de García Rodríguez eue-001.jpg', false],
    ['kia-picanto', 'Kia', 'Picanto', 'grijs', 'File:2017 Kia Picanto GT-Line S 1.2 Front.jpg', false],
  ],
  schade: [
    ['File:Jetta Mk. IV Bumper Damage.jpg', 'bumper_voor', 'barst', 3, 'De voorbumper is bij de hoek losgeduwd en gescheurd langs het spatbord, en met tape vastgezet.'],
  ],
  overzicht: [],
};

// ---------- netwerk ----------
const slaap = ms => new Promise(r => setTimeout(r, ms));
const laatste = {};
const TMP = join(tmpdir(), `bs-fotos-${process.pid}.tmp`);
async function haal(url, soort = 'json') {
  const host = new URL(url).host; const tussen = Number(process.env.FOTOS_TUSSEN_MS) || 10000; // hoogstens een verzoek per 10 s per host
  for (let poging = 0; poging < 20; poging++) {
    const wacht = tussen - (Date.now() - (laatste[host] || 0)); if (wacht > 0) await slaap(wacht);
    laatste[host] = Date.now();
    // curl in plaats van fetch: volgt HTTPS_PROXY overal en geeft de kopregels terug
    let uit;
    try { uit = execFileSync('curl', ['-sS', '-m', '60', '-A', UA, '-D', '-', '-o', TMP, url], { encoding: 'utf8', maxBuffer: 1 << 20 }); }
    catch (e) { console.warn(`  netwerkfout, poging ${poging + 1}: ${String(e.message).slice(0, 120)}`); await slaap(3000 * (poging + 1)); continue; }
    const blokken = uit.trim().split(/\r?\n\r?\n/); const kop = blokken[blokken.length - 1];
    const status = Number((kop.match(/^HTTP\/[\d.]+ (\d+)/) || [])[1]);
    if (status === 429 || status >= 500 || !status) {
      const ra = Number((kop.match(/^retry-after:\s*(\d+)/im) || [])[1]) || 5;
      if (process.env.FOTOS_LOG || poging % 4 === 3) console.warn(`  ${status}, wacht ${ra}s, poging ${poging + 1}: ${host}`);
      await slaap((ra + 1 + Math.min(poging, 3) * 2) * 1000 + Math.random() * 2000); continue;
    }
    if (status >= 400) throw new Error(`${status} ${url}`);
    const buf = readFileSync(TMP);
    if (soort === 'json') { try { return JSON.parse(buf.toString('utf8')); } catch { await slaap(8000); continue; } }
    return buf;
  }
  throw new Error(`te vaak geweigerd: ${url}`);
}
const params = o => API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...o });
const II = { prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '900', iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ObjectName|ImageDescription' };

const zonderHtml = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
function info(pagina) {
  const ii = pagina.imageinfo?.[0]; if (!ii) return null;
  const m = ii.extmetadata || {};
  const licentie = zonderHtml(m.LicenseShortName?.value);
  return {
    titel: pagina.title, bron: ii.descriptionurl, thumb: thumbUrl(ii), breedte: ii.width, hoogte: ii.height, mime: ii.mime,
    licentie, licentieUrl: zonderHtml(m.LicenseUrl?.value) || (licentie === 'CC0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : licentie.startsWith('Public') ? 'https://commons.wikimedia.org/wiki/Commons:Public_domain' : ''),
    maker: zonderHtml(m.Artist?.value) || 'onbekend', omschrijving: zonderHtml(m.ImageDescription?.value).slice(0, 160),
  };
}
// de API geeft thumb.wikimedia.org (niet bereikbaar achter elke proxy); hetzelfde bestand staat op upload.wikimedia.org
function thumbUrl(ii) {
  const u = String(ii.thumburl || ii.url || '').split('?')[0];
  return u.replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/');
}
// titels die zelden een bruikbare overzichtsfoto zijn
const AUTO_WEG = /interior|innenraum|interieur|cockpit|dashboard|engine|motor(raum)?\b|badge|logo|emblem|wheel|felge|detail|steering|seat|boot|trunk|kofferraum|heck|rear|back|tail|model ?car|\btoys?\b|diecast|police|polizei|taxi|rally|race|racing|tuning|crash|wreck|unfall|sketch|drawing|IAA|salon|motor ?show|autosalon|geneva|genf|paris|frankfurt|messe|expo|ambulance|feuerwehr|camper/i;
const bruikbaar = f => f && LICENTIES.includes(f.licentie) && /jpeg|png|webp/.test(f.mime) && f.breedte >= 700 && f.thumb;

// ---------- Python/Pillow ----------
function py(code, ...args) { return execFileSync('python3', ['-I', '-c', code, ...args], { encoding: 'utf8' }); }
const PY_WEBP = `
import sys
from PIL import Image, ImageOps
src, dst, w, maxb = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
h = round(im.height * w / im.width)
im = im.resize((w, h), Image.LANCZOS)
for q in (80, 75, 70, 65, 60, 55, 50, 45, 40):
    im.save(dst, 'WEBP', quality=q, method=6)
    import os
    if os.path.getsize(dst) <= maxb: break
print(q, os.path.getsize(dst), w, h)
`;
const PY_VEL = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(open(sys.argv[1]).read()); dst = sys.argv[2]
cw, ch, kol = 300, 210, 4
rows = (len(items) + kol - 1) // kol
vel = Image.new('RGB', (cw * kol, ch * rows), 'white'); d = ImageDraw.Draw(vel)
for i, (pad, label) in enumerate(items):
    try:
        im = Image.open(pad).convert('RGB'); im.thumbnail((cw - 6, ch - 22))
        x, y = (i % kol) * cw, (i // kol) * ch
        vel.paste(im, (x + 3, y + 3)); d.text((x + 4, y + ch - 18), label[:48], fill='black')
    except Exception as e: pass
vel.save(dst, quality=85)
`;

// ---------- fase zoek ----------
async function zoek(groepNaam, cache) {
  const groepen = groepNaam && groepNaam !== 'alles' ? [groepNaam] : Object.keys(ZOEK);
  mkdirSync(join(cache, 'img'), { recursive: true });
  const kpad = join(cache, 'kandidaten.json');
  const alle = existsSync(kpad) ? JSON.parse(readFileSync(kpad, 'utf8')) : {};
  for (const g of groepen) for (const item of ZOEK[g]) {
    const sleutel = `${g}/${item.id}`;
    if (alle[sleutel]?.length) { console.log('al gezocht', sleutel); continue; }
    const gezien = new Map();
    for (const q of item.q) {
      const r = await haal(params({ action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: `${q} filetype:bitmap`, gsrlimit: g === 'auto' ? '14' : '16', ...II }));
      for (const p of r.query?.pages || []) { const f = info(p); if (bruikbaar(f) && !gezien.has(f.titel)) gezien.set(f.titel, f); }
      if (g === 'auto' && [...gezien.values()].filter(f => !AUTO_WEG.test(f.titel)).length >= 7) break;
    }
    let lijst = [...gezien.values()];
    if (g === 'auto') lijst = lijst.filter(f => !AUTO_WEG.test(f.titel) && f.breedte > f.hoogte).slice(0, 4);
    else lijst = lijst.filter(f => !/diagram|drawing|logo|icon|map|crash test|accident scene|wreck|truck|bus|tram|train|bicycle|motorcycle/i.test(f.titel)).slice(0, 6);
    const vel = [];
    for (const [i, f] of lijst.entries()) {
      const pad = join(cache, 'img', veilig(f.titel));
      if (!existsSync(pad)) { try { writeFileSync(pad, await haal(f.thumb, 'bin')); } catch (e) { console.warn(e.message); continue; } }
      vel.push([pad, `${i} ${f.licentie} ${f.titel.slice(5, 40)}`]);
      f.index = i;
    }
    alle[sleutel] = lijst;
    writeFileSync(kpad, JSON.stringify(alle, null, 1));
    const vj = join(cache, 'vel.json'); writeFileSync(vj, JSON.stringify(vel));
    if (vel.length) { try { py(PY_VEL, vj, join(cache, `vel-${g}-${item.id}.jpg`)); } catch (e) { console.warn('  contactvel mislukt', item.id); } }
    console.log(sleutel, lijst.length, 'kandidaten');
  }
}
const veilig = t => t.replace(/^File:/, '').replace(/[^\w.-]+/g, '_').slice(0, 120);

// ---------- fase bouw ----------
async function bouw(cache) {
  mkdirSync(join(cache, 'img'), { recursive: true });
  const titels = [...SELECTIE.auto.map(a => a[4]), ...SELECTIE.schade.map(s => s[0]), ...SELECTIE.overzicht.map(o => o[0])];
  const meta = new Map();
  for (let i = 0; i < titels.length; i += 20) {
    const r = await haal(params({ action: 'query', titles: titels.slice(i, i + 20).join('|'), ...II }));
    const norm = new Map((r.query?.normalized || []).map(n => [n.to, n.from]));
    for (const p of r.query?.pages || []) { const f = info(p); if (f) { meta.set(p.title, f); if (norm.has(p.title)) meta.set(norm.get(p.title), f); } }
  }
  for (const map of ['auto', 'schade', 'overzicht']) { const d = join(UIT, map); if (existsSync(d)) for (const b of readdirSync(d)) if (b.endsWith('.webp')) rmSync(join(d, b)); mkdirSync(d, { recursive: true }); }
  const manifest = { auto: [], schade: [], overzicht: [] };
  async function maak(titel, map, naam) {
    const f = meta.get(titel);
    if (!bruikbaar(f)) throw new Error(`niet bruikbaar of licentie niet toegestaan: ${titel} (${f?.licentie})`);
    const bron = join(cache, 'img', veilig(f.titel));
    if (!existsSync(bron)) writeFileSync(bron, await haal(f.thumb, 'bin'));
    const doel = join(UIT, map, naam);
    py(PY_WEBP, bron, doel, String(BREEDTE[map]), String(MAX_BYTES));
    return { bestand: `${map}/${naam}`, bron: f.bron, titel: f.titel.replace(/^File:/, ''), maker: f.maker, licentie: f.licentie, licentieUrl: f.licentieUrl };
  }
  for (const [slug, merk, model, kleur, titel, kentekenLeesbaar] of SELECTIE.auto) {
    const r = await maak(titel, 'auto', `${slug}.webp`);
    manifest.auto.push({ slug, merk, model, kleur, bestand: r.bestand, bron: r.bron, titel: r.titel, maker: r.maker, licentie: r.licentie, licentieUrl: r.licentieUrl, kentekenLeesbaar });
  }
  for (const [i, [titel, gebied, soort, ernst, omschrijving]] of SELECTIE.schade.entries()) {
    const r = await maak(titel, 'schade', `${String(i + 1).padStart(2, '0')}-${gebied}-${soort}.webp`);
    manifest.schade.push({ bestand: r.bestand, gebied, soort, ernst, omschrijving, bron: r.bron, titel: r.titel, maker: r.maker, licentie: r.licentie, licentieUrl: r.licentieUrl });
  }
  for (const [i, [titel, zijde]] of SELECTIE.overzicht.entries()) {
    const r = await maak(titel, 'overzicht', `${String(i + 1).padStart(2, '0')}.webp`);
    manifest.overzicht.push({ bestand: r.bestand, zijde, bron: r.bron, titel: r.titel, maker: r.maker, licentie: r.licentie, licentieUrl: r.licentieUrl });
  }
  writeFileSync(join(UIT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(UIT, 'BRONNEN.md'), bronnen(manifest));
  let totaal = 0;
  for (const map of ['auto', 'schade', 'overzicht']) for (const b of readdirSync(join(UIT, map))) totaal += statSync(join(UIT, map, b)).size;
  console.log(`auto ${manifest.auto.length}, schade ${manifest.schade.length}, overzicht ${manifest.overzicht.length}, samen ${(totaal / 1024).toFixed(0)} kB`);
}

function nogTeZoeken(m) {
  const er = new Set(m.auto.map(a => a.slug));
  const auto = ZOEK.auto.filter(a => !er.has(a.id)).map(a => `${a.merk} ${a.model}`);
  const regels = [];
  if (auto.length) regels.push(`- Voertuigen (${auto.length}): ${auto.join(', ')}.`);
  if (m.schade.length < 14) regels.push(`- Schades: ${m.schade.length} van minstens 14 (kras, schaafplek, deuk, stoeprand op een velg, steenslag of barst in een ruit, spiegel, lakschade, achterklep, dorpel, motorkap).`);
  if (m.overzicht.length < 4) regels.push(`- Overzichten bij ophalen: ${m.overzicht.length} van 4 tot 8 (voorhoek, achterhoek, zijkant, zonder schade).`);
  regels.push('', 'Zoeken: \`node tools/fotos.mjs zoek <auto|schade|overzicht> <cachemap>\`, de contactvellen bekijken, de keuze in \`SELECTIE\` zetten en \`node tools/fotos.mjs bouw <cachemap>\` draaien. Commons laat vanaf een gedeeld adres weinig verzoeken per minuut toe; het script wacht en volgt Retry-After.');
  return regels.join('\n');
}
const cel = s => String(s).replace(/\|/g, '\\|');
function bronnen(m) {
  const regel = r => `| \`${r.bestand}\` | ${cel(r.titel)} | ${cel(r.maker)} | [${r.licentie}](${r.licentieUrl}) | [Commons](${r.bron}) |`;
  const kop = '| Bestand | Titel op Commons | Maker | Licentie | Link |\n| --- | --- | --- | --- | --- |';
  return `# Bronnen van de foto's

De foto's in deze map komen van Wikimedia Commons en zijn gebundeld in de demo als voorbeeld: geen foto toont een echte schade uit een dossier, en de koppeling aan een dossier, kenteken of chauffeur is gesimuleerd. Elke foto staat onder een vrije licentie (CC0, publiek domein, CC BY of CC BY-SA); de maker en de licentie staan in de app bij de foto en in dit bestand, en de CC BY-SA-foto's krijgen die naamsvermelding ook, met een link naar de licentie.

Verkleind naar WebP (voertuigen en overzichten 640 px, schades 560 px breed) door \`tools/fotos.mjs\`; verder niet bewerkt.

## Voertuigen (\`auto/\`)

${m.auto.length ? kop + '\n' + m.auto.map(regel).join('\n') : 'Nog geen; zie "Nog te zoeken".'}

## Schades (\`schade/\`)

${m.schade.length ? kop + '\n' + m.schade.map(regel).join('\n') : 'Nog geen; zie "Nog te zoeken".'}

## Overzichten bij ophalen (\`overzicht/\`)

${m.overzicht.length ? kop + '\n' + m.overzicht.map(regel).join('\n') : 'Nog geen; zie "Nog te zoeken".'}

## Nog te zoeken

${nogTeZoeken(m)}
`;
}

const [fase, a, b] = process.argv.slice(2);
if (fase === 'zoek') await zoek(a, b || join(tmpdir(), 'bs-fotos'));
else if (fase === 'bouw') await bouw(a || join(tmpdir(), 'bs-fotos'));
else console.log('gebruik: node tools/fotos.mjs zoek [auto|schade|overzicht|alles] [cache] | bouw [cache]');
