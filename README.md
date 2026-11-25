# Code Embed · Development version guide

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-CC_BY_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Define a fragment

Keep a closing instruction shared by several prompts in a note named `Templates`. Edit it once, and the next Copy+ in each prompt will use the updated text.

```xml
<VARIABLE>Give three examples.</VARIABLE>
```

Insert the following block in another note. Select **Copy+** and paste the result: `Give three examples.`

```ce
![Templates:<<VARIABLE>>]
```

Put these equivalent definitions in separate notes or end the section with another heading at the same level.

```markdown
## Instructions
Reply in $1. Tone: ${2:direct}.
```

```xml
<style>Reply in $1. Tone: ${2:direct}.</style>
```

## Embed a fragment

`![source:selector(arguments)]`

Omit the source to use the current note. Use a colon only between the source and the selector.

- `![Templates]` — Whole note
- `![Templates:3-8]` — Lines, including both endpoints
- `![Templates:#Style]` — Section with heading
- `![Templates:##Style]` — Section body
- `![Templates:##Chapter#Style]` — Subsection body
- `![Templates:<style>]` — Element including its tags
- `![Templates:<<style>>]` — Element content
- `![#Style]` · `![##Style]` — Local section
- `![<style>]` · `![<<style>>]` — Local tag

## Pass arguments

Both calls produce the result below. `$1`–`$9` select an argument, `$*` joins all arguments, and `${2:direct}` supplies a default when the second argument is missing or empty. Quote arguments containing commas. Pass arguments explicitly to nested embeds.

```ce
![##Instructions(English)]
![<<style>>(English)]
```

```text
Reply in English. Tone: direct.
```

`![Shared:##Tone($1)]`

## Preview and copy

A `ce` or `codeembed` block opens in structured View. Select View on `md` or `xml` blocks. Copy+ copies the expanded text. The block language controls presentation.

## Limit lookup to a package

Open the folder context menu with a right-click or long press, or choose a folder from the command palette. Confirm the marker path when removing a root. A marked folder always shows its color and **◆ Root**. Enable **Show actions on all folders** to show **+ Root** on unmarked folders as well. The setting is off by default.

Code Embed uses the Obsidian interface language. Its settings show the installed version, a link to the English guide, and **Choose package folder**. To mark a folder manually, create a note named `_code-embed-root` inside it (filename `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Start.md
  Shared/
    Style.md
```

`Prompts/Start.md` → `![Shared/Style:##Tone]`

The nearest marker bounds the entire expansion. Short names must be unique. If a name is ambiguous, choose a path from the error message. Paths with a slash start at the package root. Nested packages are separate. Move the folder with its marker to preserve references.

## Compatibility and migration

Inside code blocks the parser recognizes the older forms below. Outside code blocks Obsidian handles native embeds of notes, headings, and images. When renaming, Code Embed writes updated references in canonical form.

| Older syntax | Canonical syntax |
| --- | --- |
| `![[Templates:##Style]]` | `![Templates:##Style]` |
| `$[##Style]` | `![##Style]` |
| `![.:<<style>>]` | `![<<style>>]` |
| `![Templates##Style]` | `![Templates:##Style]` |

## Install the development build

```sh
npm run build
npm test
```

Copy `dist/{main.js,manifest.json,styles.css}` to `.obsidian/plugins/code-embed/`.

Commercial use is permitted. When sharing Code Embed or a modified version, credit Jakub Wajda (JavaMiner), link to the license and indicate any changes you made.

[Releases](../../releases) · [CC BY 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)
