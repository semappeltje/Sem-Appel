# Control Tower 4.0: onderzoek en repo's

25 oktober 2026 · tak `ct4/onderzoek` · voor de vier bouwstromen van 4.0 (data, kaart en beweging, 3D,
interface) en voor Sem

Dit memo zet drie dingen op een rij. Wat de onderzoeken over Simon Loos van de control tower vragen. Welke
open-source bouwstenen we gebruiken, na proeven met de echte datavorm van de app. En per werkstroom de volgorde
die het meeste oplevert. Niets hiervan zit al in de app. De 3D-modellen die klaarstaan, zitten in
`demos/simonloos-control-tower/assets-3d/`.

Bij de cijfers staat de status van de bron:

- **gelezen**: uit een rapport in `rapporten/` of een document van Sem; dat noemt zijn eigen bron.
- **schatting**: door dat rapport als schatting gemarkeerd, of een eigen inschatting.
- **gemeten**: een eigen proef in headless Chromium met SwiftShader. SwiftShader rekent de videokaart na op de
  processor. Tijden zeggen daarom iets over verhoudingen, niet over een laptop met een echte GPU.

Groottes zijn geminificeerd met esbuild, gzip op niveau 9, 1 KB = 1.024 bytes.

## In het kort

1. **Het planbord is het grootste gat.** Planners willen ritten slepen met directe toetsing en een bak met ritten
   die nog niemand heeft (Plan 1.2, scherm 4). In 3.2 kun je het bord alleen bekijken. svelte-gantt (MIT,
   93 KB) houdt het bij 1.300 voertuigen en 17.234 blokken bij. De toetsregels schrijven we zelf.
2. **Een melding wordt een zaak**: eigenaar, status, deadline, tijdlijn en een voorstel met uitleg. Daar is geen
   pakket voor nodig. Het patroon komt uit Odoo (statusbalk, logboek, activiteiten) en Timefold (“waar past
   deze rit”, uitleg per regel).
3. **Tabellen naar Tabulator** (MIT, 264 KB): 1.300 rijen sorteren in 27 ms, ARIA-grid, csv. **Zoeken naar
   MiniSearch** (MIT, 17 KB): tikfouten en kentekens met of zonder streepjes, onder de 3 ms.
4. **Kaartlabels als MapLibre-symboollagen** met letters uit het systeem, zonder glyph-server. MapLibre lost de
   botsingen op en de HTML-markers kunnen weg. deck.gl en threebox vallen af: 0,8 tot 1,2 MB extra en
   problemen met MapLibre 6.
5. **3D: geen CC0-trekker met oplegger te vinden.** De vrachtwagens blijven procedureel. Bomen en
   bedrijfshallen van Kenney (CC0) staan klaar, 668 KB voor 22 modellen. `GLTFLoader` kost 56 KB in de
   3D-bundel.
6. **De simulatie wijkt af van de onderzoeken.** Diensten duren mediaan 5,3 uur, het onderzoek noemt 9 tot 11
   uur. Om 10:00 staat de helft van de vloot op het terrein. IJk dat eerst: een mooier beeld van een
   onrealistische dag helpt geen planner.
7. **Wat het kost:** alles wat we overnemen samen is ongeveer 500 KB (146 KB gzip) bij 8,8 MB nu, waarvan
   56 KB in de 3D-bundel. Alles lokaal, geen verzoek naar buiten.

## 1. Wat de onderzoeken vragen

### Bronnen en afkortingen

| Afkorting | Document | Waar |
| --- | --- | --- |
| Plan 1.2 | Simon Loos Control Tower: plan en mockups voor een realistische versie | artifact `BsyZjcAeqfYVS23BX9aSYL`; samenvatting en mockups in `rapporten/simon-loos-control-tower/` |
| Plan 2.0 | Control Tower 2.0: ontwerpvoorstellen, rollen en mockups | artifact `PEAiAqMnTV7Y2TUxrqyaE3`; mockups in `rapporten/simon-loos-control-tower/mockups-2.0/` |
| Slimste | Simon Loos als slimste transporteur van Europa | artifact `FXjhz6D94JMHjzzUxZKbbH`; `rapporten/simon-loos-slimste-transporteur/README.md` |
| AI-voorstel | AI voor Simon Loos (13 oktober 2026) | `rapporten/hero-ai-voorstel/AI-voor-Simon-Loos.pdf` |
| Werkenbij | Website-analyse werkenbijsimonloos.nl | `rapporten/werkenbij-simonloos/Website-analyse-werkenbijsimonloos.nl.pdf` |
| Corporate | Website-analyse simonloos.nl | `rapporten/simon-loos/Website-analyse-simonloos.nl.pdf` |
| Wagenpark | Open-source wagenparksystemen op GitHub en RDW-data | artifact `SJkFYtoWtFm5Wx3T1uBaUx` (gelinkt vanuit Plan 1.2) |
| Brief | Control Tower 4.0: ontwerpbrief | `demos/simonloos-control-tower/ONTWERP-4.md` |

### 1.1 Wie wat nodig heeft

| Wie | Wat hij zoekt | Bron |
| --- | --- | --- |
| Planner | Opent op zijn standplaats en ziet alleen wat afwijkt. Sleept ritten en krijgt meteen te horen of het kan. Draagt over aan de volgende planner. Wordt regisseur die uitzonderingen afhandelt | Plan 1.2 “Uitgangspunten” en scherm 4; Plan 2.0 “Rol bepaalt het scherm”; Slimste “Planning” |
| Chauffeur | Een rooster dat klopt en vooraf vaststaat, rusttijden die gehaald worden, minder bellen | AI-voorstel 2.2 (Indeed 3,1 van 5, klacht: de planning); Werkenbij 2.3; Slimste “Chauffeurs” |
| Hal en loods | Vertrekbord: tijd, voertuig, chauffeur, dock, bestemming | Plan 1.2 “Hal-scherm”; Plan 2.0 idee 9 |
| Regiomanager | Zijn regio; rij-score, schades en kosten per km achter een slot | Plan 2.0 “Rollen en rechten”, mockup 03 |
| Directie | Nederland op een scherm voor de ochtendronde; op tijd per klant, CO2, kilometers per standplaats | Plan 1.2 “Directie-overzicht” en “Automatiseren: rapportages” |
| Winkel en klant | De ETA van de eigen truck en een bericht als het venster niet gehaald wordt | Plan 1.2 “Deel-link met klant” en “De klant informeren” |
| ICT en OR | Eerst alleen lezen, koppelen via API; een positie is een persoonsgegeven (DPIA, OR) | Plan 1.2 “Pilotplan, stap 0”; Plan 2.0 “Wet en OR” (signaal: laten toetsen) |

### 1.2 Eisenlijst

De kolom “3.2” zegt wat de app nu heeft (HEAD `5483283`).

**Moet**

