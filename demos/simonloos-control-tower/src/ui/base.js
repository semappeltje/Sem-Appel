// Gedeelde bouwstenen van de interface 4.0: opmaak van getallen en tijden, de vaste statuswoorden en -kleuren,
// badges, lege staten en de klantnaam van een stop. Geen DOM-toestand hier; alleen pure functies.
import { hhmm, fmt } from '../places.js';
import { ic } from '../icons.js';

export { hhmm, fmt, ic };
export const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nl1 = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
export const nl2 = v => v.toFixed(2).replace('.', ',');
export const pct = (v, d = 0) => `${d ? v.toFixed(d).replace('.', ',') : Math.round(v)} %`;
export const fmtDrive = m => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
// minuten van de dag terug naar 0..1439
export const day = m => ((m % 1440) + 1440) % 1440;
// verschil a - b in minuten op een klok van 24 uur, tussen -720 en 720
export const diffMin = (a, b) => { const d = day(a - b); return d > 720 ? d - 1440 : d; };
export const durTxt = m => { m = Math.max(0, Math.round(m)); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} u ${r} min` : `${h} u`; };
// adres van een standplaats of DC: { straat, nr, postcode, plaats } of een tekst ("Hoofdtocht 1, 1507 CJ")
export const adresTxt = (a, plaats = '') => !a ? '' : typeof a === 'string' ? `${a}${plaats && !a.includes(plaats) ? ` ${plaats}` : ''}` : `${a.straat} ${a.nr}, ${a.postcode} ${a.plaats}`;
const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const datumTxt = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${+m[3]} ${MAAND[+m[2] - 1]} ${m[1]}` : String(iso || ''); };
export const clockAt = (m, T) => (m > T + 0.5 ? `gisteren ${hhmm(m)}` : hhmm(m));
export const agoTxt = m => { m = Math.max(0, Math.round(m)); return m < 1 ? 'net' : `${durTxt(m)} geleden`; };
export const inTxt = m => { m = Math.round(m); return m <= 0 ? 'nu' : `over ${durTxt(m)}`; };
export const signMin = m => { m = Math.round(m); return m > 0 ? `+${m} min` : m < 0 ? `−${-m} min` : '0 min'; };
export const plural = (n, a, b) => `${fmt(n)} ${n === 1 ? a : b}`;

// ---------- voertuigstatus (vaste kleuren uit de brief; de tekst staat in een eigen inkt) ----------
export const VST = {
  onderweg: { n: 'Onderweg' }, klant: { n: 'Bij klant' }, vertraagd: { n: 'Vertraagd' }, pauze: { n: 'Pauze' }, terrein: { n: 'Op terrein' },
};
export const stBadge = (st, extra = '', cls = '') => `<span class="badge st-${st} ${cls}"><i class="dot"></i>${esc((VST[st] || { n: st }).n)}${extra}</span>`;

// ---------- ritstatus ----------
export const RST = {
  gepland: { n: 'Gepland', cls: 'st-gepland' }, onderweg: { n: 'Onderweg', cls: 'st-onderweg' }, klant: { n: 'Bij klant', cls: 'st-klant' },
  pauze: { n: 'Pauze', cls: 'st-pauze' }, vertraagd: { n: 'Vertraagd', cls: 'st-vertraagd' }, afgerond: { n: 'Afgerond', cls: 'st-afgerond' },
};
export const ritBadge = (st, extra = '') => `<span class="badge ${RST[st].cls}"><i class="dot"></i>${RST[st].n}${extra}</span>`;

// ---------- opleggerstatus: dezelfde betekenis als bij voertuigen (in gebruik groen, bij klant blauw, wachten amber,
// terrein grijs, onderhoud paars); "klaar voor vertrek" staat op het terrein en is geladen ----------
export const TST = {
  gekoppeld: { n: 'Gekoppeld', cls: 'st-onderweg' }, klaar: { n: 'Klaar voor vertrek', cls: 'st-terrein' }, geladen: { n: 'Geladen bij klant', cls: 'st-klant' },
  wacht: { n: 'Wacht op ophalen', cls: 'st-pauze' }, ophalen: { n: 'Wordt opgehaald', cls: 'st-onderweg' }, leeg: { n: 'Leeg op terrein', cls: 'st-terrein' }, onderhoud: { n: 'In onderhoud', cls: 'st-onderhoud' },
};
export const trBadge = (st, late) => late ? `<span class="badge st-vertraagd"><i class="dot"></i>Te laat opgehaald</span>` : `<span class="badge ${TST[st].cls}"><i class="dot"></i>${TST[st].n}</span>`;

