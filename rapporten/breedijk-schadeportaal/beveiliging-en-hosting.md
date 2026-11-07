# Schadeportaal Breedijk: beveiliging en hosting

Voor Sem, 7 november 2026. Je vraag: "Hoe gaan we waarborgen dat het veilig blijft en de gegevens bewaard? Hoe
kunnen we dat mooi overzetten van eigenlijk nu, hoe het lokaal draait, naar een goed beveiligd systeem waarin
data eigenlijk is opgeslagen, maar waar een derde partij eigenlijk ook niet bij kan komen?" Dit plan hoort bij
`memo.md` en de demo in `demos/breedijk-schadeportaal`. Het TMS van Breedijk heet **Transplan** (RGB+); in
`memo.md` staat nog Transpas van Art Systems, dat is fout en moet daar nog worden rechtgezet.

**Status van wat hier staat.** In deze sessie is geen bronpagina geopend. Wat ik over Microsoft, Supabase,
Netlify en Anthropic schrijf, komt uit mijn kennis van hun documentatie: status **zoek**, nakijken voordat het
naar Breedijk gaat. Alle bedragen zijn **schatting**. Juridische punten (AVG, OR, verjaring, verzekering) zijn
signalen: **laten toetsen**, geen advies.

## 1. In drie zinnen

Zet het portaal in een omgeving die van Breedijk is (hun eigen Microsoft-tenant en een Azure-abonnement op hun
naam), zodat de data nooit bij SafeTail staat en wij als bouwer alleen binnenkomen als Breedijk ons die deur
tijdelijk opent. Beveilig het in lagen: inloggen met hun eigen Microsoft-accounts en een tweede stap (MFA),
elke koppeling met de kleinst mogelijke rechten, alles versleuteld, een logboek dat niemand kan wissen, en
back-ups waarvan je het terugzetten echt hebt geoefend. Ga er in vijf kleine stappen heen, elk met een weg
terug, en begin pas met echte mails als de verwerkersovereenkomst, een korte privacytoets en het gesprek met
de OR over het chauffeursbeeld rond zijn.

**Hoe ik je vraag las.** Letterlijk: hoe maken we van de demo een veilig systeem. Het doel: Breedijk moet
erop durven vertrouwen, en jij wilt dat zonder dat SafeTail een risico of een flessenhals wordt. Het
ongezegde: "een derde partij kan er niet bij" geldt ook voor ons zelf; de echte zwakke plek zit vaak in de
tenant van de klant (een beheerder zonder MFA) en in wat nu al rondslingert (de Excel, oude mails); en Breedijk
moet kunnen doorgaan als SafeTail er morgen niet meer is.

## 2. Wie is eigenaar van wat

**Het principe.** Breedijk is eigenaar van de data en de verwerkingsverantwoordelijke (de partij die bepaalt
waarom en hoe gegevens worden verwerkt). SafeTail bouwt en beheert in opdracht en is verwerker. Dan hoort de
data in een omgeving waar Breedijk de sleutels van heeft: hun tenant (de eigen Microsoft-omgeving met hun
accounts), hun abonnement, hun facturen. SafeTail krijgt een beheerdersrol die Breedijk kan intrekken. Bij
afscheid draag je niets over behalve die rol; de data verhuist niet, want hij stond er al.

### Variant (a): alles in de Microsoft-omgeving van Breedijk

- **Inloggen**: Entra ID (de accountdienst van Microsoft 365) met de accounts die ze al hebben, MFA
  verplicht. Het portaal is een app-registratie (de officiële inschrijving van een app in hun tenant) met
  rollen.
- **De mailbox**: dezelfde of een tweede app-registratie met de Graph-toestemming Mail.Read, beperkt tot de
  schade-mailbox met RBAC for Applications (een regel in Exchange die de app alleen die ene mailbox laat
  zien; de opvolger van de oude Application Access Policies) (zoek).
