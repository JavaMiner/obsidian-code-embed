import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadBundle } from "./bundle";
import pkg from "../package.json";
import lock from "../package-lock.json";
import manifest from "../manifest.json";
import versions from "../versions.json";
const read = (path: string) => fs.readFileSync(path, "utf8");

test("release metadata, funding and build output", () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  for (const v of [lock.version, lock.packages[""].version, manifest.version])
    assert.equal(v, pkg.version);
  assert.equal((versions as Record<string, string>)[pkg.version], manifest.minAppVersion);
  assert.equal(pkg.license, "Apache-2.0");
  assert.equal(lock.packages[""].license, pkg.license);
  assert.match(read("LICENSE"), /Apache License\s+Version 2\.0/);
  assert.equal(manifest.isDesktopOnly, false);
  for (const url of Object.values(manifest.fundingUrl))
    assert.equal(new URL(url).protocol, "https:");
  assert.equal(manifest.fundingUrl.PayPal, "https://www.paypal.me/JakubWajda363");
  assert.equal(manifest.fundingUrl["Buy me a coffee"], "https://buymeacoffee.com/javaminer");
  for (const url of Object.values(manifest.fundingUrl))
    assert.ok(read(".github/FUNDING.yml").includes(url));
  for (const path of ["styles.css", "manifest.json"])
    assert.equal(read("dist/" + path), read(path));
  assert.doesNotMatch(read("dist/styles.css"), /!\s*important\b/i);
  const built = read("dist/main.js");
  assert.ok(built.includes(read("LICENSE")));
  assert.ok(built.includes(read("NOTICE")));
  assert.doesNotMatch(built, /(?:require\s*\(|import\s*(?:\(|.*?from\s*)?)[\"']\.\/i18n/);
  const locales: Record<string, Record<string, string>> = loadBundle().api.CE_LOCALES;
  const languages = ["de", "en", "es", "fr", "it", "nl", "pl"];
  assert.deepEqual(Object.keys(locales).sort(), languages);
  for (const language of languages)
    assert.deepEqual({ ...locales[language] }, JSON.parse(read("src/i18n/" + language + ".json")));
});

test("seven guides share examples, using only canonical syntax", () => {
  let expected;
  for (const suffix of ["", ".pl", ".de", ".fr", ".es", ".nl", ".it"]) {
    const guide = read("README" + suffix + ".md");
    const sections = guide.replace(/```[^\n]*\n[\s\S]*?```/g, "").split(/^## /m);
    assert.equal(sections.length, 7);
    const samples = [...guide.matchAll(/`(!\[[^`]*?\]|\$\[[^`]*?\])`/g)].map((m) =>
      m[1].replace(/[\p{L}\p{M}]+/gu, "word"),
    );
    if (expected) assert.deepEqual(samples, expected);
    expected = samples;
    const guideText = sections.join("\n").replace(/`\$\[[\p{L}]+\]`/gu, "");
    assert.doesNotMatch(guideText, /!\[\[|\$\[|!\[\.:|!\[[\p{L}]+#/u);
  }
});

test("clipboard access remains write-only", () => {
  const source = read("dist/main.js");
  assert.doesNotMatch(source, /clipboard\s*\.\s*read(?:Text)?\s*\(/);
  assert.match(source, /navigator\.clipboard\.writeText\(/);
});

test("the build embeds dictionaries for both LF and Windows CRLF checkouts", (t) => {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "code-embed-build-"));
  t.after(() => fs.rmSync(checkout, { recursive: true, force: true }));
  fs.cpSync("src", path.join(checkout, "src"), { recursive: true });
  for (const file of ["manifest.json", "styles.css", "LICENSE", "NOTICE"])
    fs.copyFileSync(file, path.join(checkout, file));

  const sources = fs
    .readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(?:ts|json)$/.test(file));
  for (const newline of ["\n", "\r\n"]) {
    for (const file of sources) {
      const relative = path.join("src", file);
      fs.writeFileSync(path.join(checkout, relative), read(relative).replace(/\r?\n/g, newline));
    }
    execFileSync(
      process.execPath,
      ["--require", require.resolve("tsx/cjs"), path.resolve("scripts/build.ts")],
      { cwd: checkout },
    );
    const locales = loadBundle(path.join(checkout, "dist/main.js")).api.CE_LOCALES;
    for (const [language, labels] of Object.entries(locales))
      assert.deepEqual({ ...labels }, JSON.parse(read("src/i18n/" + language + ".json")));
  }
});
