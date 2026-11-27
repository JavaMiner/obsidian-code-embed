import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { buildSync } from "esbuild";

const attribution = ["NOTICE", "LICENSE"].map((file) => readFileSync(file, "utf8")).join("\n");
mkdirSync("dist", { recursive: true });
buildSync({
  entryPoints: ["src/entry.ts"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2018",
  external: ["obsidian", "@codemirror/view", "@codemirror/state", "@codemirror/commands"],
  outfile: "dist/main.js",
  banner: { js: "/*!\n" + attribution + "\n*/" },
});
for (const asset of ["manifest.json", "styles.css"]) copyFileSync(asset, "dist/" + asset);
