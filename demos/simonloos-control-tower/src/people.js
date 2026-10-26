// Personen 3.0: chauffeurs uit de pool van elke standplaats, de dienst van vandaag (voertuig en tijden; niemand heeft een
// vaste wagen), de historie per voertuig (wie reed erop) en per persoon (op welke wagens), kerngegevens, onderhoud en
// documenten per voertuig en per oplegger. Alles gesimuleerd en deterministisch; namen en nummers zijn fictief.
import { SP, DIV } from './places.js';
import { TRT, LAST, rijdtOpZondag } from './fleet.js';

let seed = 7712026; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(rnd() * a.length)];
const r = (a, b) => a + rnd() * (b - a);
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const dayAgo = n => new Date(TODAY.getTime() - n * 864e5);
const clean = s => s.replace(/\./g, '');
export const fmtDay = d => clean(d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }));
export const fmtDate = d => clean(d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }));
const fmtMY = d => d.toLocaleDateString('nl-NL', { month: '2-digit', year: 'numeric' });
const monthsAhead = (a, b) => new Date(TODAY.getFullYear(), TODAY.getMonth() + Math.floor(r(a, b)), 1 + Math.floor(rnd() * 27));
const SCHADE = ['Spiegel rechts, manoeuvreren op dock', 'Krasschade oplegger, laadperron', 'Achteruitrijden tegen paal op terrein', 'Bumper, parkeren bij winkel', 'Zijschade oplegger, laadkuil', 'Rolcontainer tegen laadklep', 'Laadklep tegen stoeprand'];
const WHAT = ['banden as 2', 'remmen voor', 'APK en kleine beurt', 'grote beurt', 'software-update aandrijflijn', 'AdBlue-sensor', 'koppelschotel smeren', 'luchtveer rechts'];
const WHATTR = ['remmen oplegger', 'banden as 3', 'laadklep hydrauliek', 'koelunit service', 'ATP-keuring', 'verlichting en bekabeling', 'stempelpoten'];
const WERK = ['Lekkage luchtveer rechts', 'Camera achter defect', 'Melding bandenspanning as 3', 'Koppelschotel speling'];
const WERKTR = ['Koelunit controleren', 'Laadklep traag', 'Remklauw as 2 vast', 'Zeildoek gescheurd', 'ATP-keuring verlopen'];
const GARAGE = ['Wognum', 'Opmeer', 'Zaandam', 'Tiel'];
export const initials = n => n.split(' ').filter(x => /^[A-Z]/.test(x)).map(x => x[0]).join('').slice(0, 2).toUpperCase() || n.slice(0, 2).toUpperCase();
export const shortName = n => { const p = n.split(' '); return `${p[0][0]}. ${p.slice(1).join(' ')}`; };
export const CAPACITY = t => /600/.test(t.model) ? 600 : /300/.test(t.model) ? 300 : /Volvo/.test(t.model) ? 540 : t.van ? 70 : 0;

