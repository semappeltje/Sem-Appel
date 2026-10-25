# Van demo naar het planningssysteem van Simon Loos: wat de huidige systemen doen, wat we bouwen, hoe we testen en uitfaseren

25 oktober 2026. Vervolg op `planning-visie-en-plan.md`, op verzoek van Sem: "Denk na over wat deze systemen
precies doen en hoe we het nabouwen of een systeem maken dat het geheel goed doet, met tests en later rustig
uitfaseren." Wat hier over de systemen van Simon Loos staat, komt uit de onderzoeken in deze repo en uit algemene
kennis van die producten; de details per systeem (welke modules in gebruik, contracten, koppelingen) zijn
vragen voor de directie en ICT (onderaan). Cijfers zijn schattingen tenzij anders gezegd.

## 1. Wat de systemen precies doen

| Systeem | Wat het doet | Rol bij Simon Loos (uit de onderzoeken) | Wat we ervan houden, wat we vervangen |
|---|---|---|---|
| **Navitrans** (TMS op Microsoft Dynamics 365 Business Central) | Orders en ritten vastleggen, een planbord per middel, dispatch naar de boordcomputer, tarieven, facturatie per klant, afrekening chauffeurs, stamgegevens van vloot en klanten | Het systeem van vastlegging: orders, ritten, facturen | **Houden** als bron voor orders en als facturatie. Het planbord en de dispatch nemen we over, de facturatie niet |
| **ORTEC** (Routing and Dispatch, op Navitrans) | Rekenmotor: ritten plannen met vensters, voertuigtypes en chauffeursregels, dienstbouw, wat-als, kosten, KPI's | Planning en optimalisatie naast Navitrans | **Vervangen** op termijn door onze eigen dienstbouw en voorstellen (Timefold), eerst in schaduw naast ORTEC |
| **Trimble FleetXPS** (boordcomputer, nu onder Platform Science; nakijken) | Telematica (positie, CAN-data), chauffeursapp (ritinstructies, statussen, navigatie, berichten), e-CMR, tachograaf op afstand, uren | Posities, statussen, e-CMR, tacho | **Houden** als bron. Wij lezen posities, statussen en tacho; wij sturen ritten en berichten. Geen eigen boordcomputer |
| **Simacan Control Tower** | Zichtbaarheid en ETA per stop met verkeer, uitzonderingen, delen met winkels en retailer, hub-zicht; de toren van Albert Heijn | AH kijkt hierin mee; Zaandam plant eromheen met Excel | **Houden** als de toren van de klant; wij voeden hem (OTM5) en halen ETA's en afwijkingen op. Onze toren is die van de vervoerder: middelen, mensen, de flexibele schil |
| **Navision** (Dynamics NAV, de ERP onder Navitrans) | Financiën, inkoop, facturatie, basis-HR | Boekhouding | **Niet aanraken.** Een ERP vervangen is een ander project met een ander risico |
| **ORD** (Maasdam) | Lokaal rit- of ordersysteem van een overgenomen vestiging (nakijken) | Alleen Maasdam | **Uitfaseren** als tweede stap, via een adapter naar ons model |
| **Excel** (Zaandam en elders) | Dienstbouw, roosters, charterlijsten, telefoonnummers | De werkelijkheid naast de systemen | **Als eerste uitfaseren.** Elk Excel-blad is een functie die in de systemen ontbreekt; dat is onze functielijst |
| **Transporeon** (sector) | Tijdslots bij DC's, vrachttoewijzing aan vervoerders, zichtbaarheid | Mogelijk bij DC's van klanten (nakijken) | Koppelen voor slots; niet nabouwen |
| **PTV** (sector) | Afstanden en rijtijden voor vrachtwagens (hoogte, gewicht, tol), route-optimalisatie | Onbekend | Vervangen door een eigen routeringsdienst op OpenStreetMap (OSRM of Valhalla met vrachtwagenprofiel) of inkopen |
| **Quintiq** (sector) | Roosteren en plannen onder cao-regels, grote planningsvraagstukken | Niet bij Simon Loos | Inspiratie voor de tactische laag; wij doen het met Timefold |
| **Timefold** (open source, Apache-2.0) | Rekenmotor voor dienstbouw, roosteren en ritten, met uitleg per regel | Nog niet | **Inzetten** als onze rekenmotor, achter een eigen laag van regels |
| **Dyflexis** (sector) | Roosters, beschikbaarheid, verlof, uren, cao-toets, app voor medewerkers | Niet bekend | Inspiratie voor zelfbediening van chauffeurs; onze eigen laag voor beschikbaarheid en voorkeuren, HR blijft in HR |
| **Tachograafanalyse**, **TransFollow** (e-CMR), **Milence** en laadplanning, **NDW** (verkeer), **OTM5** | Uren en overtredingen; digitale vrachtbrief; laden; verkeersdata; de standaard voor ritdata | Tacho via Trimble; OTM5 via AH | Koppelen. OTM5 wordt de vorm van ons eigen model |

