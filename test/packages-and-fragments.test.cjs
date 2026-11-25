const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Base = class {};
const ctx = { module: { exports: {} }, require: () => new Proxy({}, {
  get: (_, key) => key === "getLanguage" ? undefined : key === "StateEffect" ? { define: () => ({}) } : Base
}) };
vm.runInNewContext(fs.readFileSync("dist/main.js", "utf8") +
  "\nglobalThis.api = { parseRef, REF_RE, rewriteText, formatEmbed };", ctx);
const { REF_RE, formatEmbed, rewriteText } = ctx.api;

function fixture(notes) {
  const files = Object.entries(notes).map(([path, body]) => ({
    path, body, name: path.split("/").pop(), extension: "md",
    basename: path.split("/").pop().replace(/\.md$/, "")
  }));
  const plugin = new ctx.module.exports();
  plugin.settings = { maxDepth: 8 };
  plugin.cache = new Map();
  plugin.app = { vault: {
    getFiles: () => files, getMarkdownFiles: () => files,
    getAbstractFileByPath: path => files.find(f => f.path === path),
    cachedRead: async file => file.body
  }, metadataCache: { getFirstLinkpathDest: name => files.find(f => f.basename === name) } };
  return { plugin, files };
}

test("canonical forms, legacy input and native embeds", () => {
  for (const ref of ["S", "S:3-8", "S:#Styl", "S:##Styl", "S:##R#Styl", "S:<x>", "S:<<x>>",
    "#Styl", "##Styl(polsku)", "<x>", "<<x>>(polsku)"]) {
    assert.equal(formatEmbed(ref), "![" + ref + "]");
  }
  for (const raw of ["![[S:##Styl]]", "$[S:##Styl]", "![.:##Styl]", "![S##Styl]"])
    assert.ok(REF_RE().test(raw));
  for (const raw of ["![alt](image.png)", "![alt][image]"]) assert.equal(REF_RE().test(raw), false);
  assert.equal(rewriteText("![[Note#Head]] ![[Image.png]]", () => "Other").count, 0);
  assert.equal(rewriteText("$[.:##Old(a)] ![S##Old(a)]", r => r.replace("Old", "New")).text,
    "![##New(a)] ![S:##New(a)]");
});

test("Markdown and XML expand identically with explicit forwarding", async () => {
  const body = "Odpowiedz po $1. Ton: ${2:rzeczowy}.";
  const { plugin } = fixture({ "A.md": "## H\n" + body + "\n## Next\n<x>" + body + "</x>",
    "B.md": "## H\n![A:##H($1)]\n![A:<<x>>]" });
  for (const raw of ["![##H(polsku)]", "![<<x>>(polsku)]", "$[.:##H(polsku)]", "![[A##H(polsku)]]"])
    assert.equal(await plugin.expand(raw, "A.md"), "Odpowiedz po polsku. Ton: rzeczowy.");
  assert.equal(await plugin.expand("![B:##H(polsku)]", "A.md"),
    "Odpowiedz po polsku. Ton: rzeczowy.\nOdpowiedz po $1. Ton: rzeczowy.");
});

test("package scope, ambiguity, traversal, nested roots and local import context", async () => {
  const { plugin } = fixture({
    "P/_code-embed-root.md": "", "P/Start.md": "",
    "P/A/Style.md": "## Ton\n![##Local]\n## Local\nA",
    "P/B/Style.md": "B", "P/N/_code-embed-root.md": "",
    "P/N/Hidden.md": "inner", "Archive/Outside.md": "outside"
  });
  const render = ref => plugin.expand("![" + ref + "]", "P/Start.md");
  assert.equal(await render("A/Style:##Ton"), "A");
  assert.match(await render("Style"), /ambiguous.*P.*A\/Style.md, B\/Style.md/);
  for (const ref of ["Hidden", "N/Hidden", "Outside", "../Archive/Outside", "A/../../Archive/Outside",
    "A\\Style", "_code-embed-root", "N/_code-embed-root.md"])
    assert.match(await render(ref), /not found in package.*package: P/);
  assert.equal(await plugin.expand("![Hidden]", "P/N/Entry.md"), "inner");
  assert.match(await plugin.expand("![Style]", "P/N/Entry.md"), /package: P\/N/);
  assert.equal(await plugin.expand("![Outside]", "unmarked.md"), "outside");
});

test("moving a package preserves root-relative paths; unmarking restores vault lookup", async () => {
  const { plugin, files } = fixture({ "P/_code-embed-root.md": "", "P/Start.md": "",
    "P/Sub/Style.md": "ok", "Archive/Outside.md": "outside" });
  for (const folder of ["P", "Moved/P"]) {
    assert.equal(await plugin.expand("![Sub/Style]", folder + "/Start.md"), "ok");
    assert.match(await plugin.expand("![Outside]", folder + "/Start.md"), /not found in package/);
    if (folder === "P") {
      for (const file of files.filter(f => f.path.startsWith("P/"))) file.path = "Moved/" + file.path;
      plugin.packageIndex = null;
    }
  }
  files.splice(files.findIndex(f => f.name === "_code-embed-root.md"), 1);
  plugin.packageIndex = null;
  assert.equal(await plugin.expand("![Outside]", "Moved/P/Start.md"), "outside");
});

