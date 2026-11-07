// Het autodiagram: een auto van boven, met de gebieden van de inspectie. De ophaalinspectie staat in inkt, de claim in
// het accent, een treffer (dezelfde of een aangrenzende plek) rood omlijnd. Zo zie je in een oogopslag of de schade er
// al zat. Breedte 200, hoogte 420; de voorkant boven.
import { GEBIEDEN, SOORTEN, ERNST, zelfdePlek } from './regels.js';

// middelpunten per gebied (x, y) in het raster van de tekening
const PUNT = {
  bumper_voor: [100, 36], motorkap: [100, 86], voorruit: [100, 136], dak: [100, 200], achterruit: [100, 268], achterklep: [100, 318], bumper_achter: [100, 384],
  spatbord_lv: [52, 92], spatbord_rv: [148, 92], spatbord_la: [52, 318], spatbord_ra: [148, 318],
  portier_lv: [50, 176], portier_la: [50, 240], portier_rv: [150, 176], portier_ra: [150, 240],
  velg_lv: [26, 110], velg_rv: [174, 110], velg_la: [26, 316], velg_ra: [174, 316],
  spiegel_l: [22, 150], spiegel_r: [178, 150], dorpel_l: [40, 208], dorpel_r: [160, 208], interieur: [100, 220], onderzijde: [100, 240],
};
const BODY = 'M58 24 C 58 14, 70 8, 100 8 C 130 8, 142 14, 142 24 L 158 92 L 162 150 L 162 330 L 150 400 C 150 410, 130 414, 100 414 C 70 414, 50 410, 50 400 L 38 330 L 38 150 L 42 92 Z';
const DELEN = `
<rect x="36" y="96" width="14" height="40" rx="5" class="wiel"/><rect x="150" y="96" width="14" height="40" rx="5" class="wiel"/>
<rect x="36" y="296" width="14" height="40" rx="5" class="wiel"/><rect x="150" y="296" width="14" height="40" rx="5" class="wiel"/>
<path d="${BODY}" class="body"/>
<path d="M62 118 C 62 108, 138 108, 138 118 L 128 156 L 72 156 Z" class="glas"/>
<path d="M70 248 L 130 248 L 136 292 C 136 300, 64 300, 64 292 Z" class="glas"/>
<path d="M72 156 L 128 156 L 130 248 L 70 248 Z" class="dak"/>
<path d="M44 160 L 70 160 L 70 204 L 42 204 Z M156 160 L 130 160 L 130 204 L 158 204 Z M42 208 L 70 208 L 70 262 L 40 262 Z M158 208 L 130 208 L 130 262 L 160 262 Z" class="deur"/>
<path d="M44 68 C 60 50, 140 50, 156 68" class="lijn"/><path d="M48 352 C 64 366, 136 366, 152 352" class="lijn"/>
<rect x="14" y="140" width="24" height="12" rx="4" class="spiegel"/><rect x="162" y="140" width="24" height="12" rx="4" class="spiegel"/>
<path d="M66 30 L 134 30" class="lijn"/><path d="M64 392 L 136 392" class="lijn"/>`;
const STYLE = `<style>.body{fill:var(--dg-body);stroke:var(--dg-line);stroke-width:1.6}.glas{fill:var(--dg-glass);stroke:var(--dg-line);stroke-width:1}.dak{fill:var(--dg-body);stroke:var(--dg-line);stroke-width:1}.deur{fill:none;stroke:var(--dg-line);stroke-width:1}.lijn{fill:none;stroke:var(--dg-line);stroke-width:1}.wiel{fill:var(--dg-line);opacity:.55}.spiegel{fill:var(--dg-body);stroke:var(--dg-line);stroke-width:1}.m text{font:700 10px Inter,system-ui,sans-serif;fill:#fff;text-anchor:middle;dominant-baseline:central}</style>`;

// markeringen: [{gebied, soort, ernst, bron:'eerder'|'claim', nr}]; een claim-markering die een eerdere raakt krijgt
// een rode ring
export function autoDiagram(markeringen, opt = {}) {
  const w = opt.width || 150;
  const M = markeringen.map((m, i) => {
    const [x, y] = PUNT[m.gebied] || [100, 220]; const dx = m.bron === 'claim' && markeringen.some(o => o !== m && o.bron === 'eerder' && (PUNT[o.gebied] || [])[0] === x && (PUNT[o.gebied] || [])[1] === y) ? 14 : 0;
    const kleur = m.bron === 'claim' ? 'var(--dg-claim)' : 'var(--dg-eerder)';
    const ring = m.match ? `<circle cx="${x + dx}" cy="${y}" r="15" fill="none" stroke="var(--dg-match)" stroke-width="2.5"/>` : '';
    return `<g class="m">${ring}<circle cx="${x + dx}" cy="${y}" r="10" fill="${kleur}" stroke="var(--bg)" stroke-width="1.5"/><text x="${x + dx}" y="${y}">${m.nr}</text><title>${GEBIEDEN[m.gebied]}: ${SOORTEN[m.soort] || ''} ${ERNST[m.ernst] ? `(${ERNST[m.ernst]})` : ''}</title></g>`;
  }).join('');
  return `<svg viewBox="0 0 200 424" width="${w}" role="img" aria-label="${opt.label || 'Autodiagram met de schadeplekken'}">${STYLE}${DELEN}${M}</svg>`;
}

