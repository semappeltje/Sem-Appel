// Instellingen: de getallen van Breedijk, de regel voor het gesprek, wie je bent, de koppelingen en wat de browser
// bewaart.
import { fmtEur } from '../regels.js';
import { STANDAARD, ROLLEN } from '../instellingen.js';
import { esc, ico, bind } from '../h.js';

export function render(el, ctx) {
  const { inst, acties, store } = ctx;
  const veld = (k, label, uitleg, attrs = '') => `<label class="flabel">${label}<input class="fld" name="${k}" type="number" value="${inst[k]}" ${attrs}><small>${uitleg}</small></label>`;
  el.innerHTML = `
    <div class="ph"><div><h1>Instellingen</h1><div class="sub">De getallen uit het gesprek met Breedijk staan hier als instelling, niet in de code. Alles blijft in deze browser.</div></div></div>
    <div class="pad"><form data-sub="bewaar" class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h2>Geld en termijnen</h2></div><div class="card-b grid g2">
        ${veld('drempelVerzekeraar', 'Grens naar de verzekeraar (euro)', 'Daarboven dienen we in; daaronder betalen we zelf. Uit het gesprek: 1.750.', 'min="0" step="50"')}
        ${veld('eigenRisico', 'Eigen risico (euro)', 'Per gebeurtenis, bij de verzekeraar. Uit het gesprek: 750.', 'min="0" step="50"')}
        ${veld('tariefPerKg', 'Limiet per kilogram (euro)', 'AVC 2002: 3,40 per kilogram; internationaal (CMR) 8,33 SDR. Signaal, laten toetsen.', 'min="0" step="0.01"')}
        ${veld('meldtermijnDagen', 'Meldtermijn tegenpartij (dagen)', 'Zichtbare schade bij aflevering, niet zichtbare binnen zeven dagen (AVC en CMR, laten toetsen).', 'min="0" step="1"')}
        ${veld('antwoordWerkdagen', 'Ons antwoord binnen (werkdagen)', 'Daarna kleurt het dossier rood op het overzicht.', 'min="1" step="1"')}
        ${veld('normUurtarief', 'Gangbaar uurtarief (euro)', 'De norm bij het toetsen van een calculatie. Schatting; vraag het tarief van de verzekeraar of een expertisebureau.', 'min="0" step="1"')}
      </div></div>
      <div class="stack" style="gap:16px">
        <div class="card"><div class="card-h"><h2>De regel voor het gesprek</h2></div><div class="card-b stack">
          <div class="grid g2">${veld('gesprekAantal', 'Schades', 'Uit het gesprek: drie.', 'min="1" step="1"')}${veld('gesprekDagen', 'Binnen (dagen)', 'Uit het gesprek: een week.', 'min="1" step="1"')}${veld('signaalAantal', 'Tweede signaal: schades', 'Een zachter signaal over een langere periode.', 'min="1" step="1"')}${veld('signaalDagen', 'Binnen (dagen)', '', 'min="1" step="1"')}</div>
          <div class="note">${ico('shield')}<span>Afgewezen claims tellen niet. Het beeld per chauffeur is voor coaching; per persoon bijhouden wie schade rijdt raakt de AVG en vraagt instemming van de OR (signaal, laten toetsen).</span></div>
        </div></div>
        <div class="card"><div class="card-h"><h2>Jij</h2></div><div class="card-b grid g2">
          <label class="flabel">Naam<input class="fld" name="naam" type="text" value="${esc(inst.naam)}" maxlength="40"><small>Staat in het logboek bij wat je doet.</small></label>
          <label class="flabel">Rol<select class="fld" name="rol">${Object.entries(ROLLEN).map(([k, r]) => `<option value="${k}" ${inst.rol === k ? 'selected' : ''}>${r.n}</option>`).join('')}</select><small>${esc(ROLLEN[inst.rol].sub)}</small></label>
          <label class="flabel">Thema<select class="fld" name="thema"><option value="licht" ${inst.thema === 'licht' ? 'selected' : ''}>Licht</option><option value="donker" ${inst.thema === 'donker' ? 'selected' : ''}>Donker</option></select></label>
        </div></div>
      </div>
      <div class="card" style="grid-column:1/-1"><div class="card-h"><h2>Koppelingen</h2><span class="tag sim">in deze demo gesimuleerd</span></div><div class="card-b tight"><table class="tbl plain compact" style="padding:0 16px"><tbody>
        <tr><td style="padding-left:16px"><b>Schade-mailbox (Outlook)</b><div class="mut">Elke mail in schade@ wordt een melding; bijlagen (foto's, calculatie) komen mee.</div></td><td><span class="pill plain warn">gesimuleerd</span></td><td class="wrap mut" style="padding-right:16px">In het echt: Microsoft Graph op de gedeelde mailbox (toestemming Mail.Read van de Microsoft 365-beheerder), of zonder code via Power Automate "When a new email arrives in a shared mailbox".</td></tr>
        <tr><td style="padding-left:16px"><b>Transpas (TMS)</b><div class="mut">De rit op kenteken en datum: chauffeur, truck, inspecties, foto's, handtekening.</div></td><td><span class="pill plain warn">gesimuleerd</span></td><td class="wrap mut" style="padding-right:16px">In het echt: de API van Transpas via Art Systems (eerst een testomgeving), of een dagelijkse export. De foto's staan mogelijk bij de leverancier van de chauffeursapp; dat is de eerste vraag aan Art Systems.</td></tr>
        <tr><td style="padding-left:16px"><b>RDW open data</b><div class="mut">Merk, model, kleur, gewicht en cataloguswaarde bij een kenteken.</div></td><td><span class="pill plain warn">gesimuleerd</span></td><td class="wrap mut" style="padding-right:16px">In het echt: opendata.rdw.nl (gratis, open licentie). Het gewicht geeft de limiet per kilogram, de velden controleren het kenteken uit de mail.</td></tr>
        <tr><td style="padding-left:16px"><b>Taalmodel (Claude API)</b><div class="mut">Velden uit de mail, de foto's naast elkaar, het conceptantwoord.</div></td><td><span class="pill plain">uit</span></td><td class="wrap mut" style="padding-right:16px">In de demo vaste zinnen. In het echt alleen de tekst van de mail en de foto's van dat dossier, contactgegevens eerst gewist; nooit het chauffeursoverzicht.</td></tr>
        <tr><td style="padding-left:16px"><b>Verzekeraar</b><div class="mut">Indienen van een erkend dossier boven de grens.</div></td><td><span class="pill plain">handmatig</span></td><td class="wrap mut" style="padding-right:16px">Per mail met het complete dossier (vrachtbrief, inspecties, foto's, claim, calculatie); de meeste verzekeraars hebben een portaal, soms een koppeling.</td></tr>
      </tbody></table></div></div>
      <div class="card" style="grid-column:1/-1"><div class="card-h"><h2>Wat deze browser bewaart</h2></div><div class="card-b row" style="justify-content:space-between"><span class="mut">${acties.aantal()} ${acties.aantal() === 1 ? 'handeling' : 'handelingen'} (besluiten, toewijzingen, notities, eigen meldingen) en deze instellingen, in localStorage. Niets gaat naar een server.</span><button type="button" class="btn danger" data-act="wis">${ico('trash')}Wis alles en begin opnieuw</button></div></div>
      <div class="row" style="grid-column:1/-1;justify-content:flex-end;gap:8px"><button type="button" class="btn" data-act="standaard">Terug naar de standaard</button><button type="submit" class="btn pri">${ico('save')}Bewaar</button></div>
    </form></div>`;
  bind(el, {
    bewaar: f => { const p = {}; for (const k of Object.keys(STANDAARD)) { const x = f.elements[k]; if (!x) continue; p[k] = x.type === 'number' ? Number(x.value) : x.value; } if (!p.naam) p.naam = 'Behandelaar'; ctx.setInst(p); ctx.toast('Instellingen bewaard.'); },
    standaard: () => { ctx.setInst({ ...STANDAARD, naam: inst.naam, thema: inst.thema }); ctx.toast('Standaardwaarden teruggezet.'); },
    wis: () => { const d = ctx.dialog(`<div class="dlg-h"><h2 id="dlgTitle">Alles wissen?</h2><button type="button" class="ib" data-close aria-label="Sluiten">${ico('x')}</button></div><div class="dlg-b"><p>Dit wist ${acties.aantal()} handelingen en de instellingen uit deze browser. De gesimuleerde dag begint opnieuw.</p></div><div class="dlg-f"><button type="button" class="btn" data-close>Annuleer</button><button type="button" class="btn pri danger" id="ok">Wis alles</button></div>`); d.querySelector('#ok').addEventListener('click', () => { acties.wis(); for (const k of ['bs-instellingen', 'bs-intro', 'bs-nav']) store.set(k, ''); try { localStorage.removeItem('bs-instellingen'); localStorage.removeItem('bs-intro'); localStorage.removeItem('bs-nav'); } catch { /* geen opslag */ } ctx.closeDialog(); location.hash = ''; location.reload(); }); },
  });
}
