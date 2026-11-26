# Code Embed · Handleiding voor de ontwikkelversie

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Versie](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![Licentie](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Een fragment definiëren

Bewaar de gedeelde slotinstructie van meerdere prompts in een notitie met de naam `Sjablonen`. Wijzig je de instructie, dan gebruikt elke prompt bij de volgende kopie de nieuwe tekst.

```xml
<VARIABELE>Geef drie voorbeelden.</VARIABELE>
```

Plaats het volgende blok in een andere notitie. Kies **📋 Copy+** en plak de tekst: `Geef drie voorbeelden.`

```ce
![Sjablonen:<<VARIABELE>>]
```

Zet deze gelijkwaardige definities in aparte notities of sluit de sectie af met een volgende kop van hetzelfde niveau.

```markdown
## Instructies
Antwoord in het $1. Toon: ${2:direct}.
```

```xml
<stijl>Antwoord in het $1. Toon: ${2:direct}.</stijl>
```

## Het fragment invoegen

`![bron:selector(argumenten)]`

Laat de bron weg voor de huidige notitie. Een dubbele punt staat alleen tussen de bron en de selector.

- `![Sjablonen]` — Hele notitie
- `![Sjablonen:3-8]` — Regels inclusief beide grenzen
- `![Sjablonen:#Stijl]` — Sectie met kop
- `![Sjablonen:##Stijl]` — Inhoud van de sectie
- `![Sjablonen:##Hoofdstuk#Stijl]` — Inhoud van de subsectie
- `![Sjablonen:<stijl>]` — Element met beide tags
- `![Sjablonen:<<stijl>>]` — Inhoud van het element
- `![#Stijl]` · `![##Stijl]` — Lokale sectie
- `![<stijl>]` · `![<<stijl>>]` — Lokale tag

## Argumenten doorgeven

Beide aanroepen geven het onderstaande resultaat. `$1`–`$9` kiezen een waarde, `$*` voegt alle waarden samen en `${2:direct}` vervangt een ontbrekende of lege waarde. Zet argumenten met komma’s tussen aanhalingstekens. Geef waarden expliciet door aan geneste insluitingen.

```ce
![##Instructies(Nederlands)]
![<<stijl>>(Nederlands)]
```

```text
Antwoord in het Nederlands. Toon: direct.
```

`![Gedeeld:##Toon($1)]`

## Bekijken en kopiëren

📋 kopieert de uitgewerkte tekst. 👁️ toont het blok of opent een gekoppeld leesvenster voor de notitie. ⚙️ opent de instellingen voor de bloktaal of de notitie. Standaard zijn blokken zonder taal, Markdown, XML en CE geselecteerd.

In een blok vervangt 🔒 verwijzingen zoals `![Sjablonen]` door hun inhoud. Bovenaan de notitie maakt en opent 🔒 een kopie in dezelfde map met uitgewerkte verwijzingen in de tekst en alle blokken. Eigenschappen, inlinecode en de oorspronkelijke notitie blijven behouden.

⚙️ → `[name].perm.[date].v[version].md` → `test.perm.20261206.v1.md`

## Zoeken binnen een pakket

Open het mapmenu met een rechtermuisklik of door de map ingedrukt te houden. Je kunt ook een map kiezen via het opdrachtenpalet. Bevestig het pad van de markering voordat je die verwijdert. Elke gemarkeerde map toont haar kleur en **◆ Hoofdmap**. De standaard uitgeschakelde optie toont **+ Hoofdmap** bij de overige mappen.

**Acties bij alle mappen tonen** — Toont ‘+ Hoofdmap’ bij ongemarkeerde mappen en ‘◆ Hoofdmap’ bij elke hoofdmap van een pakket.

Code Embed volgt de interfacetaal van Obsidian. In de instellingen staan de geïnstalleerde versie, een link naar de Nederlandse handleiding en **Pakketmap kiezen**. Maak voor handmatige markering in de map de notitie `_code-embed-root` (bestandsnaam `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Begin.md
  Gedeeld/
    Stijl.md
```

`Prompts/Begin.md` → `![Gedeeld/Stijl:##Toon]`

De dichtstbijzijnde markering begrenst de volledige uitwerking. Een korte naam moet uniek zijn. Kies bij dubbele namen een pad uit de foutmelding. Paden met een schuine streep beginnen bij de hoofdmap van het pakket. Geneste pakketten staan op zichzelf. Verplaats de map samen met de markering om verwijzingen te behouden.

## De ontwikkelversie installeren

```sh
npm run build
npm test
```

Kopieer `dist/{main.js,manifest.json,styles.css}` naar `.obsidian/plugins/code-embed/`.

Commercieel gebruik is toegestaan. Als je een aangepaste versie verspreidt, voeg dan de licentie toe, behoud de naamsvermelding van Jakub Wajda (JavaMiner) uit NOTICE voor de overgenomen code en markeer gewijzigde bestanden.

[Versies](../../releases) · [Apache 2.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)

## Ondersteuning

Steun de ontwikkeling via [Ko-fi](https://ko-fi.com/x480447). [Support](SUPPORT.md)