De kern van wat ontbreekt en wat wij bouwen: de **werkvoorraad en dienstbouw met toetsing**, de **flexibele
schil**, de **control tower van de vervoerder** (middelen, mensen, uitzonderingen, overdracht), **voorkeuren en
zelfbediening**, **prognoses en de leerlus**. Alles wat een bron is (orders, posities, tacho, financiën) blijft
waar het is tot het bewezen vervangen is.

## 2. Nabouwen of inkopen: de keuzes

- **Niet nabouwen:** de ERP en de facturatie (Navision, Navitrans), de boordcomputer en de chauffeursapp
  (Trimble), de e-CMR, de toren van de klant (Simacan), de kaartdata (OpenStreetMap, PDOK), de rekenkern van
  een solver (Timefold), de wegrouting voor vrachtwagens (OSRM of Valhalla, of PTV inkopen). Dat zijn
  volwassen producten met jaren ontwikkeling; de waarde van ons systeem zit niet daar.
- **Wel bouwen:** het datamodel op OTM5, de inname en adapters, de werkvoorraad, de dienstbouw als
  gebruikerservaring op de solver, de regels (cao, EU 561, vensters, docks, accu) als pure, geteste modules, de
  flexibele schil, de control tower met zaken en overdracht, prognoses en de leerlus, de chauffeurskant
  (beschikbaarheid, voorkeuren, bevestigen) via bestaande kanalen (de tablet of WhatsApp Business), de
  klantlink, rapporten en de meetlat (touch rate). Hier zit het verschil.
- **De demo is geen prototype van de techniek, wel van de ervaring en van de testbank.** Eén bestand in de
  browser draagt geen echte data; de simulator erin is wél goud: hij wordt de digitale tweeling waarop we het
  echte systeem testen voordat er een echte rit in gaat (zie 4).

## 3. De architectuur van het doelsysteem

**Datamodel.** OTM5 als kern: Trip, Stop, Action (laden, lossen, wachten, koppelen), Vehicle, Trailer, Actor
(chauffeur, charter, klant), Location, TimeWindow, Constraint, Event. Daarbovenop onze eigen begrippen: Dienst
(een keten van ritten voor één chauffeur), Werkvoorraad, Zaak, Voorstel, Beschikbaarheid, Voorkeur, Prognose.
Alles met een bron en een tijdstempel. Het plan wordt bijgehouden als een reeks gebeurtenissen (event sourcing):
elke wijziging is een feit met wie, wanneer, waarom. Dat geeft audit, overdracht, terugspoelen en de touch rate
gratis.

**Lagen.**
1. *Inname en adapters:* OTM5 (AH), exports en API's van Navitrans en ORTEC, telematica en tacho van Trimble,
   verzuim uit HR, slots van DC's, verkeer van NDW, charters en oproepkrachten. Elke bron een adapter met een
   contracttest; elke adapter kan uit zonder dat de rest stopt.
2. *Opslag:* PostgreSQL voor het plan en de stamgegevens, een tijdreekstabel voor posities (TimescaleDB), een
   objectopslag voor documenten, en de gebeurtenissenlog. Bewaartermijnen per gegevenssoort (AVG).
3. *Regels:* EU 561/2006 (dag, week, twee weken, pauzes, weekrust), de cao beroepsgoederenvervoer, vensters,
   opleggersoort, docks, accu en laadtijd, zero-emissiezones: pure functies met een regelnummer en een
   leesbare uitleg, los van de interface en los van de solver, met tests uit de wetteksten.
4. *Rekenen:* Timefold voor dienstbouw en toewijzen (met onze regels als constraints), een routeringsdienst
   voor afstanden en rijtijden met vrachtwagenprofiel, een prognosemodule (wachttijd per DC en uur, vraag per
   week, verzuim, kans op invulling) die begint met eenvoudige statistiek uit de historie en pas later leert.
5. *Diensten en echte tijd:* een API, een gebeurtenissenstroom (WebSocket) naar de schermen, taken voor het
   nachtplan en de prognoses, berichten naar chauffeurs en charters, de klantlink.
