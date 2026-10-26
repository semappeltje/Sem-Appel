// Het rooster van een chauffeur (Control Tower 4.1). Puur en zonder imports, zodat tests het in Node draaien. In de demo
// gesimuleerd: uit een formule met een seed per persoon, niet als lijst, zodat de bundel klein blijft. In het echt vult het
// roostersysteem of HR (bijvoorbeeld Dyflexis of AFAS) dezelfde vorm:
//
//   { persoon: 'P-0001', contract: { soort: 'vol' | 'deeltijd' | 'halvedag' | 'oproep', urenPerWeek: 40, dagenPerWeek: 5 },
//     week: { ma: ['vroeg', 'dag'], di: [...], ..., zo: [] },        beschikbare dagdelen per weekdag; [] is roostervrij
//     halveDagTot: 780 | null,                                       een halve dag: klaar om 13:00 (minuten van de dag)
//     extraDag: { dag: 'za', weken: 'even' | 'oneven' } | null,       om de week een zesde dag (dan een verkorte weekrust)
//     afwezig: [{ soort: 'vakantie' | 'ziek', van: 'JJJJ-MM-DD', tot: 'JJJJ-MM-DD' }],
//     bron: 'gesimuleerd' | 'roostersysteem', gewijzigd: 'JJJJ-MM-DD' }
//
// roosterDag(rooster, datum) zegt per dag: werk (ingeroosterd, met een venster waarin de dienst valt), vrij (roostervrij:
// een extra dienst kan alleen als de chauffeur ja zegt), rustdag (de weekrust van het rooster), vakantie of ziek. Het venster
// van een werkdag: de dienst begint in het eerste dagdeel en de werkdag duurt hoogstens 13 uur (venster van het begin van het
// dagdeel tot 13 uur na het eind ervan); een halve dag begint vroeg en is om 13:00 klaar.
// Dagdelen zoals in voorkeuren.js: vroeg 03:00 tot 08:00, dag 08:00 tot 13:00, avond 13:00 tot 22:00, nacht 22:00 tot 03:00.
export const WEEKDAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const DAGDEEL_BEGIN = { nacht: 0, vroeg: 180, dag: 480, avond: 780 };
export const DAGDEEL_EIND = { nacht: 180, vroeg: 480, dag: 780, avond: 1320 };
export const CONTRACT = {
  vol: { n: 'volle week', dagen: 5 },
  deeltijd: { n: 'deeltijd', dagen: 4 },
  halvedag: { n: 'halve dagen', dagen: 5 },
  oproep: { n: 'oproep', dagen: 0 },
};
export const STATUS_NAAM = { werk: 'ingeroosterd', vrij: 'vrij volgens rooster', rustdag: 'rustdag', vakantie: 'vakantie', ziek: 'ziek' };
export const WERKDAG_MAX = 780;
export const HALVE_DAG_TOT = 780;
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// eigen hash met eindmenging (murmur3 fmix32), vast per persoon en zout
function h01(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const vanIso = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const plusDag = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const weekdagVan = d => WEEKDAGEN[(d.getDay() + 6) % 7];
const dagdeelVan = m => { const x = ((m % 1440) + 1440) % 1440; return x >= 180 && x < 480 ? 'vroeg' : x >= 480 && x < 780 ? 'dag' : x >= 780 && x < 1320 ? 'avond' : 'nacht'; };
const VOLGORDE = ['nacht', 'vroeg', 'dag', 'avond'];
// ISO-weeknummer (de week begint op maandag)
export function isoWeek(d) { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - n); const j = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - j) / 864e5 + 1) / 7); }
export const hm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

