// Charters en oproepkrachten: de flexibele schil, waarmee de planner de gaten vult (fleet.CHARTERS en fleet.OPROEP).
// Twee tabbladen met een tabel: charters (bedrijven met eigen trekker en chauffeur: plaats, wagens, vandaag en morgen vrij,
// op tijd, tarief, contact) en oproepkrachten, zzp'ers en weekendchauffeurs (soort, standplaats, rijbewijs, de dagdelen van
// vandaag en morgen, laatste inzet). Elke rij opent een pagina met contact, beschikbaarheid, afspraken en de ritten die
// ze voor ons reden. Het nummer van een persoon is afgeschermd tot je erop klikt (vastgelegd, AVG); een bedrijfsnummer
// staat er gewoon. Bellen belt niet in de demo: de knop toont het gesimuleerde nummer. Geen ranglijst van mensen: de
// tabel van personen sorteert niet op betrouwbaarheid, en het signaal over schijnzelfstandigheid staat alleen op de pagina.
import { esc, ic, fmt, hhmm, nl1, kv, on, initials, belKnop, datumTxt } from './base.js';
import { createTable } from './table.js';
import { charters, oproepkrachten, charterById, oproepById, charterVrij, oproepOp, rittenVan, toegewezen, voorkeurRegels, dagDatum, dagenGeleden, SOORT_FLEX, DAGDEEL, DAGDELEN, WEEKDAG_NAAM, euro } from './invulling.js';
import { weekdagVan } from '../voorkeuren.js';
import { shell } from '../sheets.js';

const TABS = [['charters', 'Charters'], ['oproep', 'Oproepkrachten en zzp\'ers']];
const OPL = { koel: 'koel', vries: 'vries', droog: 'droog', huif: 'schuifzeil', city: 'city', bakwagen: 'bakwagen', lzv: 'LZV', silo: 'silo', drank: 'dranken' };
const wagens = c => [...c.opleggers.map(x => OPL[x] || x), ...(c.voertuigen.includes('bakwagen') ? ['bakwagen'] : [])].join(', ');
const ddTxt = L => (L && L.length ? L.map(x => (DAGDEEL[x] ? DAGDEEL[x].n.toLowerCase() : x)).join(', ') : '');
const dagenTxt = n => (n <= 1 ? 'gisteren' : `${n} dagen geleden`);
const cent = x => `${Math.round(x * 100)} cent`;
const km = (a, b) => { const c = Math.cos((a.lat + b.lat) / 2 * Math.PI / 180); return Math.hypot((a.lon - b.lon) * c * 111.32, (a.lat - b.lat) * 111.32); };
const inScopeSp = ctx => new Set(ctx.spsInScope().map(s => s.n));
// een charter hoort bij het werkgebied als hij in dezelfde regio zit of binnen 85 km van een standplaats ervan (zoals de data rekent)
const inScopeC = (ctx, c) => ctx.spsInScope().some(s => s.regio === c.regio || km(c, s) <= 85);
const opTijdVan = o => { const b = o.betrouwbaarheid; const n = b.ritten || 0; return { n, ok: Math.round(n * (b.opTijd || 0) / 100) }; };

