import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBundle } from "./bundle";
const { api } = loadBundle();
test("single brackets and local shorthand", () => {
  const { parseRef, REF_RE } = api;
  const refs = [..."![x] ![<tag>] ![<<tag>>] ![#Title] ![##Title]".matchAll(REF_RE())];
  assert.equal(refs.length, 5);
  assert.equal(parseRef(refs[0].groups!.ref).name, "x");
  assert.equal(parseRef(refs[1].groups!.ref).name, ".");
  assert.equal(parseRef(refs[4].groups!.ref).range, "##Title");
  assert.equal(REF_RE().test("![alt](img.png)"), false);
  assert.equal(REF_RE().test("$#Title"), false);
});
