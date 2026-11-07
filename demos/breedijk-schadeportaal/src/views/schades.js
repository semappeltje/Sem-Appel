// Schades: de werkvoorraad als tabel met filters in het adres (deelbaar), zoeken op kenteken, csv.
import { STATUS, OPEN_STATUS, fmtEur, fmtDatum, werkdagen, csv, kentekenNorm, kentekenToon, DAG } from '../regels.js';
import { VESTIGINGEN } from '../data.js';
import { esc, plaat, pill, ico, bind, th, sorteer, download, leeg } from '../h.js';

const GROEPEN = { open: { n: 'Open', f: c => OPEN_STATUS.includes(c.status) }, nieuw: { n: 'Nieuw', f: c => c.status === 'nieuw' }, onderzoek: { n: 'In onderzoek', f: c => c.status === 'onderzoek' }, wacht: { n: 'Wacht op', f: c => c.status.startsWith('wacht') }, verzekeraar: { n: 'Bij verzekeraar', f: c => c.status === 'verzekeraar' }, mijn: { n: 'Van mij', f: null }, afgerond: { n: 'Afgerond', f: c => !OPEN_STATUS.includes(c.status) || c.status === 'erkend' }, alle: { n: 'Alle', f: () => true } };
const PERIODES = { 30: '30 dagen', 90: '90 dagen', 365: 'Een jaar', alle: 'Alles' };

