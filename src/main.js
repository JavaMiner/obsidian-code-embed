'use strict';
const { Plugin, PluginSettingTab, Setting, Modal, ItemView, MarkdownRenderer, MarkdownView, Notice, Component, MarkdownRenderChild, editorInfoField, editorLivePreviewField, FuzzySuggestModal, EditorSuggest, TFolder, getLanguage } = require("obsidian");
const { ViewPlugin, EditorView, Decoration, WidgetType } = require("@codemirror/view");
const { RangeSetBuilder, StateEffect, StateField } = require("@codemirror/state");

function activeLanguage() {
  const locale = getLanguage?.() || globalThis.moment?.locale?.() || globalThis.navigator?.language || "en";
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return Object.prototype.hasOwnProperty.call(CE_LOCALES, language) ? language : "en";
}

function guideUrl() {
  const language = activeLanguage();
  const filename = language === "en" ? "README.md" : "README." + language + ".md";
  return "https://github.com/JavaMiner/obsidian-code-embed/blob/feature/canonical-embeds-packages/" + filename;
}

function t(key, values = {}) {
  const message = CE_LOCALES[activeLanguage()][key] ?? CE_LOCALES.en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (token, name) => values[name] ?? token);
}

const PANES = ["outgoing-link", "backlink"];
const VIEW_TYPE = "code-embed-panel";
const refresh = StateEffect.define();
const REF_RE = () => /(?<esc>\\)?(?<all>(?=[!$]\[\[?(?<ref>[^\[\]\r\n]+)\])(?:!\[\[[^\[\]\r\n]+\]\]|[!$](?!\[\[)\[[^\[\]\r\n]+\](?![\[(\]])))/g;
const hasEmbed = (text) => text.includes('![') || text.includes('$[');

const DEFAULTS = {
  showAllFolderActions: false,
  packageColor: "#498b78",
  maxDepth: 5,
  livePreview: true,
  viewTree: true,
  xmlPlain: true,
  treeOpenDepth: 2,
  inlineMax: 80,
  buttonsOnPlain: true,
  showPanels: true,
  panelNested: true,
  panelMaxVh: 55,
  panelOnTop: true,
  panelLinks: true,
  warnBroken: true,
  autoRenameFile: true,
  autoRenameTag: true,
  autoRenameSection: true,
  renameNotice: true,
  validateDelay: 2500,
  cWidgetBorder: "",
  cWidgetBg: "",
  cWidgetBgAlpha: 20,
  cErrBorder: "",
  cErrBg: "",
  cErrBgAlpha: 18,
  cErrText: "",
  cTreeTag: "",
  cTreeImport: "",
  cChip: "",
};

const COLOR_FALLBACK = {
  packageColor: "#498b78",
  cWidgetBorder: "#1c0020",
  cWidgetBg: "#17101d",
  cErrBorder: "#e5484d",
  cErrBg: "#e5484d",
  cErrText: "#e5484d",
  cTreeTag: "#8b7cf6",
  cTreeImport: "#f08c00",
  cChip: "#8b7cf6",
};

const errorLabels = [...new Set(Object.values(CE_LOCALES).map(labels => labels.errorLabel))];
const ERR_RE = new RegExp("\\[(?:" + errorLabels.join("|") + "): ([^\\]]*)\\]", "g");
const firstError = text => new RegExp(ERR_RE.source).exec(text)?.[1];
const formatError = message => "[" + t("errorLabel") + ": " + message + "]";
const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const markErrors = (md) => md.replace(ERR_RE, (m) => '<span class="ce-err">' + escHtml(m) + "</span>");
const hasErrors = (s) => firstError(s) !== undefined;

function fillErr(el, text) {
  el.textContent = "";
  const re = new RegExp(ERR_RE.source, "g");
  let last = 0, m, found = false;
  while ((m = re.exec(text)) !== null) {
    found = true;
    if (m.index > last) el.append(text.slice(last, m.index));
    const s = document.createElement("span");
    s.className = "ce-err";
    s.textContent = m[0];
    el.append(s);
    last = re.lastIndex;
  }
  if (last < text.length) el.append(text.slice(last));
  return found;
}

function rgba(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a / 100 + ")";
}

function splitArgs(s) {
  const out = [];
  let cur = "", q = null;
  for (const ch of s) {
    if (q) {
      if (ch === q) { q = null; continue; }
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "`") { q = ch; continue; }
    if (ch === ",") { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}

function applyArgs(text, args, hasParens) {
  return text.replace(/\\\$|\$\{([1-9]):([^}]*)\}|\$([1-9*])/g, (m, d, def, n) => {
    if (m === "\\$") return hasParens ? "$" : m;
    if (d) {
      const v = args[Number(d) - 1];
      return v !== undefined && v !== "" ? v : def;
    }
    if (!hasParens) return m;
    if (n === "*") return args.join(", ");
    const v = args[Number(n) - 1];
    return v === undefined ? m : v;
  });
}

function stripFrontmatter(t) {
  return t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

const unescapeRefs = (s) => s.replace(/\\!\[\[/g, "![[");

const FENCE_RE = /^\s*(```|~~~)/;

function fenceAware(lines) {
  const inFence = [];
  let f = false;
  for (const l of lines) {
    if (FENCE_RE.test(l)) { inFence.push(true); f = !f; }
    else inFence.push(f);
  }
  return inFence;
}

function parseRef(ref) {
  if (/^\d+-(?:-\d+|\d*)$/.test(ref.trim())) ref = ".:" + ref.trim();
  if (/^\s*[:<#]/.test(ref)) ref = '.:' + ref.trimStart().replace(/^:/, '');
  const hashAt = ref.indexOf("#"), colAt = ref.indexOf(":");
  let name, range = "", heading = false;
  if (hashAt >= 0 && (colAt < 0 || hashAt < colAt)) {
    name = ref.slice(0, hashAt); range = ref.slice(hashAt).trim(); heading = true;
  } else if (colAt >= 0 && !ref.slice(0, colAt).includes("|")) {
    name = ref.slice(0, colAt); range = ref.slice(colAt + 1).trim();
  } else {
    name = ref;
  }
  name = name.split("|")[0].trim();
  let args = null;
  const am = /^(<[\w:.\-]+>>?|<<[\w:.\-]+>>|#[^(]*?)\(([\s\S]*)\)$/.exec(range);
  if (am) {
    range = am[1].trim();
    args = am[2].trim() === "" ? [] : splitArgs(am[2]);
  } else if (heading) {
    const p = range.indexOf("|");
    if (p >= 0) range = range.slice(0, p).trim();
  }
  return { name, range, args, heading };
}

const isNativeHeading = (p) => p.heading && !p.range.startsWith("##") && p.args === null && p.name !== "." && p.name !== "";

function argumentSuffix(ref, parsed) {
  return parsed.args === null ? "" : ref.slice(ref.indexOf("(", ref.indexOf(parsed.range) + parsed.range.length));
}

function formatEmbed(ref) {
  const p = parseRef(ref);
  const source = p.name === "." ? "" : p.name;
  return "![" + source + (source && p.range ? ":" : "") + p.range + argumentSuffix(ref, p) + "]";
}

function ownsWikiEmbed(p, ref = "") {
  if (/^\s*#(?!#)/.test(ref)) return false;
  return Boolean(p.range && !isNativeHeading(p) && !p.range.startsWith("#^")) ||
    p.name === "." && !p.range.startsWith("#^");
}

const normTitle = (s) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;

function headingsOf(text, includeFencedHeadings) {
  const lines = text.split("\n"), fence = fenceAware(lines), out = [];
  lines.forEach((l, i) => {
    if (FENCE_RE.test(l)) return;
    if (!includeFencedHeadings && fence[i]) return;
    const h = HEADING_RE.exec(l.replace(/\r$/, ""));
    if (h) out.push(h[2]);
  });
  return out;
}

function sectionError(text, title) {
  const all = headingsOf(text, true).slice(0, 8).map((h) => h.replace(/\]/g, ")"));
  const hint = all.length ? " (" + t("sourceHeadings") + ": " + all.join(" | ") + ")" : " (" + t("emptySourceHeadings") + ")";
  return new Error(t("missingSection") + ": " + title + hint);
}

// When matching headings inside fenced examples, the closing fence also ends the section.
function findSection(text, title, withHeading, includeFencedHeadings) {
  const lines = text.split("\n"), fence = fenceAware(lines);
  let start = -1, level = 0;
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
      if (normTitle(h[2]) === title) { start = i + 1; level = h[1].length; }
    } else if (h[1].length <= level) {
      return lines.slice(withHeading ? start - 1 : start, i).join("\n");
    }
  }
  if (start < 0) throw sectionError(text, title);
  return lines.slice(withHeading ? start - 1 : start).join("\n");
}

function sliceSection(text, spec) {
  const withHeading = !spec.startsWith("##");
  const titles = spec.replace(/^#+\s*/, "").split("#").map(normTitle).filter(Boolean);
  if (!titles.length) throw new Error(t("emptySection"));
  function selectHeadingPath(includeFencedHeadings) {
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

function sliceLines(text, a, b) {
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

function sliceTag(text, tag, inner) {
  const open = "<" + tag + ">", close = "</" + tag + ">";
  let i = -1, from = 0;
  while ((i = text.indexOf(open, from)) !== -1) {
    if (i > 0 && text[i - 1] === "<") { from = i + 1; continue; }
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

function slice(text, range) {
  if (!range) return stripFrontmatter(text);
  let m;
  if ((m = /^(<<?)([\w:.\-]+)>>?$/.exec(range))) return sliceTag(text, m[2], m[1] === "<<");
  if (range.startsWith("#")) return sliceSection(text, range);
  if ((m = /^(\d+)-(-\d+|\d*)$/.exec(range))) return sliceLines(text, m[1], m[2]);
  throw new Error(t("unknownSelector") + ": " + range);
}

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "wbr"]);

function parseTree(text) {
  const root = { type: "root", children: [] };
  const stack = [root];
  const re = /\u0001([^\u0002]*)\u0002|(\u0003)|<(\/?)([A-Za-z_][\w:.\-]*)((?:\s[^<>]*?)?)(\/?)>/g;
  const top = () => stack[stack.length - 1];
  const addText = (s) => { if (s) top().children.push({ type: "text", text: s }); };
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    addText(text.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] !== undefined) {
      const n = { type: "import", ref: m[1], children: [] };
      top().children.push(n); stack.push(n);
    } else if (m[2]) {
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].type === "import") { stack.length = k; break; }
    } else {
      const closing = m[3] === "/", tag = m[4], attrs = (m[5] || "").trim();
      const self = m[6] === "/" || VOID_TAGS.has(tag.toLowerCase());
      if (closing) {
        let k = stack.length - 1;
        while (k > 0 && !(stack[k].type === "element" && stack[k].tag === tag)) {
          if (stack[k].type === "import") { k = -1; break; }
          k--;
        }
        if (k > 0) stack.length = k; else addText(m[0]);
      } else {
        const n = { type: "element", tag, attrs, children: [] };
        top().children.push(n);
        if (!self) stack.push(n);
      }
    }
  }
  addText(text.slice(last));
  return root;
}

function hasStructure(node) {
  return node.children.some((c) => c.type !== "text");
}

const countNl = (s) => { let n = 0; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++; return n; };

class EmbedWidget extends WidgetType {
  constructor(plugin, ref, ver, local, lang, path) { super(); Object.assign(this, {plugin, ref, ver, local, lang, path}); }
  eq(o) { return o.ref === this.ref && o.ver === this.ver && o.local === this.local && o.lang === this.lang && o.path === this.path; }
  toDOM() {
    const s = document.createElement("span");
    s.className = "ce-widget";
    s.textContent = "…";
    const path = this.path;
    const owner = this.plugin.addChild(new Component());
    s.ceOwner = owner;
    this.plugin.resolve(this.ref, path, [], false, this.local).then(async (t) => {
      if (!s.ceOwner) return;
      if (this.lang && !/^(?:ce|codeembed|md|markdown|xml)$/.test(this.lang) && !hasErrors(t)) {
        const holder = document.createElement('div'); holder.dataset.ceRendered = '1';
        const fence = '`'.repeat(t.split(/[^`]+/).reduce((n,x)=>Math.max(n,x.length+1),3));
        await this.plugin.renderMd(fence + this.lang + '\n' + t + '\n' + fence, holder, path, owner);
        if (!s.ceOwner) return;
        const code = holder.querySelector('pre code');
        if (code) { s.replaceChildren(...code.childNodes); return; }
      }
      const bad = fillErr(s, t);
      s.classList.toggle("ce-widget-error", bad);
    }).catch(() => { if (s.ceOwner) s.textContent = this.ref; });
    return s;
  }
  destroy(s) { if (s.ceOwner) this.plugin.removeChild(s.ceOwner); s.ceOwner = null; }
  ignoreEvent() { return false; }
}

function makeEditorExt(plugin) {
  return ViewPlugin.fromClass(class {
    constructor(view) { this.deco = this.build(view); }
    update(u) {
      if (u.docChanged || u.selectionSet || u.viewportChanged ||
          u.transactions.some((t) => t.effects.some((e) => e.is(refresh)))) {
        this.deco = this.build(u.view);
      }
    }
    build(view) {
      const b = new RangeSetBuilder();
      if (!plugin.settings.livePreview) return b.finish();
      const doc = view.state.doc, sel = view.state.selection.ranges;
      let inF = false, block = "", lang = "";
      const path = view.state.field(editorInfoField, false)?.file?.path ?? "";
      for (let n = 1; n <= doc.lines; n++) {
        const line = doc.line(n);
        if (FENCE_RE.test(line.text)) {
          if (!inF) {
            lang = /^\s*(?:`{3,}|~{3,})\s*([\w+-]+)/.exec(line.text)?.[1] ?? "";
            const out = [];
            for (let k = n + 1; k <= doc.lines; k++) {
              const t = doc.line(k).text;
              if (FENCE_RE.test(t)) break;
              out.push(t);
            }
            block = out.join("\n");
          }
          inF = !inF;
          continue;
        }
        if (!inF || !hasEmbed(line.text)) continue;
        if (sel.some((r) => r.from <= line.to && r.to >= line.from)) continue;
        const re = REF_RE(); let m;
        while ((m = re.exec(line.text)) !== null) {
          if (m.groups.esc) continue;
          const from = line.from + m.index, to = from + m[0].length;
          b.add(from, to, Decoration.replace({ widget: new EmbedWidget(plugin, m.groups.ref, plugin.ver, block, lang, path) }));
        }
      }
      return b.finish();
    }
  }, { decorations: (v) => v.deco });
}

class MarkdownEmbedWidget extends WidgetType {
  constructor(plugin, ref, path, ver, block) {
    super(); Object.assign(this, { plugin, ref, path, ver, block });
  }
  eq(other) {
    return other instanceof MarkdownEmbedWidget && other.plugin === this.plugin &&
      other.ref === this.ref && other.path === this.path &&
      other.ver === this.ver && other.block === this.block;
  }
  toDOM(view) {
    const el = document.createElement(this.block ? "div" : "span");
    el.className = "ce-inline-render markdown-rendered";
    el.dataset.ceRendered = "1";
    const owner = this.plugin.addChild(new Component());
    el.ceOwner = owner;
    const token = {};
    el.ceToken = token;
    this.plugin.resolve(this.ref, this.path, []).then(async (md) => {
      if (el.ceToken !== token) return;
      el.classList.toggle("ce-has-error", hasErrors(md));
      await this.plugin.renderMd(markErrors(md), el, this.path, owner);
      if (el.ceToken === token) view.requestMeasure();
    }).catch((error) => {
      if (el.ceToken === token) fillErr(el, formatError(error.message));
    });
    return el;
  }
  destroy(el) {
    el.ceToken = null;
    if (el.ceOwner) this.plugin.removeChild(el.ceOwner);
  }
  ignoreEvent() { return false; }
}

function makeMarkdownEditorExt(plugin) {
  const build = (state) => {
    if (!plugin.settings.livePreview || !state.field(editorLivePreviewField, false))
      return Decoration.none;
    const path = state.field(editorInfoField, false)?.file?.path;
    if (!path) return Decoration.none;
    const ranges = [], doc = state.doc;
    let fence = null, frontmatter = false;
    for (let n = 1; n <= doc.lines; n++) {
      const line = doc.line(n), text = line.text;
      if (n === 1 && text.trim() === "---") { frontmatter = true; continue; }
      if (frontmatter) { if (/^(---|\.\.\.)\s*$/.test(text)) frontmatter = false; continue; }
      const fm = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
      if (fence) {
        if (fm && fm[1][0] === fence.char && fm[1].length >= fence.length && !fm[2].trim()) fence = null;
        continue;
      }
      if (fm) { fence = { char: fm[1][0], length: fm[1].length }; continue; }
      if (/^(?: {4}|\t)/.test(text)) continue;
      const re = REF_RE(); let m;
      while ((m = re.exec(text)) !== null) {
        if (m.groups.esc || (m.groups.all.startsWith("![[") && !plugin.handlesMarkdownRef(m.groups.ref, path))) continue;
        // Literal examples inside inline code must remain editable as written.
        const prefix = text.slice(0, m.index);
        let tick = null;
        for (const run of prefix.matchAll(/`+/g)) {
          if (tick === null) tick = run[0].length;
          else if (tick === run[0].length) tick = null;
        }
        if (tick !== null) continue;
        if (state.selection.ranges.some((r) => r.from <= line.to && r.to >= line.from)) continue;
        const from = line.from + m.index, to = from + m[0].length;
        const block = text.trim() === m[0];
        ranges.push(Decoration.replace({
          widget: new MarkdownEmbedWidget(plugin, m.groups.ref, path, plugin.ver, block),
          block, inclusive: false
        }).range(from, to));
      }
    }
    return Decoration.set(ranges, true);
  };
  return StateField.define({
    create: build,
    update(value, tr) {
      if (tr.docChanged || tr.selectionSet || tr.effects.length) return build(tr.state);
      return value;
    },
    provide: (field) => EditorView.decorations.from(field)
  });
}

function makeLinkNavExt(plugin) {
  return EditorView.domEventHandlers({
    mousedown(e, view) {
      if (!e.ctrlKey && !e.metaKey) return;
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos == null) return;
      const path = view.state.field(editorInfoField, false)?.file?.path;
      if (!path) return;
      const line = view.state.doc.lineAt(pos);
      const re = /!?\[\[([^\]]+)\]\]/g;
      let m;
      while ((m = re.exec(line.text)) !== null) {
        const from = line.from + m.index, to = from + m[0].length;
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
    }
  });
}


class CEPanel extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Code Embed"; }
  getIcon() { return "link"; }
  async onOpen() { this.contentEl.addClass("ce-panel-view"); await this.render(); }
  async render() { await this.plugin.renderPanelView(this); }
}

class CodeEmbedSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  async set(key, val) {
    this.plugin.settings[key] = val;
    await this.plugin.saveData(this.plugin.settings);
    this.plugin.applySettings(key);
  }

  toggle(el, key, name, desc) {
    new Setting(el).setName(name).setDesc(desc)
      .addToggle((t) => t.setValue(this.plugin.settings[key]).onChange((v) => this.set(key, v)));
  }

  slider(el, key, name, desc, min, max, step) {
    new Setting(el).setName(name).setDesc(desc)
      .addSlider((s) => s.setLimits(min, max, step).setValue(this.plugin.settings[key])
        .setDynamicTooltip().onChange((v) => this.set(key, v)));
  }

  color(el, key, name, desc) {
    new Setting(el).setName(name).setDesc(desc)
      .addColorPicker((c) => c.setValue(this.plugin.settings[key] || COLOR_FALLBACK[key]).onChange((v) => this.set(key, v)))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip(t("restoreDefault")).onClick(async () => {
        await this.set(key, "");
        this.display();
      }));
  }

  display() {
    const { containerEl: el } = this;
    el.empty();

    new Setting(el).setName("Code Embed · " + this.plugin.manifest.version).setHeading();
    el.createEl("a", { text: t("helpGuide"), href: guideUrl(), attr: { target: "_blank", rel: "noopener noreferrer" } });
    new Setting(el).setName(t("chooseFolder"))
      .addButton(button => button.setButtonText(t("chooseFolder")).onClick(() => this.plugin.choosePackageFolder()));
    this.toggle(el, "showAllFolderActions", t("showAllFolderActions"), t("showAllFolderActionsHelp"));
    this.color(el, "packageColor", t("rootColor"), t("rootColorHelp"));
    new Setting(el).setName(t("expansion")).setHeading();
    this.slider(el, "maxDepth", t("maxDepth"), t("maxDepthHelp"), 1, 10, 1);
    this.toggle(el, "livePreview", t("livePreview"), t("livePreviewHelp"));

    new Setting(el).setName(t("previewMode")).setHeading();
    this.toggle(el, "viewTree", t("viewTree"), t("viewTreeHelp"));
    this.toggle(el, "xmlPlain", t("xmlPlain"), t("xmlPlainHelp"));
    this.slider(el, "treeOpenDepth", t("treeOpenDepth"), t("treeOpenDepthHelp"), 0, 10, 1);
    this.slider(el, "inlineMax", t("inlineMax"), t("inlineMaxHelp"), 0, 200, 10);
    this.toggle(el, "buttonsOnPlain", t("buttonsOnPlain"), t("buttonsOnPlainHelp"));

    new Setting(el).setName(t("sidebars")).setHeading();
    this.toggle(el, "showPanels", t("showPanels"), t("showPanelsHelp"));
    this.toggle(el, "panelOnTop", t("panelOnTop"), t("panelOnTopHelp"));
    this.toggle(el, "panelNested", t("panelNested"), t("panelNestedHelp"));
    this.slider(el, "panelMaxVh", t("panelMaxVh"), t("panelMaxVhHelp"), 20, 90, 5);
    this.toggle(el, "panelLinks", t("panelLinks"), t("panelLinksHelp"));

    new Setting(el).setName(t("rename")).setHeading();
    this.toggle(el, "autoRenameFile", t("autoRenameFile"), t("autoRenameFileHelp"));
    this.toggle(el, "autoRenameTag", t("autoRenameTag"), t("autoRenameTagHelp"));
    this.toggle(el, "autoRenameSection", t("autoRenameSection"), t("autoRenameSectionHelp"));
    this.toggle(el, "renameNotice", t("renameNotice"), t("renameNoticeHelp"));

    new Setting(el).setName(t("warnings")).setHeading();
    this.toggle(el, "warnBroken", t("warnBroken"), t("warnBrokenHelp"));
    this.slider(el, "validateDelay", t("validateDelay"), t("validateDelayHelp"), 500, 10000, 500);

    new Setting(el).setName(t("colors")).setHeading();
    this.color(el, "cWidgetBorder", t("cWidgetBorder"), t("cWidgetBorderHelp"));
    this.color(el, "cWidgetBg", t("cWidgetBg"), t("cWidgetBgHelp"));
    this.slider(el, "cWidgetBgAlpha", t("cWidgetBgAlpha"), t("cWidgetBgAlphaHelp"), 0, 100, 5);
    this.color(el, "cErrBorder", t("cErrBorder"), t("cErrBorderHelp"));
    this.color(el, "cErrBg", t("cErrBg"), t("cErrBgHelp"));
    this.slider(el, "cErrBgAlpha", t("cErrBgAlpha"), t("cErrBgAlphaHelp"), 0, 100, 5);
    this.color(el, "cErrText", t("cErrText"), t("cErrTextHelp"));
    this.color(el, "cTreeTag", t("cTreeTag"), t("cTreeTagHelp"));
    this.color(el, "cTreeImport", t("cTreeImport"), t("cTreeImportHelp"));
    this.color(el, "cChip", t("cChip"), t("cChipHelp"));

    new Setting(el).setName(t("resetAll")).setDesc(t("resetHelp"))
      .addButton((b) => b.setButtonText(t("reset")).onClick(async () => {
        this.plugin.settings = Object.assign({}, DEFAULTS);
        await this.plugin.saveData(this.plugin.settings);
        this.plugin.applySettings("all");
        this.display();
      }));
  }
}

class BrokenModal extends Modal {
  constructor(app, plugin, list) { super(app); this.plugin = plugin; this.list = list; }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText("⚠ Code Embed: " + t("broken") + " (" + this.list.length + ")");
    const box = contentEl.createDiv({ cls: "ce-broken-box" });
    for (const b of this.list) {
      const row = box.createDiv({ cls: "ce-broken-row" });
      row.createDiv({ cls: "ce-broken-path", text: b.file.path + " : L" + (b.line + 1) });
      row.createEl("code", { text: formatEmbed(b.ref) });
      row.createDiv({ cls: "ce-broken-why", text: b.why });
      row.onclick = () => { this.close(); this.plugin.goTo(b.file, b.line, b.ch); };
    }
    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText(t("dismiss")).setCta().onClick(() => this.close()))
      .addButton((btn) => btn.setButtonText(t("disableWarnings")).onClick(async () => {
        this.plugin.settings.warnBroken = false;
        await this.plugin.saveData(this.plugin.settings);
        this.plugin.brokenPrev = null;
        this.close();
      }));
  }
  onClose() {
    this.contentEl.empty();
    this.plugin.brokenModal = null;
  }
}


