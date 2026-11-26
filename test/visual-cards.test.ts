import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fixture } from "./fixture";
const root = "test/visual-vault/";
const read = (path: string) => readFileSync(root + path, "utf8").replace(/\r\n/g, "\n");
const notes: Record<string, string> = {};
for (const folder of ["Dane", "Próby"])
  for (const file of readdirSync(root + folder)) {
    const path = folder + "/" + file;
    notes[path] = read(path);
  }
for (const path of Object.keys(notes).filter((p) => p.startsWith("Próby/"))) {
  const [title] = notes[path].split("\n");
  test(title.slice(2), async () => {
    const { plugin } = fixture(notes);
    const source = notes[path].split("## Próba na żywo\n\n")[1].split("\n\n## ")[0].trim();
    const unwrap = (text: string) => text.replace(/^```text\n|\n```$/g, "");
    const actual = (await plugin.expand(unwrap(source), path)).trim();
    if (path.endsWith("CE-14.md")) {
      assert.match(actual, /7-8/);
      assert.match(actual, /error/i);
      return;
    }
    const expected = notes[path]
      .split("## Oczekiwany efekt\n\n")[1]
      .split("\n\n## Próba")[0]
      .trim()
      .split("\n\n")
      .slice(1)
      .join("\n\n");
    assert.equal(actual, unwrap(expected));
  });
}
