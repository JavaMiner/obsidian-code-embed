import type { TFile, TAbstractFile, View } from "obsidian";
import type { parseRef } from "./fragments";

export interface Occurrence {
  file: TFile;
  line: number;
  ch: number;
}
export interface BrokenReference extends Occurrence {
  ref: string;
  why: string;
}
export interface RawReference {
  ref: string;
  p: ReturnType<typeof parseRef>;
  line: number;
  ch: number;
  local: string | null;
}
export interface ScannedReference {
  ref: string;
  line: number;
  ch: number;
  fence: boolean;
  embed: boolean;
  codeEmbed?: boolean;
}
export interface ResolvedReference extends Omit<ScannedReference, "ref"> {
  target: TFile;
  range: string;
  heading: boolean;
  native: boolean;
}
export interface ReferenceNode {
  key: string;
  file: TFile;
  range: string;
  occ: Occurrence[];
  children: ReferenceNode[];
  depth: number;
  error?: string;
}
export interface Outgoing {
  node: ReferenceNode;
  depth: number;
}
export interface Incoming extends Outgoing {
  root: TFile;
  chain: ReferenceNode[];
}
export interface RenameSnapshot {
  tags: Set<string>;
  heads: Map<string, string>;
  pendTag: number;
  pendHead: number;
}
type ExplorerItem = { file: TAbstractFile; selfEl?: HTMLElement; el?: HTMLElement };
export interface ExplorerView extends View {
  fileItems?: Map<string, ExplorerItem> | Record<string, ExplorerItem>;
}