6. *Schermen:* de control tower zoals in 4.0 (werkvoorraad, planbord, zaken, hal, kaart, 3D), de
   chauffeurskant via de tablet of WhatsApp, een klantpagina, rapporten.
7. *Beheer:* inloggen via het SSO van Simon Loos, rollen (planner, regiomanager, directie, HR, hal), audit,
   monitoring, back-ups, hosting in de EU, een testomgeving naast productie.

**Schaal (schatting voor 1.300 voertuigen):** 0,5 tot 1 miljoen posities per dag (één positie per 30 tot 60
seconden, gemiddeld 6,2 uur rijden per voertuig; gecorrigeerd na het OTM5-onderzoek), 3.000 tot 4.000 ritten per
dag, 15.000 stops, maanden historie: tientallen gigabytes per jaar, een paar na compressie. Dat is bescheiden voor
PostgreSQL met een tijdreeksuitbreiding op één goede server met een reserve; geen bijzondere infrastructuur nodig.

## 4. Testen: hoe we weten dat het klopt voordat het ergens om gaat

1. **Regeltests uit de bron.** Elke regel (EU 561, cao) met de voorbeelden uit de verordening en de cao-tekst
   als testgevallen; een jurist of de HR-afdeling kijkt de lijst na. Een regel zonder test bestaat niet.
2. **Pariteitstests op echte historie.** Acht tot twaalf weken echte ritten en diensten door ons systeem halen:
   herkent het elk plan als geldig, telt het dezelfde kilometers en uren, vindt het dezelfde overtredingen die
   de tachograafanalyse vond? Verschillen zijn fouten bij ons of bij hen; beide zijn waardevol.
3. **De simulator als testbank en digitale tweeling.** De simulatie uit de demo (1.300 voertuigen, echte
   adressen, echte wegen, een realistische dag) wordt de omgeving waarin het echte systeem draait alsof het
   echt is: ziekmeldingen om 04:00, pech op de A7, een DC dat te laat opengaat, een charter die afzegt. Elke
   nieuwe versie moet die dagen doorstaan. Dit is wat luchtvaart en energiebedrijven doen voordat iets live gaat.
4. **Contracttests per koppeling.** OTM5-berichten van AH, exports van Navitrans, posities van Trimble: vaste
   voorbeeldbestanden, en een alarm als de bron van vorm verandert.
5. **Belastingtests.** Een dag met de volle vloot en een piek (vrijdag voor de kerst) in de testomgeving.
6. **Schermtests.** De dag van de planner als Playwright-scripts (zoals nu), op 1440 en 390 px, met toetsenbord
   en zonder beweging.
7. **Acceptatie door planners.** Schaduwstand: het systeem plant, de planner plant, de verschillen worden
   dagelijks besproken. Pas als vier weken lang het plan van het systeem niet slechter is op kilometers, kosten,
   overtredingen en op tijd, wordt het leidend. Meetlat: touch rate, uren planner per plan, op tijd, wachttijd,
   charteraandeel, tevredenheid.

## 5. In stappen ernaast zetten en rustig uitfaseren

Het patroon is de wurgvijg: het nieuwe groeit om het oude heen, neemt functie voor functie over, en het oude
wordt pas weggehaald als het aantoonbaar niets meer doet. Elke stap heeft een weg terug.

| Stap | Wat | Naast wat | Klaar als | Wat uit kan |
|---|---|---|---|---|
| 0. Verkennen (4 tot 6 weken) | Interviews met planners en chauffeurs, een dienst meelopen op Wognum en Zaandam, de systemen en koppelingen in kaart, voorbeelddata, AVG en OR, de meetlat | Alles blijft | De functielijst (elk Excel-blad), de datalijst, de pilotafspraak | Niets |
| 1. Lezen en kijken (10 tot 14 weken) | Inname van OTM5, Navitrans-exports, posities en tacho; de control tower op één standplaats, alleen lezen; zaken en overdracht | ORTEC, Navitrans, Excel, Simacan | Planners kijken er elke ochtend in; de pariteitstests slagen | Niets |
| 2. Dienstbouw in schaduw, dan leidend (14 tot 22 weken) | Werkvoorraad, dienstbouw met toetsing, voorstellen; eerst schaduw naast ORTEC en Excel, dan leidend op één standplaats; dispatch terug naar Navitrans en Trimble | ORTEC (schaduw), Excel | Vier weken niet slechter dan het handplan; planners willen niet terug | Excel voor dienstbouw op die standplaats |
| 3. De flexibele schil en de chauffeurskant (8 tot 12 weken) | Charters en oproepkrachten in het systeem, beschikbaarheid en voorkeuren, bevestigen via de tablet of WhatsApp, voorkeursbod | Telefoon en Excel | Elke inzet loopt via het systeem | Charterlijsten in Excel, belrondes |
| 4. Tactisch en prognoses (8 tot 12 weken) | Capaciteitsradar, wachttijdradar, roosters weken vooruit met cao-toets, laadplanning voor e-trucks | Roosters in Excel of HR | Het weekplan komt uit het systeem | Roosterbladen |
| 5. Uitrol en klantlink (in golven, 12 tot 18 maanden) | Standplaats voor standplaats, in volgorde van baat; ETA-link naar winkels; rapporten voor de directie | ORTEC per standplaats | Alle standplaatsen leidend | ORTEC-dispatch; ORD in Maasdam via een adapter |
| 6. Opruimen | Contracten opzeggen in de volgorde van de opzegtermijnen, data archiveren, adapters weghalen, documentatie | | Alleen Navitrans (orders, facturatie), Trimble, Simacan (klant) blijven | ORTEC, ORD, alle Excel |

