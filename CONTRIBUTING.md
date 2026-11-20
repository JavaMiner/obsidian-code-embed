# Development

Run `npm run build`, `npm test`, and `node --check dist/main.js`. Keep shared UI translations in `src/i18n/en.json` and `src/i18n/pl.json`. Not all legacy strings have been migrated yet.

## Release checklist

1. Update `package.json` version (SemVer), then run `npm run version:sync`.
2. Update `CHANGELOG.md`. Smoke-test Reading View, Live Preview, block Copy+, and `ce`/`codeembed` in a clean vault, including mobile before claiming support.
3. Commit and push an exact `X.Y.Z` tag (without `v`). Review the draft GitHub release and its three assets before publishing it.
4. Before a public push, confirm the code's redistribution terms and add the chosen LICENSE. No license is inferred from the source attachment.