test("moving a source out of a package reports a lost binding", async () => {
  const { plugin, files } = fixture({ "Other/Style.md": "wrong", "P/Style.md": "right",
    "P/_code-embed-root.md": "", "P/Start.md": "![Style]" });
  const src = files.find(f => f.basename === "Start");
  assert.equal(await plugin.expand(src.body, src.path), "right");
  src.path = "Start.md";
  plugin.packageIndex = null;
  plugin.saveData = plugin.invalidate = plugin.scheduleValidate = () => {};
  await plugin.trackMovedSources(src, "P/Start.md");
  assert.match(await plugin.expand(src.body, src.path), /lost its target/);
});

test("numbered and joined arguments are shared by XML and Markdown", async () => {
  const body = "$1 / $9 / $* / ${2:fallback}";
  const { plugin } = fixture({ "F.md": "## H\n" + body + "\n## End\n<x>" + body + "</x>" });
  const args = '(one, "", 3, 4, 5, 6, 7, 8, nine)';
  for (const selector of ["##H", "<<x>>"])
    assert.equal(await plugin.expand("![" + selector + args + "]", "F.md"),
      "one / nine / one, , 3, 4, 5, 6, 7, 8, nine / fallback");
});

test("package-aware Rename changes only references to the old target", async () => {
  const { plugin, files } = fixture({ "P/_code-embed-root.md": "", "Q/_code-embed-root.md": "",
    "P/Start.md": "![Style#Tone] $[Sub/Style:##Tone] ![[Style]]",
    "Q/Start.md": "![Style:##Tone]", "P/Sub/New.md": "## Tone\nP", "Q/Style.md": "Q" });
  plugin.app.vault.process = async (f, update) => { f.body = update(f.body); };
  plugin.withRenameMute = cb => cb();
  await plugin.renameFileRefs(files.find(f => f.basename === "New"), "P/Sub/Style.md");
  assert.equal(files.find(f => f.path === "P/Start.md").body, "![New:#Tone] ![Sub/New:##Tone] ![[Style]]");
  assert.equal(files.find(f => f.path === "Q/Start.md").body, "![Style:##Tone]");
});

test("source root stays fixed when an unmarked entry imports a marked note", async () => {
  const { plugin } = fixture({ "Entry.md": "", "P/_code-embed-root.md": "",
    "P/Bridge.md": "![Outside]", "Else/Outside.md": "ok" });
  assert.equal(await plugin.expand("![Bridge]", "Entry.md"), "ok");
  assert.match(await plugin.expand("![Outside]", "P/Bridge.md"), /not found in package/);
});

test("marked folders resolve existing includes throughout the package", async () => {
  const { plugin } = fixture({
    "Library/Prompts/_code-embed-root.md": "",
    "Library/Prompts/Tasks/Today/Start.md": "",
    "Library/Prompts/Templates/Common/Style.md": "## Tone\n![<<voice>>]\n## Data\n<voice>![Words:<<word>>]</voice>",
    "Library/Prompts/Shared/Vocabulary/Words.md": "<word>hello</word>",
    "Library/Prompts/Private/_code-embed-root.md": "",
    "Library/Prompts/Private/Common/Style.md": "private",
    "Archive/Common/Style.md": "outside"
  });
  const expand = ref => plugin.expand("![" + ref + "]", "Library/Prompts/Tasks/Today/Start.md");
  for (const name of ["Style", "Templates/Common/Style", "Common/Style", "Library/Prompts/Templates/Common/Style.md", "style"]) {
    assert.equal(await expand(name + ":##Tone"), "hello");
    assert.equal(await expand(name + ":<voice>"), "<voice>hello</voice>");
  }
  for (const name of ["Private/Common/Style", "Archive/Common/Style", "../Archive/Common/Style"])
    assert.match(await expand(name), /not found in package/);
});

test("shortened paths report duplicates and package-relative paths take priority", async () => {
  const { plugin } = fixture({
    "P/_code-embed-root.md": "", "P/Start.md": "",
    "P/A/Common/Style.md": "A", "P/B/Common/Style.md": "B",
    "P/Pick.md": "vault path", "P/P/Pick.md": "package path"
  });
  assert.match(await plugin.expand("![common/style]", "P/Start.md"), /ambiguous.*A\/Common\/Style.md, B\/Common\/Style.md/);
  assert.equal(await plugin.expand("![P/Pick]", "P/Start.md"), "package path");
});
