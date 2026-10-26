// Duurzame voorstellen met berekening (Control Tower 4.1, bouwsteen 2d). Puur: geen DOM, geen app-staat, geen imports.
// Alles is een schatting met de factoren hieronder; elke factor heeft een bron, een datum en een status (gelezen, zoek,
// schatting, aanname), ook in src/data/BRONNEN.md. De interface (src/ui/assistent.js) bouwt de invoer uit het dagplan en
// toont de voorstellen; met echte data komen km, verbruik en wachttijd uit de boordcomputer en OTM5, en blijven de
// functies gelijk.
//
// Vier soorten voorstellen:
//   ev     een dieselrit op een vrije elektrische truck van dezelfde standplaats, als de accu het haalt met 15 procent marge
//   retour een lege terugweg die op de weg terug de lading van een andere rit ophaalt (lege kilometers eruit)
//   lzv    twee ritten naar dezelfde bestemming op dezelfde dag als een rit met een LZV, met een bevoegde chauffeur
//   wacht  minder wachten bij een DC: wachten met de motor aan (stationair) vermeden
export const F = {
  co2Diesel: { w: 2.63, eenheid: 'kg CO2 per liter diesel', status: 'zoek', datum: 'januari 2026', bron: 'RVO, Nederlandse lijst van energiedragers en standaard CO2-emissiefactoren (januari 2026): gas- en dieselolie 72,5 kg CO2 per GJ en 43,2 MJ per kg; dichtheid 0,840 kg per liter (RVO). Uitstoot bij verbranding, zonder de keten ervoor. Gezien in zoekresultaten, rvo.nl was niet bereikbaar: nalezen' },
  co2Stroom: { w: 0.2, eenheid: 'kg CO2 per kWh', status: 'gelezen', datum: '5 december 2025', bron: 'CBS, Energie- en emissiefactoren elektriciteit, update 2024: 0,20 kg CO2 per kWh geproduceerde elektriciteit in Nederland (integrale methode)' },
  dieselKm: { w: 0.295, eenheid: 'liter diesel per km', status: 'schatting', datum: '26 oktober 2026', bron: 'de app zelf (src/people.js): een trekker met oplegger 29,5 liter per 100 km. Geen openbare bron gevonden in de sandbox: nalezen' },
  kwhKm: { w: 1.15, eenheid: 'kWh per km', status: 'gelezen', datum: 'oktober 2026', bron: 'NACFE, via het onderzoeksmemo (Slimste, Energie): 1,1 tot 1,15 kWh per km voor een elektrische truck; de toets van het planbord rekent met 1,15 (src/ui/toets.js)' },
  dieselPrijs: { w: 2.065, eenheid: 'euro per liter, zonder btw', status: 'gelezen', datum: '13 oktober 2026', bron: 'CBS: een liter diesel kostte in september 2026 gemiddeld 2,499 euro aan de pomp, met btw en accijns; zonder 21 procent btw 2,065. Een vlootkorting is niet meegerekend' },
  stroomPrijs: { w: 0.23, eenheid: 'euro per kWh', status: 'gelezen', datum: 'oktober 2026', bron: 'onderzoeksmemo (Slimste, Energie): laden op het eigen terrein 0,175 tot 0,23 euro per kWh; we rekenen met de bovenkant' },
  stationair: { w: 3.0, eenheid: 'liter diesel per uur stationair', status: 'zoek', datum: '2015', bron: 'Argonne National Laboratory (handout over stationair draaien): een zware truck verbruikt stationair ongeveer 0,8 gallon (3,0 liter) per uur. Gezien in zoekresultaten, de site was niet bereikbaar: nalezen' },
  lzvExtra: { w: 0.2, eenheid: 'deel meer diesel per km voor een LZV', status: 'aanname', datum: '26 oktober 2026', bron: 'aanname: een LZV verbruikt per km een vijfde meer dan een gewone combinatie. Geen bron gevonden: nalezen' },
  lzvLading: { w: 1.5, eenheid: 'keer de lading van een gewone combinatie', status: 'aanname', datum: '26 oktober 2026', bron: 'aanname: een LZV neemt ongeveer anderhalf keer de lading van een trekker met oplegger mee; de app kent de belading van een rit niet, dus de twee ladingen moeten samen passen: nalezen' },
  uurloon: { w: 33, eenheid: 'euro per uur, eigen chauffeur', status: 'schatting', datum: '26 oktober 2026', bron: 'de app zelf (EIGEN_UUR in src/inzet.js), dezelfde schatting als bij Open ritten' },
  kmDiesel: { w: 0.55, eenheid: 'euro per km, eigen dieseltruck', status: 'schatting', datum: '26 oktober 2026', bron: 'de app zelf (KM_KOST in src/inzet.js): variabele kosten per km' },
  kmEv: { w: 0.35, eenheid: 'euro per km, eigen elektrische truck', status: 'schatting', datum: '26 oktober 2026', bron: 'de app zelf (KM_KOST in src/inzet.js): variabele kosten per km' },
  marge: { w: 0.15, eenheid: 'marge op het verbruik', status: 'aanname', datum: '26 oktober 2026', bron: 'afspraak: een elektrisch voorstel rekent met 15 procent meer verbruik dan de 1,15 kWh per km' },
  accuMin: { w: 10, eenheid: 'procent accu bij terugkomst', status: 'aanname', datum: '26 oktober 2026', bron: 'de toets van het planbord (src/ui/toets.js): minstens 10 procent bij terugkomst' },
};
export const STATUS = { gelezen: 'gelezen', zoek: 'zoek, nalezen', schatting: 'schatting, nalezen', aanname: 'aanname, nalezen' };
export const SOORTEN = { ev: 'Elektrisch rijden', retour: 'Lege kilometers eruit', lzv: 'LZV in plaats van twee ritten', wacht: 'Minder wachten bij een DC' };
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;

