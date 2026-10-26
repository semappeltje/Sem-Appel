# Assistent: de serverfunctie van de Control Tower-demo

`assistent.mts` laat de Assistent van de demo echt antwoorden: op een vraag van de planner, met de ochtendbriefing en
met de overdracht aan de volgende planner. De app stuurt een samenvatting van de gesimuleerde dag. De functie haalt
er namen en contactgegevens uit, roept een keer de Claude API van Anthropic aan en controleert het antwoord voor het
teruggaat. Het contract voor de app (verzoek en antwoord) staat bovenin `assistent.mts`.

Alle gegevens van de demo zijn gesimuleerd. De assistent signaleert, rekent en stelt voor; de planner beslist.

## Op de demosite zetten (voor de websitesessie)

De demo draait op controltower-demo.netlify.app, uit de demo-repo met `public/index.html` en
`netlify/edge-functions/gate.ts`.

0. Zet `dist/demosite.html` (uit `npm run build` in deze map) als `public/index.html` in de demo-repo. Die heeft
   `data-ai="/api/assistent"` al op de root (zonder dat attribuut doet de app geen enkel verzoek en geeft de
   Assistent de vaste antwoorden) en `data-basiskaart="online"` (de demosite opent met OpenStreetMap).
1. Kopieer `netlify/functions/assistent.mts` uit deze map naar dezelfde plek in de demo-repo:
   `netlify/functions/assistent.mts`, naast `netlify/edge-functions/gate.ts`. Er is geen `npm install` en geen
   build-stap nodig: het bestand heeft geen dependencies en geen imports. Netlify bundelt het zelf en draait het op
   Node (22 of nieuwer). Het pad zit in het bestand: `export const config = { path: '/api/assistent' }`.
2. Controleer dat de gate ook `/api/assistent` afschermt. Kijk in `gate.ts` naar `export const config`: met
   `path: '/*'` en geen `excludedPath` voor `/api` is het goed. Valt `/api/*` buiten de gate, dan kan iedereen met
   de URL de functie aanroepen en betaal jij voor die vragen. De functie controleert de login daarom ook zelf: de
   Authorization-header (Basic) tegen `DEMO_LOGINS`, dezelfde variabele als de gate. Zonder login geeft hij een 401,
   ook aan curl; zonder `DEMO_LOGINS` in zijn eigen omgeving weigert hij alles (500). De gate blijft de eerste deur;
   door de eigen controle maakt het niet uit of de gate ook `/.netlify/functions/assistent` dekt.
3. Omgevingsvariabelen in Netlify (project controltower-demo, Project configuration, Environment variables):
   - `ANTHROPIC_API_KEY` staat er al. Controleer dat de scope Functions aanstaat.
   - `DEMO_LOGINS` staat er al voor de gate. De functie leest dezelfde variabele: geef hem ook de scope Functions,
     anders antwoordt de functie met een 500 "DEMO_LOGINS ontbreekt". De waarde zelf blijft waar hij is; zet hem
     nergens anders neer.
   - `ASSISTENT_MODEL` is optioneel en niet geheim. Zonder deze variabele is het `claude-sonnet-5-5`
     (zie "Een ander model").
   - `ASSISTENT_REM` is optioneel en niet geheim: de rem per IP-adres per uur, een geheel getal van 1 tot 1000.
     Zonder is het 20 (zie "De rem").
   Een nieuwe of gewijzigde waarde werkt pas na een nieuwe deploy.
4. Deploy (een push, of Deploys, Trigger deploy). De functie staat daarna onder Logs, Functions als `assistent`.
5. Test met curl, zoals hieronder: eerst een 405, een 401 en een 400 (die kosten niets), dan een echte vraag met
   je login.

Niet nodig: een regel in `netlify.toml`, een redirect of CORS-headers. De app roept de functie aan op dezelfde site.

## Testen

Zonder API en zonder sleutel, in de map van de demo:

```sh
node tests/assistent-check.mjs
```

