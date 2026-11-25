import { CE_LOCALES, t } from "./locale";

// A local selector starts with # or <. Named sources require a colon before a selector.
export const REF_RE = () =>
  /(?<esc>\\)?(?<all>!\[(?!\s*(?:\.\s*(?:[:\]]|$)|:))(?<ref>(?:\s*[#<][^[\]\r\n]*|[^[\]:#\r\n]+(?::[^[\]\r\n]+)?))\](?![[(\]]))/g;
export const hasEmbed = (text: string) => REF_RE().test(text);

const errorLabels = [...new Set(Object.values(CE_LOCALES).map((labels) => labels.errorLabel))];
export const ERROR_PATTERN = new RegExp("\\[(?:" + errorLabels.join("|") + "): ([^\\]]*)\\]", "g");
export const firstError = (text: string) => new RegExp(ERROR_PATTERN.source).exec(text)?.[1];
export const formatError = (message: string) => "[" + t("errorLabel") + ": " + message + "]";
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const markErrors = (md: string) =>
  md.replace(ERROR_PATTERN, (m) => '<span class="ce-err">' + escapeHtml(m) + "</span>");
export const hasErrors = (s: string) => firstError(s) !== undefined;
export function splitArgs(s: string) {
  const out = [];
  let cur = "",
    q = null;
  for (const ch of s) {
    if (q) {
      if (ch === q) {
        q = null;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "`") {
      q = ch;
      continue;
    }
    if (ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}

export function applyArgs(text: string, args: string[], hasParens: boolean) {
  return text.replace(
    /\\\$|\$\{([1-9]):([^}]*)\}|\$([1-9*])/g,
    (m: string, d: string | undefined, def: string = "", n: string | undefined) => {
      if (m === "\\$") return hasParens ? "$" : m;
      if (d) {
        const v = args[Number(d) - 1];
        return v !== undefined && v !== "" ? v : def;
      }
      if (!hasParens) return m;
      if (n === "*") return args.join(", ");
      const v = args[Number(n) - 1];
      return v === undefined ? m : v;
    },
  );
}

function stripFrontmatter(t: string) {
  return t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export const FENCE_RE = /^\s*(```|~~~)/;

export function fenceAware(lines: string[]) {
  const inFence = [];
  let f = false;
  for (const l of lines) {
    if (FENCE_RE.test(l)) {
      inFence.push(true);
      f = !f;
    } else inFence.push(f);
  }
  return inFence;
}

export function parseRef(ref: string) {
  if (/^\d+-(?:-\d+|\d*)$/.test(ref.trim())) ref = ".:" + ref.trim();
  if (/^\s*[:<#]/.test(ref)) ref = ".:" + ref.trimStart().replace(/^:/, "");
  const hashAt = ref.indexOf("#"),
    colAt = ref.indexOf(":");
  let name,
    range = "",
    heading = false;
  if (hashAt >= 0 && (colAt < 0 || hashAt < colAt)) {
    name = ref.slice(0, hashAt);
    range = ref.slice(hashAt).trim();
    heading = true;
  } else if (colAt >= 0 && !ref.slice(0, colAt).includes("|")) {
    name = ref.slice(0, colAt);
    range = ref.slice(colAt + 1).trim();
  } else {
    name = ref;
  }
  name = name.split("|")[0].trim();
  let args = null;
  const am = /^(<[\w:.-]+>>?|<<[\w:.-]+>>|#[^(]*?)\(([\s\S]*)\)$/.exec(range);
  if (am) {
    range = am[1].trim();
    args = am[2].trim() === "" ? [] : splitArgs(am[2]);
  } else if (heading) {
    const p = range.indexOf("|");
    if (p >= 0) range = range.slice(0, p).trim();
  }
  return { name, range, args, heading };
}

export const isNativeHeading = (p: ReturnType<typeof parseRef>) =>
  p.heading && !p.range.startsWith("##") && p.args === null && p.name !== "." && p.name !== "";

export function argumentSuffix(ref: string, parsed: ReturnType<typeof parseRef>) {
  return parsed.args === null
    ? ""
    : ref.slice(ref.indexOf("(", ref.indexOf(parsed.range) + parsed.range.length));
}

export function formatEmbed(ref: string) {
  const p = parseRef(ref);
  const source = p.name === "." ? "" : p.name;
  return "![" + source + (source && p.range ? ":" : "") + p.range + argumentSuffix(ref, p) + "]";
}

export const normalizeTitle = (s: string) =>
  s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;

export function headingsOf(text: string, includeFencedHeadings: boolean) {
  const lines = text.split("\n"),
    fence = fenceAware(lines),
    out: string[] = [];
  lines.forEach((l, i) => {
    if (FENCE_RE.test(l)) return;
    if (!includeFencedHeadings && fence[i]) return;
    const h = HEADING_RE.exec(l.replace(/\r$/, ""));
    if (h) out.push(h[2]);
  });
  return out;
}

function sectionError(text: string, title: string) {
  const all = headingsOf(text, true)
    .slice(0, 8)
    .map((h) => h.replace(/\]/g, ")"));
  const hint = all.length
    ? " (" + t("sourceHeadings") + ": " + all.join(" | ") + ")"
    : " (" + t("emptySourceHeadings") + ")";
  return new Error(t("missingSection") + ": " + title + hint);
}

// When matching headings inside fenced examples, the closing fence also ends the section.
function findSection(
  text: string,
  title: string,
  withHeading: boolean,
  includeFencedHeadings: boolean,
) {
  const lines = text.split("\n"),
    fence = fenceAware(lines);
  let start = -1,
    level = 0;
  for (let i = 0; i < lines.length; i++) {
    const isFenceLine = FENCE_RE.test(lines[i]);
    if (includeFencedHeadings) {
      if (isFenceLine) {
        if (start >= 0) return lines.slice(withHeading ? start - 1 : start, i).join("\n");
        continue;
      }
    } else if (fence[i]) {
      continue;
    }
    const h = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
    if (!h) continue;
    if (start < 0) {
      if (normalizeTitle(h[2]) === title) {
        start = i + 1;
        level = h[1].length;
      }
    } else if (h[1].length <= level) {
      return lines.slice(withHeading ? start - 1 : start, i).join("\n");
    }
  }
  if (start < 0) throw sectionError(text, title);
  return lines.slice(withHeading ? start - 1 : start).join("\n");
}

function sliceSection(text: string, spec: string) {
  const withHeading = !spec.startsWith("##");
  const titles = spec
    .replace(/^#+\s*/, "")
    .split("#")
    .map(normalizeTitle)
    .filter(Boolean);
  if (!titles.length) throw new Error(t("emptySection"));
  function selectHeadingPath(includeFencedHeadings: boolean) {
    let section = stripFrontmatter(text);
    for (const [index, title] of titles.entries()) {
      if (title.startsWith("^")) throw new Error(t("blockUnsupported"));
      const includeHeading = withHeading && index === titles.length - 1;
      section = findSection(section, title, includeHeading, includeFencedHeadings);
    }
    return section;
  }

  try {
    return selectHeadingPath(false);
  } catch (noteHeadingError) {
    try {
      return selectHeadingPath(true);
    } catch {
      throw noteHeadingError;
    }
  }
}

function sliceLines(text: string, a: string, b: string) {
  const lines = text.split("\n");
  const from = Number(a);
  let to;
  if (b === "" || b === undefined) to = lines.length;
  else if (b.startsWith("-")) to = lines.length + Number(b);
  else to = Number(b);
  if (from < 1 || from > lines.length || to < from || to > lines.length) {
    throw new Error(t("invalidRange", { range: a + "-" + (b ?? ""), last: lines.length }));
  }
  return lines.slice(from - 1, to).join("\n");
}

function sliceTag(text: string, tag: string, inner: boolean) {
  const open = "<" + tag + ">",
    close = "</" + tag + ">";
  let i = -1,
    from = 0;
  while ((i = text.indexOf(open, from)) !== -1) {
    if (i > 0 && text[i - 1] === "<") {
      from = i + 1;
      continue;
    }
    break;
  }
  if (i < 0) throw new Error(t("missingTag", { tag: "<" + tag + ">" }));
  const j = text.indexOf(close, i + open.length);
  if (j < 0) throw new Error(t("missingTag", { tag: "</" + tag + ">" }));
  if (inner) {
    let s = text.slice(i + open.length, j);
    s = s.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    return s.includes("\n") ? s : s.trim();
  }
  const ls = text.lastIndexOf("\n", i) + 1;
  let le = text.indexOf("\n", j);
  if (le < 0) le = text.length;
  return text.slice(ls, le);
}

export function slice(text: string, range: string) {
  if (!range) return stripFrontmatter(text);
  let m;
  if ((m = /^(<<?)([\w:.-]+)>>?$/.exec(range))) return sliceTag(text, m[2], m[1] === "<<");
  if (range.startsWith("#")) return sliceSection(text, range);
  if ((m = /^(\d+)-(-\d+|\d*)$/.exec(range))) return sliceLines(text, m[1], m[2]);
  throw new Error(t("unknownSelector") + ": " + range);
}

export const countNewlines = (s: string) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
};
export const TAG_NAME_PATTERN = /^[\w:.-]+$/;
export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function rewriteText(
  text: string,
  fn: (reference: string, fenced: boolean) => string | null,
) {
  const lines = text.split("\n");
  let inFence = false,
    count = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!hasEmbed(line)) continue;
    lines[i] = line.replace(
      REF_RE(),
      (all: string, esc: string | undefined, _all: string, ref: string) => {
        if (esc) return all;
        const p = parseRef(ref);
        const normalized = p.name + (p.range ? ":" + p.range : "") + argumentSuffix(ref, p);
        const nr = fn(normalized, inFence);
        if (nr == null || nr === normalized) return all;
        count++;
        return formatEmbed(nr);
      },
    );
  }
  return { text: lines.join("\n"), count };
}

export function headingList(text: string) {
  const lines = text.split("\n"),
    out = [];
  let from = 0;
  if (lines[0] && lines[0].trim() === "---") {
    for (let i = 1; i < lines.length; i++)
      if (/^(---|\.\.\.)\s*$/.test(lines[i])) {
        from = i + 1;
        break;
      }
  }
  const fence = fenceAware(lines);
  for (let i = from; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i]) || fence[i]) continue;
    const h = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
    if (h && h[2].trim())
      out.push({ line: i, level: h[1].length, raw: h[2].trim(), norm: normalizeTitle(h[2]) });
  }
  return out;
}

export function tagsOf(text: string) {
  const t = stripFrontmatter(text).replace(REF_RE(), "");
  const opens = new Set<string>(),
    closes = new Set<string>();
  for (const m of t.matchAll(/<(\/?)([\w:.-]+)>/g)) (m[1] ? closes : opens).add(m[2]);
  return [...opens].filter((x) => closes.has(x));
}

export const badSectionName = (s: string) => !s || /[#(^|\][\n]/.test(s);

export function tagToHeading(text: string, tag: string, level: number, title: string) {
  const lines = text.split("\n");
  const op = "<" + tag + ">",
    cl = "</" + tag + ">";
  let oi = -1;
  for (let i = 0; i < lines.length; i++) {
    const k = lines[i].indexOf(op);
    if (k >= 0 && (k === 0 || lines[i][k - 1] !== "<")) {
      oi = i;
      break;
    }
  }
  if (oi < 0) return { changed: false, text };
  let ci = -1;
  for (let i = oi; i < lines.length; i++)
    if (lines[i].includes(cl)) {
      ci = i;
      break;
    }
  if (ci < 0) return { changed: false, text };
  const openLine = lines[oi],
    closeLine = lines[ci];
  const pre = openLine.slice(0, openLine.indexOf(op));
  const inner = [];
  if (oi === ci) {
    const a = openLine.indexOf(op) + op.length;
    inner.push(openLine.slice(a, closeLine.indexOf(cl)));
  } else {
    const a = openLine.indexOf(op) + op.length;
    if (openLine.slice(a).trim()) inner.push(openLine.slice(a));
    for (let i = oi + 1; i < ci; i++) inner.push(lines[i]);
    const lastPre = closeLine.slice(0, closeLine.indexOf(cl));
    if (lastPre.trim()) inner.push(lastPre);
  }
  const post = closeLine.slice(closeLine.indexOf(cl) + cl.length);
  const head = pre + "#".repeat(level) + " " + title + post;
  lines.splice(oi, ci - oi + 1, ...[head, ...inner]);
  return { changed: true, text: lines.join("\n") };
}

export function headingToTag(text: string, lineIdx: number, tag: string) {
  const lines = text.split("\n"),
    fence = fenceAware(lines);
  const h = HEADING_RE.exec((lines[lineIdx] || "").replace(/\r$/, ""));
  if (!h) return { changed: false, text };
  let ei = lines.length;
  for (let i = lineIdx + 1; i < lines.length; i++) {
    if (fence[i] || FENCE_RE.test(lines[i])) continue;
    const h2 = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
    if (h2 && h2[1].length <= h[1].length) {
      ei = i;
      break;
    }
  }
  lines[lineIdx] = "<" + tag + ">";
  lines.splice(ei, 0, "</" + tag + ">");
  return { changed: true, text: lines.join("\n") };
}

export function* wikiLinks(text: string) {
  for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    if (text[match.index - 1] !== "!") yield match;
  }
}
