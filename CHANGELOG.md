# Changelog

## 0.2.8 — Community review fixes

- Use searchable settings on Obsidian 1.13 and later and retain the settings tab on older supported versions.
- Respect the vault trash preference when removing a package marker and keep rendered embeds and their event handlers working in popout windows.
- Check the tagged source against the official Obsidian lint rules before publishing release assets.

## 0.2.7 — TypeScript migration

- Migrate the plugin, development scripts and regression tests to TypeScript.
- Bundle the plugin and all seven interface languages into the standard Obsidian release assets.

## 0.2.6 — Apache 2.0 release

- Publish the plugin from the Apache-2.0 source tree with the existing author attribution.

## 0.2.5 � package lookup and release verification

- Resolve same-note XML embeds and includes across package subfolders.
- Scope explorer row styling to folders with visible actions.
- Verify all three uploaded plugin files before publishing the GitHub release.

## 0.2.4 — folder menus and interface languages

- Support both explorer menu events for a single folder and expose package selection in settings.
- Use the Obsidian language for settings, rename controls, diagnostics and the documentation link.

## 0.2.3 — localized folder actions

- Match the seven guide languages for package controls, confirmation dialogs and shared command labels. Prefer the Obsidian interface language.

## 0.2.2 — folder actions

- Show a labelled root action beside folder names and tint marked folders.
- Reattach actions when the file explorer mounts or rebuilds rows. Add a folder-picker ribbon shortcut.

## 0.2.1 — startup fix

- Include translations in the plugin entry point so it can load directly in Obsidian.
- Exercise command registration during startup from both source and packaged entry points.

## 0.2.0 — release preparation

- Canonical embeds in suggestions and Rename, with legacy input compatibility.
- Touch-accessible XML and Markdown fragment insertion and explicit shortcut expansion.
- Marker-based package lookup, diagnostics, folder actions and nested-root isolation.
- Seven-language guides, a visual test vault and release validation.

## 0.1.0 — initial package

- Add `ce` and `codeembed` automatic structured preview.
- Add English and Polish dictionaries for shared labels and commands.
- Add release packaging, CI, and support configuration template.