Voorwaarden om zonder schade te kunnen stoppen bij elke stap: het oude systeem blijft tot de stap erna
bewezen is; dubbel draaien kost tijdelijk meer werk en dat wordt vooraf gezegd; opzegtermijnen van contracten
bepalen de volgorde van stap 6, niet andersom; de klant (AH) wordt vooraf meegenomen omdat Simacan hun toren is.

## 6. Kritische kanttekeningen

- **Het grootste risico is niet techniek maar adoptie.** Planners die twintig jaar met een eigen Excel werken,
  stappen alleen over als het systeem hun dag lichter maakt vanaf dag één. Daarom stap 1 (alleen kijken) en de
  schaduwstand, en daarom de ochtendbriefing en de overdracht als eerste functies.
- **Data is nooit schoon.** Adressen, docks, opleggersoorten en voorkeuren staan nergens volledig. Reken op een
  maand opschonen per standplaats en bouw het systeem zo dat het fouten toont in plaats van verbergt.
- **Mensen en wet.** Posities en uren zijn persoonsgegevens; een beeld per chauffeur vraagt de OR; het
  voorkeursbod is juist iets wat de OR zal willen. Vroeg aan tafel, niet achteraf.
- **De klant bepaalt de ingang.** AH stuurt OTM5 en kijkt in Simacan; ons systeem moet daar netjes in passen,
  anders wordt het een eiland.
- **Niet alles tegelijk.** De verleiding is groot om ook facturatie, HR en onderhoud mee te nemen. Niet doen:
  elk daarvan heeft een eigenaar, een leverancier en een risico. Eerst de planning en de dag.
- **Wie en hoe lang (schatting).** Sem bouwt het zelf via SafeTail, met AI als versneller zoals bij de demo, en
  een tweede ontwikkelaar die het systeem kent als achtervang, het liefst van Simon Loos zelf. Heeft Simon Loos eigen
  ontwikkelaars, dan stuurt Sem hen aan. Een proef van stap 0 tot en met 2 op één standplaats vraagt
  daarnaast een planner als domeineigenaar, iemand van ICT en de OR op afstand, en ongeveer zeven tot tien maanden.
  De uitrol gaat in golven, met per regio een planner als kartrekker. De kosten en baten staan in het voorstel,
  hoofdstuk 6.

## 7. Wat we moeten doorvragen, specifiek over de systemen

1. Welke modules van Navitrans en ORTEC zijn echt in gebruik, per standplaats; wat doet ORD in Maasdam; waar
   staat elke Excel die een proces draagt?
2. Welke koppelingen bestaan al (Navitrans naar Trimble, AH naar Simacan, OTM5), wie beheert ze, en zijn er
   API's of alleen exports?
3. Contracten en opzegtermijnen van ORTEC, Navitrans, Trimble (of Platform Science), Simacan; wie is
   eigenaar van de data en mogen we die gebruiken voor een proef?
4. Eisen van ICT: hosting, SSO, beveiliging (ISO 27001, NIS2 als dat voor hen geldt), back-ups, logging.
5. Wat eist AH van een vervoerder (OTM5-berichten, Simacan-voeding, ETA-afspraken), en wat Jumbo, Plus en Lidl?
6. Welke tachograafsoftware en welke cao-toets worden gebruikt; wie bewaakt overtredingen?
7. Welke standplaats heeft de grootste baat en de meest bereidwillige planners voor stap 1?
