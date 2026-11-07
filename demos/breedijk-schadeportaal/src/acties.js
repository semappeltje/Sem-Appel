// Wat de behandelaar doet, blijft in de browser (localStorage `bs-acties`) en wordt bij het laden over de gesimuleerde
// dag gelegd: status en besluit, toewijzing, notities, verstuurde antwoorden en zelf aangemaakte meldingen. Zo is de
// toestand na een herlaad dezelfde als ervoor, en blijft de gesimuleerde dag zelf onaangetast ("Wis wat deze browser
// bewaart" zet alles terug).
import { BESLUITEN, STATUS, kentekenNorm } from './regels.js';
import { ritDetail, FOTOLABEL, EIGEN } from './data.js';
import { TEGENPARTIJ } from './regels.js';

const KEY = 'bs-acties';
export function createActies(store, D, nuFn) {
  let L = []; try { L = JSON.parse(store.get(KEY) || '[]'); if (!Array.isArray(L)) L = []; } catch { L = []; }
  // de basis van elke claim, om op terug te vallen
  const kopie = o => (o ? JSON.parse(JSON.stringify(o)) : o);
  for (const c of D.claims) c._basis = { status: c.status, behandelaar: c.behandelaar, besluit: c.besluit, bedragVoorstel: c.bedragVoorstel, bedragUitkomst: c.bedragUitkomst, beslotenOp: c.beslotenOp, log: c.log.slice(), formulier: kopie(c.formulier), werkorder: kopie(c.werkorder) };
  const eigen = new Map();
  function reset() { D.claims = D.claims.filter(c => !c.eigen); for (const c of D.claims) Object.assign(c, { ...c._basis, log: c._basis.log.slice(), formulier: kopie(c._basis.formulier), werkorder: kopie(c._basis.werkorder), notities: [], antwoordVerstuurd: null }); eigen.clear(); }
  function vind(id) { return D.claims.find(c => c.id === id); }
  function pas(ev) {
    if (ev.soort === 'nieuw') { const c = bouwClaim(ev); if (c) { D.claims.push(c); eigen.set(c.id, c); } return; }
    const c = vind(ev.claim); if (!c) return;
    const log = (tekst) => c.log.push({ t: ev.t, tekst, wie: ev.wie, me: true });
    if (ev.soort === 'status') { c.status = ev.status; log(ev.tekst || `Status: ${STATUS[ev.status].n}`); }
    else if (ev.soort === 'toewijzen') { c.behandelaar = ev.aan; if (c.status === 'nieuw') c.status = 'onderzoek'; log(ev.aan === ev.wie ? 'Dossier opgepakt' : `Toegewezen aan ${ev.aan}`); }
    else if (ev.soort === 'notitie') { c.notities.push({ t: ev.t, tekst: ev.tekst, wie: ev.wie }); log(`Notitie: ${ev.tekst}`); }
    else if (ev.soort === 'besluit') { const b = BESLUITEN[ev.besluit]; if ((ev.besluit === 'werkplaats' || ev.besluit === 'extern') && !c.werkorder) c.werkorder = { nummer: `WO-${c.id.slice(-4)}`, status: 'gepland', uren: c.calculatie ? c.calculatie.uren : null, onderdelen: c.calculatie ? c.calculatie.onderdelen : null, stilstand: 1, start: ev.t }; if (ev.besluit === 'werkplaats' || ev.besluit === 'extern') { c.werkorder.status = 'gepland'; c.werkorder.extern = ev.besluit === 'extern'; } c.besluit = b.status === 'wacht_tegenpartij' || b.status === 'wacht_chauffeur' || b.status === 'wacht_expert' ? c.besluit : b.status; c.status = b.status; c.bedragVoorstel = ev.bedrag ?? c.bedragVoorstel; c.beslotenOp = ev.t; c.bedragUitkomst = b.status === 'afgewezen' ? 0 : (b.status === 'erkend' || b.status === 'verzekeraar') ? (ev.bedrag ?? c.bedragGevraagd ?? 0) : c.bedragUitkomst; if (!c.behandelaar) c.behandelaar = ev.wie; log(ev.tekst || `Besluit: ${b.n}`); }
    else if (ev.soort === 'formulier') { c.formulier = c.formulier || { soort: 'eenzijdig' }; c.formulier.status = ev.status; c.formulier.op = ev.t; c.formulier.via = ev.via || null; if (ev.status === 'gevraagd' && ['nieuw', 'onderzoek'].includes(c.status)) c.status = 'wacht_chauffeur'; if (ev.status === 'ontvangen' && c.status === 'wacht_chauffeur') c.status = 'onderzoek'; if (!c.behandelaar) c.behandelaar = ev.wie; log(ev.status === 'gevraagd' ? `Schadeformulier gevraagd aan ${c.chauffeurNaam || 'de chauffeur'}` : `Schadeformulier ontvangen${ev.via ? `, ${ev.via}` : ''}`); }
    else if (ev.soort === 'werkorder') { if (c.werkorder) { c.werkorder.status = ev.status; log(`Werkorder ${c.werkorder.nummer}: ${ev.status}`); if (ev.status === 'klaar') c.status = 'gesloten'; } }
    else if (ev.soort === 'verstuurd') { c.antwoordVerstuurd = ev.t; log(ev.tekst || 'Antwoord verstuurd'); }
    else if (ev.soort === 'sluiten') { c.status = 'gesloten'; log(ev.tekst || 'Dossier gesloten'); }
  }
  function bouwClaim(ev) {
    const v = ev.velden; if (!v) return null;
    const cat = v.categorie || 'lading';
    if (cat !== 'lading') return bouwVoertuigClaim(ev, v, cat);
    if (!v.kenteken) return null;
    const kn = kentekenNorm(v.kenteken);
    const rit = D.ritten.filter(r => kentekenNorm(r.kenteken) === kn && r.aflever <= ev.t).sort((a, b) => b.aflever - a.aflever)[0] || null;
    const k = D.kMap.get(v.opdrachtgever) || (rit ? D.kMap.get(rit.k) : D.opdrachtgevers[0]);
    const vo = rit ? { kenteken: rit.kenteken, merk: rit.merk, model: rit.model, kleur: rit.kleur, bouwjaar: rit.bouwjaar, toelating: rit.toelating, massa: rit.massa, catalogusprijs: rit.catalogusprijs, soort: rit.soort, km: rit.km } : { kenteken: kn, merk: v.merk || 'Onbekend', model: v.model || '', kleur: v.kleur || '', bouwjaar: v.bouwjaar ? Number(v.bouwjaar) : null, toelating: v.toelating ? Number(v.toelating) : null, massa: Number(v.massa) || 1400, catalogusprijs: Number(v.catalogusprijs) || null, soort: v.soort_voertuig || 'personenauto', km: null, rdw: !!v.rdw };
    const bedrag = v.bedrag ? Math.round(Number(v.bedrag)) : null;
    const c = {
      id: ev.id, eigen: true, seq: 0, bron: v.bron || 'handmatig', verhaal: 'eigen', kenteken: vo.kenteken, voertuig: vo, opdrachtgever: k, rit: rit ? rit.id : null, chauffeur: rit ? rit.ch : null, chauffeurNaam: rit ? rit.chauffeurNaam : null, vestiging: rit ? rit.vestiging : null,
      gebied: v.gebied, soort: v.soort, ernst: Number(v.ernst) || 2, fase: v.fase || null, datumRit: rit ? rit.aflever : null, datumClaim: ev.t, ontvangen: ev.t,
      calculatie: bedrag ? { uren: null, uurtarief: null, onderdelen: null, lak: null, vervangen: false, dubbel: false, btw: false, totaal: bedrag, bedrijf: 'nog geen calculatie, alleen een bedrag' } : null, bedragGevraagd: bedrag, bijlagen: [], extern: '',
      fotosClaimTonenSchade: true, onderwerp: v.onderwerp || `${v.bron === 'chauffeur' ? 'Schademelding chauffeur' : 'Schademelding'} ${vo.kenteken}`, mail: v.tekst || '', uitgelezen: { kenteken: { w: vo.kenteken, z: 1 }, datum: { w: ev.t, z: 1 }, gebied: { w: v.gebied, z: 1 }, bedrag: { w: bedrag, z: bedrag ? 1 : 0 }, bijlagen: 0 },
      status: v.bron === 'chauffeur' ? 'onderzoek' : 'nieuw', behandelaar: v.bron === 'chauffeur' ? ev.wie : null, uitMail: !!v.uitMail, besluit: null, bedragVoorstel: null, beslotenOp: null, bedragUitkomst: null, notities: [], antwoordVerstuurd: null,
      log: [{ t: ev.t, tekst: v.bron === 'chauffeur' ? `Melding van de chauffeur, ingevoerd door ${ev.wie}` : v.uitMail ? `Mail geplakt en uitgelezen door ${ev.wie}` : `Handmatig ingevoerd door ${ev.wie} (${v.bron === 'telefoon' ? 'telefonisch' : 'mail'})`, wie: ev.wie, me: true }, ...(v.rdw ? [{ t: ev.t + 500, tekst: 'Voertuiggegevens opgehaald bij de RDW (open data)', wie: 'systeem' }] : []), { t: ev.t + 1000, tekst: rit ? `Rit ${rit.id} gekoppeld op kenteken (automatisch)` : 'Geen rit gevonden op dit kenteken (automatisch)', wie: 'systeem' }],
    };
    if (rit) ritDetail(rit);
    c.categorie = 'lading';
    c._basis = { status: c.status, behandelaar: c.behandelaar, besluit: null, bedragVoorstel: null, bedragUitkomst: null, beslotenOp: null, log: c.log.slice(), formulier: null, werkorder: null };
    return c;
  }
  // aanrijschade (eigen voertuig of derde) en diverse schade, ingevoerd door de behandelaar of de chauffeur
  function bouwVoertuigClaim(ev, v, cat) {
    const truck = D.vlootMap.get(v.eigenVoertuig) || D.vloot.find(x => x.soort === 'trekker');
    const opDeOpl = /^(oplegger_|bovendek|oprijplaten|achterlicht)/.test(v.gebied || ''); const eigenV = opDeOpl ? D.vlootMap.get(truck.oplegger) || truck : truck;
    const rit = D.ritten.filter(r => r.truck === truck.id && r.ophaal <= ev.t).sort((a, b) => b.ophaal - a.ophaal)[0] || null;
    const bedrag = v.bedrag ? Math.round(Number(v.bedrag)) : null; const kn = kentekenNorm(v.kenteken || '');
    const wat = v.tegenpartij || 'geparkeerd'; const auto = cat === 'derde' && (wat === 'geparkeerd' || wat === 'rijdend');
    const voertuig = cat === 'eigen' ? { kenteken: eigenV.kenteken, merk: eigenV.merk, model: eigenV.model, kleur: 'wit', bouwjaar: eigenV.bouwjaar, massa: eigenV.massa, soort: eigenV.soort } : cat === 'derde' ? (auto ? { kenteken: kn, merk: v.merk || 'Onbekend', model: v.model || '', kleur: v.kleur || '', bouwjaar: v.bouwjaar ? Number(v.bouwjaar) : null, massa: Number(v.massa) || null, soort: 'personenauto', rdw: !!v.rdw } : { kenteken: '', merk: TEGENPARTIJ[wat], model: '', soort: 'object' }) : { kenteken: truck.kenteken, merk: truck.merk, model: truck.model, kleur: 'wit', soort: 'trekker' };
    const ch = rit ? { id: rit.ch, naam: rit.chauffeurNaam } : { id: null, naam: null };
    const opdr = cat === 'derde' ? { id: `T-${ev.id.slice(-3)}`, naam: v.tegenpartijNaam || (auto ? 'Particulier' : 'Bedrijf'), soort: 'derde', plaats: v.plaats || '', btwAftrek: !auto, stijl: auto ? 'kort' : 'formeel', rol: auto ? 'eigenaar' : 'medewerker', gewicht: 0, eerder: 0 } : EIGEN;
    const c = {
      id: ev.id, eigen: true, categorie: cat, seq: 0, bron: v.bron || 'handmatig', verhaal: 'eigen', kenteken: cat === 'derde' ? kn : voertuig.kenteken, voertuig, eigenVoertuig: truck.id, oplegger: truck.oplegger, opdrachtgever: opdr,
      tegenpartij: cat === 'derde' ? { wat, partij: auto ? 'particulier' : 'bedrijf', naam: opdr.naam, aanwezig: wat === 'rijdend' } : null, rit: rit ? rit.id : null, chauffeur: ch.id, chauffeurNaam: ch.naam, vestiging: truck.vestiging,
      gebied: v.gebied || (cat === 'divers' ? 'sleutel' : 'bumper_voor'), soort: v.soort || (cat === 'divers' ? 'ontbreekt' : 'deuk'), ernst: Number(v.ernst) || 2, fase: cat === 'divers' ? null : v.fase || (cat === 'eigen' ? 'terrein' : 'rijden'), plaats: v.plaats || truck.vestiging, moment: ev.t, datumRit: ev.t, datumClaim: ev.t, ontvangen: ev.t,
      calculatie: bedrag ? { uren: null, uurtarief: null, onderdelen: null, lak: null, vervangen: false, dubbel: false, btw: false, totaal: bedrag, bedrijf: cat === 'eigen' ? 'raming, nog niet gespecificeerd' : 'nog geen calculatie, alleen een bedrag' } : null, bedragGevraagd: bedrag, bijlagen: [], extern: '',
      melding: { door: v.bron === 'chauffeur' ? 'chauffeur' : cat === 'derde' ? 'tegenpartij' : 'planner', uurNa: 0 }, formulier: { soort: wat === 'rijdend' ? 'europees' : 'eenzijdig', status: 'niet', op: null },
      gps: cat === 'derde' ? { gevonden: true, voertuig: truck.id, tijd: ev.t, afstand: 18, snelheid: 4, richting: 'achteruit', punten: [], ingevoerd: true } : null, bewijsTegenpartij: cat === 'derde' ? 'geen' : null,
      fotosClaimTonenSchade: true, onderwerp: v.onderwerp || `${cat === 'eigen' ? `Aanrijschade ${truck.id}` : cat === 'derde' ? `Aanrijschade derde: ${TEGENPARTIJ[wat].toLowerCase()}` : 'Diverse schade'}`, mail: v.tekst || '', uitgelezen: { kenteken: { w: truck.kenteken, z: 1 }, datum: { w: ev.t, z: 1 }, gebied: { w: v.gebied, z: 1 }, bedrag: { w: bedrag, z: bedrag ? 1 : 0 }, bijlagen: 0 },
      status: 'nieuw', behandelaar: null, besluit: null, bedragVoorstel: null, beslotenOp: null, bedragUitkomst: null, notities: [], antwoordVerstuurd: null, werkorder: null,
      log: [{ t: ev.t, tekst: `Handmatig ingevoerd door ${ev.wie} (${{ eigen: 'aanrijschade eigen voertuig', derde: 'aanrijschade derde', divers: 'diverse schade' }[cat]})`, wie: ev.wie, me: true }, ...(rit ? [{ t: ev.t + 1000, tekst: `Laatste rit van ${truck.id} gekoppeld: ${rit.id} (automatisch)`, wie: 'systeem' }] : [])],
    };
    c._basis = { status: c.status, behandelaar: null, besluit: null, bedragVoorstel: null, bedragUitkomst: null, beslotenOp: null, log: c.log.slice(), formulier: kopie(c.formulier), werkorder: null };
    return c;
  }
  function herspeel() { reset(); for (const ev of L) pas(ev); }
  herspeel();
  return {
    get lijst() { return L; },
    add(ev) { ev.t = ev.t || nuFn(); L.push(ev); pas(ev); store.set(KEY, JSON.stringify(L)); return ev; },
    nieuwId() { const n = L.filter(e => e.soort === 'nieuw').length + 1; return `S-2026-9${String(n).padStart(3, '0')}`; },
    wis() { L = []; store.set(KEY, '[]'); herspeel(); },
    aantal() { return L.length; },
  };
}
export { FOTOLABEL };
