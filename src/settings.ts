export type Settings = typeof DEFAULTS & {
  movedReferences?: Record<string, Record<string, string>>;
};
export type KeysOfType<T> = {
  [K in keyof typeof DEFAULTS]: (typeof DEFAULTS)[K] extends T ? K : never;
}[keyof typeof DEFAULTS];
export const DEFAULT_SNAPSHOT_TEMPLATE = "[name].perm.[date].v[version].md";

export const DEFAULTS = {
  snapshotTemplate: DEFAULT_SNAPSHOT_TEMPLATE,
  showAllFolderActions: false,
  packageColor: "#498b78",
  showActionLabels: true,
  blockOpacity: 20,
  livePreview: true,
  viewTree: true,
  xmlPlain: true,
  treeOpenDepth: 2,
  inlineMax: 80,
  blockActionKinds: "plain, markdown, xml, ce",
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
  showAdvancedAppearance: false,
  copyGutter: 0,
  actionFont: 0,
  actionGap: 0,
  childIndent: 0,
  mobileTouch: 0,
  mobileGap: 0,
  mobileTop: 0,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readSettings(data: unknown): Settings {
  const settings: Settings = { ...DEFAULTS };
  if (!isRecord(data)) return settings;
  for (const [key, initial] of Object.entries(DEFAULTS)) {
    const value = data[key];
    if (typeof value === typeof initial) Object.assign(settings, { [key]: value });
  }
  settings.blockOpacity = Number.isFinite(settings.blockOpacity)
    ? Math.min(100, Math.max(0, settings.blockOpacity))
    : DEFAULTS.blockOpacity;
  if (data.blockActionKinds === undefined && data.buttonsOnPlain === false)
    settings.blockActionKinds = "ce";
  if (isRecord(data.movedReferences)) {
    settings.movedReferences = Object.fromEntries(
      Object.entries(data.movedReferences)
        .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
        .map(([path, bindings]) => [
          path,
          Object.fromEntries(
            Object.entries(bindings).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          ),
        ]),
    );
  }
  return settings;
}
