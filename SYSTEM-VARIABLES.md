# Code Embed system variables

Write `![<<sys:note>>]` to insert the name of the note. The `sys:` namespace belongs to Code Embed and uses the same tag reference syntax on desktop and mobile. A single pair of angle brackets, as in `![<sys:note>]`, returns the same scalar value. A backslash before the exclamation mark preserves an example literally.

For a note at `Work/Prompts/Tasks/Plan.md` in the `Research` vault, with its nearest package marker in `Work/Prompts`, the following values apply.

| Key | Meaning | Example |
| --- | --- | --- |
| `sys:package` | Name of the nearest package folder | `Prompts` |
| `sys:package-path` | Vault-relative package folder | `Work/Prompts` |
| `sys:note` | Entry note filename without the Markdown extension | `Plan` |
| `sys:note-path` | Vault-relative entry note path | `Work/Prompts/Tasks/Plan.md` |
| `sys:folder` | Vault-relative parent folder | `Work/Prompts/Tasks` |
| `sys:vault` | Vault name | `Research` |
| `sys:app` | Host application | `Obsidian` |
| `sys:language` | Interface language reported by the host | `pl` |
| `sys:locale` | Preferred language reported by the runtime | `pl-PL` |
| `sys:platform` | Operating system | `android`, `ios`, `linux`, `macos`, `windows` or `unknown` |
| `sys:timezone` | Runtime time zone | `Europe/Warsaw` |

Values follow the note where expansion starts, including when a template imports another template. Outside a package, both package variables expand to an empty string. A vault-root package uses the vault name and the path `/`. An unknown key produces a reference error.

For example, typing ``Package `![<<sys:package>>]` `` in the source of the example note produces the word “Package” followed by the inline code `Prompts`. The note snapshot writes the expanded Markdown to a sibling file. A snapshot of a hidden marker uses the visible basename `code-embed-root`.

The Obsidian adapter derives the application language, vault name and platform from the [Obsidian API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts). Locale comes from the [runtime language preference](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language).
