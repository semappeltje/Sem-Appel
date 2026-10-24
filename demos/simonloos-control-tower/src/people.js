// Personen (chauffeurs) en gegevens per truck voor de record-pagina's: wie reed erop, kerngegevens, cijfers,
// onderhoud, documenten en de vaste-chauffeurindex. Alles gesimuleerd en deterministisch; namen en nummers zijn fictief.
import { SP, DIV } from './places.js';
import { FIRST, LAST } from './fleet.js';

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
const SCHADE = ['Spiegel rechts, manoeuvreren op dock', 'Krasschade trailer, laadperron', 'Achteruitrijden tegen paal op terrein', 'Bumper, parkeren bij winkel', 'Zijschade trailer, laadkuil', 'Rolcontainer tegen laadklep', 'Laadklep tegen stoeprand'];
const WHAT = ['banden as 2', 'remmen voor', 'koelunit service', 'APK en kleine beurt', 'grote beurt', 'software-update aandrijflijn', 'AdBlue-sensor', 'laadklep hydrauliek'];
const WERK = ['Koelunit controleren', 'Lekkage luchtveer rechts', 'Camera achter defect', 'Laadklep traag', 'Melding bandenspanning as 3'];
const GARAGE = ['Wognum', 'Opmeer', 'Zaandam', 'Tiel'];
export const initials = n => n.split(' ').filter(x => /^[A-Z]/.test(x)).map(x => x[0]).join('').slice(0, 2).toUpperCase() || n.slice(0, 2).toUpperCase();
export const shortName = n => { const p = n.split(' '); return `${p[0][0]}. ${p.slice(1).join(' ')}`; };
export const CAPACITY = t => /600/.test(t.model) ? 600 : /300/.test(t.model) ? 300 : /Volvo/.test(t.model) ? 540 : t.van ? 70 : 0;

