// De gesimuleerde wereld van het schadeportaal. Alles hier is verzonnen: kentekens, voertuigen, chauffeurs,
// opdrachtgevers, ritten, inspecties, foto's, claims, bedragen. Alleen de plaatsnamen zijn echt en de drie
// vestigingen van Breedijk (Opmeer, Nijkerk, Barneveld, volgens hun eigen site). De generator is deterministisch
// (vaste seed): elke keer dezelfde dag, zodat de demo en de tests hetzelfde zien.
//
// De vorm van elk record is die waarin echte data past: een voertuig heeft de velden van de RDW open data, een rit
// die van een TMS-order met inspecties in de opbouw van de AIAG/ECG-schadecodes, een claim die van een mail met
// uitgelezen velden en een calculatie. Zie ONTWERP.md, "Datamodel".
import { GEBIEDEN, SOORTEN, DAG, TEGENPARTIJ, kentekenToon, fmtEur, fmtDatumJ, fmtDatumTijd, zelfdePlek } from './regels.js';

// ---------- toeval met een vaste seed ----------
function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { const r = mulberry(typeof seed === 'number' ? seed : hash(String(seed))); return { f: r, i: (a, b) => a + Math.floor(r() * (b - a + 1)), p: x => r() < x, k: arr => arr[Math.floor(r() * arr.length)], w: pairs => { let t = 0; for (const p of pairs) t += p[1]; let x = r() * t; for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; } return pairs[pairs.length - 1][0]; } }; }

// ---------- de demo-dag ----------
// Een geijkte dag, zodat tellers en termijnen niet verlopen: vrijdag 6 november 2026, 09:40.
export const NU = new Date(2026, 10, 6, 9, 40).getTime();
// Een tijd uit de simulatie valt nooit na het moment van de demo (NU) en nooit voor de ondergrens `min`.
const voorNu = (x, min, R) => Math.max(min, Math.min(x, NU - R.i(25, 180) * 60000));
const d = (dagen, uur = 9, min = 0) => { const x = new Date(NU); x.setDate(x.getDate() - dagen); x.setHours(uur, min, 0, 0); return x.getTime(); };
const isWeekend = t => { const w = new Date(t).getDay(); return w === 0 || w === 6; };
const werkdagTerug = (t, n) => { let x = t; while (n > 0) { x -= DAG; if (!isWeekend(x)) n--; } while (isWeekend(x)) x -= DAG; return x; };

// ---------- vaste gegevens ----------
// volgens breedijktransport.nl (gelezen, 7 november 2026): hoofdkantoor De Veken 208 in Opmeer, het overslagterrein in Barneveld; Nijkerk als derde adres
export const VESTIGINGEN = { opmeer: { n: 'Opmeer', sub: 'hoofdkantoor', aandeel: 0.45 }, barneveld: { n: 'Barneveld', sub: 'overslagterrein', aandeel: 0.35 }, nijkerk: { n: 'Nijkerk', sub: 'vestiging', aandeel: 0.20 } };
export const OPDRACHTGEVERS = [
  { id: 'K-01', naam: 'Westfries Lease', soort: 'lease', plaats: 'Hoorn', btwAftrek: true, gewicht: 14, eerder: 0.55, stijl: 'formeel', rol: 'schadecoördinator' },
  { id: 'K-02', naam: 'FleetDirect Lease', soort: 'lease', plaats: 'Amersfoort', btwAftrek: true, gewicht: 12, eerder: 0.35, stijl: 'portaal', rol: 'fleetmanager' },
  { id: 'K-03', naam: 'Reitdiep Lease', soort: 'lease', plaats: 'Groningen', btwAftrek: true, gewicht: 6, eerder: 0.40, stijl: 'formeel', rol: 'schadecoördinator' },
  { id: 'K-04', naam: 'Autolease Midden', soort: 'lease', plaats: 'Utrecht', btwAftrek: true, gewicht: 8, eerder: 0.45, stijl: 'kort', rol: 'medewerker wagenpark' },
  { id: 'K-05', naam: 'Dealergroep Polder', soort: 'dealer', plaats: 'Lelystad', btwAftrek: true, gewicht: 10, eerder: 0.60, stijl: 'kort', rol: 'aftersales' },
  { id: 'K-06', naam: 'Autobedrijf De Kolk', soort: 'dealer', plaats: 'Alkmaar', btwAftrek: true, gewicht: 6, eerder: 0.70, stijl: 'kort', rol: 'verkoopleider' },
  { id: 'K-07', naam: 'Autocentrum Veluwe', soort: 'dealer', plaats: 'Apeldoorn', btwAftrek: true, gewicht: 7, eerder: 0.50, stijl: 'kort', rol: 'werkplaatschef' },
  { id: 'K-08', naam: 'Garage Zuidwal', soort: 'dealer', plaats: 'Purmerend', btwAftrek: true, gewicht: 3, eerder: 0.45, stijl: 'kort', rol: 'eigenaar' },
  { id: 'K-09', naam: 'Veilinghuis Autoflux', soort: 'veiling', plaats: 'Barneveld', btwAftrek: true, gewicht: 11, eerder: 0.30, stijl: 'portaal', rol: 'logistiek medewerker' },
  { id: 'K-10', naam: 'Remarketing Nederland', soort: 'remarketing', plaats: 'Nijkerk', btwAftrek: true, gewicht: 9, eerder: 0.40, stijl: 'formeel', rol: 'claims desk' },
  { id: 'K-11', naam: 'Noordzee Auto Import', soort: 'importeur', plaats: 'Amsterdam', btwAftrek: true, gewicht: 5, eerder: 0.25, stijl: 'formeel', rol: 'logistics coordinator' },
  { id: 'K-12', naam: 'Oosterhof Import', soort: 'importeur', plaats: 'Zwolle', btwAftrek: true, gewicht: 3, eerder: 0.35, stijl: 'kort', rol: 'inkoper' },
  { id: 'K-13', naam: 'Verhuur Kustlijn', soort: 'verhuur', plaats: 'Den Helder', btwAftrek: true, gewicht: 3, eerder: 0.50, stijl: 'kort', rol: 'vestigingsmanager' },
  { id: 'K-14', naam: 'Occasioncentrum Flevo', soort: 'dealer', plaats: 'Almere', btwAftrek: true, gewicht: 3, eerder: 0.55, stijl: 'kort', rol: 'verkoper' },
];
export const SOORT_OPDRACHTGEVER = { lease: 'Leasemaatschappij', dealer: 'Dealer', veiling: 'Veiling', remarketing: 'Remarketing', importeur: 'Importeur', verhuur: 'Verhuur' };
const PLAATSEN = ['Hoorn', 'Alkmaar', 'Purmerend', 'Zaandam', 'Amsterdam', 'Haarlem', 'Heerhugowaard', 'Den Helder', 'Enkhuizen', 'Schagen', 'Amersfoort', 'Utrecht', 'Nijkerk', 'Barneveld', 'Apeldoorn', 'Ede', 'Arnhem', 'Zwolle', 'Lelystad', 'Almere', 'Leeuwarden', 'Groningen', 'Deventer', 'Enschede', 'Nijmegen', 'Den Bosch', 'Tilburg', 'Eindhoven', 'Breda', 'Rotterdam', 'Den Haag', 'Leiden', 'Dordrecht', 'Gouda', 'Hilversum', 'Veenendaal', 'Harderwijk', 'Emmen', 'Assen', 'Middelburg', 'Venlo', 'Roermond', 'Heerenveen', 'Drachten', 'Zutphen'];
const MODELLEN = [
  ['Volkswagen', 'Polo', 1150, 25000, 'personenauto', 9], ['Volkswagen', 'Golf', 1300, 35000, 'personenauto', 7], ['Volkswagen', 'ID.3', 1800, 40000, 'personenauto', 4], ['Toyota', 'Yaris', 1100, 24000, 'personenauto', 7], ['Toyota', 'Corolla', 1350, 34000, 'personenauto', 4],
  ['Kia', 'Niro', 1500, 36000, 'personenauto', 6], ['Kia', 'Picanto', 950, 16000, 'personenauto', 5], ['Peugeot', '208', 1150, 24000, 'personenauto', 6], ['Peugeot', '2008', 1300, 32000, 'personenauto', 4], ['Renault', 'Clio', 1150, 22000, 'personenauto', 5],
  ['Opel', 'Corsa', 1150, 23000, 'personenauto', 5], ['Ford', 'Focus', 1350, 32000, 'personenauto', 3], ['Ford', 'Transit Custom', 2000, 42000, 'bedrijfsauto', 5], ['Volkswagen', 'Transporter', 2050, 48000, 'bedrijfsauto', 4], ['Mercedes-Benz', 'Vito', 2100, 50000, 'bedrijfsauto', 3],
  ['Tesla', 'Model 3', 1750, 45000, 'personenauto', 5], ['Tesla', 'Model Y', 1950, 50000, 'personenauto', 4], ['Hyundai', 'Kona', 1400, 34000, 'personenauto', 4], ['Skoda', 'Octavia', 1350, 36000, 'personenauto', 5], ['BMW', '3-serie', 1550, 55000, 'personenauto', 3],
  ['Audi', 'A3', 1350, 42000, 'personenauto', 3], ['Volvo', 'XC40', 1700, 48000, 'personenauto', 4], ['Mercedes-Benz', 'A-klasse', 1400, 40000, 'personenauto', 3], ['Fiat', '500', 950, 20000, 'personenauto', 3], ['Mini', 'Cooper', 1200, 32000, 'personenauto', 2],
  ['Nissan', 'Qashqai', 1450, 38000, 'personenauto', 3], ['Lynk & Co', '01', 1800, 42000, 'personenauto', 2], ['Polestar', '2', 2000, 50000, 'personenauto', 2], ['Renault', 'Kangoo', 1500, 30000, 'bedrijfsauto', 3], ['Citroën', 'C3', 1100, 22000, 'personenauto', 3],
];
const KLEUREN = [['grijs', 30], ['zwart', 22], ['wit', 18], ['blauw', 12], ['rood', 7], ['zilver', 4], ['groen', 3], ['beige', 2], ['bruin', 2]];
const VOORNAMEN = ['Kees', 'Jan', 'Piet', 'Henk', 'Sjaak', 'Youssef', 'Mehmet', 'Dennis', 'Jeroen', 'Marco', 'Rick', 'Tim', 'Bas', 'Daan', 'Sven', 'Niels', 'Ruud', 'Wim', 'Theo', 'Gerrit', 'Arjan', 'Patrick', 'Danny', 'Robin', 'Jordy', 'Mike', 'Kevin', 'Erik', 'Frank', 'Stefan', 'Lars', 'Thomas', 'Jesse', 'Sander', 'Mark', 'Ahmed', 'Bram', 'Joost', 'Nick', 'Wesley', 'Pieter', 'Hans', 'Ron', 'Leo', 'Cor', 'Ben', 'Dirk', 'Jaap', 'Maarten', 'Luuk', 'Anouk', 'Linda'];
const LETTERS = 'BDFGHJKLMNPRSTVWXZ';
const FOTOGEBIEDEN_OVERZICHT = ['overzicht_lv', 'overzicht_rv', 'overzicht_la', 'overzicht_ra'];
export const FOTOLABEL = { overzicht_lv: 'Overzicht linksvoor', overzicht_rv: 'Overzicht rechtsvoor', overzicht_la: 'Overzicht linksachter', overzicht_ra: 'Overzicht rechtsachter', dashboard: 'Dashboard, kilometerstand', vrachtbrief: 'Vrachtbrief', ...GEBIEDEN };
const ROLLEN_ONTVANGER = ['receptionist', 'magazijnmedewerker', 'werkplaatsmedewerker', 'fleetmanager', 'portier', 'verkoper', 'logistiek medewerker'];

