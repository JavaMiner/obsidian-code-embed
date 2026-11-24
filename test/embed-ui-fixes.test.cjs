const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Base = class {};
const context = { module: { exports: {} }, require: () => new Proxy({}, {
  get: (_, key) => key === 'getLanguage' ? undefined : key === 'StateEffect' ? { define: () => ({}) } : Base
}) };
vm.runInNewContext(fs.readFileSync('dist/main.js', 'utf8') + '\nglobalThis.api = { triggerAt, insertFragment };', context);
const { triggerAt, insertFragment } = context.api;
function editor(value) {
  return { value, getSelection: () => '', getCursor: () => ({line: 0, ch: value.length}),
    getLine: () => value, posToOffset: p => p.ch, offsetToPos: ch => ({line: 0, ch}),
    replaceRange(text, from, to) { this.value = value.slice(0, from.ch) + text + value.slice(to.ch); },
    setSelection(from, to) { this.caret = [from.ch, to.ch]; }
  };
}
test('named shortcuts replace the whole trigger and position the caret', () => {
  for (const [raw, kind, name, expected, caret] of [
    ['_xvarZMIENNA', 'xml', 'ZMIENNA', '<ZMIENNA></ZMIENNA>', 9],
    ['_mvarTitle', 'markdown', 'Title', '## Title\n', 9]
  ]) {
    const ed = editor(raw);
    assert.equal(triggerAt(ed), raw);
    insertFragment(ed, kind, name, raw);
    assert.equal(ed.value, expected);
    assert.deepEqual(ed.caret, [caret, caret]);
  }
  for (const raw of ['_xvar', '_mvar']) assert.equal(triggerAt(editor(raw)), raw);
  for (const raw of ['prefix_xvarName', '_xvar123', '_xvarName ', '_xvarBad!']) assert.equal(triggerAt(editor(raw)), '');
});
test('only the nearest active root has a visible control', () => {
  const plugin = new context.module.exports();
  const markers = new Set(['P/_code-embed-root.md', 'P/N/_code-embed-root.md', 'Q/_code-embed-root.md']);
  let active;
  plugin.app = { workspace: { getActiveFile: () => active }, vault: {
    getAbstractFileByPath: path => markers.has(path) ? {path} : null
  } };
  for (const [path, visible] of [['P/A.md', 'P'], ['P/N/A.md', 'P/N'], ['Q/A.md', 'Q'], ['Outside/A.md', null], [null, null]]) {
    active = path ? {path} : null;
    for (const folder of ['P', 'P/N', 'Q', 'Unmarked']) {
      const button = {dataset: {}, setAttribute() {}};
      const row = {classList: {toggle() {}}, querySelector: () => button};
      plugin.decorateFolder(row, {path: folder});
      assert.equal(button.hidden, folder !== visible, path + ': ' + folder);
    }
  }
  markers.add('_code-embed-root.md');
  active = {path: 'RootNote.md'};
  const button = {dataset: {}, setAttribute() {}};
  plugin.decorateFolder({classList: {toggle() {}}, querySelector: () => button}, {path: '/'});
  assert.equal(button.hidden, false);
});
