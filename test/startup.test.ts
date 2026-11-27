import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadBundle, hostFixture } from "./bundle";
import type { App, TFolder } from "obsidian";
import manifest from "../manifest.json";
function loadPlugin(
  path: string,
  locale: string,
  appLocale?: string,
  supportsApi = (_version: string) => true,
) {
  const commands = new Map();
  const noop = () => {};
  class Plugin {
    async loadData() {
      return {};
    }
    addCommand(command: { id: string; name: string }) {
      commands.set(command.id, command);
    }
  }
  for (const method of [
    "addRibbonIcon",
    "addSettingTab",
    "register",
    "registerEvent",
    "registerDomEvent",
    "registerView",
    "registerEditorExtension",
    "registerEditorSuggest",
    "registerMarkdownPostProcessor",
  ])
    Object.assign(Plugin.prototype, { [method]: noop });
  const obsidian: Record<string, unknown> = {
    Plugin,
    setIcon: noop,
    requireApiVersion: supportsApi,
    getLanguage: () => {
      assert.ok(supportsApi("1.8.7"));
      return appLocale;
    },
  };
  for (const type of [
    "PluginSettingTab",
    "Modal",
    "ItemView",
    "EditorSuggest",
    "TFolder",
    "Notice",
  ])
    obsidian[type] = class {};
  const modules: Record<string, unknown> = {
    obsidian,
    "@codemirror/state": { StateEffect: { define: noop }, StateField: { define: noop } },
    "@codemirror/view": {
      WidgetType: class {},
      ViewPlugin: { fromClass: noop },
      EditorView: { domEventHandlers: noop },
    },
  };
  const globals = {
    require: (name: string) => modules[name],
    navigator: { language: locale },
    document: {
      addEventListener: noop,
      body: { classList: { toggle: noop }, style: { setProperty: noop, removeProperty: noop } },
    },
    MutationObserver: class {
      observe() {}
    },
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
  };
  const { Plugin: BundledPlugin, context } = loadBundle(path, globals);
  const plugin = new BundledPlugin();
  plugin.settings = vm.runInNewContext("({ ...DEFAULTS })", context);
  plugin.manifest = manifest;
  plugin.app = hostFixture<App>({
    workspace: {
      on: noop,
      onLayoutReady: noop,
      iterateAllLeaves: noop,
      containerEl: { ownerDocument: globals.document },
    },
    vault: { getAbstractFileByPath: () => null, on: noop, adapter: { stat: async () => null } },
    fileManager: {},
  });
  return { plugin, commands, context };
}

for (const path of ["dist/main.js"]) {
  for (const [locale, command] of [
    ["pl-PL", "Wybierz katalog pakietu"],
    ["fr-FR", "Choisir le dossier du paquet"],
    ["sv-SE", "Choose package folder"],
  ]) {
    test(path + " registers translated commands on startup for " + locale, async () => {
      const { plugin, commands } = loadPlugin(path, locale);
      await plugin.onload();
      assert.ok(commands.get("support"));
      assert.equal(commands.get("choose-package-folder").name, command);
      assert.ok(commands.has("copy-expanded"));
    });
  }
}

test("all bundled languages define the English translation keys", () => {
  const { context } = loadPlugin("dist/main.js", "en");
  const languages = vm.runInNewContext("CE_LOCALES", context);
  for (const labels of Object.values(languages as Record<string, Record<string, string>>))
    assert.deepEqual(Object.keys(labels).sort(), Object.keys(languages.en).sort());
});

function folderButton() {
  const parts: string[] = [];
  return {
    dataset: {} as Record<string, string>,
    title: "",
    attributes: new Map<string, string>(),
    setAttribute(key: string, value: string) {
      this.attributes.set(key, value);
    },
    get textContent() {
      return parts.join(" ");
    },
    replaceChildren() {
      parts.length = 0;
    },
    createSpan(options: { text: string }) {
      parts.push(options.text);
    },
    addEventListener() {},
    remove() {},
  };
}

