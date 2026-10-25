// Toetsregels voor het planbord, de voorstellen ("Waar past deze rit?") en de zaken. Pure functies: geen DOM, geen
// app-staat, geen imports; alles wat nodig is komt als gewone gegevens binnen. Tijden in minuten sinds middernacht van
// vandaag (boven 1440 is na middernacht), afstanden in km.
//
// toets({ voertuig, plan, dienst, rit, start, context }) geeft { ok, regels: [{ regel, ernst, tekst }], effect }.
//   voertuig  { id, soort: 'trekker'|'bakwagen'|'bus', ev, accuKwh, standplaats } (een bus tot 3,5 ton valt niet onder EU 561)
//   plan      de blokken die het voertuig al heeft, zonder de rit zelf: [{ id, t0, t1, naam }]
//   dienst    de dienst waar de rit in komt (zonder de rit), of null als de rit een eigen dienst wordt:
//             { bestuurder, t0, t1, maxRij (540 of 600), rijden: [{ t0, t1 }], pauzes: [{ t0, t1 }] }
//   rit       { id, t0, t1, km, standplaats, soort, oplegger: soort oplegger of null, opleggerNaam,
//               rijden: [{ t0, t1 }], pauzes: [{ t0, t1 }], stops: [{ naam, aankomst, venster: [a, b] | null, laden }] }
//             een stop met laden: true is het laadvenster op de standplaats (eerder vertrekken kan dan niet)
//   start     de nieuwe vertrektijd van de rit
//   context   { socBijVertrek: 0..100, leegKm: km naar de standplaats van de rit (heen), opleggersVrij: { soort: n },
//               dock: { nr, duur, bezet: [{ t0, t1, door }], vrij: [nr] }, volgendeDienst: starttijd morgen (minuten van de dag) }
// Ernst: 'fout' (gaat niet: het blok gaat terug), 'let op' (kan, met een gevolg), 'ok' (ter informatie).
// Effect: { teLaatMin, extraKm, rijtijdOverMin, accuBijTerugkomst } voor het rangschikken van voorstellen.

// EU 561/2006: na 4,5 uur rijden 45 minuten pauze; 9 uur rijden per dag, twee keer per week 10. Dagelijkse rust: de cao
// beroepsgoederenvervoer is strenger dan EU 561 (die drie keer 9 uur verkorte rust toestaat): 11 uur, hoogstens drie keer
// tussen twee weekrusten verkort tot 10 uur (Staatscourant 2026, nr. 7211; status zoek: nog na te lezen). Die grens geldt
// hier, ook als de kandidaten uit de data met EU 561 zijn gerekend. Verbruik van een elektrische truck 1,1 tot 1,15 kWh
// per km (referentie NACFE).
export const NORM = { rijZonderPauze: 270, pauze: 45, rijDag: 540, rijDagVerlengd: 600, rust: 660, rustVerkort: 600, kwhPerKm: 1.15, accuMin: 10, accuLetOp: 20, laadKw: 150, dockLaden: 40, teLaatFout: 60 };
const CAO = 'cao beroepsgoederenvervoer, strenger dan EU 561';

