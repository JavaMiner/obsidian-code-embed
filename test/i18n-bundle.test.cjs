const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const languages = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl'];
test('all seven language dictionaries have identical keys and placeholders', () => {
  const dictionaries = require('../src/i18n/index.js');
  assert.deepEqual(Object.keys(dictionaries).sort(), languages);
  const tokens = value => (value.match(/\{\w+\}/g) || []).sort();
  const keys = Object.keys(dictionaries.en).sort();
  for (const lang of languages) {
    assert.deepEqual(Object.keys(dictionaries[lang]).sort(), keys, lang);
    for (const key of keys) {
      assert.equal(typeof dictionaries[lang][key], 'string');
      assert.deepEqual(tokens(dictionaries[lang][key]), tokens(dictionaries.en[key]), lang + ':' + key);
    }
  }
});
test('distribution loads without local modules and embeds every JSON translation', () => {
  const source = fs.readFileSync('dist/main.js', 'utf8');
  assert.doesNotMatch(source, /require\s*\(\s*['"]\.{1,2}\//);
  const Base = class {};
  const allowed = new Set(['obsidian', '@codemirror/view', '@codemirror/state']);
  const context = {module: {exports: {}}, require(name) {
    assert.ok(allowed.has(name), 'Unexpected runtime dependency: ' + name);
    return new Proxy({}, {get: (_, key) => key === 'getLanguage' ? undefined : key === 'StateEffect' ? {define: () => ({})} : Base});
  }};
  vm.runInNewContext(source + '\nglobalThis.dictionaries = CE_LOCALES;', context);
  assert.equal(typeof context.module.exports, 'function');
  assert.deepEqual(JSON.parse(JSON.stringify(context.dictionaries)), require('../src/i18n/index.js'));
});
