// Wat de behandelaar doet, blijft in de browser (localStorage `bs-acties`) en wordt bij het laden over de gesimuleerde
// dag gelegd: status en besluit, toewijzing, notities, verstuurde antwoorden en zelf aangemaakte meldingen. Zo is de
// toestand na een herlaad dezelfde als ervoor, en blijft de gesimuleerde dag zelf onaangetast ("Wis wat deze browser
// bewaart" zet alles terug).
import { BESLUITEN, STATUS, kentekenNorm } from './regels.js';
import { ritDetail, FOTOLABEL } from './data.js';

const KEY = 'bs-acties';
export function createActies(store, D, nuFn) {
  let L = []; try { L = JSON.parse(store.get(KEY) || '[]'); if (!Array.isArray(L)) L = []; } catch { L = []; }
  // de basis van elke claim, om op terug te vallen
  for (const c of D.claims) c._basis = { status: c.status, behandelaar: c.behandelaar, besluit: c.besluit, bedragVoorstel: c.bedragVoorstel, bedragUitkomst: c.bedragUitkomst, beslotenOp: c.beslotenOp, log: c.log.slice() };
  const eigen = new Map();
  function reset() { D.claims = D.claims.filter(c => !c.eigen); for (const c of D.claims) Object.assign(c, { ...c._basis, log: c._basis.log.slice(), notities: [], antwoordVerstuurd: null }); eigen.clear(); }
  function vind(id) { return D.claims.find(c => c.id === id); }
  function pas(ev) {
    if (ev.soort === 'nieuw') { const c = bouwClaim(ev); if (c) { D.claims.push(c); eigen.set(c.id, c); } return; }
    const c = vind(ev.claim); if (!c) return;
    const log = (tekst) => c.log.push({ t: ev.t, tekst, wie: ev.wie, me: true });
    if (ev.soort === 'status') { c.status = ev.status; log(ev.tekst || `Status: ${STATUS[ev.status].n}`); }
    else if (ev.soort === 'toewijzen') { c.behandelaar = ev.aan; if (c.status === 'nieuw') c.status = 'onderzoek'; log(ev.aan === ev.wie ? 'Dossier opgepakt' : `Toegewezen aan ${ev.aan}`); }
    else if (ev.soort === 'notitie') { c.notities.push({ t: ev.t, tekst: ev.tekst, wie: ev.wie }); log(`Notitie: ${ev.tekst}`); }
    else if (ev.soort === 'besluit') { const b = BESLUITEN[ev.besluit]; c.besluit = b.status === 'wacht_tegenpartij' || b.status === 'wacht_chauffeur' || b.status === 'wacht_expert' ? c.besluit : b.status; c.status = b.status; c.bedragVoorstel = ev.bedrag ?? c.bedragVoorstel; c.beslotenOp = ev.t; c.bedragUitkomst = b.status === 'afgewezen' ? 0 : (b.status === 'erkend' || b.status === 'verzekeraar') ? (ev.bedrag ?? c.bedragGevraagd ?? 0) : c.bedragUitkomst; if (!c.behandelaar) c.behandelaar = ev.wie; log(ev.tekst || `Besluit: ${b.n}`); }
    else if (ev.soort === 'verstuurd') { c.antwoordVerstuurd = ev.t; log(ev.tekst || 'Antwoord verstuurd'); }
    else if (ev.soort === 'sluiten') { c.status = 'gesloten'; log(ev.tekst || 'Dossier gesloten'); }
  }
  function bouwClaim(ev) {
    const v = ev.velden; if (!v || !v.kenteken) return null;
    const kn = kentekenNorm(v.kenteken);
    const rit = D.ritten.filter(r => kentekenNorm(r.kenteken) === kn && r.aflever <= ev.t).sort((a, b) => b.aflever - a.aflever)[0] || null;
    const k = D.kMap.get(v.opdrachtgever) || (rit ? D.kMap.get(rit.k) : D.opdrachtgevers[0]);
    const vo = rit ? { kenteken: rit.kenteken, merk: rit.merk, model: rit.model, kleur: rit.kleur, bouwjaar: rit.bouwjaar, toelating: rit.toelating, massa: rit.massa, catalogusprijs: rit.catalogusprijs, soort: rit.soort, km: rit.km } : { kenteken: kn, merk: v.merk || 'Onbekend', model: v.model || '', kleur: '', bouwjaar: null, toelating: null, massa: v.massa || 1400, catalogusprijs: null, soort: 'personenauto', km: null };
    const bedrag = v.bedrag ? Math.round(Number(v.bedrag)) : null;
    const c = {
      id: ev.id, eigen: true, seq: 0, bron: v.bron || 'handmatig', verhaal: 'eigen', kenteken: vo.kenteken, voertuig: vo, opdrachtgever: k, rit: rit ? rit.id : null, chauffeur: rit ? rit.ch : null, chauffeurNaam: rit ? rit.chauffeurNaam : null, vestiging: rit ? rit.vestiging : null,
      gebied: v.gebied, soort: v.soort, ernst: Number(v.ernst) || 2, fase: v.fase || null, datumRit: rit ? rit.aflever : null, datumClaim: ev.t, ontvangen: ev.t,
      calculatie: bedrag ? { uren: null, uurtarief: null, onderdelen: null, lak: null, vervangen: false, dubbel: false, btw: false, totaal: bedrag, bedrijf: 'nog geen calculatie, alleen een bedrag' } : null, bedragGevraagd: bedrag, bijlagen: [], extern: '',
      fotosClaimTonenSchade: true, onderwerp: v.onderwerp || `${v.bron === 'chauffeur' ? 'Schademelding chauffeur' : 'Schademelding'} ${vo.kenteken}`, mail: v.tekst || '', uitgelezen: { kenteken: { w: vo.kenteken, z: 1 }, datum: { w: ev.t, z: 1 }, gebied: { w: v.gebied, z: 1 }, bedrag: { w: bedrag, z: bedrag ? 1 : 0 }, bijlagen: 0 },
      status: v.bron === 'chauffeur' ? 'onderzoek' : 'nieuw', behandelaar: v.bron === 'chauffeur' ? ev.wie : null, besluit: null, bedragVoorstel: null, beslotenOp: null, bedragUitkomst: null, notities: [], antwoordVerstuurd: null,
      log: [{ t: ev.t, tekst: v.bron === 'chauffeur' ? `Melding van de chauffeur, ingevoerd door ${ev.wie}` : `Handmatig ingevoerd door ${ev.wie} (${v.bron === 'telefoon' ? 'telefonisch' : 'mail'})`, wie: ev.wie, me: true }, { t: ev.t + 1000, tekst: rit ? `Rit ${rit.id} gekoppeld op kenteken (automatisch)` : 'Geen rit gevonden op dit kenteken (automatisch)', wie: 'systeem' }],
    };
    if (rit) ritDetail(rit);
    c._basis = { status: c.status, behandelaar: c.behandelaar, besluit: null, bedragVoorstel: null, bedragUitkomst: null, beslotenOp: null, log: c.log.slice() };
    return c;
  }
  function herspeel() { reset(); for (const ev of L) pas(ev); }
  herspeel();
  return {
    get lijst() { return L; },
    add(ev) { ev.t = ev.t || nuFn(); L.push(ev); pas(ev); store.set(KEY, JSON.stringify(L)); return ev; },
    nieuwId() { const n = L.filter(e => e.soort === 'nieuw').length + 1; return `S-2026-${String(700 + n).padStart(4, '0')}`; },
    wis() { L = []; store.set(KEY, '[]'); herspeel(); },
    aantal() { return L.length; },
  };
}
export { FOTOLABEL };
