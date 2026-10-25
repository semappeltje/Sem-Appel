# Bronnen van de data (Control Tower 4.0)

Stand: 25 oktober 2026. Alles hieronder is echte, openbare data; wat gesimuleerd is (voertuigen, chauffeurs, ritten,
tijden) staat in de README onder "Wat echt is en wat niet". De verwerking staat in `tools/ct4/` (zie onderaan).

## Overture Maps

Release **2026-10-21.0** (de nieuwste op 25-10-2026), gelezen van `s3://overturemaps-us-west-2/release/2026-10-21.0/`
met pyarrow, alleen de kolommen die nodig zijn en alleen binnen het kader van Nederland (lengte 3,2 tot 7,3, breedte 50,7 tot 53,6).

| Thema / type | Gebruikt voor | Licentie |
| --- | --- | --- |
| addresses / address | adrespunten (BAG) van standplaatsen, winkels en DC's; woonplaats; bezorgstraten | per bron, zie Overture (BAG: Kadaster, CC0) |
| places / place | winkels per formule, DC's, fabrieken, groothandels, controle van de standplaatsen | CDLA Permissive 2.0 |
| buildings / building | gebouwen rond standplaatsen en DC's (3D), hoofdgebouw en terrein | ODbL (OpenStreetMap) |
| base / land_use | terrein van een standplaats of DC (het bedrijfsvlak) | ODbL (OpenStreetMap) |
| transportation / segment | routeergraaf (al sinds 3.0), toegangsroutes over alle wegklassen, wegnummers en straatnamen | ODbL (OpenStreetMap) |

## Standplaatsen (42)

Adres uit de vacaturepagina's van werkenbijsimonloos.nl (het `jobLocation`-adres in de JSON-LD van elke vacature, en de
tekst "Dit ga je doen"), opgehaald op 25 oktober 2026 (102 vacatures). Positie: het BAG-adrespunt van dat adres in
Overture Addresses (postcode en huisnummer), zes decimalen; ter controle de bedrijven op dat adres in Overture Places.
Terrein: het landgebruiksvlak waarin het hoofdgebouw ligt als dat de maat van een bedrijf heeft (hoofdgebouw minstens
18 % van het vlak, hooguit 25 ha), anders de kleinste gedraaide rechthoek om het hoofdgebouw en de aangrenzende
gebouwen, 30 m ruimer. Parkeerrijen: plekken van 4 m breed en 16,5 m diep evenwijdig aan de lange kant van het
hoofdgebouw, binnen het terrein, 4 m van gebouwen en vrij van openbare wegen; waar dat te weinig plekken gaf (minder
dan 1,25 keer de vloot) mag de rij tot 40 m buiten het terrein. Elke standplaats heeft een knoop in de routeergraaf en
een toegangsroute over echte straten van die knoop tot de poort (het punt op de weg bij het adres).

