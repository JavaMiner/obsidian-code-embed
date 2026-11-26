import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blockKind,
  expandBlock,
  expandNote,
  findFences,
  selectedKinds,
} from "../src/action-markdown";

const defaults = selectedKinds("plain, markdown, xml, ce");
const echo = async (ref: string) => "<" + ref + ">";

test("block actions recognize backtick and tilde fences by delimiter and language", () => {
  const source = "````md\n```\n~~~\n`````\n\n  ~~~~XMLCE\n$[A]\n  ~~~~\n```\nlast";
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
    [...selectedKinds(" MD,xmlce, xml, java,codeembed")],
    ["markdown", "ce", "xml", "java"],
  );
});

test("Permanent replaces dollar references only in prose and selected fences", async () => {
  const before = [
    "---",
    "example: $[A]",
    "---",
    "$[A] ![B] `$[C]` \\$[D] ![pic](file.png) ![[Wiki]]",
    "",
    "```java",
    "$[E]",
    "```",
    "",
    "~~~~md",
    "$[F]",
    "~~~~",
    "$[G]",
  ].join("\r\n");
  const after = before
    .replace("$[A] ![B]", "<A> ![B]")
    .replace("$[F]", "<F>")
    .replace("$[G]", "<G>");
  assert.equal(await expandNote(before, defaults, "permanent", echo), after);
  assert.equal(await expandNote(after, defaults, "permanent", echo), after);
});

test("Copy+ expands both reference forms and preserves literal Markdown", async () => {
  const input = "![A] $[B] ![alt](url) ![label][id] ![[Wiki]] \\![C] \\$[D]";
  assert.equal(
    await expandBlock(input, "copy", echo),
    "<A> <B> ![alt](url) ![label][id] ![[Wiki]] \\![C] \\$[D]",
  );
  assert.equal(
    await expandNote("``one\n$[A]``\n\n$[B]", defaults, "copy", echo),
    "``one\n$[A]``\n\n<B>",
  );
});

test("expansion preserves line endings and widens fences around inserted delimiters", async () => {
  const input = "~~~~\r\n$[snippet]\r\n~~~~~\r\n";
  const result = await expandNote(input, defaults, "permanent", async (_ref, local) => {
    assert.equal(local, "$[snippet]\r\n");
    return "first\n~~~~~~\nlast";
  });
  assert.equal(result, "~~~~~~~\r\nfirst\r\n~~~~~~\r\nlast\r\n~~~~~~~\r\n");
  assert.equal(findFences(result).length, 1);
});

test("note expansion rejects an unresolved reference before exposing a partial edit", async () => {
  const input = "$[available]\n\n```md\n$[absent]\n```";
  const refs: string[] = [];
  await assert.rejects(
    expandNote(input, defaults, "permanent", async (ref) => {
      refs.push(ref);
      if (ref === "absent") throw new Error("Missing fixture");
      return "found";
    }),
    /Missing fixture/,
  );
  assert.deepEqual(refs, ["available", "absent"]);
});
