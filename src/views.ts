import {
  ItemView,
  requireApiVersion,
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
import { systemKeys } from "./system-variables";
import { selectedKinds } from "./action-markdown";
import { DEFAULTS, COLOR_FALLBACK, type KeysOfType, type Settings } from "./settings";
import { formatEmbed, headingsOf, tagsOf } from "./fragments";
import { t, guideUrl } from "./locale";
import { isMarker, relativeTo } from "./package-index";

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

type SettingsRow = { name: string; desc?: string; render: (setting: Setting) => void };
type SettingsGroup = { type: "group"; heading: string; items: SettingsRow[] };

export class CodeEmbedSettings extends PluginSettingTab {
  constructor(
    app: App,
    readonly plugin: CodeEmbedPlugin,
  ) {
    super(app, plugin);
  }

  private async set<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.plugin.settings[key] = value;
    await this.plugin.saveData(this.plugin.settings);
    this.plugin.applySettings(key);
  }

  private toggle(key: KeysOfType<boolean>, name: string, desc: string): SettingsRow {
    return {
      name,
      desc,
      render: (row) => {
        row.addToggle((toggle) =>
          toggle.setValue(this.plugin.settings[key]).onChange((value) => this.set(key, value)),
        );
      },
    };
  }

  private slider(
    key: KeysOfType<number>,
    name: string,
    desc: string,
    min: number,
    max: number,
    step: number,
  ): SettingsRow {
    return {
      name,
      desc,
      render: (row) => {
        row.addSlider((slider) =>
          slider
            .setLimits(min, max, step)
            .setValue(this.plugin.settings[key])
            .onChange((value) => this.set(key, value)),
        );
      },
    };
  }

  private blockOpacity() {
    return this.slider("blockOpacity", t("blockOpacity"), "", 0, 100, 1);
  }

  private color(key: keyof typeof COLOR_FALLBACK, name: string, desc: string): SettingsRow {
    return {
      name,
      desc,
      render: (row) => {
        row.addColorPicker((picker) => {
          picker
            .setValue(this.plugin.settings[key] || COLOR_FALLBACK[key])
            .onChange((value) => this.set(key, value));
          row.addExtraButton((button) =>
            button
              .setIcon("rotate-ccw")
              .setTooltip(t("restoreDefault"))
              .onClick(async () => {
                await this.set(key, "");
                picker.setValue(COLOR_FALLBACK[key]);
              }),
          );
        });
      },
    };
  }

  private refreshSettings() {
    if (requireApiVersion("1.13.0")) this.update();
    else this.renderLegacySettings();
  }

  private kindRow(kind: string): SettingsRow {
    const names: Record<string, string> = {
      plain: t("unlabelledBlocks"),
      markdown: "Markdown",
      xml: "XML",
      ce: "CE",
    };
    return {
      name: Object.hasOwn(names, kind) ? names[kind] : kind,
      render: (row) => {
        row.addToggle((toggle) =>
          toggle
            .setValue(selectedKinds(this.plugin.settings.blockActionKinds).has(kind))
            .onChange((enabled) => {
              const kinds = selectedKinds(this.plugin.settings.blockActionKinds);
              if (enabled) kinds.add(kind);
              else kinds.delete(kind);
              return this.set("blockActionKinds", [...kinds].join(", "));
            }),
        );
      },
    };
  }

  private blockKinds(): SettingsRow[] {
    const builtIn = selectedKinds(DEFAULTS.blockActionKinds);
    const current = () => selectedKinds(this.plugin.settings.blockActionKinds);
    const save = (kinds: Set<string>) => this.set("blockActionKinds", [...kinds].join(", "));
    return [
      ...[...builtIn].map((kind) => this.kindRow(kind)),
      {
        name: t("additionalLanguages"),
        desc: t("blockKindsHelp"),
        render: (row) => {
          row.addText((field) =>
            field
              .setValue([...current()].filter((kind) => !builtIn.has(kind)).join(", "))
              .onChange((value) =>
                save(
                  new Set([
                    ...[...current()].filter((kind) => builtIn.has(kind)),
                    ...[...selectedKinds(value)].filter((kind) => !builtIn.has(kind)),
                  ]),
                ),
              ),
          );
        },
      },
    ];
  }

  private templateRow(): SettingsRow {
    return {
      name: t("snapshotTemplate"),
      desc: t("snapshotHelp"),
      render: (row) => {
        row.addText((field) =>
          field
            .setPlaceholder(DEFAULTS.snapshotTemplate)
            .setValue(this.plugin.settings.snapshotTemplate)
            .onChange((value) =>
              this.set("snapshotTemplate", value.trim() || DEFAULTS.snapshotTemplate),
            ),
        );
      },
    };
  }

  openFor(kind?: string) {
    const modal = new Modal(this.app);
    const render = () => {
      modal.contentEl.empty();
      const kinds = selectedKinds(this.plugin.settings.blockActionKinds);
      const current = kind && kinds.has(kind) ? kind : undefined;
      modal.titleEl.setText(
        "Code Embed · " + (current ? this.kindRow(current).name : t("noteActions")),
      );
      const ordered = current ? [current, ...[...kinds].filter((k) => k !== current)] : [...kinds];
      const save = async () => {
        await this.set("blockActionKinds", [...kinds].join(", "));
        render();
      };
      for (const format of ordered) {
        new Setting(modal.contentEl).setName(this.kindRow(format).name).addExtraButton((btn) =>
          btn
            .setIcon("trash-2")
            .setTooltip(t("removeFormat"))
            .onClick(async () => {
              kinds.delete(format);
              await save();
            }),
        );
      }
      const controls = [this.toggle("showActionLabels", t("showActionLabels"), "")];
      if (kind) controls.push(this.blockOpacity());
      if (!kind) controls.push(this.templateRow());
      if (kind === "markdown" || kind === "xml")
        controls.push(this.toggle("viewTree", t("viewTree"), t("viewTreeHelp")));
      if (kind === "xml") controls.push(this.toggle("xmlPlain", t("xmlPlain"), t("xmlPlainHelp")));
      if (kind === "ce")
        controls.push(
          this.slider("treeOpenDepth", t("treeOpenDepth"), t("treeOpenDepthHelp"), 0, 10, 1),
        );
      for (const control of controls) {
        const row = new Setting(modal.contentEl).setName(control.name);
        if (control.desc) row.setDesc(control.desc);
        control.render(row);
      }
      new Setting(modal.contentEl).addButton((btn) =>
        btn.setButtonText("+ " + t("addFormat")).onClick(async () => {
          const value = await askText(this.app, t("addFormat"), "", (value) =>
            /^[a-z0-9][a-z0-9_+#.-]*$/i.test(value.trim()) ? null : t("invalidFormat"),
          );
          if (value) {
            for (const format of selectedKinds(value)) kinds.add(format);
            await save();
          }
        }),
      );
    };
    render();
    modal.open();
  }

  private groups(): SettingsGroup[] {
    return [
      {
        type: "group",
        heading: "Code Embed · " + this.plugin.manifest.version,
        items: [
          {
            name: t("helpGuide"),
            render: (row) => {
              row.controlEl.createEl("a", {
                text: t("helpGuide"),
                href: guideUrl(),
                attr: { target: "_blank", rel: "noopener noreferrer" },
              });
            },
          },
          {
            name: t("chooseFolder"),
            render: (row) => {
              row.addButton((button) =>
                button
                  .setButtonText(t("chooseFolder"))
                  .onClick(() => this.plugin.choosePackageFolder()),
              );
            },
          },
          this.toggle(
            "showAllFolderActions",
            t("showAllFolderActions"),
            t("showAllFolderActionsHelp"),
          ),
          this.color("packageColor", t("rootColor"), t("rootColorHelp")),
        ],
      },
      {
        type: "group",
        heading: t("expansion"),
        items: [this.toggle("livePreview", t("livePreview"), t("livePreviewHelp"))],
      },
      {
        type: "group",
        heading: t("previewMode"),
        items: [
          this.toggle("viewTree", t("viewTree"), t("viewTreeHelp")),
          this.toggle("xmlPlain", t("xmlPlain"), t("xmlPlainHelp")),
          this.slider("treeOpenDepth", t("treeOpenDepth"), t("treeOpenDepthHelp"), 0, 10, 1),
          this.slider("inlineMax", t("inlineMax"), t("inlineMaxHelp"), 0, 200, 10),
        ],
      },
      {
        type: "group",
        heading: t("blockKinds"),
        items: [
          this.toggle("showActionLabels", t("showActionLabels"), ""),
          this.blockOpacity(),
          ...this.blockKinds(),
        ],
      },
      { type: "group", heading: t("noteActions"), items: [this.templateRow()] },
      {
        type: "group",
        heading: t("sidebars"),
        items: [
          this.toggle("showPanels", t("showPanels"), t("showPanelsHelp")),
          this.toggle("panelOnTop", t("panelOnTop"), t("panelOnTopHelp")),
          this.toggle("panelNested", t("panelNested"), t("panelNestedHelp")),
          this.slider("panelMaxVh", t("panelMaxVh"), t("panelMaxVhHelp"), 20, 90, 5),
          this.toggle("panelLinks", t("panelLinks"), t("panelLinksHelp")),
        ],
      },
      {
        type: "group",
        heading: t("rename"),
        items: [
          this.toggle("autoRenameFile", t("autoRenameFile"), t("autoRenameFileHelp")),
          this.toggle("autoRenameTag", t("autoRenameTag"), t("autoRenameTagHelp")),
          this.toggle("autoRenameSection", t("autoRenameSection"), t("autoRenameSectionHelp")),
          this.toggle("renameNotice", t("renameNotice"), t("renameNoticeHelp")),
        ],
      },
      {
        type: "group",
        heading: t("warnings"),
        items: [
          this.toggle("warnBroken", t("warnBroken"), t("warnBrokenHelp")),
          this.slider("validateDelay", t("validateDelay"), t("validateDelayHelp"), 500, 10000, 500),
        ],
      },
      {
        type: "group",
        heading: t("colors"),
        items: [
          this.color("cWidgetBorder", t("cWidgetBorder"), t("cWidgetBorderHelp")),
          this.color("cWidgetBg", t("cWidgetBg"), t("cWidgetBgHelp")),
          this.slider("cWidgetBgAlpha", t("cWidgetBgAlpha"), t("cWidgetBgAlphaHelp"), 0, 100, 5),
          this.color("cErrBorder", t("cErrBorder"), t("cErrBorderHelp")),
          this.color("cErrBg", t("cErrBg"), t("cErrBgHelp")),
          this.slider("cErrBgAlpha", t("cErrBgAlpha"), t("cErrBgAlphaHelp"), 0, 100, 5),
          this.color("cErrText", t("cErrText"), t("cErrTextHelp")),
          this.color("cTreeTag", t("cTreeTag"), t("cTreeTagHelp")),
          this.color("cTreeImport", t("cTreeImport"), t("cTreeImportHelp")),
          this.color("cChip", t("cChip"), t("cChipHelp")),
          {
            name: t("resetAll"),
            desc: t("resetHelp"),
            render: (row) => {
              row.addButton((button) =>
                button
                  .setButtonText(t("reset"))
                  .setCta()
                  .onClick(async () => {
                    this.plugin.settings = { ...DEFAULTS };
                    await this.plugin.saveData(this.plugin.settings);
                    this.plugin.applySettings("all");
                    this.refreshSettings();
                  }),
              );
            },
          },
        ],
      },
    ];
  }

  getSettingDefinitions(): SettingsGroup[] {
    return this.groups();
  }
  // Older hosts call display directly. Newer hosts index and render the same rows.
  display() {
    this.renderLegacySettings();
  }

  private renderLegacySettings() {
    this.containerEl.empty();
    for (const group of this.groups()) {
      new Setting(this.containerEl).setName(group.heading).setHeading();
      for (const item of group.items) {
        const row = new Setting(this.containerEl).setName(item.name);
        if (item.desc) row.setDesc(item.desc);
        item.render(row);
      }
    }
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
      this.plugin.renderPackageLink(row, b.file);
      row.createEl("code", { text: formatEmbed(b.ref) });
      row.createDiv({ cls: "ce-broken-why", text: b.why });
      row.onclick = () => {
        this.close();
        this.plugin.goTo(b.file, b.line, b.ch).catch(console.error);
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
    const m = /(?:^|[^\\\\])!\[([^[\]]*)$/.exec(before);
    if (!m || /^\]\s*[([]/.test(line.slice(cursor.ch))) return null;
    return {
      start: { line: cursor.line, ch: cursor.ch - m[1].length - 2 },
      end: { line: cursor.line, ch: cursor.ch + Number(line[cursor.ch] === "]") },
      query: m[1],
    };
  }
  async getSuggestions({ file, query }: EditorSuggestContext) {
    if (/^<{1,2}sys:/i.test(query)) {
      const prefix = query
        .replace(/^<{1,2}sys:/i, "")
        .replace(/>+$/, "")
        .toLowerCase();
      return systemKeys
        .filter((key) => key.startsWith(prefix))
        .map((key) => formatEmbed("<<sys:" + key + ">>"));
    }
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
            !isMarker(f.name) &&
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
    window.setTimeout(() => {
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
        window.setTimeout(() => {
          if (!chosen) resolve(null);
        }, 0);
      }
    }
    const m = new Pick(app);
    m.setPlaceholder(placeholder);
    m.open();
  });
}
