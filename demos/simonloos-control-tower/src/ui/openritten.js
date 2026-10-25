// Open ritten: het vertrekpunt van de planning. Een planner begint niet bij een voertuig maar bij "wat staat er open en
// wie kan dat doen". Links de ritten die nog niemand rijdt, op urgentie (minuten tot het laadvenster), met reden en de
// kans op invulling; rechts één rit uitgeklapt: de prognose (kans op invulling en kans op tijd, met uitleg), het advies in
// één zin, en de kandidaten in drie groepen (eigen chauffeurs, oproepkrachten en zzp'ers, charters) met redenen, de kans
// op een ja, waarschuwingen en kosten (schatting). Alles uit de data (src/ui/invulling.js). Toewijzen is één klik: de
// vraag gaat uit (een eigen chauffeur op dienst krijgt hem op de boordcomputer), de rit staat gearceerd op het planbord
// tot de planner na het antwoord bevestigt of terugzet. Vraag tegelijk uit: de kleinste groep die samen negen op de tien
// kans op een ja geeft, met één bericht. Bellen belt niet in de demo; bellen, mailen en vragen komen in het logboek, zodat
// een collega ziet wie al gevraagd is. Op een telefoon: de lijst, en een rit als eigen scherm met een terugknop.
import { SP, DIV } from '../places.js';
import { TRT } from '../fleet.js';
import { esc, ic, fmt, hhmm, nl1, empty, on, swap, kortStop, initials, belKnop } from './base.js';
import { poolInvoer, poolNu, vensterAbs, pool as poolAlles } from './planwijzig.js';
import { urgentie, urgentieTxt, urgentieKlas, prognose, advies, kandidatenVan, wijsToe, bevestig, trekTerug, contact, toegewezen, toewijzingen, euro, KOSTEN_UITLEG, wieSoort, waarschuwing } from './invulling.js';

