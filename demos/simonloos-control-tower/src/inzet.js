// De flexibele schil van de planning (Control Tower 4.0): charters (src/data/charters.json), oproepkrachten (zzp'ers,
// weekendchauffeurs en oproepkrachten) en het rangschikken van kandidaten voor een open rit. Alles gesimuleerd en
// deterministisch (eigen seed), met verzonnen namen en fictieve nummers: mobiel 06 9… en vast 0229 0… (reeksen die het
// nummerplan niet uitgeeft), e-mail op .example. Tarieven, kosten, beschikbaarheid en betrouwbaarheid zijn schattingen.
//
// De functies hieronder zijn puur: ze krijgen een rit en wat erbij hoort (ctx, opgebouwd door fleet.kandidaten) en geven een
// kandidaat terug, zonder iets te veranderen. De rij- en rusttijdregels (EU 561/2006, Arbeidstijdenbesluit vervoer) staan
// in eigenKandidaat; zie src/data/BRONNEN.md voor de aannames.
//
// Kandidaat: { soort: 'eigen' | 'oproep' | 'charter', id, naam, score (0 tot 1), kans (kans op ja), redenen: [...],
//   uren: { gereden, over, naRit, week, weekMax }, kosten: { bedrag, schatting: true, uitleg }, tel?, email?, contactpersoon?,
//   beschikbaar, waarschuwingen: ['rijtijd', 'rust', ...], voertuig (id of null), past: { score, oordeel }, gesimuleerd: true }
import CH from './data/charters.json';
import { SP } from './places.js';
import { voorkeurenVan, past, reeks, isoDag, dagVanIso, WEEKDAGEN, WEEKDAG_NAAM, DIENSTDEEL_NAAM } from './voorkeuren.js';