class EmbedSuggest extends EditorSuggest {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onTrigger(cursor, editor, file) {
    if (!file) return null;
    const line = editor.getLine(cursor.line), before = line.slice(0, cursor.ch);
    const m = /(?:^|[^\\\\])!\[([^\[\]]*)$/.exec(before);
    if (!m || /^\]\s*[([]/.test(line.slice(cursor.ch))) return null;
    return { start: { line: cursor.line, ch: cursor.ch - m[1].length - 2 },
      end: { line: cursor.line, ch: cursor.ch + Number(line[cursor.ch] === "]") }, query: m[1] };
  }
  async getSuggestions({ file, query }) {
    const index = this.plugin.packages(), root = index.root(file.path);
    const pos = query.indexOf(":"), local = /^[#<]/.test(query);
    if (pos < 0 && !local) {
      const files = root === null ? this.app.vault.getMarkdownFiles() : index.groups.get(root) || [];
      return files.filter(f => f.extension === "md" && f.name !== MARKER &&
        f.path.toLowerCase().includes(query.toLowerCase())).map(f => {
        const short = this.plugin.findFile(f.basename, file.path) === f;
        const name = short ? f.basename : root === null ? f.path : relativeTo(root, f.path);
        return formatEmbed(name);
      }).slice(0, 80);
    }
    const name = local ? "" : query.slice(0, pos), prefix = local ? query : query.slice(pos + 1);
    const target = this.plugin.findFile(name, file.path);
    if (!target) return [];
    const body = await this.plugin.read(target);
    const selectors = [...headingsOf(body, true).flatMap(h => ["#" + h, "##" + h]),
      ...tagsOf(body).flatMap(tag => ["<" + tag + ">", "<<" + tag + ">>"])];
    return selectors.filter(s => s.toLowerCase().startsWith(prefix.toLowerCase()))
      .map(s => formatEmbed((name ? name + ":" : "") + s)).slice(0, 80);
  }
  renderSuggestion(value, el) { el.setText(value); }
  selectSuggestion(value) {
    const { editor, start, end } = this.context;
    editor.replaceRange(value, start, end);
    editor.setCursor({ line: start.line, ch: start.ch + value.length });
  }
}

function isVaultFolder(file) {
  return Boolean(file && (file instanceof TFolder || Array.isArray(file.children)));
}

const MARKER = "_code-embed-root.md";
const folderOf = path => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const relativeTo = (root, path) => root ? path.slice(root.length + 1) : path;
const markerPath = root => (root && root !== "/" ? root + "/" : "") + MARKER;

class PackageIndex {
  constructor(files) {
    this.roots = new Set(files.filter(f => f.name === MARKER).map(f => folderOf(f.path)));
    this.groups = new Map();
    for (const file of files) {
      if (file.name === MARKER) continue;
      const root = this.root(file.path);
      if (root === null) continue;
      if (!this.groups.has(root)) this.groups.set(root, []);
      this.groups.get(root).push(file);
    }
  }

  root(path) {
    let folder = folderOf(path);
    while (!this.roots.has(folder)) {
      if (!folder) return null;
      folder = folderOf(folder);
    }
    return folder;
  }

  lookup(name, root) {
    const available = this.groups.get(root) || [];
    const safe = !name.includes("\\") && name.split("/").every(s => s && s !== "." && s !== "..");
    let hits = [];
    if (safe && name.includes("/")) {
      hits = available.filter(f => {
        const rel = relativeTo(root, f.path);
        return rel === name || rel === name + ".md";
      });
    } else if (safe) {
      hits = available.filter(f => f.name === name || f.extension === "md" && f.basename === name);
      // A root-level duplicate can be selected by its complete filename.
      if (hits.length > 1 && name.endsWith(".md")) {
        const exact = hits.find(f => relativeTo(root, f.path) === name);
        if (exact) hits = [exact];
      }
    }
    if (hits.length === 1 && this.root(hits[0].path) === root) return { file: hits[0] };
    const where = " (" + t("package") + ": " + (root || "/") + ")";
    return { error: hits.length > 1 ? t("ambiguous") + ": " + name + where + " — " +
      hits.map(f => relativeTo(root, f.path)).sort().join(", ") : t("notInPackage") + ": " + name + where };
  }
}

class CodeEmbedPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.rawIndex = new Map();
    this.brokenPrev = null;
    this.valT = null;
    this.valSeq = 0;
    this.panelSeq = 0;
    this.fold = {};
    this.activeRenameCount = 0;
    this.addSettingTab(new CodeEmbedSettings(this.app, this));

    this.cache = new Map();
    this.refIndex = new Map();
    this.ver = 0;
    this.timer = null;
    this.injT = null;
    this.injSeq = 0;
    this.lastFile = null;
    this.watched = new WeakSet();

    this.applyColors();
    const funding = this.manifest.fundingUrl;
    const link = typeof funding === "string" ? funding : Object.values(funding || {})[0];
    if (link && /^https:\/\//i.test(link)) this.addCommand({
      id: "support", name: t("support"), callback: async () => {
        const links = typeof funding === "string" ? [[t("support"), funding]] : Object.entries(funding);
        const options = links.filter(([, url]) => /^https:\/\//i.test(url)).map(([label, url]) => ({ label, url }));
        const choice = options.length === 1 ? options[0] : await pickOne(this.app, t("support"), options);
        if (choice) window.open(choice.url, "_blank", "noopener,noreferrer");
      }
    });

    this.registerView(VIEW_TYPE, (leaf) => new CEPanel(leaf, this));
    this.addRibbonIcon("link", t("panel"), () => this.openPanel());
    this.addCommand({ id: "open-panel", name: t("openPanel"), callback: () => this.openPanel() });

    this.registerEditorExtension([makeEditorExt(this), makeMarkdownEditorExt(this), makeLinkNavExt(this)]);
    this.registerMarkdownPostProcessor((el, ctx) => this.postProcess(el, ctx));

    this.addCommand({
      id: "copy-expanded",
      name: t("copyBlock"),
      editorCallback: async (editor, view) => {
        const lines = editor.getValue().split("\n");
        const cur = editor.getCursor().line;
        let s = -1, e = -1;
        for (let i = cur; i >= 0; i--) if (FENCE_RE.test(lines[i])) { s = i; break; }
        for (let i = Math.max(cur, s + 1); i < lines.length; i++) if (FENCE_RE.test(lines[i]) && i > s) { e = i; break; }
        if (s < 0 || e < 0) { new Notice(t("notInBlock")); return; }
        const block = lines.slice(s + 1, e).join("\n");
        const expanded = await this.expand(block, view.file?.path ?? "", [], false, block);
        await navigator.clipboard.writeText(applyArgs(expanded, [], false));
        new Notice(t("blockCopied"));
      }
    });

    const ws = this.app.workspace, v = this.app.vault;
    this.registerEvent(v.on("modify", (f) => { this.refIndex.delete(f.path); this.rawIndex.delete(f.path); this.invalidate(); this.scheduleInject(); this.scheduleValidate(); }));
    const refreshFiles = () => {
      this.packageIndex = null;
      this.cache.clear();
      this.refIndex.clear();
      this.rawIndex.clear();
      this.invalidate();
      this.scheduleInject();
      this.scheduleValidate();
      this.scheduleFolders();
      this.suggest?.close();
    };
    this.registerEvent(v.on("create", refreshFiles));
    this.registerEvent(v.on("delete", refreshFiles));
    this.registerEvent(v.on("rename", (file, oldPath) => {
      refreshFiles();
      this.trackMovedSources(file, oldPath).catch(console.error);
    }));

    this.registerEvent(ws.on("file-open", () => this.scheduleInject()));
    this.registerEvent(ws.on("active-leaf-change", () => this.scheduleInject()));
    this.registerEvent(ws.on("layout-change", () => this.scheduleInject()));
    this.app.workspace.onLayoutReady(() => {
      this.scheduleInject();
      setTimeout(() => this.validate(true), 3000);
    });

    for (const [kind, name] of [["xml", t("insertXml")], ["markdown", t("insertMarkdown")]]) {
      this.addCommand({ id: "insert-" + kind, name,
        editorCallback: editor => promptFragment(this.app, editor, kind) });
    }
    this.addCommand({ id: "expand-shortcut", name: t("expandShortcut"),
      editorCheckCallback: (checking, editor) => {
        const trigger = triggerAt(editor);
        if (!trigger) return false;
        if (!checking) {
          const xml = trigger.slice(1, 5) === "xvar";
          const tagName = trigger.slice(5);
          if (xml && tagName) {
            insertFragment(editor, "xml", tagName, trigger);
          } else {
            promptFragment(this.app, editor, xml ? "xml" : "markdown", trigger);
          }
        }
        return true;
      } });
    this.setupFolders();
    this.suggest = new EmbedSuggest(this.app, this);
    this.registerEditorSuggest(this.suggest);
    this.setupRename();
    this.registerDomEvent(document, "click", (e) => this.onClick(e), true);
  }

