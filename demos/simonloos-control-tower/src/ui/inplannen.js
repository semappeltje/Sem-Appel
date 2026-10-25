// Inplannen: een rit naar een ander voertuig of een andere tijd zetten, of een rit uit de pool inplannen, altijd eerst
// getoetst (toets.js: overlap, tijdvenster, rijtijd en pauze, rusttijd, accu, oplegger, dock). Gedeeld door het planbord,
// de zaken en de assistent, zodat overal dezelfde regels, dezelfde zinnen en hetzelfde logboek gelden.
// "Waar past deze rit?" rangschikt de kandidaten (eerst wat mag, dan het minst te laat, de minste extra kilometers, een
// bestaande dienst voor een nieuwe) en laat per kandidaat het effect zien; een klik voert uit, schrijft een regel in de
// tijdlijn van de zaak (als die er is) en stuurt de chauffeur een bericht.
import { SP } from '../places.js';
import { esc, ic, fmt, hhmm, durTxt, plate, empty, on } from './base.js';
import { toetsVoor, ritInvoer, poolInvoer, kandidaten } from './planwijzig.js';
import { fouten, letOp } from './toets.js';
import { voorkeurenVan, pastVoorkeur, ritVoor } from './invulling.js';

const nu = ctx => ctx.state.simTime;
const klaar = (ctx, opts) => { if (opts && opts.na) opts.na(); ctx.refreshAll(false); };

// effect van een kandidaat in een regel: op tijd of te laat, extra kilometers, rijtijd over, accu bij terugkomst
export function effectHtml(u) {
  const e = u.effect; const a = [];
  a.push(e.teLaatMin ? `<span class="tbad">${e.teLaatMin} min te laat</span>` : '<span class="tok">op tijd</span>');
  if (e.extraKm) a.push(`${fmt(e.extraKm)} km extra`);
  if (e.rijtijdOverMin !== null && e.rijtijdOverMin !== undefined) a.push(`${durTxt(Math.max(0, e.rijtijdOverMin))} rijtijd over`);
  if (e.accuBijTerugkomst !== null && e.accuBijTerugkomst !== undefined) a.push(`accu ${e.accuBijTerugkomst} % bij terugkomst`);
  return a.join(' · ');
}
export function effectTxt(u) { return effectHtml(u).replace(/<[^>]+>/g, ''); }

// een melding als de toets nee zegt (met de knop "Waar past hij wel?")
export function meld(ctx, u, kop, r, opts = {}) {
  const F = fouten(u); const tekst = F.map(x => x.tekst).join(' ');
  ctx.L.toast(`${kop}: ${tekst}`, { icon: 'alert', ms: 10000, action: r ? 'Waar past hij wel?' : null, onAction: r ? () => waarPast(ctx, r, opts) : null });
  const live = document.querySelector('[data-pb=cnt]'); if (live) live.textContent = `${kop}: ${tekst}`;
}

