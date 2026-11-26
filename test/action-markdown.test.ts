import assert from "node:assert/strict";
import { snapshotName } from "../src/snapshot-name";
import { DEFAULT_SNAPSHOT_TEMPLATE } from "../src/settings";
import { test } from "node:test";
import {
  noteReferences,
  blockKind,
  expandBlock,
  expandNote,
  findFences,
  selectedKinds,
} from "../src/action-markdown";

const defaults = selectedKinds("plain, markdown, xml, ce");
const echo = async (ref: string) => "<" + ref + ">";

test("block actions recognize backtick and tilde fences by delimiter and language", () => {
  const source = "````md\n```\n~~~\n`````\n\n  ~~~~CE\n$[A]\n  ~~~~\n```\nlast";
  const blocks = findFences(source);
  assert.deepEqual(
    blocks.map((b) => [b.line, blockKind(b.language), b.closingWidth]),
    [
      [0, "markdown", 5],
      [5, "ce", 4],
      [8, "plain", 0],
    ],
  );
  assert.equal(source.slice(blocks[0].bodyStart, blocks[0].bodyEnd), "```\n~~~\n");
  assert.deepEqual(
    [...selectedKinds(" MD,ce, xml, java,codeembed")],
    ["markdown", "ce", "xml", "java"],
  );
});

test("An expanded note includes all fences and preserves properties and literal examples", async () => {
  const before = [
    "---",
    "example: ![A]",
    "---",
    "![A] $[B] `![C]` \\![D] ![pic](file.png) ![[Wiki]]",
    "",
    "```java",
    "![E]",
    "```",
    "",
    "~~~~md",
    "![F]",
    "~~~~",
    "![G]",
  ].join("\r\n");
  const after = before
    .replace("![A] $[B]", "<A> $[B]")
    .replace("![E]", "<E>")
    .replace("![F]", "<F>")
    .replace("![G]", "<G>");
  assert.equal(await expandNote(before, echo), after);
  assert.equal(await expandNote(after, echo), after);
});

test("Copy+ expands canonical references and preserves literal Markdown", async () => {
  const input = "![A] $[B] ![alt](url) ![label][id] ![[Wiki]] \\![C] \\$[D]";
  assert.equal(
    await expandBlock(input, echo),
    "<A> $[B] ![alt](url) ![label][id] ![[Wiki]] \\![C] \\$[D]",
  );
  assert.equal(await expandNote("``one\n![A]``\n\n![B]", echo, defaults), "``one\n![A]``\n\n<B>");
});

test("expansion preserves line endings and widens fences around inserted delimiters", async () => {
  const input = "~~~~\r\n![snippet]\r\n~~~~~\r\n";
  const result = await expandNote(input, async (_ref, local) => {
    assert.equal(local, "![snippet]\r\n");
    return "first\n~~~~~~\nlast";
  });
  assert.equal(result, "~~~~~~~\r\nfirst\r\n~~~~~~\r\nlast\r\n~~~~~~~\r\n");
  assert.equal(findFences(result).length, 1);
});

test("note expansion rejects an unresolved reference before exposing a partial edit", async () => {
  const input = "![available]\n\n```md\n![absent]\n```";
  const refs: string[] = [];
  await assert.rejects(
    expandNote(input, async (ref) => {
      refs.push(ref);
      if (ref === "absent") throw new Error("Missing fixture");
      return "found";
    }),
    /Missing fixture/,
  );
  assert.deepEqual(refs, ["available", "absent"]);
});

test("the note lock ignores properties, literal examples, images and escaped references", () => {
  const literal =
    "---\nexample: ![a]\n---\n`![example]` ![image](photo.jpg) ![[native]] \\![escaped] $[old]";
  assert.equal([...noteReferences(literal)].length, 0);
  assert.equal([...noteReferences(literal + "\n~~~java\n![yes]\n~~~")][0]?.ref, "yes");
});

test("snapshot names use local dates, custom patterns and distinct fallback versions", () => {
  const date = new Date(2026, 11, 6, 23, 59);
  assert.equal(
    snapshotName(DEFAULT_SNAPSHOT_TEMPLATE, "test", date, 1),
    "test.perm.20261206.v1.md",
  );
  assert.equal(snapshotName("[date]-[name]-[version].md", "test", date, 2), "20261206-test-2.md");
  assert.equal(snapshotName("[name].archive", "test", date, 2), "test.archive.v2.md");
  assert.throws(() => snapshotName("../[name].md", "test", date, 1));
});
