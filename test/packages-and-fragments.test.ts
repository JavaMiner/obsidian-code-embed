import { actionReferences } from "../src/action-markdown";
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBundle, hostFixture } from "./bundle";
import type { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import type { EditorView } from "@codemirror/view";
const { context: ctx, api, Plugin } = loadBundle();
const { REF_RE, formatEmbed, rewriteText } = api;
type Note = TFile & { body: string };
function fixture(notes: Record<string, string>) {
  const files = Object.entries(notes).map(([path, body]) =>
    hostFixture<Note>({
      path,
      body,
      name: path.split("/").pop(),
      extension: "md",
      basename: path.split("/").pop()!.replace(/\.md$/, ""),
    }),
  );
  const plugin = new Plugin();
  plugin.settings.maxDepth = 8;
  plugin.cache = new Map();
  plugin.app = hostFixture<App>({
    vault: {
      getFiles: () => files,
      getMarkdownFiles: () => files,
      getAbstractFileByPath: (path: string) => files.find((f) => f.path === path),
      cachedRead: async (file: Note) => file.body,
    },
    metadataCache: {
      getFirstLinkpathDest: (name: string) => files.find((f) => f.basename === name),
    },
  });
  return { plugin, files };
}

test("canonical forms, legacy input and native embeds", () => {
  for (const ref of [
    "S",
    "S:3-8",
    "S:#Style",
    "S:##Style",
    "S:##R#Style",
    "S:<x>",
    "S:<<x>>",
    "#Style",
    "##Style(English)",
    "<x>",
    "<<x>>(English)",
  ]) {
    assert.equal(formatEmbed(ref), "![" + ref + "]");
  }
  for (const raw of ["![[S:##Style]]", "$[S:##Style]", "![.:##Style]", "![S##Style]"])
    assert.equal(REF_RE().test(raw), false);
  for (const raw of ["![alt](image.png)", "![alt][image]"]) assert.equal(REF_RE().test(raw), false);
  assert.equal(rewriteText("![[Note#Head]] ![[Image.png]]", () => "Other").count, 0);
  assert.equal(
    rewriteText("$[.:##Old(a)] ![S##Old(a)]", (r) => r.replace("Old", "New")).text,
    "$[.:##Old(a)] ![S##Old(a)]",
  );
});

test("Markdown and XML expand identically with explicit forwarding", async () => {
  const body = "Reply in $1. Tone: ${2:neutral}.";
  const { plugin } = fixture({
    "A.md": "## H\n" + body + "\n## Next\n<x>" + body + "</x>",
    "B.md": "## H\n![A:##H($1)]\n![A:<<x>>]",
  });
  for (const raw of ["![##H(English)]", "![<<x>>(English)]"])
    assert.equal(await plugin.expand(raw, "A.md"), "Reply in English. Tone: neutral.");
  for (const raw of ["![[A:##H]]", "$[##H]", "![.:<<x>>]", "![A##H]"]) {
    assert.equal(await plugin.expand(raw, "A.md"), raw);
    assert.equal(plugin.rawRefs(raw).length, 0);
  }
  assert.equal(
    await plugin.expand("![B:##H(English)]", "A.md"),
    "Reply in English. Tone: neutral.\nReply in $1. Tone: neutral.",
  );
});

test("package scope, ambiguity, traversal, nested roots and local import context", async () => {
  const { plugin } = fixture({
    "P/_code-embed-root.md": "",
    "P/Start.md": "",
    "P/A/Style.md": "## Tone\n![##Local]\n## Local\nA",
    "P/B/Style.md": "B",
    "P/N/_code-embed-root.md": "",
    "P/N/Hidden.md": "inner",
    "Archive/Outside.md": "outside",
  });
  const render = (ref: string) => plugin.expand("![" + ref + "]", "P/Start.md");
  assert.equal(await render("A/Style:##Tone"), "A");
  assert.match(await render("Style"), /ambiguous.*P.*A\/Style.md, B\/Style.md/);
  for (const ref of [
    "Hidden",
    "N/Hidden",
    "Outside",
    "../Archive/Outside",
    "A/../../Archive/Outside",
    "A\\Style",
    "_code-embed-root",
    "N/_code-embed-root.md",
  ])
    assert.match(await render(ref), /not found in package.*package: P/);
  assert.equal(await plugin.expand("![Hidden]", "P/N/Entry.md"), "inner");
  assert.match(await plugin.expand("![Style]", "P/N/Entry.md"), /package: P\/N/);
  assert.equal(await plugin.expand("![Outside]", "unmarked.md"), "outside");
});

test("moving a package preserves root-relative paths; unmarking restores vault lookup", async () => {
  const { plugin, files } = fixture({
    "P/_code-embed-root.md": "",
    "P/Start.md": "",
    "P/Sub/Style.md": "ok",
    "Archive/Outside.md": "outside",
  });
  for (const folder of ["P", "Moved/P"]) {
    assert.equal(await plugin.expand("![Sub/Style]", folder + "/Start.md"), "ok");
    assert.match(await plugin.expand("![Outside]", folder + "/Start.md"), /not found in package/);
    if (folder === "P") {
      for (const file of files.filter((f) => f.path.startsWith("P/")))
        file.path = "Moved/" + file.path;
      plugin.packageIndex = null;
    }
  }
  files.splice(
    files.findIndex((f) => f.name === "_code-embed-root.md"),
    1,
  );
  plugin.packageIndex = null;
  assert.equal(await plugin.expand("![Outside]", "Moved/P/Start.md"), "outside");
});

test("moving a source out of a package reports a lost binding", async () => {
  const { plugin, files } = fixture({
    "Other/Style.md": "wrong",
    "P/Style.md": "right",
    "P/_code-embed-root.md": "",
    "P/Start.md": "![Style]",
  });
  const src = files.find((f) => f.basename === "Start")!;
  assert.equal(await plugin.expand(src.body, src.path), "right");
  src.path = "Start.md";
  plugin.packageIndex = null;
  plugin.saveData = async () => {};
  plugin.invalidate = plugin.scheduleValidate = () => {};
  await plugin.trackMovedSources(src, "P/Start.md");
  assert.match(await plugin.expand(src.body, src.path), /lost its target/);
});

test("numbered and joined arguments are shared by XML and Markdown", async () => {
  const body = "$1 / $9 / $* / ${2:fallback}";
  const { plugin } = fixture({ "F.md": "## H\n" + body + "\n## End\n<x>" + body + "</x>" });
  const args = '(one, "", 3, 4, 5, 6, 7, 8, nine)';
  for (const selector of ["##H", "<<x>>"])
    assert.equal(
      await plugin.expand("![" + selector + args + "]", "F.md"),
      "one / nine / one, , 3, 4, 5, 6, 7, 8, nine / fallback",
    );
});

test("package-aware Rename changes only references to the old target", async () => {
  const { plugin, files } = fixture({
    "P/_code-embed-root.md": "",
    "Q/_code-embed-root.md": "",
    "P/Start.md": "![Style:#Tone] ![Sub/Style:##Tone] ![[Style]]",
    "Q/Start.md": "![Style:##Tone]",
    "P/Sub/New.md": "## Tone\nP",
    "Q/Style.md": "Q",
  });
  plugin.app.vault.process = async (f, update) => {
    const note = f as Note;
    return (note.body = update(note.body));
  };
  plugin.withRenameMute = (cb) => cb();
  await plugin.renameFileRefs(
    files.find((f) => f.basename === "New")!,
    "P/Sub/Style.md",
  );
  assert.equal(
    files.find((f) => f.path === "P/Start.md")!.body,
    "![New:#Tone] ![Sub/New:##Tone] ![[Style]]",
  );
  assert.equal(files.find((f) => f.path === "Q/Start.md")!.body, "![Style:##Tone]");
});

test("source root stays fixed when an unmarked entry imports a marked note", async () => {
  const { plugin } = fixture({
    "Entry.md": "",
    "P/_code-embed-root.md": "",
    "P/Bridge.md": "![Outside]",
    "Else/Outside.md": "ok",
  });
  assert.equal(await plugin.expand("![Bridge]", "Entry.md"), "ok");
  assert.match(await plugin.expand("![Outside]", "P/Bridge.md"), /not found in package/);
});

test("marked folders resolve existing includes throughout the package", async () => {
  const { plugin } = fixture({
    "Library/Prompts/_code-embed-root.md": "",
    "Library/Prompts/Tasks/Today/Start.md": "",
    "Library/Prompts/Templates/Common/Style.md":
      "## Tone\n![<<voice>>]\n## Data\n<voice>![Words:<<word>>]</voice>",
    "Library/Prompts/Shared/Vocabulary/Words.md": "<word>hello</word>",
    "Library/Prompts/Private/_code-embed-root.md": "",
    "Library/Prompts/Private/Common/Style.md": "private",
    "Archive/Common/Style.md": "outside",
  });
  const expand = (ref: string) =>
    plugin.expand("![" + ref + "]", "Library/Prompts/Tasks/Today/Start.md");
  for (const name of [
    "Style",
    "Templates/Common/Style",
    "Common/Style",
    "Library/Prompts/Templates/Common/Style.md",
    "style",
  ]) {
    assert.equal(await expand(name + ":##Tone"), "hello");
    assert.equal(await expand(name + ":<voice>"), "<voice>hello</voice>");
  }
  for (const name of ["Private/Common/Style", "Archive/Common/Style", "../Archive/Common/Style"])
    assert.match(await expand(name), /not found in package/);
});

test("shortened paths report duplicates and package-relative paths take priority", async () => {
  const { plugin } = fixture({
    "P/_code-embed-root.md": "",
    "P/Start.md": "",
    "P/A/Common/Style.md": "A",
    "P/B/Common/Style.md": "B",
    "P/Pick.md": "vault path",
    "P/P/Pick.md": "package path",
  });
  assert.match(
    await plugin.expand("![common/style]", "P/Start.md"),
    /ambiguous.*A\/Common\/Style.md, B\/Common\/Style.md/,
  );
  assert.equal(await plugin.expand("![P/Pick]", "P/Start.md"), "package path");
});

const products = [
  "# Products",
  "- <bi>Bioderma Sensibio Gel Moussant</bi>",
  "  (micellar gel for sensitive skin, 500 ml): https://gemini.pl/bioderma",
  "- <lon>L'Oréal Revitalift Laser</lon> night cream with retinol and niacinamide, 50 ml",
  "- <lod>L'Oréal Paris Revitalift Clinical</lod> rozświetlający cream with vitamin C and SPF 50",
  "",
  "# Directions",
  "- ![<<bi>>] - usually before bed, before applying ![[.:<<lon>>]]",
  "- ![<<lon>>] - at night, most days",
].join("\n");

test("same-note list items expand XML selectors in prose and bash blocks", async () => {
  const path = "Prompts/Notes/Routine.md";
  const expected = products
    .replace("![<<bi>>]", "Bioderma Sensibio Gel Moussant")
    .replaceAll("![<<lon>>]", "L'Oréal Revitalift Laser");
  for (const marked of [false, true]) {
    const notes: Record<string, string> = marked ? { "Prompts/_code-embed-root.md": "" } : {};
    const { plugin } = fixture({ ...notes, [path]: products });
    assert.equal(await plugin.expand(products, path), expected);
    assert.equal(await plugin.expand(products, path, [], false, products), expected);
    // A newly opened editor can provide its block before Obsidian exposes a file path.
    assert.equal(await plugin.expand(products, "", [], false, products), expected);
  }
});

test("reading view restores two XML selectors split by Markdown HTML processing", async () => {
  const path = "Prompts/Notes/Routine.md";
  const { plugin } = fixture({ [path]: products, "Prompts/_code-embed-root.md": "" });
  ctx.NodeFilter = { SHOW_TEXT: 4 };
  const parent = {
    closest: (selector: string): object | null => (selector.startsWith("p,") ? parent : null),
  };
  const nodes = ["- ![<", ">] - usually before bed", "- ![<", ">] - at night"].map((data) => ({
    data,
    length: data.length,
    parentElement: parent,
  }));
  let index = 0;
  const restored: unknown[] = [];
  const root = {
    textContent: nodes.map((node) => node.data).join(""),
    ownerDocument: {
      createTreeWalker: () => ({ nextNode: () => nodes[index++] }),
      createElement: () => ({}),
      createRange: () => ({
        start: [] as number[],
        end: [] as number[],
        setStart(node: (typeof nodes)[number], offset: number) {
          this.start = [nodes.indexOf(node), offset];
        },
        setEnd(node: (typeof nodes)[number], offset: number) {
          this.end = [nodes.indexOf(node), offset];
        },
        deleteContents() {},
        insertNode(host: { start: number[]; end: number[] }) {
          host.start = this.start;
          host.end = this.end;
        },
      }),
    },
  };
  plugin.renderMarkdownRef = async (host, ref, sourcePath) => {
    const range = hostFixture<{ start: number[]; end: number[] }>(host);
    restored.push([range.start, range.end, await plugin.resolve(ref, sourcePath)]);
  };
  await plugin.restoreLocalTagEmbeds(
    hostFixture<HTMLElement>(root),
    path,
    hostFixture<MarkdownPostProcessorContext>({
      getSectionInfo: () => ({
        text: products.split("\n").slice(-2).join("\n"),
        lineStart: 7,
        lineEnd: 8,
      }),
    }),
  );
  assert.deepEqual(restored, [
    [[2, 2], [3, 2], "L'Oréal Revitalift Laser"],
    [[0, 2], [1, 2], "Bioderma Sensibio Gel Moussant"],
  ]);
});

test("reading view unwraps a single paragraph without losing inline markup", async () => {
  const path = "Prompt.md";
  const { plugin } = fixture({ [path]: "<source_file>js ce-test.js</source_file>" });
  const text = { textContent: "js ce-test.js" };
  const inlineCode = { tagName: "CODE" };
  const replacements: unknown[][] = [];
  const paragraph = {
    matches: (selector: string) => selector === "p",
    childNodes: [text, inlineCode],
    replaceWith: (...nodes: unknown[]) => replacements.push(nodes),
  };
  const host = {
    dataset: {},
    classList: { remove() {}, add() {}, toggle() {} },
    removeAttribute() {},
    replaceChildren() {},
  };
  plugin.renderMd = async (markdown, el) => {
    assert.equal(markdown, "js ce-test.js");
    Object.assign(el, {
      firstElementChild: paragraph,
      childElementCount: replacements.length ? 2 : 1,
    });
  };
  const renderContext = hostFixture<MarkdownPostProcessorContext>({ addChild() {} });
  await plugin.renderMarkdownRef(
    hostFixture<HTMLElement>(host),
    "<<source_file>>",
    path,
    renderContext,
  );
  await plugin.renderMarkdownRef(
    hostFixture<HTMLElement>({ ...host, dataset: {} }),
    "<<source_file>>",
    path,
    renderContext,
  );
  assert.deepEqual(replacements, [[text, inlineCode]]);
});

test("Live Preview unwraps inline embeds before measuring the widget", async () => {
  const path = "Prompt.md";
  const { plugin } = fixture({ [path]: "<source_file>js ce-test.js</source_file>" });
  const text = { textContent: "js ce-test.js" };
  let rendered;
  ctx.createEl = (tag: string) => ({
    tag,
    dataset: {},
    classList: { toggle() {} },
  });
  plugin.addChild = (child) => child;
  plugin.renderMd = async (markdown, el) => {
    assert.equal(markdown, text.textContent);
    Object.assign(el, {
      childElementCount: 1,
      firstElementChild: {
        matches: (selector: string) => selector === "p",
        childNodes: [text],
        replaceWith: (...nodes: unknown[]) => {
          rendered = nodes;
        },
      },
    });
  };
  try {
    const widget = new api.MarkdownEmbedWidget(plugin, "<<source_file>>", path, 0, false);
    const host = widget.toDOM(hostFixture<EditorView>({ requestMeasure() {} }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(hostFixture<{ tag: string }>(host).tag, "span");
    assert.deepEqual(rendered, [text]);
  } finally {
    delete ctx.createEl;
  }
});

test("block actions resolve nested dollar references and use the unsaved note snapshot", async () => {
  const { plugin } = fixture({ "A.md": "## Start\nstale", "B.md": "## Step\n$[A:##Start]" });
  const rules = {
    references: actionReferences,
    source: { path: "A.md", text: "## Start\ncurrent" },
  };
  assert.equal(
    await plugin.expand("$[B:##Step]", "A.md", [], false, null, undefined, rules),
    "current",
  );
});

test("Permanent distinguishes errors in source text from unresolved references", async () => {
  const { plugin } = fixture({ "Example.md": "[error: expected output]" });
  const rules = { failOnError: true, references: actionReferences };
  const expand = (source: string) =>
    plugin.expand(source, "Example.md", [], false, null, undefined, rules);
  assert.equal(await expand("$[Example]"), "[error: expected output]");
  await assert.rejects(expand("$[Missing]"));
});
