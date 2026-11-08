# Schadeportaal (demo voor Breedijk Transport, versie 1.2)

Werkende demo van een schadeportaal voor een autotransporteur: de schade-mailbox, de rit uit het TMS met de
inspecties en foto's van de chauffeur, een vaste beoordeling met signalen, het conceptantwoord aan de
tegenpartij en het overzicht per chauffeur en opdrachtgever dat de Excel van het management vervangt.
Aanleiding: het gesprek van Sem met Breedijk Transport (Opmeer) in november 2026, zie `ONTWERP.md`. Het
onderzoek en het memo staan in `rapporten/breedijk-schadeportaal/`.

**Alles is gesimuleerd**: kentekens, voertuigen, chauffeurs, opdrachtgevers, ritten, inspecties, foto's,
mails, calculaties en bedragen. Echt zijn alleen de plaatsnamen en de drie vestigingen van Breedijk (Opmeer,
Nijkerk, Barneveld, volgens hun eigen site). De demo speelt op een vaste dag (vrijdag 6 november 2026,
09:40), zodat termijnen en tellers niet verlopen. Geen naam van een echte persoon, geen huisstijl van
Breedijk behalve het rood van hun site (#E30613 uit het child-theme van breedijktransport.nl, gelezen 7 november;
Sem vroeg om de Breedijk-stijl; een token in `src/style.css`). De pagina doet uit zichzelf geen enkel verzoek naar
buiten: geen font, geen tegel, geen API; alleen als je "RDW live" aanzet gaat op jouw klik een kenteken naar
opendata.rdw.nl. Wat de behandelaar doet, blijft in de browser (localStorage `bs-*`).

**Versie 1.1 (7 november, later op de dag):** het TMS heet Transplan (RGB+), niet Transpas; het dashboard; de
keten ophalen, overslagterrein (intake-controle), uitleveren met twee chauffeurs; de koppelingen die echt werken
(mail plakken en uitlezen, een rittenexport inlezen, de RDW live); de huisstijl; een rustiger interface; de
reparaties uit de Fable-review van ronde 1 (`rapporten/breedijk-schadeportaal/review.md`).

**Ronde 4 (dezelfde dag): de soorten schade.** Breedijk legde uit dat er meer is dan ladingsschade: aanrijschade
aan de eigen vrachtwagen (een paal, een stoeprand, bij het inparkeren langs de combinatie ernaast; negen van de tien
herstelt de eigen werkplaats, een geschuurde zijkant van richting 10.000 euro gaat naar de verzekering), aanrijschade
aan een derde (achteruit tegen een geparkeerde auto; soms merkt de chauffeur het niet en komt het via camerabeelden van
de tegenpartij) en diverse schade (booster, sleutel). Elk dossier heeft nu een soort, met een eigen afhandeling: bij
eigen schade ons voertuig op een zijaanzicht van de autotransporter, de werkorder met de dagen uit de roulatie, en de
keuze werkplaats, herstelbedrijf of cascoverzekeraar; bij schade aan een derde de telematica (was ons voertuig er, hoe
hard, achteruit), de tegenpartij, het Europees of eenzijdige schadeformulier van de chauffeur, en de WA-verzekeraar
(zelf geen aansprakelijkheid erkennen); bij elke soort het pakket voor de juiste verzekeraar met wat er al is en wat
ontbreekt. Nieuw: het wagenpark (toets 5, 42 trekkers met hun oplegger, gesimuleerd), de soort als filter in de lijst
en op het dashboard, een nieuwe melding per soort, en een geplakte mail met het kenteken van een van onze eigen
vrachtwagens wordt vanzelf een aanrijschade derde.

**Ronde 3 (dezelfde dag): rust.** Sem: "te druk, AI-achtig; subtieler, mooier, meer inklappen". Structuur uit
ruimte en toon in plaats van kaders (witte kaarten zonder rand op een grijze pagina, geen groepslabels in kapitalen,
status als tekst met een stip), een eigen letter (Source Sans 3, SIL Open Font License, gebundeld uit
`@fontsource/source-sans-3`, latijn 400 en 600), de iconen van Lucide (ISC, statisch gebundeld), een dunne
voortgangslijn, de beoordeling als een lijst waarvan alleen de punten die aandacht vragen openstaan, de foto's, de
calculatie, de notities en het logboek achter een kopje (de map met een treffer staat open), de mail ingekort met
"Lees de hele mail". Open-sourcebouwstenen die klaarstaan voor de foto's: `img-comparison-slider` (MIT) voor
ophalen naast de claim.

