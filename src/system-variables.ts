export const systemKeys = [
  "package",
  "package-path",
  "note",
  "note-path",
  "folder",
  "vault",
  "app",
  "language",
  "locale",
  "platform",
  "timezone",
] as const;

export function systemKey(ref: string) {
  const match = /^(?:<<sys:([\w.-]+)>>|<sys:([\w.-]+)>)$/.exec(ref.trim());
  return match?.[1] ?? match?.[2];
}

export interface SystemContext {
  path: string;
  root: string | null;
  vault: string;
  app: string;
  language: string;
  locale: string;
  platform: string;
  timezone: string;
}

export function systemValue(key: string, context: SystemContext): string | undefined {
  const { path, root } = context;
  const slash = path.lastIndexOf("/");
  switch (key) {
    case "package":
      return root === null ? "" : root.split("/").pop() || context.vault;
    case "package-path":
      return root === null ? "" : root || "/";
    case "note":
      return path.slice(slash + 1).replace(/\.md$/i, "");
    case "note-path":
      return path;
    case "folder":
      return slash < 0 ? "/" : path.slice(0, slash);
    case "vault":
    case "app":
    case "language":
    case "locale":
    case "platform":
    case "timezone":
      return context[key];
  }
}