// ---------- kenteken ----------
function kenteken(R, bouwjaar, soort) {
  const L = () => LETTERS[R.i(0, LETTERS.length - 1)]; const N = () => String(R.i(0, 9));
  if (soort === 'bedrijfsauto') return bouwjaar >= 2021 ? `V${L()}${L()}${N()}${N()}${L()}` : `V${N()}${N()}${N()}${L()}${L()}`;
  if (bouwjaar <= 2019) return `${L()}${L()}${N()}${N()}${N()}${L()}`;
  if (bouwjaar <= 2021) return `${L()}${N()}${N()}${N()}${L()}${L()}`;
  return `${L()}${L()}${L()}${N()}${N()}${L()}`;
}
let KLEUR_VOOR = null;
function voertuig(R) {
  const m = R.w(MODELLEN.map(x => [x, x[5]]));
  const bouwjaar = R.i(2016, 2024); const getrokken = R.w(KLEUREN); const kleur = (KLEUR_VOOR && KLEUR_VOOR(m[0], m[1])) || getrokken;
  const massa = m[2] + R.i(-40, 60); const cat = Math.round((m[3] * (0.85 + R.f() * 0.4)) / 100) * 100;
  const toelating = new Date(bouwjaar, R.i(0, 11), R.i(1, 28)).getTime();
  return { kenteken: kenteken(R, bouwjaar, m[4]), merk: m[0], model: m[1], kleur, bouwjaar, toelating, massa, catalogusprijs: cat, soort: m[4], km: R.i(12000, 160000) };
}

// ---------- chauffeurs ----------
function maakChauffeurs() {
  const R = rng('chauffeurs'); const L = [];
  const vest = Object.keys(VESTIGINGEN);
  for (let i = 0; i < 48; i++) {
    const v = R.w(vest.map(k => [k, VESTIGINGEN[k].aandeel]));
    const naam = `${VOORNAMEN[i % VOORNAMEN.length]} ${LETTERS[R.i(0, LETTERS.length - 1)]}.`;
    const sinds = new Date(R.i(2009, 2025), R.i(0, 11), 1).getTime();
    // ritten per werkdag (gesimuleerd): autotransport, meestal drie tot vier auto's per dag per chauffeur
    const tempo = 2.6 + R.f() * 1.8;
    // de kans op schade per rit verschilt per chauffeur; twee rijden merkbaar meer schade (het verhaal van de demo)
    const risico = i === 7 ? 3.2 : i === 19 ? 2.1 : i === 33 ? 1.6 : 0.6 + R.f() * 0.9;
    L.push({ id: `C-${String(i + 1).padStart(2, '0')}`, naam, vestiging: VESTIGINGEN[v].n, vestigingKey: v, sinds, tempo, risico, telefoon: `06 ${R.i(10, 59)} ${R.i(10, 99)} ${R.i(10, 99)} ${R.i(10, 99)}` });
  }
  return L;
}

// ---------- ritten ----------
// Negentig dagen ritten: ongeveer 800 per week, verdeeld over de werkdagen. Elke rit is een auto van A naar B met een
// chauffeur, een truck en een positie op de oplegger. De inspecties en foto's worden pas gemaakt als een dossier
// ze nodig heeft (ritDetail), uit een eigen seed per rit: zo blijft de start snel.
function maakRitten(chauffeurs) {
  const R = rng('ritten'); const L = []; let seq = 240131;
  const gewichtCh = chauffeurs.map(c => [c, c.tempo]);
  const gewichtK = OPDRACHTGEVERS.map(k => [k, k.gewicht]);
  for (let dag = 95; dag >= 0; dag--) {
    const t0 = d(dag, 0); if (isWeekend(t0)) continue;
    const n = R.i(150, 175);
    for (let j = 0; j < n; j++) {
      const ch = R.w(gewichtCh); const k = R.w(gewichtK); const v = voertuig(R);
      const ophaal = t0 + (R.i(6, 16) * 60 + R.i(0, 59)) * 60000;
      const dagenOnderweg = R.w([[0, 45], [1, 35], [2, 14], [3, 6]]);
      if (ophaal > NU - 45 * 60000) continue; // vandaag na dit uur: nog niet opgehaald
      let aflever = ophaal + dagenOnderweg * DAG + R.i(1, 6) * 3600000; while (isWeekend(aflever)) aflever += DAG;
      if (aflever > NU) aflever = Math.max(ophaal + 30 * 60000, NU - R.i(1, 90) * 60000);
      // de keten: ongeveer de helft van de auto's gaat eerst naar het overslagterrein in Barneveld (intake-controle) en
      // wordt daarna door een tweede chauffeur uitgeleverd; de aflevering is altijd bij de tegenpartij, nooit op eigen terrein
      let via = null, ch2 = null;
      if (R.p(0.45)) {
        const aankomst = ophaal + R.i(2, 9) * 3600000; let uit = aankomst + R.w([[1, 40], [2, 35], [3, 15], [4, 10]]) * DAG + R.i(1, 8) * 3600000; while (isWeekend(uit)) uit += DAG;
        if (uit < NU) { via = { plaats: 'Barneveld', naam: 'overslagterrein Breedijk', aankomst, vertrek: uit - R.i(2, 6) * 3600000 }; aflever = uit; ch2 = R.w(gewichtCh); if (ch2.id === ch.id) ch2 = null; }
      }
      const van = { plaats: k.soort === 'dealer' || k.soort === 'verhuur' ? k.plaats : R.k(PLAATSEN), naam: k.soort === 'lease' ? 'inleveradres berijder' : k.naam };
      const naar = { plaats: R.k(PLAATSEN.filter(x => x !== van.plaats)), naam: R.w([['dealer', 5], ['veiling', 3], ['schadeherstelbedrijf', 1], ['nieuwe berijder', 2], ['havenbedrijf', 1]]) };
      L.push({ id: `R-${seq++}`, order: `${k.id.replace('K-', 'O')}${R.i(10000, 99999)}`, k: k.id, kenteken: v.kenteken, merk: v.merk, model: v.model, kleur: v.kleur, bouwjaar: v.bouwjaar, toelating: v.toelating, massa: v.massa, catalogusprijs: v.catalogusprijs, soort: v.soort, km: v.km, ophaal, aflever, ch: ch.id, chauffeurNaam: ch.naam, vestiging: ch.vestiging, ch2: ch2 ? ch2.id : null, chauffeur2Naam: ch2 ? ch2.naam : null, truck: `BT-${R.i(11, 46)}`, positie: R.i(1, 8), van, via, naar });
    }
  }
  return L;
}
// Een rit voor een claim ouder dan de negentig dagen van de lijst: dezelfde vorm, met de datum van de claim.
function oudeRit(seed, chauffeurs, k, datumClaim) {
  const R = rng(seed); const ch = R.k(chauffeurs); const v = voertuig(R);
  const aflever = werkdagTerug(datumClaim - R.i(0, 9) * DAG, 0) - R.i(0, 8) * 3600000; const ophaal = aflever - R.w([[0, 45], [1, 35], [2, 14], [3, 6]]) * DAG - R.i(1, 6) * 3600000;
  const viaT = R.p(0.45); const ch2 = viaT ? R.k(chauffeurs.filter(x => x.id !== ch.id)) : null; const via = viaT ? { plaats: 'Barneveld', naam: 'overslagterrein Breedijk', aankomst: ophaal + R.i(2, 9) * 3600000, vertrek: aflever - R.i(2, 6) * 3600000 } : null;
  return { id: `R-${R.i(200000, 239999)}`, ch2: ch2 ? ch2.id : null, chauffeur2Naam: ch2 ? ch2.naam : null, via, order: `${k.id.replace('K-', 'O')}${R.i(10000, 99999)}`, k: k.id, kenteken: v.kenteken, merk: v.merk, model: v.model, kleur: v.kleur, bouwjaar: v.bouwjaar, toelating: v.toelating, massa: v.massa, catalogusprijs: v.catalogusprijs, soort: v.soort, km: v.km, ophaal, aflever, ch: ch.id, chauffeurNaam: ch.naam, vestiging: ch.vestiging, truck: `BT-${R.i(11, 46)}`, positie: R.i(1, 8), van: { plaats: R.k(PLAATSEN), naam: k.naam }, naar: { plaats: R.k(PLAATSEN), naam: 'dealer' }, oud: true };
}

