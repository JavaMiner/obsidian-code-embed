import {
  caretInsideReference,
  referencesIn,
  findFences,
  selectedKinds,
  type Fence,
  blockKind,
} from "./action-markdown";
import { actionBar, type BlockTarget } from "./note-actions";
import { Component, editorInfoField, editorLivePreviewField } from "obsidian";
import {
  ViewPlugin,
  EditorView,
  Decoration,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField, type EditorState } from "@codemirror/state";
import type CodeEmbedPlugin from "./main";
import {
  wikiLinks,
  REF_RE,
  hasEmbed,
  hasErrors,
  parseRef,
  isNativeHeading,
  formatError,
} from "./fragments";
import { renderErrorsInText } from "./render-errors";
type WidgetElement = HTMLElement & { ceOwner?: Component | null; ceToken?: object | null };

export const refresh = StateEffect.define();
class EmbedWidget extends WidgetType {
  constructor(
    readonly plugin: CodeEmbedPlugin,
    readonly ref: string,
    readonly revision: number,
    readonly local: string,
    readonly lang: string,
    readonly path: string,
  ) {
    super();
  }
  eq(o: EmbedWidget) {
    return (
      o.ref === this.ref &&
      o.revision === this.revision &&
      o.local === this.local &&
      o.lang === this.lang &&
      o.path === this.path
    );
  }
  toDOM() {
    const s: WidgetElement = createSpan();
    s.className = "ce-widget";
    s.textContent = "…";
    const path = this.path;
    const owner = this.plugin.addChild(new Component());
    s.ceOwner = owner;
    this.plugin
      .resolve(this.ref, path, [], false, this.local)
      .then(async (t) => {
        if (!s.ceOwner) return;
        if (this.lang && !/^(?:ce|codeembed|md|markdown|xml)$/.test(this.lang) && !hasErrors(t)) {
          const holder = createDiv();
          holder.dataset.ceRendered = "1";
          const fence = "`".repeat(t.split(/[^`]+/).reduce((n, x) => Math.max(n, x.length + 1), 3));
          await this.plugin.renderMd(
            fence + this.lang + "\n" + t + "\n" + fence,
            holder,
            path,
            owner,
          );
          if (!s.ceOwner) return;
          const code = holder.querySelector("pre code");
          if (code) {
            s.replaceChildren(...code.childNodes);
            return;
          }
        }
        const bad = renderErrorsInText(s, t);
        s.classList.toggle("ce-widget-error", bad);
      })
      .catch(() => {
        if (s.ceOwner) s.textContent = this.ref;
      });
    return s;
  }
  destroy(s: WidgetElement) {
    if (s.ceOwner) this.plugin.removeChild(s.ceOwner);
    s.ceOwner = null;
  }
  ignoreEvent() {
    return false;
  }
}

class BlockActionsWidget extends WidgetType {
  constructor(
    readonly plugin: CodeEmbedPlugin,
    readonly path: string,
    readonly target: BlockTarget,
  ) {
    super();
  }
  eq(other: BlockActionsWidget) {
    return (
      this.path === other.path &&
      this.target.line === other.target.line &&
      this.target.language === other.target.language &&
      this.target.body === other.target.body
    );
  }
  toDOM(view: EditorView) {
    const bar = actionBar(createSpan(), "ce-editor-actions", (action) =>
      this.plugin.actions.run(
        this.plugin.actions.viewForElement(view.dom, this.path),
        action,
        this.target,
      ),
    );
    bar.dataset.fenceStart = String(this.target.line);
    return bar;
  }
}

function editingReference(state: EditorState) {
  return state.selection.ranges.some(({ head }) => {
    const line = state.doc.lineAt(head);
    return [...referencesIn(line.text)].some((match) =>
      caretInsideReference(head - line.from, match),
    );
  });
}

export function createCodeBlockExtension(plugin: CodeEmbedPlugin) {
  return ViewPlugin.fromClass(
    class {
      deco: DecorationSet;
      ranges: Fence[] = [];
      hovered?: HTMLElement;
      hover(view: EditorView, target?: EventTarget | null) {
        const node = target as Node | null;
        const line = node?.instanceOf(Element) ? node.closest(".cm-line") : null;
        const pos = line ? view.posAtDOM(line) : -1;
        const fence = this.ranges.find((range) => range.start <= pos && pos < range.end);
        const bar =
          fence &&
          view.dom.querySelector<HTMLElement>(
            `.ce-editor-actions[data-fence-start="${fence.line}"]`,
          );
        if (this.hovered === bar) return;
        this.hovered?.classList.remove("ce-hovered");
        bar?.classList.add("ce-hovered");
        this.hovered = bar ?? undefined;
      }
      constructor(view: EditorView) {
        this.deco = this.build(view);
      }
      update(u: ViewUpdate) {
        if (
          u.docChanged ||
          u.focusChanged ||
          (u.selectionSet && (editingReference(u.startState) || editingReference(u.state)))
        ) {
          plugin.scheduleValidate();
          plugin.scheduleInject();
        }
        if (
          u.docChanged ||
          u.selectionSet ||
          u.viewportChanged ||
          u.transactions.some((t) => t.effects.some((e) => e.is(refresh)))
        ) {
          this.deco = this.build(u.view);
        }
      }
      build(view: EditorView) {
        const b = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        const source = doc.toString();
        const sel = view.state.selection.ranges;
        const path = view.state.field(editorInfoField, false)?.file?.path;
        if (!path) return b.finish();
        this.ranges = [];
        const kinds = selectedKinds(plugin.settings.blockActionKinds);
        for (const fence of findFences(source)) {
          const lang = fence.language;
          const block = source.slice(fence.bodyStart, fence.bodyEnd).replace(/\n$/, "");
          const opening = doc.line(fence.line + 1);
          if (kinds.has(blockKind(lang))) {
            this.ranges.push(fence);
            const containsCaret = sel.some(
              ({ head }) =>
                head >= fence.start &&
                (head < fence.end || (head === doc.length && fence.end === head)),
            );
            if (containsCaret)
              b.add(opening.from, opening.from, Decoration.line({ class: "ce-caret-in-block" }));
            b.add(
              opening.to,
              opening.to,
              Decoration.widget({
                side: 1,
                widget: new BlockActionsWidget(plugin, path, {
                  line: fence.line,
                  language: lang,
                  body: source.slice(fence.bodyStart, fence.bodyEnd),
                }),
              }),
            );
          }
          if (!plugin.settings.livePreview) continue;
          for (let n = opening.number + 1; n <= doc.lines; n++) {
            const line = doc.line(n);
            if (line.from >= fence.bodyEnd) break;
            if (!hasEmbed(line.text)) continue;
            if (sel.some((r) => r.from <= line.to && r.to >= line.from)) continue;
            const re = REF_RE();
            let m;
            while ((m = re.exec(line.text)) !== null) {
              if (m.groups!.esc) continue;
              const from = line.from + m.index,
                to = from + m[0].length;
              b.add(
                from,
                to,
                Decoration.replace({
                  widget: new EmbedWidget(
                    plugin,
                    m.groups!.ref,
                    plugin.revision,
                    block,
                    lang,
                    path,
                  ),
                }),
              );
            }
          }
        }
        return b.finish();
      }
    },
    {
      decorations: (v) => v.deco,
      eventHandlers: {
        pointerover(event, view) {
          this.hover(view, event.target);
        },
        pointerleave(_event, view) {
          this.hover(view);
        },
      },
    },
  );
}

export class MarkdownEmbedWidget extends WidgetType {
  constructor(
    readonly plugin: CodeEmbedPlugin,
    readonly ref: string,
    readonly path: string,
    readonly revision: number,
    readonly block: boolean,
  ) {
    super();
  }
  eq(other: WidgetType) {
    return (
      other instanceof MarkdownEmbedWidget &&
      other.plugin === this.plugin &&
      other.ref === this.ref &&
      other.path === this.path &&
      other.revision === this.revision &&
      other.block === this.block
    );
  }
  toDOM(view: EditorView) {
    const el: WidgetElement = createEl(this.block ? "div" : "span");
    el.className = "ce-inline-render markdown-rendered";
    el.dataset.ceRendered = "1";
    const owner = this.plugin.addChild(new Component());
    el.ceOwner = owner;
    const token = {};
    el.ceToken = token;
    this.plugin
      .resolve(this.ref, this.path, [])
      .then(async (md) => {
        if (el.ceToken !== token) return;
        el.classList.toggle("ce-has-error", hasErrors(md));
        await this.plugin.renderEmbedMarkdown(md, el, this.path, owner, this.block);
        if (el.ceToken === token) view.requestMeasure();
      })
      .catch((error: unknown) => {
        if (el.ceToken === token)
          renderErrorsInText(
            el,
            formatError(error instanceof Error ? error.message : String(error)),
          );
      });
    return el;
  }
  destroy(el: WidgetElement) {
    el.ceToken = null;
    if (el.ceOwner) this.plugin.removeChild(el.ceOwner);
  }
  ignoreEvent() {
    return false;
  }
}

export function createMarkdownExtension(plugin: CodeEmbedPlugin) {
  const build = (state: EditorState) => {
    if (!plugin.settings.livePreview || !state.field(editorLivePreviewField, false))
      return Decoration.none;
    const path = state.field(editorInfoField, false)?.file?.path;
    if (!path) return Decoration.none;
    const ranges = [],
      doc = state.doc;
    let fence = null,
      frontmatter = false;
    for (let n = 1; n <= doc.lines; n++) {
      const line = doc.line(n),
        text = line.text;
      if (n === 1 && text.trim() === "---") {
        frontmatter = true;
        continue;
      }
      if (frontmatter) {
        if (/^(---|\.\.\.)\s*$/.test(text)) frontmatter = false;
        continue;
      }
      const fm = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
      if (fence) {
        if (fm && fm[1][0] === fence.char && fm[1].length >= fence.length && !fm[2].trim())
          fence = null;
        continue;
      }
      if (fm) {
        fence = { char: fm[1][0], length: fm[1].length };
        continue;
      }
      if (/^(?: {4}|\t)/.test(text)) continue;
      const re = REF_RE();
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m.groups!.esc) continue;
        // Literal examples inside inline code must remain editable as written.
        const prefix = text.slice(0, m.index);
        let tick = null;
        for (const run of prefix.matchAll(/`+/g)) {
          if (tick === null) tick = run[0].length;
          else if (tick === run[0].length) tick = null;
        }
        if (tick !== null) continue;
        if (state.selection.ranges.some((r) => r.from <= line.to && r.to >= line.from)) continue;
        const from = line.from + m.index,
          to = from + m[0].length;
        const block = text.trim() === m[0];
        ranges.push(
          Decoration.replace({
            widget: new MarkdownEmbedWidget(plugin, m.groups!.ref, path, plugin.revision, block),
            block,
            inclusive: false,
          }).range(from, to),
        );
      }
    }
    return Decoration.set(ranges, true);
  };
  return StateField.define<DecorationSet>({
    create: build,
    update(value, tr) {
      if (tr.docChanged || tr.selection || tr.effects.length) return build(tr.state);
      return value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

export function createLinkNavigationExtension(plugin: CodeEmbedPlugin) {
  return EditorView.domEventHandlers({
    mousedown(e, view) {
      if (!e.ctrlKey && !e.metaKey) return;
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos == null) return;
      const path = view.state.field(editorInfoField, false)?.file?.path;
      if (!path) return;
      const line = view.state.doc.lineAt(pos);
      for (const m of wikiLinks(line.text)) {
        const from = line.from + m.index,
          to = from + m[0].length;
        if (pos < from || pos > to) continue;
        const p = parseRef(m[1]);
        if (!p.range || isNativeHeading(p)) return;
        const tgt = plugin.findFile(p.name, path);
        if (!tgt) return;
        e.preventDefault();
        e.stopPropagation();
        plugin.goToRange(tgt, p.range).catch(console.error);
        return;
      }
    },
  });
}
