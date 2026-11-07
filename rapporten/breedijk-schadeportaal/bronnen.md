# Schadeportaal Breedijk Transport: bronnen

Onderzoek voor de demo, geraadpleegd op 7 november 2026.

## Lees dit eerst: de status van alles hieronder

In deze sessie ging geen enkele bronpagina open. WebFetch en curl kregen voor elke host een blokkade van het
netwerk (proxy 403, of de host loste niet op): breedijktransport.nl, artsystems.nl, scrumble.nl, appfront.nl,
learn.microsoft.com, opendata.rdw.nl, sva.nl en wikipedia.org. Alleen zoeken werkte. Daarom staat bij
geen enkel feit **gelezen**. Alles is **zoek** (gezien in zoekresultaten, met de URL van de pagina die de
zoekmachine noemde) of **schatting** (eigen inschatting). Voor de demo is dat genoeg. Voor een memo aan
Breedijk moet elk feit nog een keer met de pagina zelf nagekeken worden. Daarvoor moeten deze hosts in de
netwerkinstellingen van de sessie worden toegestaan.

Afkortingen: (zoek, URL) en (schatting). Alle juridische punten zijn signalen: laten toetsen.

**Correctie (7 november, later op de dag):** onderwerp 2 hieronder gaat over Transpas van Art Systems. Het TMS van
Breedijk heet volgens Sem **Transplan** (RGB+, transplan.nl, autotransportsoftware). Het onderzoek naar Transplan,
RGB+ en de boordcomputers van Rietveld staat in `bronnen-transplan.md`; onderwerp 2 blijft staan als
achtergrond over hoe TMS-koppelingen in de sector lopen, maar is niet Breedijks systeem.

---

## 1. Breedijk Transport

### Wie ze zijn