  onunload() {
    document.querySelectorAll(".ce-native-section").forEach((e) => e.remove());
    document.querySelectorAll(".ce-host").forEach((e) => e.classList.remove("ce-host"));
    const st = document.body.style;
    ["--ce-panel-max", "--ce-widget-border", "--ce-widget-bg", "--ce-err-border", "--ce-err-bg",
     "--ce-err-text", "--ce-tag", "--ce-import", "--ce-chip"].forEach((p) => st.removeProperty(p));
    clearTimeout(this.timer);
    clearTimeout(this.valT);
    clearTimeout(this.injT);
    this.teardownRename();
    this.brokenModal?.close();
  }

  applyColors() {
    const s = this.settings, st = document.body.style;
    const setv = (name, val) => { if (val) st.setProperty(name, val); else st.removeProperty(name); };
    st.setProperty("--ce-panel-max", s.panelMaxVh + "vh");
    setv("--ce-widget-border", s.cWidgetBorder);
    setv("--ce-widget-bg", s.cWidgetBg ? rgba(s.cWidgetBg, s.cWidgetBgAlpha) : "");
    setv("--ce-err-border", s.cErrBorder);
    setv("--ce-err-bg", s.cErrBg ? rgba(s.cErrBg, s.cErrBgAlpha) : "");
    setv("--ce-err-text", s.cErrText);
    setv("--ce-package-color", s.packageColor);
    setv("--ce-tag", s.cTreeTag);
    setv("--ce-import", s.cTreeImport);
    setv("--ce-chip", s.cChip);
  }

  applySettings(key) {
    this.applyColors();
    if (key === "showAllFolderActions" || key === "all") this.scheduleFolders();
    this.refIndex.clear();
    this.rawIndex.clear();
    this.invalidate();
    this.scheduleInject();
    if (key === "warnBroken" || key === "maxDepth" || key === "all") {
      if (this.settings.warnBroken) this.validate(true);
      else this.brokenPrev = null;
    }
  }

