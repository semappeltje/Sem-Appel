# Echte data in de Control Tower: OTM5 en de andere bronnen

25 oktober 2026 · tak `ct4/otm5` (vanaf `claude/happy-darwin-3ytmwi`) · vervolg op `planning-visie-en-plan.md` en
`systeemlandschap-en-blauwdruk.md` (stap 1 van de blauwdruk: lezen en kijken)

De vraag van Sem: hoe krijgen we straks echte data in dit systeem, concreet en zonder herbouw?

Bij elk feit staat de status van de bron:

- **gelezen**: de bron zelf geopend (bestand, pagina of code), met commit of datum.
- **zoek**: alleen in zoekresultaten gezien; de pagina was in deze omgeving niet te openen. Nakijken.
- **gemeten**: een eigen meting met de test in deze tak (`tests/otm5-check.mjs`).
- **schatting**: eigen inschatting, of een getal uit de gesimuleerde dag.
- **aanname**: niet gevonden; zo nemen we het aan tot Simon Loos of een leverancier het bevestigt.

## Wat je vroeg, en hoe ik het las

Letterlijk vroeg je vijf dingen: OTM5 uitzoeken en ons model erop afbeelden, een werkende vertaling als bewijs, de andere
bronnen op een rij, een datalijst voor de proef en dit memo. Het doel is dat de demo een systeem wordt waar echte ritten in
kunnen zonder dat we het opnieuw bouwen, en dat je met ICT en de directie van Simon Loos een concreet gesprek kunt voeren
over wat ze moeten leveren. Wat je niet zei: de echte data komt uit vijf of zes systemen tegelijk, in verschillende vormen
en ritmes, met persoonsgegevens erin, en de eerste echte aanlevering bepaalt of de import een vertaling wordt of een project.

## In het kort

1. **OTM5 is de goede ingang, en ons model past erin zonder herbouw.** `src/otm5.js` zet de hele gesimuleerde dag om naar
   OTM 5.9.0 en terug: 3.259 ritten, 5.514 stops, 1.598 diensten, 59 open ritten en 17.681 gebeurtenissen tot 10:00. Alle
   32.445 entiteiten valideren tegen de officiële specificatie, en heen en terug geeft dezelfde ritten, stops, vensters,
   voertuigen, opleggers, diensten, gebeurtenissen en posities (gemeten).
2. **OTM5 is de laatste versie 5.9.0, uitgebracht op 2 oktober 2026**, beheerd door de Stichting Uniforme Transport Code
   (SUTC) met TLN, evofenedex en DALTI (gelezen). Simacan bedacht het model en is lid van de werkgroep; Ahold Delhaize staat
   als eerdere bijdrager op de lijst (gelezen).
3. **OTM5 kent geen dienst, geen dock, geen voorkeur en geen prognose.** Een dock kan netjes als sublocatie van de
   standplaats. De rest gaat mee in `externalAttributes`, onder één object `simonloos`: in 5.9 moet elke waarde daar een
   object zijn, een losse tekst valideert niet (gelezen, gemeten).
4. **Er bestaat geen aankomst- of vertrekevent in OTM5.** Aankomst en vertrek zijn het begin en het einde van een
   stop-actie; wat er gebeurde komt als dezelfde actie met lifecycle `actual` of `realized` (gelezen). Wij gebruiken
   `startMovingEvent` en `stopMovingEvent` voor bewegen en `updateEvent` op de geplande actie voor laden, lossen, koppelen
   en pauze.
5. **De andere bronnen:** Trimble telematica is sinds februari 2025 van Platform Science (zoek); de truckmerken leveren
   posities, tachostatus en koppelen ook zelf via rFMS (gelezen); Navitrans draait op Business Central met OData en REST
   (gelezen); ORTEC wisselt XML uit (zoek); de cao staat officieel in de Staatscourant (2026, nr. 7211, gelezen), is bij de
   dagelijkse rust strenger dan EU 561/2006 en voegt regels toe (vrije weekenden, venstertijden).
6. **Voor de proef**: begin met bestanden in een beveiligde map, dagelijks op vaste tijden, plus één API voor posities.
   Voor één standplaats als Zaandam is dat in de simulatie 55 voertuigen, 132 ritten en 223 stops per dag en ongeveer
   19.000 posities per dag (schatting).
7. **Een correctie op onze eigen blauwdruk**: bij een positie per 30 tot 60 seconden komt de vloot op 0,5 tot 1 miljoen
   posities per dag, niet 100.000 tot 150.000. De geijkte dag rijdt 6,2 uur per voertuig (gemeten in de simulatie).

## Wat ik deed

