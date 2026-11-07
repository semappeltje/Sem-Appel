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