  invalidate() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.cache.clear();
      this.ver++;
      this.app.workspace.iterateAllLeaves((leaf) => {
        const v = leaf.view;
        if (v instanceof MarkdownView) {
          const cm = v.editor?.cm;
          if (cm) cm.dispatch({ effects: [refresh.of(null)] });
          if (v.getMode() === "preview") v.previewMode.rerender(true);
        }
      });
    }, 500);
  }


  rawRefs(text) {
    const lines = text.split("\n"), out = [];
    let inF = false, block = null;
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (FENCE_RE.test(line)) {
        if (!inF) {
          const b = [];
          for (let k = idx + 1; k < lines.length && !FENCE_RE.test(lines[k]); k++) b.push(lines[k]);
          block = b.join("\n");
        }
        inF = !inF;
        continue;
      }
      if (!hasEmbed(line)) continue;
      const re = REF_RE(); let m;
      while ((m = re.exec(line)) !== null) {
        if (m.groups.esc) continue;
        const p = parseRef(m.groups.ref);
        if (!inF && m.groups.all.startsWith("![[") && !ownsWikiEmbed(p, m.groups.ref)) continue;
        out.push({ ref: m.groups.ref, p, line: idx, ch: m.index, local: inF ? block : null });
      }
    }
    return out;
  }

  async rawOf(file) {
    let hit = this.rawIndex.get(file.path);
    if (!hit) { hit = this.rawRefs(await this.read(file)); this.rawIndex.set(file.path, hit); }
    return hit;
  }

  async checkItem(it, file) {
    const expanded = await this.resolve(it.ref, file.path, [], false, it.local);
    return firstError(expanded) || null;
  }

  async collectErrors() {
    const out = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (f.name === MARKER) continue;
      for (const it of await this.rawOf(f)) {
        const why = await this.checkItem(it, f);
        if (why) out.push({ file: f, line: it.line, ch: it.ch, ref: it.ref, why });
      }
    }
    return out;
  }

  scheduleValidate() {
    if (!this.settings.warnBroken) return;
    clearTimeout(this.valT);
    this.valT = setTimeout(() => this.validate(false), this.settings.validateDelay);
  }

  async validate(silent) {
    if (!this.settings.warnBroken) return;
    if (this.activeRenameCount) return;
    const my = ++this.valSeq;
    const list = await this.collectErrors();
    if (my !== this.valSeq || this.activeRenameCount) return;
    const cur = new Map();
    for (const e of list) {
      const key = e.file.path + "|" + e.ref + "|" + e.why;
      if (!cur.has(key)) cur.set(key, e);
    }
    const prev = this.brokenPrev;
    this.brokenPrev = new Set(cur.keys());
    if (silent || !prev) return;
    const fresh = [...cur.entries()].filter(([k]) => !prev.has(k)).map(([, v]) => v);
    if (fresh.length) this.notifyBroken(fresh);
  }

  notifyBroken(list) {
    if (this.activeRenameCount) return;
    const k = (b) => b.file.path + "|" + b.ref + "|" + b.why;
    if (this.brokenModal) {
      const m = this.brokenModal;
      const have = new Set(m.list.map(k));
      for (const b of list) if (!have.has(k(b))) m.list.push(b);
      m.onOpen();
      return;
    }
    this.brokenModal = new BrokenModal(this.app, this, [...list]);
    this.brokenModal.open();
  }


  async read(file) {
    if (this.cache.has(file.path)) return this.cache.get(file.path);
    const t = await this.app.vault.cachedRead(file);
    this.cache.set(file.path, t);
    return t;
  }

  async trackMovedSources(item, oldPath) {
    const files = this.app.vault.getFiles();
    const moved = files.filter(f => f.path === item.path || f.path.startsWith(item.path + "/"));
    const oldPaths = new Map(moved.map(f => [f, oldPath + f.path.slice(item.path.length)]));
    const previous = new PackageIndex(files.map(f => oldPaths.has(f) ?
      { path: oldPaths.get(f), name: oldPaths.get(f).split("/").pop(), extension: f.extension,
        basename: oldPaths.get(f).split("/").pop().replace(/\.md$/i, ""), actual: f } : f));
    const guards = this.settings.movedReferences ||= Object.create(null);
    let changed = false;
    for (const file of moved) {
      if (file.extension !== "md" || file.name === MARKER) continue;
      const before = oldPaths.get(file), oldRoot = previous.root(before);
      const root = this.packages().root(file.path);
      const names = new Map(Object.entries(guards[before] || {}));
      if (guards[before]) { delete guards[before]; changed = true; }
      if (oldRoot !== null && oldRoot !== root) {
        for (const { p } of this.rawRefs(await this.app.vault.cachedRead(file))) {
          if (p.name === ".") continue;
          const prior = previous.lookup(p.name, oldRoot).file;
          const next = this.lookupWithin(p.name, file.path, root).file;
          if (prior && (prior.actual || prior) !== next) names.set(p.name, prior.actual?.path || prior.path);
        }
      }
      if (names.size) { guards[file.path] = Object.fromEntries(names); changed = true; }
    }
    if (changed) { await this.saveData(this.settings); this.invalidate(); this.scheduleValidate(); }
  }

  folderActionLabel(folder) {
    const marker = this.app.vault.getAbstractFileByPath(markerPath(folder.path));
    return marker && !isVaultFolder(marker) ? t("unmarkFolder") : t("markFolder");
  }

  async choosePackageFolder() {
    const vault = this.app.vault;
    const root = vault.getRoot();
    const folders = [root, ...vault.getAllLoadedFiles().filter(file => isVaultFolder(file) && file !== root)];
    const choice = await pickOne(this.app, t("chooseFolder"), folders.map(folder =>
      ({ folder, label: folder.path + " — " + this.folderActionLabel(folder) })));
    if (choice) await this.toggleFolder(choice.folder);
  }

  setupFolders() {
    const populatedMenus = new WeakSet();
    const addFolderAction = (menu, folder) => {
      if (!isVaultFolder(folder) || populatedMenus.has(menu)) return;
      populatedMenus.add(menu);
      menu.addItem(item => item.setTitle(this.folderActionLabel(folder)).setIcon("folder-cog")
        .onClick(() => this.toggleFolder(folder)));
    };
    const workspace = this.app.workspace;
    this.registerEvent(workspace.on("file-menu", addFolderAction));
    this.registerEvent(workspace.on("files-menu", (menu, files) => {
      if (files.length === 1) addFolderAction(menu, files[0]);
    }));
    const chooseFolder = () => this.choosePackageFolder();
    this.addCommand({ id: "choose-package-folder", name: t("chooseFolder"), callback: chooseFolder });
    this.addRibbonIcon("folder-cog", t("chooseFolder"), chooseFolder);
    this.app.workspace.onLayoutReady(() => this.scheduleFolders());
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleFolders()));
    const observer = new MutationObserver(records => {
      if (records.some(r => r.type === "attributes" || r.target.matches?.(".nav-folder-title") && !r.target.querySelector(".ce-folder-action") || [...r.addedNodes].some(n =>
        n.nodeType === 1 && (n.matches(".nav-folder, .nav-folder-title, .workspace-leaf-content[data-type=file-explorer]") || n.querySelector(".nav-folder-title") || n.parentElement?.closest(".nav-folder-title") && !n.matches(".ce-folder-action"))))) this.scheduleFolders();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-path"] });
    this.register(() => {
      observer.disconnect();
      cancelAnimationFrame(this.folderFrame);
      document.querySelectorAll(".ce-folder-action").forEach(el => el.remove());
      document.querySelectorAll(".ce-package-folder").forEach(el => el.classList.remove("ce-package-folder"));
      document.body.style.removeProperty("--ce-package-color");
    });
    this.scheduleFolders();
  }

  scheduleFolders() {
    if (this.folderFrame != null) return;
    this.folderFrame = requestAnimationFrame(() => {
      this.folderFrame = null;
      for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
        const view = leaf.view;
        // Some explorer versions keep the file on the tree item rather than the title element.
        const rows = new Map();
        const items = view.fileItems instanceof Map ? view.fileItems.values() : Object.values(view.fileItems || {});
        for (const item of items) {
          if (!isVaultFolder(item.file)) continue;
          const row = item.selfEl || item.el?.querySelector(".nav-folder-title");
          if (row?.isConnected) rows.set(row, item.file);
        }
        for (const row of view.containerEl.querySelectorAll(".nav-folder-title")) {
          if (rows.has(row)) continue;
          const path = row.dataset.path ?? row.closest(".nav-folder")?.dataset.path
            ?? row.querySelector("[data-path]")?.dataset.path;
          const folder = path && this.app.vault.getAbstractFileByPath(path);
          if (isVaultFolder(folder)) rows.set(row, folder);
        }
        for (const [row, folder] of rows) this.decorateFolder(row, folder);
      }
    });
  }

  decorateFolder(row, folder) {
    const folderPath = folder.path === "/" ? "" : folder.path;
    const showAll = this.settings.showAllFolderActions;
    const marked = this.packages().roots.has(folderPath);
    row.classList.toggle("ce-package-folder", marked);
    let button = row.querySelector(".ce-folder-action");
    if (!showAll && !marked) {
      button?.remove();
      return;
    }
    if (!button) {
      button = row.createEl("button", { cls: "ce-folder-action" });
      button.type = "button";
      button.addEventListener("pointerdown", event => event.stopPropagation());
      button.addEventListener("mousedown", event => event.stopPropagation());
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const current = this.app.vault.getAbstractFileByPath(button.dataset.folderPath);
        if (isVaultFolder(current)) this.toggleFolder(current);
      });
    }
    button.dataset.folderPath = folder.path;
    const label = marked ? t("rootActive") : t("rootSet");
    if (button.textContent !== label) button.textContent = label;
    button.title = marked ? t("unmarkFolder") : t("markFolder");
    button.setAttribute("aria-label", button.title + " — " + folder.path);
  }

  async toggleFolder(folder) {
    const path = markerPath(folder.path), existing = this.app.vault.getAbstractFileByPath(path);
    try {
      if (!existing) {
        await this.app.vault.create(path, "");
        this.scheduleFolders();
        new Notice(t("rootCreated", { path: folder.path }));
        return;
      }
      if (isVaultFolder(existing)) { new Notice(t("markerIsFolder", { path })); return; }
      const choice = await pickOne(this.app, t("confirmUnmark", { path }),
        [{ label: t("cancel") }, { label: t("removeMarker", { path }), remove: true }]);
      if (choice?.remove && existing.path === path && this.app.vault.getAbstractFileByPath(path) === existing) {
        await this.app.vault.trash(existing, true);
        this.scheduleFolders();
        new Notice(t("rootRemoved", { path: folder.path }));
      }
    } catch (error) { new Notice(error.message); }
  }

  packages() {
    return this.packageIndex ||= new PackageIndex(this.app.vault.getFiles());
  }

  lookup(name, sourcePath, root = this.packages().root(sourcePath)) {
    const result = this.lookupWithin(name, sourcePath, root);
    const bindings = this.settings.movedReferences?.[sourcePath];
    if (bindings && Object.prototype.hasOwnProperty.call(bindings, name) && result.file?.path !== bindings[name])
      return { error: t("lostTarget") + ": " + name + " (" + t("package") + ": " + (root ?? t("outsidePackage")) + ")" };
    return result;
  }

  lookupWithin(name, sourcePath, root) {
    if (name !== "." && name && root !== null) return this.packages().lookup(name, root);
    const file = this.unscopedFile(name, sourcePath);
    if (!file || file.name === MARKER || root !== null && this.packages().root(file.path) !== root)
      return { error: t("missingNote") + ": " + name + (root === null ? "" : " (" + t("package") + ": " + (root || "/") + ")") };
    return { file };
  }

  findFile(name, sourcePath) {
    return this.lookup(name, sourcePath).file || null;
  }

  unscopedFile(name, sourcePath) {
    if (name === "." || name === "") {
      const f = this.app.vault.getAbstractFileByPath(sourcePath);
      return f && f.extension ? f : null;
    }
    const linked = this.app.metadataCache.getFirstLinkpathDest(name, sourcePath);
    if (linked) return linked;
    if (!/\.(?:[cm]?js|jsx|tsx?|json|css|html|xml|ya?ml|toml|py|java|sh|sql|txt)$/i.test(name)) return null;
    const folder = sourcePath.slice(0, Math.max(0, sourcePath.lastIndexOf('/') + 1));
    for (const path of new Set([folder + name, name])) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file && typeof file.extension === 'string') return file;
    }
    return null;
  }

  async expand(text, sourcePath, stack = [], mark = false, local = null, root = this.packages().root(sourcePath)) {
    const re = REF_RE();
    const parts = [];
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      parts.push(text.slice(last, m.index));
      if (m.groups.esc) parts.push(m.groups.all);
      else parts.push(await this.resolve(m.groups.ref, sourcePath, stack, mark, local, root));
      last = re.lastIndex;
    }
    parts.push(text.slice(last));
    return parts.join("");
  }

  // For self-references, a matching fragment in the active block takes precedence over the note.
  async resolve(ref, sourcePath, stack = [], mark = false, local = null, root = this.packages().root(sourcePath)) {
    const p = parseRef(ref);
    const range = p.range;
    const { file, error } = this.lookup(p.name, sourcePath, root);
    const scope = root === null ? "" : " (" + t("package") + ": " + (root || "/") + ")";
    let text = null, outPath = sourcePath, outLocal = null, key;

    const self = !!file && file.path === sourcePath;
    let localErr = null;
    if (self && local != null) {
      try { text = slice(local, range); key = file.path + "|block|" + range; outLocal = local; }
      catch (e) { text = null; localErr = e; }
    }
    if (text === null) {
      if (!file) return formatError(error);
      key = file.path + "|" + range;
    }

    if (stack.length >= this.settings.maxDepth) return formatError(t("depthExceeded") + " (" + this.settings.maxDepth + ")" + scope);
    if (stack.includes(key)) return formatError(t("cycle") + ": " + [...stack, key].join(" → ") + scope);

    if (text === null) {
      try { text = slice(await this.read(file), range); }
      catch (e) {
        const where = localErr ? " (" + t("searchedBlock", { path: file.path }) + ")" : "";
        return formatError(e.message.replace(/\]/g, ")") + where + scope);
      }
      outPath = file.path;
    }

    text = applyArgs(text, p.args || [], !!p.args);
    const out = await this.expand(text, outPath, [...stack, key], mark, outLocal, root);
    return mark ? "\u0001" + ref.replace(/[\u0001-\u0003]/g, "") + "\u0002" + out + "\u0003" : out;
  }


  scanText(text, off) {
    const lines = text.split("\n"), fence = fenceAware(lines), out = [];
    const re = /(!?)\[\[([^\]]+)\]\]/g;
    lines.forEach((line, idx) => {
      for (const m of line.matchAll(REF_RE())) {
        if (!m.groups.esc && !m.groups.all.startsWith('![[')) {
          out.push({ ref: m.groups.ref, codeEmbed: true, embed: true, line: off + idx, ch: m.index, fence: fence[idx] });
        }
      }
      if (!line.includes('[[')) return;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        out.push({ ref: m[2], embed: m[1] === "!", line: off + idx, ch: m.index, fence: fence[idx] });
      }
    });
    return out;
  }

  resolveRefs(raw, srcPath, root = this.packages().root(srcPath)) {
    const out = [];
    for (const r of raw) {
      const p = parseRef(r.ref);
      if (!p.name) continue;
      const target = this.lookup(p.name, srcPath, root).file;
      if (!target) continue;
      out.push({ target, codeEmbed: r.codeEmbed, range: p.range, heading: p.heading, native: isNativeHeading(p), line: r.line, ch: r.ch, fence: r.fence, embed: r.embed });
    }
    return out;
  }

  async refsOf(file) {
    const hit = this.refIndex.get(file.path);
    if (hit) return hit;
    const text = await this.read(file);
    const all = this.resolveRefs(this.scanText(text, 0), file.path);
    const out = all.filter((r) => r.codeEmbed || (r.range && !r.native) || r.fence);
    this.refIndex.set(file.path, out);
    return out;
  }

  async buildNodes(src, refs, depth, stack, limit, root = this.packages().root(src.path)) {
    if (limit === undefined) limit = this.settings.maxDepth;
    const groups = new Map();
    for (const r of refs) {
      const key = r.target.path + "|" + r.range;
      let g = groups.get(key);
      if (!g) { g = { key, file: r.target, range: r.range, occ: [], children: [], depth }; groups.set(key, g); }
      g.occ.push({ file: src, line: r.line, ch: r.ch });
    }
    for (const g of groups.values()) {
      if (depth >= limit || stack.includes(g.key)) continue;
      try {
        const full = await this.read(g.file);
        const frag = slice(full, g.range);
        const p = frag ? full.indexOf(frag) : -1;
        const off = p > 0 ? countNl(full.slice(0, p)) : 0;
        const kids = this.resolveRefs(this.scanText(frag, off), g.file.path, root).filter((r) => r.embed);
        g.children = await this.buildNodes(g.file, kids, depth + 1, [...stack, g.key], limit, root);
      } catch (e) {
        if (g.file.path !== g.occ[0].file.path) g.error = e.message;
      }
    }
    return [...groups.values()];
  }

  panelLimit() { return this.settings.panelNested ? this.settings.maxDepth : 0; }

  async outgoing(file) {
    const nodes = await this.buildNodes(file, await this.refsOf(file), 0, [], this.panelLimit());
    const flat = [];
    const walk = (ns, depth) => { for (const n of ns) { flat.push({ node: n, depth }); walk(n.children, depth + 1); } };
    walk(nodes, 0);
    return flat;
  }

  async incoming(file) {
    const res = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (f.name === MARKER) continue;
      const refs = await this.refsOf(f);
      if (!refs.length) continue;
      const nodes = await this.buildNodes(f, refs, 0, [], this.panelLimit());
      const walk = (ns, chain) => {
        for (const n of ns) {
          const c = [...chain, n];
          if (n.file.path === file.path) res.push({ node: n, root: f, chain: c, depth: 0 });
          walk(n.children, c);
        }
      };
      walk(nodes, []);
    }
    return res;
  }


  trackFile() {
    const f = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (f) this.lastFile = f;
  }

  scheduleInject() {
    clearTimeout(this.injT);
    this.injT = setTimeout(() => this.injectAll(), 250);
  }

  async injectAll() {
    this.trackFile();
    try { await this.injectPanes(); }
    catch (e) { console.error("code-embed", e); }
    this.refreshPanels();
  }

  async injectPanes() {
    if (!this.settings.showPanels) {
      document.querySelectorAll(".ce-native-section").forEach((e) => e.remove());
      document.querySelectorAll(".ce-host").forEach((e) => e.classList.remove("ce-host"));
      return;
    }
    const my = ++this.injSeq;
    for (const type of PANES) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        try { await this.inject(leaf, type, my); } catch (e) { console.error("code-embed", e); }
      }
    }
  }

  refreshPanels() {
    for (const l of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (l.view && typeof l.view.render === "function") l.view.render();
    }
  }

  async openPanel() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = ws.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    ws.revealLeaf(leaf);
  }

  labelOf(n) {
    return n.file.basename + (n.range ? (n.range.startsWith("#") ? n.range : ":" + n.range) : "");
  }

  async goTo(file, line, ch) {
    const ws = this.app.workspace;
    let leaf = null;
    ws.iterateAllLeaves((l) => {
      if (!leaf && l.view instanceof MarkdownView && l.view.file?.path === file.path) leaf = l;
    });
    if (!leaf) leaf = ws.getLeaf(false);
    await leaf.openFile(file, { active: true });
    ws.setActiveLeaf(leaf, { focus: true });
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return;
    if (view.getMode() !== "source") {
      await view.setState({ ...view.getState(), mode: "source" }, { history: false });
    }
    setTimeout(() => {
      const ed = view.editor;
      if (!ed) return;
      const last = Math.max(0, ed.lineCount() - 1);
      const pos = { line: Math.min(line, last), ch: ch || 0 };
      ed.setCursor(pos);
      ed.scrollIntoView({ from: pos, to: pos }, true);
      ed.focus();
    }, 60);
  }

  locateRange(text, range) {
    const r = (range || "").replace(/\([\s\S]*$/, "").replace(/\|.*$/, "").trim();
    if (!r) return { line: 0, ch: 0 };
    let m;
    if ((m = /^<<?([\w:.\-]+)>>?$/.exec(r))) {
      const open = "<" + m[1] + ">";
      const i = text.indexOf(open);
      if (i < 0) return { line: 0, ch: 0 };
      const ls = text.lastIndexOf("\n", i) + 1;
      return { line: countNl(text.slice(0, i)), ch: i - ls };
    }
    if (r.startsWith("#")) {
      const titles = r.replace(/^#+\s*/, "").split("#").map(normTitle).filter(Boolean);
      const lines = text.split("\n"), fence = fenceAware(lines);
      let from = 0, until = lines.length, lvl = 0, startLine = 0;
      for (const t of titles) {
        let found = -1;
        for (let i = from; i < until; i++) {
          if (FENCE_RE.test(lines[i])) continue;
          if (fence[i]) continue;
          const h = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
          if (!h) continue;
          if (found < 0) { if (normTitle(h[2]) === t) { found = i; lvl = h[1].length; } }
          else if (h[1].length <= lvl) break;
        }
        if (found < 0) return { line: startLine, ch: 0 };
        startLine = found;
        from = found + 1;
        until = lines.length;
        for (let i = from; i < lines.length; i++) {
          if (fence[i] || FENCE_RE.test(lines[i])) continue;
          const h = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
          if (h && h[1].length <= lvl) { until = i; break; }
        }
      }
      return { line: startLine, ch: 0 };
    }
    if ((m = /^(\d+)-(-\d+|\d*)$/.exec(r))) return { line: Math.max(0, Number(m[1]) - 1), ch: 0 };
    return { line: 0, ch: 0 };
  }

  async goToRange(file, range) {
    const text = await this.app.vault.cachedRead(file);
    const loc = this.locateRange(text, range);
    await this.goTo(file, loc.line, loc.ch);
  }

  fillSection(sec, key, title, count, fill) {
    const head = document.createElement("div");
    head.className = "ce-native-head";
    const body = document.createElement("div");
    body.className = "ce-native-body";
    body.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    const upd = () => {
      const f = !!this.fold[key];
      head.textContent = (f ? "▸ " : "▾ ") + title + " (" + count + ")";
      body.style.display = f ? "none" : "";
    };
    head.onclick = () => { this.fold[key] = !this.fold[key]; upd(); };
    fill(body);
    upd();
    sec.replaceChildren(head, body);
  }

  emptyNote(body, text) {
    body.createDiv({ cls: "ce-native-range", text });
  }

  chip(row, o, file) {
    const chip = row.createSpan({ cls: "ce-chip" });
    chip.textContent = (file && o.file.path === file.path ? "" : o.file.basename + ":") + "L" + (o.line + 1);
    chip.title = o.file.path + " : " + (o.line + 1);
    chip.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.goTo(o.file, o.line, o.ch); };
  }

  renderOutgoing(body, items, file) {
    if (!items.length) { this.emptyNote(body, t("empty")); return; }
    for (const it of items) {
      const n = it.node;
      const row = body.createDiv({ cls: "ce-native-row" });
      row.style.setProperty("--ce-indent", it.depth * 14 + 4 + "px");
      const label = row.createSpan({ cls: "ce-label" + (n.error ? " ce-bad" : "") });
      label.textContent = this.labelOf(n) + (n.error ? " ⚠ " + n.error : "");
      label.title = n.file.path;
      const first = n.occ[0];
      label.onclick = (e) => { e.preventDefault(); this.goTo(first.file, first.line, first.ch); };
      row.createSpan({ cls: "ce-count", text: "×" + n.occ.length });
      for (const o of n.occ) this.chip(row, o, file);
    }
  }

  renderIncoming(body, items, file) {
    if (!items.length) { this.emptyNote(body, t("empty")); return; }
    const groups = new Map();
    for (const it of items) {
      let g = groups.get(it.root.path);
      if (!g) { g = { root: it.root, rows: [], total: 0 }; groups.set(it.root.path, g); }
      g.rows.push(it);
      g.total += it.node.occ.length;
    }
    for (const g of groups.values()) {
      const gk = "g|" + g.root.path;
      const wrap = body.createDiv();
      const head = wrap.createDiv({ cls: "ce-native-row ce-group" });
      const arrow = head.createSpan({ cls: "ce-arrow" });
      const name = head.createSpan({ cls: "ce-label" });
      name.textContent = g.root.basename + (g.root.path === file.path ? " (" + t("currentNote") + ")" : "");
      name.title = g.root.path;
      head.createSpan({ cls: "ce-count", text: "×" + g.total });
      const kids = wrap.createDiv({ cls: "ce-children" });
      const upd = () => {
        const f = !!this.fold[gk];
        arrow.textContent = f ? "▸" : "▾";
        kids.style.display = f ? "none" : "";
      };
      arrow.onclick = (e) => { e.stopPropagation(); this.fold[gk] = !this.fold[gk]; upd(); };
      const first = g.rows[0].node.occ[0];
      name.onclick = (e) => { e.preventDefault(); this.goTo(first.file, first.line, first.ch); };
      for (const it of g.rows) {
        const n = it.node;
        const row = kids.createDiv({ cls: "ce-native-row" });
        const label = row.createSpan({ cls: "ce-label" });
        label.textContent = this.labelOf(n);
        label.title = n.file.path;
        const f0 = n.occ[0];
        label.onclick = (e) => { e.preventDefault(); this.goTo(f0.file, f0.line, f0.ch); };
        row.createSpan({ cls: "ce-count", text: "×" + n.occ.length });
        if (it.chain.length > 1) {
          row.createSpan({ cls: "ce-count", text: t("via") + " " + it.chain.slice(0, -1).map((c) => this.labelOf(c)).join(" → ") });
        }
        for (const o of n.occ) this.chip(row, o, null);
      }
      upd();
    }
  }

  renderErrors(body, errs, file) {
    if (!errs.length) { this.emptyNote(body, t("noErrors")); return; }
    const groups = new Map();
    for (const e of errs) {
      if (!groups.has(e.file.path)) groups.set(e.file.path, { file: e.file, list: [] });
      groups.get(e.file.path).list.push(e);
    }
    const ordered = [...groups.values()].sort((a, b) => {
      const ac = file && a.file.path === file.path ? 0 : 1, bc = file && b.file.path === file.path ? 0 : 1;
      return ac - bc || a.file.path.localeCompare(b.file.path);
    });
    for (const g of ordered) {
      const gk = "e|" + g.file.path;
      const wrap = body.createDiv();
      const head = wrap.createDiv({ cls: "ce-native-row ce-group" });
      const arrow = head.createSpan({ cls: "ce-arrow" });
      const name = head.createSpan({ cls: "ce-label", text: g.file.path });
      head.createSpan({ cls: "ce-count", text: "×" + g.list.length });
      const kids = wrap.createDiv({ cls: "ce-children" });
      const upd = () => {
        const f = !!this.fold[gk];
        arrow.textContent = f ? "▸" : "▾";
        kids.style.display = f ? "none" : "";
      };
      arrow.onclick = (e) => { e.stopPropagation(); this.fold[gk] = !this.fold[gk]; upd(); };
      name.onclick = () => this.goTo(g.file, g.list[0].line, g.list[0].ch);
      for (const e of g.list) {
        const row = kids.createDiv({ cls: "ce-native-row ce-error-row" });
        row.createSpan({ cls: "ce-chip", text: "L" + (e.line + 1) });
        row.createEl("code", { text: formatEmbed(e.ref) });
        row.createSpan({ cls: "ce-err", text: e.why });
        row.onclick = () => this.goTo(e.file, e.line, e.ch);
      }
      upd();
    }
  }

  async inject(leaf, type, my) {
    const view = leaf.view;
    if (!view || !view.containerEl) return;
    const root = view.contentEl || view.containerEl.querySelector(".view-content") || view.containerEl;
    root.classList.add("ce-host");
    if (!this.watched.has(root)) {
      this.watched.add(root);
      new MutationObserver(() => {
        if (!root.querySelector(":scope > .ce-native-section")) this.scheduleInject();
      }).observe(root, { childList: true });
    }
    const file = this.lastFile || this.app.workspace.getActiveFile();
    let sec = root.querySelector(":scope > .ce-native-section");
    if (!file) { sec?.remove(); return; }

    let items = [], err = null;
    try { items = type === "backlink" ? await this.incoming(file) : await this.outgoing(file); }
    catch (e) { console.error("code-embed", e); err = e && e.message ? e.message : String(e); }
    if (my !== this.injSeq) return;

    if (!sec) {
      sec = document.createElement("div");
      sec.className = "ce-native-section";
    }
    if (this.settings.panelOnTop) {
      if (root.firstElementChild !== sec) root.prepend(sec);
    } else if (root.lastElementChild !== sec) {
      root.appendChild(sec);
    }
    const isBack = type === "backlink";
    this.fillSection(sec, isBack ? "n-in" : "n-out",
      "Code Embed – " + (isBack ? t("backlinks") : t("outgoing")), items.length, (body) => {
        if (err) { body.createDiv({ cls: "ce-err", text: t("errorLabel") + ": " + err }); return; }
        if (isBack) this.renderIncoming(body, items, file);
        else this.renderOutgoing(body, items, file);
      });
  }

  async renderPanelView(view) {
    const my = ++this.panelSeq;
    const file = this.lastFile || this.app.workspace.getActiveFile();
    let errs = [], out = [], inc = [], fail = null;
    try {
      errs = await this.collectErrors();
      if (this.settings.panelLinks && file) {
        out = await this.outgoing(file);
        inc = await this.incoming(file);
      }
    } catch (e) { console.error("code-embed", e); fail = e && e.message ? e.message : String(e); }
    if (my !== this.panelSeq) return;

    const root = view.contentEl;
    root.empty();
    if (fail) root.createDiv({ cls: "ce-err", text: t("errorLabel") + ": " + fail });
    const mk = (key, title, count, fill) => {
      const sec = root.createDiv({ cls: "ce-native-section" });
      this.fillSection(sec, key, title, count, fill);
    };
    mk("p-err", t("errors"), errs.length, (b) => this.renderErrors(b, errs, file));
    if (this.settings.panelLinks && file) {
      mk("p-out", t("outgoing") + " – " + file.basename, out.length, (b) => this.renderOutgoing(b, out, file));
      mk("p-in", t("incoming") + " – " + file.basename, inc.length, (b) => this.renderIncoming(b, inc, file));
    }
  }


  async renderMd(md, el, path, owner = this) {
    if (MarkdownRenderer.render) await MarkdownRenderer.render(this.app, md, el, path, owner);
    else await MarkdownRenderer.renderMarkdown(md, el, path, owner);
  }

  async renderTree(nodes, parent, path, plain, depth) {
    for (const n of nodes) {
      if (n.type === "text") {
        if (!n.text.trim()) continue;
        const d = parent.createDiv({ cls: plain ? "ce-text ce-plain" : "ce-text markdown-rendered" });
        if (plain) fillErr(d, n.text.replace(/^\n+|\s+$/g, ""));
        else await this.renderMd(markErrors(n.text), d, path);
        continue;
      }
      const imp = n.type === "import";
      const label = imp ? "⤵ " + n.ref : "<" + n.tag + (n.attrs ? " " + n.attrs : "") + ">";

      if (imp && this.settings.inlineMax > 0 && n.children.length === 1 && n.children[0].type === "text") {
        const val = n.children[0].text.trim();
        if (val && !val.includes("\n") && val.length <= this.settings.inlineMax) {
          const s = parent.createSpan({ cls: "ce-inline-import" });
          const rf = s.createSpan({ cls: "ce-inline-ref", text: label });
          rf.title = n.ref;
          s.createSpan({ cls: "ce-inline-val", text: val });
          continue;
        }
      }

      if (!n.children.length) {
        parent.createDiv({ cls: "ce-leaf " + (imp ? "ce-import" : "ce-tag"), text: label });
        continue;
      }
      const det = parent.createEl("details", { cls: "ce-node" + (imp ? " ce-import" : "") });
      if (depth < this.settings.treeOpenDepth) det.open = true;
      det.createEl("summary", { text: label });
      const inner = det.createDiv({ cls: "ce-children" });
      await this.renderTree(n.children, inner, path, plain, depth + 1);
    }
  }

  async postProcess(el, ctx) {
    if (el.closest("[data-ce-rendered]")) return;
    const path = ctx.sourcePath;
    for (const pre of Array.from(el.querySelectorAll("pre"))) {
      const code = pre.querySelector("code");
      if (!code || pre.dataset.ce) continue;
      const raw = code.textContent;
      const lang = (pre.className + " " + code.className).match(/language-(\w+)/)?.[1] ?? "";
      const has = hasEmbed(raw);
      const isMd = lang === "markdown" || lang === "md";
      const isXml = lang === "xml";
      const autoView = lang === "ce" || lang === "codeembed";
      if (!autoView && !has && !(this.settings.buttonsOnPlain && (isMd || isXml))) continue;
      pre.dataset.ce = "1";
      const expandedRaw = has ? await this.expand(raw, path, [], false, raw) : raw;
      const expanded = applyArgs(expandedRaw, [], false);

      if (!autoView && expanded !== raw) {
        const holder = document.createElement("div"); holder.dataset.ceRendered = "1";
        const ticks = "`".repeat(expanded.split(/[^`]+/).reduce((n, x) => Math.max(n, x.length + 1), 3));
        const owner = new MarkdownRenderChild(pre); ctx.addChild(owner);
        await this.renderMd(ticks + lang + "\n" + expanded + (expanded.endsWith("\n") ? "" : "\n") + ticks, holder, path, owner);
        const rendered = holder.querySelector("pre code");
        if (rendered) code.replaceChildren(...rendered.childNodes); else code.textContent = expanded;
      }
      const bar = document.createElement("div");
      bar.className = "ce-bar";
      const copy = bar.createEl("button", { text: t("copy") });
      copy.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        await navigator.clipboard.writeText(expanded);
        copy.setText("OK");
        setTimeout(() => copy.setText(t("copy")), 1200);
      };
      const view = autoView ? document.createElement("button") : bar.createEl("button", { text: t("view") });
      let box = null;
      view.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (box) { box.remove(); box = null; code.style.display = ""; view.setText(t("view")); return; }
        box = document.createElement("div");
        box.className = "ce-rendered markdown-rendered";
        if (hasErrors(expanded)) box.classList.add("ce-has-error");
        pre.appendChild(box);
        if (!autoView && lang && !isXml && !isMd) {
          const display = code.cloneNode(true); display.style.display = "";
          const frame = document.createElement("pre"); frame.append(display); box.append(frame);
        } else if (autoView || ((isXml || isMd) && this.settings.viewTree)) {
          const marked = applyArgs(unescapeRefs(await this.expand(raw, path, [], true, raw)), [], false);
          const tree = parseTree(marked);
          if (hasStructure(tree)) await this.renderTree(tree.children, box, path, isXml && this.settings.xmlPlain, 0);
          else await this.renderMd(markErrors(unescapeRefs(expanded)), box, path);
        } else {
          await this.renderMd(markErrors(unescapeRefs(expanded)), box, path);
        }
        code.style.display = "none";
        view.setText(t("code"));
      };
      pre.classList.add("ce-pre");
      pre.prepend(bar);
      if (autoView) await view.onclick({preventDefault(){}, stopPropagation(){}});
    }
    await this.processEmbeds(el, path, ctx);
    this.processLinks(el, path);
  }

  handlesMarkdownRef(ref, path) {
    const p = parseRef(ref);
    return ownsWikiEmbed(p, ref);
  }

  async renderMarkdownRef(el, ref, path, ctx) {
    if (el.dataset.ce) return;
    el.dataset.ce = "1";
    el.dataset.ceRendered = "1";
    el.classList.remove("internal-embed", "markdown-embed", "is-unresolved", "embed-block");
    el.classList.add("ce-inline-render", "markdown-rendered");
    el.removeAttribute("src");
    el.removeAttribute("alt");
    el.removeAttribute("contenteditable");
    const owner = new MarkdownRenderChild(el);
    if (ctx) ctx.addChild(owner);
    else this.addChild(owner);
    el.replaceChildren();
    try {
      const md = await this.resolve(ref, path, []);
      el.classList.toggle("ce-has-error", hasErrors(md));
      await this.renderMd(markErrors(md), el, path, owner);
    } catch (error) {
      fillErr(el, formatError(error.message));
    }
  }

  async processEmbeds(root, path, ctx) {
    if (root.closest("[data-ce-rendered]")) return;
    const embeds = [
      ...(root.matches?.(".internal-embed") ? [root] : []),
      ...root.querySelectorAll(".internal-embed")
    ];
    for (const el of embeds) {
      if (el.dataset.ce || el.closest("pre, code, [data-ce-rendered]")) continue;
      const src = el.getAttribute("src") || "";
      if (this.handlesMarkdownRef(src, path)) await this.renderMarkdownRef(el, src, path, ctx);
    }

    // Custom references can survive Markdown rendering as plain text nodes.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => hasEmbed(node.nodeValue) &&
        !node.parentElement?.closest("pre, code, a, .internal-embed, [data-ce-rendered]")
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = []; let node;
    while ((node = walker.nextNode())) nodes.push(node);
    for (const textNode of nodes) {
      const text = textNode.nodeValue, re = REF_RE(), frag = document.createDocumentFragment();
      const pending = []; let last = 0, m;
      while ((m = re.exec(text)) !== null) {
        if (m.groups.esc || (m.groups.all.startsWith("![[") && !this.handlesMarkdownRef(m.groups.ref, path))) continue;
        frag.append(document.createTextNode(text.slice(last, m.index)));
        const host = document.createElement("span");
        frag.append(host);
        pending.push([host, m.groups.ref]);
        last = re.lastIndex;
      }
      if (!pending.length) continue;
      frag.append(document.createTextNode(text.slice(last)));
      textNode.replaceWith(frag);
      for (const [host, ref] of pending) await this.renderMarkdownRef(host, ref, path, ctx);
    }
  }

  processLinks(root, path) {
    if (root.closest("[data-ce-rendered]")) return;
    for (const a of root.querySelectorAll("a.internal-link")) {
      if (a.dataset.ceLink) continue;
      if (a.closest("pre, code, [data-ce-rendered]")) continue;
      const href = a.getAttribute("data-href") || a.getAttribute("href") || "";
      if (!href) continue;
      const p = parseRef(href);
      if (!p.range || isNativeHeading(p)) continue;
      const tgt = this.findFile(p.name, path);
      if (!tgt) continue;
      a.dataset.ceLink = "1";
      a.classList.add("ce-link");
      a.title = tgt.path + (p.range ? " : " + p.range : "");
      a.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.goToRange(tgt, p.range);
      });
    }
  }

  scanLive() {
    // Live Preview updates through the CodeMirror state field.
  }

  onClick(e) {
    const el = e.target.closest?.(".ce-embed");
    if (!el) return;
    if (e.target.closest("a")) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      const f = this.app.vault.getAbstractFileByPath(el.dataset.cePath);
      if (f) this.app.workspace.getLeaf(true).openFile(f);
    }
  }
}


const RN_TAG_RE = /^[\w:.\-]+$/;
const rnEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function rewriteText(text, fn) {
  const lines = text.split("\n");
  let inF = false, count = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_RE.test(line)) { inF = !inF; continue; }
    if (!hasEmbed(line)) continue;
    lines[i] = line.replace(REF_RE(), (all, esc, _all, ref) => {
      if (esc) return all;
      const p = parseRef(ref);
      if (!inF && _all.startsWith("![[") && !ownsWikiEmbed(p, ref)) return all;
      const normalized = p.name + (p.range ? ":" + p.range : "") + argumentSuffix(ref, p);
      const nr = fn(normalized, inF);
      if (nr == null || nr === normalized) return all;
      count++;
      return formatEmbed(nr);
    });
  }
  return { text: lines.join("\n"), count };
}

function headingList(text) {
  const lines = text.split("\n"), out = [];
  let from = 0;
  if (lines[0] && lines[0].trim() === "---") {
    for (let i = 1; i < lines.length; i++) if (/^(---|\.\.\.)\s*$/.test(lines[i])) { from = i + 1; break; }
  }
  const fence = fenceAware(lines);
  for (let i = from; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i]) || fence[i]) continue;
    const h = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
    if (h && h[2].trim()) out.push({ line: i, level: h[1].length, raw: h[2].trim(), norm: normTitle(h[2]) });
  }
  return out;
}

function tagsOf(text) {
  const t = stripFrontmatter(text).replace(REF_RE(), "");
  const opens = new Set(), closes = new Set();
  for (const m of t.matchAll(/<(\/?)([\w:.\-]+)>/g)) (m[1] ? closes : opens).add(m[2]);
  return [...opens].filter((x) => closes.has(x));
}

const badSectionName = (s) => !s || /[#(^|\]\[\n]/.test(s);

function insertFragment(editor, kind, name, trigger = "") {
  const from = editor.getCursor("from"), to = editor.getCursor("to");
  const start = editor.posToOffset(from) - trigger.length;
  const selected = editor.getSelection();
  let prefix, suffix, selectionStart, selectionEnd;
  if (kind === "xml") {
    const tag = name || "var";
    prefix = "<" + tag + ">";
    suffix = "</" + tag + ">";
    selectionStart = selectionEnd = prefix.length;
  } else {
    const title = name || t("fragmentName");
    const newline = editor.getLine(from.line).slice(0, from.ch - trigger.length).length ? "\n" : "";
    prefix = newline + "## " + title + "\n";
    suffix = editor.getLine(to.line).slice(to.ch) ? "\n" : "";
    selectionStart = name ? prefix.length : newline.length + 3;
    selectionEnd = name ? selectionStart : selectionStart + title.length;
  }
  editor.replaceRange(prefix + selected + suffix, editor.offsetToPos(start), to);
  editor.setSelection(editor.offsetToPos(start + selectionStart), editor.offsetToPos(start + selectionEnd));
}

function triggerAt(editor) {
  if (editor.getSelection()) return "";
  const cur = editor.getCursor();
  return /(?:^|\s)([!_]xvar(?:[A-Za-z_][\w.:\-]*)?|[!_]mvar)$/.exec(editor.getLine(cur.line).slice(0, cur.ch))?.[1] || "";
}

async function promptFragment(app, editor, kind, trigger = "") {
  const before = editor.getValue(), from = editor.posToOffset(editor.getCursor("from"));
  const to = editor.posToOffset(editor.getCursor("to"));
  const xml = kind === "xml";
  const name = await askText(app, xml ? t("insertXml") : t("insertMarkdown"), "",
    value => xml && value && !/^[A-Za-z_][\w.:\-]*$/.test(value) ? t("invalidTag") :
      !xml && value && badSectionName(value) ? t("invalidTitle") : null);
  if (name === null || editor.getValue() !== before) return;
  editor.focus();
  editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(to));
  insertFragment(editor, kind, name, trigger);
}

function askText(app, title, initial, validate) {
  return new Promise((resolve) => {
    let done = false;
    const modal = new Modal(app);
    modal.titleEl.setText(title);
    const input = modal.contentEl.createEl("input", { type: "text", cls: "ce-rename-input" });
    input.value = initial;
    const err = modal.contentEl.createDiv({ cls: "ce-err" });
    const submit = () => {
      const v = input.value.trim();
      const why = validate ? validate(v) : null;
      if (why) { err.setText(why); return; }
      done = true; modal.close(); resolve(v);
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    new Setting(modal.contentEl)
      .addButton((b) => b.setButtonText("OK").setCta().onClick(submit))
      .addButton((b) => b.setButtonText(t("cancel")).onClick(() => modal.close()));
    modal.onClose = () => { modal.contentEl.empty(); if (!done) resolve(null); };
    modal.open();
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

function pickOne(app, placeholder, items) {
  return new Promise((resolve) => {
    let chosen = false;
    class Pick extends FuzzySuggestModal {
      getItems() { return items; }
      getItemText(it) { return it.label; }
      onChooseItem(it) { chosen = true; resolve(it); }
      onClose() { setTimeout(() => { if (!chosen) resolve(null); }, 0); }
    }
    const m = new Pick(app);
    m.setPlaceholder(placeholder);
    m.open();
  });
}

function tagToHeading(text, tag, level, title) {
  const lines = text.split("\n");
  const op = "<" + tag + ">", cl = "</" + tag + ">";
  let oi = -1;
  for (let i = 0; i < lines.length; i++) {
    const k = lines[i].indexOf(op);
    if (k >= 0 && (k === 0 || lines[i][k - 1] !== "<")) { oi = i; break; }
  }
  if (oi < 0) return { changed: false, text };
  let ci = -1;
  for (let i = oi; i < lines.length; i++) if (lines[i].includes(cl)) { ci = i; break; }
  if (ci < 0) return { changed: false, text };
  const openLine = lines[oi], closeLine = lines[ci];
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

function headingToTag(text, lineIdx, tag) {
  const lines = text.split("\n"), fence = fenceAware(lines);
  const h = HEADING_RE.exec((lines[lineIdx] || "").replace(/\r$/, ""));
  if (!h) return { changed: false, text };
  let ei = lines.length;
  for (let i = lineIdx + 1; i < lines.length; i++) {
    if (fence[i] || FENCE_RE.test(lines[i])) continue;
    const h2 = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
    if (h2 && h2[1].length <= h[1].length) { ei = i; break; }
  }
  lines[lineIdx] = "<" + tag + ">";
  lines.splice(ei, 0, "</" + tag + ">");
  return { changed: true, text: lines.join("\n") };
}

const renameMethods = {
  setupRename() {
    this.renameSnapshots = new Map();
    this.renameScanTimers = new Map();
    this.forceRenameUpdate = false;
    const ws = this.app.workspace, v = this.app.vault;

    this.registerEvent(v.on("rename", (f, oldPath) => {
      if (!f || f.extension !== "md") return;
      const sn = this.renameSnapshots.get(oldPath);
      if (sn) { this.renameSnapshots.delete(oldPath); this.renameSnapshots.set(f.path, sn); }
      if (!this.forceRenameUpdate && !this.settings.autoRenameFile) return;
      this.renameFileRefs(f, oldPath).catch((e) => console.error("code-embed rename", e));
    }));
    this.registerEvent(v.on("delete", (f) => { this.renameSnapshots.delete(f.path); }));
    this.registerEvent(v.on("modify", (f) => this.scheduleRenameScan(f)));
    this.registerEvent(ws.on("file-open", (f) => { if (f && f.extension === "md") this.snapshot(f, false); }));
    ws.onLayoutReady(() => { const f = ws.getActiveFile(); if (f && f.extension === "md") this.snapshot(f, false); });

    this.addCommand({
      id: "rename-file",
      name: t("cmdRenameNote"),
      checkCallback: (chk) => {
        const f = ws.getActiveFile();
        if (!f || f.extension !== "md") return false;
        if (!chk) this.cmdRenameFile(f);
        return true;
      }
    });
    this.addCommand({
      id: "rename-tag",
      name: t("cmdRenameTag"),
      checkCallback: (chk) => {
        const f = ws.getActiveFile();
        if (!f || f.extension !== "md") return false;
        if (!chk) this.cmdRenameTag(f);
        return true;
      }
    });
    this.addCommand({
      id: "rename-section",
      name: t("cmdRenameSection"),
      checkCallback: (chk) => {
        const f = ws.getActiveFile();
        if (!f || f.extension !== "md") return false;
        if (!chk) this.cmdRenameSection(f);
        return true;
      }
    });
    this.addCommand({
      id: "rename-at-cursor",
      name: t("cmdRenameTarget"),
      editorCheckCallback: (chk, editor, view) => {
        if (!view.file || !this.refAtCursor(editor)) return false;
        if (!chk) this.cmdRenameAtCursor(editor, view.file);
        return true;
      }
    });

    this.registerEvent(ws.on("file-menu", (menu, f) => {
      if (!f || f.extension !== "md") return;
      menu.addItem((i) => i.setTitle(t("cmdRenameNote")).setIcon("pencil")
        .onClick(() => this.cmdRenameFile(f)));
    }));
    this.registerEvent(ws.on("editor-menu", (menu, editor, view) => {
      if (!view.file) return;
      if (this.refAtCursor(editor)) {
        menu.addItem((i) => i.setTitle(t("cmdRenameTarget")).setIcon("pencil")
          .onClick(() => this.cmdRenameAtCursor(editor, view.file)));
      }
      const tag = this.tagAtCursor(editor);
      if (tag) {
        menu.addItem((i) => i.setTitle(t("renameTagAction") + " <" + tag + ">…").setIcon("pencil")
          .onClick(() => this.cmdRenameTag(view.file, tag)));
      }
      const h = HEADING_RE.exec(editor.getLine(editor.getCursor().line).replace(/\r$/, ""));
      if (h && h[2].trim()) {
        menu.addItem((i) => i.setTitle(t("cmdRenameSection")).setIcon("pencil")
          .onClick(() => this.cmdRenameSection(view.file, editor.getCursor().line)));
      }
    }));
  },

  teardownRename() {
    for (const t of this.renameScanTimers?.values() ?? []) clearTimeout(t);
  },

  // Validate after the outermost rename has updated both definitions and references.
  async withRenameMute(fn) {
    this.activeRenameCount++;
    try { return await fn(); }
    finally {
      this.activeRenameCount--;
      if (!this.activeRenameCount) {
        this.brokenPrev = null;
        if (this.settings.warnBroken) {
          clearTimeout(this.valT);
          this.valT = setTimeout(() => this.validate(false), this.settings.validateDelay);
        }
      }
    }
  },

  async snapshot(file, force) {
    if (!force && this.renameSnapshots.has(file.path)) return;
    const text = await this.app.vault.read(file);
    const heads = new Map();
    for (const h of headingList(text)) if (!heads.has(h.norm)) heads.set(h.norm, h.raw);
    this.renameSnapshots.set(file.path, {
      tags: new Set(tagsOf(text)), heads,
      pendTag: 0, pendHead: 0
    });
  },

  scheduleRenameScan(file) {
    if (!file || file.extension !== "md") return;
    const s = this.settings;
    if (!s.autoRenameTag && !s.autoRenameSection) { this.renameSnapshots.delete(file.path); return; }
    clearTimeout(this.renameScanTimers.get(file.path));
    this.renameScanTimers.set(file.path, setTimeout(() => {
      this.scanRename(file).catch((e) => console.error("code-embed rename", e));
    }, 1500));
  },

  rnStep(prev, cur, st, key) {
    const removed = [...prev].filter((k) => !cur.has(k));
    const added = [...cur].filter((k) => !prev.has(k));
    if (!removed.length && !added.length) { st[key] = 0; return { next: cur }; }
    if (!added.length) { if (!st[key]) st[key] = Date.now(); return { next: prev }; }
    const fresh = !st[key] || Date.now() - st[key] < 120000;
    st[key] = 0;
    if (removed.length === 1 && added.length === 1 && fresh) return { next: cur, ren: [removed[0], added[0]] };
    return { next: cur };
  },

  async scanRename(file) {
    if (this.activeRenameCount) { this.renameSnapshots.delete(file.path); return; }
    const prev = this.renameSnapshots.get(file.path);
    if (!prev) { await this.snapshot(file, true); return; }
    const text = await this.app.vault.read(file);
    const heads = new Map();
    for (const h of headingList(text)) if (!heads.has(h.norm)) heads.set(h.norm, h.raw);
    const tags = new Set(tagsOf(text));
    const tr = this.rnStep(new Set(prev.tags), tags, prev, "pendTag");
    const hr = this.rnStep(new Set(prev.heads.keys()), new Set(heads.keys()), prev, "pendHead");
    prev.tags = tr.next;
    const nextHeads = new Map();
    for (const k of hr.next) nextHeads.set(k, heads.get(k) ?? prev.heads.get(k));
    prev.heads = nextHeads;
    if (tr.ren && this.settings.autoRenameTag) {
      await this.renameTagRefs(file, tr.ren[0], tr.ren[1]);
    }
    if (hr.ren && this.settings.autoRenameSection) {
      const [from, to] = hr.ren, title = heads.get(to);
      if (badSectionName(title)) new Notice(t("invalidTitle"));
      else await this.renameSectionRefs(file, from, title);
    }
  },

  async rewriteAll(mapper) {
    let files = 0, refs = 0;
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (f.name === MARKER) continue;
      const raw = await this.app.vault.cachedRead(f);
      if (!hasEmbed(raw)) continue;
      if (rewriteText(raw, (r, inF) => mapper(r, inF, f)).count === 0) continue;
      let n = 0;
      await this.app.vault.process(f, (cur) => {
        const res = rewriteText(cur, (r, inF) => mapper(r, inF, f));
        n = res.count;
        return res.text;
      });
      if (n) { files++; refs += n; }
    }
    return { files, refs };
  },

  rnNotice(what, res) {
    if (this.settings.renameNotice && res.refs) {
      new Notice("Code Embed: " + what + " — " + t("updated", res));
    }
  },

  nameSpan(ref, p) {
    const i = ref.indexOf(p.name);
    return i < 0 ? null : [i, i + p.name.length];
  },

  async renameFileRefs(file, oldPath) {
    await this.withRenameMute(async () => {
      if (file.name === MARKER || oldPath.split("/").pop() === MARKER) return;
      const index = this.packages(), oldRoot = index.root(oldPath);
      if (index.root(file.path) !== oldRoot) return;
      const oldName = oldPath.split("/").pop();
      const oldFile = { path: oldPath, name: oldName, basename: oldName.replace(/\.md$/i, ""), extension: "md" };
      const previous = new PackageIndex(this.app.vault.getFiles().map(f => f === file ? oldFile : f));
      const res = await this.rewriteAll((ref, inF, src) => {
        const p = parseRef(ref);
        if (p.name === "." || !p.name || index.root(src.path) !== oldRoot) return null;
        let next;
        if (oldRoot !== null) {
          if (previous.lookup(p.name, oldRoot).file !== oldFile) return null;
          next = p.name.includes("/") ? relativeTo(oldRoot, file.path) : file.basename;
          if (index.lookup(next, oldRoot).file !== file) next = relativeTo(oldRoot, file.path);
        } else {
          const old = p.name.replace(/\.md$/i, "");
          if (old !== oldPath.replace(/\.md$/i, "") && old !== oldFile.basename) return null;
          if (this.findFile(p.name, src.path)) return null;
          next = this.findFile(file.basename, src.path) === file ? file.basename : file.path;
        }
        if (!p.name.endsWith(".md") && next.endsWith(".md")) {
          const short = next.slice(0, -3);
          if (this.findFile(short, src.path) === file) next = short;
        }
        if (next === p.name) return null;
        return next + ref.slice(p.name.length);
      });
      this.rnNotice(oldPath + " → " + file.path, res);
    });
  },

  async cmdRenameFile(file) {
    const name = await askText(this.app, t("newNoteName"), file.basename,
      (v) => !v ? t("emptyName") : /[\\/:*?"<>|#^\[\]]/.test(v) ? t("badChars") + ': \\ / : * ? " < > | # ^ [ ]' : null);
    if (!name || name === file.basename) return;
    const dir = file.parent && file.parent.path !== "/" ? file.parent.path + "/" : "";
    const target = dir + name + "." + file.extension;
    if (this.app.vault.getAbstractFileByPath(target)) { new Notice(t("exists") + ": " + target); return; }
    this.forceRenameUpdate = true;
    try { await this.app.fileManager.renameFile(file, target); }
    finally { setTimeout(() => { this.forceRenameUpdate = false; }, 0); }
  },

  async renameTagRefs(file, oldTag, newTag) {
    await this.withRenameMute(async () => {

      const re = new RegExp("^(\\s*:\\s*<<?)" + rnEsc(oldTag) + "(>>?)");
      const res = await this.rewriteAll((ref, inF, src) => {
        const p = parseRef(ref);
        if (!p.range || p.range.startsWith("#")) return null;
        const tgt = this.findFile(p.name, src.path);
        if (!tgt || tgt.path !== file.path) return null;
        const sp = this.nameSpan(ref, p);
        if (!sp) return null;
        const rest = ref.slice(sp[1]);
        if (!re.test(rest)) return null;
        return ref.slice(0, sp[1]) + rest.replace(re, (m, a, b) => a + newTag + b);
      });
      this.rnNotice("<" + oldTag + "> → <" + newTag + ">", res);
    });
  },

  async cmdRenameTag(file, preset) {
    const text = await this.app.vault.read(file);
    const tags = tagsOf(text);
    if (!tags.length) { new Notice(t("noTags")); return; }
    let oldTag = preset;
    if (!oldTag) {
      const it = await pickOne(this.app, t("pickTag"), tags.map((t) => ({ label: "<" + t + ">", value: t })));
      if (!it) return;
      oldTag = it.value;
    }
    const act = await pickOne(this.app, t("actionFor", { name: "<" + oldTag + ">" }), [
      { label: t("renameTagAction"), value: "rename" },
      { label: t("toHeading"), value: "heading" },
    ]);
    if (!act) return;
    if (act.value === "heading") { await this.convertTagToHeading(file, oldTag); return; }

    const nt = await askText(this.app, t("newTag") + " <" + oldTag + ">", oldTag,
      (v) => !RN_TAG_RE.test(v) ? t("tagCharacters") : null);
    if (!nt || nt === oldTag) return;
    await this.withRenameMute(async () => {
      const rx = new RegExp("(!\\[\\[[^\\]\\n]*\\]\\])|<(\\/?)" + rnEsc(oldTag) + ">", "g");
      await this.app.vault.process(file, (cur) =>
        cur.replace(rx, (m, refm, sl) => (refm ? m : "<" + sl + nt + ">")));
      await this.renameTagRefs(file, oldTag, nt);
      await this.snapshot(file, true);
    });
  },

  async convertTagToHeading(file, oldTag) {
    const lv = await pickOne(this.app, t("headingLevel"),
      [1, 2, 3, 4, 5].map((n) => ({ label: "#".repeat(n) + "  (H" + n + ")", value: n })));
    if (!lv) return;
    const title = await askText(this.app, t("headingTitle"), oldTag.replace(/[-_.:]+/g, " ").trim() || oldTag,
      (v) => badSectionName(v) ? !v ? t("emptyName") : t("badChars") + ": # ( ^ | [ ]" : null);
    if (title == null) return;
    await this.withRenameMute(async () => {
      let ok = false;
      await this.app.vault.process(file, (cur) => {
        const r = tagToHeading(cur, oldTag, lv.value, title);
        ok = r.changed;
        return r.text;
      });
      if (!ok) { new Notice(t("missingTag", { tag: "<" + oldTag + ">…</" + oldTag + ">" })); return; }
      const res = await this.rewriteAll((ref, inF, src) => {
        const p = parseRef(ref);
        const tgt = this.findFile(p.name, src.path);
        if (!tgt || tgt.path !== file.path) return null;
        const tm = /^(<<?)([\w:.\-]+)(>>?)$/.exec(p.range || "");
        if (!tm || tm[2] !== oldTag) return null;
        const sp = this.nameSpan(ref, p);
        if (!sp) return null;
        const inner = tm[1].length === 2 || tm[3].length === 2 || p.range.startsWith("<<");
        const argS = this.refArgSuffix(p);
        return ref.slice(0, sp[1]) + ":" + (inner ? "##" : "#") + title + argS;
      });
      this.rnNotice("<" + oldTag + "> → " + title, res);
      await this.snapshot(file, true);
    });
  },

  refArgSuffix(p) {
    if (!p.args) return "";
    if (!p.args.length) return "()";
    return "(" + p.args.map((a) => /[",\n]/.test(a) ? '"' + a + '"' : a).join(", ") + ")";
  },

  async renameSectionRefs(file, oldNorm, newTitle) {
    await this.withRenameMute(async () => {
      const res = await this.rewriteAll((ref, inF, src) => {
        const p = parseRef(ref);
        if (!p.range || !p.range.startsWith("#")) return null;
        const tgt = this.findFile(p.name, src.path);
        if (!tgt || tgt.path !== file.path) return null;
        const sp = this.nameSpan(ref, p);
        if (!sp) return null;
        const rest = ref.slice(sp[1]);
        const m = /^(\s*:?\s*#+\s*)([^(|]*)([\s\S]*)$/.exec(rest);
        if (!m) return null;
        let hit = false;
        const segs = m[2].split("#").map((s) => {
          if (normTitle(s) !== oldNorm) return s;
          hit = true;
          return s.replace(/^(\s*)([\s\S]*?)(\s*)$/, (_, a, b, c) => a + newTitle + c);
        });
        if (!hit) return null;
        return ref.slice(0, sp[1]) + m[1] + segs.join("#") + m[3];
      });
      this.rnNotice(t("section") + " → " + newTitle, res);
    });
  },

  async cmdRenameSection(file, line) {
    const text = await this.app.vault.read(file);
    const list = headingList(text);

    let h = line != null ? list.find((x) => x.line === line) : null;
    if (!h) {
      const it = await pickOne(this.app, t("pickSection"),
        list.map((x) => ({ label: "L" + (x.line + 1) + " " + "#".repeat(x.level) + " " + x.raw, value: x })));
      if (!it) return;
      h = it.value;
    }
    const act = await pickOne(this.app, t("actionFor", { name: h.raw }), [
      { label: t("renameSectionAction"), value: "rename" },
      { label: t("toTag"), value: "tag" },
    ]);
    if (!act) return;
    if (act.value === "tag") { await this.convertSectionToTag(file, h); return; }

    const nt = await askText(this.app, t("newSection"), h.raw,
      (v) => badSectionName(v) ? !v ? t("emptyName") : t("badChars") + ": # ( ^ | [ ]" : null);
    if (!nt || nt === h.raw) return;
    await this.withRenameMute(async () => {
      const isFirst = list.find((x) => x.norm === h.norm).line === h.line;
      let ok = true;
      await this.app.vault.process(file, (cur) => {
        const lines = cur.split("\n"), l = lines[h.line] ?? "";
        const hm = HEADING_RE.exec(l.replace(/\r$/, ""));
        if (!hm || normTitle(hm[2]) !== h.norm) { ok = false; return cur; }
        const idx = l.indexOf(hm[2], l.indexOf("#") + hm[1].length);
        lines[h.line] = l.slice(0, idx) + nt + l.slice(idx + hm[2].length);
        return lines.join("\n");
      });
      if (!ok) { new Notice(t("headingChanged")); return; }
      if (isFirst) await this.renameSectionRefs(file, h.norm, nt);
      else new Notice(t("duplicateHeading"));
      await this.snapshot(file, true);
    });
  },

  async convertSectionToTag(file, h) {
    const text = await this.app.vault.read(file);
    const list = headingList(text);
    const isFirst = list.find((x) => x.norm === h.norm)?.line === h.line;
    if (!isFirst) {
      new Notice(t("convertFirst"));
      return;
    }
    const tag = await askText(this.app, t("sectionToTag", { name: h.raw }),
      h.raw.replace(/[*_`]/g, "").replace(/[^\w:.\- ]+/g, "").trim().replace(/\s+/g, "-") || "section",
      (v) => !RN_TAG_RE.test(v) ? t("tagCharacters") : null);
    if (!tag) return;
    await this.withRenameMute(async () => {
      let ok = false;
      await this.app.vault.process(file, (cur) => {
        const lines = cur.split("\n");
        let idx = -1;
        const fence = fenceAware(lines);
        for (let i = 0; i < lines.length; i++) {
          if (fence[i] || FENCE_RE.test(lines[i])) continue;
          const hm = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
          if (hm && normTitle(hm[2]) === h.norm) { idx = i; break; }
        }
        if (idx < 0) return cur;
        const r = headingToTag(cur, idx, tag);
        ok = r.changed;
        return r.text;
      });
      if (!ok) { new Notice(t("missingHeading")); return; }
      let skipped = 0;
      const res = await this.rewriteAll((ref, inF, src) => {
        const p = parseRef(ref);
        const tgt = this.findFile(p.name, src.path);
        if (!tgt || tgt.path !== file.path) return null;
        if (!p.range || !p.range.startsWith("#")) return null;
        const titles = p.range.replace(/^#+\s*/, "").split("#").map((s) => s.trim()).filter(Boolean);
        if (titles.length !== 1) { skipped++; return null; }
        if (normTitle(titles[0]) !== h.norm) return null;
        const inner = p.range.startsWith("##");
        const sp = this.nameSpan(ref, p);
        if (!sp) return null;
        return ref.slice(0, sp[1]) + ":" + (inner ? "<<" + tag + ">>" : "<" + tag + ">") + this.refArgSuffix(p);
      });
      this.rnNotice(h.raw + " → <" + tag + ">", res);
      if (skipped) new Notice(t("skippedNested", { count: skipped }));
      await this.snapshot(file, true);
    });
  },

  refAtCursor(editor) {
    const cur = editor.getCursor(), text = editor.getLine(cur.line), re = REF_RE();
    let m;
    while ((m = re.exec(text)) !== null) {
      const from = m.index, to = from + m[0].length;
      if (!m.groups.esc && cur.ch >= from && cur.ch <= to) return { ref: m.groups.ref, from, to };
    }
    return null;
  },

  tagAtCursor(editor) {
    const off = editor.posToOffset(editor.getCursor());
    const text = editor.getValue();
    const pairs = [], stack = [];
    const re = /<(\/?)([A-Za-z_][\w:.\-]*)>/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!m[1] && m.index > 0 && text[m.index - 1] === "<") continue;
      const lineStart = text.lastIndexOf("\n", m.index) + 1;
      if (/^\s*(```|~~~)/.test(text.slice(lineStart, m.index))) continue;
      if (!m[1]) stack.push({ tag: m[2], from: m.index });
      else {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k].tag === m[2]) { pairs.push({ tag: m[2], from: stack[k].from, to: re.lastIndex }); stack.length = k; break; }
        }
      }
    }
    let best = null;
    for (const pr of pairs) {
      if (off >= pr.from && off <= pr.to && (!best || pr.to - pr.from < best.to - best.from)) best = pr;
    }
    return best ? best.tag : null;
  },

  async cmdRenameAtCursor(editor, srcFile) {
    const at = this.refAtCursor(editor);
    if (!at) { new Notice(t("missingCursor")); return; }
    const p = parseRef(at.ref);
    const target = this.findFile(p.name, srcFile.path);
    if (!target || target.extension !== "md") { new Notice(t("missingTarget")); return; }
    const opts = [];
    if (p.name && p.name !== ".") opts.push({ label: t("file") + ": " + target.basename, kind: "file" });
    else opts.push({ label: t("file") + ": " + target.basename + " (" + t("currentNote") + ")", kind: "file" });
    const tm = /^<([<]?)([\w:.\-]+)>[>]?$/.exec(p.range || "");
    if (tm) opts.push({ label: t("tag") + ": <" + tm[2] + ">", kind: "tag", tag: tm[2] });
    if (p.range && p.range.startsWith("#")) {
      const m = /^#+\s*([^(|]*)/.exec(p.range);
      const segs = (m ? m[1] : "").split("#").map((s) => s.trim()).filter(Boolean);
      const hs = headingList(await this.app.vault.read(target));
      for (const s of segs) {
        const h = hs.find((x) => x.norm === normTitle(s));
        if (h) opts.push({ label: t("section") + ": " + s, kind: "section", line: h.line });
      }
    }
    const it = opts.length === 1 ? { value: opts[0] } : await pickOne(this.app, t("chooseTarget"), opts.map((o) => ({ label: o.label, value: o })));
    if (!it) return;
    const o = it.value;
    if (o.kind === "file") await this.cmdRenameFile(target);
    else if (o.kind === "tag") await this.cmdRenameTag(target, o.tag);
    else await this.cmdRenameSection(target, o.line);
  }
};
Object.assign(CodeEmbedPlugin.prototype, renameMethods);

module.exports = CodeEmbedPlugin;