| # | Eis | Bron | Wat het in de app betekent | 3.2 |
| --- | --- | --- | --- | --- |
| E1 | Uitzonderingen eerst, elke melding een zaak | Plan 1.2 “Uitgangspunten: Uitzonderingen eerst”; Plan 2.0 “Ontwerprichting” (een cijfer per vraag); Brief “De lat: Echt helpend” | Een melding heeft eigenaar, status, deadline en tijdlijn. Wat groen is, vraagt niets | Deels: afhandelen, toewijzen en later in `sl-acties`, geen tijdlijn |
| E2 | Planbord met slepen, pool en directe toetsing | Plan 1.2 scherm 4 (“slepen naar een truck en het systeem toetst direct”) en “Planbord met controle”; Slimste “Planning”, voorstel 4 | Rit slepen tussen voertuigen; overlap, rijtijd, rusttijd, tijdvenster, accu en laadtijd meteen gemeld; een bak “Niet ingepland” | Nee: Plan 1.2 noemt slepen “nog niet gebouwd, bewust” |
| E3 | ETA tegen het tijdvenster, met de oorzaak | Plan 1.2 “ETA-belofte per winkel” en scherm 3 (een NDW-melding verklaart zeven minuten) | Per stop venster en ETA, rood voordat het misgaat, met de reden erbij (file, wegwerk, lostijd) | Deels: ETA en venster, geen oorzaak |
| E4 | Rijtijdradar met pauzevoorstel | Plan 1.2 “Rijtijd-radar” (EU 561/2006) en “Rijtijden bewaken”; AI-voorstel kans 1; Werkenbij 2.3 (“rusttijd” staat op geen enkele pagina) | Wie binnen 30 minuten moet pauzeren, met een beoordeelde plek. Dezelfde regel toetst in E2 | Ja |
| E5 | Standplaats als lens, werkgebied per rol | Plan 1.2 “Standplaats als lens”; Plan 2.0 “Rol bepaalt het scherm”, mockup 05 | Opent op het eigen werkgebied, de rest gedimd | Ja |
| E6 | Een realistische dag | Brief “De lat: Realistisch”; Plan 1.2 “Wat er mis is met de huidige demo”; Slimste “Minder trucks” | Standplaatsen op adres, echte winkels, diensten en rijtijden op de maat van 1.4 | Deels |
| E7 | Rustig kaartbeeld | Plan 2.0 “Ontwerprichting” en “Wat ik niet zou doen”; Brief “Kaart” | De kaart is het scherm, hooguit drie cijfers, geen clusterbollen, niets knippert | Ja |
| E8 | Zoeken op alles | Plan 2.0 “Verbeterpunten”; Brief “Zoeken op de kaart” | Voertuig, kenteken, oplegger, chauffeur, standplaats, winkel, plaats; tikfouten mogen; de kaart vliegt erheen | Deels: letterlijk zoeken, per soort op volgorde |
| E9 | Werktabellen | Plan 2.0 “Verbeterpunten”; Brief “Tabellen” | Sorteren, chips, kolomkeuze, bulkacties, csv, rijen van 36 px | Deels |
| E10 | Hal-scherm en klant-link | Plan 1.2 “Hal-scherm” en “Deel-link met klant”; Plan 2.0 13 en 15; Slimste “Hal-scherm en klantlink” | Houden, met dock en vertrek uit dezelfde data als het planbord | Ja |
| E11 | Opleggers los van trekkers | Plan 2.0 “Versie 3.0”; Slimste “Minder trucks” (drop-and-hook, trailerpools) | Oplegger als eigen object in planbord en toetsing | Ja |
| E12 | Werkt zonder internet | Opdracht van deze ronde; Slimste “Simon Loos nu” (cyberincident bij AH in oktober 2026: een offline-terugval voor de planning hoort in het volgende contract) | Elke bouwsteen zit in de bundel; geen tegel-, font- of glyph-server in de ingebedde versie | Ja |

**Zou moeten**

| # | Eis | Bron | Wat het in de app betekent | 3.2 |
| --- | --- | --- | --- | --- |
| E13 | Laden op dagprijs en netaansluiting | Plan 1.2 “Accu-planning eActros” en “Laden op de goedkoopste uren”; Plan 2.0 12; Slimste “Energie”; AI-voorstel kans 8 | Laadsessies als blokken op het planbord. Toetsing: haalt de accu de terugrit, past het binnen de aansluiting | Deels: weergave Laden, geen toetsing |
| E14 | Lostijden leren | Plan 1.2 “Leren van de echte lostijden”; Plan 2.0 11; Slimste “Planning”, voorstel 5 | Gepland naast gemeten per adres en dagdeel, overnemen in de planning | Ja |
| E15 | Wachttijd meten | Slimste “Minder trucks: Wachten bij DC en winkel” en “Wachttijdmeter” | Minuten op locatie per stop, per DC en winkel, als kolom en rapport | Nee |
| E16 | Voorstellen met uitleg en effect | Plan 1.2 “Planning-assistent”; Slimste “Planning”, voorstel 6 (“elke suggestie toont het KPI-effect”); AI-voorstel kans 1 | Elk voorstel zegt waarom en wat het doet met minuten te laat, kilometers en rijtijd. Akkoord in een klik | Deels: assistent zonder effect per regel |
| E17 | Dienstbouw | Slimste “Planning” (bij AH is de dienstbouw het kernprobleem) en “Dienstbouwer” | Ritten uit de pool koppelen aan chauffeur, voertuig en oplegger, getoetst op rijtijd en cao | Nee |
| E18 | Replay met spoor | Plan 1.2 “Replay 24 uur” | Terugspoelen bestaat. Voeg het spoor van de gekozen rit toe en de plek waar de vertraging ontstond | Deels |
| E19 | Overdracht per rit en voertuig | Plan 1.2 “Collega's”; Plan 2.0 idee 8 | De notitie hangt aan rit of voertuig, zichtbaar in de zaak en op het planbord | Deels: overdracht per planner |
| E20 | Touch rate meten | Slimste “Planning”, voorstellen 1 en 6 | Per planner en dag: welk deel van de ritten hij wijzigt. Dat is de nulmeting van een pilot | Nee |
| E21 | Docks | Plan 1.2 scherm 2 (“de volgende vertrekken met dock”) en “Welke data” | Dock per vertrek; dockbezetting is een planbord met docks als rijen | Deels: dock op het hal-scherm |

**Kan later**

| # | Eis | Bron | Opmerking |
| --- | --- | --- | --- |
| E22 | CO2 per rit en per klant | Plan 1.2 “CO₂ en energie per rit”; Slimste “CO2 per rit” (ISO 14083); Corporate 4.6; AI-voorstel kans 4 | Rapport per klant; vraagt verbruik per rit |
| E23 | Lagen van buiten: NDW, KNMI, zero-emissiezones, LZV | Plan 1.2 “Lagen van buiten” en “ZE-zones en LZV-routes” | Alleen in de losse versie, of gesimuleerd. De ingebedde versie vraagt niets van buiten |
| E24 | Wat-als-scenario's | Plan 1.2 “Wat-als-scenario's”; Slimste “Planning” | Een scenario op de replay van vandaag (A7 dicht, DC later open) |
| E25 | Automatisch herplannen | Plan 1.2 “Doorlopend herplannen” (VROOM, Timefold) | In de browser kan een kleine oplosser (2.2); de echte versie rekent op een server |
| E26 | Chauffeursapp en schade melden | Plan 2.0 7 en 8 (Later); Slimste “Chauffeurs”; AI-voorstel kans 2 | Het AI-voorstel kiest WhatsApp of de Trimble-tablet als kanaal, geen eigen app |
| E27 | Beheerscherm en audit-log | Plan 2.0 3 (Later), mockup 06 | “Bekijk als” bestaat al |
| E28 | Recruitment-kaart | Plan 1.2 “Recruitment-view”; Plan 2.0 16; Werkenbij | Geanonimiseerd, met vacatures per standplaats |
| E29 | Vlootsimulator per standplaats | Slimste “Minder trucks”, voorstel 5 (“De simulatie uit de control-tower-demo is de basis voor die berekening”) | De simulatie met echte ritten voeden en per weekdag tellen |
| E30 | Spraak in de cabine | Plan 1.2; Plan 2.0 17 | Buiten deze demo |

**Niet doen**, uit de onderzoeken zelf: punten of ranglijsten voor chauffeurs, vrije chat onderweg en meer dan
drie cijfers op het kaartscherm (Plan 2.0, slot van “Out-of-the-box ideeën”); clusterbollen met cijfers (Brief
“Kaart”; Plan 2.0 “Versie 3.0”); een rij-score voor beoordeling of sanctie zonder regeling met de OR (Plan 2.0
“Wet en OR”; een signaal, laten toetsen).

### 1.3 Mockups en voorstellen die nog niet in de app zitten

- Scherm 4 van Plan 1.2: ritten slepen, de bak “ritten die nog niemand heeft” en drie conflicten tegelijk in beeld
  (venster, rijtijd, rusttijd). Zie E2.
- Scherm 3 van Plan 1.2: de oorzaak van een vertraging bij de ETA (NDW-melding) en de rit als lijn, grijs
  gereden en blauw te rijden. Zie E3 en K3.
- Plan 2.0 mockup 06 (beheer: rechtenmatrix, gebruikers, koppelingen) en mockup 07 (chauffeursapp Mijn dag en
  schade melden): geparkeerd, zie E26 en E27.
- Plan 2.0 mockup 01 (echte landkaart met gebouwen en straatnamen): de brief vraagt dit nu, met OpenFreeMap in
  de losse versie en een rijkere ingebouwde kaart.
- Uit de brief zelf ontbreken nog de onderdelen Overzicht, Ritten, Meldingen (als lijst van zaken), Rapporten en
  Instellingen in de linkerbalk.

### 1.4 Cijfers om de simulatie te ijken

