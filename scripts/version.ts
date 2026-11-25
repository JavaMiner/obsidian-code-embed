import { readFileSync, writeFileSync } from "node:fs";
import { version } from "../package.json";
import manifest from "../manifest.json";

if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Expected a version in X.Y.Z format");
const versions: Record<string, string> = JSON.parse(readFileSync("versions.json", "utf8"));

function writeJson(path: string, value: object) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
writeJson("manifest.json", { ...manifest, version });
writeJson("versions.json", { ...versions, [version]: manifest.minAppVersion });