// De details van een rit: de inspectie bij ophalen (gebruikte auto's hebben vaak al schade), de foto's met tijdstip,
// de inspectie en handtekening bij afleveren. Deterministisch per rit; een claim kan er iets aan "aanwijzen"
// (forceer) zodat het verhaal van het dossier klopt.
const GEBIED_KANS = [['bumper_voor', 14], ['bumper_achter', 16], ['portier_lv', 6], ['portier_la', 5], ['portier_rv', 6], ['portier_ra', 5], ['spatbord_lv', 4], ['spatbord_rv', 4], ['spatbord_la', 5], ['spatbord_ra', 5], ['velg_lv', 6], ['velg_rv', 6], ['velg_la', 4], ['velg_ra', 4], ['motorkap', 5], ['achterklep', 4], ['voorruit', 4], ['dak', 1], ['spiegel_l', 2], ['spiegel_r', 2], ['dorpel_l', 1], ['dorpel_r', 1], ['achterruit', 1], ['interieur', 1]];
const SOORT_BIJ = { velg: ['stoeprand', 'kras'], ruit: ['steenslag', 'barst'], spiegel: ['kras', 'gebroken'], anders: ['kras', 'deuk', 'lakschade', 'schaafplek', 'steenslag'] };
function soortVoor(R, gebied) { if (gebied.startsWith('velg')) return R.k(SOORT_BIJ.velg); if (gebied.endsWith('ruit')) return R.k(SOORT_BIJ.ruit); if (gebied.startsWith('spiegel')) return R.k(SOORT_BIJ.spiegel); return R.w([['kras', 40], ['deuk', 25], ['lakschade', 15], ['schaafplek', 12], ['steenslag', 8]]); }
export function ritDetail(r, forceer) {
  if (r._detail && !forceer) return r._detail;
  if (r.bron === 'import') { r._detail = { ...r, inspectieOphaal: [], inspectieAflever: [], fotos: [], aflevering: { rol: 'onbekend', voorbehoud: false, tekst: '' }, kmAflever: null, geenInspectie: true }; return r._detail; }
  const R = rng('detail' + r.id); const f = forceer || {};
  const leeftijd = 2026 - r.bouwjaar; const nOphaal = Math.min(5, Math.max(0, Math.round(R.f() * (1 + leeftijd * 0.4) + (r.km > 100000 ? 1 : 0))));
  const inspectieOphaal = [];
  for (let i = 0; i < nOphaal; i++) { const g = R.w(GEBIED_KANS); if (inspectieOphaal.some(x => x.gebied === g)) continue; inspectieOphaal.push({ gebied: g, soort: soortVoor(R, g), ernst: R.w([[1, 40], [2, 35], [3, 18], [4, 5], [5, 2]]) }); }
  if (f.eerder) { const i = inspectieOphaal.findIndex(x => x.gebied === f.eerder.gebied); if (i >= 0) inspectieOphaal[i] = f.eerder; else inspectieOphaal.unshift(f.eerder); }
  if (f.zonder) for (let i = inspectieOphaal.length - 1; i >= 0; i--) if (zelfdePlek(inspectieOphaal[i].gebied, f.zonder)) inspectieOphaal.splice(i, 1);
  // foto's bij ophalen: de vier hoeken, dashboard, vrachtbrief, en een detail per genoteerde schade; soms mist er een
  const fotos = []; let n = 1; const t = r.ophaal;
  const voeg = (moment, gebied, minuut) => fotos.push({ id: `F-${r.id.slice(2)}-${n++}`, moment, gebied, tijd: (moment === 'ophaal' ? r.ophaal : r.aflever) + minuut * 60000, label: FOTOLABEL[gebied] || gebied });
  FOTOGEBIEDEN_OVERZICHT.forEach((g, i) => voeg('ophaal', g, i)); voeg('ophaal', 'dashboard', 4); if (R.p(0.7)) voeg('ophaal', 'vrachtbrief', 5);
  inspectieOphaal.forEach((s, i) => { if (f.geenFoto === s.gebied) return; if (R.p(0.85)) voeg('ophaal', s.gebied, 6 + i); });
  if (f.fotoVan && !fotos.some(x => x.moment === 'ophaal' && x.gebied === f.fotoVan)) voeg('ophaal', f.fotoVan, 9);
  // het overslagterrein: bij de intake dezelfde controle; schade van de aanvoerrit staat er dan al op
  let inspectieTerrein = null;
  if (r.via) {
    inspectieTerrein = inspectieOphaal.map(s => ({ ...s }));
    if (f.nieuw && f.waar === 'aanvoer') inspectieTerrein.push({ ...f.nieuw });
    const voegT = (gebied, minuut) => fotos.push({ id: `F-${r.id.slice(2)}-${n++}`, moment: 'terrein', gebied, tijd: r.via.aankomst + minuut * 60000, label: FOTOLABEL[gebied] || gebied });
    FOTOGEBIEDEN_OVERZICHT.forEach((g, i) => voegT(g, 3 + i)); if (f.nieuw && f.waar === 'aanvoer') voegT(f.nieuw.gebied, 8);
  }
  // afleveren: twee tot vier overzichten, en wat de ontvanger aanwijst
  const inspectieAflever = inspectieOphaal.map(s => ({ ...s }));
  let aflevering = { rol: R.k(ROLLEN_ONTVANGER), voorbehoud: false, tekst: '' };
  if (f.nieuw) { inspectieAflever.push(f.nieuw); if (f.voorbehoud) aflevering = { rol: R.k(ROLLEN_ONTVANGER), voorbehoud: true, tekst: `${GEBIEDEN[f.nieuw.gebied]}: ${SOORTEN[f.nieuw.soort].toLowerCase()}, niet op de ophaalbon` }; }
  else if (R.p(0.06)) { const g = R.w(GEBIED_KANS); const s = { gebied: g, soort: soortVoor(R, g), ernst: 1 }; inspectieAflever.push(s); aflevering = { rol: aflevering.rol, voorbehoud: true, tekst: `${GEBIEDEN[g]}: kleine ${SOORTEN[s.soort].toLowerCase()}` }; }
  R.k(FOTOGEBIEDEN_OVERZICHT); FOTOGEBIEDEN_OVERZICHT.slice(0, R.i(2, 4)).forEach((g, i) => voeg('aflever', g, i)); if (aflevering.voorbehoud) voeg('aflever', inspectieAflever[inspectieAflever.length - 1].gebied, 5);
  const det = { ...r, inspectieOphaal, inspectieTerrein, inspectieAflever, fotos, aflevering: { ...aflevering, eigen: false }, kmAflever: r.km + R.i(0, 4) };
  r._detail = det; return det;
}

