// Meldingen als zaken. Elke uitzondering die de simulatie signaleert (vertraging, rijtijd, accu, techniek, koeling,
// oplegger te laat opgehaald) is een zaak met een vaste sleutel uit soort, object en rit ("V:T-1112:R-10448"; een
// oplegger zonder rit), dus na een herlaad dezelfde. Velden: soort, ernst, object, standplaats, eigenaar (een planner van
// die standplaats, zie people.js), status (nieuw, in behandeling, wacht op, opgelost), deadline (ontstaan plus de norm
// van de soort), tijdlijn (wat het voertuig deed, wat de planner deed, notities) en voorstellen (de assistent en "waar
// past deze rit?"). Bewaard in sl-acties, een sleutel per dag. Het ontstaan wordt uit de simulatie teruggerekend.
// Een zaak sluit vanzelf als de oorzaak weg is (aangekomen, pauze begonnen), of door de planner (opgelost, voorstel). Wat
// vanzelf sloot zonder eigenaar, staat als "Vanzelf opgelost" met eigenaar Systeem. Een dockzaak sluit pas vanzelf als de
// chauffeur een bericht kreeg; zijn sleutel is de rit van het dockblok (een zaak, ook als het voertuig intussen een andere
// rit rijdt). Een open rit van vandaag die na zijn venster niet is ingevuld, is een zaak "Rit niet ingevuld" zonder
// voertuig ("N:P-8001"), met de keuzes alsnog een charter, morgen als eerste, of de klant bellen of een bericht.
// Wat groen is, vraagt niets: er is alleen een zaak als er iets afwijkt. Tellers in bel, overzicht, menu en lijst komen
// allemaal uit counts(): open = nieuw + in behandeling.
import { esc, ic, fmt, hhmm, hhmmDag, day, durTxt, plate, meter, kv, on, zBadge, ZST, SOORT, LETTER, WACHT, zaakId, zaakKey, initials, nl1, fmtDrive, statusBar, smartBtns, belKnop } from './base.js';
import { TRT } from '../fleet.js';
import { SP } from '../places.js';
import { createTable } from './table.js';
import * as IP from './inplannen.js';
import { kandidaten as plekKandidaten, ritInvoer, pool as poolAlles } from './planwijzig.js';
import { berichtHtml } from './assistent.js';
import { ritFase, belmoment, ritPrio, BEL_VOORAF, wieSoort, vensterVandaag, klantPlanning, klantBerichtGemist, morgenVenster, morgenAlsEerste, contact, kandidatenVan, alleKandidaten, wijsToe, bevestig, euro, hoofdLaat, naVensterTxt } from './invulling.js';
import { REDEN, klantKort, kostenNoot, vraagTegelijk, namenTxt } from './openritten.js';
// de reden van een open rit in een woord, voor de vakken bovenaan de zaakpagina
const REDEN_KORT = { ziek: 'Ziek', 'uitval voertuig': 'Uitval', 'extra rit klant': 'Extra rit', 'nieuw uit OTM5': 'OTM5' };

// gebeurtenissen van fleet.eventsOf in een zin (met dock, oplegger, wachttijd en wat er geladen wordt)
const bij = e => (e.bij ? ` bij ${e.bij}` : e.naam && e.naam !== 'onderweg' ? ` bij ${e.naam}` : '');
const aanDock = e => (e.dock ? ` aan dock ${e.dock}` : '');
const EVT = {
  vertrek: e => `Vertrokken${e.naam ? ` van ${e.naam}` : ''}${e.dock ? ` (dock ${e.dock})` : ''}`, aankomst: e => `Aangekomen bij ${e.naam || 'de stop'}${e.dock ? ` (dock ${e.dock})` : ''}`,
  los_start: e => `Lossen begonnen${e.dock ? aanDock(e) : bij(e)}`, los_eind: e => `Lossen klaar${e.dock ? aanDock(e) : bij(e)}`,
  wacht: e => e.reden === 'dock' ? `Wacht op een vrij dock${e.duur ? ` (${Math.round(e.duur)} min)` : ''}` : `Wacht${e.duur ? ` ${Math.round(e.duur)} min` : ''}${bij(e)} tot het lossen`,
  koppel: e => `Oplegger${e.oplegger ? ` ${e.oplegger}` : ''} gekoppeld${e.dock ? aanDock(e) : bij(e)}`, ontkoppel: e => `Oplegger${e.oplegger ? ` ${e.oplegger}` : ''} afgekoppeld${e.dock ? aanDock(e) : bij(e)}`,
  laad_start: e => e.wat === 'accu' ? `Accu laden begonnen${bij(e)}` : `Laden begonnen${e.dock ? aanDock(e) : bij(e)}`, laad_eind: e => e.wat === 'accu' ? 'Accu geladen' : 'Laden klaar',
  pauze_start: e => `Pauze begonnen${bij(e)}`, pauze_eind: () => 'Pauze voorbij',
};