export function createPeople(fleet) {
  const persons = []; const byKey = new Map();
  const person = (name, base, div) => {
    const k = name + '|' + base.n; let p = byKey.get(k); if (p) return p;
    const last = name.split(' ').slice(1).join(' ');
    p = {
      id: 'P-' + String(persons.length + 1).padStart(4, '0'), name, short: shortName(name), initials: initials(name), base, div, since: 1998 + Math.floor(rnd() * 28),
      role: div === 'bezorg' ? 'Bezorger B' : 'Chauffeur C/CE', licence: { ce: fmtMY(monthsAhead(6, 60)), code95: fmtMY(monthsAhead(3, 56)), code95Uren: Math.floor(rnd() * 36), kaart: fmtMY(monthsAhead(12, 60)), adr: rnd() < 0.12, lzv: div === 'netwerk' ? rnd() < 0.6 : rnd() < 0.15 },
      rijscore: +r(6.4, 9.6).toFixed(1), remmingen: +r(0.5, 6).toFixed(1), overtredingen: rnd() < 0.15 ? 1 : 0, factor: r(0.9, 1.15),
      contract: { type: rnd() < 0.85 ? 'Onbepaalde tijd' : `Bepaalde tijd tot ${fmtMY(monthsAhead(2, 14))}`, uren: pick([40, 40, 40, 36, 32, 24]), tarief: +r(27.5, 34.5).toFixed(2) },
      verzuim: +Math.max(0, r(-2, 8)).toFixed(1), phone: `06 ${Math.floor(r(10, 99))} ${Math.floor(r(10, 99))} ${Math.floor(r(10, 99))} ${Math.floor(r(10, 99))}`,
      nood: `${pick(['M.', 'A.', 'S.', 'J.', 'E.'])} ${last} (${pick(['partner', 'partner', 'ouder', 'broer', 'zus'])})`, schades: [], history: [], trucks: new Map(), dienst: null,
    };
    p.phoneMasked = '06 •• •• ' + p.phone.slice(-5);
    persons.push(p); byKey.set(k, p); return p;
  };
  // de hele pool per standplaats (ook wie vandaag vrij is), dan de diensten van vandaag
  for (const sp of SP) { const pool = fleet.driverPool.get(sp.n); pool.names.forEach((n, i) => person(n, sp, sp.div[i % sp.div.length])); }
  for (const t of fleet.trucks) for (const d of t.diensten) { const p = person(d.driver, t.base, t.div); d.person = p; p.dienst = { t, d }; p.div = t.div; }
  const poolOf = new Map(); for (const p of persons) { let a = poolOf.get(p.base.n); if (!a) { a = []; poolOf.set(p.base.n, a); } a.push(p); }

  // historie per voertuig: de laatste 12 diensten, chauffeurs uit de pool zonder vaste koppeling (een 'stam' van vier komt vaker terug).
  // Op zondag rijdt een deel van de vloot (fleet.rijdtOpZondag, schatting: samen ongeveer 45 procent): dezelfde keuze als de
  // vloot op die zondag zelf maakt, zodat Gisteren op maandag niet leeg is en ook geen volle werkdag toont. Een zondag zonder
  // dienst kost geen getal uit de reeks; de 12 diensten krijgen dezelfde waarden als voorheen, alleen soms een andere datum.
  const forTruck = new Map();
  for (const t of fleet.trucks) {
    const all = poolOf.get(t.base.n); const pool = all.filter(p => t.kind === 'bus' ? p.div === 'bezorg' : p.div !== 'bezorg'); const src = pool.length ? pool : all;
    const stam = [pick(src), pick(src), pick(src), pick(src)];
    const dayKm = t.routes.reduce((a, x) => a + x.total, 0) || 260;
    const first = t.routes[0] && t.routes[0].marks[1] ? t.routes[0].marks[1].name : t.klant;
    const trs = t.kind === 'trekker' ? fleet.trailersOf(t.base).filter(x => x.div === t.div) : [];
    const history = []; let d = 1;
    while (history.length < 12) {
      const date = dayAgo(d++); if (date.getDay() === 0 && !rijdtOpZondag(t.id, t.div, date)) continue;
      const who = rnd() < 0.55 ? pick(stam) : pick(src);
      const start = (t.dayStart || 300) + Math.round(r(-60, 60) / 15) * 15, len = Math.round(r(470, 590) / 5) * 5, km = Math.round(dayKm / Math.max(1, t.diensten.length) * r(0.82, 1.12));
      const u = rnd(); const note = u < 0.06 ? 'schade gemeld' : u < 0.11 ? 'rijtijdwaarschuwing' : u < 0.15 ? 'storing gemeld' : u < 0.18 ? 'te laat bij tijdvenster' : '';
      const e = { date, day: fmtDay(date), who, start, end: start + len, km, rit: `${DIV[t.div].n} · ${first}`, note, truck: t, tr: trs.length ? pick(trs) : null };
      history.push(e); who.history.push(e); who.trucks.set(t.id, (who.trucks.get(t.id) || 0) + 1);
      if (note === 'schade gemeld') who.schades.push({ date, truck: t.id, what: pick(SCHADE), schuld: rnd() < 0.7 ? 'Eigen' : 'Derde', kosten: Math.round(r(300, 2500) / 10) * 10 });
    }
    const counts = new Map(); for (const h of history) counts.set(h.who, (counts.get(h.who) || 0) + 1);
    const [topDriver, topN] = [...counts].sort((a, b) => b[1] - a[1])[0];
    const vaste = topN / history.length;
    const bouwjaar = t.ev ? 2023 + Math.floor(rnd() * 4) : 2017 + Math.floor(rnd() * 9);
    const kmstand = Math.round(((2026 - bouwjaar) * (t.kind === 'bus' ? 32000 : 95000) + r(5000, 60000)) / 10) * 10;
    const perDriver = new Map();
    for (const h of history) { const v = perDriver.get(h.who) || { n: 0, km: 0 }; v.n++; v.km += h.km; perDriver.set(h.who, v); }
    const base = t.ev ? (t.kind === 'bus' ? 0.3 : 1.1) : t.kind === 'bakwagen' ? 22 : 29.5;
    const verbruik = [...perDriver].map(([p, v]) => ({ p, n: v.n, v: +(base * p.factor * r(0.98, 1.02)).toFixed(t.ev ? 2 : 1) })).sort((a, b) => b.n - a.n);
    const info = {
      history, vaste, topDriver, distinct: counts.size, bouwjaar, kmstand, apk: fmtDate(monthsAhead(1, 12)), terugroep: rnd() < 0.05 ? 'open terugroepactie (software aandrijflijn)' : 'geen open terugroepactie',
      onderhoud: { date: fmtDate(dayAgo(Math.floor(r(5, 70)))), what: pick(WHAT), garage: t.base.hub ? 'Wognum' : pick(GARAGE), volgend: kmstand + Math.round(r(4000, 20000) / 500) * 500 },
      werkorder: t.storing ? { what: t.storing, since: 'vandaag' } : t.vandaag === 'onderhoud' ? { what: pick(WERK), since: fmtDay(dayAgo(Math.floor(r(1, 4)))), gepland: 'vandaag in de werkplaats' } : (rnd() < 0.06 ? { what: pick(WERK), since: fmtDay(dayAgo(Math.floor(r(1, 6)))) } : null),
      banden: rnd() < 0.08 ? 'as 2 laag (melding boordcomputer)' : 'in orde', capacity: CAPACITY(t),
      km30: Math.round(history.reduce((a, h) => a + h.km, 0) / 12 * 26), verbruik: verbruik.length ? verbruik.reduce((a, v) => a + v.v * v.n, 0) / history.length : base, inzet: Math.round(r(72, 92)), onTime: +r(97, 100).toFixed(1),
      schades12: history.filter(h => h.note === 'schade gemeld').length, kostenKm: +(t.ev ? r(0.84, 0.98) : t.kind === 'bus' ? r(0.42, 0.55) : t.kind === 'bakwagen' ? r(0.8, 0.95) : r(1.02, 1.24)).toFixed(2), perDriver: verbruik,
      docs: [['Kentekenbewijs', 'deel 1 en 2, RDW'], ['Verzekeringsbewijs', 'casco en WA, tot 31-12-2026'], ['APK-rapport', `laatste keuring ${fmtDate(dayAgo(Math.floor(r(60, 340))))}`], ['Tachograaf-ijking', `geldig tot ${fmtMY(monthsAhead(3, 24))}`], ...(t.lzv ? [['LZV-ontheffing', 'RDW, kernnet']] : [])],
    };
    forTruck.set(t.id, info);
  }
  // per persoon: een dienst per dag, nieuwste eerst; oudere schades voor een deel
  for (const p of persons) {
    const seen = new Set(); p.history = p.history.sort((a, b) => b.date - a.date).filter(h => { const k = h.date.getTime(); if (seen.has(k)) return false; seen.add(k); return true; });
    if (rnd() < 0.3) { const d = dayAgo(Math.floor(r(200, 720))); p.schades.push({ date: d, truck: [...p.trucks.keys()][0] || 'T-' + (1000 + Math.floor(r(0, 900))), what: pick(SCHADE), schuld: rnd() < 0.65 ? 'Eigen' : 'Derde', kosten: Math.round(r(300, 2500) / 10) * 10 }); }
    p.schades.sort((a, b) => b.date - a.date);
  }
  // standplaatsstatistiek: herhalingsaandeel (hoe vaak dezelfde chauffeur terugkomt op een wagen) en wisselingen per week
  const spStats = new Map();
  for (const sp of SP) { const L = fleet.trucks.filter(t => t.base === sp); const v = L.reduce((a, t) => a + forTruck.get(t.id).vaste, 0) / (L.length || 1); const w = L.reduce((a, t) => a + forTruck.get(t.id).distinct, 0) / (L.length || 1) / 2; spStats.set(sp.n, { vaste: v, wissel: +w.toFixed(1), n: L.length, opDienst: (poolOf.get(sp.n) || []).filter(p => p.dienst).length, pool: (poolOf.get(sp.n) || []).length }); }
  // opleggers: keuring, ATP, onderhoud, documenten
  const forTrailer = new Map();
  for (const tr of fleet.trailers) {
    const koel = !!TRT[tr.type].temp;
    forTrailer.set(tr.id, {
      apk: fmtDate(monthsAhead(1, 12)), atp: koel ? fmtMY(monthsAhead(2, 30)) : null, kmYear: Math.round(r(60, 140)) * 1000,
      onderhoud: { date: fmtDate(dayAgo(Math.floor(r(5, 90)))), what: pick(koel ? WHATTR : WHATTR.filter(w => !/koel|ATP/.test(w))), garage: tr.base.hub ? 'Wognum' : pick(GARAGE) },
      werkorder: tr.storing ? { what: tr.storing, since: 'vandaag' } : tr.onderhoud ? { what: pick(koel ? WERKTR : WERKTR.filter(w => !/Koel|ATP/.test(w))), since: fmtDay(dayAgo(Math.floor(r(1, 4)))), gepland: 'in de werkplaats' } : null,
      banden: rnd() < 0.06 ? 'as 3 profiel laag' : 'in orde',
      docs: [['Kentekenbewijs', 'deel 1 en 2, RDW'], ['APK-rapport', `laatste keuring ${fmtDate(dayAgo(Math.floor(r(60, 340))))}`], ...(koel ? [['ATP-certificaat', `geldig tot ${fmtMY(monthsAhead(2, 30))}`]] : []), ...(tr.type === 'lzv' ? [['LZV-ontheffing', 'RDW, kernnet']] : [])],
    });
  }
  const byId = new Map(persons.map(p => [p.id, p]));
  const truckOf = p => p.dienst ? p.dienst.t : null;
  const planners = makePlanners(fleet);
  return { persons, byId, forTruck, forTrailer, spStats, truckOf, dateLabel: fmtDate, planners, plannerVoor: (spn, div, T) => plannerVoor(planners, spn, div, T) };
}