// ---------- claims ----------
const SCHADEKOSTEN = { kras: [250, 750], deuk: [550, 1400], lakschade: [900, 2600], schaafplek: [400, 1100], steenslag: [350, 1100], barst: [500, 1200], stoeprand: [160, 420], gebroken: [280, 700], ontbreekt: [300, 900] };
function calculatie(R, gebied, soort, ernst, voertuig) {
  const [a, b] = SCHADEKOSTEN[soort] || [400, 1200]; let basis = a + R.f() * (b - a); basis *= 0.7 + ernst * 0.18; if (voertuig.catalogusprijs > 42000) basis *= 1.3; if (gebied.startsWith('bumper') && ernst >= 4) basis *= 1.4;
  const uurtarief = R.w([[82, 2], [88, 3], [95, 4], [104, 3], [112, 2], [124, 1]]);
  const vervangen = ernst >= 4 ? R.p(0.8) : R.p(0.3); const dubbel = R.p(0.12); const btw = R.p(0.35);
  const uren = Math.max(0.5, Math.round((basis * 0.45 / uurtarief) * 2) / 2);
  const onderdelen = Math.round(basis * (vervangen ? 0.45 : 0.15) / 5) * 5; const lak = Math.round(basis * (dubbel ? 0.4 : 0.25) / 5) * 5;
  const netto = uren * uurtarief + onderdelen + lak; const totaal = Math.round((btw ? netto * 1.21 : netto) / 5) * 5;
  return { uren, uurtarief, onderdelen, lak, vervangen, dubbel, btw, totaal, bedrijf: R.k(['Schadeherstel Westland', 'Carrosserie Van Dijk', 'Autoschade Noord', 'Herstelbedrijf De Vaart', 'Lakcentrum Flevoland', 'Autoschade Veluwe']) };
}
function mailTekst(R, k, c, v) {
  const kt = kentekenToon(c.kenteken); const datum = fmtDatumJ(c.datumRit || c.datumClaim); const g = GEBIEDEN[c.gebied].toLowerCase(); const s = SOORTEN[c.soort].toLowerCase();
  const auto = `${v.merk} ${v.model} (${v.kleur})`; const bedrag = c.calculatie ? fmtEur(c.calculatie.totaal) : null;
  if (k.stijl === 'formeel') return `Geachte heer, mevrouw,\n\nOp ${datum} heeft Breedijk Transport in onze opdracht het voertuig ${auto} met kenteken ${kt} vervoerd (ons dossier ${c.extern}). Bij ontvangst is een ${s} op de ${g} vastgesteld die bij uitgifte niet aanwezig was. Wij stellen u hierbij aansprakelijk voor deze schade.\n\nBijgevoegd vindt u de foto's van de schade${bedrag ? ` en de calculatie van ${c.calculatie.bedrijf} ter hoogte van ${bedrag}` : ''}. Wij verzoeken u binnen tien werkdagen te reageren.\n\nMet vriendelijke groet,\n${k.rol}, ${k.naam}`;
  if (k.stijl === 'portaal') return `Automatisch bericht uit het schadeportaal van ${k.naam}.\n\nClaimnummer: ${c.extern}\nKenteken: ${kt}\nVoertuig: ${auto}\nTransportdatum: ${datum}\nSchade: ${g}, ${s}\nGeclaimd bedrag: ${bedrag || 'volgt'}\nBijlagen: ${c.bijlagen.length}\n\nReageer via het portaal of per e-mail onder vermelding van het claimnummer.`;
  const opgehaald = c.datumOphaal ? fmtDatumJ(c.datumOphaal) : datum;
  return `Hoi,\n\nJullie hebben ${opgehaald} een ${auto} bij ons opgehaald, kenteken ${kt}. Er zit een ${s} op de ${g} en die zat er bij ons niet op. Foto's in de bijlage${bedrag ? `, offerte van ${c.calculatie.bedrijf} erbij: ${bedrag}` : ''}. Hoor graag hoe jullie dit oplossen.\n\nGroet,\n${k.rol}, ${k.naam}`;
}
function maakClaims(ritten, chauffeurs) {
  const R = rng('claims'); const L = []; const kMap = new Map(OPDRACHTGEVERS.map(k => [k.id, k])); const chMap = new Map(chauffeurs.map(c => [c.id, c]));
  const rittenDoor = new Map(); for (const r of ritten) { if (!rittenDoor.has(r.ch)) rittenDoor.set(r.ch, []); rittenDoor.get(r.ch).push(r); }
  let seq = 1; const gebruikt = new Set();
  // 1) claims op ritten van de laatste negentig dagen: per rit een kans, gewogen met het risico van de chauffeur
  //    en de neiging van de opdrachtgever
  const kandidaten = [];
  for (const r of ritten) { const ch = chMap.get(r.ch); const k = kMap.get(r.k); const kans = 0.0085 * ch.risico * (k.soort === 'dealer' ? 1.25 : 1); if (R.p(kans) && r.aflever < NU - 2 * DAG) kandidaten.push(r); }
  // de drie chauffeurs met een verhaal: extra schades dicht op elkaar
  const verhaalRit = new Set();
  const extra = (chId, dagen) => { for (const dg of dagen) { const r = (rittenDoor.get(chId) || []).find(x => Math.abs(x.aflever - d(dg)) < 1.2 * DAG && !kandidaten.includes(x) && !verhaalRit.has(x)); if (r) { kandidaten.push(r); verhaalRit.add(r); } } };
  extra('C-08', [3, 5, 6]); extra('C-20', [20, 44, 71]); extra('C-34', [9, 61]);
  kandidaten.sort((a, b) => a.aflever - b.aflever);
  for (const r of kandidaten) {
    if (gebruikt.has(r.kenteken)) continue; gebruikt.add(r.kenteken);
    L.push(maakClaim(R, r, kMap.get(r.k), seq++, false, null, null, null, verhaalRit.has(r) ? 'nieuw_voorbehoud' : null));
  }
  // 2) oudere claims (tot een jaar terug), voor de cijfers; allemaal afgerond
  const perMaand = [38, 34, 41, 36, 33, 39, 44, 37, 35]; let i = 0;
  for (let m = 12; m >= 4; m--) { for (let j = 0; j < perMaand[m - 4]; j++) { const k = R.w(OPDRACHTGEVERS.map(x => [x, x.gewicht])); const datum = d(96 + (m - 4) * 30 + R.i(0, 29), R.i(8, 17), R.i(0, 59)); const r = oudeRit(`oud${i++}`, chauffeurs, k, datum); if (gebruikt.has(r.kenteken)) continue; gebruikt.add(r.kenteken); L.push(maakClaim(R, r, k, 0, true, datum)); } }
  // 3) claims zonder rit: niet door ons vervoerd
  for (let j = 0; j < 7; j++) { const k = R.w(OPDRACHTGEVERS.map(x => [x, x.gewicht])); const v = voertuig(R); const dagen = R.i(1, 80); L.push(maakClaim(R, null, k, 0, dagen > 60, d(dagen, R.i(8, 17), R.i(0, 59)), v)); }
  // 4) meldingen van chauffeurs zelf, zonder claim van de opdrachtgever (de voorkant van het proces)
  for (const dg of [0, 1, 4]) { const r = R.k(ritten.filter(x => Math.abs(x.aflever - d(dg)) < DAG && !gebruikt.has(x.kenteken))); if (!r) continue; gebruikt.add(r.kenteken); L.push(maakClaim(R, r, kMap.get(r.k), 0, false, null, null, 'chauffeur')); }
  // twee dossiers die te lang liggen (het verhaal van "over de termijn" op het overzicht)
  for (const c of maakVoertuigschades(ritten, chauffeurs)) L.push(c);
  const laat = L.filter(c => c.categorie === 'lading' && c.rit && c.bron === 'mail' && c.ontvangen < NU - 15 * DAG && c.ontvangen > NU - 24 * DAG && c.verhaal !== 'geen_rit').slice(0, 2);
  for (const c of laat) { c.status = 'onderzoek'; c.behandelaar = 'Ruben'; c.besluit = null; c.bedragVoorstel = null; c.beslotenOp = null; c.bedragUitkomst = null; c.log = c.log.slice(0, 3); }
  // vangnet: niets in een logboek, besluit, formulier of werkorder na het moment van de demo
  const grens = NU - 60000;
  for (const c of L) { for (const l of c.log || []) if (l.t > grens) l.t = grens; if (c.beslotenOp > grens) c.beslotenOp = grens; if (c.formulier && c.formulier.op > grens) c.formulier.op = grens; if (c.werkorder && c.werkorder.start > grens) c.werkorder.start = grens; }
  // nummeren op datum van ontvangst
  L.sort((a, b) => a.ontvangen - b.ontvangen); const teller = { 2025: 400 }; L.forEach(c => { const jaar = new Date(c.ontvangen).getFullYear(); teller[jaar] = (teller[jaar] || 0) + 1; c.id = `S-${jaar}-${String(teller[jaar]).padStart(4, '0')}`; });
  return L;
}
function maakClaim(R, r, k, seq, oud, datumOntvangen, losVoertuig, bron, forceerVerhaal) {
  const v = r ? { kenteken: r.kenteken, merk: r.merk, model: r.model, kleur: r.kleur, bouwjaar: r.bouwjaar, toelating: r.toelating, massa: r.massa, catalogusprijs: r.catalogusprijs, soort: r.soort, km: r.km } : losVoertuig;
  // het verhaal: zat de schade er al (eerder), is ze bij ons ontstaan (nieuw, met of zonder voorbehoud), of onduidelijk
  const verhaal = !r ? 'geen_rit' : bron === 'chauffeur' ? 'chauffeur' : forceerVerhaal || R.w([['eerder', k.eerder * 100], ['nieuw_voorbehoud', 22], ['nieuw_stil', 14], ['onduidelijk', 14]]);
  const gebied = R.w(GEBIED_KANS); const soort = soortVoor(R, gebied); const ernst = R.w([[1, 25], [2, 35], [3, 25], [4, 10], [5, 4], [6, 1]]);
  const schade = { gebied, soort, ernst };
  const fase = verhaal === 'eerder' || verhaal === 'geen_rit' ? null : forceerVerhaal ? R.k(['laden', 'rijden']) : R.w([['laden', 35], ['lossen', 35], ['rijden', soort === 'steenslag' ? 60 : 10], ['terrein', r && r.via ? 15 : 0], ['onbekend', 10]]);
  const waar = fase === 'laden' || fase === 'rijden' ? 'aanvoer' : 'na-terrein';
  const forceer = verhaal === 'eerder' ? { eerder: { ...schade, ernst: Math.max(1, ernst - R.i(0, 1)) } } : verhaal === 'nieuw_voorbehoud' ? { zonder: gebied, nieuw: schade, voorbehoud: true, waar } : verhaal === 'nieuw_stil' ? { zonder: gebied, nieuw: schade, voorbehoud: false, fotoVan: R.p(0.5) ? gebied : null, waar } : verhaal === 'onduidelijk' ? { zonder: gebied, geenFoto: gebied, waar } : verhaal === 'chauffeur' ? { zonder: gebied, nieuw: schade, voorbehoud: true, waar } : null;
  const det = r ? ritDetail(r, forceer) : null;
  // wie reed toen het gebeurde: bij het laden of onderweg de aanvoerchauffeur, bij het lossen de uitleverchauffeur (als er
  // een tweede rit was), op het terrein niemand in het bijzonder
  const dader = !r ? null : fase === 'terrein' ? null : fase === 'lossen' && r.ch2 ? { id: r.ch2, naam: r.chauffeur2Naam } : { id: r.ch, naam: r.chauffeurNaam };
  // een rit van voor de lijst van negentig dagen is alleen via de claim bereikbaar (ritVan)
  const oudeRit = r && r.oud ? det : undefined;
  const datumRit = r ? r.aflever : null;
  let ontvangen = datumOntvangen || (bron === 'chauffeur' ? r.aflever + R.i(5, 40) * 60000 : r.aflever + (forceerVerhaal ? R.i(0, 1) : R.w([[0, 20], [1, 30], [2, 18], [3, 10], [5, 8], [8, 7], [14, 5], [25, 2]])) * DAG + R.i(2, 9) * 3600000);
  // nooit in de toekomst: een mail van na de demo-dag bestaat nog niet
  if (ontvangen > NU) ontvangen = NU - R.i(15, 700) * 60000;
  while (isWeekend(ontvangen)) ontvangen += DAG;
  if (ontvangen > NU) ontvangen = werkdagTerug(NU, 0) - R.i(15, 700) * 60000;
  const heeftCalc = bron === 'chauffeur' ? false : R.p(0.78);
  const cal = heeftCalc ? calculatie(R, gebied, soort, ernst, v) : null;
  const bijlagen = []; const nFoto = bron === 'chauffeur' ? R.i(2, 4) : R.i(1, 4); for (let i = 1; i <= nFoto; i++) bijlagen.push({ soort: 'foto', naam: `IMG_${R.i(1000, 9999)}.jpg`, kb: R.i(900, 4200) }); if (cal) bijlagen.push({ soort: 'calculatie', naam: `calculatie-${kentekenToon(v.kenteken).replace(/-/g, '')}.pdf`, kb: R.i(80, 420) });
  const c = { seq, categorie: 'lading', bron: bron || 'mail', verhaal, kenteken: v.kenteken, voertuig: v, opdrachtgever: k, rit: r ? r.id : null, chauffeur: dader ? dader.id : null, chauffeurNaam: dader ? dader.naam : (r && fase === 'terrein' ? 'terrein Barneveld' : null), vestiging: r ? (fase === 'terrein' ? 'Barneveld' : r.vestiging) : null, gebied, soort, ernst, fase, datumRit, datumOphaal: r ? r.ophaal : null, datumClaim: ontvangen, ontvangen, calculatie: cal, bedragGevraagd: cal ? cal.totaal : null, bijlagen, extern: `${k.id.replace('K-', 'CL')}-${R.i(2400, 9800)}`, fotosClaimTonenSchade: verhaal === 'eerder' ? R.p(0.6) : true };
  if (oudeRit) c._oudeRit = oudeRit;
  c.onderwerp = bron === 'chauffeur' ? `Schademelding chauffeur ${r.chauffeurNaam}: ${kentekenToon(v.kenteken)}` : k.stijl === 'portaal' ? `[${k.naam}] Claim ${c.extern} ${kentekenToon(v.kenteken)}` : k.stijl === 'formeel' ? `Aansprakelijkstelling transportschade ${kentekenToon(v.kenteken)}, dossier ${c.extern}` : `Schade ${v.merk} ${v.model} ${kentekenToon(v.kenteken)}`;
  c.mail = bron === 'chauffeur' ? `Melding uit de chauffeursapp.\n\nBij het ${fase === 'laden' ? 'laden' : fase === 'terrein' ? 'rangeren op het terrein' : 'lossen'} ${GEBIEDEN[gebied].toLowerCase()} geraakt: ${SOORTEN[soort].toLowerCase()}. Direct foto's gemaakt en de ontvanger laten tekenen met voorbehoud. Positie ${r.positie}, ${r.truck}.` : mailTekst(R, k, c, v);
  // de uitgelezen velden, met zekerheid; soms iets om te controleren
  const twijfel = R.p(0.12);
  c.uitgelezen = { kenteken: { w: v.kenteken, z: twijfel ? 0.72 : 0.99, noot: twijfel ? 'Het kenteken staat twee keer in de mail, een keer zonder streepjes en met een 0 in plaats van een O.' : null }, datum: { w: datumRit || ontvangen, z: r ? 0.95 : 0.6 }, gebied: { w: gebied, z: 0.9 }, bedrag: { w: cal ? cal.totaal : null, z: cal ? 0.97 : 0 }, bijlagen: bijlagen.length };
  // status en logboek naar leeftijd en verhaal
  const leeftijdDagen = (NU - ontvangen) / DAG; const log = [];
  const L = (t, tekst, wie) => log.push({ t, tekst, wie: wie || 'systeem' });
  L(ontvangen, bron === 'chauffeur' ? 'Melding van de chauffeur binnengekomen uit de app' : `Mail ontvangen in schade@ van ${k.naam}`);
  if (r) L(ontvangen + 2 * 60000, `Rit ${r.id} gekoppeld op kenteken en datum (automatisch)`); else L(ontvangen + 2 * 60000, 'Geen rit gevonden op dit kenteken (automatisch)');
  const eind = verhaal === 'eerder' ? 'afgewezen' : verhaal === 'geen_rit' ? 'afgewezen' : verhaal === 'nieuw_voorbehoud' || verhaal === 'nieuw_stil' ? (cal && cal.totaal >= 1750 ? 'verzekeraar' : 'erkend') : 'erkend';
  const tussen = verhaal === 'onduidelijk' ? 'wacht_chauffeur' : (cal && (cal.uurtarief > 109 || cal.dubbel) ? 'wacht_tegenpartij' : 'onderzoek');
  let status, behandelaar = null, besluit = null, bedragVoorstel = null, beslotenOp = null;
  if (bron === 'chauffeur') { status = 'onderzoek'; behandelaar = 'Ilse'; L(ontvangen + 30 * 60000, 'Dossier aangemaakt voor als de claim komt', 'Ilse'); }
  else if (!forceerVerhaal && (leeftijdDagen < 1.2 || (leeftijdDagen < 4 && R.p(0.55)))) status = 'nieuw';
  else if (leeftijdDagen < 26 && R.p(leeftijdDagen < 12 ? 0.6 : 0.14)) { status = tussen; behandelaar = R.k(['Ilse', 'Ruben']); L(ontvangen + R.i(1, 40) * 3600000, `In onderzoek genomen door ${behandelaar}`, behandelaar); if (tussen === 'wacht_chauffeur') L(ontvangen + R.i(41, 70) * 3600000, `${r.chauffeurNaam} gevraagd wat hij zich herinnert van deze auto`, behandelaar); if (tussen === 'wacht_tegenpartij') L(ontvangen + R.i(41, 70) * 3600000, `Tegenvoorstel gestuurd aan ${k.naam}`, behandelaar); }
  else if (leeftijdDagen < 30 && R.p(0.5)) { status = eind === 'erkend' && R.p(0.4) ? 'wacht_tegenpartij' : eind; behandelaar = R.k(['Ilse', 'Ruben']); besluit = eind; beslotenOp = ontvangen + R.i(1, 6) * DAG; L(ontvangen + R.i(1, 30) * 3600000, `In onderzoek genomen door ${behandelaar}`, behandelaar); L(beslotenOp, eind === 'afgewezen' ? `Afgewezen met bewijs: ${r ? 'de ophaalinspectie en de foto\'s' : 'niet door ons vervoerd'}` : eind === 'verzekeraar' ? `Erkend en ingediend bij de verzekeraar (${fmtEur(cal.totaal)}, eigen risico 750 euro)` : `Erkend voor ${fmtEur(cal ? cal.totaal : 0)}`, behandelaar); }
  else { status = eind === 'verzekeraar' && leeftijdDagen < 75 ? 'verzekeraar' : (eind === 'afgewezen' ? 'afgewezen' : 'gesloten'); behandelaar = R.k(['Ilse', 'Ruben']); besluit = eind; beslotenOp = voorNu(ontvangen + R.i(1, 8) * DAG, ontvangen + 2 * 3600000, R); L(Math.min(ontvangen + R.i(1, 30) * 3600000, beslotenOp - 600000), `In onderzoek genomen door ${behandelaar}`, behandelaar); L(beslotenOp, eind === 'afgewezen' ? `Afgewezen met bewijs: ${r ? 'de ophaalinspectie en de foto\'s' : 'niet door ons vervoerd'}` : eind === 'verzekeraar' ? `Erkend en ingediend bij de verzekeraar (${fmtEur(cal.totaal)}, eigen risico 750 euro)` : `Erkend voor ${fmtEur(cal ? cal.totaal : 0)}`, behandelaar); if (status === 'gesloten') L(voorNu(beslotenOp + R.i(3, 20) * DAG, beslotenOp + 3600000, R), eind === 'verzekeraar' ? 'Verzekeraar heeft uitgekeerd; eigen risico verrekend' : 'Betaald en verrekend', 'systeem'); if (status === 'afgewezen' && R.p(0.5)) L(voorNu(beslotenOp + R.i(2, 12) * DAG, beslotenOp + 3600000, R), `${k.naam} laat weten de afwijzing te accepteren`, 'systeem'); }
  if (besluit === 'erkend' && cal && (cal.uurtarief > 104 || cal.dubbel)) { bedragVoorstel = Math.round(cal.totaal * 0.82 / 10) * 10; }
  c.status = status; c.behandelaar = behandelaar; c.besluit = besluit; c.bedragVoorstel = bedragVoorstel; c.beslotenOp = beslotenOp; c.log = log;
  c.bedragUitkomst = besluit === 'afgewezen' ? 0 : besluit ? (bedragVoorstel || (cal ? cal.totaal : 0)) : null;
  return c;
}

