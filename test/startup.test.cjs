const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadPlugin(path, locale) {
  const commands = new Map();
  const noop = () => {};
  class Plugin {
    async loadData() { return {}; }
    addCommand(command) { commands.set(command.id, command.name); }
  }
  for (const method of ["addRibbonIcon", "addSettingTab", "register", "registerEvent",
    "registerDomEvent", "registerView", "registerEditorExtension", "registerEditorSuggest",
    "registerMarkdownPostProcessor"]) Plugin.prototype[method] = noop;
  const obsidian = { Plugin };
  for (const type of ["PluginSettingTab", "Modal", "ItemView", "EditorSuggest", "TFolder"]) obsidian[type] = class {};
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
  plugin.manifest = require("../dist/manifest.json");
  plugin.app = { workspace: { on: noop, onLayoutReady: noop }, vault: { on: noop } };
  return { plugin, commands, context };
}

for (const path of ["src/main.js", "dist/main.js"]) {
  for (const [locale, command] of [["pl-PL", "Wstaw tag XML"], ["fr-FR", "Insert XML tag"]]) {
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
  assert.equal(attached.textContent, "+ Korzeń");
});