export function createZaken(ctx) {
  const { fleet, A, state } = ctx;
  let prev = new Set(), lastT = null, list = [], byKey = new Map();
  // een rit uit de pool op nummer (fleet.poolItem; anders de pool van de interface)
  const poolVan = id => (fleet.poolItem ? fleet.poolItem(id) : null) || poolAlles(ctx).find(p => p.id === id) || null;
  const objOf = key => { const [L, id, rit] = key.split(':'); const kind = LETTER[L]; if (L === 'N') return { kind, t: null, tr: null, p: poolVan(id), id, rit: null }; return kind === 'Koeling' || kind === 'Oplegger' ? { kind, tr: fleet.trailerById.get(id) || null, t: null, id, rit: null } : { kind, t: fleet.byId.get(id) || null, tr: null, id, rit: rit || null }; };
  const ritBij = (t, T) => { const r = ctx.R.ritOf(t, T); return r ? r.id : null; };
  // De dockwissels die de chauffeur nog niet hoorde, per rit van het dockblok (fleet.dockWissels): Map rit-id (of '') naar de
  // eerste wissel in die rit. De sleutel van een dockzaak is die rit, niet de rit die het voertuig nu rijdt.
  function dockRitten(t, T) {
    const out = new Map(); if (!t || !t.dockWissel || !fleet.dockWissels) return out;
    for (const w of fleet.dockWissels(t, T)) { const i = t.plan.indexOf(w.seg); const r = ctx.R.ofTruck(t).find(x => i >= x.i0 && i <= x.i1); const id = r ? r.id : ''; if (!out.has(id)) out.set(id, w); }
    return out;
  }
  const dockKey = (t, rit) => (rit ? `D:${t.id}:${rit}` : `D:${t.id}`);
  const dockWat = w => (w.soort === 'aankomst' ? (w.begonnen ? 'koppelde af' : 'afkoppelen') : w.soort === 'laden' ? (w.begonnen ? 'laadde' : 'laden') : (w.begonnen ? 'koppelde' : 'koppelen'));
  const dockTekst = w => `dock ${w.oud} buiten gebruik; ${dockWat(w)} om ${hhmm(w.a)} aan dock ${w.nieuw}${w.begonnen ? ', zonder bericht aan de chauffeur' : ''}`;
  let dockVoertuigen = null;
  // een open rit die niemand rijdt, per fase (invulling.ritFase): de klant, de plaats, het venster, en het belmoment of de reden
  const ritTekst = (p, fase, B) => {
    const v = vensterVandaag(p); const wie = `${klantKort(p.klant)} uit ${p.sp}`; const laden = `laden ${hhmm(v[0])} tot ${hhmm(v[1])}`;
    if (fase === 'bel') return `${wie}: uiterlijk ${hhmm(B)} iemand vragen, anders haalt niemand het venster (${laden})`;
    if (fase === 'laat') return `${wie}: niemand haalt het venster meer${B !== null ? `, uiterlijk vragen was ${hhmm(B)}` : ''} (${laden})`;
    return `${wie}, ${laden}: niet ingevuld (${(REDEN[p.reden] || p.reden || 'open rit').toLowerCase()})`;
  };
  // het belmoment als deadline: alleen als de rit bekend was voor het belmoment
  const belVan = p => { const b = belmoment(ctx, p); return b && b.T !== null && b.T >= Math.max(0, p.bekend) ? b.T : null; };

  // is de oorzaak er op tijdstip T? (zelfde regels als de signalering in ui.frame, en in dezelfde rit)
  function presentAt(key, T) {
    const o = objOf(key);
    if (o.p !== undefined) return !!o.p && !!ritFase(ctx, o.p, T);
    if (!o.t && !o.tr) return false;
    if (o.tr) { const s = fleet.trailerStateAt(o.tr, T); return o.kind === 'Koeling' ? !!o.tr.storing && (s.st === 'gekoppeld' || s.st === 'geladen') : !!s.late; }
    if (o.kind === 'Dock') return dockRitten(o.t, T).has(o.rit || '');
    if (o.rit && ritBij(o.t, T) !== o.rit) return false;
    const s = fleet.stateAt(o.t, T);
    // een vertraging is een zaak zolang een stop daardoor na zijn venster aankomt (fleet.vertraging, zoals ui.frame)
    if (o.kind === 'Vertraging') return !!fleet.vertraging(o.t, T, s);
    if (o.kind === 'Rijtijd') return (s.st === 'onderweg' || s.st === 'vertraagd') && s.drive >= 240;
    if (o.kind === 'Accu') return o.t.ev && s.soc < 20 && s.st !== 'terrein';
    if (o.kind === 'Techniek') return !!o.t.storing && s.st !== 'terrein';
    return false;
  }
  // terugrekenen tot de oorzaak er nog niet was: grof per 10 minuten, dan per minuut (hooguit 24 uur terug)
  // In hele minuten: met een gebroken T kon het halveren blijven hangen (m gelijk aan lo, de afstand bleef groter dan 1).
  function ontstaan(key, T) {
    let a = Math.floor(T); let k = 0; while (k++ < 144 && presentAt(key, a - 10)) a -= 10;
    let lo = a - 10, hi = a; while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (presentAt(key, m)) hi = m; else lo = m; }
    return hi;
  }
  // ---------- terugblik: wat vandaag al speelde en vanzelf over ging ----------
  // Bij het openen (en na een sprong vooruit in de tijd) rekent de app de dag tot nu door in stappen van 5 minuten, in
  // kleine porties zodat de app vlot blijft. Zaken die vanzelf sloten staan zo meteen onder Opgelost. Niet bewaard: het
  // volgt uit de simulatie en is na een herlaad hetzelfde.
  let hist = new Map(), histT = -1, histBusy = false;
  // dockzaken staan hier niet: hun sleutel is de rit van het dockblok (keys in scanHistory), en ze sluiten pas vanzelf als de
  // chauffeur een bericht kreeg
  const truckKinds = (t, T) => {
    const s = fleet.stateAt(t, T); const k = [];
    if (fleet.vertraging(t, T, s)) k.push('V');
    if ((s.st === 'onderweg' || s.st === 'vertraagd') && s.drive >= 240 && !t.breakPlanned) k.push('R');
    if (t.ev && s.soc < 20 && s.st !== 'terrein' && !t.chargePlanned) k.push('A');
    if (t.storing && s.st !== 'terrein' && !t.workorder) k.push('T');
    return k;
  };
  const trailerKinds = (tr, T) => {
    const s = fleet.trailerStateAt(tr, T); const k = [];
    if (tr.storing && (s.st === 'gekoppeld' || s.st === 'geladen') && !tr.workorder) k.push('K');
    if (s.late && !tr.pickupPlanned) k.push('O');
    return k;
  };
  function histText(L, o, T) {
    if (L === 'D') { const w = fleet.dockWissel(o, T); return w ? dockTekst(w) : 'dock buiten gebruik'; }
    if (L === 'V' || L === 'R' || L === 'A') {
      const s = fleet.stateAt(o, T);
      if (L === 'V') { const v = fleet.vertraging(o, T, s); return v ? `${v.eerste.naam}: ${v.eerste.laat} min na het venster${v.laat.length > 1 ? ` (en ${v.laat.length - 1} ${v.laat.length === 2 ? 'stop' : 'stops'} meer)` : ''}` : 'rit met vertraging'; }
      if (L === 'R') return `${s.driver || o.id}: ${fmtDrive(s.drive)} van 4:30 rijtijd zonder geplande pauze`;
      return `Accu ${Math.round(s.soc)} % · ${Math.round(o.range * s.soc / 100)} km bereik`;
    }
    if (L === 'T' || L === 'K') return o.storing || '';
    const s = fleet.trailerStateAt(o, T); return `${o.id} stond leeg bij ${s.place || 'een klant'}, ophalen was gepland om ${s.pickup !== undefined ? hhmm(s.pickup) : '–'}`;
  }
  function scanHistory(T1) {
    if (histBusy) return; histBusy = true;
    const jobs = [...fleet.trucks.filter(t => t.vandaag === 'inzet').map(o => [o, truckKinds]), ...fleet.trailers.filter(tr => tr.storing || tr.events.some(e => e.k === 'site' && !e.place.yard)).map(o => [o, trailerKinds])];
    const out = new Map(); let i = 0;
    const one = ([o, fn]) => {
      const truck = fn === truckKinds;
      // de sleutels op tijdstip x: soort en object, voor een voertuig ook de rit (een dockzaak: de rit van het dockblok)
      const keys = x => { const k = fn(o, x); const d = truck && o.dockWissel ? [...dockRitten(o, x).keys()].map(rit => dockKey(o, rit)) : []; if (!k.length) return d; const r = truck ? ritBij(o, x) : null; return [...k.map(L => r ? `${L}:${o.id}:${r}` : `${L}:${o.id}`), ...d]; };
      const refine = (key, lo, hi, want) => { lo = Math.floor(lo); hi = Math.ceil(hi); while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (keys(m).includes(key) === want) hi = m; else lo = m; } return hi; };
      const open = new Map();
      for (let x = 0; x <= T1; x += 5) {
        const k = keys(x);
        for (const key of k) if (!open.has(key)) open.set(key, x === 0 ? 0 : refine(key, x - 5, x, true));
        for (const [key, a] of open) if (!k.includes(key)) { open.delete(key); const b = refine(key, x - 5, x, false); if (b - a >= 2) { const m = a + Math.min(2, (b - a) / 2); out.set(key, { first: a, closedAt: b, text: histText(key[0], o, m), driver: truck ? fleet.stateAt(o, m).driver || '' : '' }); } }
      }
    };
    const step = () => {
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 12) one(jobs[i++]);
      if (i < jobs.length) { setTimeout(step, 0); return; }
      // de weergaven en tellers bijwerken met een gewone beurt (ctx.frame): die tekent een open pagina alleen opnieuw als
      // haar inhoud veranderde. ctx.refreshAll tekende de pagina altijd opnieuw, ook als er niets veranderde: dan verdween
      // een knop onder de muis van de planner (gemeten: twee keer in tien seconden om 10:00, beide keren dezelfde inhoud)
      hist = out; histT = T1; histBusy = false; if (lastT !== null) build(lastT, prev); if (typeof ctx.frame === 'function') ctx.frame(true); else ctx.refreshAll();
    };
    setTimeout(step, 30);
  }

  const statusOf = (r, present, T) => !present || r.done ? 'opgelost' : r.until && r.until > T ? 'wacht' : r.who || r.status === 'behandeling' ? 'behandeling' : 'nieuw';
  function impactOf(kind, d) {
    if (!d) return 0.5;
    if (kind === 'Vertraging') return Math.min(1, (d.delay || 0) / 30) + (d.missed ? 0.3 : 0);
    if (kind === 'Rijtijd') return Math.max(0, Math.min(1, 1 - (d.left || 0) / 30));
    if (kind === 'Accu') return Math.max(0, Math.min(1, (20 - (d.soc || 20)) / 20));
    if (kind === 'Koeling') return 1;
    if (kind === 'Oplegger') return Math.min(1, (d.late || 0) / 360);
    if (kind === 'Dock') return 0.3;
    return 0.5;
  }

  // ---------- elke beurt: de aanwezige uitzonderingen (alle voertuigen en opleggers, los van het werkgebied) ----------
  function update(T, exceptions) {
    const jump = lastT === null || Math.abs(((T - lastT + 720) % 1440 + 1440) % 1440 - 720) > 5; lastT = T;
    const seen = new Set(); let dirty = false;
    // dockzaken per rit van het dockblok (in plaats van de rit die het voertuig nu rijdt), en de gemiste open ritten
    const ex = exceptions.filter(e => e.kind !== 'Dock');
    if (!dockVoertuigen) dockVoertuigen = fleet.trucks.filter(t => t.dockWissel);
    for (const t of dockVoertuigen) for (const [rit, w] of dockRitten(t, T)) ex.push({ key: dockKey(t, rit), sev: 'warn', kind: 'Dock', t, text: dockTekst(w), data: { dock: w.nieuw, oud: w.oud, om: w.a, begonnen: w.begonnen } });
    for (const p of poolAlles(ctx)) { const fase = ritFase(ctx, p, T); if (!fase) continue; const B = belVan(p); ex.push({ key: `N:${p.id}`, sev: fase === 'bel' ? 'warn' : 'bad', kind: 'Rit niet ingevuld', t: null, tr: null, p, text: ritTekst(p, fase, B), data: { pool: p.id, fase, bel: B } }); }
    for (const e of ex) {
      seen.add(e.key); const r = A.rec(e.key);
      if (r.first === undefined || r.first === null || (r.first > T + 1 && !r.closedAt)) { r.first = ontstaan(e.key, T); r.since = r.first; dirty = true; }
      if (r.closedAt !== undefined && r.closedAt !== null && !jump) { if (T > r.closedAt + 2 && !r.done) { r.since = ontstaan(e.key, T); r.reopened = (r.reopened || 0) + 1; } r.closedAt = null; dirty = true; }
      if (r.since === undefined) r.since = r.first;
      r.kind = e.kind; r.ref = e.tr ? e.tr.id : e.t ? e.t.id : e.p ? e.p.id : null; r.text = e.text; r.seen = T;
      byKey.set(e.key, e);
    }
    if (!jump) for (const key of prev) if (!seen.has(key)) { const r = A.acts.handled[key]; if (r && (r.closedAt === undefined || r.closedAt === null)) { r.closedAt = r.seen !== undefined ? r.seen : T; dirty = true; } }
    prev = seen; if (dirty) A.saveSoon();
    if (!histBusy && (histT < 0 || T > histT + 30)) scanHistory(Math.floor(T));
    build(T, seen);
  }
  const kort = (o, z) => { z.rit = o.rit; z.deadline = z.since + z.norm; z.over = Math.round(z.age - z.norm); return z; };
  function build(T, seen) {
    const out = [];
    for (const [key, r] of Object.entries(A.acts.handled)) {
      if (r.first === undefined || r.first === null || !r.kind) continue;
      const present = seen.has(key);
      if (!present && (r.closedAt === undefined || r.closedAt === null)) continue;
      if (!present && r.first > T) continue;           // na terugspoelen: nog niet ontstaan
      const o = objOf(key); if (!o.t && !o.tr && !o.p) continue;
      const e = present ? byKey.get(key) : null; const status = statusOf(r, present, T);
      const t = o.t || (e && e.t) || null; const base = o.p ? SP.find(s => s.n === o.p.sp) || null : o.tr ? o.tr.base : t ? t.base : null; if (!base) continue;
      const since = r.since !== undefined ? r.since : r.first; const age = Math.max(0, day(T - since)); const norm = A.settings.norm(o.kind);
      const sev = e ? e.sev : (o.kind === 'Rijtijd' || o.kind === 'Accu' || o.kind === 'Oplegger' || o.kind === 'Dock' ? 'warn' : 'bad');
      const imp = impactOf(o.kind, e && e.data);
      // een gemiste rit die de planner toewees of naar morgen zette, sloot door de planner, niet vanzelf
      const doorPlanner = !!(o.p && (o.p.gepland || o.p.morgenEerste));
      const z = kort(o, {
        key, id: zaakId(key), kind: o.kind, sev, t: o.tr ? (e && e.t && e.t.kind ? e.t : null) : t, tr: o.tr, p: o.p || null, obj: o.id, base, spn: base.n, div: o.p ? o.p.div : o.tr ? o.tr.div : t.div,
        present, status, open: status === 'nieuw' || status === 'behandeling', who: r.who || '', until: r.until || 0, wachtOp: status === 'wacht' ? r.wachtOp || 'reactie' : '', done: !!r.done, first: r.first, since, closedAt: present ? null : r.closedAt,
        closedBy: r.done ? (r.closedBy || 'planner') : present ? null : (r.closedBy || (doorPlanner ? 'planner' : 'vanzelf')), age, norm, sla: age / norm, text: e ? e.text : (r.text || ''), data: e ? e.data : null, rec: r, imp,
        notes: r.notes || [], driver: '',
      });
      // een rit die niemand rijdt: de deadline is het laatste belmoment (invulling.belmoment), als de rit toen al bekend was;
      // de norm is dan de tijd van het ontstaan tot dat moment (een half uur, of korter als de rit later bekend werd)
      if (o.p && z.data && typeof z.data.bel === 'number' && z.data.bel >= since) { z.norm = Math.max(1, Math.round(z.data.bel - since)); z.deadline = z.data.bel; z.over = Math.round(T - z.data.bel); z.sla = z.age / z.norm; }
      // prioriteit: hoog als de deadline voorbij is of als een ernstige melding veel effect heeft; middel bij de halve
      // norm of een ernstige melding; anders laag. Binnen een prioriteit eerst de verste over de deadline, dan het effect.
      z.prio = z.sla >= 1 || (z.sev === 'bad' && imp >= 0.5) ? 'hoog' : z.sla >= 0.5 || z.sev === 'bad' ? 'middel' : 'laag';
      // een rit die niemand rijdt, in de fase bel: hoog als het belmoment binnen 30 minuten valt of de beste kandidaat onder
      // 60 procent zit (invulling.ritPrio); in de fasen laat en gemist is hij ernstig en daarmee al hoog
      if (o.p && z.open && e && e.data && e.data.fase === 'bel') { try { z.prio = ritPrio(ctx, o.p, T); } catch { /* het advies kon niet rekenen: de gewone regel */ } }
      z.urgency = (z.prio === 'hoog' ? 30 : z.prio === 'middel' ? 20 : 10) + Math.min(z.sla, 3) + imp * 0.3;
      const vt = o.tr ? (e && e.data && e.data.vehicle) : t; if (vt) z.driver = ctx.driverName(vt);
      out.push(z);
    }
    // vanzelf opgeloste zaken van eerder vandaag (terugblik); een zaak die de planner al kent gaat voor
    for (const [key, h] of hist) {
      if (seen.has(key) || h.closedAt > T || h.first > T) continue;
      const r0 = A.acts.handled[key]; if (r0 && r0.first !== undefined && r0.first !== null) continue;
      const o = objOf(key); if (!o.t && !o.tr) continue; const t = o.t; const base = o.tr ? o.tr.base : t.base;
      out.push(kort(o, {
        key, id: zaakId(key), kind: o.kind, sev: o.kind === 'Rijtijd' || o.kind === 'Accu' || o.kind === 'Oplegger' || o.kind === 'Dock' ? 'warn' : 'bad', t: o.tr ? null : t, tr: o.tr, obj: o.id, base, spn: base.n, div: o.tr ? o.tr.div : t.div,
        present: false, status: 'opgelost', open: false, who: '', until: 0, wachtOp: '', done: false, first: h.first, since: h.first, closedAt: h.closedAt, closedBy: 'vanzelf', age: Math.max(0, h.closedAt - h.first), norm: A.settings.norm(o.kind), sla: 0, text: h.text, data: null, rec: { log: [], notes: [] }, imp: 0, notes: [], driver: h.driver || '', prio: 'laag', urgency: 0, hist: true,
      }));
    }
    list = out;
  }
  const inScope = z => z.p ? ctx.inScopeBase(z.base, z.div) : z.tr ? ctx.inScopeBase(z.tr.base, z.tr.div) : ctx.inScope(z.t || fleet.byId.get(z.obj));
  const scoped = () => list.filter(inScope);
  function counts() { const L = scoped(); const c = { open: 0, nieuw: 0, behandeling: 0, wacht: 0, opgelost: 0, alle: L.length, verlopen: 0 }; for (const z of L) { c[z.status]++; if (z.open) { c.open++; if (z.sla >= 1) c.verlopen++; } } return c; }
  const open = () => scoped().filter(z => z.open).sort((a, b) => b.urgency - a.urgency);
  // een zaak op id of sleutel; een oude link zonder rit ("V-T-1112") vindt de nieuwste zaak van die soort op dat object
  const get = id => { const key = zaakKey(id) || id; return list.find(z => z.key === key) || list.filter(z => z.key.startsWith(key + ':')).sort((a, b) => b.since - a.since)[0] || null; };

  // ---------- acties van de planner (elk met een logregel en een toast) ----------
  const objTxt = z => `${z.kind.toLowerCase()} ${z.obj}`;
  // na een actie de lijst meteen opnieuw opbouwen, zodat de weergaven die nu tekenen de nieuwe status zien (en niet pas bij de volgende tik)
  const herbouw = () => { if (lastT !== null) build(lastT, prev); };
  function addLog(z, txt) { const r = A.rec(z.key); r.log = r.log || []; r.log.push({ T: state.simTime, who: A.settings.naam(), txt }); }
  function assign(zs, who) {
    for (const z of zs) { const r = A.rec(z.key); r.who = who; if (who && !r.done && r.status !== 'behandeling') r.status = 'behandeling'; addLog(z, who ? `toegewezen aan ${who}` : 'eigenaar weggehaald'); }
    A.save(); A.log(zs.length === 1 ? `${who ? `wees ${objTxt(zs[0])} toe aan ${who}` : `haalde de eigenaar van ${objTxt(zs[0])} weg`}` : `wees ${zs.length} meldingen toe aan ${who || 'niemand'}`, { zaak: zs.length === 1 ? zs[0].key : null });
    herbouw(); ctx.refreshAll();
    ctx.L.toast(zs.length === 1 ? (who ? `${zs[0].kind} ${zs[0].obj} toegewezen aan ${who}.` : `Eigenaar weggehaald bij ${zs[0].obj}.`) : `${zs.length} meldingen toegewezen aan ${who || 'niemand'}.`, { icon: 'usercheck' });
  }
  // status zetten; wacht met een reden (chauffeur, klant, garage, collega) en een tijd; opts.mij: in behandeling en
  // nog zonder eigenaar, dan wordt de planner zelf eigenaar (slepen op het bord)
  function setStatus(zs, st, mins, reden, opts = {}) {
    const T = state.simTime; const prevState = zs.map(z => ({ key: z.key, r: JSON.parse(JSON.stringify(A.rec(z.key))) }));
    const w = WACHT[reden] ? reden : 'reactie'; const min = mins || WACHT[w][1];
    for (const z of zs) {
      const r = A.rec(z.key);
      if (st === 'opgelost') { r.done = true; r.closedBy = 'planner'; r.until = 0; addLog(z, 'op opgelost gezet'); }
      else if (st === 'wacht') { r.done = false; r.until = T + min; r.wachtOp = w; addLog(z, `wacht op ${WACHT[w][0]} tot ${hhmm(r.until)}`); }
      else if (st === 'behandeling') { r.done = false; r.until = 0; r.status = 'behandeling'; if (opts.mij && !r.who) { r.who = A.settings.naam(); addLog(z, `toegewezen aan ${r.who}`); } addLog(z, 'in behandeling genomen'); }
      else { r.done = false; r.until = 0; r.status = null; r.who = ''; addLog(z, 'teruggezet op nieuw'); }
    }
    A.save();
    const what = st === 'opgelost' ? 'opgelost' : st === 'wacht' ? `wacht op ${WACHT[w][0]} tot ${hhmm(T + min)}` : st === 'behandeling' ? 'in behandeling' : 'nieuw';
    A.log(zs.length === 1 ? `zette ${objTxt(zs[0])} op ${what}` : `zette ${zs.length} meldingen op ${what}`, { zaak: zs.length === 1 ? zs[0].key : null });
    herbouw(); ctx.refreshAll();
    ctx.L.toast(zs.length === 1 ? `${zs[0].kind} ${zs[0].obj}: ${what}.` : `${zs.length} meldingen: ${what}.`, { icon: ZST[st].icon, action: 'Ongedaan maken', onAction: () => { for (const p of prevState) A.acts.handled[p.key] = p.r; A.save(); A.log(`maakte de statuswijziging ongedaan (${zs.length === 1 ? objTxt(zs[0]) : `${zs.length} meldingen`})`); herbouw(); ctx.refreshAll(); } });
  }
  function addNote(z, txt) {
    txt = String(txt || '').trim(); if (!txt) return false; const r = A.rec(z.key); r.notes = r.notes || []; r.notes.push({ T: state.simTime, who: A.settings.naam(), txt: txt.slice(0, 600) });
    if (!r.who && !r.done && r.status !== 'behandeling') r.status = 'behandeling';
    A.save(); A.log(`schreef een notitie bij ${objTxt(z)}`, { zaak: z.key }); herbouw(); ctx.refreshAll(); ctx.L.toast('Notitie opgeslagen.', { icon: 'note' }); return true;
  }
  function markApplied(key, p) {
    const af = k => { const r = A.rec(k); r.done = true; r.closedBy = 'voorstel'; r.applied = p.title; r.log = r.log || []; r.log.push({ T: state.simTime, who: A.settings.naam(), txt: `voorstel toegepast: ${p.action}` }); };
    af(key);
    // een dockbericht gaat over elke wissel van dat voertuig die nu speelt: zijn andere dockzaken zijn daarmee ook af
    if (key.startsWith('D:')) { const t = key.split(':')[1]; for (const z of list) if (z.key !== key && (z.key === `D:${t}` || z.key.startsWith(`D:${t}:`)) && z.present && !z.done) af(z.key); }
    A.save(); herbouw();
  }

  // ---------- tijdlijn ----------
  // wat het voertuig deed rond de zaak: uit fleet.eventsOf als de data dat geeft, anders uit het dagplan
  function voertuigEvents(t, a, b) {
    if (!t) return [];
    if (typeof fleet.eventsOf === 'function') {
      try { const L = fleet.eventsOf(t.id) || []; if (L.length) return L.filter(e => e.t >= a && e.t <= b).map(e => { const r = e.rit && ctx.R.vanNr ? ctx.R.vanNr(t, e.rit) : null; return { T: e.t, txt: (EVT[e.soort] || (() => e.soort))(e), sub: r ? `rit ${r.id}` : '', kind: 'veh' }; }); } catch { /* terugval op het dagplan */ }
    }
    const out = []; const T0 = t.dayStart;
    for (const s of t.plan) {
      const s0 = T0 + s.t0, s1 = T0 + s.t1; if (s1 < a || s0 > b) continue;
      if (s.k === 'stop') { if (s0 >= a) out.push({ T: s0, txt: `Aangekomen bij ${s.stop}` }); if (s1 <= b) out.push({ T: s1, txt: `Vertrokken bij ${s.stop}`, sub: `lossen ${Math.round(s.t1 - s.t0)} min` }); }
      else if (s.k === 'pauze') { if (s0 >= a) out.push({ T: s0, txt: 'Pauze begonnen' }); if (s1 <= b) out.push({ T: s1, txt: 'Pauze voorbij', sub: 'rijtijd begint opnieuw' }); }
      else if (s.k === 'laden') { if (s0 >= a) out.push({ T: s0, txt: 'Laden begonnen' }); }
      else if (s.k === 'koppel' && s0 >= a) out.push({ T: s0, txt: `Oplegger ${s.tr ? s.tr.id : ''} gekoppeld` });
      else if (s.k === 'drive' && s0 >= a && s.idx === 0) out.push({ T: s0, txt: `Vertrokken van ${t.base.n}` });
    }
    return out.map(e => ({ ...e, kind: 'veh' }));
  }
  // de tijdlijn van een zaak: ontstaan en vanzelf opgelost uit de simulatie, het voertuig rond de zaak, de rest uit het
  // logboek van de zaak
  function timeline(z) {
    const r = z.rec; const T = state.simTime; const ev = [{ T: z.first, txt: `${z.kind} gesignaleerd`, sub: SOORT[z.kind].uitleg, kind: 'sys' }];
    if (z.since !== z.first) ev.push({ T: z.since, txt: 'Opnieuw gesignaleerd', sub: 'De oorzaak kwam terug nadat de zaak was gesloten.', kind: 'sys' });
    const eind = z.present ? T : (z.closedAt !== null && z.closedAt !== undefined ? z.closedAt + 15 : T);
    const veh = voertuigEvents(z.t || (z.tr && z.data && z.data.vehicle) || null, z.first - 45, Math.min(T, eind)).filter(e => e.T <= T);
    ev.push(...veh.slice(-8));
    // een gemiste rit: wanneer hij binnenkwam en tot wanneer hij kon laden
    if (z.p) { const p = z.p; const v = vensterVandaag(p); if (p.bekend >= 0 && p.bekend <= T) ev.push({ T: p.bekend, txt: 'Open rit binnengekomen', sub: `${REDEN[p.reden] || p.reden || 'open rit'}; laden ${hhmm(v[0])} tot ${hhmm(v[1])}`, kind: 'veh' }); if (v[0] <= T) ev.push({ T: v[0], txt: 'Laadvenster open, nog geen voertuig', sub: '', kind: 'veh' });
      // het belmoment en het eind van het venster, zolang de rit toen nog open was
      const B = belVan(p); const nogOpen = m => !p.gepland && (z.closedAt === null || z.closedAt === undefined || z.closedAt > m);
      if (B !== null && B - BEL_VOORAF <= T && B - BEL_VOORAF >= Math.max(0, p.bekend) && nogOpen(B - BEL_VOORAF)) ev.push({ T: B - BEL_VOORAF, txt: `Uiterlijk ${hhmm(B)} iemand vragen`, sub: 'daarna haalt niemand het venster', kind: 'sys' });
      if (B !== null && B < T && nogOpen(B)) ev.push({ T: B, txt: 'Belmoment voorbij', sub: 'niemand haalt het venster meer', kind: 'sys' });
      if (v[1] <= T && nogOpen(v[1])) ev.push({ T: v[1], txt: 'Laadvenster voorbij, niet ingevuld', sub: '', kind: 'sys' }); }
    for (const l of r.log || []) ev.push({ T: l.T, txt: l.txt[0].toUpperCase() + l.txt.slice(1), sub: l.who, kind: 'act' });
    for (const n of r.notes || []) ev.push({ T: n.T, txt: 'Notitie', sub: `${n.who}: ${n.txt}`, kind: 'note' });
    if (!z.present && z.closedAt !== null && z.closedAt !== undefined && z.closedBy === 'vanzelf') ev.push({ T: z.closedAt, txt: 'Vanzelf opgelost', sub: z.kind === 'Dock' ? 'De chauffeur kreeg het bericht met het nieuwe dock.' : 'De oorzaak is weg (aangekomen, pauze begonnen of opgehaald).', kind: 'sys' });
    return ev.sort((a, b) => a.T - b.T);
  }
  // een regel in de tijdlijn van een zaak (bijvoorbeeld: rit naar een ander voertuig gezet vanaf de zaak)
  const logZaak = (zk, txt) => { const z = typeof zk === 'string' ? get(zk) : zk; if (!z) return; addLog(z, txt); A.save(); };
  return { update, list: () => list, scoped, counts, open, get, assign, setStatus, addNote, markApplied, timeline, presentAt, ontstaan, inScope, logZaak };
}