// rit r naar voertuig B, vertrek start (absolute minuten); geeft { ok, uitslag }
export function voerUit(ctx, r, B, start, opts = {}) {
  if (!ctx.can('act')) { ctx.L.toast('Alleen planners en regiomanagers wijzigen het plan.', { icon: 'lock' }); return { ok: false }; }
  const rs = ctx.R.stateOf(r, nu(ctx), ctx.S); if (rs.st !== 'gepland' || nu(ctx) >= r.t.dayStart + r.t.plan[r.i0].t0) { ctx.L.toast(`Rit ${r.id} is al begonnen${rs.st === 'gepland' ? ' (laden of koppelen aan het dock)' : ''} en blijft op ${r.t.id}.`, { icon: 'lock' }); return { ok: false }; }
  const inv = ritInvoer(r); const u = toetsVoor(ctx, B, inv, start, r);
  if (!u.ok) { meld(ctx, u, `Rit ${r.id} kan niet naar ${B.id}${start !== inv.t0 ? ` om ${hhmm(start)}` : ''}`, r, opts); return { ok: false, uitslag: u }; }
  const A = r.t; const oudeChauffeur = (A.diensten[A.plan[r.i0].d] || {}).driver || '';
  const res = ctx.runAction({ k: 'verplaats', rit: r.id, naar: B.id, start, van: A.id, T: nu(ctx) }, true);
  if (!res || !res.ok) { ctx.L.toast(res && res.tekst ? res.tekst : `Rit ${r.id} kon niet worden verplaatst.`, { icon: 'alert' }); klaar(ctx, opts); return { ok: false }; }
  const wat = B === A ? `${r.id} verschoven naar ${hhmm(start)}` : `${r.id} van ${A.id} naar ${B.id}${start !== inv.t0 ? `, vertrek ${hhmm(start)}` : ''}`;
  ctx.A.log(`verplaatste rit ${wat}`, { rit: r.id, t: B.id, zaak: opts.zaak || null });
  if (res.chauffeur && B !== A) ctx.sendMsg(B, `Nieuwe rit ${r.id}: ${r.dest.slice(0, 2).join(', ')}, vertrek ${hhmm(start + (B.kind === 'trekker' ? 10 : 0))} vanaf ${r.base.n}.`, true, true);
  if (B !== A && oudeChauffeur && oudeChauffeur !== res.chauffeur && A.diensten.length) ctx.sendMsg(A, `Rit ${r.id} is naar ${B.id} gegaan; je hoeft hem niet te rijden.`, true, true);
  if (opts.zaak) ctx.Z.logZaak(opts.zaak, `rit ${r.id} naar ${B.id} gezet, vertrek ${hhmm(start)}${res.chauffeur && B !== A ? `; ${res.chauffeur} kreeg een bericht` : ''}`);
  const lo = letOp(u);
  ctx.L.toast(`Rit ${wat}.${lo.length ? ` Let op: ${lo[0].tekst}` : ''}${res.chauffeur && B !== A ? ` ${res.chauffeur} heeft een bericht.` : ''}`, { icon: 'check', ms: lo.length ? 9000 : 5000 });
  klaar(ctx, opts);
  return { ok: true, uitslag: u };
}

// een rit uit de pool op voertuig B, vertrek start
export function planIn(ctx, item, B, start, opts = {}) {
  if (!ctx.can('act')) { ctx.L.toast('Alleen planners en regiomanagers wijzigen het plan.', { icon: 'lock' }); return { ok: false }; }
  const sp = SP.find(s => s.n === item.sp) || B.base; const inv = poolInvoer(item, sp, B); const u = toetsVoor(ctx, B, inv, start, null);
  if (!u.ok) { ctx.L.toast(`De rit voor ${item.klant || 'de klant'} kan niet op ${B.id} om ${hhmm(start)}: ${fouten(u).map(x => x.tekst).join(' ')}`, { icon: 'alert', ms: 10000, action: 'Waar past hij wel?', onAction: () => waarPast(ctx, { pool: true, id: item.id, item, inv }, opts) }); return { ok: false, uitslag: u }; }
  const res = ctx.runAction({ k: 'pool', id: item.id, naar: B.id, start, T: nu(ctx), ...(opts.kosten ? { kosten: opts.kosten } : {}) }, true);
  if (!res || !res.ok) { ctx.L.toast(res && res.tekst ? res.tekst : 'Inplannen lukte niet.', { icon: 'alert' }); return { ok: false }; }
  ctx.A.log(`plande een rit uit de pool in op ${B.id} (${item.klant || ''}, vertrek ${hhmm(start)})`, { t: B.id, zaak: opts.zaak || null });
  ctx.sendMsg(B, `Nieuwe rit voor ${item.klant || 'de klant'}: vertrek ${hhmm(start + (B.kind === 'trekker' ? 10 : 0))} vanaf ${B.base.n}${res.oplegger ? ` met ${res.oplegger}` : ''}.`, true, true);
  if (opts.zaak) ctx.Z.logZaak(opts.zaak, `rit voor ${item.klant || 'de klant'} ingepland op ${B.id}, vertrek ${hhmm(start)}`);
  const lo = letOp(u);
  ctx.L.toast(`Ingepland op ${B.id}, vertrek ${hhmm(start)}.${res.chauffeur ? ` ${res.chauffeur} heeft een bericht.` : ''}${lo.length ? ` Let op: ${lo[0].tekst}` : ''}`, { icon: 'check', ms: lo.length ? 9000 : 5000 });
  klaar(ctx, opts);
  return { ok: true, uitslag: u };
}

