import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULTS, readSettings } from "../src/settings";

test("advanced appearance overrides default to the stylesheet values", () => {
  const settings = readSettings({ copyGutter: 12, mobileTop: "x" });
  assert.equal(settings.copyGutter, 12);
  assert.equal(settings.mobileTop, 0);
  assert.equal(DEFAULTS.showAdvancedAppearance, false);
  const css = fs.readFileSync("styles.css", "utf8");
  for (const name of [
    "--ce-gutter",
    "--ce-action-font",
    "--ce-action-gap",
    "--ce-indent",
    "--ce-touch",
    "--ce-mobile-gap",
    "--ce-mobile-top",
  ])
    assert.ok(css.includes("var(" + name + ","), name);
});