// ---------- ons wagenpark ----------
// Ruim veertig autotransporters (trekker met een oplegger met twee dekken; Breedijk noemt "ruim 40 transporters" en
// opleggers met een Kässbohrer Supertrans-opbouw, zoek). Nummers, kentekens, bouwjaren en kilometerstanden zijn
// gesimuleerd. Een vrachtwagen heeft een kenteken met een B in de lettergroep, een oplegger een kenteken dat met O begint.
const TREKKERS = [['Volvo', 'FM 460', 30], ['DAF', 'XF 480', 30], ['Scania', 'R 450', 25], ['Mercedes-Benz', 'Actros 1848', 15]];
// De werkplaats en de planning melden overdag, op een werkdag (07:00 tot 17:00).
function binnenWerktijd(t, R) {
  const d = new Date(t); const u = d.getHours();
  if (u < 7) d.setHours(7, R.i(0, 59)); else if (u >= 17) { d.setDate(d.getDate() + 1); d.setHours(7, R.i(10, 59)); }
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.getTime();
}
function maakVloot(chauffeurs) {
  const R = rng('vloot'); const L = []; const L2 = LETTERS; const ltr = () => L2[R.i(0, L2.length - 1)]; const cijfer = () => String(R.i(0, 9));
  const vest = Object.keys(VESTIGINGEN);
  for (let n = 11; n <= 52; n++) {
    const m = R.w(TREKKERS.map(x => [x, x[2]])); const v = R.w(vest.map(k => [k, VESTIGINGEN[k].aandeel]));
    const trekker = { id: `BT-${n}`, soort: 'trekker', merk: m[0], model: m[1], kenteken: `${cijfer()}${cijfer()}B${ltr()}${ltr()}${cijfer()}`, bouwjaar: 0, km: 0, massa: R.i(7400, 8200), vestiging: VESTIGINGEN[v].n, oplegger: `BO-${n}`, reserve: n > 46 };
    trekker.bouwjaar = R.i(2017, 2025); trekker.km = Math.round((2026.85 - trekker.bouwjaar) * R.i(95, 125)) * 1000; // 95.000 tot 125.000 km per jaar (schatting)
    const oplegger = { id: `BO-${n}`, soort: 'oplegger', merk: R.p(0.7) ? 'Kässbohrer' : 'Lohr', model: '', kenteken: `O${ltr()}${cijfer()}${cijfer()}${ltr()}${ltr()}`, bouwjaar: R.i(2015, 2025), km: null, massa: R.i(8600, 9800), vestiging: trekker.vestiging, trekker: trekker.id };
    oplegger.model = oplegger.merk === 'Kässbohrer' ? 'Supertrans' : 'Eurolohr';
    L.push(trekker, oplegger);
  }
  return L;
}
export const EIGEN = { id: 'K-00', naam: 'Breedijk, eigen materieel', soort: 'eigen', plaats: '', btwAftrek: true, stijl: 'kort', rol: 'chauffeur', gewicht: 0, eerder: 0 };

