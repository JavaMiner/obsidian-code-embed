const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
assert.equal(execFileSync('git', ['hash-object', 'src/main.js'], { encoding: 'utf8' }).trim(), 'e96867405e6b95952c8294b7f2d23bd38ca5212c', 'Source changed; review before retrying');
const updates = new Map();
function once(text, before, after) {
  assert.equal(text.split(before).length - 1, 1, before);
  return text.replace(before, () => after);
}
let main = fs.readFileSync('src/main.js', 'utf8');
const match = /^const CE_LOCALES = (\{[\s\S]*?^\});/m.exec(main);
assert.ok(match);
const locales = JSON.parse(match[1]);
assert.equal(Object.keys(locales).length, 7);
updates.set('src/locales.js', "'use strict';\nmodule.exports = " + JSON.stringify(locales, null, 2) + ';\n');
main = once(main, match[0], 'const CE_LOCALES = require("./locales");');
main = once(main, '(_xvar|_mvar)$', String.raw`(_xvar(?:[A-Za-z_][\w.:\-]*)?|_mvar(?:[A-Za-z_][\w.:\-]*)?)$`);
main = once(main, '        if (!checking) promptFragment(this.app, editor, trigger === "_xvar" ? "xml" : "markdown", trigger);', `        if (!checking) {
          const kind = trigger.startsWith("_xvar") ? "xml" : "markdown";
          const name = trigger.slice(5);
          if (name) insertFragment(editor, kind, name, trigger);
          else promptFragment(this.app, editor, kind, trigger);
        }`);
main = once(main, '    button.dataset.folderPath = folder.path;', `    const activeFile = this.app.workspace.getActiveFile?.();
    let activeRoot = activeFile ? folderOf(activeFile.path) : null;
    while (activeRoot !== null) {
      const candidate = this.app.vault.getAbstractFileByPath(markerPath(activeRoot));
      if (candidate && !(candidate instanceof TFolder)) break;
      activeRoot = activeRoot ? folderOf(activeRoot) : null;
    }
    button.hidden = !marked || activeRoot === null || activeRoot !== (folder.path === "/" ? "" : folder.path);
    button.dataset.folderPath = folder.path;`);
main = once(main, '    this.registerEvent(ws.on("file-open", () => this.scheduleInject()));', '    this.registerEvent(ws.on("file-open", () => { this.scheduleInject(); this.scheduleFolders(); }));');
main = once(main, '    this.registerEvent(ws.on("active-leaf-change", () => this.scheduleInject()));', '    this.registerEvent(ws.on("active-leaf-change", () => { this.scheduleInject(); this.scheduleFolders(); }));');
updates.set('src/main.js', main);
updates.set('scripts/build.cjs', `const fs = require("node:fs");
const assert = require("node:assert/strict");
const locales = require("../src/locales.js");
const source = fs.readFileSync("src/main.js", "utf8");
const importLine = 'const CE_LOCALES = require("./locales");';
assert.equal(source.split(importLine).length - 1, 1);
const bundled = source.replace(importLine, () => "const CE_LOCALES = " + JSON.stringify(locales, null, 2) + ";");
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/main.js", bundled);
for (const file of ["manifest.json", "styles.css"]) fs.copyFileSync(file, "dist/" + file);
`);
let startup = fs.readFileSync('test/startup.test.cjs', 'utf8');
startup = once(startup, 'require: name => modules[name]', 'require: name => name === "./locales" ? require("../src/locales.js") : modules[name]');
const inactiveAssertion = '  assert.equal(attached.textContent, "+ Korzeń");';
assert.equal(startup.split(inactiveAssertion).length - 1, 2);
startup = startup.replaceAll(inactiveAssertion, '  assert.equal(attached.hidden, true);\n' + inactiveAssertion);
startup = once(startup, '      plugin.decorateFolder(row, folder);', '      plugin.app.workspace.getActiveFile = () => ({ path: folder.path + "/Note.md" });\n      plugin.decorateFolder(row, folder);\n      assert.equal(button.hidden, !marked);');
updates.set('test/startup.test.cjs', startup);
updates.set('styles.css', fs.readFileSync('styles.css', 'utf8') + '\n.ce-folder-action[hidden] { display: none !important; }\n');
let guide = fs.readFileSync('README.pl.md', 'utf8');
const start = guide.indexOf('1. W `Szablony`');
const end = guide.indexOf('```xml', start);
assert.ok(start >= 0 && end > start);
guide = guide.slice(0, start) + '1. W notatce `Szablony` wpisz `_xvarZMIENNA`; kursor zostaw bezpośrednio za ostatnią literą.\n2. Uruchom z palety polecenie **Rozwiń skrót** wtyczki Code Embed. Tekst zostanie zastąpiony przez `<ZMIENNA></ZMIENNA>`, bez okna nazwy; kursor trafi pomiędzy tagi.\n3. Wpisz treść pomiędzy tagami, jak poniżej.\n\nSamo wpisanie skrótu nie uruchamia rozwinięcia. Poleceniu możesz przypisać klawisze w ustawieniach Obsidiana. `_xvar` bez nazwy nadal otwiera okno nazwy; anulowanie nie zmienia tekstu. `_mvarNazwa` tworzy sekcję Markdown.\n\n' + guide.slice(end);
guide = once(guide, 'Stuknij przycisk **+ Korzeń** lub **◆ Korzeń** przy katalogu, użyj menu po przytrzymaniu albo wybierz katalog z palety poleceń.', 'Przycisk **+ Korzeń** jest ukryty. **◆ Korzeń** jest widoczny tylko przy najbliższym korzeniu aktywnej notatki; poza pakietem nie pojawia się żaden znacznik. Nowy korzeń ustawisz z menu kontekstowego katalogu lub poleceniem **Wybierz katalog pakietu**.');
updates.set('README.pl.md', guide);
updates.set('CONTRIBUTING.md', once(fs.readFileSync('CONTRIBUTING.md', 'utf8'), '`CE_LOCALES` in `src/main.js`', '`src/locales.js` (inlined into `dist/main.js` during the build)'));
updates.set('test/embed-ui-fixes.test.cjs', String.raw`const { test } = require('node:test');
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
`);
for (const [path, contents] of updates) fs.writeFileSync(path, contents);
