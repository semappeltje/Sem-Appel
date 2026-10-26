# Simon Loos Control Tower (demo, versie 4.0)

Werkende demo van een control tower voor Simon Loos: 1.300 gesimuleerde voertuigen
(trekkers, bakwagens en bestelbussen) en 1.700 opleggers die over het **echte wegennet**
rijden, op een kaart die zonder internet werkt. Versie 2.0 was het ontwerp uit het
document "Control Tower 2.0: ontwerpvoorstellen, rollen en mockups": een rustige
interface met een iconenbalk, een werkgebied per gebruiker, rollen, record-pagina's,
laadplanning, lostijden, pauzeplekken, een hal-scherm en een deelbare klant-link.

Versie 3.0 maakt het model echt: chauffeurs hebben **geen vaste wagen** maar een dienst
(een voertuig rijdt op een dag een of twee diensten met verschillende chauffeurs),
**trekkers en opleggers staan los van elkaar** (koppelen op het terrein, wisselen bij een
winkel of DC, afkoppelen na de rit; meer opleggers dan trekkers, zodat laden en lossen
los staan van het rijden) en de kaart tekent **voertuigen met hun rijrichting** in plaats
van clusterbollen. Nieuw zijn de weergave Opleggers (status per oplegger: gekoppeld,
klaar voor vertrek, geladen bij een klant, wacht op ophalen, leeg op het terrein,
onderhoud), het opleggerpaneel en de opleggerpagina's, en meldingen en voorstellen
voor opleggers die te lang bij een klant staan.

