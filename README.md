# GUTTA.NO

Gutta sin hjemmebane: et kasino med spill mot AI, en samling festverktøy og en fiskekalender for Trondheimsfjorden. Alt er vanlig HTML, CSS og JavaScript,
uten byggesteg, så siden fungerer på GitHub Pages og ved å åpne `index.html` direkte. Alle lyder lages live i
nettleseren (Web Audio API), og det finnes ingen lyd- eller bildefiler.

## Innhold

| Side | Hva |
|---|---|
| `index.html` | Hjem: oversikt over alt |
| `kasino.html` | Kasino-lobby: lommebok, daglig bonushjul, mammalån, statistikk, prestasjoner, Drikkemodus |
| `blackjack.html` | Blackjack mot dealeren med 0–3 AI-spillere, fritt spill eller turnering på 10 runder |
| `rulett.html` | Rulett mot huset: europeisk med la partage, europeisk eller amerikansk hjul |
| `poker.html` | Texas Hold'em sit & go mot 1–5 AI-spillere |
| `meyer.html` | Meyer, bløffespill med terninger, mot 1–4 AI-spillere |
| `olautomat.html` | Ølautomaten, spilleautomat med 5 linjer, wild og gratisspinn |
| `hva-skal-vi-na.html`, `drikkeregler.html`, `sjekkereplikk.html`, `olsnake.html`, `lyd-bilder.html` | Festverktøy |
| `ol-ratings.html`, `bar-ratinger.html` | Ratinger av øl og barer |
| `fiskekalender.html` | Fiskekalender for Trondheimsfjorden fra land, med vær fra Yr og flo og fjære fra Kartverket |

## Fiskekalenderen

Siden gir poeng fra 0 til 100 til sju fiskemåter. Poengene er bygget som habitatmodellene i fiskeforskningen
(HSI): hver faktor blir et tall fra 0 til 1, og faktorene ganges sammen.

```
Poeng = 100 × Sesong × Lys × Strøm × Vær × Vind × Bestand
```

- **Sesong**: månedskalenderen fra fiskeguiden, flyttet etter om sjøtemperaturen er høyere eller lavere enn vanlig.
- **Lys**: solhøyden, glidende fra dagslys til natt. Skyer gjør det mørkere.
- **Strøm**: hvor fort sjøen stiger eller faller, regnet ut fra flo og fjære hos Kartverket.
- **Vær**: nedbør og sterk kulde.
- **Vind**: hvor vanskelig det er å kaste og holde kontakt med redskapen.
- **Bestand**: trekker ned sjøørret.

Lys, strøm og vær vektes ulikt for hver fiskemåte (et vektet geometrisk snitt). Uten varsel brukes vinden målt på
Trondheim – Voll 1991–2020, og uten tidevannstabell snittet over en hel tidevannssyklus, så dager med og uten varsel
kan sammenlignes. «Vanlig» sjøtemperatur er snittet fra MET sin havmodell NorKyst800 utenfor Brattøra 2017–2025.

**Plassene** er de seks TOFA beskriver i Trondheim. For hver plass er posisjonen funnet i sjøkartet, og åpent vann i
36 retninger og dybden innen kastavstand er målt i Kartverket sine dybdedata. Med vindretning fra Yr regnes
bølgehøyden ut (Coastal Engineering Manual), og plassene i munningsfredningssonene utenfor Nidelva er merket ut fra
sonekartet til Statsforvalteren. Hele Pir I kan brukes, så der er hver side målt for seg. Sjøtemperaturen hentes for
hver plass fra havvarselet til MET, i modellruta (800 m) nærmest plassen.
I «Planlegg turen» velger du dag, tid, plass, fiskemåte og stang (kastevekt), eller lar siden velge det beste
(«Beste dag» leter gjennom de neste sju dagene). Det som ikke passer valgene, for eksempel en stang som ikke tåler
søkket plassen trenger, vises med en advarsel, men velges aldri som best. Valgene står i adressen, «Del planen» lager
en lenke til selve planen, og stanga huskes i nettleseren. Kartet (Kartverket, via Leaflet) viser plassene farget
etter poengene, og du kan trykke på en plass for å velge den.
«Fiskeplassene» rangerer alle plassene i Trondheim for tidspunktet, med hva du bør fiske med der og hvilke arter
du kan få.
Den henter tre ting rett fra nettleseren, uten nøkkel eller server:

- **Timesvarsel fra Yr** (MET Norway, `api.met.no/weatherapi/locationforecast`): vind, skyer, nedbør og temperatur
  for hvert klokkeslett, opptil ca. ni dager frem.
- **Sjøtemperatur og bølger** (MET Norway, `oceanforecast`).
- **Flo og fjære** (Kartverket, `vannstand.kartverket.no/tideapi.php`), én måned om gangen.

Alt lagres i `localStorage`, så varselet bare hentes på nytt når det er over en halvtime gammelt. Du kan også legge
inn været selv eller regne uten vær. Begge kildene deler data under CC BY 4.0, og siden krediterer dem i bunnen.
Modellen ligger i `js/fiskemodell.js` (uten DOM, og brukes også av forsiden), grensesnittet i `js/fiskekalender.js`.

## Vanskelighetsgrader

- **Blackjack**: Lett = 2 stokker, dealer står på myk 17, fulle AI-er. Middels = 4 stokker, AI-ene spiller perfekt
  basic strategy. Vanskelig = 8 stokker, blackjack betaler 6:5, AI-ene teller kort (Hi-Lo).
- **Rulett**: nivået velger hjulet (husets fordel 1,35 %, 2,70 % eller 5,26 %).
- **Poker**: Lett = «calling stations» som avslører hånden sin. Middels = regner odds mot pottodds.
  Vanskelig = posisjon, bløff, vekting av motstanderens mulige hender og en modell av hvordan du spiller.
- **Meyer**: Lett = godtroende. Middels = regner sannsynligheter. Vanskelig = lærer når du løfter og hvor ofte du lyver.
- **Ølautomaten**: lav, middels eller høy volatilitet. RTP er regnet ut eksakt: 94,8 %, 94,6 % og 93,9 %.

## Gutta-kroner (GK)

Alle kasinospillene deler én lommebok i `localStorage`. GK er lekepenger: de kan ikke kjøpes eller tas ut. Du tjener
GK i kasinoet, i Ølsnake (5 GK per øl), på det daglige bonushjulet og ved å låse opp prestasjoner. Statistikk,
prestasjoner, ratinger og innstillinger lagres også bare lokalt i nettleseren.

## Struktur

```
css/style.css      felles utseende, meny, lobby
css/casino.css     felles for spillbordene (kort, sjetonger, AI-seter, dialoger)
css/<spill>.css    ett ark per spill
js/common.js       meny, lommebok, statistikk, prestasjoner, lydmotor, toast, Drikkemodus
js/casino.js       kort, sjetonger, AI-gutta, dialoger, animasjoner, rettferdig tilfeldighet (crypto)
js/<spill>.js      ett skript per spill
```

Menyen bygges av `SITE_NAV` i `js/common.js`. En ny side trenger bare `<div id="site-header"></div>` og
`<script src="js/common.js"></script>` nederst i `<body>`, pluss en linje i `SITE_NAV`.

## Kjøre lokalt

Åpne `index.html` i nettleseren, eller start en enkel server:

```bash
python -m http.server 8000
# åpne http://localhost:8000
```
