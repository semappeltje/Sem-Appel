// Overzicht: wat er vandaag speelt. Vijf cijfers, "Wat nu", schades per week, signalen.
import { OPEN_STATUS, STATUS, eigenKosten, gesprekSignaal, fmtEur, fmtDatum, werkdagen, DAG } from '../regels.js';
import { esc, plaat, pill, ico, bind, staafdiagram, sim } from '../h.js';

export function render(el, ctx) {
  const { D, inst, NU } = ctx; const open = ctx.open();
  const nieuw = D.claims.filter(c => c.status === 'nieuw'); const laat = D.claims.filter(ctx.teLaat);
  const openBedrag = open.reduce((s, c) => s + (c.bedragGevraagd || 0), 0);
  const kwStart = new Date(2026, 9, 1).getTime();
  const kw = D.claims.filter(c => c.beslotenOp && c.beslotenOp >= kwStart && (c.besluit === 'erkend' || c.besluit === 'verzekeraar'));
  const kwKosten = kw.reduce((s, c) => s + eigenKosten(c.besluit, c.bedragUitkomst || 0, inst), 0);
  const besloten90 = D.claims.filter(c => c.beslotenOp && c.beslotenOp >= NU - 90 * DAG);
  const afgew = besloten90.filter(c => c.besluit === 'afgewezen').length;
  const afgewend = besloten90.filter(c => c.besluit === 'afgewezen').reduce((s, c) => s + (c.bedragGevraagd || 0), 0);
  // wat nu
  const nu = [];
  for (const c of laat) nu.push({ c, w: 0, t: `${werkdagen(c.ontvangen, NU)} werkdagen zonder antwoord`, k: 'bad' });
  for (const c of nieuw) if (!laat.includes(c)) nu.push({ c, w: 1, t: `Nieuw, binnengekomen ${fmtDatum(c.ontvangen)}`, k: 'info' });
  for (const c of open) { if (c.status === 'wacht_chauffeur' && werkdagen(c.log[c.log.length - 1].t, NU) >= 3) nu.push({ c, w: 2, t: `Wacht ${werkdagen(c.log[c.log.length - 1].t, NU)} werkdagen op ${c.chauffeurNaam}`, k: 'warn' }); if (c.status === 'verzekeraar' && NU - c.log[c.log.length - 1].t > 14 * DAG) nu.push({ c, w: 3, t: `${Math.round((NU - c.log[c.log.length - 1].t) / DAG)} dagen bij de verzekeraar zonder bericht`, k: 'warn' }); if (c.bron === 'chauffeur' && c.status === 'onderzoek') nu.push({ c, w: 1.5, t: `${c.chauffeurNaam} meldde dit zelf; nog geen claim van ${c.opdrachtgever.naam}`, k: 'ok' }); }
  nu.sort((a, b) => a.w - b.w || a.c.ontvangen - b.c.ontvangen);
  // per week, twaalf weken
  const wk = []; for (let i = 11; i >= 0; i--) { const tot = NU - i * 7 * DAG; const van = tot - 7 * DAG; const L = D.claims.filter(c => c.ontvangen > van && c.ontvangen <= tot); const dte = new Date(tot); const jan1 = new Date(dte.getFullYear(), 0, 1); const n = Math.ceil(((dte - jan1) / DAG + jan1.getDay() + 1) / 7); wk.push({ l: `wk ${n}`, afg: L.filter(c => c.besluit === 'afgewezen').length, erk: L.filter(c => c.besluit && c.besluit !== 'afgewezen').length, open: L.filter(c => !c.besluit).length }); }
  // signalen
  const sig = [];
  for (const ch of D.chauffeurs) { const s = gesprekSignaal(D.claims.filter(c => c.chauffeur === ch.id), inst, NU); if (s) sig.push({ ico: s.niveau === 'gesprek' ? 'alert' : 'flag', k: s.niveau === 'gesprek' ? 'bad' : 'warn', t: `${ch.naam}: ${s.tekst}`, s: s.niveau === 'gesprek' ? `Volgens de regel een gesprek (${fmtDatum(s.van)} tot ${fmtDatum(s.tot)}). Alleen voor directie en HR, met de OR-afspraak.` : `Het tweede signaal (${fmtDatum(s.van)} tot ${fmtDatum(s.tot)}).`, go: `chauffeur/${ch.id}` }); }
  sig.sort((a, b) => (a.k === 'bad' ? 0 : 1) - (b.k === 'bad' ? 0 : 1));
  for (const k of D.opdrachtgevers) { const L = D.claims.filter(c => c.opdrachtgever.id === k.id && c.beslotenOp && c.beslotenOp >= NU - 365 * DAG); const e = L.filter(c => c.besluit === 'afgewezen').length; if (L.length >= 8 && e / L.length >= 0.6) sig.push({ ico: 'building', k: 'warn', t: `${k.naam}: ${e} van ${L.length} claims afgewezen`, s: 'Vaak schade die al op de ophaalinspectie stond. Een gesprek over hun uitgiftecontrole scheelt beide partijen werk.', go: `opdrachtgever/${k.id}` }); }
  const geenFoto = open.filter(c => c.rit && ctx.beoordeling(c).signalen.some(s => s.id === 'eerder' && s.kleur === 'let'));
  if (geenFoto.length) sig.push({ ico: 'camera', k: 'info', t: `${geenFoto.length} open ${geenFoto.length === 1 ? 'dossier' : 'dossiers'} zonder foto van de plek bij ophalen`, s: 'Daar staan we zwak. Een vaste fotoroutine per hoek en per genoteerde schade voorkomt dit.', go: 'schades?status=open&signaal=geenfoto' });
  const intro = ctx.store.get('bs-intro') !== 'weg';
  const uur = new Date(NU).getHours(); const groet = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
  el.innerHTML = `
    <div class="ph"><div><h1>${groet}, ${esc(inst.naam)}</h1><div class="sub">${open.length} open ${open.length === 1 ? 'dossier' : 'dossiers'}, ${nieuw.length} nieuw, ${laat.length} over de antwoordtermijn van ${inst.antwoordWerkdagen} werkdagen.</div></div><div class="acts"><button type="button" class="btn pri" data-act="nieuw">${ico('plus')}Nieuwe melding</button></div></div>
    <div class="pad stack" style="gap:16px">
      ${intro ? `<div class="note info" id="intro">${ico('info')}<div class="grow"><b>Demo met gesimuleerde data.</b> Een schadeportaal voor Breedijk Transport: de schade-mailbox, de rit uit Transpas en het overzicht voor het management in een scherm. Kentekens, voertuigen, chauffeurs, opdrachtgevers, foto's en bedragen zijn verzonnen; de plaatsen en de drie vestigingen zijn echt. De demo speelt op een vaste dag. Begin bij <a href="#schades?status=nieuw" class="lnk">de nieuwe meldingen</a> of open een dossier uit "Wat nu".</div><button type="button" class="ib sm" data-act="introweg" aria-label="Sluiten">${ico('x')}</button></div>` : ''}
      <div class="kpis">
        <a class="kpi ${nieuw.length ? 'warm' : ''}" href="#schades?status=nieuw"><span class="l">Nieuw</span><span class="v">${nieuw.length}</span><span class="s">nog niet bekeken</span></a>
        <a class="kpi ${laat.length ? 'hot' : ''}" href="#schades?status=open&signaal=laat"><span class="l">Over de termijn</span><span class="v">${laat.length}</span><span class="s">langer dan ${inst.antwoordWerkdagen} werkdagen zonder antwoord</span></a>
        <a class="kpi" href="#schades?status=open"><span class="l">Open</span><span class="v">${open.length}<small>${fmtEur(openBedrag)}</small></span><span class="s">gevraagd, nog niet besloten</span></a>
        <a class="kpi" href="#rapporten?periode=kwartaal"><span class="l">Erkend dit kwartaal</span><span class="v">${fmtEur(kwKosten)}</span><span class="s">${kw.length} ${kw.length === 1 ? 'schade' : 'schades'}, onze kosten na eigen risico</span></a>
        <a class="kpi" href="#rapporten"><span class="l">Afgewezen</span><span class="v">${besloten90.length ? Math.round(100 * afgew / besloten90.length) : 0}<small>%</small></span><span class="s">van ${besloten90.length} besluiten in 90 dagen, ${fmtEur(afgewend)} afgewend</span></a>
      </div>
      <div class="grid g32">
        <div class="card"><div class="card-h"><h2>Wat nu</h2><a class="lnk quiet" href="#schades?status=open">Alle open (${open.length})</a></div>
          <div class="list">${nu.length ? nu.slice(0, 9).map(x => `<a class="list-i" href="#schade/${x.c.id}">${ico(x.k === 'bad' ? 'clock' : x.k === 'warn' ? 'alert' : x.k === 'ok' ? 'camera' : 'mail', `lead ${x.k === 'bad' ? 'tbad' : x.k === 'warn' ? 'twarn' : x.k === 'ok' ? 'tok' : 'tinfo'}`)}<span class="t">${plaat(x.c.kenteken)}<span>${esc(x.c.voertuig.merk)} ${esc(x.c.voertuig.model)}</span><span class="mut" style="font-weight:400">${esc(x.c.opdrachtgever.naam)}</span></span><span class="rt">${x.c.bedragGevraagd ? fmtEur(x.c.bedragGevraagd) : '<span class="mut">geen bedrag</span>'}</span><span class="m">${esc(x.t)}${x.c.status !== 'nieuw' ? ` · ${esc(STATUS[x.c.status].n)}` : ''}${x.c.behandelaar ? ` · ${esc(x.c.behandelaar)}` : ''}</span></a>`).join('') : `<div class="empty"><b>Niets dat nu moet</b>Alle open dossiers zijn binnen de termijn.</div>`}</div></div>
        <div class="stack" style="gap:16px">
          <div class="card"><div class="card-h"><h2>Schades per week</h2><span class="legend"><span><i style="background:var(--viz-2)"></i>open</span><span><i style="background:var(--viz-1)"></i>erkend</span><span><i style="background:var(--c-afgewezen);opacity:.55"></i>afgewezen</span></span></div><div class="card-b">${staafdiagram([{ k: 'a', n: 'erkend', v: wk.map(w => w.erk) }, { k: 'c', n: 'afgewezen', v: wk.map(w => w.afg) }, { k: 'b', n: 'open', v: wk.map(w => w.open) }], wk.map(w => w.l), { w: 520, h: 170, label: 'Schademeldingen per week, laatste twaalf weken' })}<div class="mut" style="font-size:12px;margin-top:6px">Binnengekomen meldingen per week, naar de uitkomst tot nu toe. Ongeveer 800 auto's per week; iets meer dan een op de honderd krijgt een claim (gesimuleerd).</div></div></div>
          <div class="card"><div class="card-h"><h2>Signalen</h2></div><div class="list">${sig.length ? sig.slice(0, 5).map(x => `<a class="list-i" href="#${x.go}">${ico(x.ico, `lead ${x.k === 'bad' ? 'tbad' : x.k === 'warn' ? 'twarn' : 'tinfo'}`)}<span class="t">${esc(x.t)}</span><span class="rt">${ico('chev')}</span><span class="m">${esc(x.s)}</span></a>`).join('') : '<div class="empty">Geen signalen.</div>'}</div></div>
        </div>
      </div>
      <div class="row mut" style="font-size:12px;gap:14px">${sim('alle data gesimuleerd')}<span>Instellingen: grens verzekeraar ${fmtEur(inst.drempelVerzekeraar)}, eigen risico ${fmtEur(inst.eigenRisico)}, antwoord binnen ${inst.antwoordWerkdagen} werkdagen, gesprek bij ${inst.gesprekAantal} schades in ${inst.gesprekDagen} dagen.</span><a class="lnk quiet" href="#instellingen">Aanpassen</a></div>
    </div>`;
  bind(el, { nieuw: () => ctx.nieuweMelding(), introweg: () => { ctx.store.set('bs-intro', 'weg'); const i = el.querySelector('#intro'); if (i) i.remove(); } });
}
