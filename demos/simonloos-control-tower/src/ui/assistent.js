// De assistent: voorstellen bij open zaken die het plan echt aanpassen (ui.runAction, bewaard in sl-acties), vragen in
// gewone taal over de live situatie, de overdracht naar de volgende dienst, berichten met chauffeurs en de collega's op
// dienst. Geen toeval hier: vaste keuzes, zodat een herlaad hetzelfde geeft.
import { SP, TOWNS, laadpunten } from '../places.js';
import { KIND, TRT, TRST } from '../fleet.js';
import { thuisMin } from '../inzet.js';
import { esc, ic, fmt, hhmm, nl1, fmtDrive, initials, empty, on, VST } from './base.js';
import { CAPACITY } from '../people.js';
import { aiUrl, aiHtml, bindAi } from './ai.js';
import { standTekst } from './stand.js';
import { verplaatsRit, ritInvoer, toetsVoor } from './planwijzig.js';

// Het effect van een voorstel in korte regels (onderzoek W3): wat er met tijdvensters, kilometers, rijtijd en accu
// gebeurt. Gerekend uit het dagplan; afstanden hemelsbreed maal 1,3 en dus "ongeveer".
const ROAD = 1.3;
const eff = (t, cls = '') => ({ t, cls });
function kmRest(t, T) { const rel = (((T - t.dayStart) % 1440) + 1440) % 1440; let km = 0; for (const s of t.plan) { if (s.k !== 'drive' || s.t1 <= rel) continue; const f = s.t0 >= rel ? 1 : (s.t1 - rel) / (s.t1 - s.t0); km += Math.max(0, (s.km1 || 0) - (s.km0 || 0)) * f; } return km; }

function nearestSp(pos, minLp = 12) { let best = null, bd = Infinity; for (const sp of SP) { if (laadpunten(sp) < minLp) continue; const d = Math.hypot((sp.lon - pos.lon) * 68, (sp.lat - pos.lat) * 111); if (d < bd) { bd = d; best = sp; } } return { sp: best, km: Math.round(bd) }; }
const kmBetween = (a, b) => Math.hypot((a.lon - b.lon) * 68, (a.lat - b.lat) * 111);
const meer = (n, een, veel) => `${n} ${n === 1 ? een : veel}`;
// een stopnaam kort maar te onderscheiden: "Albert Heijn Breestraat, Leiden" wordt "AH Breestraat, Leiden"
const stopKort = n => String(n || '').replace(/^Albert Heijn\b/, 'AH');