| Standplaats | Adres | Positie (breedte, lengte) | Vacature (bron) | Terrein | Klant (`klant`) |
| --- | --- | --- | --- | --- | --- |
| Wognum | Tender 2, 1687 JB Wognum | 52.693504, 5.035636 | [administratief-medewerker-wognum-723](https://werkenbijsimonloos.nl/vacatures/administratief-medewerker-wognum-723) | bedrijfsvlak, 313 plekken | Albert Heijn Home Service |
| Zaandam | Hoofdtocht 1, 1507 CJ Zaandam | 52.427046, 4.804421 | [avondchauffeur-ce-winkeldistributie-zaandam-499](https://werkenbijsimonloos.nl/vacatures/avondchauffeur-ce-winkeldistributie-zaandam-499) | rechthoek, 631 plekken | Albert Heijn |
| Oss | Keltenweg 30, 5342 LP Oss | 51.738083, 5.565381 | [leerling-chauffeur-c-ce-oss-189](https://werkenbijsimonloos.nl/vacatures/leerling-chauffeur-c-ce-oss-189) | rechthoek, 257 plekken | Plus |
| Zwolle | Galvaniweg 1, 8013 RG Zwolle | 52.495920, 6.134738 | [vrachtwagenchauffeur-ce-winkeldistributie-zwolle-629](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-zwolle-629) | bedrijfsvlak, 390 plekken | Albert Heijn |
| Geldermalsen | Poppenbouwing 14, 4191 NZ Geldermalsen | 51.875166, 5.308321 | [nachtchauffeur-ce-netwerktransport-geldermalsen-644](https://werkenbijsimonloos.nl/vacatures/nachtchauffeur-ce-netwerktransport-geldermalsen-644) | rechthoek, 203 plekken | Albert Heijn |
| Aalsmeer | Japanlaan 4, 1432 DK Aalsmeer | 52.268095, 4.794535 | [avondchauffeur-ce-brooddistributie-aalsmeer-697](https://werkenbijsimonloos.nl/vacatures/avondchauffeur-ce-brooddistributie-aalsmeer-697) | rechthoek, 58 plekken | Borgesius (brood) |
| Tiel | De Passen 1, 4004 LV Tiel | 51.917342, 5.455457 | [crossdockmanager-tiel-tiel-737](https://werkenbijsimonloos.nl/vacatures/crossdockmanager-tiel-tiel-737) | rechthoek, 150 plekken | Crossdock |
| Barneveld | Harselaarseweg 133, 3771 MA Barneveld | 52.164115, 5.574951 | [leerling-chauffeur-c-ce-barneveld-748](https://werkenbijsimonloos.nl/vacatures/leerling-chauffeur-c-ce-barneveld-748) | rechthoek, 57 plekken | Plus (diepvries) |
| Raalte | Kotterstraat 12, 8102 HZ Raalte | 52.375954, 6.289329 | [vrachtwagenchauffeur-ce-winkeldistributie-raalte-494](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-raalte-494) | rechthoek, 145 plekken | Jumbo |
| Waalwijk | Zijlweg 18, 5145 NR Waalwijk | 51.702145, 5.040484 | [vrachtwagenchauffeur-ce-winkeldistributie-waalwijk-699](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-waalwijk-699) | rechthoek, 184 plekken | SPAR |
| Utrecht | Atoomweg 111, 3542 AB Utrecht | 52.117653, 5.047161 | [vrachtwagenchauffeur-ce-netwerk-utrecht-651](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-netwerk-utrecht-651) | rechthoek, 120 plekken | LZV netwerk |
| Nieuwegein | Inundatiedok 38, 3439 JJ Nieuwegein | 52.024071, 5.123219 | [vrachtwagenchauffeur-ce-nieuwegein-59](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-nieuwegein-59) | rechthoek, 192 plekken | Jumbo / Albert Heijn |
| Almere | Brigitten 1, 1358 CE Almere | 52.314597, 5.311747 | [vrachtwagenchauffeur-ce-winkeldistributie-almere-264](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-almere-264) | rechthoek, 404 plekken | Lidl |
| Waddinxveen | Louis Dobbelmannweg 1, 2742 JZ Waddinxveen | 52.025232, 4.618733 | [vrachtwagenchauffeur-ce-winkeldistributie-waddinxveen-490](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-waddinxveen-490) | rechthoek, 331 plekken | Lidl |
| Dinteloord | Oliemolen 7, 4671 HB Dinteloord | 51.633737, 4.378955 | [chauffeur-bulktransport-dinteloord-717](https://werkenbijsimonloos.nl/vacatures/chauffeur-bulktransport-dinteloord-717) | rechthoek, 91 plekken | Bulk (Cosun) |
| Amstelveen | Smederij 13, 1185 ZR Amstelveen | 52.283038, 4.836250 | [vrachtwagenchauffeur-c-amstelveen-26](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-c-amstelveen-26) | rechthoek, 147 plekken | Euro Pizza Products |
| Pijnacker (Delfgauw) | Laan van Ruyven 1, 2645 EE Delfgauw | 51.994607, 4.397044 | [vrachtwagenchauffeur-ce-winkeldistributie-delfgauw-506](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-delfgauw-506) | bedrijfsvlak, 1141 plekken | Albert Heijn |
| Opmeer | De Veken 27, 1716 KE Opmeer | 52.709658, 4.962578 | [leerling-monteur-opmeer-625](https://werkenbijsimonloos.nl/vacatures/leerling-monteur-opmeer-625) | rechthoek, 28 plekken | Truckspuiterij en garage |
| Ede | Neonstraat 29, 6718 WX Ede | 52.042760, 5.616686 | [vrachtwagenchauffeur-ce-netwerk-ede-641](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-netwerk-ede-641) | bedrijfsvlak, 229 plekken | Netwerk |
| Maasdam | Lageweg 4-8, 3299 AL Maasdam | 51.791159, 4.549291 | [vrachtwagenchauffeur-ce-netwerk-maasdam-708](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-netwerk-maasdam-708) | bedrijfsvlak, 360 plekken | Netwerk (FrieslandCampina) |
| Veghel | Marshallweg 1, 5466 AH Veghel | 51.609446, 5.514395 | [vrachtwagenchauffeur-ce-netwerk-veghel-660](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-netwerk-veghel-660) | rechthoek, 254 plekken | Netwerk (Kuehne + Nagel) |
| Etten-Leur | Zwarthoofd 5, 4878 AL Etten-Leur | 51.563891, 4.592145 | [vrachtwagenchauffeur-ce-winkeldistributie-etten-leur-418](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-etten-leur-418) | rechthoek, 562 plekken | Lidl |
| Alkmaar | Opaalstraat 15, 1812 RH Alkmaar | 52.604715, 4.750490 | [vrachtwagenchauffeur-ce-winkeldistributie-alkmaar-682](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-alkmaar-682) | rechthoek, 339 plekken | Vomar |
| Tilburg | Pegasusweg 1, 5015 BZ Tilburg | 51.577807, 5.119101 | [vrachtwagenchauffeur-ce-winkeldistributie-tilburg-558](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-tilburg-558) | rechthoek, 147 plekken | Albert Heijn |
| Broek op Langedijk | Westelijke Randweg 5, 1721 CH Broek op Langedijk | 52.673787, 4.802510 | [vrachtwagenchauffeur-lzv-netwerk-broek-op-langedijk-661](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-lzv-netwerk-broek-op-langedijk-661) | rechthoek, 238 plekken | Netwerk (LZV, Lay's) |
| Hoogeveen | Plesmanstraat 22, 7903 BE Hoogeveen | 52.733720, 6.520938 | [vrachtwagenchauffeur-ce-winkeldistributie-hoogeveen-530](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-hoogeveen-530) | rechthoek, 120 plekken | Albert Heijn |
| Oostzaan | Zuideinde 235, 1511 GE Oostzaan | 52.428498, 4.885274 | [avondchauffeur-c-oostzaan-752](https://werkenbijsimonloos.nl/vacatures/avondchauffeur-c-oostzaan-752) | rechthoek, 41 plekken | Ruig (pluimvee) |
| Nijkerk | Gildenstraat 30, 3861 RG Nijkerk | 52.236603, 5.478553 | [chauffeur-netwerktransport-nijkerk-706](https://werkenbijsimonloos.nl/vacatures/chauffeur-netwerktransport-nijkerk-706) | rechthoek, 40 plekken | Netwerk |
| Bunnik | Schoudermantel 52, 3981 AH Bunnik | 52.058502, 5.217991 | [nachtchauffeur-ce-dranken-bunnik-757](https://werkenbijsimonloos.nl/vacatures/nachtchauffeur-ce-dranken-bunnik-757) | rechthoek, 23 plekken | Vrumona |
| Heerenveen | Minerva 36, 8448 CS Heerenveen | 52.973444, 5.949734 | [nachtchauffeur-lzv-winkeldistributie-heerenveen-535](https://werkenbijsimonloos.nl/vacatures/nachtchauffeur-lzv-winkeldistributie-heerenveen-535) | rechthoek, 43 plekken | SPAR |
| Amsterdam | Basisweg 75, 1043 AN Amsterdam | 52.391566, 4.813700 | [vrachtwagenchauffeur-c-amsterdam-579](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-c-amsterdam-579) | rechthoek, 104 plekken | Technische Unie |
| Avenhorn | Koningsspil 25, 1633 GL Avenhorn | 52.621800, 4.956147 | [vrachtwagenchauffeur-ce-brooddistributie-avenhorn-703](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-brooddistributie-avenhorn-703) | bedrijfsvlak, 232 plekken | Bakkerij Pater (brood) |
| Emmeloord | Nijverheidstraat 3, 8301 AD Emmeloord | 52.707773, 5.748529 | [vrachtwagenchauffeur-ce-brooddistributie-nacht-emmeloord-441](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-brooddistributie-nacht-emmeloord-441) | rechthoek, 24 plekken | Bakkerij Goedhart (brood) |
| Den Bosch | Rietveldenweg 15, 5222 AP 's-Hertogenbosch | 51.698115, 5.283208 | [vrachtwagenchauffeur-ce-dranken-den-bosch-759](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-dranken-den-bosch-759) | bedrijfsvlak, 73 plekken | Heineken |
| Lieshout | de Stater 1, 5737 RV Lieshout | 51.517188, 5.607716 | [vrachtwagenchauffeur-ce-dranken-lieshout-758](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-dranken-lieshout-758) | rechthoek, 135 plekken | Bavaria |
| Ridderkerk | Handelsweg 20, 2988 DB Ridderkerk | 51.857734, 4.564819 | [vrachtwagenchauffeur-ce-netwerk-ridderkerk-667](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-netwerk-ridderkerk-667) | rechthoek, 254 plekken | Bakker Centraal Inkoop |
| Beilen | Kanaalweg 15, 9411 KB Beilen | 52.857971, 6.504828 | [vrachtwagenchauffeur-ce-winkeldistributie-beilen-551](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-beilen-551) | bedrijfsvlak, 612 plekken | Jumbo |
| Beverwijk | Rijnland 4, 1948 RL Beverwijk | 52.464837, 4.672199 | [vrachtwagenchauffeur-ce-winkeldistributie-beverwijk-554](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-beverwijk-554) | rechthoek, 65 plekken | Etos |
| Bleiswijk | Laan van Mathenesse 9, 2665 MZ Bleiswijk | 52.034334, 4.535570 | [vrachtwagenchauffeur-ce-winkeldistributie-bleiswijk-430](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-bleiswijk-430) | rechthoek, 260 plekken | Jumbo |
| Heinenoord | Reedijk 7, 3274 KE Heinenoord | 51.814716, 4.498865 | [vrachtwagenchauffeur-ce-winkeldistributie-heinenoord-505](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-heinenoord-505) | bedrijfsvlak, 25 plekken | Plus |
| Oosterhout | Rietgraaf 1, 6678 PJ Oosterhout | 51.890447, 5.819465 | [vrachtwagenchauffeur-ce-winkeldistributie-oosterhout-482](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-oosterhout-482) | bedrijfsvlak, 813 plekken | Lidl |
| Weert | Singelvenweg 1, 6002 SE Weert | 51.247797, 5.670523 | [vrachtwagenchauffeur-ce-winkeldistributie-weert-557](https://werkenbijsimonloos.nl/vacatures/vrachtwagenchauffeur-ce-winkeldistributie-weert-557) | rechthoek, 362 plekken | Lidl |

Benaderingen en correcties bij de standplaatsen:

- **Zwolle**: Tweede adres voor bulk: Mindenstraat 20, 8028 PK Zwolle (vacature chauffeur-bulktransport-zwolle-718).
- **Nieuwegein**: Tweede adres (rangeerder, Jumbo): Ravenswade 14, 3439 LD Nieuwegein.
- **Almere**: De vacature noemt postcode 1358 CB; de BAG kent Brigitten 1 onder 1358 CE (Lidl DC Almere).
- **Dinteloord**: Tweede adres (weekend): Noordzeedijk 113-14, 4671 TL Dinteloord, bij Cosun Beet Company.
- **Amstelveen**: De vacature noemt postcode 1185 ZP; de BAG kent Smederij 13 onder 1185 ZR (Euro Pizza Products).
- **Alkmaar**: De vacature noemt Opaalstraat 5; dat nummer bestaat niet in de BAG. Het Vomar DC staat op Opaalstraat 15 (Overture Places), dat adres is gebruikt.
- **Tilburg**: Tweede adres (teamleider operatie): Jules Verneweg 76, 5015 BH Tilburg (BAG kent 79 en 81, niet 76).
- **Nijkerk**: De vacature noemt postcode 3861 TG; de BAG kent Gildenstraat 30 onder 3861 RG.
- **Bunnik**: Vrumona zelf zit op Vrumonaweg 2 (1,2 km); de standplaats volgt het vacature-adres Schoudermantel 52.
- **Den Bosch**: De vacature noemt postcode 5222 AL; de BAG kent Rietveldenweg 15 onder 5222 AP (bij de Heineken-brouwerij, Rietveldenweg 25).
- **Bleiswijk**: De vacature (JSON-LD) noemt Dorpsstraat 39, het adres van de Jumbo-winkel; de tekst zegt dat je begint bij het distributiecentrum in Bleiswijk. Het Jumbo DC Bleiswijk staat op Laan van Mathenesse 9 (nieuwsbericht dils.com, september 2025). Benadering: het DC-adres in plaats van het vacature-adres.
- **Heinenoord**: Bedrijfsverzamelgebouw Reedijk 7 (veel units); volgens de vacature laden de chauffeurs bij het Plus DC in Oss.
- **Oosterhout**: Oosterhout in Gelderland (gemeente Overbetuwe, Park15), niet Oosterhout in Noord-Brabant: provincie en regio aangepast.
- **Weert**: De BAG in Overture kent de Singelvenweg niet; positie van het Lidl DC Weert uit Overture Places (Singelvenweg 1). Benadering op ongeveer 50 m.
- **Avenhorn** en **Emmeloord**: de vacatures beschrijven broodritten van een bakkerij naar supermarkten; de divisie is daarom winkeldistributie (was netwerk).
- **Klant**: waar de vacaturetitel een andere klant noemt dan de oude lijst staat die nu in `klant` (Amstelveen, Beverwijk, Oostzaan, Amsterdam, Avenhorn, Emmeloord, Maasdam, Veghel, Broek op Langedijk, Dinteloord). De winkelritten gaan naar de formules in `formules`; Amsterdam (Technische Unie, bouwplaatsen) en Oostzaan (Ruig) rijden in de simulatie winkeldistributie voor Albert Heijn, omdat bouwplaatsen en hun afnemers niet openbaar zijn.
- **Heinenoord** laadt eerst bij het Plus DC in Oss (`laad`), **Heerenveen** rijdt de helft van de ritten als LZV-pendel naar het SPAR DC in Waalwijk (`pendel`); beide volgens de vacaturetekst.

## Klanten (`klanten.json`)

**Winkels: 4.578** uit Overture Places, alleen in Nederland (landcode van het adres), niet "permanently closed".
Een winkel hoort bij een formule als de naam met de formule begint (Albert Heijn of AH, Jumbo, Plus, Lidl, SPAR, Vomar,
Aldi, Dirk, Etos) en de categorie een supermarkt of levensmiddelenwinkel is (Etos: drogisterij); DC's, kantoren,
ophaalpunten en vacatures vallen af. Ontdubbeld per formule op postcode en huisnummer en binnen 70 m. De positie is het
BAG-adrespunt van het adres van de winkel waar dat bestaat (4.437 winkels); anders het punt uit Overture (alleen bij een
betrouwbaarheid van minstens 0,9). Een winkel zonder eigen naam krijgt de straat erbij ("Albert Heijn Laat").

| Formule | Winkels |
| --- | ---: |
| Albert Heijn | 1.197 |
| Jumbo | 743 |
| Etos | 570 |
| SPAR | 493 |
| Lidl | 476 |
| Plus | 476 |
| Aldi | 373 |
| Dirk | 147 |
| Vomar | 103 |

- Etos is erbij omdat de standplaats Beverwijk volgens de vacature voor Etos rijdt (DC Etos, Rijnland 4).
- Deen en Coop zijn weggelaten: beide formules bestaan niet meer (Deen in 2023 overgenomen en omgebouwd, Coop in 2024 opgegaan in Plus). Overture had nog 72 Coop- en 16 Deen-vermeldingen op plekken zonder andere supermarkt; dat zijn oude gegevens.
- 22 winkels op de Waddeneilanden hebben geen wegverbinding met het vasteland (`eiland: 1`); ze krijgen de dichtstbijzijnde knoop maar worden niet in ritten gebruikt. AH to go (stations, tankstations) blijft op de kaart maar niet in de winkelritten.

**DC's, fabrieken en groothandels: 157** (35 DC's, 31 fabrieken en klanten uit de vacatures, 91 groothandels).
De DC's en fabrieken zijn met de hand gekozen uit Overture Places (naam en categorie) en de vacatureteksten; de positie
is het BAG-adrespunt van het adres, of het punt uit Overture Places als het adres geen huisnummer heeft. De groothandels
(Sligro, HANOS, Makro, Bidfood) komen uit Overture Places, ontdubbeld binnen 1 km. Een DC op het terrein van een
standplaats verwijst ernaar met `sp`; een DC met een eigen terrein heeft `terrein` en `poort`.

| Soort | Plekken |
| --- | --- |
| dc | AH DC Zaandam, AH DC Pijnacker, AH DC Geldermalsen, AH DC Tilburg, AH DC Zwolle, AH DC Hoorn, AH DC Nieuwegein, AH diepvries-DC Hoogeveen, Jumbo DC Raalte, Jumbo DC Beilen, Jumbo DC Veghel, Jumbo DC Breda, Jumbo DC Woerden, Jumbo DC 's-Hertogenbosch, Jumbo DC Nieuwegein, Jumbo DC Bleiswijk, Plus DC Oss, Plus diepvries-DC Barneveld, Lidl DC Almere, Lidl DC Waddinxveen, Lidl DC Etten-Leur, Lidl DC Oosterhout, Lidl DC Weert, Lidl DC Heerenveen, Lidl DC Oud Gastel, Lidl DC Breda, SPAR DC Waalwijk, Vomar DC Alkmaar, Aldi DC Culemborg, Aldi DC Roosendaal, Aldi DC Deventer, Dirk DC Sassenheim, Etos DC Beverwijk, Kuehne + Nagel Utrecht, Technische Unie DC Alphen aan den Rijn |
| fabriek | Heineken Brouwerij 's-Hertogenbosch, Heineken Brouwerij Zoeterwoude, Bavaria Lieshout, Vrumona Bunnik, Bakkersland Aalsmeer (Borgesius), Borgesius Tholen, Borgesius Nieuw Amsterdam Arnhem, Bakker Barendrecht Ridderkerk, PepsiCo (Lay's) Broek op Langedijk, FrieslandCampina Maasdam, FrieslandCampina Veghel, FrieslandCampina Rotterdam, FrieslandCampina Lochem, FrieslandCampina Steenderen, FrieslandCampina Balkbrug, FrieslandCampina Lutjewinkel, FrieslandCampina Workum, FrieslandCampina Wolvega, FrieslandCampina Domo Beilen, FrieslandCampina Marum, FrieslandCampina Leeuwarden, FrieslandCampina Domo Bedum, FrieslandCampina Noordwijk, Suiker Unie Dinteloord (Cosun), Cosun Protein Dinteloord, Suiker Unie DC Puttershoek, Cosun Roosendaal, Euro Pizza Products Amstelveen, Koninklijke Ruig Oostzaan, Bakkerij Pater Avenhorn, Bakkerij Goedhart Emmeloord |

**Bezorgpunten: 196** woonstraten in 90 plaatsen binnen 40 km van Wognum (boodschappenbezorging), uit de
BAG-adressen: straten met minstens 40 adressen die niet langer zijn dan 0,9 km, per plaats de twee of drie grootste.
Het punt is het midden van de straat, nooit een huisnummer.

Elke winkel, elk DC en elk bezorgpunt heeft een knoop in de routeergraaf (`node`, de knoop waar de toegangsroute op
aansluit) en een toegangsroute in `toegang.json` (polyline van die knoop tot de weg voor de deur).

## Wegennet en toegangsroutes

- `graph.json`: de routeergraaf van 3.0 (snelwegen, autowegen en N-wegen uit dezelfde release), nagebouwd met `tools/ct4/graph_rebuild.py` (identiek aan de vorige versie). Waar een toegangsroute halverwege een kant van de graaf uitkomt, is die kant daar gesplitst: 1.617 knopen en evenveel kanten erbij, achteraan, zodat de bestaande nummers niet veranderen (49.257 knopen, 67.944 kanten).
- Toegangsroutes: het volledige wegennet voor auto's (alle wegklassen tot en met service en woonerf, 2,69 miljoen segmenten) met een Dijkstra vanuit alle aansluitpunten op de graaf tegelijk; kosten naar wegklasse (inritten en parkeerstroken langzaam). Een plek wordt vastgeklikt op de dichtstbijzijnde weg (90 % binnen 37 m); de route eindigt op dat klikpunt. Mediaan 1,2 km, 90 % korter dan 2,9 km, langste 10,7 km (Sellingen).
- `toegang.json` (342 kB): 4.907 toegangsroutes.

## Gebouwen (`buildings.json`, alleen voor 3D)

16.196 gebouwen rond 78 plekken (42 standplaatsen en 36 DC's en fabrieken met een eigen terrein), 690 daarvan op het terrein zelf (`d: 1`).
Selectie: alle gebouwen op het terrein, alle gebouwen van minstens 400 m² binnen 900 m en kleinere tot 300 m, ten hoogste
450 per plek (dichtbij eerst). Vereenvoudigd op 1 m, coordinaten op vijf decimalen. Hoogte: `height` uit de bron, anders
verdiepingen x 3,2 m, anders 6 m (in veel landelijke gebieden ontbreekt de hoogte). Ondergrondse gebouwen niet.
Bestand 2.407 kB; wordt alleen dynamisch geladen (`src/buildings.js`, `laadGebouwen()`).

## Docks (`docks` en `dockPlek` in places.json, schatting)

Elke standplaats heeft laaddocks in de gevel van zijn hoofdgebouw (de hal uit de gebouwen hierboven): 262 docks, van 4 tot 30 per standplaats. Het aantal is een schatting: de hub (Wognum) 30, de twee warehouses (Geldermalsen, Tiel) 16, een depot een dock per zes voertuigen plus een (3 tot 9). De plek: langs de gevels van de hal die op vrije terreinruimte uitkijken (een strook van 28 m voor de gevel binnen het terrein en buiten andere gebouwen), deuren 4,5 m uit elkaar, de beste gevel eerst; voor elke deur past een hele combinatie op het terrein. `dockPlek[i]` is `[lon, lat, koers]`: de deur van dock i + 1 en de richting waarin een voertuig aan dat dock staat (graden vanaf noord). Parkeerplekken in de strook direct voor de docks (20 m) zijn vervallen (42 standplaatsen nagelopen). `tools/ct4/docks.py`, aangeroepen door `build_data.py`.

## Afdelingen (`afdelingen` in places.json)

Per standplaats wat er op het terrein staat, zoals Google Maps de gebouwen van een bedrijf toont: 240 afdelingen bij 42 standplaatsen, 114 met een eigen gebouw uit `buildings.json` (`gebouw`, alleen gebouwen op het terrein, `d: 1`). Wat er is, komt uit de vacatureteksten en de notitie van de standplaats (`bron: 'vacature'`, 32 afdelingen; de zinnen staan in `tools/ct4/afdelingen.py`). Algemene teksten tellen niet mee: het menu van de site, "van dock naar dock", "distributiecentra, fabrieken en warehouses" en tankstations als klant. Uit de vacatures:

- Wognum: Warehouse, Hoofdkantoor, Garage en werkplaats, Wasstraat
- Zaandam: AH DC Zaandam
- Oss: Plus DC Oss, Kantoor
- Zwolle: AH DC Zwolle
- Geldermalsen: Warehouse, Garage en werkplaats
- Tiel: Warehouse en crossdock, Docks 1 tot 16
- Barneveld: Plus diepvries-DC Barneveld, Laadplein
- Raalte: Jumbo DC Raalte
- Waalwijk: SPAR DC Waalwijk, Docks 1 tot 6, Kantoor
- Nieuwegein: AH DC Nieuwegein
- Almere: Lidl DC Almere
- Waddinxveen: Lidl DC Waddinxveen
- Pijnacker (Delfgauw): AH DC Pijnacker
- Opmeer: Garage en truckspuiterij
- Etten-Leur: Lidl DC Etten-Leur
- Alkmaar: Vomar DC Alkmaar
- Tilburg: AH DC Tilburg
- Hoogeveen: AH diepvries-DC Hoogeveen
- Avenhorn: Kantoor
- Beilen: Jumbo DC Beilen
- Bleiswijk: Jumbo DC Bleiswijk
- Oosterhout: Lidl DC Oosterhout
- Weert: Lidl DC Weert

Welk gebouw welke functie heeft, staat niet in open data; dat is afgeleid (`bron: 'afgeleid'` voor wat de vacatures niet noemen, de plek is bij elke afdeling afgeleid):

- loods: het hoofdgebouw op het adres (de hal, bijna altijd het grootste gebouw op het terrein), met de naam van het DC dat er volgens `klanten.json` staat, "Warehouse" als de notitie dat zegt, anders "Loods"; een tweede grote hal (vanaf 5.000 m² en 40 % van de hoofdhal) is ook een loods;
- kantoor: een klein gebouw (40 tot 3.000 m², minstens 2,5 m hoog, niet langer dan drie keer de breedte) dicht bij de poort (binnen 120 m); noemt de vacature het kantoor, dan eerst een gebouw vanaf 150 m² binnen 250 m van de poort, en zonder geschikt gebouw een punt in de hal aan de kant van de poort;
- wasstraat: een smal lang gebouw (4,5 tot 16 m breed, minstens 18 m lang, minstens twee keer zo lang als breed); garage: het grootste overgebleven middelgrote gebouw (vanaf 150 m², minstens 10 m breed); beide alleen waar de vacature ze noemt;
- docks: het midden van de deuren van een rij docks in de gevel ("Docks 1 tot 30"; zie Docks hierboven); poort: het eind van de toegangsroute (`poort`);
- opleggers: de parkeerplekken achteraan in de rijen, waar de app de opleggers zet; laadplein: de laadpunten van de standplaats (hub 24, warehouse 12, depot 4) aan het begin van de rijen, waar de voertuigen staan. De vacature in Barneveld noemt een laadplein waar geladen wordt (laadcoördinator); dat telt als bron, de plek is die van de laadpunten.

Elk punt ligt op het terrein of binnen 40 m ervan (een poort ligt soms net buiten het getekende terrein); `tests/data-check.mjs` controleert dat, en dat Wognum een kantoor, loods, garage en wasstraat heeft.

## Gesimuleerd: historie, charters, oproepkrachten, voorkeuren (de vraagkant van de planning)

Een planner begint bij de ritten die open staan en de mensen die ze kunnen rijden. Dat deel is volledig gesimuleerd, deterministisch met een vaste seed, en overal als gesimuleerd of schatting gemarkeerd (`gesimuleerd: true`, `schatting: true`). Niets hieronder is een echt bedrijf, een echte persoon of een echt nummer.

- **Historie en prognose** (`src/fleet.js`, `poolHistorie`, `prognose` op elke poolrit): acht weken open ritten per standplaats (rond 6.000), elk met divisie, reden, dienstdeel, doorlooptijd van bekend tot het venster en de afloop: een eigen chauffeur, een oproepkracht, een charter, of open gebleven (een extra rit die de klant terugkrijgt of die naar de volgende dag gaat). Aannames (schatting): ongeveer 86 procent wordt ingevuld en 15 procent daarvan vertrekt te laat; hoe korter dag, hoe minder lukt en hoe vaker te laat; maandag meer ziekmeldingen, zondag minder ritten; 's nachts minder (een planner heeft 15 tot 25 trucks, Slimste; 's nachts zijn er minder planners en chauffeurs om te bellen); in het weekend vullen oproepkrachten meer, 's nachts en bij netwerk en bulk de charters; een grote standplaats heeft meer reserve.
- **De kans op invulling** van een open rit: per doorlooptijd (minder dan een uur, een tot twee, twee tot zes, zes tot vijftien uur, langer) de kans over alle open ritten, maal het deel dat bij vergelijkbare ritten werd ingevuld tegen wat je bij hun doorlooptijden zou verwachten (indirect gestandaardiseerd, met demping). Vergelijkbaar is de kleinste groep met minstens 12 ritten: standplaats, divisie, dienstdeel en weekdag, dan zonder weekdag, zonder dienstdeel, de regio, de divisie. `opTijd` is op dezelfde manier de kans op een vertrek binnen het venster. `poolAt(T)` rekent de kans vanaf T: hoe dichter bij het venster, hoe lager. In het echt is de historie een export uit het TMS (rit, venster, moment bekend, moment ingevuld, door wie) plus het vertrek uit de boordcomputer; de rekensom blijft dezelfde.
- **Voorkeuren en tevredenheid** (`src/voorkeuren.js`): per chauffeur divisies, dagdelen, weekend, regio, klanten, maximaal aantal uren per week, extra diensten (graag, soms, nee) en een opmerking, deterministisch uit de id. De tevredenheid (1 tot 10) volgt uit de roosterfit (het deel van de laatste diensten dat bij de voorkeur paste), wijzigingen kort voor vertrek en korte rust: de klachten van chauffeurs op Indeed (3,1 van 5 bij 101 reviews: planning, afspraken niet nagekomen, korte rusttijden, geen inspraak; onderzoeksmemo, gelezen). De mediaan ligt rond 6,5. In het echt komen voorkeuren uit een formulier of de chauffeursapp, met toestemming, en de tevredenheid uit een korte vraag in de app; een beeld per persoon alleen na afspraken met de ondernemingsraad (signaal).
- **Charters** (`src/data/charters.json`, gemaakt door `tools/ct4/charters.py`): 15 verzonnen vervoerders als flexibele schil, 4 in Noord-Holland, 3 in Randstad Zuid, 3 in Oost, 2 in Noord, 3 in Zuid. Namen van planten en vogels, zodat ze niet op een bestaand bedrijf lijken; gecontroleerd tegen klanten.json en de naam Simon Loos, niet nagekeken in het KvK-register. De plaats is echt (voor de afstand). Opleggers die ze trekken of leveren, capaciteit, tarief per uur en per km, betrouwbaarheid (op tijd, ritten, annuleringen in acht weken) en beschikbaarheid vandaag en morgen zijn schattingen.
- **Oproepkrachten** (`OPROEP` in `src/inzet.js`): 76 zzp'ers, weekendchauffeurs en oproepkrachten, ongeveer een op de zestien voertuigen per standplaats, met verzonnen namen (niet gelijk aan een eigen chauffeur), rijbewijs, code 95, beschikbaarheid per weekdag en dagdeel, tarief, voorkeuren, laatste inzet en betrouwbaarheid.
- **Nummers en adressen**: mobiel 06 9… (de reeks 069 is nog niet opengesteld voor uitgifte; ACM, Monitor nummeruitgifte 2018; nakijken in het nummerregister), vast 0229 0… (een abonneenummer begint niet met een 0, dat is het voorvoegsel van het netnummer), e-mail op .example (gereserveerd voor voorbeelden, RFC 2606). Geen van deze nummers of adressen bereikt iemand.
- **Kandidaten** (`fleet.kandidaten`, regels in `src/inzet.js`): eerst eigen chauffeurs, dan oproepkrachten, dan charters met de juiste oplegger. Een eigen chauffeur rijdt een open rit op een vrije dag of voor of na de eigen dienst, als de werkdag hoogstens 13 uur blijft (15 met een verkorte rust van 9 uur), hoogstens 9 uur rijden (10 met een verlenging, twee keer per week), met 11 uur rust tot de volgende dienst (9 verkort, drie keer per week) en hoogstens 60 uur per week (EU 561/2006 en Arbeidstijdenbesluit vervoer; het rooster van morgen is dat van vandaag, een aanname). Wie vandaag geen dienst heeft, is vrij, met vakantie, ziek of heeft een rustdag (gesimuleerd). Een oproepkracht mag een oproep binnen vier dagen weigeren (Wet arbeidsmarkt in balans; de cao kan dat tot 24 uur inkorten): dat staat als signaal bij de kandidaat, het is geen juridisch advies. Wie je belt, neemt niet altijd op: 's nachts de helft, vroeg in de ochtend driekwart, overdag 90 procent (schatting; wie op dienst is, bereik je via de boordcomputer). Kosten zijn schattingen: een eigen chauffeur het uurloon uit de persoonsgegevens (anders 33 euro per uur), maal 1,3 bij overuren en 1,5 op een vrije dag of in het weekend, plus 55 cent per km (diesel, elektrisch 35); een oproepkracht 36 tot 47 euro per uur en een zzp'er 47 tot 56; een charter 47 tot 60 euro per uur plus 52 tot 72 cent per km, met eigen trekker en chauffeur.
- **Toewijzen** (`fleet.wijsToe`) verandert niets: het geeft het blok voor het planbord, een regel voor het logboek en het bericht aan de kandidaat; de interface bewaart de toewijzing.

Wat er nodig is om dit met echte data te laten draaien: een export van acht tot twaalf weken open ritten met hun afloop uit het TMS en de boordcomputer, de lijsten van oproepkrachten en charters met tarieven en afspraken, de roosters en uren (tachograaf) van de chauffeurs, en voorkeuren die chauffeurs zelf opgeven. `tests/data-check.mjs` controleert de vormen, dat er geen echte namen in de charters en oproepkrachten staan, en dat elke open rit minstens drie kandidaten heeft.

## Wegnummers en straatnamen (`roads_display.json`, veld `lab`)

Per lijn het wegnummer (`routes.ref` uit Overture: A-, N- en S-nummers, over de grens ook A-, N-, R- en B-wegen; zonder route een A- of N-nummer uit de naam) en de straatnaam (`names.primary`). Alleen lijnen van minstens 300 m, geen afritten; namen bij N-wegen, secundaire wegen en tertiaire wegen in bebouwd gebied (Natural Earth). Een waarde moet minstens de helft van de lijn dekken. Gelabeld: 14.659 kanten van de graaf, 5.592 secundaire en 6.277 tertiaire lijnen; 7.796 verschillende teksten.

## Wat een benadering is

- De standplaatsen hierboven met een opmerking (Bleiswijk, Weert, Alkmaar en de gecorrigeerde postcodes).
- Terreinen: 10 van de 42 komen uit het landgebruik (het echte bedrijfsvlak); 32 zijn een rechthoek om de gebouwen, omdat het perceel niet in open data staat. De parkeerrijen zijn een berekende indeling, geen gemeten belijning.
- Bezorgpunten zijn het midden van een woonstraat, geen klantadres.
- Welke winkels, DC's en fabrieken een standplaats op een dag bedient, is gesimuleerd (vaste seed); de plekken zelf zijn echt.
- Hoogtes van gebouwen zonder `height` of verdiepingen zijn 6 m.
- Docks: aantal en plek zijn een schatting (zie hierboven); welke docks een standplaats echt heeft, staat niet in open data.
- Afdelingen: welk gebouw het kantoor, de garage of de wasstraat is, is afgeleid uit grootte, vorm en ligging (zie hierboven).
- De vraagkant (historie, prognose, voorkeuren, tevredenheid, charters, oproepkrachten, kandidaten, kosten) is gesimuleerd; zie "Gesimuleerd" hierboven.
- De dag zelf (in `src/fleet.js`) is geijkt op de cijfers uit het onderzoeksmemo (rapporten/simon-loos-control-tower, §1.4): winkeldiensten van 8,5 tot 11 uur met 45 tot 60 procent rijden (Slimste, vacatureteksten), een tweede dienst voor een kwart tot een derde van de vloot, wachten bij DC's en winkels van 35 tot 60 minuten per truck per dag (Slimste), pauzes volgens EU-verordening 561/2006 en het Arbeidstijdenbesluit vervoer, en de AH-ritten van morgen die 's middags via OTM5 binnenkomen. De wachttijd per soort plek en dagdeel, de lostijden en de rijsnelheden zijn schattingen.

## Werkwijze (`tools/ct4/`)

Volgorde, met een werkmap buiten de repo voor de parquet-bestanden:

1. `ov_get.py`: places, addresses en transportation (alle wegklassen) voor Nederland; `bld_get.py` en `lu_get.py`: gebouwen en landgebruik rond elke plek.
2. `jobloc.py` (en `vacdoen.py`): adressen en teksten uit de vacaturepagina's; `depots.py`, `addr_find.py`, `places_near.py`, `sp_final.py`: de standplaatsen.
3. `stores.py`, `stores2.py`: winkels; `dcs.py`: DC's, fabrieken, groothandels; `bezorg.py`: bezorgstraten.
4. `terrain.py`: terrein, parkeerrijen en gebouwen; `graph_rebuild.py`: de routeergraaf nagebouwd met connectors; `access.py` en `apply_splits.py`: toegangsroutes en gesplitste kanten; `labels.py`: wegnummers en straatnamen.
5. `build_data.py`: schrijft places.json, klanten.json, toegang.json, graph.json en buildings.json. Controle: `tests/data-check.mjs`; plaatjes per plek: `qa_draw.py`.
6. `docks.py` (door `build_data.py` aangeroepen, ook los te draaien): docks en hun plek per standplaats in places.json; met een tweede argument een plaatje per standplaats.
7. `afdelingen.py` (door `build_data.py` aangeroepen na `docks.py`): de afdelingen per standplaats in places.json; met een tweede argument een plaatje per standplaats.
8. `charters.py` (los, deterministisch): de verzonnen charters in `charters.json`.

Bestandsgroottes: places.json 151 kB, klanten.json 593 kB, toegang.json 342 kB, graph.json 3.915 kB, roads_display.json 2.350 kB, buildings.json 2.407 kB, charters.json 9 kB.
