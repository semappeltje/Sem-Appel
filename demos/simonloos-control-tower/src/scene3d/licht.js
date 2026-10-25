// Daglicht uit de klok van de simulatie: de stand van de zon boven Wognum (52,7 graden noord) op de dag en het uur van de
// simulatie, en wat dat betekent voor het licht in de 3D-wereld. Vier staten die vloeiend in elkaar overgaan: nacht,
// schemer (blauw uur), gouden uur en dag; met hemelkleur, de kleur en sterkte van het zonlicht, nevel, belichting en de
// lampen (lichtmasten, docks, ramen, koplampen) die pas vanaf de schemer aangaan. Geen imports: ook in Node te testen.

export const LAT = 52.7, LON = 5.03;
const RAD = Math.PI / 180;

// ---------- Nederlandse tijd ----------
// UTC+1; zomertijd (UTC+2) van de laatste zondag van maart 01:00 UTC tot de laatste zondag van oktober 01:00 UTC (EU-regel)
const laatsteZondag = (jaar, maand) => { const d = new Date(Date.UTC(jaar, maand + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
export function zomertijd(utcMs) {
  const j = new Date(utcMs).getUTCFullYear();
  return utcMs >= Date.UTC(j, 2, laatsteZondag(j, 2), 1) && utcMs < Date.UTC(j, 9, laatsteZondag(j, 9), 1);
}
// de klok van de simulatie (minuten na middernacht, Nederlandse tijd) op datum [jaar, maand, dag] naar een UTC-tijdstip;
// op de dag dat de klok teruggaat telt het uur dat twee keer komt als zomertijd
export function naarUtc(datum, minuten) {
  const lokaal = Date.UTC(datum[0], datum[1] - 1, datum[2]) + minuten * 60000;
  const zomer = lokaal - 7200000; return zomertijd(zomer) ? zomer : lokaal - 3600000;
}
// de datum van vandaag (zoals de simulatie die gebruikt: de dag waarop de app opende)
export const vandaag = (d = new Date()) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

// ---------- stand van de zon (benadering van de NOAA, op een honderdste graad) ----------
// h: hoogte boven de horizon, az: richting vanaf het noorden met de klok mee (graden)
export function zonStand(utcMs, lat = LAT, lon = LON) {
  const d = utcMs / 86400000 - 10957.5;               // dagen sinds 1 januari 2000, 12:00 UTC
  const g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = 18.697374558 + 24.06570982441908 * d; const ha = (gmst * 15 + lon) * RAD - ra; const la = lat * RAD;
  const h = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { h: h / RAD, az: (az / RAD % 360 + 360) % 360 };
}
// zonsopgang en -ondergang (de bovenrand van de zon op de horizon, met straalbreking: −0,833 graden) in minuten
// Nederlandse tijd, of null (geen opgang of ondergang die dag)
export function zonOpOnder(datum, lat = LAT, lon = LON) {
  const h = m => zonStand(naarUtc(datum, m), lat, lon).h + 0.833; let op = null, onder = null;
  for (let m = 0; m < 1440; m += 2) {
    const a = h(m), b = h(m + 2); if ((a < 0) === (b < 0)) continue;
    let lo = m, hi = m + 2; for (let k = 0; k < 20; k++) { const mid = (lo + hi) / 2; if ((h(mid) < 0) === (a < 0)) lo = mid; else hi = mid; }
    if (a < 0) op = op == null ? (lo + hi) / 2 : op; else onder = (lo + hi) / 2;
  }
  return { op, onder };
}

// ---------- licht per zonnestand ----------
// Ijkpunten op de hoogte van de zon (graden), daartussen vloeiend. zon: kleur en sterkte van het zonlicht (in het
// donker het maanlicht), hemel: kleur boven, kleur van de grond en sterkte van het hemellicht, omgeving: sterkte van de
// lucht in glans en glas, belichting: toneMappingExposure, lampen: 0 uit tot 1 vol aan, donker: hoe donker de grond is
// (0 dag, 1 nacht), nevel: kleur van de nevel in de verte, sluier: de kleur waarmee de kaart onder de wereld wordt
// vermenigvuldigd (wit: niets; 's nachts donkerblauw, zodat een lichte kaart mee de avond in gaat), schaduw: dekking
// van de schaduw op de kaart. De dag (vanaf 25 graden) is het licht van voorheen.
const IJK = [
  { h: -14, zon: 0x9DB0DA, zi: 0.5, hb: 0x7F93B8, hg: 0x1A1F2A, hi: 0.92, env: 0.55, exp: 1.22, lampen: 1, donker: 1, nevel: 0x161D29, sluier: 0x3E485E, schaduw: 0.3 },
  { h: -6.5, zon: 0x8296C8, zi: 0.12, hb: 0x7488B8, hg: 0x2A3042, hi: 1.25, env: 0.62, exp: 1.17, lampen: 1, donker: 0.62, nevel: 0x3A4862, sluier: 0x7480A2, schaduw: 0.08 },
  { h: -1.5, zon: 0xFF9466, zi: 0.32, hb: 0x9AA8C8, hg: 0x4C4A4C, hi: 0.66, env: 0.55, exp: 1.08, lampen: 0.55, donker: 0.28, nevel: 0x9AA2B4, sluier: 0xC4BCC2, schaduw: 0.12 },
  { h: 3, zon: 0xFFA868, zi: 1.7, hb: 0xBFC8DA, hg: 0x908A7A, hi: 0.6, env: 0.62, exp: 1.06, lampen: 0, donker: 0.04, nevel: 0xD9D3C9, sluier: 0xF7EDE2, schaduw: 0.22 },
  { h: 11, zon: 0xFFDDB6, zi: 2.75, hb: 0xD3DEEC, hg: 0xAEB3A2, hi: 0.6, env: 0.7, exp: 1.06, lampen: 0, donker: 0, nevel: 0xE2E8EC, sluier: 0xFFFFFF, schaduw: 0.26 },
  { h: 25, zon: 0xFFF0DA, zi: 3.3, hb: 0xDCE8F5, hg: 0xB9C1AE, hi: 0.62, env: 0.72, exp: 1.06, lampen: 0, donker: 0, nevel: 0xE6EDF3, sluier: 0xFFFFFF, schaduw: 0.28 },
];
const glad = t => t * t * (3 - 2 * t);
const mengHex = (a, b, t) => { const c = k => Math.round(((a >> k) & 255) + (((b >> k) & 255) - ((a >> k) & 255)) * t); return (c(16) << 16) | (c(8) << 8) | c(0); };
// de staat bij een zonnestand: nacht (onder −8), schemer met het blauwe uur (tot de zon op is), gouden uur (tot 6 graden), dag
export const staatVan = h => h < -8 ? 'nacht' : h < -0.833 ? 'schemer' : h < 6 ? 'gouden uur' : 'dag';
export function lichtBij(h) {
  let i = 0; while (i < IJK.length - 1 && h > IJK[i + 1].h) i++;
  const a = IJK[i], b = IJK[Math.min(i + 1, IJK.length - 1)]; const t = b === a ? 0 : glad(Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h))));
  const out = { h, staat: staatVan(h) };
  for (const k of Object.keys(a)) if (k !== 'h') out[k] = ['zon', 'hb', 'hg', 'nevel', 'sluier'].includes(k) ? mengHex(a[k], b[k], t) : a[k] + (b[k] - a[k]) * t;
  return out;
}
// het licht op een moment van de simulatie: stand van de zon, de richting van het licht (de zon, of in het donker de maan
// uit een vaste richting) en de waarden hierboven
export function lichtOp(datum, minuten, lat = LAT, lon = LON) {
  const z = zonStand(naarUtc(datum, minuten), lat, lon); const L = lichtBij(z.h);
  // De zon geeft licht tot een paar graden onder de horizon; daarna neemt de maan het over. Waar de twee wisselen is het
  // licht bijna nul, dus springt de schaduw niet. Een zon vlak bij de horizon werpt schaduwen van honderden meters: de
  // richting zakt daarom niet onder 6 graden, de kleur en sterkte wel.
  if (z.h > -4) { L.az = z.az; L.el = Math.max(z.h, 6); } else { L.az = 160; L.el = 38; }
  L.zonAz = z.az; L.zonH = z.h; return L;
}
