# Control Tower 4.0: ontwerpbrief

Opdracht van Sem (25 oktober 2026, na het zien van 3.2): "Het is heel demo-achtig en het werkt
niet naar behoren. Ik had gevraagd om het meest geavanceerde systeem te maken. Daar hoort
functionaliteit-perfectie bij, maar ook interface. Gebruiksvriendelijk, realistisch en echt
helpend. Meer dan A-kwaliteit." Concreet noemde hij: de standplaatsen staan niet waar ze echt
horen; de kaart moet meer werken zoals Google Maps; de animaties zijn niet mooi; de hele
interface moet anders; de 3D-wereld van de Emons-site (laagpolygonaal maar realistisch,
zacht licht, schaduwen, detail) is de lat voor het beeld.

Dit document is de gedeelde brief voor de vier bouwagenten (data, kaart en beweging, 3D,
interface) en de Fable-controleur. Wie iets maakt dat hiermee botst, past het aan of meldt
het in zijn rapport.

## Wat het product is

Een control tower voor Simon Loos (1.300 voertuigen, 1.700 opleggers, 42 standplaatsen, de
klanten Albert Heijn, Jumbo, Plus, Lidl, SPAR, Vomar, Heineken, Bavaria, Vrumona, Borgesius,
Bakker Centraal Inkoop): de planner ziet in een oogopslag wat aandacht nodig heeft, grijpt in
met een paar klikken, en het systeem doet het rekenwerk (ETA's, omrijden, wisselen van
opleggers, pauzes, laden). Referenties voor het niveau: Simacan Control Tower (de echte,
bij Albert Heijn in gebruik), Samsara, Shippeo, project44, Descartes. Referentie voor de
kaart: Google Maps (vertrouwd, snel, rustig, straatnamen, gebouwen, vloeiend zoomen).
Referentie voor het 3D-beeld: de Emons-site (speelgoedwereld in de huisstijl, maar
realistisch van verhouding, licht en detail).

## De lat

- Realistisch: standplaatsen op hun echte adres (industrieterrein, DC), klanten op echte
  winkels en DC's, voertuigen die vloeiend over echte wegen rijden, tijden en afstanden die
  kloppen. Niets dat in een demo "gewoon even zo" staat.
- Gebruiksvriendelijk: een planner met tien jaar ervaring moet het zonder uitleg kunnen
  gebruiken. Elke weergave heeft een duidelijk doel, elke actie een duidelijk gevolg.
- Echt helpend: het systeem signaleert, rekent en stelt voor; de planner beslist. Elke
  melding is een zaak met een eigenaar, een status en een tijdlijn, geen los kaartje.
- Professioneel: een interface die naast Simacan of Samsara niet opvalt als "demo". Geen
  speelse tegels, geen lege staten zonder uitleg, geen kleuren zonder betekenis.
- Perfect werkend: geen consolefouten, geen overflow, geen dode knoppen, geen tekst die
  afbreekt, geen toestand die na een herlaad anders is dan ervoor. Alles met toetsenbord,
  alles bij minder beweging, alles zonder WebGL (behalve de kaart zelf en 3D).

## Ontwerpsysteem (interface)

- Letter: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  (Inter alleen als die lokaal is; geen fonts van buiten). Basis 13,5 px, regelafstand 1,45;
  tabulaire cijfers overal waar getallen staan. Koppen 15 tot 22 px, gewicht 600, nooit
  schreeuwend.
- Kleur: neutraal koel grijs voor vlakken en lijnen (licht: achtergrond #FFFFFF, vlak
  #F6F7F9, lijn #E3E6EA, tekst #15181E, gedempt #5F6775; donker: #0F1216, #171B21, #272D35,
  #EEF1F5, #9AA3B2). Simon Loos rood #E3001F alleen als accent (primaire knop, actieve
  tab, merk). Statuskleuren vast en overal gelijk: onderweg #16A34A, bij klant #2563EB,
  vertraagd #DC2626, pauze #D97706, terrein #6B7280, onderhoud #7C3AED. Contrast minstens
  4,5:1 voor tekst.
- Raster en vorm: 8-puntsraster, radius 6 (knoppen, velden) en 10 (kaarten, panelen),
  dunne lijnen in plaats van schaduwen; schaduw alleen op zwevende lagen (menu, popover,
  dialoog).
