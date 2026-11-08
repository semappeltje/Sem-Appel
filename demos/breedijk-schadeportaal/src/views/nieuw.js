// Nieuwe melding, per soort schade: ladingsschade (een auto die wij vervoerden), aanrijschade aan ons eigen voertuig,
// aanrijschade aan een derde, of diverse schade. Twee manieren: de velden invullen, of een mail plakken die het portaal
// uitleest (src/intake.js; in het echt de Claude API). Staat in de mail het kenteken van een van onze eigen
// vrachtwagens, dan is het een aanrijschade derde. Bij een ladingsschade zoekt het kenteken meteen de rit.
import { CATEGORIEN, GEBIEDEN, GEBIEDEN_VOOR, SOORTEN, ERNST, PLAATS, TEGENPARTIJ, kentekenNorm, kentekenToon, fmtDatumJ, fmtEur, fmtNum } from '../regels.js';
import { leesMail } from '../intake.js';
import { zoekRdw } from '../rdw.js';
import { esc, ico } from '../h.js';

// een tijd als waarde voor <input type=datetime-local> (lokale tijd, op de minuut)
const lokaal = t => { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const opties = (lijst, sel) => lijst.map(([k, n]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
export function nieuweMelding(ctx, vooraf = {}) {
  const { D, inst, acties } = ctx;
  if (!ctx.kan('besluit') && !ctx.kan('melden')) { ctx.toast('Een melding invoeren is er voor de schadebehandeling.', { icon: 'lock' }); return; }
  const r0 = vooraf.rit ? D.ritMap.get(vooraf.rit) : null; let tab = vooraf.tab || 'velden'; let cat = vooraf.categorie || 'lading';
  const trekkers = D.vloot.filter(v => v.soort === 'trekker');
  const d = ctx.dialog(`<div class="dlg-h"><h2 id="dlgTitle">Nieuwe melding</h2><div class="seg" role="tablist"><button type="button" role="tab" data-tab="velden">Velden</button><button type="button" role="tab" data-tab="mail">Plak een mail</button></div><button type="button" class="ib" data-close aria-label="Sluiten">${ico('x')}</button></div>
    <div class="dlg-b" id="tabMail" hidden>
      <textarea class="fld" id="mailTekst" rows="9" placeholder="Plak hier de tekst van de mail: van een opdrachtgever, een tegenpartij of een chauffeur." aria-label="Tekst van de mail" style="min-height:180px"></textarea>
      <div class="row" style="justify-content:space-between"><span class="mut" style="font-size:12.5px">Het portaal leest kenteken, datum, bedrag, plek en soort uit de tekst, zonder taalmodel; er gaat niets naar buiten.</span><button type="button" class="btn pri" id="leesMail">${ico('sparkle')}Lees de mail</button></div>
      <div id="mailUit"></div>
    </div>
    <form class="dlg-b" id="nf">
      <div class="seg" role="radiogroup" aria-label="Soort schade" id="catSeg" style="align-self:flex-start;flex-wrap:wrap">${Object.entries(CATEGORIEN).map(([k, x]) => `<button type="button" role="radio" data-cat="${k}" aria-checked="${k === cat}" class="${k === cat ? 'on' : ''}">${esc(x.kort)}</button>`).join('')}</div>
      <p class="mut" id="catUitleg" style="font-size:12.5px;margin-top:-4px"></p>
      <div class="grid g2">
        <label class="flabel">Bron<select class="fld" name="bron"><option value="mail">Mail buiten schade@</option><option value="telefoon">Telefonisch</option><option value="chauffeur">De chauffeur meldt zelf</option></select></label>
        <label class="flabel" data-voor="lading derde"><span id="kentLabel">Kenteken</span><input class="fld" name="kenteken" autocomplete="off" placeholder="XX-123-X" value="${esc(r0 ? kentekenToon(r0.kenteken) : '')}" autofocus><small id="ritUit">Typ een kenteken; de rit wordt gezocht.</small></label>
        <label class="flabel" data-voor="eigen derde divers">Ons voertuig<select class="fld" name="eigenVoertuig">${trekkers.map(t => `<option value="${t.id}">${esc(t.id)} · ${esc(t.merk)} ${esc(t.model)} · ${esc(kentekenToon(t.kenteken))}</option>`).join('')}</select><small>Met de oplegger ${'die erbij hoort'}.</small></label>
      </div>
      <div id="rdwRij" class="row" hidden><button type="button" class="btn sm" id="rdwKnop">${ico('car')}Zoek bij de RDW</button><span class="mut" id="rdwUit" style="font-size:12.5px"></span></div>
      <label class="flabel" data-voor="lading">Opdrachtgever<select class="fld" name="opdrachtgever">${D.opdrachtgevers.map(k => `<option value="${k.id}" ${r0 && r0.k === k.id ? 'selected' : ''}>${esc(k.naam)}</option>`).join('')}</select></label>
      <div class="grid g2" data-voor="derde"><label class="flabel">Wat is er geraakt<select class="fld" name="tegenpartij">${opties(Object.entries(TEGENPARTIJ), 'geparkeerd')}</select></label><label class="flabel">Wie is de tegenpartij<input class="fld" name="tegenpartijNaam" placeholder="Particulier, of de naam van het bedrijf"><small>Een naam van een particulier alleen in het dossier (AVG).</small></label></div>
      <div class="grid g3">
        <label class="flabel">Plek<select class="fld" name="gebied" id="gebiedSel"></select></label>
        <label class="flabel" data-voor="lading eigen derde">Soort<select class="fld" name="soort">${opties(Object.entries(SOORTEN), 'deuk')}</select></label>
        <label class="flabel" data-voor="lading eigen derde">Grootte<select class="fld" name="ernst">${opties(Object.entries(ERNST), '2')}</select></label>
        <label class="flabel" data-voor="divers">Wat<select class="fld" name="soortDivers"><option value="ontbreekt">Kwijt</option><option value="gebroken">Kapot</option></select></label>
      </div>
      <div class="grid g2"><label class="flabel">${'Bedrag (euro, als bekend)'}<input class="fld" name="bedrag" type="number" min="0" step="10"></label>
        <label class="flabel" data-voor="lading">Fase<select class="fld" name="fase"><option value="">Onbekend</option><option value="laden">Bij het laden</option><option value="rijden">Onderweg</option><option value="lossen">Bij het lossen</option><option value="terrein">Op het terrein</option></select></label>
        <label class="flabel" data-voor="eigen derde">Waar<select class="fld" name="plaatsSoort">${opties(Object.entries(PLAATS), 'terrein')}</select></label></div>
      <div class="grid g2" data-voor="eigen derde divers"><label class="flabel">Moment<input class="fld" type="datetime-local" name="moment" value="${lokaal(ctx.NU - 3600000)}" max="${lokaal(ctx.NU)}"><small>Wanneer het gebeurde. De telematica zoekt op dit moment.</small></label><label class="flabel">Plaats<input class="fld" name="plaats" placeholder="Bijvoorbeeld Barneveld of Hoorn"></label></div>
      <label class="flabel">Wat is er gemeld<textarea class="fld" name="tekst" rows="3" placeholder="In de woorden van de melder"></textarea></label>
      <input type="hidden" name="merk"><input type="hidden" name="model"><input type="hidden" name="kleur"><input type="hidden" name="massa"><input type="hidden" name="bouwjaar"><input type="hidden" name="toelating"><input type="hidden" name="catalogusprijs"><input type="hidden" name="soortVoertuig"><input type="hidden" name="rdw"><input type="hidden" name="uitMail"><input type="hidden" name="onderwerp">
    </form>
    <div class="dlg-f"><span class="l" id="voetTip"></span><button type="button" class="btn" data-close>Annuleer</button><button type="submit" form="nf" class="btn pri" id="maak">${ico('plus')}Maak dossier</button></div>`);
  const f = d.querySelector('#nf'); const uit = d.querySelector('#ritUit'); const kent = f.elements.kenteken; const rdwRij = d.querySelector('#rdwRij'); const rdwUit = d.querySelector('#rdwUit'); let rdw = null;
  const toonTab = t => { tab = t; d.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); d.querySelector('#tabMail').hidden = t !== 'mail'; f.hidden = t === 'mail'; d.querySelector('#maak').hidden = t === 'mail'; };
  const zetCat = k => {
    cat = k; d.querySelectorAll('#catSeg [data-cat]').forEach(b => { const on = b.dataset.cat === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    d.querySelectorAll('[data-voor]').forEach(x => { x.hidden = !x.dataset.voor.split(' ').includes(k); });
    if (f.elements.plaatsSoort) f.elements.plaatsSoort.value = k === 'derde' ? 'rijden' : 'terrein'; // een derde raak je meestal onderweg of bij een klant
    d.querySelector('#catUitleg').textContent = CATEGORIEN[k].uitleg + '.';
    d.querySelector('#kentLabel').textContent = k === 'derde' ? 'Kenteken van de tegenpartij (als het een voertuig is)' : 'Kenteken van de auto';
    d.querySelector('#gebiedSel').innerHTML = opties(GEBIEDEN_VOOR[k].map(g => [g, GEBIEDEN[g]]), GEBIEDEN_VOOR[k][0]);
    d.querySelector('#voetTip').textContent = k === 'lading' ? 'De chauffeur die zelf meldt, met foto\'s, staat sterk als de claim komt.' : k === 'divers' ? 'Komt zelden voor; het dossier houdt het bij.' : 'Vraag meteen het schadeformulier aan de chauffeur.';
    if (k === 'lading') zoekRit(); else { uit.textContent = k === 'derde' ? 'Optioneel; de RDW kan het voertuig erbij zoeken.' : ''; uit.className = ''; rdwRij.hidden = !(k === 'derde' && inst.rdwLive && kentekenNorm(kent.value).length === 6); }
  };
  d.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => toonTab(b.dataset.tab))); d.querySelectorAll('#catSeg [data-cat]').forEach(b => b.addEventListener('click', () => zetCat(b.dataset.cat)));
  const zoekRit = () => {
    const kn = kentekenNorm(kent.value); rdwRij.hidden = true; if (cat !== 'lading') { rdwRij.hidden = !(cat === 'derde' && inst.rdwLive && kn.length === 6); return null; }
    if (kn.length < 4) { uit.textContent = 'Typ een kenteken; de rit wordt gezocht.'; uit.className = ''; return null; }
    const L = D.ritten.filter(r => r.kenteken === kn).sort((a, b) => b.aflever - a.aflever);
    if (L.length) { const r = L[0]; uit.innerHTML = `${ico('check')} Rit ${esc(r.id)}: ${esc(r.merk)} ${esc(r.model)}, ${esc(fmtDatumJ(r.ophaal))}, ${esc(r.chauffeurNaam)}, ${esc(r.van.plaats)} naar ${esc(r.naar.plaats)}${r.k ? ` (${esc(D.kMap.get(r.k).naam)})` : r.opdrachtgever ? ` (${esc(r.opdrachtgever)})` : ''}`; uit.className = 'tok'; if (r.k) f.elements.opdrachtgever.value = r.k; return r; }
    const eigenV = D.vloot.find(v => kentekenNorm(v.kenteken) === kn); if (eigenV) { uit.innerHTML = `${ico('truck')} Dit is ons eigen voertuig ${esc(eigenV.trekker || eigenV.id)}. Kies "Eigen voertuig" of "Derde".`; uit.className = 'twarn'; return null; }
    const deel = D.ritten.filter(r => r.kenteken.includes(kn)).length;
    uit.textContent = deel ? `Geen rit met precies dit kenteken; ${deel} ${deel === 1 ? 'rit lijkt' : 'ritten lijken'} erop.` : 'Geen rit op dit kenteken in de laatste 90 dagen: niet door ons vervoerd, of het kenteken klopt niet.'; uit.className = 'twarn';
    if (kn.length === 6 && inst.rdwLive) { rdwRij.hidden = false; rdwUit.textContent = 'Haal merk, kleur en gewicht op bij de RDW (open data; alleen het kenteken gaat erheen).'; }
    return null;
  };
  kent.addEventListener('input', zoekRit);
  d.querySelector('#rdwKnop').addEventListener('click', async () => {
    const knop = d.querySelector('#rdwKnop'); knop.disabled = true; rdwUit.textContent = 'Bezig…'; const res = await zoekRdw(kent.value); knop.disabled = false;
    if (!res.ok) { rdwUit.textContent = res.reden; rdwUit.className = 'twarn'; return; }
    if (!res.gevonden) { rdwUit.textContent = 'De RDW kent dit kenteken niet (de kentekens van de demo zijn verzonnen; typ een echt kenteken).'; rdwUit.className = 'twarn'; return; }
    rdw = res.voertuig; const v = rdw; for (const [k, w] of Object.entries({ merk: v.merk, model: v.model, kleur: v.kleur, massa: v.massa, bouwjaar: v.bouwjaar, toelating: v.toelating, catalogusprijs: v.catalogusprijs, soortVoertuig: v.soort, rdw: '1' })) f.elements[k].value = w == null ? '' : w;
    rdwUit.innerHTML = `${ico('check')} RDW: <b>${esc(v.merk)} ${esc(v.model)}</b>, ${esc(v.kleur)}, ${v.bouwjaar || ''}, ${v.massa ? `${fmtNum(v.massa)} kg` : ''}${v.catalogusprijs ? `, cataloguswaarde ${fmtEur(v.catalogusprijs)}` : ''}`; rdwUit.className = 'tok';
  });
  d.querySelector('#leesMail').addEventListener('click', () => {
    const t = d.querySelector('#mailTekst').value; if (!t.trim()) { d.querySelector('#mailTekst').focus(); return; }
    const m = leesMail(t, { nu: ctx.NU }); const uitEl = d.querySelector('#mailUit');
    const eigenV = m.kenteken.w ? D.vloot.find(v => kentekenNorm(v.kenteken) === m.kenteken.w) : null;
    zetCat(eigenV ? 'derde' : 'lading');
    if (eigenV) f.elements.eigenVoertuig.value = eigenV.trekker || eigenV.id; else if (m.kenteken.w) kent.value = kentekenToon(m.kenteken.w);
    if (m.bedrag.w) f.elements.bedrag.value = m.bedrag.w; if (m.gebied.w && [...f.elements.gebied.options].some(o => o.value === m.gebied.w)) f.elements.gebied.value = m.gebied.w; if (m.soort.w) f.elements.soort.value = m.soort.w; f.elements.ernst.value = String(m.ernst);
    if (m.datum && m.datum.w) f.elements.moment.value = lokaal(Math.min(m.datum.w, ctx.NU));
    f.elements.tekst.value = m.tekst; f.elements.bron.value = 'mail'; f.elements.uitMail.value = '1'; if (m.onderwerp) f.elements.onderwerp.value = m.onderwerp;
    if (m.afzender && !eigenV) { const k = D.opdrachtgevers.find(x => m.afzender.toLowerCase().includes(x.naam.toLowerCase())); if (k) f.elements.opdrachtgever.value = k.id; }
    const z = v => `${Math.round(v * 100)}%`;
    uitEl.innerHTML = `${eigenV ? `<div class="note warn" style="margin-top:4px">${ico('truck')}<span><b>Het kenteken in de mail is van ons eigen voertuig ${esc(eigenV.trekker || eigenV.id)}.</b> Dit lijkt een aanrijschade aan een derde; de soort staat daarop.</span></div>` : ''}<div class="uit" style="margin-top:8px"><span class="k">Kenteken</span><span class="z ${m.kenteken.z < 0.9 ? 'low' : ''}">${m.kenteken.w ? z(m.kenteken.z) : ''}</span><span class="v">${m.kenteken.w ? esc(kentekenToon(m.kenteken.w)) : '<span class="twarn">niet gevonden</span>'}</span><span></span><span class="k">Datum</span><span class="z">${m.datum.w ? z(m.datum.z) : ''}</span><span class="v">${m.datum.w ? esc(fmtDatumJ(m.datum.w)) : '<span class="mut">geen</span>'}</span><span></span><span class="k">Plek en soort</span><span class="z">${m.gebied.w ? z(m.gebied.z) : ''}</span><span class="v">${m.gebied.w ? esc(GEBIEDEN[m.gebied.w]) : '<span class="mut">geen</span>'}${m.soort.w ? `, ${esc(SOORTEN[m.soort.w].toLowerCase())}` : ''}</span><span></span><span class="k">Bedrag</span><span class="z">${m.bedrag.w ? z(m.bedrag.z) : ''}</span><span class="v">${m.bedrag.w ? fmtEur(m.bedrag.w) : '<span class="mut">geen</span>'}</span><span></span><span class="k">Afzender</span><span></span><span class="v">${m.afzender ? esc(m.afzender) : '<span class="mut">geen</span>'}</span><span></span></div>${m.kenteken.noot ? `<div class="note warn" style="margin-top:8px">${ico('alert')}<span>${esc(m.kenteken.noot)}</span></div>` : ''}<div class="row" style="margin-top:10px;justify-content:flex-end"><button type="button" class="btn pri" id="naarVelden">${ico('check')}Neem over en controleer</button></div>`;
    d.querySelector('#naarVelden').addEventListener('click', () => { toonTab('velden'); zoekRit(); kent.focus(); });
  });
  f.addEventListener('submit', ev => {
    ev.preventDefault(); const v = Object.fromEntries(new FormData(f).entries());
    if (cat === 'lading' && !kentekenNorm(v.kenteken)) { kent.focus(); return; }
    const velden = { ...v, categorie: cat, kenteken: kentekenNorm(v.kenteken), rdw: v.rdw === '1', uitMail: v.uitMail === '1', soort: cat === 'divers' ? v.soortDivers : v.soort, fase: cat === 'lading' ? v.fase : cat === 'divers' ? null : v.plaatsSoort, soort_voertuig: v.soortVoertuig };
    const id = acties.nieuwId(); acties.add({ soort: 'nieuw', id, velden, wie: inst.naam }); ctx.closeDialog();
    const c = D.claims.find(x => x.id === id); ctx.toast(`Dossier ${id} aangemaakt${cat === 'lading' ? (c.rit ? ', rit gekoppeld.' : c.voertuig.rdw ? ', voertuig van de RDW; geen rit gevonden.' : '; geen rit gevonden.') : `: ${CATEGORIEN[cat].n.toLowerCase()}.`}`); ctx.go(`schade/${id}`);
  });
  toonTab(tab); zetCat(cat); if (r0) zoekRit();
}