test("only note actions offer a snapshot, enabled when references exist", () => {
  const { context } = loadPlugin("dist/main.js", "en");
  const actionBar: typeof import("../src/note-actions").actionBar = vm.runInNewContext(
    "actionBar",
    context,
  );
  for (const hasRefs of [undefined, false, true]) {
    const buttons = new Map<string, { disabled: boolean }>();
    const bar = {
      createEl(_tag: string, options: { attr: Record<string, string> }) {
        const button = { createSpan() {}, disabled: false };
        buttons.set(options.attr["data-action"], button);
        return button;
      },
    };
    actionBar(hostFixture({ createSpan: () => bar }), "toolbar", async () => {}, hasRefs);
    assert.deepEqual(
      [...buttons.keys()],
      hasRefs === undefined
        ? ["copy", "view", "actionSettings"]
        : ["copy", "view", "permanent", "actionSettings"],
    );
    if (hasRefs !== undefined) assert.equal(buttons.get("permanent")?.disabled, !hasRefs);
  }
});

test("the hidden root opens in one editor tab and indexed markers open in source mode", async () => {
  const { plugin } = loadPlugin("dist/main.js", "en");
  const ws = plugin.app.workspace;
  let state: import("obsidian").ViewState | undefined;
  let newTabs = 0;
  let mode: unknown;
  const leaf = hostFixture<import("obsidian").WorkspaceLeaf>({
    getViewState: () => state,
    setViewState: async (next: import("obsidian").ViewState) => {
      state = next;
    },
    openFile: async (_file: unknown, open: { state: { mode: string } }) => {
      mode = open.state.mode;
    },
  });
  ws.getLeavesOfType = () => (state ? [leaf] : []);
  ws.getLeaf = () => {
    newTabs++;
    return leaf;
  };
  ws.revealLeaf = async (opened) => {
    assert.equal(opened, leaf);
  };
  await plugin.editMarker("Example");
  assert.equal(state?.state?.path, "Example/.code-embed-root.md");
  await plugin.editMarker("Example");
  assert.equal(newTabs, 1);
  plugin.app.vault.getAbstractFileByPath = () => hostFixture({ extension: "md" });
  await plugin.editMarker("Example");
  assert.equal(mode, "source");
});

test("marked folders stay visible across note switches and only unmarked actions depend on settings", () => {
  const { plugin, context } = loadPlugin("dist/main.js", "pl");
  const events = new Map();
  Object.assign(plugin.app.workspace, {
    on: (name: string, callback: Function) => events.set(name, callback),
  });
  const roots = ["Prompts", "Prompts/Nested", "Other"];
  plugin.app.vault.getFiles = () =>
    hostFixture(
      roots.map((root) => ({ path: root + "/.code-embed-root.md", name: ".code-embed-root.md" })),
    );
  const rows = roots.concat("Unmarked").map((path) => {
    let button: ReturnType<typeof folderButton> | undefined;
    const classes = new Set();
    return {
      classes,
      isConnected: true,
      folder: { path, children: [] },
      classList: {
        toggle(key: string, state: boolean) {
          if (state) classes.add(key);
          else classes.delete(key);
        },
      },
      querySelector: (selector = ".ce-folder-action") =>
        selector === ".ce-folder-action" ? button : undefined,
      createEl(_tag: string, options: { cls: string }) {
        assert.equal(options.cls, "ce-folder-action");
        button = folderButton();
        button.remove = () => {
          button = undefined;
        };
        return button;
      },
    };
  });
  plugin.app.workspace.getLeavesOfType = () =>
    hostFixture([
      {
        view: {
          fileItems: rows.map((row) => ({ file: row.folder, selfEl: row })),
          containerEl: { querySelectorAll: () => [] },
        },
      },
    ]);
  let activeFile: { path: string; extension: string } | null,
    frame: () => void = () => {
      throw new Error("Expected an animation frame");
    };
  plugin.app.workspace.getActiveFile = () => hostFixture(activeFile);
  context.requestAnimationFrame = (callback: () => void) => {
    frame = callback;
    return 1;
  };
  plugin.setupFolders();
  function check(path: string | null) {
    activeFile = path ? { path, extension: "md" } : null;
    plugin.scheduleFolders();
    frame();
    assert.deepEqual(
      rows.filter((row) => row.querySelector()).map((row) => row.folder.path),
      roots,
    );
    assert.deepEqual(
      rows.filter((row) => row.classes.has("ce-folder-with-action")).map((row) => row.folder.path),
      roots,
    );
    assert.deepEqual(
      rows.filter((row) => row.classes.has("ce-package-folder")).map((row) => row.folder.path),
      roots,
    );
    for (const row of rows.filter((row) => row.querySelector()))
      assert.equal(row.querySelector()!.textContent, "📝 Edytuj");
  }
  check("Prompts/Nested/Note.md");
  check("Prompts/Note.md");
  check("Other/Note.md");
  check("Unmarked/Note.md");
  check(null);
  const workspace = plugin.app.workspace;
  workspace.rootSplit = hostFixture({});
  let editorFile: typeof activeFile = { path: "Prompts/Nested/Note.md", extension: "md" };
  workspace.getMostRecentLeaf = (split) => {
    assert.equal(split, workspace.rootSplit);
    return hostFixture({ view: { file: editorFile } });
  };
  workspace.activeLeaf = hostFixture({ view: { getViewType: () => "file-explorer" } });
  check(null);
  editorFile = { path: "Unmarked/Note.md", extension: "md" };
  check(null);
  editorFile = null;
  check(null);
  plugin.settings.showAllFolderActions = true;
  plugin.scheduleFolders();
  frame();
  assert.ok(rows.every((row) => row.classes.has("ce-folder-with-action")));
  assert.deepEqual(
    rows.map((row) => row.querySelector()!.textContent),
    ["📝 Edytuj", "📝 Edytuj", "📝 Edytuj", "+ Korzeń"],
  );
  assert.deepEqual(
    rows.filter((row) => row.classes.has("ce-package-folder")).map((row) => row.folder.path),
    roots,
  );
  plugin.settings.showAllFolderActions = false;
  check("Other/Note.md");
});

