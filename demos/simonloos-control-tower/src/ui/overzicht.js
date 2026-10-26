// Overzicht: het startscherm van de planner. Links wat nu aandacht nodig heeft (open zaken op urgentie, met één klik
// naar de zaak en een snelle actie) en de vertrekken van het komende uur; rechts de kerngetallen van vandaag met hun
// verloop en de recente gebeurtenissen (ritten en acties van planners). Rustig: vier kaarten, geen tegelbehang.
import { esc, ic, fmt, hhmm, day, durTxt, nl1, plate, meter, empty, on, SOORT, zBadge, initials } from './base.js';
import { sparkline } from './charts.js';
import { openIn, klantKort, toegewezenIn } from './openritten.js';
import { urgentie, prognose } from './invulling.js';
import { vensterAbs } from './planwijzig.js';
import { aiUrl, stuur } from './ai.js';

const DEPST = { Gepland: 'outline', Klaarzetten: 'b-info', Laden: 'b-warn', Vertrekt: 'b-ok', Vertrokken: '', 'Te laat': 'b-bad' };
export function depStatus(d, T, S) {
  const dt = d.at - T; const st = S.get(d.t.id);
  if (dt < -1) return st && st.st === 'terrein' && (!st.dienst || st.seg.k !== 'drive') && st.seg.k !== 'koppel' ? { cls: 'late', text: `te laat +${Math.round(-dt)}`, status: 'Te laat' } : { cls: 'gone', text: 'vertrokken', status: 'Vertrokken' };
  if (dt <= 1) return { cls: 'now', text: 'nu', status: 'Vertrekt' };
  return { cls: dt < 15 ? 'soon' : '', text: `over ${Math.round(dt)} min`, status: dt < 15 ? 'Laden' : dt < 45 ? 'Klaarzetten' : 'Gepland' };
}
export const depBadge = c => `<span class="badge ${DEPST[c.status] || ''} ${c.status === 'Vertrokken' ? 'st-afgerond' : ''}">${esc(c.status)}</span>`;
// De dag in cijfers voor de voertuigen van het werkgebied, zoals fleet.dagcijfers dat voor heel Simon Loos doet: het
// aantal diensten, de mediaan van de diensttijd in uren en het deel van de diensttijd dat gereden wordt.
export function dagVan(trucks) {
  const duur = []; let rij = 0, tot = 0;
  for (const t of trucks) for (const d of t.diensten) {
    let du = d.t1 - d.t0; if (!Number.isFinite(du)) du = d.end - d.start; if (!Number.isFinite(du) || du <= 0) continue;
    let r = 0; for (const s of t.plan) if (s.d === d.i && s.k === 'drive') r += s.t1 - s.t0;
    duur.push(du); rij += r; tot += du;
  }
  const s = duur.sort((a, b) => a - b); const med = s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0;
  return { diensten: s.length, mediaanUur: Math.round(med / 6) / 10, rijdenProcent: tot ? Math.round(rij / tot * 1000) / 10 : 0 };
}