- Navigatie: een linkerbalk met naam en icoon per onderdeel (geen alleen-iconen op
  desktop), inklapbaar; een topbalk met zoeken, meldingen, rol en gebruiker. Onderdelen:
  Overzicht, Kaart, Ritten, Meldingen, Planbord, Voertuigen, Opleggers, Chauffeurs,
  Standplaatsen, Laden, Lostijden, Pauzeplekken, Rapporten, Instellingen.
- Tabellen: dichte rijen (36 px), vaste kop, sorteren op elke kolom, filters boven de tabel
  als chips plus een zoekveld, kolomkeuze, bulkacties bij selectie, csv-export. Getallen
  rechts uitgelijnd, tabulair.
- Detailpagina's: een kop met naam, status en de drie belangrijkste getallen; tabs voor de
  rest; een kaart of tijdlijn waar die iets toevoegt.
- Lege en wachtende staten: een zin die zegt wat er is en wat je kunt doen; skeletten bij
  laden, nooit een lege tabel zonder uitleg.
- Formulieren en acties: een primaire knop per scherm, bevestiging alleen bij onomkeerbare
  acties, elke actie geeft een korte bevestiging (toast) en is terug te vinden in een
  logboek.
- Beweging: 160 tot 220 ms voor paneel en menu, `cubic-bezier(.2,.7,.2,1)`, nooit
  stuiteren; bij `prefers-reduced-motion` geen beweging. Camerabewegingen van de kaart
  600 tot 900 ms, dezelfde curve.

## Kaart

- Standalone (demo-site en artifact): een echte basiskaart (OpenFreeMap-vectortegels in
  MapLibre, stijl in de geest van Google Maps: lichte vlakken, witte wegen met grijze rand,
  snelwegen geel-oranje, water zacht blauw, groen voor parken, grijs voor industrie,
  gebouwen, straatnamen, plaatsnamen). Valt automatisch terug op de ingebouwde kaart als
  de tegels niet laden. In SafeTools (data-tiles="off") blijft de ingebouwde kaart.
- De ingebouwde kaart zelf wordt rustiger en vollediger: landgebruik, wegenhiërarchie in de
  Google-kleuren, plaatsnamen en standplaatsen als nette labels, en de echte
  standplaatsposities.
- Voertuigen bewegen vloeiend (interpolatie per beeld tussen de simulatiestappen, in 2D en
  3D), draaien mee met de weg, en hebben een rustige hover- en selectiestaat zoals een
  pin in Google Maps. Geen clusters, geen cijfers in bollen.
- Zoeken op de kaart: voertuig, oplegger, chauffeur, standplaats, winkel, plaats, met
  suggesties tijdens het typen, en de kaart vliegt ernaartoe.

## 3D

- Dezelfde wereld als 3.2 maar op het niveau van Emons: trucks met cabine, ruiten,
  spiegels, grille, wielen met velgen, oplegger met deuren en onderrijbeveiliging; bussen
  en bakwagens herkenbaar; schaduwen van een zon (shadow map), zachte hemel, lichte
  grondtinten; depots op hun echte terrein met echte gebouwcontouren (buildings.json) en
  ramen, docks en terreinmarkeringen; bomen met variatie; donkere stand met verlichting.
- Prestaties: 60 fps op een gewone laptop, instanced, LOD bij uitzoomen.

## Data en realisme

- Standplaatsen: het echte adres van elke standplaats (werkenbijsimonloos.nl, simonloos.nl,
  de DC's van de klanten), gegeocodeerd op straatniveau. Bronnen en datum in
  `src/data/BRONNEN.md`.
- Klanten: echte winkels (supermarkten per formule) en DC's als bestemmingen, uit Overture
  Places; ritten gaan naar winkels van de klant van de standplaats binnen een realistische
  straal.
- Gebouwen rond standplaatsen en DC's (Overture Buildings) voor de 3D-wereld, als apart,
  pas bij 3D geladen bestand.
- Alles wat gesimuleerd is (voertuigen, chauffeurs, ritten, tijden) blijft deterministisch
  (seed) en wordt als gesimuleerd benoemd op de pagina.

## Kwaliteit en controle

- Elke agent levert schermafbeeldingen (1440 en 390 px, licht en donker, minder beweging)
  en een Playwright-check van wat hij bouwde; verify.mjs in de drie standen en fn-check
  blijven groen of worden aangepast met reden.
- De Fable-controleur beoordeelt het geheel als de planner van Simon Loos: realistisch,
  bruikbaar, helpend, foutloos. Wat niet door die beoordeling komt, wordt opnieuw gedaan.