- Breedijk Transport staat in het handelsregister onder KvK 37156877, actief, ingeschreven op 19 oktober
  2009, statutair adres De Veken 208, 1716 KJ Opmeer (zoek, https://www.liza.nl/en/37156877/breedijk-transport).
- Volgens de laatst gedeponeerde jaarcijfers (boekjaar tot 31 december 2024) werken er 58 fte; het eigen
  vermogen over 2024 is ongeveer € 1,16 miljoen; omzet niet bekend (zoek, zelfde URL; een aggregator, niet de KvK).
- De titel van de site is "Breedijk Autotransport BV". Er bestaat dus mogelijk meer dan een bv (Breedijk
  Transport BV en Breedijk Autotransport BV). Welke partij de vervoerder op de vrachtbrief is, doet ertoe
  voor de aansprakelijkheid en de polis (zoek, https://www.breedijktransport.nl/; laten nakijken in de KvK).
- De site heeft ook een pagina over koeltransport. Autotransport is dus niet het enige werk (zoek,
  https://www.breedijktransport.nl/koeltransport/).
- Breedijk zegt een eigen vloot van meer dan 40 autotransporters te hebben (zoek, samenvatting van
  https://www.werkenbijbreedijk.nl/autotransport/ en https://www.breedijktransport.nl/autotransport/).
- Een adres in Barneveld is Industrieweg 12 (zoek, https://www.waze.com/live-map/directions/nl/ge/barneveld/breedijk-autotransport?to=place.ChIJXxl-Sq05xkcRv5ZSd9Cw5_w).
  Nijkerk wordt genoemd als overslagterrein waar auto's heen gaan als ze niet direct op de retourrit gelost
  kunnen worden (zoek, https://www.werkenbijbreedijk.nl/autotransport/). Welke vestiging precies wat doet,
  is uit de zoekresultaten niet eenduidig.

### Volume: een tegenspraak op hun eigen site

- De homepage zegt: "Per week komen en gaan hier circa 800 auto's" (zoek, https://www.breedijktransport.nl/).
- De pagina Overslag zegt: "Met een oppervlakte van wel 16.000 m² kunnen we per dag ongeveer 800 auto's
  klaarzetten voor distributie binnen Nederland" (zoek, https://www.breedijktransport.nl/overslag/).
- Het eerste is een doorstroom, het tweede een capaciteit. Voor de testdata nemen we 800 per week als
  doorstroom en vragen we het na (schatting).
- Een LinkedIn-bericht noemt het terrein vooral bedoeld voor overslag van auto's die uit heel Europa worden
  aangeleverd (zoek, https://nl.linkedin.com/company/breedijk-transport-bv). Er is dus ook internationaal
  vervoer, en dan geldt CMR (zie onderwerp 3).

### Soort klanten

- De opdracht noemt leasemaatschappijen, dealers, veilingen en importeurs. In de zoekresultaten vond ik die
  vier groepen niet terug op hun site; alleen "transporteren auto's door Europa" (zoek,
  https://www.truckfan.nl/bedrijf/14548-breedijk-transport-bv/). Nakijken op de site zelf.

### Schade, schouw en foto's (belangrijk voor het portaal)

- De chauffeur inspecteert elke auto voordat hij op de transporter gaat, maakt van elke auto zes
  overzichtsfoto's en fotografeert en noteert elke schade apart (zoek, samenvatting van
  https://www.breedijktransport.nl/autotransport/).
- Klanten kunnen inloggen op een "persoonlijke vervoerspagina" en daar "meteen de vervoersdocumentatie en
  schouwfoto's bekijken" (zoek, https://www.breedijktransport.nl/over-ons/). In de voettekst staan aparte
  links "Login voor personeel" en "Login voor klanten" (zoek, zelfde bron). De pagina is volgens de
  zoekmachine ongeveer 640 dagen oud.
- De chauffeur maakt het laadplan zelf op basis van de rit van de planner (zoek,
  https://www.werkenbijbreedijk.nl/autotransport/).
- Er bestaat in de branche een "schade-indicator" waarmee de grootte van een beschadiging op een voertuig
  wordt vastgesteld; TLN noemt hem bij de deelmarkt autotransport (zoek,
  https://www.tln.nl/over-tln/deelmarkten/autotransport/). Of Breedijk hem gebruikt, is niet bekend.

### Wat dit voor de demo betekent (schatting)

- De schouwfoto's bestaan al digitaal en klanten zien ze al. Het klantportaal is waarschijnlijk Transpas
  Online (onderwerp 2), maar dat is een vermoeden. Het schadeportaal hoeft de foto's dus niet te maken, alleen
  op te halen en naast de claim te leggen.
- Zes overzichtsfoto's per auto bij ophalen, maal 800 auto's per week, is ongeveer 4.800 foto's per week
  aan ophaalkant, plus de aflevering als daar ook foto's gemaakt worden (schatting).

---

## 2. Transpas (Art Systems, Tilburg)

### Het product

- Art Systems in Tilburg maakt Transpas Enterprise, een TMS voor orders, planning, facturatie,
  boordcomputercommunicatie, emballage en warehouse (zoek, https://scansys.eu/koppeling/art-systems-transpas en
  https://www.accountone.nl/accountview/koppelingen/transpas-enterprise-tms/).
- Transpas Online is het portaal waarin klanten, charters en geadresseerden orders, facturen, voorraad,
  emballage en zendingdocumenten zien. Documenten zoals vrachtbrieven en afleverbonnen staan per order
  (zoek, https://artsystems.nl/en/transpas-online-3/ en https://artsystems.nl/en/transpas-online-2/).
- Charters kunnen getekende vrachtbrieven uploaden die dan onder de zending in Transpas Enterprise staan;
  klanten kunnen zelf transportorders invoeren; geadresseerden volgen een zending via een link zonder
  account (zoek, zelfde bronnen).
- Over foto's in Transpas Online vond ik niets. Breedijk zegt wel dat klanten schouwfoto's zien (onderwerp 1).
  Of dat via Transpas Online gaat of via iets anders, moet Breedijk zeggen (zoek).

### De chauffeursapp

- Een eigen Transpas-chauffeursapp vond ik niet in de zoekresultaten. Transpas koppelt met apps en
  boordcomputers van anderen:
  - MobiScout Mobile (MobiCoach): de chauffeur kan berichten en foto's versturen, barcodes scannen,
    emballage registreren en rit- en orderafhandeling doen; vanuit Transpas is een koppeling gemaakt zodat de
    chauffeur zijn rit ontvangt en afwijkingen automatisch geregistreerd worden (zoek,
    https://artsystems.nl/integratie-mobicoach/).
  - Trimble, Data2Track, EasyTrack en CargoLedger worden genoemd als boordcomputerkoppelingen (zoek,
    samenvatting van https://appfront.nl/en/transpas-integratie en een releasenote,
    https://help.artsystems.nl/releasenotes/transpas_enterprise_release_august_2021_2_nl_.pdf).
  - Sluyter gebruikt LogiApp, "volledig geïntegreerd met Transpas Enterprise", met digitale handtekening na
    het lossen (zoek, https://www.ttm.nl/trucks/sluyter-verruilt-boordcomputers-voor-smartphones/48490/; oud artikel).
- Gevolg (schatting): de foto's van de chauffeur staan misschien niet in Transpas zelf maar bij de leverancier
  van de app of boordcomputer, en Transpas toont of linkt ze. Dan is de app-leverancier de tweede partij om
  te vragen. Dit is de belangrijkste open vraag van het hele onderzoek.

### Koppelingen

- Art Systems biedt volgens de zoekresultaten "zowel API-koppelingen als EDI" en standaardkoppelingen met
  boordcomputers (onder andere Trimble), boekhouding (Exact, AFAS, Twinfield), EDI-berichten en salaris via
  Loket.nl (zoek, https://appfront.nl/en/transpas-integratie; https://loket.nl/koppelingen/art-systems-transportsoftware/).
- Een integrator schrijft dat Art Systems de API-inloggegevens verstrekt, dat je begint in een
  stagingomgeving, en dat het meestal om OAuth of API-sleutels met een IP-whitelist gaat (zoek,
  https://scrumble.nl/blog/technologie/transpas-api-koppeling/).
- Een ander bureau bouwt "Transpas Enterprise Web RestFullAPI services" op maat (zoek,
  https://www.transpaswebapi.nl/). Openbare documentatie van endpoints vond ik niet.
- Scan Sys koppelt gescande vrachtbrieven en CMR's via barcode of dossiernummer aan orders in Transpas (zoek,
  https://www.scansys.eu/koppeling/geautomatiseerde-vrachtbriefverwerking-met-transpas/).
- Connectorleveranciers noemen REST en SOAP (zoek, https://eqgroup.nl/databronnen/art-systems-transpas-enterprise).
- Over EDIFACT, XML of SFTP bij Transpas vond ik niets concreets. transportkoppeling.nl en uniglobal.nl kwamen
  niet in de resultaten; niet geopend (zoek).

### Conclusie over "gesloten systeem"

- Breedijk denkt dat Transpas geen koppelingen ondersteunt. De zoekresultaten wijzen de andere kant op:
  meerdere bureaus bouwen koppelingen, Art Systems geeft API-toegang en er zijn standaardkoppelingen (zoek).
  Sem heeft hier vermoedelijk gelijk. Wel geldt: toegang loopt via Art Systems, en kost waarschijnlijk geld
  en doorlooptijd (schatting).

### Drie routes, van zeker naar onzeker (schatting, op basis van het bovenstaande)

1. **De API via Art Systems.** Kenteken in, ritten en chauffeur uit, en als het kan de documenten en
   foto's. Zeker als techniek (bureaus doen het al), onzeker in tijd en kosten, en in de vraag of foto's
   via de API komen. Begint in staging.
2. **Export of rapport uit Transpas, plus de foto's uit het klantportaal of de app-leverancier.** Een
   dagelijkse export (csv of Excel) van ritregels met kenteken, datum, chauffeur en klant is in de meeste TMS
   een standaardfunctie. Foto's dan via de app-leverancier of een downloadlink uit het portaal. Werkt
   zonder Art Systems te laten bouwen, maar is een dag oud en handwerk om in te richten.
3. **Mailparsing of RPA.** Afleverbonnen en ritbevestigingen die Transpas toch al mailt, automatisch
   uitlezen; of een robot die het kenteken in Transpas intikt en het scherm uitleest. Werkt altijd, maar
   breekt bij elke wijziging in het scherm of de mail. Alleen als proef of noodroute.

Voor de demo bouwen we de gegevens in de vorm van route 1 (een rit met kenteken, datum, tijd, chauffeurscode,
laad- en losadres, foto's met tijdstip), zodat echte data later zonder ombouw past.

### Wat we Art Systems moeten vragen

- Is er een REST-API voor Transpas Enterprise, en kan Breedijk die afnemen? Wat kost het, hoe lang duurt
  aansluiten, is er staging?
- Kan je via de API op kenteken (of VIN) zoeken en de ritten, de chauffeur en de tijden terugkrijgen?
- Waar staan de foto's van de schouw: in Transpas, of bij de app- of boordcomputerleverancier? Zijn ze
  via de API of een export op te halen, met tijdstip en (als die er is) gps-positie?
- Kan Transpas bij een nieuwe rit of status een bericht sturen (webhook), of moeten we opvragen?
- Mogen wij als derde partij in opdracht van Breedijk koppelen, en welke voorwaarden gelden daarvoor?

---

## 3. Aansprakelijkheid en termijnen (signalen, laten toetsen)

### Binnenlands: AVC 2002 (Stichting Vervoeradres)

- De aansprakelijkheid van de vervoerder voor verlies of schade is beperkt tot € 3,40 per kilogram
  brutogewicht van de beschadigde of verloren zaken, behalve bij opzet of bewuste roekeloosheid (zoek,
  https://www.sva.nl/themas/avc-2002/korte-antwoorden-over-aansprakelijkheid-schade-verjaring en
  https://transportbedrijf.nl/vergelijken/avc-of-cmr).
- **Artikelnummer: anders dan in de opdracht.** Een bron noemt artikel 13 voor de limiet; een inhoudsopgave van de
  AVC 2002 noemt artikel 10 "Aansprakelijkheid van de vervoerder" en artikel 20 "Stapelvervoer;
  doorvervoer". De € 3,40 in artikel 20 gaat volgens een zoekresultaat over de vervoerder die na aflevering
  doorvervoer regelt en dan als expediteur optreedt (zoek, https://www.sva.nl/blog/sva-voorwaarden-15/avc-2002-545,
  https://transportbedrijf.nl/vergelijken/avc-of-cmr). Het juiste artikel nakijken in de tekst zelf voordat we het noemen.
- Het gewicht dat telt, is het gewicht op de vrachtbrief (zoek,
  https://vanspreuweltransport.nl/wp-content/uploads/2022/11/AVC2002.pdf).
- Een voorbehoud bij zichtbare schade moet specifiek zijn; een algemene standaardzin op de vrachtbrief heeft
  volgens SVA geen effect (zoek, https://www.sva.nl/themas/avc-2002/korte-antwoorden-over-aansprakelijkheid-schade-verjaring).
- Niet zichtbare schade: de ontvanger moet binnen zeven dagen na aflevering schriftelijk voorbehoud maken;
  doet hij dat niet, dan geldt dat hij de zaken in de staat van de vrachtbrief ontving (zoek, zelfde bron).
  De AVC-tekst zelf zegt "binnen een week"; zon- en feestdagen tellen mogelijk niet mee (zoek,
  https://transportbedrijf.nl/vergelijken/avc-of-cmr).
- Verjaring: rechtsvorderingen uit de vervoerovereenkomst verjaren na een jaar (zoek, zelfde SVA-bron).
- Vertraging: zonder schriftelijke levertermijn maximaal de vrachtprijs, met zo'n termijn tweemaal (zoek,
  https://www.evofenedex.nl/kennis/vervoer/vervoersmodaliteiten/vervoer-over-de-weg/logistieke-voorwaarden-uitbesteed-vervoer/voorwaarden-nationaal-wegvervoer).

### Internationaal: CMR-verdrag

Tekst: https://wetten.overheid.nl/BWBV0005177/1986-04-28 (niet geopend; alles hieronder zoek).

- Artikel 17: de vervoerder is aansprakelijk voor verlies en beschadiging tussen inontvangstneming en
  aflevering, en voor vertraging (zoek).
- Artikel 23 lid 3: de vergoeding is maximaal 8,33 rekeneenheden (SDR) per ontbrekend kilogram brutogewicht (zoek).
- Artikel 30: zichtbare schade bij aflevering melden; niet zichtbare schade schriftelijk binnen zeven
  dagen, zon- en feestdagen niet meegerekend; vertraging binnen 21 dagen (zoek; de zevendagentermijn kwam
  in de fragmenten niet letterlijk terug, nakijken in de tekst).
- Artikel 32 lid 1: verjaring na een jaar; lid 2: een schriftelijke reclamatie schorst de verjaring (zoek,
  https://www.sva.nl/blog/weg-wagen-6/verjarings-en-vervaltermijnen-in-het-cmr-verdrag-duur-aanvang-verloop-schorsing-en-stuiting-deel-i-255).

### Wat de kilogramlimiet voor een auto betekent (schatting)

- Een auto van 1.300 kg ledig: onder AVC maximaal 1.300 × € 3,40 = € 4.420.
- Onder CMR: 1.300 × 8,33 = 10.829 SDR. Bij een koers van ongeveer € 1,15 tot € 1,20 per SDR (schatting,
  koers niet nagekeken) is dat circa € 12.500 tot € 13.000.
- Een bumperschade van een paar honderd euro tot € 1.750 blijft dus ruim onder de limiet. De limiet is pas
  van belang bij zware schade of total loss. Voor het dagelijkse werk wegen de termijn en het voorbehoud
  op de afleverbon zwaarder dan de limiet (schatting).
- Let op: welk gewicht telt (ledig, rijklaar, op de vrachtbrief) laten toetsen. RDW geeft "massa ledig voertuig" (onderwerp 5).

### Sectorvoorwaarden voor autotransport

- Ik vond geen aparte TLN-voorwaarden voor autotransport over schouw bij ophalen en afleveren (zoek,
  https://www.tln.nl/ledenvoordeel/voorwaarden).
- TLN heeft een deelmarkt autotransport met circa 60 bedrijven (zoek, https://www.tln.nl/over-tln/deelmarkten/autotransport/).
- Het TLN-keurmerk vraagt bewijs van ophalen en afleveren met ondertekende documenten of een wederzijds
  geaccepteerde bevestiging (artikel 4.21) (zoek,
  https://cms.tln.nl/storage/media/00.-Bestanden/201910-Reglement-Keurmerk-Transport-en-Logistiek-TLN.pdf).
- Leasemaatschappijen hebben eigen innameprotocollen met de grens tussen "gebruiksschade" en echte schade
  (zoek, https://justlease.nl/uploads/2025/03/Innamehandleiding-Justlease.pdf;
  https://www.athlon.com/nl/zakelijk/uw-leaseauto/teruggeven/inname/inleverschade). Arval noemt in een
  handleiding een grens van € 500 inclusief btw voor nieuwe schade tussen inspectie en inname (zoek,
  https://www.arval.nl/sites/default/files/119/2023/11/Innamehandleiding%20Hyundai%202023_0.pdf). Zulke
  protocollen bepalen mee wat een leasemaatschappij als claim indient (schatting).
- Wat Breedijk met elke klant contractueel afspreekt (AVC, CMR of eigen voorwaarden), moet Breedijk zeggen.

---

## 4. Schadecodes in de voertuiglogistiek (AIAG/ECG, M-22)

- De schadecode heeft vijf cijfers: twee voor het gebied, twee voor de soort, een voor de ernst (zoek,
  https://superdispatch.com/blog/aiag-damage-codes/ en https://www.ecgassociation.eu/wp-content/uploads/2022/11/AIAG-Damage-Codes-21.11.pdf).
- Ernst loopt van 0 tot 6. Codes 1 tot 5 zijn maatklassen naar lengte of doorsnede; 6 is ontbrekend of
  zware schade. Ernst 1 is tot en met 1 inch (2,5 cm) (zoek, zelfde bronnen). De grenzen van 2 tot 5 vond ik
  niet betrouwbaar terug (zoek).
- Meerdere schades op hetzelfde paneel tellen als ernst 3, ongeacht de afzonderlijke ernst (zoek,
  https://proautogistics.com/wp-content/uploads/2024/04/AIAG-DAMAGE-CODES_2023.pdf).
- ECG noemt M-22 ook "Finished Vehicle Transport Damage Reporting" met de "Global Damage Codes", oorspronkelijk
  van AIAG; ECG en AIAG werken sinds 2007 samen (zoek, https://www.ecgassociation.eu/publications-and-reports/aiag-damage-codes/).
- **Editie:** de zesde editie van M-22 kwam uit in juni 2023 (AIAG kondigde in september 2024 de versie 6 aan)
  en heeft "veel gebied- en soortcodes herzien en opnieuw toegekend" (zoek,
  https://www.aiag.org/about-aiag/newsroom/articles/2024/09/23/aiag-announces-new-finished-vehicle-logistics-(fvl)-guidance-documents
  en https://www.en-standard.eu/finished-vehicle-logistics-transportation-damage-handling). De codes hieronder
  komen uit de tabel van november 2021 en oudere lijsten. Ze kunnen in de zesde editie anders zijn.
- ECG vertegenwoordigt volgens een zoekresultaat 55 grote bedrijven in de Europese voertuiglogistiek (zoek,
  https://www.ecgassociation.eu/wp-content/uploads/2019/10/M22-version-4-1.pdf).
- Of Nederlandse autotransporteurs zoals Breedijk de codes gebruiken, vond ik niet. Grote spelers in de
  Europese keten werken ermee; een kleinere transporteur voor gebruikte auto's waarschijnlijk niet (schatting).

### Gebieden (zoek; editie november 2021 of ouder)

| Gebied | Code | Status |
| --- | --- | --- |
| Bumper voor (bumper/cover/exterieur) | 03 | zoek |
| Bumperstrip voor | 05 | zoek |
| Bumper achter | 04 | zoek |
| Bumperstrip achter | 06 | zoek |
| Portier links voor | 10 | zoek |
| Andere portieren | niet gevonden | zoek |
| Voorruit | 20 | zoek |
| Motorkap | 27 | zoek |
| Dak | 37 | zoek |
| Schuif- of glazen dak | 53 | zoek |
| Spatbord | niet gevonden | zoek |
| Velg | niet gevonden | zoek |
| Achterklep | niet gevonden | zoek |
| Spiegel | niet gevonden | zoek |

### Soorten (zoek)

| Soort | Code | Status |
| --- | --- | --- |
| Gebroken / zware schade (in andere tabellen "werkt niet") | 02 | zoek, bronnen spreken elkaar tegen |
| Gedeukt, lak of chroom beschadigd | 04 | zoek |
| Afgebladderd (chip), geen glas of paneelrand | 05 | zoek |
| Gegutst | 07 | zoek |
| Gekrast (geen glas) | 12 | zoek |
| Gedeukt, lak niet beschadigd | 14 | zoek |
| Afgebladderd, paneelrand | 34 | zoek |

Bronnen soorten: https://aar.com/standards/pdfs/GLOVIS%20APPENDIX.%20E%20Vehicle%20Inspection%20Damage%20Codes%202.0.pdf
en https://proautogistics.com/wp-content/uploads/2024/04/AIAG-DAMAGE-CODES_2023.pdf.

Voorbeeld (schatting, op basis van de tabellen): "03 12 2" is een kras op de voorbumper in maatklasse 2.

Voor de demo: sla de code op als drie velden (gebied, soort, ernst) met een eigen Nederlands label, en
houd de editie bij als veld. Dan kan de echte M-22-tabel er later in zonder ombouw.

---

## 5. RDW open data: Gekentekende voertuigen

- Dataset m9d7-ebf2 op https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen/m9d7-ebf2
  (zoek). Licentie: publiek domein op het RDW-portaal, CC-0 (1.0) volgens data.overheid.nl (zoek,
  https://data.overheid.nl/en/dataset/11441-open-data-rdw--gekentekende-voertuigen).
- Ongeveer 16,9 miljoen rijen en 98 kolommen; bijgewerkt eind oktober of begin november 2026 (zoek, zelfde bronnen).
- Endpoint in Socrata-vorm: `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=AB123C` (kenteken in
  hoofdletters, zonder streepjes) (zoek, https://github.com/zebrassimo/NL-open-data-RDW; vorm schatting).
- In de csv-kop staan onder meer Kenteken, Voertuigsoort, Merk, Handelsbenaming, Eerste kleur, Datum eerste
  toelating, Massa ledig voertuig en Catalogusprijs (zoek,
  https://opendata.rdw.nl/api/views/m9d7-ebf2/rows.csv?accessType=DOWNLOAD). In de API zijn de veldnamen
  klein met underscores (merk, handelsbenaming, eerste_kleur, datum_eerste_toelating, massa_ledig_voertuig,
  catalogusprijs, voertuigsoort) (schatting, naar het patroon van Socrata).
- App-token: gaat in de kop `X-App-Token`; zonder token wordt per IP-adres afgeremd, met token per
  applicatie, en te veel verzoeken geven HTTP 429 (zoek, https://dev.socrata.com/docs/app-tokens).
  Derden noemen 1.000 verzoeken per uur met een gratis token; dat staat niet in de officiële docs (zoek,
  https://supergood.ai/api-report-card/socrata). Voor een schadeportaal met tientallen claims per week is
  dat ruim genoeg (schatting).
- Catalogusprijs is bij oudere auto's vaak leeg (schatting; nakijken met een steekproef).

Waarom nuttig (schatting):

- **Gewicht** voor de kilogramlimiet van AVC en CMR (onderwerp 3).
- **Catalogusprijs en datum eerste toelating** als context bij nieuwwaarde tegenover dagwaarde (onderwerp 7).
- **Controle van een kenteken uit een mail**: klopt het merk en de kleur met de foto's en de claim? Een
  verkeerd overgetikt kenteken valt direct op.
- Let op: een kenteken kan in combinatie met andere gegevens een persoonsgegeven zijn. De RDW-data zelf
  bevat geen eigenaar (signaal, laten toetsen).

---

## 6. De mailbox koppelen

### Microsoft Graph

- Een app leest een gedeelde mailbox met de application permission Mail.Read. Mail.ReadBasic is te smal:
  die geeft geen body en geen bijlagen (zoek, https://learn.microsoft.com/en-us/graph/api/message-list-attachments
  en https://practical365.com/rbac-for-applications/).
- Bijlagen: `GET /users/{id | userPrincipalName}/messages/{id}/attachments` geeft de bijlagen;
  een `fileAttachment` heeft `contentBytes` (base64), `name`, `contentType` en `size` (zoek,
  https://learn.microsoft.com/en-us/graph/api/message-list-attachments).
- Beperk de app tot de schade-mailbox. Microsoft noemt "RBAC for Applications" in Exchange Online als opvolger
  van de oudere Application Access Policies; ook gedeelde mailboxen kunnen in een management scope (zoek,
  https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac en
  https://learn.microsoft.com/en-us/exchange/permissions-exo/application-access-policies). Zonder zo'n
  beperking kan een app met Mail.Read alle mailboxen van de organisatie lezen (zoek, zelfde bronnen).
  Een oudere Q&A spreekt dit tegen voor Graph; nakijken.
- Change notifications: een abonnement op berichten duurt maximaal 10.080 minuten (net onder zeven dagen) en
  moet worden verlengd; met resource data in de melding maximaal 1.440 minuten (zoek,
  https://learn.microsoft.com/graph/api/resources/subscription). Gebruik een `lifecycleNotificationUrl` voor
  de meldingen subscriptionRemoved, missed en reauthorizationRequired, en haal na een gemiste melding bij met
  een delta query (zoek, https://learn.microsoft.com/en-us/graph/webhooks-lifecycle).
- Het eenvoudigste alternatief is elke paar minuten opvragen (poll) met een delta query (schatting). Voor
  tientallen mails per week is dat genoeg.
- Rol van de Microsoft 365-beheerder (zoek in algemene zin, details niet geopend): een app-registratie in
  Microsoft Entra ID aanmaken, de application permission Mail.Read toekennen en admin consent geven, en de
  app via RBAC for Applications beperken tot de schade-mailbox. Een certificaat in plaats van een geheim
  is netter (schatting).

### Zonder code: Power Automate

- De trigger "When a new email arrives in a shared mailbox (V2)" van de Office 365 Outlook-connector staat
  standaard met "Include Attachments" en "Only with Attachments" op Nee; zet "Include Attachments" op Ja,
  anders is de inhoud van de bijlage leeg en faalt een volgende stap (zoek,
  https://learn.microsoft.com/en-au/troubleshoot/power-platform/power-automate/flow-run-issues/issues-triggering-emails-with-attachments-from-shared-mailbox).
- De trigger kan dezelfde mail twee keer afleveren (bijvoorbeeld bij Safe Attachments met Dynamic Delivery);
  controleer op dubbelen (zoek, https://collab365.com/blog/power-automate-and-shared-mailbox).
- Voor een proef is Power Automate de snelste route: mail binnen, bijlagen naar een SharePoint-map, een regel
  naar het portaal. Daarna kan Graph het overnemen (schatting).

### AVG (signalen, laten toetsen)

- Schademails bevatten namen, e-mailadressen, telefoonnummers en kentekens van de tegenpartij, en
  chauffeurscodes. Dat zijn persoonsgegevens.
- Wie het portaal bouwt of host, is verwerker voor Breedijk: een verwerkersovereenkomst is nodig.
- Een bewaartermijn: claims hebben een verjaring van een jaar (onderwerp 3); langer bewaren vraagt een reden.
- Het overzicht "wie rijdt schade" is een beeld van de prestatie van chauffeurs. Dat raakt de privacy van
  werknemers en mogelijk het instemmingsrecht van de ondernemingsraad bij een personeelsvolgsysteem (signaal, laten toetsen).
- Foto's van auto's kunnen mensen of andere kentekens tonen (signaal).
- Stuur je mails of foto's naar een AI-dienst, dan is dat een extra verwerking en een extra verwerker (signaal).

---

## 7. Schadecalculatie en onderhandelen

- Audatex is in 1981 opgericht door Nederlandse verzekeraars samen met FOCWA, BOVAG, RAI en de ANWB en wordt
  breed gebruikt; het zet fabrieksgegevens over hersteltijd en vervanging om in tijd en materiaal. Het
  uurtarief en de keuze voor nieuwe of gebruikte onderdelen bepaalt het herstelbedrijf zelf (zoek,
  https://solera.nl/nieuws-1/schadecalculatie-vroeger-en-nu-van-nattevingerwerk-naar-algoritmes).
- DAT Nederland is opgericht door VWE en DAT Group als alternatief voor Audatex (zoek,
  https://aftersalesmagazine.nl/nieuws/algemeen/nieuwe-concurrent-audatex/).
- Een calculatie bestaat uit arbeidsloon (uren maal uurtarief), onderdelen, spuitwerk (lakuren en
  lakmateriaal), kleine materialen en btw (schatting, gangbare opbouw; niet in een geopende bron gezien).
- In het eerste halfjaar van 2024 lagen arbeidsloon, onderdelen en spuitkosten ongeveer tien procent hoger;
  het gemiddelde arbeidsloon per calculatie steeg van € 640 naar € 705 (zoek,
  https://www.automotive-online.nl/management/schade/2024/09/03/audatex-schadelast-in-eerste-halfjaar-fors-hoger/).
- Uurtarief: een FOCWA-gerelateerde bron noemt € 78,50 voor arbeid en € 81,75 voor spuitwerk als realistisch
  stuurtarief, zonder duidelijke datum (zoek, https://schadeherstelbranche.nl/tag/focwa/). Een oudere
  uitspraak van de Hoge Raad noemt € 66 en € 69,80 exclusief btw (zoek,
  https://platformpersonenschade.verzekeraars.nl/hr-abstracte-schadebegroting-autoschade-op-basis-audatex-vanwege-eenvoudige-en-uniforme-afwikkeling/).
  Voor 2026 rekenen we in de testdata met € 80 tot € 95 per uur exclusief btw (schatting).

Wat een vervoerder toetst in een offerte (schatting, gangbare praktijk; laten toetsen):

- Herstellen in plaats van vervangen (een deuk uitdeuken, smart repair, spot repair).
- Dubbele posten (twee keer demontage, overlap tussen lakuren van aangrenzende delen).
- Schade die er al was: staat die op de ophaalfoto's of op de vrachtbrief?
- Uurtarief en lakmateriaal tegenover het marktgemiddelde.
- Nieuwwaarde tegenover dagwaarde: bij een gebruikte auto is vervangen door een nieuw onderdeel een
  verbetering; aftrek "nieuw voor oud" bespreken.
- Btw: een ondernemer (leasemaatschappij, dealer) kan de btw meestal terugvragen; dan vergoed je exclusief btw.
- Waardevermindering en stilstand: die vallen onder AVC en CMR meestal buiten de vergoeding of onder de limiet (laten toetsen).

---

## 8. Verzekering

- Een vervoerdersaansprakelijkheidsverzekering dekt de aansprakelijkheid van de vervoerder volgens AVC of CMR
  (zoek, https://www.sva.nl/themas/verzekeringen/praktijkboek-over-verzekeringen-de-logistiek/verzekeringen-voor-de-vervoerdersaansprakelijkheid;
  https://www.interpolis.nl/zakelijk/verzekeren/vervoerdersaansprakelijkheidsverzekering).
- Het eigen risico hangt af van landen, soort vervoer en soort schade, en is vaak zelf te kiezen (zoek,
  https://verzekeringskaarten.nl/asr/vervoerdersaansprakelijkheid). Voor diefstal van een hele lading geldt vaak
  een hoger eigen risico, een bron noemt 30 procent met een minimum van € 25.000 (zoek, SVA-praktijkboek hierboven).
- Of het eigen risico per gebeurtenis of per claim geldt, staat in de polis. Breedijk noemt € 750 (gesprek; polis niet gezien).
- Melden: zo snel mogelijk en volledig (zoek, https://verzekeringskaarten.nl/asr/vervoerdersaansprakelijkheid).
- Stukken die verzekeraars en SVA noemen: vrachtbrief (CMR), pakbon, factuur, correspondentie, foto's,
  schadeformulier, hersteloffertes en facturen (zoek, https://www.sva.nl/themas/schade/schade-claimen;
  https://zakelijkeverzekering.nl/blog-kennisbank/schadeclaim-vrachtwagen-stappenplan/). Voor autotransport
  voeg ik toe: de ophaal- en afleverfoto's, de aansprakelijkstelling van de tegenpartij, de calculatie en
  eventueel de afwijzingsbrief (schatting).
- Expertise: boven een bepaald bedrag stuurt de verzekeraar een expert (schatting; bedrag staat in de polis).

### Waarom een interne drempel van € 1.750 boven het eigen risico van € 750 (schatting)

- Onder € 750 betaalt Breedijk alles zelf; de verzekering doet niets.
- Tussen € 750 en € 1.750 zou de verzekeraar € 1 tot € 1.000 betalen. Elke melding telt in het
  schadeverleden en kan de premie bij verlenging verhogen. Zelf betalen is dan vaak goedkoper.
- Boven € 1.750 is de uitkering groot genoeg om de premiestijging en het werk van een melding te rechtvaardigen.
- Let op: de polis kan eisen dat elke aansprakelijkstelling gemeld wordt, ook als je zelf betaalt. Niet melden
  kan dekking kosten (signaal, laten toetsen bij de makelaar).

---

## 9. AI in schadeafhandeling (voorbeelden, geen aanbeveling)

- **Focalx**: AI-schadeherkenning met 360-gradenscans en conditierapporten, zegt AIAG-, ECG- en AAR-codes te
  volgen, met een partnerschap met VASCOR in de Amerikaanse voertuiglogistiek en inspecties bij elke ophaal en
  aflevering, gekoppeld aan het VIN (zoek, https://focalx.ai/yard-operations/ en https://focalx.ai/product/).
- **UVeye**: vaste camera's, ook onder de auto; komt uit de beveiliging van grensposten (zoek, https://uveye.com/).
- **ProovStation**: een doorrijstraat die in een keer meer dan 200 foto's in 4K maakt (zoek, https://proovstation.com/).
- **Tractable**: beoordeelt schadefoto's voor verzekeraars; de eigenaar uploadt foto's via een link (zoek,
  https://inspektlabs.com/blog/top-10-ai-powered-car-damage-inspection-solutions-2/).
- Onafhankelijke vergelijkingen van de nauwkeurigheid vond ik niet; de cijfers komen van de leveranciers zelf (zoek).

Wat realistisch is met een taalmodel met beeldinvoer (schatting):

- Velden uit een mail halen: kenteken, datum, afzender, soort klant, beschreven schade, bijlagen. Goed te doen.
- De ophaalfoto naast de claimfoto leggen en aanwijzen: "op de ophaalfoto van 3 november is de linkerhoek
  van de voorbumper al beschadigd". Bruikbaar als hulp voor de behandelaar, niet als bewijs. Licht, hoek en
  resolutie verschillen; het model kan zich vergissen.
- Een voorstel voor de schadecode (gebied, soort, ernst) en een conceptantwoord aan de tegenpartij met de
  juiste foto's erbij.
- Een offerte uitlezen en posten markeren die opvallen (dubbel, vervangen waar herstel kan).

Wat niet:

- Een juridisch oordeel over aansprakelijkheid of termijnen.
- Een bedrag vaststellen of accepteren zonder mens.
- Een uitspraak over een chauffeur.
- De mens beslist altijd, en het portaal zegt erbij dat het een voorstel is.

---

## 10. Cijfers voor de simulatie

Alles hieronder is zwak onderbouwd. Het bepaalt alleen de verhoudingen in de testdata.

- Een consumentenvervoerder noemt 2 tot 3 procent schade bij open transport en 0,5 tot 1 procent bij
  gesloten transport, en een claimpercentage van 0,8 tot 1,2 procent (zoek, een bedrijf over zichzelf,
  https://ultimatetransport123.com/vehicle-damage-prevention-faq-2026/).
- Een Automotive Logistics-artikel noemt claims rond 1 procent bij inkomende zendingen van een Ford-fabriek;
  het gaat om onderdelen en is ongeveer 14 jaar oud (zoek, https://www.automotivelogistics.media/damage-control/7895.article).
- Een ECG-onderzoek met een schadecijfer per 100 of 1.000 auto's vond ik niet (zoek).
- Gemiddeld arbeidsloon per Audatex-calculatie € 705 in 2024 (zoek, onderwerp 7).

Aannames voor de testdata (schatting):

| Grootheid | Waarde | Status |
| --- | --- | --- |
| Auto's per week | 800 | zoek (eigen site), nog navragen |
| Claims per 100 vervoerde auto's | 1 (bandbreedte 0,5 tot 2) | schatting |
| Claims per week | circa 8 (4 tot 16) | schatting |
| Deel "zat er al op" (afgewezen met ophaalfoto) | 30 procent | schatting |
| Deel onder € 750 | 50 procent | schatting |
| Deel € 750 tot € 1.750 | 30 procent | schatting |
| Deel boven € 1.750 (verzekering) | 20 procent | schatting |
| Gemiddelde claim gebruikte auto | € 900 (spreiding € 150 tot € 6.000) | schatting |
| Doorlooptijd eenvoudige claim | 5 tot 15 werkdagen | schatting |
| Doorlooptijd met verzekeraar | 4 tot 12 weken | schatting |
| Chauffeurs | circa 45 (bij 40+ transporters) | schatting |
| Schades per chauffeur per jaar | Poisson, gemiddeld 4, enkele uitschieters | schatting |
| Claims na de termijn van zeven dagen | 15 procent | schatting |

---

## Wat we moeten doorvragen

**Bij Breedijk**

1. Hoeveel claims komen er per week of maand binnen, en hoeveel daarvan wijs je af omdat de schade er al zat?
2. Rijden jullie 800 auto's per week of per dag (homepage tegenover de pagina Overslag)?
3. Welke voorwaarden staan op de vrachtbrief: AVC 2002, CMR of eigen voorwaarden per klant? En welke bv is vervoerder?
4. Worden er ook bij aflevering foto's gemaakt, en tekent de ontvanger voor ontvangst met of zonder voorbehoud?
5. Met welke app of boordcomputer maken de chauffeurs de schouwfoto's, en is het klantportaal Transpas Online?
6. Mogen we een geanonimiseerd deel van de Excel zien (kolommen, aantallen, bedragen), zodat de testdata klopt?
7. Is er een ondernemingsraad, en weten de chauffeurs dat de Excel per persoon wordt bijgehouden?

**Bij Art Systems** (en zo nodig de app-leverancier)

8. Is er een REST-API voor Transpas Enterprise, met staging, en wat kost toegang voor een derde partij?
9. Kun je op kenteken zoeken en krijg je ritten, chauffeur, tijden en documenten terug?
10. Waar staan de schouwfoto's, en zijn ze met tijdstip en positie via API of export op te halen?

**Bij de verzekeraar of makelaar**

11. Geldt het eigen risico van € 750 per gebeurtenis of per claim, en moet elke aansprakelijkstelling gemeld
    worden, ook onder de drempel?
12. Welke stukken wil de verzekeraar standaard, en mag dat digitaal als een pakket uit het portaal?

**Bij de Microsoft 365-beheerder**

13. Wil je een app-registratie met Mail.Read, beperkt tot de schade-mailbox via RBAC for Applications, of
    liever eerst een proef met Power Automate?
14. Hoe lang worden mails in de schade-mailbox nu bewaard, en is er een bewaarbeleid?

---

## Een eigen idee: de termijnklok

**Het probleem.** De behandelaar kijkt nu of Breedijk de auto reed en of de schade er al zat. Hij kijkt
waarschijnlijk niet systematisch naar de klok. Onder AVC en CMR moet niet zichtbare schade binnen zeven
dagen na aflevering schriftelijk gemeld worden, en zichtbare schade direct bij aflevering met een specifiek
voorbehoud. Een claim die later komt, of een afleverbon zonder voorbehoud, verzwakt de positie van de
tegenpartij sterk (zoek, onderwerp 3; laten toetsen). Dat argument kost niets, als je het ziet.

**Wat het portaal doet.** Bij elke claim legt het drie datums naast elkaar: aflevering volgens Transpas,
ontvangst van de mail, en of de afleverbon een voorbehoud heeft. Het toont "gemeld na 11 dagen, geen
voorbehoud op de afleverbon" bovenaan de claim, met de termijn die bij de vrachtbrief hoort (AVC of CMR,
werkdagen of kalenderdagen). De behandelaar beslist; het portaal wijst het alleen aan, met de tekst
"laten toetsen" bij twijfel. Ook de verjaring van een jaar komt in beeld, zodat oude claims niet blijven liggen.

**Voorbeeld uit een andere sector.** Luchtvaartmaatschappijen werken bij beschadigde bagage met een vaste
meldtermijn (onder het Verdrag van Montreal zeven dagen voor schade, zoek: niet nagekeken in deze sessie).
Hun claimsystemen zetten de datum van aankomst naast de datum van de melding en wijzen te late claims af als
eerste stap, voordat iemand naar de schade kijkt. Pakketvervoerders doen hetzelfde met hun klachttermijn.

**Wat het oplevert (schatting).** Stel 8 claims per week, gemiddeld € 900, en 15 procent komt na de termijn.
Dat is ruim 60 claims per jaar. Als de helft daarvan alsnog vervalt of met korting wordt geschikt, is dat
ongeveer 30 × € 900 = € 27.000 per jaar, plus de tijd die de behandelaar niet aan die claims besteedt. Het
werkelijke deel late claims kan veel lager of hoger zijn; daarom de proef.

**Goedkope proef.** Neem de laatste 50 claims uit de Excel. Zoek per claim in Transpas de afleverdatum op en
noteer de datum van de eerste mail en of de afleverbon een voorbehoud had. Een middag werk. Dan weet je hoe
vaak de termijn speelt, en of de termijnklok in de demo hoort of alleen een regel in het overzicht is.