## Wat erin zit

| Weergave | Adres | Wat het doet |
| --- | --- | --- |
| Overzicht | `#overzicht`, toets 1 | Vijf cijfers (nieuw, over de antwoordtermijn, open met bedrag, erkend dit kwartaal, aandeel afgewezen), "Wat nu" (over de termijn, nieuw, wacht te lang op de chauffeur of de verzekeraar, door de chauffeur zelf gemeld), schades per week over twaalf weken, signalen (chauffeur boven de regel, opdrachtgever die vaak schade claimt die er al zat, open dossiers zonder foto van de plek) |
| Schades | `#schades`, toets 2 | De werkvoorraad als tabel (op een telefoon een lijst): kenteken als plaat, opdrachtgever, ontvangen met werkdagen, gevraagd, status, signaalicoontjes, behandelaar, chauffeur; zoeken op kenteken met of zonder streepjes; chips per status, keuzemenu's per opdrachtgever, vestiging, chauffeur en periode; sorteren op elke kolom; csv. Elke filter staat in het adres |
| Dossier | `#schade/S-2026-0585` | Drie kolommen (op een telefoon drie tabbladen). Links de melding: de mail, de bijlagen, de uitgelezen velden met hun zekerheid, de calculatie met de punten om te bespreken en de herrekening. In het midden onze rit uit Transplan: rit, van en naar, chauffeur, truck en positie, kilometerstand, het voertuig met de RDW-velden; de inspectie bij ophalen op een autodiagram met de claim ernaast (dezelfde plek rood omlijnd), de foto's bij ophalen met tijd en plek (de treffers gemarkeerd), de aflevering met de handtekening met of zonder voorbehoud. Rechts de beoordeling: zeven signalen (vervoerd door ons, stond al op de ophaalinspectie, getekend zonder voorbehoud, op tijd gemeld, limiet per kilogram, boven of onder de grens naar de verzekeraar, de calculatie), het advies met de reden, het besluit (zeven keuzes, bedrag waar dat hoort), "Besluit vastleggen", "Conceptantwoord", de vraag aan de chauffeur, toewijzen, sluiten; notities en het logboek |
| Chauffeurs | `#chauffeurs`, `#chauffeur/C-08`, toets 3 | Per chauffeur ritten, schades (afgewezen claims tellen niet), schades per duizend ritten, onze kosten, het signaal van de regel (drie in zeven dagen is een gesprek; het tweede signaal is een instelling) en de laatste schade; per chauffeur de dossiers, per maand, de fase en de plek die het vaakst voorkomen. Alleen voor de schadebehandeling en de directie; met de noot over AVG en OR |
| Opdrachtgevers | `#opdrachtgevers`, `#opdrachtgever/K-01`, toets 4 | Claims per opdrachtgever, aandeel afgewezen, aandeel "schade bestond al", doorlooptijd, gemiddeld gevraagd; per opdrachtgever de dossiers en, als het patroon er is, de aanbeveling voor een gesprek over hun uitgiftecontrole |
| Wagenpark | `#wagenpark`, `#voertuig/BT-23`, toets 5 | Per trekker met zijn oplegger de aanrijschades van een jaar, onze kosten, de dagen uit de roulatie en of hij nu in herstel is; per voertuig de schades op het zijaanzicht en de dossiers |
| Dashboard | `#dashboard`, toets 6 | Het beeld voor de directie: vijf tegels met de richting en een vonklijn (claims, onze kosten, aandeel afgewezen, claims per duizend ritten, doorlooptijd), de kosten per maand, de uitkomst als een balk, waar de schade zit als warmtekaart op de auto, per vestiging, wanneer het gebeurt, de opdrachtgevers en de spreiding van de chauffeurs; per 30 of 90 dagen of een jaar, per vestiging |
| Rapporten | `#rapporten`, toets 7 | Het maandoverzicht voor het management: per maand, kwartaal of jaar de aantallen en bedragen, per vestiging, fase, plek, opdrachtgever en chauffeur, de uitkomst; csv en afdrukken |
| Instellingen | `#instellingen`, toets 8 | De getallen van Breedijk (grens naar de verzekeraar 1.750 euro, eigen risico 750 euro), de limiet per kilogram (AVC 3,40), de termijnen, het gangbare uurtarief (schatting), de regel voor het gesprek, naam, rol (behandelaar, planner, directie), thema, de koppelingen (mail plakken, een rittenexport inlezen met het voorbeeldbestand als datacontract, RDW live aan of uit) en wat de browser bewaart |
| Nieuwe melding | toets n | Velden invullen, of een mail plakken die het portaal uitleest (`src/intake.js`: kenteken, datum, bedrag, plek, soort, afzender, met zekerheid); het kenteken zoekt meteen de rit; zonder rit en met "RDW live" haalt een knop merk, kleur, gewicht en cataloguswaarde bij de RDW; het dossier opent |
| Zoeken | toets / | Kenteken (met of zonder streepjes), dossiernummer, chauffeur, opdrachtgever; een rit zonder claim opent een nieuwe melding |

