const fs = require("node:fs");

const languages = ["en", "pl", "de", "fr", "es", "nl", "it"];
const locales = Object.fromEntries(languages.map(language => [
  language,
  JSON.parse(fs.readFileSync(`src/i18n/${language}.json`, "utf8"))
]));

fs.mkdirSync("dist", { recursive: true });
const source = fs.readFileSync("src/main.js", "utf8");
const prelude = "'use strict';\nconst CE_LOCALES = " + JSON.stringify(locales) + ";\n";
fs.writeFileSync("dist/main.js", prelude + source);
for (const name of ["manifest.json", "styles.css"]) {
  fs.copyFileSync(name, "dist/" + name);
}
