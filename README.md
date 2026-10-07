# Vilket väder

Väderapp byggd i ren HTML, CSS och JavaScript – utan ramverk, byggsteg eller API-nycklar.
Visar vädret just nu, timme för timme och sju dagar framåt för valfri ort i världen.

> Version 2 (2026) är en total omskrivning av skolprojektet från 2023. Den gamla
> versionen slutade fungera när OpenWeatherMap-nyckeln gick ut; den nya använder
> [Open-Meteo](https://open-meteo.com) som är gratis och nyckelfritt.

## Funktioner

- **Ortsök med autocomplete** – skriv några bokstäver, välj med piltangenter eller tryck. Svenska orter sorteras först.
- **Min position** – en knapp hämtar din plats och slår upp ortnamnet (OpenStreetMap).
- **Just nu** – temperatur, väderbeskrivning, känns som, vind (riktning, styrka i ord, byar), luftfuktighet, nederbörd, UV-index, soluppgång/solnedgång.
- **Kommande 24 timmar** – scrollbar rad med ikon, temperatur och regnchans.
- **Sju dagar** – lägsta/högsta med temperaturstapel färgad efter kallt → varmt.
- **Favoriter** – spara orter med stjärnan, byt snabbt via chips. Sparas i webbläsaren.
- **Mörkt/ljust tema** – följer systemet, kan växlas manuellt. Bakgrunden skiftar färg efter vädret och tid på dygnet.
- **°C / °F**.
- **Tre designer att jämföra** – välj **Claude Code · Original**, **Astra · Ny design** eller **Grok · Observatorium** ovanför prognosen. Originalet är förvalt; ditt val sparas. Växlingen behåller ort, prognos, favoriter, temperaturenhet och ljust/mörkt tema. Astra har en separat stilmall med skogsgrönt, varmvit bakgrund, landskapsillustration och en annan layout. Grok är ett mörkt observatorium: himlen ritas om efter vädret, temperaturen står i en antikva, och prognosen får en temperaturkurva och en solbåge. `?design=grok` (eller `astra` / `claude`) visar den designen utan att skriva över ett sparat val.
- **Installerbar app (PWA)** med egen ikon, fungerar offline med senast hämtade prognos.
- Kommer ihåg senast visade ort. Uppdaterar automatiskt var 15:e minut.

## Kör lokalt

Appen är statisk men använder ES-moduler, så den måste serveras över HTTP (inte öppnas som `file://`):

```bash
python3 -m http.server 8000
# öppna http://localhost:8000
```

Eller vilken statisk server som helst (`npx serve`, VS Code Live Server, GitHub Pages…).

## Mappstruktur

```
index.html               Sidans struktur
manifest.webmanifest     PWA-manifest (namn, ikoner, färger)
sw.js                    Service worker – offline-cache
assets/
  css/style.css          Designtokens, teman, vädergradienter, layout
  css/astra.css          Isolerad Astra-design och gemensam designväljare
  css/grok.css           Isolerad Grok-design (observatorium)
  js/design.js           Designbyte och sparat designval
  js/app.js              Huvudlogik: tillstånd, händelser, rendering
  js/api.js              Open-Meteo (väder + ortsök) och omvänd geokodning
  js/weather-codes.js    WMO-väderkod → svensk text, ikon, tema
  js/icons.js            Animerade SVG-väderikoner
  js/format.js           Svenska datum, vindriktning, UV-nivå m.m.
  js/storage.js          Favoriter, senaste ort, inställningar (localStorage)
  icons/                 App-ikon (SVG + PNG i alla storlekar)
scripts/build-icons.py   Genererar PNG-ikonerna från icon.svg
```

## Datakällor

| Vad | Tjänst | Nyckel |
|---|---|---|
| Prognos | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | Nej |
| Ortsök | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | Nej |
| Position → ort | [Nominatim](https://nominatim.org/release-docs/latest/api/Reverse/) (reserv: BigDataCloud) | Nej |

Open-Meteo tillåter 10 000 anrop per dag för icke-kommersiellt bruk. Tider levereras i ortens lokala tid.

## Byta app-ikon

Redigera `assets/icons/icon.svg` och kör:

```bash
python3 scripts/build-icons.py     # kräver Pillow (pip3 install pillow) och Chrome
```

## Driftsättning

Lägg filerna på valfri statisk host. Alla sökvägar är relativa, så appen fungerar
även under en undermapp (t.ex. GitHub Pages på `/LAStudioWeatherAppJS/`).
Bumpa `VERSION` i `sw.js` vid varje deploy så att gamla cachar rensas.

## Tekniska val

- **Inga beroenden.** Inget npm, ingen bundler, inga ramverk – bara moderna webbstandarder
  (ES-moduler, `fetch`, `Intl`, CSS `@property`, `color-mix`, `backdrop-filter`).
- **Open-Meteo i stället för OpenWeatherMap** – ingen nyckel att läcka eller förnya, HTTPS och CORS ur lådan.
- **Ikoner ritas i kod** i stället för att laddas som bilder: skalbara, temaanpassade och animerade.
- **Glasdesign på vädergradient.** Färgerna byts mjukt via registrerade CSS-variabler.
- **Tillgänglighet:** semantisk HTML, ARIA på sökfältet (combobox/listbox), tangentbordsnavigering, `prefers-reduced-motion`.