// ---------- vertraging: een voorstel met winst, of de klant de nieuwe ETA ----------
// Een vertraging (fleet.vertraging) raakt stops die na hun venster aankomen. De stops van de rit die het voertuig nu rijdt,
// kan niemand eerder bedienen: de lading zit in deze wagen. Die klanten krijgen de nieuwe ETA (een bericht met een
// volg-link; het venster gaat mee). Een volgende rit die door de vertraging te laat vertrekt, is nog niet begonnen: die kan
// op de geplande tijd met een vrij voertuig en een vrije chauffeur van dezelfde standplaats. Het effect rekent de assistent
// door het voorstel op proef uit te voeren (fleet.proef, met dezelfde functies als Toepassen) en de ETA van elke geraakte
// stop voor en na te lezen; daarna staat alles weer zoals het was. Zo is de beloofde winst wat Toepassen doet. Een voorstel
// zonder winst komt niet in de lijst; dan is het voorstel de klant informeren.
export const klantBericht = (x, oorzaak) => `Je levering van vandaag komt later: rond ${hhmm(x.eta)} in plaats van uiterlijk ${hhmm(x.venster[1])}${oorzaak ? `, door een ${oorzaak}` : ''}. Je kunt de wagen volgen via de link.`;
// Een stop bij een eigen vestiging (een crossdock van Simon Loos, zoals Geldermalsen) is geen klant: daar gaat een intern
// bericht naar de collega's van de vestiging (dock en ontvangst), zonder volg-link.
export const internBericht = (x, t, oorzaak) => `Intern: ${t.id} komt rond ${hhmm(x.eta)} in plaats van uiterlijk ${hhmm(x.venster[1])}${oorzaak ? `, door een ${oorzaak}` : ''}. Houd het dock vrij en pas de ontvangst aan.`;
const berichtVoor = (x, t, oorzaak) => (x.eigen ? { aan: stopKort(x.naam), tekst: internBericht(x, t, oorzaak), intern: true } : { aan: stopKort(x.naam), tekst: klantBericht(x, oorzaak) });
// Een rit naar een ander voertuig op een gekozen tijd (planwijzig.verplaatsRit, zoals Zet hier op het planbord), met de
// gekozen chauffeur als de rit daar een eigen dienst wordt. Gedeeld door het voorstel (op proef) en Toepassen (runAction).
export function ritNaar(ctx, rit, B, start, wieId) {
  // is de rit de enige rit van zijn dienst, dan gaat de hele dienst mee, met zijn eigen chauffeur (verplaatsRit)
  const A = rit.t; const di = A.plan[rit.i0] ? A.plan[rit.i0].d : null;
  const heel = di !== null && di !== undefined && !A.plan.some((s, k) => (k < rit.i0 || k > rit.i1) && s.d === di && s.route);
  const r = verplaatsRit(ctx, rit, B, start); if (!r || !r.ok) return r || { ok: false, tekst: 'Verplaatsen lukte niet.' };
  const p = wieId && !heel ? ctx.people.byId.get(wieId) : null; if (!p || p.dienst) return r;
  const rel = start - B.dayStart; const seg = B.plan.find(s => s.d !== null && s.d !== undefined && s.t0 <= rel + 0.5 && rel < s.t1 - 0.01);
  const d = seg ? B.diensten.find(x => x.i === seg.d) : null;
  // alleen een eigen dienst met alleen deze rit krijgt de gekozen chauffeur (niet de dienst van iemand anders)
  if (d && d.person !== p && (d.routes || []).every(x => rit.routes.includes(x))) {
    if (d.person && d.person.dienst && d.person.dienst.d === d) d.person.dienst = null;
    d.driver = p.name; d.person = p; p.dienst = { t: B, d }; if (B.diensten[0] === d) B.driver = p.name; r.chauffeur = p.name;
  }
  return r;
}
// een vrije chauffeur van de standplaats: vandaag vrij (niet ziek, op vakantie of met een rustdag), nog zonder dienst; wie
// graag extra diensten rijdt eerst (de grootste kans op een ja), dan wie dat soms doet, dan de rest
const EXTRA = { graag: 0, soms: 1, nee: 2 };
function vrijeChauffeur(ctx, t, used) {
  const L = (ctx.fleet.chauffeurs ? ctx.fleet.chauffeurs(t.base, ctx.people) : []).filter(c => c.status === 'vrij' && (t.kind === 'bus') === (c.div === 'bezorg'));
  const rang = c => (c.voorkeuren && EXTRA[c.voorkeuren.extra] !== undefined ? EXTRA[c.voorkeuren.extra] : 1);
  for (const c of L.map((c, i) => [c, i]).sort((a, b) => rang(a[0]) - rang(b[0]) || a[1] - b[1]).map(x => x[0])) {
    const p = ctx.people.byId.get(c.id); if (p && !p.dienst && !used.has(p)) return p;
  }
  return null;
}
// De volgende rit r2 van t, die door de vertraging later vertrekt, op de geplande tijd naar een vrij voertuig met een vrije
// chauffeur. Geeft null, of { r2, B, wie, start, winst (minuten, opgeteld over de stops van r2), verhuisd, klant }.
function probeerRitNaar(ctx, t, r2, v, used) {
  const { fleet, people, state } = ctx; const T = state.simTime; const P = t.plan;
  // hoeveel de rit opschoof: de aankomst van zijn eerste rijstuk tegen de geplande aankomst (gepland)
  // (gepland is de aankomst zonder de vertraging van dat stuk zelf, dus die gaat er ook af)
  let schuif = 0; for (let i = r2.i0; i <= r2.i1; i++) { const x = P[i]; if (x && x.k === 'drive' && x.gepland !== undefined) { schuif = t.dayStart + x.t1 - (x.delay || 0) - x.gepland; break; } }
  if (schuif < 1) return null;
  const nu0 = t.dayStart + P[r2.i0].t0; const dur = P[r2.i1].t1 - P[r2.i0].t0;
  // is de rit de enige rit van zijn dienst, dan gaat de dienst met zijn eigen chauffeur mee; anders een vrije chauffeur
  const di = P[r2.i0].d; const heel = di !== null && di !== undefined && !P.some((s, k) => (k < r2.i0 || k > r2.i1) && s.d === di && s.route);
  const wie = heel ? null : vrijeChauffeur(ctx, t, used); if (!heel && !wie) return null;
  const chauffeur = heel ? (t.diensten.find(d => d.i === di) || {}).driver || 'de chauffeur' : wie.name;
  const vk = wie ? (fleet.chauffeurs(t.base, people).find(c => c.id === wie.id) || {}).voorkeuren : null; const extra = vk ? vk.extra : null;
  // vertrek op de geplande tijd, of zo snel als de chauffeur er kan zijn (van huis: aanrijtijd, schatting)
  const start = Math.round(Math.max(nu0 - schuif, Math.ceil((T + (heel ? 15 : thuisMin(wie.id))) / 5) * 5));
  if (start > nu0 - 1) return null;
  const end = start + dur; const inv = ritInvoer(r2);
  const kand = fleet.trucks.filter(b => b !== t && b.base === t.base && b.kind === t.kind && b.vandaag !== 'onderhoud' && !b.storing && !used.has(b)
    && !b.diensten.some(d => start < d.end + 20 && d.start - 20 < end) && (!b.plan.some(x => x.route) || b.dayStart <= start - 30) && (!b.ev || (inv.km || 0) <= b.range * 0.78))
    .sort((a, b) => ((b.vandaag === 'reserve') - (a.vandaag === 'reserve')) || a.idx - b.idx);
  let B = null; for (const b of kand.slice(0, 6)) { let u = null; try { u = toetsVoor(ctx, b, inv, start, r2); } catch { u = null; } if (u && u.ok) { B = b; break; } }
  if (!B) return null;
  // voor: elke stop die nog komt, uit het plan; na: dezelfde stops nadat het voorstel op proef is uitgevoerd
  const keys = v.stops.map(x => ({ naam: x.naam, route: x.route, idx: x.idx }));
  const plat = (st, wie2) => (st ? { eta: st.eta, venster: st.venster ? [st.venster[0], st.venster[1]] : null, laat: st.laat, op: wie2 || st.t.id } : null);
  const voor = keys.map(k => plat(fleet.stopOp([t], k.route, k.idx)));
  const na = fleet.proef([t, B], () => {
    const r = ritNaar(ctx, r2, B, start, wie ? wie.id : null); if (!r || !r.ok) return null;
    const k = fleet.klantEta(t, T);
    return { stops: keys.map(k2 => plat(fleet.stopOp([t, B], k2.route, k2.idx))), klant: k.stops.map(x => ({ naam: x.naam, eta: x.eta, venster: [x.venster[0], x.venster[1]], eigen: !!x.eigen })) };
  }, people.persons.filter(p => p.base === t.base));
  if (!na) return null;
  let winst = 0; const verhuisd = [];
  keys.forEach((k, i) => { const a = voor[i], b = na.stops[i]; if (!a || !b || b.op !== B.id) return; const w = Math.round(a.eta - b.eta); if (w > 0) { winst += w; verhuisd.push({ naam: k.naam, voor: a.eta, na: b.eta, winst: w, laat: b.laat, venster: b.venster }); } });
  return winst > 0 ? { r2, B, wie, heel, chauffeur, extra, start, winst, verhuisd, klant: na.klant } : null;
}
// het bericht aan de klant bij een voorstel (uitklapbaar), zodat de planner leest wat er uitgaat; een eigen vestiging krijgt
// een intern bericht
export const berichtHtml = p => { const B = p.berichten || []; if (!B.length) return ''; const n = B.filter(b => !b.intern).length, e = B.length - n; return `<details class="prop-bericht"><summary>${B.length === 1 ? `${B[0].intern ? 'Intern bericht' : 'Bericht'} aan ${esc(B[0].aan)}` : `Berichten aan ${[n ? `${n} ${n === 1 ? 'klant' : 'klanten'}` : '', e ? `${e} ${e === 1 ? 'eigen vestiging' : 'eigen vestigingen'}` : ''].filter(Boolean).join(' en ')}`}</summary>${B.map(b => `<p><b>${esc(b.aan)}</b>${b.intern ? ' (intern)' : ''}: ${esc(b.tekst)}</p>`).join('')}</details>`; };
// wie de nieuwe ETA krijgt: klanten een bericht met een volg-link, eigen vestigingen een intern bericht
function etaWie(L) {
  const k = L.filter(x => !x.eigen), e = L.filter(x => x.eigen); const deel = [];
  if (k.length) deel.push(`${k.length === 1 ? stopKort(k[0].naam) : `${k.length} klanten`} ${k.length === 1 ? 'krijgt' : 'krijgen'} de nieuwe ETA met een volg-link`);
  if (e.length) deel.push(`${e.length === 1 ? stopKort(e[0].naam) : `${e.length} eigen vestigingen`} ${e.length === 1 ? 'krijgt' : 'krijgen'} een intern bericht`);
  return deel.join(', en ');
}
const etaRegel = x => (x.eigen ? `${stopKort(x.naam)}: intern bericht, aankomst rond ${hhmm(x.eta)} (venster tot ${hhmm(x.venster[1])}${x.laat ? `, ${x.laat} min later` : ''})` : `${stopKort(x.naam)}: nieuwe ETA ${hhmm(x.eta)} doorgegeven (venster tot ${hhmm(x.venster[1])}${x.laat ? `, ${x.laat} min later` : ''})`);
const vCache = new Map();
function vertragingVoorstel(ctx, z, t, used) {
  const { fleet, state } = ctx; const T = state.simTime;
  const v = fleet.vertraging(t, T); if (!v) return null;
  const ritten = ctx.R.ofTruck(t); const rNu = ctx.R.ritOf(t, T);
  const ritVan = x => ritten.find(r => x.i >= r.i0 && x.i <= r.i1) || null;
  // de ritten die nog moeten beginnen en waarvan een stop te laat komt
  const later = []; for (const x of v.laat) { const r = ritVan(x); if (r && r !== rNu && !later.includes(r) && ctx.R.stateOf(r, T, ctx.S).st === 'gepland') later.push(r); }
  let best = null;
  for (const r2 of later.slice(0, 2)) {
    const sig = `${z.key}|${r2.id}|${ctx.R.ver()}|${Math.floor(T)}`; let res = vCache.get(sig);
    if (res === undefined || (res && (used.has(res.B) || (res.wie && used.has(res.wie))))) { res = probeerRitNaar(ctx, t, r2, v, used); vCache.set(sig, res); if (vCache.size > 300) vCache.delete(vCache.keys().next().value); }
    if (res) { best = res; break; }
  }
  const oorzaak = v.oorzaak;
  if (best) {
    used.add(best.B); if (best.wie) used.add(best.wie);
    const { r2, B, wie, heel, chauffeur, extra, start, winst, verhuisd, klant } = best; const kl = klant.length; const n = verhuisd.length;
    const act = { k: 'ritNaar', rit: r2.id, naar: B.id, start, wie: wie ? wie.id : null };
    return {
      id: 'v' + t.id, key: z.key, sev: 'bad', kind: 'Vertraging', kort: `Volgende rit naar ${B.id}`, t,
      title: `${t.id} loopt ${v.achter} min achter: ${meer(v.laat.length, 'stop komt', 'stops komen')} na het venster`,
      action: `Rit ${r2.id} (${meer(n, 'stop', 'stops')}) gaat naar ${B.id} met ${chauffeur}${heel ? ', zijn eigen dienst' : ', vandaag vrij'}: vertrek ${hhmm(start)} in plaats van ${hhmm(t.dayStart + t.plan[r2.i0].t0)}.${kl ? ` Van de rit die ${t.id} nu rijdt: ${etaWie(klant)}.` : ''}`,
      why: `${t.id} loopt ${v.achter} min achter${oorzaak ? ` door een ${oorzaak}` : ''}. Rit ${r2.id} is nog niet begonnen: met een vrij voertuig en een vrije chauffeur vertrekt hij op tijd. De lading van de rit die ${t.id} nu rijdt, zit in die wagen; die klanten informeer je. Getoetst op overlap, venster, rijtijd, rust, accu, oplegger en dock. ${heel ? `${chauffeur} rijdt zijn eigen dienst, alleen met een andere wagen.` : `${chauffeur} is vandaag vrij en ${extra === 'graag' ? 'rijdt graag extra diensten' : extra === 'nee' ? 'rijdt liever geen extra diensten' : 'rijdt soms een extra dienst'}: eerst bellen, aanrijden ongeveer ${thuisMin(wie.id)} min (schatting).`}`,
      effect: [
        ...verhuisd.map(x => eff(`${stopKort(x.naam)} ${hhmm(x.na)} in plaats van ${hhmm(x.voor)} (${x.winst} min winst), ${x.laat ? `nog ${x.laat} min na het venster` : 'venster gehaald'}`, x.laat ? 'bad' : 'ok')),
        ...klant.map(x => eff(etaRegel(x))),
        eff('geen extra kilometers', 'ok'),
      ],
      winst: { soort: 'minuten', min: winst, stops: verhuisd.map(x => ({ naam: x.naam, voor: x.voor, na: x.na, winst: x.winst, gehaald: !x.laat })), klant: klant.map(x => ({ naam: x.naam, eta: x.eta, eigen: !!x.eigen })) },
      berichten: klant.map(x => berichtVoor(x, t, oorzaak)),
      acts: [act, { k: 'klantEta', t: t.id }], act, hint: `Het plan verandert echt: rit ${r2.id} staat daarna op ${B.id} op het planbord en het vertrekbord, de klanten krijgen hun bericht, beide chauffeurs een bericht.`,
      msg: () => [[t, `Planning: rit ${r2.id} rijdt ${B.id}. Rij de rit die je nu rijdt af${kl ? '; de klanten weten van de nieuwe ETA' : ''}.`], [B, `Planning: rit ${r2.id} voor ${r2.klant}, vertrek ${hhmm(start)} vanaf ${t.base.n}, ${meer(n, 'stop', 'stops')}.`]],
    };
  }
  // geen rit die met winst kan verhuizen: de klanten van alle stops die te laat komen, krijgen de nieuwe ETA (een eigen
  // vestiging, zoals een crossdock, een intern bericht)
  const klant = v.laat.map(x => ({ naam: x.naam, eta: t.dayStart + x.seg.t0, venster: x.venster, laat: x.laat, eigen: !!x.eigen })); const e = klant[0]; const n = klant.length;
  const alleenEigen = klant.every(x => x.eigen);
  return {
    id: 'v' + t.id, key: z.key, sev: 'bad', kind: 'Vertraging', kort: alleenEigen ? (n === 1 ? `Intern bericht aan ${stopKort(e.naam)}` : 'Intern bericht aan de vestigingen') : 'Nieuwe ETA aan de klant', t,
    title: `${t.id} haalt ${stopKort(e.naam)} niet (ETA ${hhmm(e.eta)}, venster tot ${hhmm(e.venster[1])})${n > 1 ? ` en ${meer(n - 1, 'stop', 'stops')} meer` : ''}`,
    action: `${etaWie(klant).replace(/^./, c => c.toUpperCase())}; het tijdvenster gaat mee. Je hoeft niet te bellen.`,
    why: later.length ? `Rit ${later[0].id} vertrekt door de vertraging ook later, maar er is nu geen vrij voertuig met een vrije chauffeur die eerder kan; de klanten van die rit krijgen daarom ook de nieuwe ETA.` : alleenEigen ? `De lading zit in deze wagen: niemand is er eerder dan ${t.id}. ${stopKort(e.naam)} is een eigen vestiging: de collega's daar houden het dock vrij en passen de ontvangst aan.` : `De lading zit in deze wagen: niemand is er eerder dan ${t.id}. Een klant die het op tijd weet, past de ontvangst aan; dat scheelt bellen en wachten.`,
    effect: [...klant.map(x => eff(etaRegel(x))), eff('geen extra kilometers', 'ok')],
    winst: { soort: 'bericht', min: 0, klant: klant.map(x => ({ naam: x.naam, eta: x.eta, eigen: !!x.eigen })) },
    berichten: klant.map(x => berichtVoor(x, t, oorzaak)),
    act: { k: 'klantEta', t: t.id }, hint: alleenEigen ? 'De vestiging krijgt een intern bericht en het venster gaat mee; de chauffeur krijgt een bericht. Het plan zelf verandert niet.' : 'De klant krijgt het bericht met de volg-link en het venster gaat mee; de chauffeur krijgt een bericht. Het plan zelf verandert niet.',
    msg: () => [t, `Planning: ${n === 1 ? stopKort(e.naam) : alleenEigen ? `${n} vestigingen` : `${n} klanten`} ${n === 1 ? 'weet' : 'weten'} dat je later komt; het tijdvenster is bijgesteld.`],
  };
}
// ---------- dock buiten gebruik (oefendag): de chauffeur het nieuwe dock laten weten ----------
// De zaak hoort bij de rit van het dockblok (zaken.js); het bericht gaat over elke dockwissel van het voertuig die nu
// speelt (fleet.dockGemeld), ook een die al begon zonder dat de chauffeur het hoorde.
function dockVoorstel(ctx, z, t) {
  const T = ctx.state.simTime; const L = ctx.fleet.dockWissels ? ctx.fleet.dockWissels(t, T) : [ctx.fleet.dockWissel(t, T)].filter(Boolean);
  const r = z.rit ? ctx.R.get(z.rit) : null;
  const w = (r && L.find(x => { const i = t.plan.indexOf(x.seg); return i >= r.i0 && i <= r.i1; })) || L[0]; if (!w) return null;
  const watVan = x => (x.soort === 'aankomst' ? 'afkoppelen' : x.soort === 'laden' ? 'laden' : 'koppelen'); const wat = watVan(w); const dn = ctx.driverName(t) || 'De chauffeur';
  const doe = x => (x.begonnen ? { koppelen: 'koppelde', laden: 'laadde', afkoppelen: 'koppelde af' } : { koppelen: 'koppelt', laden: 'laadt', afkoppelen: 'koppelt af' })[watVan(x)];
  const i = t.plan.indexOf(w.seg); const wacht = i > 0 && t.plan[i - 1].wachtDock ? Math.round(t.plan[i - 1].t1 - t.plan[i - 1].t0) : 0;
  const zinnen = L.map(x => `je ${doe(x)} om ${hhmm(x.a)} aan dock ${x.nieuw}`).join(' en ');
  return {
    id: `d${t.id}${z.rit ? `-${z.rit}` : ''}`, key: z.key, sev: 'warn', kind: 'Dock', kort: `Dock ${w.nieuw} doorgeven`, t,
    title: `${t.id}: dock ${w.oud} is buiten gebruik tot ${hhmm(w.tot)}`,
    action: w.begonnen ? `${dn} krijgt alsnog een bericht: dock ${w.oud} is buiten gebruik, het ${wat} om ${hhmm(w.a)} was aan dock ${w.nieuw}. Nog niets bewijst dat de chauffeur het wist.` : `${dn} krijgt een bericht: ${wat} om ${hhmm(w.a)} aan dock ${w.nieuw} in plaats van dock ${w.oud}. Het hal-scherm toont dock ${w.nieuw} al.`,
    why: `Dock ${w.oud} is buiten gebruik (${w.reden}); de planning zette ${t.id} op dock ${w.nieuw}, dat dan vrij is. Wie het weet, rijdt meteen naar het goede dock en zoekt niet op het terrein.${w.begonnen ? ' De wagen gebruikte het andere dock al, maar dat zegt niet dat de chauffeur het hoorde; de zaak blijft open tot het bericht er is.' : ''}`,
    effect: [eff(w.begonnen ? `de wagen staat sinds ${hhmm(w.a)} aan dock ${w.nieuw}` : `dock ${w.nieuw} is om ${hhmm(w.a)} vrij`, 'ok'), wacht ? eff(`${wacht} min wachten op een vrij dock`, 'bad') : eff('geen wachttijd aan het dock', 'ok'), eff(L.length > 1 ? `één bericht met ${L.length} dockwissels` : 'hal-scherm en planbord tonen het nieuwe dock')],
    winst: { soort: 'chauffeur', min: 0, tekst: `${dn} weet het nieuwe dock` },
    act: { k: 'dockBericht', t: t.id }, hint: 'De chauffeur krijgt een bericht met het nieuwe dock; het plan had het dock al aangepast.',
    msg: () => [t, `Planning: dock ${w.oud} is buiten gebruik; ${zinnen}.`],
  };
}

