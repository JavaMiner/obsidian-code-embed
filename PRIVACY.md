# Privacy

## Vault access

Code Embed lists local file paths to find package markers and distinguish matching candidates. The folder picker lists folders in the vault. Backlinks, broken-reference checks, and reference updates during renaming may read Markdown notes across the vault. The plugin reads individual notes to resolve embedded fragments. When expanding a fragment within a package, it selects targets within that package. The lock action modifies the selected block or creates a new, expanded note beside its source. These operations use local Obsidian APIs.

## Clipboard access

When you invoke Copy+ or the expanded-copy command, Code Embed writes the expanded text of the selected block or note to the system clipboard. It does not read the clipboard.

## External links

The support command opens the selected payment provider in an external browser.
