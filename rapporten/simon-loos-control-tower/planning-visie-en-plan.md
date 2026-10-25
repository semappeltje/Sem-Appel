# Control Tower: planning als werkproces. Visie, plan en vragen

25 oktober 2026. Vastgelegd op verzoek van Sem, als vaste opdracht voor elke volgende ronde.

## De opdracht van Sem (letterlijk)

"Je hebt toch kennis over wat die systemen en processen inhouden. Je kan toch zien wat er allemaal bij komt
kijken bij het plannen van die ritten en welke huidige systemen bij bedrijven worden gebruikt, en wat de
werkprocessen inhouden, wat er moet gebeuren. Daarom wil ik dat je kritisch nadenkt over hoe we dit echt goed
kunnen invullen. Welke subsystemen, applicaties, processen gebruiken andere bedrijven, wat kunnen we daarvan
leren. Hoe kunnen we het werk van de planners leuker maken en makkelijker, of uiteindelijk minder afhankelijk van
planners worden. Dit systeem focust zich op dit gedeelte: alles met planning en actuele auto's en ritten en
prognoses. Straks moet er echte data in, dat zal heel veel zijn. Zeg wat je nodig hebt om echt goed te kunnen
draaien of een proef in het echt te kunnen draaien. Zeg welke verbeteringen er moeten worden doorgevoerd. Wees
kritisch. Kom met een plan, en met wat we concreet kunnen doorvragen."

Eerder die dag: "Je ziet de planning vanuit chauffeursperspectief, maar niet de ritten die moeten worden
ingevuld. Dus de bak met openstaande ritten, en daar prognoses bij: kans op invulling vanuit historische data. En
welke chauffeur welke ritten fijn vindt en welke tijden, zodat we de tevredenheid kunnen verhogen. En waar is de
poule met charters en nummers? En zzp- of weekendchauffeurs, oproepkrachten."

## Wat planning bij een vervoerder als Simon Loos echt is

Het is geen scherm, het is een keten van vier lagen die elkaar voeden. De control tower zit in laag 3, maar is
alleen bruikbaar als 1, 2 en 4 erin zitten.

1. **Tactisch (weken vooruit).** Capaciteit per standplaats per dag: hoeveel diensten, welke voertuigen, welke
   opleggers, welke chauffeurs met welk rooster (cao beroepsgoederenvervoer: gemiddeld 48 uur per week,
   rustdagen, weekendregels), onderhoud en APK, de contracten met charters, de inzet van elektrische trekkers
   per zero-emissiezone. Bij winkeldistributie maakt de retailer het leveringsschema (AH stuurt donderdag de
   capaciteitsritten); de vervoerder plant hier vooral middelen.
2. **Operationeel (de dag ervoor).** De ritten komen binnen (AH via OTM5, Open Trip Model, elke middag
   definitief; andere klanten via EDI, portaal, mail of Excel). Daaruit bouwt de planner diensten: ritten aan
   elkaar koppelen tot een dienst van 9 tot 11 uur binnen rij- en rusttijd (EU 561/2006), laadslots bij het DC,
   opleggersoort (koel, vries, droog), zero-emissie waar vereist; dan chauffeurs toewijzen (bevoegdheid, uren,
   voorkeur, eerlijkheid), dan voertuigen en opleggers; de gaten vullen met de flexibele schil (eigen
   oproepkrachten, zzp'ers, charters); publiceren naar de chauffeurs en bevestigen aan de klant.
3. **Actueel (de dag zelf).** Volgen, ETA tegen venster, uitzonderingen (vertraging, pech, een zieke chauffeur
   om 04:00), herplannen (wisselen, pool, charter bellen), docks en opleggerwissels, wachttijd vastleggen, uren
   van de chauffeur bewaken (tachograaf), incidenten, overdracht tussen planners, communicatie met winkel en
   DC. Dit is de control tower.
4. **Achteraf.** Uren en loon, afrekening met de klant (wachttijd, extra ritten), KPI's (op tijd, kilometers per
   rit, lege kilometers, kosten per rit, charteraandeel), en leren: gepland tegen gereden (lostijden, wachttijd,
   rijtijd) terug naar laag 1 en 2.

De fout in de demo tot nu: alles draait om laag 3 vanuit het voertuig. De vraagkant (de ritten die ingevuld
moeten worden, laag 2) en de flexibele schil ontbraken. Een planner begint zijn dag niet bij een voertuig maar bij
"wat staat er open en wie kan dat doen".

## Welke systemen bedrijven gebruiken, en wat we ervan leren

