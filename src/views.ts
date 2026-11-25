import {
  ItemView,
  PluginSettingTab,
  Setting,
  Modal,
  EditorSuggest,
  FuzzySuggestModal,
  type App,
  type WorkspaceLeaf,
  type Editor,
  type EditorPosition,
  type EditorSuggestContext,
  type TFile,
} from "obsidian";
import type CodeEmbedPlugin from "./main";
import type { BrokenReference } from "./model";
import { DEFAULTS, COLOR_FALLBACK, type KeysOfType, type Settings } from "./settings";
import { formatEmbed, headingsOf, tagsOf } from "./fragments";
import { t, guideUrl } from "./locale";
import { MARKER, relativeTo } from "./package-index";

export const VIEW_TYPE = "code-embed-panel";
export class ReferencePanel extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    readonly plugin: CodeEmbedPlugin,
  ) {
    super(leaf);
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Code Embed";
  }
  getIcon() {
    return "link";
  }
  async onOpen() {
    this.contentEl.addClass("ce-panel-view");
    await this.render();
  }
  async render() {
    await this.plugin.renderPanelView(this);
  }
}

export class CodeEmbedSettings extends PluginSettingTab {
  constructor(
    app: App,
    readonly plugin: CodeEmbedPlugin,
  ) {
    super(app, plugin);
  }

  async set<K extends keyof Settings>(key: K, val: Settings[K]) {
    this.plugin.settings[key] = val;
    await this.plugin.saveData(this.plugin.settings);
    this.plugin.applySettings(key);
  }

  toggle(el: HTMLElement, key: KeysOfType<boolean>, name: string, desc: string) {
    new Setting(el)
      .setName(name)
      .setDesc(desc)
      .addToggle((t) => t.setValue(this.plugin.settings[key]).onChange((v) => this.set(key, v)));
  }

  slider(
    el: HTMLElement,
    key: KeysOfType<number>,
    name: string,
    desc: string,
    min: number,
    max: number,
    step: number,
  ) {
    new Setting(el)
      .setName(name)
      .setDesc(desc)
      .addSlider((s) =>
        s
          .setLimits(min, max, step)
          .setValue(this.plugin.settings[key])
          .setDynamicTooltip()
          .onChange((v) => this.set(key, v)),
      );
  }

  color(el: HTMLElement, key: keyof typeof COLOR_FALLBACK, name: string, desc: string) {
    new Setting(el)
      .setName(name)
      .setDesc(desc)
      .addColorPicker((c) =>
        c
          .setValue(this.plugin.settings[key] || COLOR_FALLBACK[key])
          .onChange((v) => this.set(key, v)),
      )
      .addExtraButton((b) =>
        b
          .setIcon("rotate-ccw")
          .setTooltip(t("restoreDefault"))
          .onClick(async () => {
            await this.set(key, "");
            this.display();
          }),
      );
  }

  display() {
    const { containerEl: el } = this;
    el.empty();

    new Setting(el).setName("Code Embed · " + this.plugin.manifest.version).setHeading();
    el.createEl("a", {
      text: t("helpGuide"),
      href: guideUrl(),
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });
    new Setting(el)
      .setName(t("chooseFolder"))
      .addButton((button) =>
        button.setButtonText(t("chooseFolder")).onClick(() => this.plugin.choosePackageFolder()),
      );
    this.toggle(
      el,
      "showAllFolderActions",
      t("showAllFolderActions"),
      t("showAllFolderActionsHelp"),
    );
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

    new Setting(el)
      .setName(t("resetAll"))
      .setDesc(t("resetHelp"))
      .addButton((b) =>
        b.setButtonText(t("reset")).onClick(async () => {
          this.plugin.settings = Object.assign({}, DEFAULTS);
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.applySettings("all");
          this.display();
        }),
      );
  }
}

export class BrokenModal extends Modal {
  constructor(
    app: App,
    readonly plugin: CodeEmbedPlugin,
    readonly list: BrokenReference[],
  ) {
    super(app);
  }
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
      row.onclick = () => {
        this.close();
        this.plugin.goTo(b.file, b.line, b.ch);
      };
    }
    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText(t("dismiss"))
          .setCta()
          .onClick(() => this.close()),
      )
      .addButton((btn) =>
        btn.setButtonText(t("disableWarnings")).onClick(async () => {
          this.plugin.settings.warnBroken = false;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.previousBrokenReferences = null;
          this.close();
        }),
      );
  }
  onClose() {
    this.contentEl.empty();
    this.plugin.brokenModal = null;
  }
}

