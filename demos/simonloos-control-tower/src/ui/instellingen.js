// Instellingen: profiel (naam, rol, thema), werkgebied, meldingsnormen per soort, kaart, sneltoetsen en wat deze browser
// bewaart (met een knop om te wissen). Alles staat in localStorage onder sl-*; er gaat niets naar een server, behalve
// een vraag aan de Assistent als de pagina de Claude API aanzet (data-ai op de root, alleen op de demosite).
import { esc, ic, fmt, on, swap, SOORT } from './base.js';
import { ROLES } from '../places.js';
import { ROLDESC } from './nav.js';
import { aiUrl } from './ai.js';
import { BASES, kiesBasis } from './kaart.js';

const KEYS = {
  'sl-planbord': 'Planbord: rijen, zoom en de bak met open ritten; vandaag ook de dag en de filters', 'sl-openritten': 'Open ritten: vandaag of morgen',
  'sl-werkgebied': 'Werkgebied: regio\'s, divisies, rol en standplaats', 'sl-role': 'Rol (bekijk als)', 'sl-theme': 'Thema', 'sl-nav': 'Menu ingeklapt of niet',
  'sl-acties': 'Acties van vandaag: zaken, notities, toegepaste voorstellen, berichten, logboek', 'sl-views': 'Opgeslagen weergaven', 'sl-instellingen': 'Je naam en meldingsnormen',
  'sl-kolommen': 'Gekozen kolommen per tabel', 'sl-lostijden': 'Overgenomen lostijden', 'sl-rest': 'Je beoordelingen van pauzeplekken', 'sl-overdracht': 'Overdracht naar de volgende dienst',
  'sl-3d': '3D-wereld aan of uit', 'sl-kaartlaag': 'Gekozen basiskaart', 'sl-kaartfilter': 'Statusfilter, dimmen en bezorgbussen op de kaart', 'sl-tabelstand': 'Zoekwoord, filters en sortering per tabel', 'sl-tabelweergaven': 'Opgeslagen weergaven per tabel', 'sl-meldweergave': 'Meldingen als lijst of als bord', 'sl-pbhint': 'Uitleg bij het planbord gelezen', 'sl-online': 'Online basiskaart aan of uit (voor oudere versies)',
  'sl-oefendag': 'Oefendag aan of uit', 'sl-acties-oefendag': 'Acties op de oefendag: zaken, notities, toegepaste voorstellen, berichten, logboek (apart van de gewone dag)',
};
// ---------- oefendag: een vaste drukke dag om mee te oefenen (src/oefendag.js, fleet.scenario) ----------
// Aan of uit vraagt een herlaad: de dag wordt bij het laden opgebouwd. ?scenario=druk in de adresbalk zet hem ook aan (en
// ?scenario=gewoon uit); de schakelaar haalt dat uit de adresbalk, zodat herladen doet wat je koos.
const KLOK = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;
function oefendagRegels(sc) {
  return sc.verstoringen.map(v => {
    if (v.soort === 'ziek') return ['Ziekmeldingen', `${v.diensten.length} chauffeurs van ${v.standplaats} om ${KLOK(v.om)}; ${v.ritten.length} ${v.ritten.length === 1 ? 'rit staat' : 'ritten staan'} bij de open ritten`];
    if (v.soort === 'file') return ['File', `${v.weg} tussen Hoorn en Purmerend, richting Purmerend, ${KLOK(v.van)} tot ${KLOK(v.tot)}: ${v.ritten} ${v.ritten === 1 ? 'rit' : 'ritten'} ${v.minuten && v.minuten.length ? `${Math.min(...v.minuten)} tot ${Math.max(...v.minuten)}` : `${v.vertraging[0]} tot ${v.vertraging[1]}`} min later`];
    if (v.soort === 'dock') return ['Dock', v.dock ? `dock ${v.dock} van ${v.standplaats} buiten gebruik van ${KLOK(v.van)} tot ${KLOK(v.tot)} (${v.reden}); ${v.verzet} ${v.verzet === 1 ? 'blok' : 'blokken'} naar een ander dock` : 'geen dock gevonden'];
    if (v.soort === 'koeling') return ['Koeling', v.oplegger ? `${v.oplegger}${v.voertuig ? ` achter ${v.voertuig}` : ''}: koelunit haalt het doel niet (${v.temp} °C)` : 'geen koeloplegger gevonden'];
    return [v.soort, v.tekst || ''];
  });
}
function zetOefendag(aan) {
  try { if (aan) localStorage.setItem('sl-oefendag', 'druk'); else localStorage.removeItem('sl-oefendag'); } catch { /* geen opslag */ }
  try { const u = new URL(location.href); if (u.searchParams.has('scenario')) { u.searchParams.delete('scenario'); history.replaceState(null, '', u.toString()); } } catch { /* adres blijft */ }
  location.reload();
}
function stored(store) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('sl-')) out.push([k, (localStorage.getItem(k) || '').length]); } } catch { /* geen opslag */ } return out.sort((a, b) => a[0].localeCompare(b[0])); }
const kb = n => n < 1024 ? `${n} tekens` : `${(n / 1024).toFixed(1).replace('.', ',')} kB`;

