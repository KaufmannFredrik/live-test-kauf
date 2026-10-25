# detfunkernok

To nettsteder under samme tak, hver i sin mappe: **Gutta** (kasino med spill mot AI, festverktøy og ratinger) og
**Fiske** (fiske fra land i Trondheimsfjorden). Forsiden `index.html` er en hvit startside der du velger hvor du skal.
Alt er vanlig HTML, CSS og JavaScript uten byggesteg, så siden fungerer på GitHub Pages og ved å åpne `index.html`
direkte.

```
index.html          startsiden: velg Gutta eller Fiske
gutta/              kasinoet, festverktøyene og ratingene (egen css/ og js/)
fiske/              fiskekalenderen, artene og kartet (egen css/ og js/)
```

De to mappene deler ingen filer. Startsiden henter `fiske/js/felles.js` og `fiske/js/fiskemodell.js` for å vise hva
som er best å fiske akkurat nå.

## Gutta

Alle lyder lages live i nettleseren (Web Audio API), og det finnes ingen lyd- eller bildefiler.

| Side | Hva |
|---|---|
| `gutta/index.html` | Hjem: oversikt over alt |
| `gutta/kasino.html` | Kasino-lobby: lommebok, daglig bonushjul, mammalån, statistikk, prestasjoner, Drikkemodus |
| `gutta/blackjack.html` | Blackjack mot dealeren med 0–3 AI-spillere, fritt spill eller turnering på 10 runder |
| `gutta/rulett.html` | Rulett mot huset: europeisk med la partage, europeisk eller amerikansk hjul |
| `gutta/poker.html` | Texas Hold'em sit & go mot 1–5 AI-spillere |
| `gutta/meyer.html` | Meyer, bløffespill med terninger, mot 1–4 AI-spillere |
| `gutta/olautomat.html` | Ølautomaten, spilleautomat med 5 linjer, wild og gratisspinn |
| `gutta/hva-skal-vi-na.html`, `drikkeregler.html`, `sjekkereplikk.html`, `olsnake.html`, `lyd-bilder.html` | Festverktøy |
| `gutta/ol-ratings.html`, `bar-ratinger.html` | Ratinger av øl og barer |

### Vanskelighetsgrader

- **Blackjack**: Lett = 2 stokker, dealer står på myk 17, fulle AI-er. Middels = 4 stokker, AI-ene spiller perfekt
  basic strategy. Vanskelig = 8 stokker, blackjack betaler 6:5, AI-ene teller kort (Hi-Lo).
- **Rulett**: nivået velger hjulet (husets fordel 1,35 %, 2,70 % eller 5,26 %).
- **Poker**: Lett = «calling stations» som avslører hånden sin. Middels = regner odds mot pottodds.
  Vanskelig = posisjon, bløff, vekting av motstanderens mulige hender og en modell av hvordan du spiller.
- **Meyer**: Lett = godtroende. Middels = regner sannsynligheter. Vanskelig = lærer når du løfter og hvor ofte du lyver.
- **Ølautomaten**: lav, middels eller høy volatilitet. RTP er regnet ut eksakt: 94,8 %, 94,6 % og 93,9 %.

### Gutta-kroner (GK)

Alle kasinospillene deler én lommebok i `localStorage`. GK er lekepenger: de kan ikke kjøpes eller tas ut. Du tjener
GK i kasinoet, i Ølsnake (5 GK per øl), på det daglige bonushjulet og ved å låse opp prestasjoner. Statistikk,
prestasjoner, ratinger og innstillinger lagres også bare lokalt i nettleseren.

### Struktur

```
gutta/css/style.css    felles utseende, meny, lobby
gutta/css/casino.css   felles for spillbordene (kort, sjetonger, AI-seter, dialoger)
gutta/css/<spill>.css  ett ark per spill
gutta/js/common.js     meny, lommebok, statistikk, prestasjoner, lydmotor, toast, Drikkemodus
gutta/js/casino.js     kort, sjetonger, AI-gutta, dialoger, animasjoner, rettferdig tilfeldighet (crypto)
gutta/js/<spill>.js    ett skript per spill
```

Menyen bygges av `SITE_NAV` i `gutta/js/common.js`. En ny side trenger bare `<div id="site-header"></div>` og
`<script src="js/common.js"></script>` nederst i `<body>`, pluss en linje i `SITE_NAV`.

## Fiske

Fiskesidene har sitt eget utseende: et naturhistorisk register fra opplysningstiden, med elfenben og pergament,
sepia, olivengrønt og blekksvart, Cormorant Garamond til titler og latinske navn og Source Sans 3 til tekst og
knapper. Hele designsystemet ligger i `fiske/css/fiske.css`.

| Side | Hva |
|---|---|
| `fiske/index.html` | Tittelside med innhold, dagens art og hva som er best å fiske nå |
| `fiske/kalender.html` | Fiskekalenderen: poeng time for time, planlegging, plassene, regler og ordlisten |
| `fiske/arter.html` | Registeret over de 30 artene, med kobberstikk eller fotografier, systematikk og fakta |
| `fiske/kart.html` | Kart over plassene på sjøkartet, med fredningssonene, dybde og åpent vann |

### Fiskekalenderen

Siden gir poeng fra 0 til 100 til sju fiskemåter. Poengene er bygget som habitatmodellene i fiskeforskningen
(HSI): hver faktor blir et tall fra 0 til 1, og faktorene ganges sammen.

```
Poeng = 100 × Sesong × Lys × Strøm × Vær × Vind × Bølger × Bestand
```

