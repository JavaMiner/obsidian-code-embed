const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = path => fs.readFileSync(path, "utf8");

test("release metadata, funding and build output", () => {
  const pkg = require("../package.json"), lock = require("../package-lock.json");
  const manifest = require("../manifest.json");
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  for (const v of [lock.version, lock.packages[""].version, manifest.version]) assert.equal(v, pkg.version);
  assert.equal(require("../versions.json")[pkg.version], manifest.minAppVersion);
  assert.equal(pkg.license, "CC-BY-NC-4.0");
  assert.match(read("LICENSE"), /Attribution-NonCommercial 4\.0 International/);
  assert.equal(manifest.isDesktopOnly, false);
  for (const url of Object.values(manifest.fundingUrl)) assert.equal(new URL(url).protocol, "https:");
  assert.equal(manifest.fundingUrl.PayPal, "https://www.paypal.me/JakubWajda363");
  assert.equal(manifest.fundingUrl["Buy me a coffee"], "https://buymeacoffee.com/javaminer");
  for (const url of Object.values(manifest.fundingUrl)) assert.ok(read(".github/FUNDING.yml").includes(url));
  for (const path of ["styles.css", "manifest.json"]) assert.equal(read("dist/" + path), read(path));
  const built = read("dist/main.js");
  assert.doesNotMatch(built, /(?:require\s*\(|import\s*(?:\(|.*?from\s*)?)[\"']\.\/i18n/);
  const bundled = /^const CE_LOCALES = (.+);$/m.exec(built);
  assert.ok(bundled, "dist/main.js bundles the locale dictionary");
  const locales = JSON.parse(bundled[1]);
  const languages = ["de", "en", "es", "fr", "it", "nl", "pl"];
  assert.deepEqual(Object.keys(locales).sort(), languages);
  for (const language of languages)
    assert.deepEqual(locales[language], JSON.parse(read("src/i18n/" + language + ".json")));
});

test("seven guides share examples, with legacy syntax confined to migration", () => {
  let expected;
  for (const suffix of ["", ".pl", ".de", ".fr", ".es", ".nl", ".it"]) {
    const guide = read("README" + suffix + ".md");
    const sections = guide.replace(/```[^\n]*\n[\s\S]*?```/g, "").split(/^## /m);
    assert.equal(sections.length, 8);
    const samples = [...guide.matchAll(/`(!\[[^`]*?\]|\$\[[^`]*?\])`/g)].map(m => m[1]);
    if (expected) assert.deepEqual(samples, expected);
    expected = samples;
    assert.doesNotMatch(sections.slice(1, 6).join("\n"), /!\[\[|\$\[|!\[\.:/);
    assert.ok(sections[6].includes("![[Szablony:##Styl]]"));
  }
});

test("clipboard access remains write-only", () => {
  const source = read("src/main.js");
  assert.doesNotMatch(source, /clipboard\s*\.\s*read(?:Text)?\s*\(/);
  assert.match(source, /navigator\.clipboard\.writeText\(/);
});
