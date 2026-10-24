// Weergaven: planbord, standplaatsen met vertrekbord, hal-scherm, klantweergave en de assistent.
import { SP, TOWNS, DIV, ST, laadpunten, fmt, hhmm } from './places.js';
import { KIND, TRT, TRST } from './fleet.js';
import { ic } from './icons.js';

const COL = { drive: '#16A34A', stop: '#2563EB', pauze: '#9CA3AF', laden: '#0E7490', terrein: '#C9CFD8', koppel: '#6B7280', ontkoppel: '#6B7280' };
const fmtDrive = m => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const nl1 = v => v.toFixed(1).replace('.', ',');

// ---------- planbord ----------
export function renderPlanbord(ctx) {
  const { fleet, state, S, esc, $ } = ctx; const sp = ctx.pbSp(); const T = state.simTime; const sel = ctx.selTruck(); const PF = ctx.pbF;
  const all = fleet.trucks.filter(t => t.base === sp);
  const divs = [...new Set(all.map(t => t.div))], kinds = [...new Set(all.map(t => t.kind))];
  if (PF.div !== 'alle' && !divs.includes(PF.div)) PF.div = 'alle'; if (PF.kind !== 'alle' && !kinds.includes(PF.kind)) PF.kind = 'alle';
  const rows = all.filter(t => (PF.div === 'alle' || t.div === PF.div) && (PF.kind === 'alle' || t.kind === PF.kind)).sort((a, b) => (a.vandaag === 'inzet' ? 0 : 1) - (b.vandaag === 'inzet' ? 0 : 1) || a.dayStart - b.dayStart || a.id.localeCompare(b.id));
  const W0 = Math.floor((T - 180) / 60) * 60, SPAN = 14 * 60, PX = 1020 / SPAN;
  const pct = m => ((m - W0) / SPAN * 100).toFixed(3) + '%';
  const body = rows.map(t => {
    const s = S.get(t.id); const bl = [];
    for (const b of fleet.blocks(t)) { if (b.k === 'terrein' && b.b - b.a <= 20) continue; for (const off of [-1440, 0, 1440]) { const x = Math.max(b.a + off, W0), y = Math.min(b.b + off, W0 + SPAN); if (y - x > 0.5) bl.push({ ...b, x, y }); } }
    const who = t.diensten.length ? t.diensten.map(d => `<span class="${s && s.dienst === d ? 'cur' : ''}">${esc(d.person ? d.person.short : d.driver)} <small>${hhmm(d.start)}${d.shifted ? ` <em title="opgeschoven door de planner">+${d.shifted}</em>` : ''}</small></span>`).join('') : `<span class="mut">${t.vandaag === 'onderhoud' ? 'werkplaats' : 'reserve, niet ingepland'}</span>`;
    return `<div class="prow ${sel === t ? 'sel' : ''} ${t.vandaag !== 'inzet' ? 'idle' : ''}" data-truck="${t.id}"><div class="who"><span class="plate">${t.id}</span><div><b>${who}</b><span>${KIND[t.kind].n} · ${esc(t.model.replace('Mercedes-Benz ', 'MB '))}${s && s.tr ? ` · ${s.tr.id}` : ''}${t.replaces ? ` · voor ${t.replaces.t.id}` : ''}</span></div><i class="dot" style="background:${s ? ST[s.st].color : '#999'}"></i></div><div class="lane">${bl.map(b => { const w = (b.y - b.x) * PX; const label = b.k === 'drive' || b.k === 'stop' ? b.label : b.k === 'pauze' ? 'Pauze' : b.k === 'laden' ? 'Laden' : b.k === 'koppel' ? 'Koppelen' : b.k === 'ontkoppel' ? 'Afkoppelen' : 'Terrein'; return `<div class="blk ${b.k} ${b.delay ? 'late' : ''} ${b.swap ? 'swap' : ''} ${b.ingevoegd ? 'ingevoegd' : ''}" data-a="${b.x.toFixed(1)}" style="left:${pct(b.x)};width:${((b.y - b.x) / SPAN * 100).toFixed(3)}%;--c:${COL[b.k]}" title="${esc(b.label)} ${hhmm(b.a)}–${hhmm(b.b)}${b.delay ? ` · +${b.delay} min` : ''}${b.swap ? ` · ${b.swap.drop.id} blijft achter${b.swap.take ? `, ${b.swap.take.id} mee` : ''}` : ''}${b.tr && b.k === 'drive' ? ` · ${b.tr.id}` : ''}${b.ingevoegd ? ' · ingepland door de planner' : ''} · klik: tijdlijn naar ${hhmm(b.x)}">${w > 46 ? `<b>${esc(label)}</b><small>${hhmm(b.a)}–${hhmm(b.b)}</small>` : ''}${b.swap && w > 30 ? `<em class="sw" title="oplegger wisselen">${ic('swap', 10)}</em>` : b.delay && w > 120 ? `<em>+${b.delay}</em>` : ''}</div>`; }).join('')}</div></div>`;
  }).join('');
  const hours = []; for (let h = W0; h <= W0 + SPAN; h += 60) hours.push(h);
  const inzet = rows.filter(t => t.vandaag === 'inzet').length; const diensten = rows.reduce((a, t) => a + t.diensten.length, 0);
  $('v-planbord').innerHTML = `<div class="vhead"><label class="dd"><small>Standplaats</small><select id="pbSel">${SP.slice().sort((a, b) => a.n.localeCompare(b.n)).map(s => `<option ${s === sp ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label><label class="dd"><small>Divisie</small><select id="pbDiv"><option value="alle">Alle</option>${divs.map(d => `<option value="${d}" ${PF.div === d ? 'selected' : ''}>${esc(DIV[d].n)}</option>`).join('')}</select></label><label class="dd"><small>Soort</small><select id="pbKind"><option value="alle">Alle</option>${kinds.map(k => `<option value="${k}" ${PF.kind === k ? 'selected' : ''}>${KIND[k].n}s</option>`).join('').replace('Bestelbuss<', 'Bestelbussen<')}</select></label><span class="dd"><small>Dag</small><b>vandaag · ${hhmm(T)}</b></span><span class="pill">${inzet} van ${rows.length} voertuigen ingezet · ${diensten} diensten${rows.length < all.length ? ` · ${all.length - rows.length} verborgen door het filter` : ''}</span>
      <div class="legend2">${[['drive', 'Rijden'], ['stop', 'Bij klant'], ['koppel', 'Koppelen'], ['pauze', 'Pauze'], ['laden', 'Laden'], ['terrein', 'Terrein']].map(([k, n]) => `<span><i style="background:${COL[k]}"></i>${n}</span>`).join('')}<span>${ic('swap', 11)} oplegger wisselen</span><span><i class="ingevoegd"></i>door de planner ingepland</span></div></div>
    <div class="gantt"><div class="ginner"><div class="ghead"><div class="who"><b>Voertuig en chauffeurs</b><span>${rows.length}</span></div><div class="lane hd">${hours.map(h => `<i style="left:${pct(h)}"><span>${hhmm(h)}</span></i>`).join('')}</div></div><div class="gbody" data-w0="${W0}" data-span="${SPAN}">${body || '<div class="empty">Geen voertuigen binnen dit filter.</div>'}<div class="nowline" style="left:calc(var(--who) + (100% - var(--who)) * ${((T - W0) / SPAN).toFixed(4)})"><span>${hhmm(T)}</span></div></div></div></div>`;
  $('pbSel').onchange = e => { ctx.setPbSp(SP.find(s => s.n === e.target.value)); renderPlanbord(ctx); };
  $('pbDiv').onchange = e => { PF.div = e.target.value; renderPlanbord(ctx); };
  $('pbKind').onchange = e => { PF.kind = e.target.value; renderPlanbord(ctx); };
  $('v-planbord').querySelectorAll('[data-truck]').forEach(el => el.addEventListener('click', () => ctx.selectTruck(el.dataset.truck, { stay: true })));
  // klik op een blok: dat voertuig selecteren en de tijdlijn op het begin van het blok zetten
  $('v-planbord').querySelectorAll('.blk[data-a]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const row = b.closest('[data-truck]'); state.simTime = ((+b.dataset.a + 0.5) % 1440 + 1440) % 1440; if (row) ctx.selectTruck(row.dataset.truck, { stay: true }); ctx.frame(true); }));
}

// ---------- standplaatsen en vertrekbord ----------
export function renderSpView(ctx) {
  const { fleet, state, S, TRS, esc, $, people } = ctx; const T = state.simTime; const pb = ctx.pbSp();
  const rows = SP.slice().sort((a, b) => b.fleet - a.fleet).map(sp => {
    const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; let inzet = 0; for (const t of fleet.trucks) { if (t.base !== sp) continue; const s = S.get(t.id); if (s) c[s.st]++; if (t.vandaag === 'inzet') inzet++; }
    const trs = fleet.trailersOf(sp); let los = 0; for (const tr of trs) { const s = TRS.get(tr.id); if (s && s.st !== 'gekoppeld' && s.st !== 'onderhoud') los++; }
    const ex = ctx.exceptions().filter(e => (e.tr ? e.tr.base : e.t.base) === sp).length; const st = people.spStats.get(sp.n); return { sp, c, ex, st, inzet, trs: trs.length, los };
  });
  const deps = fleet.departures(pb, T - 5, 155).slice(0, 12);
  $('v-standplaatsen').innerHTML = `<div class="spgrid"><div class="sptable"><div class="vhead"><h3>Standplaatsen <small>${SP.length} · ${fmt(fleet.trucks.length)} voertuigen · ${fmt(fleet.trailers.length)} opleggers</small></h3><span class="hintline">Los: opleggers die nu niet achter een trekker hangen (op het terrein, bij een DC of bij een winkel). Chauffeurs per wagen: hoeveel verschillende chauffeurs een voertuig per week rijden.</span></div>
      <table><thead><tr><th>Standplaats</th><th>Regio</th><th class="opt">Klant</th><th class="r">Voertuigen</th><th class="r opt">Ingezet</th><th class="r">Onderweg</th><th class="r">Uitz.</th><th class="r">Opleggers</th><th class="r">Los</th><th class="r opt">Chauff./wagen/wk</th></tr></thead><tbody>${rows.map(({ sp, c, ex, st, inzet, trs, los }) => `<tr class="${sp === pb ? 'sel' : ''}" data-sp="${esc(sp.n)}"><td><b>${esc(sp.n)}</b>${sp.hub ? ' <small>hoofdkantoor</small>' : ''}</td><td>${esc(sp.regio)}</td><td class="opt">${esc(sp.klant)}</td><td class="r">${sp.fleet}</td><td class="r opt">${inzet}</td><td class="r">${c.onderweg + c.vertraagd}</td><td class="r ${ex ? 'bad' : ''}">${ex}</td><td class="r">${trs || '–'}</td><td class="r">${trs ? los : '–'}</td><td class="r opt">${st.wissel.toString().replace('.', ',')}</td></tr>`).join('')}</tbody></table></div>
      <div class="hal"><div class="halhead"><span class="prod">Vertrekbord</span><h3>${esc(pb.n)}</h3><b>${hhmm(T)}</b></div><div class="halrows">${deps.map(d => { const cd = countdown(d, T, S); return `<div class="halrow ${cd.cls}" data-truck="${d.t.id}"><time>${hhmm(d.at)}<small>${cd.text}</small></time><b>${d.t.id}${d.tr ? `<small> + ${d.tr.id}</small>` : ''}</b><span class="drv">${esc(d.driver)}</span><span class="dest">${esc(d.dest)}</span><em>Dock ${d.dock}</em><i class="${cd.cls}">${cd.status}</i></div>`; }).join('') || '<div class="empty">Geen vertrekken in de komende 2,5 uur.</div>'}</div>
      <div class="halfoot"><button class="btn" data-hal="${esc(pb.n)}">${ic('tv', 15)} Open als hal-scherm</button><button class="btn" data-pb="${esc(pb.n)}">${ic('cal', 15)} Planbord</button></div></div></div>`;
  $('v-standplaatsen').querySelectorAll('tr[data-sp]').forEach(el => el.addEventListener('click', () => { ctx.setPbSp(SP.find(s => s.n === el.dataset.sp)); renderSpView(ctx); }));
  $('v-standplaatsen').querySelectorAll('[data-truck]').forEach(el => el.addEventListener('click', () => ctx.selectTruck(el.dataset.truck, { stay: true })));
  const h = $('v-standplaatsen').querySelector('[data-hal]'); if (h) h.onclick = () => { ctx.hashTo('#hal/' + encodeURIComponent(h.dataset.hal)); ctx.fullscreen(); };
  const p = $('v-standplaatsen').querySelector('[data-pb]'); if (p) p.onclick = () => ctx.setView('planbord');
}

// ---------- hal-scherm (tv in de loods) ----------
// Aftelling per vertrek, meelopend met de klok; vertrokken rijen blijven vijf minuten staan en verdwijnen dan.
function countdown(d, T, S) {
  const dt = d.at - T; const st = S.get(d.t.id);
  if (dt < -1) { const late = st && st.st === 'terrein'; return late ? { cls: 'late', text: `te laat +${Math.round(-dt)}`, status: 'Te laat' } : { cls: 'gone', text: 'vertrokken', status: 'Vertrokken' }; }
  if (dt <= 1) return { cls: 'now', text: 'nu', status: 'Vertrekt' };
  return { cls: dt < 15 ? 'soon' : '', text: `over ${Math.round(dt)} min`, status: dt < 15 ? 'Laden' : dt < 45 ? 'Klaarzetten' : 'Gepland' };
}
export function renderHal(ctx, spName) {
  const { fleet, state, esc, $, S } = ctx; const sp = SP.find(s => s.n === spName) || SP[0]; const T = state.simTime;
  const deps = fleet.departures(sp, T - 5, 185).slice(0, 14);
  const now = new Date(); const date = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  $('hal').innerHTML = `<div class="halbar"><div><span class="prod">Simon Loos · vertrekbord</span><h2>${esc(sp.n)}</h2></div><div class="halclock"><b>${hhmm(T)}</b><span>${esc(date)}</span></div><button class="btn ghost" id="halClose">${ic('x', 16)} Sluiten</button></div>
    <div class="halgrid"><div class="halcols"><span>Vertrek</span><span>Voertuig</span><span>Oplegger</span><span>Chauffeur</span><span>Bestemming</span><span>Dock</span><span>Status</span></div>${deps.map(d => { const cd = countdown(d, T, S); return `<div class="halline ${cd.cls}"><time>${hhmm(d.at)}<small>${cd.text}</small></time><b>${d.t.id}</b><span class="trl">${d.tr ? d.tr.id : d.t.kind === 'trekker' ? 'solo' : '–'}</span><span>${esc(d.driver)}</span><span class="dest">${esc(d.dest)}</span><em>${d.dock}</em><i>${cd.status}</i></div>`; }).join('') || '<div class="empty big">Geen vertrekken in de komende drie uur.</div>'}</div>
    <div class="halnote">Zelfde data als de control tower · ververst elke seconde · ${fleet.trucks.filter(t => t.base === sp).length} voertuigen en ${fleet.trailersOf(sp).length} opleggers op deze standplaats</div>`;
  $('halClose').onclick = () => ctx.hashTo('');
}

// ---------- klantweergave (deelbare link per winkel) ----------
export function renderKlant(ctx, truckId) {
  const { fleet, state, esc, $ } = ctx; const t = fleet.byId.get(truckId); const el = $('klant');
  if (!t) { el.innerHTML = `<div class="kcard"><h2>Onbekende rit</h2><p>Deze link verwijst naar een voertuig dat niet (meer) bestaat.</p><button class="btn pri" id="kClose">Naar de control tower</button></div>`; $('kClose').onclick = () => ctx.hashTo(''); return; }
  const s = fleet.stateAt(t, state.simTime); const nx = s.next; const stops = t.plan.filter(x => x.k === 'stop'); const done = stops.filter(x => x.t1 <= s.rel).length;
  const late = nx && nx.win && nx.eta > nx.win[1]; const trs = s.tr ? ctx.trailerState(s.tr) : null;
  el.innerHTML = `<div class="kcard"><div class="khead"><span class="prod">Simon Loos · uw levering</span><button class="btn ghost sm" id="kClose">${ic('x', 14)} Sluiten</button></div>
    <h2>${esc(nx && !nx.home ? nx.name : 'Rit afgerond')}</h2>
    <div class="kstat ${late ? 'bad' : s.st === 'klant' ? 'ok' : ''}">${s.st === 'klant' ? 'De wagen staat bij u' : nx && !nx.home ? (late ? `Verwacht ${hhmm(nx.eta)}, ${nx.delay} min later dan gepland` : `Verwacht ${hhmm(nx.eta)}${nx.win ? `, binnen het venster tot ${hhmm(nx.win[1])}` : ''}`) : 'Alle stops van vandaag zijn gedaan'}</div>
    <dl><dt>Voertuig</dt><dd>${t.id} · ${esc(t.model)}${s.tr ? `<br>oplegger ${s.tr.id} · ${esc(TRT[s.tr.type].n.toLowerCase())}` : ''}</dd><dt>Chauffeur</dt><dd>${esc((s.driver || 'onbekend').split(' ')[0])}</dd><dt>Nog te rijden</dt><dd>${nx ? `${nx.kmLeft.toFixed(1).replace('.', ',')} km` : '–'}</dd><dt>Lading</dt><dd>${esc((trs && trs.lading) || t.lading || 'volgens afspraak')}</dd><dt>Stops vandaag</dt><dd>${done} van ${stops.length} gedaan</dd><dt>Laatste update</dt><dd>${hhmm(state.simTime)}</dd></dl>
    <p class="small">Deze link toont alleen dit voertuig en deze levering. De kaart achter dit venster volgt het voertuig live. Vragen: bel de planning van ${esc(t.base.n)}.</p></div>`;
  $('kClose').onclick = () => ctx.hashTo('');
}

// ---------- assistent ----------
export function renderAssist(ctx) {
  const { fleet, state, S, esc, $, store, rest } = ctx; const el = $('v-assistent'); if (!el) return; const T = state.simTime;
  const props = proposals(ctx); const over = store.get('sl-overdracht') || '';
  el.innerHTML = `<div class="acol">
      <div class="acard"><h3>Voorstellen <b>${props.length}</b></h3>
        <div class="kline">${ctx.applied.length} vandaag toegepast · ${props.length} wachten op akkoord · ${ctx.msgCount()} berichten naar chauffeurs</div>
        ${props.length ? props.map(p => `<div class="prop ${p.sev}"><i></i><div><b>${esc(p.title)}</b><span>${esc(p.kind)}</span><p>${esc(p.action)}</p><details class="why"><summary>Waarom</summary><div>${esc(p.why)}</div></details></div><button class="btn pri sm" data-apply="${p.id}">Pas toe</button></div>`).join('') : '<div class="empty">Geen open voorstellen. De assistent kijkt elke seconde opnieuw naar tijdvensters, rijtijden, accu\'s, koeling, losse opleggers en storingen.</div>'}
        ${ctx.applied.length ? `<h4 class="sub">Afgehandeld <small>laatste ${Math.min(ctx.applied.length, 6)}</small></h4>${ctx.applied.slice(-6).reverse().map(a => `<div class="prop done ${a.sev}"><i></i><div><b>${esc(a.title)}</b><span>${hhmm(a.T)}</span><p>${esc(a.action)}</p></div></div>`).join('')}` : ''}
        <div class="hint">In de echte versie rekent de optimizer elke vijf minuten alle ritten opnieuw door met de live ETA's en de opleggerposities; de assistent legt per voorstel uit waarom, en de planner keurt goed met één klik.</div>
      </div>
      <div class="acard"><h3>Vraag het de assistent</h3>
        <div class="chat" id="chatBox">${ctx.chat.length ? ctx.chat.map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)}</time></div>`).join('') : '<div class="empty">Stel een vraag in gewone taal over de live situatie.</div>'}</div>
        <div class="ask"><input id="askIn" placeholder="Bijvoorbeeld: welke opleggers staan leeg bij een winkel?" autocomplete="off"><button class="btn pri sm" id="askBtn">Vraag</button></div>
        <div class="sugg">${['Welke voertuigen halen hun tijdvenster niet?', 'Welke opleggers staan leeg bij een winkel?', 'Hoeveel eActros laden nu?', 'Wie zit bijna op zijn rijtijd?', 'Wat doet Wognum?', 'Wie rijdt er naar Hoorn?'].map(q => `<button class="chip sm" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      </div>
    </div>
    <div class="acol">
      <div class="acard"><h3>Collega's op dienst</h3>
        ${ctx.COLLEGAS.map(([n, sp, role, a, b]) => { const on = T >= a && T < b; return `<div class="col"><span class="av ${on ? 'on' : ''}">${esc(n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(n)}</b><span>${esc(role)} · ${esc(sp)} · ${hhmm(a)}–${hhmm(b)}</span></div><em class="${on ? 'on' : ''}">${on ? 'op dienst' : 'buiten dienst'}</em></div>`; }).join('')}
        <h4 class="sub">Overdracht naar de volgende dienst</h4>
        <textarea id="overIn" class="over" placeholder="Wat moet de volgende planner weten?">${esc(over)}</textarea>
      </div>
      <div class="acard"><h3>Berichten met chauffeurs <b>${ctx.msgCount()}</b></h3>
        ${(() => { const L = fleet.trucks.filter(t => t.msgs && t.msgs.length).slice(-6).reverse(); return L.length ? L.map(t => { const m = t.msgs[t.msgs.length - 1]; const dn = ctx.driverName(t) || t.id; return `<div class="col" data-truck="${t.id}"><span class="av">${esc(dn.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(dn)} · ${t.id}</b><span>${esc(m.text)}</span></div><em>${hhmm(m.T)}</em></div>`; }).join('') : '<div class="empty">Nog geen berichten. Open een voertuig en stuur een bericht, of pas een voorstel toe.</div>'; })()}
        <div class="hint">Berichten worden in de cabine voorgelezen; de chauffeur antwoordt met één knop.</div>
      </div>
    </div>`;
  el.querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => { const p = props.find(x => x.id === b.dataset.apply); if (p) ctx.applyProposal(p); }));
  el.querySelectorAll('[data-truck]').forEach(x => x.addEventListener('click', () => ctx.selectTruck(x.dataset.truck)));
  const ask = () => { const v = $('askIn').value.trim(); if (!v) return; ctx.chat.push({ me: true, text: v, T: state.simTime }); ctx.chat.push({ me: false, text: answer(ctx, v), T: state.simTime }); if (ctx.chat.length > 12) ctx.chat.splice(0, ctx.chat.length - 12); renderAssist(ctx); const box = $('chatBox'); if (box) box.scrollTop = box.scrollHeight; };
  $('askBtn').onclick = ask; $('askIn').addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
  el.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => { $('askIn').value = b.dataset.ask; ask(); }));
  $('overIn').addEventListener('input', e => store.set('sl-overdracht', e.target.value));
}

function nearestSp(pos, minLp = 12) { let best = null, bd = Infinity; for (const sp of SP) { if (laadpunten(sp) < minLp) continue; const d = Math.hypot((sp.lon - pos.lon) * 68, (sp.lat - pos.lat) * 111); if (d < bd) { bd = d; best = sp; } } return { sp: best, km: Math.round(bd) }; }
const kmBetween = (a, b) => Math.hypot((a.lon - b.lon) * 68, (a.lat - b.lat) * 111);
// Elk voorstel heeft een actie (act) die de planning echt aanpast (ui.runAction, bewaard in sl-acties) en een bericht
// aan de chauffeur (msg, met het resultaat van de actie). Geen toeval hier: vaste keuzes, zodat een herlaad hetzelfde geeft.
export function proposals(ctx) {
  const { fleet, state, S, TRS, rest, people } = ctx; const out = []; const T = state.simTime; const used = new Set();
  for (const e of ctx.openExceptions().slice(0, 16)) {
    if (e.tr) {
      const tr = e.tr; const ts = TRS.get(tr.id);
      if (e.kind === 'Oplegger' && ts) {
        // een trekker die solo terugrijdt naar dezelfde standplaats en dichtbij is, haalt de lege oplegger op
        let helper = null, hd = Infinity; for (const t of fleet.trucks) { if (t.base !== tr.base || t.kind !== 'trekker' || used.has(t)) continue; const s = S.get(t.id); if (!s || !s.solo || !s.next || !s.next.home) continue; const d = kmBetween(s.pos, ts.pos); if (d < hd) { hd = d; helper = t; } }
        const reserve = !helper && fleet.trucks.find(t => t.base === tr.base && t.kind === 'trekker' && t.vandaag === 'reserve' && !used.has(t));
        const freeP = reserve ? people.persons.find(p => p.base === tr.base && !p.dienst && p.div !== 'bezorg') : null;
        const who = helper || (reserve && freeP ? reserve : null); if (!who) continue; used.add(who);
        out.push({ id: 'o' + tr.id, sev: 'warn', kind: 'Oplegger', t: who, tr, title: `${tr.id} staat leeg bij ${ts.place} (ophalen gepland ${hhmm(ts.pickup)})`, action: helper ? `${helper.id} (${ctx.driverName(helper)}) rijdt solo terug naar ${tr.base.n} en haalt ${tr.id} op, ${Math.round(hd)} km van zijn route; zijn dagplan en de ETA thuis schuiven mee.` : `Reservetrekker ${reserve.id} met ${freeP.name} (vrij, pool ${tr.base.n}) haalt ${tr.id} op en zet hem op het terrein.`, why: helper ? 'Een solo-rit terug is lege kilometers; met de oplegger mee is de rit nuttig en staat de winkel niet nog een dag met een oplegger.' : 'Geen solo-trekker in de buurt; de reserve staat stil op het terrein.', act: { k: 'ophalen', t: who.id, tr: tr.id, person: helper ? null : freeP.id }, msg: r => [who, `Planning: haal ${tr.id} op bij ${ts.place} (leeg) en neem hem mee naar ${tr.base.n}${r ? `; aankomst daar rond ${hhmm(r.end)}` : ''}. Je dagplan is aangepast.`] });
      } else if (e.kind === 'Koeling' && ts) {
        const veh = ts.vehicle; const { sp, km } = nearestSp(ts.pos, 4);
        out.push({ id: 'k' + tr.id, sev: 'bad', kind: 'Koeling', t: veh || null, tr, title: `${tr.id}: koelunit buiten bereik (${nl1(fleet.trailerTemp(tr, T))} °C)`, action: veh ? `${ctx.driverName(veh)} herstart de koelunit; lukt dat niet binnen 15 min, dan lossen bij ${sp.n} (${km} km) en lading overzetten. Werkorder voor de koelunit.` : `Lading overzetten bij ${ts.place}; werkorder voor de koelunit.`, why: 'Diepvries boven -18 °C mag niet geleverd worden; snel handelen voorkomt afkeur van de lading.', act: { k: 'koeling', tr: tr.id }, msg: () => veh ? [veh, `Planning: herstart de koelunit van ${tr.id}. Niet binnen 15 min onder -18 °C? Rij naar ${sp.n} om te lossen. Werkorder is aangemaakt.`] : null });
      }
      continue;
    }
    const t = e.t, s = S.get(t.id); if (!s) continue;
    if (e.kind === 'Vertraging' && s.next && s.next.home) {
      const v = s.next.volgende; if (!v) continue; const shift = Math.max(5, Math.round((s.next.eta - v.start + 10) / 5) * 5);
      out.push({ id: 'v' + t.id, sev: 'warn', kind: 'Vertraging', t, title: `${t.id} is ${s.next.delay} min later terug op ${t.base.n} (ETA ${hhmm(s.next.eta)})`, action: `Dienst ${v.i + 1} van ${v.driver} (${hhmm(v.start)}) schuift ${shift} min op naar ${hhmm(v.start + shift)}; ${v.driver} krijgt een bericht en de eerste stop van die dienst een nieuwe ETA.`, why: 'Dezelfde trekker rijdt de volgende dienst; wachten op het terrein is beter dan een andere wagen klaarzetten.', act: { k: 'schuif', t: t.id, d: v.i, min: shift }, msg: () => [t, `Planning: ${v.driver} weet dat je ${s.next.delay} min later terug bent; dienst ${v.i + 1} begint nu om ${hhmm(v.start + shift)}.`] });
    } else if (e.kind === 'Vertraging' && s.next) {
      const helper = fleet.trucks.find(h => h.base === t.base && h !== t && h.kind === t.kind && !h.helping && !used.has(h) && (S.get(h.id) || {}).st === 'terrein' && (S.get(h.id) || {}).dienst && (S.get(h.id).dienst.end - T) > 90);
      const reserve = !helper && fleet.trucks.find(h => h.base === t.base && h !== t && h.kind === t.kind && !h.helping && !used.has(h) && h.vandaag === 'reserve');
      if (helper) used.add(helper); if (reserve) used.add(reserve);
      const freeDriver = reserve && people.persons.find(p => p.base === t.base && !p.dienst && (t.kind === 'bus' ? p.div === 'bezorg' : p.div !== 'bezorg'));
      const who = helper || (reserve && freeDriver ? reserve : null);
      out.push({ id: 'v' + t.id, sev: 'bad', kind: 'Vertraging', t, title: `${t.id} haalt ${s.next.name} niet (ETA ${hhmm(s.next.eta)}, +${s.next.delay} min)`, action: who ? (helper ? `${helper.id} (${ctx.driverName(helper)}, op het terrein in ${t.base.n}) neemt de resterende stops over; ${t.id} rijdt na ${s.next.name} terug.` : `Reservewagen ${reserve.id} met ${freeDriver.name} (vrij, pool ${t.base.n}) neemt de resterende stops over.`) : `Klant ${s.next.name} krijgt automatisch de nieuwe ETA ${hhmm(s.next.eta)} en een volg-link; het tijdvenster wordt bijgesteld, de planner hoeft niet te bellen.`, why: helper ? `${helper.id} heeft nog ${((S.get(helper.id).dienst.end - T) / 60).toFixed(1).replace('.', ',')} uur dienst en staat naast de lading.` : who ? 'De reservewagen staat stil en er is een chauffeur beschikbaar in de pool.' : 'Geen vrij voertuig met chauffeur op de standplaats; informeren is dan de beste stap.', act: { k: 'eta', t: t.id, helper: who ? who.id : null }, msg: () => [t, who ? `Planning: ${who.id} neemt je resterende stops over na ${s.next.name}. Rij daarna terug naar ${t.base.n}.` : `Planning: klant ${s.next.name} is geinformeerd over je nieuwe ETA ${hhmm(s.next.eta)}; het tijdvenster is bijgesteld.`] });
    } else if (e.kind === 'Rijtijd') {
      const near = rest.nearest(s.pos, 45); const pl = near && near.place; const amen = pl ? [pl.douche ? 'douche' : null, pl.eten !== 'geen' ? pl.eten : null, pl.beveiligd ? 'beveiligd' : null].filter(Boolean).join(', ') : '';
      const fits = !(s.next && s.next.win) || s.next.eta + 45 <= s.next.win[1]; const venster = fits ? 'het tijdvenster van de volgende stop blijft haalbaar' : `de volgende stop (${s.next.name}) wordt 45 min later; de klant krijgt de nieuwe ETA`;
      out.push({ id: 'r' + t.id, sev: 'warn', kind: 'Rijtijd', t, title: `${s.driver} (${t.id}) zit op ${fmtDrive(s.drive)} rijtijd`, action: pl ? `Pauze van 45 min bij ${pl.n} (${rest.score(pl).toString().replace('.', ',')}★ van ${pl.count} chauffeurs${amen ? ', ' + amen : ''}), ${near.km} km verderop; ${venster}.` : `Pauze van 45 min binnen 8 km inplannen; ${venster}.`, why: pl ? 'Een beoordeelde pauzeplek op de route kost geen omweg en geeft een echte pauze.' : 'Een pauze op tijd voorkomt een rijtijdovertreding en een boete.', act: { k: 'pauze', t: t.id, place: pl ? pl.id : null }, msg: r => [t, pl ? `Planning: neem je pauze van 45 min bij ${pl.n} (${near.km} km verderop, ${amen || 'parkeren'})${r ? `, gepland om ${hhmm(r.at)}` : ''}. Je dagplan is aangepast.` : `Planning: neem je pauze van 45 min op de eerstvolgende parkeerplaats${r ? ` (gepland om ${hhmm(r.at)})` : ''}. Je dagplan is aangepast.`] });
    } else if (e.kind === 'Accu') {
      const { sp, km } = nearestSp(s.pos);
      out.push({ id: 'a' + t.id, sev: 'warn', kind: 'Accu', t, title: `${t.id} heeft ${Math.round(s.soc)} % accu (${Math.round(t.range * s.soc / 100)} km)`, action: sp ? `25 min snelladen bij ${sp.n} (${laadpunten(sp)} laadpunten, ${km} km van de route); laadpunt wordt gereserveerd en het dagplan schuift 25 min op.` : 'Terug naar de standplaats om te laden.', why: 'Het bereik is te krap voor de terugrit; laden onderweg kost minder dan slepen.', act: { k: 'laden', t: t.id, sp: sp ? sp.n : null }, msg: r => [t, `Planning: laad 25 min bij ${sp ? sp.n : t.base.n}${r ? ` om ${hhmm(r.at)}` : ''}, laadpunt ${1 + (t.idx % 6)} is gereserveerd. Je dagplan is aangepast.`] });
    } else if (e.kind === 'Techniek') {
      const nextD = t.diensten.find(d => d !== s.dienst && d.start > T + 30) || null;
      const reserve = nextD ? fleet.trucks.find(h => h.base === t.base && h !== t && h.kind === t.kind && h.vandaag === 'reserve' && !used.has(h)) || null : null; if (reserve) used.add(reserve);
      const garage = t.base.hub ? 'Wognum' : 'Opmeer'; const endD = s.dienst ? s.dienst.end : t.dayStart + t.shiftEnd; const gepland = `na de dienst (${hhmm(endD)}) in garage ${garage}`;
      out.push({ id: 't' + t.id, sev: 'bad', kind: 'Techniek', t, title: `${t.id}: ${t.storing}`, action: `Werkorder in de garage ${garage} na de dienst (${hhmm(endD)})${reserve ? `; dienst ${nextD.i + 1} van ${nextD.driver} (${hhmm(nextD.start)}) gaat naar reservevoertuig ${reserve.id}` : nextD ? '; voor de volgende dienst is geen reservevoertuig vrij' : ''}.`, why: 'De rit kan veilig worden afgemaakt; de storing moet vandaag nog bekeken worden.', act: { k: 'werkorder', t: t.id, gepland, reserve: reserve ? reserve.id : null, dienst: nextD ? nextD.i : null }, msg: () => [t, `Planning: werkorder aangemaakt voor "${t.storing}". Na je dienst naar de garage ${garage}${reserve ? `; ${nextD.driver} rijdt dienst ${nextD.i + 1} met ${reserve.id}` : ''}.`] });
    }
  }
  return out;
}
export function answer(ctx, q) {
  const { fleet, S, TRS } = ctx; const ql = q.toLowerCase(); const vis = fleet.trucks.filter(t => ctx.inScope(t));
  const ex = ctx.exceptions(); const counts = ctx.counts(); const kpi = ctx.kpi();
  const tr = fleet.trailers.find(x => ql.includes(x.id.toLowerCase()) || ql.includes(x.plate.toLowerCase()));
  if (tr) { const s = TRS.get(tr.id) || fleet.trailerStateAt(tr, ctx.state.simTime); const temp = fleet.trailerTemp(tr, ctx.state.simTime); return `${tr.id} (${TRT[tr.type].n.toLowerCase()}, standplaats ${tr.base.n}): ${TRST[s.st].n.toLowerCase()}${s.vehicle ? ` achter ${s.vehicle.id} (${ctx.driverName(s.vehicle)})` : s.place ? ` bij ${s.place}` : ''}${s.lading ? `, lading: ${s.lading}` : ', leeg'}${temp !== null ? `, ${nl1(temp)} °C` : ''}.`; }
  const truck = fleet.trucks.find(t => ql.includes(t.id.toLowerCase())) || fleet.trucks.find(t => t.diensten.some(d => ql.includes(d.driver.toLowerCase())));
  if (truck) { const s = S.get(truck.id) || fleet.stateAt(truck, ctx.state.simTime); return `${truck.id} (${KIND[truck.kind].n.toLowerCase()}, ${truck.model}, standplaats ${truck.base.n}): ${ST[s.st].n.toLowerCase()}${s.driver ? `, chauffeur ${s.driver} tot ${hhmm(s.dienst.end)}` : ', geen chauffeur op dit moment'}${s.tr ? `, oplegger ${s.tr.id}` : s.solo ? ', solo' : ''}${s.next ? `, volgende stop ${s.next.name} om ${hhmm(s.next.eta)}${s.next.delay ? ` (+${s.next.delay} min)` : ''}` : ''}, ${truck.ev ? 'accu' : 'brandstof'} ${Math.round(s.soc)} %, rijtijd ${fmtDrive(s.drive)}.`; }
  if (/oplegger|los|leeg|trailer/.test(ql)) { const L = fleet.trailers.filter(x => ctx.inScopeBase(x.base, x.div)).map(x => [x, TRS.get(x.id)]).filter(([, s]) => s); const late = L.filter(([, s]) => s.late); const c = { gekoppeld: 0, geladen: 0, wacht: 0, ophalen: 0, leeg: 0, klaar: 0, onderhoud: 0 }; for (const [, s] of L) c[s.st]++; return `${L.length} opleggers in je werkgebied: ${c.gekoppeld} gekoppeld, ${c.klaar} klaar voor vertrek op het terrein, ${c.leeg} leeg op het terrein, ${c.geladen} geladen bij een klant, ${c.wacht} leeg bij een winkel of DC (wachten op ophalen)${c.ophalen ? `, ${c.ophalen} worden opgehaald` : ''}, ${c.onderhoud} in onderhoud. ${late.length ? `${late.length} hadden al opgehaald moeten zijn: ${late.slice(0, 5).map(([x, s]) => `${x.id} bij ${s.place}`).join(', ')}.` : 'Geen oplegger wacht te lang op ophalen.'}`; }
  if (/te laat|tijdvenster|vertraag/.test(ql)) { const L = ex.filter(e => e.kind === 'Vertraging'); return L.length ? `${L.length} voertuigen halen hun tijdvenster niet: ${L.slice(0, 6).map(e => `${e.t.id} (${e.t.base.n})`).join(', ')}${L.length > 6 ? ' en meer' : ''}. De voorstellen staan hiernaast.` : 'Geen voertuigen met een gemist tijdvenster binnen je werkgebied.'; }
  if (/accu|laden|laadpunt|elektr/.test(ql)) { const ev = vis.filter(t => t.ev); const laden = ev.filter(t => ((S.get(t.id) || {}).seg || {}).k === 'laden').length; const low = ev.filter(t => (S.get(t.id) || {}).soc < 25).length; return `${ev.length} elektrische voertuigen in je werkgebied: ${laden} laden nu, ${low} hebben minder dan 25 % accu. De laadplanning staat onder Laden.`; }
  if (/rijtijd|pauze/.test(ql)) { const L = ex.filter(e => e.kind === 'Rijtijd'); return L.length ? `${L.length} chauffeurs zitten binnen 30 minuten op de rijtijdlimiet: ${L.map(e => `${S.get(e.t.id).driver} (${e.t.id})`).join(', ')}.` : 'Niemand zit binnen 30 minuten op de rijtijdlimiet.'; }
  if (/koel|vries|temperat/.test(ql)) { const L = ex.filter(e => e.kind === 'Koeling'); return L.length ? `${L.length} koelmelding: ${L.map(e => e.text).join('; ')}.` : 'Alle koel- en vriesopleggers zitten binnen hun temperatuurbereik.'; }
  const sp = SP.find(x => ql.includes(x.n.toLowerCase())); if (sp) { const mine = fleet.trucks.filter(t => t.base === sp); const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; for (const t of mine) { const st = (S.get(t.id) || {}).st; if (st) c[st]++; } const trs = fleet.trailersOf(sp); const los = trs.filter(x => { const s = TRS.get(x.id); return s && s.st !== 'gekoppeld'; }).length; return `${sp.n}: ${mine.length} voertuigen (${mine.filter(t => t.vandaag === 'inzet').length} ingezet), ${c.onderweg + c.vertraagd} onderweg, ${c.klant} bij een klant, ${c.pauze} met pauze, ${c.terrein} op het terrein; ${trs.length} opleggers, waarvan ${los} los; ${fleet.departures(sp, ctx.state.simTime, 120).length} vertrekken in de komende twee uur.`; }
  const town = TOWNS.find(x => ql.includes(x.n.toLowerCase())); if (town) { const L = vis.filter(t => { const s = S.get(t.id); return s && s.next && s.next.name.toLowerCase().includes(town.n.toLowerCase()); }); return L.length ? `${L.length} voertuigen rijden naar ${town.n}: ${L.slice(0, 8).map(t => `${t.id} (ETA ${hhmm(S.get(t.id).next.eta)})`).join(', ')}.` : `Op dit moment rijdt geen voertuig naar ${town.n}.`; }
  if (/hoeveel|aantal|status/.test(ql)) return `${counts.onderweg + counts.vertraagd} voertuigen zijn onderweg, ${counts.klant} staan bij een klant, ${counts.pauze} hebben pauze en ${counts.terrein} staan op het terrein; ${kpi.loose || 0} opleggers staan los. ${kpi.onTime.toFixed(1).replace('.', ',')} % van de stops was op tijd.`;
  return 'Ik beantwoord vragen over tijdvensters, opleggers, accu\'s, rijtijden, koeling, standplaatsen, plaatsen, voertuigen en chauffeurs. Probeer: "welke opleggers staan leeg bij een winkel?", "wat doet Wognum?" of "waar is O-5123?".';
}