export const CHARTERS = CH.charters;
export const SEED_FLEX = 20261027;
// Schattingen voor de kosten van een rit (euro): loonkosten per uur van een eigen chauffeur, toeslagen voor een verlengde
// dienst, een extra dienst op een vrije dag en het weekend, en de variabele kosten per km van een eigen voertuig.
export const EIGEN_UUR = 33;
export const TOESLAG = { verlenging: 1.3, vrij: 1.5, weekend: 1.5 };
export const KM_KOST = { diesel: 0.55, ev: 0.35, bus: 0.18, busEv: 0.12 };
export const OPLEGGER_NAAM = { koel: 'koeloplegger', vries: 'vriesoplegger', droog: 'gesloten oplegger', huif: 'schuifzeiloplegger', lzv: 'LZV-combinatie', silo: 'silo-oplegger', drank: 'drankenoplegger', city: 'city-oplegger' };
export const WAARSCHUWINGEN = {
  rijtijd: 'Rijtijd: gaat over 9 uur, een verlenging tot 10 uur (twee keer per week toegestaan)',
  rust: 'Rust: minder dan 11 uur dagrust, een verkorte rust van 9 uur (drie keer per week toegestaan)',
  pauze: 'Pauze: na 4,5 uur rijden 45 minuten pauze inplannen voor of tijdens de rit',
  uren: 'Uren: boven de gewenste uren deze week',
  accu: 'Accu: de rit is langer dan 78 procent van het bereik, laden onderweg nodig',
  voertuig: 'Voertuig: geen vrij voertuig van deze soort op de standplaats',
  code95: 'Code 95 verloopt binnen 60 dagen',
  lzv: 'LZV-bevoegdheid nakijken',
  aanrijtijd: 'Aanrijtijd: kan pas na het begin van het laadvenster vertrekken (eerst nog naar de standplaats)',
};
// Dezelfde waarschuwingen kort, voor een chip of het logboek.
export const WAARSCHUWING_KORT = { rijtijd: 'rijtijd boven 9 uur', rust: 'verkorte rust', pauze: 'pauze inplannen', uren: 'boven de gewenste uren', accu: 'laden onderweg', voertuig: 'nog geen voertuig', code95: 'code 95 verloopt', lzv: 'LZV nakijken', aanrijtijd: 'na het begin van het venster' };
const SOORTNAAM = { zzp: 'Zzp\'er', weekend: 'Weekendchauffeur', oproep: 'Oproepkracht' };
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const uur = m => `${(Math.round(m / 6) / 10).toString().replace('.', ',')} uur`;
const euro = x => `€ ${Math.round(x).toLocaleString('nl-NL')}`;
const km = (a, b) => { const c = Math.cos((a.lat + b.lat) / 2 * Math.PI / 180); return Math.hypot((a.lon - b.lon) * c * 111.32, (a.lat - b.lat) * 111.32); };
const spVan = n => SP.find(s => s.n === n);
const kosten = (bedrag, uitleg) => ({ bedrag: Math.round(bedrag / 5) * 5, schatting: true, uitleg });
const r2 = x => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Een zzp'er of oproepkracht mag een oproep binnen vier dagen weigeren (Wet arbeidsmarkt in balans; de cao kan dat tot 24 uur
// inkorten). Dat is een signaal voor de planner, geen juridisch advies.
const OPROEPTERMIJN = 4 * 1440;
// Bereikbaar als je belt (schatting): 's nachts neemt de helft op, vroeg in de ochtend driekwart, overdag bijna iedereen.
// Wie op dienst is, bereik je via de boordcomputer; een grote charter heeft 's nachts een planner, een kleine niet.
export const bereikbaar = T => { const m = ((T % 1440) + 1440) % 1440; return m < 300 ? 0.5 : m < 420 ? 0.75 : m < 1200 ? 0.9 : 0.8; };
// Aanrijtijd (minuten, schatting): hoe lang het duurt voor een kandidaat met de rit kan vertrekken als je nu vraagt. Wie thuis
// is, moet de vraag krijgen, reizen en inklokken: 35 tot 65 minuten, vast per persoon (de woonplaats staat niet in de data;
// met echte data komt dit uit de reistijd van huis naar de standplaats). Een oproepkracht van een standplaats verderop rijdt
// die afstand erbij. Een charter rijdt van zijn eigen plaats (70 km/u over 1,3 keer de afstand) plus een kwartier.
const hash01 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967295; };
export const thuisMin = id => 35 + Math.round(hash01(`aanrij|${id}`) * 30);
// Na de eigen dienst: wisselen en koppelen op het terrein.
export const AANRIJ_KOPPELEN = 15;
// Het vertrek van een rit voor een kandidaat (absolute minuten): niet voor het venster, niet voor hij er kan zijn, op vijf
// minuten. Een rit van morgen vertrekt gewoon aan het begin van zijn venster.
export function vertrekVan(ctx, aanrij, vanaf = -Infinity) {
  if (ctx.dag === 'morgen') return ctx.a;
  const kan = Math.max(ctx.T + aanrij, vanaf);
  return kan > ctx.a + 0.5 ? Math.ceil(kan / 5) * 5 : ctx.a;
}
// De aanrijtijd voor een kandidaat van wie alleen soort en id bekend zijn (een bewaarde toewijzing waarvan de kandidaat
// intussen niet meer in de lijst staat): eigen chauffeur of oproepkracht vanaf huis, een charter vanaf zijn plaats.
export function aanrijVan(ctx, k) {
  if (k && k.soort === 'charter') { const ch = CHARTERS.find(c => c.id === k.id); return ch ? Math.round(km(ch, ctx.sp) * 1.3 / 70 * 60 + 15) : 60; }
  return thuisMin(k && k.id ? k.id : '');
}
// Een regel voor de kandidaat als het vertrek later is dan het begin van het venster
const vertrekRegel = (ctx, vertrek, waarom) => (ctx.dag !== 'morgen' && vertrek > ctx.a + 0.5 ? `vertrekt op zijn vroegst om ${hhmm(vertrek)}: ${waarom} (schatting)` : null);