- **Azure in hun abonnement**, regio West-Europa (de datacenters in Nederland): een database (Azure
  Database for PostgreSQL Flexible Server, of Azure SQL), Blob Storage (opslag voor bestanden) voor de foto's,
  Key Vault (een kluis voor wachtwoorden en sleutels), de app als Static Web App met een kleine API als
  Container App of Function, en Log Analytics voor de logboeken.
- **Kosten per maand** (schatting): database 20 tot 30 euro, opslag voor foto's 1 tot 5 euro (circa 470
  claims per jaar met 20 foto's van 1 MB is 10 GB per jaar), Static Web App Standard circa 9 euro, API 0 tot
  10 euro, Key Vault onder 1 euro, logboeken 5 tot 15 euro. Samen **45 tot 70 euro**. Vraagt Transplan een
  vast IP-adres van ons (een whitelist), dan komt er een NAT-gateway bij (een vast uitgaand adres): circa 35
  euro. Conditional Access (regels als "alleen inloggen vanaf een beheerd apparaat") vraagt Entra ID P1, dat in
  Microsoft 365 Business Premium zit; hebben ze dat niet, dan circa 6 euro per gebruiker voor de vijf tot
  tien kantoorgebruikers. De gewone MFA via security defaults is gratis.
- **Afhankelijkheid**: Microsoft, waar Breedijk al van afhangt voor mail en bestanden. Geen nieuwe leverancier
  met persoonsgegevens, behalve Anthropic (sectie 4).

### Variant (b): de SafeTail-opzet, op naam van Breedijk

- Netlify voor de app en een functie als poort, Supabase in de EU (Frankfurt) met RLS (row level security:
  de database bepaalt per rij wie hem mag zien), net als SafeTools. Maar dan een Netlify-team en een
  Supabase-organisatie op naam van Breedijk, met hun creditcard, en SafeTail als uitgenodigd lid.
- Inloggen kan nog steeds met hun Microsoft-accounts: Supabase heeft Azure (Entra) als inlogpartij; MFA
  dwing je dan af in Entra. De mailbox lees je met dezelfde app-registratie in hun tenant, maar de mails
  verlaten de tenant en landen bij Supabase.
- **Kosten per maand** (schatting): Supabase Pro circa 25 dollar, Netlify Pro circa 19 dollar per lid, samen
  **45 tot 80 euro**. Point-in-time recovery (terugzetten naar elk moment, in plaats van naar de nacht ervoor)
  is een uitbreiding van circa 100 dollar per maand (zoek).
- **Afhankelijkheid**: twee extra leveranciers (Netlify en Supabase, beide Amerikaanse bedrijven, met
  servers van AWS eronder), dus twee extra subverwerkers in de verwerkersovereenkomst. Netlify-functies
  hebben geen vast uitgaand IP-adres; vraagt Transplan een whitelist, dan heb je ergens anders een klein
  doorgeefluik nodig (zoek).

### Vergelijking en aanbeveling

| | (a) Breedijks Microsoft-omgeving | (b) Netlify en Supabase op naam van Breedijk |
| --- | --- | --- |
| Waar de mails heen gaan | Blijven in de tenant van Breedijk | Gaan naar Supabase in Frankfurt |
| Extra leveranciers met persoonsgegevens | Geen (plus Anthropic) | Twee (plus Anthropic) |
| Inloggen en afmelden van een medewerker | Vanzelf: account weg in Entra is toegang weg | Via Entra, plus een gebruikersrij in Supabase die je ook opruimt |
| Wie het kan beheren als SafeTail wegvalt | Elke Microsoft-partner; hun IT-partner kent het | Iemand die Supabase en Netlify kent; minder gangbaar in het mkb |
| Vast IP voor Transplan | Kan (NAT-gateway) | Niet zonder extra dienst |
| Bouwtijd voor SafeTail | Hoger: Azure is nieuw voor ons, meer instellingen | Laag: de opzet van SafeTools ligt klaar |
| Kosten per maand (schatting) | 45 tot 70 euro, met vast IP 80 tot 105 | 45 tot 80 euro |

