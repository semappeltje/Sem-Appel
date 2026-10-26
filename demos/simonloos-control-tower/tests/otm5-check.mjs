// Controle van de OTM5-vertaling (src/otm5.js) tegen de gesimuleerde dag en tegen de officiële OTM5-specificatie.
//
//   node tests/otm5-check.mjs                       alle controles (een halve tot anderhalve minuut)
//   node tests/otm5-check.mjs --schrijf-voorbeeld   schrijft ook tests/otm5/voorbeeld-simonloos.json (één voertuig, één dag)
//   node tests/otm5-check.mjs --bestand pad.json    valideert en leest een echt OTM5-bestand (bijvoorbeeld een export van AH)
//
// Wat er gecontroleerd wordt:
//  1. src/otm5.js is puur (geen imports) en zit niet in de app-bundel; UUID v5 en de tijdomrekening kloppen (ook rond zomertijd).
//  2. De validator: het schema komt uit de vastgezette kopie van de officiële specificatie (tests/otm5/otm-api-v5.9.yaml,
//     OTM 5.9.0 van 2 oktober 2026); de OpenAPI-discriminator wordt omgezet naar if/then zoals OpenAPI hem bedoelt. Een
//     officieel voorbeeld valideert (positieve controle), een kapotte trip niet (negatieve controle).
//  3. Onze vorm (uitFleet) klopt met de app zelf: dezelfde stops, tijden, vensters, wachttijden en docks als fleet.blocks()
//     en dezelfde gebeurtenissen als fleet.eventsOf(); elk ritsegment hoort ergens bij.
//  4. naarOtm5: elke entiteit in de bundel valideert tegen OTM 5.9; elke verwijzing wijst naar een entiteit in de bundel;
//     twee keer maken geeft hetzelfde bestand; geen naam van een chauffeur in het bestand.
//  5. Rondreis: vanOtm5(naarOtm5(dag)) geeft dezelfde ritten, stops, vensters, voertuigen, opleggers, diensten, open ritten,
//     gebeurtenissen en posities als uitFleet(dag).
//  6. De voorbeelden uit de OTM-documentatie (tests/otm5/voorbeelden/) en de voorbeelden in de specificatie zelf lezen in
//     zonder fouten.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(app, 'package.json'));
const YAML = require('yaml');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default || require('ajv-formats');
const otm = await import(pathToFileURL(path.join(app, 'src', 'otm5.js')).href);
const { uitFleet, naarOtm5, vanOtm5, uuid5, isoTijd, minutenVan, NS, OTM_VERSIE } = otm;

const args = process.argv.slice(2);
const bestand = args.includes('--bestand') ? args[args.indexOf('--bestand') + 1] : null;
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FOUT'} ${msg}`); if (!ok) fail++; return ok; };
const DATUM = '2026-10-26', T = 600;