// Elk voorstel: id, key (de zaak), kort (een knoplabel), title, action (wat er gebeurt), why, act (de actie op het plan)
// en msg (het bericht aan de chauffeur, met het resultaat van de actie).
export function proposals(ctx) {
  const { fleet, state, S, TRS, rest, people } = ctx; const out = []; const T = state.simTime; const used = new Set();
  // elke open zaak in het werkgebied krijgt een voorstel (de zwaarste eerst: wie eerst komt, krijgt het vrije voertuig);
  // hooguit 120, zodat een heel drukke dag de interface niet ophoudt
  const zs = ctx.Z.scoped().filter(z => z.present && !z.done).sort((a, b) => b.urgency - a.urgency).slice(0, 120);
  for (const z of zs) {
    if (z.tr) {
      const tr = z.tr; const ts = TRS.get(tr.id) || fleet.trailerStateAt(tr, T);
      if (z.kind === 'Oplegger' && ts) {
        let helper = null, hd = Infinity; for (const t of fleet.trucks) { if (t.base !== tr.base || t.kind !== 'trekker' || used.has(t)) continue; const s = S.get(t.id); if (!s || !s.solo || !s.next || !s.next.home) continue; const d = kmBetween(s.pos, ts.pos); if (d < hd) { hd = d; helper = t; } }
        const reserve = !helper && fleet.trucks.find(t => t.base === tr.base && t.kind === 'trekker' && t.vandaag === 'reserve' && !used.has(t));
        const freeP = reserve ? people.persons.find(p => p.base === tr.base && !p.dienst && p.div !== 'bezorg') : null;
        const who = helper || (reserve && freeP ? reserve : null); if (!who) continue; used.add(who);
        out.push({ id: 'o' + tr.id, key: z.key, sev: 'warn', kind: 'Oplegger', kort: `Ophalen met ${who.id}`, winst: { soort: 'oplegger', tekst: 'de winkel heeft zijn plek terug en de rit terug is niet leeg' }, t: who, tr, title: `${tr.id} staat leeg bij ${ts.place} (ophalen gepland ${hhmm(ts.pickup)})`, action: helper ? `${helper.id} (${ctx.driverName(helper)}) rijdt solo terug naar ${tr.base.n} en haalt ${tr.id} op, ${Math.round(hd)} km van zijn route; zijn dagplan en de ETA thuis schuiven mee.` : `Reservetrekker ${reserve.id} met ${freeP.name} (vrij, pool ${tr.base.n}) haalt ${tr.id} op en zet hem op het terrein.`, why: helper ? 'Een solo-rit terug is lege kilometers; met de oplegger mee is de rit nuttig en staat de winkel niet nog een dag met een oplegger.' : 'Geen solo-trekker in de buurt; de reserve staat stil op het terrein.', act: { k: 'ophalen', t: who.id, tr: tr.id, person: helper ? null : freeP.id }, effect: helper ? [eff(`ongeveer ${Math.round(hd * ROAD * 2)} km extra voor ${helper.id}`), eff(`ETA thuis ongeveer ${Math.round(hd * ROAD * 2 + 15)} min later`), eff('de winkel heeft zijn plek terug', 'ok')] : [eff(`rit van ongeveer ${Math.round(kmBetween(tr.base, ts.pos) * ROAD * 2)} km`), eff(`${freeP.name} krijgt een korte dienst`), eff('de winkel heeft zijn plek terug', 'ok')], msg: r => [who, `Planning: haal ${tr.id} op bij ${ts.place} (leeg) en neem hem mee naar ${tr.base.n}${r ? `; aankomst daar rond ${hhmm(r.end)}` : ''}. Je dagplan is aangepast.`] });
      } else if (z.kind === 'Koeling' && ts) {
        const veh = ts.vehicle; const { sp, km } = nearestSp(ts.pos, 4);
        out.push({ id: 'k' + tr.id, key: z.key, sev: 'bad', kind: 'Koeling', kort: 'Koelunit herstarten', winst: { soort: 'lading', tekst: 'de lading blijft binnen de temperatuur; geen afkeur bij de klant' }, t: veh || null, tr, title: `${tr.id}: koelunit buiten bereik (${nl1(fleet.trailerTemp(tr, T))} °C)`, action: veh ? `${ctx.driverName(veh)} herstart de koelunit; lukt dat niet binnen 15 min, dan lossen bij ${sp.n} (${km} km) en lading overzetten. Werkorder voor de koelunit.` : `Lading overzetten bij ${ts.place}; werkorder voor de koelunit.`, why: 'Diepvries boven -18 °C mag niet geleverd worden; snel handelen voorkomt afkeur van de lading.', act: { k: 'koeling', tr: tr.id }, effect: [eff('herstarten kost ongeveer 15 min'), eff(`anders lossen bij ${sp.n}, ${km} km`), eff('werkorder voor de koelunit')], msg: () => veh ? [veh, `Planning: herstart de koelunit van ${tr.id}. Niet binnen 15 min onder -18 °C? Rij naar ${sp.n} om te lossen. Werkorder is aangemaakt.`] : null });
      }
      continue;
    }
    const t = z.t, s = t && S.get(t.id); if (!s) continue;
    // vertraging: een voorstel met winst (een volgende rit naar een vrij voertuig), anders de klant de nieuwe ETA
    if (z.kind === 'Vertraging') { const p = vertragingVoorstel(ctx, z, t, used); if (p) out.push(p); continue; }
    if (z.kind === 'Dock') { const p = dockVoorstel(ctx, z, t); if (p) out.push(p); continue; }
    if (z.kind === 'Rijtijd') {
      const near = rest.nearest(s.pos, 45); const pl = near && near.place; const amen = pl ? [pl.douche ? 'douche' : null, pl.eten !== 'geen' ? pl.eten : null, pl.beveiligd ? 'beveiligd' : null].filter(Boolean).join(', ') : '';
      const fits = !(s.next && s.next.win) || s.next.eta + 45 <= s.next.win[1]; const venster = fits ? 'het tijdvenster van de volgende stop blijft haalbaar' : `de volgende stop (${s.next.name}) wordt 45 min later; de klant krijgt de nieuwe ETA`;
      out.push({ id: 'r' + t.id, key: z.key, sev: 'warn', kind: 'Rijtijd', winst: { soort: 'regel', tekst: 'geen overtreding van de rijtijd (EU 561/2006)' }, kort: pl ? `Pauze bij ${pl.n.replace('Pauzeplek ', '')}` : 'Pauze plannen', t, title: `${s.driver} (${t.id}) zit op ${fmtDrive(s.drive)} rijtijd`, action: pl ? `Pauze van 45 min bij ${pl.n} (${nl1(rest.score(pl))} sterren van ${pl.count} ${pl.count === 1 ? 'chauffeur' : 'chauffeurs'}${amen ? ', ' + amen : ''}), ${near.km} km verderop; ${venster}.` : `Pauze van 45 min binnen 8 km inplannen; ${venster}.`, why: pl ? 'Een beoordeelde pauzeplek op de route kost geen omweg en geeft een echte pauze.' : 'Een pauze op tijd voorkomt een rijtijdovertreding en een boete.', act: { k: 'pauze', t: t.id, place: pl ? pl.id : null }, effect: [eff('na de pauze weer 4:30 rijtijd', 'ok'), fits ? eff('volgende stop blijft binnen het venster', 'ok') : eff(`volgende stop ${Math.max(0, Math.round(s.next.eta + 45 - s.next.win[1]))} min na het venster`, 'bad'), eff(pl ? `${near.km} km verderop, op de route` : 'parkeerplaats binnen 8 km')], msg: r => [t, pl ? `Planning: neem je pauze van 45 min bij ${pl.n} (${near.km} km verderop, ${amen || 'parkeren'})${r ? `, gepland om ${hhmm(r.at)}` : ''}. Je dagplan is aangepast.` : `Planning: neem je pauze van 45 min op de eerstvolgende parkeerplaats${r ? ` (gepland om ${hhmm(r.at)})` : ''}. Je dagplan is aangepast.`] });
    } else if (z.kind === 'Accu') {
      const { sp, km } = nearestSp(s.pos);
      out.push({ id: 'a' + t.id, key: z.key, sev: 'warn', kind: 'Accu', winst: { soort: 'accu', tekst: 'genoeg accu om de dienst af te maken' }, kort: sp ? `Snelladen in ${sp.n}` : 'Terug om te laden', t, title: `${t.id} heeft ${Math.round(s.soc)} % accu (${Math.round(t.range * s.soc / 100)} km)`, action: sp ? `25 min snelladen bij ${sp.n} (${laadpunten(sp)} laadpunten, ${km} km van de route); het laadpunt wordt gereserveerd en het dagplan schuift 25 min op.` : 'Terug naar de standplaats om te laden.', why: 'Het bereik is te krap voor de terugrit; laden onderweg kost minder dan slepen.', act: { k: 'laden', t: t.id, sp: sp ? sp.n : null }, effect: (() => { const cap = CAPACITY(t) || t.range * 1.15; const bij = 25 / 60 * 150 / cap * 100; const terug = Math.round(Math.min(100, s.soc + bij) - kmRest(t, T) * 1.15 / cap * 100); return [eff(`accu bij terugkomst ongeveer ${Math.max(0, terug)} %`, terug < 10 ? 'bad' : 'ok'), eff(sp ? `${km} km naar ${sp.n}` : 'terug naar de standplaats'), eff('dagplan 25 min later')]; })(), msg: r => [t, `Planning: laad 25 min bij ${sp ? sp.n : t.base.n}${r ? ` om ${hhmm(r.at)}` : ''}, laadpunt ${1 + (t.idx % 6)} is gereserveerd. Je dagplan is aangepast.`] });
    } else if (z.kind === 'Techniek') {
      const nextD = t.diensten.find(d => d !== s.dienst && d.start > T + 30) || null;
      const reserve = nextD ? fleet.trucks.find(h => h.base === t.base && h !== t && h.kind === t.kind && h.vandaag === 'reserve' && !used.has(h)) || null : null; if (reserve) used.add(reserve);
      const garage = t.base.hub ? 'Wognum' : 'Opmeer'; const endD = s.dienst ? s.dienst.end : t.dayStart + t.shiftEnd; const gepland = `na de dienst (${hhmm(endD)}) in garage ${garage}`;
      out.push({ id: 't' + t.id, key: z.key, sev: 'bad', kind: 'Techniek', winst: { soort: 'storing', tekst: 'de storing wordt vandaag nog bekeken; de volgende dienst heeft een wagen' }, kort: reserve ? `Werkorder, dienst naar ${reserve.id}` : 'Werkorder na de dienst', t, title: `${t.id}: ${t.storing}`, action: `Werkorder in de garage ${garage} na de dienst (${hhmm(endD)})${reserve ? `; dienst ${nextD.i + 1} van ${nextD.driver} (${hhmm(nextD.start)}) gaat naar reservevoertuig ${reserve.id}` : nextD ? '; voor de volgende dienst is geen reservevoertuig vrij' : ''}.`, why: 'De rit kan veilig worden afgemaakt; de storing moet vandaag nog bekeken worden.', act: { k: 'werkorder', t: t.id, gepland, reserve: reserve ? reserve.id : null, dienst: nextD ? nextD.i : null }, effect: [nextD ? (reserve ? eff(`dienst ${nextD.i + 1} rijdt met ${reserve.id}`, 'ok') : eff(`dienst ${nextD.i + 1} heeft nog geen vervanger`, 'bad')) : eff('geen dienst meer vandaag', 'ok'), eff(`werkorder na ${hhmm(endD)} in ${garage}`)], msg: () => [t, `Planning: werkorder aangemaakt voor "${t.storing}". Na je dienst naar de garage ${garage}${reserve ? `; ${nextD.driver} rijdt dienst ${nextD.i + 1} met ${reserve.id}` : ''}.`] });
    }
  }
  // voorstellen met echte winst (10 minuten of meer) eerst, de grootste bovenaan; de rest in de volgorde van de zaken
  const w = p => (p.winst && p.winst.min >= 10 ? p.winst.min : 0);
  return out.map((p, i) => [p, i]).sort((a, b) => w(b[0]) - w(a[0]) || a[1] - b[1]).map(x => x[0]);
}

