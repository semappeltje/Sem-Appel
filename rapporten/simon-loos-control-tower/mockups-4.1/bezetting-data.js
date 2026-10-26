// Gesimuleerde bezetting van Wognum voor veertien dagen (di 27 oktober tot en met ma 9 november 2026).
// Per dag en dagdeel: nodig (ritten uit het plan plus de prognose uit de historie) en het verschil met wat het rooster
// kan (na vakantie, ziek, rust en rij- en rusttijden). Negatief is tekort, positief is overschot.
// Kosten (schatting): een tekort als charter voor een dienst van 9 uur tegen 55 euro per uur (het middelste
// chartertarief in de demo, src/inzet.js) = 495 euro; een overschot als 9 betaalde uren tegen 33 euro (EIGEN_UUR) = 297 euro.
window.BEZ = (function () {
  const dagen = ['di 27', 'wo 28', 'do 29', 'vr 30', 'za 31', 'zo 1', 'ma 2', 'di 3', 'wo 4', 'do 5', 'vr 6', 'za 7', 'zo 8', 'ma 9'];
  const lang = ['dinsdag 27 oktober', 'woensdag 28 oktober', 'donderdag 29 oktober', 'vrijdag 30 oktober', 'zaterdag 31 oktober', 'zondag 1 november', 'maandag 2 november', 'dinsdag 3 november', 'woensdag 4 november', 'donderdag 5 november', 'vrijdag 6 november', 'zaterdag 7 november', 'zondag 8 november', 'maandag 9 november'];
  const delen = ['Vroeg', 'Dag', 'Avond', 'Nacht'];
  const uren = ['04:00 tot 08:00', '08:00 tot 14:00', '14:00 tot 20:00', '20:00 tot 04:00'];
  const werk = [34, 22, 14, 6], zat = [24, 14, 6, 2], zon = [8, 6, 4, 4];
  const nodig = dagen.map(d => d.startsWith('za') ? zat : d.startsWith('zo') ? zon : werk);
  // verschil per dagdeel: vroeg, dag, avond, nacht
  const verschil = [
    [-2, 1, 0, 0], [-1, 2, 1, 0], [-3, 0, -1, 0], [-4, -1, 1, 0], [-2, 1, 0, 1], [0, 2, 1, 0], [-2, 1, 0, 0],
    [-5, 1, 0, 1], [-2, 2, 0, 0], [-3, 0, -1, 0], [-4, -2, 0, 0], [-1, 2, 1, 0], [0, 1, 1, 0], [-1, 2, 1, 0],
  ];
  const TEKORT_EUR = 495, OVER_EUR = 297;
  let tekort = 0, over = 0;
  verschil.forEach(r => r.forEach(v => { if (v < 0) tekort -= v; else over += v; }));
  const perDag = verschil.map(r => ({ tekort: r.reduce((s, v) => s + (v < 0 ? -v : 0), 0), over: r.reduce((s, v) => s + (v > 0 ? v : 0), 0) }));
  return { dagen, lang, delen, uren, nodig, verschil, tekort, over, perDag, TEKORT_EUR, OVER_EUR,
    kostenTekort: tekort * TEKORT_EUR, kostenOver: over * OVER_EUR };
})();
