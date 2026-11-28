import {
  Plugin,
  requireApiVersion,
  MarkdownRenderer,
  MarkdownView,
  Platform,
  Notice,
  Component,
  MarkdownRenderChild,
  type WorkspaceLeaf,
  type View,
  type TFile,
  type TAbstractFile,
  type TFolder,
  type Editor,
  type MarkdownPostProcessorContext,
  type Menu,
} from "obsidian";
import { MARKER_EDITOR, MarkerEditor } from "./marker-editor";
import { actionBar, NoteActions } from "./note-actions";
import {
  validationDocument,
  noteReferences,
  isTagReference,
  blockKind,
  findFences,
  selectedKinds,
} from "./action-markdown";
import type { EditorView } from "@codemirror/view";
import {
  refresh,
  createCodeBlockExtension,
  createMarkdownExtension,
  createLinkNavigationExtension,
} from "./editor";
import {
  VIEW_TYPE,
  ReferencePanel,
  CodeEmbedSettings,
  BrokenModal,
  EmbedSuggest,
  askText,
  pickOne,
} from "./views";
import { readSettings, DEFAULTS, type Settings } from "./settings";
import {
  isVaultFile,
  isVaultFolder,
  MARKER,
  LEGACY_MARKER,
  isMarker,
  markerPath,
  relativeTo,
  PackageIndex,
  type IndexedFile,
  type Lookup,
} from "./package-index";
import { markImport, parseTree, hasStructure, type TreeNode } from "./tree";
import { t, interfaceLanguage } from "./locale";
import { systemKey, systemValue } from "./system-variables";
import { renderErrorsInText } from "./render-errors";
import {
  REF_RE,
  wikiLinks,
  hasEmbed,
  FENCE_RE,
  HEADING_RE,
  formatError,
  markErrors,
  hasErrors,
  applyArgs,
  parseRef,
  isNativeHeading,
  formatEmbed,
  normalizeTitle,
  fenceAware,
  slice,
  countNewlines,
  headingList,
  tagsOf,
  TAG_NAME_PATTERN,
  escapeRegExp,
  badSectionName,
  tagToHeading,
  headingToTag,
  rewriteText,
} from "./fragments";
import type {
  BrokenReference,
  RawReference,
  ScannedReference,
  ResolvedReference,
  ReferenceNode,
  Occurrence,
  Outgoing,
  Incoming,
  RenameSnapshot,
  ExplorerView,
} from "./model";

function operatingSystem() {
  if (Platform.isAndroidApp) return "android";
  if (Platform.isIosApp) return "ios";
  if (Platform.isWin) return "windows";
  if (Platform.isMacOS) return "macos";
  if (Platform.isLinux) return "linux";
  return "unknown";
}

interface ExpansionRules {
  originPath?: string;
  failOnError?: boolean;
  source?: { path: string; text: string };
  read?: (file: TFile) => Promise<string>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const PANES = ["outgoing-link", "backlink"];
function rgba(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return (
    "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a / 100 + ")"
  );
}

class CodeEmbedPlugin extends Plugin {
  settings: Settings = { ...DEFAULTS };
  rawReferences = new Map<string, RawReference[]>();
  previousBrokenReferences: Set<string> | null = null;
  brokenModal: BrokenModal | null = null;
  validationTimer?: number;
  timer?: number;
  panelTimer?: number;
  validationRevision = 0;
  panelRevision = 0;
  injectionRevision = 0;
  fold: Record<string, boolean> = {};
  activeRenameCount = 0;
  cache = new Map<string, string>();
  resolvedReferences = new Map<string, ResolvedReference[]>();
  revision = 0;
  lastFile: TFile | null = null;
  watched = new WeakSet<Element>();
  packageIndex: PackageIndex<TFile> | null = null;
  suggest?: EmbedSuggest;
  folderUpdateFrame: number | null = null;
  renameSnapshots = new Map<string, RenameSnapshot>();
  renameScanTimers = new Map<string, number>();
  private scanningRenames = 0;
  forceRenameUpdate = false;

  readonly actions = new NoteActions(this);

  private settingsTab?: CodeEmbedSettings;

  openActionSettings(kind?: string) {
    this.settingsTab?.openFor(kind);
  }

  async onload() {
    this.settings = readSettings(await this.loadData());
    this.settingsTab = new CodeEmbedSettings(this.app, this);
    this.addSettingTab(this.settingsTab);

    const funding = (
      this.manifest as typeof this.manifest & { fundingUrl?: string | Record<string, string> }
    ).fundingUrl;
    const link = typeof funding === "string" ? funding : Object.values(funding || {})[0];
    if (link && /^https:\/\//i.test(link))
      this.addCommand({
        id: "support",
        name: t("support"),
        callback: async () => {
          const links =
            typeof funding === "string" ? [[t("support"), funding]] : Object.entries(funding ?? {});
          const options = links
            .filter(([, url]) => /^https:\/\//i.test(url))
            .map(([label, url]) => ({ label, url }));
          const choice =
            options.length === 1 ? options[0] : await pickOne(this.app, t("support"), options);
          if (choice) window.open(choice.url, "_blank", "noopener,noreferrer");
        },
      });

    this.registerView(MARKER_EDITOR, (leaf) => new MarkerEditor(leaf, this));
    this.registerView(VIEW_TYPE, (leaf) => new ReferencePanel(leaf, this));
    this.addRibbonIcon("link", t("panel"), () => this.openPanel());
    this.addCommand({ id: "open-panel", name: t("openPanel"), callback: () => this.openPanel() });

    this.registerEditorExtension([
      createCodeBlockExtension(this),
      createMarkdownExtension(this),
      createLinkNavigationExtension(this),
    ]);
    this.registerMarkdownPostProcessor((el, ctx) => this.postProcess(el, ctx));

    this.addCommand({
      id: "copy-expanded",
      name: t("copyBlock"),
      editorCallback: async (editor, view) => {
        const source = editor.getValue();
        const at = editor.posToOffset(editor.getCursor());
        const fence = findFences(source).find((block) => at >= block.start && at < block.end);
        if (!fence) {
          new Notice(t("notInBlock"));
          return;
        }
        const body = source.slice(fence.bodyStart, fence.bodyEnd).replace(/\r?\n$/, "");
        await this.actions.copyBlock(body, view.file?.path ?? "", source);
        new Notice(t("blockCopied"));
      },
    });

    const ws = this.app.workspace,
      v = this.app.vault;
    this.registerEvent(
      v.on("modify", (f) => {
        this.cache.delete(f.path);
        this.resolvedReferences.delete(f.path);
        this.rawReferences.delete(f.path);
        this.invalidate();
        this.scheduleInject();
        this.scheduleValidate();
      }),
    );
    const refreshFiles = () => {
      this.packageIndex = null;
      this.cache.clear();
      this.resolvedReferences.clear();
      this.rawReferences.clear();
      this.invalidate();
      this.scheduleInject();
      this.scheduleValidate();
      this.scheduleFolders();
      this.suggest?.close();
    };
    this.registerEvent(v.on("create", refreshFiles));
    this.registerEvent(v.on("delete", refreshFiles));
    this.registerEvent(
      v.on("rename", (file, oldPath) => {
        if (isVaultFolder(file)) {
          this.hiddenRoots = new Set(
            [...this.hiddenRoots].map((root) =>
              root === oldPath || root.startsWith(oldPath + "/")
                ? file.path + root.slice(oldPath.length)
                : root,
            ),
          );
        }
        refreshFiles();
        this.trackMovedSources(file, oldPath).catch(console.error);
      }),
    );

    this.registerEvent(ws.on("file-open", () => this.scheduleInject()));
    this.registerEvent(ws.on("active-leaf-change", () => this.scheduleInject()));
    this.registerEvent(ws.on("layout-change", () => this.scheduleInject()));
    this.app.workspace.onLayoutReady(() => {
      this.scheduleInject();
    });

    this.setupFolders();
    this.suggest = new EmbedSuggest(this.app, this);
    this.registerEditorSuggest(this.suggest);
    this.setupRename();
    this.attachDocument(this.app.workspace.containerEl.ownerDocument);
    this.app.workspace.iterateAllLeaves((leaf) =>
      this.attachDocument(leaf.view.containerEl.ownerDocument),
    );
    this.registerEvent(
      ws.on("window-open", (_container, win) => this.attachDocument(win.document)),
    );
    this.registerEvent(
      ws.on("window-close", (_container, win) => this.detachDocument(win.document)),
    );
  }

  onunload() {
    this.markerRevision++;
    for (const doc of this.documents.keys()) this.detachDocument(doc);
    if (this.folderUpdateFrame !== null) window.cancelAnimationFrame(this.folderUpdateFrame);
    window.clearTimeout(this.timer);
    window.clearTimeout(this.validationTimer);
    window.clearTimeout(this.panelTimer);
    this.teardownRename();
    this.brokenModal?.close();
  }

  private readonly documents = new Map<Document, () => void>();

  private attachDocument(doc: Document) {
    if (this.documents.has(doc)) return;
    const onClick = (event: MouseEvent) => this.onClick(event);
    doc.addEventListener("click", onClick, true);
    const observer = new MutationObserver((records) => {
      if (
        Platform.isMobile &&
        records.some(
          (record) =>
            [...record.addedNodes].some(
              (node) =>
                node.instanceOf(Element) &&
                (node.matches(".cm-sizer, .mod-header") ||
                  node.querySelector(".cm-sizer, .mod-header")),
            ) ||
            [...record.removedNodes].some(
              (node) => node.instanceOf(Element) && node.matches(".ce-note-actions"),
            ),
        )
      )
        this.scheduleInject();
      if (
        records.some(
          (r) =>
            r.type === "attributes" ||
            (r.target.instanceOf(Element) &&
              r.target.matches(".nav-folder-title") &&
              !r.target.querySelector(".ce-folder-action")) ||
            [...r.addedNodes].some(
              (n) =>
                n.instanceOf(Element) &&
                (n.matches(
                  ".nav-folder, .nav-folder-title, .workspace-leaf-content[data-type=file-explorer]",
                ) ||
                  n.querySelector<HTMLElement>(".nav-folder-title") ||
                  (n.parentElement?.closest(".nav-folder-title") &&
                    !n.matches(".ce-folder-action"))),
            ),
        )
      )
        this.scheduleFolders();
    });
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-path"],
    });
    this.documents.set(doc, () => {
      doc.removeEventListener("click", onClick, true);
      observer.disconnect();
    });
    this.applyDocumentColors(doc);
    this.scheduleFolders();
  }

