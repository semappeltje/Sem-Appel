// Dashboard: het beeld voor de directie in een oogopslag. Weinig tekst, elke tegel een getal met zijn richting en een
// vonklijn; daaronder de kosten per maand, de uitkomst, waar de schade zit, de vestigingen, de fase en de opdrachtgevers.
import { OPEN_STATUS, eigenKosten, gesprekSignaal, teltVoorChauffeur, fmtEur, fmtMaandKort, DAG, GEBIEDEN, FASEN } from '../regels.js';
import { VESTIGINGEN } from '../data.js';
import { warmteDiagram } from '../diagram.js';
import { esc, ico, bind, staafdiagram, vonk, verdeling } from '../h.js';

const PER = { 30: { n: '30 dagen', d: 30 }, 90: { n: '90 dagen', d: 90 }, 365: { n: '12 maanden', d: 365 } };
export function render(el, ctx, { q }) {
  const { D, inst, NU } = ctx;
  const per = PER[q.get('p')] ? Number(q.get('p')) : 90; const vest = q.get('vest') || '';
  const van = NU - per * DAG, vanVorig = NU - 2 * per * DAG;
  const in_ = (c, a, b) => c.ontvangen >= a && c.ontvangen < b && (!vest || c.vestiging === vest);
  const L = D.claims.filter(c => in_(c, van, NU + 1)); const V = D.claims.filter(c => in_(c, vanVorig, van));
  const kosten = c => c.besluit ? eigenKosten(c.besluit, c.bedragUitkomst || 0, inst) : 0;
  const som = (A, f) => A.reduce((s, c) => s + (f(c) || 0), 0);
  const ritten = (a, b) => D.ritten.filter(r => r.ophaal >= a && r.ophaal < b && (!vest || r.vestiging === vest)).length;
  const rittenNu = ritten(van, NU + 1) || Math.round(830 / 7 * per), rittenVorig = ritten(vanVorig, van) || rittenNu;
  const med = A => { const d = A.filter(c => c.beslotenOp).map(c => (c.beslotenOp - c.ontvangen) / DAG).sort((a, b) => a - b); return d.length ? d[Math.floor(d.length / 2)] : null; };
  const afgPct = A => { const b = A.filter(c => c.besluit); return b.length ? b.filter(c => c.besluit === 'afgewezen').length / b.length : 0; };
  // vonklijnen: twaalf stappen over de periode
  const stappen = 12; const reeks = f => { const out = []; for (let i = stappen - 1; i >= 0; i--) { const b = NU - i * (per * DAG / stappen), a = b - per * DAG / stappen; out.push(f(D.claims.filter(c => in_(c, a, b)))); } return out; };
  const kpi = (l, v, sub, delta, goedAlsLager, reeksV, fmt) => { const d = delta == null ? null : delta; const richting = d == null || Math.abs(d) < 0.005 ? 0 : d > 0 ? 1 : -1; const goed = richting === 0 ? null : (goedAlsLager ? richting < 0 : richting > 0); return `<div class="dk"><span class="l">${esc(l)}</span><span class="v">${v}</span><span class="d ${goed == null ? '' : goed ? 'goed' : 'slecht'}">${richting === 0 ? '<span class="mut">gelijk</span>' : `${richting > 0 ? ico('up') : ico('up', 'down')}${Math.abs(Math.round(d * 100))}%`} <span class="mut">t.o.v. ervoor</span></span><span class="vonkw" title="${esc(sub)}">${vonk(reeksV, { nul: true })}</span><span class="s">${esc(sub)}</span></div>`; };
  const rel = (a, b) => (b ? (a - b) / b : null);
  const kNu = som(L, kosten), kVorig = som(V, kosten);
  const perDuizend = L.length / rittenNu * 1000, perDuizendV = V.length / rittenVorig * 1000;
  const medNu = med(L), medV = med(V);
  // kosten per maand (twaalf maanden), uitkomst, plekken, vestigingen, fase, opdrachtgevers
  const maanden = D.maanden.map(m => { const A = D.claims.filter(c => { const d = new Date(c.ontvangen); return d.getFullYear() === m.jaar && d.getMonth() === m.maand && (!vest || c.vestiging === vest); }); return { l: fmtMaandKort(m.t), kosten: som(A, kosten), n: A.length, afg: A.filter(c => c.besluit === 'afgewezen').length }; });
  const afg = L.filter(c => c.besluit === 'afgewezen'), erk = L.filter(c => c.besluit === 'erkend'), verz = L.filter(c => c.besluit === 'verzekeraar'), open = L.filter(c => !c.besluit);
  const plek = {}; for (const c of L) plek[c.gebied] = (plek[c.gebied] || 0) + 1; const topPlek = Object.entries(plek).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const vesten = Object.values(VESTIGINGEN).map(v => { const A = D.claims.filter(c => c.ontvangen >= van && c.vestiging === v.n); const r = D.ritten.filter(x => x.ophaal >= van && x.vestiging === v.n).length || 1; return { v, n: A.length, kosten: som(A, kosten), per: A.length / r * 1000, afg: afgPct(A) }; });
  const fase = {}; for (const c of L.filter(x => x.besluit && x.besluit !== 'afgewezen')) fase[c.fase || 'onbekend'] = (fase[c.fase || 'onbekend'] || 0) + 1;
  const faseTot = Object.values(fase).reduce((s, n) => s + n, 0) || 1;
  const opdr = {}; for (const c of L) { const k = c.opdrachtgever; opdr[k.id] = opdr[k.id] || { k, n: 0, afg: 0, bes: 0 }; opdr[k.id].n++; if (c.besluit) { opdr[k.id].bes++; if (c.besluit === 'afgewezen') opdr[k.id].afg++; } }
  const topOpdr = Object.values(opdr).sort((a, b) => b.n - a.n).slice(0, 5);
  const sig = D.chauffeurs.map(ch => gesprekSignaal(D.claims.filter(c => c.chauffeur === ch.id), inst, NU)).filter(Boolean);
  const maxPlek = topPlek.length ? topPlek[0][1] : 1;
  const setQ = o => { const n = new URLSearchParams(q); for (const [k, v] of Object.entries(o)) { if (v == null || v === '') n.delete(k); else n.set(k, v); } ctx.go(`dashboard${n.toString() ? '?' + n : ''}`); };
  el.innerHTML = `
    <div class="ph"><div><h1>Dashboard</h1><div class="sub">${esc(PER[per].n)}${vest ? `, ${esc(vest)}` : ', alle vestigingen'} · ${L.length} claims op ${rittenNu.toLocaleString('nl-NL')} ritten</div></div>
      <div class="acts"><div class="seg" role="tablist" aria-label="Periode">${Object.entries(PER).map(([k, p]) => `<button type="button" role="tab" class="${Number(k) === per ? 'on' : ''}" aria-selected="${Number(k) === per}" data-act="p" data-v="${k}">${p.n}</button>`).join('')}</div><select class="fld" style="width:auto" data-chg="vest" aria-label="Vestiging"><option value="">Alle vestigingen</option>${Object.values(VESTIGINGEN).map(v => `<option ${vest === v.n ? 'selected' : ''}>${v.n}</option>`).join('')}</select></div></div>
    <div class="pad stack" style="gap:16px">
      <div class="dks">
        ${kpi('Claims', L.length, `${open.length} nog open`, rel(L.length, V.length), true, reeks(A => A.length))}
        ${kpi('Onze kosten', fmtEur(kNu), 'erkend plus eigen risico', rel(kNu, kVorig), true, reeks(A => som(A, kosten)))}
        ${kpi('Afgewezen', `${Math.round(afgPct(L) * 100)}<small>%</small>`, `${fmtEur(som(afg, c => c.bedragGevraagd))} afgewend`, rel(afgPct(L), afgPct(V)), false, reeks(A => Math.round(afgPct(A) * 100)))}
        ${kpi('Per 1.000 ritten', perDuizend.toFixed(1).replace('.', ','), 'claims per duizend vervoerde auto\'s', rel(perDuizend, perDuizendV), true, reeks(A => A.length))}
        ${kpi('Doorlooptijd', medNu != null ? `${Math.round(medNu)}<small>dagen</small>` : '<small>nog geen</small>', 'mediaan tot het besluit', medNu != null && medV != null ? rel(medNu, medV) : null, true, reeks(A => med(A) || 0))}
      </div>
      <div class="grid g32">
        <div class="card"><div class="card-h"><h2>Onze kosten per maand</h2><span class="mut">in euro, erkend plus eigen risico</span></div><div class="card-b">${staafdiagram([{ k: 'a', n: 'onze kosten', v: maanden.map(m => m.kosten) }], maanden.map(m => m.l), { w: 640, h: 190, label: 'Onze kosten per maand', fmt: v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v) })}</div></div>
        <div class="card"><div class="card-h"><h2>Uitkomst</h2><span class="mut">${L.length} claims</span></div><div class="card-b stack" style="gap:14px">
          ${verdeling([{ k: 'afgewezen', n: afg.length, kleur: 'var(--viz-3)' }, { k: 'erkend, zelf betaald', n: erk.length, kleur: 'var(--viz-1)' }, { k: 'bij de verzekeraar', n: verz.length, kleur: 'var(--c-verzekeraar)' }, { k: 'open', n: open.length, kleur: 'var(--viz-2)' }], { label: 'Uitkomst van de claims' })}
          <table class="tbl plain compact"><tbody>${[['Afgewezen met bewijs', afg, 'var(--viz-3)'], ['Erkend, zelf betaald', erk, 'var(--viz-1)'], ['Bij de verzekeraar', verz, 'var(--c-verzekeraar)'], ['Nog open', open, 'var(--viz-2)']].map(([n, A, k]) => `<tr><td><i class="dot" style="background:${k}"></i> ${n}</td><td class="r num">${A.length}</td><td class="r num mut">${L.length ? Math.round(A.length / L.length * 100) : 0}%</td><td class="r num">${fmtEur(som(A, c => c.bedragGevraagd))}</td></tr>`).join('')}</tbody></table>
        </div></div>
      </div>
      <div class="grid g3">
        <div class="card"><div class="card-h"><h2>Waar de schade zit</h2></div><div class="card-b"><div class="diag heat">${warmteDiagram(plek, { width: 130 })}<ol class="lst">${topPlek.map(([g, n]) => `<li><span class="barw"><span class="trk"><i style="width:${Math.round(n / maxPlek * 100)}%"></i></span></span><span><b>${n}</b> ${esc(GEBIEDEN[g].toLowerCase())}</span></li>`).join('') || '<li class="mut">Geen claims in deze periode.</li>'}</ol></div></div></div>
        <div class="card"><div class="card-h"><h2>Per vestiging</h2></div><div class="card-b tight"><table class="tbl plain compact" style="padding:0 16px"><thead><tr><th style="padding-left:16px">Vestiging</th><th class="r">Claims</th><th class="r" style="padding-right:16px">Kosten</th></tr></thead><tbody>${vesten.map(x => `<tr><td style="padding-left:16px;white-space:normal"><b>${esc(x.v.n)}</b><div class="mut" style="font-size:11.5px">${esc(x.v.sub)} · ${x.per.toFixed(1).replace('.', ',')} per 1.000 · ${Math.round(x.afg * 100)}% afgewezen</div></td><td class="r num" style="vertical-align:top;padding-top:8px">${x.n}</td><td class="r num" style="padding-right:16px;vertical-align:top;padding-top:8px">${fmtEur(x.kosten)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-h"><h2>Wanneer het gebeurt</h2><span class="mut">erkende schades</span></div><div class="card-b stack" style="gap:10px">${Object.entries(FASEN).filter(([k]) => fase[k]).sort((a, b) => fase[b[0]] - fase[a[0]]).map(([k, n]) => `<div class="fr"><span>${esc(n)}</span><span class="barw"><span class="trk" style="width:120px"><i style="width:${Math.round(fase[k] / faseTot * 100)}%"></i></span><span class="num">${fase[k]}</span></span></div>`).join('') || '<span class="mut">Nog geen erkende schades in deze periode.</span>'}</div></div>
      </div>
      <div class="grid g32">
        <div class="card"><div class="card-h"><h2>Opdrachtgevers</h2><a class="lnk quiet" href="#opdrachtgevers">Alle</a></div><div class="card-b tight"><table class="tbl plain compact" style="padding:0 16px"><thead><tr><th style="padding-left:16px">Opdrachtgever</th><th class="r">Claims</th><th class="r" style="padding-right:16px">Afgewezen</th></tr></thead><tbody>${topOpdr.map(x => `<tr class="click" tabindex="0" data-act="opdr" data-id="${x.k.id}"><td style="padding-left:16px">${esc(x.k.naam)}</td><td class="r num">${x.n}</td><td class="r" style="padding-right:16px"><span class="barw"><span class="trk"><i style="width:${x.bes ? Math.round(x.afg / x.bes * 100) : 0}%" class="${x.bes && x.afg / x.bes >= 0.6 ? 'bad' : ''}"></i></span><span class="num">${x.bes ? Math.round(x.afg / x.bes * 100) : 0}%</span></span></td></tr>`).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-h"><h2>Chauffeurs</h2>${ctx.kan('chauffeur') ? '<a class="lnk quiet" href="#chauffeurs">Alle</a>' : ''}</div><div class="card-b stack" style="gap:10px">
          <div class="row" style="gap:20px"><div><span class="v2">${sig.filter(s => s.niveau === 'gesprek').length}</span><div class="mut" style="font-size:12px">boven de regel (${inst.gesprekAantal} in ${inst.gesprekDagen} dagen)</div></div><div><span class="v2">${sig.filter(s => s.niveau === 'signaal').length}</span><div class="mut" style="font-size:12px">tweede signaal</div></div><div><span class="v2">${D.chauffeurs.length}</span><div class="mut" style="font-size:12px">chauffeurs</div></div></div>
          ${ctx.kan('chauffeur') ? `<div class="strip" role="img" aria-label="Verdeling van de chauffeurs naar claims per duizend ritten">${D.chauffeurs.map(ch => { const n = D.claims.filter(c => c.chauffeur === ch.id && c.ontvangen >= van && teltVoorChauffeur(c)).length; const r = (per === 30 ? ch.ritten90 / 3 : per === 90 ? ch.ritten90 : ch.ritten365) || 1; const x = Math.min(100, n / r * 1000 / 40 * 100); return `<i style="left:${x}%" title="${esc(ch.naam)}: ${(n / r * 1000).toFixed(1).replace('.', ',')} per 1.000"></i>`; }).join('')}<b style="left:${Math.min(100, perDuizend / 40 * 100)}%" title="gemiddeld"></b></div><div class="row mut" style="font-size:11.5px;justify-content:space-between"><span>0 per 1.000 ritten</span><span>gemiddeld ${perDuizend.toFixed(1).replace('.', ',')}</span><span>40</span></div>` : `<div class="note">${ico('lock')}<span>Het beeld per chauffeur is er voor de schadebehandeling en de directie.</span></div>`}
        </div></div>
      </div>
      <div class="row mut" style="font-size:12px;justify-content:space-between"><span>Gesimuleerde data op een vaste dag. Bedragen zonder btw.</span><a class="lnk quiet" href="#rapporten">Tabellen, csv en afdrukken</a></div>
    </div>`;
  bind(el, { p: t => setQ({ p: t.dataset.v }), vest: t => setQ({ vest: t.value }), opdr: t => ctx.go(`opdrachtgever/${t.dataset.id}`) });
}