Versie 3.1 (ronde 4) is een ontwerp- en werkingsronde na Sems review ("snoeilelijk, te
druk, werkt niet"). Ontwerp: een ontwerpsysteem in de stylesheet (tokens voor licht en
donker, typografische schaal met tabulaire cijfers, 8-puntsraster), een rustige basiskaart
(grijs land, zacht water, wegen als dunne lijnen), voertuigsilhouetten met rijrichting,
standplaatsen als rode ruiten met naam, minder drukke weergaven (drie kerngetallen in het
meldingenpaneel, vier tegels bij Opleggers, kortere assistentkaarten met "Waarom"
uitklapbaar, rustige koppen op de pagina's, minder kolommen standaard) en een mobiele
opzet op 390 px (onderbalk met "Meer", voertuigkaartje als onderste blad, lijstrijen in
plaats van tabellen). Werking: "Pas toe" in de Assistent past het plan echt aan (pauze op
een pauzeplek, laadblok, omrijroute om een oplegger op te halen, dienst opschuiven,
werkorder met reservevoertuig), elke weergave, elk voertuig, elke oplegger, persoon en
standplaats heeft een URL (`#voertuig/T-1002`, `#oplegger/O-5150`, `#standplaats/Wognum`, sinds de eindcontrole ook
`#plaats/Purmerend` en `#route/P-9016` voor een plaats of een open rit op de kaart; Esc wist ze)
en de terugknop werkt, meldingen kunnen op "later" (30 of 60 min) en blijven na een herlaad
staan (localStorage `sl-acties`, samen met toegepaste voorstellen en berichten), het
opleggerpaneel heeft een tijdlijn en "Toon op kaart", een klik op een standplaats opent
het standplaatspaneel, het planbord heeft filters, klik-op-blok en een meelopende nu-lijn,
het hal-scherm telt af per rij en het zoekpalet vindt ook opleggers, kentekens, werkorders
en standplaatsen.

Versie 4.0 (oktober 2026) is een nieuwe interface volgens `ONTWERP-4.md`, naar het voorbeeld van de grote
control towers (Simacan, Samsara, Shippeo, project44, Descartes). Een linkermenu in vier groepen dat je inklapt
tot iconen, een topbalk met zoeken, werkgebied, rol, de klok van de simulatie, assistent, meldingen, thema en je
naam, en op een telefoon een onderbalk. Nieuw zijn het Overzicht als startscherm, Ritten (elke route van elke
dienst is een rit met een vast nummer en een eigen pagina), Meldingen als zaken (vaste sleutel, eigenaar, deadline
en de statussen nieuw, in behandeling, wacht op en opgelost; als lijst of als bord), een planbord waarop je ritten
versleept en elke wijziging eerst getoetst wordt (overlap, tijdvenster, rij- en rusttijd, accu, oplegger, dock),
de bak "Open ritten" met de ritten uit de pool, detailpagina's met een statusbalk, slimme knoppen met tellers,
tabbladen en een logboek, Rapporten en Instellingen. Elke weergave, rit, zaak, voertuig, oplegger, chauffeur en
standplaats heeft een eigen adres (`#rit/R-10213`, `#melding/V-T-1112-R-10448`), de terugknop werkt en wat je doet
blijft na een herlaad staan. Een ontwerpsysteem in `src/style.css`: tokens voor licht en donker, een typeschaal met
tabulaire cijfers, een raster van 8 punten, zichtbare focusringen en minder beweging als je systeem dat vraagt (de
keyframes staan buiten de geneste regel `.slct`: daarbinnen negeerde de browser ze en liep tot 26 oktober geen enkele
animatie van menu, dialoog, melding of laadbalk). In
dezelfde ronde kwamen de echte plekken en de geijkte dag (zie "Wat echt is en wat niet"), de kaart en de
3D-wereld (zie daar).

Later in 4.0 kwam de vraagkant van de planning erbij (Sem: "je ziet de planning vanuit chauffeursperspectief, maar
niet de ritten die moeten worden ingevuld"). **Open ritten** is het vertrekpunt: wat staat er open, hoe groot is de
kans dat het rond komt en op tijd weg is, wat doe je nu, en wie kan het rijden (eigen chauffeurs, oproepkrachten en
zzp'ers, charters), met de kans op een ja, redenen en kosten. Toewijzen is een klik; de rit staat gearceerd op het
planbord tot iemand ja zegt. **Charters en oproepkrachten** is de flexibele schil zelf, met een pagina per charter en
per persoon; de chauffeurspagina heeft voorkeuren en tevredenheid, het planbord een stille markering als een dienst
slecht past, en de rapporten de invulling per week en de roosterfit per standplaats. Het planbord gaat door de tijd
(gisteren, vandaag, morgen, zoom van 2 tot 24 uur, gepland tegen gereden), tabellen hebben filtermenu's met chips en
opgeslagen weergaven, en de Assistent kan de Claude API gebruiken als de pagina dat aanzet (zie "Vraagkant" en
"Assistent met de Claude API").

Voor de eindcontrole van 4.0 (de acceptatie-eisen in `rapporten/simon-loos-control-tower/acceptatie-4.0.md`) kwamen
er nog bij: de **briefing** bovenaan het overzicht (wat er speelt, wat open staat, waar het risico zit, wat je moet
beslissen, elke regel naar de zaak of de rit), op de ritpagina **waar een vertraging ontstond** met het voorstel en
het effect in minuten, **zoeken** dat een voertuig, oplegger of chauffeur als pagina opent met de kaart die erheen
vliegt, en **herladen** dat ook het zoekwoord, de filters en de sortering van elke tabel en de statusfilter van de
kaart terugzet. De basiskaart kies je onder Kaartlagen (vier standen in de losse versie). Zonder eigen keuze opent de
losse versie met de ingebouwde kaart en de demosite (`dist/demosite.html`) met OpenStreetMap; de bezorgbussen zet je
onder Kaartlagen aan of uit (toets b), alleen op de kaart: in lijsten en tellers tellen ze mee.

Artifact: https://claude.ai/artifact/S2ni36VcHix21CuMkWUnqF (versie 1.2 staat op
https://claude.ai/artifact/GTELKsXiif8zP4SsijvTUN).

## Wat erin zit

| Onderdeel | Waar | Wat het doet |
| --- | --- | --- |
| Indeling | linkermenu, topbalk; op een telefoon de onderbalk | Vier groepen: Overzicht, Kaart, Ritten, Meldingen, Open ritten, Planbord en Vrijgeven; Vloot (Voertuigen, Opleggers, Chauffeurs, Charters en oproepkrachten); Locaties (Standplaatsen, Laden, Lostijden, Pauzeplekken); Analyse (Rapporten, Instellingen). Inklappen met `[` of de knop onderaan (bewaard); tussen 761 en 1100 px breed (een tablet, een smal venster) klapt het menu vanzelf in, zoals Gmail en Linear, tot je het daar zelf uitklapt (ook die keuze blijft). Op 390 px een onderbalk met Overzicht, Kaart, Open ritten, Meldingen en Meer. Vanuit een detailpagina ga je met de balk direct naar een ander onderdeel; de terugknop van de browser en Terug brengen je terug met hetzelfde zoekwoord, filter en dezelfde scrollpositie, ook na een adres dat je zelf intypte. Een pagina die je opent terwijl het paneel open is (vanuit dat paneel, zoeken, de bel, de Assistent of het adres) ligt boven het paneel; het paneel wacht eronder en is er na Terug weer zoals je het liet, met de focus op de knop waarmee je de pagina opende. Een Assistent die je boven een pagina opent, ligt bovenop; Esc sluit hem eerst. Esc sluit een menu ook als de focus er niet in staat, en de focus gaat daarna terug naar de knop die het opende |
| Werkgebied en rol | de eerste keer, daarna in de topbalk | Drie stappen: regio's, divisies, rol en standplaats; bewaard in de browser. Planner, regiomanager, directie en HR zien elk hun deel; alleen wie mag handelen ziet de knoppen. Rijgedrag per chauffeur zien alleen directie en HR, voor coaching en alleen met instemming van de OR; de regiomanager ziet het niet. De topbalk past altijd en breekt niets half af. Eerst geeft rechts mee, tegen een vaste ruimte voor de titel die alleen van de breedte afhangt, zodat de knoppen niet verspringen als je van weergave wisselt: een smaller zoekveld met een kortere tekst, het label van de rol, de snelheid bij de klok, het label van het werkgebied, het woord bij de chip van de oefendag, het kleinste zoekveld, en als allerlaatste de knoppen van werkgebied en rol (beide staan ook in het gebruikersmenu; nodig als iemand het menu op een tablet zelf uitklapt). Dan de titel zelf (de korte ondertitel, de korte titel), en als het dan nog niet past de rest van rechts. Na elke ronde gaat een stap terug die een latere overbodig maakte; de andere knoppen houden hun icoon, de uitleg staat in de tooltip en in aria-label. Pas daarna breekt een lange titel af met een ellips: dat gebeurt alleen als iemand het menu op een tablet (768 px) zelf uitklapt, en dan wijkt alleen de titel. Op de oefendag staat de chip er altijd |
| Overzicht | startscherm, toets 1 | Bovenaan de briefing (de ochtendbriefing tot 11:00): hooguit vijf regels in de volgorde van een overdracht, wat er speelt (de grootste vertraging; onderweg en vertraagd zoals de filterbalk van de kaart ze telt: onderweg rijdt volgens plan, vertraagd rijdt achter op plan, en een vertraagd voertuig dat toch binnen zijn venster komt, is geen zaak: "Niemand komt na zijn venster"), wat open staat (de dringendste open rit, wat op een ja wacht), waar het risico zit (de dringendste andere zaak, of de open rit met de kleinste kans op tijd), wat je moet beslissen (voorstellen, zaken zonder eigenaar) en de overdracht van de vorige dienst als die er is; elke regel opent de zaak of de rit. Met `data-ai` schrijft de Assistent hem op een klik. Daaronder drie cijfers (op tijd, met eronder de stops na het tijdvenster en de gemiste ritten van vandaag als die er zijn; vertraagd; open ritten), wat nu aandacht nodig heeft (open zaken op urgentie, met een snelle actie), de vertrekken van het komende uur, de dag in een regel (`fleet.dagcijfers`) met de open ritten, en de recente gebeurtenissen |
| Kaart | toets 2 | Voertuigen in hun statuskleur met rijrichting (nooit clusters), een filterbalk (hooguit drie getallen in beeld; onderweg, vertraagd en bij klant tonen hun zin uit de begrippenlijst bij aanwijzen en bij focus), losse opleggers, kaartlagen (in de losse versie vier basiskaarten: ingebouwd, OpenStreetMap, luchtfoto en topografisch; verder losse opleggers, bezorgbussen, pauzeplekken en gedimde standplaatsen), de 3D-wereld en de tijdbalk. Tegenliggers rijden rechts op hun eigen rijbaan, wegen staan vanaf zoom 16 op ware breedte en de afdelingen op het terrein vanaf zoom 16; rechts het paneel van een voertuig, oplegger, standplaats, pauzeplek, winkel of DC. Het kaartje bij aanwijzen (beeld, kenteken, chauffeur, volgende stop) rijdt mee met het voertuig (`mapApi.anchor`); een klik laat de kaart staan als het voertuig al in beeld is; volgen (f) doet de kaart zelf (`mapApi.follow`) |
| 3D-wereld | knop met de kubus op de kaart, of toets d | De kaart kantelt naar een wereld op ware grootte: trekkers met opleggers, bakwagens en bussen op koers, geparkeerd op hun plek in de rijen; de standplaatsen op hun echte terrein met de hal uit de gebouwgegevens, genummerde docks, poort, lichtmasten en de buurt eromheen; bij een klant achteruit tegen een dock; het licht volgt de klok van de simulatie (dag, schemer, nacht), met schaduw; naamborden van de afdelingen; volgen (toets f) zet de camera schuin achter het voertuig; klik en aanwijzen werken als op de platte kaart |
| Ritten | toets 3, `#ritten`, `#rit/<id>` | Alle ritten van de dag (ruim 3.200) met status, ETA en afwijking. De ritpagina: statusbalk (gepland, onderweg, bij klant, afgerond), slimme knoppen, drie cijfers, waar de vertraging ontstond (het stuk rijden met de vertraging, de aankomst tegen het venster en het voorstel van de assistent met het effect in minuten en Pas toe), de mijlpalen gepland naast werkelijk (met wachten en lossen per stop), berichten aan de chauffeur, "Verplaats deze rit" (naar het planbord) en "Waar past hij?". De dag van een voertuig loopt van zijn eerste dienst tot 24 uur later: voor die eerste dienst (de vroege ochtend) staat elke rit van vandaag op gepland en is hij te verplaatsen, ook een nachtrit die het voertuig vannacht voor gisteren al reed; een nachtrit van gisteren die het voertuig nu nog rijdt, staat als onderweg (`R.stateOf`, gecontroleerd in `tests/ochtend-check.mjs`) |
| Meldingen | toets 4 of m, `#melding/<id>` | Elke uitzondering is een zaak met een vaste sleutel uit soort, voertuig en rit, een eigenaar (de planners van de standplaats) en een deadline per soort. Statussen nieuw, in behandeling, wacht op (chauffeur, klant, garage of collega; na de wachttijd komt hij vanzelf terug) en opgelost. Als lijst of als bord per status (slepen, of Alt met een pijltje). De zaakpagina: statusbalk, slimme knoppen, voorstellen met uitleg en effect, een logboek met wat het voertuig deed (`fleet.eventsOf`), notities en "Verplaats deze rit"; per pagina één hoofdknop (het voorstel, anders de eerste plek elders, anders Verplaats). Een zaak die vanzelf sloot zonder eigenaar, staat als "Vanzelf opgelost" met eigenaar Systeem. Een dockzaak (oefendag) hoort bij de rit van het dockblok, dus één zaak per wissel, en sluit pas als de chauffeur het bericht met het nieuwe dock kreeg: dat de wagen het andere dock gebruikte, bewijst niet dat de chauffeur het wist. Een open rit van vandaag die niemand rijdt, is één zaak "Rit niet ingevuld" (`N:P-8001`) in drie fasen: een half uur voor het laatste belmoment (tot wanneer haalt nog iemand het venster) "uiterlijk 06:50 iemand vragen", met dat moment als deadline en als hoofdknop wie het venster haalt (de grootste kans op een ja); na het belmoment "niemand haalt het venster meer"; na het venster gemist. Haalde niemand het venster al toen de rit bekend werd, dan is er meteen een zaak. Met de klant en de keuzes: wie het venster haalt, alsnog een charter (vertrek, kans op een ja en kosten als schatting), morgen als eerste (laden morgen vanaf 04:00), de klant bellen (demo) of het bericht kopiëren, en alle kandidaten. Is er geen charter vrij, dan zegt de pagina dat; het bericht aan de klant volgt wie er nog vrij is (een andere wagen zoeken, of meteen morgen als eerste voorstellen) |
| Open ritten | toets 5, `#openritten`, `#openritten/<id>` | De ritten zonder voertuig of chauffeur (`fleet.poolAt`), vandaag en morgen, op urgentie, met reden en de kans op invulling; het belmoment ("uiterlijk vragen 05:40") staat in elke rij heel, de reden en de naam lopen door op een tweede regel als het krap is. Een rit uitgeklapt: de kans op invulling en de kans op tijd met de uitleg en het advies in een zin (`fleet.prognose`), en de kandidaten in drie groepen (`fleet.kandidaten`): eigen chauffeurs, oproepkrachten en zzp'ers, charters, elk met de kans op een ja, de redenen, de voorkeur, waarschuwingen (rijtijd, rust, uren, voertuig) en de kosten (schatting); een aanbevolen knop. "Vraag tegelijk uit" vraagt de kleinste groep die samen negen op de tien kans op een ja geeft. Toewijzen (`fleet.wijsToe`) zet de rit gearceerd op het planbord met het bericht erbij; "Ja, bevestigd" of "Kan niet". Bellen belt niet in de demo (de knop toont het gesimuleerde nummer), Mail opent een mail met de rit; wie gebeld of gevraagd is, staat in het logboek en blijft na herladen bewaard. Elke open rit van vandaag toont het laatste belmoment: "uiterlijk vragen 06:50", daarna haalt niemand het venster nog (`invulling.belmoment`, zie "Het laatste belmoment"); rood vanaf een half uur ervoor, op de rij, in de uitgeklapte rit en op de kaart in de bak van het planbord. Een collega vult een rit op het laatst in, in het kwartier voordat hij een zaak zou worden (gesimuleerd, zo vaak als de kans op invulling zegt; de groep "Door een collega ingevuld", met het moment). Wat niemand invult, zegt na het belmoment "niemand haalt het venster meer" (de keuzes van een gemiste rit, zonder prognose) en staat na het venster onder "Gemist vandaag" met de keuzes van de zaak "Rit niet ingevuld"; hij telt als gemist naast Op tijd (`metrics.sample(...).gemist`) en in de ondertitel van Open ritten ("3 open vandaag · 1 gemist · 2 morgen"). Morgen als eerste zet hem bij de open ritten van morgen; vandaag blijft hij gemist |
| Planbord | toets 6, `#planbord/<rit>` | Een werkbalk op een regel: standplaats, rijen per voertuig, chauffeur of dock, Filters, zoeken, Gisteren, Vandaag en Morgen, Vroeger, Later en Nu, zoom (2, 6, 12 of 24 uur) en de legenda. De hele dag staat in het bord: slepen of Shift met het wiel schuift door de tijd, Ctrl met het wiel of knijpen zoomt, en het beeld blijft staan als de simulatie verder loopt. Een klik op de tijdas zet de replay op dat tijdstip en het bord volgt de replay ("Terug naar de echte klok" zet hem terug). Gepland tegen gereden: gereden gevuld, nog te rijden licht, het geplande blok omlijnd, een vertraging erachter in de statuskleur. Gisteren toont de gereden diensten uit de historie; op maandag is dat een zondag, met minder diensten (zie "Wat echt is en wat niet"). Wat een voertuig in de vroege ochtend nog van de nachtdienst van gisteren rijdt, staat op Vandaag als een gestreept blok "van gisteren" op zijn rij, vanaf zijn vertrek (of 00:00 als hij voor middernacht vertrok) en vast (`R.vanGisteren`), en de legenda noemt de arcering; om 04:00 op maandag zijn dat er 10 landelijk (8 rijden, 2 pauzeren midden in de rit). Het blok voor vannacht staat dan ook vast. Zet "Verplaats deze rit" een rit van een standplaats buiten je werkgebied klaar, dan toont het bord die standplaats, zegt de kop dezelfde naam en staat erboven dat hij buiten je werkgebied valt. Bovenaan de open ritten als omlijnde blokken in hun laadvenster (in hooguit drie banen; zijn het er meer tegelijk, dan per uur een blok met het aantal dat Open ritten opent) en de toegewezen ritten zonder voertuig (charter, morgen) in een eigen rij; wat op een ja wacht, is gearceerd; een stille stip als een dienst slecht past bij de voorkeur van de chauffeur. Een rit die nog niet begon, sleep je naar een ander voertuig of een andere tijd, of je schuift hem met de pijltjes; eerst getoetst (`src/ui/toets.js`). De bak Open ritten eronder: per rit "Rit inplannen" (de drie groepen) of slepen op een voertuig Na herladen staan de rijen (per voertuig of per chauffeur), de zoom en de dag weer zoals je ze liet (`sl-planbord`; Open ritten onthoudt vandaag of morgen in `sl-openritten`), en een gevraagde rit is gearceerd met "gevraagd" tot de chauffeur bevestigt. De ondertitel in de topbalk noemt de dag die het bord toont; bij Gisteren en Morgen met hun eigen datum ("zondag 25 oktober (gisteren)"). |
| Vrijgeven | toets 7, `#vrijgeven/<standplaats>` | De planning per standplaats (die van het planbord) met per dienst de chauffeur, het voertuig, de oplegger, de ritten en een status: concept, vrijgegeven, gezien, bevestigd, onderweg, afgerond. Planning vrijgeven (alleen planner en regiomanager) stuurt elke chauffeur zijn dienst en elke rit als OTM5-ritopdracht naar de boordcomputer, gesimuleerd; een wijziging daarna toont precies het verschil en gaat apart. Zie "Vrijgeven, het bericht aan de chauffeur en de ritopdracht" |
| Voertuigen, Opleggers, Chauffeurs | toets 8, 9 en 0 | Tabellen met rijen van 36 px en een regel bediening: zoeken, filters als keuzemenu's (een actief filter is een chip met een kruisje, de rest achter "Meer filters", "Wis filters"), opgeslagen weergaven per tabel (`sl-tabelweergaven`), kolomkeuze en csv. Selectie met bulkacties en een menu op de rechtermuisknop. Kentekens als Nederlandse plaat; de nummers zijn verzonnen en bevatten bewust een Q. Detailpagina's met het beeld in de kop (een foto van Sems schaalmodel als die er is, met "Foto: schaalmodel"; anders de render van het 3D-model, met "Beeld: 3D-model"; `src/portretten.js`, dynamisch geladen), een statusbalk, slimme knoppen, groepen in kaarten met label en waarde, hooguit drie cijfers en een primaire actie. De chauffeurspagina heeft de voorkeuren (diensten, weekend, ritten, regio, uren, extra diensten, wat hij zelf zei) en de tevredenheid met de roosterfit (`fleet.voorkeurenVan`, `fleet.tevredenheid`), alleen op die pagina en nooit als ranglijst; bij de diensten staat of ze pasten |
| Charters en oproepkrachten | menu, `#charters`, `#charter/<id>`, `#oproep/<id>` | Twee tabbladen: charters (`fleet.CHARTERS`: plaats, wagens, vandaag en morgen vrij, op tijd, tarief, contact) en oproepkrachten, zzp'ers en weekendchauffeurs (`fleet.OPROEP`: soort, standplaats, rijbewijs, de dagdelen van vandaag en morgen, laatste inzet). Een pagina per charter (afspraken, contact, de ritten die hij voor ons reed) en per persoon (beschikbaarheid per dag en dagdeel, voorkeuren, afspraken, het nummer afgeschermd tot een klik die wordt vastgelegd). Geen ranglijst van mensen: de tabel sorteert niet op betrouwbaarheid, en het signaal over de Wet DBA (schijnzelfstandigheid) staat alleen op de pagina van een zzp'er |
| Standplaatsen | menu | Tabel, paneel met vertrekbord en terrein, de dockplanning per standplaats, "Open als hal-scherm". Het paneel en de pagina tellen wat er nu op het terrein staat; de lijst noemt onderweg zoals de kaart (rijdt volgens plan) |
| Laden | menu | Drie getallen (te laden, bespaard, piek), dagprijs en laadvermogen per kwartier, laadsessies in de goedkoopste kwartieren, slim tegenover direct |
| Lostijden | menu | Gepland (`s.los`) naast gemeten, met de wachttijd ernaast, per dagdeel en adres; overnemen per adres of alles |
| Pauzeplekken | menu | Plekken op het snelwegennet met voorzieningen en beoordelingen; de assistent stelt er een voor bij rijtijd |
| Rapporten | menu | Op tijd per dag (dertig dagen, op de kalender geteld, ook over de zomertijd), per klant en per standplaats; de invulling van open ritten per week (eigen, oproep of zzp, charter, niet ingevuld; `fleet.poolHistorie`); de roosterfit per standplaats (het deel van de laatste diensten dat bij de voorkeur paste); de kosten van charters per week (schatting, alleen voor regiomanager en directie); wachttijd per DC, de dag in cijfers en meldingen per soort; bij elke grafiek een tabel en csv |
| Instellingen | menu | Je naam, rol en thema, werkgebied, normen per soort melding, kaart, sneltoetsen, de Assistent (alleen met `data-ai`) en wat deze browser bewaart (wissen vraagt eerst om bevestiging) |
| Zoeken | topbalk, toets / of Ctrl K | Voertuigen (kenteken met en zonder streepjes), opleggers, chauffeurs, open ritten, charters en oproepkrachten, standplaatsen met hun klanten, winkels en DC's, plaatsen, ritten, pauzeplekken, weergaven en acties; een tikfout mag ("wognm"), en in een kenteken ook twee omgewisselde tekens ("37QJJ7" vindt 37-JQJ-7); een plaats of standplaats met die naam staat bovenaan. Na een wijziging in het plan wordt alleen bijgewerkt wat veranderde, dus zoeken blijft snel. De lijst staat er bij elke toets meteen (MiniSearch, ruim onder de 100 ms). Een voertuig, oplegger of chauffeur opent als pagina en de kaart in die pagina vliegt erheen (met minder beweging springt hij); een standplaats, winkel, DC of plaats opent op de kaart |
| Assistent | topbalk of toets a | Voorstellen bij open zaken met uitleg en effect; "Pas toe" past het plan echt aan en stuurt de chauffeur een bericht. Met `data-ai` op de root ook Ochtendbriefing, Overdracht schrijven en een vraag via de Claude API (zie "Assistent met de Claude API"); zonder dat attribuut de vaste antwoorden en geen enkel verzoek |
| Hal-scherm en klant-link | `#hal/<standplaats>`, `#klant/<voertuig>` | Vertrekbord met dock voor een tv in de loods (volledig scherm, telt af per rij; chauffeurs met voornaam en de eerste letter van de achternaam, want iedereen in de loods ziet het); voor een klant alleen dat voertuig en de volgende levering |
| Sneltoetsen | toets ? | 1 tot 9 en 0 wisselen van weergave in de volgorde van het menu (Overzicht, Kaart, Ritten, Meldingen, Open ritten, Planbord, Vrijgeven, Voertuigen, Opleggers, Chauffeurs; sinds 4.1 heeft Charters en oproepkrachten geen cijfer meer, en het overzicht van de sneltoetsen leest de cijfers uit het menu), / zoekt, m meldingen, a assistent, o losse opleggers, d de 3D-wereld, f volgen, `[` het menu, Esc sluit; ingebed alleen als de app de focus heeft |
| Opgeslagen weergaven | werkgebied in de topbalk, en per tabel | Werkgebied, filters en kaartpositie onder een naam; per tabel zoekwoord, filters, sortering en kolommen |

## Draaien

```
npm install
npm run dev              # ontwikkelserver
npm run build            # dist/index.html: één bestand met alles erin (ca. 15,7 MB; het artifact mag tot 16 MB), plus dist/artifact.html voor het Claude-artifact (ook 15,7 MB)
npm run build:site       # dist-site/: app.js, data.js, lib.js, uplot.js, maplibre.js, three.js, buildings.js, portretten.js en app.css met vaste namen, om in een site in te bedden
```

Open `dist/index.html` via een webserver (bijvoorbeeld `npx vite preview` of
`python3 -m http.server` in `dist/`). Direct vanaf schijf (`file://`) werkt niet,
omdat MapLibre een web worker start.

### Controles

Met `dist/` op een webserver (`cd dist && python3 -m http.server 8774 --bind 127.0.0.1`):

```
node tests/toets.test.mjs                                   # de toetsregels van het planbord, zonder browser
node --test tests/verdeel.test.mjs                          # de toewijzing over alle open ritten (Hongaars en gretig), zonder browser
node tests/verify.mjs 8774 [gl|nogl] [plain|embedded] [map]  # laden, thema en kiosk op de root, geen overloop op 1440 en 390 px, minder beweging, alle weergaven
node tests/ui-check.mjs 8774 [gl|nogl] [plain|embedded]      # ruim 100 controles van de werking: adressen, de kaart vanuit elke weergave, belmenu, planbord (arcering, herladen), voorstellen, zaken, zoeken, de topbalk (ook op de oefendag, op 1440, 1280, 1024, 820, 768 en 390 px, met het menu dat tussen 761 en 1100 px vanzelf inklapt en de keuze van de kijker die blijft; niets breder dan het scherm; rechts verspringt niets tussen weergaven), een adres met een # geeft hooguit een melding, de cijfers van een zaakpagina op 390 px, pagina's boven het paneel en Terug, de samenhang van onderweg en vertraagd en om 15:00 van elk getal met een begrip (onderweg, vertraagd, bij klant, te laat, gemist) op het Overzicht, de kaart, het standplaatspaneel en Open ritten, sneltoetsen, 390 px
node tests/data-check.mjs http://127.0.0.1:8774/index.html    # de echte plekken en de geijkte dag
node tests/map-check.mjs http://127.0.0.1:8774/index.html     # de kaart en de beweging, en het eerste beeld (nooit alleen zee, ook met de processor vier keer trager)
node tests/3d-check.mjs http://127.0.0.1:8774/index.html      # de 3D-wereld
node tests/portretten-check.mjs http://127.0.0.1:8774/index.html  # de beelden van voertuigen en opleggers (foto of render)
node tests/open-ritten-check.mjs http://127.0.0.1:8774/index.html # de vraagkant op de data, het advies (niemand twee keer, onder 300 ms, Plan alle open ritten), bellen zonder tel:, de Assistent door de echte serverfunctie
node tests/assistent-check.mjs                                # de serverfunctie van de Assistent, zonder browser
node tests/voorstel-check.mjs http://127.0.0.1:8774/index.html # voorstellen met winst, Op tijd bij aankomst, vertrek per kandidaat, de oefendag
node tests/otm5-check.mjs                                     # de vertaling naar en van OTM5 (zie src/otm5.js)
node tests/vrijgeven-check.mjs http://127.0.0.1:8774/index.html [--schermen map]  # Vrijgeven: elke dienst vrijgegeven met een logregel, het bericht, de bevestiging die soms uitblijft, alleen het verschil na een wijziging, geldige OTM5-ritopdrachten en de export, rollen, herladen, de oefendag
node tests/ochtend-check.mjs http://127.0.0.1:8774/index.html  # de klok en kalender van de planner: een maandag en een zondag om 04:00, 05:30 en 06:30, de nachtdienst van gisteren op het planbord, het belmoment van P-8001 op de oefendag, de maandag na de zomertijd en het rapport erover
```

`gl` draait Chromium met software-WebGL (SwiftShader), `nogl` zonder WebGL (de kaart toont dan een melding);
`embedded` zet `data-tiles="off" data-embedded` op de root, zoals in SafeTools. Elke controle meldt ook
consolefouten en verzoeken naar buiten.

## Vraagkant: open ritten, de flexibele schil en voorkeuren

De interface rekent hier niet zelf; ze toont de data van `src/fleet.js` (met `src/inzet.js` en `src/voorkeuren.js`)
en bewaart wat de planner doet. `src/ui/invulling.js` is de enige plek waar de interface die data aanroept:

| Data | Wat de interface ermee doet |
| --- | --- |
| `fleet.poolAt(T, zonder)` | De open ritten zoals de planner ze om T ziet, zonder wat al is toegewezen; vandaag en morgen, op urgentie |
| `fleet.urgentie(rit, T)`, `fleet.prognose(rit, T)` | Minuten tot het laadvenster; de kans op invulling en de kans op tijd (ingevuld en binnen het venster weg), met `tekst`, `uitleg`, `advies` (de ene zin wat te doen) en `basis` (acht weken vergelijkbare ritten: eigen, oproep, charter, te laat) |
| `fleet.kandidaten(rit, { T, people, toegewezen, max })` | De kandidaten in drie groepen, altijd met `people` (dezelfde personen en voorkeuren als op de chauffeurspagina) en met wat al is toegewezen (niemand twee keer tegelijk, een charter niet boven zijn trekkers) |
| `fleet.wijsToe(rit, kandidaat, opts)` | Puur: het blok voor het planbord, de logregel, het bericht en de kosten. De interface bewaart de toewijzing als actie in `sl-acties` (de sleutel van vandaag; een nieuwe dag begint leeg), voert haar na herladen opnieuw uit en geeft haar terug als `toegewezen` en `zonder` |
| `fleet.poolHistorie(sp)` | De invulling per week in de rapporten |
| `fleet.CHARTERS`, `fleet.OPROEP` | Charters en oproepkrachten met hun pagina's; ids `CH-01` en `OP-001` |
| `fleet.voorkeurenVan`, `fleet.tevredenheid`, `fleet.past` | De chauffeurspagina, de markering op het planbord, de roosterfit per standplaats |
| `fleet.WAARSCHUWINGEN`, `fleet.WAARSCHUWING_KORT` | De waarschuwingen bij een kandidaat (de rust volgens de cao, zie hieronder) |

Toewijzen werkt voor alle drie de groepen hetzelfde: de vraag gaat uit (een eigen chauffeur die op dienst is krijgt
hem op de boordcomputer; bij een oproepkracht of charter staat het bericht klaar om te kopiëren, te mailen of voor te
lezen), de rit staat gearceerd op het planbord, en "Ja, bevestigd" of "Kan niet" maakt het af. Een rit van vandaag
komt op het vrije voertuig dat de data kiest, in een eigen dienst; een charter, een rit van morgen of een rit zonder
vrij voertuig krijgt een eigen rij. Het vertrek hangt af van wie rijdt (`aanrij` en `vertrek` op elke kandidaat, schatting):
wie thuis is, moet eerst naar de standplaats (35 tot 65 minuten, vast per persoon; een oproepkracht van een standplaats
verderop rijdt die afstand erbij), een eigen chauffeur die na zijn dienst rijdt vertrekt na die dienst en het koppelen, een
charter rijdt van zijn eigen plaats. Loopt het venster al, dan vertrekt de rit zodra die kandidaat er kan zijn; het blok op
het planbord en het bericht hebben die tijd, en de kandidaat krijgt de waarschuwing aanrijtijd.

**Het advies belooft nooit dezelfde persoon twee keer.** Over alle open ritten van een dag (heel Nederland, zodat elke
planner hetzelfde ziet) kiest één toewijzing (`invulling.verdeling` op `src/verdeel.js`, Hongaars) voor elke rit zijn eigen
beste kandidaat: niemand twee keer, een charter niet vaker dan hij trekkers vrij heeft, en wie al voor een andere rit
tegelijk gevraagd of al toegewezen is, blijft bij die rit. De waarde van een kandidaat is zijn kans op een ja met een kleine
opslag voor eigen mensen (8 punten) en de flexibele schil (4 punten) boven een charter; een rit van vandaag krijgt alleen wie
het venster haalt, zolang iemand dat haalt, en gaat voor een rit waarvoor niemand het venster meer haalt. Die ene kandidaat
staat overal: in de rij en het advies van Open ritten, bij Toewijzen, op de kaart in de bak van het planbord en als
hoofdknop in de zaak. Wordt iemand elders gevraagd of ingezet, dan schuift de rest mee. Gemeten (gesimuleerd, maandag 26
oktober 2026): voor de toewijzing deelde 55 tot 65 procent van de open ritten zijn beste kandidaat met een andere rit; nu
niemand, bij 55 tot 76 open ritten tegelijk. Hongaars tegen gretig op belmoment: Hongaars verwacht 0,5 tot 1,2 ja's per dag
meer (24,9 tegen 24,4 om 04:00; 49,8 tegen 49,0 om 10:00) en rekent in 5 tot 16 ms; de kandidaten van alle open ritten
rekenen kost het meeste, samen 20 tot 160 ms op een drukke machine (schatting; de toets eist onder 300 ms). Daarom Hongaars.
**Plan alle open ritten** (de knop boven de lijst in Open ritten) toont het voorstel voor alle open ritten van de dag in het
werkgebied tegelijk; de planner vraagt per rit of de aangevinkte in één keer, en elke toewijzing krijgt haar eigen regel in
het logboek en de zaak. Open ritten en de bak op het planbord staan op het eerste moment waarop je iets moet doen (het
laatste belmoment of het begin van het venster, `invulling.handelMoment`), zodat een rit die nu een zaak is bovenaan staat.
Na het belmoment of het venster (de fasen laat en gemist) geldt één regel voor de rij en het detail van Open ritten en voor
de zaak (`invulling.hoofdLaat`): de hoofdactie is de beste kandidaat die binnen 120 minuten na het einde van het venster kan
vertrekken ("vertrekt 45 min na het venster"; boven 90 minuten in uren, "7,4 uur na het venster"); is die er niet, dan
morgen als eerste, en wie later kan (vaak een charter die nog moet aanrijden) staat als gewone keuze. Een opleggerzaak
zonder voorstel van de assistent heeft als eerste stap "Ophalen inplannen" (het planbord van de standplaats), en een tijd
van gisteren staat met de dag erbij ("wacht sinds gisteren 17:55").

Rusttijd: de cao beroepsgoederenvervoer is strenger dan EU 561/2006. EU 561 staat drie keer 9 uur verkorte rust toe
tussen twee weekrusten; de cao hoogstens drie keer 10 uur, verder 11 uur (Staatscourant 2026, nr. 7211; status zoek,
nog na te lezen). De toets van het planbord (`src/ui/toets.js`) gebruikt de cao-grens, en een eigen chauffeur die de
data met EU 561 voorstelt maar met de rit minder dan 10 uur rust houdt, staat als niet beschikbaar met de reden.

Bellen belt niet: in de demo is er geen `tel:`-link. De knop Bel toont het gesimuleerde nummer met de melding "Demo:
er wordt niet gebeld, het nummer is gesimuleerd", en het gesprek komt in het logboek. Mail blijft `mailto:` (de
adressen eindigen op `.example`). Telefoonnummers en e-mailadressen gaan niet mee in de bewaarde acties.

Wat er nodig is voor echte data: de open ritten en hun historie uit het TMS (rit, venster, wanneer bekend, door wie
ingevuld; OTM5, zie `src/otm5.js` en `rapporten/simon-loos-control-tower/echte-data-en-otm5.md`), het vertrek uit de
boordcomputer, het rooster en de uren uit het roostersysteem (voor rij- en rusttijd en de weekuren), de flexibele
schil uit de inhuur (charters met tarief en beschikbaarheid, oproepkrachten met hun beschikbaarheid), en voorkeuren
uit een chauffeursapp (vrijwillig). De functies hierboven rekenen dan ongewijzigd op die records.

## Vertragingen, voorstellen met winst en de oefendag

**Een vertraging is een zaak als een stop daardoor na zijn venster aankomt** (`fleet.vertraging(t, T)`): het voertuig
loopt nu achter op het plan (het rijdt een stuk met vertraging, of een eerdere vertraging schoof de rest van zijn plan
op) en een stop in deze dienst of de volgende komt na het einde van zijn venster. Een vertraging op een stuk dat nog
moet komen, telt niet (die weet de planner nog niet); binnen het venster vraagt het niets. De zaak noemt de eerste stop
die te laat komt, hoeveel minuten, en hoeveel stops er nog meer te laat komen. Aan het eind van een rit is de volgende
stop de standplaats, ook als het voertuig daar eerst pauzeert of de volgende oplegger koppelt. Te laat telt in hele
minuten, zoals de klok ze toont: een ETA van 09:35 bij een venster tot 09:35 is op tijd (ook als het 09:35:40 is), pas
09:36 is 1 min te laat; zo is er nooit een zaak bij 0 minuten (`lateBy` in `src/ui/base.js`, `stopStand` in `src/fleet.js`).

**Elk voorstel heeft winst, gerekend met de simulatie zelf.** De assistent voert het voorstel op proef uit
(`fleet.proef`: dezelfde functies als Toepassen, daarna wordt alles teruggezet) en leest de ETA van elke geraakte stop
voor en na. Bij een vertraging:

- Volgende rit naar een ander voertuig: een rit die door de vertraging later vertrekt en nog niet begon, gaat op de
  geplande tijd naar een vrij voertuig van de standplaats met een vrije chauffeur (vandaag vrij, getoetst op overlap,
  venster, rijtijd, rust, accu, oplegger en dock; vertrek niet eerder dan de chauffeur er van huis kan zijn). Het effect
  per stop: "AH Nibbixwoud 12:38 in plaats van 13:14 (36 min winst), venster gehaald" (oefendag, 07:30). De klanten van
  de rit die het voertuig nu rijdt, krijgen in hetzelfde voorstel de nieuwe ETA.
- Nieuwe ETA aan de klant: als niets eerder kan (de lading zit in de wagen), krijgt elke klant die te laat bediend wordt
  de nieuwe ETA met een volg-link en een bericht ("Je levering van vandaag komt later: rond 07:52 in plaats van uiterlijk
  07:30, door een file op de A7 tussen Hoorn en Purmerend."); het venster gaat mee (`fleet.klantEta`). Een stop bij een
  eigen vestiging (een crossdock zoals Simon Loos Geldermalsen) is geen klant: die krijgt een intern bericht ("Intern: T-1890
  komt rond 10:53 in plaats van uiterlijk 10:50. Houd het dock vrij en pas de ontvangst aan."), zonder volg-link.

Een voorstel zonder winst komt niet in de lijst. De andere soorten noemen wat ze opleveren (`winst`: geen overtreding van
de rijtijd, genoeg accu, de lading blijft koel, de winkel heeft zijn plek terug). Toepassen voert de acties op volgorde
uit (`p.acts`; bewaard en na herladen opnieuw uitgevoerd) en geeft dezelfde ETA's als beloofd; `tests/voorstel-check.mjs`
controleert dat op een gewone dag en op de oefendag.

**Op tijd telt bij aankomst**: een stop telt mee zodra de wagen er aankomt (dan is bekend of hij binnen het venster was),
niet pas als hij weer weg is (`src/ui/metrics.js`).

**De oefendag** (`?scenario=druk` in de adresbalk, of Instellingen, "Oefendag: een drukke dag"; standaard uit, bewaard in
`sl-oefendag`; `?scenario=gewoon` zet hem voor één keer uit). Een vaste drukke dag bovenop de gewone, elke keer hetzelfde
(`src/oefendag.js`, toegepast aan het eind van `createFleet`, zodat de rest gelijk blijft): twee chauffeurs van Wognum
melden zich om 04:30 ziek (hun ritten staan bij de open ritten, met reden ziek), een file op de A7 tussen Hoorn en
Purmerend richting Purmerend van 06:30 tot 08:45 (elke rit die daar dan rijdt 25 tot 40 minuten later, midden in de file
het langst; de vensters van de klanten blijven staan, dus de stops erna komen echt te laat), het drukste dock van Wognum
buiten gebruik van 07:00 tot 11:00 (de blokken gaan naar een ander dock; de chauffeur krijgt een zaak "Dock" met het
voorstel het nieuwe dock door te geven) en een koelstoring op een koeloplegger van Wognum. Een chip "Oefendag" in de
topbalk; alles is gesimuleerd. De acties op de oefendag staan apart (`sl-acties-oefendag`), zodat de gewone dag precies
blijft zoals hij was. Wat er gebeurde, met de aantallen, staat in `fleet.scenario`. De vorm is die van echte meldingen
(een file uit NDW, een ziekmelding uit het rooster, een dock uit de hal, een koelstoring uit de telematica), zodat een
echte bron hem later kan vullen.

## Vrijgeven, het bericht aan de chauffeur en de ritopdracht (4.1)

De planner geeft de planning per standplaats vrij met een handeling: menu Vrijgeven (onder Planbord), toets 7,
`#vrijgeven/<standplaats>`. De standplaats is die van het planbord. Code: `src/ui/vrijgeven.js` (de weergave en de
vrijgave), `src/ui/bericht.js` (het bericht en de bevestiging) en `src/ui/ritopdracht.js` (OTM5).

- **Statussen per dienst**: concept, vrijgegeven, gezien, bevestigd, onderweg, afgerond. Onderweg en afgerond volgen uit
  de simulatie (het dagplan van het voertuig, zoals bij de ritten). Een dienst hoort bij de chauffeur (zijn
  personeelsnummer): gaat hij naar een ander voertuig, dan blijft het dezelfde dienst, met dat verschil.
- **Planning vrijgeven** (alleen planner en regiomanager, `ctx.can('act')`; directie en HR kijken mee zonder knop): na
  een bevestiging gaan alle concepten van de standplaats tegelijk. Elke dienst krijgt een logregel ("stuurde ... de
  dienst ... per app" of "per mail") en er komt een samenvatting.
- **De demo heeft een dag.** Vrijgeven geldt voor wat nog niet begonnen is: om 01:00 de hele planning van de dag, om
  10:00 de middag- en avondploeg. In het echt geef je de planning voor morgen de middag ervoor vrij, als de ritten van
  morgen binnen zijn (13:00 tot 16:30). Zijn alle diensten begonnen, dan zet een knop de klok op 01:00.
- **Een wijziging na vrijgeven**: bij vrijgeven bewaart de app per dienst een korte momentopname (voertuig, oplegger,
  begin en einde, en per rit het geplande vertrek en de stops; geplande tijden, zonder de vertraging van de simulatie).
  Wijkt het plan daarna af (een rit erbij of eraf, vijf minuten of meer een andere tijd, een ander voertuig of een andere
  oplegger, of de dienst vervalt), dan staat precies dat verschil bij de dienst. "Wijzigingen vrijgeven" stuurt alleen
  dat, en de chauffeur bevestigt opnieuw.
- **Het bericht**: begintijd en plek, voertuig met kenteken, oplegger, per rit het vertrek en waar hij laadt (dock of DC
  met adres), de stops met tijd, adres en venster, de pauze (een pauzeblok in het plan, anders de tijd tussen twee ritten
  op de standplaats), het einde en een link naar de eerste rit (`#rit/<id>`). Per dienst open te klappen als voorbeeld.
  Kanaal: ongeveer zeven op de tien per app, de rest per mail (gesimuleerd). Een winkel heeft in onze data alleen naam en
  plaats; een standplaats en een DC hebben een straatadres.
- **De bevestiging** (gesimuleerd, vast per dienst, dag en versie): gezien na 2 tot 15 minuten simulatietijd, akkoord 2 tot
  25 minuten later; ongeveer 7 procent ziet het niet en 8 procent ziet het zonder akkoord. Zonder akkoord na 30 minuten
  (schatting voor de demo) staat de dienst bij "Wacht op bevestiging", met een belknop (demo: er wordt niet gebeld). Een
  zaak zoals de wachtklok (ideeënbank 44) vraagt een nieuwe soort in `src/ui/zaken.js`; die staat er nog niet.
- **De ritopdracht**: per rit een OTM5-trip (5.9.0), gemaakt met `uitFleet` en `naarOtm5Van` uit `src/otm5.js`: stops met
  tijden en vensters, het laadadres met straat en dock, het koppelen van de oplegger, het voertuig en de chauffeur als
  personeelsnummer (geen naam). Elk bericht bevat alles waar de trip naar verwijst. Te bekijken per rit (een paneel met de
  JSON, kopiëren, downloaden) en per standplaats te exporteren als een bestand (`ritopdrachten-<standplaats>-<datum>.json`,
  dezelfde vorm als `naarOtm5`, dus `node tests/otm5-check.mjs --bestand` leest het). Stand naar de boordcomputer: klaar,
  verzonden (gesimuleerd, een minuut na vrijgeven), bevestigd (na het akkoord van de chauffeur, met het akkoord erin). Na
  een wijziging krijgen de geraakte ritten een nieuwe versie met dezelfde UUID (in OTM een update).
- **Opslag**: `sl-vrijgave` in localStorage, per dag (de laatste vier) en apart op de oefendag, per standplaats en dienst.
  Namen en adressen blijven in de browser. Er gaat niets de deur uit: geen mailto, geen fetch, geen tel:.

### Open vragen voor ICT

- Welke boordcomputer zit er in de vloot (Trimble FleetXPS, of per divisie een andere), en neemt die ritopdrachten aan
  via een eigen API, via OTM5 of alleen via het TMS (ORTEC, Navitrans)?
- Wie maakt de ritopdracht in het echt: de Control Tower, of het TMS met de vrijgave uit de Control Tower? Wie beheert de
  sleutel van de koppeling?
- Welk kanaal naar de chauffeur: de app van de boordcomputer, een eigen chauffeursapp of een maildienst? Wie beheert de
  adressen en nummers, en hoe lang bewaren we berichten en bevestigingen?
- Hoe komt de bevestiging terug: een status uit de boordcomputer, een tik in de app of een link in de mail?
- Een ritopdracht is een wijziging in een systeem van een leverancier: in de proef pas na een test op een voertuig.

## Assistent met de Claude API

Zet de pagina `data-ai="/api/assistent"` op de root, dan krijgt de Assistent drie ingangen: Ochtendbriefing,
Overdracht schrijven en een vraag (Enter stuurt). Zonder dat attribuut doet de app geen enkel verzoek en geeft de
Assistent de vaste antwoorden. Het verzoek volgt het contract van `netlify/functions/assistent.mts`: POST met
Content-Type `application/json`, `{ soort, vraag?, dag }`. De dag (`aiDag` in `src/ui/ai.js`) is kleiner dan 40 KB:
tijd, datum, standplaats, rol, cijfers, de zaken (hoogstens 30, op urgentie), de open ritten met de kans op invulling,
de kans op tijd en het advies (hoogstens 30), de kandidaten van de vijf meest urgente ritten (hoogstens vijf per rit),
wachttijd, rijtijd, laden, de overdracht, recente gebeurtenissen en de sleutel `personen` (nummer en naam, hoogstens
200). Namen in vrije tekst worden eerst nummers, telefoonnummers en e-mailadressen gaan eruit; de functie vervangt
de namen opnieuw voordat er iets naar de API gaat. Het antwoord komt met `textContent` op het scherm (nooit als
HTML), nummers (ritten, voertuigen, zaken, personen, charters) worden knoppen naar dat onderdeel, en een half of
ongeldig antwoord wordt nooit getoond. Een 429 zegt na hoeveel minuten je het weer kunt proberen; een 404 valt terug
op de vaste antwoorden. Elke actie in het antwoord kan in het logboek, het antwoord in de overdracht.

## De demosite (controltower-demo.netlify.app)

`npm run build` maakt naast `dist/index.html` (de losse versie) en `dist/artifact.html` ook `dist/demosite.html`:
dezelfde app met `data-basiskaart="online"` (opent met OpenStreetMap in onze eigen stijl, de luchtfoto een klik
verder; laadt OpenFreeMap niet, dan stil de ingebouwde kaart) en `data-ai="/api/assistent"` (de Assistent met de
Claude API, zie `netlify/functions/README.md`). Op de demosite wordt dat bestand `public/index.html`, met
`netlify/functions/assistent.mts` ernaast. Hosts buiten de eigen site: tiles.openfreemap.org (de standaardkaart)
en service.pdok.nl (luchtfoto en topografisch, alleen als de kijker die kiest); de Assistent loopt via de eigen
functie.

## Inbedden in een site (SafeTail: safetail.nl/intern/control-tower)

De app staat als tabblad "Control Tower" in SafeTools, het interne deel van safetail.nl
(repo SafeTail-V-O-F/Website, pagina `src/pages/intern/control-tower.astro`, achter de
inlog van de oprichters). Daarvoor is de app inbedbaar gemaakt:

- Alle CSS staat onder `.slct`, de app-root (`#app.app.slct`); het thema (`data-theme`)
  en de kiosk-klasse voor het hal-scherm staan op die root, niet op `<html>` of `<body>`.
  Met `contain: layout` blijven de vaste panelen (paneel, record-pagina, modals, hal-scherm)
  binnen de app, ook midden in een andere pagina.
- Vier opties als data-attribuut op de root: `data-tiles="off"` laadt geen externe
  kaarttegels (geen enkel verzoek naar buiten; de basiskaart zit in de bundel) en
  `data-embedded` houdt de sneltoetsen binnen de app en vraagt bij "Open als hal-scherm"
  om volledig scherm op de app zelf (Esc sluit beide). Alleen buiten SafeTools:
  `data-basiskaart` (`kaart`, `online`, `luchtfoto` of `brt`) is de basiskaart zolang de kijker zelf niets koos
  (zijn keuze onder Kaartlagen gaat voor en wordt bewaard, de standaard niet; met `data-tiles="off"` blijft het
  altijd de ingebouwde kaart), en `data-ai` zet de Assistent aan (zie "Assistent met de Claude API").
- Zonder WebGL toont de kaart een rustige melding; de andere weergaven werken gewoon.

Bijwerken in de SafeTail-repo:

```
npm run build:site
node tools/sync-safetail.mjs ../../../website   # pad naar de website-repo
```

Dat kopieert de negen bestanden naar `public/intern/control-tower/app/` en schrijft daar `VERSIE.json` (commit en
datum): `app.js` (de code), `data.js` (wegennet en plaatsen), `lib.js` (svelte-gantt, MiniSearch en Floating UI),
`uplot.js` (de grafieken, pas bij de eerste grafiek geladen), `maplibre.js`, `three.js` en `buildings.js` (de
3D-wereld en de gebouwen, pas bij de eerste klik op de kubus), `portretten.js` (de beelden van voertuigen en
opleggers, pas op een detailpagina of in een kaartje) en `app.css`. De late bestanden laadt `app.js` met een
relatief pad. De pagina daar bevat de HTML-opbouw van de app (het skelet hieronder): verandert die
opbouw, pas dan ook die pagina aan, en de lijsten `SHELL_IDS` en `APP_BESTANDEN` in `tests/smoke/control-tower.spec.mjs`
daar. Daarna in de website-repo: `npm run build`, `npm test`, committen (zie daar DEPLOY.md, "SafeTools · Control
Tower").

### Skelet (sinds 4.0)

De id's die de code verwacht, in deze opbouw (`index.html`; klassen en `hidden` horen erbij):

```html
<div id="app" class="app slct">                       <!-- data-tiles="off" data-embedded in SafeTools -->
  <nav class="side" id="side" aria-label="Hoofdmenu"></nav>
  <div class="main">
    <header class="top" id="topbar"></header>
    <div class="views" id="views">
      <section class="view" id="v-overzicht" aria-label="Overzicht"></section>
      <section class="view on" id="v-kaart" aria-label="Kaart">
        <div id="map"></div>
        <div class="mapbar" id="mapbar"></div>
        <div class="maptools" id="maptools"></div>
        <div class="timebar" id="timebar"></div>
        <div class="tip" id="tip"></div>
      </section>
      <section class="view" id="v-ritten" aria-label="Ritten"></section>
      <section class="view" id="v-meldingen" aria-label="Meldingen"></section>
      <section class="view" id="v-openritten" aria-label="Open ritten"></section>
      <section class="view" id="v-planbord" aria-label="Planbord"></section>
      <section class="view" id="v-voertuigen" aria-label="Voertuigen"></section>
      <section class="view" id="v-opleggers" aria-label="Opleggers"></section>
      <section class="view" id="v-chauffeurs" aria-label="Chauffeurs"></section>
      <section class="view" id="v-charters" aria-label="Charters en oproepkrachten"></section>
      <section class="view" id="v-standplaatsen" aria-label="Standplaatsen"></section>
      <section class="view" id="v-laden" aria-label="Laden"></section>
      <section class="view" id="v-lostijden" aria-label="Lostijden"></section>
      <section class="view" id="v-pauze" aria-label="Pauzeplekken"></section>
      <section class="view" id="v-rapporten" aria-label="Rapporten"></section>
      <section class="view" id="v-instellingen" aria-label="Instellingen"></section>
      <aside class="panel" id="panel" aria-label="Details"></aside>
      <div class="sheet" id="sheet" hidden></div>
    </div>
  </div>
  <nav class="bottombar" id="bottombar" aria-label="Hoofdmenu"></nav>
  <div class="pop" id="popover" hidden></div>
  <div class="modal" id="dialog" hidden></div>
  <div class="modal" id="wizard" hidden></div>
  <div class="full" id="hal" hidden></div>
  <div class="full kl" id="klant" hidden></div>
  <div class="toasts" id="toasts" aria-live="polite"></div>
  <div class="loading" id="loading" role="status"> <!-- skelet en tekst zoals in index.html --> <p id="loadMsg"></p> </div>
</div>
```

Samen 36 id's: `app`, `side`, `topbar`, `views`, `v-overzicht`, `v-kaart`, `map`, `mapbar`, `maptools`, `timebar`,
`tip`, `v-ritten`, `v-meldingen`, `v-openritten`, `v-planbord`, `v-voertuigen`, `v-opleggers`, `v-chauffeurs`,
`v-charters`, `v-standplaatsen`,
`v-laden`, `v-lostijden`, `v-pauze`, `v-rapporten`, `v-instellingen`, `panel`, `sheet`, `bottombar`, `popover`,
`dialog`, `wizard`, `hal`, `klant`, `toasts`, `loading` en `loadMsg`. Ten opzichte van 3.2 vervallen `rail`,
`statline`, `fcard`, `notice`, `v-trucks`, `v-mensen`, `v-assistent` en `palette`; nieuw zijn `side`, `views`,
`v-overzicht`, `mapbar`, `v-ritten`, `v-meldingen`, `v-openritten`, `v-voertuigen`, `v-chauffeurs`, `v-charters`,
`v-rapporten`, `v-instellingen`, `bottombar`, `popover`, `dialog` en `toasts`, en `timebar` staat nu binnen `v-kaart`.
`v-openritten` en `v-charters` kwamen er later in 4.0 bij: in SafeTools moeten ze ook in de pagina en in `SHELL_IDS`. Al het andere (het zoekveld
`#zoekIn`, de bel `#bellCnt`, het kaartje `#hcard`, de knoppen) bouwt de app zelf op. Meldingen van de app zijn
toasts in `#toasts` (aria-live polite); er is geen `#notice` meer.

## 3D-wereld

De 3D-stand (knop met de kubus naast Kaartlagen, toets d, bewaard als `sl-3d`) is een eigen laag van
MapLibre (`CustomLayerInterface`, `renderingMode: '3d'`) die met **three.js** tekent. `src/scene3d.js` maakt
de scene, de camera (elk beeld overgenomen uit `defaultProjectionData.mainMatrix`), het licht en de
voertuigen. In `src/scene3d/` staan de wereld (`world.js`: terreinen, gebouwen, docks, poort, bomen,
huizen, winkels), de voertuigmodellen (`vehicles.js`), het kleurenpalet (`palette.js`), het licht uit de klok
(`licht.js`), de naamborden van de afdelingen (`borden.js`), getekende texturen en vlakken op de grond
(`fx.js`), bouwgeometrie (`geom.js`), bomen, hagen en huizen (`nature.js`), de CC0-modellen (`assets.js`)
en hulpfuncties (`util.js`).

**Wat je ziet.** Alles op ware grootte: een trekker met oplegger is 16,5 m lang en 4 m hoog. Bij uitzoomen
groeien rijdende voertuigen mee tot ongeveer 20 pixels (ware grootte vanaf zoom 15,4); geparkeerde hooguit
1,3 keer, zodat ze in hun vak blijven. Een standplaats ligt op zijn echte terrein (`terrein` uit
`places.json`) als verhard vlak. De hal en de andere eigen gebouwen komen uit `buildings.js` (`d: 1` en
`hal`); de panden eromheen zonder `d` zijn de buurt, in minder detail en pas vanaf zoom 13,2, elk in een
eigen gevel- en dakkleur. Zonder hoogte in de gegevens is een loods 10,5 m (de hal 11,5 m), een kantoor
drie lagen en een klein pand een woonhuis met een kap. Opleggers, containers en overkappingen die in de
gegevens als gebouw staan, laat de wereld weg.

Geparkeerde voertuigen en losse opleggers staan op hun plek in de parkeerrijen (`rijen`) met de koers van
de rij; de vakken zijn getekend. Rijen die buiten de terreinring vallen, krijgen hun eigen verharding. De
docks staan waar de gegevens ze zetten: `sp.dockPlek` geeft per dock de deur in de gevel van de hal en de
koers van de gevel af, en de wereld nummert ze in die volgorde, 1 tot n, met een bord boven elke deur
(hetzelfde nummer als op het hal-scherm en het planbord). Een voertuig dat laadt, lost of koppelt, staat
al op zijn plek voor die deur (`pos` uit de simulatie). Zonder `dockPlek` zoekt de wereld zelf de lange
zijde van de hal waar de rijen staan (het aantal uit `sp.docks`, anders uit de lengte van de gevel),
nummert van links naar rechts gezien vanaf het terrein en zet een voertuig met een `dock` achteruit aan
die deur. De poort ligt waar de toegangsroute (`toegang`) het terrein op
komt: slagbomen, een portiersloge, een bord en lantaarnpalen langs de inrit; populieren langs de laatste
450 m van die weg, lichtmasten tussen de rijen, een haag en bomen rond het terrein (nooit op het terrein of
in een gebouw). Een fabriek uit de DC-lijst (`soort: 'fabriek'`) krijgt silo's, een schoorsteen en
liggende tanks.

Het terrein is asfalt met een lichte korrel, gerepareerde stroken, gevoegde scheuren en olievlekken (een
getekende textuur van 40 bij 40 m). Parkeervakken en dockvakken zijn wit, de gangpaden voor de rijen hebben
een onderbroken middenlijn, bij elk dock staan gele wielgeleiders en aan de koppen van de dockstrook liggen
betonblokken. Het laadplein ligt waar `sp.afdelingen` het zegt (soort `laadplein`), anders bij de rij die het
dichtst bij het kantoor ligt: laadpalen op een betonnen eiland langs een rij, één paal per twee plekken (het
aantal uit `sp.laadpunten`, anders zoals `laadpunten()` in `places.js`: hub 24, warehouse 12, anders 4),
met een trafokast en gele paaltjes. Verder stapels pallets langs een gevel van de hal zonder docks, een paar
zeecontainers in gedekte kleuren langs de rand, en een tankstation als de notitie of de afdelingen dat
noemen. Alles staat op een vaste plek per standplaats (een toevalsreeks op de naam), nooit op een rij, een
schort, de inrit of tegen een lamp.

**Naamborden.** De afdelingen uit `sp.afdelingen` (`{ naam, soort, p: [lon, lat], gebouw?, bron }`) krijgen
vanaf zoom 15,5 een rustig wit bord met de naam in kleine kapitalen, zoals de docknummers: op het dak van het
gebouw (`gebouw` is de index in `buildings.json` van die standplaats), boven de dockdeuren of boven het
gebied. De borden houden een vaste maat op het scherm en wijken voor elkaar: raken twee borden elkaar, dan
blijft het belangrijkste staan (kantoor, hal, garage en wasstraat, docks, laadplein, opleggers, poort).
Zonder `afdelingen` zijn er geen borden. Eén tekening voor alle borden: een atlas met de namen (de
systeemletter) en een instanced vlak dat in de shader naar het scherm draait (`borden.js`).

Bij een klant staat een vrachtwagen of oplegger achteruit tegen een dock: van het echte DC-gebouw als dat
er is, anders van een supermarkt op het winkelpunt (`WINKELS`) of naast de stopplek (glazen pui, gevelband
in de kleur van de formule, klantenparkeerplaats), of van een distributiehal bij een DC uit de lijst
zonder gebouwgegevens. Woonhuizen (rijtjes en vrijstaand) en bomen staan in de bebouwing van
`urban.json`, niet op een terrein en niet binnen 320 m van een plek met echte gebouwen. Woonhuizen, ook die
uit de gebouwgegevens, hebben een zadeldak, een schilddak of een plat dak, in gedekte kleuren (rode, bruine
en gele baksteen, wit en grijs pleisterwerk; antraciet, grijze en rode pannen), en een deel heeft een lage
haag langs de voortuin.

**Licht.** Het licht komt uit de klok van de simulatie, niet uit het thema. `licht.js` rekent de stand van
de zon boven Wognum (52,7 graden noord) uit voor de dag en het uur van de simulatie, in Nederlandse tijd met
zomer- en wintertijd. Op zondag 25 oktober 2026, de dag dat de klok een uur teruggaat, komt de zon op om
07:24 en gaat ze onder om 17:23; op zaterdag 24 oktober was dat 08:22 en 18:26. Vier staten lopen vloeiend
in elkaar over: nacht (de zon meer dan 8 graden onder de horizon), schemer met het blauwe uur, gouden uur
(tot 6 graden boven de horizon) en dag. De richting en lengte van de schaduwen, de kleur en sterkte van het
zonlicht (oranje bij een lage zon, 's nachts het maanlicht), het hemellicht, de lucht in glans en glas, de
nevel en de belichting lopen mee. Lampen gaan aan vanaf de schemer en zijn overdag uit: lichtmasten,
lantaarnpalen en docks (met een lichtpoel op de grond), verlichte ramen en dockborden, koplampen en
achterlichten van rijdende voertuigen (geparkeerde staan uit) en het lampje van de laadpalen. 's Avonds en
's nachts ligt een donkerblauwe sluier over een lichte kaart, zodat kaart en wereld samen de avond in gaan;
de namen op de kaart liggen erboven en blijven leesbaar. Het donkere thema verandert alleen de kaart en de
interface: 's middags is de wereld dan nog steeds bij daglicht, iets gedempt, zodat hij niet als een lamp op
de donkere kaart ligt. Verder een schaduwkaart van 2048 px die het zichtbare gebied volgt (in stappen van een
texel), ACES-tonemapping en een zachte voetschaduw rond gebouwen.

**Modellen van buiten.** Vier bomen (linde, eik, populier, den) en de schoorsteen en tank bij fabrieken
zijn CC0-modellen van Kenney uit `assets-3d/` (herkomst en licentie in de README daar). Ze komen met `?url`
als data-URL in de three-bundel: geen los bestand en geen verzoek naar buiten. `tools/build-assets.mjs`
zet een nieuw model op dezelfde manier klaar (glTF-Transform, in de devDependencies). Vrachtwagens,
opleggers, bakwagens en bussen blijven procedureel: er is geen CC0-model van een Europese trekker met
oplegger. De Kenney-hallen en -auto's gebruikt de wereld niet: de echte contouren zeggen meer, en een
vast model uitrekken naar een contour vervormt ramen en deuren.

**Laden en prijs.** Geen imports uit de app: standplaatsen, statuskleuren, bebouwing, winkels (`WINKELS`)
en DC's (`DCS`) komen via `opts.data`, de gebouwen via een dynamische import van `./buildings.js` (zonder
dat bestand: een procedurele loods met kantoor). Zo blijven three.js, de wereld en de modellen een eigen
bundel die pas bij de eerste klik op de kubus laadt. Een plek wordt pas voorbereid en gebouwd als hij in de
buurt van het beeld komt (de dichtstbijzijnde eerst, ongeveer 14 ms per beeld), de buurt een beeld later.
Voertuigen, bomen, huizen en auto's zijn instanced meshes; de grootste 60 voertuigen in beeld krijgen het
volle model met draaiende wielen, de rest een eenvoudiger model of een blok; bomen in vol detail vanaf
zoom 16,3. Bij Wognum zijn dat 45 tot 55 tekenopdrachten en 85.000 tot 230.000 driehoeken per beeld (het meest
vlak boven het terrein), op zoom 11 ongeveer 40. De sluier, de borden en de schilddaken zijn elk één tekening
(de schilddaken twee: dichtbij en ver); laadpalen, pallets, containers, wielgeleiders en betonblokken zitten in
de tekening van de plek zelf. Klik en aanwijzen gaan via een straal tegen de omtrek van elk getekend voertuig.
Zonder WebGL is er geen knop.

**Aanroep.** `createScene3d(map, maplibregl, { theme, klok?, data: { SP, ST, TRST, urban, WINKELS?, DCS? },
onSelectTruck, onSelectTrailer, onHover })` geeft `{ enable, isOn, setVehicles, setTrailers, setTheme,
setClock, pick, refresh, setSelected, dispose, ready, stats }`. Een voertuig is `{ id, st, b, k, base, lon,
lat, dock? }`, een oplegger `{ id, st, base, lon, lat, b?, dock? }` (zonder `b` neemt een oplegger op het
terrein de koers van zijn rij). `setSelected(id)` zet de rode ring om het gekozen voertuig. `klok` is een
object met `simTime` (minuten na middernacht, Nederlandse tijd) en eventueel `datum` (`[jaar, maand, dag]`);
zonder die optie leest de wereld de klok van de app (`window.SLCT.state`), en anders de echte tijd. De dag is
die van de simulatie: vandaag. `setClock(minuten, datum?)` zet een vaste tijd (tests, schermafbeeldingen),
`setClock(null)` volgt de klok weer. `stats().licht` geeft de staat, de stand van de zon, de lampen en de
tijden van zonsopgang en -ondergang; `stats().borden` het aantal getekende borden.
`tests/3d-check.mjs` controleert bouwtijd, tekenopdrachten en driehoeken per zoom, de zon boven Wognum
(zonsopgang en -ondergang op drie dagen), dag, schemer en nacht op een vaste dag, het donkere thema
overdag, de naamborden bij Wognum, klikken, geheugen na drie keer uit en aan, en consolefouten.

**Huisstijl.** Naar Sems schaalmodellen van Simon Loos (foto's in `rapporten/simon-loos-control-tower/fotos-modellen/`).
De cabine is boven wit: dak, zonneklep, het vlak rond de voorruit en de deuren tot onder de ruit. Onder is ze
Simon Loos-rood (#E3001F): grille, bumper, de deuren onder de ruit en de zijkant tot het chassis. De grens loopt
onder de voorruit en de zijruiten: een goudgele band (#F0A526), een smalle witte bies en dan het rood. Op de
zijkant loopt die grens licht omhoog naar achteren. Bovenaan de zijkant loopt een smalle sierstreep, geel boven
rood, die naar voren eindigt in het kleine beeldmerk. Het beeldmerk is twee gele vierkantjes boven twee rode,
schuin als een cursieve letter, met tussen de paren de ruimte waar het woordmerk loopt. Het staat boven de
voorruit (op het hoge dak of op de dakspoiler) en groot midden op de zijkant van opleggers en laadbakken. Die
zijn licht gebroken wit, met een aluminium onderrand en een smalle zwarte onderbalk; de koelmachine is wit met
grijze roosters en de velgen zijn zilver. De Actros-vorm en de cabine in de 3D-wereld hebben een zwarte
zonneklep, DAF, Scania en Volvo een witte. De bestelbus is wit met het beeldmerk. Het woordmerk "Simon Loos" laten we weg: er is geen letter die op elke
machine hetzelfde rendert. Alles zit in het palet (`cabineWit`, `geel`, `kast`, `alu`, `rooster` in
`palette.js`) en in onderdelen van dezelfde modellen (`cabineLak`, `beeldmerk` en `sierstreep` in
`vehicles.js`): geen extra materiaal en geen extra tekenopdracht. De iconen op de 2D-kaart blijven zoals ze zijn.

**Voertuigbeelden.** De beelden van voertuigen en opleggers op de voertuig- en opleggerpagina en in de
hoverkaart zijn renders van onze eigen 3D-modellen, geen foto's; alleen van een DAF XF met koeloplegger en
een Mercedes-Benz Actros bakwagen met aanhanger staan er foto's van Sems eigen schaalmodellen in de echte
huisstijl (`src/assets/fotos/`, bron `rapporten/simon-loos-control-tower/fotos-modellen/`, uitsneden met
`tools/fotos-modellen.mjs`; `fotoVan` en `fotoVanOplegger` gaan voor een render). Elke trekker heeft de cabinevorm van zijn
merk (DAF XF, Scania R, Volvo FH, Mercedes Actros en eActros 600), zonder merktekens. Een elektrische trekker
heeft accupakketten en een laadklep in plaats van de tank. Verder: met of zonder koeloplegger, de bakwagen
in drie vormen, de bestelbus, en elke opleggersoort los op de steunpoten. Alles in de huisstijl hierboven en
met een fictief kenteken op het model (met een C, die Nederlandse kentekens niet hebben); de app zet het
echte kenteken als plaat ernaast. De modellen staan in `src/scene3d/varianten.js`. `tools/render-portretten.mjs`
rendert ze met Playwright en de software-GPU: 26 beelden van 640 x 400 px, WebP met een doorzichtige
achtergrond, elk hooguit 25 KB en samen ongeveer 560 KB. Twee keer draaien geeft dezelfde bestanden. De
beelden staan in `src/assets/portretten/`. `src/portretten.js` neemt ze met `?inline` op in de bundel
(geen los bestand, geen fetch) en kiest met `portretVan(voertuig, oplegger?)` en
`portretVanOplegger(oplegger)` het juiste beeld, met een alt-tekst. `tests/portretten-check.mjs`
controleert de bestanden en de keuze voor elk voertuig en elke oplegger uit de simulatie.

## Kaart en wegen

- **Wegen: OpenStreetMap via Overture Maps** (release 2026-10-21.0, licentie
  ODbL). Snelwegen, autowegen en N-wegen vormen de routeergraaf waarover de trucks
  rijden; secundaire en tertiaire wegen worden getoond bij inzoomen.
- **Land en water: OpenStreetMap via Overture Maps** (base/land en base/water, dezelfde release, ODbL; sinds 25 oktober
  2026, `tools/ct4/kust_water.py`). Het land is het land binnen de kustlijn van OpenStreetMap: de Waddenzee, de Eems en
  Dollard, de Westerschelde en de Oosterschelde zijn zee. Daarover het water: de IJssel- en randmeren, de rivieren, de
  kanalen, de havens van Amsterdam en Rotterdam (Westpoort, Europoort, Maasvlakte, Botlek) en het IJ. Weggelaten:
  water smaller dan 16 m (sloten, smalle vaarten), kribben, eilandjes onder 2,5 ha en losse plassen onder 4 ha (een stuk
  vanaf 0,5 ha dat door een brug van groter water gescheiden is, zoals het water voor Amsterdam Centraal, blijft);
  vereenvoudigd tot op 10 m (land 8 m). Ver weg (tot zoom 10) een grove versie van de grote wateren, vanaf zoom 10 het
  fijne water met de havens en het IJ, kleine vlakken vanaf zoom 11; de namen van de grote wateren, de rivieren, het
  Noordzeekanaal en het IJ staan erop vanaf de zoom waarop ze passen. Buiten lengte 1,8 tot 8,6 en breedte 50 tot 54,3
  de grove kust van Natural Earth. De landsgrens met België en Duitsland komt uit OpenStreetMap (Overture divisions).
  De bebouwing ligt onder het water. Gecontroleerd in `tests/map-check.mjs`: elke standplaats, elk DC, elke fabriek en
  elke winkel ligt op land (vorm en beeld), en op 26 bekende plekken op het water (het IJ, de havens, de rivieren, de
  meren, de Eems, de Westerschelde) staat water, licht en donker, met 8 plekken land vlak ernaast.
- **Het eerste beeld**: de zee is de achtergrond en het land ligt er als vlakken over. Tot de bronnen land en water
  getegeld zijn (onder belasting met software-WebGL een paar seconden), ligt er een vlak in de kleur van het land over de
  kaart, met na 600 ms de regel "De kaart wordt getekend"; zodra land en water geladen zijn en het land echt in het
  zichtbare beeld getekend is (`queryRenderedFeatures` op de landlaag; `isSourceLoaded` alleen zegt dat niet, zonder tegels
  in de cache is een bron al "geladen"), vaagt het in 200 ms weg (met minder beweging meteen, na hetzelfde wachten); met
  een online basiskaart pas als die zelf iets getekend heeft; na 30 s hoe dan ook, en meteen als een bron van de basiskaart faalt (op een zwaar belaste machine duurt land en water verwerken meer dan 12 s, en dan stond met het oude net van 12 s toch de zee). Nooit een beeld met alleen zee; per
  getekend beeld gecontroleerd in `tests/map-check.mjs`, met de processor vier keer trager.
- **Provincies en bebouwing: Natural Earth 10m.**
- **Rijstroken op ware maat**: een rijdend voertuig rijdt in het midden van de rechterstrook van zijn eigen rijbaan (een
  rijstrook is 3,5 m). Op een gescheiden weg is de lijn in de data het midden van de rijbaan: 1,75 m rechts daarvan; de
  middenberm zit in de afstand tussen de twee rijbanen. Op een snelweg met één lijn voor beide richtingen 7,25 m rechts van
  de hartlijn, op een autoweg of N-weg met één lijn 1,75 m, op een straat 1,4 m (`laneShift` in `src/basemap.js`).
- **MapLibre GL JS 6** (BSD). De basiskaart zit in het bestand zelf. In de losse versie kan onder Kaartlagen (links
  onderaan) ook een online basiskaart: OpenStreetMap via OpenFreeMap (vectortegels in hetzelfde palet), de luchtfoto
  of de BRT-achtergrondkaart van PDOK (Kadaster, CC BY 4.0). Laadt een bron niet, dan blijft de ingebouwde kaart.
- Voertuigen zijn iconen in de statuskleur, gedraaid in hun rijrichting (trekker met
  oplegger, trekker solo, bakwagen, bus); ver uitgezoomd worden het stippen. Losse
  opleggers zijn een aparte laag (toets o). Geen clusters. De bezorgbussen kunnen van de kaart (Kaartlagen,
  Instellingen, toets b; dan staat er een chip "Bezorgbussen verborgen" in de filterbalk die ze terugzet): alleen
  de kaart en de 3D-wereld, in lijsten, tellers en meldingen tellen ze mee, en een gekozen bus blijft zichtbaar.

## Wat echt is en wat niet

Echt: wegen, land en water (de kust, de meren, rivieren, kanalen en havens uit OpenStreetMap; zie "Kaart en wegen"), de 42 standplaatsen met hun klanten (werkenbijsimonloos.nl,
oktober 2026), de divisies en de ligging van de pauzeplekken op het snelwegennet.

Sinds 4.0 staan de standplaatsen op hun echte adres (uit de vacatures op werkenbijsimonloos.nl, op het BAG-adrespunt
gezet) met hun echte terrein, hoofdgebouw en parkeerrijen; geparkeerde voertuigen en opleggers staan in die rijen.
Ritten gaan naar echte winkels van de klant van de standplaats (4.574 supermarkten en drogisterijen uit Overture Places, zonder de vier vermeldingen op het adres of terrein van een standplaats of DC, zoals "Etos Wognum - Tender 2" op het hoofdkantoor,
binnen 80 km, bezorging binnen 40 km naar woonstraten) en naar echte DC's, fabrieken en groothandels (157), en rijden de
laatste kilometers over echte straten tot de poort of de weg voor de deur. Voor de 3D-wereld zijn er de echte
gebouwen rond elke standplaats en elk DC (Overture Buildings, 16.196 contouren met hoogte), apart geladen. Welke winkel
een vrachtwagen vandaag bedient blijft gesimuleerd (vaste seed); bronnen, aantallen en benaderingen staan in
`src/data/BRONNEN.md`.

In de tweede ronde van 4.0 is de dag geijkt op de cijfers uit het onderzoeksmemo (paragraaf 1.4; schattingen). Een dienst
in de winkeldistributie duurt 8,5 tot 11 uur (mediaan 9,6), netwerk en bulk iets langer (mediaan 10,2 en 10,3 uur) met
minder stops; 53 procent van de diensttijd is rijden, de rest is laden en koppelen aan het dock, wachten, lossen en
pauze. De eerste dienst begint tussen 02:00 en 07:00, 29 procent van de vloot rijdt 's middags of 's avonds een tweede
dienst met een andere chauffeur, en om 10:00 staan 212 van de 1.300 voertuigen op het terrein. Pauzes volgen
EU-verordening 561/2006 (uiterlijk na 4,5 uur rijden 45 minuten, of 15 + 30; hoogstens 9 uur rijden per dienst, op een
kwart van de diensten mag het vandaag 10 uur) en het Arbeidstijdenbesluit vervoer; elektrische voertuigen laden tussen
twee ritten als de volgende rit niet meer in 78 procent van de accu past. Bij elke stop wacht een vrachtwagen eerst (bij
DC's in de ochtend het langst, gemiddeld 42 minuten per truck per dag; `fleet.wachtPerPlek()`). Elke standplaats heeft
docks in de gevel van zijn hal (aantal en plek geschat: `sp.docks`, `sp.dockPlek`, `dockPos()` in `src/places.js`);
koppelen, laden en afkoppelen gebeuren aan een dock, nooit twee voertuigen tegelijk aan hetzelfde, en hal-scherm,
planbord en `fleet.dockPlan(standplaats)` tonen hetzelfde dock. `fleet.eventsOf(voertuig)` geeft de gebeurtenissen van de
dag (vertrek, aankomst, wachten, lossen, koppelen, pauze, laden) en `fleet.pool` de ritten zonder voertuig: 2 tot 5
procent van de ritten per standplaats per dag, elk met een reden (ziek, uitval voertuig, extra rit klant, nieuw uit
OTM5); 's middags komen de ritten van morgen erbij (`fleet.poolAt(T)`). `fleet.dagcijfers()` geeft de kerngetallen.

Zondag (schatting): supermarkten zijn op zondag deels open en krijgen minder ritten; netwerk, bulk en dranken leveren aan
bedrijven en rijden weinig. Op een zondag rijdt per divisie een deel van de voertuigen (`ZONDAG_AANDEEL` in `src/fleet.js`:
winkel 55, bezorging 50, bulk 40, netwerk 30, dranken 20 procent), samen ongeveer 45 procent van een werkdag (gemeten: 711
diensten op zondag 25 oktober en 752 op 1 november tegen 1.626 op een werkdag, 44 en 46 procent; de historie van de pool
rekende al met 55 procent van de open ritten op zondag). De andere voertuigen staan vrij op het terrein ("zondag, vrij" op
het planbord). Welk voertuig rijdt, staat vast per voertuig en datum (`rijdtOpZondag`), en de historie van elk voertuig
(`src/people.js`) maakt dezelfde keuze voor elke zondag: Gisteren op maandag toont die zondag (op Wognum 96 van de 225
voertuigen), niet een lege dag en niet een volle werkdag. Op zondag zijn de open ritten van maandag en de historie van acht
weken die van gewone dagen. Op een werkdag verandert er niets: geen getal uit de reeks van de dag, dezelfde vingerafdruk.
De historie telt terug op de kalender, niet in blokken van 24 uur: de nacht van de zomertijd heeft 23 uur, en eerder
schoof daardoor elke dag ervoor een dag op (op maandag 30 maart 2026 was Gisteren leeg; nu 100 van de 225 op Wognum).

Elke standplaats heeft afdelingen (`sp.afdelingen`, zoals Google Maps de gebouwen van een bedrijf toont): de loods of het
warehouse (met de naam van het DC als dat er staat), de docks ("Docks 1 tot 30"), de poort, de opleggers en het
laadplein, en waar de vacature het noemt ook het kantoor, de garage en de wasstraat (Wognum: hoofdkantoor, warehouse,
garage en wasstraat). Wat er is, komt uit de vacatures (`bron: 'vacature'`); welk gebouw welke functie heeft, staat niet in
open data en is afgeleid uit grootte, vorm en ligging (`bron: 'afgeleid'`; zie `src/data/BRONNEN.md`). Op de kaart staan
ze vanaf zoom 16 als rustige namen op het terrein, een afdeling in een gebouw midden in dat gebouw; in 3D op bordjes.

De vraagkant van de planning is gesimuleerd (`src/inzet.js`, `src/voorkeuren.js`, `src/data/charters.json`). Elke rit in de
pool heeft een prognose: de kans op invulling en op een vertrek binnen het venster, uit acht weken gesimuleerde historie per
standplaats, divisie, dienstdeel en weekdag (`prognose` met zijn basis; `fleet.poolHistorie(standplaats)` geeft de reeksen
voor een grafiek), en een urgentie, de minuten tot het laadvenster (`fleet.poolAt(T)` rekent beide vanaf T). Elke chauffeur
heeft voorkeuren (divisies, dagdelen, weekend, regio, klanten, uren, extra diensten) en een tevredenheid uit de roosterfit
(`fleet.voorkeurenVan`, `fleet.tevredenheid`, `fleet.past`). De flexibele schil: 15 verzonnen charters met contactpersoon,
nummer, opleggers, capaciteit, tarief en betrouwbaarheid (`fleet.CHARTERS`) en 76 zzp'ers, weekendchauffeurs en
oproepkrachten (`fleet.OPROEP`). `fleet.kandidaten(rit, { T, people, toegewezen })` geeft per open rit wie hem kan rijden:
eerst eigen chauffeurs met uren over (rij- en rusttijden getoetst), dan oproepkrachten, dan charters met de juiste
oplegger, elk met redenen in gewone taal, uren, kosten (schatting) en waarschuwingen. `fleet.wijsToe(rit, kandidaat)`
verandert niets: het geeft het blok voor het planbord, een regel voor het logboek en het bericht aan de kandidaat. Namen,
nummers (06 9…, 0229 0…) en e-mailadressen (.example) zijn fictief; tarieven en kansen zijn schattingen.

Het laatste belmoment (`belmoment` in `src/ui/invulling.js`, gesimuleerd): per open rit van vandaag het laatste moment
waarop nog iemand het venster haalt. Per kandidaat van `fleet.kandidaten` (eigen chauffeurs, oproepkrachten en zzp'ers,
charters, allemaal) is dat het eind van het venster min zijn aanrijtijd (van huis: de vraag, reizen en inklokken; een
charter vanaf zijn eigen plaats); wie op dienst is en na zijn dienst kan, vraag je tot het eind van die dienst (dan
koppelt hij meteen). Het belmoment is het laatste van die momenten, op vijf minuten naar beneden; het hangt niet af van de
klok en verandert alleen met het plan. Een half uur ervoor wordt de rit een zaak (zie Meldingen), meteen met prioriteit
hoog: hoog als het belmoment binnen 30 minuten valt of de beste kandidaat onder 60 procent kans op een ja heeft, laag alleen
met meer dan een uur en een kandidaat boven 80 procent, anders middel (`invulling.ritPrio`; zo stond P-8001 op de oefendag
om 05:30 niet meer op laag met nog 25 minuten). In de fase bel is de hoofdknop van de zaak **Vraag ze tegelijk**: de kleinste
groep die samen minstens 90 procent kans op een ja geeft (hoogstens vier), allemaal mensen die het venster halen als je nu
vraagt, de aanbevolen kandidaat eerst en niemand die al de eerste keus van een andere rit is; "Vraag <naam>" staat ernaast
als gewone knop, en na het vragen noteer je het ja van wie het eerst antwoordt. De collega's vullen een
rit op het laatst in, net voordat hij een zaak zou worden, en een rit die niemand meer op tijd kan rijden, vullen ook zij
niet in. Gemeten in de app op maandag 26 oktober 2026 (gesimuleerd, heel Nederland): 14 van de 119 open ritten van vandaag
vult niemand in. Zoals het was, kwam hun zaak pas na het venster: 14 gemist. Nu komt elke zaak terwijl iemand het
venster nog haalt, mediaan 70 minuten voor het eind van het venster; vraagt de planner dan alleen de aanbevolen kandidaat,
dan blijven er naar verwachting 6,9 gemist (met de kans op een ja, een schatting), vraagt hij de groep tegelijk (gemiddeld
3,7 mensen), 1,7. Op de oefendag: 18 zaken, 8,7 met alleen de beste, 2,1 met de groep. Eerder stond hier 1,2 en 1,4: dat
telde de vier beste van elke rit apart, ook als dezelfde mensen bij twee ritten in de groep zaten; nu is elke naam één keer
beloofd.

Gesimuleerd: voertuigen, opleggers, wagennummers, kentekens, chauffeurs en hun
diensten, ritten, koppelingen, ladingen, temperaturen, tijden, vertragingen, wachttijden, de indeling van de docks,
de open ritten in de pool en hun historie, voorkeuren en tevredenheid van chauffeurs, charters en oproepkrachten,
accustanden, berichten, collega's, historie, schades, kosten, lostijden, stroomprijzen
en beoordelingen. Werkgebied, rol, thema, opgeslagen weergaven, overgenomen lostijden,
eigen beoordelingen, de overdrachtstekst en de acties van vandaag (afgehandelde en
uitgestelde meldingen, toegepaste voorstellen, berichten), de 3D-stand, de basiskaart, de statusfilter van de kaart
en per tabel het zoekwoord, de filters en de sortering staan in de browser (localStorage, `sl-*`), zodat herladen
dezelfde toestand geeft.

Vrijgeven (4.1): de berichten, de kanalen, de bevestigingen en het verzenden naar de boordcomputer zijn gesimuleerd. De
ritopdrachten zijn echte OTM5 (getoetst tegen de specificatie in `tests/vrijgeven-check.mjs`), maar gaan nergens heen.

## Bestanden

- `index.html`, `src/main.js`: opbouw, opties van de app-root, laden en de klok van de simulatie
- `src/ui.js`: de app-staat, de beurt van de simulatie (`frame`), selectie, kaart en volgen, routes (`#…`), wizard, sneltoetsen, de context voor de weergaven
- `src/ui/`: de interface 4.0. `nav.js` (linkermenu, topbalk, onderbalk), `overzicht.js`, `kaart.js` (filterbalk, kaartlagen, tijdbalk, panelen, het kaartje bij aanwijzen), `begrippen.js` (één begrippenlijst: onderweg, vertraagd, bij klant, op tijd, te laat en gemist, één zin per begrip; de filterbalk toont de zin, ui-check J11 houdt de getallen overal gelijk), `ritten.js` (ritten en de ritpagina), `zaken.js` (meldingen als zaken: sleutel, eigenaar, deadline, statussen, bord, zaakpagina, logboek), `planbord.js` (svelte-gantt), `planwijzig.js` (het plan aanpassen: een rit verplaatsen of uit de pool inplannen, met dock), `toets.js` (pure toetsregels, met `tests/toets.test.mjs`), `inplannen.js` (toetsen, uitvoeren, berichten en logboek, gedeeld door planbord, zaken en assistent), `assistent.js` en `ai.js` (de Assistent, met de Claude API als `data-ai` op de root staat), `invulling.js` (de vraagkant op de data: prognose, kandidaten, toewijzen, de flexibele schil, voorkeuren), `openritten.js` (Open ritten en de dialoog Rit inplannen), `poule.js` (Charters en oproepkrachten en hun pagina's), `portret.js` (het beeld in de kop van een pagina), `zoek.js` (MiniSearch), `layers.js` (popovers, menu's, het kaartje bij een nummer, dialogen, bevestigen, toasts; Floating UI), `table.js` (de tabel met venster, filters, kolomkeuze, selectie, csv en menu), `tijdreeks.js` (uPlot), `charts.js` (kleine SVG-grafieken), `metrics.js` (kerngetallen door de dag), `rapporten.js`, `instellingen.js`, `acts.js` (wat de planner vandaag deed, `sl-acties`), `base.js` (opmaak, statuswoorden, badges, statusbalk en slimme knoppen) en `taal.js` (een ongeldige taalcode van de browser houdt de app niet tegen)
- `src/views.js`: standplaatsen met vertrekbord en dockplanning, hal-scherm, klantweergave
- `src/sheets.js`: voertuig-, oplegger- en persoonspagina's (statusbalk, slimme knoppen, tabbladen, logboek) met rechten per rol
- `src/tables.js`: tabellen voertuigen, opleggers en chauffeurs, lostijden, laden (met de grafieken per kwartier), pauzeplekken
- `src/people.js`: chauffeurs en hun dienst, planners per standplaats (een per 15 tot 25 voertuigen, over vroeg, dag en avond), voertuighistorie zonder vaste wagen, kerngegevens, opleggergegevens (APK, ATP, onderhoud)
- `src/rest.js`, `src/energy.js`, `src/lostijden.js`: pauzeplekken, laadplanner, lostijden
- `src/inzet.js`, `src/voorkeuren.js`: de flexibele schil (charters, oproepkrachten, kandidaten, toewijzen) en de voorkeuren en tevredenheid van chauffeurs (puur, gesimuleerd); `src/verdeel.js`: één toewijzing over alle open ritten van een dag (Hongaars en gretig; puur, zonder imports, met `tests/verdeel.test.mjs`)
- `src/map.js`, `src/fleet.js`, `src/roads.js`, `src/places.js`: kaart (iconen met koers, lagen voor voertuigen en losse opleggers, de 3D-stand), simulatie (voertuigen, opleggers, diensten, koppelen en wisselen, docks, wachttijd, gebeurtenissen, pool), wegennet, standplaatsen, rollen en rechten
- `src/scene3d.js`: de 3D-wereld (three.js in een eigen MapLibre-laag: voertuigen, opleggers, depots, bomen, huizen, klik en aanwijzen)
- `src/icons.js`, `src/style.css`: iconen en het ontwerpsysteem
- `src/data/`: `graph.json` (routeergraaf), `roads_display.json` (met wegnummers en straatnamen in `lab`), `water.json`, `provinces.json`, `urban.json`, `places.json` (standplaatsen met adres, terrein, parkeerrijen, docks en afdelingen), `klanten.json` (winkels en DC's), `toegang.json` (de laatste kilometers), `buildings.json` (gebouwen voor 3D, via `src/buildings.js` en alleen dynamisch geladen), `charters.json` (verzonnen charters), `BRONNEN.md`
- `tests/map-check.mjs`: de kaart in de browser (terugval en online bronnen nagebootst, ingebed zonder verzoeken naar buiten, het eerste beeld zonder zee alleen, minder beweging, rechts rijden op de rechterstrook, land en zee, water op het beeld, afdelingen, framerate)
- `tests/data-check.mjs`: controle van de echte plekken en ritten en van de geijkte dag (diensten, rij- en rusttijden, accu, docks, wachttijd, gebeurtenissen, pool), van de afdelingen en van de vraagkant (prognose, historie, voorkeuren, charters en oproepkrachten zonder echte namen, kandidaten, toewijzen); `tools/ct4/`: de verwerking van de data (Overture, vacatures, docks, afdelingen, charters)
- `src/otm5.js`: de vertaling tussen de gesimuleerde dag en OTM5 (Open Trip Model 5.9.0): `uitFleet` (onze vorm), `naarOtm5` en `vanOtm5`; puur, de basis voor de import van echte ritten (zie `rapporten/simon-loos-control-tower/echte-data-en-otm5.md`). Sinds 4.1 maakt `src/ui/ritopdracht.js` er de ritopdracht mee; `vanOtm5` blijft buiten de bundel
- `src/ui/vrijgeven.js`, `src/ui/bericht.js`, `src/ui/ritopdracht.js`: Vrijgeven (4.1), het bericht aan de chauffeur en de ritopdracht naar de boordcomputer; `tests/vrijgeven-check.mjs` en `tests/otm5/valideer.mjs` (de validator uit de specificatie, voor tests)
- `tests/otm5-check.mjs` (`npm run test:otm5`): de vertaling tegen de officiële OTM5-specificatie (vastgezet in `tests/otm5/`), tegen het planbord en de gebeurtenissen van de app, en heen en terug; `--bestand pad.json` controleert een echt OTM5-bestand
- `tests/`: `verify.mjs` en `ui-check.mjs` (de interface), `toets.test.mjs`, `data-check.mjs`, `map-check.mjs`, `3d-check.mjs` (zie "Controles")
- `vite.config.js` (één bestand), `vite.site.config.js` (bundel voor een site)
- Bibliotheken: MapLibre GL JS (BSD-3), three.js (MIT), svelte-gantt 4.5 (MIT, het planbord), MiniSearch 7.2 (MIT, zoeken), Floating UI 1.8 (MIT, plaatsen van popovers en kaartjes), uPlot 1.6 (MIT, tijdreeksen). Geen lettertypen of iets anders van buiten
- `tools/`: dataverwerking (Overture), `artifact.cjs` en `sync-safetail.mjs` (de bundel naar de SafeTail-repo)