export function answer(ctx, q) {
  const { fleet, S, TRS } = ctx; const ql = q.toLowerCase(); const vis = fleet.trucks.filter(t => ctx.inScope(t));
  const zs = ctx.Z.open(); const counts = ctx.counts(); const kpi = ctx.kpi();
  const tr = fleet.trailers.find(x => ql.includes(x.id.toLowerCase()) || ql.includes(x.plate.toLowerCase()));
  if (tr) { const s = TRS.get(tr.id) || fleet.trailerStateAt(tr, ctx.state.simTime); const temp = fleet.trailerTemp(tr, ctx.state.simTime); return `${tr.id} (${TRT[tr.type].n.toLowerCase()}, standplaats ${tr.base.n}): ${TRST[s.st].n.toLowerCase()}${s.vehicle ? ` achter ${s.vehicle.id} (${ctx.driverName(s.vehicle)})` : s.place ? ` bij ${s.place}` : ''}${s.lading ? `, lading: ${s.lading}` : ', leeg'}${temp !== null ? `, ${nl1(temp)} °C` : ''}.`; }
  const rit = ctx.R.all().find(r => ql.includes(r.id.toLowerCase())); if (rit) { const rs = ctx.R.stateOf(rit, ctx.state.simTime, S); return `Rit ${rit.id} (${rit.t.id}, ${rit.klant}): ${rs.st === 'klant' ? 'bij klant' : rs.st}, ${rs.done} van ${rs.n} ${rs.n === 1 ? 'stop' : 'stops'} gedaan, ETA ${hhmm(rs.eta)} (${rs.etaWhat})${rs.dev > 0 ? `, ${rs.dev} min later dan gepland` : ''}.`; }
  const truck = fleet.trucks.find(t => ql.includes(t.id.toLowerCase())) || fleet.trucks.find(t => t.diensten.some(d => ql.includes(d.driver.toLowerCase())));
  if (truck) { const s = S.get(truck.id) || ctx.stAt(truck, ctx.state.simTime); return `${truck.id} (${KIND[truck.kind].n.toLowerCase()}, ${truck.model}, standplaats ${truck.base.n}): ${VST[s.st].n.toLowerCase()}${s.driver ? `, chauffeur ${s.driver} tot ${hhmm(s.dienst.end)}` : ', geen chauffeur op dit moment'}${s.tr ? `, oplegger ${s.tr.id}` : s.solo ? ', solo' : ''}${s.next ? `, volgende stop ${s.next.name} om ${hhmm(s.next.eta)}${s.next.delay ? ` (+${s.next.delay} min)` : ''}` : ''}, ${truck.ev ? 'accu' : 'brandstof'} ${Math.round(s.soc)} %, rijtijd ${fmtDrive(s.drive)}.`; }
  if (/oplegger|los|leeg|trailer/.test(ql)) { const L = fleet.trailers.filter(x => ctx.inScopeBase(x.base, x.div)).map(x => [x, TRS.get(x.id)]).filter(([, s]) => s); const late = L.filter(([, s]) => s.late); const c = { gekoppeld: 0, geladen: 0, wacht: 0, ophalen: 0, leeg: 0, klaar: 0, onderhoud: 0 }; for (const [, s] of L) c[s.st]++; return `${fmt(L.length)} opleggers in je werkgebied: ${fmt(c.gekoppeld)} gekoppeld, ${fmt(c.klaar)} klaar voor vertrek op het terrein, ${fmt(c.leeg)} leeg op het terrein, ${c.geladen} geladen bij een klant, ${c.wacht} leeg bij een winkel of DC${c.ophalen ? `, ${c.ophalen} worden opgehaald` : ''}, ${c.onderhoud} in onderhoud. ${late.length ? `${late.length} hadden al opgehaald moeten zijn: ${late.slice(0, 5).map(([x, s]) => `${x.id} bij ${s.place}`).join(', ')}.` : 'Geen oplegger wacht te lang op ophalen.'}`; }
  if (/te laat|tijdvenster|vertraag/.test(ql)) { const L = zs.filter(z => z.kind === 'Vertraging'); return L.length ? `${L.length} voertuigen halen hun tijdvenster niet: ${L.slice(0, 6).map(z => `${z.obj} (${z.spn})`).join(', ')}${L.length > 6 ? ' en meer' : ''}. De voorstellen staan bij de meldingen.` : 'Geen voertuigen met een gemist tijdvenster binnen je werkgebied.'; }
  if (/accu|laden|laadpunt|elektr/.test(ql)) { const ev = vis.filter(t => t.ev); const laden = ev.filter(t => ((S.get(t.id) || {}).seg || {}).k === 'laden').length; const low = ev.filter(t => (S.get(t.id) || {}).soc < 25).length; return `${ev.length} elektrische voertuigen in je werkgebied: ${laden} laden nu, ${low} hebben minder dan 25 % accu. De laadplanning staat onder Laden.`; }
  if (/rijtijd|pauze/.test(ql)) { const L = zs.filter(z => z.kind === 'Rijtijd'); return L.length ? `${L.length} chauffeurs zitten binnen 30 minuten op de rijtijdlimiet: ${L.map(z => `${z.driver || z.obj} (${z.obj})`).join(', ')}.` : 'Niemand zit binnen 30 minuten op de rijtijdlimiet.'; }
  if (/koel|vries|temperat/.test(ql)) { const L = zs.filter(z => z.kind === 'Koeling'); return L.length ? `${L.length} koelmelding: ${L.map(z => z.text).join('; ')}.` : 'Alle koel- en vriesopleggers zitten binnen hun temperatuurbereik.'; }
  const sp = SP.find(x => ql.includes(x.n.toLowerCase())); if (sp) { const mine = fleet.trucks.filter(t => t.base === sp); const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; for (const t of mine) { const st = (S.get(t.id) || {}).st; if (st) c[st]++; } const trs = fleet.trailersOf(sp); const los = trs.filter(x => { const s = TRS.get(x.id); return s && s.st !== 'gekoppeld'; }).length; return `${sp.n}: ${mine.length} voertuigen (${mine.filter(t => t.vandaag === 'inzet').length} ingezet), ${standTekst(c)}; ${trs.length} opleggers, waarvan ${los} los; ${fleet.departures(sp, ctx.state.simTime, 120).length} vertrekken in de komende twee uur.`; }
  const town = TOWNS.find(x => ql.includes(x.n.toLowerCase())); if (town) { const L = vis.filter(t => { const s = S.get(t.id); return s && s.next && s.next.name.toLowerCase().includes(town.n.toLowerCase()); }); return L.length ? `${L.length} voertuigen rijden naar ${town.n}: ${L.slice(0, 8).map(t => `${t.id} (ETA ${hhmm(S.get(t.id).next.eta)})`).join(', ')}.` : `Op dit moment rijdt geen voertuig naar ${town.n}.`; }
  if (/hoeveel|aantal|status/.test(ql)) return `${standTekst(counts, { voertuigen: true })}; ${kpi.loose || 0} opleggers staan los. ${nl1(kpi.onTime || 100)} % van de stops was binnen het tijdvenster.`;
  return 'Ik beantwoord vragen over tijdvensters, ritten, opleggers, accu\'s, rijtijden, koeling, standplaatsen, plaatsen, voertuigen en chauffeurs. Probeer: "welke opleggers staan leeg bij een winkel?", "wat doet Wognum?" of "waar is O-5123?".';
}