// ---------- oproepkrachten: zzp'ers, weekendchauffeurs en oproepkrachten (gesimuleerd) ----------
// Per standplaats ongeveer een op de zestien voertuigen, minstens één. Velden: { id, naam, soort, standplaats, regio, tel,
// rijbewijs, code95Tot, bevoegd, beschikbaarheid: { ma: ['vroeg', ...], ... }, tarief: { perUur, schatting, soort },
// voorkeuren (zoals voorkeurenVan), laatsteInzet, betrouwbaarheid: { opTijd, ritten, afgezegd, ja }, bezet: { vandaag, morgen } }.
const VOORNAAM = ['Arjen', 'Bert', 'Chantal', 'Gijs', 'Hans', 'Ingrid', 'Karin', 'Leon', 'Mehmet', 'Nadia', 'Orhan', 'Sjoerd', 'Theo', 'Vincent', 'Willem', 'Yvonne', 'Zeynep', 'Hamza', 'Bilal', 'Tamara', 'Gert', 'Remco', 'Stefan', 'Joost', 'Marcel', 'Jasper', 'Melvin', 'Esra', 'Tomasz', 'Pawel', 'Marek', 'Andrei', 'Wouter', 'Dewi', 'Mila', 'Rachid', 'Ivo', 'Lotte', 'Rianne', 'Thomas', 'Dylan', 'Anouar', 'Gerben', 'Hilde'];
const ACHTERNAAM = ['Smits', 'Mertens', 'van Leeuwen', 'Postma', 'Hoekstra', 'Jacobs', 'van der Heijden', 'Kuipers', 'Prins', 'Verbruggen', 'Sanders', 'van Beek', 'Dijkstra', 'Kowalski', 'Nowak', 'Yilmaz', 'Demir', 'El Amrani', 'Bouzid', 'Veenstra', 'Kroon', 'Zijlstra', 'Claassen', 'Gerritsen', 'Hermans', 'Wolters', 'Scholten', 'Brink', 'Kuiper', 'Nijland', 'Wiersma', 'Snijders', 'Pronk', 'Venema', 'Rutten', 'Coenen', 'Aksoy', 'Popescu', 'Lindhout', 'Haverkamp'];
function maakOproep(vandaag) {
  const out = []; const namen = new Set(); const nummers = new Set(); let nr = 1;
  const R = reeks(SEED_FLEX, 'oproep', 'flex');
  const dag = n => isoDag(new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate() + n));
  for (const sp of SP) {
    const n = Math.max(1, Math.round(sp.fleet / 16));
    for (let k = 0; k < n; k++) {
      const id = `OP-${String(nr++).padStart(3, '0')}`;
      let naam; do naam = `${VOORNAAM[Math.floor(R() * VOORNAAM.length)]} ${ACHTERNAAM[Math.floor(R() * ACHTERNAAM.length)]}`; while (namen.has(naam)); namen.add(naam);
      let tel; do tel = `06 9${Math.floor(R() * 10)} ${10 + Math.floor(R() * 90)} ${10 + Math.floor(R() * 90)} ${10 + Math.floor(R() * 90)}`; while (nummers.has(tel)); nummers.add(tel);
      const u = R(); const soort = u < 0.3 ? 'weekend' : u < 0.55 ? 'zzp' : 'oproep';
      const div = sp.div[k % sp.div.length];
      const rijbewijs = div === 'bezorg' ? ['B'] : R() < 0.18 ? ['C', 'B'] : ['CE', 'C', 'B'];
      const v = voorkeurenVan(id, SEED_FLEX, { base: sp, div });
      if (soort === 'weekend') { v.weekend = true; v.opmerking = ['Doordeweeks een andere baan, in het weekend graag rijden', 'Studeert, rijdt alleen in het weekend', 'Oud-chauffeur, rijdt graag op zaterdag'][Math.floor(R() * 3)]; }
      // beschikbaarheid per weekdag: de dagdelen van de voorkeur, soms een dagdeel erbij
      const beschikbaarheid = {}; const extraDd = { vroeg: 'dag', dag: 'avond', avond: 'dag', nacht: 'vroeg' };
      const dagen = soort === 'weekend' ? ['za', 'zo', ...(R() < 0.35 ? ['vr'] : [])]
        : soort === 'zzp' ? WEEKDAGEN.filter(d => d !== 'zo' && (d !== 'za' || v.weekend) && R() < 0.8)
          : WEEKDAGEN.filter(d => (d !== 'za' && d !== 'zo') || v.weekend).filter(() => R() < 0.55);
      for (const d of WEEKDAGEN) beschikbaarheid[d] = dagen.includes(d) ? [...new Set([...v.dagdelen, ...(R() < 0.4 ? [extraDd[v.dagdelen[0]]] : [])])] : [];
      if (!dagen.length) beschikbaarheid[WEEKDAGEN[Math.floor(R() * 5)]] = [v.dagdelen[0]];
      const perUur = soort === 'zzp' ? 47 + R() * 9 : soort === 'weekend' ? 39 + R() * 8 : 36 + R() * 7;
      const code95Tot = rijbewijs.includes('C') ? dag(Math.round(-25 + R() * 1800)) : null;
      const ritten = soort === 'zzp' ? 12 + Math.floor(R() * 19) : soort === 'weekend' ? 3 + Math.floor(R() * 12) : 4 + Math.floor(R() * 13);
      const bevoegd = div === 'bulk' && R() < 0.5 ? ['silo'] : div === 'netwerk' && R() < 0.4 ? ['lzv'] : [];
      out.push({
        id, naam, soort, standplaats: sp.n, regio: sp.regio, tel, rijbewijs, code95Tot, bevoegd, beschikbaarheid,
        tarief: { perUur: Math.round(perUur * 10) / 10, schatting: true, soort: soort === 'zzp' ? 'zzp-tarief' : 'inleentarief' },
        voorkeuren: v, laatsteInzet: dag(-(1 + Math.floor(R() * 40))),
        betrouwbaarheid: { opTijd: Math.round((85 + R() * 14) * 10) / 10, ritten, afgezegd: Math.floor(R() * R() * 4), ja: Math.round(soort === 'zzp' ? 70 + R() * 25 : soort === 'weekend' ? 55 + R() * 35 : 45 + R() * 40) },
        bezet: { vandaag: R() < 0.2, morgen: R() < 0.15 }, gesimuleerd: true,
      });
    }
  }
  return out;
}
const VANDAAG0 = (d => new Date(d.getFullYear(), d.getMonth(), d.getDate()))(new Date());
export const OPROEP = maakOproep(VANDAAG0);

