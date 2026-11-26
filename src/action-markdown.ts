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

export function blockKind(language: string) {
  const name = language.toLowerCase();
  if (!name) return "plain";
  if (name === "md") return "markdown";
  if (name === "codeembed") return "ce";
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

export function* referencesIn(text: string, prose = false) {
  if (!text.includes("![")) return;
  const spans = prose ? inlineCodeSpans(text) : [];
  let span = 0;
  for (const match of text.matchAll(canonicalReferences())) {
    while (span < spans.length && spans[span].end <= match.index) span++;
    if (match.groups!.esc || (spans[span] && spans[span].start <= match.index)) continue;
    yield { ref: match.groups!.ref, from: match.index, to: match.index + match[0].length };
  }
}

async function expandText(text: string, local: string | null, resolve: ResolveReference) {
  let offset = 0;
  let output = "";
  for (const match of referencesIn(text, local === null)) {
    const value = await resolve(match.ref, local);
    output += text.slice(offset, match.from) + value;
    offset = match.to;
  }
  return output + text.slice(offset);
}

function preserveLineEndings(source: string, resolve: ResolveReference): ResolveReference {
  return source.includes("\r\n")
    ? async (ref, local) => (await resolve(ref, local)).replace(/\r?\n/g, "\r\n")
    : resolve;
}

export function expandBlock(body: string, resolve: ResolveReference) {
  return expandText(body, body, preserveLineEndings(body, resolve));
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

function* noteSections(source: string, kinds?: ReadonlySet<string>) {
  let start = frontmatterEnd(source);
  for (const fence of findFences(source)) {
    if (start < fence.start) yield { from: start, to: fence.start, fence: null };
    if (!kinds || kinds.has(blockKind(fence.language))) {
      yield { from: fence.bodyStart, to: fence.bodyEnd, fence };
    }
    start = fence.end;
  }
  if (start < source.length) yield { from: start, to: source.length, fence: null };
}

export function* noteReferences(source: string) {
  if (!source.includes("![")) return;
  for (const { from, to, fence } of noteSections(source)) {
    const text = source.slice(from, to);
    for (const match of referencesIn(text, !fence))
      yield {
        ref: match.ref,
        from: from + match.from,
        to: from + match.to,
        local: fence ? text : null,
      };
  }
}

export function caretInsideReference(caret: number, match: { from: number; to: number }) {
  return caret >= match.from + 2 && caret < match.to;
}

/** Mask active references without shifting diagnostic offsets or exposing unfinished imports to other notes. */
export function validationDocument(source: string, carets: readonly number[]) {
  let offset = 0;
  const parts: string[] = [];
  const deferred = new Set<string>();
  for (const match of noteReferences(source)) {
    if (!carets.some((caret) => caretInsideReference(caret, match))) continue;
    deferred.add(match.ref);
    parts.push(source.slice(offset, match.from), " ".repeat(match.to - match.from));
    offset = match.to;
  }
  return { text: parts.length ? parts.join("") + source.slice(offset) : source, deferred };
}

export async function expandNote(
  source: string,
  resolve: ResolveReference,
  kinds?: ReadonlySet<string>,
) {
  const resolver = preserveLineEndings(source, resolve);
  let offset = 0;
  let output = "";
  for (const { from, to, fence } of noteSections(source, kinds)) {
    const text = source.slice(from, to);
    output += source.slice(offset, fence?.start ?? from);
    const expanded = await expandText(text, fence ? text : null, resolver);
    output += fence ? replaceFenceBody(source, fence, expanded) : expanded;
    offset = fence?.end ?? to;
  }
  return output + source.slice(offset);
}