export function renderPoule(ctx, el) {
  const ui = ctx.ui; const tab = () => ui.pouleTab || 'charters';
  if (!el.dataset.mounted) {
    el.dataset.mounted = '1';
    el.innerHTML = '<div class="pl-tab" data-pl="charters"></div><div class="pl-tab" data-pl="oproep" hidden></div>';
    const head = () => { const c = charters(ctx).filter(x => inScopeC(ctx, x)).length; const o = oproepkrachten(ctx).filter(x => inScopeSp(ctx).has(x.standplaats)).length;
      return `<div class="tv-head" style="padding-bottom:0;border-bottom:0"><div class="tabs" role="tablist" style="margin:0">${TABS.map(([k, n]) => `<button class="tab" role="tab" type="button" aria-selected="${tab() === k}" data-pltab="${k}">${n} <span class="n">${fmt(k === 'charters' ? c : o)}</span></button>`).join('')}</div></div>`; };
    const onMount = e => on(e, 'click', '[data-pltab]', (ev, b) => { ui.pouleTab = b.dataset.pltab; renderPoule(ctx, el); const t = el.querySelector(`.pl-tab:not([hidden]) [data-pltab="${ui.pouleTab}"]`); if (t) t.focus(); ctx.syncHash(); });
    const kosten = () => !ctx.can('kosten');
    ui.chTable = createTable(ctx, el.querySelector('[data-pl=charters]'), {
      id: 'charters', unit: 'charters', csvName: 'charters.csv', key: r => r.id, sort: ['vandaag', -1], head, onMount,
      rows: () => charters(ctx).filter(x => inScopeC(ctx, x)).map(c => ({ ...c, c, vrij: charterVrij(ctx, c, 'vandaag'), vrijM: charterVrij(ctx, c, 'morgen') })),
      cols: [
        { k: 'naam', l: 'Charter', w: 210, req: true, html: r => `<span class="nowrap"><span class="av sm sq">${esc(initials(r.naam))}</span> <b style="font-weight:600">${esc(r.naam)}</b></span>` },
        { k: 'plaats', l: 'Plaats', w: 110, mw: 130 },
        { k: 'regio', l: 'Regio', w: 120, mw: 140, def: false },
        { k: 'wagens', l: 'Wagens', w: 160, mw: 200, sort: r => wagens(r), html: r => esc(wagens(r)), csv: r => wagens(r) },
        { k: 'vandaag', l: 'Vandaag vrij', w: 104, r: true, desc: true, sort: r => r.vrij, html: r => (r.vrij ? `<b class="tok">${r.vrij}</b> ${r.vrij === 1 ? 'trekker' : 'trekkers'}` : '<span class="mut">vol</span>'), csv: r => r.vrij },
        { k: 'morgen', l: 'Morgen vrij', w: 104, r: true, desc: true, sort: r => r.vrijM, html: r => (r.vrijM ? `${r.vrijM} ${r.vrijM === 1 ? 'trekker' : 'trekkers'}` : '<span class="mut">vol</span>'), csv: r => r.vrijM },
        { k: 'optijd', l: 'Op tijd', w: 90, r: true, desc: true, sort: r => r.betrouwbaarheid.opTijd, html: r => `${nl1(r.betrouwbaarheid.opTijd)} %`, csv: r => r.betrouwbaarheid.opTijd },
        { k: 'ritten', l: 'Ritten (8 weken)', w: 120, r: true, def: false, sort: r => r.betrouwbaarheid.ritten, html: r => fmt(r.betrouwbaarheid.ritten), csv: r => r.betrouwbaarheid.ritten },
        { k: 'afgezegd', l: 'Afgezegd', w: 90, r: true, def: false, sort: r => r.betrouwbaarheid.annuleringen, html: r => fmt(r.betrouwbaarheid.annuleringen), csv: r => r.betrouwbaarheid.annuleringen },
        { k: 'tarief', l: 'Tarief', w: 170, r: true, sort: r => r.tarief.perUur, html: r => `${euro(r.tarief.perUur)} per uur <small class="mut">+ ${cent(r.tarief.perKm)} per km</small>`, csv: r => `${r.tarief.perUur} per uur + ${r.tarief.perKm} per km` },
        { k: 'contact', l: 'Contact', w: 140, mw: 160, sort: r => r.contactpersoon, html: r => esc(r.contactpersoon), csv: r => r.contactpersoon },
        { k: 'tel', l: 'Telefoon', w: 140, nosort: true, html: r => belKnop(r.naam, r.tel, { cls: 'lnk quiet nowrap', label: r.tel, extra: 'data-plbel="1"' }), csv: r => r.tel },
        { k: 'email', l: 'E-mail', w: 220, def: false, html: r => (r.email ? `<a class="lnk quiet" href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ''), csv: r => r.email },
      ],
      search: { ph: 'Zoek charter, plaats of contactpersoon', text: r => `${r.naam} ${r.plaats} ${r.regio} ${r.contactpersoon} ${wagens(r)}` },
      filters: [
        { id: 'besch', l: 'Beschikbaar', kind: 'chips', opts: pool => [{ v: 'vandaag', l: 'Vandaag vrij', n: pool.filter(r => r.vrij > 0).length }, { v: 'morgen', l: 'Morgen vrij', n: pool.filter(r => r.vrijM > 0).length }], test: (r, s) => [...s].every(x => (x === 'vandaag' ? r.vrij : r.vrijM) > 0) },
        { id: 'wagen', l: 'Wagen', kind: 'menu', opts: pool => ['koel', 'vries', 'droog', 'huif', 'city', 'drank', 'lzv', 'silo', 'bakwagen'].map(k => ({ v: k, l: OPL[k], n: pool.filter(r => (k === 'bakwagen' ? r.voertuigen.includes('bakwagen') : r.opleggers.includes(k))).length })).filter(o => o.n), test: (r, s) => [...s].some(x => (x === 'bakwagen' ? r.voertuigen.includes('bakwagen') : r.opleggers.includes(x))) },
        { id: 'regio', l: 'Regio', kind: 'menu', opts: pool => [...new Set(pool.map(r => r.regio))].sort().map(n => ({ v: n, l: n, n: pool.filter(r => r.regio === n).length })), test: (r, s) => s.has(r.regio) },
      ],
      open: r => ctx.go(`charter/${r.id}`),
      menuLabel: r => r.naam,
      menu: r => [{ l: 'Open charter', icon: 'user', run: () => ctx.go(`charter/${r.id}`) }, { l: 'Open ritten', icon: 'inbox', run: () => ctx.go('view:openritten') }],
      emptyTxt: () => ['Geen charters in je werkgebied', 'Kies een groter werkgebied in de topbalk.'],
      mobile: { t: r => `<span class="av sm sq">${esc(initials(r.naam))}</span> ${esc(r.naam)}`, r: r => (r.vrij ? `<span class="badge st-onderweg sm">${r.vrij} vrij</span>` : '<span class="badge st-afgerond sm">vol</span>'), m: r => `${esc(r.plaats)} · ${esc(wagens(r))}<br>${nl1(r.betrouwbaarheid.opTijd)} % op tijd · ${euro(r.tarief.perUur)} per uur` },
    });
    ui.opTable = createTable(ctx, el.querySelector('[data-pl=oproep]'), {
      id: 'oproep', unit: 'mensen', csvName: 'oproepkrachten.csv', key: r => r.id, sort: ['vandaag', -1], head, onMount,
      rows: () => { const sps = inScopeSp(ctx); return oproepkrachten(ctx).filter(o => sps.has(o.standplaats)).map(o => ({ ...o, o, vd: oproepOp(ctx, o, 'vandaag'), mo: oproepOp(ctx, o, 'morgen') })); },
      cols: [
        { k: 'naam', l: 'Naam', w: 190, req: true, html: r => `<span class="nowrap"><span class="av sm">${esc(initials(r.naam))}</span> <b style="font-weight:600">${esc(r.naam)}</b></span>` },
        { k: 'soort', l: 'Soort', w: 150, html: r => `<span class="badge sm outline">${esc(SOORT_FLEX[r.soort] || r.soort)}</span>`, csv: r => SOORT_FLEX[r.soort] || r.soort },
        { k: 'standplaats', l: 'Standplaats', w: 110, mw: 130 },
        { k: 'rijbewijs', l: 'Rijbewijs', w: 110, sort: r => r.rijbewijs.join(','), html: r => esc(r.rijbewijs.join(', ')), csv: r => r.rijbewijs.join(' ') },
        { k: 'vandaag', l: 'Vandaag', w: 150, desc: true, sort: r => r.vd.dagdelen.length, html: r => (r.vd.ingezet ? '<span class="mut">al ingezet</span>' : r.vd.dagdelen.length ? `<span class="tok">${esc(ddTxt(r.vd.dagdelen))}</span>` : '<span class="mut">niet</span>'), csv: r => (r.vd.ingezet ? 'al ingezet' : ddTxt(r.vd.dagdelen)) },
        { k: 'morgen', l: 'Morgen', w: 150, desc: true, sort: r => r.mo.dagdelen.length, html: r => (r.mo.ingezet ? '<span class="mut">al ingezet</span>' : r.mo.dagdelen.length ? esc(ddTxt(r.mo.dagdelen)) : '<span class="mut">niet</span>'), csv: r => (r.mo.ingezet ? 'al ingezet' : ddTxt(r.mo.dagdelen)) },
        { k: 'laatste', l: 'Laatste inzet', w: 120, r: true, sort: r => -dagenGeleden(ctx, r.laatsteInzet), html: r => dagenTxt(dagenGeleden(ctx, r.laatsteInzet)), csv: r => r.laatsteInzet },
        { k: 'optijd', l: 'Op tijd (8 weken)', w: 130, r: true, nosort: true, html: r => { const x = opTijdVan(r); return x.n ? `${x.ok} van ${x.n}` : '<span class="mut">–</span>'; }, csv: r => { const x = opTijdVan(r); return `${x.ok}/${x.n}`; } },
        { k: 'tarief', l: 'Tarief', w: 110, r: true, def: false, lock: kosten, sort: r => r.tarief.perUur, html: r => `${euro(r.tarief.perUur)} per uur`, csv: r => r.tarief.perUur },
      ],
      search: { ph: 'Zoek naam, standplaats of rijbewijs', text: r => `${r.naam} ${r.standplaats} ${r.rijbewijs.join(' ')} ${SOORT_FLEX[r.soort] || ''}` },
      filters: [
        { id: 'soort', l: 'Soort', kind: 'chips', opts: pool => ['zzp', 'weekend', 'oproep'].map(k => ({ v: k, l: SOORT_FLEX[k], n: pool.filter(r => r.soort === k).length })), test: (r, s) => s.has(r.soort) },
        { id: 'besch', l: 'Beschikbaar', kind: 'menu', all: 'Altijd', opts: pool => [{ v: 'vandaag', l: 'Vandaag', n: pool.filter(r => r.vd.dagdelen.length).length }, { v: 'morgen', l: 'Morgen', n: pool.filter(r => r.mo.dagdelen.length).length }], test: (r, s) => [...s].every(x => (x === 'vandaag' ? r.vd : r.mo).dagdelen.length) },
        { id: 'sp', l: 'Standplaats', kind: 'menu', opts: pool => [...new Set(pool.map(r => r.standplaats))].sort().map(n => ({ v: n, l: n, n: pool.filter(r => r.standplaats === n).length })), test: (r, s) => s.has(r.standplaats) },
      ],
      open: r => ctx.go(`oproep/${r.id}`),
      menuLabel: r => r.naam,
      menu: r => [{ l: 'Open profiel', icon: 'user', run: () => ctx.go(`oproep/${r.id}`) }],
      emptyTxt: () => ['Geen oproepkrachten of zzp\'ers in je werkgebied', 'Kies een groter werkgebied in de topbalk.'],
      mobile: { t: r => `<span class="av sm">${esc(initials(r.naam))}</span> ${esc(r.naam)}`, r: r => `<span class="badge sm outline">${esc(SOORT_FLEX[r.soort] || r.soort)}</span>`, m: r => `${esc(r.standplaats)} · ${esc(r.rijbewijs.join(', '))}<br>vandaag ${r.vd.ingezet ? 'al ingezet' : r.vd.dagdelen.length ? esc(ddTxt(r.vd.dagdelen)) : 'niet'} · morgen ${r.mo.ingezet ? 'al ingezet' : r.mo.dagdelen.length ? esc(ddTxt(r.mo.dagdelen)) : 'niet'}` },
    });
    on(el, 'click', '[data-plbel]', (e, a) => ctx.A.log(`belde ${a.dataset.wie} (charter)`));
  }
  const t = tab();
  el.querySelector('[data-pl=charters]').hidden = t !== 'charters'; el.querySelector('[data-pl=oproep]').hidden = t !== 'oproep';
  (t === 'charters' ? ui.chTable : ui.opTable).refresh(true);
}

// ---------- pagina's ----------
function ritRijen(ctx, x) {
  const L = rittenVan(ctx, x);
  return L.length ? `<div class="tbl-x"><table class="tbl plain rv"><thead><tr><th>Dag</th><th>Standplaats</th><th>Klant</th><th>Vertrek</th><th class="r">Uren</th><th>Waarom</th><th>Op tijd</th></tr></thead><tbody>${L.map(r => `<tr><td>${esc(r.dag)}</td><td>${esc(r.sp)}</td><td>${esc(r.klant)}</td><td>${hhmm(r.start)}</td><td class="r">${String(r.uren).replace('.', ',')}</td><td class="mut">${esc(r.reden)}</td><td class="${r.opTijd ? '' : 'twarn'}">${r.opTijd ? 'ja' : 'te laat'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Nog geen ritten voor ons gereden.</p>';
}
function vandaagHtml(ctx, x) {
  const L = toegewezen(ctx).filter(p => p.toegewezen && p.toegewezen.id === x.id);
  return L.length ? `<div class="pg-sec"><h2>Toegewezen <span class="sub">${L.length} ${L.length === 1 ? 'rit' : 'ritten'} vandaag of morgen</span></h2><ul class="pl-vd">${L.map(p => `<li><button class="lnk" type="button" data-open="openritten/${esc(p.id)}">${esc(p.klant || p.id)}</button> <span class="mut">${esc(p.sp)} · ${p.dag === 'morgen' ? 'morgen ' : ''}vertrek ${hhmm(p.toegewezen.start)} · ${p.toegewezen.status === 'aangevraagd' ? 'wacht op een ja' : 'bevestigd'}</span></li>`).join('')}</ul></div>` : '';
}
function logHtml(ctx, naam) {
  const L = ctx.A.acts.log.filter(l => l.txt.includes(naam)).slice(0, 10);
  return `<div class="pg-sec pg-log"><h2>Logboek <span class="sub">${L.length ? `${L.length} ${L.length === 1 ? 'regel' : 'regels'} vandaag, nieuwste eerst` : 'vandaag'}</span></h2>${L.length ? `<ol class="tline">${L.map(l => `<li class="tli act"><time>${hhmm(l.T)}</time><div class="tl-c"><b>${esc(`${l.who} ${l.txt}`)}</b></div></li>`).join('')}</ol>` : '<p class="hint">Nog niets vandaag.</p>'}</div>`;
}
export function charterPage(ctx, id) {
  const c = charterById(ctx, id); if (!c) return null;
  const b = c.betrouwbaarheid; const vrij = charterVrij(ctx, c, 'vandaag'), vrijM = charterVrij(ctx, c, 'morgen');
  const mail = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent('Capaciteit voor Simon Loos')}`;
  const head = `<div class="pg-h"><div class="pg-id"><h1><span class="av lg sq">${esc(initials(c.naam))}</span> ${esc(c.naam)} <span class="badge lg outline">Charter</span></h1><div class="sub">${esc(c.plaats)} · ${esc(wagens(c))} · contact ${esc(c.contactpersoon)}</div></div>
    <div class="pg-a">${belKnop(c.naam, c.tel, { cls: 'btn sm pri', extra: 'data-plbel2="1"' })}${c.email ? `<a class="btn sm" href="${esc(mail)}">${ic('mail', 15)}Mail</a>` : ''}<button class="btn sm ghost" type="button" data-open="view:openritten">${ic('inbox', 15)}Open ritten</button></div></div>`;
  const kpis = [['Vandaag vrij', vrij ? `${vrij} <em>${vrij === 1 ? 'trekker' : 'trekkers'}</em>` : 'vol', `morgen ${vrijM ? `${vrijM} vrij` : 'vol'}`, vrij ? '' : 'bad'],
    ['Op tijd', `${nl1(b.opTijd)} <em>%</em>`, `${b.ritten} ritten in 8 weken, ${b.annuleringen} keer afgezegd`],
    ['Tarief', `${euro(c.tarief.perUur)} <em>per uur</em>`, `plus ${cent(c.tarief.perKm)} per km · schatting`]];
  const main = `${vandaagHtml(ctx, c)}<div class="pg-sec"><h2>Ritten voor ons <span class="sub">laatste 8 weken · gesimuleerd</span></h2>${ritRijen(ctx, c)}</div>`;
  const side = `<div class="pg-side"><div class="pg-sec"><h2>Afspraken</h2>${kv([['Wagens', esc(wagens(c))], ['Capaciteit', `${c.capaciteit.trekkers} trekkers, ${c.capaciteit.perDag} per dag voor ons`], ['Tarief', `${euro(c.tarief.perUur)} per uur plus ${cent(c.tarief.perKm)} per km`], ['Plaats', `${esc(c.plaats)} · ${esc(c.regio)}`], c.opmerking ? ['Opmerking', esc(c.opmerking)] : null])}</div>
    <div class="pg-sec"><h2>Contact</h2>${kv([['Contactpersoon', esc(c.contactpersoon)], ['Telefoon', belKnop(c.naam, c.tel, { cls: 'lnk', label: c.tel, extra: 'data-plbel2="1"' }) || '–'], ['E-mail', c.email ? `<a class="lnk" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '–']])}<p class="hint" style="margin-top:8px">Bedrijf, nummers, tarieven en ritten zijn verzonnen (gesimuleerd). Bellen belt niet in de demo.</p></div></div>`;
  const html = shell('Charters en oproepkrachten', 'charters', c.naam, head, kpis, '', `<div class="pg-cols"><div class="pg-main">${main}</div>${side}</div>`, '', logHtml(ctx, c.naam));
  const bind = el => on(el, 'click', '[data-plbel2]', () => ctx.A.log(`belde ${c.naam} (charter)`));
  return { html, bind, title: c.naam, parent: 'charters' };
}
export function oproepPage(ctx, id) {
  const o = oproepById(ctx, id); if (!o) return null;
  const x = opTijdVan(o); const b = o.betrouwbaarheid; const can = ctx.can; const vd = oproepOp(ctx, o, 'vandaag'), mo = oproepOp(ctx, o, 'morgen');
  const zien = (ctx.ui.revealed || (ctx.ui.revealed = new Set())).has(o.id); const masked = `06 •• •• ${String(o.tel || '').slice(-5)}`;
  const head = `<div class="pg-h"><div class="pg-id"><h1><span class="av lg">${esc(initials(o.naam))}</span> ${esc(o.naam)} <span class="badge lg outline">${esc(SOORT_FLEX[o.soort] || o.soort)}</span></h1><div class="sub">Rijbewijs ${esc(o.rijbewijs.join(', '))} · standplaats ${esc(o.standplaats)} · laatst ingezet ${dagenTxt(dagenGeleden(ctx, o.laatsteInzet))}</div></div>
    <div class="pg-a">${belKnop(o.naam, o.tel, { cls: 'btn sm pri', extra: 'data-opbel="1"' })}<button class="btn sm ghost" type="button" data-open="view:openritten">${ic('inbox', 15)}Open ritten</button></div></div>`;
  const kpis = [['Vandaag', vd.ingezet ? 'al ingezet' : vd.dagdelen.length ? esc(ddTxt(vd.dagdelen)) : 'niet', `morgen ${mo.ingezet ? 'al ingezet' : mo.dagdelen.length ? esc(ddTxt(mo.dagdelen)) : 'niet'}`],
    ['Op tijd', `${x.ok} <em>van ${x.n}</em>`, 'ritten voor ons, laatste 8 weken'],
    ['Tarief', can('kosten') ? `${euro(o.tarief.perUur)} <em>per uur</em>` : '<span class="kpi-lock">alleen regiomanager en directie</span>', `${o.tarief.soort} · schatting`]];
  const d0 = dagDatum(ctx, 'vandaag');
  const grid = `<div class="bk" role="table" aria-label="Beschikbaarheid de komende zeven dagen"><div class="bk-r bk-h" role="row"><span role="columnheader"></span>${DAGDELEN.map(d => `<span role="columnheader">${esc(DAGDEEL[d].n)}<small>${esc(DAGDEEL[d].van)}</small></span>`).join('')}</div>${[0, 1, 2, 3, 4, 5, 6].map(i => { const dt = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i); const wd = weekdagVan(dt); const ingezet = i === 0 ? vd.ingezet : i === 1 ? mo.ingezet : false; const L = ingezet ? [] : o.beschikbaarheid[wd] || []; return `<div class="bk-r ${i === 0 ? 'nu' : ''}" role="row"><span role="rowheader">${i === 0 ? 'vandaag' : i === 1 ? 'morgen' : WEEKDAG_NAAM[wd]}${ingezet ? ' <small>ingezet</small>' : ''}</span>${DAGDELEN.map(d => `<span role="cell" class="${L.includes(d) ? 'ja' : ''}" aria-label="${L.includes(d) ? 'beschikbaar' : 'niet beschikbaar'}">${L.includes(d) ? ic('check', 14) : ''}</span>`).join('')}</div>`; }).join('')}</div>`;
  // signalen over de soort inzet: alleen hier op de pagina, niet in de lijst of bij de kandidaten
  const regel = o.soort === 'zzp' ? 'Zelfstandige, factuur per rit. Wet DBA: let op schijnzelfstandigheid (vaste uren, onder gezag, steeds voor ons); laten toetsen.' : o.soort === 'oproep' ? 'Oproepcontract. Een oproep korter dan vier dagen vooruit mag hij weigeren, en een oproep levert minstens drie uur loon op (Wet arbeidsmarkt in balans, tenzij de cao iets anders regelt); laten toetsen.' : 'Weekendcontract: vooral op zaterdag en zondag.';
  const main = `${vandaagHtml(ctx, o)}<div class="pg-sec"><h2>Beschikbaarheid <span class="sub">de komende zeven dagen, zoals doorgegeven</span></h2>${grid}</div>
    <div class="pg-sec"><h2>Voorkeuren <span class="sub">gesimuleerd</span></h2>${kv(voorkeurRegels(o.voorkeuren).map(([k, v]) => [k, esc(v)]))}</div>
    <div class="pg-sec"><h2>Ritten voor ons <span class="sub">laatste 8 weken · gesimuleerd</span></h2>${ritRijen(ctx, o)}</div>`;
  const side = `<div class="pg-side"><div class="pg-sec"><h2>Afspraken</h2>${kv([['Soort', esc(SOORT_FLEX[o.soort] || o.soort)], ['Rijbewijs', esc(o.rijbewijs.join(', '))], o.code95Tot ? ['Code 95', `geldig tot ${esc(datumTxt(o.code95Tot))}`] : null, o.bevoegd && o.bevoegd.length ? ['Bevoegd', esc(o.bevoegd.map(z => OPL[z] || z).join(', '))] : null, ['Standplaats', `${esc(o.standplaats)} · ${esc(o.regio)}`], ['Ja op een oproep', `${b.ja} % <small>${b.afgezegd ? `${b.afgezegd} keer afgezegd` : 'nooit afgezegd'} in 8 weken</small>`]])}<p class="note" style="margin-top:10px">${ic('info', 15)}<span>${esc(regel)}</span></p></div>
    <div class="pg-sec"><h2>Contact</h2>${kv([['Telefoon', zien ? `<b>${esc(o.tel)}</b> <small>inzage vastgelegd</small>` : `<button class="lnk" type="button" data-opreveal="1">${esc(masked)}</button> <small>zichtbaar na klik, wordt vastgelegd</small>`]])}<p class="hint" style="margin-top:8px">Naam, nummer en ritten zijn verzonnen (gesimuleerd). Wie persoonsgegevens bekijkt, wordt vastgelegd (AVG). Bellen belt niet in de demo.</p></div></div>`;
  const html = shell('Charters en oproepkrachten', 'charters', o.naam, head, kpis, '', `<div class="pg-cols"><div class="pg-main">${main}</div>${side}</div>`, '', logHtml(ctx, o.naam));
  const bind = el => {
    on(el, 'click', '[data-opbel]', () => ctx.A.log(`belde ${o.naam} (${SOORT_FLEX[o.soort] || 'oproepkracht'})`));
    on(el, 'click', '[data-opreveal]', () => { (ctx.ui.revealed || (ctx.ui.revealed = new Set())).add(o.id); ctx.A.log(`bekeek het telefoonnummer van ${o.naam}`); ctx.L.toast('Inzage van het telefoonnummer is vastgelegd: wie, wat en wanneer.', { icon: 'lock' }); ctx.rerenderPage(); });
  };
  return { html, bind, title: o.naam, parent: 'charters' };
}
