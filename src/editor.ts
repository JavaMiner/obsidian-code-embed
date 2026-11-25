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
  FENCE_RE,
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
    const s: WidgetElement = document.createElement("span");
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
          const holder = document.createElement("div");
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

export function createCodeBlockExtension(plugin: CodeEmbedPlugin) {
  return ViewPlugin.fromClass(
    class {
      deco: DecorationSet;
      constructor(view: EditorView) {
        this.deco = this.build(view);
      }
      update(u: ViewUpdate) {
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
        if (!plugin.settings.livePreview) return b.finish();
        const doc = view.state.doc,
          sel = view.state.selection.ranges;
        let inFence = false,
          block = "",
          lang = "";
        const path = view.state.field(editorInfoField, false)?.file?.path ?? "";
        for (let n = 1; n <= doc.lines; n++) {
          const line = doc.line(n);
          if (FENCE_RE.test(line.text)) {
            if (!inFence) {
              lang = /^\s*(?:`{3,}|~{3,})\s*([\w+-]+)/.exec(line.text)?.[1] ?? "";
              const out = [];
              for (let k = n + 1; k <= doc.lines; k++) {
                const t = doc.line(k).text;
                if (FENCE_RE.test(t)) break;
                out.push(t);
              }
              block = out.join("\n");
            }
            inFence = !inFence;
            continue;
          }
          if (!inFence || !hasEmbed(line.text)) continue;
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
                widget: new EmbedWidget(plugin, m.groups!.ref, plugin.revision, block, lang, path),
              }),
            );
          }
        }
        return b.finish();
      }
    },
    { decorations: (v) => v.deco },
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
    const el: WidgetElement = document.createElement(this.block ? "div" : "span");
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
      .catch((error) => {
        if (el.ceToken === token) renderErrorsInText(el, formatError(error.message));
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
      const re = /(?<!!)\[\[([^\]]+)\]\]/g;
      let m;
      while ((m = re.exec(line.text)) !== null) {
        const from = line.from + m.index,
          to = from + m[0].length;
        if (pos < from || pos > to) continue;
        const p = parseRef(m[1]);
        if (!p.range || isNativeHeading(p)) return;
        const tgt = plugin.findFile(p.name, path);
        if (!tgt) return;
        e.preventDefault();
        e.stopPropagation();
        plugin.goToRange(tgt, p.range);
        return;
      }
    },
  });
}