**Aanbeveling: (a).** De mails, de accounts en het beheer van Breedijk zitten al bij Microsoft. Met (a) komt
er geen nieuwe plek bij waar hun gegevens staan, regelt hun eigen accountbeheer de toegang, en kan hun
IT-partner het overnemen. Dat weegt zwaarder dan onze bouwsnelheid. Het nadeel is reëel: Azure kost ons in het
begin meer uren dan Supabase, en die uren moeten we niet doorrekenen als "inwerken". Kies (b) alleen als
Breedijk geen Azure-abonnement wil of hun IT-partner het niet wil dragen; zet ook dan alles op hun naam.
Toets de vraag: begin niet in (b) "omdat het sneller is" om later te verhuizen. Verhuizen met echte
persoonsgegevens is het moment waarop het misgaat; begin in de omgeving waar je wilt eindigen.

## 3. Beveiliging in lagen

**Identiteit en toegang.** Inloggen alleen via Entra (SSO: een keer inloggen met je werkaccount), MFA
verplicht voor iedereen, voor beheerders met een sterke methode (de Authenticator-app of een sleutel, geen
sms). Geen gedeelde logins zoals "schade@": elke handeling moet naar een persoon te herleiden zijn. De rollen
zijn app-rollen in Entra, gekoppeld aan een groep, zodat Breedijk zelf beslist wie wat is:

| Rol | Ziet | Mag |
| --- | --- | --- |
| Behandelaar | Alle dossiers, de mail, de rit, de foto's, het chauffeursbeeld | Beoordelen, besluiten, antwoorden, toewijzen |
| Planner | De dossiers van zijn vestiging zonder bedragen en zonder chauffeursbeeld; de vraag aan de chauffeur | Een chauffeur vragen om uitleg, een rit aanvullen |
| Directie | Rapporten en het chauffeursbeeld als overzicht | Lezen; instellingen (drempels) wijzigen |
| Chauffeur | Alleen de eigen meldingen en vragen | Zelf melden met foto's, een vraag beantwoorden |
| Beheerder (SafeTail, tijdelijk) | Instellingen en logboeken, geen dossiers | Alleen tijdens een geopende onderhoudsperiode (sectie 4) |

Toegang per vestiging (Opmeer, Nijkerk, Barneveld) is een extra filter op de planner, als Breedijk dat wil.
Chauffeurs hebben vaak geen Microsoft-licentie. Toets daarom of ze wel in het portaal moeten: de
boordcomputer of de app die ze al gebruiken kan de melding met foto's sturen, en het portaal leest die in.
Dan hoeft er geen inlog bij voor veertig mensen in een cabine.

**De koppelingen, elk met de kleinst mogelijke rechten.**

- *Mailbox*: Mail.Read als applicatierecht, met RBAC for Applications op de schade-mailbox alleen. Een
  antwoord versturen doet de behandelaar vanuit Outlook (dan is het ook zijn mail), of het portaal maakt een
  concept in die mailbox (Mail.ReadWrite, dezelfde beperking). Geen Mail.Send voor de hele tenant.
- *Transplan*: een eigen API-sleutel voor het portaal, alleen leesrechten op ritten, chauffeur en documenten,
  met een IP-beperking op ons vaste adres. De sleutel staat in Key Vault en wordt elk jaar vervangen. Bestaat
  er geen API, dan een dagelijkse export naar een map in hun tenant, die het portaal leest.
- *Foto's* (Rietveld, Efficio, EasyTrack of Transplan): ophalen per dossier, met een eigen sleutel. Kopieer
  alleen de foto's van een rit waar een claim op zit; die zijn bewijs en moeten blijven, ook als de leverancier
  ze na een paar maanden weggooit.
- *RDW open data*: alleen het kenteken gaat erheen, geen persoonsgegevens; geen sleutel nodig.
- *Claude API*: alleen de tekst van die ene mail en de foto's van dat dossier, met e-mailadressen,
  telefoonnummers en namen eerst vervangen door `[e-mailadres]` en zo verder, zoals in SafeTools AI. Nooit het
  chauffeursbeeld, nooit het logboek. Volgens de commerciële voorwaarden van Anthropic wordt API-verkeer niet
  gebruikt om modellen te trainen: **laten nakijken in de actuele voorwaarden**. Let op: een kenteken op een
  foto is ook een persoonsgegeven (je kunt erachter komen van wie de auto is).

