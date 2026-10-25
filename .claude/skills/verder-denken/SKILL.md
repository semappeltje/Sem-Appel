---
name: verder-denken
description: De kwaliteitsnorm van Sem (25 oktober 2026) voor al het werk in deze repo en voor Simon Loos, Hero en de Control Tower. Gebruik deze skill bij ELKE opdracht van Sem, ook een korte of een losse opmerking bij een schermafbeelding. Lees de vraag drie keer, denk verder dan de prompt, zoek wat hij niet benoemt, toets of hij iets anders bedoelt of dat er iets beters is, bouw voor echte data, en verras hem elke ronde met minstens één onwerkelijk goed idee met bewijs. Geldt ook voor elke brief aan een agent.
---

# Verder denken dan de prompt

Sem, 25 oktober 2026: "Ik wil dat je vanaf nu dit als de kwaliteitsnorm ziet. Verder denken dan een prompt. Kijk
goed wat ik vraag, of eigenlijk juist buiten dat: ik zal veel niet belichten of benoemen. Denk zelf kritisch
verder, of misschien vraag ik iets maar bedoel ik iets anders, of toets me als er iets beters is. Verras me
telkens met onwerkelijk goede ideeën en input." Aanleiding: ik bouwde de planning als een scherm vanuit het
voertuig, terwijl een planner begint bij de ritten die ingevuld moeten worden, de flexibele schil en de
voorkeuren van chauffeurs. Dat had ik zelf moeten zien. Zie `rapporten/simon-loos-control-tower/
planning-visie-en-plan.md` voor de inhoudelijke uitwerking.

## De zes stappen, bij elke opdracht

1. **Lees drie keer.** Eerst letterlijk: wat vraagt hij. Dan het doel: waarom vraagt hij het, voor wie (de
   planner, zijn vader, de directie, een chauffeur), en wat moet het opleveren. Dan het ongezegde: wat hoort er
   in de echte wereld bij dat hij niet noemt (het proces ervoor en erna, de andere gebruikers, de data, het geld,
   de wet, de ochtend van 04:00). Schrijf de drie lezingen op voordat je iets doet.
2. **Domein eerst.** Begin bij het werkproces, niet bij het scherm: wie doet wat, wanneer, met welk systeem,
   met welke data, met welke regels (cao, EU 561/2006, AVG, OR), en wat het kost of oplevert. Vraag je af welke
   systemen bedrijven hiervoor gebruiken (TMS, planning, telematica, tacho, HR, slots, control towers) en wat
   die goed doen. Gebruik de kennis die er is; wacht niet tot Sem het benoemt.
3. **Toets de vraag.** Bedoelt hij iets anders dan hij zegt? Is er iets beters dan wat hij vraagt? Zeg het in
   twee zinnen met de reden, en lever dan toch wat hij vroeg, tenzij het schadelijk is. "Google Maps" betekende
   herkenbaarheid en ware grootte, geen afhankelijkheid van Google. "Een foto van de DAF" betekende dat de app
   voelt als Simon Loos. Benoem wat je las.
4. **Bouw voor echte data.** Elke verzonnen waarde krijgt de vorm waarin echte data hem vervangt (OTM5 voor
   ritten, een bron en een datum voor elk feit, "gesimuleerd" of "schatting" erbij). Zeg per ronde wat er
   nodig is om het met echte data of in een proef te laten draaien.
5. **Verras, met bewijs.** Elke ronde minstens één idee dat hij niet vroeg en niet zou bedenken, geen gimmick:
   met het probleem dat het oplost, een voorbeeld uit een andere sector of een ander systeem, een schatting van
   wat het oplevert, en een goedkope proef. Houd `rapporten/simon-loos-control-tower/ideeenbank.md` bij, zodat
   een idee niet twee keer komt en afgewezen ideeën niet terugkeren.
6. **Rapporteer in de vaste vorm** (hieronder), kort, in de schrijfstijl van de repo: "je", geen accenten,
   geen gedachtestreepjes, geen uitroeptekens, korte zinnen.

## De vaste rapportvorm

- **Wat je vroeg, en hoe ik het las** (de drie lezingen in drie zinnen).
- **Wat ik deed.** Feitelijk, met wat gecontroleerd is en hoe.
- **Waar ik van je vraag afweek, en waarom.** Leeg als er niets is.
- **Wat je niet vroeg, maar waar je iets aan hebt.** Twee tot drie punten, elk met waarde en een proef.
- **Wat we moeten doorvragen** bij de directie, de planners of ICT om verder te kunnen.
- **Wat er nodig is om dit echt te laten draaien** (data, afspraken, techniek), in één alinea.
- **Risico's en signalen** (AVG, OR, octrooi, merk, kosten): alleen als signaal, nooit als juridisch advies.

## Checklists

**Planning (de vier lagen; elke functie hoort ergens):** tactisch (capaciteit, roosters, onderhoud, charters,
zero-emissie), operationeel (ritten binnen, dienstbouw, toewijzen, gaten vullen, publiceren), actueel (volgen,
uitzonderingen, herplannen, docks, wachttijd, uren, overdracht), achteraf (uren en loon, afrekening, KPI's,
leren van gereden tegen gepland). De vraagkant (open ritten, werkvoorraad) komt vóór het planbord.

**Gebruikers:** planner (vroeg, laat, nacht), chauffeur, hal en loods, regiomanager, directie, klant (DC en
winkel), charter en oproepkracht, HR, ICT, OR. Wie mist er in wat je bouwt?

**Systeemlandschap:** bij Simon Loos ORTEC met Navitrans, Trimble FleetXPS met e-CMR, Navision, ORD, Simacan,
Excel; in de sector Transporeon (slots, charters), PTV, Quintiq, Timefold en VROOM (rekenen), Dyflexis en AFAS
(rooster, verzuim), tachograafanalyse, laadplanning. Vraag: welk bestaand systeem doet dit al, wat doen we
beter, hoe koppelen we (OTM5, API, export)?

**Data-gereedheid:** heeft het een bron, een datum, een vorm waarin echte data past, een status (gelezen,
schatting, gesimuleerd)? Kan het straks 1.300 voertuigen, honderdduizend posities per dag en maanden historie
aan?

**Kwaliteit (de lat van ONTWERP-4):** realistisch, gebruiksvriendelijk zonder uitleg, echt helpend (signaleren,
rekenen, voorstellen; de mens beslist), professioneel naast Simacan of Samsara, foutloos (geen consolefouten,
geen overflow, geen dode knoppen, dezelfde toestand na herladen), toegankelijk (toetsenbord, minder beweging,
zonder WebGL), zuinig (de bundel), en gecontroleerd met Playwright en schermafbeeldingen op 1440 en 390 px.

**Mensen en wet, altijd als signaal:** posities en uren zijn persoonsgegevens (AVG, verwerkersovereenkomst,
bewaartermijn); een rij- of prestatiebeeld niet zonder de OR; geen echte namen van personen of concurrenten in
verzonnen data; merken en huisstijl van klanten alleen met akkoord; geen octrooi- of veiligheidsclaims.

## Voor elke brief aan een agent

Zet deze norm in elke opdracht aan een agent: de drie lezingen van de vraag, het werkproces waar de functie in
hoort, de rapportvorm, de eis "voor echte data", en de vraag om minstens één eigen verbetering buiten de opdracht
te melden (niet ongevraagd bouwen, wel voorstellen). De orkestrator leest elk rapport kritisch tegen deze
checklists voordat het naar Sem gaat.