export class EmbedSuggest extends EditorSuggest<string> {
  constructor(
    app: App,
    readonly plugin: CodeEmbedPlugin,
  ) {
    super(app);
  }
  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null) {
    if (!file) return null;
    const line = editor.getLine(cursor.line),
      before = line.slice(0, cursor.ch);
    const m = /(?:^|[^\\\\])!\[([^\[\]]*)$/.exec(before);
    if (!m || /^\]\s*[([]/.test(line.slice(cursor.ch))) return null;
    return {
      start: { line: cursor.line, ch: cursor.ch - m[1].length - 2 },
      end: { line: cursor.line, ch: cursor.ch + Number(line[cursor.ch] === "]") },
      query: m[1],
    };
  }
  async getSuggestions({ file, query }: EditorSuggestContext) {
    const index = this.plugin.packages(),
      root = index.root(file.path);
    const pos = query.indexOf(":"),
      local = /^[#<]/.test(query);
    if (pos < 0 && !local) {
      const files =
        root === null ? this.app.vault.getMarkdownFiles() : index.groups.get(root) || [];
      return files
        .filter(
          (f) =>
            f.extension === "md" &&
            f.name !== MARKER &&
            f.path.toLowerCase().includes(query.toLowerCase()),
        )
        .map((f) => {
          const short = this.plugin.findFile(f.basename, file.path) === f;
          const name = short ? f.basename : root === null ? f.path : relativeTo(root, f.path);
          return formatEmbed(name);
        })
        .slice(0, 80);
    }
    const name = local ? "" : query.slice(0, pos),
      prefix = local ? query : query.slice(pos + 1);
    const target = this.plugin.findFile(name, file.path);
    if (!target) return [];
    const body = await this.plugin.read(target);
    const selectors = [
      ...headingsOf(body, true).flatMap((h) => ["#" + h, "##" + h]),
      ...tagsOf(body).flatMap((tag) => ["<" + tag + ">", "<<" + tag + ">>"]),
    ];
    return selectors
      .filter((s) => s.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((s) => formatEmbed((name ? name + ":" : "") + s))
      .slice(0, 80);
  }
  renderSuggestion(value: string, el: HTMLElement) {
    el.setText(value);
  }
  selectSuggestion(value: string) {
    if (!this.context) return;
    const { editor, start, end } = this.context;
    editor.replaceRange(value, start, end);
    editor.setCursor({ line: start.line, ch: start.ch + value.length });
  }
}

export function askText(
  app: App,
  title: string,
  initial: string,
  validate: (value: string) => string | null,
) {
  return new Promise<string | null>((resolve) => {
    let done = false;
    const modal = new Modal(app);
    modal.titleEl.setText(title);
    const input = modal.contentEl.createEl("input", { type: "text", cls: "ce-rename-input" });
    input.value = initial;
    const err = modal.contentEl.createDiv({ cls: "ce-err" });
    const submit = () => {
      const v = input.value.trim();
      const why = validate ? validate(v) : null;
      if (why) {
        err.setText(why);
        return;
      }
      done = true;
      modal.close();
      resolve(v);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
    new Setting(modal.contentEl)
      .addButton((b) => b.setButtonText("OK").setCta().onClick(submit))
      .addButton((b) => b.setButtonText(t("cancel")).onClick(() => modal.close()));
    modal.onClose = () => {
      modal.contentEl.empty();
      if (!done) resolve(null);
    };
    modal.open();
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  });
}

export function pickOne<T extends { label: string }>(app: App, placeholder: string, items: T[]) {
  return new Promise<T | null>((resolve) => {
    let chosen = false;
    class Pick extends FuzzySuggestModal<T> {
      getItems() {
        return items;
      }
      getItemText(it: T) {
        return it.label;
      }
      onChooseItem(it: T) {
        chosen = true;
        resolve(it);
      }
      onClose() {
        setTimeout(() => {
          if (!chosen) resolve(null);
        }, 0);
      }
    }
    const m = new Pick(app);
    m.setPlaceholder(placeholder);
    m.open();
  });
}
