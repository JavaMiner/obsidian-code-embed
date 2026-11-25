# Development

Run `npm run build`, `npm test`, and `node --check dist/main.js`. Keep shared UI translations in `src/i18n/`. Not all legacy strings have been migrated yet.

## Code style

Use descriptive English names for internal state and functions. Keep comments in English for non-obvious behavior, such as Obsidian rendering quirks or the timing of reference validation. Put user-facing labels in the locale dictionaries.

## Release checklist

1. Update `package.json` version (SemVer), then run `npm run version:sync`.
2. Update `CHANGELOG.md`. Smoke-test Reading View, Live Preview, block Copy+, and `ce`/`codeembed` in a clean vault, including mobile before claiming support.
3. Commit and push an exact `X.Y.Z` tag (without `v`). Review the draft GitHub release and its three assets before publishing it.
4. Record desktop and Android results separately using the [visual smoke note](examples/smoke-vault/Prompts/Test%20Code%20Embed.md). Use PASS, FAIL, or NIE URUCHOMIONO for each scenario. Verify the built assets before publishing.

The project uses Apache-2.0. Commercial use is permitted. When distributing a modified version, include the license, retain the applicable attribution to Jakub Wajda (JavaMiner) from NOTICE and mark the files you changed. Keep the full license text and SPDX metadata consistent.
