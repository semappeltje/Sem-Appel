# Schadeportaal voor Breedijk Transport: ontwerpbrief (demo 1.0)

Aanleiding: een gesprek van Sem met Breedijk Transport (autotransporteur, Opmeer; vestigingen Nijkerk en
Barneveld; gebruikte auto's en lichte bestelwagens voor leasemaatschappijen, dealers, veilingen en
importeurs; circa 800 auto's per week over het eigen overslagterrein). Schadeclaims komen binnen in een
schade-mailbox in Outlook. De behandelaar zoekt het kenteken op in Transpas (het TMS), ziet wanneer en door
wie de auto is gereden en welke foto's de chauffeur maakte, en beslist: zat de schade er al, of hebben wij
hem gereden. Daarna gaat alles in een Excel voor het management (wie rijdt schade; drie keer in een week is
een gesprek), met de vragen boven of onder 1.750 euro (daarboven wordt het verzekeringswerk, eigen risico
750 euro) en het onderhandelen over de offerte. Afspraak: een onderzoek met een demo, testdata en een
mooie interface. Geen echte kentekens of voertuigen, wel realistisch.

## Drie lezingen van de vraag

1. **Letterlijk.** Een demo van een schadeportaal: de mailbox, Transpas en de Excel in een scherm, met
   testdata en een interface die eruitziet als een echt product.
2. **Het doel.** Breedijk wil minder handwerk per claim, een vaste manier van beoordelen, en een
   overzicht voor het management dat vanzelf ontstaat in plaats van uit een Excel. Sem wil laten zien dat
   dit snel en betaalbaar kan en dat de koppelingen bestaan.
3. **Het ongezegde.** Een claim is geld: de drempel, het eigen risico, de limiet van de vervoerscondities
   (AVC: een bedrag per kilogram), de termijn waarbinnen een ontvanger schade moet melden, de handtekening
   bij aflevering. De foto's bij ophalen zijn het bewijs; zonder foto van die plek staat Breedijk zwak. De
   chauffeur is een mens met een dossier: een schadebeeld per persoon raakt de AVG en de OR. De tegenpartij
   claimt soms schade die er al was; dat patroon wil je zien. En er zijn meer mensen dan de behandelaar:
   de planner (chauffeur toewijzen), de directie (de cijfers), de chauffeur zelf (direct melden met foto),
   de verzekeraar (het dossier compleet), de opdrachtgever (antwoord met bewijs).

## Het werkproces dat de demo volgt

1. **Binnenkomst.** Een mail in de schade-mailbox (of een melding van een chauffeur, of een handmatige
   invoer). De demo "leest" de mail: kenteken, datum, schadeplek, gevraagd bedrag, bijlagen. In het echt
   doet een taalmodel dat via de Claude API; in de demo is het gesimuleerd en staat dat erbij.
2. **Koppelen aan de rit.** Op kenteken en datum zoekt het portaal de rit in Transpas: chauffeur, truck,
   van en naar, positie op de oplegger, de inspectie bij ophalen en bij afleveren (schadecodes en foto's),
   de handtekening met of zonder voorbehoud. Niet gevonden is ook een antwoord: niet door ons vervoerd.
3. **Beoordelen.** Een vaste checklist met signalen die het portaal zelf invult: hebben wij hem vervoerd;
   stond de schade al op de ophaalinspectie; is er bij aflevering getekend zonder voorbehoud; is de claim
   op tijd; hoe verhoudt het bedrag zich tot de limiet per kilogram, de interne drempel en het eigen
   risico; klopt de calculatie (uurtarief, vervangen in plaats van herstellen, dubbele posten). De mens
   beslist.
4. **Besluit en antwoord.** Afwijzen met bewijs, erkennen en zelf betalen, erkennen en indienen bij de
   verzekeraar, tegenvoorstel, of eerst meer informatie vragen. Het portaal schrijft het conceptantwoord
   met de bewijsstukken; de behandelaar leest en verstuurt.
5. **Chauffeur en management.** Elk besluit landt in het dossier van de chauffeur en in de cijfers: per
   chauffeur, per opdrachtgever, per vestiging, per schadeplek, per fase (laden, rijden, lossen, terrein).
   De regel "drie in een week" is een instelling en geeft een signaal, geen oordeel.
6. **Afsluiten.** Betaald, verrekend of geschikt; het dossier is compleet voor de verzekeraar en de
   accountant. Alles staat in een logboek.

## Wat de demo laat zien (weergaven)

| Weergave | Adres | Wat erin zit |
| --- | --- | --- |
| Overzicht | `#overzicht` | Vijf cijfers (nieuw, antwoord over de termijn, open bedrag, erkend dit kwartaal, afgewezen deel), "Wat nu" (deadlines en nieuwe mails), schades per week over twaalf weken, signalen (chauffeur boven de regel, opdrachtgever met veel afgewezen claims) |
| Schades | `#schades`, filters in de URL | De werkvoorraad: kenteken, voertuig, opdrachtgever, ontvangen, bedrag, status, termijn, behandelaar; zoeken op kenteken; filters als chips; csv |
| Dossier | `#schade/S-2026-0412` | Drie kolommen: de melding (mail, uitgelezen velden, bijlagen, calculatie), onze rit (Transpas: rit, chauffeur, inspecties op een autodiagram, foto's, handtekening), de beoordeling (checklist met signalen, besluit, conceptantwoord, logboek). Op een telefoon drie tabbladen |
| Chauffeurs | `#chauffeurs`, `#chauffeur/C-17` | Schades per chauffeur over 30, 90 en 365 dagen, ritten, schades per duizend ritten, het signaal van de regel, de AVG- en OR-noot; per chauffeur een tijdlijn |
| Opdrachtgevers | `#opdrachtgevers`, `#opdrachtgever/K-03` | Claims per opdrachtgever, aandeel afgewezen, gemiddeld bedrag, doorlooptijd, het patroon "claimt schade die al bestond" |
| Rapporten | `#rapporten` | Het maandoverzicht dat de Excel vervangt: aantal, bedragen, uitkomst, per vestiging, per schadeplek, per fase; csv en afdrukken |
| Instellingen | `#instellingen` | Drempel verzekeraar, eigen risico, limiet per kilogram, termijnen, de regel voor het gesprek, koppelingen (mailbox, Transpas, verzekeraar), rol, thema, wat de browser bewaart |

Zoeken in de topbalk: kenteken (met of zonder streepjes), dossiernummer, chauffeur, opdrachtgever.
Toetsen: 1 tot 7 voor de weergaven, / zoeken, n nieuwe melding, Esc sluit.

## Datamodel (de vorm waarin echte data past)

- **Voertuig**: kenteken, merk, handelsbenaming, kleur, datum eerste toelating, massa ledig voertuig,
  catalogusprijs, soort (personenauto, bedrijfsauto). Dezelfde velden als de RDW open data, zodat een echt
  kenteken straks met een verzoek is aangevuld.
- **Rit (Transpas)**: ritnummer, ordernummer, opdrachtgever, ophaaladres en afleveradres (plaats),
  ophaaldatum en -tijd, afleverdatum en -tijd, chauffeur, truck, positie op de oplegger, kilometerstand,
  inspectie bij ophalen en bij afleveren (lijst van schades met gebied, soort, ernst in de opbouw van de
  AIAG/ECG-schadecodes, en foto's met tijdstip), ontvangst getekend (naam van een rol, met of zonder
  voorbehoud en de tekst ervan), vestiging.
- **Schade (claim)**: dossiernummer, bron (mail, chauffeur, handmatig), ontvangen op, afzender
  (opdrachtgever, rol van de contactpersoon, geen persoonsnaam), onderwerp en tekst van de mail,
  bijlagen (foto's, calculatie), uitgelezen velden met zekerheid (kenteken, datum, gebied, bedrag),
  calculatie (regels: arbeid in uren maal tarief, onderdelen, lak en materiaal, btw), gevraagd bedrag,
  gekoppelde rit, beoordeling (checklist), besluit, voorstelbedrag, status, behandelaar, termijn,
  logboek.
- **Chauffeur**: nummer, roepnaam met eerste letter van de achternaam (gesimuleerd), vestiging, in dienst
  sinds, ritten per maand (gesimuleerd), de schades via de dossiers.
- **Opdrachtgever**: nummer, naam (verzonnen), soort (lease, dealer, veiling, importeur), plaats.
- **Instellingen**: drempel verzekeraar (1.750), eigen risico (750), limiet per kilogram (3,40),
  antwoordtermijn (10 werkdagen), meldtermijn tegenpartij (7 dagen na aflevering voor niet zichtbare
  schade; zichtbare schade bij aflevering), regel voor het gesprek (3 schades in 7 dagen, of 3 in 90
  dagen als tweede signaal), uurtarief dat als norm geldt (schatting), rollen.

Elke gesimuleerde waarde draagt zijn status ("gesimuleerd", "schatting") in de interface of in de
README. De getallen van Breedijk uit het gesprek (1.750 en 750 euro, drie in een week) zijn instellingen,
geen aannames in code.

## Ontwerpsysteem

Het ontwerpsysteem van Control Tower 4.0 (demos/simonloos-control-tower/ONTWERP-4.md), zodat de twee
demo's van SafeTail als een familie ogen: Inter of de systeemletter, 13,5 px, tabulaire cijfers, koel
grijs voor vlakken en lijnen, 8-puntsraster, radius 6 en 10, dunne lijnen, schaduw alleen op zwevende
lagen, beweging 160 tot 220 ms en niets bij minder beweging, licht en donker. Het accent is hier een
diep blauw (geen huisstijl van Breedijk zonder hun akkoord; het accent is een token en in een regel te
vervangen). Statuskleuren vast: nieuw blauw, in onderzoek amber, wacht op grijs, erkend groen, afgewezen
rood, bij verzekeraar paars, gesloten grijs. Geen echte foto's: foto's zijn kaartjes met plek, tijd en
een schets van het gebied; het bewijs staat op het autodiagram (ophaalinspectie en claim naast elkaar).

## De lat

Realistisch, zonder uitleg te gebruiken, echt helpend (signaleren, rekenen, voorstellen; de mens
beslist), professioneel naast een verzekeraarsportaal, foutloos (geen consolefouten, geen overloop, geen
dode knoppen, dezelfde toestand na herladen), toegankelijk (toetsenbord, minder beweging), zuinig (een
bestand zonder bibliotheken), en gecontroleerd met Playwright op 1440 en 390 px. Niets gaat naar buiten:
geen verzoek, geen font, geen tegel. Wat de behandelaar doet, blijft in localStorage (`bs-*`).
