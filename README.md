# Code Embed for Obsidian

New syntax on `main`: `![x]` embeds a note, `![<tag>]` the local tag, `![<<tag>>]` its contents, `![#Heading]` a local section with its heading, and `![##Heading]` its body. `$#Heading` is not embed syntax. `![[x]]` is native Obsidian notation.

[Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Nederlands](README.nl.md) · [Italiano](README.it.md) · [Revolut](https://revolut.me/jakubwt6)

[Polski](README.pl.md) · [Releases](../../releases) · [Buy me a coffee (Wise)](https://wise.com/pay/me/jakubw238)

Assemble prompts from reusable note fragments instead of copying the same instructions into several notes. Copy+ copies the expanded block; View lets you inspect its structure without changing the source.

## Installation

Download `main.js`, `manifest.json`, and `styles.css` from a release. Copy them to `.obsidian/plugins/code-embed/` inside your vault and enable Code Embed in Community plugins. To build locally, run `npm run build` and `npm test`, then use the files in `dist/`.

## Embed reference

| Syntax | Result |
| --- | --- |
| `![Notes]` | Whole note, without frontmatter |
| `![Notes:#Rules]` | Section including its heading |
| `![Notes:##Rules]` | Section body only |
| `![Notes:##Chapter#Rules]` | Nested section body |
| `![Notes:1-100]` | Lines 1–100, inclusive |
| `![Notes:5-]` | Line 5 through the end |
| `![Notes:1--1]` | All but the last line |
| `![Notes:<rules>]` | All lines from opening to closing tag |
| `![Notes:<<rules>>]` | Inner tag content |
| `![.:<<rules>>]` | Local tag content |

- Note names resolve like Obsidian links. Prefer unique basenames to full paths. A whole-note alias after `|` is ignored; do not use `|` in ranges. Line numbers start at 1, include frontmatter, and must be within the file.
- H1–H6 headings use the first case-insensitive match. Asterisks, underscores and backticks are ignored. A section ends at the next heading of the same or higher level. Avoid `#`, `(`, and `^` in a section name; block IDs are not supported.
- Tag extraction requires the exact `<tag>` opener without attributes and a matching `</tag>`. The first occurrence wins. Tag names use ASCII letters, digits, `_`, `:`, `.`, and `-`. Inner extraction removes one leading and one trailing newline and trims single-line values.
- `.` checks the current code block before the note. Embeds can nest up to 5 levels by default. Cycles, missing targets, invalid ranges and depth errors appear as `[błąd: …]`. A backslash before an embed makes it literal.

## Arguments

In `Snippets.md`, define `<rating>topic: $1; rating: ${2:good}</rating>`. `![Snippets:<<rating>>(recovery)]` expands to `topic: recovery; rating: good`.

- `$1`–`$9` are positional; `$*` joins arguments with `, `. `${n:text}` supplies a value for a missing or empty argument; its text cannot contain `}`.
- Use commas between arguments. `![Snippets:<<rating>>(recovery, "good, but variable")]` passes two arguments. Double quotes or backticks group values and are removed; quote escaping is not supported.
- Without parentheses, only defaults are substituted. A missing `$3` without a default stays literal. `\$` gives a literal dollar when the call has parentheses, including `()`.
- Arguments work on tags and sections, not whole notes or line ranges. Forward a value to another fragment with `![Other:<<tag>>($1)]`.

## Preview, navigation and rename

- `ce` and `codeembed` start in structured View with Copy+ only. `xml`, `md`, and `markdown` show regular code with a separate View button. Live Preview shows the reference again while you edit its line. Short single-line imports can display as compact chips; set the threshold to 0 to disable this.
- The Code Embed panel reports broken references and shows incoming and outgoing references. Panels can show nested dependencies or only direct references and can take you to the relevant source.
- Rename commands update supported references after changing a note, XML tag, or heading. You can rename a target at the cursor and convert a tag to a heading or vice versa. Check nested paths and duplicate names after conversion. Automatic updates and broken-reference warnings can be switched off in settings.

## Example: a prompt for writing prompts

Keep shared instructions under `Style` in `Snippets.md`. The example uses single-bracket notation.

~~~markdown
```ce
<obsidian_code_embed_prompt_writer>
# Context
I use Code Embed in Obsidian. Reference shared instructions instead of copying them.

# Task
When asked for a prompt, return one ce, md, or xml code fence. Use indentation for nested examples rather than inner fences.

# Style
![Snippets:##Style]

# Embed rules
Use unique note basenames. Prefix an embed with a backslash to show it literally, e.g. \![Snippets:##Style].
</obsidian_code_embed_prompt_writer>
```
~~~

Author: Jakub Wajda. License: [CC BY-NC 4.0](LICENSE). Wise support is optional and does not unlock features.