Dat vraagt Node 22.18 of nieuwer (met een oudere 22: `node --experimental-strip-types tests/assistent-check.mjs`).
De check laadt de functie met een nagebootste fetch en controleert onder meer: de grenzen van de body (400, 403,
405), de sleutel (500), de rem (de 31e aanroep is een 429), dat er geen naam, telefoonnummer of e-mailadres in de
prompt komt, de vorm van de aanroep (model, max_tokens, effort, schema, geen temperature), de drie soorten, de Let
op-regels en elke fout van de AI-dienst (502, 503, 504). Er gaat niets naar buiten.

Op de demosite, na de deploy, met een login uit `DEMO_LOGINS` (`-u`): de gate en de functie vragen er allebei om.
Typ de login in je terminal; zet hem nergens in een bestand of een chat.

```sh
ADRES=https://controltower-demo.netlify.app/api/assistent
LOGIN='naam:wachtwoord'

# 405: alleen POST
curl -sS -i "$ADRES" | head -1

# 401: zonder login, ook met curl
curl -sS -X POST "$ADRES" -H 'Content-Type: application/json' -d ''

# 400 met een leesbare fout: een lege body
curl -sS -u "$LOGIN" -X POST "$ADRES" -H 'Content-Type: application/json' -d ''

# Een echte vraag (kost ongeveer een dollarcent)
curl -sS -u "$LOGIN" -X POST "$ADRES" -H 'Content-Type: application/json' -d '{
  "soort": "vraag",
  "vraag": "Welke ritten halen hun venster niet, en wat stel je voor?",
  "dag": {
    "tijd": "07:40", "standplaats": "Wognum", "rol": "planner",
    "zaken": [{ "id": "Z-1", "soort": "Vertraging", "ernst": "hoog", "object": "T-1112",
                "tekst": "AH Hoorn: ETA 08:20, venster tot 08:00 (+20 min)", "sinds": "07:31", "status": "nieuw" }],
    "openRitten": [{ "id": "R-10448", "klant": "Albert Heijn", "venster": "14:00-15:00", "duur": 310,
                     "oplegger": "koel", "reden": "ziek", "urgentie": "hoog", "prognose": 0.62 }],
    "kandidaten": { "R-10448": [{ "soort": "eigen", "id": "P-0417", "naam": "Fatima el Idrissi",
                                  "score": 0.86, "redenen": ["op tijd"], "kosten": 0 }] },
    "personen": [{ "nummer": "P-0417", "naam": "Fatima el Idrissi" }]
  }
}'
```

De briefing en de overdracht gaan hetzelfde, met `"soort": "briefing"` of `"soort": "overdracht"` en zonder vraag.
Een goed antwoord is `200 { "ok": true, "antwoord": "...", "acties": [...], "letOp": [...], ... }`; in het antwoord
staat P-0417, niet de naam.

## Wat naar Anthropic gaat, en wat niet

Gaat mee:
- de systeemprompt: de rol, de huisregels en uitleg bij de velden;
- de schone dag: tijd, datum, standplaats, rol, cijfers, zaken, open ritten, kandidaten, wachttijd, rijtijd, laden,
  overdracht en gebeurtenissen, met nummers in plaats van namen;
- bij een vraag: de vraag, met dezelfde vervanging.

Gaat nooit mee:
- namen van personen. Elke naam wordt het nummer van de persoon of het voertuig (T-1234, P-0412, PL-003), of een
  pseudoniem als "collega 1" of "oproepkracht 1". De lijst `personen` is de sleutel en blijft in de functie;
- telefoonnummers en e-mailadressen (in tekst `[telefoonnummer]` en `[e-mailadres]`), en velden als telefoon,
  email, adres, bsn en iban;
- velden die de functie niet kent;
- het IP-adres, cookies, de login (de Authorization-header) en alles van de gate.

De grens: een naam die nergens in de dag staat, herkent de functie in vrije tekst niet. De app zet daarom iedereen
die in de dag of in de vraag voorkomt in `personen`, met zijn nummer. Het antwoord bevat nummers; de app zet die
terug in een naam als hij dat wil.

## Wat er bewaard wordt

