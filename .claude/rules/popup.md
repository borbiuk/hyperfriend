---
paths:
    - 'src/options/**'
    - 'public/options.html'
---

# Toolbar popup (`src/options/`)

> Settings UI: React 19 + Primer React. Theming, entry and save timing are described in [extension-architecture.md](extension-architecture.md).

- **Width is 400 px** (set in `public/options.html` and `OptionsApp`); keep the layout compact.
- **One setting = one field inside a `SettingsSection`**. Version 1.0.0 has two: the Pull Request and the Issue link template.
- **Each template field** has an accessible label, placeholder hints from `TEMPLATE_PLACEHOLDERS` (not the hidden `{{number}}` / `{{title}}` aliases), a live preview built with `buildLinkPayload`, and autosave with a "Saved" status.
- **Footer** (`footer-actions.tsx`): "Reset to defaults", **Export** (`DownloadIcon`), **Import** (`UploadIcon`) and a link to the GitHub repository. Messages appear under the buttons (success "Settings imported.", errors inline; no `confirm()`).
    - Reset and Import cancel pending field saves first; Export flushes them first.
    - Export builds `hyperfriend-settings.json` with `serializeSettings` and downloads it through a Blob and a temporary `<a download>` (`utils/download-text.ts`); no `downloads` permission.
    - Import rejects files over 64 KB (checked via `file.size`) before reading them. It reads a hidden `<input type="file" accept="application/json,.json">` with `file.text()`, validates with `parseSettings`, applies with one `configService.setTemplates` call and refreshes the fields.
    - **Chrome**: Export and Import work directly in the popup.
    - **Firefox**: the popup closes when the download panel or the OS file picker opens, so **both Export and Import** there open the settings page in a tab (`chrome.runtime.openOptionsPage()`, `options_ui` with `open_in_tab`). `use-view-mode.ts` tells the tab from the popup (`chrome.tabs.getCurrent()`; `#tab` forces tab mode for manual tests); in a tab the 400 px panel is centered.
- **Popups close when they lose focus** in both browsers: save on change and keep no unsaved state that matters. Subscribe to `configService` so changes made elsewhere show up.
- Check both light and dark themes.