  private detachDocument(doc: Document) {
    this.documents.get(doc)?.();
    this.documents.delete(doc);
    doc.querySelectorAll(".ce-folder-action").forEach((el) => el.remove());
    doc
      .querySelectorAll(".ce-package-folder, .ce-folder-with-action")
      .forEach((el) => el.classList.remove("ce-package-folder", "ce-folder-with-action"));
    doc.querySelectorAll(".ce-note-actions, .ce-native-section").forEach((e) => e.remove());
    doc.querySelectorAll(".ce-host").forEach((e) => e.classList.remove("ce-host"));
    doc.body.classList.remove("ce-icons-only");
    const st = doc.body.style;
    [
      "--ce-block-opacity",
      "--ce-panel-max",
      "--ce-package-color",
      "--ce-widget-border",
      "--ce-widget-bg",
      "--ce-err-border",
      "--ce-err-bg",
      "--ce-err-text",
      "--ce-tag",
      "--ce-import",
      "--ce-chip",
      "--ce-gutter",
      "--ce-action-font",
      "--ce-action-gap",
      "--ce-indent",
      "--ce-touch",
      "--ce-mobile-gap",
      "--ce-mobile-top",
    ].forEach((p) => st.removeProperty(p));
  }

  applyColors() {
    for (const doc of this.documents.keys()) this.applyDocumentColors(doc);
  }

  private applyDocumentColors(doc: Document) {
    doc.body.classList.toggle("ce-icons-only", !this.settings.showActionLabels);
    const s = this.settings,
      st = doc.body.style;
    const setColor = (name: string, val: string | null) => {
      if (val) st.setProperty(name, val);
      else st.removeProperty(name);
    };
    st.setProperty("--ce-block-opacity", String(s.blockOpacity / 100));
    st.setProperty("--ce-panel-max", s.panelMaxVh + "vh");
    setColor("--ce-widget-border", s.cWidgetBorder);
    setColor("--ce-widget-bg", s.cWidgetBg ? rgba(s.cWidgetBg, s.cWidgetBgAlpha) : "");
    setColor("--ce-err-border", s.cErrBorder);
    setColor("--ce-err-bg", s.cErrBg ? rgba(s.cErrBg, s.cErrBgAlpha) : "");
    setColor("--ce-err-text", s.cErrText);
    setColor("--ce-package-color", s.packageColor);
    setColor("--ce-tag", s.cTreeTag);
    setColor("--ce-import", s.cTreeImport);
    setColor("--ce-chip", s.cChip);
    const setPx = (name: string, value: number) => {
      if (Number.isFinite(value) && value > 0) st.setProperty(name, Math.min(value, 400) + "px");
      else st.removeProperty(name);
    };
    setPx("--ce-gutter", s.copyGutter);
    setPx("--ce-action-font", s.actionFont);
    setPx("--ce-action-gap", s.actionGap);
    setPx("--ce-indent", s.childIndent);
    setPx("--ce-touch", s.mobileTouch);
    setPx("--ce-mobile-gap", s.mobileGap);
    setPx("--ce-mobile-top", s.mobileTop);
  }

  applySettings(key: keyof Settings | "all") {
    this.applyColors();
    if (key === "showAllFolderActions" || key === "all") this.scheduleFolders();
    this.resolvedReferences.clear();
    this.rawReferences.clear();
    this.invalidate();
    this.scheduleInject();
    if (key === "warnBroken" || key === "all") {
      if (this.settings.warnBroken) this.validate(true).catch(console.error);
      else this.previousBrokenReferences = null;
    }
  }

