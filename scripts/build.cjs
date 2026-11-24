const fs = require("node:fs");

fs.mkdirSync("dist", { recursive: true });
for (const [source, name] of [
  ["src/main.js", "main.js"],
  ["manifest.json", "manifest.json"],
  ["styles.css", "styles.css"]
]) {
  fs.copyFileSync(source, "dist/" + name);
}
