# Na 4.0: wat open staat (26 oktober 2026, bij de oplevering)

Niet blokkerend voor de oplevering van 4.0; de eerste punten voor 4.1. Bron: de derde eindcontrole, de twee
herstel-agents en de website-sessie. Alles in de demo is gesimuleerd.

## Tekst en kleine fouten
- Het Assistent-paneel zegt "nooit namen of nummers van personen", terwijl de functie juist de nummers (P-0417)
  meestuurt in plaats van de naam. Goed: "nooit namen; een persoon gaat als nummer" (src/ui/ai.js).
- Het paneel zegt "hoogstens dertig vragen per uur" terwijl de rem 20 is (ASSISTENT_REM). Op de demosite staat
  vandaag ASSISTENT_REM=30, zodat de tekst klopt; de tekst zelf moet het getal niet noemen (src/ui/ai.js).
- Op 390 px breekt een lange stopnaam op een planbordblok af met een ellips, en op de standplaatspagina de regel
  "T-1096 + O-5080 · Martijn Willems".
- De fotocredit "Sem Appel" in portretten.js is de keuze van de oprichters; nakijken.

## Tests
- De volgmetingen van map-check (2D, 3D, draaisnelheid) meten met de tijd van het beeld waarin MapLibre tekent, de
  camera met de klok van de eigen beeldlus; op een software-GPU lopen die tot 15 procent uiteen (68 tegen 60 graden
  per seconde). Meten met dezelfde klok, en wachten op een minimum aantal beelden in plaats van een vast venster.
- Een vaste "trage machine"-stand (CPU-throttling via CDP) voor de metingen van het eerste kaartbeeld en het volgen,
  zoals map-check 2b nu heeft.
- tests/ochtend-check elke nacht over zeven dagen, beide maandagen na een tijdwissel en de feestdagen (ideeënbank 48).

## Demosite
- De 15 MB in één bestand is op mobiel internet 15 tot 25 s tot het eerste beeld. Splitsen zoals in SafeTools
  (gehashte bestandsnamen, lange cache, alleen index.html no-store) scheelt ongeveer 1,5 MB gzip bij het openen.
- De demosite online (OpenFreeMap) en de regel "online: de eigen stijl tekent de tegel (o-landuse)" uit map-check
  zijn in de derde eindcontrole niet onderzocht.

## Doorvragen bij Simon Loos
- Planners: wat zij als eerste willen als niemand het venster meer haalt (iemand die na het venster vertrekt, of
  morgen als eerste); hoe lang zij op een antwoord wachten voor ze de volgende vragen; of zij ooit één chauffeur voor
  twee ritten op een dag vragen; het woord voor "achter op plan maar binnen het venster".
- Directie en inhuur: wordt een charter centraal of per standplaats beloofd; wie mag "Plan alle open ritten" in één
  keer bevestigen; het echte zondagpatroon per divisie.
- ICT: welke machines in de hal en op kantoor (software-WebGL of een GPU; 768, 834 of 1024 px); de export van open
  ritten en antwoorden uit het TMS (OTM5), het rooster en de uren voor de kandidaten.
- OR en AVG (signaal, geen advies): de kans op een ja per persoon en het logboek met namen zijn bij echte data
  persoonsgegevens en lijken op een beoordeling.
