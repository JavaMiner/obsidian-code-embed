const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadPlugin(path, locale, appLocale) {
  const commands = new Map();
  const noop = () => {};
  class Plugin {
    async loadData() { return {}; }
    addCommand(command) { commands.set(command.id, command); }
  }
  for (const method of ["addRibbonIcon", "addSettingTab", "register", "registerEvent",
    "registerDomEvent", "registerView", "registerEditorExtension", "registerEditorSuggest",
    "registerMarkdownPostProcessor"]) Plugin.prototype[method] = noop;
  const obsidian = { Plugin, getLanguage: () => appLocale };
  for (const type of ["PluginSettingTab", "Modal", "ItemView", "EditorSuggest", "TFolder", "Notice"]) obsidian[type] = class {};
  const modules = {
    obsidian,
    "@codemirror/state": { StateEffect: { define: noop }, StateField: { define: noop } },
    "@codemirror/view": { WidgetType: class {}, ViewPlugin: { fromClass: noop },
      EditorView: { domEventHandlers: noop } }
  };
  const context = { module: { exports: {} }, require: name => modules[name],
    navigator: { language: locale }, document: { body: { style: { setProperty: noop, removeProperty: noop } } },
    MutationObserver: class { observe() {} }, requestAnimationFrame: noop, cancelAnimationFrame: noop };
  vm.runInNewContext(fs.readFileSync(path, "utf8"), context);
  const plugin = new context.module.exports();
  plugin.settings = vm.runInNewContext("({ ...DEFAULTS })", context);
  plugin.manifest = require("../dist/manifest.json");
  plugin.app = { workspace: { on: noop, onLayoutReady: noop }, vault: { on: noop } };
  return { plugin, commands, context };
}

for (const path of ["dist/main.js"]) {
  for (const [locale, command] of [["pl-PL", "Wstaw tag XML"], ["fr-FR", "Insérer une balise XML"], ["sv-SE", "Insert XML tag"]]) {
    test(path + " registers translated commands on startup for " + locale, async () => {
      const { plugin, commands } = loadPlugin(path, locale);
      await plugin.onload();
      assert.ok(commands.get("support"));
      assert.equal(commands.get("insert-xml").name, command);
      assert.ok(commands.has("copy-expanded"));
    });
  }
}

test("all bundled languages define the English translation keys", () => {
  const { context } = loadPlugin("dist/main.js", "en");
  const languages = vm.runInNewContext("CE_LOCALES", context);
  for (const labels of Object.values(languages))
    assert.deepEqual(Object.keys(labels).sort(), Object.keys(languages.en).sort());
});