// Het gesimuleerde rooster. p: { id, uren (contracturen uit people.js), werkdagen: [{ datum: Date, start }] (dagen waarop de
// persoon rijdt of reed: die vallen altijd in het rooster), vandaag: Date }.
export function maakRooster(p) {
  const u = k => h01(`rooster|${p.id}|${k}`);
  const uren = p.uren || 40;
  // contract: de contracturen bepalen het soort, een klein deel werkt op oproepbasis
  const soort = u('oproep') < 0.05 ? 'oproep' : uren >= 36 ? 'vol' : uren >= 30 ? 'deeltijd' : u('half') < 0.6 ? 'halvedag' : 'deeltijd';
  const nDagen = soort === 'oproep' ? 4 : soort === 'deeltijd' && uren < 30 ? 3 : CONTRACT[soort].dagen;
  // de dagdelen: die van de vroegste dienst als die er is, anders vroeg en dag (de distributie begint 's ochtends)
  const W = (p.werkdagen || []).slice().sort((x, y) => x.start - y.start);
  const g = u('deel');
  const deel = W.length ? dagdeelVan(W[0].start) : g < 0.72 ? 'vroeg' : g < 0.88 ? 'dag' : g < 0.96 ? 'avond' : 'nacht';
  const delen = soort === 'halvedag' ? ['vroeg', 'dag'] : [deel, VOLGORDE[(VOLGORDE.indexOf(deel) + 1) % 4]];
  // de roostervrije dagen als één blok (de weekrust), zo gekozen dat elke rijdag een werkdag is; past dat niet, dan worden
  // de rijdagen in het blok toch werkdag (een ruil met een collega)
  const vrijN = 7 - nDagen; const rij = new Set(W.map(w => weekdagVan(w.datum)));
  // een gelijke keus uit de blokken die geen rijdag raken (anders stapelen de vrije dagen zich op de dag na vandaag)
  const goed = [0, 1, 2, 3, 4, 5, 6].filter(s => !Array.from({ length: vrijN }, (_, i) => WEEKDAGEN[(s + i) % 7]).some(d => rij.has(d)));
  // p.kies: een keus van buiten (people.js verdeelt de vrije dagen over de standplaats naar de vraag per weekdag)
  const start = goed.length ? (p.kies ? p.kies(goed, vrijN) : goed[Math.floor(u('vrij') * goed.length)]) : Math.floor(u('vrij') * 7);
  const vrij = new Set(Array.from({ length: vrijN }, (_, i) => WEEKDAGEN[(start + i) % 7]).filter(d => !rij.has(d)));
  const week = {}; for (const d of WEEKDAGEN) week[d] = vrij.has(d) ? [] : delen.slice();
  // een derde van de volle weken werkt om de week een zesde dag (de eerste vrije dag): dan is de weekrust die week verkort
  const vb = [...vrij]; const extraDag = soort === 'vol' && vb.length >= 2 && u('zes') < 0.35 ? { dag: WEEKDAGEN[start], weken: u('pariteit') < 0.5 ? 'even' : 'oneven' } : null;
  // halve dag: een rijdag die later begint, krijgt een eigen venster (de dienst van vandaag valt altijd in het rooster)
  const laat = soort === 'halvedag' && W.length > 0;
  // afwezig: vakantie (ongeveer een op de acht heeft nu of binnen twee weken een week vakantie) en soms ziek; nooit op een
  // dag waarop de persoon rijdt of reed
  const afwezig = []; const vd = p.vandaag || new Date();
  const rijIso = new Set(W.map(w => iso(w.datum)));
  const vrijVan = (van, n) => { for (let i = 0; i < n; i++) if (rijIso.has(iso(plusDag(van, i)))) return false; return true; };
  if (u('vak') < 0.125) { const van = plusDag(vd, Math.floor(u('vakvan') * 14) - 3); if (vrijVan(van, 7)) afwezig.push({ soort: 'vakantie', van: iso(van), tot: iso(plusDag(van, 6)) }); }
  if (u('ziek') < 0.06) { const van = plusDag(vd, -Math.floor(u('ziekvan') * 3)); const n = 2 + Math.floor(u('ziekn') * 4); if (vrijVan(van, n)) afwezig.push({ soort: 'ziek', van: iso(van), tot: iso(plusDag(van, n - 1)) }); }
  return { persoon: p.id, contract: { soort: laat ? 'deeltijd' : soort, urenPerWeek: soort === 'oproep' ? 0 : uren, dagenPerWeek: nDagen }, week, extraDag, halveDagTot: soort === 'halvedag' && !laat ? HALVE_DAG_TOT : null, afwezig, bron: 'gesimuleerd', gewijzigd: iso(plusDag(vd, -Math.floor(u('gew') * 20) - 1)) };
}

