import { TFolder, type TFile, type TAbstractFile } from "obsidian";
import { t } from "./locale";
export type IndexedFile = Pick<TFile, "path" | "name" | "basename" | "extension"> & {
  actual?: TFile;
};
export type Lookup<F> = { file: F; error?: never } | { error: string; file?: never };

export function isVaultFolder(file: TAbstractFile | null | undefined): file is TFolder {
  return Boolean(
    file && (file instanceof TFolder || ("children" in file && Array.isArray(file.children))),
  );
}

export const MARKER = "_code-embed-root.md";
const folderOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
export const relativeTo = (root: string, path: string) =>
  root ? path.slice(root.length + 1) : path;
export const markerPath = (root: string) => (root && root !== "/" ? root + "/" : "") + MARKER;

export class PackageIndex<F extends IndexedFile = TFile> {
  readonly roots: Set<string>;
  readonly groups = new Map<string, F[]>();
  constructor(files: F[]) {
    this.roots = new Set(files.filter((f) => f.name === MARKER).map((f) => folderOf(f.path)));
    for (const file of files) {
      if (file.name === MARKER) continue;
      const root = this.root(file.path);
      if (root === null) continue;
      if (!this.groups.has(root)) this.groups.set(root, []);
      this.groups.get(root)!.push(file);
    }
  }

  root(path: string): string | null {
    let folder = folderOf(path);
    while (!this.roots.has(folder)) {
      if (!folder) return null;
      folder = folderOf(folder);
    }
    return folder;
  }

  lookup(name: string, root: string): Lookup<F> {
    const available = this.groups.get(root) || [];
    const safe = !name.includes("\\") && name.split("/").every((s) => s && s !== "." && s !== "..");
    const linkKey = (path: string) => path.normalize("NFC").toLowerCase();
    const key = linkKey(name);
    const matches = (path: string) => linkKey(path) === key || linkKey(path) === key + ".md";
    let hits: F[] = [];
    if (safe && name.includes("/")) {
      hits = available.filter((file) => matches(relativeTo(root, file.path)));
      if (!hits.length) hits = available.filter((file) => matches(file.path));
      if (!hits.length) {
        // Obsidian can shorten a link to the trailing folders that distinguish its target.
        hits = available.filter((file) => {
          const path = linkKey(relativeTo(root, file.path));
          return path.endsWith("/" + key) || path.endsWith("/" + key + ".md");
        });
      }
    } else if (safe) {
      hits = available.filter((file) => matches(file.name));
      if (hits.length > 1 && key.endsWith(".md")) {
        const atRoot = hits.filter((file) => linkKey(relativeTo(root, file.path)) === key);
        if (atRoot.length === 1) hits = atRoot;
      }
    }
    if (hits.length === 1 && this.root(hits[0].path) === root) return { file: hits[0] };
    const where = " (" + t("package") + ": " + (root || "/") + ")";
    return {
      error:
        hits.length > 1
          ? t("ambiguous") +
            ": " +
            name +
            where +
            " — " +
            hits
              .map((f) => relativeTo(root, f.path))
              .sort()
              .join(", ")
          : t("notInPackage") + ": " + name + where,
    };
  }
}

export function isVaultFile(file: TAbstractFile | null): file is TFile {
  return !!file && "extension" in file && typeof file.extension === "string";
}