export function render(el, ctx, { q }) {
  const { D, inst, NU } = ctx;
  const F = { status: q.get('status') || 'open', k: q.get('k') || '', ch: q.get('ch') || '', vest: q.get('vest') || '', periode: q.get('periode') || 'alle', q: q.get('q') || '', signaal: q.get('signaal') || '' };
  const sort = (s => ({ k: s[0] || 'ontvangen', d: s[1] === 'op' ? 1 : -1 }))((q.get('sort') || '').split(':'));
  const groep = GROEPEN[F.status] || GROEPEN.open;
  let L = D.claims.filter(c => F.status === 'mijn' ? c.behandelaar === inst.naam && OPEN_STATUS.includes(c.status) : groep.f(c));
  if (F.k) L = L.filter(c => c.opdrachtgever.id === F.k); if (F.ch) L = L.filter(c => c.chauffeur === F.ch); if (F.vest) L = L.filter(c => c.vestiging === F.vest);
  if (F.periode !== 'alle') L = L.filter(c => c.ontvangen >= NU - Number(F.periode) * DAG);
  if (F.q) { const s = F.q.toLowerCase(); const kn = kentekenNorm(F.q); L = L.filter(c => (kn.length >= 2 && kentekenNorm(c.kenteken).includes(kn)) || c.id.toLowerCase().includes(s) || c.opdrachtgever.naam.toLowerCase().includes(s) || (c.chauffeurNaam || '').toLowerCase().includes(s) || `${c.voertuig.merk} ${c.voertuig.model}`.toLowerCase().includes(s)); }
  if (F.signaal === 'laat') L = L.filter(ctx.teLaat); if (F.signaal === 'geenfoto') L = L.filter(c => c.rit && ctx.beoordeling(c).signalen.some(s => s.id === 'eerder' && s.kleur === 'let')); if (F.signaal === 'geenrit') L = L.filter(c => !c.rit);
  L = sorteer(L, sort, { ontvangen: c => c.ontvangen, kenteken: c => c.kenteken, k: c => c.opdrachtgever.naam, bedrag: c => c.bedragGevraagd, status: c => c.status, beh: c => c.behandelaar || '', ch: c => c.chauffeurNaam || '' });
  const tellers = Object.fromEntries(Object.entries(GROEPEN).map(([k, g]) => [k, k === 'mijn' ? D.claims.filter(c => c.behandelaar === inst.naam && OPEN_STATUS.includes(c.status)).length : D.claims.filter(g.f).length]));
  const setQ = (p) => { const n = new URLSearchParams(q); for (const [k, v] of Object.entries(p)) { if (v === '' || v == null) n.delete(k); else n.set(k, v); } ctx.go(`schades${n.toString() ? '?' + n : ''}`); };
  const sig = c => { const out = []; if (ctx.teLaat(c)) out.push(`<span class="tbad" title="Over de antwoordtermijn">${ico('clock')}</span>`); if (!c.rit) out.push(`<span class="twarn" title="Geen rit gevonden">${ico('alert')}</span>`); else { const B = ctx.beoordeling(c); const e = B.signalen.find(s => s.id === 'eerder'); if (e && e.kleur === 'ok' && B.eerder) out.push(`<span class="tok" title="Stond al op de ophaalinspectie">${ico('shield')}</span>`); else if (e && e.kleur === 'let') out.push(`<span class="twarn" title="Geen foto van de plek bij ophalen">${ico('camera')}</span>`); if (c.bron === 'chauffeur') out.push(`<span class="tinfo" title="Gemeld door de chauffeur zelf">${ico('truck')}</span>`); } return out.join(' '); };
  const kol = [{ n: 'Kenteken', sort: 'kenteken' }, { n: 'Opdrachtgever', sort: 'k' }, { n: 'Ontvangen', sort: 'ontvangen' }, { n: 'Gevraagd', sort: 'bedrag', cls: 'r' }, { n: 'Status', sort: 'status' }, { n: 'Signaal' }, { n: 'Behandelaar', sort: 'beh', cls: 'hide-m' }, { n: 'Chauffeur', sort: 'ch', cls: 'hide-m' }];
  el.innerHTML = `
    <div class="ph"><div><h1>Schades</h1><div class="sub">${tellers.open} open, ${tellers.nieuw} nieuw.</div></div><div class="acts"><button type="button" class="btn" data-act="csv">${ico('download')}csv (${L.length})</button><button type="button" class="btn pri" data-act="nieuw">${ico('plus')}Nieuwe melding</button></div></div>
    <div class="tv">
      <div class="tv-head">
        <div class="tv-row">
          <div class="fsearch">${ico('search')}<input class="fld" id="sq" type="search" placeholder="Kenteken, dossier, opdrachtgever, chauffeur" value="${esc(F.q)}" data-inp="q" aria-label="Zoek in de lijst"></div>
          <select class="fld" data-chg="k" aria-label="Opdrachtgever"><option value="">Alle opdrachtgevers</option>${D.opdrachtgevers.map(k => `<option value="${k.id}" ${F.k === k.id ? 'selected' : ''}>${esc(k.naam)}</option>`).join('')}</select>
          <select class="fld" data-chg="vest" aria-label="Vestiging"><option value="">Alle vestigingen</option>${Object.values(VESTIGINGEN).map(v => `<option ${F.vest === v.n ? 'selected' : ''}>${v.n}</option>`).join('')}</select>
          <select class="fld" data-chg="ch" aria-label="Chauffeur"><option value="">Alle chauffeurs</option>${D.chauffeurs.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(c => `<option value="${c.id}" ${F.ch === c.id ? 'selected' : ''}>${esc(c.naam)}</option>`).join('')}</select>
          <select class="fld" data-chg="periode" aria-label="Periode">${Object.entries(PERIODES).map(([k, n]) => `<option value="${k}" ${F.periode === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
          ${F.signaal ? `<button type="button" class="chip on" data-act="signaalweg">${F.signaal === 'laat' ? 'Over de termijn' : F.signaal === 'geenfoto' ? 'Zonder foto van de plek' : 'Zonder rit'} ${ico('x')}</button>` : ''}
          <span class="grow"></span><span class="tv-cnt">${L.length} ${L.length === 1 ? 'dossier' : 'dossiers'}</span>
        </div>
        <div class="chips" role="tablist" aria-label="Status">${Object.entries(GROEPEN).map(([k, g]) => `<button type="button" class="chip ${F.status === k ? 'on' : ''}" role="tab" aria-selected="${F.status === k}" data-act="status" data-v="${k}">${g.n}<span class="n">${tellers[k]}</span></button>`).join('')}</div>
      </div>
      <div class="tv-scroll">${L.length ? `<ul class="ml">${L.slice(0, 80).map(c => `<li class="ml-i" tabindex="0" data-act="open" data-id="${c.id}"><span class="t">${plaat(c.kenteken)}<span class="sub">${esc(c.voertuig.merk)} ${esc(c.voertuig.model)}</span></span><span class="rt">${c.bedragGevraagd ? fmtEur(c.bedragGevraagd) : '<span class="mut">geen bedrag</span>'}</span><span class="m">${pill(c.status)}<span>${esc(c.opdrachtgever.naam)}</span><span>${fmtDatum(c.ontvangen)}</span>${sig(c)}</span></li>`).join('')}${L.length > 80 ? `<li class="empty">De eerste 80 van ${L.length}; filter verder of gebruik een computer voor de hele lijst.</li>` : ''}</ul><table class="tbl m-list"><thead><tr>${th(kol, sort)}</tr></thead><tbody>${L.map(c => `<tr class="click" tabindex="0" data-act="open" data-id="${c.id}"><td class="strong">${plaat(c.kenteken)} <span class="sub">${esc(c.voertuig.merk)} ${esc(c.voertuig.model)}</span></td><td>${esc(c.opdrachtgever.naam)}</td><td>${fmtDatum(c.ontvangen)}<span class="sub">${OPEN_STATUS.includes(c.status) ? `${werkdagen(c.ontvangen, NU)} wd` : ''}</span></td><td class="r num">${c.bedragGevraagd ? fmtEur(c.bedragGevraagd) : '<span class="mut">geen</span>'}</td><td>${pill(c.status)}</td><td>${sig(c)}</td><td class="hide-m">${esc(c.behandelaar || '')}${!c.behandelaar && OPEN_STATUS.includes(c.status) ? '<span class="mut">niemand</span>' : ''}</td><td class="hide-m">${c.chauffeurNaam ? esc(c.chauffeurNaam) : '<span class="mut">geen rit</span>'}</td></tr>`).join('')}</tbody></table>` : leeg('Geen dossiers in deze selectie', 'Pas de filters aan of zoek op een ander kenteken.')}</div>
      <div class="tv-foot"><span>${ico('clock')} over de termijn</span><span>${ico('shield')} stond al op de ophaalinspectie</span><span>${ico('camera')} geen foto van de plek</span><span>${ico('alert')} geen rit gevonden</span><span>${ico('truck')} door de chauffeur gemeld</span></div>
    </div>`;
  let timer;
  bind(el, {
    open: t => ctx.go(`schade/${t.dataset.id}`), nieuw: () => ctx.nieuweMelding(), status: t => setQ({ status: t.dataset.v }), signaalweg: () => setQ({ signaal: '' }),
    k: t => setQ({ k: t.value }), vest: t => setQ({ vest: t.value }), ch: t => setQ({ ch: t.value }), periode: t => setQ({ periode: t.value }),
    q: t => { clearTimeout(timer); timer = setTimeout(() => { setQ({ q: t.value }); const s = el.querySelector('#sq'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 250); },
    sort: t => setQ({ sort: `${t.dataset.sort}:${sort.k === t.dataset.sort && sort.d < 0 ? 'op' : 'af'}` }),
    csv: () => download(`schades-${new Date(NU).toISOString().slice(0, 10)}.csv`, csv(L, [{ n: 'Dossier', k: 'id' }, { n: 'Kenteken', k: c => kentekenToon(c.kenteken) }, { n: 'Voertuig', k: c => `${c.voertuig.merk} ${c.voertuig.model}` }, { n: 'Opdrachtgever', k: c => c.opdrachtgever.naam }, { n: 'Ontvangen', k: c => new Date(c.ontvangen).toISOString().slice(0, 10) }, { n: 'Gevraagd', k: c => c.bedragGevraagd ?? '' }, { n: 'Status', k: c => STATUS[c.status].n }, { n: 'Besluit', k: c => c.besluit || '' }, { n: 'Uitkomst', k: c => c.bedragUitkomst ?? '' }, { n: 'Behandelaar', k: c => c.behandelaar || '' }, { n: 'Chauffeur', k: c => c.chauffeurNaam || '' }, { n: 'Vestiging', k: c => c.vestiging || '' }, { n: 'Rit', k: c => c.rit || '' }])),
  });
}
