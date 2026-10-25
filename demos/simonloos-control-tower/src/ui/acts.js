// Wat de planner vandaag deed, in de browser bewaard (localStorage sl-acties, één sleutel met de datum erin; een nieuwe
// dag begint leeg): per melding de zaak (status, eigenaar, later, notities, tijdlijn, ontstaan), toegepaste voorstellen,
// berichten aan chauffeurs, de acties op het plan (na een herlaad opnieuw uitgevoerd, in dezelfde volgorde) en het
// logboek van de planner. Instellingen (naam, meldingsnormen) staan apart in sl-instellingen.
import { SOORT } from './base.js';

export function createActs(store, state) {
  const now0 = new Date(); const DAY = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}-${String(now0.getDate()).padStart(2, '0')}`;
  let acts = { day: DAY, handled: {}, applied: [], msgs: {}, actions: [], log: [] };
  try {
    const a = JSON.parse(store.get('sl-acties') || 'null');
    if (a && a.day === DAY) acts = { day: DAY, handled: a.handled || {}, applied: a.applied || [], msgs: a.msgs || {}, actions: a.actions || [], log: a.log || [] };
  } catch { /* leeg beginnen */ }
  let timer = null;
  const save = () => { clearTimeout(timer); timer = null; store.set('sl-acties', JSON.stringify(acts)); };
  const saveSoon = () => { if (!timer) timer = setTimeout(save, 2500); };
  const rec = key => acts.handled[key] || (acts.handled[key] = {});

  let set = {}; try { set = JSON.parse(store.get('sl-instellingen') || '{}') || {}; } catch { set = {}; }
  const saveSet = () => store.set('sl-instellingen', JSON.stringify(set));
  const settings = {
    naam: () => (set.naam || '').trim() || 'Planner',
    setNaam: v => { set.naam = String(v || '').slice(0, 40); saveSet(); },
    norm: kind => { const v = set.normen && +set.normen[kind]; return v > 0 ? v : SOORT[kind].norm; },
    setNorm: (kind, v) => { set.normen = set.normen || {}; const n = Math.max(1, Math.min(600, Math.round(+v || 0))); if (n) set.normen[kind] = n; saveSet(); },
    resetNormen: () => { delete set.normen; saveSet(); },
    get: k => set[k], set: (k, v) => { set[k] = v; saveSet(); },
  };
  // logboek van de planner: wie, wat, wanneer (simulatietijd) en waarnaar het verwijst
  function log(txt, ref = {}, who) { acts.log.unshift({ T: state.simTime, txt, who: who || settings.naam(), ...ref }); if (acts.log.length > 400) acts.log.length = 400; save(); }
  return { acts, DAY, save, saveSoon, rec, log, settings };
}