- De officiële bron van OTM5 gevonden en vastgezet: de specificatie `otm-api-v5.9.yaml` uit
  `github.com/opentripmodel/otm5-change-requests` (commit `fcef963`, 2 oktober 2026, OpenAPI 3.1, 184 schema's) en de
  documentatie uit `github.com/opentripmodel/documentation` (commit `c87e397`, 13 oktober 2026). De gegenereerde site
  `otm5.opentripmodel.org` was hier niet te openen; de bron op GitHub is dezelfde.
- `demos/simonloos-control-tower/src/otm5.js` geschreven: puur, geen imports, niet in de app-bundel (gecontroleerd met een
  build naar een tijdelijke map en zoeken in de bundel).
- `demos/simonloos-control-tower/tests/otm5-check.mjs` geschreven, met een validator uit de vastgezette specificatie, en
  alles gedraaid: 38 controles, allemaal geslaagd (gemeten, een halve tot anderhalve minuut in deze omgeving).
- De andere bronnen nagezocht op GitHub (specificaties, documentatie en code die de formaten leest), via zoekresultaten en
  op de twee sites die wel open waren: cbs.nl en zoek.officielebekendmakingen.nl.
- Nieuwe ideeën in `ideeenbank.md` gezet (nummer 18 tot en met 22).

## 1. OTM5: wat het is en wat wij ervan nodig hebben

### 1.1 De standaard

OTM (Open Trip Model) is een open datamodel voor ritgegevens voor, tijdens en na het vervoer. Het is gemaakt door Simacan,
met geld uit het programma Beter Benutten, en sinds 2018 in beheer bij SUTC, samen met TLN, evofenedex en DALTI (gelezen,
documentatie, pagina "About"). Volgens dezelfde pagina gebruiken ruim twintig vervoerders het om data te delen met grote
verladers, retailers en wegbeheerders (gelezen). OTM 4 is verouderd sinds OTM5 in 2020 uitkwam (gelezen, README van
`opentripmodel/opentripmodel`).

Vier principes die voor ons tellen (gelezen, "Design principles" en "Fundamentals"):

- **Voor communicatie, niet als intern model.** OTM raadt zelf aan om aan de rand van je systeem te vertalen naar je eigen
  vorm. Dat is precies wat `src/otm5.js` doet: onze vorm in het midden, OTM5 aan de rand.
- **Bewust los.** Bijna alles is optioneel. Een afnemer die iets nodig heeft, maakt daar een profiel van (strengere regels
  bovenop de kern). Er zijn profielen voor CBS, FMS (posities), CO2, eFTI en transportopdrachten.
- **Statisch en dynamisch gescheiden.** Entiteiten (rit, plek, voertuig, zending) veranderen weinig; acties (stop, laden,
  lossen, koppelen) en events (positie, update) leggen de verbanden en de tijd.
- **Verbanden inline of als verwijzing.** Een plek kan volledig in de stop staan of als verwijzing naar een UUID. Wij
  verwijzen, zodat een plek, voertuig of oplegger maar één keer in het bestand staat.

Formaat en vervoer: alleen JSON, en een REST-API met per soort een eigen adres (`/api/v5/trips`, `/vehicles`, `/locations`,
`/events` en negen andere). OTM schrijft geen adressen voor; de partijen spreken af wie aanbiedt en wie ophaalt (gelezen).
OTM kent geen omhulsel en geen vast hoofdelement: je stuurt entiteiten los. Valideren kan in Semantic Treehouse
(`sutc.semantic-treehouse.nl`), niet te openen vanaf hier; wij valideren daarom zelf tegen de specificatie.

### 1.2 De entiteiten die wij nodig hebben

| Entiteit | Wat het is in OTM5 (gelezen in 5.9.0) | Wat wij ermee doen |
| --- | --- | --- |
| **Trip** | Eén voertuig dat plekken bezoekt; `status` (draft, requested, rejected, confirmed, inTransit, completed, closed, cancelled), `vehicle`, `actors`, `actions`, `constraint` | Eén trip per rit. Open ritten zijn trips met status `requested` en zonder voertuig |
| **Vehicle** | `licensePlate`, `vehicleType` (vrije tekst), `fuels[]` (diesel, electricity, ...), maten, `loadCapacities`, `emissionClasses`; sinds 5.8 ook `actions` | Trekker, bakwagen, bus; de acties buiten een rit (pauze en laden op de standplaats) en de oplegger die er nu achter hangt |
| **Actor** | Persoon of bedrijf; de rol staat op het verband: shipper, carrier, consignee, consignor, driver, subcontractor, ... | Simon Loos als carrier, de klant als shipper, de chauffeur als driver (alleen een nummer), later een charter als subcontractor |
| **Location** | `geoReference` (verplicht), `type` (warehouse, store, operationalBase, customer, ...), adres, `subLocations` | Standplaatsen, DC's, winkels, bezorgstraten; docks als sublocatie van de standplaats |
| **Consignment** | De administratieve zending: `goods`, `actors`, `documents`, `actions`, `status` | Eén zending per rit met de lading ("26 rolcontainers"); straks de orders van AH |
| **Goods** | Twee soorten: `items` (goederen) en `transportEquipment` (alles wat goederen bevat en niet zelf rijdt) | Items voor de lading |
| **TransportEquipment** | Geen eigen entiteit maar een soort goods: `equipmentType` (trailer, box, loadCarrier, pallet), `equipmentSubType`, `licensePlate`, `containedGoods` | Elke oplegger; koel en vries met een `temperatureConstraint` |
| **TransportOrder** | Groepeert zendingen van een opdrachtgever | Nog niet: komt als AH orders stuurt in plaats van ritten (aanname: AH stuurt ritten) |
| **Route** | Een geometrie (`geoReference`) met constraints | Niet nodig: de ontvanger rekent zelf; wel bruikbaar voor een omleiding of een LZV-route |
| **Action** | 12 soorten: stop, move, load, unload, wait, break, attachTransportEquipment, detachTransportEquipment, refuel, handOver, weigh, genericAction; elk met `lifecycle`, `startTime`, `endTime`, `constraint` | Stop per bezoek, move per rijstuk, wait, unload of load, break, refuel (elektrisch laden), koppelen en afkoppelen |
| **Constraint** | Regels: `timeWindowConstraint`, `temperatureConstraint`, `vehicleTypeConstraint`, `transportEquipmentTypeConstraint`, `fuelTypeConstraint`, toegang, gewicht, maten; samen te stellen met and, or, not; `enforceability` enforced of preference | Het venster van elke stop; het laadvenster en de eisen van een open rit |
| **TimeWindow** | Geen entiteit maar een constraint: `timeWindowConstraint` met `startTime` en `endTime` | Het venster van 30 minuten van een stop, het laadvenster van een open rit |
| **Event** | 13 soorten: locationUpdate, startMoving, stopMoving, startWaiting, startEngine, stopEngine, sensorUpdate, update, associationCreated, associationRemoved, emission, fuelConsumed, weigh; de tijd is `creationDate` | Posities, vertrek en aankomst, wachten, en updates op geplande acties |
| **Document** | Bestand of link (`content`, `documentType`, `mimeType`) aan een zending of actie | Straks de e-CMR of een afleverbewijs; nu niet |
| **Sensor** | Een sensor met waarden via `sensorUpdateEvent` | Straks de temperatuur van koel- en vriesopleggers; nu niet |

### 1.3 Lifecycles, en waarom er geen aankomstevent is

Elke actie en elk event heeft een lifecycle: `requested` (gevraagd), `planned` (gepland), `projected` (verwacht, zoals een
ETA), `actual` (nu bezig) en `realized` (achteraf vastgelegd). Wil je laten zien wat er met een geplande actie gebeurde,
dan stuur je dezelfde actie met dezelfde UUID in een volgende lifecycle (gelezen, "Lifecycles"). Een stop die gepland is om
10:00 en om 10:11 begint, staat dus twee keer in het bericht: planned met 10:00 en realized met 10:11.

Daardoor heeft OTM5 geen event "aankomst" of "vertrek". De aankomst is de `startTime` van de stop in lifecycle `actual` of
`realized`, het vertrek de `endTime`. Events kennen alleen `creationDate` als tijd (gelezen in het schema). In 5.9 bestaat
`startWaitingEvent`, maar geen `stopWaitingEvent`, al staat `stopWaiting` wel in de lijst van verwijzingen (gelezen; een
kleine slordigheid in de specificatie).

### 1.4 Hoe Albert Heijn en Simacan OTM gebruiken

Met zekerheid (gelezen):

- Simacan heeft OTM bedacht en staat op de lijst van gebruikers met "supply chain visibility and control for ETAs, trip
  updates, and realisation data"; Simacan is lid van de OTM-werkgroep (documentatie, pagina "Adopters", 13 oktober 2026).
- "Ahold Delhaize Transport & Inbound Logistics" staat er als eerdere bijdrager aan OTM, net als Cornelissen (dezelfde
  pagina).
- In onze eigen onderzoeken: AH stuurt op donderdag de capaciteitsritten en elke middag de definitieve ritten via OTM5;
  Simacan rekent de ETA (Slimste, hoofdstuk Planning, bron TTM; `onderzoek-en-repos.md`).

Uit zoekresultaten (zoek):

- TTM over Transplan (een TMS voor winkeldistributie): "een signaal via OTM5 levert elke donderdag een ID op, waarmee
  capaciteitsritten voor de komende week worden opgehaald"; elke middag komen via hetzelfde protocol de finale ritten, die
  de capaciteitsritten vervangen. Simacan is daarin de control tower-partner van AH. Het artikel is ongeveer drie jaar oud.
- Simacan heeft een eigen ontwikkelaarsportaal met een profiel "OTM5 Trips" en een API voor "OTM5 Realisation Data":
  realisatiepunten in OTM5, gekoppeld aan een trip-id of een kenteken.
- AH werkt met een pool van ongeveer 25 vervoerders, die allemaal op het platform van Simacan zitten (Simacan, casus Ahold
  Delhaize Transport).

Aannames (bevestigen bij ICT en de planners):

- Simon Loos krijgt de ritten van AH in OTM5 binnen in een van zijn systemen (ORTEC, Navitrans of een koppeling ertussen) en
  levert de realisatie (posities en stoptijden) terug aan Simacan, rechtstreeks of via Trimble.
- De berichten van AH zijn ritten met stops, vensters en misschien laadeenheden, geen volledige zendingen. Welke 5.x-versie
  AH gebruikt, weten we niet.
- Jumbo, Lidl, Plus en SPAR gebruiken geen OTM5 (EDI, portaal, mail of Excel) tot het tegendeel blijkt.

## 2. Ons model naar OTM5

Gekozen vorm: **één trip per rit**. Een OTM-trip is één voertuig dat plekken bezoekt; een dienst is bij ons een keten van
ritten voor één chauffeur, en die kent OTM niet. De dienst staat daarom bij elke rit in `externalAttributes`.

| Ons veld | OTM5-entiteit en attribuut | Opmerking |
| --- | --- | --- |
| `fleet.trucks[].id` (T-1002) | `vehicle.name`, `externalIdentifiers` (scheme `simonloos:wagennummer`); `vehicle.id` is een UUID v5 uit het wagennummer | `externalIdentifiers` is nieuw in 5.9 en is de nette plek voor eigen nummers (ook straks die van Navitrans) |
| `.plate` | `vehicle.licensePlate` en `externalIdentifiers` (scheme `kenteken`) | |
| `.kind` (trekker, bakwagen, bus) | `vehicle.vehicleType` (tractor, truck, van) | Vrije tekst in 5.9; volgens de FAQ komen er vaste lijsten |
| `.ev`, `.range` | `vehicle.fuels[].fuelType` (electricity of diesel); bereik in `externalAttributes` | OTM kent geen bereik of laadtoestand van een accu |
| `.model`, `.div`, `.base`, `.vandaag`, `.klant`, `.lzv` | `externalAttributes.simonloos` | |
| `stateAt(t, T)`: positie, snelheid, koers | `locationUpdateEvent` met `geoReference` (lat, lon, speed, heading), lifecycle `actual`, verwijzing naar het voertuig | Zoals het OTM-profiel FMS het vraagt |
| `fleet.trailers[].id`, `.plate` | `goods` met `type: transportEquipment`, `equipmentType: trailer`, `name`, `licensePlate` | |
| `.type` (koel, vries, droog, ...) en de temperatuur | `equipmentSubType` (vrije tekst) en `constraint` met `temperatureConstraint` (range, in C) | |
| Oplegger gekoppeld om T | `vehicle.actions`: `attachTransportEquipment` met lifecycle `actual` | Sinds 5.8 mag een actie aan een voertuig hangen zonder rit |
| Toestand van een losse oplegger (bij klant, wacht op ophalen, leeg) | `externalAttributes.simonloos.status` | OTM kent geen "waar staat deze oplegger nu"; dat volgt alleen uit het laatste afkoppelen |
| Chauffeur (personen uit `people.js`) | `actor` met `type: person`, zonder naam of telefoon, `externalIdentifiers` (scheme `simonloos:personeelsnummer`); op de trip met rol `driver` | Dataminimalisatie: de naam staat in HR, niet in de ritdata |
| Simon Loos, de klant | `actor` (company) met rol `carrier` en `shipper` op trip en zending | |
| Dienst (`d.i`, `t0`, `t1`, `rij`, chauffeur) | Geen entiteit. `trip.externalAttributes.simonloos`: dienst, dienstStart, dienstEind, dienstRijMin; de chauffeur als actor op elke trip | Voorstel aan SUTC waard: diensten zijn bij elke vervoerder de eenheid van plannen |
| Rit (`t.routes[n]`) | `trip` met `status` confirmed, inTransit of completed | |
| Plansegment `koppel` (dock bij vertrek) | Eerste stop: `attachTransportEquipment` met `location` = de dock-sublocatie | |
| `terrein` met `dockSoort: 'laden'` (bakwagen, bus) | Eerste stop: `load` aan het dock | |
| `drive` (`t0`, `t1`, `km0`, `km1`, `delay`, `win`) | `move` (`from`, `to`, `startTime`, `endTime`, `distance` in km); vertraging in `externalAttributes`; het venster als `timeWindowConstraint` op de stop erna | De OTM-manier voor een vertraging is een `projected` versie van de volgende stops (nog niet gebouwd) |
| `stop` (`place`, `wacht`, `los`, `actie`, `swap`, `pickup`) | `stop` met `location`, `startTime` (aankomst), `endTime` (vertrek) en daarin `wait`, `unload` of `load`, of `detachTransportEquipment` en `attachTransportEquipment` bij wisselen | De zending verwijst zelf naar koppelen en afkoppelen, want bij drop & swap is er geen los-actie |
| `pauze` | `break` in het rijstuk of de stop waarin hij valt | |
| `laden` (accu, onderweg of op de standplaats) | `refuel` (brandstof electricity) | |
| `ontkoppel`, `terrein` met `dockSoort: 'aankomst'` | Laatste stop: `detachTransportEquipment` of `unload` aan het dock | |
| `terrein` tussen ritten, wachten op een dock, pauze of laden op de standplaats | `vehicle.actions`: `wait`, `break`, `refuel` | Het dagplan buiten de ritten |
| `blocks()`: `k`, `t0`, `t1` | `actionType`, `startTime`, `endTime` | Tijden als ISO 8601 met offset (+01:00 of +02:00), Amsterdamse kloktijd |
| `blocks()`: `klant`, `venster`, `vertraging`, `dock`, `wacht`, `los` | shipper op de trip, `timeWindowConstraint` (enforced), `externalAttributes` op de move, verwijzing naar de dock-sublocatie, de duur van `wait` en `unload` | |
| `fleet.eventsOf`: vertrek, aankomst | `startMovingEvent`, `stopMovingEvent` met positie | Plus `startTime` en `endTime` van de stop |
| wacht | `startWaitingEvent` met positie; de duur in `externalAttributes` | Er is geen `stopWaitingEvent` |
| los, laad, koppel, ontkoppel, pauze (start en eind) | `updateEvent` met de geplande actie (zelfde UUID) in lifecycle `actual` (begin) of `realized` (einde); de positie als `contextEvents` | Zo koppelt een ontvanger gepland aan gereden |
| `fleet.pool` (open ritten) | `trip` met `status: requested`, zonder voertuig; het laadvenster als `timeWindowConstraint` op de eerste stop; `vehicleTypeConstraint` en `transportEquipmentTypeConstraint`; `creationDate` is het moment dat de rit bekend werd; de reden in `externalAttributes` | Precies de vorm waarin AH een rit vraagt |
| `SP` (standplaatsen) | `location` met `type: operationalBase`, adres in `administrativeReference`, docks als `subLocations` (`type: other`, `otherLocationType: dock`) | |
| `DCS` | `location` met `type: warehouse` (DC, groothandel) of `customer` (fabriek) | |
| `WINKELS`, `BEZORG` | `location` met `type: store` en `customer` | |
| Docks (`sp.docks`, `sp.dockPlek`) | Sublocatie van de standplaats, met de positie van de deur | OTM kent geen dock; dit is de natuurlijke plek ervoor |
| Charters (nog niet in deze tak) | `actor` (company) met rol `subcontractor` op de trip | Let op de charterbepaling in de cao (paragraaf 4) |
| Lading (`tr.lading`, `t.lading`) | `consignment` met `goods` (items: omschrijving, aantal, verpakking of gewicht) | |
| Voorkeuren van chauffeurs | Geen. Een wens op een rit kan als constraint met `enforceability: preference`; voorkeuren van mensen horen in een eigen tabel | AVG: voorkeuren zijn persoonsgegevens |
| Prognoses (wachttijd per DC, kans op invulling, ETA) | Geen, behalve de ETA als `projected` lifecycle; de rest in een eigen API of `externalAttributes` | |
| `wachtPerPlek()` | Geen; af te leiden uit `wait`-acties in lifecycle `realized` | De leerlus uit de blauwdruk |

Wat OTM5 niet kent, gaat onder één sleutel mee: `"externalAttributes": { "simonloos": { ... } }`. In 5.9 moet elke waarde
in `externalAttributes` een JSON-object zijn (`unrestricted_json`); een tekst als `"klant": "AH"` valideert niet. De
documentatie toont wel teksten. En de zoekfunctie van OTM (`attributeRestriction`) eist juist teksten. Die twee passen niet
op elkaar (gelezen in het schema, gemeten met de validator).

## 3. Het bewijs: `src/otm5.js` en `tests/otm5-check.mjs`

**Wat de code doet.** Drie functies, met onze eigen vorm in het midden:

- `uitFleet(fleet, T)` maakt van de gesimuleerde dag onze vorm: plekken, voertuigen, opleggers (met hun toestand om T),
  chauffeurs als nummer, diensten, ritten (stops met aankomst, klaar, vertrek, venster, wacht, los en actie; rijstukken met
  km en vertraging; pauzes; de dockblokken), losse blokken, open ritten, gebeurtenissen tot T en posities om T.
- `naarOtm5(fleet, T)` maakt daar een bundel van: per soort een lijst OTM5-entiteiten (`trips`, `vehicles`, `actors`,
  `locations`, `transportEquipment`, `consignments`, `events`). Elke entiteit is los geldig; de bundel zelf is ons omhulsel.
- `vanOtm5(doc)` leest onze bundel, een lijst entiteiten of een losse trip van een ander systeem terug naar onze vorm. Het
  gooit geen fout op onbekende velden en noemt wat het niet kan lezen in `waarschuwingen`.

Keuzes: elk id is een UUID versie 5 uit ons eigen id (dezelfde rit geeft altijd dezelfde UUID, zoals de OTM-documentatie
aanraadt); tijden in ISO 8601 met de Amsterdamse offset, ook goed op de dagen van de zomertijdwissel (vandaag, 25 oktober,
is er een); geen naam of telefoon van een chauffeur in het bestand.

**Wat de test controleert, met de uitkomst van 25 oktober 2026 (gemeten):**

| Controle | Uitkomst |
| --- | --- |
| `src/otm5.js` puur en buiten de bundel | geen imports, geen DOM; geen app-bestand importeert het; de gebouwde app bevat het niet |
| Validator uit de specificatie | de OpenAPI-discriminator omgezet naar if/then; zonder die omzetting valt elke actor met `type: person` af. Positieve controle: het officiële voorbeeld valideert. Negatieve controle: zeven kapotte varianten vallen af |
| Onze vorm tegen de app | dezelfde 5.514 stops, aankomst- en lostijden, vensters, wachttijden en docks als `fleet.blocks()`; dezelfde 17.681 gebeurtenissen als `fleet.eventsOf()`; elk ritsegment heeft een plek in OTM |
| Geldig tegen OTM 5.9.0 | 32.445 van 32.445 entiteiten (3.318 trips, 1.300 vehicles, 1.627 actors, 2.260 locations, 1.700 opleggers, 3.259 zendingen, 18.981 events) |
| Verwijzingen | 118.022 verwijzingen, allemaal naar een entiteit in de bundel |
| Herhaalbaar | twee keer maken geeft hetzelfde bestand |
| Privacy | geen naam van een chauffeur in het bestand (978 namen gezocht); 1.598 chauffeurs alleen als nummer |
| Lifecycles | elke update (8.668) verwijst met dezelfde UUID naar de geplande actie |
| Rondreis | plekken, voertuigen, opleggers, chauffeurs, diensten, ritten, losse blokken, open ritten, gebeurtenissen en posities gelijk na OTM5 en terug |
| Echte voorbeelden | de vier voorbeelden uit de OTM-documentatie en zeven voorbeelden uit de specificatie lezen in zonder fouten; een gevraagde rit wordt een open rit; dezelfde stop als planned en realized wordt één stop met de gerealiseerde tijden erbij |

**Maat en snelheid (gemeten in deze omgeving, dus als verhouding):** de bundel om 10:00 is 40 MB JSON (4,4 MB met gzip);
een hele dag met alle gebeurtenissen 57 MB (6,1 MB). Een rit is gemiddeld 6,7 KB, een positie 508 bytes (77 bytes met gzip
in bulk). Maken kost ongeveer 4 seconden, valideren 2 seconden, terug inlezen 1 seconde. Eén dag als één bestand is dus te
groot om zo te versturen: per rit of per entiteit over de API, zoals OTM het bedoelt.

**Wat de test vond in de officiële voorbeelden.** Drie van de vier voorbeeldritten uit de documentatie valideren tegen
5.9. `trip_with_vehicle.json` niet: het voertuig heeft `"fuel": "Diesel"`, 5.9 kent alleen `diesel`, en sinds 5.8 hoort
brandstof in `fuels`. De pagina "Adding constraints" schrijft `timeWindowsConstraint`, het schema kent alleen
`timeWindowConstraint`. Als de voorbeelden van de standaard al afwijken, zal een echt bestand dat ook doen. De inname moet
ruimhartig lezen en streng melden; `vanOtm5` leest het afwijkende voorbeeld daarom gewoon in.

**Wat nog niet gebouwd is:** de app leest onze vorm nog niet (de toren draait op `createFleet()`); geen controle tegen een
profiel van AH (alleen tegen de kern); geen `projected` ETA's, geen temperatuur als sensor, geen routegeometrie, geen
charters.

Draaien: `npm run test:otm5` in `demos/simonloos-control-tower` (een halve tot anderhalve minuut), of
`node tests/otm5-check.mjs --bestand pad.json` voor een echt bestand. Een voorbeeld van één trekker op één dag staat in
`tests/otm5/voorbeeld-simonloos.json`.

## 4. De andere bronnen

| Bron | Wat eruit komt | Vorm | Hoe vaak | Wat we nodig hebben | Zeker, en wat een aanname is |
| --- | --- | --- | --- | --- | --- |
| **Trimble FleetXPS, nu Platform Science** | Posities, statussen per rit en stop uit de chauffeursapp, berichten, e-CMR, tacho op afstand, CAN-data | API van de leverancier (aanname: REST of SOAP), of bestanden | Posities elke 30 tot 60 seconden (schatting); statussen bij elke handeling | API-toegang via het contract van Simon Loos, een verwerkersovereenkomst, afspraak over kosten per bericht | Zeker: Simon Loos gebruikt FleetXPS met e-CMR (gelezen, onze onderzoeken). Platform Science nam de telematica van Trimble wereldwijd over, rond op 10 februari 2025; Trimble houdt ongeveer 32,5 procent en Transporeon bleef bij Trimble (zoek). Aanname: FleetXPS hoort bij die overname, en de API levert posities, statussen en tachobestanden |
| **rFMS van de truckmerken** (DAF, Scania, Volvo, Mercedes, MAN) | Voertuigen, posities, statussen met de werktoestand van de chauffeur uit de tachograaf (REST, DRIVER_AVAILABLE, WORK, DRIVE), koppelen en afkoppelen van een oplegger, laadstatus van de accu, brandstof, kilometerstand | REST-API (`/vehicles`, `/vehiclepositions`, `/vehiclestatuses`), JSON, OAuth2; in 5.0 ook abonnementen | Op tijd, bij contact aan of uit, bij elke wisseling van werktoestand | Een account bij het portaal van elk merk en toestemming als eigenaar | Gelezen in de OpenAPI van rFMS 4.0 en 5.0 (een kopie in `way-platform/rfms-go`; de officiële tekst staat op fms-standard.com, hier niet te openen). Aanname: de wagens van Simon Loos hebben de diensten van hun merk aan |
| **Navitrans** (op Dynamics 365 Business Central) | Orders, ritten, klanten, adressen, tarieven, vloot en opleggers, chauffeurs (stam), facturen | REST API v2.0 en eigen API-pagina's, OData V4 (JSON); SOAP wordt afgebouwd; of exports | Op afroep; webhooks bij wijzigingen (verlopen na drie dagen zonder verlenging) | Een app-registratie met OAuth (Entra ID) en de rechten in Business Central; een partner die de API-pagina's voor de Navitrans-tabellen publiceert | Gelezen (Microsoft-documentatie op GitHub, 22 oktober 2026): online hoogstens 6.000 OData-verzoeken per gebruiker per vijf minuten, 5 tegelijk, 20.000 regels per pagina. Zoek: Navitrans wordt gemaakt door Young & Partners Belgium. Aanname: Simon Loos draait Business Central online; "Navision" in onze stukken kan ook op een oudere versie wijzen, met andere grenzen |
| **ORTEC** (Routing and Dispatch, gekoppeld aan Navitrans) | Het plan: ritten met volgorde en tijden, toegewezen middelen, kosten en KPI's | XML, synchroon of asynchroon via SOAP-webservices, of via de ORTEC Message Hub | Na elke planronde (aanname: 's avonds het plan voor morgen, daarna wijzigingen) | Een export van het plan op vaste tijden, met ICT en ORTEC afgesproken | Gelezen: ORTEC is sinds 2014 aan Navitrans gekoppeld (onze onderzoeken). Zoek: XML via SOAP en de Message Hub (presentatie van ORTEC). Aanname: de rest |
| **Transporeon** (tijdsloten bij DC's) | Geboekte slots per DC (tijd, dock, referentie), en in de Visibility-API transporten met stops en tijdvakken | Webportaal; API's voor verladers (transports, places, vehicles, partners, telematics) | Bij elke boeking | Toestemming van de verlader die de slots beheert (AH, Jumbo, Lidl), of een export | Gelezen: de eindpunten van de Visibility-API in een SDK van een derde partij. Zoek: Transporeon is van Trimble. Aanname: welke DC's van de klanten van Simon Loos slots via Transporeon boeken |
| **Tachograaf** (.ddd) | Chauffeurskaart: activiteiten per dag (rijden, werken, beschikbaar, rust), gebruikte voertuigen, plaatsen van begin en einde dagelijkse arbeid, gebeurtenissen en storingen, controles, posities tijdens het rijden (tweede generatie; uit kennis: na elke drie uur rijden), grensovergangen en laden of lossen (tweede generatie versie 2). Voertuigunit: overzicht, activiteiten, gebeurtenissen, gedetailleerde snelheid, technische gegevens | Binair (TLV-blokken), digitaal ondertekend; te lezen met bijvoorbeeld `tachoparser` (AGPL-3.0) naar JSON | Download op afstand of op de standplaats; wettelijk de kaart minstens elke 28 dagen en de unit elke 90 dagen (uit kennis, nakijken) | De downloads of beter de export van de tachoanalyse die Simon Loos al gebruikt; afspraken met de OR | Gelezen: de indeling in `tachoparser` (commit `f108ac4`), gebaseerd op verordening 165/2014 en uitvoeringsverordening 2016/799. Aanname: welk analysepakket Simon Loos gebruikt en wat het exporteert |
| **NDW** (verkeer, open data) | Snelheid en intensiteit per meetpunt, reistijden, actuele situaties, werkzaamheden en evenementen, matrixborden, afsluitingen | DATEX II in XML, gzip; vrij te halen, zonder sleutel | Snelheid elke minuut (een bestand van ongeveer 52 MB uitgepakt) | Niets; filteren op de wegvakken die we gebruiken | Gelezen in code van derden die de feeds leest (`clemensv/real-time-sources`, `wissehes/ndw-viewer`); de site van NDW was hier niet te openen. Gelezen bij NDW op GitHub: begrippenmodellen voor de ITS-gegevens, waaronder veilig vrachtwagenparkeren (vrije plaatsen, bezetting, plekken voor koelwagens), versie 0.5.0, concept, 15 oktober 2026 |
| **Cao beroepsgoederenvervoer** | De regels voor dienst, rust, weekenden, overuren, oproepkrachten en charters | Tekst in de Staatscourant | Elk jaar een nieuwe cao en een nieuw besluit | Niets; de regels als pure functies met artikelnummer en tests | Gelezen: Staatscourant 2026, nr. 7211 (6 juli 2026), besluit van 2 juli 2026; de bepalingen zijn algemeen verbindend tot en met 31 december 2026 |
| **EU 561/2006** (rij- en rusttijden) | Dagelijkse en wekelijkse rijtijd, pauzes, dagelijkse en wekelijkse rust | Verordening (EG) nr. 561/2006 op EUR-Lex, geconsolideerde versie | Vast; verandert alleen bij een nieuwe verordening (uit kennis: gewijzigd bij 165/2014 en 2020/1054) | Niets; de regels als pure functies met artikelnummer | EUR-Lex gaf hier een beveiligingscontrole en was niet te lezen. De cao verwijst zelf naar artikel 8 lid 4 en artikel 4 onder g (gelezen). Het Arbeidstijdenbesluit vervoer staat op wetten.overheid.nl (niet te openen) |

**De cao als bron voor de toetsregels** (gelezen, Staatscourant 2026, 7211). Voor de planning tellen vooral deze artikelen:

- Artikel 76 lid 3: na terugkeer op de standplaats hoogstens drie keer tussen twee weekrusten een dagelijkse rust van
  minimaal 10 uur, de andere minimaal 11 uur. Dat wijkt af van EU 561/2006 artikel 8 lid 4 en is strenger: de verordening
  staat drie keer 9 uur toe (uit kennis; EUR-Lex was hier niet te openen).
- Artikel 34: per half kalenderjaar minstens 13 vrije weekeinden voor rijdend personeel, in de regel 48 uur en minimaal 45
  uur aaneen, tussen vrijdag 12:00 en maandag 12:00.
- Artikel 26b: een urenmaximum per jaar naar keuze (3.120, 2.860, 2.600, 2.340 of 2.080 uur), teruggerekend naar een
  gemiddelde per vier weken; meer dan 5 procent erboven geeft 15 procent van de overschrijding terug in tijd. Lid 6: de
  werkgever spant zich in om te werken met wekelijkse venstertijden voor de aanvangstijden van de diensten.
- Artikel 27 tot en met 30: overuren boven 40 uur per week (maandag tot en met vrijdag), 30 procent toeslag, het recht om
  overwerk boven gemiddeld 50 uur per week (over vier weken) te weigeren, geen verplicht overwerk vanaf 55 jaar, en boven 220
  uur per vier weken tijd voor tijd. Met een boordcomputer worden overuren niet afgerond (artikel 29): de tijden van de
  boordcomputer zijn dus de bron voor het loon.
- Artikel 10: voor oproepkrachten zijn overuren de uren boven gemiddeld 8 uur per dag; ze worden per uur beloond.
- Artikel 73, de charterbepaling: bij onderaanneming moet de vervoerder bedingen dat de werknemers van de charter de
  basisarbeidsvoorwaarden van deze cao krijgen als de detacheringsrichtlijn dat vraagt.

## 5. Wat de proef vraagt

Stap 1 van de blauwdruk is lezen en kijken: de control tower op één standplaats, alleen lezen, acht tot tien weken. De
hoeveelheden hieronder zijn voor één standplaats als Zaandam, uit de gesimuleerde dag (schatting; de werkelijke vloot per
standplaats kennen we niet).

| Gegeven | Bron | Vorm | Frequentie | Hoeveelheid (schatting) | Wie levert | AVG |
| --- | --- | --- | --- | --- | --- | --- |
| Ritten en stops met vensters (de vraag) | AH via OTM5 (een kopie van wat Simon Loos binnenkrijgt); andere klanten uit Navitrans of ORTEC | OTM5 (JSON), anders XML of CSV | Donderdag de capaciteit, elke middag de definitieve ritten, plus wijzigingen | 130 ritten en 220 stops per dag; 2,4 MB OTM5 per dag | ICT van Simon Loos, of AH en Simacan met toestemming | Laag |
| Diensten en wie wat rijdt | ORTEC, Navitrans of Excel | Export (XML of CSV) | Na elke planronde en bij wijziging | 60 diensten per dag | Planners, ICT | Persoonsgegeven (chauffeursnummer): pseudonimiseren bij de inname |
| Vloot en opleggers | Navitrans | Export (CSV) of API | Eenmalig, daarna wekelijks | 55 voertuigen, 80 opleggers | ICT | Laag |
| Standplaats, docks, adressen van klanten met openingstijden | Navitrans, ORTEC, de klant | CSV of OTM5 (locations) | Eenmalig, bij wijziging | 170 plekken | ICT, planners | Laag |
| Posities en statussen | Trimble of Platform Science; of rFMS van een merk | API (JSON) | Elke 30 tot 60 seconden tijdens het rijden | 19.000 tot 37.000 posities per dag (hele vloot: 0,5 tot 1 miljoen) | ICT en de leverancier | Hoog: een positie is herleidbaar tot een chauffeur. Doel, bewaartermijn, verwerkersovereenkomst |
| Gereden tijden (aankomst, vertrek, wachten, lossen) | Statussen uit de boordcomputer, of de realisatie die naar Simacan gaat | API of export | Doorlopend, of elke dag | 1.700 gebeurtenissen per dag | ICT | Middel |
| Rij- en rusttijden | Tachoanalyse of Trimble | Export (CSV), of .ddd | Elke dag | 95 chauffeurs | HR of ICT | Hoog, met de OR |
| Historie van 8 tot 12 weken (de vijf regels hierboven) | Dezelfde bronnen | Exports | Eenmalig | 8.000 ritten, 1 tot 2 miljoen posities | ICT | Als hierboven; korter bewaren als het kan |
| Charters en oproepkrachten | Excel van de planners | CSV | Eenmalig, dan wekelijks | Enkele tientallen regels | Planners | Middel: contactgegevens van zzp'ers zijn persoonsgegevens |
| Ziekmeldingen en beschikbaarheid | HR | Export | Elke dag | Een paar per dag | HR | Hoog (gezondheid): alleen "niet beschikbaar", nooit de reden |
| Slots bij de DC's | Transporeon of de klant | Export | Elke dag | Enkele per dag | Klant, ICT | Laag |
| Verkeer | NDW | DATEX II (XML) | Elke minuut | Gefilterd enkele MB per dag | Open data | Geen |

**Voorstel voor de inname in stap 1.** Begin met bestanden in een beveiligde map, plus één API:

- Een map per bron (SFTP met een sleutel per bron, of een opslagmap in de EU met een eigen sleutel), met dagelijkse
  exports op vaste tijden: de OTM5-bestanden van AH, het plan en de diensten uit ORTEC of Navitrans, de export van de
  tachoanalyse, en eenmalig de stamgegevens en de historie.
- Eén API voor posities en statussen (Trimble of Platform Science, of als proef rFMS van één merk), omdat de toren live
  moet zijn. Alleen lezen.
- NDW rechtstreeks uit de open feed.
- Elke aanlevering wordt onveranderd bewaard (met datum), gecontroleerd (het OTM5-schema met dezelfde validator als de
  test, en eigen regels: elke stop een plek, elk venster een tijd), vertaald naar onze vorm (een adapter per bron, zoals
  `vanOtm5`) en bij een fout apart gezet met een melding. Chauffeursnummers worden bij de inname gepseudonimiseerd met een
  sleutel die bij Simon Loos blijft.

Waarom eerst bestanden: niets verandert in de systemen van Simon Loos, ICT kan leveren zonder ontwikkelwerk, dezelfde
bestanden zijn de contracttest en de herhaling (een echte dag afspelen in de simulator), en stoppen kan op elk moment.
In stap 2 komen de API's: webhooks van Business Central, OTM5 rechtstreeks van AH als Simon Loos dat wil, en het plan uit
ORTEC als bericht.

## Waar ik van je vraag afweek, en waarom

- **Events zoals arrival en departure bestaan niet in OTM5.** Ik heb aankomst en vertrek afgebeeld op `stopMovingEvent` en
  `startMovingEvent` (met positie) en op het begin en einde van de stop. Laden, lossen, koppelen en pauze gaan als
  `updateEvent` op de geplande actie.
- **TransportEquipment en TimeWindow zijn geen eigen entiteiten.** Een oplegger is een soort goods, een venster is een
  constraint. Zo staan ze in de code en in de tabel.
- **Eén trip per rit, niet per dienst**, omdat OTM een trip als één voertuig langs plekken ziet en geen dienst kent.
- **De validator volgt OpenAPI, niet kaal JSON Schema.** Kaal JSON Schema keurt elke persoon en elk bedrijf als actor af
  (die voldoen ook aan het basisschema). De omzetting staat in de test en is te controleren.
- **Een correctie op de blauwdruk**: 0,5 tot 1 miljoen posities per dag in plaats van 100.000 tot 150.000 (zie In het
  kort). Opslag blijft bescheiden: ongeveer 10 tot 40 GB per jaar onbewerkt bij 60 tot 100 bytes per positie, enkele GB
  met compressie (schatting).

## Wat je niet vroeg, maar waar je iets aan hebt

1. **De CBS-enquête wegvervoer komt gratis uit dezelfde export.** Vervoerders die het CBS vraagt, zijn verplicht hun ritten
   aan te leveren (CBS-wet; anders een last onder dwangsom of een boete). Het CBS ontvangt die gegevens in OTM, en TLN en het
   CBS raden OTM aan; de minimale velden zijn kenteken, plaats en tijd van laden en lossen, goederensoort en gewicht
   (gelezen, cbs.nl, 25 oktober 2026). Die velden zitten al in onze vertaling. Er is een OTM-profiel voor (gelezen).
   Waarde: geen handwerk meer bij een CBS-verzoek, en een tweede afnemer van dezelfde OTM-stroom naast AH. Met dezelfde
   bouwstenen volgen later CO2 per rit (voor de CSRD) en eFTI; beide profielen zijn nog concept (gelezen). Goedkope proef:
   een week gereden ritten voor de kentekens die het CBS vraagt, via het testtraject (XMLwegvervoer@cbs.nl).
2. **rFMS van de truckmerken als tweede bron naast Trimble.** De merken zelf (de specificatie noemt onder meer DAF, Scania,
   Volvo, Daimler en MAN) leveren via rFMS posities, de werktoestand uit de tachograaf, koppelen en afkoppelen van een
   oplegger en de laadstatus van de accu (gelezen in de specificatie; wat elk merk echt levert, verschilt). Waarde: minder
   afhankelijk van de overgang van Trimble naar Platform Science, een reserve als de telematica uitvalt, en accudata van de
   elektrische trekkers die de laadplanning nodig heeft. De luchtvaart werkt zo: de positie van een vliegtuig komt uit het
   eigen systeem van de maatschappij en los daarvan uit ADS-B. Goedkope proef: tien trekkers van één merk een week via het
   portaal van dat merk naast Trimble leggen en de posities vergelijken.
3. **De cao is strenger dan EU 561/2006, en dat hoort in de toetsregels.** Dagelijkse rust van 10 uur mag hoogstens drie
   keer tussen twee weekrusten, anders 11 uur (de verordening staat 9 uur toe; uit kennis, nakijken); 13 vrije weekenden per half jaar; en de
   werkgever spant zich in voor wekelijkse venstertijden voor het begin van de diensten (gelezen, artikelen 76, 34 en 26b).
   Waarde: een dienstbouw die alleen EU 561 toetst, plant diensten die volgens de cao niet mogen. De venstertijden maken het
   voorkeursbod (idee 3 in de ideeënbank) een afspraak waar de werkgever zich al aan verbond. Goedkope proef: de drie regels
   als pure functies met tests uit de cao-tekst, en de gesimuleerde dag erdoor halen (de simulatie rekent nu met 11 uur).

Meer in de ideeënbank: de begrippen voor veilig vrachtwagenparkeren van NDW als echte bron voor de pauzeplekken (nummer 21)
en één echt OTM5-bestand als eerste contracttest (nummer 22).

## Wat we moeten doorvragen

Bij ICT:

1. Welk systeem ontvangt de OTM5-berichten van AH (ORTEC, Navitrans, Transplan of een andere koppeling), welke versie, en
   kunnen we één dag krijgen (de capaciteit van donderdag en de definitieve ritten van een middag)?
2. Levert Simon Loos de realisatie terug aan Simacan, en hoe: in OTM5, via Trimble, of anders?
3. Welke API heeft Trimble of Platform Science voor Simon Loos: posities (hoe vaak), statussen, berichten, tacho op afstand,
   e-CMR; wat kost het, en van wie is de data?
4. Navitrans: Business Central online of een oudere versie op eigen servers? Zijn er API-pagina's voor orders en ritten,
   wie is de partner, en wat kan er zonder ontwikkelwerk als export?
5. ORTEC: welke versie, wanneer is het plan definitief, kan het plan als XML naar buiten, en hoe gaan wijzigingen na het
   publiceren?
6. Welk pakket analyseert de tachograaf, hoe vaak wordt gedownload, wat kan het exporteren, en wie ziet de overtredingen?
7. Hebben de wagens de diensten van hun merk aan (DAF Connect, Scania, Volvo Connect, Mercedes Fleetboard), en mag Simon
   Loos daar rFMS-toegang voor aanvragen?
8. Wat eist ICT voor een beveiligde map en een API-koppeling (SFTP, opslag in de EU, SSO, logging)?

Bij de directie en HR:

9. Krijgt Simon Loos verzoeken voor de CBS-enquête wegvervoer, en hoe worden ze nu ingevuld?
10. Wat is het doel van posities en uren in de control tower, hoe lang mogen ze bewaard worden, en is er al een DPIA of
    een afspraak met de OR over volgsystemen?

Bij de planners:

11. Welke cao-regels toetsen jullie nu zelf (10 of 11 uur rust, vrije weekenden, venstertijden), en waar staat dat?
12. Waar staan de charters en oproepkrachten (een Excel, een telefoon), en hebben charters eigen telematica die ze kunnen
    delen?

## Wat er nodig is om dit echt te laten draaien

Data: één dag OTM5 van AH (capaciteit en definitief), één export van het plan uit ORTEC of Navitrans, een API-sleutel voor
posities (Trimble of Platform Science, of één merk via rFMS) en een export van de tachoanalyse, voor één standplaats.
Afspraken: een verwerkersovereenkomst, een DPIA, de OR vooraf, en wie eigenaar is van de data. Techniek: de inname
(beveiligde map, een adapter per bron, de validator uit deze tak, een quarantaine en pseudonimisering) en een database. In
de code is de volgende stap een lader die de toren vult uit onze vorm in plaats van uit `createFleet()`. Dan draait de demo
een echte dag, eerst als herhaling van gisteren, daarna live.

## Risico's en signalen

Dit zijn signalen, geen juridisch advies. Laten toetsen.

- **AVG.** Posities, uren en tachogegevens zijn persoonsgegevens, ook met een nummer in plaats van een naam
  (pseudoniem is niet anoniem). Voor stelselmatig volgen is een DPIA waarschijnlijk nodig. Een verwerkersovereenkomst met
  ons, doelbinding en een bewaartermijn per soort gegeven horen vooraf vast te liggen.
- **OR.** Een systeem dat aanwezigheid, gedrag of prestaties van medewerkers kan volgen, vraagt instemming van de OR
  (artikel 27 van de Wet op de ondernemingsraden, uit kennis). Een rij- of prestatiebeeld per chauffeur blijft uitgesloten
  zonder regeling.
- **Licenties.** De OTM-documentatie staat onder CC BY-SA 4.0; onze vastgezette kopie noemt de bron
  (`tests/otm5/README.md`). De repo van de specificatie heeft zelf geen licentiebestand: nakijken bij SUTC. `tachoparser` is
  AGPL-3.0: gebruik in een dienst kan verplichten de broncode te delen. De rFMS-specificatie hier is een kopie van een
  derde; gebruik de officiële van fms-standard.com.
- **Leveranciers.** De overgang van Trimble naar Platform Science kan API's en contracten veranderen. Navitrans, ORTEC en
  Transporeon leveren via partners; reken op uren en kosten per koppeling.
- **Omvang.** Een hele dag als één OTM5-bestand is 57 MB. Verstuur per rit of per entiteit.
- **Namen in data.** Klantnamen staan in de ritdata als hun eigen bedrijfsnaam. Winkelnamen uit open data bevatten soms de
  naam van de ondernemer (zoals "Plus Tom Groot Roessink, Hengelo"); dat is openbare bedrijfsinformatie, geen
  chauffeursgegeven.

## Bronnen

OTM:

- OTM 5.9.0, specificatie: github.com/opentripmodel/otm5-change-requests, `otm-api/otm-api-v5.9.yaml`, commit `fcef963`
  (2 oktober 2026), changelog in de specificatie. Vastgezet in `demos/simonloos-control-tower/tests/otm5/`. Gelezen.
- OTM-documentatie: github.com/opentripmodel/documentation, commit `c87e397` (13 oktober 2026): Fundamentals, Lifecycles,
  Associations, Design principles, Usage notes (External attributes, UUIDs, Adding constraints), Monitoring trips,
  Profiles (CBS, FMS, eFTI), Adopters, About, FAQ, Validation; de vier voorbeeldritten in `app/static/data/`. Gelezen.
- OTM 4: github.com/opentripmodel/opentripmodel (README: verouderd sinds OTM5 in 2020). Gelezen.
- otm5.opentripmodel.org en sutc.semantic-treehouse.nl: niet te openen vanaf hier.

Albert Heijn en Simacan:

- TTM, "Transplan maakt planning Albert Heijn transport weer wat makkelijker". Zoek (en in het Slimste-onderzoek).
- developer.simacan.com, "OTM5 Trips" en "OTM5 Realisation Data". Zoek.
- Simacan, Proven Case Ahold Delhaize Transport NL (pool van ongeveer 25 vervoerders). Zoek.
- Onze onderzoeken: `onderzoek-en-repos.md`, `planning-visie-en-plan.md`, `systeemlandschap-en-blauwdruk.md`,
  `rapporten/simon-loos-slimste-transporteur/README.md`. Gelezen.

Andere bronnen:

- CBS, "Wegvervoer" (deelnemers enquêtes) en "Tijd besparen" (cbs.nl/tijdbesparen), geopend op 25 oktober 2026. Gelezen.
- Staatscourant 2026, nr. 7211: algemeenverbindendverklaring van bepalingen van de cao Beroepsgoederenvervoer over de weg
  en de verhuur van mobiele kranen, besluit van 2 juli 2026 (zoek.officielebekendmakingen.nl/stcrt-2026-7211.html).
  Gelezen.
- rFMS 4.0 en 5.0 (preliminary 9): OpenAPI in github.com/way-platform/rfms-go, commit `c3f9a32` (3 augustus 2026).
  Gelezen (kopie van een derde).
- Tachograaf: github.com/traconiq/tachoparser, commit `f108ac4` (7 augustus 2026), met verwijzingen naar 165/2014 en
  2016/799 (geconsolideerd 26 februari 2020). Gelezen. Downloadtermijnen (28 en 90 dagen): uit kennis, nakijken.
- Business Central: github.com/MicrosoftDocs/dynamics365smb-devitpro-pb, commit `fb2fdd5` (22 oktober 2026): REST API web
  services, web services, operational limits (18 april 2024 en 8 april 2025), webhooks (23 maart 2026). Gelezen.
- NDW: github.com/ndwnu/its-gegevenscatalogus (commit `94a6f6b`, 16 oktober 2026), model SSTP versie 0.5.0. Gelezen. De
  feeds: github.com/clemensv/real-time-sources (commit `491c091`) en github.com/wissehes/ndw-viewer (commit `6505122`).
  Gelezen (code van derden). opendata.ndw.nu: niet te openen.
- Transporeon Visibility-API: github.com/moxtheox/transporeon_sdk_visibility (commit `a87bf9c`). Gelezen (code van derden).
- Platform Science en Trimble: news.trimble.com (10 februari 2025), Business Wire, ABI Research. Zoek.
- Navitrans en Young & Partners: partnerpagina van nShift, Microsoft AppSource. Zoek.
- ORTEC Routing and Dispatch: presentatie op SlideShare en brochure van ortec.com. Zoek.
- EU 561/2006, 165/2014, 2016/799, 2020/1054 en 581/2010 op EUR-Lex: niet te openen (beveiligingscontrole). Uit kennis,
  nakijken.
- De gesimuleerde dag: `demos/simonloos-control-tower/src/fleet.js` (seed 20261024), gemeten met `tests/otm5-check.mjs`.
