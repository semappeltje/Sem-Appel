// Sommige omgevingen (een browser zonder scherm met LANG=en_US@posix, zoals in testopstellingen) geven een ongeldige
// taalcode in navigator.language. Bibliotheken die daarmee bij het laden een Intl.NumberFormat maken (uPlot) geven dan
// een fout en de app start niet. Is de code ongeldig, dan geldt hier nl-NL; een gewone browser merkt hier niets van.
// Dit bestand wordt als eerste geladen (eerste import in ui.js).
try { new Intl.NumberFormat(navigator.language); } catch {
  try { Object.defineProperty(navigator, 'language', { value: 'nl-NL', configurable: true }); Object.defineProperty(navigator, 'languages', { value: ['nl-NL'], configurable: true }); } catch { /* laat staan */ }
}
export const taal = () => navigator.language;
