const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const read = path => fs.readFileSync(path, "utf8");

test("release metadata, funding and build output", () => {
  const pkg = require("../package.json"), lock = require("../package-lock.json");
  const manifest = require("../manifest.json");
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  for (const v of [lock.version, lock.packages[""].version, manifest.version]) assert.equal(v, pkg.version);
  assert.equal(require("../versions.json")[pkg.version], manifest.minAppVersion);
  assert.equal(pkg.license, "Apache-2.0");
  assert.equal(lock.packages[""].license, pkg.license);
  assert.match(read("LICENSE"), /Apache License\s+Version 2\.0/);
  assert.equal(manifest.isDesktopOnly, false);
  for (const url of Object.values(manifest.fundingUrl)) assert.equal(new URL(url).protocol, "https:");
  assert.equal(manifest.fundingUrl.PayPal, "https://www.paypal.me/JakubWajda363");
  assert.equal(manifest.fundingUrl["Buy me a coffee"], "https://buymeacoffee.com/javaminer");
  for (const url of Object.values(manifest.fundingUrl)) assert.ok(read(".github/FUNDING.yml").includes(url));
  for (const path of ["styles.css", "manifest.json"]) assert.equal(read("dist/" + path), read(path));
  const built = read("dist/main.js");
  assert.ok(built.includes(read("LICENSE")));
  assert.ok(built.includes(read("NOTICE")));
  assert.doesNotMatch(built, /(?:require\s*\(|import\s*(?:\(|.*?from\s*)?)[\"']\.\/i18n/);
  const bundled = /^const CE_LOCALES = (.+);$/m.exec(built);
  assert.ok(bundled, "dist/main.js bundles the locale dictionary");
  const locales = JSON.parse(bundled[1]);
  const languages = ["de", "en", "es", "fr", "it", "nl", "pl"];
  assert.deepEqual(Object.keys(locales).sort(), languages);
  for (const language of languages)
    assert.deepEqual(locales[language], JSON.parse(read("src/i18n/" + language + ".json")));
});

test("seven guides share examples, using only canonical syntax", () => {
  let expected;
  for (const suffix of ["", ".pl", ".de", ".fr", ".es", ".nl", ".it"]) {
    const guide = read("README" + suffix + ".md");
    const sections = guide.replace(/```[^\n]*\n[\s\S]*?```/g, "").split(/^## /m);
    assert.equal(sections.length, 7);
    const samples = [...guide.matchAll(/`(!\[[^`]*?\]|\$\[[^`]*?\])`/g)].map(m => m[1].replace(/[\p{L}\p{M}]+/gu, "word"));
    if (expected) assert.deepEqual(samples, expected);
    expected = samples;
    assert.doesNotMatch(sections.join("\n"), /!\[\[|\$\[|!\[\.:|!\[[\p{L}]+#/u);
  }
});

test("clipboard access remains write-only", () => {
  const source = read("src/main.js");
  assert.doesNotMatch(source, /clipboard\s*\.\s*read(?:Text)?\s*\(/);
  assert.match(source, /navigator\.clipboard\.writeText\(/);
});

test("the build embeds dictionaries for both LF and Windows CRLF checkouts", t => {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "code-embed-build-"));
  t.after(() => fs.rmSync(checkout, { recursive: true, force: true }));
  fs.cpSync("src", path.join(checkout, "src"), { recursive: true });
  for (const file of ["manifest.json", "styles.css", "LICENSE", "NOTICE"])
    fs.copyFileSync(file, path.join(checkout, file));

  const source = read("src/main.js");
  for (const newline of ["\n", "\r\n"]) {
    fs.writeFileSync(path.join(checkout, "src/main.js"), source.replace(/\r?\n/g, newline));
    execFileSync(process.execPath, [path.resolve("scripts/build.cjs")], { cwd: checkout });
    const artifact = read(path.join(checkout, "dist/main.js"));
    const declaration = /^const CE_LOCALES = (.+);$/m.exec(artifact);
    assert.ok(declaration, "artifact must declare translations before the plugin uses them");
    assert.ok(declaration.index < artifact.indexOf("Object.values(CE_LOCALES)"));
    for (const [language, labels] of Object.entries(JSON.parse(declaration[1])))
      assert.deepEqual(labels, JSON.parse(read("src/i18n/" + language + ".json")));
  }
});