**De data.** Versleuteling onderweg (alleen https, TLS 1.2 of hoger) en in rust (Azure versleutelt database en
opslag standaard). Op veldniveau versleutel je de contactgegevens van de tegenpartij (naam, e-mail, telefoon)
met een sleutel uit Key Vault, zodat een kopie van de database zonder die sleutel waardeloos is. Zoeken op een
versleuteld e-mailadres kan dan niet; zoek op kenteken of dossiernummer, en bewaar zo nodig een hash (een
vingerafdruk) om te kunnen matchen. In de database rijniveau-rechten (RLS, zoals in SafeTools): de database
zelf weigert een planner de bedragen, ook als de app een fout maakt. Foto's staan in een privé-container
zonder openbare link en gaan open met een link die vijf minuten geldig is (een SAS-token, of in (b) een
signed URL zoals de dossiers van SafeTools).

**Het logboek.** Elke actie komt in een tabel waar alleen bij geschreven kan worden (append-only: de rechten
staan geen wijzigen of wissen toe, ook niet voor de app), met wie, wanneer, wat en welk dossier. Ook
leesacties op het chauffeursbeeld en op de contactgegevens van de tegenpartij, want daar zit het risico. Een
kopie gaat dagelijks naar opslag met een onwijzigbaarheidsregel (immutability: een bestand dat een vaste tijd
niet te wissen is, ook niet door een beheerder) (zoek). De demo heeft al een logboek per dossier; dit is
hetzelfde, maar dan voor het hele portaal en onaantastbaar.

**Back-ups.** De database dagelijks, 35 dagen terug te zetten (het maximum van Azure PostgreSQL, zoek), plus
een maandelijkse kopie die een jaar blijft in een andere regio in de EU. Foto's met soft delete (een gewist
bestand blijft nog 30 dagen terug te halen) en versiebeheer. Elk kwartaal zet je een back-up terug in een
testomgeving en kijk je of een dossier compleet is. Een back-up die nooit is teruggezet, telt niet.

**Bewaartermijn** (voorstel, laten toetsen). Ankerpunt is de verjaring: een vordering uit de
vervoerovereenkomst verjaart na een jaar, en een schriftelijke reclamatie kan dat verlengen (zoek, `bronnen.md`
onderwerp 3). De Belastingdienst vraagt zeven jaar voor de financiële administratie (zoek); dat raakt de
betaalde bedragen, niet de hele correspondentie. Voorstel:

| Wat | Hoe lang | Daarna |
| --- | --- | --- |
| Open dossier | Zolang het loopt | |
| Gesloten dossier, compleet | Twee jaar na sluiten (de verjaring met marge) | Naam, e-mail en telefoon van de tegenpartij gewist, foto's weg |
| Bedrag, besluit, kenteken, factuur | Zeven jaar | Weg |
| Chauffeursbeeld | Een rollend venster van twaalf maanden | Telt niet meer mee |
| Logboek | Zo lang als het dossier, minimaal twee jaar | Weg |
| Mails in de schade-mailbox | Een bewaarregel in Microsoft 365, gelijk aan het dossier | Weg |

Vraag de verzekeraar en de accountant of zij langer willen; het langste antwoord met een reden wint.

**Geheimen.** Nooit in code, in de repo, in een mail of in een chat. In (a) in Key Vault, en de app haalt ze op
met een managed identity (een identiteit van de app zelf, zonder wachtwoord). In (b) in de omgevingsvariabelen
van Netlify, zoals `SUPABASE_SECRET_KEY` en `ANTHROPIC_API_KEY` in SafeTools. Elke sleutel een eigen naam en
een vervangdatum.