// de kandidaten voor een rit (of een rit uit de pool: { pool: true, item, inv })
export function kandidatenVoor(ctx, r, max = 8) {
  const inv = r.pool ? r.inv : ritInvoer(r);
  return { inv, K: kandidaten(ctx, inv, { zonder: r.pool ? null : r, max }) };
}
// de beste kandidaat die mag (voor een voorstel op een zaak), of null
export function besteVoor(ctx, r) {
  if (!r || r.pool) return null; const rs = ctx.R.stateOf(r, nu(ctx), ctx.S); if (rs.st !== 'gepland' || nu(ctx) >= r.t.dayStart + r.t.plan[r.i0].t0) return null;
  const { K } = kandidatenVoor(ctx, r, 6); return K.find(k => k.uitslag.ok && k.t !== r.t) || null;
}

export function waarPast(ctx, r, opts = {}) {
  const { inv, K } = kandidatenVoor(ctx, r, 8);
  ctx.L.openDialog(waarHtml(ctx, r, inv, K, opts), { wide: true, label: `Waar past ${r.pool ? 'deze rit' : `rit ${r.id}`}?`, onBind: d => {
    on(d, 'click', '[data-kies]', (e, b) => {
      const k = K[+b.dataset.kies]; if (!k) return; ctx.L.closeDialog();
      if (r.pool) planIn(ctx, r.item, k.t, k.start, opts); else voerUit(ctx, r, k.t, k.start, opts);
    });
  } });
}
// de voorkeur van de chauffeur van een kandidaat: alleen als de rit slecht past, met wat er tegenin gaat (een stille regel)
function tegenVoorkeur(ctx, k) {
  const p = k.wie ? ctx.people.persons.find(x => x.name === k.wie && x.base === k.t.base) : null; if (!p) return [];
  const pr = pastVoorkeur(ctx, voorkeurenVan(ctx, p), ritVoor(ctx, k.t, k.start));
  return pr && pr.oordeel === 'past slecht' && pr.tegen.length ? [`${p.short}: ${pr.tegen.join(', ')}`] : [];
}
function waarHtml(ctx, r, inv, K, opts) {
  return `<div class="dlg-h"><h2>Waar past ${r.pool ? 'deze rit' : `rit ${esc(r.id)}`}?</h2><button class="ib" type="button" data-close aria-label="Sluiten">${ic('x', 18)}</button></div>
    <div class="dlg-b"><p class="hint" style="margin-bottom:12px">${esc(inv.standplaats)} · ${hhmm(inv.t0)}–${hhmm(inv.t1)} · ${fmt(inv.km)} km${inv.oplegger ? ` · ${inv.oplegger === 'koel' ? 'koeloplegger' : 'droge oplegger'}` : ''}${opts.zaak ? ' · vanuit de zaak' : ''}. Elke kandidaat is getoetst op overlap, tijdvenster, rijtijd en pauze, rusttijd, accu, oplegger en dock; de beste staat bovenaan.</p>
    ${K.length ? `<ol class="wp">${K.map((k, i) => `<li class="wp-i ${k.uitslag.ok ? '' : 'nee'}"><div class="wp-t">${plate(k.t.id)}<div><b>${k.nieuw ? `Nieuwe dienst · ${esc(k.wie || 'reservechauffeur')}` : `In de dienst van ${esc(k.wie)}`}</b><span>${effectHtml(k.uitslag)}</span></div></div>
      <ul class="wp-r">${k.uitslag.regels.filter(x => x.ernst !== 'ok').slice(0, 3).map(x => `<li class="${x.ernst === 'fout' ? 'tbad' : 'twarn'}">${ic(x.ernst === 'fout' ? 'x' : 'alert', 13)}${esc(x.tekst)}</li>`).join('') || `<li class="tok">${ic('check', 13)}Alle regels in orde</li>`}${tegenVoorkeur(ctx, k).map(x => `<li class="mut">${ic('circle', 13)}${esc(x)}</li>`).join('')}</ul>
      <div class="wp-a">${k.uitslag.ok ? `<button class="btn sm ${i === 0 ? 'pri' : ''}" type="button" data-kies="${i}">${r.pool ? 'Plan in' : 'Zet hier'}</button>` : '<span class="hint">kan niet</span>'}</div></li>`).join('')}</ol>` : empty('Geen voertuig van deze soort op de standplaats', 'Kijk bij een standplaats in de buurt of zet de rit morgen in.', '', 'info')}</div>`;
}
