// De teller per chauffeur (Control Tower 4.1): gereden vandaag, deze week en deze twee weken, de laatste rust, de volgende
// verplichte rust en wat er nog kan. Puur en zonder imports; de planner hoeft niet zelf te tellen. In de demo uit de
// gesimuleerde historie (people.js) en het plan van vandaag; in het echt uit de tachograaf of de werkstaten van de
// boordcomputer: per dienst het begin, het eind en de minuten rijden (de vorm hieronder).
//
// teller({ diensten, nu, weekdag, rooster }) met
//   diensten  [{ a, b, rij, maxRij? }]: begin en eind in minuten vanaf middernacht van vandaag (gisteren is negatief),
//             rij in minuten; gereden en gepland door elkaar, vandaag het plan van vandaag
//   nu        minuten van de dag (de klok van de planner)
//   weekdag   0 is maandag, 6 is zondag (de week van EU 561 loopt van maandag 00:00 tot zondag 24:00)
//   vrijVanaf optioneel: het begin van het volgende roostervrije blok (minuten vanaf vandaag), voor de geplande weekrust
//
// De regels (EU 561/2006 artikel 6 en 8; de cao beroepsgoederenvervoer voor de dagrust, zie toets.js):
//   hoogstens 56 uur rijden per week en 90 uur in twee opeenvolgende weken; een weekrust van 45 uur, verkort tot 24 uur met
//   compensatie binnen drie weken; de weekrust begint uiterlijk na zes perioden van 24 uur na het eind van de vorige.
// Een rust tussen twee diensten van 45 uur of meer is een normale weekrust, van 24 uur of meer een verkorte.
export const WEEKNORM = { rijWeek: 3360, rijTweeWeken: 5400, weekrust: 2700, weekrustVerkort: 1440, zesDagen: 8640, rijDag: 540, rijDagVerlengd: 600 };
const DAGNAAM = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
const hm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
// 190 -> "3 uur 10", 60 -> "1 uur", 45 -> "45 min"
export const uurMin = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} uur ${r}` : `${h} uur`) : `${r} min`; };
// een moment (minuten vanaf vandaag) als "vandaag 18:00", "morgen 04:30", "vrijdag 18:00"
export function momentTekst(x, weekdag) {
  const dag = Math.floor(x / 1440);
  const wd = ((weekdag + dag) % 7 + 7) % 7;
  const naam = dag === 0 ? 'vandaag' : dag === 1 ? 'morgen' : dag === -1 ? 'gisteren' : dag > 1 && dag < 7 ? DAGNAAM[wd] : dag >= 7 ? `${DAGNAAM[wd]} over een week` : dag > -7 ? `afgelopen ${DAGNAAM[wd]}` : `${DAGNAAM[wd]} een week eerder`;
  return `${naam} ${hm(x)}`;
}
// het rijden van een dienst tot een moment (lineair over de dienst: in het echt komt het uit de tachograaf)
const rijTot = (d, t) => t <= d.a ? 0 : t >= d.b ? d.rij : d.rij * (t - d.a) / Math.max(1, d.b - d.a);

export function teller({ diensten = [], nu = 0, weekdag = 0, vrijVanaf = null }) {
  const D = diensten.filter(d => d && d.b > d.a).slice().sort((x, y) => x.a - y.a);
  const weekBegin = -weekdag * 1440, vorigeWeek = weekBegin - 7 * 1440;
  const vandaagD = D.filter(d => d.a >= 0 && d.a < 1440);
  // vandaag: gepland (het hele plan van vandaag) en gereden (tot nu)
  const gepland = vandaagD.reduce((s, d) => s + d.rij, 0);
  const gereden = vandaagD.reduce((s, d) => s + rijTot(d, nu), 0);
  const maxRij = vandaagD.length ? Math.max(...vandaagD.map(d => d.maxRij || WEEKNORM.rijDag)) : WEEKNORM.rijDag;
  // de week en de vorige week: een dienst telt in de week waarin hij begint (een nachtdienst over zondag 24:00 heen telt in
  // zijn eigen week; de tachograaf splitst hem, een benadering van hooguit een paar uur)
  const som = (van, tot) => D.filter(d => d.a >= van && d.a < tot).reduce((s, d) => s + d.rij, 0);
  const week = som(weekBegin, weekBegin + 7 * 1440), vorige = som(vorigeWeek, weekBegin);
  const weekGereden = D.filter(d => d.a >= weekBegin && d.a < weekBegin + 7 * 1440).reduce((s, d) => s + rijTot(d, nu), 0);
  // rusten tussen diensten: de laatste weekrust (24 uur of meer) voor het eind van de laatste dienst die al begon
  const rusten = []; for (let i = 1; i < D.length; i++) rusten.push({ van: D[i - 1].b, tot: D[i].a, duur: D[i].a - D[i - 1].b });
  // tot en met de diensten van vandaag (het plan): de rust voor de dienst van vandaag telt, ook als die dienst nog moet beginnen
  const begonnen = D.filter(d => d.a < 1440 || d.a <= nu); const grens = begonnen.length ? begonnen[begonnen.length - 1].a : nu;
  const wr = rusten.filter(r => r.tot <= grens + 0.5 && r.duur >= WEEKNORM.weekrustVerkort - 0.5);
  const eersteDienst = D.length ? D[0].a : nu;
  // geen weekrust in de historie: dan telt het begin van de historie, met een rust ervoor (een benadering, gemeld als onbekend)
  const laatsteWeekrust = wr.length ? { ...wr[wr.length - 1], verkort: wr[wr.length - 1].duur < WEEKNORM.weekrust - 0.5, bekend: true } : { van: eersteDienst - WEEKNORM.weekrust, tot: eersteDienst, duur: WEEKNORM.weekrust, verkort: false, bekend: false };
  const compensatie = laatsteWeekrust.verkort ? Math.round(WEEKNORM.weekrust - laatsteWeekrust.duur) : 0;
  // de volgende weekrust begint uiterlijk zes perioden van 24 uur na het eind van de vorige
  const uiterlijk = laatsteWeekrust.tot + WEEKNORM.zesDagen;
  const dagritten = D.filter(d => d.a >= laatsteWeekrust.tot - 0.5).length;
  // de laatste dagrust: tussen de laatste twee diensten die al begonnen
  const vorigeRust = rusten.filter(r => r.tot <= grens + 0.5).pop() || null;
  // na vandaag: de dagrust na de laatste dienst van vandaag, en de geplande weekrust (rooster) of de uiterlijke
  const laatsteVandaag = vandaagD.length ? vandaagD[vandaagD.length - 1].b : null;
  const geplandeWeekrust = typeof vrijVanaf === 'number' && vrijVanaf < uiterlijk ? vrijVanaf : null;
  // de weekrust had al moeten beginnen (een overtreding in de data): vandaag kan er niets meer bij
  // het eind van de laatste dienst (vandaag het plan): ligt dat 24 uur of meer voor een rit, dan is de weekrust ervoor genomen
  // en telt de uiterlijke start niet meer; wie vandaag geen dienst heeft en al 24 uur vrij is, zit nu in zijn weekrust
  const laatsteEind = D.length ? Math.max(...D.map(d => d.b)) : null;
  const lopend = !vandaagD.length && laatsteEind !== null && nu - laatsteEind >= WEEKNORM.weekrustVerkort - 0.5 ? { van: laatsteEind } : null;
  const teLaat = uiterlijk <= nu && !lopend;
  const kanVandaag = teLaat ? 0 : Math.max(0, Math.min(maxRij - gepland, WEEKNORM.rijWeek - week, WEEKNORM.rijTweeWeken - week - vorige));
  const kan = { vandaag: kanVandaag, dag: Math.max(0, maxRij - gepland), week: Math.max(0, WEEKNORM.rijWeek - week), tweeWeken: Math.max(0, WEEKNORM.rijTweeWeken - week - vorige), totWeekrust: Math.max(0, uiterlijk - nu) };
  const grensVandaag = kanVandaag === kan.dag ? 'dag' : kanVandaag === kan.week ? 'week' : 'tweeWeken';
  const t = {
    vandaag: { gereden: Math.round(gereden), gepland: Math.round(gepland), max: maxRij },
    week: { gereden: Math.round(weekGereden), totaal: Math.round(week), max: WEEKNORM.rijWeek },
    tweeWeken: { totaal: Math.round(week + vorige), vorigeWeek: Math.round(vorige), max: WEEKNORM.rijTweeWeken },
    laatsteRust: vorigeRust ? { van: vorigeRust.van, tot: vorigeRust.tot, duur: Math.round(vorigeRust.duur), soort: vorigeRust.duur >= WEEKNORM.weekrustVerkort - 0.5 ? 'weekrust' : 'dagrust' } : null,
    weekrust: { laatste: laatsteWeekrust, compensatie, uiterlijk, gepland: geplandeWeekrust, dagritten, lopend }, laatsteEind,
    volgendeRust: laatsteVandaag !== null ? { soort: 'dagrust', vanaf: laatsteVandaag } : null,
    kan, grens: teLaat ? 'weekrust' : grensVandaag, weekdag, nu,
  };
  t.zin = zin(t, weekdag);
  return t;
}

// één regel per chauffeur: "kan vandaag nog 3 uur 10 rijden, weekrust vanaf vrijdag 18:00"
export function zin(t, weekdag) {
  const wr = t.weekrust; const wanneer = wr.gepland !== null ? wr.gepland : wr.uiterlijk;
  const rust = wr.lopend ? `weekrust sinds ${momentTekst(wr.lopend.van, weekdag)}` : `weekrust ${wr.gepland !== null ? 'vanaf' : 'uiterlijk vanaf'} ${momentTekst(wanneer, weekdag)}`;
  const k = t.kan.vandaag;
  if (t.grens === 'weekrust') return `kan vandaag niet meer rijden: de weekrust had uiterlijk ${momentTekst(wr.uiterlijk, weekdag)} moeten beginnen`;
  const waarom = t.grens === 'week' ? ' (56 uur in de week)' : t.grens === 'tweeWeken' ? ' (90 uur in twee weken)' : '';
  if (k < 1) return `kan vandaag niet meer rijden${waarom}, ${rust}`;
  return `kan vandaag nog ${uurMin(k)} rijden${waarom}, ${rust}`;
}

// Past een extra blok rijden in de week? rit: { a, b, rij } (minuten vanaf vandaag), naam voor de tekst. Geeft de regels als
// { regel, ernst, tekst } zoals toets.js: 'fout' als het niet mag (56 uur in de week, 90 in twee weken, na de uiterlijke start
// van de weekrust), anders 'ok'. Een rit die al in het plan zat, staat er niet dubbel in: geef dan de teller zonder die rit.
export function pastInWeek(t, rit, naam = 'de chauffeur', weekdag = 0) {
  const R = []; if (!t || !rit) return R;
  // een rit in de volgende week (morgen op zondag): die week begint leeg, de twee weken zijn deze week plus de rit
  const nieuweWeek = rit.a >= (7 - weekdag) * 1440;
  const week = (nieuweWeek ? 0 : t.week.totaal) + rit.rij, twee = (nieuweWeek ? t.week.totaal : t.tweeWeken.totaal) + rit.rij;
  if (week > WEEKNORM.rijWeek + 0.5) R.push({ regel: 'week', ernst: 'fout', tekst: `Na deze rit heeft ${naam} ${uurMin(week)} rijden in de week: hoogstens 56 uur (EU 561).` });
  if (twee > WEEKNORM.rijTweeWeken + 0.5) R.push({ regel: 'week', ernst: 'fout', tekst: `Na deze rit heeft ${naam} ${uurMin(twee)} rijden in twee weken: hoogstens 90 uur (EU 561).` });
  const rustErvoor = t.laatsteEind !== null && t.laatsteEind !== undefined && rit.a - t.laatsteEind >= WEEKNORM.weekrustVerkort - 0.5;
  if (rit.b > t.weekrust.uiterlijk + 0.5 && !rustErvoor) R.push({ regel: 'weekrust', ernst: 'fout', tekst: `De weekrust van ${naam} moet uiterlijk ${momentTekst(t.weekrust.uiterlijk, weekdag)} beginnen (na zes dagen); de rit loopt tot ${hm(rit.b)}.` });
  if (!R.length) R.push({ regel: 'week', ernst: 'ok', tekst: `Rijtijd in de week ${uurMin(week)} van 56 uur, in twee weken ${uurMin(twee)} van 90.` });
  return R;
}
// Wat er in de week van de rit nog gereden mag worden (minuten): de grens die verdeel.js als ruimte meekrijgt. Een rit in de
// volgende week (morgen op zondag) begint met een lege week; de twee weken zijn dan deze week plus de rit.
export function ruimteVoor(t, rit, weekdag = 0) {
  const nieuweWeek = rit.a >= (7 - weekdag) * 1440;
  return nieuweWeek ? Math.max(0, Math.min(WEEKNORM.rijWeek, WEEKNORM.rijTweeWeken - t.week.totaal)) : Math.max(0, Math.min(t.kan.week, t.kan.tweeWeken));
}
// een korte vorm voor een chip of een kolom: "3 u 10 vandaag, 21 u week"
export const kort = t => `${uurMin(t.kan.vandaag)} vandaag · ${uurMin(t.kan.week)} week`;