export const REDEN = { ziek: 'Ziekmelding', 'uitval voertuig': 'Voertuig uitgevallen', 'extra rit klant': 'Extra rit van de klant', 'nieuw uit OTM5': 'Nieuw uit OTM5' };
const OPLN = { koel: 'koeloplegger', vries: 'vriesoplegger', droog: 'gesloten oplegger', huif: 'schuifzeiloplegger', lzv: 'LZV-combinatie', silo: 'silo-oplegger', drank: 'drankenoplegger', city: 'city-oplegger' };
const SOORTN = { trekker: 'trekker', bakwagen: 'bakwagen', bus: 'bestelbus' };
const uurTxt = m => { m = Math.round(m); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} u`; };
const spVan = n => SP.find(s => s.n === n) || null;
export const kansKlas = k => (k >= 80 ? 'k-hoog' : k >= 60 ? 'k-mid' : 'k-laag');
export const kansChip = (pg, kort = false) => `<span class="kans ${kansKlas(pg.kans)}" title="${esc(`${pg.tekst}. Kans op tijd weg: ${pg.opTijd} %.`)}">${kort ? `${pg.kans} %` : `kans ${pg.kans} %`}</span>`;
export const wagenTxt = item => (item.oplegger ? OPLN[item.oplegger] || item.oplegger : SOORTN[item.soort] || 'rit');
export const klantKort = k => String(k || 'Rit').replace(/^Albert Heijn\b/, 'AH');
// duur (met pauze) en kilometers zoals de data ze geeft, anders uit de route
export const duurVan = (p, inv) => p.duur || (inv.t1 - inv.t0);
export const kmVan = (p, inv) => p.km || inv.km || 0;
const namenTxt = L => (L.length < 2 ? L.join('') : `${L.slice(0, -1).join(', ')} en ${L[L.length - 1]}`);

// de open ritten in het werkgebied, op urgentie (fleet.poolAt zonder wat al is toegewezen); en wat er al is toegewezen
export function openIn(ctx) {
  return poolNu(ctx).filter(p => { const sp = spVan(p.sp); return sp && ctx.inScopeBase(sp, p.div); })
    .map(p => ({ p, u: urgentie(ctx, p) })).sort((a, b) => (a.p.dag === 'morgen') - (b.p.dag === 'morgen') || a.u - b.u).map(x => x.p);
}
export const toegewezenIn = ctx => toegewezen(ctx).filter(p => { const sp = spVan(p.sp); return sp && ctx.inScopeBase(sp, p.div); });

// ---------- een rij in de lijst ----------
function rijHtml(ctx, p, on2) {
  const inv = poolInvoer(p, spVan(p.sp)); const u = urgentie(ctx, p); const pg = prognose(ctx, p); const v = vensterAbs(p) || [inv.t0, inv.t0 + 60];
  return `<li><button class="or-i ${on2 ? 'on' : ''}" type="button" data-or="${esc(p.id)}" ${on2 ? 'aria-current="true"' : ''}>
    <span class="or-u ${urgentieKlas(u, p)}">${esc(urgentieTxt(u, p))}</span>
    <span class="or-t"><b>${esc(klantKort(p.klant))}</b><small>${esc(p.sp)}</small></span>
    <span class="or-m">laden ${hhmm(v[0])}–${hhmm(v[1])} · ${uurTxt(duurVan(p, inv))} · ${esc(wagenTxt(p))}</span>
    <span class="or-c"><span class="or-r">${esc(REDEN[p.reden] || p.reden || 'open rit')}</span>${kansChip(pg)}</span></button></li>`;
}
function wachtRijHtml(ctx, p, on2) {
  const tw = p.toegewezen; const wacht = tw.status === 'aangevraagd';
  return `<li><button class="or-i wacht ${on2 ? 'on' : ''}" type="button" data-or="${esc(p.id)}" ${on2 ? 'aria-current="true"' : ''}>
    <span class="or-u ${wacht ? 'u-snel' : 'u-ok'}">${wacht ? 'wacht op een ja' : 'bevestigd'}</span>
    <span class="or-t"><b>${esc(klantKort(p.klant))}</b><small>${esc(p.sp)}</small></span>
    <span class="or-m">${esc(tw.naam || 'eigen chauffeur')} · ${esc(wieSoort(tw))}${tw.t ? `, ${esc(tw.t)}` : ''} · ${p.dag === 'morgen' ? 'morgen ' : ''}vertrek ${hhmm(tw.start || vensterAbs(p)[0])}</span></button></li>`;
}

// ---------- berichten: de vraag aan één kandidaat (uit fleet.wijsToe, puur) of aan een groep ----------
const opties = ctx => ({ T: ctx.state.simTime, people: ctx.people, toegewezen: toewijzingen(ctx) });
function berichtVoor(ctx, item, k) { try { const u = ctx.fleet.wijsToe(item, k, opties(ctx)); return u && u.bericht ? u.bericht : null; } catch { return null; } }
function groepsbericht(item) {
  const v = vensterAbs(item); const eind = v[0] + (item.duur || 300); const n = (item.stops || []).length; const wat = item.oplegger ? `, ${OPLN[item.oplegger] || item.oplegger}` : '';
  return `Wie kan ${item.dag === 'morgen' ? 'morgen' : 'vandaag'} rit ${item.id} rijden? Laden in ${item.sp} tussen ${hhmm(v[0])} en ${hhmm(v[1])}${wat}, ${n} ${n === 1 ? 'stop' : 'stops'}, ongeveer ${fmt(Math.round(item.km || 0))} km, terug rond ${hhmm(eind)}. Wie het eerst ja zegt, krijgt de rit.`;
}
const onderwerp = item => `Rit voor ${item.klant || 'een klant'}, laden ${hhmm(vensterAbs(item)[0])} in ${item.sp}${item.dag === 'morgen' ? ' (morgen)' : ''}`;
const mailHref = (ctx, item, k, tekst) => `mailto:${encodeURIComponent(k.email)}?subject=${encodeURIComponent(onderwerp(item))}&body=${encodeURIComponent(`${tekst}\n\nMet vriendelijke groet,\n${ctx.A.settings.naam()}\nPlanning Simon Loos ${item.sp}`)}`;
// Bel (demo: toont het gesimuleerde nummer, belt niet) en Mail (alleen een charter, met het bericht erin)
function contactKnoppen(ctx, item, k) {
  if (k.soort === 'eigen') return '';
  const b = belKnop(k.naam, k.tel, { extra: 'data-contact="bel"' });
  const bericht = k.soort === 'charter' && k.email ? berichtVoor(ctx, item, k) : null;
  const m = bericht ? `<a class="btn sm" href="${esc(mailHref(ctx, item, k, bericht.tekst))}" data-contact="mail" data-wie="${esc(k.naam)}" title="Mail ${esc(k.email)} met de rit">${ic('mail', 14)}<span>Mail</span></a>` : '';
  return b + m;
}

// ---------- de kandidaten (gedeeld met de dialoog op het planbord) ----------
function kandidaatHtml(ctx, item, k, i, kan, pri) {
  const WK = ctx.fleet.WAARSCHUWING_KORT || {};
  const doel = k.soort === 'charter' ? `charter/${k.id}` : k.soort === 'oproep' ? `oproep/${k.id}` : `persoon/${k.id}/overzicht`;
  const sub = k.soort === 'charter' ? `charter${k.contactpersoon ? `, contact ${k.contactpersoon}` : ''}` : `${wieSoort(k)} · ${k.voertuig ? `op ${k.voertuig}` : 'nog geen voertuig'}`;
  const ja = Math.round((k.kans || 0) * 100);
  const why = (k.redenen || []).slice(0, 3);
  const chips = [k.past ? `<span class="rz ${k.past.oordeel === 'past goed' ? 'ok' : k.past.oordeel === 'past slecht' ? 'nee' : ''}" title="Voorkeur van ${esc(k.naam)}">${esc(k.past.oordeel)}</span>` : '',
    ...(k.waarschuwingen || []).map(w => `<span class="rz let" title="${esc(waarschuwing(ctx, w))}">${ic('alert', 12)}${esc(WK[w] || w)}</span>`)].join('');
  const rest = [...why.slice(1), ...(k.soort === 'eigen' && k.uren && typeof k.uren.naRit === 'number' && k.beschikbaar ? [`${nl1(k.uren.naRit)} uur rijtijd over na de rit`] : [])].join(' · ');
  return `<li class="kd-i ${k.beschikbaar ? '' : 'nee'}"><span class="av sm${k.soort === 'charter' ? ' sq' : ''}">${esc(initials(k.naam))}</span>
    <div class="kd-w"><span class="kd-n"><b><button class="lnk quiet" type="button" data-open="${esc(doel)}">${esc(k.naam)}</button></b><small>${esc(sub)}</small></span>${why[0] ? `<span class="kd-why">${esc(why[0])}</span>` : ''}${rest ? `<span class="kd-why2">${esc(rest)}</span>` : ''}${chips ? `<span class="kd-r">${chips}</span>` : ''}</div>
    <div class="kd-f" title="Kans dat ${esc(k.naam)} ja zegt (schatting)"><b class="${ja >= 60 ? 'tok' : ja < 35 ? 'twarn' : ''}">${ja} %</b><small>kans op ja</small></div>
    <div class="kd-k" title="${esc(k.kosten ? k.kosten.uitleg : '')}"><b>${euro(k.kosten ? k.kosten.bedrag : 0)}</b><small>schatting</small></div>
    <div class="kd-a">${contactKnoppen(ctx, item, k)}${kan && k.beschikbaar ? `<button class="btn sm ${pri ? 'pri' : ''}" type="button" data-kies="${k.soort}:${i}">Toewijzen</button>` : kan ? '<span class="hint">niet beschikbaar</span>' : ''}</div></li>`;
}
function samenHtml(ctx, item, KD) {
  const S = KD.samen; if (!S || !ctx.can('act')) return '';
  const al = (item.contact || []).filter(c => c.soort === 'samen');
  if (al.length) return `<section class="kd-samen al">${ic('users', 18)}<div><b>Tegelijk gevraagd om ${hhmm(al[0].T)}</b><p>${esc(namenTxt(al.map(c => c.wie)))}. Wie het eerst ja zegt, wijs je hieronder toe.</p><p class="kd-msg">${esc(groepsbericht(item))}</p></div><div class="kd-sa"><button class="btn sm" type="button" data-kopieer="${esc(groepsbericht(item))}">${ic('copy', 14)}Kopieer bericht</button></div></section>`;
  return `<section class="kd-samen">${ic('users', 18)}<div><b>Vraag tegelijk uit</b><p>${esc(namenTxt(S.wie.map(k => k.naam)))}: samen ${S.kans} % kans op minstens één ja, tegen ${S.alleen} % als je alleen de eerste vraagt (schatting). Eén bericht naar ${S.wie.length}; wie het eerst ja zegt, krijgt de rit.</p></div><div class="kd-sa"><button class="btn sm" type="button" data-samen="1">${ic('send', 14)}Vraag ze tegelijk</button></div></section>`;
}
export function kandidatenHtml(ctx, item, KD) {
  const kan = ctx.can('act'); const best = KD.best;
  const vanaf = L => { const K = L.filter(k => k.beschikbaar && k.kosten); return K.length ? euro(Math.min(...K.map(k => k.kosten.bedrag))) : null; };
  const som = [['eigen chauffeur', vanaf(KD.eigen)], ['oproepkracht of zzp\'er', vanaf(KD.oproep)], ['charter', vanaf(KD.charter)]].filter(x => x[1]);
  const groep = (titel, sub, L, leeg) => `<section class="kd-g"><h3>${esc(titel)} <span class="n">${L.length}</span><span class="sub">${sub}</span></h3>${L.length ? `<ul class="kd-l">${L.map((k, i) => kandidaatHtml(ctx, item, k, i, kan, k === best)).join('')}</ul>` : `<p class="hint kd-leeg">${leeg}</p>`}</section>`;
  return `<div class="kd">
    ${som.length ? `<p class="kd-sum">${ic('info', 15)}<span>Kosten van deze rit: ${som.map(([n, v]) => `${n} vanaf ${v}`).join(', ')} (schatting).</span></p>` : ''}
    ${samenHtml(ctx, item, KD)}
    ${groep('Eigen chauffeurs', 'rij- en rusttijden, uren en voorkeur meegewogen', KD.eigen, 'Geen eigen chauffeur kan deze rit: iedereen zit vast in een dienst, komt aan zijn rij- of rusttijd, of is vrij en niet beschikbaar.')}
    ${groep('Oproepkrachten en zzp\'ers', 'beschikbaar in dit dagdeel, binnen 40 km', KD.oproep, 'Niemand uit de flexibele schil is in dit dagdeel beschikbaar met het juiste rijbewijs.')}
    ${groep('Charters', 'eigen trekker en chauffeur, binnen 85 km', KD.charter, 'Geen charter in de buurt met deze wagen.')}
    <p class="hint kd-uitleg">${esc(KOSTEN_UITLEG)} De kans op ja is een schatting uit voorkeur, bereikbaarheid op dit uur en eerdere antwoorden.</p></div>`;
}
// klik op Toewijzen, Bel, Mail, Vraag ze tegelijk en Kopieer (gedeeld door de weergave en de dialoog op het planbord);
// itemVan geeft de rit die open staat
export function bindKandidaten(ctx, root, itemVan, getKD, na) {
  on(root, 'click', '[data-kies]', (e, b) => {
    const item = itemVan(); const KD = getKD(); const [groep, i] = b.dataset.kies.split(':'); const k = item && KD && KD[groep] && KD[groep][+i]; if (!k) return;
    const res = wijsToe(ctx, item, k);
    if (res && res.ok && na) na(k);
  });
  on(root, 'click', '[data-contact]', (e, a) => {
    const item = itemVan(); if (!item) return; const wie = a.dataset.wie; const soort = a.dataset.contact;
    contact(ctx, item, [wie], soort, `${soort === 'bel' ? 'belde' : 'mailde'} ${wie} over open rit ${item.id} van ${item.klant || 'de klant'} (${item.sp}, laden ${hhmm(vensterAbs(item)[0])})`);
    if (na && soort === 'bel') na(null, true);
  });
  on(root, 'click', '[data-samen]', () => {
    const item = itemVan(); const KD = getKD(); const S = KD && KD.samen; if (!item || !S) return;
    const L = S.wie.map(k => k.naam);
    contact(ctx, item, L, 'samen', `vroeg ${namenTxt(L)} tegelijk of ze open rit ${item.id} van ${item.klant || 'de klant'} kunnen rijden (samen ${S.kans} % kans op een ja, schatting)`);
    ctx.L.toast('Demo: er gaat geen bericht de deur uit. In het echt gaat de vraag via de chauffeursapp of sms; wie het eerst ja zegt, wijs je toe.', { icon: 'send', ms: 8000 });
    if (na) na(null, true);
  });
  on(root, 'click', '[data-kopieer]', (e, b) => {
    const t = b.dataset.kopieer || ''; let ok = false;
    try { if (navigator.clipboard) { navigator.clipboard.writeText(t).catch(() => {}); ok = true; } } catch { ok = false; }
    ctx.L.toast(ok ? 'Bericht gekopieerd.' : 'Kopieren kan hier niet; selecteer de tekst.', { icon: ok ? 'copy' : 'info' });
  });
}

// ---------- de uitgeklapte rit ----------
function gevraagdHtml(item) {
  const L = (item.contact || []).filter(c => c.soort !== 'samen'); if (!L.length) return '';
  return `<p class="hint or-gebeld">${ic('phone', 13)}Al gevraagd: ${L.map(c => `${esc(c.wie)} (${c.soort === 'bel' ? 'gebeld' : 'gemaild'} ${hhmm(c.T)})`).join(', ')}</p>`;
}
function wachtHtml(ctx, item, v) {
  const tw = item.toegewezen; const wacht = tw.status === 'aangevraagd';
  const x = tw.soort === 'charter' ? (ctx.fleet.CHARTERS || []).find(c => c.id === tw.id) : tw.soort === 'oproep' ? (ctx.fleet.OPROEP || []).find(o => o.id === tw.id) : null;
  const k = { soort: tw.soort, naam: tw.naam, tel: x ? x.tel : null, email: x && x.email ? x.email : null };
  const br = tw.bericht; const waar = tw.t ? `op ${tw.t}` : tw.soort === 'charter' ? 'eigen trekker en chauffeur' : item.dag === 'morgen' ? 'voor morgen, een eigen rij op het planbord' : 'nog geen voertuig';
  const mail = tw.soort === 'charter' && k.email && br ? `<a class="btn sm" href="${esc(mailHref(ctx, item, k, br.tekst))}" data-contact="mail" data-wie="${esc(k.naam)}">${ic('mail', 14)}<span>Mail</span></a>` : '';
  return `<section class="or-st ${wacht ? 'wacht' : 'ok'}">${ic(wacht ? 'clock' : 'okc', 20)}<div class="or-sw"><b>${wacht ? `Wacht op een ja van ${esc(tw.naam)}` : `${esc(tw.naam || 'Eigen chauffeur')} rijdt deze rit`}</b>
      <p>${esc(wieSoort(tw))}, ${esc(waar)} · ${item.dag === 'morgen' ? 'morgen ' : ''}vertrek ${hhmm(tw.start || v[0])}${tw.kosten ? ` · ${euro(tw.kosten)} (schatting)` : ''} · gevraagd om ${hhmm(tw.T || 0)}${!wacht && tw.Tb !== undefined ? `, ja om ${hhmm(tw.Tb)}` : ''}</p>
      ${(tw.waarschuwingen || []).length ? `<ul class="or-w">${tw.waarschuwingen.map(w => `<li>${ic('alert', 13)}${esc(waarschuwing(ctx, w))}</li>`).join('')}</ul>` : ''}
      ${br && wacht ? `<div class="or-msg"><small>Het bericht${br.kanaal ? `, via ${esc(br.kanaal)}` : ''}</small><p>${esc(br.tekst)}</p></div>` : ''}
      ${wacht ? `<p class="hint">Tot het antwoord staat de rit gearceerd op het planbord. Kan ${esc(tw.naam)} niet, zet de rit dan terug en kies de volgende.</p>` : ''}
      <div class="or-sa">${wacht ? `${belKnop(k.naam, k.tel, { extra: 'data-contact="bel"' })}${mail}${br ? `<button class="btn sm" type="button" data-kopieer="${esc(br.tekst)}">${ic('copy', 14)}Kopieer bericht</button>` : ''}` : ''}${ctx.can('act') ? `${wacht ? `<button class="btn sm pri" type="button" data-orbev="1">${ic('check', 14)}Ja, bevestigd</button>` : ''}<button class="btn sm ghost" type="button" data-orterug="1">${ic('undo', 14)}${wacht ? 'Kan niet' : 'Terug naar open ritten'}</button>` : ''}</div></div></section>`;
}
function detailHtml(ctx, item) {
  const sp = spVan(item.sp); const inv = poolInvoer(item, sp); const u = urgentie(ctx, item); const v = vensterAbs(item) || [inv.t0, inv.t0 + 60];
  const stops = inv.stops.filter(x => !x.laden).map(x => x.naam); const tw = item.gepland ? item.toegewezen : null;
  const temp = item.oplegger && TRT[item.oplegger] && TRT[item.oplegger].temp ? ` (${TRT[item.oplegger].temp[0]} tot ${TRT[item.oplegger].temp[1]} °C)` : '';
  const kop = `<div class="or-dh"><div class="or-dt"><h2 id="orTitel" tabindex="-1">${esc(item.klant || 'Open rit')}</h2><span class="badge sm outline">${esc(item.id)}</span>${tw ? '' : `<span class="or-u ${urgentieKlas(u, item)}">${esc(urgentieTxt(u, item))}</span>`}</div>
    <p class="or-ds">${esc(item.sp)} · laden ${item.dag === 'morgen' ? 'morgen ' : ''}${hhmm(v[0])}–${hhmm(v[1])} · ${uurTxt(duurVan(item, inv))} · ${fmt(kmVan(item, inv))} km · ${esc(wagenTxt(item))}${temp}</p>
    <p class="or-ds mut">${stops.length} ${stops.length === 1 ? 'stop' : 'stops'}: ${esc(stops.map(kortStop).join(', ') || 'volgt')} · ${esc(DIV[item.div] ? DIV[item.div].n.toLowerCase() : '')} · ${esc(REDEN[item.reden] || item.reden || '')}${item.bekend !== undefined && item.bekend !== null ? `, ${item.bekend < 0 ? 'sinds gisteren' : `binnen om ${hhmm(item.bekend)}`}` : ''}</p>
    <div class="or-da">${item.route || item.stops ? `<button class="btn sm" type="button" data-orkaart="1">${ic('map', 15)}Route op de kaart</button>` : ''}${tw && tw.t ? `<button class="btn sm" type="button" data-open="planbord/R-${esc(item.id)}">${ic('gantt', 15)}Op het planbord</button>` : ''}</div></div>`;
  if (tw) return `${kop}${wachtHtml(ctx, item, v)}${gevraagdHtml(item)}`;
  const pg = prognose(ctx, item); const ad = advies(ctx, item, pg); const KD = kandidatenVan(ctx, item); const b = pg.basis;
  const bar = b && b.n ? (() => { const tot = Math.max(1, b.n); const niet = b.n - b.ingevuld; const seg = (n, cls, l) => (n ? `<i class="${cls}" style="width:${(n / tot * 100).toFixed(2)}%" title="${esc(`${l}: ${n}`)}"></i>` : ''); return `<div class="pg-bar2" role="img" aria-label="${esc(`Van ${b.n} vergelijkbare ritten: ${b.eigen} eigen chauffeur, ${b.oproep} oproepkracht of zzp'er, ${b.charter} charter, ${niet} niet ingevuld`)}">${seg(b.eigen, 's1', 'eigen chauffeur')}${seg(b.oproep, 's2', 'oproepkracht of zzp\'er')}${seg(b.charter, 's3', 'charter')}${seg(niet, 's0', 'niet ingevuld')}</div><div class="pg-leg"><span><i class="s1"></i>eigen ${b.eigen}</span><span><i class="s2"></i>oproep of zzp ${b.oproep}</span><span><i class="s3"></i>charter ${b.charter}</span><span><i class="s0"></i>niet ingevuld ${niet}</span></div>`; })() : '';
  return `${kop}
    <section class="or-pg" aria-label="Prognose"><div class="or-pk"><div><b class="${kansKlas(pg.kans)}">${pg.kans} %</b><span>kans op invulling</span></div><div><b class="${kansKlas(pg.opTijd)}">${pg.opTijd} %</b><span>kans op tijd weg</span></div></div>
      <div class="or-pt"><p><b>${esc(pg.tekst)}.</b> ${esc(pg.uitleg || '')}</p>${bar}<p class="hint">Gesimuleerde historie van acht weken. Met echte data: een export uit het TMS (rit, venster, wanneer bekend, door wie ingevuld) en het vertrek uit de boordcomputer.</p></div></section>
    ${ad.tekst ? `<p class="note ${ad.sev}">${ic(ad.sev === 'info' ? 'info' : 'alert', 16)}<span>${esc(ad.tekst)}</span></p>` : ''}
    ${gevraagdHtml(item)}
    ${kandidatenHtml(ctx, item, KD)}`;
}

// ---------- de weergave ----------
export function renderOpenRitten(ctx, el) {
  const ui = ctx.ui; const S = ui.or || (ui.or = { sel: null, dag: 'vandaag' });
  const open = openIn(ctx); const tw = toegewezenIn(ctx); const wacht = tw.filter(p => p.toegewezen.status === 'aangevraagd'); const klaar = tw.filter(p => p.toegewezen.status !== 'aangevraagd');
  const vd = open.filter(p => p.dag !== 'morgen'), mo = open.filter(p => p.dag === 'morgen');
  const L = S.dag === 'morgen' ? mo : vd; const narrow = ctx.narrow();
  // de gekozen rit: uit de route, anders de meest urgente (op een telefoon: niets, dan zie je de lijst)
  const alle = [...open, ...tw]; let sel = alle.find(p => p.id === S.sel) || null;
  if (!sel && !narrow) sel = wacht[0] && !L.length ? wacht[0] : L[0] || wacht[0] || null;
  if (sel && !narrow && sel.dag === 'morgen' !== (S.dag === 'morgen') && !sel.gepland) S.dag = sel.dag === 'morgen' ? 'morgen' : 'vandaag';
  const toonDetail = !!sel && (!narrow || !!S.sel);
  const lijst = `<div class="or-l" ${narrow && toonDetail ? 'hidden' : ''}>
      <div class="or-bar"><div class="seg" role="group" aria-label="Dag"><button type="button" data-ordag="vandaag" aria-pressed="${S.dag !== 'morgen'}">Vandaag <span class="n">${vd.length}</span></button><button type="button" data-ordag="morgen" aria-pressed="${S.dag === 'morgen'}">Morgen <span class="n">${mo.length}</span></button></div><span class="hint or-sort">op urgentie</span></div>
      ${wacht.length ? `<div class="or-g"><h3>Wacht op een ja <span class="n">${wacht.length}</span></h3><ol class="or-list">${wacht.map(p => wachtRijHtml(ctx, p, sel === p)).join('')}</ol></div>` : ''}
      <div class="or-g"><h3>${S.dag === 'morgen' ? 'Open voor morgen' : 'Open'} <span class="n">${L.length}</span></h3>${L.length ? `<ol class="or-list">${L.map(p => rijHtml(ctx, p, sel === p)).join('')}</ol>` : `<p class="hint or-leeg">${S.dag === 'morgen' ? 'Nog geen open ritten voor morgen. Die komen tussen 13:00 en 16:30 binnen.' : 'Alles van vandaag is ingevuld in je werkgebied.'}</p>`}</div>
      ${klaar.length ? `<details class="or-g or-klaar" ${S.klaarOpen ? 'open' : ''}><summary><h3>Bevestigd <span class="n">${klaar.length}</span></h3></summary><ol class="or-list">${klaar.map(p => wachtRijHtml(ctx, p, sel === p)).join('')}</ol></details>` : ''}
      <p class="hint or-bron">Prognose, kandidaten en de flexibele schil zijn gesimuleerd. Namen, nummers en tarieven zijn verzonnen.</p>
    </div>`;
  const detail = toonDetail ? `<div class="or-d" data-or-d="${esc(sel.id)}">${narrow ? `<button class="btn sm ghost or-terug" type="button" data-orlijst="1">${ic('back', 15)}Alle open ritten</button>` : ''}${detailHtml(ctx, sel)}</div>`
    : narrow ? '' : `<div class="or-d">${empty('Geen open ritten', 'Alles in je werkgebied is ingevuld. Nieuwe ritten van klanten, ziekmeldingen en uitval komen hier vanzelf binnen.', '', 'okc', 'center')}</div>`;
  const h = `<div class="or">${lijst}${detail}</div>`;
  S.cur = sel ? sel.id : null;
  if (swap(el, h)) el.querySelectorAll('.or-i.on').forEach(x => { const box = x.closest('.or-l'); if (box && (x.offsetTop < box.scrollTop || x.offsetTop > box.scrollTop + box.clientHeight - 60)) x.scrollIntoView({ block: 'nearest' }); });
  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    const huidig = () => { const id = ctx.ui.or.cur; return id ? poolAlles(ctx).find(p => p.id === id) || null : null; };
    on(el, 'click', '[data-or]', (e, b) => { ctx.ui.or.sel = b.dataset.or; ctx.go(`openritten/${b.dataset.or}`); const t = el.querySelector('#orTitel'); if (t && ctx.narrow()) t.focus({ preventScroll: true }); });
    on(el, 'click', '[data-ordag]', (e, b) => { ctx.ui.or.dag = b.dataset.ordag; ctx.ui.or.sel = null; renderOpenRitten(ctx, el); ctx.syncHash(); });
    on(el, 'click', '[data-orlijst]', () => { ctx.ui.or.sel = null; ctx.go('openritten'); });
    on(el, 'click', '[data-orkaart]', () => { const it = huidig(); if (it && ctx.toonPoolrit) ctx.toonPoolrit(it); });
    on(el, 'click', '[data-orbev]', () => { const it = huidig(); if (it) bevestig(ctx, it); });
    on(el, 'click', '[data-orterug]', () => { const it = huidig(); if (it) { trekTerug(ctx, it); ctx.ui.or.sel = it.id; renderOpenRitten(ctx, el); } });
    on(el, 'toggle', 'details.or-klaar', (e, d) => { ctx.ui.or.klaarOpen = d.open; });
    // toewijzen, bellen, mailen en tegelijk vragen: de rit die nu open staat
    // na het toewijzen blijft de rit open (wacht op een ja, met het bericht), zodat de planner meteen kan bellen of sturen
    bindKandidaten(ctx, el, huidig, () => { const it = huidig(); return it ? kandidatenVan(ctx, it) : null; }, () => { const it = huidig(); if (it) ctx.ui.or.sel = it.id; renderOpenRitten(ctx, el); ctx.syncHash(); });
    // pijltjes door de lijst
    on(el, 'keydown', '.or-i', (e, b) => { if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return; const L2 = [...el.querySelectorAll('.or-i')]; const i = L2.indexOf(b); const n = L2[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) { e.preventDefault(); n.focus(); } });
  }
}

// ---------- dialoog op het planbord: "Rit inplannen" met de drie groepen ----------
export function openRitDialoog(ctx, item, opts = {}) {
  const sp = spVan(item.sp); const inv = poolInvoer(item, sp); const v = vensterAbs(item) || [inv.t0, inv.t0 + 60];
  const html = () => { const pg = prognose(ctx, item); return `<div class="dlg-h"><h2>${esc(item.klant || 'Open rit')} <span class="badge sm outline">${esc(item.id)}</span></h2><button class="ib" type="button" data-close aria-label="Sluiten">${ic('x', 18)}</button></div>
    <div class="dlg-b"><p class="hint" style="margin-bottom:10px">${esc(item.sp)} · laden ${item.dag === 'morgen' ? 'morgen ' : ''}${hhmm(v[0])}–${hhmm(v[1])} · ${uurTxt(duurVan(item, inv))} · ${fmt(kmVan(item, inv))} km · ${esc(wagenTxt(item))} · ${kansChip(pg)}</p>${pg.advies ? `<p class="note ${advies(ctx, item, pg).sev}" style="margin-bottom:12px">${ic('info', 16)}<span>${esc(pg.advies)}</span></p>` : ''}${kandidatenHtml(ctx, item, kandidatenVan(ctx, item))}</div>`; };
  ctx.L.openDialog(html(), { wide: true, label: `Rit inplannen: ${item.klant || item.id}`, onBind: d => {
    bindKandidaten(ctx, d, () => item, () => kandidatenVan(ctx, item), (k, blijf) => {
      if (blijf) { const b = d.querySelector('.dlg-b'); if (b) { const y = b.scrollTop; const h = html(); b.outerHTML = h.slice(h.indexOf('<div class="dlg-b">')); const nb = d.querySelector('.dlg-b'); if (nb) nb.scrollTop = y; } return; }
      ctx.L.closeDialog(); if (opts.na) opts.na();
    });
  } });
}