// ---------- de briefing ----------
// Bovenaan het overzicht, in de volgorde van een overdracht: wat er speelt, wat open staat, waar het risico zit en wat
// je moet beslissen; als de vorige dienst iets achterliet, de overdracht als vijfde regel. Elke regel opent de zaak of
// de rit erachter. De app schrijft hem zelf uit de dag van het werkgebied; met data-ai kan de Assistent hem schrijven,
// alleen na een klik (nooit vanzelf).
const kl = s => { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); };
// nummers als T-1005 of R-10188 breken niet af bij het streepje
const idsHeel = s => esc(s).replace(/\b([A-Z]{1,2}-\d{2,6})\b/g, '<span class="nowrap">$1</span>');
// een duur als "1 u 4 min" breekt niet midden in
const duurHeel = m => durTxt(m).replace(/ /g, ' ');
const rij = (n, een, meer) => `${fmt(n)} ${n === 1 ? een : meer}`;
const ritVan = (ctx, d) => ctx.R.ofTruck(d.t).find(x => Math.abs(x.dep - d.at) < 1 || Math.abs(day(x.dep - d.at)) < 1);
export function briefing(ctx) {
  const T = ctx.state.simTime; const c = ctx.counts(); const open = ctx.Z.open(); const out = []; const can = ctx.can('act');
  // elke regel opent iets anders: wat al een regel heeft (een zaak of een open rit), komt niet nog een keer; een voorstel
  // bij een zaak die al een regel heeft, staat op die regel
  const gebruikt = new Set(); const props = ctx.voorstellen();
  const voorstelBij = z => props.find(p => { const x = ctx.Z.get(p.key); return x && x.id === z.id; }) || null;
  const metVoorstel = z => { const p = voorstelBij(z); return p ? ` Voorstel: ${kl(p.kort)}.` : ''; };
  // 1. wat er speelt: de grootste vertraging, anders wat er rijdt, anders het eerste vertrek. De woorden en getallen zijn
  // die van de filterbalk op de kaart: onderweg (rijdt volgens plan), vertraagd (rijdt achter op plan), bij een klant;
  // ze tellen niet dubbel. Vertraagd is nog geen zaak: dat wordt het pas als een stop daardoor na zijn venster komt.
  const rijdt = c.onderweg + c.vertraagd;
  const stand = `${rij(c.onderweg, 'voertuig', 'voertuigen')} onderweg${c.vertraagd ? `, ${fmt(c.vertraagd)} vertraagd` : ''}`;
  const vz = open.filter(z => z.kind === 'Vertraging').sort((a, b) => ((b.data && b.data.delay) || 0) - ((a.data && a.data.delay) || 0));
  // een stop na zijn venster zonder open zaak: de zaak staat op wacht of is al afgehandeld
  const laat = ctx.exceptions().filter(e => e.kind === 'Vertraging' && ctx.inScope(e.t));
  if (vz.length) { gebruikt.add(vz[0].id); out.push({ k: 'Speelt', icon: 'activity', sev: 'bad', open: `melding/${vz[0].id}`, lead: `${stand}.`, t: `De grootste: ${vz[0].obj}, ${vz[0].text}.${metVoorstel(vz[0])}` }); }
  else if (rijdt && laat.length) { const z = ctx.Z.get(laat[0].key); out.push({ k: 'Speelt', icon: 'activity', sev: 'warn', open: z ? `melding/${z.id}` : 'view:meldingen', lead: `${stand}, ${fmt(c.klant)} bij een klant.`, t: `${laat.length === 1 ? 'Eén voertuig komt na zijn venster' : `${fmt(laat.length)} voertuigen komen na hun venster`}; ${laat.length === 1 ? 'die zaak wacht of is afgehandeld' : 'die zaken wachten of zijn afgehandeld'}.` }); }
  else if (rijdt && c.vertraagd) {
    // vertraagd, maar binnen het venster: het voertuig dat het meest achter rijdt, met zijn rit
    let mx = null; for (const t of ctx.fleet.trucks) { if (!ctx.inScope(t)) continue; const s = ctx.S.get(t.id); if (s && s.st === 'vertraagd' && s.next && (!mx || (s.next.delay || 0) > (mx.s.next.delay || 0))) mx = { t, s }; }
    const r = mx && ctx.R.ritOf(mx.t, T);
    out.push({ k: 'Speelt', icon: 'activity', open: r ? `rit/${r.id}` : 'view:ritten', lead: `${stand}, ${fmt(c.klant)} bij een klant.`, t: `Niemand komt na zijn venster.${mx && mx.s.next.delay ? ` Het meest achter: ${mx.t.id}, ${mx.s.next.delay} min, op weg naar ${mx.s.next.home ? mx.t.base.n : mx.s.next.name}.` : ''}` });
  }
  else if (rijdt) out.push({ k: 'Speelt', icon: 'activity', open: 'view:ritten', lead: `${stand}, ${fmt(c.klant)} bij een klant.`, t: 'Niemand loopt uit.' });
  else {
    const deps = []; for (const sp of ctx.spsInScope()) for (const d of ctx.fleet.departures(sp, T - 2, 60)) if (ctx.inScope(d.t) && d.at >= T - 1) deps.push(d);
    deps.sort((a, b) => a.at - b.at); const d = deps[0]; const r = d && ritVan(ctx, d);
    out.push({ k: 'Speelt', icon: 'activity', open: r ? `rit/${r.id}` : 'view:planbord', lead: 'Nog niemand onderweg.', t: d ? `Het komende uur ${deps.length === 1 ? 'vertrekt één voertuig' : `vertrekken ${fmt(deps.length)} voertuigen`}, het eerste om ${hhmm(d.at)}: ${d.t.id} naar ${d.dest}.` : 'Het komende uur vertrekt er niemand.' });
  }
  // 2. wat open staat: de open ritten van vandaag (de meest dringende eerst) en wat op een ja wacht
  const OV = openIn(ctx); const vandaag = OV.filter(p => p.dag !== 'morgen'); const morgen = OV.length - vandaag.length;
  const wacht = toegewezenIn(ctx).filter(p => p.toegewezen.status === 'aangevraagd');
  const wachtTxt = wacht.length ? ` ${wacht.length === 1 ? 'Eén toewijzing wacht' : `${fmt(wacht.length)} toewijzingen wachten`} op een ja.` : '';
  if (vandaag.length) {
    const p = vandaag[0]; const v = vensterAbs(p); const pg = prognose(ctx, p); const snel = vandaag.filter(x => urgentie(ctx, x) < 60).length;
    gebruikt.add(`rit:${p.id}`);
    out.push({ k: 'Open', icon: 'inbox', sev: snel ? 'warn' : '', open: `openritten/${p.id}`, lead: `${rij(vandaag.length, 'open rit', 'open ritten')} vandaag${snel ? `, ${rij(snel, 'laadt', 'laden')} binnen het uur` : ''}.`, t: `Eerst: ${klantKort(p.klant)} uit ${p.sp}${v ? `, laden ${hhmm(v[0])}` : ''}, kans op invulling ${pg.kans} %.${wachtTxt}` });
  } else out.push({ k: 'Open', icon: 'inbox', open: wacht.length ? `openritten/${wacht[0].id}` : 'view:openritten', lead: 'Vandaag is alles ingevuld.', t: `${morgen ? `Morgen nog ${rij(morgen, 'open rit', 'open ritten')}.` : ''}${wachtTxt}`.trim() });
  // 3. waar het risico zit: de dringendste zaak die geen vertraging is (rijtijd, accu, techniek, koeling, oplegger),
  // anders de open rit met de kleinste kans om op tijd weg te gaan (niet de rit die Open al noemt)
  const rz = open.find(z => z.kind !== 'Vertraging' && !gebruikt.has(z.id));
  if (rz) {
    gebruikt.add(rz.id);
    // "O-5151 (vriesoplegger, achter T-1005): Koelunit ..." wordt "Vriesoplegger achter T-1005. Koelunit ..."
    const over = Math.round(rz.age - rz.norm); let tekst = rz.text.startsWith(rz.obj) ? rz.text.slice(rz.obj.length).replace(/^[\s:,]+/, '') : rz.text;
    tekst = tekst.replace(/^\(([^)]*)\):?\s*/, (m, g) => { const x = g.replace(/,\s*/g, ' '); return `${x.charAt(0).toUpperCase()}${x.slice(1)}. `; });
    out.push({ k: 'Risico', icon: 'alert', sev: rz.sev === 'bad' || over > 0 ? 'bad' : 'warn', open: `melding/${rz.id}`, lead: `${rz.kind} · ${rz.obj}.`, t: `${tekst}. ${over > 0 ? `${duurHeel(over)} over de deadline` : `Deadline over ${duurHeel(Math.max(1, -over))}`}${rz.who ? `, ${rz.who} heeft hem.` : ', nog zonder eigenaar.'}${metVoorstel(rz)}` });
  } else {
    const lr = vandaag.filter(p => !gebruikt.has(`rit:${p.id}`)).map(p => [p, prognose(ctx, p)]).filter(([, pg]) => pg.opTijd < 70).sort((a, b) => a[1].opTijd - b[1].opTijd)[0];
    if (lr) gebruikt.add(`rit:${lr[0].id}`);
    out.push(lr ? { k: 'Risico', icon: 'alert', sev: 'warn', open: `openritten/${lr[0].id}`, lead: `${klantKort(lr[0].klant)} uit ${lr[0].sp}.`, t: `Kans om op tijd weg te gaan ${lr[1].opTijd} %. ${lr[1].advies || ''}`.trim() } : { k: 'Risico', icon: 'alert', open: 'view:meldingen', lead: 'Geen melding boven de norm.', t: 'Geen andere open rit met een kleine kans op tijd.' });
  }
  // 4. wat je moet beslissen: voorstellen bij open zaken die nog geen regel hebben, anders zaken zonder eigenaar
  const zaakVan = p => ctx.Z.get(p.key);
  const verder = props.filter(p => { const z = zaakVan(p); return !z || !gebruikt.has(z.id); });
  if (verder.length) { const p = verder[0]; const z = zaakVan(p); out.push({ k: 'Beslissen', icon: 'usercheck', open: z ? `melding/${z.id}` : 'view:meldingen', lead: `${rij(verder.length, props.length > verder.length ? 'ander voorstel wacht' : 'voorstel wacht', props.length > verder.length ? 'andere voorstellen wachten' : 'voorstellen wachten')} op ${can ? 'je besluit' : 'een planner'}.`, t: `Eerst: ${kl(p.kind)} bij ${p.t ? p.t.id : p.tr ? p.tr.id : ''}, ${kl(p.kort)}.` }); }
  else {
    const los = open.filter(z => !z.who && !gebruikt.has(z.id));
    out.push(los.length ? { k: 'Beslissen', icon: 'usercheck', open: `melding/${los[0].id}`, lead: `${rij(los.length, `${props.length ? 'andere ' : ''}melding heeft`, `${props.length ? 'andere ' : ''}meldingen hebben`)} nog geen eigenaar.`, t: `Eerst: ${kl(los[0].kind)} bij ${los[0].obj}.` } : { k: 'Beslissen', icon: 'usercheck', open: 'view:meldingen', lead: props.length ? 'Niets anders wacht op een besluit.' : 'Niets wacht op een besluit.', t: '' });
  }
  // 5. de overdracht van de vorige dienst, als die er is
  const over = (ctx.store.get('sl-overdracht') || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  if (over.length) out.push({ k: 'Overdracht', icon: 'note', over: true, lead: '', t: `${over[0].length > 160 ? `${over[0].slice(0, 157).trimEnd()}…` : over[0]}${over.length > 1 ? ` (en nog ${over.length - 1})` : ''}` });
  return out;
}
const briefTitel = T => { const m = ((T % 1440) + 1440) % 1440; return m >= 240 && m < 660 ? 'Ochtendbriefing' : m >= 1080 || m < 240 ? 'Avondbriefing' : 'Briefing'; };

