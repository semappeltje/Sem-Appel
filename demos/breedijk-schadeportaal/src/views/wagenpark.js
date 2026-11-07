// Ons wagenpark: per trekker (met zijn oplegger) de aanrijschades van het afgelopen jaar, wat ze kostten, hoeveel dagen
// het voertuig uit de roulatie was en of het nu in herstel is. Per voertuig een pagina met de schades op het zijaanzicht.
import { CATEGORIEN, OPEN_STATUS, GEBIEDEN, SOORTEN, eigenKosten, fmtEur, fmtDatum, fmtNum, DAG } from '../regels.js';
import { truckDiagram } from '../diagram.js';
import { esc, plaat, pill, ico, bind, th, sorteer, leeg, sim } from '../h.js';

const telt = c => c.categorie === 'eigen' || c.categorie === 'derde';
export function render(el, ctx, { naam, id, q }) {
  const { D, inst, NU } = ctx;
  if (naam === 'voertuig' && id) return detail(el, ctx, id);
  const sort = (s => ({ k: s[0] || 'kosten', d: s[1] === 'op' ? 1 : -1 }))((q.get('sort') || '').split(':'));
  const rows = D.vloot.filter(v => v.soort === 'trekker').map(t => {
    const L = D.claims.filter(c => telt(c) && (c.eigenVoertuig === t.id) && c.ontvangen >= NU - 365 * DAG);
    const eigen = L.filter(c => c.categorie === 'eigen'), derde = L.filter(c => c.categorie === 'derde');
    const kosten = L.reduce((s, c) => s + (c.besluit ? eigenKosten(c.besluit, c.bedragUitkomst || 0, inst, c.categorie) : 0), 0);
    const stil = eigen.reduce((s, c) => s + (c.werkorder ? c.werkorder.stilstand || 0 : 0), 0);
    const inHerstel = L.some(c => c.status === 'werkplaats');
    return { t, opl: D.vlootMap.get(t.oplegger), n: L.length, eigen: eigen.length, derde: derde.length, kosten, stil, inHerstel, open: L.filter(c => OPEN_STATUS.includes(c.status)).length };
  });
  const L = sorteer(rows, sort, { id: x => x.t.id, type: x => x.t.merk, vest: x => x.t.vestiging, n: x => x.n, kosten: x => x.kosten, stil: x => x.stil });
  const setQ = o => { const n = new URLSearchParams(q); for (const [k, v] of Object.entries(o)) { if (v == null || v === '') n.delete(k); else n.set(k, v); } ctx.go(`wagenpark${n.toString() ? '?' + n : ''}`); };
  const tot = { n: rows.reduce((s, x) => s + x.n, 0), kosten: rows.reduce((s, x) => s + x.kosten, 0), stil: rows.reduce((s, x) => s + x.stil, 0), herstel: rows.filter(x => x.inHerstel).length };
  const kol = [{ n: 'Voertuig', sort: 'id' }, { n: 'Type', sort: 'type', cls: 'hide-m' }, { n: 'Vestiging', sort: 'vest', cls: 'hide-m' }, { n: 'Schades', sort: 'n', cls: 'r' }, { n: 'Onze kosten', sort: 'kosten', cls: 'r' }, { n: 'Uit de roulatie', sort: 'stil', cls: 'r hide-m' }, { n: 'Nu' }];
  el.innerHTML = `
    <div class="ph"><div><h1>Wagenpark</h1><div class="sub">${rows.length} autotransporters met hun oplegger. Afgelopen twaalf maanden: ${tot.n} aanrijschades, ${fmtEur(tot.kosten)} aan onze kosten, ${tot.stil} dagen uit de roulatie; nu ${tot.herstel} in herstel.</div></div></div>
    <div class="tv"><div class="tv-scroll"><table class="tbl"><thead><tr>${th(kol, sort)}</tr></thead><tbody>${L.map(x => `<tr class="click ${x.n ? '' : 'dim'}" tabindex="0" data-act="open" data-id="${x.t.id}"><td class="strong">${esc(x.t.id)} <span class="sub">${plaat(x.t.kenteken)}</span></td><td class="hide-m">${esc(x.t.merk)} ${esc(x.t.model)}<span class="sub">${esc(x.opl.merk)}</span></td><td class="hide-m">${esc(x.t.vestiging)}</td><td class="r num">${x.n || ''}${x.derde ? `<span class="sub">${x.derde} derde</span>` : ''}</td><td class="r num">${x.kosten ? fmtEur(x.kosten) : ''}</td><td class="r num hide-m">${x.stil ? `${x.stil} d` : ''}</td><td>${x.inHerstel ? pill('werkplaats') : x.open ? `<span class="mut">${x.open} open</span>` : ''}</td></tr>`).join('')}</tbody></table></div><div class="tv-foot"><span>Aanrijschade aan het voertuig zelf en aan derden; ladingsschade staat bij de opdrachtgevers en chauffeurs.</span>${sim('nummers, kentekens en bouwjaren gesimuleerd')}</div></div>`;
  bind(el, { open: t => ctx.go(`voertuig/${t.dataset.id}`), sort: t => setQ({ sort: `${t.dataset.sort}:${sort.k === t.dataset.sort && sort.d < 0 ? 'op' : 'af'}` }) });
}
function detail(el, ctx, id) {
  const { D, inst, NU } = ctx; const v = D.vlootMap.get(id);
  if (!v) { el.innerHTML = `<div class="crumb"><a href="#wagenpark">Wagenpark</a>${ico('chev')}<span>${esc(id)}</span></div>${leeg('Voertuig niet gevonden', '')}`; return; }
  const t = v.soort === 'trekker' ? v : D.vlootMap.get(v.trekker); const opl = D.vlootMap.get(t.oplegger);
  const L = D.claims.filter(c => c.eigenVoertuig === t.id && (c.categorie !== 'lading')).sort((a, b) => b.ontvangen - a.ontvangen);
  const M = L.filter(c => c.categorie === 'eigen').slice(0, 8).map((c, i) => ({ gebied: c.gebied, bron: OPEN_STATUS.includes(c.status) ? 'claim' : 'eerder', nr: i + 1 }));
  const ritten90 = D.ritten.filter(r => r.truck === t.id).length;
  el.innerHTML = `
    <div class="crumb"><a href="#wagenpark">Wagenpark</a>${ico('chev')}<span>${esc(t.id)}</span></div>
    <div class="ph"><div><h1>${esc(t.id)} ${esc(t.merk)} ${esc(t.model)}</h1><div class="sub">${plaat(t.kenteken)} · bouwjaar ${t.bouwjaar} · ${fmtNum(t.km)} km · ${esc(t.vestiging)} · ${ritten90} ritten in 90 dagen · oplegger ${esc(opl.id)} ${esc(opl.merk)} ${esc(opl.model)} ${plaat(opl.kenteken)} <span class="tag sim">gesimuleerd</span></div></div><div class="acts"><a class="btn" href="#schades?status=alle&q=${encodeURIComponent(t.id)}">${ico('inbox')}Alle dossiers</a></div></div>
    <div class="pad stack" style="gap:16px">
      <div class="card"><div class="card-h"><h2>Waar de schade zat</h2><span class="legend"><span><i class="e"></i>afgehandeld</span><span><i class="c"></i>open</span></span></div><div class="card-b"><div class="vl-kop"><div class="truckw">${truckDiagram(M, { label: `Schades aan ${t.id} en ${opl.id}` })}</div><ol class="lst" style="display:flex;flex-direction:column;gap:6px;font-size:13px">${M.length ? M.map((m, i) => `<li>${m.nr}. ${esc(GEBIEDEN[m.gebied])} <span class="mut">${esc(fmtDatum(L.filter(c => c.categorie === 'eigen')[i].moment))}</span></li>`).join('') : '<li class="mut">Geen aanrijschade aan dit voertuig.</li>'}</ol></div></div></div>
      <div class="card"><div class="card-h"><h2>Dossiers</h2></div><div class="card-b tight">${L.length ? `<table class="tbl compact"><thead><tr><th>Moment</th><th>Soort</th><th>Wat</th><th class="hide-m">Chauffeur</th><th>Status</th><th class="r">Onze kosten</th></tr></thead><tbody>${L.map(c => `<tr class="click" tabindex="0" data-act="dos" data-id="${c.id}"><td>${esc(fmtDatum(c.moment || c.ontvangen))}</td><td>${esc(CATEGORIEN[c.categorie].kort)}</td><td>${esc(c.categorie === 'derde' ? c.voertuig.merk + (c.voertuig.model ? ' ' + c.voertuig.model : '') : GEBIEDEN[c.gebied])}<span class="sub">${esc(SOORTEN[c.soort] ? SOORTEN[c.soort].toLowerCase() : '')}</span></td><td class="hide-m">${esc(c.chauffeurNaam || '')}</td><td>${pill(c.status)}</td><td class="r num">${c.besluit ? fmtEur(eigenKosten(c.besluit, c.bedragUitkomst || 0, inst, c.categorie)) : '<span class="mut">open</span>'}</td></tr>`).join('')}</tbody></table>` : leeg('Geen dossiers', 'Geen aanrijschade of diverse schade bij dit voertuig.')}</div></div>
    </div>`;
  bind(el, { dos: t2 => ctx.go(`schade/${t2.dataset.id}`) });
}
