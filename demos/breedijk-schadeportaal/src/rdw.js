// De RDW open data (opendata.rdw.nl, dataset Gekentekende voertuigen m9d7-ebf2, publiek domein): merk, handelsbenaming,
// kleur, datum eerste toelating, massa en cataloguswaarde bij een kenteken. Alleen op verzoek van de gebruiker en alleen
// als de schakelaar "RDW live" aanstaat: dan gaat precies een kenteken naar de RDW, verder niets. Een kenteken uit de
// demo bestaat niet bij de RDW; typ een echt kenteken om het te zien werken.
import { kentekenNorm } from './regels.js';

const BASIS = 'https://opendata.rdw.nl/resource/m9d7-ebf2.json';
const kleur = s => (s || '').toLowerCase().replace('niet geregistreerd', '').trim();
const naam = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bBmw\b/, 'BMW').replace(/\bVw\b/, 'VW').replace(/-benz/i, '-Benz');
export async function zoekRdw(kenteken, fetchFn = (typeof fetch === 'function' ? fetch : null)) {
  const k = kentekenNorm(kenteken); if (k.length !== 6) return { ok: false, reden: 'Geen geldig kenteken.' };
  if (!fetchFn) return { ok: false, reden: 'Geen netwerk beschikbaar.' };
  const ctl = typeof AbortController === 'function' ? new AbortController() : null; const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
  try {
    const res = await fetchFn(`${BASIS}?kenteken=${encodeURIComponent(k)}`, { signal: ctl ? ctl.signal : undefined, headers: { accept: 'application/json' } });
    if (!res.ok) return { ok: false, reden: `De RDW antwoordde met ${res.status}.` };
    const rijen = await res.json(); if (!Array.isArray(rijen) || !rijen.length) return { ok: true, gevonden: false, kenteken: k };
    const r = rijen[0]; const toel = r.datum_eerste_toelating ? new Date(Number(r.datum_eerste_toelating.slice(0, 4)), Number(r.datum_eerste_toelating.slice(4, 6)) - 1, Number(r.datum_eerste_toelating.slice(6, 8))).getTime() : null;
    return { ok: true, gevonden: true, kenteken: k, voertuig: { kenteken: k, merk: naam(r.merk), model: naam((r.handelsbenaming || '').replace(new RegExp('^' + (r.merk || '') + '\\s*', 'i'), '')), kleur: kleur(r.eerste_kleur), bouwjaar: toel ? new Date(toel).getFullYear() : null, toelating: toel, massa: Number(r.massa_ledig_voertuig) || null, massaRijklaar: Number(r.massa_rijklaar) || null, catalogusprijs: Number(r.catalogusprijs) || null, soort: (r.voertuigsoort || '').toLowerCase(), apk: r.vervaldatum_apk || null } };
  } catch (e) { return { ok: false, reden: e && e.name === 'AbortError' ? 'De RDW antwoordde niet binnen acht seconden.' : 'De RDW is niet bereikbaar vanaf dit netwerk.' }; }
  finally { if (timer) clearTimeout(timer); }
}
// de vergelijking met wat het dossier zegt: klopt merk en kleur
export function vergelijkRdw(v, dossier) {
  const punten = [];
  if (dossier.merk && v.merk && dossier.merk.toLowerCase() !== v.merk.toLowerCase()) punten.push(`merk: dossier ${dossier.merk}, RDW ${v.merk}`);
  if (dossier.kleur && v.kleur && dossier.kleur.toLowerCase() !== v.kleur.toLowerCase()) punten.push(`kleur: dossier ${dossier.kleur}, RDW ${v.kleur}`);
  return punten;
}
