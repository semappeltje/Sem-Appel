// Nieuwe melding: een claim die telefonisch of per mail buiten de mailbox komt, of wat een chauffeur zelf meldt. Het
// kenteken zoekt meteen de rit in de ritten van de laatste negentig dagen.
import { GEBIEDEN, SOORTEN, ERNST, kentekenNorm, kentekenToon, fmtDatumJ, fmtEur } from '../regels.js';
import { esc, plaat, ico } from '../h.js';

export function nieuweMelding(ctx, vooraf = {}) {
  const { D, inst, acties } = ctx;
  if (!ctx.kan('besluit') && !ctx.kan('melden')) { ctx.toast('Een melding invoeren is er voor de schadebehandeling en de chauffeur.', { icon: 'lock' }); return; }
  const r0 = vooraf.rit ? D.ritMap.get(vooraf.rit) : null;
  const d = ctx.dialog(`<div class="dlg-h"><h2 id="dlgTitle">Nieuwe melding</h2><button type="button" class="ib" data-close aria-label="Sluiten">${ico('x')}</button></div>
    <form class="dlg-b" id="nf">
      <div class="grid g2">
        <label class="flabel">Bron<select class="fld" name="bron">${inst.rol === 'chauffeur' ? '' : '<option value="telefoon">Telefonisch</option><option value="mail">Mail buiten schade@</option>'}<option value="chauffeur" ${inst.rol === 'chauffeur' ? 'selected' : ''}>Chauffeur meldt zelf</option></select></label>
        <label class="flabel">Kenteken<input class="fld" name="kenteken" autocomplete="off" placeholder="XX-123-X" value="${esc(r0 ? kentekenToon(r0.kenteken) : '')}" autofocus required><small id="ritUit">Typ een kenteken; de rit wordt gezocht.</small></label>
      </div>
      <label class="flabel">Opdrachtgever<select class="fld" name="opdrachtgever">${D.opdrachtgevers.map(k => `<option value="${k.id}" ${r0 && r0.k === k.id ? 'selected' : ''}>${esc(k.naam)}</option>`).join('')}</select></label>
      <div class="grid g3">
        <label class="flabel">Plek<select class="fld" name="gebied">${Object.entries(GEBIEDEN).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
        <label class="flabel">Soort<select class="fld" name="soort">${Object.entries(SOORTEN).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
        <label class="flabel">Grootte<select class="fld" name="ernst">${Object.entries(ERNST).map(([k, n]) => `<option value="${k}" ${k === '2' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
      <div class="grid g2"><label class="flabel">Gevraagd bedrag (euro, als genoemd)<input class="fld" name="bedrag" type="number" min="0" step="10"></label><label class="flabel">Fase<select class="fld" name="fase"><option value="">Onbekend</option><option value="laden">Bij het laden</option><option value="rijden">Onderweg</option><option value="lossen">Bij het lossen</option><option value="terrein">Op het terrein</option></select></label></div>
      <label class="flabel">Wat is er gemeld<textarea class="fld" name="tekst" rows="3" placeholder="In de woorden van de melder"></textarea></label>
    </form>
    <div class="dlg-f"><span class="l">De chauffeur die zelf meldt, met foto's, staat sterk als de claim komt.</span><button type="button" class="btn" data-close>Annuleer</button><button type="submit" form="nf" class="btn pri">${ico('plus')}Maak dossier</button></div>`);
  const f = d.querySelector('#nf'); const uit = d.querySelector('#ritUit'); const kent = f.elements.kenteken;
  const zoekRit = () => { const kn = kentekenNorm(kent.value); if (kn.length < 4) { uit.textContent = 'Typ een kenteken; de rit wordt gezocht.'; uit.className = ''; return null; } const L = D.ritten.filter(r => r.kenteken === kn).sort((a, b) => b.aflever - a.aflever); if (L.length) { const r = L[0]; uit.innerHTML = `${ico('check')} Rit ${esc(r.id)}: ${esc(r.merk)} ${esc(r.model)}, ${esc(fmtDatumJ(r.ophaal))}, ${esc(r.chauffeurNaam)}, ${esc(r.van.plaats)} naar ${esc(r.naar.plaats)} (${esc(D.kMap.get(r.k).naam)})`; uit.className = 'tok'; f.elements.opdrachtgever.value = r.k; return r; } const deel = D.ritten.filter(r => r.kenteken.includes(kn)).length; uit.textContent = deel ? `Geen rit met precies dit kenteken; ${deel} ${deel === 1 ? 'rit lijkt' : 'ritten lijken'} erop.` : 'Geen rit op dit kenteken in de laatste 90 dagen: dan is de auto niet door ons vervoerd, of klopt het kenteken niet.'; uit.className = 'twarn'; return null; };
  kent.addEventListener('input', zoekRit); if (r0) zoekRit();
  f.addEventListener('submit', ev => { ev.preventDefault(); const v = Object.fromEntries(new FormData(f).entries()); if (!kentekenNorm(v.kenteken)) { kent.focus(); return; } const id = acties.nieuwId(); acties.add({ soort: 'nieuw', id, velden: { ...v, kenteken: kentekenNorm(v.kenteken) }, wie: inst.naam }); ctx.closeDialog(); ctx.toast(`Dossier ${id} aangemaakt${D.claims.find(c => c.id === id).rit ? ', rit gekoppeld.' : '; geen rit gevonden.'}`); ctx.go(`schade/${id}`); });
}
