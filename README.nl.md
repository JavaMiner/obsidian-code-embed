# Code Embed · Handleiding voor de ontwikkelversie

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-CC_BY--NC_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Een fragment definiëren

Kies **Insert XML tag** of **Insert Markdown section** in het opdrachtenpalet. Vul een naam in en tik op OK. Zonder naam krijg je een `var`-tagpaar of wordt `Nazwa fragmentu` geselecteerd om te vervangen. Geselecteerde tekst vormt de inhoud. Bevestig `_xvar` of `_mvar` met **Expand shortcut**.

Zet deze gelijkwaardige definities in aparte notities of sluit de sectie af met een volgende kop van hetzelfde niveau.

```markdown
## Instrukcje
Odpowiedz po $1. Ton: ${2:rzeczowy}.
```

```xml
<styl>Odpowiedz po $1. Ton: ${2:rzeczowy}.</styl>
```

## Het fragment invoegen

`![źródło:selektor(argumenty)]`

Laat de bron weg voor de huidige notitie. Een dubbele punt staat alleen tussen de bron en de selector.

- `![Szablony]` — Hele notitie
- `![Szablony:3-8]` — Regels inclusief grenzen
- `![Szablony:#Styl]` — Sectie met kop
- `![Szablony:##Styl]` — Sectie-inhoud
- `![Szablony:##Rozdział#Styl]` — Inhoud van de subsectie
- `![Szablony:<styl>]` — Tag met beide markeringen
- `![Szablony:<<styl>>]` — Inhoud van de tag
- `![#Styl]` · `![##Styl]` — Lokale sectie
- `![<styl>]` · `![<<styl>>]` — Lokale tag

## Argumenten doorgeven

Beide aanroepen geven onderstaand resultaat. `$1`–`$9` kiezen een waarde, `$*` voegt alle waarden samen en `${2:rzeczowy}` vervangt een ontbrekende of lege waarde. Zet argumenten met komma’s tussen aanhalingstekens. Geef waarden expliciet door aan geneste imports.

```ce
![##Instrukcje(polsku)]
![<<styl>>(polsku)]
```

```text
Odpowiedz po polsku. Ton: rzeczowy.
```

`![Wspólne:##Ton($1)]`

## Bekijken en kopiëren

`ce` en `codeembed` tonen de structuur. Tik bij `md` of `xml` op View. Copy+ kopieert de uitgewerkte tekst. De bloktaal bepaalt de weergave.

## Zoeken binnen een pakket

Tik op **+ Root** of **◆ Root** naast de map, houd de map ingedrukt voor het menu of kies een map in het opdrachtenpalet. Tik op de naam om de map uit te klappen. Markeren maakt onderstaand bestand aan. Bevestig het pad om de markering te verwijderen.

```text
Prompts/
  _code-embed-root.md
  Start.md
  Wspólne/
    Styl.md
```

`Prompts/Start.md` → `![Wspólne/Styl:##Ton]`

De dichtstbijzijnde markering begrenst de volledige uitwerking. Een korte naam moet uniek zijn. Kies bij dubbele namen een pad uit de foutmelding. Paden met een schuine streep beginnen bij de pakketmap. Geneste pakketten staan op zichzelf. Verplaats de map samen met de markering om verwijzingen te behouden.

## Compatibiliteit en migratie

In codeblokken leest de parser alle onderstaande oudere vormen. Daarbuiten verwerkt Obsidian zelf de ingebouwde insluitingen van notities, koppen en afbeeldingen. Rename schrijft gewijzigde insluitingen in de canonieke vorm.

| Legacy | → |
| --- | --- |
| `![[Szablony:##Styl]]` | `![Szablony:##Styl]` |
| `$[##Styl]` | `![##Styl]` |
| `![.:<<styl>>]` | `![<<styl>>]` |
| `![Szablony##Styl]` | `![Szablony:##Styl]` |

## De ontwikkelversie installeren

```sh
npm run build
npm test
```

`dist/{main.js,manifest.json,styles.css}` → `.obsidian/plugins/code-embed/`

[Releases](../../releases) · [CC BY-NC 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363)