// ---------- kandidaten (puur) ----------
// ctx (van fleet.kandidaten): { rit (uit de pool), sp (standplaats), dag ('vandaag' | 'morgen'), a, b (begin en eind van de rit
// in absolute minuten, morgen +1440), rijMin, km, uren, weekdag, weekend, dagdeel, datum (Date van de ritdag), lead (minuten
// van nu tot het begin), T (nu, minuten van de dag), kenmerken (ritKenmerken), voertuig ({ id, ev, kind, kmKost, accu } of
// null), charterGebruik (Map 'CH-01|vandaag' -> al toegewezen) }.
const ritTekst = ctx => `${ctx.dag === 'morgen' ? 'morgen ' : ''}${hhmm(ctx.a)} tot ${hhmm(ctx.b)}`;
const kmKosten = ctx => ctx.km * (ctx.voertuig ? ctx.voertuig.kmKost : KM_KOST.diesel);

// Eigen chauffeur. c: { id, naam, div, dienst: { start, end, rij, maxRij, voertuig } | null (vandaag, absolute minuten), status
// ('vrij' | 'vakantie' | 'ziek' | 'rustdag'), statusMorgen ('vrij' | 'ingeroosterd' | 'vakantie' | 'ziek'), weekUren, voorkeuren,
// uurloon (of null), lzv (true, false of null: onbekend) }. Het rooster van morgen is dat van vandaag (zelfde dienst).
// Regels: geen overlap met de eigen dienst; een rit voor of na de dienst maakt één werkdag van hoogstens 13 uur (15 met een
// verkorte rust), 9 uur rijden (10 met een verlenging), en laat 11 uur rust (9 verkort) tot de volgende dienst; hoogstens
// 60 uur per week (Arbeidstijdenbesluit vervoer).
export function eigenKandidaat(c, ctx) {
  const { rit } = ctx;
  if ((rit.soort === 'bus') !== (c.div === 'bezorg')) return null;
  if (rit.oplegger === 'silo' && c.div !== 'bulk') return null;
  if (rit.oplegger === 'lzv' && c.lzv === false) return null;
  const W = []; const R = []; if (rit.oplegger === 'lzv' && c.lzv == null) W.push('lzv');
  const v = c.voorkeuren; const p = past(v, ctx.kenmerken);
  const weekMax = v.maxUren; const week = ctx.dag === 'morgen' && typeof c.weekUrenMorgen === 'number' ? c.weekUrenMorgen : c.weekUren;
  let gereden = 0, over = 540, toeslag = ctx.weekend ? TOESLAG.weekend : 1, kansJa, hoofd; const uren = ctx.uren;
  const D = c.dienst ? (ctx.dag === 'morgen' ? { ...c.dienst, start: c.dienst.start + 1440, end: c.dienst.end + 1440 } : c.dienst) : null;
  const vrijDag = !D;
  // aanrijden: van huis, of (een rit na de eigen dienst, die nog loopt of nog moet komen) na die dienst en het koppelen
  let aanrij = thuisMin(c.id), vanaf = -Infinity, waarom = `eerst ${aanrij} min van huis naar ${ctx.sp.n}`;
  if (D && ctx.a >= D.end && ctx.dag !== 'morgen' && ctx.T < c.dienst.end) { aanrij = AANRIJ_KOPPELEN; vanaf = D.end + AANRIJ_KOPPELEN; waarom = `na de eigen dienst (klaar om ${hhmm(D.end)}) en het koppelen`; }
  if (!D) {
    const st = ctx.dag === 'morgen' ? c.statusMorgen : c.status; if (st !== 'vrij') return null;
    toeslag = Math.max(toeslag, TOESLAG.vrij);
    kansJa = ({ graag: 0.75, soms: 0.5, nee: 0.15 }[v.extra] || 0.5) * bereikbaar(ctx.T);
    if (ctx.lead < 90) kansJa *= 0.75;   // eerst nog naar de standplaats
    hoofd = `${ctx.dag === 'morgen' ? 'Morgen vrij' : 'Vrij vandaag'} en uitgerust; 9 uur rijtijd over`;
    if (v.extra === 'graag') R.push('wil graag extra diensten'); else if (v.extra === 'nee') R.push('wil liever geen extra diensten');
  } else {
    if (ctx.a < D.end + 15 && D.start - 15 < ctx.b) return null;   // overlapt met de eigen dienst
    const na = ctx.a >= D.end; const gat = na ? ctx.a - D.end : D.start - ctx.b;
    const span = na ? ctx.b - D.start : D.end - ctx.a; const rij = D.rij + ctx.rijMin;
    // rust tot de volgende dienst (na de rit) of sinds de vorige (voor de rit): het rooster herhaalt zich elke dag
    const rust = na ? D.start + 1440 - ctx.b : ctx.a - (D.end - 1440);
    if (span > 900 || rij > 600 || rust < 540) return null;
    if (span > 780 || rust < 660) W.push('rust');
    if (rij > 540) W.push('rijtijd');
    if (gat < 45 && rij > 270) W.push('pauze');
    gereden = D.rij; over = Math.max(0, (W.includes('rijtijd') ? 600 : 540) - D.rij);
    toeslag = Math.max(toeslag, TOESLAG.verlenging);
    const opDienst = ctx.T >= c.dienst.start && ctx.T < c.dienst.end;   // nu op dienst: bereikbaar via de boordcomputer
    kansJa = ({ graag: 0.6, soms: 0.4, nee: 0.12 }[v.extra] || 0.4) * (opDienst ? 0.95 : bereikbaar(ctx.T));
    hoofd = na ? `Klaar om ${hhmm(D.end)}${ctx.dag === 'morgen' ? ' (rooster morgen)' : ''}; met deze rit ${uur(span)} dienst en ${uur(rij)} rijden`
      : `Begint ${ctx.dag === 'morgen' ? 'morgen ' : ''}om ${hhmm(D.start)}; de rit is om ${hhmm(ctx.b)} klaar, dan ${uur(span)} dienst en ${uur(rij)} rijden`;
  }
  if (week + ctx.uren > 60) return null;
  if (week + ctx.uren > weekMax) { W.push('uren'); kansJa *= 0.7; }
  if (!ctx.voertuig) W.push('voertuig'); else if (ctx.voertuig.accu) W.push('accu');
  const vertrek = vertrekVan(ctx, aanrij, vanaf); const vr = vertrekRegel(ctx, vertrek, waarom); if (vr) W.push('aanrijtijd');
  kansJa = clamp(kansJa * (0.75 + 0.5 * p.score), 0.03, 0.95);
  R.unshift(hoofd); if (vr) R.splice(1, 0, vr); R.push(...p.redenen.slice(0, 2), `${Math.round(week)} van de ${weekMax} gewenste uren deze week`);
  const uurloon = c.uurloon || EIGEN_UUR; const kmK = ctx.voertuig ? ctx.voertuig.kmKost : KM_KOST.diesel;
  const bedrag = uren * uurloon * toeslag + kmKosten(ctx);
  // score: vooral de kans dat iemand ja zegt (daar zit de voorkeur al in), dan hoe goed de rit past, dan de waarschuwingen
  const score = clamp(0.7 * kansJa + 0.2 * p.score + 0.1 * (1 - 0.25 * W.length), 0, 1);
  return {
    soort: 'eigen', id: c.id, naam: c.naam, score: r2(score), kans: r2(kansJa), redenen: R,
    uren: { gereden: Math.round(gereden / 6) / 10, over: Math.round(over / 6) / 10, naRit: Math.round(Math.max(0, over - ctx.rijMin) / 6) / 10, week: Math.round(week * 2) / 2, weekMax },
    kosten: kosten(bedrag, `${uur(uren * 60)} x ${euro(uurloon)}${toeslag > 1 ? ` x ${String(toeslag).replace('.', ',')} (${vrijDag ? 'extra dienst' : 'overuren'}${ctx.weekend ? ', weekend' : ''})` : ''} + ${Math.round(ctx.km)} km x ${Math.round(kmK * 100)} cent`),
    beschikbaar: true, waarschuwingen: W, voertuig: ctx.voertuig ? ctx.voertuig.id : null, past: { score: p.score, oordeel: p.oordeel }, aanrij, vertrek, gesimuleerd: true,
  };
}

