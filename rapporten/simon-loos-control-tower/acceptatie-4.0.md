# Control Tower 4.0: acceptatie-eisen

25 oktober 2026. De lat voor de eindcontrole van 4.0, op verzoek van Sem: "Je moet aan kwaliteitseisen voldoen en
me met resultaat omver blazen." Elke eis is te toetsen met Playwright (Chromium met SwiftShader) op 1440 x 900 en
390 x 844, licht en donker, met en zonder `prefers-reduced-motion`, in de losse en de ingebedde versie
(`data-tiles="off" data-embedded`). Een eis zonder bewijs (schermafbeelding, meting of consoleregel) telt als niet
gehaald. De controleur verandert zelf niets; wat niet slaagt, gaat terug naar de werkstroom met de reden.

## A. De vijf momenten die moeten overtuigen

Een planner met tien jaar ervaring moet bij elk moment denken: "dit wil ik morgen hebben".

1. **05:30, de ochtendbriefing.** Bij openen als planner van Wognum staat bovenaan wat er speelt, wat open staat,
   waar het risico zit en wat de planner moet beslissen, in die volgorde, in hooguit vijf regels, elk klikbaar naar
   de zaak of rit. Met `data-ai` schrijft de Assistent de briefing; zonder doet de app het zelf.
2. **Een open rit invullen.** Van de bak "Niet ingepland" naar een toegewezen rit in hooguit drie klikken: rit
   openen, kandidaat kiezen (eigen, oproep, charter, met reden, uren, kosten als schatting en waarschuwingen),
   toewijzen. De toets (overlap, venster, rijtijd, rust, accu, oplegger, dock) loopt mee en een weigering zegt
   waarom. De rit staat daarna op het planbord en in het logboek, en is na herladen nog toegewezen.
3. **Een vertraging begrijpen.** Een vertraagde rit openen toont het spoor (gereden grijs, te rijden blauw), bij
   elke stop wat er gebeurde (wachten, lossen) en de plek waar de vertraging ontstond, met de ETA tegen het venster
   en een voorstel met effect in minuten.
4. **Wognum in 3D.** De standplaats op het echte terrein, trucks in de echte huisstijl aan genummerde docks, de
   bordjes van de afdelingen, licht dat past bij de klok (dag, schemer, nacht), vloeiend draaien en zoomen.
5. **Zoeken.** Een kenteken met een tikfout of zonder streepjes, een winkel, een DC of een plaats: de juiste treffer
   bovenaan binnen 100 ms na typen, de kaart vliegt erheen, het detail opent als pagina.

## B. Werkt zoals een planner werkt

- De dag begint bij de werkvoorraad (open ritten), niet bij een voertuig.
- Elke melding is een zaak met eigenaar, status, deadline en tijdlijn; groen vraagt niets.
- Het planbord kan terug en vooruit in de tijd (scrollen, slepen, Vroeger, Later, Nu, zoom 2 tot 24 uur, gisteren,
  vandaag, morgen), toont gepland naast gereden, en springt niet terug als de data ververst.
- Slepen tussen voertuigen en vanuit de pool toetst bij het loslaten; met het toetsenbord kan het ook.
- De flexibele schil (charters, oproepkrachten) is een eigen onderdeel met nummers, beschikbaarheid en
  betrouwbaarheid; "Bel" belt in de demo niet echt.
- Voorkeuren en tevredenheid staan op de persoonspagina; per standplaats als roosterfit; nergens een ranglijst.

## C. Interface en rust

- Nooit vastzitten: de linkerbalk is altijd klikbaar, een detail is een pagina met kruimelpad en Terug, Terug
  brengt je naar de lijst met dezelfde filters en scrollpositie, de terugknop van de browser werkt overal.
- Elke pagina begint met één kop, één primaire actie en hooguit drie cijfers; de rest gevouwen of achter een klik.
- Filters als keuzemenu's, alleen actieve filters als chips, "Meer filters" voor de rest, hooguit één rij bediening
  boven een tabel.
- Detailpagina's in kaarten (Kerngegevens, Nu, Historie, Onderhoud, Documenten) met een raster van label en
  waarde, kopjes, statuschips; nooit een lange lijst kale regels; cursief alleen voor een citaat.
- Kentekens als Nederlandse plaat; voertuigen en opleggers met een foto of render en de bron eronder.
- Geen tekst die afbreekt of overloopt, geen lege staat zonder uitleg, geen kleur zonder betekenis.

## D. Realisme en data

- Standplaatsen op hun adres, ritten naar echte winkels en DC's, de dag zoals de onderzoeken hem beschrijven
  (diensten rond 9,7 uur, om 10:00 rijdt het grootste deel), pauzes volgens EU 561/2006.
- Tegenliggers rijden elk op hun eigen rijbaan; voertuigen op ware grootte bij inzoomen; nergens land als zee.
- Alles wat gesimuleerd is, staat als gesimuleerd; elke schatting heet schatting; elke bron staat in BRONNEN.md.

## E. Robuust en zuinig

- Nul consolefouten in alle standen; geen horizontale overflow; geen dode knoppen (elke knop doet iets of zegt
  waarom niet).
- Herladen geeft dezelfde toestand (weergave, selectie, filters, toewijzingen van vandaag).
- Toetsenbord overal; met minder beweging geen animatie; zonder WebGL werkt alles behalve kaart en 3D, met een
  rustige melding.
- De ingebedde versie doet nul verzoeken naar buiten; de losse versie alleen naar de gedocumenteerde hosts en alleen
  als de kijker een online laag aanzet.
- Het artifact blijft onder 16 MB; de sitebuild importeert three.js en buildings.js nergens statisch.
- Alle bestaande controles groen: verify (drie standen), fn-check, data-check, map-check, 3d-check,
  portretten-check, assistent-check.

## F. Hoe het oordeel luidt

Per eis: gehaald, niet gehaald (met bewijs en de werkstroom die het moet herstellen) of niet te toetsen hier (met de
reden, bijvoorbeeld online tegels). 4.0 gaat naar Sem als A en C volledig gehaald zijn en B tot en met E op
hooguit drie kleine punten na; elk open punt staat in het eindrapport.