// ---------- zaken (meldingen) ----------
export const ZST = {
  nieuw: { n: 'Nieuw', icon: 'circle' }, behandeling: { n: 'In behandeling', icon: 'half' }, wacht: { n: 'Wacht op', icon: 'snooze' }, opgelost: { n: 'Opgelost', icon: 'okc' },
};
// waar een zaak op wacht (met de standaardtijd tot hij terugkomt)
export const WACHT = { chauffeur: ['chauffeur', 30], klant: ['klant', 60], garage: ['garage', 120], collega: ['collega', 30], reactie: ['reactie', 30] };
export const zBadge = (st, z) => `<span class="badge z-${st}">${ic(ZST[st].icon, 12)}${st === 'wacht' ? `Wacht op ${esc(WACHT[(z && z.wachtOp) || 'reactie'] ? WACHT[(z && z.wachtOp) || 'reactie'][0] : 'reactie')}` : ZST[st].n}</span>`;
// Soorten met de standaardnorm (minuten tot de planner gereageerd moet hebben); aan te passen onder Instellingen.
export const SOORT = {
  Vertraging: { l: 'V', icon: 'clock', norm: 10, uitleg: 'Een voertuig haalt het tijdvenster van een stop niet of komt later terug dan de volgende dienst begint.' },
  Rijtijd: { l: 'R', icon: 'steer', norm: 15, uitleg: 'Een chauffeur zit binnen 30 minuten op 4,5 uur rijtijd zonder geplande pauze.' },
  Accu: { l: 'A', icon: 'bolt', norm: 20, uitleg: 'Een elektrisch voertuig heeft minder dan 20 procent accu en geen laadmoment gepland.' },
  Techniek: { l: 'T', icon: 'wrench', norm: 30, uitleg: 'De boordcomputer meldt een storing terwijl het voertuig onderweg is.' },
  Koeling: { l: 'K', icon: 'thermo', norm: 10, uitleg: 'De koelunit van een koel- of vriesoplegger haalt de doeltemperatuur niet.' },
  Oplegger: { l: 'O', icon: 'trailer', norm: 60, uitleg: 'Een lege oplegger staat langer dan een uur na het geplande ophaalmoment bij een winkel of DC.' },
  Dock: { l: 'D', icon: 'dock', norm: 20, uitleg: 'Een dock op de standplaats is buiten gebruik; een voertuig koppelt of lost aan een ander dock en de chauffeur moet dat weten.' },
};
export const LETTER = Object.fromEntries(Object.entries(SOORT).map(([k, v]) => [v.l, k]));
// De sleutel van een zaak is vast: soort, object en rit ("V:T-1112:R-10448"; een oplegger heeft geen rit in de sleutel,
// "K:O-2011"). Na een herlaad met dezelfde acties is het dezelfde sleutel. In de URL met strepen: "V-T-1112-R-10448".
export const zaakId = key => key.split(':').join('-');
export const zaakKey = id => { const m = /^([A-Z])-([A-Z]-\d+)(?:-(R-.+))?$/.exec(id || ''); return m ? `${m[1]}:${m[2]}${m[3] ? `:${m[3]}` : ''}` : null; };