// ---------- aanrijschade en diverse schade ----------
// Wat Breedijk vertelde (7 november): aanrijschade aan de eigen vrachtwagen (een paal, een stoeprand, bij het inparkeren
// in de vakken langs de combinatie ernaast; negen van de tien herstelt de eigen werkplaats, een geschuurde zijkant van
// "richting de 10.000" gaat naar de verzekering), aanrijschade aan een derde (achteruit tegen een geparkeerde auto; soms
// merkt de chauffeur het niet en komt het via camerabeelden van de tegenpartij) en diverse schade (booster, sleutel;
// "bijna nooit"). Aantallen en bedragen zijn een schatting.
const OPL_GEBIEDEN = ['oplegger_l', 'oplegger_r', 'bovendek', 'oprijplaten', 'achterlicht'];
const EIGEN_KANS = [['oplegger_r', 14], ['oplegger_l', 12], ['zijscherm_r', 8], ['zijscherm_l', 7], ['bumper_voor', 8], ['cabine_voor', 6], ['spiegel_r', 8], ['spiegel_l', 6], ['oprijplaten', 9], ['achterlicht', 7], ['band', 8], ['cabine_r', 4], ['cabine_l', 3], ['bovendek', 2]];
function eigenZin(R, fase, gebied, plaats, klant) {
  const g = GEBIEDEN[gebied].toLowerCase();
  if (fase === 'terrein') return R.k([`Bij het inparkeren in de vakken op het terrein in ${plaats} te vroeg ingestuurd en met de ${g} langs de combinatie ernaast geschuurd.`, `Bij het rangeren op het terrein in ${plaats} achteruit tegen een lichtmast; ${g} beschadigd.`, `Op het terrein in ${plaats} bij het keren de ${g} tegen de paal van de slagboom.`]);
  if (fase === 'rijden') return gebied === 'band' ? R.k([`Bij het afslaan in ${plaats} de stoeprand geraakt; band en velg beschadigd.`, `Op een rotonde bij ${plaats} over de rand gereden; band rechtsachter kapot.`]) : R.k([`In ${plaats} in een smalle straat langs een paaltje; ${g} beschadigd.`, `Bij ${plaats} een overhangende tak geraakt; ${g} beschadigd.`, `Bij het keren in ${plaats} tegen een verkeersbord; ${g} beschadigd.`]);
  return R.k([`Bij het ${fase === 'laden' ? 'laden' : 'lossen'} bij ${klant} met de ${g} tegen het hek van het terrein.`, `Bij het ${fase === 'laden' ? 'laden' : 'lossen'} bij ${klant} achteruit gestoken en de ${g} tegen een betonnen paal.`]);
}
function maakVoertuigschades(ritten, chauffeurs) {
  const R = rng('voertuigschades'); const L = []; const vloot = maakVloot(chauffeurs); const trekkers = vloot.filter(v => v.soort === 'trekker' && !v.reserve); const vMap = new Map(vloot.map(v => [v.id, v]));
  const chW = chauffeurs.map(ch => [ch, ch.risico]); let wo = 2400, tp = 1;
  const dagMet = dg => { let t = d(dg, R.i(6, 18), R.i(0, 59)); while (isWeekend(t) || t > NU - 3 * 3600000) t -= DAG; return t; };
  const ritBij = (truck, t) => ritten.find(r => r.truck === truck.id && Math.abs(r.ophaal - t) < 0.8 * DAG) || ritten.find(r => r.truck === truck.id && r.ophaal <= t && r.aflever >= t - 3600000) || null;
  const logboek = (c, regels) => { c.log = regels.map(([t, tekst, wie]) => ({ t, tekst, wie: wie || 'systeem' })); };
  const statusNaarLeeftijd = (c, moment, opties) => {
    const dagen = (NU - c.ontvangen) / DAG; const beh = R.k(['Ilse', 'Ruben']); c.behandelaar = null; c.besluit = null; c.bedragVoorstel = null; c.beslotenOp = null; c.bedragUitkomst = null;
    const log = [[c.ontvangen, c.melding.door === 'chauffeur' ? 'Melding van de chauffeur uit de app' : c.melding.door === 'tegenpartij' ? `Mail ontvangen in schade@ van ${c.opdrachtgever.naam}` : c.melding.door === 'planner' ? 'Schade gevonden bij de controle na de rit en gemeld' : 'Schade gevonden in de werkplaats en gemeld']];
    if (c.rit) log.push([c.ontvangen + 90000, c.chauffeur || !c.vermoedelijk ? `Rit ${c.rit} gekoppeld op voertuig en moment (automatisch)` : `Laatste rit van ${c.eigenVoertuig}: ${c.rit} (automatisch)`]);
    if (c.gps) log.push([c.ontvangen + 120000, c.gps.gevonden ? `Telematica: ${c.gps.voertuig} was op ${c.gps.afstand} m van de plek (automatisch)` : 'Telematica: geen voertuig van ons in de buurt (automatisch)']);
    const navraag = t0 => { if (c.chauffeur || !c.vermoedelijk || !R.p(0.75)) return; c.chauffeur = c.vermoedelijk.id; c.chauffeurNaam = c.vermoedelijk.naam; log.push([voorNu(t0 + R.i(1, 6) * 3600000, t0 + 60000, R), `Navraag gedaan: ${c.chauffeurNaam} reed als laatste en herkent de schade; dossier aan de chauffeur gekoppeld`, beh]); };
    if (dagen < opties.nieuwTot) { c.status = 'nieuw'; c.formulier.status = c.melding.door === 'chauffeur' && R.p(0.5) ? 'ontvangen' : 'niet'; if (c.formulier.status === 'ontvangen') c.formulier.op = voorNu(c.ontvangen + R.i(1, 6) * 3600000, c.ontvangen + 300000, R); }
    else if (dagen < opties.openTot) {
      c.behandelaar = beh; const inOnd = voorNu(c.ontvangen + R.i(2, 20) * 3600000, c.ontvangen + 300000, R); log.push([inOnd, `In onderzoek genomen door ${beh}`, beh]); navraag(inOnd);
      const k = opties.open(); c.status = k.status; c.besluit = k.besluit || null; c.formulier.status = c.chauffeur || c.categorie === 'derde' ? k.formulier : 'niet';
      if (!c.chauffeur && c.categorie === 'eigen' && c.status === 'wacht_chauffeur') c.status = 'onderzoek';
      if (c.formulier.status !== 'niet') { c.formulier.op = voorNu(c.ontvangen + R.i(4, 30) * 3600000, inOnd + 60000, R); log.push([c.formulier.op, c.formulier.status === 'gevraagd' ? `Schadeformulier gevraagd aan ${c.chauffeurNaam || 'de chauffeur'}` : `Schadeformulier ontvangen van ${c.chauffeurNaam || 'de chauffeur'}`, c.formulier.status === 'gevraagd' ? beh : 'systeem']); }
      if (k.log) { const tl = voorNu(c.ontvangen + R.i(1, 4) * DAG, Math.max(inOnd, c.formulier.op || 0) + 60000, R); log.push([tl, k.log, beh]); if (k.besluit) { c.beslotenOp = tl; c.bedragUitkomst = k.besluit === 'afgewezen' ? 0 : c.bedragGevraagd; } }
    }
    else {
      c.behandelaar = beh; const inOnd = voorNu(c.ontvangen + R.i(2, 20) * 3600000, c.ontvangen + 300000, R); log.push([inOnd, `In onderzoek genomen door ${beh}`, beh]); navraag(inOnd);
      const k = opties.oud(); c.status = k.status; c.besluit = k.besluit; c.beslotenOp = voorNu(c.ontvangen + R.i(1, 6) * DAG, inOnd + 3 * 3600000, R); c.bedragUitkomst = k.besluit === 'afgewezen' ? 0 : c.bedragGevraagd; log.push([c.beslotenOp, k.log, beh]);
      if (c.chauffeur && c.categorie !== 'divers' && k.besluit !== 'afgewezen') { c.formulier.status = 'ontvangen'; c.formulier.op = Math.max(inOnd + 60000, Math.min(c.ontvangen + R.i(4, 40) * 3600000, c.beslotenOp - 600000)); log.push([c.formulier.op, `Schadeformulier ontvangen van ${c.chauffeurNaam}`]); }
      if (k.slot) log.push([voorNu(c.beslotenOp + R.i(4, 25) * DAG, c.beslotenOp + 3600000, R), k.slot]);
    }
    if (c.werkorder && (c.status === 'werkplaats' || c.status === 'gesloten') && c.besluit === 'werkplaats') { c.werkorder.status = c.status === 'gesloten' ? 'klaar' : R.k(['gepland', 'in reparatie']); c.werkorder.start = voorNu((c.beslotenOp || c.ontvangen) + DAG, (c.beslotenOp || c.ontvangen) + 60000, R); }
    else if (c.werkorder && c.besluit !== 'werkplaats') { if (c.besluit === 'verzekeraar') c.werkorder.status = c.status === 'gesloten' ? 'klaar, via de verzekeraar' : 'wacht op de expert'; else c.werkorder = null; }
    logboek(c, log.sort((a, b) => a[0] - b[0]));
  };
  // ---- aanrijschade eigen voertuig: ongeveer zes per maand
  for (let i = 0; i < 78; i++) {
    const dg = R.p(0.09) ? R.i(0, 20) : R.i(21, 364); const t = dagMet(dg); const truck = R.k(trekkers); const r = ritBij(truck, t);
    const ch = r ? chauffeurs.find(x => x.id === r.ch) : R.w(chW);
    const fase = R.w([['terrein', 40], ['rijden', 30], ['laden', 15], ['lossen', 15]]);
    const gebied = R.w(EIGEN_KANS); const soort = gebied === 'band' ? 'stoeprand' : gebied.startsWith('spiegel') ? R.k(['gebroken', 'kras']) : R.w([['deuk', 35], ['schaafplek', 30], ['kras', 25], ['gebroken', 10]]);
    const groot = R.p(0.13); const bedrag = groot ? Math.round(R.i(5200, 14500) / 50) * 50 : Math.round((R.p(0.65) ? R.i(250, 1500) : R.i(1500, 4800)) / 10) * 10;
    const opDeOpl = OPL_GEBIEDEN.includes(gebied); const v = opDeOpl ? vMap.get(truck.oplegger) : truck;
    const klant = r ? (OPDRACHTGEVERS.find(k => k.id === r.k) || {}).naam || 'een klant' : 'een klant';
    const door = R.w([['chauffeur', 80], ['werkplaats', 15], ['planner', 5]]); const onbekend = door !== 'chauffeur';
    const plaats = onbekend ? null : fase === 'terrein' ? (truck.vestiging === 'Opmeer' ? 'Opmeer' : 'Barneveld') : (r ? (fase === 'lossen' ? r.naar.plaats : r.van.plaats) : R.k(PLAATSEN)); const uurNa = door === 'chauffeur' ? R.w([[0.3, 50], [2, 25], [8, 12], [30, 8], [72, 5]]) : R.i(24, 96);
    let ontvangen = t + uurNa * 3600000; if (door !== 'chauffeur') ontvangen = binnenWerktijd(ontvangen, R); if (ontvangen > NU - 600000) ontvangen = Math.max(t + 10 * 60000, NU - R.i(20, 300) * 60000);
    // werkplaats: 75 euro per uur (schatting); een grote schade is vooral plaatwerk en onderdelen, 15 tot 25 uur
    const uurtarief = 75; const uren = Math.max(1, Math.min(groot ? 25 : 12, Math.round(bedrag * (groot ? 0.12 : 0.3) / uurtarief))); const onderdelen = Math.round(bedrag * (groot ? 0.6 : 0.45) / 5) * 5; const lak = Math.max(0, bedrag - uren * uurtarief - onderdelen);
    const c = { categorie: 'eigen', seq: 0, bron: door === 'chauffeur' ? 'chauffeur' : 'handmatig', verhaal: groot ? 'eigen_groot' : 'eigen_klein', kenteken: v.kenteken, voertuig: { kenteken: v.kenteken, merk: v.merk, model: v.model, kleur: 'wit', bouwjaar: v.bouwjaar, toelating: null, massa: v.massa, catalogusprijs: null, soort: v.soort, km: v.km },
      eigenVoertuig: truck.id, oplegger: truck.oplegger, opdrachtgever: EIGEN, rit: r ? r.id : null, chauffeur: onbekend ? null : ch.id, chauffeurNaam: onbekend ? null : ch.naam, vermoedelijk: onbekend ? { id: ch.id, naam: ch.naam } : null, vestiging: truck.vestiging, gebied, soort, ernst: groot ? 5 : R.i(2, 4), fase: onbekend ? 'onbekend' : fase, plaats, moment: t, datumRit: t, datumClaim: ontvangen, ontvangen,
      calculatie: { uren, uurtarief, onderdelen, lak, vervangen: groot, dubbel: false, btw: false, totaal: bedrag, bedrijf: groot ? 'offerte van een herstelbedrijf voor bedrijfswagens' : 'raming van onze werkplaats' }, bedragGevraagd: bedrag, extern: '',
      melding: { door, uurNa }, formulier: { soort: 'eenzijdig', status: 'niet', op: null }, werkorder: { nummer: `WO-${wo++}`, status: 'gepland', uren, onderdelen, stilstand: groot ? R.i(5, 14) : R.w([[0, 30], [1, 40], [2, 20], [4, 10]]), start: null },
      bijlagen: Array.from({ length: R.i(2, 4) }, () => ({ soort: 'foto', naam: `IMG_${R.i(1000, 9999)}.jpg`, kb: R.i(900, 4200) })), fotosClaimTonenSchade: true };
    const zin = eigenZin(R, fase, gebied, plaats, klant);
    c.onderwerp = door === 'chauffeur' ? `Aanrijschade ${truck.id}: ${GEBIEDEN[gebied].toLowerCase()}` : `Schade gevonden aan ${opDeOpl ? truck.oplegger : truck.id}: ${GEBIEDEN[gebied].toLowerCase()}`;
    c.mail = door === 'chauffeur' ? `Melding uit de chauffeursapp, ${truck.id} met ${truck.oplegger}.\n\n${zin} Foto's gemaakt. Geen andere partij betrokken.\n\n${ch.naam}` : `Melding van de ${door === 'werkplaats' ? 'werkplaats' : 'planning'}.\n\nBij ${door === 'werkplaats' ? 'het onderhoud' : 'de controle na de rit'} van ${opDeOpl ? truck.oplegger : truck.id} schade gevonden: ${GEBIEDEN[gebied].toLowerCase()}, ${SOORTEN[soort].toLowerCase()}. Niet gemeld door een chauffeur. Laatste rit volgens de planning: ${ch.naam.replace(/\.$/, '')}.`;
    c.uitgelezen = { kenteken: { w: truck.kenteken, z: 0.99 }, datum: { w: t, z: 0.95 }, gebied: { w: gebied, z: 0.9 }, bedrag: { w: bedrag, z: 0.95 }, bijlagen: c.bijlagen.length };
    statusNaarLeeftijd(c, t, { nieuwTot: 1.5, openTot: groot ? 30 : 12,
      open: () => groot ? (R.p(0.6) ? { status: 'verzekeraar', besluit: 'verzekeraar', formulier: 'ontvangen', log: `Gemeld bij de cascoverzekeraar (${fmtEur(bedrag)})` } : { status: 'wacht_chauffeur', formulier: 'gevraagd' }) : R.w([[{ status: 'werkplaats', besluit: 'werkplaats', formulier: 'ontvangen', log: `Werkorder ${c.werkorder.nummer} voor onze werkplaats` }, 60], [{ status: 'wacht_chauffeur', formulier: 'gevraagd' }, 30], [{ status: 'onderzoek', formulier: 'niet' }, 10]]),
      oud: () => groot ? { status: 'gesloten', besluit: 'verzekeraar', log: `Gemeld bij de cascoverzekeraar (${fmtEur(bedrag)})`, slot: 'Uitkering van de cascoverzekeraar ontvangen; eigen risico verrekend' } : { status: 'gesloten', besluit: 'werkplaats', log: `Werkorder ${c.werkorder.nummer} voor onze werkplaats`, slot: `Werkorder ${c.werkorder.nummer} gereed; voertuig terug in de planning` } });
    L.push(c);
  }
  // ---- aanrijschade derde: ongeveer twee per maand
  for (let i = 0; i < 26; i++) {
    const dg = i < 3 ? R.i(0, 24) : R.i(25, 364); const t = dagMet(dg); const truck = R.k(trekkers); const r = ritBij(truck, t);
    const ch = r ? chauffeurs.find(x => x.id === r.ch) : R.w(chW);
    const wat = R.w([['geparkeerd', 40], ['rijdend', 15], ['hek', 15], ['gebouw', 15], ['paal', 15]]); const auto = wat === 'geparkeerd' || wat === 'rijdend';
    const fase = wat === 'gebouw' || wat === 'hek' ? R.k(['laden', 'lossen']) : R.w([['rijden', 70], ['laden', 15], ['lossen', 15]]);
    const klantK = r ? OPDRACHTGEVERS.find(k => k.id === r.k) : R.k(OPDRACHTGEVERS);
    const bijKlant = fase === 'laden' || fase === 'lossen'; const plaats = r ? (fase === 'lossen' ? r.naar.plaats : r.van.plaats) : R.k(PLAATSEN);
    const particulier = auto && R.p(0.75); const naam = particulier ? `Particulier in ${plaats}` : bijKlant ? klantK.naam : `Bedrijf in ${plaats}`;
    const gevonden = R.p(0.85); const doorChauffeur = R.p(0.45) && gevonden; const bw = doorChauffeur ? R.w([['fotos', 70], ['geen', 30]]) : R.w([['camera', 45], ['fotos', 45], ['geen', 10]]);
    const ander = R.k(trekkers.filter(x => x.id !== truck.id));
    const gps = gevonden ? { gevonden: true, voertuig: truck.id, tijd: t, afstand: R.i(4, 45), snelheid: R.i(2, 9), richting: wat === 'rijdend' ? 'vooruit' : R.w([['achteruit', 65], ['vooruit', 35]]) } : { gevonden: false, voertuig: ander.id, tijd: t, afstand: R.i(4, 60) * 1000, snelheid: R.i(40, 85), richting: 'vooruit' };
    { // posities rond het moment: de afstand volgt uit de snelheid (km/u x 1000 / 60 = meter per minuut)
      const mins = [-4, -2, -1, 0, 1, 3]; const v = gevonden ? { '-4': R.i(18, 32), '-2': R.i(8, 16), '-1': R.i(3, 8), 0: gps.snelheid, 1: R.i(3, 9), 3: R.i(18, 32) } : Object.fromEntries(mins.map(m => [m, R.i(62, 85)]));
      const mpm = x => x * 1000 / 60; const afst = { 0: gps.afstand };
      if (gevonden) { for (const [a, b] of [[0, -1], [-1, -2], [-2, -4], [0, 1], [1, 3]]) afst[b] = Math.round(afst[a] + Math.abs(b - a) * mpm((v[a] + v[b]) / 2)); }
      else { let x = gps.afstand; for (const m of mins) { afst[m] = Math.round(x); x += mpm(v[m]) * 1.2; } }
      gps.punten = mins.map(m => ({ t: t + m * 60000, afstand: afst[m], snelheid: v[m] }));
    }
    const tv = auto ? voertuig(R) : { kenteken: '', merk: TEGENPARTIJ[wat], model: '', kleur: '', bouwjaar: null, toelating: null, massa: null, catalogusprijs: null, soort: 'object', km: null };
    const gebied = auto ? R.w([['bumper_voor', 25], ['bumper_achter', 20], ['portier_lv', 12], ['portier_rv', 12], ['spatbord_lv', 10], ['spatbord_rv', 10], ['spiegel_l', 6], ['spiegel_r', 5]]) : 'object';
    const soort = R.w([['deuk', 40], ['kras', 30], ['schaafplek', 15], ['gebroken', 15]]); const bedrag = auto ? Math.round(R.i(350, 4200) / 5) * 5 : Math.round(R.i(250, 3200) / 10) * 10;
    let ontvangen = t + (doorChauffeur ? R.i(10, 120) * 60000 : R.w([[1, 40], [2, 30], [4, 20], [8, 10]]) * DAG + R.i(1, 8) * 3600000); while (isWeekend(ontvangen)) ontvangen += DAG; if (ontvangen > NU - 600000) ontvangen = Math.max(t + 10 * 60000, NU - R.i(20, 600) * 60000);
    const tpObj = { id: `T-${String(tp++).padStart(3, '0')}`, naam, soort: 'derde', plaats, btwAftrek: !particulier, stijl: particulier ? 'kort' : 'formeel', rol: particulier ? 'eigenaar' : wat === 'gebouw' || wat === 'hek' ? 'facilitair medewerker' : 'wagenparkbeheerder', gewicht: 0, eerder: 0 };
    const cal = bedrag ? (() => { const uurtarief = R.w([[88, 3], [95, 4], [112, 2]]); const uren = Math.max(1, Math.round(bedrag * 0.4 / uurtarief * 2) / 2); let onderdelen = Math.round(bedrag * 0.3 / 5) * 5; let lak = bedrag - uren * uurtarief - onderdelen; if (lak < 0) { onderdelen = Math.max(0, onderdelen + lak); lak = 0; } return { uren, uurtarief, onderdelen, lak, vervangen: false, dubbel: false, btw: false, totaal: uren * uurtarief + onderdelen + lak, bedrijf: auto ? 'een schadeherstelbedrijf' : 'een aannemer' }; })() : null;
    const c = { categorie: 'derde', seq: 0, bron: doorChauffeur ? 'chauffeur' : 'mail', verhaal: gevonden ? 'derde_raak' : 'derde_niet', kenteken: tv.kenteken, voertuig: tv, eigenVoertuig: gevonden ? truck.id : null, oplegger: gevonden ? truck.oplegger : null, opdrachtgever: tpObj,
      tegenpartij: { wat, partij: particulier ? 'particulier' : 'bedrijf', naam, aanwezig: wat === 'rijdend', gegevens: !doorChauffeur || wat === 'rijdend' }, rit: gevonden && r ? r.id : null, chauffeur: gevonden ? ch.id : null, chauffeurNaam: gevonden ? ch.naam : null, vestiging: truck.vestiging,
      gebied, soort, ernst: R.i(2, 4), fase, plaats, moment: t, datumRit: t, datumClaim: ontvangen, ontvangen, calculatie: cal, bedragGevraagd: bedrag, extern: '',
      melding: { door: doorChauffeur ? 'chauffeur' : 'tegenpartij', uurNa: (ontvangen - t) / 3600000 }, formulier: { soort: wat === 'rijdend' ? 'europees' : 'eenzijdig', status: 'niet', op: null }, gps, bewijsTegenpartij: bw,
      bijlagen: bw === 'geen' ? [] : [...Array.from({ length: R.i(1, 3) }, () => ({ soort: 'foto', naam: `IMG_${R.i(1000, 9999)}.jpg`, kb: R.i(900, 4200) })), ...(bw === 'camera' ? [{ soort: 'video', naam: `beelden-${R.i(100, 999)}.mp4`, kb: R.i(8000, 42000) }] : []), ...(cal ? [{ soort: 'calculatie', naam: 'offerte.pdf', kb: R.i(80, 400) }] : [])], fotosClaimTonenSchade: true };
    const wanneer = `${fmtDatumJ(t)} rond ${new Date(t).getHours()}:${String(new Date(t).getMinutes()).padStart(2, '0')}`;
    const watZin = auto ? (wat === 'geparkeerd' ? 'mijn geparkeerde auto' : 'mijn auto') : wat === 'hek' ? 'ons hek' : wat === 'gebouw' ? 'ons laadperron' : 'een paal bij ons pand';
    c.onderwerp = doorChauffeur ? `Aanrijschade derde: ${TEGENPARTIJ[wat].toLowerCase()}, ${plaats}` : auto ? 'Schade aan mijn auto door uw vrachtwagen' : `Schade aan ${watZin} door een vrachtwagen van Breedijk`;
    c.mail = doorChauffeur ? `Melding uit de chauffeursapp, ${truck.id}.\n\nBij het ${gps.richting === 'achteruit' ? 'achteruitrijden' : 'manoeuvreren'} in ${plaats} ${auto ? `een ${wat === 'geparkeerd' ? 'geparkeerde ' : ''}${tv.merk} ${tv.model} geraakt` : TEGENPARTIJ[wat].toLowerCase() + ' geraakt'}; ${GEBIEDEN[gebied].toLowerCase()}, ${SOORTEN[soort].toLowerCase()}. ${wat === 'rijdend' ? 'Europees schadeformulier samen ingevuld.' : auto ? 'Briefje met onze gegevens achtergelaten.' : 'Gemeld bij de receptie.'}\n\n${ch.naam}` :
      `${particulier ? 'Goedemiddag,' : 'Geachte heer, mevrouw,'}\n\nOp ${wanneer} heeft een vrachtwagen van Breedijk Transport ${gps.richting === 'achteruit' ? 'bij het achteruitrijden ' : ''}${watZin} geraakt, in ${plaats}. ${bw === 'camera' ? (gevonden ? `Ik heb het teruggezien op ${particulier ? 'de beelden van de deurbelcamera' : 'onze camerabeelden'}: het logo en het kenteken ${kentekenToon(truck.kenteken)} zijn goed te zien.` : `Op ${particulier ? 'de beelden van de deurbelcamera' : 'onze camerabeelden'} is een autotransporter te zien; de naam op de oplegger lijkt Breedijk, het kenteken is niet te lezen.`) : 'Een buurman zag het gebeuren en noteerde de naam op de oplegger.'} ${auto ? `Het gaat om de ${GEBIEDEN[gebied].toLowerCase()}.` : ''}${bw !== 'geen' ? ' Foto\'s in de bijlage' : ''}${cal ? `, met een offerte van ${fmtEur(bedrag)}` : ''}.\n\n${particulier ? 'Ik hoor graag hoe u dit oplost.' : 'Wij verzoeken u de schade te vergoeden.'}\n\nMet vriendelijke groet,\n${particulier ? 'de eigenaar van de auto' : `${tpObj.rol}, ${naam}`}`;
    const metKenteken = doorChauffeur || (bw === 'camera' && gevonden);
    c.uitgelezen = { kenteken: { w: metKenteken ? truck.kenteken : '', z: metKenteken ? 0.97 : 0, noot: metKenteken ? null : 'Geen kenteken in de mail, alleen de naam op de oplegger. De telematica zoekt welk voertuig er op dat moment was.' }, datum: { w: t, z: 0.9 }, gebied: { w: gebied, z: 0.8 }, bedrag: { w: bedrag, z: cal ? 0.95 : 0 }, bijlagen: c.bijlagen.length };
    statusNaarLeeftijd(c, t, { nieuwTot: 2.5, openTot: 28,
      open: () => !gevonden ? (bw === 'camera' ? { status: 'wacht_tegenpartij', formulier: 'niet', log: 'Beelden opgevraagd bij de tegenpartij: de telematica zet geen voertuig van ons op die plek' } : { status: 'afgewezen', besluit: 'afgewezen', formulier: 'niet', log: 'Afgewezen: geen voertuig van ons op die plek en tijd (telematica)' }) : R.w([[{ status: 'verzekeraar', besluit: 'verzekeraar', formulier: 'ontvangen', log: 'Gemeld bij de WA-verzekeraar, met het pakket' }, 50], [{ status: 'wacht_chauffeur', formulier: 'gevraagd' }, 40], [{ status: 'onderzoek', formulier: 'niet' }, 10]]),
      oud: () => !gevonden ? { status: 'afgewezen', besluit: 'afgewezen', log: bw === 'camera' ? 'Afgewezen na de beelden: een autotransporter van een ander bedrijf; de telematica zette geen voertuig van ons op die plek' : 'Afgewezen: geen voertuig van ons op die plek en tijd (telematica)' } : bedrag < 500 && R.p(0.4) ? { status: 'gesloten', besluit: 'erkend', log: `Zelf betaald onder het WA-eigen risico (${fmtEur(bedrag)})`, slot: 'Betaald aan de tegenpartij' } : { status: 'gesloten', besluit: 'verzekeraar', log: 'Gemeld bij de WA-verzekeraar, met het pakket', slot: 'De verzekeraar heeft het met de tegenpartij afgehandeld; eigen risico verrekend' } });
    L.push(c);
  }
  // ---- diverse schade: ongeveer een per maand
  for (let i = 0; i < 12; i++) {
    const dg = i < 2 ? R.i(0, 9) : R.i(10, 364); const t = dagMet(dg); const truck = R.k(trekkers); const r = ritBij(truck, t); const ch = r ? chauffeurs.find(x => x.id === r.ch) : R.w(chW);
    const gebied = R.w([['sleutel', 50], ['booster', 30], ['laadmateriaal', 20]]); const soort = gebied === 'laadmateriaal' ? 'gebroken' : 'ontbreekt';
    const bedrag = gebied === 'sleutel' ? Math.round(R.i(180, 650) / 5) * 5 : gebied === 'booster' ? Math.round(R.i(250, 600) / 5) * 5 : Math.round(R.i(60, 300) / 5) * 5;
    const k = r ? OPDRACHTGEVERS.find(x => x.id === r.k) : R.k(OPDRACHTGEVERS); const opAuto = gebied === 'sleutel' && r;
    let ontvangen = t + R.i(1, 20) * 3600000; while (isWeekend(ontvangen)) ontvangen += DAG; if (ontvangen > NU - 600000) ontvangen = Math.max(t + 10 * 60000, NU - R.i(20, 600) * 60000);
    const vv = opAuto ? { kenteken: r.kenteken, merk: r.merk, model: r.model, kleur: r.kleur, bouwjaar: r.bouwjaar, toelating: r.toelating, massa: r.massa, catalogusprijs: r.catalogusprijs, soort: r.soort, km: r.km } : { kenteken: truck.kenteken, merk: truck.merk, model: truck.model, kleur: 'wit', bouwjaar: truck.bouwjaar, massa: truck.massa, soort: 'trekker' };
    const c = { categorie: 'divers', seq: 0, bron: 'chauffeur', verhaal: 'divers', kenteken: vv.kenteken, voertuig: vv, eigenVoertuig: truck.id, oplegger: truck.oplegger, opdrachtgever: opAuto ? k : EIGEN, rit: r ? r.id : null, chauffeur: ch.id, chauffeurNaam: ch.naam, vestiging: truck.vestiging,
      gebied, soort, ernst: 1, fase: null, plaats: r ? r.naar.plaats : truck.vestiging, moment: t, datumRit: t, datumClaim: ontvangen, ontvangen, calculatie: null, bedragGevraagd: bedrag, extern: '', melding: { door: 'chauffeur', uurNa: (ontvangen - t) / 3600000 }, formulier: { soort: 'eenzijdig', status: 'niet', op: null }, bijlagen: [], fotosClaimTonenSchade: true };
    c.onderwerp = gebied === 'sleutel' ? (opAuto ? `Sleutel kwijt: ${vv.merk} ${vv.model} ${kentekenToon(vv.kenteken)}` : `Sleutel kwijt van ${truck.id}`) : gebied === 'booster' ? `Booster kwijt, ${truck.id}` : `Laadmateriaal kapot, ${truck.id}`;
    c.mail = `Melding uit de chauffeursapp, ${truck.id}.\n\n${gebied === 'sleutel' ? (opAuto ? `Na het lossen in ${c.plaats} de sleutel van de ${vv.merk} ${vv.model} niet meer gevonden; niet in de cabine en niet in de auto.` : `Reservesleutel van ${truck.id} kwijt. Niet in de cabine, niet in het kastje op de vestiging. Er is nog een sleutel.`) : gebied === 'booster' ? 'Booster niet teruggevonden na het starten van een auto met een lege accu.' : 'Twee spanbanden gescheurd bij het vastzetten; vervangen uit de voorraad.'}\n\n${ch.naam}`;
    c.uitgelezen = { kenteken: { w: vv.kenteken, z: 0.99 }, datum: { w: t, z: 0.95 }, gebied: { w: gebied, z: 0.95 }, bedrag: { w: bedrag, z: 0.6 }, bijlagen: 0 };
    statusNaarLeeftijd(c, t, { nieuwTot: 3, openTot: 10, open: () => ({ status: 'onderzoek', formulier: 'niet' }), oud: () => ({ status: 'gesloten', besluit: 'erkend', log: `Voor eigen rekening (${fmtEur(bedrag)})`, slot: 'Vervangen en betaald' }) });
    L.push(c);
  }
  maakVoertuigschades.vloot = vloot;
  return L;
}