const SOORT = { trekker: 'trekker', bakwagen: 'bakwagen', bus: 'bestelbus' };
export const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const duur = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} u ${r} min` : `${h} u`) : `${r} min`; };

// Langste stuk rijden zonder een pauze van minstens 45 minuten. Lossen en wachten bij de klant is ander werk en telt
// niet als pauze; een pauze is een pauzeblok, of stilstand van 45 minuten tussen blokken uit een andere bron (de rit
// en de rest van de dienst). Blokken mogen een veld bron hebben.
export function rijZonderPauze(rijden, pauzes = []) {
  const R = rijden.filter(b => b.t1 > b.t0).slice().sort((a, b) => a.t0 - b.t0);
  const P = pauzes.filter(p => p.t1 - p.t0 >= NORM.pauze - 0.01);
  let best = 0, cur = 0, at = null, prev = null;
  for (const b of R) {
    const gap = prev ? b.t0 - prev.t1 : Infinity;
    const brk = !prev || (gap >= NORM.pauze - 0.01 && b.bron !== prev.bron) || P.some(p => p.t0 >= prev.t1 - 0.01 && p.t1 <= b.t0 + 0.01);
    if (brk) cur = 0;
    cur += b.t1 - b.t0; if (cur > best) { best = cur; at = b.t1; }
    prev = b;
  }
  return { min: best, op: at };
}
export const rijTotaal = rijden => rijden.reduce((a, b) => a + Math.max(0, b.t1 - b.t0), 0);

export function toets({ voertuig, plan = [], dienst = null, rit, start, context = {} }) {
  const regels = []; const add = (regel, ernst, tekst) => regels.push({ regel, ernst, tekst });
  const d = (start === undefined || start === null ? rit.t0 : start) - rit.t0;
  const s = rit.t0 + d, e = rit.t1 + d;
  const sh = L => (L || []).map(b => ({ t0: b.t0 + d, t1: b.t1 + d }));
  const effect = { teLaatMin: 0, extraKm: 0, rijtijdOverMin: null, accuBijTerugkomst: null };

  // soort voertuig
  if (rit.soort && voertuig.soort && rit.soort !== voertuig.soort) {
    if (rit.oplegger && voertuig.soort !== 'trekker') add('soort', 'fout', `${voertuig.id} is een ${SOORT[voertuig.soort] || voertuig.soort} en kan geen oplegger trekken.`);
    else add('soort', 'fout', `De rit is voor een ${SOORT[rit.soort] || rit.soort}; ${voertuig.id} is een ${SOORT[voertuig.soort] || voertuig.soort}.`);
  }
  // overlap met wat het voertuig al rijdt
  const botst = plan.filter(b => b.id !== rit.id && b.t0 < e - 0.01 && b.t1 > s + 0.01).sort((a, b) => a.t0 - b.t0);
  if (botst.length) add('overlap', 'fout', `Overlapt met ${botst[0].naam || botst[0].id} (${hhmm(botst[0].t0)}–${hhmm(botst[0].t1)})${botst.length > 1 ? ` en ${botst.length - 1} ander blok` : ''}.`);
  // standplaats
  if (rit.standplaats && voertuig.standplaats && rit.standplaats !== voertuig.standplaats) {
    const km = Math.round(context.leegKm || 0); effect.extraKm = km * 2;
    add('standplaats', 'let op', `${voertuig.id} staat in ${voertuig.standplaats}${km ? `: ${km} km leeg naar ${rit.standplaats} en terug` : `; de rit begint in ${rit.standplaats}`}.`);
  }
  // tijdvensters: aankomst verschuift mee, het venster van de klant niet
  let laatst = null;
  for (const st of rit.stops || []) {
    if (!st.venster) continue; const aan = st.aankomst + d; const te = aan - st.venster[1];
    // het laadvenster op de standplaats: de lading is er pas vanaf het begin van het venster
    if (st.laden && aan < st.venster[0] - 0.5) add('venster', 'fout', `${st.naam} kan pas vanaf ${hhmm(st.venster[0])}; vertrek ${hhmm(aan)} is ${duur(st.venster[0] - aan)} te vroeg.`);
    if (te > 0.5) { effect.teLaatMin += Math.round(te); if (!laatst || te > laatst.te) laatst = { te, st, aan }; }
  }
  if (laatst) add('venster', laatst.te > NORM.teLaatFout ? 'fout' : 'let op', laatst.st.laden ? `${laatst.st.naam} om ${hhmm(laatst.aan)}: het laadvenster loopt tot ${hhmm(laatst.st.venster[1])} (${duur(laatst.te)} te laat).` : `${laatst.st.naam}: aankomst ${hhmm(laatst.aan)}, venster tot ${hhmm(laatst.st.venster[1])} (${duur(laatst.te)} te laat).`);
  else if ((rit.stops || []).some(x => x.venster) && !regels.some(r => r.regel === 'venster')) add('venster', 'ok', 'Alle stops binnen het tijdvenster.');
  // rijtijd en pauze (EU 561/2006); niet voor een bestelbus tot 3,5 ton
  const max = dienst && dienst.maxRij ? Math.min(NORM.rijDagVerlengd, dienst.maxRij) : NORM.rijDag;
  if (voertuig.soort === 'bus') add('rijtijd', 'ok', 'Bestelbus tot 3,5 ton: de rij- en rusttijden van EU 561 gelden niet.');
  else {
    const rij = [...sh(rit.rijden).map(b => ({ ...b, bron: 'rit' })), ...(dienst ? dienst.rijden || [] : []).map(b => ({ ...b, bron: 'dienst' }))];
    const pz = [...sh(rit.pauzes), ...(dienst ? dienst.pauzes || [] : [])];
    const lang = rijZonderPauze(rij, pz); const tot = rijTotaal(rij);
    effect.rijtijdOverMin = Math.round(max - tot);
    if (lang.min > NORM.rijZonderPauze + 0.5) add('rijtijd', 'fout', `${duur(lang.min)} rijden zonder pauze tot ${hhmm(lang.op)}: na 4,5 uur rijden is 45 minuten pauze nodig.`);
    if (tot > NORM.rijDagVerlengd + 0.5) add('rijtijd', 'fout', `${duur(tot)} rijden op de dag${dienst && dienst.bestuurder ? ` van ${dienst.bestuurder}` : ''}: meer dan 10 uur.`);
    else if (tot > max + 0.5) add('rijtijd', 'let op', `${duur(tot)} rijden op de dag: verlengd tot 10 uur, dat mag twee keer per week.`);
    else if (lang.min <= NORM.rijZonderPauze + 0.5) add('rijtijd', 'ok', `Rijtijd ${duur(tot)} op de dag, ${duur(max - tot)} over.`);
    // rusttijd tot de volgende dienst (dezelfde chauffeur morgen)
    const d0 = Math.min(s, dienst ? dienst.t0 : s), d1 = Math.max(e, dienst ? dienst.t1 : e);
    const morgen = (context.volgendeDienst === undefined || context.volgendeDienst === null ? d0 : context.volgendeDienst) + 1440;
    const rust = morgen - d1;
    if (rust < NORM.rustVerkort - 0.5) add('rusttijd', 'fout', `Rusttijd tot de volgende dienst (${hhmm(morgen)}) wordt ${duur(rust)}: minder dan 10 uur (${CAO}).`);
    else if (rust < NORM.rust - 0.5) add('rusttijd', 'let op', `Rusttijd tot de volgende dienst wordt ${duur(rust)}: verkort tot minstens 10 uur, dat mag hoogstens drie keer tussen twee weekrusten (${CAO}).`);
  }
  // accu en laadtijd (elektrisch)
  if (voertuig.ev) {
    const cap = voertuig.accuKwh || 540; const soc0 = context.socBijVertrek === undefined || context.socBijVertrek === null ? 100 : context.socBijVertrek;
    const kwh = ((rit.km || 0) + effect.extraKm) * NORM.kwhPerKm; const eind = soc0 - kwh / cap * 100; effect.accuBijTerugkomst = Math.round(eind);
    if (eind < NORM.accuMin) { const nodig = (NORM.accuMin - eind) / 100 * cap; add('accu', 'fout', `Accu bij terugkomst ${Math.round(eind)} % (vertrek ${Math.round(soc0)} %): laad eerst ${duur(nodig / NORM.laadKw * 60)} op ${NORM.laadKw} kW.`); }
    else if (eind < NORM.accuLetOp) add('accu', 'let op', `Accu bij terugkomst ${Math.round(eind)} %: krap, laad na de rit.`);
    else add('accu', 'ok', `Accu bij terugkomst ${Math.round(eind)} %.`);
  }
  // oplegger
  if (rit.oplegger && context.opleggersVrij) {
    const n = context.opleggersVrij[rit.oplegger] || 0; const naam = rit.opleggerNaam || (rit.oplegger === 'koel' ? 'koeloplegger' : 'droge oplegger');
    if (!n) add('oplegger', 'fout', `Geen ${naam} vrij in ${rit.standplaats || voertuig.standplaats} om ${hhmm(s)}.`);
    else add('oplegger', 'ok', `${n === 1 ? `Een ${naam}` : `${n} ${naam.replace(/(\S+)$/, '$1s')}`} vrij.`);
  }
  // dock: laden (of koppelen) vlak voor vertrek
  if (context.dock) {
    const a = s - (context.dock.duur || NORM.dockLaden); const bz = (context.dock.bezet || []).find(b => b.t0 < s - 0.01 && b.t1 > a + 0.01);
    // een ander vrij dock lost het op (de loods wijst het toe); zonder vrij dock kan het niet
    if (bz) { const vrij = (context.dock.vrij || [])[0]; add('dock', vrij ? 'ok' : 'fout', vrij ? `Dock ${context.dock.nr} is bezet tot ${hhmm(bz.t1)}; laden aan dock ${vrij}.` : `Dock ${context.dock.nr} is bezet ${hhmm(bz.t0)}–${hhmm(bz.t1)}${bz.door ? ` (${bz.door})` : ''} en er is geen dock vrij.`); }
  }
  const ok = !regels.some(r => r.ernst === 'fout');
  return { ok, regels, effect };
}

// volgorde van kandidaten: eerst wat kan, dan het minst te laat, de minste extra kilometers, de meeste rijtijd over
export function rangschik(kandidaten) {
  return kandidaten.slice().sort((a, b) => (b.uitslag.ok - a.uitslag.ok) || (a.uitslag.effect.teLaatMin - b.uitslag.effect.teLaatMin)
    || (a.uitslag.effect.extraKm - b.uitslag.effect.extraKm) || ((b.uitslag.effect.rijtijdOverMin || 0) - (a.uitslag.effect.rijtijdOverMin || 0))
    || ((b.uitslag.effect.accuBijTerugkomst ?? 100) - (a.uitslag.effect.accuBijTerugkomst ?? 100)));
}
export const fouten = uitslag => uitslag.regels.filter(r => r.ernst === 'fout');
export const letOp = uitslag => uitslag.regels.filter(r => r.ernst === 'let op');
