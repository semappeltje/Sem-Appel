// Voorkeuren en tevredenheid van chauffeurs (Control Tower 4.0, de vraagkant van de planning). Gesimuleerd en
// deterministisch: elke waarde volgt uit de id van de persoon en de seed, nooit uit Math.random. Puur: geen DOM, geen import
// (ook niet uit people.js); de interface geeft de persoon mee (standplaats, divisie, dienst, historie) als die er is.
//
// In het echt komen voorkeuren uit een formulier of de chauffeursapp (vrijwillig, met toestemming) en komt de tevredenheid
// uit een korte vraag in die app plus de roosterfit uit de planning: past wat iemand rijdt bij wat hij of zij wil. Een
// tevredenheidsbeeld per persoon is gevoelig (AVG, ondernemingsraad); zie src/data/BRONNEN.md.
//
//   voorkeurenVan(id, seed?, persoon?) -> { divisies, dagdelen, weekend, regio, klanten, maxUren, extra, opmerking, bron }
//   past(voorkeuren, rit)              -> { score (0 tot 1), oordeel, redenen: ['vroege dienst, zoals gewenst', ...] }
//   tevredenheid(id, seed?, persoon?)  -> { score (1 tot 10), trend, roosterfit, laatsteRitten: [{ datum, rit, past }], signalen, ... }
// persoon (optioneel): { base: standplaats uit places.js, div, dienst: { d: { start } }, history: [{ date, start, truck, rit }] },
// zoals people.js een persoon opbouwt. Een rit: een rit uit de pool, een dienst uit de historie, of { div, dagdeel, weekend,
// regio, klant }.

export const SEED = 20261024;
// Dagdelen van een dienst, naar de begintijd: vroeg 03:00 tot 08:00, dag 08:00 tot 13:00, avond 13:00 tot 22:00, nacht 22:00 tot 03:00.
export const DIENSTDELEN = ['vroeg', 'dag', 'avond', 'nacht'];
export const DIENSTDEEL_NAAM = { vroeg: 'vroege dienst', dag: 'dagdienst', avond: 'avonddienst', nacht: 'nachtdienst' };
export const DIENSTDEEL_TIJD = { vroeg: '03:00 tot 08:00', dag: '08:00 tot 13:00', avond: '13:00 tot 22:00', nacht: '22:00 tot 03:00' };
const LIEVER = { vroeg: 'liever vroeg', dag: 'liever overdag', avond: 'liever \'s avonds', nacht: 'liever \'s nachts' };
export const dienstdeel = m => { const x = ((m % 1440) + 1440) % 1440; return x >= 180 && x < 480 ? 'vroeg' : x >= 480 && x < 780 ? 'dag' : x >= 780 && x < 1320 ? 'avond' : 'nacht'; };
export const WEEKDAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const WEEKDAG_NAAM = { ma: 'maandag', di: 'dinsdag', wo: 'woensdag', do: 'donderdag', vr: 'vrijdag', za: 'zaterdag', zo: 'zondag' };
export const weekdagVan = d => WEEKDAGEN[(d.getDay() + 6) % 7];
// Datum als 'YYYY-MM-DD' (lokale tijd) en terug.
export const isoDag = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dagVanIso = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const DIVS = ['winkel', 'netwerk', 'bulk', 'dranken', 'bezorg'];
const DIVRIT = { winkel: 'winkelrit', netwerk: 'netwerkrit', bulk: 'bulkrit', dranken: 'drankenrit', bezorg: 'bezorgronde' };
const DIVKORT = { winkel: 'winkel', netwerk: 'netwerk', bulk: 'bulk', dranken: 'dranken', bezorg: 'bezorging' };
// De regio's van de standplaatsen (gelijk aan REGIOS in places.js) en welke ernaast liggen.
const REGIOS = ['Noord-Holland', 'Randstad Zuid', 'Oost', 'Noord', 'Zuid'];
export const BUURREGIO = { 'Noord-Holland': ['Randstad Zuid', 'Noord'], 'Randstad Zuid': ['Noord-Holland', 'Oost', 'Zuid'], Oost: ['Noord', 'Randstad Zuid', 'Zuid'], Noord: ['Oost', 'Noord-Holland'], Zuid: ['Randstad Zuid', 'Oost'] };

