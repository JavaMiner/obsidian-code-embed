# Code Embed · Development version guide

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-CC_BY--NC_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Define a fragment

Keep the closing instruction for several prompts in one note, `Szablony`. Edit it once and the next Copy+ in each prompt picks up the change.

```xml
<ZMIENNA>Podaj trzy przykłady.</ZMIENNA>
```

In another note insert the block below. Tap **Copy+** and paste the result: `Podaj trzy przykłady.` (Give three examples.)

```ce
![Szablony:<<ZMIENNA>>]
```

Put these equivalent definitions in separate notes or end the section with another heading of the same level.

```markdown
## Instrukcje
Odpowiedz po $1. Ton: ${2:rzeczowy}.
```

```xml
<styl>Odpowiedz po $1. Ton: ${2:rzeczowy}.</styl>
```

## Embed it

`![źródło:selektor(argumenty)]`

Omit the source for the current note. Use a colon only between a source and a selector.

- `![Szablony]` — Whole note
- `![Szablony:3-8]` — Inclusive lines
- `![Szablony:#Styl]` — Section with heading
- `![Szablony:##Styl]` — Section body
- `![Szablony:##Rozdział#Styl]` — Subsection body
- `![Szablony:<styl>]` — Tag with delimiters
- `![Szablony:<<styl>>]` — Tag body
- `![#Styl]` · `![##Styl]` — Local section
- `![<styl>]` · `![<<styl>>]` — Local tag

## Pass arguments

Both calls produce the result below. `$1`–`$9` select a value, `$*` joins all values, and `${2:rzeczowy}` supplies a missing or empty value. Quote arguments containing commas. Forward values explicitly to nested imports.

```ce
![##Instrukcje(polsku)]
![<<styl>>(polsku)]
```

```text
Odpowiedz po polsku. Ton: rzeczowy.
```

`![Wspólne:##Ton($1)]`

## Preview and copy

A `ce` or `codeembed` block opens in structured View. Tap View on `md` or `xml` blocks. Copy+ copies the expanded text. The block language controls presentation.

## Limit lookup to a package

Open the folder context menu with a right click or long press, or choose a folder from the command palette. Confirm the marker path when removing a root. Every marked folder always shows its color and **◆ Root**. Enable the setting to show **+ Root** on unmarked folders. It defaults to off.

**Show actions on all folders** — Show “+ Root” on unmarked folders and “◆ Root” on every package root.

Code Embed uses the Obsidian interface language. Its settings show the installed version, a link to the English guide and **Choose package folder**. To mark a folder manually, create a note named `_code-embed-root` inside it (filename `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Start.md
  Wspólne/
    Styl.md
```

`Prompts/Start.md` → `![Wspólne/Styl:##Ton]`

The nearest marker bounds the entire expansion. Short names must be unique. For duplicates, use a path from the diagnostic. Paths with a slash start at the package root. Nested packages are separate. Move the folder with its marker to preserve references.

## Compatibility and migration

Inside code blocks the parser reads all the older forms below. Outside code blocks Obsidian handles native note, heading and image embeds. Rename writes changed embeds in canonical form.

| Legacy | → |
| --- | --- |
| `![[Szablony:##Styl]]` | `![Szablony:##Styl]` |
| `$[##Styl]` | `![##Styl]` |
| `![.:<<styl>>]` | `![<<styl>>]` |
| `![Szablony##Styl]` | `![Szablony:##Styl]` |

## Install the development build

```sh
npm run build
npm test
```

`dist/{main.js,manifest.json,styles.css}` → `.obsidian/plugins/code-embed/`

[Releases](../../releases) · [CC BY-NC 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)
