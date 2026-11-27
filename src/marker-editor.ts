import {
  Component,
  ItemView,
  Notice,
  Platform,
  type ViewStateResult,
  type WorkspaceLeaf,
} from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { createCodeBlockExtension, createMarkdownExtension, refresh } from "./editor";
import { noteReferences } from "./action-markdown";
import { actionBar, type Action } from "./note-actions";
import type CodeEmbedPlugin from "./main";
import { MARKER } from "./package-index";
import { t } from "./locale";

export const MARKER_EDITOR = "code-embed-marker-editor";

function markerFromState(state: unknown) {
  if (!state || typeof state !== "object" || !("path" in state) || typeof state.path !== "string")
    return;
  const parts = state.path.split("/");
  if (
    parts.pop() !== MARKER ||
    parts.some((part) => !part || part === "." || part === ".." || /[\\:]/.test(part))
  )
    return;
  return state.path;
}

// Hidden Markdown files are accessible through the adapter but have no TFile for MarkdownView.
export class MarkerEditor extends ItemView {
  private path = "";
  private saved = "";
  private editor?: EditorView;
  private bar?: HTMLElement;
  private preview?: HTMLElement;
  private previewOwner?: Component;
  private mode: "source" | "preview" = "source";
  private text = "";

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: CodeEmbedPlugin,
  ) {
    super(leaf);
  }
  private timer?: number;
  private pending = Promise.resolve();

  getViewType() {
    return MARKER_EDITOR;
  }
  getDisplayText() {
    return this.path || MARKER;
  }
  getIcon() {
    return "file-pen";
  }
  getState() {
    return { path: this.path, mode: this.mode };
  }

  async setState(state: unknown, result: ViewStateResult) {
    const path = markerFromState(state);
    if (!path) throw new Error(t("sourceChanged"));
    const mode =
      state && typeof state === "object" && "mode" in state && state.mode === "preview"
        ? "preview"
        : "source";
    if (this.path !== path || this.mode !== mode) {
      await this.flush();
      const text = await this.app.vault.adapter.read(path);
      this.clearContent();
      this.path = path;
      this.mode = mode;
      this.saved = text;
      this.text = text;
      this.contentEl.addClass("ce-marker-view");
      this.bar = actionBar(
        this.contentEl,
        "ce-note-actions",
        (action) => this.run(action),
        this.hasReferences(),
      );
      if (mode === "preview") await this.renderPreview(text);
      else this.openEditor(text);
    }
    await super.setState(state, result);
  }

  private openEditor(text: string) {
    this.editor = new EditorView({
      parent: this.contentEl,
      doc: text,
      extensions: [
        EditorState.lineSeparator.of(text.includes("\r\n") ? "\r\n" : "\n"),
        EditorView.lineWrapping,
        EditorView.editorAttributes.of({ class: "ce-marker-editor" }),
        EditorView.contentAttributes.of({
          "aria-label": this.path,
          role: "textbox",
          "aria-multiline": "true",
        }),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        createCodeBlockExtension(this.plugin, this.path),
        createMarkdownExtension(this.plugin, this.path),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          this.text = update.state.sliceDoc();
          this.updateLock();
          window.clearTimeout(this.timer);
          this.timer = window.setTimeout(() => {
            void this.flush().catch(this.report);
          }, 300);
        }),
        EditorView.domEventHandlers({
          blur: () => {
            void this.flush().catch(this.report);
          },
        }),
      ],
    });
  }

  private hasReferences() {
    return !noteReferences(this.text).next().done;
  }

  private updateLock() {
    const lock = this.bar?.querySelector<HTMLButtonElement>("[data-action=permanent]");
    if (lock) lock.disabled = !this.hasReferences();
  }

  refreshActions() {
    if (this.editor)
      this.editor.dispatch({ effects: [this.editor.scrollSnapshot(), refresh.of(null)] });
    if (this.mode === "preview") void this.renderPreview(this.text).catch(this.report);
  }

  private clearContent() {
    this.editor?.destroy();
    this.editor = undefined;
    if (this.previewOwner) this.removeChild(this.previewOwner);
    this.previewOwner = undefined;
    this.preview = undefined;
    this.contentEl.empty();
  }

  private async renderPreview(text: string) {
    this.text = text;
    this.updateLock();
    if (this.previewOwner) this.removeChild(this.previewOwner);
    this.preview?.remove();
    this.previewOwner = this.addChild(new Component());
    this.preview = this.contentEl.createDiv({ cls: "ce-marker-preview-content markdown-rendered" });
    await this.plugin.renderMd(text, this.preview, this.path, this.previewOwner);
  }

  private async run(action: Action) {
    if (action === "actionSettings") return this.plugin.openActionSettings();
    if (action === "view") {
      const mode = this.mode === "preview" ? "source" : "preview";
      await this.flush();
      if (!Platform.isPhone && mode === "source")
        return this.plugin.editMarker(this.path.slice(0, -MARKER.length).replace(/\/$/, ""));
      const workspace = this.app.workspace;
      const partner = workspace.getLeavesOfType(MARKER_EDITOR).find((leaf) => {
        const state = leaf.getViewState().state;
        return state?.path === this.path && state.mode === mode;
      });
      const next = Platform.isPhone
        ? this.leaf
        : (partner ?? workspace.createLeafBySplit(this.leaf, "vertical"));
      await next.setViewState({
        type: MARKER_EDITOR,
        state: { path: this.path, mode },
        active: true,
      });
      workspace.setActiveLeaf(next, { focus: true });
      return;
    }
    const { path, text } = this;
    await this.plugin.actions.runDocument(
      action,
      path,
      text,
      this.leaf,
      () => this.path === path && this.text === text,
    );
  }

  private report(this: void, error: unknown) {
    new Notice(error instanceof Error ? error.message : String(error));
  }

  private flush() {
    window.clearTimeout(this.timer);
    const path = this.path;
    const value = this.editor ? this.text : undefined;
    const save = async () => {
      if (value === undefined || value === this.saved) return;
      await this.app.vault.adapter.process(path, (current) => {
        if (current !== this.saved && current !== value) throw new Error(t("sourceChanged"));
        return value;
      });
      this.saved = value;
      for (const leaf of this.app.workspace.getLeavesOfType(MARKER_EDITOR)) {
        const view = leaf.view;
        if (view instanceof MarkerEditor && view.path === path && view.mode === "preview")
          void view.renderPreview(value).catch(this.report);
      }
    };
    const write = this.pending.then(save);
    this.pending = write.catch(() => {});
    return write;
  }

  async onClose() {
    await this.flush().catch(this.report);
    this.clearContent();
  }
}