export function renderOverzicht(ctx, el) {
  const T = ctx.state.simTime;
  if (!el.querySelector('.ov')) {
    // twee kolommen met elk hun eigen hoogte (geen gat onder een korte kaart); smal een kolom in de volgorde aandacht,
    // vandaag, vertrekken, gebeurtenissen
    el.innerHTML = `<div class="page"><div class="page-in"><section class="card brief" aria-labelledby="ovBrief"><div class="card-h"><h2 id="ovBrief" data-ov="brieft">Briefing</h2><span class="sub" data-ov="briefsub"></span><div class="act" data-ov="briefai"></div></div><ol class="brief-l" data-ov="brief"></ol></section><div class="ov"><div class="ov-c">
      <section class="card ov-1" aria-labelledby="ovAtt"><div class="card-h"><h2 id="ovAtt">Nu aandacht nodig</h2><span class="sub" data-ov="attsub"></span><div class="act"><button class="btn ghost sm" type="button" data-open="view:meldingen">Alle meldingen${ic('arrowr', 15)}</button></div></div><div class="att" data-ov="att"></div></section>
      <section class="card ov-3" aria-labelledby="ovDep"><div class="card-h"><h2 id="ovDep">Vertrekken komend uur</h2><span class="sub" data-ov="depsub"></span><div class="act">${ctx.can('act') ? `<button class="btn sm" type="button" data-open="view:planbord" title="Ritten verslepen naar een ander voertuig of een andere tijd">${ic('gantt', 15)}Planning aanpassen</button>` : ''}<button class="btn ghost sm" type="button" data-ovdeps="1">Alle vertrekken${ic('arrowr', 15)}</button></div></div><div class="card-b flush" data-ov="dep"></div></section>
    </div><div class="ov-c">
      <section class="card ov-2" aria-labelledby="ovKpi"><div class="card-h"><h2 id="ovKpi">Vandaag</h2><span class="sub" data-ov="kpisub"></span></div><div class="kpil" data-ov="kpi"></div><div class="kpi-f" data-ov="dag"></div></section>
      <section class="card ov-4" aria-labelledby="ovLog"><div class="card-h"><h2 id="ovLog">Recente gebeurtenissen</h2><div class="act"><div class="seg" role="group" aria-label="Filter gebeurtenissen" data-ov="logf"></div></div></div><div class="feed" data-ov="log"></div></section>
    </div></div></div></div>`;
    on(el, 'click', '[data-pastoe]', (e, b) => { e.stopPropagation(); const p = ctx.voorstelById(b.dataset.pastoe); if (p) ctx.applyProposal(p); });
    on(el, 'click', '[data-neem]', (e, b) => { e.stopPropagation(); const z = ctx.Z.get(b.dataset.neem); if (z) ctx.Z.assign([z], ctx.A.settings.naam()); });
    on(el, 'click', '[data-logf]', (e, b) => { ctx.ui.logF = b.dataset.logf; renderOverzicht(ctx, el); });
    on(el, 'click', '[data-ovdeps]', () => { ctx.go('view:ritten'); const t = ctx.ui.ritTable; if (t) { t.setFilter('uur', ['60']); } });
    on(el, 'click', '[data-ovover]', () => { ctx.ui.assistTab = 'overdracht'; ctx.openPanel('assist'); });
    on(el, 'click', '[data-ovai]', () => { ctx.ui.assistTab = 'vraag'; ctx.openPanel('assist'); stuur(ctx, 'briefing'); });
  }
  const set = (k, h) => { const x = el.querySelector(`[data-ov="${k}"]`); if (x && x.dataset.h !== h) { x.innerHTML = h; x.dataset.h = h; } };

  // ---------- briefing ----------
  set('brieft', briefTitel(T)); set('briefsub', `${esc(ctx.scopeLabel())} · om ${hhmm(T)}`);
  // met data-ai op de root kan de Assistent de briefing schrijven (een klik; het antwoord staat in het paneel)
  set('briefai', aiUrl(ctx) ? `<button class="btn sm" type="button" data-ovai="1">${ic('spark', 15)}Laat de Assistent schrijven</button>` : '');
  set('brief', briefing(ctx).map(b => `<li><button class="brief-i${b.sev ? ` s-${b.sev}` : ''}" type="button" ${b.over ? 'data-ovover="1"' : `data-open="${esc(b.open)}"`}><span class="brief-k">${ic(b.icon, 16)}${esc(b.k)}</span><span class="brief-t">${b.lead ? `<b>${idsHeel(b.lead)}</b>${b.t ? ' ' : ''}` : ''}${idsHeel(b.t)}</span>${ic('chev', 16)}</button></li>`).join(''));

  // ---------- nu aandacht nodig ----------
  const open = ctx.Z.open(); const c = ctx.Z.counts(); const can = ctx.can('act');
  set('attsub', `${fmt(c.open)} open${c.verlopen ? ` · <span class="tbad">${fmt(c.verlopen)} over de deadline</span>` : ''}`);
  const MAX = 6;
  set('att', open.length ? open.slice(0, MAX).map(z => {
    const p = ctx.voorstelVoor(z.key); const cls = z.sla >= 1 ? 'bad' : z.sla >= 0.75 ? 'warn' : '';
    return `<div class="att-i ${z.sev === 'bad' ? '' : 'warn'}" role="link" tabindex="0" data-open="melding/${esc(z.id)}" aria-label="${esc(`${z.kind} ${z.obj}: ${z.text}`)}">${ic(SOORT[z.kind].icon, 18)}
      <div class="att-t"><b><span>${esc(z.kind)} · <span class="nowrap">${esc(z.obj)}</span></span> <span class="mut" style="font-weight:400">${esc(z.spn)}</span>${z.status !== 'nieuw' ? ` ${zBadge(z.status, z)}` : ''}</b><p>${esc(z.text)}</p></div>
      <div class="att-s ${cls}"><b>${durTxt(z.age)} open</b><span>norm ${z.norm} min · ${z.who ? esc(z.who) : 'niemand'}</span></div>
      <div class="att-a">${can && p ? `<button class="btn sm" type="button" data-pastoe="${esc(p.id)}" title="${esc(p.action)}">${esc(p.kort)}</button>` : can && !z.who ? `<button class="btn sm" type="button" data-neem="${esc(z.id)}">Neem op</button>` : ''}</div></div>`;
  }).join('') + (open.length > MAX ? `<div class="card-f"><button class="lnk quiet" type="button" data-open="view:meldingen">Nog ${fmt(open.length - MAX)} open meldingen</button></div>` : '')
    : empty('Niets dat nu aandacht nodig heeft', `Geen open meldingen in ${esc(ctx.scopeLabel())}. Vertragingen, rijtijd, accu, techniek, koeling en wachtende opleggers verschijnen hier vanzelf, de meest urgente bovenaan.`, '', 'okc'));

  // ---------- kerngetallen met verloop ----------
  const trucks = ctx.fleet.trucks.filter(t => ctx.inScope(t)); const trailers = ctx.fleet.trailers.filter(tr => ctx.inScopeBase(tr.base, tr.div));
  const ser = ctx.M.series(T, ctx.scopeKey(), trucks, trailers); const now = ser[ser.length - 1];
  const ago = ser.length > 2 ? ser.reduce((b, x) => Math.abs(day(T - x.T) - 60) < Math.abs(day(T - b.T) - 60) ? x : b, ser[0]) : null;
  // drie getallen: hoe gaat het (op tijd), wat loopt uit (vertraagd) en wat moet nog ingevuld (open ritten)
  const ov = openIn(ctx).filter(p => p.dag !== 'morgen'); const ovSnel = ov.filter(p => urgentie(ctx, p) < 60).length;
  const K = [
    { l: 'Op tijd', v: `${nl1(now.ontime)} %`, d: ago ? now.ontime - ago.ontime : null, unit: 'pt', good: 1, s: ser.map(x => x.ontime), sub: `${fmt(now.stops)} stops vandaag, ${fmt(now.late)} na het tijdvenster`, min: null },
    // dezelfde begrippen als de briefing en de filterbalk van de kaart: onderweg rijdt volgens plan, vertraagd rijdt
    // achter op plan, bij een klant apart; samen zijn ze alles wat niet op het terrein of in de pauze staat
    { l: 'Vertraagd', v: fmt(now.vertraagd), d: ago ? now.vertraagd - ago.vertraagd : null, good: -1, s: ser.map(x => x.vertraagd), sub: `${fmt(now.onderweg)} onderweg · ${fmt(now.klant)} bij een klant`, min: 0 },
    { l: 'Open ritten', v: fmt(ov.length), d: null, good: -1, s: [], sub: ov.length ? `${ovSnel ? `${fmt(ovSnel)} laden binnen het uur` : 'niets laadt binnen het uur'}` : 'alles van vandaag is ingevuld', min: 0, open: 'view:openritten' },
  ];
  const first = ser[0];
  set('kpisub', ser.length > 1 ? `verloop sinds ${hhmm(first.T)}, verschil met een uur geleden` : 'verloop verschijnt in de loop van de nacht');
  set('kpi', K.map(k => {
    const dv = k.d === null ? null : Math.round(k.d * (k.unit ? 10 : 1)) / (k.unit ? 10 : 1);
    const dcls = dv === null || dv === 0 || k.good === 0 ? '' : (dv > 0) === (k.good > 0) ? 'good' : 'bad';
    const dtxt = dv === null ? '' : dv === 0 ? 'gelijk' : `${dv > 0 ? '+' : '−'}${k.unit ? nl1(Math.abs(dv)) : fmt(Math.abs(dv))}${k.unit ? ' pt' : ''}`;
    const lab = k.s.length ? `${k.l}: van ${k.unit ? nl1(k.s[0]) + ' %' : fmt(k.s[0])} om ${hhmm(first.T)} naar ${k.v} nu` : k.l;
    return `<div class="kpi"><div class="kpi-l">${esc(k.l)}</div><div class="kpi-v">${k.v}${dtxt ? `<span class="kpi-d ${dcls}" title="Verschil met een uur geleden">${dtxt}</span>` : ''}</div>${k.open ? `<button class="btn sm ghost kpi-go" type="button" data-open="${k.open}">Bekijk${ic('arrowr', 14)}</button>` : sparkline(k.s, { label: lab, min: k.min })}<div class="kpi-l" style="grid-column:1">${esc(k.sub)}</div></div>`;
  }).join(''));

  // de dag in een regel, voor het werkgebied (een keer per planversie en werkgebied), en de ritten zonder voertuig in het
  // werkgebied; dezelfde voertuigen als de rest van dit scherm, niet heel Simon Loos
  const ui = ctx.ui; const dk = `${ctx.R.ver()}|${ctx.scopeKey()}`;
  if (!ui.dcCache || ui.dcCache.k !== dk) { try { ui.dcCache = { k: dk, d: dagVan(trucks) }; } catch { ui.dcCache = { k: dk, d: null }; } }
  const dg = ui.dcCache.d; const OV = openIn(ctx).filter(p => p.dag !== 'morgen'); const pl = OV.length; const snel = OV.filter(p => urgentie(ctx, p) < 60).length;
  set('dag', `${dg && dg.diensten ? `<span>De dag in ${esc(ctx.scopeLabel())}: ${fmt(dg.diensten)} diensten, mediaan ${nl1(dg.mediaanUur)} uur, ${nl1(dg.rijdenProcent)} % rijden</span>` : ''}<button class="lnk" type="button" data-open="view:openritten">${pl ? `${fmt(pl)} open ${pl === 1 ? 'rit' : 'ritten'}${snel ? `, ${fmt(snel)} binnen het uur` : ''}` : 'Geen open ritten'}${ic('arrowr', 14)}</button>`);

  // ---------- vertrekken komend uur ----------
  const sps = ctx.spsInScope(); const deps = [];
  for (const sp of sps) for (const d of ctx.fleet.departures(sp, T - 2, 60)) { if (ctx.inScope(d.t)) deps.push(d); }
  deps.sort((a, b) => a.at - b.at);
  set('depsub', `${fmt(deps.length)} in het komende uur`);
  // kolommen: op een telefoon drie, met de bestemming onder het voertuig en de aftelling onder de tijd (anders past
  // het voertuig niet en blijft er van de bestemming een paar letters over)
  const nar = ctx.narrow();
  const DC = nar ? [
    { h: 'Vertrek', w: 84, td: (d, cd) => `<td class="cd"><b>${hhmm(d.at)}</b><small class="blk">${esc(cd.text)}</small></td>` },
    { h: 'Voertuig', w: 0, td: d => `<td title="${esc(d.dest)}${d.driver ? `, ${esc(d.driver)}` : ''}">${plate(d.t.id)}<small class="dep-best">${esc(d.dest)}</small></td>` },
    { h: 'Status', w: 100, td: (d, cd) => `<td>${depBadge(cd)}</td>` },
  ] : [
    { h: 'Vertrek', w: 132, td: (d, cd) => `<td class="cd"><b>${hhmm(d.at)}</b> <small>${esc(cd.text)}</small></td>` },
    { h: 'Voertuig', w: 96, td: d => `<td title="${esc(d.driver || '')}">${plate(d.t.id)}</td>` },
    { h: 'Bestemming', w: 0, td: d => `<td title="${esc(d.dest)}${d.driver ? `, ${esc(d.driver)}` : ''}">${esc(d.dest)}</td>` },
    { h: 'Standplaats', w: 150, td: d => `<td>${esc(d.t.base.n)} <small class="mut">${d.dock ? `dock ${d.dock}` : "parkeerplek"}</small></td>` },
    { h: 'Status', w: 108, td: (d, cd) => `<td>${depBadge(cd)}</td>` },
  ];
  set('dep', deps.length ? `<div class="tv-scroll" style="max-height:330px"><table class="tbl plain compact vb deps-t${nar ? ' nar' : ''}" style="margin:0 16px;width:calc(100% - 32px)"><colgroup>${DC.map(c => `<col${c.w ? ` style="width:${c.w}px"` : ''}>`).join('')}</colgroup><thead><tr>${DC.map(c => `<th>${c.h}</th>`).join('')}</tr></thead><tbody>${deps.slice(0, 8).map(d => {
    const cd = depStatus(d, T, ctx.S); const r = ctx.R.ofTruck(d.t).find(x => Math.abs(x.dep - d.at) < 1 || Math.abs(day(x.dep - d.at)) < 1);
    return `<tr class="click ${cd.cls}" tabindex="0" role="link" data-open="${r ? `rit/${esc(r.id)}` : `kaart:truck:${esc(d.t.id)}`}" aria-label="${esc(`Vertrek ${hhmm(d.at)}, ${d.t.id} naar ${d.dest}, ${cd.status}`)}">${DC.map(c => c.td(d, cd)).join('')}</tr>`;
  }).join('')}</tbody></table></div>${deps.length > 8 ? `<div class="card-f"><button class="lnk quiet" type="button" data-ovdeps="1">Nog ${fmt(deps.length - 8)} vertrekken in het komende uur</button></div>` : ''}`
    : empty('Geen vertrekken in het komende uur', `In ${esc(ctx.scopeLabel())} vertrekt het komende uur geen voertuig. Het planbord laat de hele dag zien.`, `<button class="btn sm" type="button" data-open="view:planbord">Naar het planbord</button>`, 'clock'));

  // ---------- recente gebeurtenissen ----------
  const f = ctx.ui.logF || 'alles';
  set('logf', [['alles', 'Alles'], ['acties', 'Acties'], ['ritten', 'Ritten']].map(([k, n]) => `<button type="button" aria-pressed="${f === k}" data-logf="${k}">${n}</button>`).join(''));
  const acts = f === 'ritten' ? [] : ctx.A.acts.log.filter(x => x.T <= T + 0.01 || day(T - x.T) < 720).slice(0, 30).map(x => ({ T: x.T, act: true, html: `<b>${esc(x.who)}</b> ${esc(x.txt)}`, open: x.zaak ? `melding/${x.zaak.replace(':', '-')}` : x.rit ? `rit/${x.rit}` : x.t ? `kaart:truck:${x.t}` : '' }));
  const sys = f === 'acties' ? [] : ctx.feed.filter(x => ctx.inScope(x.t)).slice(0, 30).map(x => ({ T: x.T, sev: x.sev, html: `${plate(x.t.id)} ${esc(x.txt)}`, open: `kaart:truck:${x.t.id}` }));
  const items = [...acts, ...sys].sort((a, b) => day(T - a.T) - day(T - b.T)).slice(0, 12);
  set('log', items.length ? items.map(x => `<div class="feed-i ${x.act ? 'act' : x.sev || ''}"><time>${hhmm(x.T)}</time>${ic(x.act ? 'usercheck' : x.sev === 'bad' ? 'alert' : x.sev === 'info' ? 'pin' : 'route', 15)}<span>${x.open ? `<button class="lnk quiet" type="button" data-open="${esc(x.open)}" style="text-decoration:none;text-align:left">${x.html}</button>` : x.html}</span></div>`).join('')
    : empty(f === 'acties' ? 'Nog geen acties vandaag' : 'Nog geen gebeurtenissen', f === 'acties' ? 'Toewijzingen, statuswijzigingen, berichten en toegepaste voorstellen komen hier te staan, met wie en wanneer.' : 'Vertrekken, aankomsten en vertragingen verschijnen hier zodra de klok loopt.', '', 'activity'));
}