Niets van de kijker. De functie heeft geen opslag: geen vraag, geen antwoord, geen dag, geen IP-adres en geen
login blijft ergens achter. In de log van Netlify staat per aanroep alleen de soort, het model, de tokens, de duur
en de uitkomst. Wat Anthropic met API-verkeer doet, staat in zijn voorwaarden (zie "Wat er nodig is voor echte
data").

## De rem

20 aanroepen per uur per IP-adres, geteld in het geheugen van de functie. Bij de 21e: een 429 met `{ fout }` en
`Retry-After` in seconden. `ASSISTENT_REM` zet een andere grens (1 tot 1000), bijvoorbeeld 60 voor een demodag met
meer kijkers achter het IP-adres van één kantoor; een nieuwe waarde werkt na een deploy. Netlify kan meer instanties tegelijk draaien en begint na een pauze met een lege teller.
Het is dus een rem op ongelukken (een knop die blijft hangen, een lus in de app), geen budget. Het budget is de
bestedingslimiet in de Anthropic Console: zet die op een bedrag dat bij een demo past, bijvoorbeeld $10 per maand.

## Kosten (schatting)

Prijs van `claude-sonnet-5-5` (Anthropic, oktober 2026): $2 per miljoen tokens in, $10 per miljoen tokens uit.
De tokens zijn geschat op 3 tekens per token; de echte aantallen staan per aanroep in de log.

| | In | Uit | Kosten per aanroep |
|---|---|---|---|
| Dag van 5 KB | ongeveer 3.200 tokens (de systeemprompt is 1.300) | 400 tot 900 tokens | $0,01 tot $0,02 |
| Dag van 15 KB | ongeveer 5.600 tokens | 400 tot 900 tokens | $0,015 tot $0,02 |
| Volle dag (alle lijsten op hun maximum, 31 KB) | ongeveer 9.000 tokens | hoogstens 1.500 | hoogstens $0,035 |

Een aanroep kost dus ongeveer 1 tot 3 dollarcent. De rem houdt een IP-adres op hoogstens ongeveer $1 per uur. Een
drukke demomaand met 400 aanroepen kost $5 tot $10. De Console toont de echte kosten.

## Een ander model

Zet `ASSISTENT_MODEL` (scope Functions) en deploy opnieuw.

- `claude-sonnet-5-5` (standaard): uitgebreid denken staat uit (`thinking: between_tools`, de laagste stand van dit
  model), dus de 1.500 tokens zijn helemaal voor het antwoord en het komt snel.
- Een model dat altijd mee denkt, zoals `claude-opus-5-5` ($4 en $20 per miljoen tokens): de functie stuurt dan geen
  `between_tools` (alleen Sonnet 5.5 kent het) en geeft 4.000 tokens extra ruimte om te denken. Trager en duurder;
  soms beter bij een lastige vraag.
- Alleen `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-opus-5` en `claude-fable-5-1` krijgen de fallback van de
  API (`fallbacks: "default"`): weigeren de veiligheidsfilters een verzoek, dan antwoordt een ander model.
- Het model moet structured outputs kennen. Zo niet, dan geeft de API een 400 en de functie een 502.

## Foutmeldingen en wat je doet

| Status | Melding (begin) | Wat je doet |
|---|---|---|
| 400 | "De body is leeg", "dag.zaken: hoogstens 30", "De dag is te groot" | De app stuurt iets verkeerd of te veel; de melding zegt wat |
| 403 | "De assistent werkt alleen vanuit de Control Tower op deze site" | Een andere site riep de functie aan; zo hoort het |
| 401 | "Log eerst in op de demosite" | De login van de demosite zit niet op het verzoek: de browser stuurt hem mee zodra de gate erom vroeg (de pagina herladen); met curl `-u` |
| 405 | "Gebruik POST" | Alleen POST |
| 429 | "Je hebt het maximum van 20 vragen per uur bereikt" | Wachten tot de tijd in de melding, of `ASSISTENT_REM` hoger zetten |
| 500 | "ANTHROPIC_API_KEY ontbreekt" | Stap 3 hierboven, daarna opnieuw deployen |
| 500 | "DEMO_LOGINS ontbreekt" | De variabele van de gate ook de scope Functions geven, daarna opnieuw deployen |
| 500 | "ASSISTENT_MODEL is geen geldige modelnaam" | De variabele verbeteren of weghalen |
| 502 | "De AI-dienst weigert de sleutel" | De sleutel is fout of ingetrokken: een nieuwe in de Console |
| 502 | "voldeed niet aan de regels (vorm of lengte)" | Opnieuw proberen; de log zegt welk veld (zonder inhoud) |
| 502 | "De AI-dienst gaf een fout (status 400)" | Vaak het model: kent het structured outputs? |
| 503 | "zit aan zijn limiet" | Bestedingslimiet of rate limit in de Console |
| 503 | "even overbelast" | Over een minuut opnieuw |
| 504 | "De AI deed er te lang over" | Opnieuw; na 45 seconden stopt de functie (Netlify stopt bij 60) |

De log (Netlify, Logs, Functions, `assistent`) heeft per aanroep een regel: `fn`, `soort`, `model`, `tokens_in`,
`tokens_uit`, `ms` en `uitkomst`, bij een fallback `fallback: true` en bij een afgekeurd antwoord de velden die
fout waren. Nooit de dag, de vraag, het antwoord of het IP-adres.

## Voor de app

- `fetch('/api/assistent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })` op dezelfde
  site. Het contract staat bovenin `assistent.mts`.
- Roep de assistent alleen aan op een klik van de planner, nooit bij elke render of elke tik van de klok: elke
  aanroep kost geld en telt mee voor de rem. Toon dat de assistent bezig is; een antwoord duurt een paar seconden
  (schatting).
- Stuur de belangrijkste zaken en open ritten (hoogstens 30, op ernst of urgentie); een langere lijst geeft een 400.
- Zet in `personen` iedereen die in de dag of in de vraag voorkomt, met zijn nummer. Haal de vraag van de planner
  langs je eigen lijst met namen voordat je hem stuurt.
- Toon het antwoord als tekst (`textContent`), nooit als HTML: het komt van een AI.
- Toon `letOp` altijd, en bij de assistent dat de gegevens gesimuleerd zijn.
- Een fout heeft altijd `{ ok: false, fout }`: toon `fout`. Valt de functie weg (404 in SafeTools, waar hij niet
  staat), val dan terug op de vaste antwoorden die de app nu heeft. Een 401 betekent dat de login van de demosite
  niet op het verzoek zat: de pagina herladen zet hem terug.

## Over de keuzes

- Geen `temperature`: `claude-sonnet-5-5` weigert een andere waarde dan de standaard met een 400, en vanaf
  API-versie 2026-10-21 bestaat het veld niet meer. Korte en rustige antwoorden komen van `effort: low`, het
  JSON-schema en de controle in de functie.
- `anthropic-version: 2023-06-01`. Naar `2026-10-21` kan zonder andere wijziging: de functie stuurt geen temperature,
  geen documenten en geen citaten.
- Het antwoord is gedwongen in een JSON-schema (structured outputs); de functie controleert vorm, aantallen en
  woorden nog eens. Een fout antwoord is een 502 en wordt nooit half getoond.
- De Let op-regels van de functie: een bedrag zonder "schatting" (een bedrag dat letterlijk in de gegevens staat
  telt niet), een claim als "gegarandeerd" of "bewezen" (niet als er "niet" of "geen" voor staat), een nummer dat
  niet in de dag staat (een verzonnen voertuig of rit), en contactgegevens.

## Wat er nodig is voor echte data

Met echte namen, posities en uren is dit een verwerking van persoonsgegevens. Signalen, geen juridisch advies:
een verwerkersovereenkomst met Anthropic en met de host; de bewaartermijn van API-verkeer in de voorwaarden van
Anthropic nakijken; een AVG-toets en de OR bij alles wat een beeld van een chauffeur geeft; de functie en de hosting
in de EU (Netlify Functions draaien standaard in de VS, regio cmh; een EU-regio kan op een betaald plan); een inlog
per gebruiker in plaats van een gedeelde gate, met de rem per gebruiker; en de nummers uit het TMS, zodat `personen`
uit de bron komt en niet uit de app.