// de lijst bij het diagram: eerst de ophaalinspectie (inkt), dan de claim (accent); de nummers lopen door
export function markeringen(inspectieOphaal, claimSchade) {
  const L = []; let nr = 1;
  for (const s of inspectieOphaal) L.push({ ...s, bron: 'eerder', nr: nr++, match: claimSchade ? zelfdePlek(s.gebied, claimSchade.gebied) : false });
  if (claimSchade) L.push({ ...claimSchade, bron: 'claim', nr: nr++, match: inspectieOphaal.some(s => zelfdePlek(s.gebied, claimSchade.gebied)) });
  return L;
}

// een klein schetsje voor een fotokaartje: welk deel van de auto de foto toont (een hoek, een zijkant, een detail)
export function fotoSchets(gebied) {
  const vlak = { overzicht_lv: 'M0 0h50v60H0z', overzicht_rv: 'M50 0h50v60H50z', overzicht_la: 'M0 40h50v60H0z', overzicht_ra: 'M50 40h50v60H50z', dashboard: 'M25 30h50v30H25z', vrachtbrief: 'M30 15h40v70H30z' }[gebied];
  const [x, y] = PUNT[gebied] || [100, 220];
  const detail = vlak ? '' : `M${x / 2 - 16} ${y / 4.24 - 12}h32v24h-32z`;
  return `<svg class="zone" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${vlak || detail}" fill="currentColor" opacity=".12"/></svg>`;
}

// Warmtekaart: dezelfde auto van boven, elk gebied gevuld naar het aantal schades (0 tot max). Voor het dashboard:
// waar zit de schade. Vormen zijn vereenvoudigd tot vlakken binnen de carrosserie.
const VLAK = {
  bumper_voor: 'M60 12 C 60 6, 140 6, 140 12 L 142 30 L 58 30 Z', motorkap: 'M50 34 L 150 34 L 146 100 L 54 100 Z', voorruit: 'M62 118 C 62 108, 138 108, 138 118 L 128 156 L 72 156 Z',
  dak: 'M72 158 L 128 158 L 130 246 L 70 246 Z', achterruit: 'M70 248 L 130 248 L 136 292 C 136 300, 64 300, 64 292 Z', achterklep: 'M52 304 L 148 304 L 150 372 L 50 372 Z', bumper_achter: 'M50 376 L 150 376 L 150 400 C 150 410, 130 414, 100 414 C 70 414, 50 410, 50 400 Z',
  spatbord_lv: 'M42 60 L 58 34 L 50 100 L 42 100 Z M38 104 L 58 104 L 58 150 L 38 150 Z', spatbord_rv: 'M158 60 L 142 34 L 150 100 L 158 100 Z M162 104 L 142 104 L 142 150 L 162 150 Z',
  spatbord_la: 'M38 270 L 60 270 L 60 372 L 50 372 L 40 330 Z', spatbord_ra: 'M162 270 L 140 270 L 140 372 L 150 372 L 160 330 Z',
  portier_lv: 'M42 154 L 70 154 L 70 210 L 40 210 Z', portier_rv: 'M158 154 L 130 154 L 130 210 L 160 210 Z', portier_la: 'M40 214 L 70 214 L 70 266 L 40 266 Z', portier_ra: 'M160 214 L 130 214 L 130 266 L 160 266 Z',
  velg_lv: 'M30 96 h 14 v 40 h -14 z', velg_rv: 'M156 96 h 14 v 40 h -14 z', velg_la: 'M30 296 h 14 v 40 h -14 z', velg_ra: 'M156 296 h 14 v 40 h -14 z',
  spiegel_l: 'M14 140 h 24 v 12 h -24 z', spiegel_r: 'M162 140 h 24 v 12 h -24 z', dorpel_l: 'M36 152 h 6 v 116 h -6 z', dorpel_r: 'M158 152 h 6 v 116 h -6 z',
};
export function warmteDiagram(tellingen, opt = {}) {
  const max = Math.max(1, ...Object.values(tellingen));
  const vlakken = Object.entries(VLAK).map(([g, d]) => { const n = tellingen[g] || 0; const a = n ? 0.12 + 0.78 * (n / max) : 0; return `<path d="${d}" fill="var(--heat)" fill-opacity="${a.toFixed(2)}" stroke="var(--dg-line)" stroke-width=".8"><title>${GEBIEDEN[g]}: ${n}</title></path>`; }).join('');
  return `<svg viewBox="0 0 200 424" width="${opt.width || 150}" role="img" aria-label="${opt.label || 'Waar de schade zit'}">${STYLE}${DELEN}${vlakken}</svg>`;
}