// ---------- per km en per rit ----------
// soort: 'trekker' (met oplegger), 'bakwagen' of 'bus'; de bakwagen en de bus rekenen met de waarden die de app gebruikt
export const VERBRUIK = { bakwagenDiesel: 0.22, busEv: 0.3, bron: 'de app zelf (src/people.js): bakwagen 22 liter per 100 km, elektrische bestelbus 0,3 kWh per km; schatting, nalezen' };
export const literDiesel = (km, soort) => km * (soort === 'bakwagen' || soort === 'bus' ? VERBRUIK.bakwagenDiesel : F.dieselKm.w);
export const kwhEv = (km, soort) => km * (soort === 'bus' ? VERBRUIK.busEv : F.kwhKm.w);
export const co2Diesel = (km, soort) => literDiesel(km, soort) * F.co2Diesel.w;
export const co2Ev = (km, soort) => kwhEv(km, soort) * F.co2Stroom.w;
export const co2Rit = (km, ev, soort) => (ev ? co2Ev(km, soort) : co2Diesel(km, soort));
export const energieDiesel = (km, soort) => literDiesel(km, soort) * F.dieselPrijs.w;
export const energieEv = (km, soort) => kwhEv(km, soort) * F.stroomPrijs.w;
// de kosten van een rit zoals Open ritten ze schat: uren van de chauffeur maal het uurloon plus km maal de variabele kosten
export const kostenRit = (km, uren, ev) => uren * F.uurloon.w + km * (ev ? F.kmEv.w : F.kmDiesel.w);