Bij Simon Loos zelf (uit de onderzoeken): ORTEC met Navitrans (planning en TMS), Trimble FleetXPS met e-CMR
(boordcomputer), Navision en ORD in Maasdam, Simacan en Excel in Zaandam (de control tower van AH), tachograaf.
Elders in de sector: ORTEC Routing en Dispatch, PTV, Descartes, Quintiq (dienstbouw en roostering), Transporeon
(tijdslots bij DC's, vrachtuitwisseling, charters), Simacan en Shippeo (zichtbaarheid en ETA naar de klant),
Samsara en Trimble (telematica), TransFollow (e-CMR), Timefold en VROOM (rekenmotoren), Dyflexis en AFAS (rooster,
verzuim, HR), tachograafanalyse, laadplanning voor e-trucks (Milence, netaansluiting).

Wat we leren:
- **De werkvoorraad is het hart.** In elk TMS is er een pool van ritten zonder middelen; het planbord is de
  uitkomst. De planner werkt van pool naar bord, met directe toetsing (cao, EU 561, venster, opleggersoort,
  accu, dock).
- **Dienstbouw is het echte rekenwerk.** Niet "welke truck", maar "welke keten van ritten past in één dienst
  voor deze chauffeur". Dat is een optimalisatieprobleem (Timefold, ORTEC); de planner kiest uit voorstellen
  met uitleg.
- **De flexibele schil is een eigen proces.** Charters en oproepkrachten hebben beschikbaarheid, tarieven,
  betrouwbaarheid en een contactpersoon; het bellen en bevestigen is nu handwerk en hoort in het systeem.
- **Eén waarheid, geen Excel ernaast.** Zaandam plant met Excel naast Simacan. Elke kopie veroorzaakt fouten en
  belwerk.
- **Standaarden voor data.** OTM5 is de Nederlandse standaard voor ritdata; wie die spreekt, sluit aan op AH,
  Simacan en de meeste TMS'en. Dat is de ingang voor echte data.
- **Uitzonderingen eerst.** Simacan en Samsara tonen niet alles, maar wat afwijkt. Groen vraagt niets.
- **Leren van gereden tegen gepland.** Lostijden, wachttijd en rijtijd per adres en dagdeel maken de volgende
  planning beter; dat is de brug van laag 4 naar laag 2.

## Het werk van de planner leuker en lichter maken, en minder afhankelijk worden

- Routine automatiseren: het systeem bouwt 's nachts het plan voor morgen en stelt voor; de planner beoordeelt
  en grijpt in. Doel: de "touch rate" (het deel van de ritten dat de planner nog aanraakt) omlaag van bijna
  alles naar de uitzonderingen.
- Regels ingebouwd: cao, EU 561, vensters, opleggersoort, accu en laadtijd, docks. Geen handmatig narekenen,
  geen boetes achteraf.
- De flexibele schil in het systeem: beschikbaarheid van oproepkrachten en charters, één klik bellen of mailen,
  bevestiging terug, kosten direct zichtbaar.
- Voorkeuren en eerlijkheid: wie welke ritten en tijden wil, rotatie van de onaantrekkelijke diensten, een
  tevredenheidsbeeld per standplaats. De Indeed-klacht (planning, afspraken, rusttijd) is precies dit.
- Zelfbediening: chauffeurs geven beschikbaarheid en voorkeuren door en ruilen diensten binnen de regels;
  klanten zien hun ETA; charters registreren capaciteit.
- Prognoses: vraag per dag en week (seizoen, acties, weekdag), uitval (verzuim), wachttijd per DC, kans op
  invulling per open rit uit de historie.
- Overdracht en logboek: elke beslissing met reden; een nieuwe planner neemt het over zonder bellen.

Minder afhankelijk van planners betekent niet "zonder planners": het betekent dat één planner meer kan
overzien (nu 15 tot 25 trucks, Slimste), dat de nachtdienst niet meer alleen van het geheugen van één persoon
afhangt, en dat de kennis in het systeem zit in plaats van in een Excel op een laptop.

## Wat er nodig is om echt te draaien of een proef te doen

**Data (de kern):**
- Ritorders per klant: OTM5-export of API (AH), anders exports uit ORTEC en Navitrans: rit, stops, vensters,
  laadeenheden, opleggersoort, klant, tarief.
- De vloot: kentekens, type, bouwjaar, aandrijving, bereik, opleggers en hun soort, onderhoudsstatus (uit
  Navitrans of RDW).
- Chauffeurs: geanonimiseerd (een id), bevoegdheden, contracturen, standplaats, rooster, voorkeuren als die
  ergens staan.
- Historie van 8 tot 12 weken: gepland tegen gereden (vertrek, aankomst, lossen, wachten), ziekmeldingen,
  charterinzet, uitval. Zonder historie geen prognose.
- Telematica: posities elke 30 tot 60 seconden (Trimble FleetXPS, API of export), tachograafdata (rij- en
  rusttijd per chauffeur).
- Standplaatsen en DC's: adressen, docks, openingstijden, slotregels, terreinregels; winkels met vensters.
- Charters en oproepkrachten: lijst, contact, tarieven, afspraken.

**Afspraken:** een verwerkersovereenkomst; een AVG-toets (posities en uren zijn persoonsgegevens; doelbinding,
bewaartermijn); de OR (een rij- of prestatiebeeld zonder regeling met de OR is uitgesloten); een pilotplan met
één standplaats, vier tot zes weken, eerst in schaduwstand (het systeem stelt voor, planners beslissen), met
meetpunten: op tijd, wachttijd, charteraandeel, uren planner per plan, touch rate, tevredenheid.

**Techniek (de demo is één bestand in de browser; dat kan niet met echte data):** een backend met inname
(OTM5, telematica, tacho), een database (PostgreSQL met tijdreeksen), een API en echte tijd (WebSocket), inloggen
met rollen (SSO van Simon Loos), audit, een rekenmotor voor dienstbouw en voorstellen (Timefold of VROOM),
eigen kaarttegels (PMTiles van Nederland, geen externe dienst), monitoring en back-ups, hosting in de EU.

## Verbeteringen aan het huidige systeem, op volgorde

1. Open ritten als vertrekpunt, met prognose, kandidaten (eigen, oproepkracht, charter) en toewijzen in één klik.
   Dienstbouw: ritten tot diensten ketenen met toetsing. (Nu in bouw in 4.0, gesimuleerd.)
2. Datamodel op OTM5: rit, stop, actie, voertuig, actor, venster, laadeenheid. Alles wat we nu "bedenken"
   (fleet.js) krijgt de vorm waarin echte data binnenkomt; dan is de import een vertaling, geen herbouw.
3. Toetsregels volledig en controleerbaar: EU 561 (dag, week, twee weken, weekrust), de cao, vensters, docks,
   accu; als pure functies met tests, per regel uitlegbaar.
4. De flexibele schil als proces: beschikbaarheid, aanvraag, bevestiging, kosten, betrouwbaarheid; nummers in
   het systeem.
5. Voorkeuren, eerlijkheid en tevredenheid; zelfbediening voor chauffeurs (beschikbaarheid, ruilen).
6. Leren van gereden tegen gepland: lostijden, wachttijd, rijtijd per adres en dagdeel; prognoses per week.
7. Een rekenmotor voor het nachtplan (schaduwstand), met de touch rate als meetlat.
8. Toestand buiten de browser: opslag, meerdere gebruikers, rollen, audit, overdracht.
9. Koppelingen: OTM5 in en uit, telematica, tacho, HR-verzuim, ERP; en de klantlink (ETA naar de winkel).
10. Prestaties en schaal: 1.300 voertuigen, ruim honderdduizend posities per dag, maanden historie.

## Wat we concreet moeten doorvragen (bij de directie, de planners en ICT)

1. Welk systeem houdt wat bij, per standplaats en divisie: ORTEC, Navitrans, Trimble, Simacan, Navision, ORD,
   Excel? Wie beheert het, en kunnen we exports of API-toegang krijgen?
2. Hoe komen de ritten per klant binnen (OTM5 van AH? EDI, portaal, mail, Excel?), op welke tijden, en hoe vaak
   veranderen ze daarna nog?
3. Hoe werkt dienstbouw nu: wie doet het, wanneer, met welk hulpmiddel, hoe lang duurt het, wat is handwerk, en
   welke regels worden echt toegepast (cao, EU 561, weekendrust)?
4. Hoeveel planners per standplaats en per ploeg, waar gaat hun tijd aan op, wat gaat per telefoon of
   WhatsApp, wat is het grootste dagelijkse gedoe, en wat zou hun werk leuker maken?
5. Hoe worden gaten gevuld: eigen flexpool, zzp'ers, charters; hoeveel per week, tegen welke kosten, wie
   beslist, hoe wordt het geregeld en bevestigd?
6. Chauffeurs: hoe ver vooruit staat het rooster vast, worden voorkeuren ergens vastgelegd, wat gebeurt er bij
   een ziekmelding om 04:00, wat zeggen chauffeurs zelf (de Indeed-klachten)?
7. DC's en docks: slots (Transporeon?), wachttijden per DC, opleggerpools en terreinregels bij AH Zaandam, Jumbo
   Raalte en Beilen, Plus Oss, Lidl; wie betaalt wachttijd?
8. Tachograaf en cao: welk hulpmiddel bewaakt de uren, hoe gaan ze met overtredingen om, welke regels gelden
   echt per standplaats?
9. Elektrisch: hoe wordt laden gepland, wat is de netaansluiting per standplaats, welke zero-emissiezones
   gelden, wie bewaakt de accu op de dag?
10. Geld en meetlat: wat wordt nu gemeten (op tijd, kilometers per rit, kosten per rit, charteraandeel), en
    waar zit de business case: minder charters, minder wachten, minder planneruren, minder verloop?
11. AVG en OR: wat is de status van het gebruik van posities en uren, is er een verwerkersovereenkomst, wat eist
    ICT (beveiliging, hosting, SSO)?
12. De proef: welke standplaats, welke planners, welke periode, wie is de opdrachtgever, en wat is "geslaagd"?

## Afspraak voor elke volgende ronde

- Elke functie begint bij het werkproces van de planner (laag 2 en 3), niet bij een scherm of een kaart.
- Elke verzonnen waarde wordt zo gemaakt dat echte data hem kan vervangen (OTM5-vorm, een bron, een datum).
- Elke ronde noemt wat er nodig is om het met echte data te laten draaien.