| Onderwerp | Onderzoek | Status | Simulatie 3.2 (gemeten) | Advies |
| --- | --- | --- | --- | --- |
| Vloot | 1.300 trucks, circa 60 locaties, 3.500 collega's (Slimste “Simon Loos nu”, uit simonloos.nl) | gelezen | 1.300: 1.131 trekkers, 113 bakwagens, 56 bestelbussen | Houden |
| Elektrisch | circa 210 e-trucks, 16 procent van de vloot (Slimste; AI-voorstel 2.1) | gelezen | 210 trekkers en bakwagens, plus 56 elektrische bussen | Houden; de bussen apart noemen |
| Opleggers | tellers op simonloos.nl: “1.200+ trekkers”, “1.500+ trailers” (Corporate 4.1) | gelezen | 1.681 | Houden |
| Standplaatsen | 60 op simonloos.nl; 40 met vacatures en elders “70 standplaatsen” (Werkenbij, G1 en de tabel met vacatures) | gelezen | 42 | Houden (Brief); de bronnen spreken elkaar tegen |
| Dienstduur | een dienst is 9 tot 11 uur inzet, waarvan 50 tot 60 procent rijden (Slimste “Minder trucks”) | schatting | mediaan 5,3 uur, p10 3,1, p90 9,1 | Naar 8,5 tot 11 uur, mediaan rond 9,5 |
| Rijden binnen de dienst | 45 tot 60 procent (Slimste “Chauffeurs”) | schatting | 61 procent | Iets omlaag: lossen, wachten, koppelen |
| Inzet over de dag | een truck staat 55 tot 65 procent van de 24 uur stil (Slimste “Minder trucks”) | schatting | om 10:00 staan 655 van de 1.300 op het terrein | Om 10:00 hoort het grootste deel te rijden |
| Diensten per voertuig | voorstel: van 1,0 naar 1,7 per dag voor 30 tot 40 procent van de AH-trucks (Slimste “Minder trucks”, voorstel 1) | schatting | 1,5 gemiddeld (611 voertuigen twee, 606 een) | Tweede dienst bij een deel van de vloot, niet bij de helft |
| Wachten | 3 tot 5 uur per week bij magazijnen, 35 tot 60 minuten per truck per dag (Slimste, leveranciersbron Nokavision) | schatting | niet gemodelleerd | Wachttijd per DC en winkel toevoegen (E15) |
| Ritten van AH | capaciteitsritten op donderdag, definitieve ritten elke middag via OTM5; Simacan rekent de ETA (Slimste “Planning”, bron TTM) | gelezen | niet zichtbaar | De pool vult zich 's middags voor morgen |
| Stroomprijs | depot 0,175 tot 0,23 euro per kWh, Milence 0,399; goedkoopste uren 3 tot 6 uur en zonnige middagen (Slimste “Energie”) | gelezen | dagprijs 44 tot 172 euro per MWh plus 0,09 euro per kWh, dal 's nachts en rond 13:00 | Past |
| Verbruik | referentie 1,1 kWh per km (Slimste “Energie”, NACFE) | gelezen | 1,15 kWh per km voor trucks | Past |
| Planners | 15 tot 25 trucks per planner, bij 1.300 trucks 50 tot 85 planners (Slimste “Planning”) | schatting | 5 planners in de hele app, 3 in Wognum bij 225 voertuigen | Per standplaats een planner per 15 tot 25 voertuigen |
| Klacht van chauffeurs | Indeed 3,1 van 5 bij 101 reviews: planning, afspraken niet nagekomen, korte rusttijden, geen inspraak (AI-voorstel 2.2; Werkenbij 2.3) | gelezen | | Rusttijd en wijzigingen zichtbaar op planbord en in de zaak |
| Systemen | ORTEC met Navitrans, Trimble FleetXPS met e-CMR, Navision en ORD in Maasdam, Simacan en Excel in Zaandam (Slimste “Simon Loos nu”; AI-voorstel 2.1) | gelezen | | Per gegeven tonen uit welk systeem het later komt |

## 2. Repo's en bouwstenen

### 2.1 Oordeel per bouwsteen

Alleen MIT, BSD, Apache, ISC en CC0 nemen we over. GPL, LGPL en AGPL zijn alleen referentie. “Afhankelijkheid”
betekent: npm-pakket in de bundel. “Patroon”: we bouwen het idee zelf na. “Referentie”: alleen kijken.

**Planbord**

