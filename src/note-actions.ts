import {
  setIcon,
  Component,
  MarkdownView,
  Modal,
  Notice,
  Platform,
  type TFile,
  type WorkspaceLeaf,
} from "obsidian";
import type CodeEmbedPlugin from "./main";
import {
  noteReferences,
  blockKind,
  expandBlock,
  expandNote,
  findFences,
  selectedKinds,
  type ResolveReference,
} from "./action-markdown";
import { snapshotName } from "./snapshot-name";
import { applyArgs } from "./fragments";
import { t } from "./locale";

const icons = { copy: "copy", view: "👁️", permanent: "🔒", actionSettings: "⚙️" } as const;
export type Action = keyof typeof icons;
export interface BlockTarget {
  line: number;
  language: string;
  body: string;
}

export function actionBar(
  parent: HTMLElement,
  cls: string,
  run: (action: Action) => Promise<void>,
  noteHasReferences?: boolean,
) {
  const bar = parent.createSpan({ cls });
  for (const action of ["copy", "view", "permanent", "actionSettings"] as const) {
    if (action === "permanent" && noteHasReferences === undefined) continue;
    const label = t(action === "permanent" ? "saveSnapshot" : action);
    const button = bar.createEl("button", {
      attr: { type: "button", "data-action": action, "aria-label": label, title: label },
    });
    if (action === "copy") setIcon(button, "copy");
    else button.createSpan({ text: icons[action], attr: { "aria-hidden": "true" } });
    button.createSpan({
      cls: "ce-action-label",
      text: t(
        (
          {
            copy: "copyLabel",
            view: "previewLabel",
            permanent: "freezeLabel",
            actionSettings: "settingsLabel",
          } as const
        )[action],
      ),
    });
    button.disabled = action === "permanent" && !noteHasReferences;
    let busy = false;
    button.onmousedown = (event) => event.preventDefault();
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;
      busy = true;
      run(action)
        .catch(
          (error: unknown) => new Notice(error instanceof Error ? error.message : String(error)),
        )
        .finally(() => {
          busy = false;
        });
    };
  }
  return bar;
}

export class NoteActions {
  private readonly partners = new WeakMap<WorkspaceLeaf, WorkspaceLeaf>();

  private readonly reservedPaths = new Set<string>();

  constructor(private readonly plugin: CodeEmbedPlugin) {}

  private get workspace() {
    return this.plugin.app.workspace;
  }

  private resolver(path: string, source?: string): ResolveReference {
    const snapshots = new Map<string, Promise<string>>();
    return (ref, local) =>
      this.plugin.resolve(ref, path, [], false, local, undefined, {
        failOnError: true,
        read: (file) => {
          let pending = snapshots.get(file.path);
          if (!pending) {
            pending = this.plugin.app.vault.read(file);
            snapshots.set(file.path, pending);
          }
          return pending;
        },
        source: source === undefined ? undefined : { path, text: source },
      });
  }

  async copyBlock(body: string, path: string, source?: string) {
    const text = await expandBlock(body, this.resolver(path, source));
    await navigator.clipboard.writeText(applyArgs(text, [], false));
  }

  async showBlock(target: BlockTarget, path: string) {
    const modal = new Modal(this.plugin.app);
    modal.titleEl.setText(t("view"));
    modal.contentEl.dataset.ceRendered = "1";
    modal.contentEl.addClass("markdown-rendered");
    modal.open();
    const owner = this.plugin.addChild(new Component());
    modal.onClose = () => {
      this.plugin.removeChild(owner);
    };
    await this.plugin.renderBlockPreview(
      target.body,
      target.language,
      path,
      modal.contentEl,
      owner,
    );
  }

