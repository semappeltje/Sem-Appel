// Intake zonder taalmodel: velden uit de tekst van een mail halen (kenteken, datum, bedrag, plek, soort, afzender) en
// een rittenexport (csv) van het TMS inlezen. Pure functies, getest zonder browser. In het echt doet de Claude API het
// lezen van de mail beter (vrije tekst, bijlagen); dit is de vaste onderlaag die altijd werkt en niets naar buiten stuurt.
import { GEBIEDEN, SOORTEN, kentekenNorm } from './regels.js';

// Nederlandse kentekens: de sidecodes sinds 1951, met of zonder streepjes, hoofd- of kleine letters.
const KENTEKEN = /\b(?:[A-Z]{2}-?\d{2}-?\d{2}|\d{2}-?\d{2}-?[A-Z]{2}|\d{2}-?[A-Z]{2}-?\d{2}|[A-Z]{2}-?\d{2}-?[A-Z]{2}|[A-Z]{2}-?[A-Z]{2}-?\d{2}|\d{2}-?[A-Z]{2}-?[A-Z]{2}|\d{2}-?[A-Z]{3}-?\d|\d-?[A-Z]{3}-?\d{2}|[A-Z]{2}-?\d{3}-?[A-Z]|[A-Z]-?\d{3}-?[A-Z]{2}|[A-Z]{3}-?\d{2}-?[A-Z]|[A-Z]-?\d{2}-?[A-Z]{3}|\d-?[A-Z]{2}-?\d{3}|\d{3}-?[A-Z]{2}-?\d)\b/gi;
const MAANDEN = { januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5, juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11, jan: 0, feb: 1, mrt: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, okt: 9, nov: 10, dec: 11 };
const PLEK_WOORDEN = [
  ['bumper_voor', /voorbumper|bumper voor|front bumper/i], ['bumper_achter', /achterbumper|bumper achter|rear bumper/i], ['motorkap', /motorkap|bonnet|hood/i], ['achterklep', /achterklep|kofferklep|tailgate/i], ['dak', /\bdak\b|roof/i],
  ['voorruit', /voorruit|windscreen|windshield/i], ['achterruit', /achterruit/i], ['portier_lv', /portier (links)?voor|linkervoorportier|bestuurdersportier|voorportier links/i], ['portier_la', /portier (links)?achter|linkerachterportier|achterportier links/i], ['portier_rv', /portier rechts ?voor|rechtervoorportier|bijrijdersportier/i], ['portier_ra', /portier rechts ?achter|rechterachterportier/i],
  ['spatbord_lv', /spatbord (links)?voor|linkervoorspatbord|voorscherm links/i], ['spatbord_rv', /spatbord rechts ?voor|rechtervoorspatbord/i], ['spatbord_la', /zijpaneel (links)?achter|achterscherm links|spatbord (links)?achter/i], ['spatbord_ra', /zijpaneel rechts ?achter|achterscherm rechts|spatbord rechts ?achter/i],
  ['velg_lv', /velg (links)?voor|linkervoorvelg/i], ['velg_rv', /velg rechts ?voor|rechtervoorvelg/i], ['velg_la', /velg (links)?achter|linkerachtervelg/i], ['velg_ra', /velg rechts ?achter|rechterachtervelg/i], ['velg_lv', /\bvelg\b|velgen|lichtmetaal/i],
  ['spiegel_l', /spiegel links|linkerspiegel|linker buitenspiegel/i], ['spiegel_r', /spiegel rechts|rechterspiegel|rechter buitenspiegel/i], ['spiegel_l', /spiegel/i], ['dorpel_l', /dorpel/i], ['portier_lv', /portier|deur/i], ['bumper_achter', /bumper/i],
];
const SOORT_WOORDEN = [['stoeprand', /stoeprand/i], ['steenslag', /steenslag|pit|ster(retje)?\b/i], ['barst', /barst|scheur|crack/i], ['schaafplek', /schaafplek|schaaf|schuur/i], ['lakschade', /lakschade|lak\b|verf/i], ['gebroken', /gebroken|kapot|afgebroken/i], ['ontbreekt', /ontbreekt|mist\b|weg is/i], ['deuk', /deuk|ingedeukt|dent/i], ['kras', /kras|gekrast|scratch/i]];