// ---------- 2. de validator uit de officiële specificatie ----------
const specTekst = readFileSync(path.join(app, 'tests', 'otm5', 'otm-api-v5.9.yaml'), 'utf8');
const spec = YAML.parse(specTekst);
const fixRef = r => r.replace('#/components/schemas/', '#/$defs/');
function omzetten(node) {
  if (Array.isArray(node)) return node.map(omzetten);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'example' || k === 'examples' || k === 'discriminator' || k === 'xml' || k === 'externalDocs') continue;
    out[k] = k === '$ref' && typeof v === 'string' ? fixRef(v) : omzetten(v);
  }
  // OpenAPI-discriminator: de waarde van het veld kiest het schema (if/then), in plaats van "precies één van" (oneOf). Zonder
  // die omzetting valt een actor met type 'person' af, omdat hij ook aan het basisschema voldoet.
  const d = node.discriminator, sleutel = out.oneOf ? 'oneOf' : out.anyOf ? 'anyOf' : null;
  if (d && sleutel) {
    const alts = out[sleutel], p = d.propertyName;
    const map = d.mapping ? Object.entries(d.mapping).map(([val, r]) => [val, fixRef(r)]) : alts.filter(a => a.$ref).map(a => [a.$ref.split('/').pop(), a.$ref]);
    const gemapt = new Set(map.map(m => m[1])); const rest = alts.filter(a => !(a.$ref && gemapt.has(a.$ref)));
    let keten = rest.length === 0 ? { [sleutel]: alts } : rest.length === 1 ? rest[0] : { [sleutel]: rest };
    for (const [val, r] of map.slice().reverse()) keten = { if: { properties: { [p]: { const: val } }, required: [p] }, then: { $ref: r }, else: keten };
    delete out[sleutel]; out.allOf = [...(out.allOf || []), keten];
  }
  return out;
}
const ajv = new Ajv2020({ strict: false, allErrors: false });
addFormats(ajv); ajv.addFormat('recurrence', true);
ajv.addSchema({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'otm5', $defs: omzetten(spec.components.schemas) });
const V = {}; for (const s of ['trip', 'vehicle', 'actor', 'location', 'goods', 'consignment', 'event', 'transportEquipment', 'locationUpdateEvent']) V[s] = ajv.compile({ $ref: `otm5#/$defs/${s}` });
const fouttekst = v => (v.errors || []).slice(0, 3).map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
const SOORT = { trips: 'trip', vehicles: 'vehicle', actors: 'actor', locations: 'location', transportEquipment: 'goods', consignments: 'consignment', events: 'event' };
function valideerBundel(doc, label) {
  let n = 0; const fout = [];
  for (const [lijst, schema] of Object.entries(SOORT)) for (const e of doc[lijst] || []) { n++; if (!V[schema](e) && fout.length < 5) fout.push(`${lijst} ${e.name || e.id}: ${fouttekst(V[schema])}`); }
  return { n, fout };
}
const soortVan = e => e.eventType ? 'event' : e.entityType === 'goods' || e.type === 'transportEquipment' || e.type === 'items' ? 'goods' : e.entityType || (Array.isArray(e.actions) ? 'trip' : null);

// ---------- --bestand: een echt OTM5-bestand valideren en inlezen ----------
if (bestand) {
  const doc = JSON.parse(readFileSync(bestand, 'utf8'));
  const lijst = Array.isArray(doc) ? doc : doc.trips || doc.events || doc.vehicles ? Object.keys(SOORT).flatMap(k => doc[k] || []) : [doc];
  let ok = 0; for (const e of lijst) { const s = soortVan(e); if (!s || !V[s]) { console.log(`?    entiteit zonder herkenbare soort (${e.id || '?'})`); continue; } if (V[s](e)) ok++; else console.log(`FOUT ${s} ${e.id || e.name || ''}: ${fouttekst(V[s])}`); }
  console.log(`${ok} van ${lijst.length} entiteiten geldig tegen OTM ${OTM_VERSIE}`);
  const v = vanOtm5(doc);
  console.log(`ingelezen: ${v.ritten.length} ritten (${v.ritten.reduce((a, r) => a + r.stops.length, 0)} stops), ${v.open.length} open ritten, ${v.voertuigen.length} voertuigen, ${v.opleggers.length} opleggers, ${v.plekken.length} plekken, ${v.events.length} gebeurtenissen, ${v.posities.length} posities; datum ${v.datum}`);
  for (const w of v.waarschuwingen.slice(0, 10)) console.log(`let op: ${w}`);
  process.exit(ok === lijst.length ? 0 : 1);
}