// Oproepkracht, zzp'er of weekendchauffeur van de eigen standplaats of een standplaats binnen 40 km: beschikbaar op die
// weekdag en dat dagdeel, het juiste rijbewijs en een geldige code 95, vandaag of morgen nog niet ingezet.
export function oproepKandidaat(o, ctx) {
  const { rit } = ctx; const rb = o.rijbewijs;
  if (rit.soort === 'trekker' && !rb.includes('CE')) return null;
  if (rit.soort === 'bakwagen' && !rb.includes('C')) return null;
  if (rit.soort === 'bus' && !rb.includes('B')) return null;
  if ((rit.oplegger === 'silo' || rit.oplegger === 'lzv') && !o.bevoegd.includes(rit.oplegger)) return null;
  const thuis = spVan(o.standplaats); const afstand = thuis === ctx.sp ? 0 : km(thuis, ctx.sp);
  if (afstand > 40) return null;
  if (!(o.beschikbaarheid[ctx.weekdag] || []).includes(ctx.dagdeel)) return null;
  if (o.bezet[ctx.dag]) return null;
  const W = [];
  if (o.code95Tot && rit.soort !== 'bus') { const tot = dagVanIso(o.code95Tot); if (tot < ctx.datum) return null; if ((tot - ctx.datum) / 864e5 < 60) W.push('code95'); }
  if (!ctx.voertuig) W.push('voertuig'); else if (ctx.voertuig.accu) W.push('accu');
  const p = past(o.voorkeuren, ctx.kenmerken); const b = o.betrouwbaarheid;
  let kansJa = b.ja / 100 * (0.75 + 0.5 * p.score) * (ctx.lead < 90 ? 0.6 : ctx.lead < 180 ? 0.85 : 1) * bereikbaar(ctx.T);
  const R = [`${SOORTNAAM[o.soort]}, ${WEEKDAG_NAAM[ctx.weekdag]} beschikbaar voor de ${DIENSTDEEL_NAAM[ctx.dagdeel]}`];
  if (afstand) R.push(`staat ingeschreven bij ${o.standplaats}, ${Math.round(afstand)} km verderop`);
  R.push(`${b.ja} % ja op een oproep, ${String(b.opTijd).replace('.', ',')} % op tijd (${b.ritten} ritten in 8 weken)`);
  if (o.soort !== 'zzp' && ctx.lead < OPROEPTERMIJN) { R.push('opgeroepen binnen 4 dagen: mag nee zeggen'); kansJa *= 0.9; }
  R.push(...p.redenen.slice(0, 2));
  // aanrijden van huis, plus de afstand als hij bij een standplaats verderop staat ingeschreven (60 km/u over 1,3 keer)
  const aanrij = thuisMin(o.id) + Math.round(afstand * 1.3); const vertrek = vertrekVan(ctx, aanrij);
  const vr = vertrekRegel(ctx, vertrek, `eerst ${aanrij} min naar ${ctx.sp.n}`); if (vr) { W.push('aanrijtijd'); R.splice(1, 0, vr); }
  kansJa = clamp(kansJa, 0.03, 0.95);
  const bedrag = ctx.uren * o.tarief.perUur + kmKosten(ctx);
  const score = clamp(0.5 * kansJa + 0.2 * p.score + 0.15 * b.opTijd / 100 + 0.15 * (1 - 0.25 * W.length) - afstand / 400, 0, 1);
  return {
    soort: 'oproep', id: o.id, naam: o.naam, sub: o.soort, score: r2(score), kans: r2(kansJa), redenen: R,
    uren: { gereden: 0, over: 9, naRit: Math.round(Math.max(0, 540 - ctx.rijMin) / 6) / 10, week: null, weekMax: o.voorkeuren.maxUren },
    kosten: kosten(bedrag, `${uur(ctx.uren * 60)} x ${euro(o.tarief.perUur)} (${o.tarief.soort}) + ${Math.round(ctx.km)} km eigen voertuig`),
    tel: o.tel, beschikbaar: true, waarschuwingen: W, voertuig: ctx.voertuig ? ctx.voertuig.id : null, past: { score: p.score, oordeel: p.oordeel }, aanrij, vertrek, gesimuleerd: true,
  };
}

