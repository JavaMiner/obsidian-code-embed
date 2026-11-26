/** Format a sibling Markdown filename using the local calendar date. */
export function snapshotName(template: string, name: string, day: Date, version: number) {
  const date = [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("");
  const values: Record<string, string> = { name, date, version: String(version) };
  const pattern = template.trim().replace(/\.md$/i, "");
  if (!pattern || /[\\/<>:"|?*]/.test(pattern) || [...pattern].some((c) => c.charCodeAt(0) < 32))
    throw new Error("Enter a filename without a folder or reserved characters.");
  const stem = pattern.replace(/\[(name|date|version)\]/g, (_, key: string) => values[key]);
  if (/^[. ]+$/.test(stem) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(stem))
    throw new Error("Choose a valid Markdown filename.");
  return stem + (!pattern.includes("[version]") && version > 1 ? ".v" + version : "") + ".md";
}