function datum(tekst, basisJaar) {
  const num = tekst.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/); if (num) { const j = num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3]); return new Date(j, Number(num[2]) - 1, Number(num[1])).getTime(); }
  const w = tekst.match(/\b(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sept?|okt|nov|dec)\.?\s*(\d{4})?\b/i); if (w) return new Date(w[3] ? Number(w[3]) : basisJaar, MAANDEN[w[2].toLowerCase()], Number(w[1])).getTime();
  const iso = tekst.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  return null;
}
function bedrag(tekst) {
  const m = [...tekst.matchAll(/(?:€|eur(?:o)?\.?)\s?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)|(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s?(?:€|euro)/gi)].map(x => (x[1] || x[2])).map(s => Number(s.replace(/[.\s]/g, '').replace(',', '.'))).filter(n => n > 0 && n < 1000000);
  return m.length ? Math.max(...m) : null;
}
// Leest een mail: geeft de velden met een zekerheid (0 tot 1) en de regels waarop ze gevonden zijn.
export function leesMail(tekst, opt = {}) {
  const t = String(tekst || ''); const basisJaar = opt.jaar || new Date(opt.nu || Date.now()).getFullYear();
  const kent = [...new Set([...t.matchAll(KENTEKEN)].map(m => kentekenNorm(m[0])))].filter(k => k.length === 6 && /\d/.test(k) && /[A-Z]/.test(k));
  const gebied = (PLEK_WOORDEN.find(([, re]) => re.test(t)) || [null])[0];
  const soort = (SOORT_WOORDEN.find(([, re]) => re.test(t)) || [null])[0];
  const b = bedrag(t); const d = datum(t, basisJaar);
  const groet = t.match(/(?:met vriendelijke groet|vriendelijke groet|groet(?:en)?|mvg|hartelijke groet)[,\s]*\n+\s*([^\n]{2,80})/i);
  const afz = t.match(/^(?:van|from):\s*([^\n<]+)/im);
  const onderwerp = t.match(/^(?:onderwerp|subject):\s*([^\n]+)/im);
  const ernst = /groot|grote|flink|zwaar|diep|fors/i.test(t) ? 3 : /klein|licht|kras(je)?|oppervlakkig/i.test(t) ? 1 : 2;
  return {
    kenteken: kent[0] ? { w: kent[0], z: kent.length === 1 ? 0.95 : 0.7, noot: kent.length > 1 ? `Meer dan een kenteken in de tekst: ${kent.join(', ')}.` : null } : { w: null, z: 0, noot: 'Geen kenteken gevonden.' },
    datum: d ? { w: d, z: 0.85 } : { w: null, z: 0 }, bedrag: b ? { w: Math.round(b), z: 0.9 } : { w: null, z: 0 },
    gebied: gebied ? { w: gebied, z: 0.75 } : { w: null, z: 0 }, soort: soort ? { w: soort, z: 0.75 } : { w: null, z: 0 }, ernst,
    afzender: (afz && afz[1].trim()) || (groet && groet[1].trim()) || null, onderwerp: onderwerp ? onderwerp[1].trim() : null,
    tekst: t.trim(),
  };
}