// ---------- assistent als paneel rechts (#panel, modus assist) ----------
const ATABS = [['voorstellen', 'Voorstellen'], ['vraag', 'Vraag'], ['overdracht', 'Overdracht'], ['berichten', 'Berichten']];
// met de Claude API (data-ai op de root) staat Vraag vooraan, met Ochtendbriefing en Overdracht schrijven erboven
const ATABS_AI = [['vraag', 'Vraag'], ['voorstellen', 'Voorstellen'], ['overdracht', 'Overdracht'], ['berichten', 'Berichten']];
export function assistPanel(ctx) {
  const ai = !!aiUrl(ctx); const tabs = ai ? ATABS_AI : ATABS;
  const tab = ctx.ui.assistTab || (ai ? 'vraag' : 'voorstellen'); const T = ctx.state.simTime; const props = ctx.voorstellen(); const can = ctx.can('act');
  let body = '';
  if (tab === 'voorstellen') {
    body = props.length ? props.map(p => { const z = ctx.Z.get(p.key); return `<section class="prop"><div class="prop-h">${ic(p.sev === 'bad' ? 'alert' : 'clock', 14)}${esc(p.kind)} · ${esc(p.t ? p.t.id : p.tr ? p.tr.id : '')}${z ? ` <button class="lnk quiet" type="button" data-open="melding/${esc(z.id)}" style="margin-left:auto">Open zaak</button>` : ''}</div><b>${esc(p.title)}</b><p>${esc(p.action)}</p>${p.effect && p.effect.length ? `<ul class="eff">${p.effect.map(x => `<li class="${x.cls || ''}">${esc(x.t)}</li>`).join('')}</ul>` : ''}${berichtHtml(p)}<details><summary>Waarom</summary><div>${esc(p.why)}</div></details>${can ? `<div class="prop-a"><button class="btn sm" type="button" data-pastoe="${esc(p.id)}">${ic('check', 14)}Pas toe</button></div>` : ''}</section>`; }).join('')
      : empty('Geen open voorstellen', 'De assistent kijkt elke seconde opnieuw naar tijdvensters, rijtijden, accu\'s, koeling, losse opleggers en storingen. Voorstellen verschijnen hier en bij de melding.', '', 'spark');
    const done = ctx.applied.slice(-5).reverse();
    if (done.length) body += `<div class="sec-t">Vandaag toegepast <span class="mut">${ctx.applied.length}</span></div>${done.map(a => `<div class="note ok">${ic('okc', 15)}<div><b>${esc(a.title)}</b><div class="hint">${hhmm(a.T)} · ${esc(a.action)}</div></div></div>`).join('')}`;
  } else if (tab === 'vraag' && ai) {
    body = aiHtml(ctx);
  } else if (tab === 'vraag') {
    body = `<div class="chat" id="chatBox" aria-live="polite">${ctx.chat.length ? ctx.chat.map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)}</time></div>`).join('') : '<p class="hint">Stel een vraag in gewone taal over de live situatie. De assistent kijkt in de ritten, meldingen, opleggers en voertuigen van je werkgebied.</p>'}</div>
      <div class="ask"><label class="sr" for="askIn">Vraag</label><input class="fld" id="askIn" placeholder="Bijvoorbeeld: welke opleggers staan leeg bij een winkel?" autocomplete="off"><button class="btn" type="button" id="askBtn">Vraag</button></div>
      <div class="sugg">${['Welke voertuigen halen hun tijdvenster niet?', 'Welke opleggers staan leeg bij een winkel?', 'Wie zit bijna op zijn rijtijd?', 'Hoeveel eActros laden nu?', 'Wat doet Wognum?'].map(q => `<button class="chip" type="button" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  } else if (tab === 'overdracht') {
    const over = ctx.store.get('sl-overdracht') || '';
    body = `<label class="flabel" for="overIn">Overdracht naar de volgende dienst<textarea class="fld" id="overIn" rows="7" placeholder="Wat moet de volgende planner weten? Bijvoorbeeld: T-1112 had een storing, werkorder staat; Plus Hoorn weet van de late levering.">${esc(over)}</textarea></label><p class="hint">Wordt bewaard in deze browser zodra je typt.</p>
      <div class="sec-t">Collega's</div><div>${ctx.collegas().slice(0, 10).map(c => { const onD = T >= c.a && T < c.b; return `<div class="col-i"><span class="av ${onD ? 'on' : ''}">${esc(initials(c.n))}</span><b>${esc(c.n)}</b><span>${esc(c.rol)} · ${esc(c.sp)} · ${hhmm(c.a)}–${hhmm(c.b)}</span><span class="badge sm ${onD ? 'b-ok' : ''}">${onD ? 'op dienst' : 'vrij'}</span></div>`; }).join('')}</div>`;
  } else {
    const L = ctx.fleet.trucks.filter(t => t.msgs && t.msgs.length).sort((a, b) => b.msgs[b.msgs.length - 1].T - a.msgs[a.msgs.length - 1].T).slice(0, 12);
    body = L.length ? L.map(t => { const m = t.msgs[t.msgs.length - 1]; const dn = ctx.driverName(t) || t.id; return `<button class="obj" type="button" data-open="kaart:truck:${esc(t.id)}"><span class="av">${esc(initials(dn))}</span><span class="obj-t"><b>${esc(dn)} · ${esc(t.id)}</b><span>${m.me ? 'Jij: ' : ''}${esc(m.text)}</span></span><small>${hhmm(m.T)}</small></button>`; }).join('')
      : empty('Nog geen berichten vandaag', 'Open een voertuig of rit en stuur een bericht, of pas een voorstel toe: de chauffeur krijgt het voorgelezen in de cabine.', '', 'msg');
  }
  return `<div class="pnl-h"><div class="pnl-t"><h2>${ic('spark', 18)}Assistent</h2><div class="sub">${props.length} ${props.length === 1 ? 'voorstel' : 'voorstellen'} · ${ctx.applied.length} vandaag toegepast · ${ctx.msgCount()} ${ctx.msgCount() === 1 ? 'bericht' : 'berichten'}</div></div><div class="pnl-a"><button class="ib" type="button" id="closePanel" aria-label="Sluiten">${ic('x', 18)}</button></div></div>
    <div class="tabs" role="tablist" style="padding:0 12px">${tabs.map(([k, n]) => `<button class="tab" type="button" role="tab" aria-selected="${tab === k}" data-atab="${k}">${n}${k === 'voorstellen' && props.length ? ` <span class="n">${props.length}</span>` : ''}</button>`).join('')}</div>
    <div class="pnl-b">${body}</div>`;
}
export function bindAssist(ctx, p) {
  on(p, 'click', '[data-atab]', (e, b) => { ctx.ui.assistTab = b.dataset.atab; ctx.renderPanel(true); const f = p.querySelector(`[data-atab="${b.dataset.atab}"]`); if (f) f.focus(); });
  if (p.querySelector('.ai')) bindAi(ctx, p);
  on(p, 'click', '[data-pastoe]', (e, b) => { const pp = ctx.voorstelById(b.dataset.pastoe); if (pp) ctx.applyProposal(pp); });
  const ask = () => { const i = p.querySelector('#askIn'); const v = i.value.trim(); if (!v) return; ctx.chat.push({ me: true, text: v, T: ctx.state.simTime }); ctx.chat.push({ me: false, text: answer(ctx, v), T: ctx.state.simTime }); if (ctx.chat.length > 16) ctx.chat.splice(0, ctx.chat.length - 16); ctx.renderPanel(true); const box = p.querySelector('#chatBox'); if (box) box.scrollTop = box.scrollHeight; const i2 = p.querySelector('#askIn'); if (i2) i2.focus(); };
  const ab = p.querySelector('#askBtn'); if (ab) { ab.addEventListener('click', ask); p.querySelector('#askIn').addEventListener('keydown', e => { if (e.key === 'Enter') ask(); }); }
  on(p, 'click', '[data-ask]', (e, b) => { const i = p.querySelector('#askIn'); i.value = b.dataset.ask; ask(); });
  const ov = p.querySelector('#overIn'); if (ov) ov.addEventListener('input', () => ctx.store.set('sl-overdracht', ov.value));
}