test("marked folders stay visible across note switches and only unmarked actions depend on settings", () => {
  const { plugin, context } = loadPlugin("dist/main.js", "pl");
  const events = new Map();
  plugin.app.workspace.on = (name, callback) => events.set(name, callback);
  const roots = ["Prompts", "Prompts/Nested", "Other"];
  plugin.app.vault.getFiles = () => roots.map(root =>
    ({ path: root + "/_code-embed-root.md", name: "_code-embed-root.md" }));
  const rows = roots.concat("Unmarked").map(path => {
    let button;
    const classes = new Set();
    return {
      classes,
      isConnected: true,
      folder: { path, children: [] },
      classList: { toggle(key, state) { if (state) classes.add(key); else classes.delete(key); } },
      querySelector: () => button,
      createEl() {
        button = { dataset: {}, setAttribute() {}, addEventListener() {}, remove() { button = undefined; } };
        return button;
      }
    };
  });
  plugin.app.workspace.getLeavesOfType = () => [{ view: {
    fileItems: rows.map(row => ({ file: row.folder, selfEl: row })),
    containerEl: { querySelectorAll: () => [] }
  } }];
  let activeFile, frame;
  plugin.app.workspace.getActiveFile = () => activeFile;
  context.requestAnimationFrame = callback => { frame = callback; return 1; };
  plugin.setupFolders();
  function check(path, root, event) {
    activeFile = path ? { path, extension: "md" } : null;
    plugin.scheduleFolders();
    frame();
    assert.deepEqual(rows.filter(row => row.querySelector()).map(row => row.folder.path), roots);
    assert.deepEqual(rows.filter(row => row.classes.has("ce-package-folder")).map(row => row.folder.path), roots);
    for (const row of rows.filter(row => row.querySelector())) assert.equal(row.querySelector().textContent, "◆ Korzeń");
  }
  check("Prompts/Nested/Note.md", "Prompts/Nested", "file-open");
  check("Prompts/Note.md", "Prompts", "active-leaf-change");
  check("Other/Note.md", "Other", "file-open");
  check("Unmarked/Note.md", null, "file-open");
  check(null, null, "active-leaf-change");
  const workspace = plugin.app.workspace;
  workspace.rootSplit = {};
  let editorFile = { path: "Prompts/Nested/Note.md", extension: "md" };
  workspace.getMostRecentLeaf = split => {
    assert.equal(split, workspace.rootSplit);
    return { view: { file: editorFile } };
  };
  workspace.activeLeaf = { view: { getViewType: () => "file-explorer" } };
  check(null, "Prompts/Nested", "active-leaf-change");
  editorFile = { path: "Unmarked/Note.md", extension: "md" };
  check(null, null, "active-leaf-change");
  editorFile = null;
  check(null, null, "file-open");
  plugin.settings.showAllFolderActions = true;
  plugin.scheduleFolders();
  frame();
  assert.deepEqual(rows.map(row => row.querySelector().textContent), ["◆ Korzeń", "◆ Korzeń", "◆ Korzeń", "+ Korzeń"]);
  assert.deepEqual(rows.filter(row => row.classes.has("ce-package-folder")).map(row => row.folder.path), roots);
  plugin.settings.showAllFolderActions = false;
  check("Other/Note.md", "Other", "file-open");
});

test("auto-close inserts a matching tag after one second and preserves the caret", () => {
  const { plugin, context } = loadPlugin("dist/main.js", "en");
  context.require("@codemirror/view").ViewPlugin.fromClass = implementation => implementation;
  let timer, delay;
  context.setTimeout = (callback, ms) => { timer = callback; delay = ms; return 1; };
  context.clearTimeout = () => { timer = null; };
  context.plugin = plugin;
  const handler = vm.runInNewContext("new (xmlClosingExtension(plugin))()", context);
  for (const [lang, typed, existing, enabled, expected] of [
    ["xml", "<x>", "", true, "</x>"], ["ce", "<data-item>", "", true, "</data-item>"],
    ["md", "<x>", "", true, ""], ["xml", "<x/>", "", true, ""],
    ["xml", "<x>", "</x>", true, ""], ["ce", "<x>", "", false, ""]
  ]) {
    const first = "```" + lang, text = first + "\n" + typed + existing;
    const pos = first.length + 1 + typed.length;
    const doc = { length: text.length, line: () => ({ text: first }),
      lineAt: () => ({ from: first.length + 1, number: 2 }), sliceString: (a,b) => text.slice(a,b) };
    const state = { doc, selection: { main: { empty: true, head: pos }, ranges: [{}] } };
    let edit;
    const view = { state, hasFocus: true, dispatch: value => { edit = value; } };
    plugin.settings.autoCloseXml = enabled;
    const update = { state, view, docChanged: true, transactions: [{ isUserEvent: key => key === "input.type" }] };
    handler.update(update);
    if (!expected) { assert.equal(timer, null); continue; }
    assert.equal(delay, 1000);
    timer();
    assert.equal(edit.changes.from, pos);
    assert.equal(edit.changes.insert, expected);
    assert.equal(edit.selection.anchor, pos);
    handler.update(update);
    handler.update({ ...update, docChanged: false, selectionSet: true });
    assert.equal(timer, null);
  }
});

