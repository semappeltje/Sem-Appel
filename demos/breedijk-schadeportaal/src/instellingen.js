// De instellingen van het portaal. De getallen van Breedijk uit het gesprek (1.750 euro als grens naar de
// verzekeraar, 750 euro eigen risico, drie schades in een week is een gesprek) staan hier als standaard, niet in de
// code. De overige zijn signalen die de behandelaar zelf zet: de limiet per kilogram van de vervoerscondities
// (AVC 2002: 3,40 euro per kilogram; laten toetsen), de termijnen (zichtbare schade bij aflevering, niet zichtbare
// binnen zeven dagen; AVC en CMR, laten toetsen), onze eigen antwoordtermijn en het uurtarief dat als norm geldt bij
// het toetsen van een calculatie (schatting; een echte norm komt van de verzekeraar of een expertisebureau).
export const STANDAARD = {
  drempelVerzekeraar: 1750, eigenRisico: 750, tariefPerKg: 3.40,
  // aanrijschade: de grens naar de cascoverzekeraar en de eigen risico's zijn schattingen tot Breedijk de polis noemt
  // (in het gesprek: een geschuurde zijkant van "richting de 10.000" ging naar de verzekering, negen van de tien
  // aanrijschades herstelt de eigen werkplaats)
  cascoGrens: 5000, cascoEigenRisico: 2500, waEigenRisico: 500, werkplaatsUurtarief: 75, meldtermijnDagen: 7, antwoordWerkdagen: 10,
  gesprekAantal: 3, gesprekDagen: 7, signaalAantal: 6, signaalDagen: 90, normUurtarief: 90,
  naam: 'Ilse', rol: 'behandelaar', thema: 'licht', rdwLive: false,
};
export const ROLLEN = {
  behandelaar: { n: 'Schadebehandelaar', sub: 'beoordeelt, antwoordt, dient in', kan: ['besluit', 'toewijzen', 'chauffeur'] },
  planner: { n: 'Planner', sub: 'ziet de dossiers en de chauffeurs, besluit niet', kan: ['toewijzen'] },
  directie: { n: 'Directie', sub: 'ziet de cijfers en de signalen per chauffeur', kan: ['cijfers', 'chauffeur'] },
};
const KEY = 'bs-instellingen';
export function laadInstellingen(store) {
  try { const o = JSON.parse(store.get(KEY) || '{}'); return { ...STANDAARD, ...(o && typeof o === 'object' ? o : {}) }; } catch { return { ...STANDAARD }; }
}
export function bewaarInstellingen(store, inst) {
  const diff = {}; for (const k of Object.keys(STANDAARD)) if (inst[k] !== STANDAARD[k]) diff[k] = inst[k];
  store.set(KEY, JSON.stringify(diff));
}
