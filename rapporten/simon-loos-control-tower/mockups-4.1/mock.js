// Vult de linkerbalk en de topbalk van een mockup, zoals de app ze tekent (src/ui/nav.js).
// Twee nieuwe onderdelen in 4.1 onder "Plannen": Bezetting en Vrijgeven (met het label "nieuw").
(function () {
  const ic = window.ic, b = document.body, d = b.dataset;
  const NAV = [
    ['', [['overzicht', 'Overzicht', 'dash'], ['kaart', 'Kaart', 'map'], ['ritten', 'Ritten', 'route'], ['meldingen', 'Meldingen', 'alert', '33'], ['openritten', 'Open ritten', 'inbox', '4'], ['planbord', 'Planbord', 'gantt']]],
    ['Plannen', [['bezetting', 'Bezetting', 'bars', 'nieuw'], ['vrijgeven', 'Vrijgeven', 'send', 'nieuw']]],
    ['Vloot', [['voertuigen', 'Voertuigen', 'truck'], ['opleggers', 'Opleggers', 'trailer'], ['chauffeurs', 'Chauffeurs', 'users'], ['charters', 'Charters en oproep', 'contact']]],
    ['Locaties', [['standplaatsen', 'Standplaatsen', 'depot'], ['laden', 'Laden', 'bolt'], ['lostijden', 'Lostijden', 'timer']]],
    ['Analyse', [['rapporten', 'Rapporten', 'chart'], ['instellingen', 'Instellingen', 'settings']]],
  ];
  const side = document.getElementById('side');
  if (side) {
    side.className = 'side';
    side.innerHTML = `<div class="side-head"><img src="logo.png" alt="Simon Loos"><span>Control Tower</span></div>
      <nav class="side-nav">${NAV.map(([g, items]) => `<div class="nav-g">${g ? `<div class="nav-gl">${g}</div>` : ''}${items.map(([k, n, i, x]) =>
        `<div class="nav-i ${d.actief === k ? 'on' : ''}">${ic(i, 18)}<span class="tx">${n}</span>${x === 'nieuw' ? '<span class="nw">nieuw</span>' : x ? `<span class="nc">${x}</span>` : ''}</div>`).join('')}</div>`).join('')}</nav>
      <div class="side-foot"><div class="nav-i">${ic('sidebar', 18)}<span class="tx">Menu inklappen</span></div></div>`;
  }
  const top = document.getElementById('top');
  if (top) {
    top.className = 'top';
    top.innerHTML = `<div class="top-t"><h1>${d.titel}</h1><div class="crumb">${d.crumb}</div></div>
      <div class="tsearch">${ic('search', 16)}<span>Zoek voertuig, oplegger, chauffeur, plaats</span><span class="kbd">/</span></div>
      <div class="vsep"></div>
      <div class="top-r">
        <span class="tbtn">${ic('pin', 16)}<span>${d.gebied || 'Wognum'}</span>${ic('chevd', 14, 'chev')}</span>
        <span class="tbtn">${ic('idcard', 16)}<span>${d.rol || 'Planner'}</span>${ic('chevd', 14, 'chev')}</span>
        <span class="clock"><i></i>${d.klok || '15:42'} <small class="mut">${d.dag || 'ma 26 okt'}</small></span>
        <div class="vsep"></div>
        <span class="ib">${ic('spark', 18)}</span>
        <span class="ib">${ic('bell', 18)}<span class="cnt">${d.meldingen || '33'}</span></span>
        <span class="ib">${ic('moon', 18)}</span>
        <span class="avatar">P</span>
      </div>`;
  }
  const mtop = document.getElementById('mtop');
  if (mtop) {
    mtop.className = 'm-top';
    mtop.innerHTML = `<span class="ib">${ic('menu', 20)}</span><div class="top-t"><h1>${d.titel}</h1><div class="crumb">${d.crumb}</div></div>
      <span class="clock"><i></i>${d.klok || '15:42'}</span><span class="ib">${ic('bell', 18)}<span class="cnt">${d.meldingen || '33'}</span></span>`;
  }
  const mbar = document.getElementById('mbar');
  if (mbar) {
    mbar.className = 'm-bar';
    const items = [['overzicht', 'Overzicht', 'dash'], ['kaart', 'Kaart', 'map'], ['planbord', 'Planbord', 'gantt'], [d.actief, d.titel, d.actief === 'bezetting' ? 'bars' : 'send'], ['meer', 'Meer', 'more']];
    mbar.innerHTML = items.map(([k, n, i]) => `<span class="${k === d.actief ? 'on' : ''}">${ic(i, 20)}${n}</span>`).join('');
  }
  document.querySelectorAll('[data-ic]').forEach(el => { el.outerHTML = ic(el.dataset.ic, +(el.dataset.s || 16), el.className || ''); });
  const lab = document.createElement('div'); lab.className = 'mocklabel'; lab.textContent = 'Mockup 4.1 · gesimuleerd'; document.body.appendChild(lab);
})();
