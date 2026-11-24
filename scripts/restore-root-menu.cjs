const fs = require('node:fs');
const assert = require('node:assert/strict');
let main = fs.readFileSync('src/main.js', 'utf8');
const method = main.indexOf('  setupFolders() {');
const start = main.indexOf('    const populatedMenus = new WeakSet();', method);
const end = main.indexOf('    const chooseFolder = () => this.choosePackageFolder();', start);
assert.ok(method >= 0 && start > method && end > start, 'Expected folder menu implementation not found');
const replacement = `    const addFolderAction = (menu, candidate) => {
      const folder = this.app.vault.getAbstractFileByPath(candidate?.path) || candidate;
      if (!isVaultFolder(folder)) return;
      const action = this.folderActionLabel(folder);
      // A Menu may be reused after its items have been cleared.
      if (menu.items?.some(item => item.ceRootFolderPath === folder.path && item.ceRootFolderAction === action)) return;
      menu.addItem(item => {
        item.ceRootFolderPath = folder.path;
        item.ceRootFolderAction = action;
        item.setTitle(action).setIcon("folder-cog")
          .onClick(() => this.toggleFolder(folder));
      });
    };
    const workspace = this.app.workspace;
    this.registerEvent(workspace.on("file-menu", addFolderAction));
    this.registerEvent(workspace.on("files-menu", (menu, files) => {
      if (Array.isArray(files) && files.length === 1) addFolderAction(menu, files[0]);
    }));
`;
main = main.slice(0, start) + replacement + main.slice(end);
let tests = fs.readFileSync('test/startup.test.cjs', 'utf8');
const before = 'const titles = [], menu = { addItem(cb) { cb(this); },';
assert.equal(tests.split(before).length - 1, 1);
tests = tests.replace(before, 'const titles = [], menu = { items: [], addItem(cb) { const item = { ...this }; this.items.push(item); cb(item); },');
const oldClick = 'onClick(callback) { this.click = callback; return this; } };';
assert.equal(tests.split(oldClick).length - 1, 1);
tests = tests.replace(oldClick, 'onClick(callback) { menu.click = callback; return this; } };');
tests += String.raw`

test("reused folder menu restores the root action after each clear independently of the active note", async () => {
  const { plugin } = loadPlugin("dist/main.js", "en", "pl");
  const events = new Map(), files = new Map();
  const folder = {path: "Prompts", children: []};
  files.set(folder.path, folder);
  plugin.app.workspace.on = (name, fn) => { events.set(name, fn); };
  plugin.app.workspace.getActiveFile = () => ({path: "Elsewhere/Note.md"});
  plugin.app.vault.getAbstractFileByPath = path => files.get(path);
  plugin.app.vault.create = async (path, content) => { files.set(path, {path, content}); };
  plugin.scheduleFolders = () => {};
  plugin.setupFolders();
  const menu = {items: [], addItem(callback) {
    const item = {setTitle(title) {this.title = title; return this;},
      setIcon() {return this;}, onClick(fn) {this.click = fn; return this;}};
    this.items.push(item);
    callback(item);
  }};
  for (let opening = 0; opening < 3; opening++) {
    menu.items.length = 0;
    events.get("file-menu")(menu, folder);
    events.get("files-menu")(menu, [folder]);
    assert.equal(menu.items.length, 1);
    assert.equal(menu.items[0].title, "Ustaw katalog jako korzeń Code Embed");
  }
  await menu.items[0].click();
  assert.equal(files.get("Prompts/_code-embed-root.md").content, "");
  menu.items.length = 0;
  events.get("files-menu")(menu, [folder]);
  events.get("file-menu")(menu, folder);
  assert.equal(menu.items.length, 1);
  assert.equal(menu.items[0].title, "Usuń oznaczenie korzenia Code Embed");
  menu.items.length = 0;
  events.get("file-menu")(menu, {path: "Note.md", extension: "md"});
  assert.equal(menu.items.length, 0);
});
`;
fs.writeFileSync('src/main.js', main);
fs.writeFileSync('test/startup.test.cjs', tests);