  invalidate() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.cache.clear();
      this.revision++;
      this.app.workspace.iterateAllLeaves((leaf) => {
        const v = leaf.view;
        if (v instanceof MarkerEditor) v.refreshActions();
        if (v instanceof MarkdownView) {
          const cm = (v.editor as Editor & { cm?: EditorView })?.cm;
          if (cm) cm.dispatch({ effects: [cm.scrollSnapshot(), refresh.of(null)] });
          if (v.getMode() === "preview") v.previewMode.rerender(false);
        }
      });
    }, 500);
  }

  rawRefs(text: string): RawReference[] {
    const out = [];
    let line = 0;
    let start = 0;
    let newline = text.indexOf("\n");
    for (const { ref, from, local } of noteReferences(text)) {
      while (newline >= 0 && newline < from) {
        line++;
        start = newline + 1;
        newline = text.indexOf("\n", start);
      }
      out.push({ ref, p: parseRef(ref), line, ch: from - start, local });
    }
    return out;
  }

  async rawOf(file: TFile) {
    let hit = this.rawReferences.get(file.path);
    if (!hit) {
      hit = this.rawRefs(await this.read(file));
      this.rawReferences.set(file.path, hit);
    }
    return hit;
  }

  async checkItem(it: RawReference, file: TFile, source?: { path: string; text: string }) {
    try {
      await this.resolve(it.ref, file.path, [], false, it.local, undefined, {
        failOnError: true,
        source,
      });
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  async collectErrors(deferred = new Set<string>()) {
    const out: BrokenReference[] = [];
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view?.getMode() === "source" ? view.editor : null;
    let draft: { path: string; text: string } | undefined;
    if (editor && view?.file) {
      const carets = editor.listSelections().map((range) => editor.posToOffset(range.head));
      const doc = validationDocument(editor.getValue(), carets);
      draft = { path: view.file.path, text: doc.text };
      for (const ref of doc.deferred) deferred.add(view.file.path + "|" + ref + "|");
    }
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (isMarker(file.name)) continue;
      const items = draft?.path === file.path ? this.rawRefs(draft.text) : await this.rawOf(file);
      for (const it of items) {
        const why = await this.checkItem(it, file, draft);
        if (why) out.push({ file, line: it.line, ch: it.ch, ref: it.ref, why });
      }
    }
    return out;
  }

  scheduleValidate() {
    this.validationRevision++;
    if (!this.settings.warnBroken) return;
    window.clearTimeout(this.validationTimer);
    this.validationTimer = window.setTimeout(() => {
      this.validate(false).catch(console.error);
    }, this.settings.validateDelay);
  }

  async validate(silent: boolean) {
    if (!this.settings.warnBroken) return;
    if (this.activeRenameCount || this.scanningRenames || this.renameScanTimers.size) return;
    const revision = ++this.validationRevision;
    const deferred = new Set<string>();
    const list = await this.collectErrors(deferred);
    if (revision !== this.validationRevision || this.activeRenameCount) return;
    const cur = new Map<string, BrokenReference>();
    for (const e of list) {
      const key = e.file.path + "|" + e.ref + "|" + e.why;
      if (!cur.has(key)) cur.set(key, e);
    }
    const prev = this.previousBrokenReferences;
    this.previousBrokenReferences = new Set(cur.keys());
    if (prev && deferred.size) {
      const prefixes = [...deferred];
      for (const key of prev) {
        if (prefixes.some((prefix) => key.startsWith(prefix)))
          this.previousBrokenReferences.add(key);
      }
    }
    if (silent || !prev) return;
    const fresh = [...cur.entries()].filter(([k]) => !prev.has(k)).map(([, v]) => v);
    if (fresh.length) this.notifyBroken(fresh);
  }

  notifyBroken(list: BrokenReference[]) {
    if (this.activeRenameCount) return;
    const k = (b: BrokenReference) => b.file.path + "|" + b.ref + "|" + b.why;
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

  async read(file: TFile): Promise<string> {
    const cached = this.cache.get(file.path);
    if (cached !== undefined) return cached;
    const t = await this.app.vault.cachedRead(file);
    this.cache.set(file.path, t);
    return t;
  }

  async trackMovedSources(item: TAbstractFile, oldPath: string) {
    const files = this.app.vault.getFiles();
    const oldPaths = new Map(
      files
        .filter((file) => file.path === item.path || file.path.startsWith(item.path + "/"))
        .map((file) => [file, oldPath + file.path.slice(item.path.length)]),
    );
    const previous = new PackageIndex<IndexedFile>(
      files.map((file) => {
        const path = oldPaths.get(file);
        if (path === undefined) return file;
        const name = path.slice(path.lastIndexOf("/") + 1);
        return {
          path,
          name,
          basename: name.replace(/\.md$/i, ""),
          extension: file.extension,
          actual: file,
        };
      }),
      [...this.hiddenRoots].map((root) =>
        root === item.path || root.startsWith(item.path + "/")
          ? oldPath + root.slice(item.path.length)
          : root,
      ),
    );
    const guards: Record<string, Record<string, string>> = (this.settings.movedReferences ??= {});
    let changed = false;
    for (const [file, before] of oldPaths) {
      if (file.extension !== "md" || isMarker(file.name)) continue;
      const oldRoot = previous.root(before);
      const root = this.packages().root(file.path);
      const names = new Map(Object.entries(guards[before] || {}));
      if (guards[before]) {
        delete guards[before];
        changed = true;
      }
      if (oldRoot !== null && oldRoot !== root) {
        for (const { p } of this.rawRefs(await this.app.vault.cachedRead(file))) {
          if (p.name === ".") continue;
          const prior = previous.lookup(p.name, oldRoot).file;
          const next = this.lookupWithin(p.name, file.path, root).file;
          if (prior && (prior.actual ?? prior) !== next)
            names.set(p.name, prior.actual?.path ?? prior.path);
        }
      }
      if (names.size) {
        guards[file.path] = Object.fromEntries(names);
        changed = true;
      }
    }
    if (changed) {
      await this.saveData(this.settings);
      this.invalidate();
      this.scheduleValidate();
    }
  }

  private hiddenRoots = new Set<string>();
  private markerRevision = 0;

  private async scanHiddenRoots() {
    const revision = ++this.markerRevision;
    const { vault } = this.app;
    const folders = new Set([
      "",
      ...vault
        .getAllLoadedFiles()
        .filter(isVaultFolder)
        .map((f) => (f.path === "/" ? "" : f.path)),
    ]);
    const found = new Set<string>();
    for (const folder of folders) {
      if (revision !== this.markerRevision) return;
      if ((await vault.adapter.stat(markerPath(folder)))?.type === "file") found.add(folder);
    }
    if (revision !== this.markerRevision) return;
    this.hiddenRoots = found;
    this.packageIndex = null;
    this.resolvedReferences.clear();
    this.invalidate();
    this.scheduleFolders();
    this.scheduleInject();
    this.scheduleValidate();
  }

  private packageMarker(root: string) {
    const path = markerPath(root);
    if (
      this.hiddenRoots.has(root === "/" ? "" : root) ||
      this.app.vault.getAbstractFileByPath(path)
    )
      return path;
    const legacy = path.slice(0, -MARKER.length) + LEGACY_MARKER;
    return this.app.vault.getAbstractFileByPath(legacy) ? legacy : path;
  }

  async editMarker(root: string) {
    const path = this.packageMarker(root);
    const { vault, workspace } = this.app;
    const file = vault.getAbstractFileByPath(path);
    if (isVaultFile(file)) {
      await workspace.getLeaf("tab").openFile(file, { state: { mode: "source" } });
      return;
    }
    const existing = workspace.getLeavesOfType(MARKER_EDITOR).find((leaf) => {
      const state = leaf.getViewState().state;
      return state?.path === path && state.mode !== "preview";
    });
    const leaf = existing ?? workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: MARKER_EDITOR, state: { path }, active: true });
    if (requireApiVersion("1.7.2")) await workspace.revealLeaf(leaf);
    else workspace.setActiveLeaf(leaf, { focus: true });
  }

  folderActionLabel(folder: TFolder) {
    const path = this.packageMarker(folder.path);
    const marker = this.app.vault.getAbstractFileByPath(path);
    return this.hiddenRoots.has(folder.path === "/" ? "" : folder.path) ||
      (marker && !isVaultFolder(marker))
      ? t("unmarkFolder")
      : t("markFolder");
  }

  async choosePackageFolder() {
    const vault = this.app.vault;
    const root = vault.getRoot();
    const folders = [
      root,
      ...vault
        .getAllLoadedFiles()
        .filter(isVaultFolder)
        .filter((file) => file !== root),
    ];
    const choice = await pickOne(
      this.app,
      t("chooseFolder"),
      folders.map((folder) => ({
        folder,
        label: folder.path + " — " + this.folderActionLabel(folder),
      })),
    );
    if (choice) await this.toggleFolder(choice.folder);
  }

  setupFolders() {
    const populatedMenus = new WeakSet();
    const addFolderAction = (menu: Menu, folder: TAbstractFile) => {
      if (!isVaultFolder(folder) || populatedMenus.has(menu)) return;
      populatedMenus.add(menu);
      menu.addItem((item) =>
        item
          .setTitle(this.folderActionLabel(folder))
          .setIcon("folder-cog")
          .onClick(() => this.toggleFolder(folder)),
      );
    };
    const workspace = this.app.workspace;
    this.registerEvent(workspace.on("file-menu", addFolderAction));
    this.registerEvent(
      workspace.on("files-menu", (menu, files) => {
        if (files.length === 1) addFolderAction(menu, files[0]);
      }),
    );
    const chooseFolder = () => this.choosePackageFolder();
    this.addCommand({
      id: "choose-package-folder",
      name: t("chooseFolder"),
      callback: chooseFolder,
    });
    this.addRibbonIcon("folder-cog", t("chooseFolder"), chooseFolder);
    const scan = () => this.scanHiddenRoots().catch(console.error);
    this.app.workspace.onLayoutReady(() => {
      this.scanHiddenRoots()
        .then(() => this.validate(true))
        .catch(console.error);
    });
    const refreshFolderMarkers = (file: TAbstractFile) => {
      if (isVaultFolder(file)) void scan();
    };
    this.registerEvent(this.app.vault.on("rename", refreshFolderMarkers));
    this.registerEvent(this.app.vault.on("create", refreshFolderMarkers));
    this.registerEvent(this.app.vault.on("delete", refreshFolderMarkers));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleFolders()));
    this.scheduleFolders();
  }

  scheduleFolders() {
    if (this.folderUpdateFrame != null) return;
    this.folderUpdateFrame = window.requestAnimationFrame(() => {
      this.folderUpdateFrame = null;
      const rows = new Map<HTMLElement, TFolder>();
      for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
        const view = leaf.view as ExplorerView;
        // Some explorer versions keep the file on the tree item rather than the title element.
        const items =
          view.fileItems instanceof Map
            ? view.fileItems.values()
            : Object.values(view.fileItems || {});
        for (const item of items) {
          if (!isVaultFolder(item.file)) continue;
          const row = item.selfEl || item.el?.querySelector<HTMLElement>(".nav-folder-title");
          if (row?.isConnected) rows.set(row, item.file);
        }
      }
      // A phone drawer can mount its explorer outside the leaf container.
      for (const doc of this.documents.keys()) {
        for (const row of doc.querySelectorAll<HTMLElement>(".nav-folder-title")) {
          if (rows.has(row)) continue;
          const path =
            row.dataset.path ??
            row.closest<HTMLElement>(".nav-folder")?.dataset.path ??
            row.querySelector<HTMLElement>("[data-path]")?.dataset.path;
          const folder = path ? this.app.vault.getAbstractFileByPath(path) : null;
          if (isVaultFolder(folder)) rows.set(row, folder);
        }
      }
      for (const [row, folder] of rows) this.decorateFolder(row, folder);
    });
  }

  decorateFolder(row: HTMLElement, folder: TFolder) {
    const folderPath = folder.path === "/" ? "" : folder.path;
    const showAll = this.settings.showAllFolderActions;
    const marked = this.packages().roots.has(folderPath);
    row.classList.toggle("ce-package-folder", marked);
    row.classList.toggle("ce-folder-with-action", marked || showAll);
    const legacyPreview = row.querySelector(".ce-marker-preview");
    if (legacyPreview) {
      legacyPreview.remove();
      row.querySelector(".ce-folder-action")?.remove();
    }
    let button = row.querySelector<HTMLButtonElement>(".ce-folder-action");
    if (!showAll && !marked) {
      button?.remove();
      return;
    }
    if (!button) {
      button = row.createEl("button", { cls: "ce-folder-action" });
      button.type = "button";
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("mousedown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = this.app.vault.getAbstractFileByPath(button?.dataset.folderPath ?? "");
        if (!isVaultFolder(current)) return;
        const operation = this.packages().roots.has(current.path === "/" ? "" : current.path)
          ? this.editMarker(current.path)
          : this.toggleFolder(current);
        operation.catch((error: unknown) => new Notice(errorMessage(error)));
      });
    }
    button.dataset.folderPath = folder.path;
    const label = marked ? t("editDescription") : t("rootSet").replace(/^\+\s*/, "");
    if (button.dataset.label !== label || button.dataset.marked !== String(marked)) {
      button.replaceChildren();
      button.createSpan({ text: marked ? "📝" : "+", attr: { "aria-hidden": "true" } });
      button.createSpan({ cls: "ce-action-label", text: label });
      button.dataset.label = label;
      button.dataset.marked = String(marked);
    }
    button.title = marked
      ? t("editDescription") + " · " + this.packageMarker(folder.path)
      : t("markFolder");
    button.setAttribute("aria-label", button.title + " — " + folder.path);
  }

  async toggleFolder(folder: TFolder) {
    const path = this.packageMarker(folder.path),
      existing = this.app.vault.getAbstractFileByPath(path);
    const root = folder.path === "/" ? "" : folder.path;
    const { adapter } = this.app.vault;
    try {
      if (!existing) {
        const stat = await adapter.stat(path);
        if (stat?.type === "folder") {
          new Notice(t("markerIsFolder", { path }));
          return;
        }
        if (stat) {
          const choice = await pickOne(this.app, t("confirmUnmark", { path }), [
            { label: t("cancel") },
            { label: t("removeMarker", { path }), remove: true },
          ]);
          if (!choice?.remove) return;
          const now = await adapter.stat(path);
          if (
            !now ||
            now.mtime !== stat.mtime ||
            now.ctime !== stat.ctime ||
            now.size !== stat.size
          )
            return;
          await adapter.trashLocal(path);
          this.hiddenRoots.delete(root);
          new Notice(t("rootRemoved", { path: folder.path }));
        } else {
          const name = "`![<<sys:package>>]`";
          await this.app.vault.create(
            path,
            "# " +
              t("packageHeading", { name }) +
              "\n\n```md\n" +
              t("packagePrompt", { name }) +
              "\n```\n",
          );
          this.hiddenRoots.add(root);
          new Notice(t("rootCreated", { path: folder.path }));
        }
        this.markerRevision++;
        this.packageIndex = null;
        this.scheduleFolders();
        this.scheduleInject();
        this.scheduleValidate();
        return;
      }
      if (isVaultFolder(existing)) {
        new Notice(t("markerIsFolder", { path }));
        return;
      }
      if (requireApiVersion("1.6.6")) {
        const choice = await pickOne(this.app, t("confirmUnmark", { path }), [
          { label: t("cancel") },
          { label: t("removeMarker", { path }), remove: true },
        ]);
        if (
          !choice?.remove ||
          existing.path !== path ||
          this.app.vault.getAbstractFileByPath(path) !== existing
        )
          return;
        await this.app.fileManager.trashFile(existing);
      } else if (!(await this.app.fileManager.promptForDeletion(existing))) {
        return;
      }
      this.hiddenRoots.delete(root);
      this.packageIndex = null;
      this.scheduleFolders();
      new Notice(t("rootRemoved", { path: folder.path }));
    } catch (error) {
      new Notice(errorMessage(error));
    }
  }

  packages() {
    return (this.packageIndex ||= new PackageIndex(this.app.vault.getFiles(), this.hiddenRoots));
  }

  lookup(name: string, sourcePath: string, root = this.packages().root(sourcePath)): Lookup<TFile> {
    const result = this.lookupWithin(name, sourcePath, root);
    const bindings = this.settings.movedReferences?.[sourcePath];
    if (
      bindings &&
      Object.prototype.hasOwnProperty.call(bindings, name) &&
      result.file?.path !== bindings[name]
    )
      return {
        error:
          t("lostTarget") +
          ": " +
          name +
          " (" +
          t("package") +
          ": " +
          (root ?? t("outsidePackage")) +
          ")",
      };
    return result;
  }

  lookupWithin(name: string, sourcePath: string, root: string | null): Lookup<TFile> {
    if (name !== "." && name && root !== null) return this.packages().lookup(name, root);
    const file = this.unscopedFile(name, sourcePath);
    if (!file || isMarker(file.name) || (root !== null && this.packages().root(file.path) !== root))
      return {
        error:
          t("missingNote") +
          ": " +
          name +
          (root === null ? "" : " (" + t("package") + ": " + (root || "/") + ")"),
      };
    return { file };
  }

  findFile(name: string, sourcePath: string) {
    return this.lookup(name, sourcePath).file || null;
  }

  unscopedFile(name: string, sourcePath: string): TFile | null {
    if (name === "." || name === "") {
      const f = this.app.vault.getAbstractFileByPath(sourcePath);
      return isVaultFile(f) && f.extension ? f : null;
    }
    const linked = this.app.metadataCache.getFirstLinkpathDest(name, sourcePath);
    if (linked) return linked;
    if (!/\.(?:[cm]?js|jsx|tsx?|json|css|html|xml|ya?ml|toml|py|java|sh|sql|txt)$/i.test(name))
      return null;
    const folder = sourcePath.slice(0, Math.max(0, sourcePath.lastIndexOf("/") + 1));
    for (const path of new Set([folder + name, name])) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (isVaultFile(file)) return file;
    }
    return null;
  }

  async expand(
    text: string,
    sourcePath: string,
    stack: string[] = [],
    mark = false,
    local: string | null = null,
    root = this.packages().root(sourcePath),
    rules: ExpansionRules = {},
  ): Promise<string> {
    const re = REF_RE();
    const parts = [];
    let last = 0,
      m;
    while ((m = re.exec(text)) !== null) {
      parts.push(text.slice(last, m.index));
      if (m.groups!.esc) parts.push(m.groups!.all);
      else
        parts.push(await this.resolve(m.groups!.ref, sourcePath, stack, mark, local, root, rules));
      last = re.lastIndex;
    }
    parts.push(text.slice(last));
    return parts.join("");
  }

  // For self-references, a matching fragment in the active block takes precedence over the note.
  async resolve(
    ref: string,
    sourcePath: string,
    stack: string[] = [],
    mark = false,
    local: string | null = null,
    root = this.packages().root(sourcePath),
    rules: ExpansionRules = {},
  ): Promise<string> {
    const unresolved = (message: string) => {
      if (rules.failOnError) throw new Error(message);
      return formatError(message);
    };
    const keyName = systemKey(ref);
    if (keyName) {
      const path = rules.originPath ?? sourcePath;
      const value = systemValue(keyName, {
        path,
        root,
        vault: this.app.vault.getName(),
        app: "Obsidian",
        language: interfaceLanguage(),
        locale: window.navigator.language,
        get timezone() {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        },
        platform: operatingSystem(),
      });
      return value ?? unresolved(t("unknownVariable", { name: "sys:" + keyName }));
    }
    const p = parseRef(ref);
    const range = p.range;
    const { file, error } = this.lookup(p.name, sourcePath, root);
    const scope = root === null ? "" : " (" + t("package") + ": " + (root || "/") + ")";
    let localText: string | undefined;
    const isSelf = p.name === "." || p.name === "" || file?.path === sourcePath;
    const searchBlock = isSelf && local !== null;
    if (searchBlock) {
      try {
        localText = slice(local, range);
      } catch {
        /* The selector may still exist elsewhere in the same note. */
      }
    }
    let path = sourcePath;
    let key = sourcePath + "|block|" + range;
    let loadFragment: () => Promise<string>;
    if (localText !== undefined) {
      const fragment = localText;
      loadFragment = async () => fragment;
    } else if (!file && isSelf && isMarker(sourcePath.split("/").pop())) {
      key = sourcePath + "|" + range;
      loadFragment = async () =>
        slice(
          rules.source?.path === sourcePath
            ? rules.source.text
            : await this.app.vault.adapter.read(sourcePath),
          range,
        );
    } else if (file) {
      path = file.path;
      key = path + "|" + range;
      loadFragment = async () =>
        slice(
          rules.source?.path === path
            ? rules.source.text
            : await (rules.read?.(file) ?? this.read(file)),
          range,
        );
    } else {
      return unresolved(error);
    }
    if (stack.includes(key))
      return unresolved(t("cycle") + ": " + [...stack, key].join(" → ") + scope);
    let fragment: string;
    try {
      fragment = await loadFragment();
    } catch (error) {
      const where = searchBlock ? " (" + t("searchedBlock", { path }) + ")" : "";
      return unresolved(errorMessage(error).replace(/\]/g, ")") + where + scope);
    }
    const text = applyArgs(fragment, p.args ?? [], p.args !== null);
    const out = await this.expand(
      text,
      path,
      [...stack, key],
      mark,
      localText === undefined ? null : local,
      root,
      rules.originPath ? rules : { ...rules, originPath: sourcePath },
    );
    return mark ? markImport(ref, out) : out;
  }

  scanText(text: string, off: number) {
    const lines = text.split("\n"),
      fence = fenceAware(lines),
      out: ScannedReference[] = [];
    lines.forEach((line, idx) => {
      for (const m of line.matchAll(REF_RE())) {
        if (!m.groups!.esc) {
          out.push({
            ref: m.groups!.ref,
            codeEmbed: true,
            embed: true,
            line: off + idx,
            ch: m.index,
            fence: fence[idx],
          });
        }
      }
      if (!line.includes("[[")) return;
      for (const m of wikiLinks(line)) {
        out.push({ ref: m[1], embed: false, line: off + idx, ch: m.index, fence: fence[idx] });
      }
    });
    return out;
  }

  resolveRefs(raw: ScannedReference[], srcPath: string, root = this.packages().root(srcPath)) {
    const out = [];
    for (const r of raw) {
      if (systemKey(r.ref)) continue;
      const p = parseRef(r.ref);
      if (!p.name) continue;
      const target = this.lookup(p.name, srcPath, root).file;
      if (!target) continue;
      out.push({
        target,
        codeEmbed: r.codeEmbed,
        range: p.range,
        heading: p.heading,
        native: isNativeHeading(p),
        line: r.line,
        ch: r.ch,
        fence: r.fence,
        embed: r.embed,
      });
    }
    return out;
  }

  async refsOf(file: TFile) {
    const hit = this.resolvedReferences.get(file.path);
    if (hit) return hit;
    const text = await this.read(file);
    const all = this.resolveRefs(this.scanText(text, 0), file.path);
    const out = all.filter((r) => r.codeEmbed || (r.range && !r.native) || r.fence);
    this.resolvedReferences.set(file.path, out);
    return out;
  }

  async buildNodes(
    src: TFile,
    refs: ResolvedReference[],
    depth: number,
    stack: string[],
    limit = Infinity,
    root = this.packages().root(src.path),
  ): Promise<ReferenceNode[]> {
    const groups = new Map<string, ReferenceNode>();
    for (const r of refs) {
      const key = r.target.path + "|" + r.range;
      let g = groups.get(key);
      if (!g) {
        g = { key, file: r.target, range: r.range, occ: [], children: [], depth };
        groups.set(key, g);
      }
      g.occ.push({ file: src, line: r.line, ch: r.ch });
    }
    for (const g of groups.values()) {
      if (depth >= limit || stack.includes(g.key)) continue;
      try {
        const full = await this.read(g.file);
        const frag = slice(full, g.range);
        const p = frag ? full.indexOf(frag) : -1;
        const off = p > 0 ? countNewlines(full.slice(0, p)) : 0;
        const kids = this.resolveRefs(this.scanText(frag, off), g.file.path, root).filter(
          (r) => r.embed,
        );
        g.children = await this.buildNodes(g.file, kids, depth + 1, [...stack, g.key], limit, root);
      } catch (e) {
        if (g.file.path !== g.occ[0].file.path) g.error = errorMessage(e);
      }
    }
    return [...groups.values()];
  }

  panelLimit() {
    return this.settings.panelNested ? Infinity : 0;
  }

  async outgoing(file: TFile) {
    const nodes = await this.buildNodes(file, await this.refsOf(file), 0, [], this.panelLimit());
    const flat: Outgoing[] = [];
    const walk = (ns: ReferenceNode[], depth: number) => {
      for (const n of ns) {
        flat.push({ node: n, depth });
        walk(n.children, depth + 1);
      }
    };
    walk(nodes, 0);
    return flat;
  }

  async incoming(file: TFile) {
    const res: Incoming[] = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (isMarker(f.name)) continue;
      const refs = await this.refsOf(f);
      if (!refs.length) continue;
      const nodes = await this.buildNodes(f, refs, 0, [], this.panelLimit());
      const walk = (ns: ReferenceNode[], chain: ReferenceNode[]) => {
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
    window.clearTimeout(this.panelTimer);
    this.panelTimer = window.setTimeout(() => {
      this.injectAll().catch(console.error);
    }, 250);
  }

  async injectAll() {
    this.actions.mountNoteBars();
    this.trackFile();
    try {
      await this.injectPanes();
    } catch (e) {
      console.error("code-embed", e);
    }
    this.refreshPanels();
  }

  async injectPanes() {
    if (!this.settings.showPanels) {
      for (const doc of this.documents.keys()) {
        doc.querySelectorAll(".ce-native-section").forEach((el) => el.remove());
        doc.querySelectorAll(".ce-host").forEach((el) => el.classList.remove("ce-host"));
      }
      return;
    }
    const revision = ++this.injectionRevision;
    for (const type of PANES) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        try {
          await this.inject(leaf, type, revision);
        } catch (e) {
          console.error("code-embed", e);
        }
      }
    }
  }

  refreshPanels() {
    for (const l of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (l.view instanceof ReferencePanel) l.view.render().catch(console.error);
    }
  }

  async openPanel() {
    const ws = this.app.workspace;
    let leaf: WorkspaceLeaf | null = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = ws.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (requireApiVersion("1.7.2")) await ws.revealLeaf(leaf);
    else {
      const root = leaf.getRoot();
      if (root === ws.leftSplit) ws.leftSplit.expand();
      if (root === ws.rightSplit) ws.rightSplit.expand();
      ws.setActiveLeaf(leaf, { focus: true });
    }
  }

  labelOf(n: ReferenceNode) {
    return n.file.basename + (n.range ? (n.range.startsWith("#") ? n.range : ":" + n.range) : "");
  }

  async goTo(file: TFile, line: number, ch: number) {
    const ws = this.app.workspace;
    let leaf: WorkspaceLeaf | null = null;
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
    window.setTimeout(() => {
      const ed = view.editor;
      if (!ed) return;
      const last = Math.max(0, ed.lineCount() - 1);
      const pos = { line: Math.min(line, last), ch: ch || 0 };
      ed.setCursor(pos);
      ed.scrollIntoView({ from: pos, to: pos }, true);
      ed.focus();
    }, 60);
  }

  locateRange(text: string, range: string) {
    const r = (range || "")
      .replace(/\([\s\S]*$/, "")
      .replace(/\|.*$/, "")
      .trim();
    if (!r) return { line: 0, ch: 0 };
    let m;
    if ((m = /^<<?([\w:.-]+)>>?$/.exec(r))) {
      const open = "<" + m[1] + ">";
      const i = text.indexOf(open);
      if (i < 0) return { line: 0, ch: 0 };
      const ls = text.lastIndexOf("\n", i) + 1;
      return { line: countNewlines(text.slice(0, i)), ch: i - ls };
    }
    if (r.startsWith("#")) {
      const titles = r
        .replace(/^#+\s*/, "")
        .split("#")
        .map(normalizeTitle)
        .filter(Boolean);
      const lines = text.split("\n"),
        fence = fenceAware(lines);
      let from = 0,
        until = lines.length,
        lvl = 0,
        startLine = 0;
      for (const t of titles) {
        let found = -1;
        for (let i = from; i < until; i++) {
          if (FENCE_RE.test(lines[i])) continue;
          if (fence[i]) continue;
          const h = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
          if (!h) continue;
          if (found < 0) {
            if (normalizeTitle(h[2]) === t) {
              found = i;
              lvl = h[1].length;
            }
          } else if (h[1].length <= lvl) break;
        }
        if (found < 0) return { line: startLine, ch: 0 };
        startLine = found;
        from = found + 1;
        until = lines.length;
        for (let i = from; i < lines.length; i++) {
          if (fence[i] || FENCE_RE.test(lines[i])) continue;
          const h = HEADING_RE.exec(lines[i].replace(/\r$/, ""));
          if (h && h[1].length <= lvl) {
            until = i;
            break;
          }
        }
      }
      return { line: startLine, ch: 0 };
    }
    if ((m = /^(\d+)-(-\d+|\d*)$/.exec(r))) return { line: Math.max(0, Number(m[1]) - 1), ch: 0 };
    return { line: 0, ch: 0 };
  }

  async goToRange(file: TFile, range: string) {
    const text = await this.app.vault.cachedRead(file);
    const loc = this.locateRange(text, range);
    await this.goTo(file, loc.line, loc.ch);
  }

  fillSection(
    sec: HTMLElement,
    key: string,
    title: string,
    count: number,
    fill: (body: HTMLElement) => void,
  ) {
    const head = createDiv();
    head.className = "ce-native-head";
    const body = createDiv();
    body.className = "ce-native-body";
    body.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    const upd = () => {
      const f = !!this.fold[key];
      head.textContent = (f ? "▸ " : "▾ ") + title + " (" + count + ")";
      body.classList.toggle("ce-hidden", f);
    };
    head.onclick = () => {
      this.fold[key] = !this.fold[key];
      upd();
    };
    fill(body);
    upd();
    sec.replaceChildren(head, body);
  }

  emptyNote(body: HTMLElement, text: string) {
    body.createDiv({ cls: "ce-native-range", text });
  }

  chip(row: HTMLElement, o: Occurrence, file: TFile | null) {
    const chip = row.createSpan({ cls: "ce-chip" });
    chip.textContent =
      (file && o.file.path === file.path ? "" : o.file.basename + ":") + "L" + (o.line + 1);
    chip.title = o.file.path + " : " + (o.line + 1);
    chip.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.goTo(o.file, o.line, o.ch).catch(console.error);
    };
  }

  renderOutgoing(body: HTMLElement, items: Outgoing[], file: TFile) {
    if (!items.length) {
      this.emptyNote(body, t("empty"));
      return;
    }
    for (const it of items) {
      const n = it.node;
      const row = body.createDiv({ cls: "ce-native-row" });
      row.style.setProperty("--ce-indent", it.depth * 14 + 4 + "px");
      const label = row.createSpan({ cls: "ce-label" + (n.error ? " ce-bad" : "") });
      label.textContent = this.labelOf(n) + (n.error ? " ⚠ " + n.error : "");
      label.title = n.file.path;
      const first = n.occ[0];
      label.onclick = (e) => {
        e.preventDefault();
        this.goTo(first.file, first.line, first.ch).catch(console.error);
      };
      this.renderPackageLink(row, n.file);
      row.createSpan({ cls: "ce-count", text: "×" + n.occ.length });
      for (const o of n.occ) this.chip(row, o, file);
    }
  }

  renderIncoming(body: HTMLElement, items: Incoming[], file: TFile) {
    if (!items.length) {
      this.emptyNote(body, t("empty"));
      return;
    }
    const groups = new Map<string, { root: TFile; rows: Incoming[]; total: number }>();
    for (const it of items) {
      let g = groups.get(it.root.path);
      if (!g) {
        g = { root: it.root, rows: [], total: 0 };
        groups.set(it.root.path, g);
      }
      g.rows.push(it);
      g.total += it.node.occ.length;
    }
    for (const g of groups.values()) {
      const gk = "g|" + g.root.path;
      const wrap = body.createDiv();
      const head = wrap.createDiv({ cls: "ce-native-row ce-group" });
      const arrow = head.createSpan({ cls: "ce-arrow" });
      const name = head.createSpan({ cls: "ce-label" });
      name.textContent =
        g.root.basename + (g.root.path === file.path ? " (" + t("currentNote") + ")" : "");
      name.title = g.root.path;
      this.renderPackageLink(head, g.root);
      head.createSpan({ cls: "ce-count", text: "×" + g.total });
      const kids = wrap.createDiv({ cls: "ce-children" });
      const upd = () => {
        const f = !!this.fold[gk];
        arrow.textContent = f ? "▸" : "▾";
        kids.classList.toggle("ce-hidden", f);
      };
      arrow.onclick = (e) => {
        e.stopPropagation();
        this.fold[gk] = !this.fold[gk];
        upd();
      };
      const first = g.rows[0].node.occ[0];
      name.onclick = (e) => {
        e.preventDefault();
        this.goTo(first.file, first.line, first.ch).catch(console.error);
      };
      for (const it of g.rows) {
        const n = it.node;
        const row = kids.createDiv({ cls: "ce-native-row" });
        const label = row.createSpan({ cls: "ce-label" });
        label.textContent = this.labelOf(n);
        label.title = n.file.path;
        this.renderPackageLink(row, n.file);
        const f0 = n.occ[0];
        label.onclick = (e) => {
          e.preventDefault();
          this.goTo(f0.file, f0.line, f0.ch).catch(console.error);
        };
        row.createSpan({ cls: "ce-count", text: "×" + n.occ.length });
        if (it.chain.length > 1) {
          row.createSpan({
            cls: "ce-count",
            text:
              t("via") +
              " " +
              it.chain
                .slice(0, -1)
                .map((c) => this.labelOf(c))
                .join(" → "),
          });
        }
        for (const o of n.occ) this.chip(row, o, null);
      }
      upd();
    }
  }

  renderPackageLink(row: HTMLElement, file: TFile) {
    const root = this.packages().root(file.path);
    if (root === null) {
      row.createSpan({ cls: "ce-package-link", text: t("outsidePackage") });
      return;
    }
    const path = this.packageMarker(root);
    const link = row.createEl("a", {
      cls: "ce-package-link internal-link",
      text: t("package") + " · " + (root || "/"),
      href: path,
      attr: { "data-href": path, title: path },
    });
    link.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.editMarker(root).catch(console.error);
    };
  }

  renderErrors(body: HTMLElement, errs: BrokenReference[], file: TFile | null) {
    if (!errs.length) {
      this.emptyNote(body, t("noErrors"));
      return;
    }
    const groups = new Map<string, { file: TFile; list: BrokenReference[] }>();
    for (const e of errs) {
      if (!groups.has(e.file.path)) groups.set(e.file.path, { file: e.file, list: [] });
      groups.get(e.file.path)!.list.push(e);
    }
    const ordered = [...groups.values()].sort((a, b) => {
      const ac = file && a.file.path === file.path ? 0 : 1,
        bc = file && b.file.path === file.path ? 0 : 1;
      return ac - bc || a.file.path.localeCompare(b.file.path);
    });
    for (const g of ordered) {
      const gk = "e|" + g.file.path;
      const wrap = body.createDiv();
      const head = wrap.createDiv({ cls: "ce-native-row ce-group" });
      const arrow = head.createSpan({ cls: "ce-arrow" });
      const name = head.createSpan({ cls: "ce-label", text: g.file.path });
      this.renderPackageLink(head, g.file);
      head.createSpan({ cls: "ce-count", text: "×" + g.list.length });
      const kids = wrap.createDiv({ cls: "ce-children" });
      const upd = () => {
        const f = !!this.fold[gk];
        arrow.textContent = f ? "▸" : "▾";
        kids.classList.toggle("ce-hidden", f);
      };
      arrow.onclick = (e) => {
        e.stopPropagation();
        this.fold[gk] = !this.fold[gk];
        upd();
      };
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

  async inject(leaf: WorkspaceLeaf, type: string, revision: number) {
    const view = leaf.view;
    if (!view || !view.containerEl) return;
    const root =
      (view as View & { contentEl?: HTMLElement }).contentEl ||
      view.containerEl.querySelector<HTMLElement>(".view-content") ||
      view.containerEl;
    root.classList.add("ce-host");
    if (!this.watched.has(root)) {
      this.watched.add(root);
      new MutationObserver(() => {
        if (!root.querySelector<HTMLElement>(":scope > .ce-native-section")) this.scheduleInject();
      }).observe(root, { childList: true });
    }
    const file = this.lastFile || this.app.workspace.getActiveFile();
    let sec = root.querySelector<HTMLElement>(":scope > .ce-native-section");
    if (!file) {
      sec?.remove();
      return;
    }

    const isBacklink = type === "backlink";
    let count = 0;
    let render: (body: HTMLElement) => void;
    try {
      if (isBacklink) {
        const items = await this.incoming(file);
        count = items.length;
        render = (body) => this.renderIncoming(body, items, file);
      } else {
        const items = await this.outgoing(file);
        count = items.length;
        render = (body) => this.renderOutgoing(body, items, file);
      }
    } catch (error) {
      console.error("code-embed", error);
      render = (body) => {
        body.createDiv({ cls: "ce-err", text: t("errorLabel") + ": " + errorMessage(error) });
      };
    }
    if (revision !== this.injectionRevision) return;

    if (!sec) {
      sec = createDiv();
      sec.className = "ce-native-section";
    }
    if (this.settings.panelOnTop) {
      if (root.firstElementChild !== sec) root.prepend(sec);
    } else if (root.lastElementChild !== sec) {
      root.appendChild(sec);
    }
    this.fillSection(
      sec,
      isBacklink ? "n-in" : "n-out",
      "Code Embed – " + t(isBacklink ? "backlinks" : "outgoing"),
      count,
      render,
    );
  }

  async renderPanelView(view: ReferencePanel) {
    const revision = ++this.panelRevision;
    const file = this.lastFile || this.app.workspace.getActiveFile();
    let errs: BrokenReference[] = [],
      out: Outgoing[] = [],
      inc: Incoming[] = [],
      fail: string | null = null;
    try {
      errs = await this.collectErrors();
      if (this.settings.panelLinks && file) {
        out = await this.outgoing(file);
        inc = await this.incoming(file);
      }
    } catch (e) {
      console.error("code-embed", e);
      fail = errorMessage(e);
    }
    if (revision !== this.panelRevision) return;

    const root = view.contentEl;
    root.empty();
    if (fail) root.createDiv({ cls: "ce-err", text: t("errorLabel") + ": " + fail });
    const mk = (key: string, title: string, count: number, fill: (body: HTMLElement) => void) => {
      const sec = root.createDiv({ cls: "ce-native-section" });
      this.fillSection(sec, key, title, count, fill);
    };
    mk("p-err", t("errors"), errs.length, (b) => this.renderErrors(b, errs, file));
    if (this.settings.panelLinks && file) {
      mk("p-out", t("outgoing") + " – " + file.basename, out.length, (b) =>
        this.renderOutgoing(b, out, file),
      );
      mk("p-in", t("incoming") + " – " + file.basename, inc.length, (b) =>
        this.renderIncoming(b, inc, file),
      );
    }
  }

  async renderEmbedMarkdown(
    md: string,
    el: HTMLElement,
    path: string,
    owner: Component,
    block = false,
  ) {
    await this.renderMd(markErrors(md), el, path, owner);
    // Keep inline fragments alongside the surrounding Markdown.
    const paragraph = el.firstElementChild;
    if (!block && el.childElementCount === 1 && paragraph?.matches("p")) {
      paragraph.replaceWith(...paragraph.childNodes);
    }
  }

  async renderMd(md: string, el: HTMLElement, path: string, owner: Component = this) {
    await MarkdownRenderer.render(this.app, md, el, path, owner);
  }

  async renderTree(
    nodes: TreeNode[],
    parent: HTMLElement,
    path: string,
    plain: boolean,
    depth: number,
  ) {
    for (const n of nodes) {
      if (n.type === "text") {
        if (!n.text.trim()) continue;
        const d = parent.createDiv({
          cls: plain ? "ce-text ce-plain" : "ce-text markdown-rendered",
        });
        if (plain) renderErrorsInText(d, n.text.replace(/^\n+|\s+$/g, ""));
        else await this.renderMd(markErrors(n.text), d, path);
        continue;
      }
      const imp = n.type === "import";
      const label = imp ? "⤵ " + n.ref : "<" + n.tag + (n.attrs ? " " + n.attrs : "") + ">";

      if (
        imp &&
        this.settings.inlineMax > 0 &&
        n.children.length === 1 &&
        n.children[0].type === "text"
      ) {
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

  private codeFence(text: string, language: string) {
    const ticks = "`".repeat(
      text.split(/[^`]+/).reduce((n, run) => Math.max(n, run.length + 1), 3),
    );
    return ticks + language + "\n" + text + (text.endsWith("\n") ? "" : "\n") + ticks;
  }

  async renderBlockPreview(
    raw: string,
    language: string,
    path: string,
    box: HTMLElement,
    owner: Component,
  ) {
    const kind = blockKind(language);
    const treeView =
      kind === "ce" || (this.settings.viewTree && (kind === "markdown" || kind === "xml"));
    const expanded = applyArgs(await this.expand(raw, path, [], false, raw), [], false);
    box.classList.toggle("ce-has-error", hasErrors(expanded));
    if (treeView) {
      const marked = applyArgs(await this.expand(raw, path, [], true, raw), [], false);
      const tree = parseTree(marked);
      if (hasStructure(tree)) {
        await this.renderTree(
          tree.children,
          box,
          path,
          kind === "xml" && this.settings.xmlPlain,
          0,
        );
        return;
      }
    }
    const markdown = ["ce", "markdown", "xml", "plain"].includes(kind)
      ? markErrors(expanded)
      : this.codeFence(expanded, language);
    await this.renderMd(markdown, box, path, owner);
  }

  async postProcess(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    if (el.closest("[data-ce-rendered]")) return;
    const path = ctx.sourcePath;
    for (const pre of el.matches?.("pre") ? [el] : el.querySelectorAll("pre")) {
      const code = pre.querySelector("code");
      if (!code || pre.dataset.ce) continue;
      const raw = code.textContent ?? "";
      const lang =
        (pre.className + " " + code.className).match(/language-([\w+#.-]+)/i)?.[1]?.toLowerCase() ??
        "";
      const kind = blockKind(lang);
      const showActions = selectedKinds(this.settings.blockActionKinds).has(kind);
      const autoView = kind === "ce";
      if (!showActions && !autoView && !hasEmbed(raw)) continue;
      pre.dataset.ce = "1";
      const expanded = hasEmbed(raw)
        ? applyArgs(await this.expand(raw, path, [], false, raw), [], false)
        : raw;

      if (!autoView && expanded !== raw) {
        const holder = createDiv();
        holder.dataset.ceRendered = "1";
        const owner = new MarkdownRenderChild(pre);
        ctx.addChild(owner);
        await this.renderMd(this.codeFence(expanded, lang), holder, path, owner);
        const rendered = holder.querySelector("pre code");
        if (rendered) code.replaceChildren(...rendered.childNodes);
        else code.textContent = expanded;
      }
      let box: HTMLElement | null = null;
      const owner = new MarkdownRenderChild(pre);
      ctx.addChild(owner);
      const togglePreview = async () => {
        if (box) {
          box.remove();
          box = null;
          code.classList.remove("ce-hidden");
        } else {
          box = pre.createDiv({ cls: "ce-rendered markdown-rendered" });
          box.dataset.ceRendered = "1";
          await this.renderBlockPreview(raw, lang, path, box, owner);
          code.classList.add("ce-hidden");
        }
        pre
          .querySelector('button[data-action="view"]')
          ?.setAttribute("aria-pressed", String(!!box));
      };
      pre.classList.add("ce-pre");
      if (showActions) {
        const bar = actionBar(pre, "ce-bar", async (action) => {
          if (action === "actionSettings") return this.openActionSettings(kind);
          if (action === "view") return togglePreview();
          if (action === "copy") return this.actions.copyBlock(raw.replace(/\r?\n$/, ""), path);
        });
        pre.prepend(bar);
      }
      if (autoView) await togglePreview();
    }
    await this.processEmbeds(el, path, ctx);
    this.processLinks(el, path);
  }

  async renderMarkdownRef(
    el: HTMLElement,
    ref: string,
    path: string,
    ctx?: MarkdownPostProcessorContext,
  ) {
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
      const md = await this.resolve(ref, path, [], false, null);
      el.classList.toggle("ce-has-error", hasErrors(md));
      if (systemKey(ref)) el.setText(md);
      else await this.renderEmbedMarkdown(md, el, path, owner);
    } catch (error) {
      renderErrorsInText(el, formatError(errorMessage(error)));
    }
  }

  async restoreLocalTagEmbeds(root: HTMLElement, path: string, ctx: MarkdownPostProcessorContext) {
    // Markdown treats <bi> inside ![<<bi>>] as inline HTML. After sanitization
    // the name can be missing and the brackets can span several text nodes.
    const lost = /!\[(?:<>)?\](?![[(])/g;
    if (!ctx?.getSectionInfo || !root.textContent.match(lost)) return;
    const section = ctx.getSectionInfo(root);
    if (!section) return;
    const sourceLines = section.text.split("\n");
    const lines =
      sourceLines.length > section.lineEnd - section.lineStart + 1 &&
      section.lineEnd < sourceLines.length
        ? sourceLines.slice(section.lineStart, section.lineEnd + 1)
        : sourceLines;
    const fence = fenceAware(lines);
    const originals = new Map<string, string[]>();
    for (const [index, line] of lines.entries()) {
      if (fence[index]) continue;
      const prose = line.replace(/(`+).*?\1/g, "");
      for (const match of prose.matchAll(REF_RE())) {
        if (match.groups!.esc) continue;
        const ref = match.groups!.ref;
        if (!/^(?:<[\w:.-]+>|<<[\w:.-]+>>)$/.test(ref)) continue;
        const projected = match[0].replace(/<[\w:.-]+>/, "");
        if (!originals.has(projected)) originals.set(projected, []);
        originals.get(projected)!.push(ref);
      }
    }

    const ranges = new Map<string, Range[]>();
    const document = root.ownerDocument;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let nodes: Text[] = [],
      block: Element | undefined;
    const flush = () => {
      const text = nodes.map((node) => node.data).join("");
      for (const match of text.matchAll(lost)) {
        if (!originals.has(match[0])) continue;
        const range = document.createRange();
        let offset = 0;
        for (const node of nodes) {
          const end = offset + node.length;
          if (match.index >= offset && match.index < end)
            range.setStart(node, match.index - offset);
          const finish = match.index + match[0].length;
          if (finish > offset && finish <= end) {
            range.setEnd(node, finish - offset);
            break;
          }
          offset = end;
        }
        if (!ranges.has(match[0])) ranges.set(match[0], []);
        ranges.get(match[0])!.push(range);
      }
      nodes = [];
    };
    for (let node; (node = walker.nextNode());) {
      const parent = node.parentElement;
      if (!parent) continue;
      const container = parent.closest("p, li, td, th, h1, h2, h3, h4, h5, h6") || root;
      if (container !== block) flush();
      block = container;
      if (parent.closest("pre, code, a, .internal-embed, [data-ce-rendered]")) flush();
      else nodes.push(node as Text);
    }
    flush();
    for (const [projected, matches] of ranges) {
      const refs = originals.get(projected);
      if (!refs || refs.length !== matches.length) continue;
      for (let i = matches.length - 1; i >= 0; i--) {
        const host = createSpan();
        matches[i].deleteContents();
        matches[i].insertNode(host);
        await this.renderMarkdownRef(host, refs[i], path, ctx);
      }
    }
  }

  async processEmbeds(root: HTMLElement, path: string, ctx: MarkdownPostProcessorContext) {
    if (root.closest("[data-ce-rendered]")) return;
    await this.restoreLocalTagEmbeds(root, path, ctx);

    // Custom references can survive Markdown rendering as plain text nodes.
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        REF_RE().test(node.nodeValue ?? "") &&
        !node.parentElement?.closest("pre, a, .internal-embed, [data-ce-rendered]")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.instanceOf(Text)) nodes.push(node);
    }
    for (const textNode of nodes) {
      const text = textNode.data,
        re = REF_RE(),
        frag = createFragment();
      const pending: [HTMLElement, string][] = [];
      const inlineCode = !!textNode.parentElement?.closest("code");
      let last = 0,
        m;
      while ((m = re.exec(text)) !== null) {
        if (m.groups!.esc || (inlineCode && !isTagReference(m.groups!.ref))) continue;
        frag.append(root.ownerDocument.createTextNode(text.slice(last, m.index)));
        const host = createSpan();
        frag.append(host);
        pending.push([host, m.groups!.ref]);
        last = re.lastIndex;
      }
      if (!pending.length) continue;
      frag.append(root.ownerDocument.createTextNode(text.slice(last)));
      textNode.replaceWith(frag);
      for (const [host, ref] of pending) {
        if (inlineCode || systemKey(ref)) {
          host.dataset.ceRendered = "1";
          host.setText(await this.resolve(ref, path));
        } else await this.renderMarkdownRef(host, ref, path, ctx);
      }
    }
  }

  processLinks(root: HTMLElement, path: string) {
    if (root.closest("[data-ce-rendered]")) return;
    for (const a of root.querySelectorAll<HTMLAnchorElement>("a.internal-link")) {
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
        this.goToRange(tgt, p.range).catch(console.error);
      });
    }
  }

  onClick(e: MouseEvent) {
    const target = e.targetNode;
    if (!target?.instanceOf(Element)) return;
    const el = target.closest<HTMLElement>(".ce-embed");
    if (!el) return;
    if (target.closest("a")) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      const f = this.app.vault.getAbstractFileByPath(el.dataset.cePath ?? "");
      if (isVaultFile(f)) this.app.workspace.getLeaf(true).openFile(f).catch(console.error);
    }
  }

  setupRename() {
    const ws = this.app.workspace,
      v = this.app.vault;

    this.registerEvent(
      v.on("rename", (f, oldPath) => {
        if (!isVaultFile(f) || f.extension !== "md") return;
        const sn = this.renameSnapshots.get(oldPath);
        if (sn) {
          this.renameSnapshots.delete(oldPath);
          this.renameSnapshots.set(f.path, sn);
        }
        if (!this.forceRenameUpdate && !this.settings.autoRenameFile) return;
        this.renameFileRefs(f, oldPath).catch((e) => console.error("code-embed rename", e));
      }),
    );
    this.registerEvent(
      v.on("delete", (f) => {
        this.renameSnapshots.delete(f.path);
      }),
    );
    this.registerEvent(v.on("modify", (f) => this.scheduleRenameScan(f)));
    this.registerEvent(
      ws.on("file-open", (f) => {
        if (f && f.extension === "md") this.snapshot(f, false).catch(console.error);
      }),
    );
    ws.onLayoutReady(() => {
      const f = ws.getActiveFile();
      if (f && f.extension === "md") this.snapshot(f, false).catch(console.error);
    });

    this.addCommand({
      id: "rename-file",
      name: t("cmdRenameNote"),
      checkCallback: (chk) => {
        const f = ws.getActiveFile();
        if (!isVaultFile(f) || f.extension !== "md") return false;
        if (!chk) this.cmdRenameFile(f).catch(console.error);
        return true;
      },
    });
    this.addCommand({
      id: "rename-tag",
      name: t("cmdRenameTag"),
      checkCallback: (chk) => {
        const f = ws.getActiveFile();
        if (!isVaultFile(f) || f.extension !== "md") return false;
        if (!chk) this.cmdRenameTag(f).catch(console.error);
        return true;
      },
    });
    this.addCommand({
      id: "rename-section",
      name: t("cmdRenameSection"),
      checkCallback: (chk) => {
        const f = ws.getActiveFile();
        if (!isVaultFile(f) || f.extension !== "md") return false;
        if (!chk) this.cmdRenameSection(f).catch(console.error);
        return true;
      },
    });
    this.addCommand({
      id: "rename-at-cursor",
      name: t("cmdRenameTarget"),
      editorCheckCallback: (chk, editor, view) => {
        if (!view.file || !this.refAtCursor(editor)) return false;
        if (!chk) this.cmdRenameAtCursor(editor, view.file).catch(console.error);
        return true;
      },
    });

    this.registerEvent(
      ws.on("file-menu", (menu, f) => {
        if (!isVaultFile(f) || f.extension !== "md") return;
        menu.addItem((i) =>
          i
            .setTitle(t("cmdRenameNote"))
            .setIcon("pencil")
            .onClick(() => this.cmdRenameFile(f)),
        );
      }),
    );
    this.registerEvent(
      ws.on("editor-menu", (menu, editor, view) => {
        const file = view.file;
        if (!file) return;
        if (this.refAtCursor(editor)) {
          menu.addItem((i) =>
            i
              .setTitle(t("cmdRenameTarget"))
              .setIcon("pencil")
              .onClick(() => this.cmdRenameAtCursor(editor, file)),
          );
        }
        const tag = this.tagAtCursor(editor);
        if (tag) {
          menu.addItem((i) =>
            i
              .setTitle(t("renameTagAction") + " <" + tag + ">…")
              .setIcon("pencil")
              .onClick(() => this.cmdRenameTag(file, tag)),
          );
        }
        const h = HEADING_RE.exec(editor.getLine(editor.getCursor().line).replace(/\r$/, ""));
        if (h && h[2].trim()) {
          menu.addItem((i) =>
            i
              .setTitle(t("cmdRenameSection"))
              .setIcon("pencil")
              .onClick(() => this.cmdRenameSection(file, editor.getCursor().line)),
          );
        }
      }),
    );
  }

  teardownRename() {
    for (const t of this.renameScanTimers.values()) window.clearTimeout(t);
    this.renameScanTimers.clear();
  }

  // Validate after the outermost rename has updated both definitions and references.
  async withRenameMute(fn: () => Promise<void>) {
    this.activeRenameCount++;
    try {
      return await fn();
    } finally {
      this.activeRenameCount--;
      if (!this.activeRenameCount) this.scheduleValidate();
    }
  }

  async snapshot(file: TFile, force: boolean) {
    if (!force && this.renameSnapshots.has(file.path)) return;
    const text = await this.app.vault.read(file);
    const heads = new Map<string, string>();
    for (const h of headingList(text)) if (!heads.has(h.norm)) heads.set(h.norm, h.raw);
    this.renameSnapshots.set(file.path, {
      tags: new Set(tagsOf(text)),
      heads,
      pendTag: 0,
      pendHead: 0,
    });
  }

  scheduleRenameScan(file: TAbstractFile) {
    if (!isVaultFile(file) || file.extension !== "md") return;
    const s = this.settings;
    if (!s.autoRenameTag && !s.autoRenameSection) {
      this.renameSnapshots.delete(file.path);
      return;
    }
    const path = file.path;
    window.clearTimeout(this.renameScanTimers.get(path));
    this.renameScanTimers.set(
      path,
      window.setTimeout(() => {
        this.renameScanTimers.delete(path);
        this.scanningRenames++;
        this.scanRename(file)
          .catch((error: unknown) => console.error("code-embed rename", error))
          .finally(() => {
            this.scanningRenames--;
            this.scheduleValidate();
          });
      }, 1500),
    );
  }

  detectRename(
    prev: Set<string>,
    cur: Set<string>,
    st: RenameSnapshot,
    key: "pendTag" | "pendHead",
  ) {
    const removed = [...prev].filter((k) => !cur.has(k));
    const added = [...cur].filter((k) => !prev.has(k));
    if (!removed.length && !added.length) {
      st[key] = 0;
      return { next: cur };
    }
    if (!added.length) {
      if (!st[key]) st[key] = Date.now();
      return { next: prev };
    }
    const fresh = !st[key] || Date.now() - st[key] < 120000;
    st[key] = 0;
    if (removed.length === 1 && added.length === 1 && fresh)
      return { next: cur, ren: [removed[0], added[0]] };
    return { next: cur };
  }

  async scanRename(file: TFile) {
    if (this.activeRenameCount) {
      this.renameSnapshots.delete(file.path);
      return;
    }
    const prev = this.renameSnapshots.get(file.path);
    if (!prev) {
      await this.snapshot(file, true);
      return;
    }
    const text = await this.app.vault.read(file);
    const heads = new Map<string, string>();
    for (const h of headingList(text)) if (!heads.has(h.norm)) heads.set(h.norm, h.raw);
    const tags = new Set(tagsOf(text));
    const tr = this.detectRename(new Set(prev.tags), tags, prev, "pendTag");
    const hr = this.detectRename(
      new Set(prev.heads.keys()),
      new Set(heads.keys()),
      prev,
      "pendHead",
    );
    prev.tags = tr.next;
    const nextHeads = new Map<string, string>();
    for (const k of hr.next) nextHeads.set(k, heads.get(k) ?? prev.heads.get(k)!);
    prev.heads = nextHeads;
    if (tr.ren && this.settings.autoRenameTag) {
      await this.renameTagRefs(file, tr.ren[0], tr.ren[1]);
    }
    if (hr.ren && this.settings.autoRenameSection) {
      const [from, to] = hr.ren,
        title = heads.get(to);
      if (!title || badSectionName(title)) new Notice(t("invalidTitle"));
      else await this.renameSectionRefs(file, from, title);
    }
  }

  async rewriteAll(mapper: (ref: string, fenced: boolean, file: TFile) => string | null) {
    let files = 0,
      refs = 0;
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (isMarker(f.name)) continue;
      const map = (ref: string, fenced: boolean) => mapper(ref, fenced, f);
      const active = this.app.workspace.getActiveViewOfType(MarkdownView);
      let n = 0;
      if (active?.file === f && active.getMode() === "source") {
        const editor = active.editor;
        const result = rewriteText(editor.getValue(), map);
        if (result.count) editor.transaction({ changes: result.changes });
        n = result.count;
      } else {
        const raw = await this.app.vault.cachedRead(f);
        if (!hasEmbed(raw) || !rewriteText(raw, map).count) continue;
        await this.app.vault.process(f, (current) => {
          const result = rewriteText(current, map);
          n = result.count;
          return result.text;
        });
      }
      if (n) {
        this.cache.delete(f.path);
        this.rawReferences.delete(f.path);
        this.resolvedReferences.delete(f.path);
        files++;
        refs += n;
      }
    }
    return { files, refs };
  }

  notifyRename(what: string, res: { files: number; refs: number }) {
    if (this.settings.renameNotice && res.refs) {
      new Notice("Code Embed: " + what + " — " + t("updated", res));
    }
  }

  nameSpan(ref: string, p: ReturnType<typeof parseRef>) {
    const i = ref.indexOf(p.name);
    return i < 0 ? null : [i, i + p.name.length];
  }

  async renameFileRefs(file: TFile, oldPath: string) {
    await this.withRenameMute(async () => {
      if (isMarker(file.name) || isMarker(oldPath.split("/").pop())) return;
      const index = this.packages(),
        oldRoot = index.root(oldPath);
      if (index.root(file.path) !== oldRoot) return;
      const oldName = oldPath.split("/").pop()!;
      const oldFile = {
        path: oldPath,
        name: oldName,
        basename: oldName.replace(/\.md$/i, ""),
        extension: "md",
      };
      const previous = new PackageIndex<IndexedFile>(
        this.app.vault.getFiles().map((f) => (f === file ? oldFile : f)),
        this.hiddenRoots,
      );
      const res = await this.rewriteAll((ref, inFence, src) => {
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
      this.notifyRename(oldPath + " → " + file.path, res);
    });
  }

  async cmdRenameFile(file: TFile) {
    const name = await askText(this.app, t("newNoteName"), file.basename, (v) =>
      !v
        ? t("emptyName")
        : /[\\/:*?"<>|#^[\]]/.test(v)
          ? t("badChars") + ': \\ / : * ? " < > | # ^ [ ]'
          : null,
    );
    if (!name || name === file.basename) return;
    const dir = file.parent && file.parent.path !== "/" ? file.parent.path + "/" : "";
    const target = dir + name + "." + file.extension;
    if (this.app.vault.getAbstractFileByPath(target)) {
      new Notice(t("exists") + ": " + target);
      return;
    }
    this.forceRenameUpdate = true;
    try {
      await this.app.fileManager.renameFile(file, target);
    } finally {
      window.setTimeout(() => {
        this.forceRenameUpdate = false;
      }, 0);
    }
  }

  async renameTagRefs(file: TFile, oldTag: string, newTag: string) {
    await this.withRenameMute(async () => {
      const re = new RegExp("^(\\s*:\\s*<<?)" + escapeRegExp(oldTag) + "(>>?)");
      const res = await this.rewriteAll((ref, inFence, src) => {
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
      this.notifyRename("<" + oldTag + "> → <" + newTag + ">", res);
    });
  }

  async cmdRenameTag(file: TFile, preset?: string) {
    const text = await this.app.vault.read(file);
    const tags = tagsOf(text);
    if (!tags.length) {
      new Notice(t("noTags"));
      return;
    }
    let oldTag = preset;
    if (!oldTag) {
      const it = await pickOne(
        this.app,
        t("pickTag"),
        tags.map((t) => ({ label: "<" + t + ">", value: t })),
      );
      if (!it) return;
      oldTag = it.value;
    }
    const act = await pickOne(this.app, t("actionFor", { name: "<" + oldTag + ">" }), [
      { label: t("renameTagAction"), value: "rename" },
      { label: t("toHeading"), value: "heading" },
    ]);
    if (!act) return;
    if (act.value === "heading") {
      await this.convertTagToHeading(file, oldTag);
      return;
    }

    const nt = await askText(this.app, t("newTag") + " <" + oldTag + ">", oldTag, (v) =>
      !TAG_NAME_PATTERN.test(v) ? t("tagCharacters") : null,
    );
    if (!nt || nt === oldTag) return;
    await this.withRenameMute(async () => {
      const rx = new RegExp("(!\\[\\[[^\\]\\n]*\\]\\])|<(\\/?)" + escapeRegExp(oldTag) + ">", "g");
      await this.app.vault.process(file, (cur) =>
        cur.replace(rx, (m, refm, sl) => (refm ? m : "<" + sl + nt + ">")),
      );
      await this.renameTagRefs(file, oldTag, nt);
      await this.snapshot(file, true);
    });
  }

  async convertTagToHeading(file: TFile, oldTag: string) {
    const lv = await pickOne(
      this.app,
      t("headingLevel"),
      [1, 2, 3, 4, 5].map((n) => ({ label: "#".repeat(n) + "  (H" + n + ")", value: n })),
    );
    if (!lv) return;
    const title = await askText(
      this.app,
      t("headingTitle"),
      oldTag.replace(/[-_.:]+/g, " ").trim() || oldTag,
      (v) => (badSectionName(v) ? (!v ? t("emptyName") : t("badChars") + ": # ( ^ | [ ]") : null),
    );
    if (title == null) return;
    await this.withRenameMute(async () => {
      let ok = false;
      await this.app.vault.process(file, (cur) => {
        const r = tagToHeading(cur, oldTag, lv.value, title);
        ok = r.changed;
        return r.text;
      });
      if (!ok) {
        new Notice(t("missingTag", { tag: "<" + oldTag + ">…</" + oldTag + ">" }));
        return;
      }
      const res = await this.rewriteAll((ref, inFence, src) => {
        const p = parseRef(ref);
        const tgt = this.findFile(p.name, src.path);
        if (!tgt || tgt.path !== file.path) return null;
        const tm = /^(<<?)([\w:.-]+)(>>?)$/.exec(p.range || "");
        if (!tm || tm[2] !== oldTag) return null;
        const sp = this.nameSpan(ref, p);
        if (!sp) return null;
        const inner = tm[1].length === 2 || tm[3].length === 2 || p.range.startsWith("<<");
        const argS = this.formatArgumentSuffix(p);
        return ref.slice(0, sp[1]) + ":" + (inner ? "##" : "#") + title + argS;
      });
      this.notifyRename("<" + oldTag + "> → " + title, res);
      await this.snapshot(file, true);
    });
  }

  formatArgumentSuffix(p: ReturnType<typeof parseRef>) {
    if (!p.args) return "";
    if (!p.args.length) return "()";
    return "(" + p.args.map((a) => (/[",\n]/.test(a) ? '"' + a + '"' : a)).join(", ") + ")";
  }

  async renameSectionRefs(file: TFile, oldNorm: string, newTitle: string) {
    await this.withRenameMute(async () => {
      const res = await this.rewriteAll((ref, inFence, src) => {
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
          if (normalizeTitle(s) !== oldNorm) return s;
          hit = true;
          return s.replace(/^(\s*)([\s\S]*?)(\s*)$/, (_, a, b, c) => a + newTitle + c);
        });
        if (!hit) return null;
        return ref.slice(0, sp[1]) + m[1] + segs.join("#") + m[3];
      });
      this.notifyRename(t("section") + " → " + newTitle, res);
    });
  }

  async cmdRenameSection(file: TFile, line?: number) {
    const text = await this.app.vault.read(file);
    const list = headingList(text);

    let h = line != null ? list.find((x) => x.line === line) : null;
    if (!h) {
      const it = await pickOne(
        this.app,
        t("pickSection"),
        list.map((x) => ({
          label: "L" + (x.line + 1) + " " + "#".repeat(x.level) + " " + x.raw,
          value: x,
        })),
      );
      if (!it) return;
      h = it.value;
    }
    const act = await pickOne(this.app, t("actionFor", { name: h.raw }), [
      { label: t("renameSectionAction"), value: "rename" },
      { label: t("toTag"), value: "tag" },
    ]);
    if (!act) return;
    if (act.value === "tag") {
      await this.convertSectionToTag(file, h);
      return;
    }

    const nt = await askText(this.app, t("newSection"), h.raw, (v) =>
      badSectionName(v) ? (!v ? t("emptyName") : t("badChars") + ": # ( ^ | [ ]") : null,
    );
    if (!nt || nt === h.raw) return;
    await this.withRenameMute(async () => {
      const isFirst = list.find((x) => x.norm === h.norm)?.line === h.line;
      let ok = true;
      await this.app.vault.process(file, (cur) => {
        const lines = cur.split("\n"),
          l = lines[h.line] ?? "";
        const hm = HEADING_RE.exec(l.replace(/\r$/, ""));
        if (!hm || normalizeTitle(hm[2]) !== h.norm) {
          ok = false;
          return cur;
        }
        const idx = l.indexOf(hm[2], l.indexOf("#") + hm[1].length);
        lines[h.line] = l.slice(0, idx) + nt + l.slice(idx + hm[2].length);
        return lines.join("\n");
      });
      if (!ok) {
        new Notice(t("headingChanged"));
        return;
      }
      if (isFirst) await this.renameSectionRefs(file, h.norm, nt);
      else new Notice(t("duplicateHeading"));
      await this.snapshot(file, true);
    });
  }

  async convertSectionToTag(file: TFile, h: ReturnType<typeof headingList>[number]) {
    const text = await this.app.vault.read(file);
    const list = headingList(text);
    const isFirst = list.find((x) => x.norm === h.norm)?.line === h.line;
    if (!isFirst) {
      new Notice(t("convertFirst"));
      return;
    }
    const tag = await askText(
      this.app,
      t("sectionToTag", { name: h.raw }),
      h.raw
        .replace(/[*_`]/g, "")
        .replace(/[^\w:.\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "-") || "section",
      (v) => (!TAG_NAME_PATTERN.test(v) ? t("tagCharacters") : null),
    );
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
          if (hm && normalizeTitle(hm[2]) === h.norm) {
            idx = i;
            break;
          }
        }
        if (idx < 0) return cur;
        const r = headingToTag(cur, idx, tag);
        ok = r.changed;
        return r.text;
      });
      if (!ok) {
        new Notice(t("missingHeading"));
        return;
      }
      let skipped = 0;
      const res = await this.rewriteAll((ref, inFence, src) => {
        const p = parseRef(ref);
        const tgt = this.findFile(p.name, src.path);
        if (!tgt || tgt.path !== file.path) return null;
        if (!p.range || !p.range.startsWith("#")) return null;
        const titles = p.range
          .replace(/^#+\s*/, "")
          .split("#")
          .map((s) => s.trim())
          .filter(Boolean);
        if (titles.length !== 1) {
          skipped++;
          return null;
        }
        if (normalizeTitle(titles[0]) !== h.norm) return null;
        const inner = p.range.startsWith("##");
        const sp = this.nameSpan(ref, p);
        if (!sp) return null;
        return (
          ref.slice(0, sp[1]) +
          ":" +
          (inner ? "<<" + tag + ">>" : "<" + tag + ">") +
          this.formatArgumentSuffix(p)
        );
      });
      this.notifyRename(h.raw + " → <" + tag + ">", res);
      if (skipped) new Notice(t("skippedNested", { count: skipped }));
      await this.snapshot(file, true);
    });
  }

  refAtCursor(editor: Editor) {
    const cur = editor.getCursor(),
      text = editor.getLine(cur.line),
      re = REF_RE();
    let m;
    while ((m = re.exec(text)) !== null) {
      const from = m.index,
        to = from + m[0].length;
      if (!m.groups!.esc && cur.ch >= from && cur.ch <= to) return { ref: m.groups!.ref, from, to };
    }
    return null;
  }

  tagAtCursor(editor: Editor) {
    const off = editor.posToOffset(editor.getCursor());
    const text = editor.getValue();
    const pairs = [],
      stack = [];
    const re = /<(\/?)([A-Za-z_][\w:.-]*)>/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!m[1] && m.index > 0 && text[m.index - 1] === "<") continue;
      const lineStart = text.lastIndexOf("\n", m.index) + 1;
      if (/^\s*(```|~~~)/.test(text.slice(lineStart, m.index))) continue;
      if (!m[1]) stack.push({ tag: m[2], from: m.index });
      else {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k].tag === m[2]) {
            pairs.push({ tag: m[2], from: stack[k].from, to: re.lastIndex });
            stack.length = k;
            break;
          }
        }
      }
    }
    let best = null;
    for (const pr of pairs) {
      if (off >= pr.from && off <= pr.to && (!best || pr.to - pr.from < best.to - best.from))
        best = pr;
    }
    return best ? best.tag : null;
  }

  async cmdRenameAtCursor(editor: Editor, srcFile: TFile) {
    const at = this.refAtCursor(editor);
    if (!at) {
      new Notice(t("missingCursor"));
      return;
    }
    const p = parseRef(at.ref);
    const target = this.findFile(p.name, srcFile.path);
    if (!target || target.extension !== "md") {
      new Notice(t("missingTarget"));
      return;
    }
    const opts = [];
    if (p.name && p.name !== ".")
      opts.push({ label: t("file") + ": " + target.basename, kind: "file" });
    else
      opts.push({
        label: t("file") + ": " + target.basename + " (" + t("currentNote") + ")",
        kind: "file",
      });
    const tm = /^<([<]?)([\w:.-]+)>[>]?$/.exec(p.range || "");
    if (tm) opts.push({ label: t("tag") + ": <" + tm[2] + ">", kind: "tag", tag: tm[2] });
    if (p.range && p.range.startsWith("#")) {
      const m = /^#+\s*([^(|]*)/.exec(p.range);
      const segs = (m ? m[1] : "")
        .split("#")
        .map((s) => s.trim())
        .filter(Boolean);
      const hs = headingList(await this.app.vault.read(target));
      for (const s of segs) {
        const h = hs.find((x) => x.norm === normalizeTitle(s));
        if (h) opts.push({ label: t("section") + ": " + s, kind: "section", line: h.line });
      }
    }
    const it =
      opts.length === 1
        ? { value: opts[0] }
        : await pickOne(
            this.app,
            t("chooseTarget"),
            opts.map((o) => ({ label: o.label, value: o })),
          );
    if (!it) return;
    const o = it.value;
    if (o.kind === "file") await this.cmdRenameFile(target);
    else if (o.kind === "tag") await this.cmdRenameTag(target, o.tag);
    else await this.cmdRenameSection(target, o.line);
  }
}

export default CodeEmbedPlugin;
