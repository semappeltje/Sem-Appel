// Weergaven: planbord, standplaatsen met vertrekbord, hal-scherm, klantweergave en de assistent.
import { SP, TOWNS, DIV, ST, laadpunten, fmt, hhmm } from './places.js';
import { ic } from './icons.js';

const COL = { drive: '#E3001F', stop: '#D97706', pauze: '#9CA3AF', laden: '#16A34A', terrein: '#D1D5DB' };
const fmtDrive = m => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

// ---------- planbord ----------
export function renderPlanbord(ctx) {
  const { fleet, state, S, esc, $ } = ctx; const sp = ctx.pbSp(); const T = state.simTime; const sel = ctx.selTruck();
  const rows = fleet.trucks.filter(t => t.base === sp).sort((a, b) => a.shiftStart - b.shiftStart);
  const W0 = Math.floor((T - 180) / 60) * 60, SPAN = 14 * 60, PX = 1020 / SPAN;
  const pct = m => ((m - W0) / SPAN * 100).toFixed(3) + '%';
  const body = rows.map(t => {
    const s = S.get(t.id); const bl = [];
    for (const b of fleet.blocks(t)) { if (b.k === 'terrein' && b.b - b.a <= 20) continue; for (const off of [-1440, 0, 1440]) { const x = Math.max(b.a + off, W0), y = Math.min(b.b + off, W0 + SPAN); if (y - x > 0.5) bl.push({ ...b, x, y }); } }
    return `<div class="prow ${sel === t ? 'sel' : ''}" data-truck="${t.id}"><div class="who"><span class="plate">${t.id}</span><div><b>${esc(t.driver)}</b><span>${esc(t.model.replace('Mercedes-Benz ', 'MB '))} · ${hhmm(t.shiftStart)}–${hhmm(t.shiftStart + t.shiftEnd)}</span></div><i class="dot" style="background:${s ? ST[s.st].color : '#999'}"></i></div><div class="lane">${bl.map(b => { const w = (b.y - b.x) * PX; const label = b.k === 'drive' || b.k === 'stop' ? b.label : b.k === 'pauze' ? 'Pauze' : b.k === 'laden' ? 'Laden' : 'Terrein'; return `<div class="blk ${b.k} ${b.delay ? 'late' : ''}" style="left:${pct(b.x)};width:${((b.y - b.x) / SPAN * 100).toFixed(3)}%;--c:${COL[b.k]}" title="${esc(b.label)} ${hhmm(b.a)}–${hhmm(b.b)}${b.delay ? ` · +${b.delay} min` : ''}">${w > 46 ? `<b>${esc(label)}</b><small>${hhmm(b.a)}–${hhmm(b.b)}</small>` : ''}${b.delay && w > 120 ? `<em>+${b.delay}</em>` : ''}</div>`; }).join('')}</div></div>`;
  }).join('');
  const hours = []; for (let h = W0; h <= W0 + SPAN; h += 60) hours.push(h);
  $('v-planbord').innerHTML = `<div class="vhead"><label class="dd"><small>Standplaats</small><select id="pbSel">${SP.slice().sort((a, b) => a.n.localeCompare(b.n)).map(s => `<option ${s === sp ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label><span class="dd"><small>Dag</small><b>vandaag · ${hhmm(T)}</b></span><span class="pill">${rows.length} trucks</span>
      <div class="legend2">${[['drive', 'Rijden'], ['stop', 'Bij klant'], ['pauze', 'Pauze'], ['laden', 'Laden'], ['terrein', 'Terrein']].map(([k, n]) => `<span><i style="background:${COL[k]}"></i>${n}</span>`).join('')}</div></div>
    <div class="gantt"><div class="ginner"><div class="ghead"><div class="who"><b>Truck en chauffeur</b><span>${rows.length}</span></div><div class="lane hd">${hours.map(h => `<i style="left:${pct(h)}"><span>${hhmm(h)}</span></i>`).join('')}</div></div><div class="gbody">${body}<div class="nowline" style="left:calc(var(--who) + (100% - var(--who)) * ${((T - W0) / SPAN).toFixed(4)})"><span>${hhmm(T)}</span></div></div></div></div>`;
  $('pbSel').onchange = e => { ctx.setPbSp(SP.find(s => s.n === e.target.value)); renderPlanbord(ctx); };
  $('v-planbord').querySelectorAll('[data-truck]').forEach(el => el.addEventListener('click', () => ctx.selectTruck(el.dataset.truck, { stay: true })));
}

// ---------- standplaatsen en vertrekbord ----------
export function renderSpView(ctx) {
  const { fleet, state, S, esc, $, people } = ctx; const T = state.simTime; const pb = ctx.pbSp();
  const rows = SP.slice().sort((a, b) => b.fleet - a.fleet).map(sp => { const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; for (const t of fleet.trucks) { if (t.base !== sp) continue; const s = S.get(t.id); if (s) c[s.st]++; } const ex = ctx.exceptions().filter(e => e.t.base === sp).length; const st = people.spStats.get(sp.n); return { sp, c, ex, st }; });
  const deps = fleet.departures(pb, T, 150).slice(0, 12);
  $('v-standplaatsen').innerHTML = `<div class="spgrid"><div class="sptable"><div class="vhead"><h3>Standplaatsen <small>${SP.length} · ${fmt(fleet.trucks.length)} trucks</small></h3><span class="hintline">Vaste chauffeur: aandeel diensten door de vaste chauffeur; wissels: chauffeurswisselingen per truck per week.</span></div>
      <table><thead><tr><th>Standplaats</th><th>Regio</th><th>Klant</th><th class="r">Trucks</th><th class="r">Onderweg</th><th class="r">Uitz.</th><th class="r">Vaste chauffeur</th><th class="r">Wissels/wk</th></tr></thead><tbody>${rows.map(({ sp, c, ex, st }) => `<tr class="${sp === pb ? 'sel' : ''}" data-sp="${esc(sp.n)}"><td><b>${esc(sp.n)}</b>${sp.hub ? ' <small>hoofdkantoor</small>' : ''}</td><td>${esc(sp.regio)}</td><td>${esc(sp.klant)}</td><td class="r">${sp.fleet}</td><td class="r">${c.onderweg + c.vertraagd}</td><td class="r ${ex ? 'bad' : ''}">${ex}</td><td class="r ${st.vaste < 0.65 ? 'warn' : ''}">${Math.round(st.vaste * 100)} %</td><td class="r">${st.wissel.toString().replace('.', ',')}</td></tr>`).join('')}</tbody></table></div>
      <div class="hal"><div class="halhead"><span class="prod">Vertrekbord</span><h3>${esc(pb.n)}</h3><b>${hhmm(T)}</b></div><div class="halrows">${deps.map(d => `<div class="halrow" data-truck="${d.t.id}"><time>${hhmm(d.at)}</time><b>${d.t.id}</b><span class="drv">${esc(d.t.driver)}</span><span class="dest">${esc(d.dest)}</span><em>Dock ${d.dock}</em><i class="${d.at - T < 15 ? 'soon' : ''}">${d.at - T < 15 ? 'Laden' : 'Gepland'}</i></div>`).join('') || '<div class="empty">Geen vertrekken in de komende 2,5 uur.</div>'}</div>
      <div class="halfoot"><button class="btn" data-hal="${esc(pb.n)}">${ic('tv', 15)} Open als hal-scherm</button><button class="btn" data-pb="${esc(pb.n)}">${ic('cal', 15)} Planbord</button></div></div></div>`;
  $('v-standplaatsen').querySelectorAll('tr[data-sp]').forEach(el => el.addEventListener('click', () => { ctx.setPbSp(SP.find(s => s.n === el.dataset.sp)); renderSpView(ctx); }));
  $('v-standplaatsen').querySelectorAll('[data-truck]').forEach(el => el.addEventListener('click', () => ctx.selectTruck(el.dataset.truck, { stay: true })));
  const h = $('v-standplaatsen').querySelector('[data-hal]'); if (h) h.onclick = () => { ctx.hashTo('#hal/' + encodeURIComponent(h.dataset.hal)); ctx.fullscreen(); };
  const p = $('v-standplaatsen').querySelector('[data-pb]'); if (p) p.onclick = () => ctx.setView('planbord');
}

// ---------- hal-scherm (tv in de loods) ----------
export function renderHal(ctx, spName) {
  const { fleet, state, esc, $ } = ctx; const sp = SP.find(s => s.n === spName) || SP[0]; const T = state.simTime;
  const deps = fleet.departures(sp, T, 180).slice(0, 14);
  const now = new Date(); const date = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  $('hal').innerHTML = `<div class="halbar"><div><span class="prod">Simon Loos · vertrekbord</span><h1>${esc(sp.n)}</h1></div><div class="halclock"><b>${hhmm(T)}</b><span>${esc(date)}</span></div><button class="btn ghost" id="halClose">${ic('x', 16)} Sluiten</button></div>
    <div class="halgrid"><div class="halcols"><span>Vertrek</span><span>Truck</span><span>Chauffeur</span><span>Bestemming</span><span>Dock</span><span>Status</span></div>${deps.map(d => `<div class="halline ${d.at - T < 15 ? 'soon' : ''}"><time>${hhmm(d.at)}</time><b>${d.t.id}</b><span>${esc(d.t.driver)}</span><span class="dest">${esc(d.dest)}</span><em>${d.dock}</em><i>${d.at - T < 15 ? 'Laden' : d.at - T < 45 ? 'Klaarzetten' : 'Gepland'}</i></div>`).join('') || '<div class="empty big">Geen vertrekken in de komende drie uur.</div>'}</div>
    <div class="halnote">Zelfde data als de control tower · ververst elke seconde · ${fleet.trucks.filter(t => t.base === sp).length} trucks op deze standplaats</div>`;
  $('halClose').onclick = () => ctx.hashTo('');
}

// ---------- klantweergave (deelbare link per winkel) ----------
export function renderKlant(ctx, truckId) {
  const { fleet, state, esc, $ } = ctx; const t = fleet.byId.get(truckId); const el = $('klant');
  if (!t) { el.innerHTML = `<div class="kcard"><h2>Onbekende rit</h2><p>Deze link verwijst naar een truck die niet (meer) bestaat.</p><button class="btn pri" id="kClose">Naar de control tower</button></div>`; $('kClose').onclick = () => ctx.hashTo(''); return; }
  const s = fleet.stateAt(t, state.simTime); const nx = s.next; const stops = t.plan.filter(x => x.k === 'stop'); const done = stops.filter(x => x.t1 <= s.rel).length;
  const late = nx && nx.win && nx.eta > nx.win[1];
  el.innerHTML = `<div class="kcard"><div class="khead"><span class="prod">Simon Loos · uw levering</span><button class="btn ghost sm" id="kClose">${ic('x', 14)} Sluiten</button></div>
    <h2>${esc(nx && !nx.home ? nx.name : 'Rit afgerond')}</h2>
    <div class="kstat ${late ? 'bad' : s.st === 'klant' ? 'ok' : ''}">${s.st === 'klant' ? 'De truck staat bij u' : nx && !nx.home ? (late ? `Verwacht ${hhmm(nx.eta)}, ${nx.delay} min later dan gepland` : `Verwacht ${hhmm(nx.eta)}${nx.win ? `, binnen het venster tot ${hhmm(nx.win[1])}` : ''}`) : 'Alle stops van vandaag zijn gedaan'}</div>
    <dl><dt>Truck</dt><dd>${t.id} · ${esc(t.model)}</dd><dt>Chauffeur</dt><dd>${esc(t.driver.split(' ')[0])}</dd><dt>Nog te rijden</dt><dd>${nx ? `${nx.kmLeft.toFixed(1).replace('.', ',')} km` : '–'}</dd><dt>Lading</dt><dd>${esc(t.lading)}</dd><dt>Stops vandaag</dt><dd>${done} van ${stops.length} gedaan</dd><dt>Laatste update</dt><dd>${hhmm(state.simTime)}</dd></dl>
    <p class="small">Deze link toont alleen deze truck en deze levering. De kaart achter dit venster volgt de truck live. Vragen: bel de planning van ${esc(t.base.n)}.</p></div>`;
  $('kClose').onclick = () => ctx.hashTo('');
}

// ---------- assistent ----------
export function renderAssist(ctx) {
  const { fleet, state, S, esc, $, store, rest } = ctx; const el = $('v-assistent'); if (!el) return; const T = state.simTime;
  const props = proposals(ctx); const over = store.get('sl-overdracht') || '';
  el.innerHTML = `<div class="acol">
      <div class="acard"><h3>Voorstellen <b>${props.length}</b></h3>
        <div class="auto"><div><b>${ctx.applied.length}</b><span>vandaag toegepast</span></div><div><b>${props.length}</b><span>wachten op akkoord</span></div><div><b>${ctx.msgCount()}</b><span>berichten naar chauffeurs</span></div></div>
        ${props.length ? props.map(p => `<div class="prop ${p.sev}"><i></i><div><b>${esc(p.title)}</b><span>${esc(p.kind)}</span><p>${esc(p.action)}</p><div class="why">Waarom: ${esc(p.why)}</div></div><button class="btn pri sm" data-apply="${p.id}">Pas toe</button></div>`).join('') : '<div class="empty">Geen open voorstellen. De assistent kijkt elke seconde opnieuw naar tijdvensters, rijtijden, accu\'s en storingen.</div>'}
        ${ctx.applied.length ? `<h4 class="sub">Afgehandeld <small>laatste ${Math.min(ctx.applied.length, 6)}</small></h4>${ctx.applied.slice(-6).reverse().map(a => `<div class="prop done ${a.sev}"><i></i><div><b>${esc(a.title)}</b><span>${hhmm(a.T)}</span><p>${esc(a.action)}</p></div></div>`).join('')}` : ''}
        <div class="hint">In de echte versie rekent de optimizer elke vijf minuten alle ritten opnieuw door met de live ETA's; de assistent legt per voorstel uit waarom, en de planner keurt goed met één klik.</div>
      </div>
      <div class="acard"><h3>Vraag het de assistent</h3>
        <div class="chat" id="chatBox">${ctx.chat.length ? ctx.chat.map(m => `<div class="msg ${m.me ? 'me' : ''}">${esc(m.text)}<time>${hhmm(m.T)}</time></div>`).join('') : '<div class="empty">Stel een vraag in gewone taal over de live situatie.</div>'}</div>
        <div class="ask"><input id="askIn" placeholder="Bijvoorbeeld: welke trucks halen hun tijdvenster niet?" autocomplete="off"><button class="btn pri sm" id="askBtn">Vraag</button></div>
        <div class="sugg">${['Welke trucks halen hun tijdvenster niet?', 'Hoeveel eActros laden nu?', 'Wie zit bijna op zijn rijtijd?', 'Wat doet Wognum?', 'Wie rijdt er naar Hoorn?'].map(q => `<button class="chip sm" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      </div>
    </div>
    <div class="acol">
      <div class="acard"><h3>Collega's op dienst</h3>
        ${ctx.COLLEGAS.map(([n, sp, role, a, b]) => { const on = T >= a && T < b; return `<div class="col"><span class="av ${on ? 'on' : ''}">${esc(n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(n)}</b><span>${esc(role)} · ${esc(sp)} · ${hhmm(a)}–${hhmm(b)}</span></div><em class="${on ? 'on' : ''}">${on ? 'op dienst' : 'buiten dienst'}</em></div>`; }).join('')}
        <h4 class="sub">Overdracht naar de volgende dienst</h4>
        <textarea id="overIn" class="over" placeholder="Wat moet de volgende planner weten?">${esc(over)}</textarea>
      </div>
      <div class="acard"><h3>Berichten met chauffeurs <b>${ctx.msgCount()}</b></h3>
        ${(() => { const L = fleet.trucks.filter(t => t.msgs && t.msgs.length).slice(-6).reverse(); return L.length ? L.map(t => { const m = t.msgs[t.msgs.length - 1]; return `<div class="col" data-truck="${t.id}"><span class="av">${esc(t.driver.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(t.driver)} · ${t.id}</b><span>${esc(m.text)}</span></div><em>${hhmm(m.T)}</em></div>`; }).join('') : '<div class="empty">Nog geen berichten. Open een truck en stuur een bericht, of pas een voorstel toe.</div>'; })()}
        <div class="hint">Berichten worden in de cabine voorgelezen; de chauffeur antwoordt met één knop.</div>
      </div>
    </div>`;
  el.querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => { const p = props.find(x => x.id === b.dataset.apply); if (!p) return; p.apply(); ctx.applied.push({ ...p, T: state.simTime }); ctx.feed.unshift({ T: state.simTime, t: p.t, txt: `voorstel toegepast: ${p.kind.toLowerCase()}`, sev: 'ok' }); ctx.frame(true); }));
  el.querySelectorAll('[data-truck]').forEach(x => x.addEventListener('click', () => ctx.selectTruck(x.dataset.truck)));
  const ask = () => { const v = $('askIn').value.trim(); if (!v) return; ctx.chat.push({ me: true, text: v, T: state.simTime }); ctx.chat.push({ me: false, text: answer(ctx, v), T: state.simTime }); if (ctx.chat.length > 12) ctx.chat.splice(0, ctx.chat.length - 12); renderAssist(ctx); const box = $('chatBox'); if (box) box.scrollTop = box.scrollHeight; };
  $('askBtn').onclick = ask; $('askIn').addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
  el.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => { $('askIn').value = b.dataset.ask; ask(); }));
  $('overIn').addEventListener('input', e => store.set('sl-overdracht', e.target.value));
}

function nearestSp(pos, minLp = 12) { let best = null, bd = Infinity; for (const sp of SP) { if (laadpunten(sp) < minLp) continue; const d = Math.hypot((sp.lon - pos.lon) * 68, (sp.lat - pos.lat) * 111); if (d < bd) { bd = d; best = sp; } } return { sp: best, km: Math.round(bd) }; }
export function proposals(ctx) {
  const { fleet, state, S, rest } = ctx; const out = []; const T = state.simTime;
  for (const e of ctx.exceptions().slice(0, 14)) {
    const t = e.t, s = S.get(t.id); if (!s) continue;
    if (e.kind === 'Vertraging' && s.next) {
      const helper = fleet.trucks.find(h => h.base === t.base && h !== t && !h.helping && (S.get(h.id) || {}).st === 'terrein' && ((T - h.shiftStart + 1440) % 1440) < h.shiftEnd - 90);
      out.push({ id: 'v' + t.id, sev: 'bad', kind: 'Vertraging', t, title: `${t.id} haalt ${s.next.name} niet (ETA ${hhmm(s.next.eta)}, +${s.next.delay} min)`, action: helper ? `${helper.id} (${helper.driver}, op terrein in ${t.base.n}) neemt de resterende stops over; ${t.id} rijdt na ${s.next.name} terug.` : `Klant ${s.next.name} krijgt automatisch de nieuwe ETA ${hhmm(s.next.eta)} en een volg-link; de planner hoeft niet te bellen.`, why: helper ? `${helper.id} heeft nog ${((helper.shiftStart + helper.shiftEnd - T + 1440) % 1440 / 60).toFixed(1).replace('.', ',')} uur dienst en staat naast de lading.` : 'Geen vrije truck op de standplaats; informeren is dan de beste stap.', apply: () => { t.delayResolved = true; if (helper) helper.helping = t.id; ctx.sendMsg(t, helper ? `Planning: ${helper.id} neemt je resterende stops over na ${s.next.name}. Rij daarna terug naar ${t.base.n}.` : `Planning: klant ${s.next.name} is geïnformeerd over je nieuwe ETA ${hhmm(s.next.eta)}.`); } });
    } else if (e.kind === 'Rijtijd') {
      const near = rest.nearest(s.pos, 45); const pl = near && near.place; const amen = pl ? [pl.douche ? 'douche' : null, pl.eten !== 'geen' ? pl.eten : null, pl.beveiligd ? 'beveiligd' : null].filter(Boolean).join(', ') : '';
      out.push({ id: 'r' + t.id, sev: 'warn', kind: 'Rijtijd', t, title: `${t.driver} (${t.id}) zit op ${fmtDrive(s.drive)} rijtijd`, action: pl ? `Pauze van 45 min bij ${pl.n} (${rest.score(pl).toString().replace('.', ',')}★ van ${pl.count} chauffeurs${amen ? ', ' + amen : ''}), ${near.km} km verderop; het tijdvenster van de volgende stop blijft haalbaar.` : `Pauze van 45 min inplannen bij ${s.next ? s.next.name : 'de volgende stop'}.`, why: pl ? 'Een beoordeelde pauzeplek op de route kost geen omweg en geeft een echte pauze.' : 'Pauze op een losplek kost geen extra stilstand.', apply: () => { t.breakPlanned = true; ctx.sendMsg(t, pl ? `Planning: neem je pauze van 45 min bij ${pl.n} (${near.km} km verderop, ${amen || 'parkeren'}). Het tijdvenster daarna blijft haalbaar.` : `Planning: neem je pauze van 45 min bij ${s.next ? s.next.name : 'de volgende stop'}.`); } });
    } else if (e.kind === 'Accu') {
      const { sp, km } = nearestSp(s.pos);
      out.push({ id: 'a' + t.id, sev: 'warn', kind: 'Accu', t, title: `${t.id} heeft ${Math.round(s.soc)} % accu (${Math.round(t.range * s.soc / 100)} km)`, action: sp ? `25 min snelladen bij ${sp.n} (${laadpunten(sp)} laadpunten, ${km} km van de route); laadpunt wordt gereserveerd.` : 'Terug naar de standplaats om te laden.', why: 'Het bereik is te krap voor de terugrit; laden onderweg kost minder dan slepen.', apply: () => { t.chargePlanned = true; ctx.sendMsg(t, `Planning: laad 25 min bij ${sp ? sp.n : t.base.n}, laadpunt ${1 + (t.idx % 6)} is gereserveerd.`); } });
    } else if (e.kind === 'Techniek') {
      out.push({ id: 't' + t.id, sev: 'bad', kind: 'Techniek', t, title: `${t.id}: ${t.storing}`, action: `Werkorder in de garage ${t.base.hub ? 'Wognum' : 'Opmeer'} na de dienst (${hhmm(t.shiftStart + t.shiftEnd)}); reservetruck wordt klaargezet.`, why: 'De rit kan veilig worden afgemaakt; de storing moet vandaag nog bekeken worden.', apply: () => { t.workorder = true; ctx.sendMsg(t, `Planning: werkorder aangemaakt voor "${t.storing}". Na je dienst naar de garage; reservetruck staat klaar.`); } });
    }
  }
  return out;
}
export function answer(ctx, q) {
  const { fleet, S } = ctx; const ql = q.toLowerCase(); const vis = fleet.trucks.filter(t => ctx.inScope(t));
  const ex = ctx.exceptions(); const counts = ctx.counts(); const kpi = ctx.kpi();
  const truck = fleet.trucks.find(t => ql.includes(t.id.toLowerCase())) || fleet.trucks.find(t => ql.includes(t.driver.toLowerCase()));
  if (truck) { const s = S.get(truck.id) || fleet.stateAt(truck, ctx.state.simTime); return `${truck.id} (${truck.driver}, ${truck.model}, standplaats ${truck.base.n}): ${ST[s.st].n.toLowerCase()}${s.next ? `, volgende stop ${s.next.name} om ${hhmm(s.next.eta)}${s.next.delay ? ` (+${s.next.delay} min)` : ''}` : ''}, ${truck.ev ? 'accu' : 'brandstof'} ${Math.round(s.soc)} %, rijtijd ${fmtDrive(s.drive)}.`; }
  if (/te laat|tijdvenster|vertraag/.test(ql)) { const L = ex.filter(e => e.kind === 'Vertraging'); return L.length ? `${L.length} trucks halen hun tijdvenster niet: ${L.slice(0, 6).map(e => `${e.t.id} (${e.t.base.n})`).join(', ')}${L.length > 6 ? ' en meer' : ''}. De voorstellen staan hiernaast.` : 'Geen trucks met een gemist tijdvenster binnen je werkgebied.'; }
  if (/accu|laden|laadpunt|elektr/.test(ql)) { const ev = vis.filter(t => t.ev); const laden = ev.filter(t => ((S.get(t.id) || {}).seg || {}).k === 'laden').length; const low = ev.filter(t => (S.get(t.id) || {}).soc < 25).length; return `${ev.length} elektrische voertuigen in je werkgebied: ${laden} laden nu, ${low} hebben minder dan 25 % accu. De laadplanning staat onder Laden.`; }
  if (/rijtijd|pauze/.test(ql)) { const L = ex.filter(e => e.kind === 'Rijtijd'); return L.length ? `${L.length} chauffeurs zitten binnen 30 minuten op de rijtijdlimiet: ${L.map(e => `${e.t.driver} (${e.t.id})`).join(', ')}.` : 'Niemand zit binnen 30 minuten op de rijtijdlimiet.'; }
  const sp = SP.find(x => ql.includes(x.n.toLowerCase())); if (sp) { const mine = fleet.trucks.filter(t => t.base === sp); const c = { onderweg: 0, klant: 0, pauze: 0, vertraagd: 0, terrein: 0 }; for (const t of mine) { const st = (S.get(t.id) || {}).st; if (st) c[st]++; } return `${sp.n}: ${mine.length} trucks, ${c.onderweg + c.vertraagd} onderweg, ${c.klant} bij een klant, ${c.pauze} met pauze, ${c.terrein} op het terrein; ${fleet.departures(sp, ctx.state.simTime, 120).length} vertrekken in de komende twee uur.`; }
  const town = TOWNS.find(x => ql.includes(x.n.toLowerCase())); if (town) { const L = vis.filter(t => { const s = S.get(t.id); return s && s.next && s.next.name.toLowerCase().includes(town.n.toLowerCase()); }); return L.length ? `${L.length} trucks rijden naar ${town.n}: ${L.slice(0, 8).map(t => `${t.id} (ETA ${hhmm(S.get(t.id).next.eta)})`).join(', ')}.` : `Op dit moment rijdt geen truck naar ${town.n}.`; }
  if (/hoeveel|aantal|status/.test(ql)) return `${counts.onderweg + counts.vertraagd} trucks zijn onderweg, ${counts.klant} staan bij een klant, ${counts.pauze} hebben pauze en ${counts.terrein} staan op het terrein. ${kpi.onTime.toFixed(1).replace('.', ',')} % van de stops was op tijd.`;
  return 'Ik beantwoord vragen over tijdvensters, accu\'s, rijtijden, standplaatsen, plaatsen, trucks en chauffeurs. Probeer: "welke trucks halen hun tijdvenster niet?", "wat doet Wognum?" of "wie rijdt er naar Hoorn?".';
}