// Charter met eigen trekker (of bakwagen) en de juiste soort oplegger, binnen 85 km van de standplaats. Beschikbaar als
// hij die dag nog trekkers vrij heeft (min wat al aan hem is toegewezen); aanrijden met 70 km/u over 1,3 keer de afstand.
export function charterKandidaat(ch, ctx) {
  const { rit } = ctx;
  if (rit.soort === 'bus') return null;
  if (!ch.voertuigen.includes(rit.soort === 'bakwagen' ? 'bakwagen' : 'trekker')) return null;
  if (rit.soort === 'trekker' && rit.oplegger && !ch.opleggers.includes(rit.oplegger)) return null;
  const afstand = km(ch, ctx.sp); if (afstand > 85) return null;
  const gebruikt = ctx.charterGebruik ? ctx.charterGebruik.get(`${ch.id}|${ctx.dag}`) || 0 : 0;
  const vrij = (ch.beschikbaar[ctx.dag] || 0) - gebruikt; const beschikbaar = vrij > 0;
  const aanrij = Math.round(afstand * 1.3 / 70 * 60 + 15);
  const W = []; if (beschikbaar && ctx.lead < aanrij) W.push('aanrijtijd');
  const b = ch.betrouwbaarheid;
  const nachtdienst = ch.capaciteit.trekkers >= 8 ? 0.95 : bereikbaar(ctx.T) < 0.6 ? 0.6 : 0.95;
  let kansJa = beschikbaar ? 0.85 * nachtdienst * (1 - Math.min(0.5, 2 * b.annuleringen / Math.max(1, b.ritten))) * (ctx.lead < aanrij ? 0.4 : ctx.lead < aanrij + 60 ? 0.7 : 1) : 0.05;
  kansJa = clamp(kansJa, 0.03, 0.95);
  const wat = rit.soort === 'bakwagen' ? 'bakwagen' : rit.oplegger ? OPLEGGER_NAAM[rit.oplegger] : 'oplegger';
  const R = [beschikbaar ? `Charter, ${vrij} ${vrij === 1 ? 'trekker' : 'trekkers'} vrij ${ctx.dag}, rijdt met ${rit.soort === 'bakwagen' ? 'een bakwagen' : `een ${wat}`}` : `Charter, ${ctx.dag} vol (geen trekker vrij)`];
  R.push(`${String(b.opTijd).replace('.', ',')} % op tijd in 8 weken (${b.ritten} ritten, ${b.annuleringen} keer afgezegd)`);
  R.push(`zit in ${ch.plaats}, ${Math.round(afstand)} km van ${ctx.sp.n}${beschikbaar && ctx.lead < aanrij ? `; op zijn vroegst om ${hhmm(ctx.T + aanrij)} op de standplaats` : ''}`);
  if (ch.opmerking) R.push(/^[A-Z][a-z]/.test(ch.opmerking) ? ch.opmerking.charAt(0).toLowerCase() + ch.opmerking.slice(1) : ch.opmerking);
  const bedrag = ctx.uren * ch.tarief.perUur + ctx.km * ch.tarief.perKm;
  const goedkoop = clamp(1 - (ch.tarief.perUur - 45) / 20, 0, 1);
  const score = clamp(0.3 * kansJa + 0.3 * b.opTijd / 100 + 0.2 * (1 - 0.25 * W.length) + 0.2 * goedkoop, 0, 1) * (beschikbaar ? 1 : 0.3);
  return {
    soort: 'charter', id: ch.id, naam: ch.naam, score: r2(score), kans: r2(kansJa), redenen: R,
    uren: { gereden: null, over: null, naRit: null, week: null, weekMax: null },
    kosten: kosten(bedrag, `${uur(ctx.uren * 60)} x ${euro(ch.tarief.perUur)} + ${Math.round(ctx.km)} km x ${Math.round(ch.tarief.perKm * 100)} cent (charter, met trekker en chauffeur)`),
    tel: ch.tel, email: ch.email, contactpersoon: ch.contactpersoon, beschikbaar, waarschuwingen: W, voertuig: null, aanrij, vertrek: vertrekVan(ctx, aanrij), gesimuleerd: true,
  };
}