test("app language determines folder labels for every documented locale", () => {
  const roots: Record<string, string> = {
    en: "Root",
    pl: "Korzeń",
    de: "Wurzel",
    fr: "Racine",
    es: "Raíz",
    nl: "Hoofdmap",
    it: "Radice",
  };
  const guides = fs.readdirSync(".").filter((name) => /^README(?:\.[a-z]+)?\.md$/.test(name));
  const documented = guides
    .map((name) => (name === "README.md" ? "en" : name.split(".")[1]))
    .sort();
  assert.deepEqual(documented, Object.keys(roots).sort());
  for (const [lang, root] of Object.entries(roots)) {
    const { context, plugin } = loadPlugin("dist/main.js", "sv", lang.toUpperCase() + "_XX");
    context.moment = { locale: () => "sv" };
    const dictionaries = vm.runInNewContext("CE_LOCALES", context);
    assert.deepEqual(Object.keys(dictionaries).sort(), documented);
    const labels = dictionaries[lang];
    const guide = fs.readFileSync(lang === "en" ? "README.md" : "README." + lang + ".md", "utf8");
    const button = folderButton();
    const row = { classList: { toggle() {} }, querySelector: () => button };
    const folder = { path: "My $& folder" };
    plugin.packages = () => hostFixture({ roots: new Set([folder.path]) });
    plugin.app.vault.getAbstractFileByPath = () => null;
    plugin.decorateFolder(hostFixture<HTMLElement>(row), hostFixture<TFolder>(folder));
    assert.equal(labels.rootSet, "+ " + root);
    assert.equal(button.textContent, "📝 " + labels.editDescription);
    assert.ok(guide.includes(button.textContent));
    assert.ok(button.title.includes(folder.path + "/.code-embed-root.md"));
    assert.equal(button.attributes.get("aria-label"), button.title + " — " + folder.path);
    const confirm = vm.runInNewContext(
      't("confirmUnmark", {path: "My $& folder/.code-embed-root.md"})',
      context,
    );
    assert.equal(
      confirm,
      labels.confirmUnmark.replace("{path}", () => folder.path + "/.code-embed-root.md"),
    );
    assert.ok(confirm.includes(folder.path));
  }
});