// ---------- de wereld ----------
export function maakWereld(opt = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  KLEUR_VOOR = opt.kleurVoor || null;
  const chauffeurs = maakChauffeurs(); const ritten = maakRitten(chauffeurs); for (const r of ritten) r.oplegger = r.truck.replace('BT-', 'BO-'); const claims = maakClaims(ritten, chauffeurs);
  const vloot = maakVoertuigschades.vloot || []; const vlootMap = new Map(vloot.map(v => [v.id, v]));
  const ritMap = new Map(ritten.map(r => [r.id, r])); const chMap = new Map(chauffeurs.map(c => [c.id, c])); const kMap = new Map(OPDRACHTGEVERS.map(k => [k.id, k]));
  for (const c of claims) if (c.rit && !ritMap.has(c.rit)) { /* oude rit: alleen via de claim bereikbaar */ }
  // ritten per chauffeur per maand (de laatste twaalf maanden): de echte telling uit de lijst voor de laatste drie,
  // daarvoor het tempo maal de werkdagen (gesimuleerd)
  const maanden = []; for (let m = 11; m >= 0; m--) { const x = new Date(NU); x.setDate(1); x.setMonth(x.getMonth() - m); maanden.push({ jaar: x.getFullYear(), maand: x.getMonth(), t: x.getTime() }); }
  for (const ch of chauffeurs) {
    ch.rittenPerMaand = maanden.map(mm => { const telling = ritten.filter(r => r.ch === ch.id && new Date(r.ophaal).getFullYear() === mm.jaar && new Date(r.ophaal).getMonth() === mm.maand).length; if (telling > 0 && mm.t > NU - 80 * DAG) return telling; const werk = 21; return Math.round(ch.tempo * werk * (0.85 + rng(ch.id + mm.t).f() * 0.3)); });
    ch.ritten90 = ritten.filter(r => r.ch === ch.id).length; ch.ritten365 = ch.rittenPerMaand.reduce((a, b) => a + b, 0);
  }
  return { NU, chauffeurs, ritten, claims, opdrachtgevers: OPDRACHTGEVERS, ritMap, chMap, kMap, maanden, vloot, vlootMap, bouwMs: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 };
}
export function ritVan(D, c) { if (!c.rit) return null; const r = D.ritMap.get(c.rit); if (r) return ritDetail(r); return c._oudeRit || null; }
