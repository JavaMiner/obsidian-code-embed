/** Markdown source operations shared by hosts. Offsets are UTF-16 indices into the original text. */
export interface Fence {
  start: number;
  line: number;
  bodyStart: number;
  bodyEnd: number;
  end: number;
  marker: string;
  closingWidth: number;
  language: string;
}

export function canonicalReferences() {
  return /(?<esc>\\)?(?<all>!\[(?!\s*(?:\.\s*(?:[:\]]|$)|:))(?<ref>(?:\s*[#<][^[\]\r\n]*|[^[\]:#\r\n]+(?::[^[\]\r\n]+)?))\](?![[(\]]))/g;
}

export function actionReferences() {
  return /(?<esc>\\)?(?<all>(?:!\[(?!\s*(?:\.\s*(?:[:\]]|$)|:))|\$\[)(?<ref>(?:\s*[:#<][^[\]\r\n]*|[^[\]:#\r\n]+(?::[^[\]\r\n]+)?))\](?![[(\]]))/g;
}

export function blockKind(language: string) {
  const name = language.toLowerCase();
  if (!name) return "plain";
  if (name === "md") return "markdown";
  if (name === "codeembed" || name === "xmlce") return "ce";
  return name;
}

export function selectedKinds(setting: string) {
  return new Set(
    setting
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(blockKind),
  );
}

function frontmatterEnd(source: string) {
  const match = /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(source);
  return match?.index === 0 ? match[0].length : 0;
}

export function findFences(source: string): Fence[] {
  const fences: Fence[] = [];
  const front = frontmatterEnd(source);
  let open: Fence | undefined;
  let line = 0;
  for (const row of source.matchAll(/[^\n]*(?:\n|$)/g)) {
    if (!row[0]) break;
    const start = row.index;
    const text = row[0].replace(/\r?\n$/, "");
    const match = start >= front && /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (match) {
      const [, marker, info] = match;
      if (open) {
        if (marker.startsWith(open.marker) && !info.trim()) {
          open.bodyEnd = start;
          open.end = start + row[0].length;
          open.closingWidth = marker.length;
          open = undefined;
        }
      } else if (marker[0] !== "`" || !info.includes("`")) {
        open = {
          start,
          line,
          marker,
          bodyStart: start + row[0].length,
          bodyEnd: source.length,
          end: source.length,
          closingWidth: 0,
          language: info.trim().split(/\s+/, 1)[0].toLowerCase(),
        };
        fences.push(open);
      }
    }
    line++;
  }
  return fences;
}

export type ResolveReference = (reference: string, local: string | null) => Promise<string>;
export type Expansion = "copy" | "permanent";

function inlineCodeSpans(text: string) {
  const spans: { start: number; end: number }[] = [];
  let offset = 0;
  for (const paragraph of text.split(/(\r?\n[ \t]*\r?\n)/)) {
    const runs = [...paragraph.matchAll(/`+/g)];
    const next = new Map<number, number>();
    const pairs = new Map<number, number>();
    for (let i = runs.length - 1; i >= 0; i--) {
      const width = runs[i][0].length;
      const close = next.get(width);
      if (close !== undefined) pairs.set(i, close);
      next.set(width, i);
    }
    for (let i = 0; i < runs.length; i++) {
      const close = pairs.get(i);
      if (close === undefined) continue;
      spans.push({
        start: offset + runs[i].index,
        end: offset + runs[close].index + runs[close][0].length,
      });
      i = close;
    }
    offset += paragraph.length;
  }
  return spans;
}

async function expandText(
  text: string,
  kind: Expansion,
  local: string | null,
  resolve: ResolveReference,
  prose = false,
) {
  const spans = prose ? inlineCodeSpans(text) : [];
  let span = 0;
  let offset = 0;
  let output = "";
  for (const match of text.matchAll(actionReferences())) {
    while (span < spans.length && spans[span].end <= match.index) span++;
    if (spans[span] && spans[span].start <= match.index) continue;
    if (match.groups!.esc || (kind === "permanent" && !match[0].startsWith("$"))) continue;
    const value = await resolve(match.groups!.ref, local);
    output += text.slice(offset, match.index) + value;
    offset = match.index + match[0].length;
  }
  return output + text.slice(offset);
}

function preserveLineEndings(source: string, resolve: ResolveReference): ResolveReference {
  return source.includes("\r\n")
    ? async (ref, local) => (await resolve(ref, local)).replace(/\r?\n/g, "\r\n")
    : resolve;
}

export function expandBlock(body: string, kind: Expansion, resolve: ResolveReference) {
  return expandText(body, kind, body, preserveLineEndings(body, resolve));
}

/** Keep inserted fence-like lines inside their original block. */
export function replaceFenceBody(source: string, fence: Fence, body: string) {
  const opening = source.slice(fence.start, fence.bodyStart);
  const closing = source.slice(fence.bodyEnd, fence.end);
  let width = fence.marker.length;
  for (const match of body.matchAll(/^ {0,3}(`+|~+)[ \t]*\r?$/gm)) {
    if (match[1][0] === fence.marker[0]) width = Math.max(width, match[1].length + 1);
  }
  const open = opening.replace(fence.marker, fence.marker[0].repeat(width));
  const close =
    fence.closingWidth && width > fence.closingWidth
      ? closing.replace(fence.marker[0].repeat(fence.closingWidth), fence.marker[0].repeat(width))
      : closing;
  return open + body + close;
}

export async function expandNote(
  source: string,
  kinds: ReadonlySet<string>,
  kind: Expansion,
  resolve: ResolveReference,
) {
  const resolveWithLineEndings = preserveLineEndings(source, resolve);
  let offset = frontmatterEnd(source);
  let output = source.slice(0, offset);
  for (const fence of findFences(source)) {
    output += await expandText(
      source.slice(offset, fence.start),
      kind,
      null,
      resolveWithLineEndings,
      true,
    );
    if (kinds.has(blockKind(fence.language))) {
      const body = source.slice(fence.bodyStart, fence.bodyEnd);
      output += replaceFenceBody(
        source,
        fence,
        await expandText(body, kind, body, resolveWithLineEndings),
      );
    } else output += source.slice(fence.start, fence.end);
    offset = fence.end;
  }
  return (
    output + (await expandText(source.slice(offset), kind, null, resolveWithLineEndings, true))
  );
}