// Een eigen toevalsreeks per persoon en onderwerp: een hash van seed, onderwerp en id als begin (Park-Miller, zoals fleet.js).
export function reeks(seed, id, zout = '') {
  let h = (2166136261 ^ (seed | 0)) >>> 0; const s = `${zout}|${id}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let x = ((h >>> 0) % 2147483646) + 1;
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
}
const wkies = (R, mix) => { let x = R() * mix.reduce((a, m) => a + m[1], 0); for (const [k, w] of mix) { x -= w; if (x <= 0) return k; } return mix[0][0]; };
const kies = (R, a) => a[Math.floor(R() * a.length)];
// Klanten waar een chauffeur een voorkeur voor kan hebben, naar divisie: bij winkelritten de formules van de standplaats,
// bij bezorging de klant zelf, bij netwerk, bulk en dranken de klant uit de vacature (of tussen haakjes: "Bulk (Cosun)").
const ALGEMEEN = /^(netwerk|lzv netwerk|lzv|crossdock|bulk|truckspuiterij en garage)$/i;
const klantenVan = (base, div) => {
  if (!base) return [];
  const klant = String(base.klant || ''); const haakjes = (klant.match(/\(([^)]*)\)/) || [])[1];
  const los = s => s.split(/\s*[,/]\s*/).map(x => x.trim()).filter(x => x && !ALGEMEEN.test(x));
  if (div === 'bezorg') return /home service/i.test(klant) ? [klant] : [];
  if (div === 'winkel') return base.formules && base.formules.length ? base.formules.slice() : los(klant.replace(/\s*\(.*\)\s*/g, ''));
  return haakjes ? los(haakjes).filter(x => !/^(brood|diepvries|pluimvee)$/i.test(x)) : los(klant);
};
const MEER = { winkel: 'winkelritten', netwerk: 'lange ritten', bulk: 'bulkritten', dranken: 'drankenritten' };

export function voorkeurenVan(id, seed = SEED, persoon = null) {
  const R = reeks(seed, id, 'voorkeur');
  const base = persoon && persoon.base ? persoon.base : null;
  const eigen = persoon && persoon.div ? persoon.div : base && base.div ? base.div[0] : kies(R, DIVS.slice(0, 4));
  // divisies: meestal de eigen divisie eerst; ruim een kwart wil liever iets anders (lange ritten, minder stops). Een bezorger
  // rijdt met rijbewijs B en blijft bij de bezorging.
  let divisies;
  if (eigen === 'bezorg') divisies = ['bezorg'];
  else {
    const ander = wkies(R, [['netwerk', 5], ['winkel', 3], ['dranken', 1], ['bulk', 1]].filter(([d]) => d !== eigen));
    divisies = R() < 0.72 ? (R() < 0.4 ? [eigen, ander] : [eigen]) : [ander, eigen];
  }
  // dagdelen: wie vandaag een dienst heeft, wil in twee van de drie gevallen dat dagdeel; anders volgens de verdeling hieronder.
  const nu = persoon && persoon.dienst && persoon.dienst.d && typeof persoon.dienst.d.start === 'number' ? dienstdeel(persoon.dienst.d.start) : null;
  const eerste = nu && R() < 0.66 ? nu : wkies(R, [['vroeg', 45], ['dag', 20], ['avond', 25], ['nacht', 10]]);
  const NAAST = { vroeg: ['dag', 'nacht'], dag: ['vroeg', 'avond'], avond: ['dag', 'nacht'], nacht: ['vroeg', 'avond'] };
  const dagdelen = R() < 0.45 ? [eerste, kies(R, NAAST[eerste])] : [eerste];
  const weekend = R() < (eigen === 'bezorg' ? 0.5 : 0.35);
  const thuis = base && base.regio ? base.regio : kies(R, REGIOS);
  const regio = R() < 0.35 ? [thuis, kies(R, BUURREGIO[thuis] || REGIOS)] : [thuis];
  const kl = klantenVan(base, divisies[0]); const klanten = kl.length && R() < 0.4 ? [kies(R, kl)] : [];
  const maxUren = wkies(R, [[32, 10], [36, 10], [40, 45], [45, 25], [50, 10]]);
  const extra = wkies(R, [['graag', 30], ['soms', 45], ['nee', 25]]);
  // één opmerking zoals een chauffeur die zelf zou geven, passend bij de voorkeuren
  const O = [];
  if (!weekend) O.push('Weekend liever vrij', 'Zaterdag liever vrij, dan is er voetbal');
  if (dagdelen[0] === 'vroeg') O.push('Liefst vroeg beginnen, dan is de middag vrij');
  if (dagdelen[0] === 'avond') O.push('Liever niet voor 06:00 de deur uit');
  if (dagdelen[0] === 'nacht') O.push('Rijdt graag \'s nachts, dan zijn de wegen rustig');
  if (dagdelen[0] === 'dag') O.push('Liefst een dagdienst, \'s avonds thuis');
  if (divisies[0] !== eigen) O.push(`Wil graag meer ${MEER[divisies[0]]}`);
  if (klanten.length) O.push(`Kent de winkels en DC's van ${klanten[0]} goed`);
  if (maxUren >= 45 && extra !== 'nee') O.push('Wil graag extra uren maken');
  if (maxUren <= 36) O.push(`Wil niet meer dan ${maxUren} uur per week werken`);
  if (regio.length > 1) O.push(`Rijdt ook graag in de regio ${regio[1]}`);
  if (eigen !== 'bezorg') O.push('Rijdt graag elektrisch', 'Liever vaste winkels dan steeds andere');
  const opmerking = O.length ? kies(R, O) : '';
  return { divisies, dagdelen, weekend, regio, klanten, maxUren, extra, opmerking, bron: 'gesimuleerd' };
}