// ---------- planners ----------
// Een planner per 15 tot 25 voertuigen per standplaats (onderzoek D2), verdeeld over drie diensten: vroeg, dag en avond.
// Wognum, de grootste standplaats, heeft er 9 tot 15. Daarnaast het team van de control tower in Wognum. Fictieve namen
// uit een eigen reeks toevalsgetallen: de chauffeurs en hun gegevens veranderen er niet door.
export const PL_DIENST = { vroeg: { n: 'Vroege dienst', a: 300, b: 810 }, dag: { n: 'Dagdienst', a: 510, b: 1020 }, avond: { n: 'Avonddienst', a: 810, b: 1320 } };
const PL_VOOR = ['Sanne', 'Ilse', 'Femke', 'Lotte', 'Eva', 'Noor', 'Iris', 'Daan', 'Ruud', 'Fatima', 'Yara', 'Esther', 'Mark', 'Jesse', 'Karin', 'Wouter', 'Sophie', 'Hamza', 'Nadia', 'Joost', 'Merel', 'Rutger', 'Inge', 'Bart', 'Ricardo', 'Mirjam', 'Stefan', 'Leila'];
function makePlanners(fleet) {
  let s2 = 5512026; const rn = () => { s2 = (s2 * 16807) % 2147483647; return (s2 - 1) / 2147483646; };
  const pk = a => a[Math.floor(rn() * a.length)];
  const bezet = new Set(); for (const p of fleet.driverPool.values()) for (const n of p.names) bezet.add(n);
  const naam = () => { for (let i = 0; i < 60; i++) { const n = `${pk(PL_VOOR)} ${pk(LAST)}`; if (!bezet.has(n)) { bezet.add(n); return n; } } return `${pk(PL_VOOR)} ${pk(LAST)} ${bezet.size}`; };
  const out = []; const add = o => { const d = PL_DIENST[o.dienst]; out.push({ id: `PL-${String(out.length + 1).padStart(3, '0')}`, a: d.a, b: d.b, ...o }); };
  add({ n: 'Anouk Groot', sp: 'Wognum', div: null, rol: 'Teamleider control tower', dienst: 'dag', team: true }); bezet.add('Anouk Groot');
  for (const sp of SP) {
    const L = fleet.trucks.filter(t => t.base === sp); if (!L.length) continue;
    let k = Math.max(1, Math.round(L.length / 20)); if (sp.n === 'Wognum') k = Math.min(15, Math.max(9, k));
    // de divisies naar hun aandeel in de vloot van de standplaats
    const per = new Map(); for (const t of L) per.set(t.div, (per.get(t.div) || 0) + 1);
    const divs = [...per].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    for (let i = 0; i < k; i++) {
      const dienst = ['dag', 'vroeg', 'avond'][i % 3]; const div = divs[Math.floor(i / 3) % divs.length];
      add({ n: naam(), sp: sp.n, div, rol: `Planner ${DIV[div].n.toLowerCase()}`, dienst, voertuigen: Math.round(L.length / k) });
    }
  }
  add({ n: naam(), sp: 'Wognum', div: null, rol: 'Control tower, avond', dienst: 'avond', team: true });
  return out;
}
// wie pakt een zaak op: een planner van die standplaats en divisie die nu dienst heeft, anders van die standplaats,
// anders het team van de control tower
function plannerVoor(L, spn, div, T) {
  const t = ((T % 1440) + 1440) % 1440; const op = p => t >= p.a && t < p.b;
  return L.find(p => p.sp === spn && p.div === div && op(p)) || L.find(p => p.sp === spn && op(p)) || L.find(p => p.team && op(p)) || L.find(p => p.sp === spn) || L[0];
}
