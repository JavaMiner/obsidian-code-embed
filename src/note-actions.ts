import { Component, MarkdownView, Modal, Notice, Platform, type WorkspaceLeaf } from "obsidian";
import type CodeEmbedPlugin from "./main";
import {
  actionReferences,
  blockKind,
  expandBlock,
  expandNote,
  findFences,
  replaceFenceBody,
  selectedKinds,
  type ResolveReference,
} from "./action-markdown";
import { applyArgs } from "./fragments";
import { t } from "./locale";

export type Action = "copy" | "view" | "permanent";
export interface BlockTarget {
  line: number;
  language: string;
  body: string;
}

export function actionBar(
  parent: HTMLElement,
  cls: string,
  run: (action: Action) => Promise<void>,
) {
  const bar = parent.createSpan({ cls });
  for (const action of ["copy", "view", "permanent"] as const) {
    const button = bar.createEl("button", {
      text: t(action),
      attr: { type: "button", "data-action": action },
    });
    button.onmousedown = (event) => event.preventDefault();
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      run(action)
        .catch(
          (error: unknown) => new Notice(error instanceof Error ? error.message : String(error)),
        )
        .finally(() => {
          button.disabled = false;
        });
    };
  }
  return bar;
}

export class NoteActions {
  private readonly partners = new WeakMap<WorkspaceLeaf, WorkspaceLeaf>();

  private readonly previewLeaves = new WeakSet<WorkspaceLeaf>();

  constructor(private readonly plugin: CodeEmbedPlugin) {}

  private get workspace() {
    return this.plugin.app.workspace;
  }

  private resolver(path: string, source?: string): ResolveReference {
    const snapshots = new Map<string, Promise<string>>();
    return async (ref, local) => {
      return this.plugin.resolve(ref, path, [], false, local, undefined, {
        references: actionReferences,
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
    };
  }

  async copyBlock(body: string, path: string, source?: string) {
    const text = await expandBlock(body, "copy", this.resolver(path, source));
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
      if (
        !(view instanceof MarkdownView) ||
        !view.file ||
        view.contentEl.querySelector(":scope > .ce-note-actions")
      )
        continue;
      const bar = actionBar(view.contentEl, "ce-note-actions", (action) => this.run(view, action));
      view.contentEl.prepend(bar);
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
    let from = 0;
    let to = source.length;
    let replacement: string;
    if (target) {
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
      if (action === "copy") {
        await this.copyBlock(body.replace(/\r?\n$/, ""), file.path, source);
        return;
      }
      from = fence.start;
      to = fence.end;
      replacement = replaceFenceBody(source, fence, await expandBlock(body, action, resolve));
    } else {
      replacement = await expandNote(source, kinds, action, resolve);
      if (action === "copy") {
        await navigator.clipboard.writeText(replacement);
        return;
      }
    }
    if (source.slice(from, to) === replacement) {
      new Notice(t("nothingToReplace"));
      return;
    }
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

  previewsNote(path: string) {
    return this.workspace
      .getLeavesOfType("markdown")
      .some(
        (leaf) =>
          this.previewLeaves.has(leaf) &&
          leaf.view instanceof MarkdownView &&
          leaf.view.getMode() === "preview" &&
          leaf.view.file?.path === path,
      );
  }

  private async split(view: MarkdownView) {
    const leaf = view.leaf;
    const state = leaf.getViewState();
    const mode = view.getMode() === "source" ? "preview" : "source";
    const next = { type: "markdown", state: { ...state.state, file: view.file?.path, mode } };
    if (Platform.isPhone) {
      this.previewLeaves.add(leaf);
      await leaf.setViewState(next);
      return;
    }
    const partner = this.partners.get(leaf);
    if (partner && this.workspace.getLeavesOfType("markdown").includes(partner)) {
      this.previewLeaves.add(mode === "preview" ? partner : leaf);
      await partner.setViewState(next);
      this.workspace.setActiveLeaf(partner, { focus: true });
      return;
    }
    const other = this.workspace.createLeafBySplit(leaf, "vertical", mode === "source");
    const preview = mode === "preview" ? other : leaf;
    this.previewLeaves.add(preview);
    try {
      await other.setViewState(next);
      other.setGroupMember(leaf);
      this.partners.set(leaf, other);
      this.partners.set(other, leaf);
      if (preview.view instanceof MarkdownView) preview.view.previewMode.rerender(true);
    } catch (error) {
      this.previewLeaves.delete(preview);
      other.detach();
      throw error;
    }
  }
}