**Updates en afhankelijkheden.** Zo weinig bibliotheken als kan (de demo heeft er nu geen). Dependabot of
Renovate voor wekelijkse updates, een test die bij elke wijziging draait (zoals `npm test` op GitHub voor de
SafeTail-site), en beveiligingsupdates binnen een week. Microsoft Defender for Cloud in de gratis stand geeft
een score van het abonnement; kijk die maandelijks.

**Voor livegang een test van buitenaf.** Minimaal een geautomatiseerde scan (OWASP ZAP, gratis) en de check
van de tenant (Microsoft Secure Score). Beter een kleine penetratietest door een onafhankelijke partij: 3.000 tot
8.000 euro voor een app van deze omvang (schatting). Dat gaat over schade van klanten en chauffeurs; een
test is goedkoper dan het eerste lek.

**Een plan voor een datalek.** Breedijk moet een lek binnen 72 uur melden bij de Autoriteit
Persoonsgegevens, en soms aan de mensen zelf (laten toetsen). SafeTail meldt een vermoeden aan Breedijk
binnen 24 uur (afspraak in de verwerkersovereenkomst). Leg vooraf vast: wie belt wie (een naam en een
nummer aan beide kanten), hoe je toegang direct dichtzet (de app-registratie uitschakelen, sleutels
vervangen), hoe je uit het logboek haalt wat er gezien is, en wie de melding doet. Oefen het een keer, aan
tafel, in een uur.

## 4. "Een derde partij kan er niet bij"

Eerlijk vooraf: geen enkele partij die een systeem draait, kan er technisch nooit bij. Je kunt wel zorgen dat
elke partij alleen ziet wat nodig is, dat toegang zichtbaar wordt, en dat het contractueel vastligt.

- **SafeTail.** Geen staande toegang: na de bouw staat ons account in de tenant uit. Toegang op verzoek: de
  beheerder van Breedijk zet ons gastaccount aan voor een bepaalde tijd, met een reden, en het logboek
  laat zien wat we deden. Met Entra ID P2 kan dat met PIM (Privileged Identity Management: een rol die je
  per keer aanvraagt en die na een paar uur vervalt); zonder P2 met de hand (account aan, account uit). Voor
  een storing buiten kantooruren een break glass-procedure: een noodaccount bij Breedijk in een verzegelde
  envelop of een kluis, waarvan elk gebruik een melding geeft. Onze beheerdersrol geeft standaard geen
  inzage in dossiers.
- **Microsoft (of Supabase en Netlify in variant b).** Data in de EU (West-Europa; Microsoft heeft de EU
  Data Boundary, zoek), versleuteld in rust. Wees eerlijk: de leverancier beheert de servers. Klantbeheerde
  sleutels (customer-managed keys: de sleutel staat in de Key Vault van Breedijk en kan worden ingetrokken)
  maken het moeilijker, maar de dienst moet de data ontsleutelen om ermee te werken. Ook is Microsoft een
  Amerikaans bedrijf, dus de Amerikaanse wet (de CLOUD Act) kan om gegevens vragen; dat geldt even goed voor
  Supabase en Netlify. Voor schadedossiers van een transporteur is dat een gangbaar en aanvaard risico, maar
  het hoort in de privacytoets (laten toetsen). Customer Lockbox (Microsoft vraagt toestemming voor
  inzage bij support) bestaat voor Microsoft 365 en Azure; welke licentie dat vraagt, nakijken (zoek).
- **RGB+ (Transplan) en de boordcomputerleverancier (Rietveld, Efficio of EasyTrack).** Zij houden hun eigen
  data; wij halen op met een eigen sleutel, alleen lezen. Zij komen niet in het portaal en krijgen geen
  account. Wat zij zelf met de ritten doen, valt onder hun eigen overeenkomst met Breedijk.
