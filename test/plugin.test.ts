import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBundle } from "./bundle";
import manifest from "../manifest.json";
import pkg from "../package.json";
import versions from "../versions.json";
const { api, context } = loadBundle();
test("parameterized XML reference", () => {
  const p = api.parseRef(".:<<lh>>(8000)");
  assert.equal(p.range, "<<lh>>");
  assert.equal(p.args?.[0], "8000");
});
test("default English", () => assert.equal(api.t("view"), "View"));
test("Polish locale", () => {
  context.moment = { locale: () => "pl" };
  assert.equal(api.t("view"), "Podgląd");
  delete context.moment;
});
test("release versions match", () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal((versions as Record<string, string>)[pkg.version], manifest.minAppVersion);
});