test("app language determines folder labels for every documented locale", () => {
  const roots = { en: "Root", pl: "Korzeń", de: "Wurzel", fr: "Racine", es: "Raíz", nl: "Hoofdmap", it: "Radice" };
  const guides = fs.readdirSync(".").filter(name => /^README(?:\.[a-z]+)?\.md$/.test(name));
  const documented = guides.map(name => name === "README.md" ? "en" : name.split(".")[1]).sort();
  assert.deepEqual(documented, Object.keys(roots).sort());
  for (const [lang, root] of Object.entries(roots)) {
    const { context, plugin } = loadPlugin("dist/main.js", "sv", lang.toUpperCase() + "_XX");
    context.moment = { locale: () => "sv" };
    const dictionaries = vm.runInNewContext("CE_LOCALES", context);
    assert.deepEqual(Object.keys(dictionaries).sort(), documented);
    const labels = dictionaries[lang];
    const guide = fs.readFileSync(lang === "en" ? "README.md" : "README." + lang + ".md", "utf8");
    const button = { dataset: {}, setAttribute(key, value) { this[key] = value; } };
    const row = { classList: { toggle() {} }, querySelector: () => button };
    const folder = { path: "My $& folder" };
    plugin.packages = () => ({ roots: new Set([folder.path]) });
    plugin.decorateFolder(row, folder);
    assert.equal(button.textContent, "◆ " + root);
    assert.ok(guide.includes(button.textContent));
    assert.equal(button.title, labels.unmarkFolder);
    assert.equal(button["aria-label"], button.title + " — " + folder.path);
    const confirm = vm.runInNewContext('t("confirmUnmark", {path: "My $& folder/_code-embed-root.md"})', context);
    assert.equal(confirm, labels.confirmUnmark.replace("{path}", () => folder.path + "/_code-embed-root.md"));
    assert.ok(confirm.includes(folder.path));
  }
});

test("single-folder context menus support both explorer events and add one working action", async () => {
  const { context, plugin } = loadPlugin("dist/main.js", "en", "pl-PL");
  const events = new Map();
  plugin.app.workspace.on = (name, callback) => events.set(name, callback);
  plugin.app.workspace.getActiveFile = () => ({ path: "Outside.md", extension: "md" });
  const paths = new Map();
  plugin.app.vault.getAbstractFileByPath = path => paths.get(path);
  plugin.app.vault.create = async (path, content) => { paths.set(path, { path, content }); };
  plugin.app.vault.trash = async file => { paths.delete(file.path); };
  vm.runInNewContext("pickOne = async (_app, _title, choices) => choices.find(choice => choice.remove)", context);
  plugin.setupFolders();
  const folder = { path: "Prompts", children: [] };
  const titles = [], menu = { addItem(cb) { cb(this); },
    setTitle(title) { titles.push(title); return this; }, setIcon() { return this; },
    onClick(callback) { this.click = callback; return this; } };
  events.get("files-menu")(menu, [folder, folder]);
  events.get("file-menu")(menu, { path: "Note.md" });
  assert.equal(titles.length, 0);
  events.get("files-menu")(menu, [folder]);
  events.get("file-menu")(menu, folder);
  assert.deepEqual(titles, ["Ustaw katalog jako korzeń Code Embed"]);
  await menu.click();
  assert.equal(paths.get("Prompts/_code-embed-root.md").content, "");
  const markedMenu = { ...menu };
  events.get("file-menu")(markedMenu, folder);
  assert.equal(titles[1], "Usuń oznaczenie korzenia Code Embed");
  await markedMenu.click();
  assert.equal(paths.has("Prompts/_code-embed-root.md"), false);
});

test("documentation follows the app language including unsupported-language fallback", () => {
  for (const language of ["en", "pl", "de", "fr", "es", "nl", "it", "sv"]) {
    const { context } = loadPlugin("dist/main.js", "pl", language);
    const filename = ["en", "sv"].includes(language) ? "README.md" : "README." + language + ".md";
    assert.ok(vm.runInNewContext("guideUrl()", context).endsWith("/" + filename));
    const expanded = vm.runInNewContext('formatError(t("notInPackage"))', context);
    context.expanded = expanded;
    assert.ok(vm.runInNewContext("hasErrors(expanded) && firstError(expanded) === t('notInPackage')", context));
  }
});