// Wat een rit is voor de voorkeuren: divisie, dagdeel, weekdag en weekend, regio's en klant. Leest een rit uit de pool
// ({ div, venster, weekdag, weekend, dagdeel, regio, klant }), een dienst uit de historie van people.js ({ truck, start, date })
// of een eenvoudige rit ({ div, start, datum, ... }).
export function ritKenmerken(rit) {
  if (!rit) return { div: null, dagdeel: null, weekdag: null, weekend: false, regio: [], klant: null };
  const t = rit.truck || rit.t || null;
  const div = rit.div || (t && t.div) || null;
  const start = Array.isArray(rit.venster) ? rit.venster[0] : typeof rit.start === 'number' ? rit.start : typeof rit.a === 'number' ? rit.a : null;
  const dagdeel = rit.dagdeel || (start !== null ? dienstdeel(start) : null);
  const weekdag = rit.weekdag || (rit.date instanceof Date ? weekdagVan(rit.date) : typeof rit.datum === 'string' ? weekdagVan(dagVanIso(rit.datum)) : null);
  const weekend = typeof rit.weekend === 'boolean' ? rit.weekend : weekdag === 'za' || weekdag === 'zo';
  const regio = Array.isArray(rit.regio) ? rit.regio : rit.regio ? [rit.regio] : t && t.base && t.base.regio ? [t.base.regio] : [];
  const klant = rit.klant || (t && t.klant) || null;
  return { div, dagdeel, weekdag, weekend, regio, klant };
}

// Past een rit bij de voorkeuren? Score van 0 (past niet) tot 1 (precies wat iemand wil), met de redenen in gewone taal,
// de zwaarste eerst. Divisie en dagdeel wegen het zwaarst, dan het weekend; regio en klant geven een duwtje.
export function past(v, rit) {
  const k = ritKenmerken(rit); const R = []; let s = 0.5;
  const add = (d, tekst) => { s += d; R.push([d, tekst]); };
  if (v && k.div) {
    const i = v.divisies.indexOf(k.div);
    if (i === 0) add(0.2, `${DIVRIT[k.div]}, de eerste voorkeur`);
    else if (i > 0) add(0.07, `${DIVRIT[k.div]}, de tweede voorkeur`);
    else add(-0.2, `${DIVRIT[k.div]}, liever ${DIVKORT[v.divisies[0]]}`);
  }
  if (v && k.dagdeel) {
    const i = v.dagdelen.indexOf(k.dagdeel);
    if (i === 0) add(0.2, `${DIENSTDEEL_NAAM[k.dagdeel]}, zoals gewenst`);
    else if (i > 0) add(0.08, `${DIENSTDEEL_NAAM[k.dagdeel]}, kan ook`);
    else add(k.dagdeel === 'nacht' ? -0.3 : -0.22, `${DIENSTDEEL_NAAM[k.dagdeel]}, ${LIEVER[v.dagdelen[0]]}`);
  }
  if (v && k.weekend) {
    const dag = k.weekdag ? WEEKDAG_NAAM[k.weekdag] : 'weekend';
    if (v.weekend) add(0.05, `${dag}, werkt graag in het weekend`); else add(-0.25, `${dag}, liever vrij in het weekend`);
  }
  if (v && k.regio.length) {
    const buiten = k.regio.filter(r => !v.regio.includes(r));
    if (buiten.length) add(-0.1, `rit naar de regio ${buiten[0]}, buiten de voorkeur`);
    else if (k.regio.length > 1 || v.regio.length > 1) add(0.04, `in de regio ${k.regio[k.regio.length - 1]}, zoals gewenst`);
  }
  if (v && k.klant && v.klanten.length) {
    const kl = String(k.klant).toLowerCase();
    const hit = v.klanten.find(x => kl.includes(String(x).toLowerCase()) || String(x).toLowerCase().includes(kl));
    if (hit) add(0.06, `voor ${hit}, een klant van voorkeur`);
  }
  const score = Math.round(Math.max(0, Math.min(1, s)) * 100) / 100;
  const S = R.sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]));
  return { score, oordeel: score >= 0.7 ? 'past goed' : score >= 0.45 ? 'past redelijk' : 'past slecht', redenen: S.map(x => x[1]), voor: S.filter(x => x[0] > 0).map(x => x[1]), tegen: S.filter(x => x[0] < 0).map(x => x[1]) };
}

