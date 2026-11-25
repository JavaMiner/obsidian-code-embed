import { readFileSync } from "node:fs";
import { runInNewContext, type Context } from "node:vm";
import type CodeEmbedPlugin from "../src/main";
import type * as fragments from "../src/fragments";
import type * as locale from "../src/locale";
import type { MarkdownEmbedWidget } from "../src/editor";

type TestApi = Pick<typeof fragments, "parseRef" | "REF_RE" | "formatEmbed" | "rewriteText"> &
  Pick<typeof locale, "t" | "CE_LOCALES"> & { MarkdownEmbedWidget: typeof MarkdownEmbedWidget };
const hostTypes = new Proxy(
  {},
  {
    get(_, key) {
      if (key === "requireApiVersion") return () => false;
      if (key === "getLanguage") return undefined;
      if (key === "StateEffect") return { define: () => ({}) };
      return class {};
    },
  },
);

export function loadBundle(path = "dist/main.js", globals: Context = {}) {
  const context: Context = { module: { exports: {} }, require: () => hostTypes, ...globals };
  context.window = context;
  context.createSpan = () => ({});
  runInNewContext(readFileSync(path, "utf8"), context, { filename: path });
  const api: TestApi = runInNewContext(
    "({ parseRef, REF_RE, formatEmbed, rewriteText, MarkdownEmbedWidget, t, CE_LOCALES })",
    context,
  );
  const Plugin = context.module.exports as new () => CodeEmbedPlugin;
  return { context, api, Plugin };
}

// Fixtures implement only the host operations exercised by each test.
export function hostFixture<T>(fixture: unknown): T {
  return fixture as T;
}
