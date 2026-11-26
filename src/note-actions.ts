import {
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
  replaceFenceBody,
  selectedKinds,
  type ResolveReference,
} from "./action-markdown";
import { snapshotName } from "./snapshot-name";
import { applyArgs } from "./fragments";
import { t } from "./locale";

const icons = { copy: "📋", view: "👁️", permanent: "🔒", actionSettings: "⚙️" } as const;
export type Action = keyof typeof icons;
export interface BlockTarget {
  line: number;
  language: string;
  body: string;
}

export function actionBar(
  parent: HTMLElement,
  cls: string,
  canExpand: boolean,
  run: (action: Action) => Promise<void>,
  lockLabel: "permanent" | "saveSnapshot" = "permanent",
) {
  const bar = parent.createSpan({ cls });
  for (const action of ["copy", "view", "permanent", "actionSettings"] as const) {
    const label = t(action === "permanent" ? lockLabel : action);
    const button = bar.createEl("button", {
      text: icons[action],
      attr: { type: "button", "data-action": action, "aria-label": label, title: label },
    });
    button.disabled = action === "permanent" && !canExpand;
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
      const existing = view.contentEl.querySelector<HTMLButtonElement>(
        ":scope > .ce-note-actions [data-action=permanent]",
      );
      if (existing) existing.disabled = !hasRefs;
      else {
        const bar = actionBar(
          view.contentEl,
          "ce-note-actions",
          hasRefs,
          (action) => this.run(view, action),
          "saveSnapshot",
        );
        view.contentEl.prepend(bar);
      }
    }
  }

  viewForElement(element: HTMLElement, path: string) {
    for (const leaf of this.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (
        view instanceof MarkdownView &&
        view.file?.path === path &&
        view.containerEl.contains(element)
      )
        return view;
    }
    throw new Error(t("sourceChanged"));
  }

  async run(view: MarkdownView, action: Action, target?: BlockTarget) {
    const file = view.file;
    if (!file) return;
    if (action === "actionSettings")
      return this.plugin.openActionSettings(target ? blockKind(target.language) : undefined);
    if (action === "view") {
      if (target) await this.showBlock(target, file.path);
      else await this.split(view);
      return;
    }

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
    const resolve = this.resolver(file.path, source);
    const kinds = selectedKinds(this.plugin.settings.blockActionKinds);
    if (!target) {
      const expanded = await expandNote(source, resolve, action === "copy" ? kinds : undefined);
      if (action === "copy") return navigator.clipboard.writeText(expanded);
      if (expanded === source) return;
      if (view.file !== file || (editor && editor.getValue() !== source))
        throw new Error(t("sourceChanged"));
      const copy = await this.createSnapshot(file, expanded);
      if (view.file === file) await view.leaf.openFile(copy);
      return;
    }

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
    if (action === "copy") return this.copyBlock(body.replace(/\r?\n$/, ""), file.path, source);

    const replacement = replaceFenceBody(source, fence, await expandBlock(body, resolve));
    const { start: from, end: to } = fence;
    if (source.slice(from, to) === replacement) return;
    if (editor && sourceView) {
      if (
        sourceView.file !== file ||
        sourceView.getMode() !== "source" ||
        editor.getValue() !== source
      )
        throw new Error(t("sourceChanged"));
      editor.replaceRange(replacement, editor.offsetToPos(from), editor.offsetToPos(to));
    } else {
      await this.plugin.app.vault.process(file, (current) => {
        if (current !== source || view.file !== file) throw new Error(t("sourceChanged"));
        return source.slice(0, from) + replacement + source.slice(to);
      });
    }
  }

  private async createSnapshot(file: TFile, text: string) {
    const vault = this.plugin.app.vault;
    const prefix = file.path.slice(0, file.path.length - file.name.length);
    const day = new Date();
    for (let version = 1; ; version++) {
      const path =
        prefix + snapshotName(this.plugin.settings.snapshotTemplate, file.basename, day, version);
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
