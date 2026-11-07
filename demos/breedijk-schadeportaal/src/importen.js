// Geïmporteerde ritten (een csv-export uit het TMS, zie src/intake.js) over de gesimuleerde wereld heen, bewaard in de
// browser (`bs-ritten-import`, hoogstens 2.000 rijen). Zo kun je een echte export proberen zonder dat er iets naar
// buiten gaat. Een geïmporteerde rit heeft geen inspectie en geen foto's: die zitten niet in een rittenexport.
const KEY = 'bs-ritten-import'; const MAX = 2000;
export function createImporten(store, D) {
  let L = []; try { L = JSON.parse(store.get(KEY) || '[]'); if (!Array.isArray(L)) L = []; } catch { L = []; }
  function pas(r) {
    const vol = { ...r, bron: 'import', k: null, ch: r.chauffeurId || `IMP-${r.chauffeurNaam}`, bouwjaar: r.bouwjaar || (r.toelating ? new Date(r.toelating).getFullYear() : null), massa: r.massa || 1400, catalogusprijs: r.catalogusprijs || null, soort: r.soort || 'personenauto', km: r.km || 0, truck: r.truck || '', positie: r.positie || null };
    D.ritten.push(vol); D.ritMap.set(vol.id, vol);
  }
  for (const r of L) pas(r);
  return {
    get aantal() { return L.length; },
    voeg(ritten) { const nieuw = ritten.filter(r => !D.ritMap.has(r.id)); for (const r of nieuw) { pas(r); L.push(r); } if (L.length > MAX) L = L.slice(-MAX); store.set(KEY, JSON.stringify(L)); return nieuw.length; },
    wis() { for (const r of L) { D.ritMap.delete(r.id); } D.ritten = D.ritten.filter(r => r.bron !== 'import'); L = []; store.set(KEY, '[]'); },
  };
}
