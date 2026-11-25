export type Settings = typeof DEFAULTS & {
  movedReferences?: Record<string, Record<string, string>>;
};
export type KeysOfType<T> = {
  [K in keyof typeof DEFAULTS]: (typeof DEFAULTS)[K] extends T ? K : never;
}[keyof typeof DEFAULTS];
export const DEFAULTS = {
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

export const COLOR_FALLBACK = {
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