- **Sesong**: månedskalenderen fra fiskeguiden, flyttet etter om sjøtemperaturen er høyere eller lavere enn vanlig.
- **Lys**: solhøyden, glidende fra dagslys til natt. Skyer gjør det mørkere.
- **Strøm**: hvor fort sjøen stiger eller faller, regnet ut fra flo og fjære hos Kartverket.
- **Vær**: nedbør og sterk kulde.
- **Vind**: hvor vanskelig det er å kaste og holde kontakt med redskapen.
- **Bølger**: bølgehøyden på plassen, fra vinden og åpent vann i vindretningen.
- **Bestand**: trekker ned sjøørret.

Lys, strøm og vær vektes ulikt for hver fiskemåte (et vektet geometrisk snitt). Uten varsel brukes vinden målt på
Trondheim – Voll 1991–2020, og uten tidevannstabell snittet over en hel tidevannssyklus, så dager med og uten varsel
kan sammenlignes. «Vanlig» sjøtemperatur er snittet fra MET sin havmodell NorKyst800 2017–2025, for hver plass.

**Plassene** er de seks TOFA beskriver i Trondheim. For hver plass er posisjonen funnet i sjøkartet, og åpent vann i
36 retninger og dybden innen kastavstand er målt i Kartverket sine dybdedata. Med vindretning fra Yr regnes
bølgehøyden ut (Coastal Engineering Manual), og plassene i munningsfredningssonene utenfor Nidelva er merket ut fra
sonekartet til Statsforvalteren. Hele Pir I kan brukes, så der er hver side målt for seg. Sjøtemperaturen hentes for
hver plass fra havvarselet til MET, i modellruta (800 m) nærmest plassen.

I «Planlegg turen» velger du dag, tid, plass, fiskemåte og stang (kastevekt), eller lar siden velge det beste
(«Beste dag» leter gjennom de neste sju dagene). Det som ikke passer valgene, for eksempel en stang som ikke tåler
søkket plassen trenger, vises med en advarsel, men velges aldri som best. Valgene står i adressen, «Del planen» lager
en lenke til selve planen, og stanga huskes i nettleseren. «Fiskeplassene» rangerer alle plassene for tidspunktet,
og hver art lenker til artssiden. Ordlisten (`fiske/js/ordliste.js`) forklarer fiskeordene og forkortelsene.

### Artene

`fiske/js/arter.js` har de 30 artene. Faktaene er fra Store norske leksikon (lysing fra Havforskningsinstituttet,
tangkutling fra MarLIN), og systematikken (klasse, orden, familie og autor) fra WoRMS. Hver art har to bilder fra
Wikimedia Commons, og bryteren «Stikk / Foto» øverst på fiskesidene velger hvilket som vises (huskes i
nettleseren):

- **Kobberstikk** som er falt i det fri: Marcus Elieser Bloch (1783 til 1801), Jonathan Couch (1877) og Jules
  Richard (1907). Navnet på hver plansje er lest av selve stikket, eller fra beskrivelsen på Commons.
- **Fotografier** med fri lisens, med fotograf og lisens under bildet.

Bildene lenkes direkte, så siden har ingen egne bildefiler. Registeret kan ordnes etter gruppene på siden,
systematisk etter orden og familie, eller alfabetisk.

### Kartet

`fiske/kart.html` viser plassene på sjøkartet fra Kartverket (med gråtonekart og topografisk kart som valg),
nummerert fra vest mot øst og farget etter poengene nå. Munningsfredningssonene er tegnet fra kartdataene til
Statsforvalteren (`fiske/js/soner.js`, forenklet til ca. 2 m). For hver plass viser panelet poengene, artene,
dybden fra sjøkartet, en rose med åpent vann i alle retninger og vinden nå, reglene og hva TOFA sier.

### Data

Fiskesidene henter tre ting rett fra nettleseren, uten nøkkel eller server:

- **Timesvarsel fra Yr** (MET Norway, `api.met.no/weatherapi/locationforecast`): vind, skyer, nedbør og temperatur
  for hvert klokkeslett, opptil ca. ni dager frem.
- **Sjøtemperatur og bølger** (MET Norway, `oceanforecast`).
- **Flo og fjære** (Kartverket, `vannstand.kartverket.no/tideapi.php`), én måned om gangen.

Alt lagres i `localStorage`, så varselet bare hentes på nytt når det er over en halvtime gammelt. Du kan også legge
inn været selv eller regne uten vær. Kildene deler data under CC BY 4.0, og sidene krediterer dem i bunnen.

### Struktur

```
fiske/css/fiske.css      designsystemet: farger, skrift, tittellinje, knapper, paneler, tabeller, kart
fiske/css/kalender.css   fiskekalenderen
fiske/css/arter.css      artene
fiske/css/kart.css       kartet
fiske/js/felles.js       lagring, tittellinjen og bryteren mellom kobberstikk og foto
fiske/js/fiskemodell.js  modellen: sol, måne, tidevann, poeng, plassene og henting av vær (uten DOM)
fiske/js/arter.js        artene: fakta, systematikk og bilder
fiske/js/soner.js        munningsfredningssonene
fiske/js/kalender.js     grensesnittet til kalenderen
fiske/js/ordliste.js     ordlisten
fiske/js/artene.js       registeret over artene
fiske/js/kart.js         kartet
```

## Kjøre lokalt

Åpne `index.html` i nettleseren, eller start en enkel server:

```bash
python -m http.server 8000
# åpne http://localhost:8000
```