export function createPeople(fleet) {
  const persons = []; const byKey = new Map();
  const person = (name, base, div, since) => {
    const k = name + '|' + base.n; let p = byKey.get(k); if (p) return p;
    const last = name.split(' ').slice(1).join(' ');
    p = {
      id: 'P-' + String(persons.length + 1).padStart(4, '0'), name, short: shortName(name), initials: initials(name), base, div, since: since || 1998 + Math.floor(rnd() * 28),
      role: 'Chauffeur C/CE', licence: { ce: fmtMY(monthsAhead(6, 60)), code95: fmtMY(monthsAhead(3, 56)), code95Uren: Math.floor(rnd() * 36), kaart: fmtMY(monthsAhead(12, 60)), adr: rnd() < 0.12, lzv: div === 'netwerk' ? rnd() < 0.6 : rnd() < 0.15 },
      rijscore: +r(6.4, 9.6).toFixed(1), remmingen: +r(0.5, 6).toFixed(1), overtredingen: rnd() < 0.15 ? 1 : 0, factor: r(0.9, 1.15),
      contract: { type: rnd() < 0.85 ? 'Onbepaalde tijd' : `Bepaalde tijd tot ${fmtMY(monthsAhead(2, 14))}`, uren: pick([40, 40, 40, 36, 32]), tarief: +r(27.5, 34.5).toFixed(2) },
      verzuim: +Math.max(0, r(-2, 8)).toFixed(1), phone: `06 ${Math.floor(r(10, 99))} ${Math.floor(r(10, 99))} ${Math.floor(r(10, 99))} ${Math.floor(r(10, 99))}`,
      nood: `${pick(['M.', 'A.', 'S.', 'J.', 'E.'])} ${last} (${pick(['partner', 'partner', 'ouder', 'broer', 'zus'])})`, schades: [], history: [], trucks: new Map(),
    };
    p.phoneMasked = '06 •• •• ' + p.phone.slice(-5);
    persons.push(p); byKey.set(k, p); return p;
  };
  // vaste chauffeur per truck, plus reservechauffeurs per standplaats
  for (const t of fleet.trucks) { t.person = person(t.driver, t.base, t.div, t.since); t.vaste = r(0.55, 0.92); }
  for (const sp of SP) for (let i = 0; i < Math.ceil(sp.fleet * 0.15); i++) person(`${pick(FIRST)} ${pick(LAST)}`, sp, sp.div[i % sp.div.length]);
  const pool = new Map(); for (const p of persons) { let a = pool.get(p.base.n); if (!a) { a = []; pool.set(p.base.n, a); } a.push(p); }

  const forTruck = new Map();
  for (const t of fleet.trucks) {
    const others = pool.get(t.base.n).filter(p => p !== t.person);
    const dayKm = t.routes.reduce((a, x) => a + x.total, 0);
    const first = t.routes[0].marks[1] ? t.routes[0].marks[1].name : t.klant;
    const history = []; let d = 1;
    while (history.length < 12) {
      const date = dayAgo(d++); if (date.getDay() === 0) continue;
      const who = rnd() < t.vaste || !others.length ? t.person : pick(others);
      const start = t.shiftStart + Math.round(r(-45, 45) / 15) * 15, km = Math.round(dayKm * r(0.82, 1.12));
      const u = rnd(); const note = u < 0.06 ? 'schade gemeld' : u < 0.11 ? 'rijtijdwaarschuwing' : u < 0.15 ? 'storing gemeld' : u < 0.18 ? 'te laat bij tijdvenster' : '';
      const e = { date, day: fmtDay(date), who, start, end: start + t.shiftEnd, km, rit: `${DIV[t.div].n} · ${first}`, note, truck: t };
      history.push(e); who.history.push(e); who.trucks.set(t.id, (who.trucks.get(t.id) || 0) + 1);
      if (note === 'schade gemeld') who.schades.push({ date, truck: t.id, what: pick(SCHADE), schuld: rnd() < 0.7 ? 'Eigen' : 'Derde', kosten: Math.round(r(300, 2500) / 10) * 10 });
    }
    const vaste = history.filter(h => h.who === t.person).length / history.length;
    const bouwjaar = t.ev ? 2024 + Math.floor(rnd() * 3) : 2018 + Math.floor(rnd() * 8);
    const kmstand = Math.round(((2026 - bouwjaar) * 88000 + r(5000, 60000)) / 10) * 10;
    const perDriver = new Map();
    for (const h of history) { const v = perDriver.get(h.who) || { n: 0, km: 0 }; v.n++; v.km += h.km; perDriver.set(h.who, v); }
    const base = t.ev ? 1.1 : t.van ? 0.3 : 29.5;
    const verbruik = [...perDriver].map(([p, v]) => ({ p, n: v.n, v: +(base * p.factor * r(0.98, 1.02)).toFixed(t.ev || t.van ? 2 : 1) })).sort((a, b) => b.n - a.n);
    const info = {
      history, vaste, bouwjaar, kmstand, apk: fmtDate(monthsAhead(1, 12)), terugroep: rnd() < 0.05 ? 'open terugroepactie (software aandrijflijn)' : 'geen open terugroepactie',
      onderhoud: { date: fmtDate(dayAgo(Math.floor(r(5, 70)))), what: pick(WHAT), garage: t.base.hub ? 'Wognum' : pick(GARAGE), volgend: kmstand + Math.round(r(4000, 20000) / 500) * 500 },
      werkorder: t.storing ? { what: t.storing, since: 'vandaag' } : (rnd() < 0.08 ? { what: pick(WERK), since: fmtDay(dayAgo(Math.floor(r(1, 6)))) } : null),
      banden: rnd() < 0.08 ? 'as 2 laag (melding boordcomputer)' : 'in orde', capacity: CAPACITY(t),
      km30: Math.round(history.reduce((a, h) => a + h.km, 0) / 12 * 26), verbruik: verbruik.length ? verbruik.reduce((a, v) => a + v.v * v.n, 0) / history.length : base, inzet: Math.round(r(72, 92)), onTime: +r(90, 99.5).toFixed(1),
      schades12: history.filter(h => h.note === 'schade gemeld').length, kostenKm: +(t.ev ? r(0.84, 0.98) : t.van ? r(0.42, 0.55) : r(1.02, 1.24)).toFixed(2), perDriver: verbruik,
      docs: [['Kentekenbewijs', 'deel 1 en 2, RDW'], ['Verzekeringsbewijs', 'casco en WA, tot 31-12-2026'], ['APK-rapport', `laatste keuring ${fmtDate(dayAgo(Math.floor(r(60, 340))))}`], ...(t.div === 'winkel' ? [['ATP-certificaat koeltrailer', `geldig tot ${fmtMY(monthsAhead(4, 30))}`]] : []), ['Tachograaf-ijking', `geldig tot ${fmtMY(monthsAhead(3, 24))}`], ...(t.lzv ? [['LZV-ontheffing', 'RDW, kernnet']] : [])],
    };
    forTruck.set(t.id, info);
  }
  // oudere schades voor een deel van de chauffeurs
  for (const p of persons) if (rnd() < 0.3) { const d = dayAgo(Math.floor(r(200, 720))); p.schades.push({ date: d, truck: [...p.trucks.keys()][0] || 'W-' + String(Math.floor(r(1, 1300))).padStart(4, '0'), what: pick(SCHADE), schuld: rnd() < 0.65 ? 'Eigen' : 'Derde', kosten: Math.round(r(300, 2500) / 10) * 10 }); }
  for (const p of persons) p.schades.sort((a, b) => b.date - a.date);
  // standplaatsstatistiek: gemiddelde vaste-chauffeurindex en wisselingen per week
  const spStats = new Map();
  for (const sp of SP) { const L = fleet.trucks.filter(t => t.base === sp); const v = L.reduce((a, t) => a + forTruck.get(t.id).vaste, 0) / (L.length || 1); spStats.set(sp.n, { vaste: v, wissel: +((1 - v) * 6).toFixed(1), n: L.length }); }
  const byId = new Map(persons.map(p => [p.id, p]));
  const truckOf = p => fleet.trucks.find(t => t.person === p) || null;
  return { persons, byId, forTruck, spStats, truckOf, dateLabel: fmtDate };
}