// Een autotransporter van opzij (trekker links, oplegger met twee dekken rechts), met de plekken van een aanrijschade.
// Links en rechts vallen op hetzelfde zijaanzicht; de lijst ernaast zegt welke kant. Breedte 440, hoogte 150.
const TPUNT = {
  bumper_voor: [16, 112], cabine_voor: [14, 72], cabine_l: [50, 66], cabine_r: [50, 66], spiegel_l: [6, 50], spiegel_r: [6, 50],
  zijscherm_l: [62, 112], zijscherm_r: [62, 112], oplegger_l: [250, 88], oplegger_r: [250, 88], bovendek: [250, 40], oprijplaten: [426, 96],
  achterlicht: [428, 118], band: [330, 126], velg_lv: [40, 126], velg_rv: [40, 126],
};
const TSTYLE = `<style>.t-body{fill:var(--dg-body);stroke:var(--dg-line);stroke-width:1.4}.t-glas{fill:var(--dg-glass);stroke:var(--dg-line);stroke-width:1}.t-lijn{fill:none;stroke:var(--dg-line);stroke-width:1.2}.t-wiel{fill:var(--dg-line);opacity:.7}.t-naaf{fill:var(--dg-body)}.m text{font:700 10px 'Source Sans 3',system-ui,sans-serif;fill:#fff;text-anchor:middle;dominant-baseline:central}</style>`;
const TDELEN = `
<path class="t-body" d="M8 42 Q8 30 20 28 L66 26 Q76 26 78 36 L80 112 L8 112 Z"/>
<path class="t-glas" d="M12 40 Q13 33 20 32 L40 31 L40 62 L12 62 Z"/>
<rect class="t-body" x="2" y="44" width="5" height="14" rx="2"/>
<path class="t-lijn" d="M44 32 L44 108 M14 96 L76 96"/>
<rect class="t-body" x="8" y="106" width="20" height="10" rx="2"/>
<rect class="t-body" x="80" y="100" width="352" height="10" rx="2"/>
<path class="t-lijn" d="M96 100 L96 54 L432 54 M96 70 L432 70 M150 54 L150 100 M210 54 L210 100 M270 54 L270 100 M330 54 L330 100 M390 54 L390 100"/>
<path class="t-body" d="M100 54 L430 54 L430 50 L100 50 Z"/>
<path class="t-lijn" d="M432 100 L438 116 M432 54 L438 70"/>
<rect class="t-body" x="424" y="112" width="12" height="6" rx="1.5"/>
<circle class="t-wiel" cx="40" cy="126" r="12"/><circle class="t-naaf" cx="40" cy="126" r="4"/>
<circle class="t-wiel" cx="104" cy="126" r="12"/><circle class="t-naaf" cx="104" cy="126" r="4"/>
<circle class="t-wiel" cx="306" cy="126" r="12"/><circle class="t-naaf" cx="306" cy="126" r="4"/>
<circle class="t-wiel" cx="334" cy="126" r="12"/><circle class="t-naaf" cx="334" cy="126" r="4"/>
<circle class="t-wiel" cx="362" cy="126" r="12"/><circle class="t-naaf" cx="362" cy="126" r="4"/>`;
export function truckDiagram(markeringen, opt = {}) {
  const M = markeringen.map((m, i) => {
    const [x, y] = TPUNT[m.gebied] || [250, 88]; const dx = markeringen.slice(0, i).filter(o => (TPUNT[o.gebied] || [])[0] === x && (TPUNT[o.gebied] || [])[1] === y).length * 16;
    const kleur = m.bron === 'claim' ? 'var(--dg-claim)' : 'var(--dg-eerder)';
    return `<g class="m"><circle cx="${x + dx}" cy="${y}" r="10" fill="${kleur}" stroke="var(--bg)" stroke-width="1.5"/><text x="${x + dx}" y="${y}">${m.nr}</text><title>${GEBIEDEN[m.gebied] || m.gebied}</title></g>`;
  }).join('');
  return `<svg viewBox="0 0 440 142" width="${opt.width || '100%'}" role="img" aria-label="${opt.label || 'Autotransporter van opzij met de schadeplekken'}" style="max-width:100%;height:auto">${TSTYLE}${TDELEN}${M}</svg>`;
}