// ---------- 1. elektrisch in plaats van diesel ----------
// Haalt de accu het? nodig = km x 1,15 kWh x (1 + marge); beschikbaar = wat boven de 10 procent zit bij vertrek.
export function accuToets({ km, capKwh, socPct, soort }) {
  const nodig = kwhEv(km, soort) * (1 + F.marge.w); const beschikbaar = Math.max(0, capKwh * (socPct - F.accuMin.w) / 100);
  const na = capKwh > 0 ? socPct - nodig / capKwh * 100 : -100;
  return { ok: capKwh > 0 && nodig <= beschikbaar + 1e-9, nodigKwh: r1(nodig), beschikbaarKwh: r1(beschikbaar), vertrekPct: Math.round(socPct), naPct: Math.round(na) };
}
export function evBesparing(km, soort) {
  const co2 = co2Diesel(km, soort) - co2Ev(km, soort); const euro = energieDiesel(km, soort) - energieEv(km, soort);
  return { km: Math.round(km), co2: r1(co2), euro: r2(euro), liter: r1(literDiesel(km, soort)), kwh: Math.round(kwhEv(km, soort)), co2Diesel: r1(co2Diesel(km, soort)), co2Ev: r1(co2Ev(km, soort)), euroDiesel: r2(energieDiesel(km, soort)), euroEv: r2(energieEv(km, soort)) };
}
// Kies voor een rit de elektrische truck: alleen een vrije truck (geen dienst binnen gat minuten voor of na de rit), van
// dezelfde soort, met genoeg accu volgens accuToets; de truck met de meeste accu over na de rit eerst (dan de laagste id).
// rit: { km, a, b, soort }; trucks: [{ id, soort, capKwh, socPct, bezet: [[a, b], ...] }].
export function kiesEv(rit, trucks, gat = 125) {
  let best = null;
  for (const t of trucks) {
    if (t.soort !== rit.soort) continue;
    if ((t.bezet || []).some(([a, b]) => rit.a - gat < b && a < rit.b + gat)) continue;
    const u = accuToets({ km: rit.km, capKwh: t.capKwh, socPct: t.socPct, soort: rit.soort }); if (!u.ok) continue;
    if (!best || u.naPct > best.u.naPct || (u.naPct === best.u.naPct && t.id < best.t.id)) best = { t, u };
  }
  return best;
}

// ---------- 2. lege kilometers ----------
// Welke stukken van een rit rijden beladen? acties: per stop 'laden' (ophalen bij een DC), 'lossen' of 'wisselen'. Het
// eerste stuk is beladen als de rit op de standplaats laadt (de eerste stop is geen 'laden'); na een stop is de wagen
// beladen als hij daar laadde of als er nog een stop komt waar hij lost. Geeft een boolean per stuk (stops + 1 stukken).
export function beladen(acties) {
  const n = acties.length; const out = [n ? acties[0] !== 'laden' : false];
  for (let i = 0; i < n; i++) out.push(acties[i] === 'laden' || acties.slice(i + 1).some(a => a === 'lossen' || a === 'wisselen'));
  return out;
}
export const legeKm = (kms, acties) => { const b = beladen(acties); return kms.reduce((s, km, i) => s + (b[i] ? 0 : km), 0); };
// Een lege terugweg die een andere rit kan meenemen: rit A rijdt leeg terug van zijn laatste stop; rit B rijdt eerst leeg naar
// een laadadres (een DC). Ligt dat laadadres dicht bij de weg terug van A en is A er voor B daar laadt, dan haalt A de lading
// van B op en vertrekt B geladen van de standplaats. Besparing = de lege heenweg van B min de omweg van A. Afstanden:
// hemelsbreed x 1,3, rijden met 70 km per uur. A: { id, laatste: { lon, lat }, terugKm, terugOm (aankomst thuis) };
// B: { id, laad: { lon, lat, naam }, heenKm, laadOm }; basis: { lon, lat }. Elke rit hooguit een keer, de grootste eerst.
export const kmTussen = (p, q) => Math.hypot((p.lon - q.lon) * 68, (p.lat - q.lat) * 111) * 1.3;
export function dieselBesparing(km) { return { co2: r1(co2Diesel(km)), euro: r2(energieDiesel(km)), liter: r1(literDiesel(km)) }; }
export function retourMatches(basis, A, B, minKm = 10) {
  const kand = [];
  for (const a of A) for (const b of B) {
    if (a.id === b.id || !b.laad) continue;
    const om = kmTussen(a.laatste, b.laad) + kmTussen(b.laad, basis) - kmTussen(a.laatste, basis);
    const spaar = b.heenKm - om; if (spaar < minKm) continue;
    const bij = a.terugOm - a.terugKm / 70 * 60 + kmTussen(a.laatste, b.laad) / 70 * 60; if (bij > b.laadOm) continue;
    kand.push({ a: a.id, b: b.id, omKm: Math.round(om), leegKm: Math.round(b.heenKm), spaarKm: Math.round(spaar), laad: b.laad.naam || '' });
  }
  kand.sort((x, y) => y.spaarKm - x.spaarKm || (x.a < y.a ? -1 : 1));
  const al = new Set(); const out = [];
  for (const k of kand) { if (al.has(k.a) || al.has(k.b)) continue; al.add(k.a); al.add(k.b); out.push({ ...k, ...dieselBesparing(k.spaarKm) }); }
  return out;
}