// Tevredenheid: score van 1 tot 10, trend (stijgt, gelijk, daalt), de roosterfit (het deel van de laatste diensten dat bij de
// voorkeur paste) en de laatste diensten met past ja of nee. Met de historie van de persoon (people.js) zijn dat die
// diensten, anders zes gesimuleerde uit de afgelopen weken. De score volgt uit de roosterfit, wijzigingen kort voor vertrek
// en korte rust (drie klachten op Indeed: planning, afspraken, rusttijd), met een kleine persoonlijke spreiding.
export function tevredenheid(id, seed = SEED, persoon = null, vandaag = new Date()) {
  const v = voorkeurenVan(id, seed, persoon); const R = reeks(seed, id, 'tevreden');
  const nu = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
  let ritten;
  const hist = persoon && Array.isArray(persoon.history) ? persoon.history.filter(h => h && h.date instanceof Date) : [];
  if (hist.length) {
    ritten = hist.slice().sort((a, b) => b.date - a.date).slice(0, 8).map(h => ({ datum: isoDag(h.date), rit: h.rit || '', k: h }));
  } else {
    const div0 = persoon && persoon.div ? persoon.div : v.divisies[v.divisies.length - 1];
    ritten = [];
    for (let i = 0, d = 1; i < 6 && d < 30; d += 1 + Math.floor(R() * 2)) {
      const dag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - d); const wd = weekdagVan(dag);
      if (wd === 'zo' || (wd === 'za' && R() < 0.6)) continue;
      const div = R() < 0.8 ? div0 : v.divisies[0];
      const dd = R() < 0.6 ? v.dagdelen[0] : kies(R, DIENSTDELEN);
      const start = { vroeg: 300, dag: 600, avond: 900, nacht: 60 }[dd] + Math.floor(R() * 8) * 15;
      ritten.push({ datum: isoDag(dag), rit: `${DIVKORT[div][0].toUpperCase()}${DIVKORT[div].slice(1)} · ${DIENSTDEEL_NAAM[dd]}`, k: { div, start, datum: isoDag(dag), regio: persoon && persoon.base ? [persoon.base.regio] : [v.regio[0]] } });
      i++;
    }
  }
  const laatsteRitten = ritten.map(r => { const p = past(v, r.k); const ok = p.score >= 0.5; return { datum: r.datum, rit: r.rit, past: ok, score: p.score, waarom: (ok ? p.voor[0] : p.tegen[0]) || p.redenen[0] || '' }; });
  const n = laatsteRitten.length; const goed = laatsteRitten.filter(r => r.past).length; const fit = n ? goed / n : 0.5;
  const wijzigingen = Math.min(4, Math.floor(R() * 3.2 + (1 - fit) * 2));
  const rustKort = (R() < 0.22 ? 1 : 0) + (fit < 0.4 && R() < 0.3 ? 1 : 0);
  const ruw = 4.7 + 2.9 * fit - 0.35 * wijzigingen - 0.45 * rustKort + (R() - 0.5) * 1.6;
  const score = Math.round(Math.max(1, Math.min(10, ruw)) * 10) / 10;
  // trend: de nieuwste helft tegen de oudste helft van de diensten, plus een kleine eigen beweging
  const h = Math.floor(n / 2); const nieuw = laatsteRitten.slice(0, h), oud = laatsteRitten.slice(h);
  const f = a => a.length ? a.filter(r => r.past).length / a.length : fit;
  const d = (n >= 2 ? f(nieuw) - f(oud) : 0) + (R() - 0.5) * 0.3;
  const trend = d > 0.18 ? 'stijgt' : d < -0.18 ? 'daalt' : 'gelijk';
  const signalen = [`${goed} van de ${n} laatste diensten pasten bij de voorkeur`];
  if (wijzigingen) signalen.push(`${wijzigingen} keer kort voor vertrek gewijzigd (vier weken)`);
  if (rustKort) signalen.push(`${rustKort} keer minder dan 11 uur rust tussen twee diensten (vier weken)`);
  return { score, trend, roosterfit: Math.round(fit * 100) / 100, laatsteRitten, signalen, wijzigingen, rustKort, bron: 'gesimuleerd' };
}
