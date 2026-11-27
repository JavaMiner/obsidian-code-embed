import { ItemView, Notice, type ViewStateResult } from "obsidian";
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
  private field?: HTMLTextAreaElement;
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
    return { path: this.path };
  }

  async setState(state: unknown, result: ViewStateResult) {
    const path = markerFromState(state);
    if (!path) throw new Error(t("sourceChanged"));
    if (!this.field || this.path !== path) {
      await this.flush();
      const text = await this.app.vault.adapter.read(path);
      this.path = path;
      this.saved = text;
      this.contentEl.empty();
      this.contentEl.addClass("ce-marker-view");
      this.field = this.contentEl.createEl("textarea", {
        cls: "ce-marker-editor",
        attr: { "aria-label": path, spellcheck: "true" },
      });
      this.field.value = text;
      this.field.oninput = () => {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
          void this.flush().catch(this.report);
        }, 300);
      };
      this.field.onblur = () => {
        void this.flush().catch(this.report);
      };
    }
    await super.setState(state, result);
  }

  private report(this: void, error: unknown) {
    new Notice(error instanceof Error ? error.message : String(error));
  }

  private flush() {
    window.clearTimeout(this.timer);
    const path = this.path;
    const value = this.field?.value;
    const save = async () => {
      if (value === undefined || value === this.saved) return;
      await this.app.vault.adapter.process(path, (current) => {
        if (current !== this.saved && current !== value) throw new Error(t("sourceChanged"));
        return value;
      });
      this.saved = value;
    };
    const write = this.pending.then(save);
    this.pending = write.catch(() => {});
    return write;
  }

  async onClose() {
    await this.flush().catch(this.report);
  }
}