// ---------- weergave Meldingen: een lijst of een bord per status ----------
const STAB = [['open', 'Open'], ['wacht', 'Wacht op'], ['opgelost', 'Opgelost'], ['alle', 'Alle']];
const KOLOM = [['nieuw', 'Nieuw'], ['behandeling', 'In behandeling'], ['wacht', 'Wacht op'], ['opgelost', 'Opgelost']];
// deadline: het ontstaan plus de norm van de soort; in de lijst hoeveel tijd er nog is of hoe ver erover (kort: 12 min, 3:30 u)
const duurKort = m => { m = Math.max(0, Math.round(m)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} u`; };
export function slaHtml(z) {
  if (z.status === 'wacht') return `<span class="mut nowrap">terug ${hhmm(z.until)}</span>`;
  if (!z.open) return `<span class="mut">${z.closedAt !== null && z.closedAt !== undefined ? `opgelost ${hhmm(z.closedAt)}` : 'opgelost'}</span>`;
  const cls = z.sla >= 1 ? 'bad' : z.sla >= 0.75 ? 'warn' : '';
  return `<span class="sla ${cls}" title="Open sinds ${hhmm(z.since)}; deadline ${hhmm(z.deadline)} (norm ${z.norm} min)"><b>${z.over > 0 ? `${duurKort(z.over)} over` : z.over === 0 ? 'nu' : `nog ${duurKort(-z.over)}`}</b>${meter(z.sla, cls || 'mut')}</span>`;
}
export const prioHtml = p => `<span class="prio ${p}">${ic(p === 'hoog' ? 'arrowup' : p === 'middel' ? 'minus' : 'arrowdn', 13)}${p === 'hoog' ? 'Hoog' : p === 'middel' ? 'Middel' : 'Laag'}</span>`;
// Een zaak die vanzelf sloot (de oorzaak is weg), heeft het systeem als eigenaar als geen planner hem had, en de status
// "Vanzelf opgelost"; zo staat er nooit "Opgelost · Niemand".
const vanzelf = z => !!z && z.status === 'opgelost' && z.closedBy === 'vanzelf';
export const eigenaarVan = z => (z.who ? z.who : vanzelf(z) ? 'Systeem' : '');
export const ownerHtml = (who, z) => who ? `<span class="nowrap"><span class="av sm">${esc(initials(who))}</span> ${esc(who)}</span>` : vanzelf(z) ? `<span class="nowrap mut">${ic('settings', 13)} Systeem</span>` : '<span class="mut">Niemand</span>';
export const statusHtml = z => (vanzelf(z) ? `<span class="badge z-opgelost">${ic(ZST.opgelost.icon, 12)}Vanzelf opgelost</span>` : zBadge(z.status, z));
const statusTxt = z => (vanzelf(z) ? 'Vanzelf opgelost' : z.status === 'wacht' ? `wacht op ${(WACHT[z.wachtOp] || WACHT.reactie)[0]}` : ZST[z.status].n);
const deadlineTxt = z => z.status === 'wacht' ? `terug ${hhmm(z.until)}` : !z.open ? (z.closedAt !== null && z.closedAt !== undefined ? `${vanzelf(z) ? 'vanzelf opgelost' : 'opgelost'} ${hhmm(z.closedAt)}` : 'opgelost') : z.over > 0 ? `${durTxt(z.over)} over de deadline` : `deadline ${hhmm(z.deadline)}`;

export function renderMeldingen(ctx, el) {
  const Z = ctx.Z;
  if (!ctx.ui.meldMode) { let m = 'lijst'; try { m = ctx.store.get('sl-meldweergave') === 'bord' ? 'bord' : 'lijst'; } catch { /* alleen deze sessie */ } ctx.ui.meldMode = m; }
  // tab en weergave staan in ctx.ui, zodat een slimme knop of een link ze kan zetten
  const tabNu = () => ctx.ui.meldTab || 'open'; const modeNu = () => ctx.ui.meldMode;
  if (!ctx.ui.meldTable) {
    const cols = [
      { k: 'kind', l: 'Melding', w: 170, html: z => `<span class="zk-m">${ic(SOORT[z.kind].icon, 15, z.sev === 'bad' ? 'tbad' : 'twarn')}<span>${esc(z.kind)}</span>${plate(z.obj)}</span>`, csv: z => `${z.kind} ${z.obj}`, req: true },
      { k: 'obj', l: 'Object', w: 90, html: z => plate(z.obj), def: false },
      { k: 'text', l: 'Omschrijving', w: 200, mw: 220, csv: z => z.text },
      { k: 'status', l: 'Status', w: 130, sort: z => ['nieuw', 'behandeling', 'wacht', 'opgelost'].indexOf(z.status), html: z => statusHtml(z), csv: statusTxt },
      { k: 'who', l: 'Eigenaar', w: 120, html: z => ownerHtml(z.who, z), csv: eigenaarVan },
      { k: 'deadline', l: 'Deadline', w: 140, sort: z => z.open ? z.sla : -1, html: slaHtml, csv: z => `${hhmm(z.deadline)} (${Math.round(z.age)} min open, norm ${z.norm})`, desc: true },
      { k: 'urgency', l: 'Prioriteit', w: 96, sort: z => z.open || z.status === 'wacht' ? z.urgency : -1, html: z => z.open || z.status === 'wacht' ? prioHtml(z.prio) : '<span class="mut">–</span>', csv: z => z.open || z.status === 'wacht' ? z.prio : '', desc: true },
      { k: 'rit', l: 'Rit', w: 90, def: false, html: z => z.rit ? esc(z.rit) : '<span class="mut">–</span>', csv: z => z.rit || '' },
      { k: 'spn', l: 'Standplaats', w: 110, mw: 130, def: false },
      { k: 'driver', l: 'Chauffeur', w: 130, mw: 150, def: false, html: z => z.driver ? esc(z.driver) : '<span class="mut">–</span>' },
      { k: 'vs', l: 'Voorstel', w: 170, sort: z => (ctx.voorstelVoor(z.key) || {}).kort || '', html: z => { const p = z.open || z.status === 'wacht' ? ctx.voorstelVoor(z.key) : null; return p ? (ctx.can('act') ? `<button class="btn xs vs-b" type="button" data-pastoe="${esc(p.id)}" title="Pas toe: ${esc(p.action)}">${ic('spark', 13)}<span>${esc(p.kort)}</span></button>` : `<span class="cw" style="max-width:190px" title="${esc(p.action)}">${esc(p.kort)}</span>`) : '<span class="mut">–</span>'; }, csv: z => (ctx.voorstelVoor(z.key) || {}).action || '' },
      { k: 'first', l: 'Ontstaan', w: 90, r: true, sort: z => z.since, html: z => hhmm(z.since), def: false },
      { k: 'div', l: 'Divisie', w: 120, def: false, html: z => esc(ctx.DIV[z.div] ? ctx.DIV[z.div].n : z.div) },
    ];
    ctx.ui.meldTable = createTable(ctx, el, {
      id: 'meldingen', unit: 'meldingen', csvName: 'meldingen.csv', key: z => z.key, cols, sort: ['urgency', -1],
      rows: () => { const L = Z.scoped(); const tab = tabNu(); return modeNu() === 'bord' || tab === 'alle' ? L : tab === 'open' ? L.filter(z => z.open) : L.filter(z => z.status === tab); },
      search: { ph: 'Zoek voertuig, rit of chauffeur', text: z => `${z.obj} ${z.kind} ${z.text} ${z.spn} ${z.driver} ${z.who} ${z.rit || ''}` },
      filters: [
        { id: 'kind', l: 'Soort', kind: 'chips', opts: pool => Object.keys(SOORT).map(k => ({ v: k, l: k, n: pool.filter(z => z.kind === k).length })).filter(o => o.n), test: (z, s) => s.has(z.kind) },
        { id: 'who', l: 'Eigenaar', kind: 'menu', all: 'Iedereen', opts: pool => { const me = ctx.A.settings.naam(); const names = [...new Set(pool.map(z => z.who).filter(w => w && w !== me))].sort((a, b) => a.localeCompare(b, 'nl')); return [{ v: '__mij', l: 'Aan mij', n: pool.filter(z => z.who === me).length }, { v: '__geen', l: 'Niet toegewezen', n: pool.filter(z => !z.who).length }, ...names.map(n => ({ v: n, l: n, n: pool.filter(z => z.who === n).length }))]; }, test: (z, s) => (s.has('__mij') && z.who === ctx.A.settings.naam()) || (s.has('__geen') && !z.who) || s.has(z.who) },
        { id: 'sp', l: 'Standplaats', kind: 'menu', opts: pool => [...new Set(pool.map(z => z.spn))].sort().map(n => ({ v: n, l: n, n: pool.filter(z => z.spn === n).length })), test: (z, s) => s.has(z.spn) },
      ],
      bulk: [
        { id: 'assign', l: 'Toewijzen', icon: 'usercheck', run: (rows, b) => ctx.assignMenu(b, rows) },
        { id: 'status', l: 'Status', icon: 'half', run: (rows, b) => ctx.statusMenu(b, rows) },
        { id: 'done', l: 'Opgelost', icon: 'okc', run: async rows => { if (rows.length > 1 && !(await ctx.L.confirm({ title: `${rows.length} meldingen op opgelost zetten?`, text: 'Zaken die nog spelen, komen terug zodra de simulatie ze opnieuw signaleert. Je kunt het direct ongedaan maken in de melding onderaan.', ok: 'Op opgelost zetten' }))) return; Z.setStatus(rows, 'opgelost'); ctx.ui.meldTable.clearSel(); } },
      ],
      open: z => ctx.go(`melding/${z.id}`),
      menuLabel: z => `${z.kind} ${z.obj}`,
      menu: z => { const can = ctx.can('act'); const p = z.open || z.status === 'wacht' ? ctx.voorstelVoor(z.key) : null; const tb = ctx.ui.meldTable; const el2 = tb && document.querySelector(`[data-row="${CSS.escape(z.key)}"]`); return [
        { l: 'Open zaak', icon: 'alert', run: () => ctx.go(`melding/${z.id}`) },
        can && p && { l: `Pas toe: ${p.kort}`, icon: 'spark', run: () => ctx.applyProposal(p) },
        can && z.status !== 'opgelost' && { l: 'Toewijzen', icon: 'usercheck', run: () => ctx.assignMenu(el2 || document.body, [z]) },
        can && z.status !== 'opgelost' && { l: 'Status', icon: 'half', run: () => ctx.statusMenu(el2 || document.body, [z]) },
        can && z.status !== 'opgelost' && { l: 'Opgelost', icon: 'okc', run: () => Z.setStatus([z], 'opgelost') },
        { sep: true },
        z.t && { l: 'Op de kaart', icon: 'map', run: () => ctx.go(`kaart:truck:${z.t.id}`) },
        z.tr && !z.t && { l: 'Op de kaart', icon: 'map', run: () => ctx.go(`kaart:trailer:${z.tr.id}`) },
        z.rit && { l: `Rit ${z.rit}`, icon: 'route', run: () => ctx.go(`rit/${z.rit}`) },
      ]; },
      rowCls: z => z.open ? '' : 'dim',
      emptyTxt: () => { const tab = tabNu(); return tab === 'open' ? ['Geen open meldingen in je werkgebied', 'Nieuwe uitzonderingen verschijnen hier vanzelf, op urgentie gesorteerd. Afgehandelde staan onder Opgelost.'] : tab === 'wacht' ? ['Niets wacht', 'Zet een melding op wacht als je op een chauffeur, klant of garage wacht; hij komt op tijd terug.'] : tab === 'opgelost' ? ['Nog niets opgelost vandaag', 'Zaken die vanzelf of door een toegepast voorstel sluiten, komen hier te staan.'] : ['Geen meldingen', '']; },
      tools: () => `<span class="seg" role="group" aria-label="Weergave"><button type="button" data-mview="lijst" aria-pressed="${modeNu() === 'lijst'}">${ic('list', 15)}Lijst</button><button type="button" data-mview="bord" aria-pressed="${modeNu() === 'bord'}">${ic('columns', 15)}Bord</button></span>`,
      // de tellers staan op de tabbladen (en over de deadline in de ondertitel); op het bord staan ze boven de kolommen
      head: () => { const c = Z.counts(); const tab = tabNu(); return modeNu() === 'bord' ? '' : `<div class="tv-head" style="padding-bottom:0;border-bottom:0"><div class="tabs" role="tablist" style="margin:0">${STAB.map(([k, n]) => `<button class="tab" role="tab" type="button" aria-selected="${tab === k}" data-mtab="${k}">${n} <span class="n">${fmt(c[k])}</span>${k === 'open' && c.verlopen ? ` <small class="tab-over" title="over de deadline">${fmt(c.verlopen)} <span class="lang">over de deadline</span><span class="kort">te laat</span></small>` : ''}</button>`).join('')}</div></div>`; },
      custom: view => modeNu() === 'bord' ? bordHtml(ctx, view) : null,
      onMount: e => {
        on(e, 'click', '[data-mtab]', (ev, b) => { ctx.ui.meldTab = b.dataset.mtab; const t = ctx.ui.meldTable; t.st.sort = ctx.ui.meldTab === 'opgelost' ? ['first', -1] : ['urgency', -1]; t.refresh(true, true); });
        on(e, 'click', '[data-mview]', (ev, b) => { ctx.ui.meldMode = b.dataset.mview; try { ctx.store.set('sl-meldweergave', ctx.ui.meldMode); } catch { /* alleen deze sessie */ } e.classList.toggle('bordmode', modeNu() === 'bord'); ctx.ui.meldTable.refresh(true, true); });
        on(e, 'click', '[data-pastoe]', (ev, b) => { ev.stopPropagation(); const p = ctx.voorstelById(b.dataset.pastoe); if (p) ctx.applyProposal(p); });
        bindBord(ctx, e);
      },
      mobile: { t: z => `${ic(SOORT[z.kind].icon, 15, z.sev === 'bad' ? 'tbad' : 'twarn')} ${esc(z.kind)} ${plate(z.obj)}`, r: z => statusHtml(z), m: z => `${esc(z.text)}<br>${esc(z.spn)} · ${esc(deadlineTxt(z))} · ${esc(eigenaarVan(z) || 'niemand')}` },
    });
  }
  el.classList.toggle('bordmode', modeNu() === 'bord');
  ctx.ui.meldTable.refresh(true);
}

// ---------- het bord: een kolom per status, kaarten op urgentie; slepen of Alt met pijl naar links of rechts ----------
function bordHtml(ctx, view) {
  const T = ctx.state.simTime; const can = ctx.can('act'); const alle = ctx.ui.kbAlle;
  const per = { nieuw: [], behandeling: [], wacht: [], opgelost: [] }; for (const z of view) per[z.status].push(z);
  per.nieuw.sort((a, b) => b.urgency - a.urgency); per.behandeling.sort((a, b) => b.urgency - a.urgency); per.wacht.sort((a, b) => a.until - b.until); per.opgelost.sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
  const kaart = z => {
    const dl = deadlineTxt(z); const over = z.open && z.over > 0; const eig = eigenaarVan(z);
    return `<article class="kb-c ${z.open ? `p-${z.prio}` : 'dicht'}" ${can ? 'draggable="true"' : ''} tabindex="0" data-kz="${esc(z.key)}" data-fk="${esc(z.key)}" aria-label="${esc(`${z.kind} ${z.obj}, ${statusTxt(z).toLowerCase()}, ${dl}${eig ? `, eigenaar ${eig}` : ', geen eigenaar'}`)}">
      <div class="kb-t">${ic(SOORT[z.kind].icon, 15, z.sev === 'bad' ? 'tbad' : 'twarn')}<b>${esc(z.kind)}</b>${plate(z.obj)}<span class="grow"></span>${z.open || z.status === 'wacht' ? prioHtml(z.prio) : ''}</div>
      <p class="kb-x">${esc(z.text)}</p>
      <div class="kb-m">${z.who ? `<span class="av sm" title="${esc(z.who)}">${esc(initials(z.who))}</span><span class="kb-w">${esc(z.who)}</span>` : vanzelf(z) ? `<span class="mut">${ic('settings', 13)} Systeem</span>` : '<span class="mut">Niemand</span>'}<span class="grow"></span><span class="${over ? 'tbad' : 'mut'} nowrap">${esc(dl)}</span>${can && z.status !== 'opgelost' ? `<button class="ib xs" type="button" data-kmenu="${esc(z.key)}" aria-label="Status van ${esc(z.kind)} ${esc(z.obj)}" title="Status">${ic('more', 15)}</button>` : ''}</div>
    </article>`;
  };
  const MAX = 10;
  return `<div class="kb" data-kb="1">${KOLOM.map(([k, n]) => { const L = per[k]; const show = k === 'opgelost' && !alle ? L.slice(0, MAX) : L; return `<section class="kb-col k-${k}" data-kcol="${k}" aria-label="${esc(n)}, ${L.length} ${L.length === 1 ? 'zaak' : 'zaken'}">
    <header><span class="badge z-${k}">${ic(ZST[k].icon, 12)}${esc(n)}</span><b>${fmt(L.length)}</b></header>
    <div class="kb-l" data-kdrop="${k}">${show.map(kaart).join('') || `<p class="kb-e">${k === 'nieuw' ? 'Niets nieuws. Wat groen is, vraagt niets.' : k === 'behandeling' ? 'Niemand is met een zaak bezig.' : k === 'wacht' ? 'Niets wacht op iemand.' : 'Nog niets opgelost.'}</p>`}${L.length > show.length ? `<button class="btn ghost sm" type="button" data-kball="1">Toon alle ${fmt(L.length)}</button>` : ''}</div>
  </section>`; }).join('')}</div>${can ? '<p class="hint kb-hint">Sleep een kaart naar een andere kolom, of kies de kaart en druk Alt met pijl links of rechts. Enter opent de zaak.</p>' : ''}`;
}
const VOLG = ['nieuw', 'behandeling', 'wacht', 'opgelost'];
function bindBord(ctx, el) {
  const Z = ctx.Z; let sleep = null;
  const zet = (z, st) => {
    if (!z || z.status === st || !ctx.can('act')) return;
    if (st === 'wacht') Z.setStatus([z], 'wacht', 0, 'reactie'); else Z.setStatus([z], st, 0, null, { mij: true });
    requestAnimationFrame(() => { const n = el.querySelector(`[data-kz="${CSS.escape(z.key)}"]`); if (n) n.focus({ preventScroll: true }); });
  };
  on(el, 'click', '[data-kz]', (e, c) => { if (e.target.closest('button')) return; const z = Z.get(c.dataset.kz); if (z) ctx.go(`melding/${z.id}`); });
  on(el, 'click', '[data-kmenu]', (e, b) => { e.stopPropagation(); const z = Z.get(b.dataset.kmenu); if (z) ctx.statusMenu(b, [z]); });
  on(el, 'click', '[data-kball]', () => { ctx.ui.kbAlle = !ctx.ui.kbAlle; ctx.ui.meldTable.refresh(true); });
  on(el, 'keydown', '[data-kz]', (e, c) => {
    const z = Z.get(c.dataset.kz); if (!z) return;
    if (e.key === 'Enter') { e.preventDefault(); ctx.go(`melding/${z.id}`); return; }
    if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); const i = VOLG.indexOf(z.status) + (e.key === 'ArrowRight' ? 1 : -1); if (i >= 0 && i < VOLG.length) zet(z, VOLG[i]); return; }
    if (!e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const L = [...c.parentElement.querySelectorAll('[data-kz]')]; const n = L[L.indexOf(c) + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); }
  });
  el.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('[data-kz]'); if (!c) return; sleep = c.dataset.kz; c.classList.add('sleept'); try { e.dataTransfer.setData('text/plain', sleep); e.dataTransfer.effectAllowed = 'move'; } catch { /* oude browser */ } ctx.ui.kbSleept = true; });
  el.addEventListener('dragend', e => { const c = e.target.closest && e.target.closest('[data-kz]'); if (c) c.classList.remove('sleept'); el.querySelectorAll('.kb-col.over').forEach(x => x.classList.remove('over')); sleep = null; ctx.ui.kbSleept = false; });
  el.addEventListener('dragover', e => { const col = e.target.closest && e.target.closest('[data-kcol]'); if (!col || !sleep) return; e.preventDefault(); el.querySelectorAll('.kb-col.over').forEach(x => { if (x !== col) x.classList.remove('over'); }); col.classList.add('over'); });
  el.addEventListener('dragleave', e => { const col = e.target.closest && e.target.closest('[data-kcol]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
  el.addEventListener('drop', e => { const col = e.target.closest && e.target.closest('[data-kcol]'); if (!col || !sleep) return; e.preventDefault(); const z = Z.get(sleep); col.classList.remove('over'); sleep = null; ctx.ui.kbSleept = false; zet(z, col.dataset.kcol); });
}

// ---------- zaakpagina (#melding/<id>) ----------
// Kop met naam en status, de statusbalk (klik een stap om de status te zetten), slimme knoppen naar wat erbij hoort,
// de drie getallen die ertoe doen, dan de voorstellen en onderaan het logboek.
const vsCache = new Map();
// de geplande begintijd van een rit die door een eerdere vertraging opschoof (gepland op zijn eerste rijstuk), anders null
function geplandeStart(t, r) { const P = t.plan; for (let i = r.i0; i <= r.i1; i++) { const x = P[i]; if (x && x.k === 'drive' && x.gepland !== undefined) { const schuif = t.dayStart + x.t1 - (x.delay || 0) - x.gepland; return schuif >= 1 ? t.dayStart + P[r.i0].t0 - schuif : null; } } return null; }
// de ritten van het voertuig die door de zaak in gevaar komen, met de beste plek elders (getoetst met toets.js)
function ritVoorstellen(ctx, z) {
  const t = z.t; if (!t || !(z.open || z.status === 'wacht') || !ctx.can('act')) return [];
  const T = ctx.state.simTime; const S = ctx.S; const s = S.get(t.id);
  const gepland = ctx.R.ofTruck(t).filter(r => ctx.R.stateOf(r, T, S).st === 'gepland');
  let L = [];
  if (z.kind === 'Techniek') L = gepland;
  else if (z.kind === 'Vertraging' && s && s.next) { const terug = s.next.home ? s.next.eta : (ctx.R.ritOf(t, T) || { end: T }).end + (s.next.delay || 0); L = gepland.filter(r => r.dep < terug + 20); }
  else if (z.kind === 'Accu') L = gepland.slice(0, 1);
  L = L.slice(0, 2); if (!L.length) return [];
  const sig = `${z.key}|${ctx.R.ver()}|${Math.floor(T / 5)}`; const c = vsCache.get(sig); if (c) return c;
  // een rit die door een vertraging opschoof, zoekt een plek op zijn geplande tijd (dan wint hij die minuten terug), en niet
  // op het voertuig dat de assistent al voorstelt (zodat dit een echt alternatief is)
  const p = ctx.voorstelVoor(z.key); const al = p && p.act && p.act.naar;
  const out = L.map(r => {
    const g = z.kind === 'Vertraging' ? geplandeStart(t, r) : null; if (g === null) return { r, k: IP.besteVoor(ctx, r) };
    const start = Math.max(g, Math.ceil((T + 20) / 5) * 5); let K = []; try { K = plekKandidaten(ctx, ritInvoer(r), { zonder: r, start, max: 6 }); } catch { K = []; }
    return { r, k: K.find(k => k.uitslag.ok && k.t !== t && k.t.id !== al) || null };
  }).filter(x => x.k);
  if (vsCache.size > 40) vsCache.clear(); vsCache.set(sig, out); return out;
}
// de dockwissel van een dockzaak: de eerste wissel die de chauffeur nog niet hoorde in de rit van de zaak (fleet.dockWissels)
function wisselVan(ctx, t, rit, T) {
  if (!t || !ctx.fleet.dockWissels) return t ? ctx.fleet.dockWissel(t, T) : null;
  const L = ctx.fleet.dockWissels(t, T); if (!rit) return L[0] || null;
  const r = ctx.R.get(rit); if (!r) return L[0] || null;
  return L.find(w => { const i = t.plan.indexOf(w.seg); return i >= r.i0 && i <= r.i1; }) || null;
}
export function zaakPage(ctx, id) {
  const z = ctx.Z.get(id); if (!z) return null;
  const T = ctx.state.simTime; const p = z.open || z.status === 'wacht' ? ctx.voorstelVoor(z.key) : null; const can = ctx.can('act');
  const d = z.data || {}; const t = z.t; const tr = z.tr; const gp = z.p || null; const s = t ? ctx.S.get(t.id) : null; const ts = tr ? ctx.trailerState(tr) : null;
  // de rit om te verplaatsen: die van de zaak als hij nog niet begon, anders de volgende geplande rit van het voertuig
  const zr0 = z.rit ? ctx.R.get(z.rit) : null; const gepland = r => ctx.R.stateOf(r, T, ctx.S).st === 'gepland';
  const zrit = zr0 && gepland(zr0) ? zr0 : t ? ctx.R.ofTruck(t).find(r => r !== zr0 && gepland(r)) || null : null;
  let k3 = [];
  const vt = z.kind === 'Vertraging' && t ? ctx.fleet.vertraging(t, T) : null; const dw = z.kind === 'Dock' && t ? wisselVan(ctx, t, z.rit, T) : null;
  // ligt de eerste stop die te laat komt in een volgende rit, dan staat die rit erbij (de zaak hoort bij de rit van nu)
  const vtRit = vt ? (ctx.R.ofTruck(t).find(r => vt.eerste.i >= r.i0 && vt.eerste.i <= r.i1) || {}).id || null : null;
  if (vt) k3 = [['ETA', hhmm(vt.eerste.eta), `${esc(vt.eerste.naam)}${vtRit && vtRit !== z.rit ? ` · rit ${esc(vtRit)}` : ''}`], ['Te laat', `${vt.eerste.laat} <em>min</em>`, `venster ${hhmm(vt.eerste.venster[0])}–${hhmm(vt.eerste.venster[1])}`], ['Achter op plan', `+${vt.achter} <em>min</em>`, `${vt.laat.length} ${vt.laat.length === 1 ? 'stop' : 'stops'} na het venster`]];
  else if (z.kind === 'Vertraging') k3 = [['ETA', s && s.next ? hhmm(s.next.eta) : '–', s && s.next ? esc(s.next.name) : ''], ['Afwijking', d.delay ? `+${d.delay} <em>min</em>` : '–', s && s.next && s.next.win ? `venster ${hhmm(s.next.win[0])}–${hhmm(s.next.win[1])}` : 'geen venster'], ['Status', s ? ctx.VST[s.st].n : '–', t ? esc(t.base.n) : '']];
  else if (z.kind === 'Dock') k3 = [['Nieuw dock', dw ? `${dw.nieuw}` : d.dock ? `${d.dock}` : '–', dw ? `was dock ${dw.oud}` : ''], ['Om', dw ? hhmm(dw.a) : d.om ? hhmm(d.om) : '–', dw ? `${dw.soort === 'aankomst' ? 'afkoppelen' : dw.soort === 'laden' ? 'laden' : 'koppelen'}${dw.begonnen ? ', al begonnen' : ''}` : ''], ['Bericht', dw ? (dw.begonnen ? '<span class="tbad">Nog niet</span>' : 'Nog niet') : 'Verstuurd', dw ? `${dw.begonnen ? `al bezig aan dock ${dw.oud}` : 'de chauffeur weet het nog niet'} · dock ${dw.oud} buiten gebruik tot ${hhmm(dw.tot)}` : 'de chauffeur weet het']];
  else if (z.kind === 'Rijtijd') k3 = [['Rijtijd', s ? `${fmtDrive(s.drive)} <em>/ 4:30</em>` : '–', 'sinds de laatste pauze'], ['Pauze uiterlijk', s ? hhmm(T + Math.max(0, 270 - s.drive)) : '–', s ? `over ${durTxt(Math.max(0, 270 - s.drive))}` : ''], ['Volgende stop', s && s.next ? hhmm(s.next.eta) : '–', s && s.next ? esc(s.next.name) : '']];
  else if (z.kind === 'Accu') k3 = [['Accu', s ? `${Math.round(s.soc)} <em>%</em>` : '–', t ? `${Math.round(t.range * (s ? s.soc : 0) / 100)} km bereik` : ''], ['Volgende stop', s && s.next ? hhmm(s.next.eta) : '–', s && s.next ? esc(s.next.name) : ''], ['Nog te rijden', s && s.next ? `${nl1(s.next.kmLeft)} <em>km</em>` : '–', 'tot de volgende stop']];
  else if (z.kind === 'Techniek') k3 = [['Storing', 'Boordcomputer', esc(t ? t.storing || '' : '')], ['Status', s ? ctx.VST[s.st].n : '–', s && s.next ? `volgende: ${esc(s.next.name)}` : ''], ['Volgende dienst', t && t.diensten.find(x => x.start > T) ? hhmm(t.diensten.find(x => x.start > T).start) : 'geen', t && t.diensten.find(x => x.start > T) ? esc(t.diensten.find(x => x.start > T).driver) : 'vandaag niet meer']];
  else if (z.kind === 'Koeling') { const tt = TRT[tr.type]; const temp = ctx.fleet.trailerTemp(tr, T); k3 = [['Temperatuur', temp !== null ? `${nl1(temp)} <em>°C</em>` : '–', tt.temp ? `doel ${tt.temp[0]} tot ${tt.temp[1]} °C` : ''], ['Lading', ts && ts.lading ? esc(ts.lading.split(',')[0]) : 'leeg', ts && ts.vehicle ? `achter ${ts.vehicle.id}` : esc(ts ? ts.place || '' : '')], ['Oplegger', esc(tt.n), esc(tr.base.n)]]; }
  else if (z.kind === 'Oplegger') k3 = [['Wacht sinds', ts && ts.unloadAt !== undefined ? hhmmDag(ts.unloadAt) : '–', esc(ts ? ts.place || '' : '')], ['Ophalen gepland', ts && ts.pickup !== undefined ? hhmmDag(ts.pickup) : '–', ts && ts.pickup !== undefined ? `${durTxt(Math.max(0, day(T - ts.pickup)))} geleden` : ''], ['Oplegger', esc(TRT[tr.type].n), esc(tr.base.n)]];
  // een rit die niemand rijdt: de fase nu (invulling.ritFase: bel, laat, gemist) en het laatste belmoment, als de rit toen al
  // bekend was
  const fase = gp && z.open ? ritFase(ctx, gp, T) : null;
  const bm = gp ? belmoment(ctx, gp) : null; const B = bm && bm.T !== null && bm.T >= Math.max(0, gp.bekend) ? bm.T : null;
  // korte waarden (ze passen ook op 390 px in de drie vakken); de klant en de uitleg staan eronder
  if (gp) {
    const v = vensterVandaag(gp); const n = (gp.stops || []).length; const rd = REDEN[gp.reden] || gp.reden || 'open rit';
    const reden = ['Reden', esc(REDEN_KORT[gp.reden] || rd), `${esc(rd.toLowerCase())} · ${gp.bekend < 0 ? 'sinds gisteren' : `binnen om ${hhmm(gp.bekend)}`}`];
    if (fase === 'bel' || fase === 'laat') k3 = [['Uiterlijk vragen', B !== null ? hhmm(B) : '–', fase === 'bel' ? 'daarna haalt niemand het venster' : B !== null ? 'voorbij: niemand haalt het venster' : 'niemand haalde het venster'], ['Laden tot', hhmm(v[1]), `vanaf ${hhmm(v[0])} · ${esc(klantKort(gp.klant))}`], reden];
    else k3 = [['Laden tot', hhmm(v[1]), gp.morgenEerste ? `nu morgen ${hhmm(gp.venster[0])}–${hhmm(gp.venster[1])}` : gp.gepland && gp.toegewezen ? `vertrek ${hhmm(gp.toegewezen.start)}` : `vanaf ${hhmm(v[0])} · voorbij`], ['Stops', `${n}`, `${esc(klantKort(gp.klant))} · uit ${esc(gp.sp)}`], reden];
  }
  const slaCls = z.open ? (z.sla >= 1 ? 'bad' : z.sla >= 0.75 ? 'warn' : '') : 'ok';
  // logboek: de tijdlijn, nieuwste onderaan, met wat het voertuig deed in een rustige kleur
  const tl = ctx.Z.timeline(z).map(e => `<li class="tli ${e.kind === 'act' || e.kind === 'note' ? 'act' : e.kind === 'veh' ? 'veh' : 'done'}"><time>${hhmmDag(e.T)}</time><div class="tl-c"><b>${esc(e.txt)}</b>${e.sub ? `<span>${esc(e.sub)}</span>` : ''}</div></li>`).join('');
  // voorstellen: de assistent (met het effect) en per rit in gevaar de beste plek elders
  const RV = ritVoorstellen(ctx, z);
  // een rit die niemand rijdt: zolang iemand het venster haalt (fase bel), wie je nu vraagt (invulling.haaltVenster: de
  // grootste kans op een ja); daarna de beste charter die nog een wagen vrij heeft (vertrekt na het venster)
  let KDn = null; if (gp && z.open) { try { KDn = kandidatenVan(ctx, gp); } catch { KDn = null; } }
  // de aanbevolen kandidaat (invulling.besteVoor: dezelfde als in Open ritten en op het planbord, niemand twee keer), als hij
  // het venster haalt; de groep om tegelijk te vragen (invulling.samenVragen: allemaal halen ze het venster); wie al tegelijk
  // gevraagd is
  const v1b = gp ? vensterVandaag(gp)[1] : 0;
  const vraag = KDn && fase === 'bel' && can && KDn.best && KDn.best.beschikbaar && typeof KDn.best.vertrek === 'number' && KDn.best.vertrek <= v1b ? KDn.best : null;
  const S = vraag && KDn.samen ? KDn.samen : null;
  const al = gp ? (gp.contact || []).filter(c => c.soort === 'samen') : []; const alGevraagd = fase === 'bel' && al.length > 0;
  const alKand = alGevraagd ? al.map(c => { const k = (KDn ? KDn.alle : []).find(x => x.naam === c.wie) || alleKandidaten(ctx, gp).find(x => x.naam === c.wie) || null; return { naam: c.wie, k: k && k.beschikbaar ? k : null }; }) : [];
  // na het belmoment of het venster (fasen laat en gemist): één regel met Open ritten (invulling.hoofdLaat): de kandidaat die
  // binnen 120 minuten na het einde van het venster kan vertrekken is de hoofdactie, anders morgen als eerste; wie later
  // kan (vaak een charter die nog moet aanrijden) is een gewone keuze
  const na = gp && z.open && can && (fase === 'laat' || fase === 'gemist') ? hoofdLaat(ctx, gp) : null;
  const vraagLaat = na && na.soort === 'kandidaat' ? na.k : null; const laterK = na ? na.later : null;
  const nogIemand = KDn ? KDn.alle.some(k => k.beschikbaar) : undefined;
  // een oplegger die te lang bij een klant staat zonder voorstel van de assistent: de eerste stap is het ophalen inplannen
  const ophalen = !p && z.open && can && z.kind === 'Oplegger' && tr;
  // één hoofdknop per pagina: het voorstel van de assistent, anders (een open rit) de groep tegelijk vragen, wie het venster
  // haalt, de charter of morgen als eerste, anders de eerste plek elders, anders de rit verplaatsen. Is de groep al gevraagd,
  // dan is de hoofdknop het ja van de meest waarschijnlijke
  const hoofd = p ? 'pastoe' : gp && z.open ? (alGevraagd ? 'ja' : S ? 'tegelijk' : vraag ? 'vraag' : vraagLaat ? 'laat' : 'morgen') : RV.length ? 'zethier' : zrit ? 'verplaats' : ophalen ? 'ophalen' : null;
  const effect = p && p.effect && p.effect.length ? `<ul class="eff">${p.effect.map(x => `<li class="${x.cls || ''}">${esc(x.t)}</li>`).join('')}</ul>` : '';
  const assist = p ? `<section class="prop focus" aria-label="Voorstel van de assistent"><div class="prop-h">${ic('spark', 15)}Voorstel van de assistent · ${esc(p.kort)}</div><p>${esc(p.action)}</p>${effect}${berichtHtml(p)}<details><summary>Waarom dit voorstel</summary><div>${esc(p.why)}</div></details><div class="prop-a">${can ? `<button class="btn pri" type="button" data-pastoe="${esc(p.id)}" id="zaakPasToe">${ic('check', 15)}Pas toe</button>` : '<span class="hint">Alleen planners en regiomanagers passen voorstellen toe.</span>'}<span class="hint">${esc(p.hint || 'Het plan verandert echt: dagplan, ETA\'s en het vertrekbord schuiven mee, de chauffeur krijgt een bericht.')}</span></div></section>`
    : z.rec.applied ? `<section class="prop done"><div class="prop-h">${ic('okc', 15)}Voorstel toegepast</div><p>${esc(z.rec.applied)}</p></section>` : '';
  const ritVs = RV.map(({ r, k }, i) => { const lo = k.uitslag.regels.filter(x => x.ernst === 'let op').slice(0, 2); return `<section class="prop" aria-label="Rit ${esc(r.id)} elders"><div class="prop-h">${ic('target', 15)}Waar past rit ${esc(r.id)}?</div><p>${k.nieuw ? `Op <b>${esc(k.t.id)}</b> als nieuwe dienst met ${esc(k.wie || 'een reservechauffeur')}` : `Op <b>${esc(k.t.id)}</b> in de dienst van ${esc(k.wie)}`}, vertrek ${hhmm(k.start)}. ${esc(r.klant)} · ${esc(r.dest.slice(0, 2).join(', '))}.</p><p class="eff1">${IP.effectHtml(k.uitslag)}</p>${lo.length ? `<ul class="wp-r">${lo.map(x => `<li class="twarn">${ic('alert', 13)}${esc(x.tekst)}</li>`).join('')}</ul>` : ''}<div class="prop-a"><button class="btn ${hoofd === 'zethier' && i === 0 ? 'pri' : ''}" type="button" data-zkies="${i}">${ic('swap', 15)}Zet hier</button><button class="btn ghost" type="button" data-zwaar="${esc(r.id)}">Andere plekken</button><span class="hint">Getoetst op overlap, venster, rijtijd, rust, accu, oplegger en dock.</span></div></section>`; }).join('');
  // een rit die niemand rijdt: de keuzes (wie het venster haalt, of alsnog een charter), morgen als eerste, de klant laten
  // weten, alle kandidaten
  const kp = gp ? klantPlanning(gp) : null; const mv = gp ? morgenVenster(gp) : null; const v1 = gp ? vensterVandaag(gp)[1] : 0;
  const pctK = k => Math.round((k.kans || 0) * 100);
  const tgHtml = alGevraagd ? `<section class="prop focus" aria-label="Tegelijk gevraagd"><div class="prop-h">${ic('users', 15)}Tegelijk gevraagd om ${hhmm(al[0].T)}</div><p>${esc(namenTxt(al.map(c => c.wie)))}. Wie het eerst ja zegt, krijgt de rit: noteer het ja hier, dan staat de rit op het planbord en gaat de zaak dicht.</p><div class="prop-a">${alKand.map((x, i) => (x.k ? `<button class="btn sm ${hoofd === 'ja' && i === 0 ? 'pri' : ''}" type="button" data-nja="${esc(x.k.soort)}:${esc(x.k.id)}">${ic('check', 14)}Ja van ${esc(x.naam)}</button>` : `<span class="hint">${esc(x.naam)}: niet meer beschikbaar</span>`)).join('')}</div></section>`
    : S ? `<section class="prop focus" aria-label="Vraag tegelijk uit"><div class="prop-h">${ic('users', 15)}Vraag tegelijk uit · ${S.wie.length} mensen</div><p>${esc(namenTxt(S.wie.map(k => k.naam)))}: samen ${S.kans} % kans op minstens één ja, tegen ${S.alleen} % als je alleen ${esc(vraag.naam)} vraagt (schatting). Allemaal halen ze het venster als je nu vraagt; één bericht, wie het eerst ja zegt krijgt de rit.</p><ul class="eff">${S.wie.map(k => `<li class="ok">${esc(k.naam)} (${esc(wieSoort(k))}) · vertrek ${hhmm(k.vertrek)} · ${pctK(k)} %</li>`).join('')}</ul><div class="prop-a"><button class="btn ${hoofd === 'tegelijk' ? 'pri' : ''}" type="button" data-ntegelijk="1">${ic('send', 15)}Vraag ze tegelijk</button><span class="hint">Demo: er gaat geen bericht de deur uit. In het echt via de chauffeursapp of sms.</span></div></section>` : '';
  const vrHtml = vraag && !(alGevraagd && al.some(c => c.wie === vraag.naam)) ? `<section class="prop ${hoofd === 'vraag' ? 'focus' : ''}" aria-label="Iemand die het venster haalt"><div class="prop-h">${ic('send', 15)}${S ? 'Of alleen de beste' : 'Haalt het venster'} · ${esc(vraag.naam)}</div><p>${esc(vraag.naam)} (${esc(wieSoort(vraag))}) kan om ${hhmm(vraag.vertrek)} weg als je nu vraagt.${B !== null ? ` Na ${hhmm(B)} haalt niemand het venster meer.` : ''}${vraag.gedeeld ? ' Let op: ook de eerste keus van een andere open rit.' : ''}</p><ul class="eff"><li class="ok">vertrek ${hhmm(vraag.vertrek)}, binnen het venster tot ${hhmm(v1)}</li><li>${Math.round((vraag.kans || 0) * 100)} % kans op een ja (schatting)</li><li>kosten ongeveer ${euro(vraag.kosten ? vraag.kosten.bedrag : 0)} (${esc(kostenNoot(vraag))})</li></ul><div class="prop-a"><button class="btn ${hoofd === 'vraag' ? 'pri' : ''}" type="button" data-nvraag="1">${ic('send', 15)}Vraag ${esc(vraag.naam)}</button><span class="hint">De rit staat daarna gearceerd op het planbord tot er een ja is.</span></div></section>` : '';
  const naTxt = k => naVensterTxt(k.vertrek - v1);
  const laatHtml = vraagLaat ? `<section class="prop focus" aria-label="Kan nog, na het venster"><div class="prop-h">${ic('send', 15)}Kan nog, na het venster · ${esc(vraagLaat.naam)}</div><p>${esc(vraagLaat.naam)} (${esc(wieSoort(vraagLaat))}) vertrekt ${esc(naTxt(vraagLaat))} (om ${hhmm(vraagLaat.vertrek)}), binnen twee uur na het einde van het venster${vraagLaat.gedeeld ? '; let op: ook de eerste keus van een andere open rit' : ''}.</p><ul class="eff"><li class="bad">vertrekt ${esc(naTxt(vraagLaat))}</li><li>${Math.round((vraagLaat.kans || 0) * 100)} % kans op een ja (schatting)</li><li>kosten ongeveer ${euro(vraagLaat.kosten ? vraagLaat.kosten.bedrag : 0)} (${esc(kostenNoot(vraagLaat))})</li></ul><div class="prop-a"><button class="btn ${hoofd === 'laat' ? 'pri' : ''}" type="button" data-nlaat="1">${ic('send', 15)}Vraag ${esc(vraagLaat.naam)}</button><span class="hint">De rit staat daarna gearceerd op het planbord tot er een ja is.</span></div></section>` : '';
  const laterHtml = laterK ? `<section class="prop" aria-label="Kan later"><div class="prop-h">${ic(laterK.soort === 'charter' ? 'truck' : 'send', 15)}Kan later · ${esc(laterK.naam)}</div><p>${esc(laterK.naam)} (${esc(wieSoort(laterK))}) vertrekt pas ${esc(naTxt(laterK))} (om ${hhmm(laterK.vertrek)})${laterK.soort === 'charter' ? ': de charter moet nog aanrijden' : ''}. Alleen als de klant dat wil; anders morgen als eerste.</p><ul class="eff"><li class="bad">vertrekt ${esc(naTxt(laterK))}</li><li>${Math.round((laterK.kans || 0) * 100)} % kans op een ja (schatting)</li><li>kosten ongeveer ${euro(laterK.kosten ? laterK.kosten.bedrag : 0)} (${esc(kostenNoot(laterK))})</li></ul><div class="prop-a"><button class="btn" type="button" data-nlater="1">${ic('send', 15)}Vraag ${esc(laterK.naam)}</button></div></section>` : '';
  const chHtml = laatHtml + laterHtml;
  const ophalenHtml = ophalen ? `<section class="prop focus" aria-label="Ophalen inplannen"><div class="prop-h">${ic('gantt', 15)}Ophalen inplannen</div><p>De assistent vond geen trekker die ${esc(tr.id)} onderweg kan meenemen. Zet het ophalen op het planbord van ${esc(tr.base.n)}: kies een trekker die terugkomt of een reservewagen, en sleep een rit langs ${esc(ts && ts.place ? ts.place : 'de klant')}.</p><div class="prop-a"><button class="btn ${hoofd === 'ophalen' ? 'pri' : ''}" type="button" data-ztrplan="1">${ic('gantt', 15)}Ophalen inplannen</button><button class="btn" type="button" data-open="oplegger/${esc(tr.id)}/vandaag">${ic('trailer', 15)}Open de oplegger</button></div></section>` : '';
  const keuzes = gp && z.open && can ? `${tgHtml}${vrHtml}${chHtml}<section class="prop" aria-label="Morgen als eerste"><div class="prop-h">${ic('cal', 15)}Morgen als eerste</div><p>De rit gaat naar de open ritten van morgen: laden ${hhmm(mv[0])} tot ${hhmm(mv[1])}, voor de rest van de ritten uit. Spreek het af met de klant; vandaag telt hij als gemist.</p><div class="prop-a"><button class="btn ${hoofd === 'morgen' ? 'pri' : ''}" type="button" data-nmorgen="1">${ic('cal', 15)}Zet morgen als eerste</button></div></section>
    <section class="prop" aria-label="De klant laten weten"><div class="prop-h">${ic('phone', 15)}De klant laten weten</div><p>${esc(kp.naam)}: bel, of kopieer het bericht. Demo: er wordt niet gebeld en er gaat niets de deur uit.</p><p class="kd-msg">${esc(klantBerichtGemist(gp, nogIemand, fase || 'gemist'))}</p><div class="prop-a">${belKnop(kp.naam, kp.tel, { extra: 'data-nbel="1"' })}<button class="btn sm" type="button" data-nbericht="1">${ic('copy', 14)}Kopieer bericht</button></div></section>
    <section class="prop" aria-label="Alle kandidaten"><div class="prop-h">${ic('users', 15)}Alle kandidaten</div><p>Eigen chauffeurs, oproepkrachten en charters met de kans op een ja, het vertrek en de kosten (schatting).${fase === 'bel' ? '' : ' Wie nu nog kan, vertrekt na het venster.'}</p><div class="prop-a"><button class="btn sm" type="button" data-open="openritten/${esc(gp.id)}">${ic('inbox', 15)}Open de rit</button></div></section>`
    : gp && !z.open && (gp.morgenEerste || gp.gepland) ? `<section class="prop done"><div class="prop-h">${ic('okc', 15)}${gp.morgenEerste ? 'Morgen als eerste' : 'Toegewezen'}</div><p>${gp.morgenEerste ? `Laden morgen ${hhmm(gp.venster[0])} tot ${hhmm(gp.venster[1])}; de rit staat bij de open ritten van morgen.` : `${esc(gp.toegewezen ? gp.toegewezen.naam : 'Toegewezen')}, vertrek ${hhmm(gp.toegewezen ? gp.toegewezen.start : vensterVandaag(gp)[0])}${gp.toegewezen && gp.toegewezen.status === 'aangevraagd' ? ', wacht op een ja' : ''}.`}</p></section>` : '';
  const geen = !p && !RV.length && z.open && !vraag && !vraagLaat && !laterK && !ophalen ? (gp ? (fase !== 'bel' ? `<section class="prop"><div class="prop-h">${ic('spark', 15)}Niemand meer vrij</div><p class="hint">Geen eigen chauffeur, oproepkracht of charter kan deze rit vandaag nog rijden. Zet hem morgen als eerste of laat de klant het weten.</p></section>` : '') : `<section class="prop"><div class="prop-h">${ic('spark', 15)}Geen voorstel</div><p class="hint">De assistent heeft voor deze zaak geen vrij voertuig of geschikte oplossing gevonden. Neem contact op met de chauffeur of zet de zaak op wacht.</p></section>`) : '';
  const nKeuzes = (p ? 1 : 0) + RV.length + (ophalen ? 1 : 0) + (keuzes && z.open ? 3 + (laatHtml ? 1 : 0) + (laterHtml ? 1 : 0) + (vrHtml ? 1 : 0) + (tgHtml ? 1 : 0) : 0);
  const voorstel = assist || ritVs || geen || keuzes || ophalenHtml ? `<div class="pg-sec"><h2>${gp ? 'Keuzes' : 'Voorstellen'}${nKeuzes ? ` <span class="sub">${nKeuzes}</span>` : ''}</h2><div class="props">${assist}${ritVs}${ophalenHtml}${geen}${keuzes}</div></div>` : '';
  // statusbalk en slimme knoppen
  const stappen = KOLOM.map(([k, n]) => [k, k === 'wacht' && z.status === 'wacht' ? `Wacht op ${(WACHT[z.wachtOp] || WACHT.reactie)[0]}` : n, can ? `data-zset="${k}"` : '']);
  const ritObj = z.rit ? ctx.R.get(z.rit) : null; const rs = ritObj ? ctx.R.stateOf(ritObj, T, ctx.S) : null;
  const zelfde = ctx.Z.scoped().filter(x => x.obj === z.obj).length;
  const berichten = t ? (t.msgs || []).length : 0;
  const sb = smartBtns([
    ritObj && [ritObj.id, rs ? `rit · ${rs.st === 'klant' ? 'bij klant' : rs.st}` : 'rit', `rit/${ritObj.id}`, 'route'],
    gp && [gp.id, `open rit · ${gp.morgenEerste ? 'morgen' : gp.gepland ? 'toegewezen' : T < vensterVandaag(gp)[1] ? 'open' : 'gemist'}`, `openritten/${gp.id}`, 'inbox'],
    t && [t.id, s ? `voertuig · ${ctx.VST[s.st].n.toLowerCase()}` : 'voertuig', `voertuig/${t.id}/vandaag`, t.kind === 'bus' ? 'bus' : 'truck'],
    tr && [tr.id, 'oplegger', `oplegger/${tr.id}/vandaag`, 'trailer'],
    t && s && s.dienst && [s.dienst.person.short, 'chauffeur', `persoon/${s.dienst.person.id}`, 'user'],
    [zelfde, zelfde === 1 ? 'melding vandaag' : 'meldingen vandaag', `lijst:meldingen:${z.obj}`, 'alert'],
    t && [berichten, berichten === 1 ? 'bericht' : 'berichten', `kaart:truck:${t.id}`, 'msg'],
  ]);
  const wachtTxt = z.status === 'wacht' ? ` <small>tot ${hhmm(z.until)}</small>` : '';
  const actions = `<div class="pg-sec"><h2>Afhandeling</h2>${kv([
    ['Status', `${statusHtml(z)}${wachtTxt}`],
    ['Eigenaar', ownerHtml(z.who, z)],
    ['Deadline', z.open ? `<span class="${z.over > 0 ? 'tbad' : ''}">${hhmmDag(z.deadline)}</span> <small>${z.over > 0 ? `${durTxt(z.over)} over` : `nog ${durTxt(Math.max(0, -z.over))}`} · norm ${z.norm} min</small>` : `<span class="mut">${z.status === 'wacht' ? `terug ${hhmm(z.until)}` : 'gesloten'}</span>`],
    ['Ernst', z.sev === 'bad' ? '<span class="tbad">ernstig</span>' : '<span class="twarn">waarschuwing</span>'],
  ])}${can ? `<div class="chips" style="margin-top:12px"><button class="btn sm" type="button" data-zassign="1" aria-haspopup="true">${ic('usercheck', 15)}Toewijzen</button><button class="btn sm" type="button" data-zstatus="1" aria-haspopup="true">${ic('half', 15)}Status</button>${z.status !== 'opgelost' ? `<button class="btn sm" type="button" data-zdone="1">${ic('okc', 15)}Opgelost</button>` : ''}</div>` : '<p class="hint" style="margin-top:8px">Je rol kan zaken bekijken, niet afhandelen.</p>'}</div>`;
  const poolKaart = gp ? `<button class="obj" type="button" data-open="openritten/${esc(gp.id)}"><span class="av" style="border-radius:8px">${ic('inbox', 16)}</span><span class="obj-t"><b>Open rit ${esc(gp.id)}</b><span>${esc(klantKort(gp.klant))} · ${esc(gp.sp)} · ${(gp.stops || []).length} ${(gp.stops || []).length === 1 ? 'stop' : 'stops'}</span></span></button>` : '';
  const objSec = `<div class="pg-sec"><h2>Betrokken</h2><div style="display:flex;flex-direction:column;gap:8px">${poolKaart}${t ? ctx.objCard('truck', t) : ''}${tr ? ctx.objCard('trailer', tr) : ''}${t && s && s.dienst ? ctx.objCard('person', s.dienst.person) : ''}${ritObj ? ctx.objCard('rit', ritObj) : t ? ctx.objCard('rit', ctx.R.ritOf(t, T)) : ''}</div></div>`;
  const notes = `${can ? `<div class="note-in"><label class="sr" for="zaakNote">Notitie</label><textarea class="fld" id="zaakNote" rows="2" placeholder="Wat heb je gedaan of afgesproken? Bijvoorbeeld: chauffeur gebeld, klant weet het."></textarea><button class="btn sm" type="button" id="zaakNoteBtn">${ic('note', 15)}Notitie opslaan</button></div>` : ''}`;
  const html = `<div class="pg" data-zaak="${esc(z.key)}">
    <div class="pg-bar"><nav class="crumbs" aria-label="Kruimelpad"><button type="button" data-open="view:meldingen">Meldingen</button>${ic('chev', 12)}<span>${esc(z.kind)} ${esc(z.obj)}</span></nav><div class="act"><button class="btn sm" type="button" data-back="1">${ic('back', 15)}Terug</button></div></div>
    <div class="pg-h"><div class="pg-id"><h1>${ic(SOORT[z.kind].icon, 22, z.sev === 'bad' ? 'tbad' : 'twarn')}${esc(z.kind)} · <span class="nowrap">${esc(z.obj)}</span></h1><div class="sub">${esc(z.text)}</div><div class="sub">${esc(z.spn)}${z.driver ? ` · ${esc(z.driver)}` : ''}${z.rit ? ` · rit ${esc(z.rit)}` : ''} · ontstaan ${hhmmDag(z.first)}${z.since !== z.first ? `, opnieuw ${hhmmDag(z.since)}` : ''}</div></div>
      <div class="pg-a">${z.open || z.status === 'wacht' ? `<span title="Prioriteit">${prioHtml(z.prio)}</span>` : ''}<span class="sla ${slaCls}" style="grid-template-columns:auto 96px" title="Deadline ${hhmm(z.deadline)}, norm ${z.norm} min">${z.open ? `<b>${z.over > 0 ? `${durTxt(z.over)} over` : `nog ${durTxt(Math.max(0, -z.over))}`}</b>${meter(z.sla, slaCls || 'mut')}` : z.status === 'wacht' ? `<b>terug ${hhmm(z.until)}</b>${meter(0, 'mut')}` : `<b class="tok">${vanzelf(z) ? 'Vanzelf opgelost' : 'Opgelost'}${z.closedAt !== null && z.closedAt !== undefined ? ` ${hhmm(z.closedAt)}` : ''}</b>`}</span>${zrit && can ? `<button class="btn sm ${hoofd === 'verplaats' ? 'pri' : ''}" type="button" data-open="planbord/${esc(zrit.id)}" title="Open het planbord met rit ${esc(zrit.id)} gekozen">${ic('gantt', 15)}${zrit === zr0 ? 'Verplaats deze rit' : `Verplaats de volgende rit (${esc(zrit.id)})`}</button>` : ''}${gp ? `<button class="btn sm" type="button" data-open="openritten/${esc(gp.id)}">${ic('inbox', 15)}Open de rit</button>` : t ? `<button class="btn sm" type="button" data-open="kaart:truck:${esc(t.id)}">${ic('map', 15)}Op kaart</button>` : tr ? `<button class="btn sm" type="button" data-open="kaart:trailer:${esc(tr.id)}">${ic('map', 15)}Op kaart</button>` : ''}</div></div>
    <div class="pg-strip">${statusBar(stappen, z.status, 'Status van de zaak')}${sb}</div>
    <div class="pg-kpis">${k3.map(([a, b, c]) => `<div><small>${a}</small><b>${b}</b><span>${c || '&nbsp;'}</span></div>`).join('')}</div>
    <div class="pg-cols"><div class="pg-main">${voorstel}<div class="pg-sec"><h2>Logboek <span class="sub">${z.notes.length ? `${z.notes.length} ${z.notes.length === 1 ? 'notitie' : 'notities'} · ` : ''}${gp ? 'de rit, de planner en het systeem' : 'het voertuig, de planner en het systeem'}</span></h2><ol class="tline">${tl}</ol>${notes}</div></div><div class="pg-side">${actions}${objSec}</div></div></div>`;
  const bind = el => {
    on(el, 'click', '[data-pastoe]', (e, b) => { const pp = ctx.voorstelById(b.dataset.pastoe); if (pp) ctx.applyProposal(pp); });
    on(el, 'click', '[data-zassign]', (e, b) => ctx.assignMenu(b, [z]));
    on(el, 'click', '[data-zstatus]', (e, b) => ctx.statusMenu(b, [z]));
    on(el, 'click', '[data-zdone]', () => ctx.Z.setStatus([z], 'opgelost'));
    on(el, 'click', '[data-zset]', (e, b) => { const st = b.dataset.zset; if (st === 'wacht') ctx.statusMenu(b, [z], 'wacht'); else ctx.Z.setStatus([z], st, 0, null, { mij: true }); });
    on(el, 'click', '[data-zkies]', (e, b) => { const x = RV[+b.dataset.zkies]; if (x) IP.voerUit(ctx, x.r, x.k.t, x.k.start, { zaak: z.key, na: () => ctx.rerenderPage() }); });
    on(el, 'click', '[data-zwaar]', (e, b) => { const r = ctx.R.get(b.dataset.zwaar); if (r) IP.waarPast(ctx, r, { zaak: z.key, na: () => ctx.rerenderPage() }); });
    // een gemiste rit: morgen als eerste, de klant gebeld (het nummer toont ui.js, data-bel) of het bericht gekopieerd
    if (gp) {
      on(el, 'click', '[data-nmorgen]', () => { if (morgenAlsEerste(ctx, gp).ok) ctx.rerenderPage(); });
      on(el, 'click', '[data-nvraag]', () => { if (vraag && wijsToe(ctx, gp, vraag).ok) ctx.rerenderPage(); });
      on(el, 'click', '[data-ntegelijk]', () => { if (S) { vraagTegelijk(ctx, gp, S); ctx.rerenderPage(); } });
      // een ja uit de groep: toewijzen en meteen bevestigd (hij zei al ja)
      on(el, 'click', '[data-nja]', (e, b) => { const x = alKand.find(y => y.k && `${y.k.soort}:${y.k.id}` === b.dataset.nja); if (x && wijsToe(ctx, gp, x.k, { stil: true }).ok) { bevestig(ctx, gp); ctx.rerenderPage(); } });
      on(el, 'click', '[data-nlaat]', () => { if (vraagLaat && wijsToe(ctx, gp, vraagLaat).ok) ctx.rerenderPage(); });
      on(el, 'click', '[data-nlater]', () => { if (laterK && wijsToe(ctx, gp, laterK).ok) ctx.rerenderPage(); });
      on(el, 'click', '[data-nbel]', () => { contact(ctx, gp, [kp.naam], 'bel', `belde ${kp.naam} over ${fase === 'gemist' ? 'gemiste' : 'open'} rit ${gp.id} (${gp.sp})`); ctx.Z.logZaak(z.key, `${kp.naam} gebeld`); ctx.rerenderPage(); });
      on(el, 'click', '[data-nbericht]', () => {
        const tekst = klantBerichtGemist(gp, nogIemand, fase || 'gemist'); let ok = false; try { if (navigator.clipboard) { navigator.clipboard.writeText(tekst).catch(() => {}); ok = true; } } catch { ok = false; }
        contact(ctx, gp, [kp.naam], 'bericht', `zette een bericht aan ${kp.naam} klaar over ${fase === 'gemist' ? 'gemiste' : 'open'} rit ${gp.id} (${gp.sp})`); ctx.Z.logZaak(z.key, `bericht aan ${kp.naam} klaargezet`);
        ctx.L.toast(ok ? 'Bericht gekopieerd. Demo: er gaat niets de deur uit.' : 'Kopieren kan hier niet; selecteer de tekst. Demo: er gaat niets de deur uit.', { icon: ok ? 'copy' : 'info' }); ctx.rerenderPage();
      });
    }
    // een oplegger ophalen: het planbord van zijn standplaats
    on(el, 'click', '[data-ztrplan]', () => { if (tr && ctx.setPbSp) ctx.setPbSp(tr.base); ctx.go('view:planbord'); });
    const nb = el.querySelector('#zaakNoteBtn'); if (nb) { const ta = el.querySelector('#zaakNote'); nb.addEventListener('click', () => { if (ctx.Z.addNote(z, ta.value)) ta.value = ''; }); ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) nb.click(); }); }
  };
  return { html, bind, title: `${z.kind} · ${z.obj}`, parent: 'meldingen' };
}
export { STAB };