// Een rittenexport uit het TMS: csv met een kopregel. Kolomnamen zijn vrij; dit zijn de namen die we herkennen (in
// kleine letters, zonder spaties). Puntkomma of komma als scheidingsteken; aanhalingstekens volgens RFC 4180.
export const RIT_KOLOMMEN = {
  id: ['rit', 'ritnummer', 'ritnr', 'rit_id', 'id', 'trip'], order: ['order', 'ordernummer', 'ordernr', 'opdracht'], kenteken: ['kenteken', 'plaat', 'licenseplate', 'kenteken_voertuig'],
  merk: ['merk', 'make', 'brand'], model: ['model', 'type', 'handelsbenaming'], kleur: ['kleur', 'color'], ophaal: ['ophaal', 'ophaaldatum', 'laaddatum', 'geladen', 'pickup', 'laden'], aflever: ['aflever', 'afleverdatum', 'losdatum', 'gelost', 'delivery', 'lossen'],
  chauffeur: ['chauffeur', 'chauffeurnaam', 'driver', 'bestuurder'], chauffeurId: ['chauffeurnr', 'chauffeur_id', 'personeelsnummer', 'driver_id'], truck: ['truck', 'trekker', 'voertuig', 'wagen', 'kenteken_truck'], positie: ['positie', 'plek', 'position'],
  van: ['van', 'laadadres', 'laadplaats', 'ophaalplaats', 'origin'], naar: ['naar', 'losadres', 'losplaats', 'afleverplaats', 'destination'], opdrachtgever: ['opdrachtgever', 'klant', 'debiteur', 'customer'], vestiging: ['vestiging', 'standplaats', 'depot'],
};
export function leesCsv(tekst) {
  const t = String(tekst || '').replace(/^﻿/, ''); const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rijen = []; let rij = [], veld = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { veld += '"'; i++; } else q = false; } else veld += c; } else if (c === '"') q = true; else if (c === sep) { rij.push(veld); veld = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; rij.push(veld); if (rij.some(x => x.trim() !== '')) rijen.push(rij); rij = []; veld = ''; } else veld += c; }
  rij.push(veld); if (rij.some(x => x.trim() !== '')) rijen.push(rij);
  return rijen;
}
export function leesRittenExport(tekst, opt = {}) {
  const rijen = leesCsv(tekst); if (rijen.length < 2) return { ritten: [], fouten: ['Geen rijen gevonden onder de kopregel.'], kolommen: {} };
  const kop = rijen[0].map(k => k.trim().toLowerCase().replace(/[\s_-]+/g, '')); const idx = {};
  for (const [veld, namen] of Object.entries(RIT_KOLOMMEN)) { const i = kop.findIndex(k => namen.map(n => n.replace(/[\s_-]+/g, '')).includes(k)); if (i >= 0) idx[veld] = i; }
  const fouten = []; for (const v of ['kenteken', 'ophaal']) if (idx[v] == null) fouten.push(`Kolom voor ${v} niet gevonden (verwacht bijvoorbeeld "${RIT_KOLOMMEN[v][0]}").`);
  if (fouten.length) return { ritten: [], fouten, kolommen: idx };
  const ritten = []; const basisJaar = new Date(opt.nu || Date.now()).getFullYear();
  rijen.slice(1).forEach((r, n) => {
    const g = v => (idx[v] != null ? String(r[idx[v]] || '').trim() : '');
    const kenteken = kentekenNorm(g('kenteken')); if (kenteken.length !== 6) { fouten.push(`Rij ${n + 2}: kenteken "${g('kenteken')}" niet herkend.`); return; }
    const ophaal = datum(g('ophaal'), basisJaar); if (!ophaal) { fouten.push(`Rij ${n + 2}: ophaaldatum "${g('ophaal')}" niet herkend.`); return; }
    const aflever = datum(g('aflever'), basisJaar) || ophaal;
    ritten.push({ id: g('id') || `R-IMP-${n + 1}`, order: g('order') || '', kenteken, merk: g('merk') || 'Onbekend', model: g('model') || '', kleur: g('kleur') || '', ophaal, aflever, chauffeurNaam: g('chauffeur') || 'onbekend', chauffeurId: g('chauffeurId') || '', truck: g('truck') || '', positie: Number(g('positie')) || null, van: { plaats: g('van') || '', naam: g('opdrachtgever') || '' }, naar: { plaats: g('naar') || '', naam: '' }, opdrachtgever: g('opdrachtgever') || '', vestiging: g('vestiging') || '', bron: 'import' });
  });
  return { ritten, fouten, kolommen: idx };
}
// Het datacontract in een voorbeeldbestand: de kolommen die een export of een API-antwoord moet dragen.
export function voorbeeldCsv() {
  return ['rit;order;kenteken;merk;model;kleur;ophaal;aflever;chauffeur;chauffeurnr;truck;positie;van;naar;opdrachtgever;vestiging',
    'R-250001;O0112345;GX-412-N;Volkswagen;Polo;grijs;2026-11-02 09:40;2026-11-03 14:10;Kees B.;C-01;BT-12;3;Hoorn;Barneveld;Westfries Lease;Opmeer',
    'R-250002;O0112346;H-123-BC;Toyota;Yaris;wit;2026-11-02 11:05;2026-11-02 16:30;Youssef A.;C-06;BT-12;5;Alkmaar;Barneveld;Dealergroep Polder;Opmeer'].join('\n') + '\n';
}