// ---------- klant van een stop (keten uit de naam; anders de klant van de standplaats) ----------
const KETEN = [[/^(AH|Albert Heijn)\b/, 'Albert Heijn'], [/^Jumbo\b/, 'Jumbo'], [/^Plus\b/, 'Plus'], [/^Lidl\b/, 'Lidl'], [/^SPAR\b/, 'SPAR'], [/^Vomar\b/, 'Vomar'], [/^Borgesius\b/, 'Borgesius'], [/^Heineken\b/, 'Heineken'], [/^Bavaria\b/, 'Bavaria'], [/^Vrumona\b/, 'Vrumona'], [/^Bakker\b/, 'Bakker Centraal Inkoop']];
// korte naam in een blok: winkelketen afgekort, geen pijl (de kleur zegt al dat het rijden is); de hele naam staat in de tooltip
// "Albert Heijn Laat, Alkmaar" wordt "AH Alkmaar", een bezorgstraat "Dorpsstraat, Hoorn" wordt "Hoorn"
const KORT = [[/^(Albert Heijn|AH)\b/, 'AH'], [/^Jumbo\b/, 'Jumbo'], [/^Plus\b/, 'Plus'], [/^Lidl\b/, 'Lidl'], [/^SPAR\b/i, 'Spar'], [/^Vomar\b/, 'Vomar'], [/^Aldi\b/, 'Aldi'], [/^Dirk\b/, 'Dirk'], [/^Etos\b/, 'Etos']];
const SHORT = [[/^Albert Heijn\b/, 'AH'], [/^Simon Loos\s+/, 'SL '], [/^Distributiecentrum\s+/, 'DC ']];
export function kortStop(s) {
  let n = String(s || '').replace(/^→\s*/, '').replace(/^Terug\s+/, ''); const i = n.lastIndexOf(', ');
  if (i > 0) { const left = n.slice(0, i), place = n.slice(i + 2); const k = KORT.find(([re]) => re.test(left)); return k ? `${k[1]} ${place}` : place; }
  for (const [re, r] of SHORT) n = n.replace(re, r); return n.trim();
}
// Tijdvenster van een stop zoals de planner het ziet (win en plan in dezelfde minuten). De simulatie legt vensters op
// halve uren rond de geplande aankomst, waardoor die soms tot 10 min na het venster valt: dat venster schuift dan 10 min
// op. Ligt de geplande aankomst na een ingreep (pauze, laden, opschuiven) verder na het venster, dan is het venster met
// de klant verlegd tot die tijd (moved). Een stop is te laat als hij na het einde van dit venster aankomt.
export function effWin(win, plan) {
  if (!win) return null;
  if (plan === undefined || plan === null || !(plan > win[1] + 0.01)) return win;
  if (plan <= win[1] + 10) return [win[0] + 10, win[1] + 10];
  return Object.assign([win[0], Math.ceil((plan - 0.01) / 5) * 5], { moved: true });
}
export const lateBy = (arr, win) => (win && arr > win[1] + 0.5 ? Math.round(arr - win[1]) : 0);
export function klantNaam(stopName, t, mark) {
  if (mark && mark.klant) return mark.klant;
  const p = mark && mark.place;
  if (p && p.fleet !== undefined) return 'Simon Loos';   // eigen vestiging (crossdock, pendel tussen standplaatsen)
  if (p && p.formule) return p.formule;                   // winkel, DC, fabriek of groothandel (places.js)
  if (p && p.klant) return p.klant;
  const n = String(stopName || '');
  for (const [re, k] of KETEN) if (re.test(n)) return k;
  if (t) {
    if (t.div === 'bezorg') return 'Albert Heijn';
    const k = String(t.klant || '').split(' (')[0].split(' / ')[0];
    if (/Netwerk|LZV|Crossdock|Winkeldistributie|Truckspuiterij/i.test(k) || !k) return t.div === 'bulk' ? 'Bulk' : t.div === 'netwerk' ? 'Netwerk' : 'Overig';
    if (/^Bulk/.test(k)) return 'Bulk';
    for (const [re, kk] of KETEN) if (re.test(k)) return kk;
    return k;
  }
  return 'Overig';
}

