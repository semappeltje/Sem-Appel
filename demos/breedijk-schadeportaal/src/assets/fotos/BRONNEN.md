# Bronnen van de foto's

De foto's in deze map komen van Wikimedia Commons en zijn gebundeld in de demo als voorbeeld: geen foto toont een echte schade uit een dossier, en de koppeling aan een dossier, kenteken of chauffeur is gesimuleerd. Elke foto staat onder een vrije licentie (CC0, publiek domein, CC BY of CC BY-SA); de maker en de licentie staan in de app bij de foto en in dit bestand, en de CC BY-SA-foto's krijgen die naamsvermelding ook, met een link naar de licentie.

Verkleind naar WebP (voertuigen en overzichten 640 px, schades 560 px breed) door `tools/fotos.mjs`; verder niet bewerkt.

## Voertuigen (`auto/`)

| Bestand | Titel op Commons | Maker | Licentie | Link |
| --- | --- | --- | --- | --- |
| `auto/volkswagen-polo.webp` | 2018 Volkswagen Polo SE 1.0 Front.jpg | Vauxford | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:2018_Volkswagen_Polo_SE_1.0_Front.jpg) |
| `auto/volkswagen-golf.webp` | 2020 Volkswagen Golf Style 1.5 Front.jpg | Vauxford | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:2020_Volkswagen_Golf_Style_1.5_Front.jpg) |
| `auto/volkswagen-id3.webp` | 2020 Volkswagen ID.3 1st Front.jpg | Vauxford | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:2020_Volkswagen_ID.3_1st_Front.jpg) |
| `auto/toyota-yaris.webp` | Toyota Yaris Hybrid (XP210) 1X7A0354.jpg | Alexander Migl | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:Toyota_Yaris_Hybrid_(XP210)_1X7A0354.jpg) |
| `auto/toyota-corolla.webp` | Toyota Corolla Hybrid no lago das Pontes de García Rodríguez eue-001.jpg | Lmbuga (Luis Miguel Bugallo Sánchez) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:Toyota_Corolla_Hybrid_no_lago_das_Pontes_de_Garc%C3%ADa_Rodr%C3%ADguez_eue-001.jpg) |
| `auto/kia-niro.webp` | Kia Niro (SG2) PHEV Leonberg 2022 1X7A0474.jpg | Alexander Migl | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:Kia_Niro_(SG2)_PHEV_Leonberg_2022_1X7A0474.jpg) |
| `auto/kia-picanto.webp` | 2017 Kia Picanto GT-Line S 1.2 Front.jpg | Vauxford | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:2017_Kia_Picanto_GT-Line_S_1.2_Front.jpg) |

## Schades (`schade/`)

Nog geen; zie "Nog te zoeken".

## Overzichten bij ophalen (`overzicht/`)

Nog geen; zie "Nog te zoeken".

## Nog te zoeken

- Voertuigen (23): Peugeot 208, Peugeot 2008, Renault Clio, Opel Corsa, Ford Focus, Ford Transit Custom, Volkswagen Transporter, Mercedes-Benz Vito, Tesla Model 3, Tesla Model Y, Hyundai Kona, Skoda Octavia, BMW 3-serie, Audi A3, Volvo XC40, Mercedes-Benz A-klasse, Fiat 500, Mini Cooper, Nissan Qashqai, Lynk & Co 01, Polestar 2, Renault Kangoo, Citroën C3.
- Schades: 0 van minstens 14 (kras, schaafplek, deuk, stoeprand op een velg, steenslag of barst in een ruit, spiegel, lakschade, achterklep, dorpel, motorkap).
- Overzichten bij ophalen: 0 van 4 tot 8 (voorhoek, achterhoek, zijkant, zonder schade).

Zoeken: `node tools/fotos.mjs zoek <auto|schade|overzicht> <cachemap>`, de contactvellen bekijken, de keuze in `SELECTIE` zetten en `node tools/fotos.mjs bouw <cachemap>` draaien. Commons laat vanaf een gedeeld adres weinig verzoeken per minuut toe; het script wacht en volgt Retry-After.