test("single-folder context menus support both explorer events and add one working action", async () => {
  const { context, plugin } = loadPlugin("dist/main.js", "en", "pl-PL");
  const events = new Map();
  Object.assign(plugin.app.workspace, {
    on: (name: string, callback: Function) => events.set(name, callback),
  });
  plugin.app.workspace.getActiveFile = () => hostFixture({ path: "Outside.md", extension: "md" });
  const paths = new Map();
  plugin.app.vault.getAbstractFileByPath = (path) => paths.get(path);
  plugin.app.vault.create = async (path, content) => {
    const file = { path, content };
    paths.set(path, file);
    return hostFixture(file);
  };
  plugin.app.fileManager.trashFile = async (file) => {
    paths.delete(file.path);
  };
  vm.runInNewContext(
    "pickOne = async (_app, _title, choices) => choices.find(choice => choice.remove)",
    context,
  );
  plugin.setupFolders();
  const folder = { path: "Prompts", name: "Prompts", children: [] };
  const titles: string[] = [],
    menu = {
      click: async () => {},
      addItem(cb: (item: object) => void) {
        cb(this);
      },
      setTitle(title: string) {
        titles.push(title);
        return this;
      },
      setIcon() {
        return this;
      },
      onClick(callback: () => Promise<void>) {
        this.click = callback;
        return this;
      },
    };
  events.get("files-menu")(menu, [folder, folder]);
  events.get("file-menu")(menu, { path: "Note.md" });
  assert.equal(titles.length, 0);
  events.get("files-menu")(menu, [folder]);
  events.get("file-menu")(menu, folder);
  assert.deepEqual(titles, ["Ustaw katalog jako korzeń Code Embed"]);
  await menu.click();
  assert.match(paths.get("Prompts/.code-embed-root.md").content, /^# Pakiet Prompts\n\n.+/);
  const markedMenu = { ...menu };
  events.get("file-menu")(markedMenu, folder);
  assert.equal(titles[1], "Usuń oznaczenie korzenia Code Embed");
  await markedMenu.click();
  assert.equal(paths.has("Prompts/.code-embed-root.md"), false);
});

test("documentation follows the app language including unsupported-language fallback", () => {
  for (const language of ["en", "pl", "de", "fr", "es", "nl", "it", "sv"]) {
    const { context } = loadPlugin("dist/main.js", "pl", language);
    const filename = ["en", "sv"].includes(language) ? "README.md" : "README." + language + ".md";
    assert.ok(vm.runInNewContext("guideUrl()", context).endsWith("/" + filename));
    const expanded = vm.runInNewContext('formatError(t("notInPackage"))', context);
    context.expanded = expanded;
    assert.ok(
      vm.runInNewContext(
        "hasErrors(expanded) && firstError(expanded) === t('notInPackage')",
        context,
      ),
    );
  }
});

test("older hosts use the legacy locale, panel activation and native deletion prompt", async () => {
  const { plugin, context } = loadPlugin("dist/main.js", "en", "de", () => false);
  context.moment = { locale: () => "pl" };
  assert.equal(vm.runInNewContext('t("view")', context), "Podgląd");
  const panel = hostFixture<import("obsidian").WorkspaceLeaf>({ getRoot: () => ({}) });
  plugin.app.workspace.getLeavesOfType = () => [panel];
  let activated = false;
  plugin.app.workspace.setActiveLeaf = (leaf) => {
    activated = leaf === panel;
  };
  await plugin.openPanel();
  assert.ok(activated);

  const folder = hostFixture<TFolder>({ path: "Examples", children: [] });
  const marker = hostFixture<import("obsidian").TFile>({ path: "Examples/.code-embed-root.md" });
  plugin.app.vault.getAbstractFileByPath = () => marker;
  let prompts = 0;
  plugin.app.fileManager.promptForDeletion = async (file) => {
    assert.equal(file, marker);
    prompts++;
    return false;
  };
  await plugin.toggleFolder(folder);
  assert.equal(prompts, 1);
});

test("a replaced package marker survives a pending confirmation", async () => {
  const { plugin, context } = loadPlugin("dist/main.js", "en");
  const path = "Examples/.code-embed-root.md";
  const original = hostFixture<import("obsidian").TFile>({ path });
  const replacement = hostFixture<import("obsidian").TFile>({ path });
  let current = original;
  plugin.app.vault.getAbstractFileByPath = () => current;
  let removals = 0;
  plugin.app.fileManager.trashFile = async () => {
    removals++;
  };
  context.confirmReplacement = () => {
    current = replacement;
    return { remove: true };
  };
  vm.runInNewContext("pickOne = confirmReplacement", context);
  await plugin.toggleFolder(hostFixture<TFolder>({ path: "Examples", children: [] }));
  assert.equal(removals, 0);
});