// ---------- 3. een LZV in plaats van twee ritten ----------
// Twee ritten van dezelfde standplaats naar dezelfde eerste bestemming op dezelfde dag, die binnen drie uur na elkaar
// vertrekken en ongeveer even lang zijn, op een standplaats waar LZV kan. De eerste rit heeft een LZV-truck en een bevoegde
// chauffeur nodig (bevoegd); de tweede vervalt; de LZV rijdt een vijfde meer diesel per km (aanname). Alleen diesel.
// ritten: [{ id, sp, doel, a, km, bevoegd }], lzvSp: Set van standplaatsen. Elke rit hooguit een keer.
export function lzvParen(ritten, lzvSp, venster = 180) {
  const per = new Map();
  for (const r of ritten) { if (!lzvSp.has(r.sp) || !r.doel) continue; const k = `${r.sp}|${r.doel}`; if (!per.has(k)) per.set(k, []); per.get(k).push(r); }
  const out = [];
  for (const L of per.values()) {
    L.sort((x, y) => x.a - y.a || (x.id < y.id ? -1 : 1)); const al = new Set();
    for (let i = 0; i < L.length; i++) {
      const x = L[i]; if (al.has(x.id) || !x.bevoegd) continue;
      const y = L.find((z, j) => j > i && !al.has(z.id) && z.a - x.a <= venster && Math.abs(z.km - x.km) <= Math.max(25, x.km * 0.25));
      if (!y) continue;
      const extraL = literDiesel(x.km) * F.lzvExtra.w; const spaarL = literDiesel(y.km) - extraL;
      if (spaarL <= 0) continue; al.add(x.id); al.add(y.id);
      out.push({ a: x.id, b: y.id, sp: x.sp, doel: x.doel, kmA: Math.round(x.km), kmB: Math.round(y.km), liter: r1(spaarL), co2: r1(spaarL * F.co2Diesel.w), euro: r2(spaarL * F.dieselPrijs.w) });
    }
  }
  return out;
}

// ---------- 4. minder wachten bij een DC ----------
// Wachten met de motor aan kost 3 liter per uur (zoek). Per DC: de wachtminuten van vandaag; het voorstel is motor uit tijdens
// het wachten of een tijdslot, en levert hooguit die liters op (als de motor nu de hele wachttijd draait).
export function wachtBesparing(min) { const l = min / 60 * F.stationair.w; return { min: Math.round(min), liter: r1(l), co2: r1(l * F.co2Diesel.w), euro: r2(l * F.dieselPrijs.w) }; }

// ---------- de som van een dag ----------
// Reproduceerbaar: dezelfde voorstellen geven dezelfde som, in welke volgorde ze ook binnenkomen (gesorteerd op id, en pas
// aan het eind afgerond).
export function somVan(voorstellen) {
  const L = voorstellen.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const per = {}; let co2 = 0, euro = 0;
  for (const v of L) { co2 += v.co2 || 0; euro += v.euro || 0; const p = per[v.soort] || (per[v.soort] = { n: 0, co2: 0, euro: 0 }); p.n++; p.co2 += v.co2 || 0; p.euro += v.euro || 0; }
  for (const p of Object.values(per)) { p.co2 = r1(p.co2); p.euro = r2(p.euro); }
  return { n: L.length, co2: r1(co2), euro: r2(euro), per };
}

// ---------- historie voor een trend (gesimuleerd) ----------
// Dertig dagen tot en met vandaag: vandaag is gemeten, de dagen ervoor varieren vast rond die waarde (een hash van sleutel
// en datum, op zondag een eigen niveau). Met echte data komt hier de reeks uit de dagcijfers van het TMS en de telematica.
const hash01 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };
export function reeks(sleutel, nu, dagen, { spreiding = 0.08, zondag = 1, min = 0, max = Infinity, rond = 1 } = {}) {
  return dagen.map((d, i) => {
    if (i === dagen.length - 1) return nu;
    const f = 1 + (hash01(`${sleutel}|${d.iso}`) - 0.5) * 2 * spreiding; const z = d.zondag ? zondag : 1;
    return Math.max(min, Math.min(max, Math.round(nu * f * z / rond) * rond));
  });
}