- **Anthropic.** Ziet alleen de gestuurde tekst en foto's van een dossier, met gewiste contactgegevens.
  Volgens de voorwaarden geen training en een korte bewaartermijn voor misbruikcontrole; een afspraak
  zonder bewaring (zero data retention) is op aanvraag mogelijk: **laten nakijken in de actuele
  voorwaarden**. Het verkeer gaat mogelijk naar de VS; dat hoort in de privacytoets. Een alternatief om te
  onderzoeken: Claude via Microsoft (Azure AI Foundry) in het abonnement van Breedijk, dan loopt het via hun
  eigen contract; waar de verwerking dan plaatsvindt, nakijken (zoek). Kan dit allemaal niet, dan werkt het
  portaal zonder AI: de velden tikt de behandelaar dan zelf over.
- **De verzekeraar.** Krijgt geen toegang. Breedijk stuurt het pakket (een pdf of zip uit het portaal) vanuit
  Outlook, en het logboek legt vast wat er ging. Wil de verzekeraar later een eigen inlog, dan een gastaccount
  per dossier dat vervalt.

**De omgekeerde vraag: Breedijk kan altijd bij zijn eigen data.** De database staat in hun abonnement en ze
zijn eigenaar. Daarbij een knop "alles exporteren" (csv voor de tabellen, de foto's als bestanden met het
dossiernummer in de naam, het logboek als csv), een export per persoon voor een inzageverzoek van een
chauffeur of een tegenpartij (AVG), de broncode in een repository op naam van Breedijk, en de opbouw van de
omgeving als code (Bicep of Terraform: een beschrijving waarmee je de hele omgeving opnieuw opbouwt). PostgreSQL
is open: elke partij kan ermee verder. Geen eigen formaat, geen opslag die alleen wij kunnen lezen.

## 5. Van de demo naar het echte systeem

**Eerst de afspraken.** Zonder deze vijf geen echte mail in het portaal:

1. Een **verwerkersovereenkomst** tussen Breedijk en SafeTail, met de subverwerkers (Microsoft, Anthropic),
   de 24 uur bij een lek, de bewaartermijn en wat er bij afscheid gebeurt.
