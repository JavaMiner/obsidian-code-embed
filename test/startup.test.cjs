const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadPlugin(path, locale, appLocale) {
  const commands = new Map();
  const noop = () => {};
  class Plugin {
    async loadData() { return {}; }
    addCommand(command) { commands.set(command.id, command.name); }
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
  const context = { module: { exports: {} }, require: name => name === "./i18n" ? require("../src/i18n/index.js") : modules[name],
    navigator: { language: locale }, document: { body: { style: { setProperty: noop, removeProperty: noop } } },
    MutationObserver: class { observe() {} }, requestAnimationFrame: noop, cancelAnimationFrame: noop };
  vm.runInNewContext(fs.readFileSync(path, "utf8"), context);
  const plugin = new context.module.exports();
  plugin.manifest = require("../dist/manifest.json");
  plugin.app = { workspace: { on: noop, onLayoutReady: noop }, vault: { on: noop } };
  return { plugin, commands, context };
}

for (const path of ["src/main.js", "dist/main.js"]) {
  for (const [locale, command] of [["pl-PL", "Wstaw tag XML"], ["fr-FR", "Insérer une balise XML"], ["sv-SE", "Insert XML tag"]]) {
    test(path + " registers translated commands on startup for " + locale, async () => {
      const { plugin, commands } = loadPlugin(path, locale);
      await plugin.onload();
      assert.ok(commands.get("support"));
      assert.equal(commands.get("insert-xml"), command);
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

test("folder action survives late mounting and recycled rows, preserves folder clicks and follows the marker", async () => {
  const { plugin, context } = loadPlugin("dist/main.js", "pl");
  const Folder = context.require("obsidian").TFolder;
  const folder = Object.assign(new Folder(), { path: "Prompts" });
  const files = new Map([[folder.path, folder]]);
  const removed = [];
  plugin.app.vault = {
    getAbstractFileByPath: path => files.get(path),
    async create(path) {
      assert.equal(files.has(path), false);
      files.set(path, { path, name: "_code-embed-root.md" });
    },
    async trash(file) { removed.push(file.path); files.delete(file.path); }
  };
  const handlers = {}, classes = new Set();
  let attached, pending, choice;
  const row = {
    dataset: {}, isConnected: true,
    closest: () => ({ dataset: { path: folder.path } }),
    classList: { toggle(key, enabled) { if (enabled) classes.add(key); else classes.delete(key); } },
    querySelector: selector => selector === ".ce-folder-action" ? attached : null,
    createEl(tag) {
      assert.equal(tag, "button");
      assert.equal(attached, undefined);
      return attached = { dataset: {}, setAttribute() {}, addEventListener(type, fn) { handlers[type] = fn; } };
    }
  };
  const leaves = [];
  plugin.app.workspace.getLeavesOfType = () => leaves;
  context.requestAnimationFrame = cb => { assert.equal(pending, undefined); pending = cb; return 1; };
  vm.runInNewContext("pickOne = async (_app, title, items) => globalThis.choose(title, items)", context);
  context.choose = (title, items) => { assert.ok(title.includes(folder.path + "/_code-embed-root.md")); return items[choice]; };
  function refresh() {
    plugin.scheduleFolders();
    plugin.scheduleFolders();
    const cb = pending;
    pending = undefined;
    cb();
  }
  refresh();
  assert.equal(attached, undefined);
  leaves.push({ view: { containerEl: { querySelectorAll: () => [row] } } });
  refresh();
  assert.equal(attached.hidden, true);
  assert.equal(attached.textContent, "+ Korzeń");
  const click = async () => {
    let stopped = false;
    handlers.click({ preventDefault() {}, stopPropagation() { stopped = true; } });
    assert.ok(stopped);
    await new Promise(resolve => setImmediate(resolve));
    refresh();
  };
  await click();
  assert.equal(attached.textContent, "◆ Korzeń");
  assert.ok(classes.has("ce-package-folder"));
  const marker = files.get("Prompts/_code-embed-root.md");
  assert.ok(marker);
  files.clear();
  folder.path = "Moved/Prompts";
  marker.path = folder.path + "/_code-embed-root.md";
  files.set(folder.path, folder);
  files.set(marker.path, marker);
  leaves[0].view.fileItems = { moved: { file: folder, selfEl: row } };
  refresh();
  assert.equal(attached.dataset.folderPath, folder.path);
  choice = 0;
  await click();
  assert.ok(files.has(marker.path));
  choice = 1;
  await click();
  assert.deepEqual(removed, [marker.path]);
  assert.ok(files.has(folder.path));
  assert.equal(classes.size, 0);
  assert.equal(attached.hidden, true);
  assert.equal(attached.textContent, "+ Korzeń");
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
    for (const marked of [false, true]) {
      plugin.app.vault.getAbstractFileByPath = () => marked ? {name: "_code-embed-root.md"} : null;
      plugin.app.workspace.getActiveFile = () => ({ path: folder.path + "/Note.md" });
      plugin.decorateFolder(row, folder);
      assert.equal(button.hidden, !marked);
      assert.equal(button.textContent, (marked ? "◆ " : "+ ") + root);
      assert.ok(guide.includes(button.textContent));
      assert.equal(button.title, marked ? labels.unmarkFolder : labels.markFolder);
      assert.equal(button["aria-label"], button.title + " — " + folder.path);
    }
    const confirm = vm.runInNewContext('t("confirmUnmark", {path: "My $& folder/_code-embed-root.md"})', context);
    assert.equal(confirm, labels.confirmUnmark.replace("{path}", () => folder.path + "/_code-embed-root.md"));
    assert.ok(confirm.includes(folder.path));
  }
});

test("single-folder context menus support both explorer events and add one working action", async () => {
  const { plugin } = loadPlugin("dist/main.js", "en", "pl-PL");
  const events = new Map();
  plugin.app.workspace.on = (name, callback) => events.set(name, callback);
  const paths = new Map();
  plugin.app.vault.getAbstractFileByPath = path => paths.get(path);
  plugin.app.vault.create = async (path, content) => { paths.set(path, { path, content }); };
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
  events.get("file-menu")({ ...menu }, folder);
  assert.equal(titles[1], "Usuń oznaczenie korzenia Code Embed");
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