// ---------- 1. puur, buiten de bundel, UUID en tijd ----------
const src = readFileSync(path.join(app, 'src', 'otm5.js'), 'utf8');
check(!/^\s*import\s/m.test(src) && !/\brequire\(/.test(src) && !/\bdocument\.|\bwindow\./.test(src), 'src/otm5.js is puur: geen imports, geen DOM');
// 4.1: de ritopdracht naar de boordcomputer (src/ui/ritopdracht.js) maakt zijn OTM5 met dit bestand; dat is het enige
// app-bestand dat het importeert. Het inlezen (vanOtm5) hoort niet in de bundel: de bundel neemt alleen mee wat gebruikt
// wordt, dus de teksten die alleen vanOtm5 kent, staan niet in dist/index.html.
const { readdirSync } = await import('node:fs');
const jsVan = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? jsVan(path.join(d, e.name)) : /\.js$/.test(e.name) ? [path.join(d, e.name)] : []);
const importeurs = jsVan(path.join(app, 'src')).filter(f => !/otm5\.js$/.test(f) && /from\s+['"][./]+otm5(\.js)?['"]/.test(readFileSync(f, 'utf8'))).map(f => path.relative(path.join(app, 'src'), f));
check(importeurs.length === 1 && importeurs[0] === path.join('ui', 'ritopdracht.js'), `alleen src/ui/ritopdracht.js importeert src/otm5.js (${importeurs.join(', ') || 'geen'})`);
const bundelPad = path.join(app, 'dist', 'index.html');
if (existsSync(bundelPad)) { const b = readFileSync(bundelPad, 'utf8'); check(!b.includes('document zonder herkenbare OTM5-entiteit') && !b.includes('onbekende entiteit overgeslagen') && b.includes('simonloos:ritnummer'), 'de bundel heeft de ritopdracht, maar niet het inlezen van OTM5 (vanOtm5 blijft eruit)'); }
else console.log('--   dist/index.html ontbreekt: de controle op de bundel slaat over (eerst npm run build)');
check(uuid5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8') === '886313e1-3b8a-5372-9b90-0c9aee199e5d', `UUID v5 volgens RFC 4122 (bekende testwaarde; naamruimte Simon Loos ${NS})`);
const tijden = [[DATUM, 0], [DATUM, 367.25], [DATUM, -195], [DATUM, 1500.5], ['2026-10-25', 90], ['2026-10-25', 150], ['2026-10-25', 200], ['2026-03-29', 60], ['2026-03-29', 200], ['2026-07-01', 720]];
const tijdFout = tijden.filter(([d, m]) => Math.abs(minutenVan(isoTijd(d, m), d) - m) > 1e-6);
check(!tijdFout.length, `tijd heen en terug, ook op de dagen van de zomertijdwissel (${isoTijd('2026-10-25', 150)}, ${isoTijd('2026-10-25', 200)}, ${isoTijd(DATUM, 367.25)})${tijdFout.length ? ': ' + JSON.stringify(tijdFout) : ''}`);
check(minutenVan('2021-03-25T10:00:00Z', '2021-03-25') === 660 && minutenVan('2026-07-01T10:00:00Z', '2026-07-01') === 720, 'UTC-tijden (Z) worden Amsterdamse kloktijd: 10:00Z is 11:00 in maart, 12:00 in juli');

// ---------- 2 (vervolg). positieve en negatieve controle van de validator ----------
const voorbeeldDir = path.join(app, 'tests', 'otm5', 'voorbeelden');
const voorbeelden = ['trip_with_actions', 'trip_with_consignor_consignee', 'trip_with_realization_data', 'trip_with_vehicle'].map(n => ({ n, doc: JSON.parse(readFileSync(path.join(voorbeeldDir, n + '.json'), 'utf8')) }));
const geldig = voorbeelden.map(({ n, doc }) => ({ n, ok: V.trip(doc), fout: V.trip(doc) ? '' : fouttekst(V.trip) }));
for (const g of geldig) console.log(`     voorbeeld ${g.n}: ${g.ok ? 'geldig' : 'ongeldig (' + g.fout + ')'}`);
check(geldig.find(g => g.n === 'trip_with_actions').ok, 'positieve controle: het officiële voorbeeld trip_with_actions valideert tegen 5.9');
const kapot = JSON.parse(JSON.stringify(voorbeelden[0].doc)); kapot.actions[0].entity.location = { associationType: 'reference', entityType: 'location' };
const kapot2 = JSON.parse(JSON.stringify(voorbeelden[0].doc)); kapot2.actions[1].entity.constraint.entity.value.startTime = 'morgen om tien';
const kapot3 = { ...JSON.parse(JSON.stringify(voorbeelden[0].doc)), status: 'onderweg' };
check(!V.trip(kapot) && !V.trip(kapot2) && !V.trip(kapot3), 'negatieve controle: een trip met een verwijzing zonder uuid, een venster zonder geldige tijd of een onbekende status valideert niet');
const kapot4 = JSON.parse(JSON.stringify(voorbeelden[0].doc)); kapot4.actions[0].entity.actionType = 'stopp';
const kapot5 = { ...JSON.parse(JSON.stringify(voorbeelden[0].doc)), externalAttributes: { klant: 'AH' } };
const kapot6 = { eventType: 'startMovingEvent', creationDate: '2026-10-26T10:00:00+01:00', lifecycle: 'actual' };
check(!V.trip(kapot4) && !V.trip(kapot5) && !V.event(kapot6) && V.trip({ ...voorbeelden[0].doc, externalAttributes: { simonloos: { klant: 'AH' } } }),
  'negatieve controle: een onbekende actie, een externalAttribute met een tekst als waarde (in 5.9 moet dat een object zijn) en een bewegingsevent zonder positie vallen af');
const persoon = { entityType: 'actor', id: 'x', type: 'person', firstName: 'A' }, bedrijf = { entityType: 'actor', id: 'y', type: 'company', coc: '123' };
check(V.actor(persoon) && V.actor(bedrijf) && !V.actor({ ...persoon, firstName: 12 }), 'discriminator: een persoon en een bedrijf zijn geldige actoren; een persoon met een getal als voornaam niet');
const specVoorbeelden = ['trip', 'vehicle', 'location', 'consignment', 'locationUpdateEvent', 'stop', 'load', 'actor-person', 'transportEquipment'].filter(n => spec.components.schemas[n] && spec.components.schemas[n].example).map(n => [n, spec.components.schemas[n].example]);

// ---------- 3. de gesimuleerde dag in Node (Vite laadt de JSON-data) ----------
const { createServer } = await import(require.resolve('vite'));
const t0 = Date.now();
const server = await createServer({ root: app, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
const { createFleet } = await server.ssrLoadModule('/src/fleet.js');
const { createPeople } = await server.ssrLoadModule('/src/people.js');
const fleet = createFleet(); const people = createPeople(fleet);
await server.close();
console.log(`     vloot ${fleet.trucks.length} voertuigen, ${fleet.trailers.length} opleggers, ${people.persons.length} chauffeurs (${Date.now() - t0} ms)`);

const t1 = Date.now();
const ons = uitFleet(fleet, T, { datum: DATUM });
const nStops = ons.ritten.reduce((a, r) => a + r.stops.length, 0);
console.log(`     onze vorm om 10:00: ${ons.ritten.length} ritten, ${nStops} stops, ${ons.diensten.length} diensten, ${ons.blokken.length} losse blokken, ${ons.open.length} open ritten, ${ons.events.length} gebeurtenissen, ${ons.plekken.length} plekken (${Date.now() - t1} ms)`);
check(ons.ritten.length === fleet.trucks.reduce((a, t) => a + (t.routes || []).length, 0), `elke rit van de dag staat in onze vorm (${ons.ritten.length})`);
// stops, tijden, vensters, wachttijd en docks tegen fleet.blocks() (het planbord van de app)
const perRit = new Map(ons.ritten.map(r => [r.id, r]));
let blokStops = 0; const blokFout = [];
for (const t of fleet.trucks) {
  const B = fleet.blocks(t);
  B.forEach((b, i) => {
    if (b.rit === null) return;
    const r = perRit.get(`${t.id}/${b.rit}`); if (!r) { blokFout.push(`${t.id}/${b.rit} ontbreekt`); return; }
    if (b.k === 'stop') {
      blokStops++;
      const s = r.stops.find(x => Math.abs(x.aankomst - b.t0) < 1e-6);
      const vorige = B.slice(0, i).reverse().find(x => x.k === 'drive');
      if (!s || s.plek !== b.plek || Math.abs(s.klaar - b.t1) > 1e-6 || s.wacht !== b.wacht || JSON.stringify(s.venster) !== JSON.stringify(vorige && vorige.venster)) blokFout.push(`${t.id}/${b.rit} stop ${b.plek}`);
    }
    if (b.k === 'koppel' && b.dockSoort === 'vertrek' && r.dockVertrek !== b.dock) blokFout.push(`${t.id}/${b.rit} dock vertrek`);
    if (b.k === 'ontkoppel' && b.dockSoort === 'aankomst' && r.dockAankomst !== b.dock) blokFout.push(`${t.id}/${b.rit} dock aankomst`);
  });
}
check(!blokFout.length && blokStops === nStops, `stops, aankomst- en lostijden, vensters, wachttijd en docks gelijk aan het planbord (fleet.blocks, ${blokStops} stops)${blokFout.length ? ': ' + blokFout.slice(0, 5).join(', ') : ''}`);
const marksFout = ons.ritten.filter(r => { const t = fleet.byId.get(r.voertuig); const rt = t.routes[r.nr - 1]; return r.stops.map(s => s.plek).join() !== rt.marks.slice(1, -1).map(m => m.place.fleet !== undefined ? 'sp:' + m.place.n : m.place.id).join() || Math.abs(r.km - Math.round(rt.total * 10) / 10) > 1e-9; });
check(!marksFout.length, `volgorde van de stops en de kilometers gelijk aan de route van elke rit${marksFout.length ? ': ' + marksFout.slice(0, 5).map(r => r.id).join(', ') : ''}`);
const SEG = new Set(['koppel', 'ontkoppel', 'drive', 'stop', 'pauze', 'laden', 'terrein']);
const vreemd = []; for (const t of fleet.trucks) for (const s of t.plan) { const rt = s.route || s.ritRef; if (rt && t.routes.includes(rt) && (!SEG.has(s.k) || (s.k === 'terrein' && !s.dockSoort))) vreemd.push(`${t.id} ${s.k}`); }
check(!vreemd.length, `elk segment van een rit heeft een plek in OTM (stop, rijstuk, dockblok of pauze)${vreemd.length ? ': ' + vreemd.slice(0, 5).join(', ') : ''}`);
const evFout = [];
for (const t of fleet.trucks) {
  const a = fleet.eventsOf(t).filter(e => e.t <= T); const b = ons.events.filter(e => e.voertuig === t.id).map(({ voertuig, lat, lon, ...e }) => e);
  if (JSON.stringify(a) !== JSON.stringify(b)) evFout.push(t.id);
}
check(!evFout.length, `gebeurtenissen tot 10:00 gelijk aan fleet.eventsOf (${ons.events.length})${evFout.length ? ': ' + evFout.slice(0, 5).join(', ') : ''}`);
check(ons.open.length === fleet.poolAt(T).length && ons.posities.length === fleet.trucks.length, `open ritten zoals de planner ze om 10:00 ziet (${ons.open.length}) en een positie per voertuig (${ons.posities.length})`);

// ---------- 4. naar OTM5: valideren, verwijzingen, herhaalbaar, privacy ----------
const t2 = Date.now();
const doc = naarOtm5(fleet, T, { datum: DATUM });
const json = JSON.stringify(doc); const ms2 = Date.now() - t2;
console.log(`     OTM5-bundel: ${doc.trips.length} trips, ${doc.vehicles.length} vehicles, ${doc.actors.length} actors, ${doc.locations.length} locations, ${doc.transportEquipment.length} transportEquipment, ${doc.consignments.length} consignments, ${doc.events.length} events; ${(json.length / 1048576).toFixed(1)} MB (${ms2} ms)`);
const t3 = Date.now(); const val = valideerBundel(doc);
check(!val.fout.length, `elke entiteit in de bundel valideert tegen OTM ${OTM_VERSIE} (${val.n} entiteiten, ${Date.now() - t3} ms)${val.fout.length ? ': ' + val.fout.join(' | ') : ''}`);
const ids = new Set(), refs = [];
const loop = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(loop); return; } if (typeof o.id === 'string') ids.add(o.id); if (o.associationType === 'reference') refs.push(o.uuid); for (const [k, v] of Object.entries(o)) if (k !== 'externalAttributes') loop(v); };
loop(doc);
const los = refs.filter(u => !ids.has(u));
check(refs.length > 0 && !los.length, `elke verwijzing wijst naar een entiteit in de bundel (${refs.length} verwijzingen)${los.length ? ': ' + los.length + ' los' : ''}`);
check(JSON.stringify(naarOtm5(fleet, T, { datum: DATUM })) === json, 'twee keer maken geeft hetzelfde bestand (vaste UUID v5 per rit, stop, voertuig en plek)');
// een naam telt alleen als hij ergens anders staat dan in de naam van een plek (een winkel kan de naam van de ondernemer
// dragen, zoals "Plus Tom Groot Roessink, Hengelo"; dat is geen chauffeur)
const plekNamen = ons.plekken.map(p => p.naam);
const namen = [...new Set(fleet.trucks.flatMap(t => t.diensten.map(d => d.driver)))];
const zonderPlekken = json.split(/"(?:name|naam|plek)":"[^"]*"/).join('');
const gevonden = namen.filter(n => zonderPlekken.includes(n) || (json.includes(n) && !plekNamen.some(p => p.includes(n))));
const personen = doc.actors.filter(a => a.type === 'person');
check(namen.length > 100 && !gevonden.length && personen.length && personen.every(a => !a.name && !a.firstName && !a.lastName && !a.contactDetails),
  `geen naam of telefoon van een chauffeur in de bundel; chauffeurs staan er alleen als personeelsnummer in (${personen.length} chauffeurs, ${namen.length} namen gezocht)${gevonden.length ? ': ' + gevonden.slice(0, 3).join(', ') : ''}`);
const metVenster = doc.trips.flatMap(t => t.actions).filter(a => a.entity.constraint).length;
check(metVenster === ons.ritten.reduce((a, r) => a + r.stops.filter(s => s.venster).length, 0) + ons.open.filter(o => o.venster).length, `elk venster staat als timeWindowConstraint op zijn stop (${metVenster})`);
const updates = doc.events.filter(e => e.eventType === 'updateEvent');
const geplandeIds = new Set(); const acties = l => { for (const a of l || []) { if (a.entity && a.entity.id) geplandeIds.add(a.entity.id); acties(a.entity && a.entity.actions); } };
for (const t of [...doc.trips, ...doc.vehicles]) acties(t.actions);
const opGepland = updates.filter(e => geplandeIds.has(e.entity.id)).length;
check(updates.length > 0 && opGepland === updates.length, `elke update (laden, lossen, koppelen, pauze) verwijst met dezelfde UUID naar de geplande actie, zoals OTM-lifecycles bedoelen (${opGepland} van ${updates.length})`);

// ---------- 5. rondreis ----------
const t4 = Date.now();
const terug = vanOtm5(JSON.parse(json)); const ms4 = Date.now() - t4;
function vergelijk(a, b, pad, fout) {
  if (fout.length >= 8) return;
  if (typeof a === 'number' && typeof b === 'number') { const tol = /\.(lat|lon)$/.test(pad) ? 1e-9 : 1e-3; if (Math.abs(a - b) > tol) fout.push(`${pad}: ${a} tegen ${b}`); return; }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) fout.push(`${pad}: ${JSON.stringify(a)} tegen ${JSON.stringify(b)}`); return; }
  if (Array.isArray(a) !== Array.isArray(b)) { fout.push(`${pad}: lijst tegen object`); return; }
  if (Array.isArray(a)) { if (a.length !== b.length) fout.push(`${pad}: ${a.length} tegen ${b.length} items`); for (let i = 0; i < Math.min(a.length, b.length); i++) vergelijk(a[i], b[i], `${pad}[${i}]`, fout); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (a[k] === undefined && b[k] === undefined) continue; vergelijk(a[k], b[k], `${pad}.${k}`, fout); }
}
const sorteer = (l, k) => [...l].sort((x, y) => k(x) < k(y) ? -1 : k(x) > k(y) ? 1 : 0);
const delen = [
  ['plekken', x => x.id], ['voertuigen', x => x.id], ['opleggers', x => x.id], ['chauffeurs', x => x.id], ['diensten', x => x.id], ['ritten', x => x.id],
  ['blokken', x => `${x.voertuig}|${String(Math.round(x.t0 * 1000)).padStart(9, '0')}`], ['open', x => x.id], ['events', null], ['posities', null],
];
for (const [deel, k] of delen) {
  const fout = []; vergelijk(k ? sorteer(ons[deel], k) : ons[deel], k ? sorteer(terug[deel], k) : terug[deel], deel, fout);
  check(!fout.length, `rondreis ${deel}: ${ons[deel].length} gelijk na OTM5 en terug${fout.length ? ': ' + fout.join(' | ') : ''}`);
}
check(terug.datum === DATUM && Math.abs(terug.T - T) < 1e-6 && !terug.waarschuwingen.length, `datum, tijdstip en geen waarschuwingen bij het inlezen (${ms4} ms)`);

// ---------- 6. echte voorbeelden inlezen ----------
const gelezen = voorbeelden.map(({ n, doc: d }) => { try { return { n, v: vanOtm5(d) }; } catch (e) { return { n, fout: e.message }; } });
check(gelezen.every(g => !g.fout), `de vier voorbeelden uit de OTM-documentatie lezen in zonder fouten${gelezen.filter(g => g.fout).map(g => `: ${g.n} ${g.fout}`).join('')}`);
const ta = gelezen.find(g => g.n === 'trip_with_actions').v, tr = gelezen.find(g => g.n === 'trip_with_realization_data').v, tv = gelezen.find(g => g.n === 'trip_with_vehicle').v;
check(ta.open.length === 1 && ta.open[0].stops.length === 2 && JSON.stringify(ta.open[0].venster) === '[660,720]' && ta.datum === '2021-03-25',
  `trip_with_actions: een aangevraagde rit zonder voertuig wordt een open rit met twee stops en het venster 11:00 tot 12:00 Amsterdamse tijd (${JSON.stringify(ta.open[0] && ta.open[0].venster)})`);
const rs = tr.ritten[0] && tr.ritten[0].stops;
check(rs && rs.length === 2 && rs[0].gerealiseerd && Math.round(rs[0].gerealiseerd.aankomst) === 671 && Math.round(rs[1].gerealiseerd.vertrek) === 871,
  'trip_with_realization_data: dezelfde stop als planned en realized wordt één stop, met de gerealiseerde tijden erbij (11:11 en 14:31)');
check(tv.voertuigen.length === 1 && tv.voertuigen[0].kenteken === 'AB-12-CD' && tv.voertuigen[0].elektrisch === false && tv.ritten.length === 1, 'trip_with_vehicle: het voertuig met kenteken AB-12-CD wordt herkend (ook met het verouderde veld fuel)');
let specOk = true; try { const v = vanOtm5(specVoorbeelden.map(([, e]) => e)); specOk = Array.isArray(v.ritten); } catch (e) { specOk = false; console.log(e); }
check(specOk && specVoorbeelden.length >= 5, `de voorbeelden in de specificatie zelf (${specVoorbeelden.map(x => x[0]).join(', ')}) lezen in zonder fouten`);

// ---------- voorbeeldbestand: één voertuig, één dag ----------
const voorbeeldPad = path.join(app, 'tests', 'otm5', 'voorbeeld-simonloos.json');
if (args.includes('--schrijf-voorbeeld')) {
  const kandidaat = ons.ritten.filter(r => r.oplegger && r.stops.some(s => s.wacht > 0) && r.pauzes.length && r.stops.length >= 2).map(r => fleet.byId.get(r.voertuig)).find(t => t.diensten.length === 2 && t.kind === 'trekker');
  const v = naarOtm5(fleet, T, { datum: DATUM, voertuigen: [kandidaat.id] });
  writeFileSync(voorbeeldPad, JSON.stringify(v, null, 2) + '\n');
  console.log(`     voorbeeld geschreven: ${kandidaat.id} (${kandidaat.base.n}), ${v.trips.length} trips, ${v.events.length} events`);
}
if (existsSync(voorbeeldPad)) {
  const v = JSON.parse(readFileSync(voorbeeldPad, 'utf8')); const r = valideerBundel(v); const l = vanOtm5(v);
  check(!r.fout.length && l.ritten.length > 0 && !l.waarschuwingen.length, `tests/otm5/voorbeeld-simonloos.json valideert (${r.n} entiteiten) en leest in (${l.ritten.length} ritten, ${l.events.length} gebeurtenissen)${r.fout.length ? ': ' + r.fout.join(' | ') : ''}`);
}

console.log(fail ? `\n${fail} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fail ? 1 : 0);