// Volgorde: eerst eigen chauffeurs, dan oproepkrachten, dan charters; binnen een groep wie beschikbaar is eerst, dan de
// hoogste score. Ten hoogste max.eigen, max.oproep en max.charter per groep.
export function rangschik({ eigen = [], oproep = [], charter = [] }, max = {}) {
  const M = { eigen: 5, oproep: 4, charter: 4, ...max };
  const sorteer = L => L.slice().sort((x, y) => (y.beschikbaar - x.beschikbaar) || (y.score - x.score) || (x.id < y.id ? -1 : 1));
  return [...sorteer(eigen).slice(0, M.eigen), ...sorteer(oproep).slice(0, M.oproep), ...sorteer(charter).slice(0, M.charter)];
}

// Toewijzen (puur): het nieuwe blok voor het planbord, een regel voor het logboek en het bericht aan de kandidaat. Verandert
// niets: de interface bewaart de toewijzing en geeft haar terug aan fleet.kandidaten (opts.toegewezen). Het blok begint bij
// het vertrek van deze kandidaat (k.vertrek: het venster, of later als hij er dan nog niet kan zijn).
export function toewijzing(ctx, k) {
  const { rit } = ctx; const off = ctx.dag === 'morgen' ? 1440 : 0;
  const eerste = rit.stops[0] ? rit.stops[0].name : rit.sp;
  const a = typeof k.vertrek === 'number' && k.vertrek >= ctx.a ? k.vertrek : ctx.a; const b = a + (ctx.b - ctx.a); const later = a > ctx.a + 0.5;
  const laden = later ? `Vertrek vanaf ${ctx.sp.n} om ${hhmm(a)}, zo snel als het kan (laadvenster ${hhmm(rit.venster[0])} tot ${hhmm(rit.venster[1])})` : `Laden in ${ctx.sp.n} tussen ${hhmm(rit.venster[0])} en ${hhmm(rit.venster[1])}`;
  const segment = {
    a, b, t0: a, t1: b, k: 'rit', bron: 'pool', rit: rit.id, label: `${rit.id} · ${eerste}${rit.stops.length > 1 ? ` +${rit.stops.length - 1}` : ''}`,
    klant: rit.klant, venster: [rit.venster[0] + off, rit.venster[1] + off], vertraging: 0, dock: null, dockSoort: null, plek: null, wacht: 0, los: null, ingevoegd: true,
    sp: rit.sp, div: rit.div, dag: ctx.dag, km: rit.km, duur: rit.duur, rij: rit.rij, stops: rit.stops.map(s => s.name),
    wie: { soort: k.soort, id: k.id, naam: k.naam }, voertuig: k.voertuig || null, oplegger: rit.oplegger, kosten: k.kosten, waarschuwingen: k.waarschuwingen.slice(),
  };
  const wieTekst = k.soort === 'eigen' ? 'eigen chauffeur' : k.soort === 'charter' ? 'charter' : (SOORTNAAM[k.sub] || 'oproepkracht').toLowerCase();
  const log = { t: ctx.T, soort: 'toewijzing', rit: rit.id, wie: k.id, tekst: `Open rit ${rit.id} (${ctx.sp.n}, venster ${hhmm(rit.venster[0])} tot ${hhmm(rit.venster[1])}${ctx.dag === 'morgen' ? ' morgen' : ''}) toegewezen aan ${k.naam} (${wieTekst}); kosten ongeveer ${euro(k.kosten.bedrag)} (schatting).${k.waarschuwingen.length ? ` Let op: ${k.waarschuwingen.map(w => WAARSCHUWING_KORT[w] || w).join(', ')}.` : ''}` };
  const voornaam = (k.soort === 'charter' ? k.contactpersoon || '' : k.naam).split(' ')[0];
  const wat = rit.soort === 'trekker' && rit.oplegger ? `, ${OPLEGGER_NAAM[rit.oplegger]}` : '';
  const tekst = k.soort === 'charter'
    ? `Hallo ${voornaam}, hebben jullie ${ctx.dag} een ${rit.soort === 'bakwagen' ? 'bakwagen' : 'trekker'} voor een rit vanaf Simon Loos ${ctx.sp.n}${wat}? ${laden}, ongeveer ${Math.round(rit.km)} km, ${rit.stops.length} ${rit.stops.length === 1 ? 'stop' : 'stops'}, terug rond ${hhmm(b)}. Graag een bevestiging met het kenteken en de naam van de chauffeur.`
    : `Hoi ${voornaam}, kun je ${ctx.dag} rit ${rit.id} rijden? ${laden}${wat}, ${rit.stops.length} ${rit.stops.length === 1 ? 'stop' : 'stops'}, ongeveer ${Math.round(rit.km)} km, terug rond ${hhmm(b)}. Laat je even weten of het lukt?`;
  return { rit: rit.id, wie: segment.wie, segment, log, bericht: { aan: k.tel || null, naam: k.naam, kanaal: k.soort === 'charter' ? 'telefoon of e-mail' : 'app', tekst }, kosten: k.kosten, waarschuwingen: segment.waarschuwingen, gesimuleerd: true };
}