export function renderInstellingen(ctx, el) {
  const S2 = ctx.A.settings; const m = ctx.mapApi(); const L = stored(ctx.store); const total = L.reduce((a, x) => a + x[1], 0);
  const tg = (id, on2, label, sub) => `<div class="set-r"><div><b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div><label class="tgl"><input type="checkbox" id="${id}" ${on2 ? 'checked' : ''} aria-label="${esc(label)}"><i></i></label></div>`;
  const h = `<div class="page"><div class="page-in"><div class="set">
    <section class="card" aria-labelledby="setProf"><div class="card-h"><h2 id="setProf">Profiel</h2></div><div class="card-b">
      <div class="set-r"><div><b>Je naam</b><span>Staat bij toewijzingen, notities en in het logboek.</span></div><input class="fld" id="setNaam" value="${esc(S2.naam())}" maxlength="40" autocomplete="name" aria-label="Je naam" style="width:200px"></div>
      <div class="set-r"><div><b>Rol</b><span>${esc(ROLDESC[ctx.role()])}. De rol bepaalt wat je ziet en of je zaken mag afhandelen.</span></div><select class="fld" id="setRol" aria-label="Rol" style="width:200px">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${ctx.role() === k ? 'selected' : ''}>${esc(r.n)}</option>`).join('')}</select></div>
      <div class="set-r"><div><b>Thema</b><span>Donker is rustiger in een donkere ruimte of op een tv.</span></div><div class="seg" role="group" aria-label="Thema"><button type="button" data-thema="light" aria-pressed="${ctx.theme() !== 'dark'}">Licht</button><button type="button" data-thema="dark" aria-pressed="${ctx.theme() === 'dark'}">Donker</button></div></div>
    </div></section>
    ${aiUrl(ctx) ? `<section class="card" aria-labelledby="setAi"><div class="card-h"><h2 id="setAi">Assistent</h2></div><div class="card-b"><div class="set-r"><div><b>Claude API</b><span>Gaat naar de Claude API via de demosite; nooit namen of nummers van personen. Alleen als je zelf de ochtendbriefing, een overdracht of een antwoord vraagt; hoogstens dertig vragen per uur. Gesimuleerde dagdata; de Assistent stelt voor, jij beslist.</span></div></div></div></section>` : ''}
    <section class="card" aria-labelledby="setWg"><div class="card-h"><h2 id="setWg">Werkgebied</h2></div><div class="card-b">
      <div class="set-r"><div><b>${esc(ctx.scopeLabel())}</b><span>${esc(ctx.divLabel())} · ${fmt(ctx.spsInScope().length)} standplaatsen</span></div><button class="btn" type="button" data-setwg="1">${ic('pin', 15)}Wijzigen</button></div>
      ${ctx.F.sps.size ? `<div class="set-r"><div><b>Alleen ${esc([...ctx.F.sps].join(', '))}</b><span>Je kijkt naar één standplaats.</span></div><button class="btn" type="button" data-setnl="1">Loslaten</button></div>` : ''}
      <div class="set-r"><div><b>Opgeslagen weergaven</b><span>${ctx.savedViews().length ? ctx.savedViews().map(v => esc(v.name)).join(', ') : 'Nog geen. Bewaar een weergave via het werkgebied in de topbalk.'}</span></div></div>
    </div></section>
    <section class="card" aria-labelledby="setNorm"><div class="card-h"><h2 id="setNorm">Meldingsnormen</h2><span class="sub">minuten tot een zaak opgepakt moet zijn</span></div><div class="card-b">
      <div class="norms">${Object.keys(SOORT).map(k => `<label>${ic(SOORT[k].icon, 15)} <span style="flex:1">${esc(k)}</span><input class="fld sm" type="number" min="1" max="600" step="1" data-norm="${k}" value="${S2.norm(k)}" aria-label="Norm voor ${esc(k.toLowerCase())} in minuten"> <span class="mut">min</span></label>`).join('')}</div>
      <p class="hint">Een zaak die langer open staat dan de norm, kleurt rood in de lijst en op het overzicht en telt als "over de norm". Standaard: ${Object.entries(SOORT).map(([k, v]) => `${k.toLowerCase()} ${v.norm}`).join(', ')} minuten.</p>
      <div><button class="btn sm" type="button" data-normreset="1">Standaard herstellen</button></div>
    </div></section>
    <section class="card" aria-labelledby="setKaart"><div class="card-h"><h2 id="setKaart">Kaart</h2></div><div class="card-b">
      ${m && m.hasTiles() ? `<div class="set-r"><div><b>Basiskaart</b><span>Ingebouwd vraagt niets van buiten. OpenStreetMap, de luchtfoto en de topografische kaart komen van internet; laadt er een niet, dan blijft de ingebouwde kaart. Ook onder Kaartlagen.</span></div><select class="fld" id="setBase" aria-label="Basiskaart" style="width:200px">${BASES.map(([k, n]) => `<option value="${k}" ${m.base() === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>` : '<div class="set-r"><div><b>Ingebouwde basiskaart</b><span>In deze omgeving laadt de kaart niets van buiten.</span></div></div>'}
      ${m && m.has3d() ? tg('set3d', ctx.three(), '3D-wereld', 'Kantelt de kaart en toont voertuigen, depots en bomen in 3D (toets d).') : ''}
      ${tg('setTrl', ctx.trailersOnMap(), 'Losse opleggers', 'Opleggers die niet achter een trekker hangen (toets o).')}
      ${tg('setBus', ctx.bussenOnMap(), 'Bezorgbussen', 'De bestelbussen van de boodschappenbezorging. Uit haalt ze alleen van de kaart; in lijsten en meldingen tellen ze mee (toets b).')}
      ${tg('setRest', ctx.restOnMap(), 'Pauzeplekken', 'De 48 pauzeplekken langs het snelwegennet.')}
      ${tg('setDim', ctx.F.dim, 'Andere standplaatsen gedimd', 'Als je werkgebied één standplaats is, de rest als stippen.')}
    </div></section>
    <section class="card" aria-labelledby="setOefenH" data-sec="oefendag"><div class="card-h"><h2 id="setOefenH">Oefendag</h2><span class="sub">gesimuleerd</span></div><div class="card-b">
      ${tg('setOefen', !!ctx.fleet.scenario, 'Oefendag: een drukke dag', 'Een vaste drukke dag om mee te oefenen: twee zieke chauffeurs om 04:30, een file op de A7, een dock buiten gebruik en een koelstoring. Elke keer hetzelfde. De app laadt opnieuw; de gewone dag en je acties daarop blijven zoals ze waren.')}
      ${ctx.fleet.scenario ? `<table class="tbl plain compact" aria-label="Wat er op de oefendag gebeurt"><tbody>${oefendagRegels(ctx.fleet.scenario).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="wrap">${esc(v)}</td></tr>`).join('')}</tbody></table><p class="hint">Alles op de oefendag is gesimuleerd. Ook met ?scenario=druk in de adresbalk.</p>` : '<p class="hint">Uit: de gewone dag. Ook aan te zetten met ?scenario=druk in de adresbalk.</p>'}
    </div></section>
    <section class="card" aria-labelledby="setOpslag"><div class="card-h"><h2 id="setOpslag">Bewaard in deze browser</h2><span class="sub">${L.length} ${L.length === 1 ? 'onderdeel' : 'onderdelen'} · ${kb(total)}</span></div><div class="card-b">
      ${L.length ? `<table class="tbl plain compact"><thead><tr><th>Wat</th><th class="r">Grootte</th><th class="r"></th></tr></thead><tbody>${L.map(([k, n]) => `<tr><td class="wrap">${esc(KEYS[k] || k)}<small style="display:block" class="mut">${esc(k)}</small></td><td class="r">${kb(n)}</td><td class="r"><button class="btn ghost xs" type="button" data-wis="${esc(k)}">Wis</button></td></tr>`).join('')}</tbody></table>` : '<p class="hint">Deze browser bewaart nog niets van de control tower.</p>'}
      <p class="hint">Alleen in deze browser, nergens anders. Wissen kan niet ongedaan worden gemaakt.</p>
      <div><button class="btn sm" type="button" data-wisalles="1" ${L.length ? '' : 'disabled'}>${ic('trash', 15)}Alles wissen</button></div>
    </div></section>
    <section class="card" aria-labelledby="setOver"><div class="card-h"><h2 id="setOver">Over deze control tower</h2></div><div class="card-b">
      <div class="set-r"><div><b>Sneltoetsen</b><span>Zoeken, onderdelen, volgen, kaartlagen.</span></div><button class="btn" type="button" data-setkeys="1">${ic('keyboard', 15)}Toon</button></div>
      <p class="hint">Echt: wegen en water (OpenStreetMap via Overture Maps), de standplaatsen en hun klanten (werkenbijsimonloos.nl), de divisies en de ligging van de pauzeplekken. Gesimuleerd: voertuigen, opleggers, kentekens (altijd met een Q, die de RDW niet uitgeeft), chauffeurs, diensten, ritten, tijden, vertragingen, berichten, historie, schades, kosten, lostijden, stroomprijzen en beoordelingen.</p>
    </div></section>
  </div></div></div>`;
  swap(el, h);
  if (el.dataset.bound) return; el.dataset.bound = '1';
  el.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'setNaam') { S2.setNaam(e.target.value); ctx.refreshAll(); ctx.L.toast(`Je naam is nu ${S2.naam()}.`, { icon: 'user' }); }
    else if (id === 'setRol') ctx.setRole(e.target.value);
    else if (id === 'setBase') { const mm = ctx.mapApi(); if (!kiesBasis(ctx, e.target.value) && mm) e.target.value = mm.base(); }
    else if (id === 'set3d') ctx.set3dMode(e.target.checked);
    else if (id === 'setTrl') ctx.setTrailersOnMap(e.target.checked, true);
    else if (id === 'setBus') ctx.setBussenOnMap(e.target.checked, true);
    else if (id === 'setRest') ctx.setRestOnMap(e.target.checked);
    else if (id === 'setDim') { ctx.F.dim = e.target.checked; ctx.frame(true); }
    else if (id === 'setOefen') {
      const aan = e.target.checked; e.target.checked = !aan;
      ctx.L.confirm({ title: aan ? 'Oefendag aanzetten?' : 'Terug naar de gewone dag?', text: aan ? 'De app laadt opnieuw met een drukke dag (gesimuleerd): twee zieke chauffeurs, een file op de A7, een dock buiten gebruik en een koelstoring. Je acties op de gewone dag blijven bewaard.' : 'De app laadt opnieuw met de gewone dag. Je acties op de oefendag blijven apart bewaard.', ok: aan ? 'Oefendag aan' : 'Gewone dag' }).then(ok => { if (ok) zetOefendag(aan); });
    }
    else if (e.target.dataset.norm) { S2.setNorm(e.target.dataset.norm, e.target.value); e.target.value = S2.norm(e.target.dataset.norm); ctx.refreshAll(false); ctx.L.toast(`Norm voor ${e.target.dataset.norm.toLowerCase()}: ${S2.norm(e.target.dataset.norm)} minuten.`, { icon: 'clock' }); }
  });
  on(el, 'click', '[data-thema]', (e, b) => { if ((ctx.theme() === 'dark') !== (b.dataset.thema === 'dark')) ctx.toggleTheme(); renderInstellingen(ctx, el); });
  on(el, 'click', '[data-setwg]', () => ctx.openWizard(1));
  on(el, 'click', '[data-setnl]', () => { ctx.clearSps(); renderInstellingen(ctx, el); });
  on(el, 'click', '[data-setkeys]', () => ctx.showKeys());
  on(el, 'click', '[data-normreset]', () => { S2.resetNormen(); renderInstellingen(ctx, el); ctx.refreshAll(false); ctx.L.toast('De standaardnormen staan weer ingesteld.', { icon: 'undo' }); });
  // bevestigen met een native <dialog> (modaal, Esc annuleert)
  on(el, 'click', '[data-wis]', async (e, b) => { const k = b.dataset.wis; if (!(await ctx.L.confirm({ title: `${KEYS[k] || k} wissen?`, text: `Dit haalt ${(KEYS[k] || k).toLowerCase()} weg uit deze browser. Dat kan niet ongedaan worden gemaakt. Na het wissen laadt de control tower opnieuw.`, ok: 'Wissen', danger: true }))) return; try { localStorage.removeItem(k); } catch { /* */ } location.reload(); });
  on(el, 'click', '[data-wisalles]', async () => { if (!(await ctx.L.confirm({ title: 'Alles wissen?', text: 'Dit wist je werkgebied, rol, thema, de acties en notities van vandaag, opgeslagen weergaven, kolomkeuzes, overgenomen lostijden, beoordelingen en de overdracht uit deze browser. Dat kan niet ongedaan worden gemaakt. Daarna begint de control tower opnieuw met de vragen over je werkgebied.', ok: 'Alles wissen', danger: true }))) return; try { for (const [k] of stored(ctx.store)) localStorage.removeItem(k); } catch { /* */ } location.hash = ''; location.reload(); });
}