// Een dag van het rooster. datum: Date. Geeft { status, dagdelen, van, tot, tekst, kort }, met van en tot in minuten van die
// dag (het venster waarin gewerkt mag worden; tot kan na middernacht liggen), of null op een dag zonder werk.
export function roosterDag(R, datum) {
  if (!R) return { status: 'werk', dagdelen: [], van: 0, tot: 2040, tekst: 'geen rooster bekend', kort: 'geen rooster' };
  const d = iso(datum);
  const af = (R.afwezig || []).find(a => a.van <= d && d <= a.tot);
  if (af) { const tot = vanIso(af.tot); return { status: af.soort, dagdelen: [], van: null, tot: null, tekst: `${af.soort === 'ziek' ? 'ziek gemeld' : 'vakantie'} tot en met ${tot.getDate()} ${MAAND[tot.getMonth()]}`, kort: af.soort }; }
  const wd = weekdagVan(datum); let delen = (R.week && R.week[wd]) || [];
  // de zesde dag om de week: dezelfde dagdelen als de werkdagen
  if (!delen.length && R.extraDag && R.extraDag.dag === wd && (isoWeek(datum) % 2 === 0) === (R.extraDag.weken === 'even')) delen = Object.values(R.week).find(x => x.length) || [];
  // oproep: een opgegeven dag telt als werk (de oproep is de afspraak); zonder opgave is de dag vrij
  if (R.contract && R.contract.soort === 'oproep' && !delen.length) return { status: 'vrij', dagdelen: [], van: null, tot: null, tekst: 'oproep: vandaag niet opgegeven', kort: 'oproep' };
  const oproep = !!(R.contract && R.contract.soort === 'oproep');
  if (!delen.length) {
    // de eerste roostervrije dag na een werkdag is de rustdag (het begin van de weekrust); de rest is roostervrij
    const gisteren = (R.week && R.week[weekdagVan(plusDag(datum, -1))]) || [];
    return gisteren.length ? { status: 'rustdag', dagdelen: [], van: null, tot: null, tekst: 'rustdag volgens rooster (weekrust)', kort: 'rustdag' } : { status: 'vrij', dagdelen: [], van: null, tot: null, tekst: 'vrij volgens rooster', kort: 'vrij' };
  }
  const van = DAGDEEL_BEGIN[delen[0]], eind = DAGDEEL_EIND[delen[0]];
  if (R.halveDagTot) return { status: 'werk', dagdelen: delen, van, tot: R.halveDagTot, tekst: `halve dag, begint vanaf ${hm(van)} en klaar om ${hm(R.halveDagTot)}`, kort: `halve dag tot ${hm(R.halveDagTot)}` };
  return { status: 'werk', dagdelen: delen, van, tot: eind + WERKDAG_MAX, tekst: `${oproep ? 'oproep, opgegeven' : 'ingeroosterd'}, begint tussen ${hm(van)} en ${hm(eind)}, werkdag hoogstens 13 uur`, kort: `begint ${hm(van)} tot ${hm(eind)}` };
}

// Past een blok [a, b] (minuten van de dag van datum) in het rooster? Geeft { ok, dag, regel: { regel: 'rooster', ernst, tekst } }.
// Werk: het blok valt in het venster. Vrij: een extra dienst, alleen als de chauffeur ja zegt. Vrij, rustdag, vakantie en
// ziek zijn op het planbord een fout; de planner kan er bewust van afwijken, met een reden (toets.js maakt er dan let op van).
export function pastInRooster(R, datum, a, b, naam = 'de chauffeur') {
  const dag = roosterDag(R, datum);
  if (dag.status === 'werk') {
    if (a < dag.van - 0.5) return { ok: false, dag, regel: { regel: 'rooster', ernst: 'fout', tekst: `Buiten het rooster van ${naam}: begint pas om ${hm(dag.van)} (${dag.tekst}).` } };
    if (b > dag.tot + 0.5) return { ok: false, dag, regel: { regel: 'rooster', ernst: 'fout', tekst: `Buiten het rooster van ${naam}: ${dag.tekst}, de rit loopt tot ${hm(b)}.` } };
    return { ok: true, dag, regel: { regel: 'rooster', ernst: 'ok', tekst: `Binnen het rooster van ${naam} (${dag.kort}).` } };
  }
  const tekst = dag.status === 'vrij' ? `${naam} is ${dag.tekst}: een extra dienst kan alleen als hij of zij ja zegt.` : `${naam}: ${dag.tekst}.`;
  return { ok: false, dag, regel: { regel: 'rooster', ernst: 'fout', tekst } };
}

// Een week van het rooster, voor de chauffeurspagina: [{ dag: 'ma', datum, iso, status, tekst, lang }]
export function roosterWeek(R, vanaf) {
  const ma = plusDag(vanaf, -((vanaf.getDay() + 6) % 7));
  return WEEKDAGEN.map((wd, i) => { const datum = plusDag(ma, i); const x = roosterDag(R, datum); return { dag: wd, datum, iso: iso(datum), status: x.status, tekst: x.kort, lang: x.tekst, dagdelen: x.dagdelen || [] }; });
}