// ---------- kleine html-bouwstenen ----------
// een voertuig- of opleggernummer; met de muis erop verschijnt een kaartje (layers.js, data-hc)
export const plate = id => `<span class="plate" data-hc="${esc(id)}">${esc(id)}</span>`;
// een kenteken als Nederlandse plaat: geel met zwarte letters en links de blauwe band met NL; een oplegger (aanhanger)
// wit met zwarte letters. maat: 'sm' (tabellen, kaartjes), '' (gewoon) of 'lg' (kop van een pagina). De kentekens zijn
// verzonnen en bevatten bewust een Q, zodat niemand er een echt voertuig in herkent.
export const kenteken = (nr, { opl = false, maat = '' } = {}) => nr ? `<span class="kenteken${opl ? ' opl' : ''}${maat ? ` ${maat}` : ''}" role="img" aria-label="kenteken ${esc(nr)}"><span class="kt-nl" aria-hidden="true">NL</span><span class="kt-t" aria-hidden="true">${esc(nr)}</span></span>` : '';
export const meter = (frac, cls = '') => `<div class="meter ${cls}" role="presentation"><i style="width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%"></i></div>`;
export const empty = (title, text, action = '', icon = 'info', cls = '') => `<div class="empty ${cls}">${ic(icon, 20)}<b>${esc(title)}</b>${text ? `<span>${text}</span>` : ''}${action}</div>`;
// een icoon uit de set voor de kop van elke groep op een detailpagina (op de eerste woorden van de kop)
const SECTIE = [['Vandaag', 'clock'], ['Nu', 'activity'], ['Diensten', 'cal'], ['Ritten', 'route'], ['Dagplan', 'gantt'], ['Keuring', 'shield'], ['Onderhoud', 'wrench'], ['Documenten', 'note'], ['Contact', 'phone'], ['Bevoegdheden', 'idcard'], ['Voertuigen', 'truck'], ['Rijden', 'steer'], ['Schades', 'alert'], ['Contract', 'lock'], ['Logboek', 'list'], ['Voorkeuren', 'usercheck'], ['Afspraken', 'note'], ['Beschikbaarheid', 'cal'], ['Trekker', 'truck'], ['Historie', 'cal'], ['Cijfers', 'bars'], ['Stops', 'pin'], ['Berichten', 'msg'], ['Voorstel', 'spark'], ['Tijdlijn', 'list'], ['Notities', 'note'], ['Oplegger', 'trailer'], ['Gebruik', 'activity'], ['Lading', 'box']];
export const sectieIconen = html => html.replace(/<div class="pg-sec([^"]*)"><h2>(?!<svg)([^<]+)/g, (m, cls, t) => { const x = SECTIE.find(([k]) => t.trim().startsWith(k)); return x ? `<div class="pg-sec${cls}"><h2>${ic(x[1], 16)}${t}` : m; });
export const kv = pairs => `<dl class="kv">${pairs.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
// Detailpagina's volgen het patroon van Odoo: een statusbalk (de stappen, de huidige gemarkeerd; een stap met een actie
// is een knop) en slimme knoppen met een teller of nummer die openen wat erbij hoort, vaak een gefilterde lijst.
// steps: [[sleutel, naam, attributen voor een knop]]; items: [[getal of nummer, label, data-open, icoon]]
export const statusBar = (steps, cur, label = 'Status') => { const i = steps.findIndex(s => s[0] === cur); return `<ol class="sbar" aria-label="${esc(label)}">${steps.map(([k, n, act], j) => `<li class="${j < i ? 'done' : j === i ? 'cur' : ''}"${j === i ? ' aria-current="step"' : ''}>${act && j !== i ? `<button type="button" ${act}>${esc(n)}</button>` : `<span>${esc(n)}</span>`}</li>`).join('')}</ol>`; };
// slimme knoppen (patroon van Odoo); een teller op nul laten we weg: wat niets is, vraagt geen knop
export const smartBtns = items => `<div class="smart" role="group" aria-label="Hoort erbij">${items.filter(x => x && x[0] !== 0 && x[0] !== '–').map(([n, l, open, icon]) => `<button class="sb" type="button" ${open ? `data-open="${esc(open)}"` : 'disabled'}>${ic(icon || 'list', 16)}<span><b>${typeof n === 'number' ? fmt(n) : esc(n)}</b><small>${esc(l)}</small></span></button>`).join('')}</div>`;
export const initials = n => String(n || '').split(/\s+/).filter(x => /^[A-Za-z]/.test(x) && x[0] === x[0].toUpperCase()).map(x => x[0]).join('').slice(0, 2).toUpperCase() || String(n || '?').slice(0, 2).toUpperCase();
// Bellen in de demo: de knop belt niet (geen tel:-link); een klik toont het gesimuleerde nummer in een melding (ui.js, data-bel)
export const belKnop = (naam, tel, { cls = 'btn sm', label = 'Bel', extra = '' } = {}) => (tel ? `<button class="${cls}" type="button" data-bel="${esc(tel)}" data-wie="${esc(naam)}" ${extra} title="Bel ${esc(naam)} (demo: er wordt niet gebeld)">${ic('phone', 14)}<span>${esc(label)}</span></button>` : '');
export const stars = v => `<span class="stars" aria-label="${nl1(v)} van 5">${'★'.repeat(Math.round(v))}${'☆'.repeat(5 - Math.round(v))}</span>`;
// csv met puntkomma (Nederlandse Excel), met BOM
export function downloadCsv(name, head, rows) {
  const q = v => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;
  const txt = [head, ...rows].map(r => r.map(q).join(';')).join('\n');
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return true; } catch { return false; }
}
// gedelegeerde gebeurtenissen: één luisteraar per container
export function on(el, type, sel, fn) { el.addEventListener(type, e => { const t = e.target instanceof Element ? e.target.closest(sel) : null; if (t && el.contains(t)) fn(e, t); }); }
// innerHTML alleen vervangen als het verandert; de focus (en de cursor in een veld) blijft waar hij was
const sigOf = el => { if (el.id) return '#' + CSS.escape(el.id); for (const a of el.attributes) if (a.name.startsWith('data-') && a.name !== 'data-h') return `[${a.name}="${CSS.escape(a.value)}"]`; return null; };
export function swap(el, h) {
  if (!el || el.dataset.h === h) return false;
  const ae = document.activeElement; let sig = null, caret = null;
  if (ae && el.contains(ae)) { sig = sigOf(ae); try { if (typeof ae.selectionStart === 'number') caret = ae.selectionStart; } catch { /* geen cursor */ } }
  el.innerHTML = h; el.dataset.h = h;
  if (sig) { const x = el.querySelector(sig); if (x) { x.focus({ preventScroll: true }); if (caret !== null && x.setSelectionRange) try { x.setSelectionRange(caret, caret); } catch { /* */ } } }
  return true;
}