Toetsen: 1 tot 8, /, n, [ (menu), Esc (sluiten of terug naar de lijst), ? (de lijst).

## Hoe de beoordeling werkt (`src/regels.js`)

Per claim legt het portaal zeven dingen naast elkaar (acht als de auto over het overslagterrein ging) en zegt wat het
ziet; de mens beslist. Hieronder de ladingsschade; voor aanrijschade en diverse schade staat de beoordeling in
`beoordeelVoertuig` (melding, schadeformulier, plaats, raming tegen de grens naar de casco, dagen uit de roulatie;
bij een derde de telematica, de melding van de chauffeur, het formulier, het bewijs, geen aansprakelijkheid erkennen,
het bedrag tegen het WA-eigen risico).

1. **Vervoerd door ons?** De rit op kenteken en datum. Geen rit is ook een antwoord.
2. **Stond de schade al op de ophaalinspectie?** Dezelfde of een aangrenzende plek (bumper en spatbord
   lopen in elkaar over), met de foto's van die plek en hun tijdstip.
3. **De keten.** Ging de auto over het overslagterrein in Barneveld, dan zegt de intake-controle daar of de schade op
   de aanvoerrit ontstond (al gezien bij de intake) of op het terrein of bij de uitlevering (nog niet gezien). De
   aflevering is altijd bij de tegenpartij; onze eigen handtekening op het terrein telt nooit als bewijs.
4. **Bij aflevering getekend?** Zonder voorbehoud, of met een voorbehoud over deze plek.
5. **Op tijd gemeld?** Zichtbare schade bij aflevering, niet zichtbare binnen zeven dagen (AVC en CMR; signaal,
   laten toetsen).
6. **De limiet per kilogram.** Massa van het voertuig maal het tarief (AVC 3,40 euro; CMR 8,33 SDR); signaal.
7. **Boven of onder de grens naar de verzekeraar**, en het eigen risico.
8. **De calculatie.** Uurtarief tegen de norm (schatting), vervangen waar herstellen past, dubbele posten,
   btw bij een ondernemer; een herrekend tegenvoorstel, nooit boven de limiet.

Het advies volgt uit die signalen (afwijzen met bewijs, erkennen, indienen bij de verzekeraar, tegenvoorstel,
meer informatie vragen, de chauffeur vragen). Het conceptantwoord (`src/antwoord.js`) noemt de bewijsstukken
met hun tijdstip; in de demo uit vaste zinnen, in het echt uit dezelfde feiten door de Claude API, altijd
nagelezen door de behandelaar en verstuurd vanuit Outlook.

## Draaien

```
npm install
npm run dev          # ontwikkelserver
npm run build        # dist/index.html: een bestand met alles erin (ca. 820 kB met lettertype en foto's), plus dist/artifact.html
npm test             # de regels, de gesimuleerde wereld en de intake, zonder browser (node --test)
cd dist && python3 -m http.server 8791 --bind 127.0.0.1
node tests/verify.mjs 8791 [map voor schermafbeeldingen]   # de app in Chromium op 1440, 390 en 1024 px, met minder beweging en ingebed
```

`tests/verify.mjs` controleert: laden zonder consolefouten, geen enkel verzoek naar buiten, geen horizontale
overloop in elke weergave, drie kolommen op 1440 en tabbladen op 390 px, een besluit dat na een herlaad nog
staat, het conceptantwoord met het dossiernummer, een nieuwe melding die de rit vindt, zoeken met pijltjes en
Enter, de sneltoetsen, het donkere thema op de app-root, de rol planner zonder chauffeursbeeld, de onderbalk
en de lijst op een telefoon (gemeten in pixels), de zijbalk ingeklapt op 1024 px, het dashboard, een geplakte
mail die de velden vult, een rittenexport die ingelezen wordt, en ingebed (`data-embedded`) de sneltoetsen alleen
na een klik in de app.

## Inbedden in een site

De app-root `<div id="app" class="app bsp">` draagt alle stijl (CSS nesting onder `.bsp`, afgevlakt door de
build) en het thema (`data-theme`). Met `data-embedded` tellen de sneltoetsen pas na een klik in de app. De
route voor SafeTools is dezelfde als bij de Control Tower (`demos/simonloos-control-tower/README.md`,
"Inbedden in een site"): een site-build met vaste bestandsnamen en een pagina met het skelet uit `index.html`.
Dat is nog niet gedaan; eerst het gesprek met Breedijk. De gebouwde demo staat ook achter het wachtwoord van
de demosite (repo `controltower-demo`, `public/schadeportaal/`).

## Bestanden

- `index.html`: het skelet (de id's die `src/ui.js` verwacht).
- `src/regels.js`: de pure regels (statussen, besluiten, gebieden, de beoordeling met het ketensignaal, het
  tegenvoorstel, wat telt als schade van een chauffeur, de regel voor het gesprek, zoeken, csv). Geen DOM, geen opslag.
- `src/intake.js`: de mail lezen zonder taalmodel en een rittenexport (csv) inlezen; `voorbeeldCsv()` is het
  datacontract. `src/rdw.js`: de RDW open data op verzoek. `src/importen.js`: geïmporteerde ritten over de wereld heen.
- `src/data.js`: de gesimuleerde wereld met een vaste seed: de drie adressen van Breedijk (Opmeer, het
  overslagterrein in Barneveld, Nijkerk), 14 verzonnen opdrachtgevers (de namen zijn gezocht en komen voor zover
  bekend niet voor), 48 chauffeurs, ongeveer 11.000 ritten in 90 dagen (800 per week; bijna de helft over het
  overslagterrein met een intake-controle en een tweede chauffeur voor de uitlevering), 470 claims over een jaar
  met hun verhaal (stond er al, nieuw met voorbehoud, nieuw zonder voorbehoud, onduidelijk, geen rit, door de
  chauffeur gemeld) en de fase waarin de schade ontstond (die bepaalt welke chauffeur erbij hoort), de mails,
  calculaties, inspecties en foto's (per rit pas gemaakt als een dossier ze nodig heeft).
- `src/instellingen.js`: de standaardwaarden en de rollen.
- `src/acties.js`: wat de behandelaar doet, over de dag heen gelegd en bewaard (`bs-acties`).
- `src/antwoord.js`: het conceptantwoord en de vraag aan de chauffeur.
- `src/diagram.js`: het autodiagram van boven en de schets op een fotokaartje.
- `src/ui.js`: de schil (menu, topbalk, onderbalk, adressen, zoeken, dialogen, meldingen, sneltoetsen).
- `src/views/`: de weergaven (overzicht, schades, dossier, chauffeurs, opdrachtgevers, dashboard, rapporten,
  instellingen, nieuw).
- `src/style.css`: het ontwerpsysteem (tokens licht en donker, 13,5 px, 8-puntsraster) en de onderdelen.
- `src/views/wagenpark.js`: het wagenpark en de pagina per voertuig. `src/diagram.js` tekent ook het zijaanzicht van de
  autotransporter. `src/antwoord.js` heeft ook het pakket per soort, de mail aan de verzekeraar en de werkorder.
- `tests/`: `regels.test.mjs`, `data.test.mjs`, `intake.test.mjs` (node --test) en `verify.mjs` (Playwright).
- `tools/artifact.mjs`: maakt `dist/artifact.html` voor een Claude-artifact.
- `tools/schermen.mjs`: neemt de schermafbeeldingen voor het rapport opnieuw op (`rapporten/breedijk-schadeportaal/schermen`),
  met de dossiers gekozen op hun soort. Bouw eerst, serveer `dist` en geef de poort mee.

## Wat echt is en wat niet

Echt: de plaatsnamen; de drie vestigingen; de opbouw van een schadecode (gebied, soort, ernst, naar
AIAG/ECG M-22); de velden van een voertuig (RDW open data); de getallen uit het gesprek als instelling (1.750,
750, drie in een week). Gesimuleerd: al het andere. Schatting: het aandeel ritten met een claim (iets meer dan
een op de honderd), de verdeling van de verhalen, de bedragen, het gangbare uurtarief. De limiet per kilogram
en de termijnen zijn signalen uit de AVC 2002 en het CMR-verdrag, in `rapporten/breedijk-schadeportaal/
bronnen.md` met status "zoek": voor een memo aan Breedijk eerst nalezen in de tekst zelf.
