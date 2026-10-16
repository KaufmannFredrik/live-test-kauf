# GUTTA.NO

Gutta sin hjemmebane: et kasino med spill mot AI og en samling festverktøy. Alt er vanlig HTML, CSS og JavaScript,
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
