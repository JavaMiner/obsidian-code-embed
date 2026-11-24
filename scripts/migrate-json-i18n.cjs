const fs = require('node:fs');
const assert = require('node:assert/strict');
const languages = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl'];
const locales = require('../src/locales.js');
assert.deepEqual(Object.keys(locales).sort(), languages);
const keys = Object.keys(locales.en).sort();
for (const lang of languages) {
  assert.deepEqual(Object.keys(locales[lang]).sort(), keys, lang);
  for (const value of Object.values(locales[lang])) assert.equal(typeof value, 'string');
}
const updates = new Map();
function replaceRequired(text, before, after) {
  assert.ok(text.includes(before), before);
  return text.replaceAll(before, after);
}
let main = fs.readFileSync('src/main.js', 'utf8');
main = replaceRequired(main, 'const CE_LOCALES = require("./locales");', 'const CE_LOCALES = require("./i18n");');
updates.set('src/main.js', main);
for (const lang of languages) updates.set('src/i18n/' + lang + '.json', JSON.stringify(locales[lang], null, 2) + '\n');
updates.set('src/i18n/index.js', "'use strict';\nmodule.exports = {\n" + languages.map(lang => '  ' + lang + ': require("./' + lang + '.json")').join(',\n') + '\n};\n');
let build = fs.readFileSync('scripts/build.cjs', 'utf8');
build = replaceRequired(build, '../src/locales.js', '../src/i18n/index.js');
build = replaceRequired(build, './locales', './i18n');
updates.set('scripts/build.cjs', build);
let startup = fs.readFileSync('test/startup.test.cjs', 'utf8');
startup = replaceRequired(startup, '../src/locales.js', '../src/i18n/index.js');
startup = replaceRequired(startup, './locales', './i18n');
updates.set('test/startup.test.cjs', startup);
let release = fs.readFileSync('test/release-validation.test.cjs', 'utf8');
release = replaceRequired(release, '../src/locales.js', '../src/i18n/index.js');
release = replaceRequired(release, './locales', './i18n');
updates.set('test/release-validation.test.cjs', release);
let contributing = fs.readFileSync('CONTRIBUTING.md', 'utf8');
contributing = replaceRequired(contributing, '`src/locales.js`', '`src/i18n/*.json`');
contributing += '\n## Install a development build\n\nNever install `src/main.js`: it is an unbundled source file. Run `node scripts/install.cjs "/absolute/path/to/vault/.obsidian/plugins/code-embed"` to build and copy only the three distributable files. All seven JSON locale dictionaries are embedded in `dist/main.js`; no locale files are loaded by Obsidian at runtime.\n';
updates.set('CONTRIBUTING.md', contributing);
fs.mkdirSync('src/i18n', {recursive: true});
for (const [path, content] of updates) fs.writeFileSync(path, content);
const migrated = require('../src/i18n/index.js');
assert.deepEqual(migrated, locales, 'Every original language and translation must be preserved');
fs.unlinkSync('src/locales.js');