2. Een **lichte DPIA of privacytoets** (een vastgelegde afweging van de risico's voor de mensen in de data).
   Een systematisch beeld van werknemers kan een volledige DPIA verplicht maken (laten toetsen).
3. **De OR over het chauffeursbeeld.** Breedijk heeft circa 58 fte, dus vermoedelijk een OR, en een
   systeem dat het werk van chauffeurs volgt valt mogelijk onder het instemmingsrecht (artikel 27 WOR, zoek,
   laten toetsen). Zonder instemming bouw je stap 1 tot en met 4 zonder chauffeursoverzicht.
4. **De bewaartermijn** uit sectie 3, vastgesteld door Breedijk.
5. **Een SLA** (de afspraak over beschikbaarheid en reactietijd: bijvoorbeeld op werkdagen binnen vier uur
   bij een storing) en **wat er gebeurt als SafeTail wegvalt**: code, documentatie en een overdrachtsdocument
   staan bij Breedijk, de IT-partner kan het in een dag overnemen, en we oefenen dat een keer.

| Stap | Wie doet wat | Wat het oplevert | Terug |
| --- | --- | --- | --- |
| 0. De demo zoals nu | SafeTail; geen data, alles gesimuleerd, alleen in de browser | Het gesprek, de vorm van de data, de vragen aan RGB+ | Niets nodig |
| 1. Proef met echte mails | De M365-beheerder van Breedijk maakt de app-registratie en de Azure-omgeving op hun naam (een uur tot een dagdeel); SafeTail bouwt het inlezen; de behandelaar beoordeelt zes weken naast de Excel | Elke mail wordt een dossier met uitgelezen velden; je ziet of het klopt, zonder dat iets afhangt van het portaal | De app-registratie uitzetten, de database wissen; de Excel liep gewoon door |
| 2. Transplan en de foto's | RGB+ geeft een sleutel of een export; de boordcomputerleverancier de foto's; SafeTail koppelt | De rit en het bewijs staan bij het dossier; geen overtikken meer | Sleutels intrekken; terug naar stap 1 |
| 3. Rollen, logboek, rapporten | SafeTail bouwt; Breedijk deelt groepen in; de OR heeft ingestemd voor het chauffeursbeeld | Het portaal vervangt de Excel; directie en planner werken erin | De export naar Excel blijft een maand bestaan |
| 4. De Claude API | Breedijk sluit het contract (of het loopt via Azure); SafeTail zet het wissen van contactgegevens en de controles erin | Velden en conceptantwoord vanzelf; de behandelaar leest na | Een schakelaar uit; het portaal werkt zonder |
| 5. Livegang | Samen, met de checklist van sectie 6 | Het officiële systeem; de Excel gaat dicht en wordt gearchiveerd of gewist | Tot de Excel is gewist, kan het terug |

Toets bij stap 1: de opdracht noemt Power Automate. Dat werkt, maar een flow die naar een eigen database
schrijft, gebruikt een premium-connector, en die vraagt Power Automate Premium (circa 15 euro per gebruiker
per maand, zoek). De API in Azure die zelf met Graph de mailbox leest, kost niets extra en is de vorm die je
toch houdt. Power Automate is wel de snelste weg als hun IT-partner geen app-registratie wil maken: laat de
flow dan de mail en bijlagen in een SharePoint-map zetten (standaardconnector), en laat het portaal die map
lezen.

Vergeet bij livegang de oude plekken niet: de Excel met chauffeursnamen, mails die doorgestuurd zijn naar
privé-adressen, foto's op telefoons. Die zijn nu het grootste risico, en het portaal lost dat pas op als ze
weg zijn.

## 6. Checklist voor livegang

- [ ] Verwerkersovereenkomst getekend, met subverwerkers en meldtermijn bij een lek
- [ ] Privacytoets of DPIA vastgelegd en door Breedijk goedgekeurd
- [ ] OR heeft ingestemd met het chauffeursbeeld, of het staat uit
- [ ] Bewaartermijnen ingesteld in de database, de opslag en de schade-mailbox
- [ ] Alle data in de omgeving van Breedijk, regio EU, op hun naam en factuur
- [ ] MFA verplicht voor elke gebruiker; geen gedeelde accounts
- [ ] Rollen ingericht als groepen in Entra; de planner ziet geen bedragen en geen chauffeursbeeld
- [ ] Mail.Read beperkt tot de schade-mailbox, getest: een andere mailbox geeft een weigering
- [ ] Transplan- en fotosleutels alleen lezen, met IP-beperking, in Key Vault
- [ ] Contactgegevens worden gewist voor ze naar de Claude API gaan, getest met tien echte mails
- [ ] Voorwaarden van Anthropic nagekeken op training en bewaring, en vastgelegd in de privacytoets
- [ ] Contactgegevens van de tegenpartij versleuteld op veldniveau
- [ ] Foto's privé, alleen met een link van minuten
- [ ] Logboek append-only, met leesacties op het chauffeursbeeld, en een onwijzigbare kopie
- [ ] Back-up dagelijks en een keer teruggezet in een testomgeving, met verslag
- [ ] Geen geheimen in de code; een scan van de repository op sleutels is schoon
- [ ] Scan of penetratietest gedaan, de hoge bevindingen opgelost
- [ ] Toegang van SafeTail staat uit; de procedure voor toegang op verzoek en break glass is getest
- [ ] Datalekplan met namen en nummers, een keer aan tafel geoefend
- [ ] Export van alles en overdrachtsdocument staan bij Breedijk; de Excel is gearchiveerd of gewist

## 7. Wat we moeten doorvragen

**Bij Breedijk.** Welke Microsoft 365-licentie hebben ze (Business Basic, Standard of Premium: dat bepaalt
Conditional Access en de kosten)? Hebben ze een Azure-abonnement, of willen ze er een? Is er een OR, en weten
de chauffeurs van de Excel? Wie wordt binnen Breedijk eigenaar van het portaal en wie keurt toegang goed? Hoe
lang willen ze dossiers bewaren, en waar staat de Excel nu? Hebben chauffeurs een Microsoft-account?

**Bij hun Microsoft 365-beheerder of IT-partner.** Staat MFA aan voor iedereen, ook voor de beheerders? Wat is
de Secure Score? Mogen wij een app-registratie met Mail.Read en RBAC for Applications, of willen zij die maken?
Welke bewaarregels gelden nu voor de schade-mailbox? Willen zij het beheer van de Azure-omgeving dragen, of
alleen meekijken? Hebben ze Entra ID P2 voor PIM?

**Bij RGB+ (Transplan).** Is er een API, met een testomgeving? Hoe werkt de toegang (sleutel, OAuth,
IP-whitelist) en wat kost die voor een derde? Kun je zoeken op kenteken en datum? Waar staan de schouwfoto's:
bij Transplan of bij de boordcomputerleverancier, en hoe lang worden ze bewaard? Kan een export dagelijks naar
een map in de tenant van Breedijk?

**Bij de verzekeraar of makelaar.** Welke stukken willen ze en in welke vorm? Hoe lang moet Breedijk een
dossier bewaren voor de polis? Stellen ze eisen aan de beveiliging van systemen met schadedata (soms staat
dat in een cyberpolis)?

**Bij een jurist.** Is het chauffeursbeeld een personeelsvolgsysteem in de zin van de WOR? Is een volledige
DPIA nodig? Welke bewaartermijn houdt stand, ook gezien de verjaring en de fiscale bewaarplicht? Is de
doorgifte naar Anthropic (mogelijk de VS) goed geregeld met de huidige voorwaarden? Wat moet er in de
verwerkersovereenkomst over aansprakelijkheid van SafeTail?

## 8. Eigen idee: het bewijs dat niemand kan veranderen

**Het probleem.** De kracht van het portaal is het bewijs: de foto bij ophalen met tijdstip, de handtekening
zonder voorbehoud. In een geschil kan een tegenpartij of later een rechter vragen: hoe weet je dat die foto
toen gemaakt is en sindsdien niet is aangepast? Nu is het antwoord "omdat wij het zeggen". Dat is zwak, zeker
bij een opdrachtgever die vaak claimt.

**Het idee.** Op het moment dat een foto, een inspectie of een afleverbon het portaal binnenkomt, berekent het
een vingerafdruk (een SHA-256-hash: een code die verandert als er een pixel verandert) en zet die met het
tijdstip in het append-only logboek. Een dagelijkse samenvatting van alle vingerafdrukken gaat naar de
onwijzigbare opslag, en eventueel naar een externe tijdstempeldienst (een partij die bevestigt dat deze code
op dit moment bestond, volgens RFC 3161). Het pakket voor een tegenpartij of verzekeraar krijgt een regel:
"Foto 3 van 13 oktober, 21:30, vingerafdruk a3f9…, sinds ontvangst ongewijzigd."

**Waar het vandaan komt.** De politie werkt met een chain of custody (een sluitende keten van wie het
bewijs had) voor bodycambeelden; banken en notarissen gebruiken gekwalificeerde tijdstempels; de e-CMR
(de digitale vrachtbrief) leunt op hetzelfde principe om te bewijzen dat een vrachtbrief niet is aangepast.

**Wat het oplevert** (schatting, grote marge). Bij circa 470 claims per jaar en een deel waar de tegenpartij
de ophaalfoto betwist: wint Breedijk er daardoor een paar per jaar sneller of zonder korting, dan is dat bij
900 euro gemiddeld enkele duizenden euro per jaar, en minder uren discussie. Het sterkste effect is
voorkomen: een opdrachtgever die weet dat het bewijs vastligt, claimt minder vaak schade die er al was. Het
past bij idee 2 (het patroon per opdrachtgever) in `ideeenbank.md`.

**Goedkope proef.** Een dag werk: bij binnenkomst de hash berekenen en in het logboek zetten (een paar regels
code, geen kosten), en in het pakket voor de verzekeraar de regel met de vingerafdruk tonen. Vraag de
makelaar en een jurist of dat in een geschil iets toevoegt (laten toetsen). Een externe tijdstempel kan
later, voor een paar euro per maand (schatting).
