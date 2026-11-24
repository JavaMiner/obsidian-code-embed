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
  for (const type of ["PluginSettingTab", "Modal", "ItemView", "EditorSuggest"]) obsidian[type] = class {};
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
