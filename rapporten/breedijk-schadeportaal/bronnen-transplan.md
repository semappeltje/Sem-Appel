# Schadeportaal Breedijk Transport: bronnen over Transplan, Rietveld en Breedijk (ronde 2)

Onderzoek voor de demo, geraadpleegd op 7 november 2026. Dit bestand vult `bronnen.md` aan en corrigeert
het op een punt: het TMS van Breedijk is **Transplan** van **RGB+**, niet Transpas van Art Systems.

## Lees dit eerst: wat er open ging

- **Open (gelezen met curl):** transplan.nl (de vijf gevraagde pagina's en 29 andere, via de sitemap),
  www.rietveld.nl en rietveld.nl (Efficio, de partnerpagina Transplan, EasyTrack, over Rietveld),
  breedijktransport.nl (home, autotransport, over ons, overslag, koeltransport, contact) en de stylesheets en
  het logo van www.breedijktransport.nl.
- **Dicht (proxy 403 of host lost niet op):** werkenbijbreedijk.nl, breedijk.movingit.nl, movingit.nl,
  movingit.eu, mijn.breedijktransport.nl, snelstart.nl, kpisolutions.nl, use.typekit.net. Daarvoor werkte
  alleen zoeken (status zoek). Twee keer geprobeerd, aan het begin en aan het eind van het werk.
- Afkortingen: (gelezen, URL), (zoek, URL), (schatting). Juridische punten zijn signalen: laten toetsen.

---

## 1. Transplan TMS en RGB+

### Wie RGB+ is

- RGB+ Automatisering B.V., Spitsstraat 17a, 8102 HW Raalte, telefoon 0572 331812 (gelezen,
  https://transplan.nl/contact/).
- RGB+ bouwt Transplan en ontwikkelt sinds 1999 standaardsoftware voor de transportsector, op de Microsoft
  ontwikkelstack, met "ongeveer 15 medewerkers" (gelezen, https://transplan.nl/rgb/).
- De vacature noemt "twee Agile teams", "een team van vier ontwikkelaars" voor Transplan en .NET als taal
  (gelezen, https://transplan.nl/vacatures-bij-rgb/software-ontwikkelaar-transplan/). Een klein team: een
  koppelverzoek gaat langs weinig mensen (schatting).
- RGB+ maakt ook Assistance Online (software voor autoberging), Shiftigo (resource- en capaciteitsplanning)
  en Rentlinq (gelezen, https://transplan.nl/rgb/).
- Support loopt via support@rgbplus.nl, de telefoon en TeamViewer (gelezen, https://transplan.nl/support/).

### Wat Transplan doet

- Transplan is een TMS van orderinvoer tot facturatie en rapportage, voor groupage, retail, FTL, HTL,
  tank- en autotransport (gelezen, https://transplan.nl/tms-software/).
- De metabeschrijving van de branchepagina zegt: "Het meest gebruikte TMS pakket voor autotransport in
  Nederland" (gelezen, https://transplan.nl/branches/autotransportsoftware/). De vacature zegt "Op het
  gebied van Automotive zijn we absoluut marktleider" (gelezen, vacaturepagina hierboven). Dat zegt RGB+
  zelf; een onafhankelijke bron vond ik niet.
- **Orders** komen binnen met de hand, als import (CSV), als vaste orders uit een prognose, via klantportaal
  en EDI, en via OTM-koppelingen of interfaces met bijvoorbeeld webshops. Transplan controleert de order,
  breekt hem op in een of meer trajecten op basis van laad- en losadres en waarschuwt bij een adres dat niet
  te geocoderen is (gelezen, https://transplan.nl/tms-ordermanagement/).
- **Planning** in drie weergaven: lijst, stroken (slepen naar voertuig op een tijdlijn) en kaart. Met
  rij- en rusttijden, vaste combinaties trekker, oplegger en chauffeur, planafdelingen, PTV voor afstand,
  tijd en tol, bloktijden, stoptijdklassen en ETA uit de boordcomputerposities (gelezen,
  https://transplan.nl/tmsplanning/).
- **Autotransport** (gelezen, https://transplan.nl/branches/autotransportsoftware/):
  - RDW-integratie: voertuiggegevens op basis van het kenteken gaan mee in de planning;
  - extra kenmerken op de order, zoals een fietsendrager of aanhanger;
  - belading: totaalgewicht en het type lader (4, 6 of 8 auto's);
  - plannen vanaf de kaart of op postcodegebied, marge per rit;
  - een meertalig klantportaal waarin klanten voertuigen aanmelden en de ETA zien;
  - ook voor dealers: logistiek tussen vestigingen, schadebedrijven en klanten, en "hikers".
- **Chauffeurs**: het AlertMyDrive-portaal stuurt opdrachten en wijzigingen per sms, mail of app, met
  ontvangen- en gelezenstatus op het planbord (gelezen, https://transplan.nl/functies/tijdens-de-rit/).
- **Facturatie**: templates per klant met bijlagen ("getekende vrachtbrieven of Excel-details"), een
  preview, UBL, dieseltoeslag en een koppeling met de boekhouding (gelezen, https://transplan.nl/tms-facturatie/).
- **Chartering en self-billing**: een charter op een rit slepen maakt een charteropdracht per mail, met
  tarieven per kilometer, uur of rit en een creditfactuur achteraf (gelezen,
  https://transplan.nl/tms-chartering-selfbilling/).
- **Rapportage**: standaardrapporten plus een eigen rapport-editor voor vrachtbrieven, barcodestickers,
  routelijsten en exports; uitvoer als pdf, print, mail en "diverse formaten"; rapporten en exports kunnen
  "automatisch via e-mail" worden verstuurd (gelezen, https://transplan.nl/tms-rapportage/).
- **Kwaliteitsregistratie, een eigen schademodule.** Transplan legt "schade, manco's of vertragingen" vast
  in een centraal dossier, met actiehouders, een workflow en trends. Externe partijen kunnen meekijken in
  "een schadedossier" (gelezen, https://transplan.nl/tms-kwaliteitsregistratie/). Een chauffeur kan een
  melding "vanaf zijn boordcomputer inschieten"; bestaande klanten kregen de module kosteloos (gelezen,
  https://transplan.nl/geen-notitieboekjes-of-klachtenformulieren-meer/, artikel uit 2021).

### De OrderExchange: wie wisselt wat met wie

- De OrderExchange is een beveiligd netwerk van RGB+ waarop autotransportbedrijven opdrachten aan elkaar
  uitcharteren. Gebruikers van Transplan en Assistance Online zijn standaard aangesloten; er zijn ook
  koppelingen met andere systemen (gelezen,
  https://transplan.nl/de-digitale-koppeling-van-autotransport-nederland-transplan-orderexchange/).
- Over het netwerk gaan ook statusupdates: geplande en werkelijke laad- en lostijden en de ETA. Je kunt
  documenten meesturen. De data is alleen zichtbaar voor verzender en ontvanger (gelezen, zelfde URL).
- Het artikel noemt ongeveer 10.000 opdrachten per maand en 50 actieve deelnemers (gelezen, zelfde URL;
  het artikel is van 2021, laatst gewijzigd in maart 2023, dus de getallen zijn oud).
- Opdrachtgevers koppelen er ook op: importeurs, dealers en andere autotransporteurs (gelezen,
  branchepagina). CarCollect, een B2B-platform voor voertuighandel, stuurt sinds september 2026
  transportopdrachten via de OrderExchange door, "met kenteken, ophaal- en aflevergegevens al ingevuld", en
  krijgt statussen terug (gelezen, https://transplan.nl/carcollect-koppeling-transplan/).
- Een nieuwe klant, Middelkoop Mobility, krijgt zo de opdrachten van zijn opdrachtgevers "inclusief laad- en
  losinformatie en statusupdates" in Transplan (gelezen, https://transplan.nl/middelkoop-mobility-transplan-tms/).
- Op de branchepagina staan logo's van systemen waarmee Transplan gekoppeld is of waaruit het orders
  importeert: ADAC, Alphabet, BCA, BMW, CarCollect, Autotelex, Transconnect en Volvo (gelezen, alt-teksten
  en bestandsnamen op https://transplan.nl/branches/autotransportsoftware/).

### Klanten die RGB+ zelf noemt (bedrijfsnamen)

- **Breedijk staat erbij.** Het Middelkoop-artikel noemt "Logicx, Breedijk, Van Zandwijk, Collewijn, Wolves,
  Van Eijck en Assistance United, die al langere tijd met Transplan werken" (gelezen, URL hierboven). Het
  logo `breedijk_transport.gif` staat onder "Autotransporteurs die werken met Transplan" (gelezen,
  branchepagina) en de homepage linkt naar breedijktransport.nl in de klantenrij (gelezen, https://transplan.nl/).
- Andere klanten in de rij op de homepage: Bentvelzen, Euser, Logistics4you, L. van Zandwijk, SVZ Transport,
  Van Houten, Wezenberg, A.G. van Geffen, Autohulpdienst Broekmans, Boekhorst, BRL, Collewijn, C. van
  Heezik, Van Eijck, Groot Koerkamp, Hoogwout, Jooren, Kuzee, Lelieveld, Logicx, Nieuwenhuijse, Rood
  Berging, **Simon Loos**, Trans-Imex, Vreugdenhil en Wolves (gelezen, links in de klantenrij op https://transplan.nl/).
- Op de klantendag van 9 april 2026 liet RGB+ aan de automotive klanten onder meer zien: betere routeplanning,
  een kaart met verkeersdata en nul-emissiezones, flexibelere orderinvoer en uitgebreidere rapportage; AI
  voor orders uit e-mail staat op de plannen (gelezen, https://transplan.nl/transplan-automotive-klantendag-2026/).

---

## 2. Koppelmogelijkheden van Transplan

### Wat er op transplan.nl staat

- **Standaardkoppelingen**: boekhouding (AFAS, Exact Online, Microsoft Dynamics, Twinfield, Unit4 Multivers,
  SnelStart), boordcomputers en apps (Platform Science, Transics, TomTom Webfleet, Rietveld,
  Data2track/Fleetgo), plan- en executiepartners (PTV, MoreOptimal, de control tower van Simacan) en
  Shiftigo. "Ook maken we EDI imports naar uw klanten." "Staat er een pakket niet bij? Neem dan contact op"
  (gelezen, https://transplan.nl/koppelingen-met-transplan-tms/).
- Uitwisseling met de boordcomputer: "Scans, foto's en relevante planinformatie worden tussen chauffeur en
  TMS gedeeld" (gelezen, https://transplan.nl/functies/tijdens-de-rit/). Dat is de belangrijkste zin voor
  het portaal: foto's kunnen in Transplan terechtkomen.
- **OTM**: RGB+ heeft "het OTM5 protocol" in Transplan geïntegreerd (gelezen,
  https://transplan.nl/transplan-tms-omarmt-het-otm5-protocol/). Euser en Albert Heijn wisselen via OTM
  orders in twee richtingen uit, met Simacan ertussen; de verlader ziet de orders verrijkt met realisatiedata
  (gelezen, https://transplan.nl/digitale-stap-voorwaarts-voor-euser-en-albert-heijn-door-otm-koppeling/).
  Welke OTM5-entiteiten (consignment, trip, actor, event) RGB+ ondersteunt, staat er niet. Bentvelzen koos
  Transplan onder meer voor "een goede (OTM) integratie met hun klanten" en Simacan (gelezen,
  https://transplan.nl/bentvelzen-transport-kiest-voor-tms-software-transplan-van-rgb/).
- **Autotelex** (sinds de release van juni 2026): een nieuwe transportopdracht in AutotelexPRO wordt
  automatisch een order in Transplan; de status gaat terug naar Autotelex: "ingepland, onderweg of
  afgeleverd" (gelezen, https://transplan.nl/autotelex-koppeling-met-transplan-tms/). Dit bewijst dat
  Transplan koppelingen in twee richtingen heeft, ook in autotransport.
- **Exporten**: de rapport-editor exporteert naar "diverse formaten" en kan rapporten en exports automatisch
  mailen (gelezen, https://transplan.nl/tms-rapportage/).
- Over een **API** staat op transplan.nl niets: geen REST, geen documentatie, geen ontwikkelaarsportaal
  (gelezen, gezocht op alle 34 opgehaalde pagina's van transplan.nl).

### Wat zoeken liet zien

- SnelStart noemt Transplan als koppeling met koppeltype "API", werkend met een online administratie; je
  activeert hem via de koppelpartner RGB+ (zoek, https://www.snelstart.nl/koppelingen/transplan).
- KPI Solutions biedt een "Power BI API Koppeling" voor Transplan TMS, met dashboardsjablonen (zoek,
  https://kpisolutions.nl/powerbi-api-koppeling/transplan-tms-software/). Hun FAQ zegt dat de connector de
  data dagelijks naar een eigen database van de klant kopieert (zoek, https://kpisolutions.nl/veel-gestelde-vragen/).
- Er is dus een API waar derden bij kunnen. Hoe die werkt (REST of SOAP, sleutels, rechten, welke tabellen)
  is niet openbaar (schatting).

### Oordeel over "het ondersteunt geen koppelingen"

Technisch klopt het niet. Transplan koppelt met boordcomputers, boekhouding, OTM5, EDI, Autotelex, CarCollect
en de OrderExchange, en derden lezen data via een API (gelezen en zoek, hierboven). Wat er waarschijnlijk wel
klopt (schatting, navragen):

- Breedijk heeft zelf geen toegang tot de API, en elke nieuwe koppeling loopt via RGB+ (offerte, inrichting).
  Voor Breedijk voelt dat als "je kunt er nooit via iets inkomen".
- De licentie van Breedijk heeft de API-module of de koppeling niet, of RGB+ zet die alleen aan voor bekende
  partners (zoals bij SnelStart: "neem contact op met de koppelpartner").
- Er is geen koppeling naar een **zelfgebouwd** systeem. RGB+ werkt met standaarden en vaste partners.
- **Een tegenspraak.** Breedijk heeft al een klantportaal buiten Transplan: "Login voor klanten" gaat naar
  breedijk.movingit.nl (gelezen, de link op https://breedijktransport.nl/; de host zelf ging niet open). Op
  die "persoonlijke vervoerspagina" ziet de klant vervoersdocumenten en schouwfoto's (gelezen,
  https://breedijktransport.nl/over-ons/). Moving IT B.V. is een IT-bedrijf voor transport en logistiek (zoek,
  https://village.ai/company/moving-it-b.v.); een portfoliopagina heet "Breedijk autotrailer - Moving IT"
  (zoek, http://www.movingit.eu/portfolio/autotransport/bjorn-fiats-002/). Dat portaal krijgt zijn data dus
  ergens vandaan: uit Transplan, uit de boordcomputer of uit een eigen app (schatting). Er loopt dus al data
  naar buiten. De vraag is wie die stroom beheert. Wat Breedijk in het gesprek beschreef (kenteken intikken,
  zien wanneer en door wie verplaatst, foto's bij documenten) kan dit portaal zijn of Transplan zelf; vragen.

### Drie routes voor ritgegevens en foto's, van zeker naar onzeker

1. **Geplande export uit Transplan** (meest zeker, geen ontwikkelaar nodig). De rapport-editor maakt een
   lijst per dag (kenteken, ordernummer, opdrachtgever, laad- en losadres, geplande en werkelijke tijden,
   chauffeur, rit) en mailt die automatisch (gelezen, https://transplan.nl/tms-rapportage/). Het portaal
   leest het bestand uit een vaste mailbox of map. Nadeel: een keer per dag of per uur, geen foto's, en de
   export moet iemand bij Breedijk of RGB+ inrichten (schatting).
2. **De Transplan-API via RGB+** (bestaat, voorwaarden onbekend). Zoals KPI Solutions en SnelStart: lezend,
   met een sleutel van RGB+ en akkoord van Breedijk (zoek, hierboven). Mogelijk ook de documenten bij de
   order, als de foto's daar staan. Een variant: het portaal als deelnemer op de OrderExchange of via OTM5,
   dan krijgt het statussen en documenten zoals een opdrachtgever (schatting; vraag of RGB+ dat toestaat
   voor een niet-vervoerder).
3. **De foto's bij de bron** (minst zeker). Uit het boordcomputerplatform (EasyTrack van Rietveld, of een
   ander, zie onderwerp 3), of uit het bestaande portaal van Moving IT. Dat vraagt een tweede leverancier en
   een tweede afspraak, en het koppelen op kenteken en datum in plaats van op ordernummer (schatting).

Voor de demo: bouw op route 1 met de vorm van route 2. Een dagexport in CSV met dezelfde velden als de API
straks geeft, en een los fotoveld per order met een bronlabel (schatting).

---

## 3. De foto's

### Waar staan ze waarschijnlijk

- De chauffeur schouwt elke auto voor het laden, maakt zes overzichtsfoto's en fotografeert en noteert elke
  schade apart (gelezen, https://breedijktransport.nl/autotransport/).
- De klant ziet "vervoersdocumentatie en schouwfoto's" op zijn persoonlijke vervoerspagina (gelezen,
  https://breedijktransport.nl/over-ons/), en die pagina draait bij Moving IT (gelezen, de link; zie boven).
- Breedijk zegt in het gesprek dat je in Transplan "bij documenten de foto's" ziet. Transplan deelt scans en
  foto's met de boordcomputer (gelezen, https://transplan.nl/functies/tijdens-de-rit/). Het meest
  waarschijnlijk: de boordcomputer of app maakt de foto's, die gaan als documenten mee naar de order in
  Transplan, en het klantportaal toont ze (schatting).
- Welke boordcomputer Breedijk heeft, vond ik niet. Over ons zegt alleen "boordcomputer" en "track-and-trace"
  en noemt de overstap op eCMR (gelezen, https://breedijktransport.nl/over-ons/). Transplan koppelt standaard
  met Platform Science, Transics, Webfleet, Rietveld en Data2track/Fleetgo (gelezen, koppelingenpagina). Dat
  het Rietveld is, is dus een aanname uit ronde 1; navragen.
- Let op: de buitenlandse ritten rijden Europese partners (gelezen, https://breedijktransport.nl/autotransport/).
  Hun schouwfoto's staan misschien niet in Breedijks boordcomputer. Juist bij een overdracht in Barneveld
  ontstaat dan de vraag wie de schade maakte (schatting).

### Wat Rietveld zegt

- Rietveld B.V. zit in Ermelo (3851 SK) en noemt meer dan 30 jaar ervaring in telematica, wagenparkbeheer
  en voertuigveiligheid (gelezen, https://rietveld.nl/en/about-rietveld).
- De Efficio VT7PRO is een boordcomputer met touchscreen: ritopdrachten uit het TMS, TomTom-trucknavigatie,
  berichten, activiteitenregistratie "via vragenlijsten en digitale formulieren" (een "digitaal vragenpad"),
  urenregistratie met EasyHours en eCMR (gelezen,
  https://www.rietveld.nl/oplossingen/easymanagement/efficio-boordcomputer/).
- Foto's: "Maak foto's van vrachtbrieven, CMR's, schades of documenten en verstuur deze direct naar
  kantoor", en "Verstuur berichten, foto's en updates direct tussen chauffeur en planning" (gelezen, zelfde URL).
- Alles komt "realtime" in EasyTrack Web en in gekoppelde TMS- en ERP-systemen; Rietveld noemt "meer dan 20
  TMS-koppelingen" (gelezen, zelfde URL). EasyTrack is het cloudplatform voor track and trace,
  ritregistratie, berichten en rapporten, en koppelt met TMS, ERP, HR en salaris (gelezen,
  https://rietveld.nl/en/solutions/fleet-management/easytrack-trip-registration-track-and-trace).
- Over Transplan: ritopdrachten gaan digitaal naar de chauffeur; voertuigdata, statussen en afgeronde taken
  komen automatisch terug (gelezen,
  https://rietveld.nl/en/partners/transplan-integration-with-efficio-easytrack-rietveld).
- Proof of delivery en handtekening noemt Rietveld niet met die woorden; eCMR (de digitale vrachtbrief, met
  aftekenen bij aflevering) wel (gelezen, Efficio-pagina). Een openbare API of export voor foto's vond ik
  niet; alleen "integraties" op aanvraag (gelezen, de drie Rietveld-pagina's).
- De camera van de VT7PRO noemt de pagina niet apart; het fotograferen wel (gelezen, Efficio-pagina).

---

## 4. Breedijk zelf

### Namen, plaatsen, volume

- Drie namen op een site: titel "Breedijk Autotransport BV", contactblok "Breedijk Transport BV, De Veken 208,
  1716 KJ Opmeer", copyright "Autotransport Breedijk B.V." (gelezen, https://breedijktransport.nl/). Welke bv
  vervoerder is, doet ertoe voor de polis en de vrachtbrief (signaal; KvK nakijken).
- Telefoon 0226 412060, info@breedijktransport.nl (gelezen, zelfde URL).
- Overslagterrein in Barneveld, 16.000 m², beveiligd en verlicht (gelezen, https://breedijktransport.nl/overslag/).
- Volume blijft tegenstrijdig: "Per week komen en gaan hier circa 800 auto's" (gelezen, homepage) en "per dag
  ongeveer 800 auto's klaarzetten voor distributie" (gelezen, overslag). Het eerste is doorstroom, het tweede
  capaciteit. Voor de demo: 800 per week (schatting), navragen.
- Eigen wagenpark "met ruim 40 transporters" plus een Europees netwerk van autotransporteurs (gelezen,
  https://breedijktransport.nl/autotransport/).
- Levertijd: binnen Nederland maximaal 5 werkdagen, Duitsland en België maximaal 10 (gelezen, homepage).
- Werkwijze: een koper in het buitenland schakelt via de verkoper Breedijk in; de planners voeren de order in
  en kijken of op de terugweg gelost kan worden, anders gaat de auto naar Barneveld; buitenlands vervoer met
  Europese partners, distributie vanuit Barneveld met eigen chauffeurs; de chauffeur maakt een laadplan op de
  route van de planner (gelezen, https://breedijktransport.nl/autotransport/).
- Koeltransport bestaat ook (Van der Sterre als klant, HACCP, KTL, temperatuur via Trailer Guard), maar valt
  buiten het schadeportaal (gelezen, https://breedijktransport.nl/koeltransport/).
- Klanten: testimonials van BCA Autoveiling, Content Autogroep Eindhoven en Marinus Auto's Leerdam (gelezen,
  autotransportpagina); logo's van Auto1, BCA, Louwman, Van der Sterre en VWE Automotive (gelezen,
  bestandsnamen op de homepage).
- In de voet: "Algemene vervoerscondities motorvoertuigen" (gelezen, homepage). Die bepalen termijnen en
  aansprakelijkheid bij schade; voor het portaal lezen (signaal).
- Systemen: boordcomputer, track-and-trace (24/7 volgen), de persoonlijke vervoerspagina, eCMR in opbouw
  (gelezen, over ons); "Login voor klanten" naar breedijk.movingit.nl, "Login voor personeel" naar
  mijn.breedijktransport.nl (gelezen, links op de homepage; beide hosts gingen niet open).

### Huisstijl (voor het dashboard)

Uit de stylesheets van het thema (`breedijk/css/custom.css`, `breedijk-child/style.css`, `dynamic_avia/
breedijk_transport.css`) en het logo (gelezen, gedownload van www.breedijktransport.nl):

| Rol | Waarde | Waar |
| --- | --- | --- |
| Huisrood | `#e30613` (in het thema ook `#e30615`) | menu-hover, actief menu, kopbalk, logoschild |
| Donkerrood | `#a21007` | begin van het verloop op knoppen en lijsticonen |
| Verloop | `linear-gradient(to right, #a21007, #e30613)` | verzendknop, `.button` |
| Helderrood | `#f41726`, donker `#c10403`, `#d20504` | streep, knoprand, accent |
| Tekst | `#222222`, bijna zwart `#121212` | kop- en broodtekst, placeholders |
| Vlak | `#ffffff`, lichtgrijs `#eeeeee`, rand `#d8d8d8` | achtergrond, lijsten |

- Het logo (340 × 80 px, png): "BREEDIJK" in zware zwarte kapitalen, een rood schild met een verloop van
  donkerrood naar huisrood en een witte B met drie vleugelstrepen en een T erin, en "TRANSPORT" in dunne
  cursieve zwarte kapitalen (gelezen, `logo-breedijk-transport.png`). Het schild staat ook los als icoon
  (`icon-breedijk-rood-outline.png`).
- Letter: koppen in Aller Display (regulier, h3 in kapitalen), broodtekst en knoppen in Aller (vet op
  knoppen), geladen via Adobe Fonts, kit `ljk8bdh` (gelezen, CSS). Het thema laadt ook Montserrat van Google
  Fonts (gelezen, de stylesheetlijst).
- Signaal: logo en huisstijl van Breedijk alleen in een demo met hun akkoord. Aller valt onder een Adobe-
  licentie; neem in de demo een vrije letter met dezelfde vorm (bijvoorbeeld een humanistische schreefloze)
  en noem dat (schatting).

---

## 5. Wat we RGB+ en Rietveld moeten vragen

Aan RGB+:

1. Heeft Breedijk de API-module of een API-sleutel? Wat kost lezende toegang voor een derde (zoals KPI
   Solutions), en welke tabellen of eindpunten zijn er: orders, trajecten, ritten, statussen, documenten?
2. Staan de schouwfoto's als documenten bij de order in Transplan? Zo ja: per order of per traject, met
   welke metadata (tijd, chauffeur, positie, soort foto), en kun je ze via API of export ophalen?
3. Kan de rapport-editor een dagelijkse of uurlijkse export (CSV) per kenteken maken met geplande en werkelijke
   laad- en lostijden en de chauffeur, en automatisch versturen? Wie richt dat in?
4. Gebruikt Breedijk de module Kwaliteitsregistratie voor schadedossiers? Kunnen externe partijen
   (opdrachtgever, verzekeraar, expert) daarin meekijken, en kan een dossier via de API naar buiten?
5. Welke OTM5-entiteiten en events ondersteunt Transplan, en kan een portaal (geen vervoerder) via OTM of de
   OrderExchange statussen en documenten ontvangen?
6. Hoe komt de data nu in het klantportaal van Moving IT (breedijk.movingit.nl): API, export of iets anders?
   En geldt daarvoor een verwerkersovereenkomst?

Aan Rietveld (of de leverancier die het blijkt te zijn):

7. Rijdt Breedijk met Efficio en EasyTrack? Hoe gaan de zes overzichtsfoto's en de schadefoto's van de
   VT7PRO naar Transplan: als document bij de order, met welk ordernummer of kenteken?
8. Is er een API of export uit EasyTrack voor foto's, activiteiten (het vragenpad van de schouw) en
   tijdstempels, en hoe lang bewaart EasyTrack de foto's?
9. Kan de schouw in het vragenpad een vaste volgorde afdwingen (zes vaste hoeken, schade per plek op een
   autoschets) en een handtekening of eCMR-aftekening bij laden en lossen vastleggen?
10. Welke gegevens over de chauffeur gaan mee (naam, pas, positie), en wat zegt de verwerkersovereenkomst over
    doorgeven aan een derde portaal (AVG, en de OR bij Breedijk)?

---

## 6. Wat dit verandert aan de demo

- **Naam.** Overal "Transplan (RGB+)" in plaats van "Transpas (Art Systems)". De bron-tag van een order:
  `transplan`.
- **Velden van een order**, in de vorm van Transplan (gelezen, ordermanagement en branchepagina; de precieze
  veldnamen zijn schatting): ordernummer, opdrachtgever, bron (eigen invoer, OrderExchange-partner,
  Autotelex, CarCollect, klantportaal), kenteken met RDW-gegevens (merk, model, kleur, massa),
  bijzonderheden (fietsendrager, aanhanger), trajecten met laad- en losadres, rit, voertuigcombinatie en
  type lader (4, 6 of 8), chauffeur, charter ja of nee (Europese partner), geplande, verwachte en werkelijke
  laad- en lostijden, status (ingepland, onderweg, afgeleverd), documenten (vrachtbrief of eCMR, foto's).
- **De foto's** krijgen een bronlabel: "boordcomputer via Transplan", "klantportaal" of "partner (charter)".
  Bij een charterrit toont de demo dat foto's van het buitenlandse deel kunnen ontbreken. Daar zit de
  meeste discussie over wie de schade maakte (schatting).
- **De zes foto's** als vaste set (voor, achter, links, rechts en twee schuin, schatting voor de hoeken),
  plus losse schadefoto's met plek en notitie. Laden en lossen naast elkaar: dezelfde hoek, twee momenten.
- **Koppelroute** in de demo: een dagexport (CSV, route 1) met een adapter die later de API (route 2) leest.
  Een schakelaar "bron: export | API | gesimuleerd" laat Breedijk zien dat er niets in Transplan hoeft te
  veranderen voor de proef.
- **Niet dubbel bouwen.** Transplan heeft een schadedossier (Kwaliteitsregistratie) en Breedijk heeft een
  klantportaal met schouwfoto's. Het portaal moet dus iets toevoegen: de claim van melding tot afhandeling,
  laden naast lossen, de termijn uit de vervoerscondities, en een dossier dat de verzekeraar kan lezen.
  Vraag eerst of Breedijk die module gebruikt (schatting).

### Wat je niet vroeg, maar waar je iets aan hebt

- **Simon Loos gebruikt Transplan ook.** De klantenrij op transplan.nl linkt naar simonloos.nl (gelezen,
  https://transplan.nl/). Tot nu toe gingen we uit van ORTEC en Navitrans bij Simon Loos. Misschien gebruikt
  een onderdeel Transplan. Wat we hier over de API, OTM5 en exporten leren, kan dan ook in de Control Tower
  terechtkomen. Proef: een vraag aan de contactpersoon bij Simon Loos, welk onderdeel Transplan gebruikt.
- **Een koppeling via een bestaande partner is goedkoper dan een nieuwe.** RGB+ werkt met vaste partners
  (KPI Solutions, Simacan, Rietveld). Een portaal dat leest zoals KPI Solutions (een dagkopie in een eigen
  database) past in iets wat RGB+ al kent. Proef: RGB+ vragen wat zo'n lezende koppeling voor Breedijk kost.
- **De OrderExchange is een netwerk van opdrachtgevers.** BCA, Alphabet en CarCollect zitten er aan vast
  (gelezen, branchepagina en CarCollect-artikel). Een schadeportaal dat hun statusberichten leest, zou
  later meer vervoerders op Transplan kunnen bedienen dan alleen Breedijk (schatting). Niet bouwen, wel
  bewaren voor de ideeënbank.

### Risico's en signalen

- Foto's met kenteken, chauffeursnamen en posities zijn persoonsgegevens: verwerkersovereenkomst met
  Breedijk, bewaartermijn, en de OR als het portaal chauffeurs aanwijst (laten toetsen).
- Logo, kleuren en de letter Aller van Breedijk alleen met akkoord van Breedijk; de demo noemt de huisstijl
  "naar Breedijk" en gebruikt een vrije letter.
- Toegang tot de Transplan-API loopt via RGB+ en Breedijk samen; geen scraping van het klantportaal of van
  Transplan (signaal: voorwaarden van RGB+ en Moving IT).
