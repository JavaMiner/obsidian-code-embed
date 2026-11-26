import { loadBundle, hostFixture } from "./bundle";
import type { App, TFile } from "obsidian";
export const bundle = loadBundle();
const { Plugin } = bundle;
export type Note = TFile & { body: string };
export function fixture(notes: Record<string, string>) {
  const files = Object.entries(notes).map(([path, body]) =>
    hostFixture<Note>({
      path,
      body,
      name: path.split("/").pop(),
      extension: "md",
      basename: path.split("/").pop()!.replace(/\.md$/, ""),
    }),
  );
  const plugin = new Plugin();
  plugin.settings.maxDepth = 8;
  plugin.cache = new Map();
  plugin.app = hostFixture<App>({
    vault: {
      getFiles: () => files,
      getMarkdownFiles: () => files,
      getAbstractFileByPath: (path: string) => files.find((f) => f.path === path),
      cachedRead: async (file: Note) => file.body,
    },
    metadataCache: {
      getFirstLinkpathDest: (name: string) => files.find((f) => f.basename === name),
    },
  });
  return { plugin, files };
}