| Bouwsteen | Licentie | Grootte (min / gzip) | Laatste release | Oordeel | Hoe het de app in komt |
| --- | --- | --- | --- | --- | --- |
| [svelte-gantt](https://github.com/ANovokmet/svelte-gantt) 4.5.0 | MIT (licentietekst in het pakket; `package.json` noemt geen licentie, de copyrightregel is een sjabloon) | 92,7 / 30,4 KB | 10 februari 2025 | **Afhankelijkheid** | npm, achter een eigen `planbord.js`. Het pakket is al gecompileerd: de app hoeft geen Svelte te kennen. Licentietekst meeleveren |
| [vis-timeline](https://github.com/visjs/vis-timeline) 8.5.4 | Apache-2.0 of MIT | 557,8 / 159,7 KB | 12 augustus 2026 | Niet (plan B voor een bord per standplaats) | |
| [frappe-gantt](https://github.com/frappe/gantt) 1.2.2 | MIT | 46,6 / 13,0 KB | 25 februari 2026 | Niet | Een taak per rij, geen rijen met voertuigen |
| [SVAR Gantt](https://github.com/svar-widgets/gantt) 2.8.1 | MIT | niet gemeten | 12 oktober 2026 | Niet | Svelte-component (vraagt een Svelte-build) en taakgericht |
| [gantt-schedule-timeline-calendar](https://github.com/neuronetio/gantt-schedule-timeline-calendar) 3.43.16 | eigen licentie, geen open source | | 24 oktober 2026 | Niet | |

**Tabellen**

| Bouwsteen | Licentie | Grootte | Laatste release | Oordeel | Hoe het de app in komt |
| --- | --- | --- | --- | --- | --- |
| [Tabulator](https://github.com/olifolkerd/tabulator) 6.7.1 | MIT | 263,7 / 64,2 KB met de 12 modules uit de proef (210,0 / 51,6 zonder `EditModule` en `PersistenceModule`), plus 28 KB css | 22 oktober 2026 | **Afhankelijkheid** | npm, modules los geregistreerd; uiterlijk via de CSS-variabelen van de brief |
| [TanStack Table](https://github.com/TanStack/table) 9.3 + [Virtual](https://github.com/TanStack/virtual) 3.19 | MIT | 74,1 / 21,1 KB | oktober 2026 | Patroon, alternatief | Kies dit als de bundel klein moet blijven. Dan schrijf je rijen, toetsenbord en ARIA zelf |
| [AG Grid Community](https://github.com/ag-grid/ag-grid) 36.2 | MIT | 840,8 tot 1.106,1 / 235,9 tot 308,4 KB | september 2026 | Niet | Te groot |

**Zoeken, toetsen en zwevende lagen**

| Bouwsteen | Licentie | Grootte | Laatste release | Oordeel | Hoe het de app in komt |
| --- | --- | --- | --- | --- | --- |
| [MiniSearch](https://github.com/lucaong/minisearch) 7.2.0 | MIT | 17,2 / 5,7 KB | september 2025 | **Afhankelijkheid** | npm; index bij het opstarten (82 ms voor 5.350 items). De eigen paletweergave blijft |
| [Fuse.js](https://github.com/krisk/Fuse) 7.5.0 | Apache-2.0 | 25,9 / 9,4 KB | augustus 2026 | Niet | 20 tot 60 keer trager op onze data en een zwakkere volgorde |
| [ninja-keys](https://github.com/ssleptsov/ninja-keys) 1.2.2 | MIT | 50,7 / 16,5 KB (met lit, hotkeys-js en een Material-icoon) | juli 2022 | Niet | Niet onderhouden, eigen shadow-DOM-stijl |
| [tinykeys](https://github.com/jamiebuilds/tinykeys) 4.0.1 | MIT | 1,6 / 0,9 KB | september 2026 | Kan | Toetsreeksen zoals “g p”; de app heeft al eigen sneltoetsen |
| [Floating UI](https://github.com/floating-ui/floating-ui) dom 1.8.0 | MIT | 16,3 / 6,6 KB | juli 2026 | **Afhankelijkheid** | Een helper voor hoverkaart, contextmenu, popover en tooltip die bij de rand omklapt |
| [Tippy.js](https://github.com/atomiks/tippyjs) 6.3.7 | MIT | niet gemeten | juni 2025 | Niet | Leunt op Popper, de voorganger van Floating UI |
| [Shoelace](https://github.com/shoelace-style/shoelace) 2.20.1 / Web Awesome | MIT | 84,9 / 27,9 KB voor alleen dialoog en tooltip | maart 2025 | Niet | Eigen uiterlijk. Gebruik `<dialog>` en het `popover`-attribuut van de browser |
| [SortableJS](https://github.com/SortableJS/Sortable) 1.15.7 | MIT | 36,3 / 12,6 KB | februari 2026 | Kan later | Stops binnen een rit herordenen |

**Grafieken**

| Bouwsteen | Licentie | Grootte | Laatste release | Oordeel | Hoe het de app in komt |
| --- | --- | --- | --- | --- | --- |
| [uPlot](https://github.com/leeoniya/uPlot) 1.6.32 | MIT | 50,8 / 22,7 KB plus 2 KB css | maart 2025 | **Afhankelijkheid** | Tijdreeksen in Laden en Rapporten |
| [Chart.js](https://github.com/chartjs/Chart.js) 4.6.1 | MIT | 176,7 / 61,9 KB | oktober 2026 | Kan | Als staven en ringen nodig zijn die uPlot niet doet |
| [Apache ECharts](https://github.com/apache/echarts) 6.1.0 | Apache-2.0 | 526,0 / 180,1 KB zo klein mogelijk; 1.115,3 / 374,6 KB volledig | mei 2026 | Niet | Te groot voor wat we tekenen (Plan 1.2 noemde het) |
| [Observable Plot](https://github.com/observablehq/plot) 0.6.17 | ISC | 384,6 / 131,0 KB | april 2026 | Niet | Te groot |

**Kaart**

| Bouwsteen | Licentie | Grootte | Laatste release | Oordeel | Hoe het de app in komt |
| --- | --- | --- | --- | --- | --- |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) 6.15 (zit er al in) | BSD-3-Clause | 0 extra | | **Patroon** | Symboollagen met lokale letters voor plaatsnamen en standplaatsen; `feature-state` voor hover en selectie; `line-gradient` voor het spoor |
| [deck.gl](https://github.com/visgl/deck.gl) 9.4 | MIT | 820,8 tot 1.190,0 / 232,5 tot 327,7 KB extra | september 2026 | Niet | Het idee van TripsLayer (vervagend spoor) bouwen we in MapLibre na |
| [threebox](https://github.com/jscastro76/threebox) (`threebox-plugin` 2.2.7) | MIT | 844,5 / 228,4 KB, met een eigen oude three.js | juni 2022; het oorspronkelijke `peterqliu/threebox` is gearchiveerd | Niet | |
| [kepler.gl](https://github.com/keplergl/kepler.gl) | MIT | niet gemeten | | Referentie | React en Redux, past niet bij de opzet zonder raamwerk |
| [Supercluster](https://github.com/mapbox/supercluster) | ISC | niet gemeten | | Niet | De brief wil geen clusters |
| [OpenFreeMap](https://github.com/hyperknot/openfreemap), [PMTiles](https://github.com/protomaps/PMTiles) | MIT, BSD-3 | niet getest | | Referentie | OpenFreeMap alleen in de losse versie (brief); PMTiles voor een eigen uitsnede van Nederland later |

**3D**

| Bouwsteen | Licentie | Grootte | Laatste release | Oordeel | Hoe het de app in komt |
| --- | --- | --- | --- | --- | --- |
| [three.js](https://github.com/mrdoob/three.js) 0.170 `GLTFLoader` (three zit er al in) | MIT | +55,6 / +16,0 KB | | **Afhankelijkheid** | Alleen in `scene3d.js`, dus in de 3D-bundel |
| [glTF-Transform](https://github.com/donmccurdy/glTF-Transform) 4.5.1 | MIT | 0 (bouwgereedschap) | september 2026 | **Afhankelijkheid** (dev) | Script in `tools/` dat elk nieuw model klaarzet |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) | MIT | niet gemeten | | Kan later | Compressie vraagt een decoder in de app; bij deze maten niet nodig |
| Kenney Car Kit, Nature Kit, City Kit Industrial | CC0 | 668 KB voor 22 modellen | | **Afhankelijkheid** (bestanden) | In `assets-3d/`; bomen en hallen in de 3D-wereld, de voertuigen alleen voor de verte |
| [KayKit City Builder Bits](https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0) 1.0 | CC0 | niet klaargezet | | Niet | Woonwijk en winkels, geen bedrijfshallen |
| CesiumMilkTruck ([Khronos glTF-voorbeelden](https://github.com/KhronosGroup/glTF-Sample-Assets)) | CC-BY 4.0 met handelsmerk | | | Niet | Geen CC0 of MIT |
| [ir-engine-assets-basic](https://github.com/ir-engine/ir-engine-assets-basic) (`SemiTruck.glb`) | CPAL-1.0, per map anders | | | Niet | Licentie |

**Planning en optimalisatie**

| Bouwsteen | Licentie | Grootte | Laatste release | Oordeel | Hoe het de app in komt |
| --- | --- | --- | --- | --- | --- |
| [u-routing](https://github.com/iyulab/u-routing) (`@iyulab/u-routing` 0.22.1) | MIT | 597 KB WebAssembly | 20 oktober 2026 | Kan later | Ritten met tijdvensters herplannen in de browser. Jong project; de JS-ingang kent alleen rechte lijnen |
| [VROOM](https://github.com/VROOM-Project/vroom) | BSD-2-Clause | server (C++) | | Referentie | Voor de echte versie (Plan 1.2) |
| [Timefold quickstarts](https://github.com/TimefoldAI/timefold-quickstarts) (vehicle-routing) | Apache-2.0 | server (Java) | laatste commit 24 september 2026 | **Patroon** | “Recommended fit” en score-uitleg, zie 2.3 |
| [PyVRP](https://github.com/PyVRP/PyVRP), [OR-Tools](https://github.com/google/or-tools) | MIT, Apache-2.0 | server | | Referentie | Slimste: schaduwplanning naast de planner |

**Platforms**

| Bouwsteen | Licentie | Laatste commit | Oordeel | Wat we eruit halen |
| --- | --- | --- | --- | --- |
| [Fleetbase FleetOps](https://github.com/fleetbase/fleetops) | AGPL-3.0-or-later | 19 oktober 2026 | Referentie, geen code | Werkbank voor dispatch, kaartlade, kaartjes bij markers, knoppen per recht (2.3) |
| [Traccar web](https://github.com/traccar/traccar-web) | Apache-2.0 | 24 oktober 2026 | **Patroon** | Bewegingsbalk, markers met richting, replay, rapporten (2.3) |
| [Odoo Fleet](https://github.com/odoo/odoo/tree/master/addons/fleet) | LGPL-3 | 24 oktober 2026 | Referentie, patroon | Statusbalk, slimme knoppen, logboek, activiteiten (2.3) |
| [OpenBoxes](https://github.com/openboxes/openboxes) | | | Niet nader bekeken | Voorraadbeheer, buiten deze vraag |

### 2.2 Wat de proeven lieten zien

Alle proeven draaiden op de echte simulatie van 3.2, naar JSON gezet met `export-entry.js` (1.300 voertuigen,
1.681 opleggers, 2.241 mensen, 17.364 plansegmenten, 1.828 diensten). Paden staan in bijlage 4.3.

**Planbord: svelte-gantt tegen vis-timeline** (rijen = voertuigen, blokken = de `blocks` van de simulatie)

| | svelte-gantt | vis-timeline |
| --- | --- | --- |
| Opbouw, 50 tot 1.300 voertuigen | 190 tot 310 ms, ook bij 1.300 voertuigen en 17.234 blokken | 167 ms bij 50; 667 ms bij 225 (2.391 blokken); bij 1.300 geen uitslag binnen 180 s |
| Inzoomen naar 2 uur | 205 ms (225), 179 tot 286 ms (1.300) | 362 ms (225) |
| 50 blokken bijwerken bij 1.300 rijen | 400 ms met losse `updateTask`, 33 ms met `updateTasks` in een keer | |
| Elementen in de DOM | 515 tot 588, alleen wat in beeld is | 1.347 (50) en 2.922 (225) |
| Slepen tussen rijen met weigering | werkt: toetsen in `changed`, bij een botsing terugzetten | werkt: `onMove` met veto |
| Rit uit de pool op het bord slepen | werkt (`SvelteGanttExternal`) | niet geprobeerd |
| Toetsenbord en schermlezer | via `taskElementHook`: tabindex, naam en pijltjes voor 5 minuten werken. Uit zichzelf zijn alleen de kolomkoppen bereikbaar | geen focus op blokken, geen ARIA-rollen |

**Tabellen: Tabulator** (1.300 voertuigen, 14 kolommen, virtueel). Opbouw 58 ms. Sorteren 27 tot 45 ms. Filter
op status 11 ms, zoeken in een kopfilter 65 ms. Kolom verbergen 38 ms, alles selecteren 27 ms, 100 rijen
bijwerken 15 ms, csv 3 ms (69 KB). Bij 3.000 rijen bijna hetzelfde: opbouw 62 ms. 33 rijen in de DOM. ARIA:
`grid`, `rowgroup`, `row`, `columnheader`, `gridcell` en `aria-sort` op alle 14 koppen. Valkuil: kopfilters
breken met “Cannot read properties of undefined (reading 'editors')” als `EditModule` niet geregistreerd is.

**Zoeken: MiniSearch tegen Fuse.js** (5.350 items: voertuigen, opleggers, mensen, standplaatsen, plaatsen).
MiniSearch: index 82 ms, zoeken 0,1 tot 2,7 ms. Fuse: index 19 ms, zoeken 23 tot 61 ms. Tikfouten: “wognm” en
“geldermalsn” vinden Wognum en Geldermalsen; “kes vries” vindt Kees de Vries (Fuse zet drie andere De Vriezen
bovenaan). Kentekens: “67JQZ” en “67-JQZ” geven allebei T-1014. “lidl” geeft de standplaatsen die voor Lidl
rijden.

**Kaartlabels zonder glyph-server** (MapLibre 6.15, stijl zonder `glyphs`). 37 plaatsnamen en 31
standplaatsnamen in beeld, de rest weggelaten waar ze botsen, 354 ms tot de kaart stilstaat, geen verzoek naar
buiten.

**Spoor zonder deck.gl** (MapLibre `line-gradient` op `line-progress`, bron met `lineMetrics: true`). Gereden
stuk grijs, komend stuk blauw, de laatste minuten als groene lijn die vervaagt; het gekozen voertuig groter via
`feature-state`. Werkt, geen fouten.

**deck.gl op MapLibre 6.15**

- `MapboxOverlay` in de stand `interleaved`: bij elk beeld de paginafout “Cannot read properties of undefined
  (reading 'height')”, en niets getekend.
- `MapboxOverlay` erboven (niet interleaved): werkt. IconLayer met 1.276 voertuigen in beeld, aanklikken werkt.
- `MapLibreOverlay` uit `@deck.gl/maplibre`, interleaved: werkt voor `SimpleMeshLayer`.
- `ScenegraphLayer` met het Kenney-model: niets in beeld zolang `KHR_texture_transform` erin zat (luma.gl sloeg
  de textuur over). Na het weghalen wel: 40 voertuigen, aanklikken werkt. Met alle 1.300 kwam er in SwiftShader
  binnen 100 seconden geen beeld.
- `TripsLayer`: 2.784 ritsecties met 381.678 punten opgebouwd; de schermafbeelding van de hele dag liep vast.
- Grootte: 820,8 tot 1.190,0 KB extra, 26 tot 73 pakketten. Oordeel: de winst is echt, maar we hebben al
  MapLibre voor 1.300 punten en three.js voor 3D. deck.gl wordt een derde tekenmotor.

**3D-modellen.** Kenney-modellen in three.js gerenderd, 46 tot 62 ms laden per model. glTF-Transform maakt ze
kleiner: delivery van 234,6 naar 64,0 KB, building-q van 176,6 naar 86,2 KB, bomen van 5 tot 31 KB naar 3,5
tot 16,4 KB. Bomen als `InstancedMesh`: 24 populieren in 2 tekenopdrachten. Valkuil: na het kwantiseren staat de
terugschaling in de node, niet in de geometrie (de geometrie alleen is 2,0 hoog, de boom 1,69). Neem
`matrixWorld` van elke mesh mee in de matrix per exemplaar (bijlage 4.4). In de sitebuild gecontroleerd: een
model dat `scene3d.js` importeert met `?url`, komt als data-URL in `three.js`; een boom van 4,3 KB maakte
`three.js` 5,7 KB groter en `app.js` bleef gelijk.

**Herplannen in de browser (u-routing).** 60 winkelstops rond Wognum, vensters van een half uur, 25 minuten
lossen, tot 12 voertuigen: savings 10 ms, ALNS 231 ms, GA 246 ms. 9 tot 10 stops bleven over (de vensters waren
met opzet krap). Dat is snel genoeg voor een voorstel per standplaats. Wel: 597 KB WebAssembly en de JS-ingang
rekent met rechte lijnen, niet met ons wegennet.

**De app zelf (3.2).** In SwiftShader 2,2 beelden per seconde in 2D en 4 in 3D, klaar na 9,8 en 13,6 seconden,
257 en 326 MB geheugen, geen verzoek naar buiten. Alleen bruikbaar als nulpunt op dezelfde machine.

### 2.3 Patronen uit de platforms

| Uit | Patroon | Waar in onze app |
| --- | --- | --- |
| Fleetbase FleetOps (AGPL, alleen kijken) | Werkbank voor dispatch: ritten zonder voertuig links, middelen rechts, het plan in het midden met de tabs Routes en Tijdlijn, en “sleep ritten hierheen” | Planbord: pool onder het bord, voertuigen als rijen, wisselen tussen tijdlijn en kaart |
| | Kaartlade met tabs: voertuigen, chauffeurs, plaatsen, gebeurtenissen | Lade onder de kaart in plaats van vaste zijbalken |
| | Kaartje bij een marker, per soort (voertuig, chauffeur) | Hoverkaart (K5) |
| | Knop zonder recht blijft staan, uitgegrijsd, met de reden als tooltip | Rollen en “Bekijk als” |
| | Tijdlijn per order, replay van posities | Tijdlijn per zaak en rit (W2, D3) |
| Traccar web (Apache-2.0) | Bewegingsbalk: 24 uur rijden en stilstaan per voertuig in de lijst | Kolom in de tabel Voertuigen |
| | Markers met richting en titel als symboollaag, klik op cluster zoomt in | K4 (zonder clusters) |
| | Rapporten: ritten, stops, samenvatting, grafiek | Rapporten (E20, E22) |
| | Geofences en gebeurtenissen bij in- en uitrijden | “Op terrein” uit de terreincontour, wachttijd (E15) |
| Timefold quickstarts (Apache-2.0) | “Recommended fit”: voor een nieuwe stop de beste plekken met het verschil in score | W3: “Waar past deze rit?” |
| | Score-analyse: welke regel kost hoeveel | Uitleg bij elk voorstel (E16) |
| Odoo Fleet (LGPL-3, alleen kijken) | Statusbalk op het record, slimme knoppen met tellingen die een gefilterde lijst openen | Detailpagina's (I6) |
| | Logboek met berichten, activiteiten met een deadline | De zaak (W2) |
| | Kanban per status | Zaken per status als tweede weergave |

## 3. Plan per werkstroom

Volgorde over de stromen heen, het meeste effect eerst:

1. Data D1: diensten ijken. Zonder een realistische dag zijn planbord, zaken en kaart niet geloofwaardig.
2. Werking W1: toetsregels als pure functies. Planbord, voorstellen en zaken gebruiken ze alle drie.
3. Interface I1: planbord op svelte-gantt met slepen en pool.
4. Werking W2: meldingen worden zaken.
5. Kaart K1 en K2: labels als symboollagen, zoeken met MiniSearch.
6. Interface I2: tabellen op Tabulator.
7. 3D, stappen 3D1 tot 3D3: procedurele trekker en oplegger, bomen en hallen.
8. Daarna de rest per stroom, in de volgorde hieronder.

**Bundel.** Zet de nieuwe bibliotheken in een eigen chunk `lib.js` (in `manualChunks`: alles uit `node_modules`
behalve `maplibre-gl` en `three`). De code verandert vaak, de bibliotheken zelden; zo blijft een update klein,
zoals nu met `data.js`. Voeg `lib.js` dan toe aan de vaste lijst in `tools/sync-safetail.mjs` en aan
`tests/smoke/control-tower.spec.mjs` in de SafeTail-repo, die de app-bestanden nagaat.

| Bouwsteen | min | gzip | Waar |
| --- | --- | --- | --- |
| svelte-gantt | 92,7 KB | 30,4 KB | `lib.js` |
| Tabulator, 12 modules | 263,7 KB plus 28 KB css | 64,2 KB | `lib.js`, `app.css` |
| MiniSearch | 17,2 KB | 5,7 KB | `lib.js` |
| Floating UI | 16,3 KB | 6,6 KB | `lib.js` |
| uPlot | 50,8 KB plus 2 KB css | 22,7 KB | `lib.js`, `app.css` |
| `GLTFLoader` | 55,6 KB | 16,0 KB | `three.js` |
| Samen | 496,3 KB plus 30 KB css | 145,6 KB | |

### Data

| Stap | Wat | Klaar als |
| --- | --- | --- |
| D1 | Diensten ijken. Winkeldistributie 8,5 tot 11 uur, mediaan rond 9,5, rijden 45 tot 60 procent, start tussen 02:00 en 07:00. Een tweede dienst bij 25 tot 35 procent van de vloot (schatting op basis van Slimste voorstel 1), vooral dagrand en avond. Netwerk en bulk langer, met minder stops | Mediaan 9 tot 10 uur; om 10:00 minder dan een derde op het terrein (schatting); `verify.mjs` groen |
| D2 | Planners per standplaats: een per 15 tot 25 voertuigen (Slimste, schatting). Wognum krijgt er 9 tot 15, over vroeg, dag en avond | De Collega's-lijst en de eigenaren van zaken komen uit deze lijst |
| D3 | Gebeurtenissen per rit, deterministisch uit het plan: vertrek, aankomst, start en eind lossen, wachten, koppelen, laden. Een lijst per voertuig met tijd en plaats | Voedt de tijdlijn van een zaak (W2), het spoor (K3), de wachttijd (E15) en de touch rate (W4) |
| D4 | Wachttijd per DC en winkel: per adres en dagdeel een verdeling (schatting), per stop de minuten op locatie | Kolom en rapport “minuten op locatie” |
| D5 | Pool: per standplaats per dag 2 tot 5 procent ritten zonder voertuig (schatting), met klant, venster en duur. 's Middags komen de ritten voor morgen erbij (ritme uit Slimste “Planning”) | De pool onder het planbord is nooit leeg en nooit vol |
| D6 | Docks per standplaats en een dock per vertrek | Hal-scherm, planbord en 3D-terrein tonen hetzelfde dock |
| D7 | Datavorm voor het planbord vastleggen: rijen = voertuigen of docks; blokken = plansegmenten met `k`, `t0`, `t1`, klant, venster, vertraging; pool = ritten zonder rij | Zie de proef in bijlage 4.4 |

### Kaart

| Stap | Wat | Bouwsteen |
| --- | --- | --- |
| K1 | Plaatsnamen en standplaatsen als symboollaag zonder `glyphs`-URL: MapLibre 6 tekent de letters lokaal. Plaatsnamen op rang (`symbol-sort-key`), standplaatsen halfvet en gesorteerd op vlootgrootte. De HTML-markers kunnen weg | MapLibre, 0 KB |
| K2 | Zoeken op de kaart met de MiniSearch-index uit I3, dan `flyTo` in 600 tot 900 ms met de curve uit de brief | MiniSearch |
| K3 | Spoor van de gekozen rit: gereden grijs, komend blauw (Plan 1.2 scherm 3), de laatste 20 minuten als vervagende lijn | MapLibre `line-gradient` |
| K4 | Voertuigen in een symbool- of cirkellaag met `feature-state` voor hover en selectie, richting via `icon-rotate` (Traccar-patroon). Geen DOM-element per voertuig | MapLibre |
| K5 | Hoverkaartje bij een voertuig: status, chauffeur, volgende stop en ETA (Fleetbase-patroon), geplaatst zodat het bij de rand omklapt | Floating UI |
| K6 | Losse versie met OpenFreeMap-tegels en terugval op de ingebouwde kaart (brief) | Niet getest in deze ronde |

### 3D

| Stap | Wat |
| --- | --- |
| 3D1 | Trekker en oplegger procedureel: cabine, ruiten, spiegels, grille, wielen met velg; oplegger met deuren en onderrijbeveiliging. Er is geen CC0- of MIT-model van een Europese trekker met oplegger gevonden. Bouw elk onderdeel een keer en zet het neer als `InstancedMesh`. Bakwagen en bestelbus ook procedureel, in de verhouding 1 : 3,7 |
| 3D2 | Bomen: Kenney Nature Kit als `InstancedMesh` per soort, met `matrixWorld` per mesh (bijlage 4.4). Populier (`tree_tall`) langs wegen en sloten, `tree_default` en `tree_oak` op erven. Laden met `GLTFLoader` (+56 KB in `three.js`) |
| 3D3 | Hallen: Kenney City Kit Industrial als achtergrond rond standplaatsen en DC's, geschaald op de gebouwcontour. De eigen loods met docks blijft procedureel |
| 3D4 | Zet de stappen van `build-assets.mjs` als script in `tools/`, zodat elk nieuw model dezelfde stappen doorloopt (bijlage 4.4) |
| 3D5 | Importeer modellen alleen in `scene3d.js` met `?url`. Zo komen ze als data-URL in `three.js` en blijft de bestandslijst van de sitebuild gelijk |
| 3D6 | Meet beelden per seconde alleen op een echte GPU. De 60 per seconde uit de brief kon ik hier niet meten |

### Interface

| Stap | Wat | Bouwsteen |
| --- | --- | --- |
| I1 | Planbord achter een eigen `planbord.js`, zodat wisselen later een bestand is. Rijen: voertuigen van het werkgebied, of docks. Pool onder het bord. Slepen toetst met W1; bij een botsing zet de `changed`-handler het blok terug en zegt waarom. Toetsenbord via `taskElementHook`: tabindex, een naam voor de schermlezer en pijltjes voor 5 minuten (getest); een toets om een blok naar een andere rij te zetten bouwen we zelf. Werk de simulatie bij met `updateTasks` in een keer (33 ms tegen 400 ms). Eigen datumadapter, geen moment.js. De rode “nu”-lijn als `timeRanges` | svelte-gantt |
| I2 | Tabellen Voertuigen, Opleggers, Chauffeurs, Ritten en Zaken. Chips boven de tabel zetten `setFilter`; kolomkeuze via `column.toggle()`; selectie met bulkacties; csv. Nederlandse teksten via `langs` | Tabulator |
| I3 | Zoekpalet op MiniSearch: velden label, sub, trefwoorden en soort; `prefix: true`, `fuzzy: 0.2`, extra gewicht op label. Kenteken ook zonder streepjes in de trefwoorden. De paletweergave blijft, met de rollen `combobox` en `listbox` (WAI-ARIA) | MiniSearch |
| I4 | Zwevende lagen: hoverkaart, contextmenu op een rij of blok, popover bij een chip. Bevestigen met `<dialog>`. Meldingen (toast) met `aria-live="polite"` | Floating UI |
| I5 | Grafieken: dagprijs en laadvermogen per kwartier (Laden), op tijd per dag en wachttijd per DC (Rapporten) | uPlot |
| I6 | Detailpagina's voor voertuig, oplegger, persoon, rit en zaak: kop met naam en statusbalk, slimme knoppen met tellingen die een gefilterde lijst openen, tabs, onderaan het logboek (Odoo-patroon) | eigen code |

### Werking

| Stap | Wat |
| --- | --- |
| W1 | Toetsregels als pure functies in een eigen module, zonder DOM. Invoer: het plan van een voertuig en de wijziging. Uitvoer: `{ ok, regels: [{ regel, ernst, tekst }], effect: { teLaatMin, extraKm, rijtijdOverMin, accuBijTerugkomst } }`. Regels: overlap; tijdvenster; rijtijd en pauze volgens EU 561/2006 (na 4,5 uur rijden 45 minuten pauze, 9 uur rijden per dag en twee keer per week 10; nakijken in de verordening voor het in de app komt); rusttijd tussen diensten; accu en laadtijd (1,1 tot 1,15 kWh per km); oplegger beschikbaar; dock bezet |
| W2 | Zaken. Een zaak per afwijking, met een vaste sleutel uit soort, object en rit, zodat hij na herladen dezelfde is. Velden: soort, ernst, object, standplaats, eigenaar, status (nieuw, in behandeling, wacht op, opgelost), deadline, tijdlijn, voorstellen. Opslaan in `localStorage` onder een `sl-`-sleutel per dag, zoals `sl-acties` nu. Lijst als tabel (I2) en als kanban per status |
| W3 | Voorstellen met uitleg (Timefold-patroon). “Waar past deze rit?” zet de kandidaten op volgorde met het effect per regel uit W1: minuten te laat, extra kilometers, rijtijd over, accu bij terugkomst. Een klik voert uit, schrijft in de tijdlijn en stuurt het bericht aan de chauffeur |
| W4 | Tellen wat de planner doet: wijzigingen per planner en dag, uit het logboek. Dat is de touch rate uit Slimste en de nulmeting van een pilot |
| W5 | Later: herplannen in de browser met u-routing (ALNS) per standplaats. Vraagt eerst reistijden uit het eigen wegennet |

## 4. Bijlage

### 4.1 Links

Repo's staan bij de tabellen in 2.1. Verder:

- WAI-ARIA-patronen: [grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), [combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Kenney: [kenney.nl](https://kenney.nl); de gebruikte spiegel: [series-ai/jam-ready-assets](https://github.com/series-ai/jam-ready-assets) (commit `2d7c410`)
- Timefold vehicle-routing, de twee bestanden met de patronen: `use-cases/vehicle-routing/src/main/resources/META-INF/resources/recommended-fit.js` en `score-analysis.js`
- Traccar web: `src/main/MotionController.jsx` (bewegingsbalk), `src/map/MapMarkers.js` (markers met richting en titel), `src/other/ReplayPage.jsx`
- Fleetbase FleetOps: `addon/components/orchestrator-workbench.hbs`, `orchestrator/order-pool.hbs`, `orchestrator/plan-viewer.hbs`, `map/drawer.hbs`, `map/toolbar.hbs` (knoppen per recht)
- Odoo: `addons/fleet/views/fleet_vehicle_views.xml` (statusbar, statinfo, chatter, activity)
- Wagenpark-onderzoek over RDW-data en wagenparksystemen: artifact `SJkFYtoWtFm5Wx3T1uBaUx`

### 4.2 Bestanden in `assets-3d/`

Alle CC0 1.0, licentietekst per map in `License.txt`. Driehoeken: wat in het bestand staat; bij de voertuigen
worden de wielen herhaald, in beeld zijn het er meer.

| Pad | Bytes | Driehoeken |
| --- | --- | --- |
| `kenney-car-kit/delivery.glb` | 65.488 | 1.620 (2.476 in beeld) |
| `kenney-car-kit/van.glb` | 62.412 | 1.418 (2.082 in beeld) |
| `kenney-nature-kit/tree_default.glb` | 5.480 | 114 |
| `kenney-nature-kit/tree_oak.glb` | 8.100 | 196 |
| `kenney-nature-kit/tree_detailed.glb` | 16.840 | 402 |
| `kenney-nature-kit/tree_fat.glb` | 3.548 | 50 |
| `kenney-nature-kit/tree_tall.glb` | 4.256 | 72 |
| `kenney-nature-kit/tree_cone.glb` | 6.220 | 132 |
| `kenney-nature-kit/tree_simple.glb` | 4.004 | 62 |
| `kenney-nature-kit/tree_small.glb` | 4.008 | 62 |
| `kenney-nature-kit/tree_pineTallA.glb` | 4.396 | 78 |
| `kenney-nature-kit/tree_plateau.glb` | 8.960 | 215 |
| `kenney-city-kit-industrial/building-e.glb` | 66.600 | 1.484 |
| `kenney-city-kit-industrial/building-h.glb` | 38.912 | 698 |
| `kenney-city-kit-industrial/building-i.glb` | 42.680 | 798 |
| `kenney-city-kit-industrial/building-k.glb` | 39.232 | 702 |
| `kenney-city-kit-industrial/building-m.glb` | 72.012 | 1.706 |
| `kenney-city-kit-industrial/building-p.glb` | 56.144 | 1.162 |
| `kenney-city-kit-industrial/building-q.glb` | 88.220 | 2.062 |
| `kenney-city-kit-industrial/building-s.glb` | 45.308 | 876 |
| `kenney-city-kit-industrial/chimney-large.glb` | 20.292 | 212 |
| `kenney-city-kit-industrial/detail-tank.glb` | 21.268 | 236 |
| `*/voorbeeld.png` (drie stuks) | 362.864 samen | |

Samen 684.380 bytes aan modellen; de map is 1,0 MB. Meer in `assets-3d/README.md`.

### 4.3 Proeven in de scratchpad

De paden zijn relatief aan de scratchpad van deze sessie: een tijdelijke map onder `/tmp`, het volledige pad
staat in het rapport van deze onderzoeksronde. Omdat de map tijdelijk is, staat de kern van elke proef ook in
4.4. De proefpagina's draaien op de eigen statische server (`lab/serve.mjs`, poort 8765) en laden de bibliotheken
uit `lab/node_modules`.

| Proef | Bestanden |
| --- | --- |
| Server en meetgereedschap | `lab/serve.mjs`, `lab/shot.mjs` (schermafbeelding plus uitslag), `lab/measure.mjs` met `lab/entries/` en `lab/sizes.json` (bundelgroottes) |
| Simulatie naar JSON | `lab/export-entry.js`, uitvoer in `lab/data/` (voertuigen, opleggers, mensen, plaatsen) |
| Planbord | `lab/pages/sg-planbord.js` en `.html` (svelte-gantt, `?n=50`, `225` of `1300`), `lab/pages/vis-planbord.js` en `.html`, `lab/interact-sg.mjs`, `lab/interact-vis.mjs` |
| Tabel | `lab/pages/tab-voertuigen.js` en `.html` (`?n=1300` of `3000`) |
| Zoeken | `lab/pages/zoek.js` en `.html`, `lab/interact-zoek.mjs` |
| Kaartlabels | `lab/pages/labels.html` |
| Spoor | `lab/pages/spoor.html` |
| deck.gl | `lab/pages/deck-voertuigen.js` en `.html` (`?mode=icon`, `scenegraph`, `trips` of `mesh`; `&pkg=maplibre`, `&inter=0`, `&n=`, `&model=`) |
| 3D | `lab/render/index.html` (modellen beoordelen), `lab/render/instanced.html` (bomen als `InstancedMesh`), `lab/build-assets.mjs`, `lab/check-tt.mjs`, `lab/check-attr.mjs` |
| Inlining in de sitebuild | `vitecheck/` (kopie van de demo met een boom in `scene3d.js`) |
| Herplannen | `lab/vrp-proef.mjs` |
| De app en toegankelijkheid | `lab/appbench.mjs`, `lab/a11y-check.mjs` |
| Schermafbeeldingen | `shots/`, onder meer `sg-planbord-pool.png`, `tabulator-1300.png`, `labels-lokaal.png`, `spoor.png`, `bomen-instanced.png`, `deck-scenegraph-n40.png` |

### 4.4 Codevoorbeelden uit de proeven

Planbord met svelte-gantt: toetsen na het loslaten, pool, toetsenbord, bijwerken in een keer.

```js
import { SvelteGantt, SvelteGanttTable, SvelteGanttExternal } from 'svelte-gantt';
const MIN = 60000, UUR = 3600000;
const gantt = new SvelteGantt({ target: el, props: {
  rows,   // [{ id: 'T-1002', label: 'T-1002', enableDragging: true }]
  tasks,  // [{ id, resourceId, from, to, label, classes: 'k-drive', enableDragging: true, enableResize: false }]
  from: dag + 4 * UUR, to: dag + 24 * UUR, rowHeight: 32, rowPadding: 4, magnetUnit: 'minute', magnetOffset: 5,
  headers: [{ unit: 'hour', format: 'HH:mm' }], ganttTableModules: [SvelteGanttTable], tableWidth: 240,
  tableHeaders: [{ title: 'Voertuig', property: 'label', width: 80, type: 'tree' }],
  // eigen datumadapter: alleen uren en minuten, geen moment.js
  dateAdapter: { format: ms => hhmm(ms), roundTo: (ms, unit, n) => { const s = (unit === 'hour' ? UUR : MIN) * n; return Math.round(ms / s) * s; } },
  timeRanges: [{ id: 'nu', from: nu, to: nu + MIN, classes: 'nu', resizable: false }],
  taskElementHook: (node, task) => {
    const m = task.model || task;
    node.tabIndex = 0; node.setAttribute('role', 'button'); node.setAttribute('aria-label', `${m.label}, ${hhmm(m.from)} tot ${hhmm(m.to)}`);
    const opToets = e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault();
      const d = (e.key === 'ArrowRight' ? 5 : -5) * MIN; const nieuw = { ...m, from: m.from + d, to: m.to + d };
      if (toets(nieuw, m.resourceId).ok) { gantt.updateTask(nieuw); Object.assign(m, nieuw); } };
    node.addEventListener('keydown', opToets);
    return { destroy() { node.removeEventListener('keydown', opToets); } };
  },
} });
// svelte-gantt kent geen weigering vooraf: toets na het loslaten en zet zo nodig terug. Argumenten komen als array.
gantt.api.tasks.on.changed(([{ task, sourceRow, targetRow, previousState }]) => {
  const uitslag = toets(task.model, targetRow.model.id);
  if (!uitslag.ok) gantt.updateTask({ ...task.model, resourceId: sourceRow.model.id,
    from: previousState ? previousState.from : task.model.from, to: previousState ? previousState.to : task.model.to });
});
// Pool: een kaartje onder het bord wordt sleepbaar naar een rij.
new SvelteGanttExternal(kaartje, { gantt, enabled: true, dragging: false, elementContent: () => kopie,
  onsuccess: (row, date) => { const t = { id: rit.id, resourceId: row.model.id, from: date, to: date + rit.min * MIN, label: rit.label };
    if (toets(t, row.model.id).ok) gantt.updateTask(t); } });
// Simulatie bijwerken: altijd in een keer (33 ms tegen 400 ms voor 50 blokken bij 1.300 rijen).
gantt.updateTasks(gewijzigdeBlokken);
```

Tabulator met kopfilters:

```js
import { Tabulator, EditModule, SortModule, FilterModule, FormatModule, SelectRowModule, DownloadModule, ExportModule,
  ResizeColumnsModule, MoveColumnsModule, KeybindingsModule, InteractionModule, PersistenceModule } from 'tabulator-tables';
// EditModule is nodig voor kopfilters, ook als niets bewerkbaar is
Tabulator.registerModule([EditModule, SortModule, FilterModule, FormatModule, SelectRowModule, DownloadModule, ExportModule,
  ResizeColumnsModule, MoveColumnsModule, KeybindingsModule, InteractionModule, PersistenceModule]);
const tabel = new Tabulator(el, { data, index: 'id', height: 640, rowHeight: 36, renderVertical: 'virtual', layout: 'fitColumns',
  selectableRows: true, movableColumns: true, columns,
  placeholder: 'Geen voertuigen binnen dit filter. Pas de chips of het zoekveld aan.' });
tabel.setFilter('st', '=', 'vertraagd');    // een chip
tabel.download('csv', 'voertuigen.csv');   // werkt in de losse versie, niet in de artifact-viewer
```

MiniSearch voor het zoekpalet:

```js
import MiniSearch from 'minisearch';
const zoek = new MiniSearch({
  fields: ['label', 'sub', 'kw', 'type'], storeFields: ['type', 'label', 'sub'],
  tokenize: s => s.toLowerCase().split(/[\s·,\/]+/).filter(Boolean),
  searchOptions: { prefix: true, fuzzy: 0.2, boost: { label: 3, kw: 2 }, combineWith: 'AND' },
});
// kw: trefwoorden, ook het kenteken zonder streepjes ('67JQZ8') en de klanten van een standplaats ('lidl')
zoek.addAll(items);
const treffers = zoek.search(invoer).slice(0, 14);
```

Labels zonder glyph-server (de stijl heeft geen `glyphs`):

```js
map.addLayer({ id: 'plaatsen', type: 'symbol', source: 'plaatsen', layout: {
  'text-field': ['get', 'n'], 'text-font': ['Inter', 'system-ui'],
  'text-size': ['match', ['get', 'r'], 1, 15, 2, 13, 11], 'symbol-sort-key': ['get', 'r'], 'text-padding': 4 },
  paint: { 'text-color': '#5F6775', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4 } });
map.addLayer({ id: 'standplaatsen-label', type: 'symbol', source: 'sp', layout: {
  'text-field': ['get', 'n'], 'text-font': ['Inter Semibold', 'system-ui'], 'text-size': 12.5,
  'text-anchor': 'left', 'text-offset': [0.8, 0], 'symbol-sort-key': ['-', 0, ['get', 'fleet']] },
  paint: { 'text-color': '#15181E', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 } });
```

Vervagend spoor en selectie zonder deck.gl:

```js
map.addSource('spoor', { type: 'geojson', lineMetrics: true, data: laatsteMinuten });
map.addLayer({ id: 'spoor', type: 'line', source: 'spoor', layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-width': 6, 'line-gradient': ['interpolate', ['linear'], ['line-progress'],
    0, 'rgba(22,163,74,0)', 1, 'rgba(22,163,74,0.95)'] } });
// voertuigen: bron met promoteId, grootte uit feature-state
map.setFeatureState({ source: 'voertuigen', id: 'T-1002' }, { gekozen: true });
```

Bomen als `InstancedMesh` (gekwantiseerde modellen):

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import populierUrl from '../assets-3d/kenney-nature-kit/tree_tall.glb?url';
const gltf = await new GLTFLoader().loadAsync(populierUrl);
gltf.scene.updateMatrixWorld(true);
const delen = []; gltf.scene.traverse(o => { if (o.isMesh) delen.push(o); });   // blad en stam
const lagen = delen.map(m => new THREE.InstancedMesh(m.geometry, m.material, aantal));
const plek = new THREE.Matrix4(), m4 = new THREE.Matrix4();
plaatsen.forEach((p, i) => {
  plek.compose(p.positie, p.draaiing, p.schaal);
  // na quantize() staat de terugschaling in de node: matrixWorld meenemen
  lagen.forEach((im, k) => im.setMatrixAt(i, m4.multiplyMatrices(plek, delen[k].matrixWorld)));
});
lagen.forEach(im => { im.instanceMatrix.needsUpdate = true; im.castShadow = im.receiveShadow = true; scene.add(im); });
```

Een model klaarzetten met glTF-Transform (zoals `assets-3d/`):

```js
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, unpartition } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const doc = await io.read(bron);   // leest ook de losse textuur en bedt hem in
await doc.transform(dedup(), weld(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), unpartition());
// KHR_texture_transform weghalen als elke transformatie een identiteit is; ongebruikte extensies opruimen
await io.write(doel, doc);
```

### 4.5 Wat niet lukte, en waarom

- kenney.nl, poly.pizza en quaternius.com gaven 403 vanuit de onderzoeksomgeving. Kenney kwam via een
  GitHub-spiegel. Quaternius heb ik niet kunnen bekijken.
- De GitHub-API was niet bereikbaar. Licenties en datums komen uit npm, uit de klonen zelf en uit de zoekfunctie
  van GitHub.
- Geen echte GPU. Alle beeldsnelheden komen uit SwiftShader; de 60 beelden per seconde uit de brief kon ik niet
  meten.
- deck.gl: `MapboxOverlay` interleaved werkt niet met MapLibre 6. De `ScenegraphLayer` met 1.300 voertuigen en de
  `TripsLayer` over de hele dag gaven in SwiftShader geen beeld binnen de tijd.
- CesiumMilkTruck: de proef bleef hangen. De licentie sluit hem toch uit.
- vis-timeline met 1.300 rijen: geen uitslag binnen 180 seconden.
- Niet getest: SVAR Gantt (vraagt een Svelte-build), frappe-gantt in de browser (alleen gemeten), OpenFreeMap-tegels
  (extern, en in de ingebedde versie niet toegestaan), kepler.gl (React en Redux), VROOM, Timefold en PyVRP als
  rekenmachine (servers; van Timefold alleen de interface gelezen), OpenBoxes.
- Geen CC0- of MIT-model van een Europese trekker met oplegger gevonden. Gekeken in Kenney Car Kit (speelgoedmaat,
  geen oplegger), KayKit City Builder Bits (personenauto's), de glTF-voorbeelden van Khronos (CC-BY) en
  ir-engine-assets-basic (CPAL).