  mountNoteBars() {
    for (const leaf of this.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file) continue;
      const hasRefs = !noteReferences(view.getViewData()).next().done;
      const mobile = Platform.isMobile;
      const host = mobile
        ? view.contentEl.querySelector<HTMLElement>(
            view.getMode() === "source"
              ? ".markdown-source-view .cm-sizer"
              : ".markdown-reading-view .markdown-preview-sizer > .mod-header",
          )
        : view.contentEl;
      if (!host) continue;
      let bar = view.contentEl.querySelector<HTMLElement>(".ce-note-actions");
      if (!bar || bar.parentElement !== host) {
        bar ??= actionBar(host, "ce-note-actions", (action) => this.run(view, action), hasRefs);
        host.prepend(bar);
      }
      const lock = bar.querySelector<HTMLButtonElement>("[data-action=permanent]");
      if (lock) lock.disabled = !hasRefs;
      this.updatePackageAction(bar, view.file);
    }
  }

  private updatePackageAction(bar: HTMLElement, file: TFile) {
    const root = this.plugin.packages().root(file.path);
    let button = bar.querySelector<HTMLButtonElement>(".ce-note-root");
    if (root === null) {
      button?.remove();
      return;
    }
    if (!button) {
      button = bar.createEl("button", { cls: "ce-note-root", attr: { type: "button" } });
      button.createSpan({ text: "📝", attr: { "aria-hidden": "true" } });
      button.createSpan({ cls: "ce-action-label" });
      bar.prepend(button);
    }
    const name = root.split("/").pop() || this.plugin.app.vault.getName();
    const label = t("editDescription");
    if (button.lastElementChild?.textContent !== label) button.lastElementChild?.setText(label);
    button.title = t("editDescription") + " · " + (root || name);
    button.setAttribute("aria-label", button.title);
    button.onclick = () => {
      this.plugin.editMarker(root).catch((error: unknown) => new Notice(String(error)));
    };
  }

  async run(view: MarkdownView, action: Action) {
    const file = view.file;
    if (!file) return;
    if (action === "actionSettings") return this.plugin.openActionSettings();
    if (action === "view") return this.split(view);

    const other = this.workspace
      .getLeavesOfType("markdown")
      .map((leaf) => leaf.view)
      .find(
        (candidate): candidate is MarkdownView =>
          candidate instanceof MarkdownView &&
          candidate.file === file &&
          candidate.getMode() === "source",
      );
    const sourceView = view.getMode() === "source" ? view : other;
    const editor = sourceView?.editor;
    const source = editor ? editor.getValue() : await this.plugin.app.vault.read(file);
    await this.runDocument(
      action,
      file.path,
      source,
      view.leaf,
      () => view.file === file && (!editor || editor.getValue() === source),
    );
  }

  async runDocument(
    action: "copy" | "permanent",
    path: string,
    source: string,
    leaf: WorkspaceLeaf,
    isCurrent: () => boolean,
  ) {
    const kinds =
      action === "copy" ? selectedKinds(this.plugin.settings.blockActionKinds) : undefined;
    const expanded = await expandNote(source, this.resolver(path, source), kinds);
    if (action === "copy") return navigator.clipboard.writeText(expanded);
    if (expanded === source) return;
    if (!isCurrent()) throw new Error(t("sourceChanged"));
    const copy = await this.createSnapshot(path, expanded);
    if (isCurrent()) await leaf.openFile(copy);
  }

  async runBlock(action: Action, path: string, source: string, target: BlockTarget) {
    if (action === "actionSettings")
      return this.plugin.openActionSettings(blockKind(target.language));
    if (action === "view") return this.showBlock(target, path);
    const kinds = selectedKinds(this.plugin.settings.blockActionKinds);
    const fence = findFences(source).find((candidate) => candidate.line === target.line);
    if (
      !fence ||
      !kinds.has(blockKind(fence.language)) ||
      blockKind(fence.language) !== blockKind(target.language)
    )
      throw new Error(t("sourceChanged"));
    const body = source.slice(fence.bodyStart, fence.bodyEnd);
    const normalize = (value: string) => value.replace(/\r\n/g, "\n").replace(/\n$/, "");
    if (normalize(body) !== normalize(target.body)) throw new Error(t("sourceChanged"));
    if (action === "copy") await this.copyBlock(body.replace(/\r?\n$/, ""), path, source);
  }

  private async createSnapshot(sourcePath: string, text: string) {
    const vault = this.plugin.app.vault;
    const prefix = sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1);
    const basename = sourcePath.slice(prefix.length, -3).replace(/^\./, "");
    const day = new Date();
    for (let version = 1; ; version++) {
      const path =
        prefix + snapshotName(this.plugin.settings.snapshotTemplate, basename, day, version);
      if (this.reservedPaths.has(path) || vault.getAbstractFileByPath(path)) continue;
      this.reservedPaths.add(path);
      try {
        if (await vault.adapter.exists(path)) continue;
        return await vault.create(path, text);
      } catch (error) {
        if (!(await vault.adapter.exists(path))) throw error;
      } finally {
        this.reservedPaths.delete(path);
      }
    }
  }

  private async split(view: MarkdownView) {
    const leaf = view.leaf;
    const state = leaf.getViewState();
    const mode = view.getMode() === "source" ? "preview" : "source";
    const next = { type: "markdown", state: { ...state.state, file: view.file?.path, mode } };
    if (Platform.isPhone) {
      await leaf.setViewState(next);
      return;
    }
    const partner = this.partners.get(leaf);
    if (partner && this.workspace.getLeavesOfType("markdown").includes(partner)) {
      await partner.setViewState(next);
      this.workspace.setActiveLeaf(partner, { focus: true });
      return;
    }
    const other = this.workspace.createLeafBySplit(leaf, "vertical", mode === "source");
    const preview = mode === "preview" ? other : leaf;
    try {
      await other.setViewState(next);
      other.setGroupMember(leaf);
      this.partners.set(leaf, other);
      this.partners.set(other, leaf);
      if (preview.view instanceof MarkdownView) preview.view.previewMode.rerender(true);
    } catch (error) {
      other.detach();
      throw error;
    }
  }
}
