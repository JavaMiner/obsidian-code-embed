# Code Embed for Obsidian

[Polski](README.pl.md) · [Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md)

Reuse note fragments in structured prompts. A `ce` or `codeembed` fence opens directly in the structured view, with only `Copy+`. `xml` and `md` fences retain a normal code preview until View is selected.

~~~markdown
```ce
<task>
![[Fragments:##Instructions]]
</task>
```
~~~

## Installation

From a release, copy `main.js`, `manifest.json` and `styles.css` into `.obsidian/plugins/code-embed/`, then enable Code Embed in Community plugins. For a local build run `npm run build` and use the files from `dist/`.

## Embed syntax

- `![[Note]]`: whole note without frontmatter.
- `![[Note:#Title]]` / `![[Note:##Title]]`: section with / without its heading.
- `![[Note:<tag>]]` / `![[Note:<<tag>>]]`: full tag lines / inner content.
- `![[.:<<tag>>(8000)]]`: local parameterized tag; `$1` receives `8000`.
- `![[Note:1-10]]`: inclusive physical line range.

This is a pre-release. Check theme and platform behavior in a test vault before installing on important notes.
