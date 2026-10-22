---
paths:
    - 'public/manifest*.json'
    - 'src/shared/services/**'
    - 'webpack/**'
---

# Firefox notes (Hyperfriend)

> Project-specific notes about Firefox MV3 differences. Not a mirror of MDN: verify details on
> `developer.mozilla.org` (WebExtensions) when something here is not enough.

## Build and manifest

- Firefox gets its own manifest: `public/manifest.firefox.json`, copied to `dist-firefox/manifest.json` by `npm run build:firefox`. It must stay identical to `public/manifest.json` except for `browser_specific_settings` and `background` (`scripts` instead of `service_worker`).
- `browser_specific_settings.gecko`:
    - `id`: `hyperfriend@borbiuk`. A fixed ID is required for `storage.sync` to work and for a stable add-on identity.
    - `strict_min_version`: `140.0`, because `data_collection_permissions` is understood by Firefox 140 and newer (desktop).
    - `data_collection_permissions`: `{ "required": ["none"] }` declares that the extension collects no data. Required by addons.mozilla.org for new submissions; the key is only understood from Firefox 140 (desktop) and 142 (Android), hence the two `strict_min_version` values.
- `browser_specific_settings.gecko_android.strict_min_version`: `142.0`, the first Firefox for Android version that supports `data_collection_permissions`.
- Check the Firefox build with `npm run lint:firefox` (`web-ext lint` on `dist-firefox/`).

## Differences that matter for this project

- **Background.** Firefox MV3 has no service workers: its manifest declares `background.scripts` (an event page), Chrome's declares `background.service_worker`; both load `background.js` (`src/background/background.ts`), which registers the content script for the GitHub Enterprise domains (`scripting.registerContentScripts`, supported in Firefox MV3 from 102). Do not add other background work without an agreed reason.
- **`chrome.*` namespace works.** Firefox MV3 supports `chrome.*` with promises. Do not add a `browser.*` polyfill or `webextension-polyfill`.
- **Host access.** The content script matches `https://github.com/*` and `https://*.ghe.com/*` (Firefox 140+ asks for the site access at install; if buttons are missing on a `*.ghe.com` site, check the Permissions tab in `about:addons`); Enterprise Server domains are optional host permissions (`optional_host_permissions` `https://*/*`, requested one exact origin at a time with `permissions.request`). The Firefox popup closes when that prompt opens, so the General tab opens the settings page in a tab for it (like Export and Import). Firefox lets users manage site access for an extension in `about:addons` (Permissions tab); if buttons are missing on Firefox, check it there. Verify exact MV3 host permission behavior on MDN before relying on it.
- **Clipboard.** `navigator.clipboard.write` with `ClipboardItem` is supported in recent Firefox versions and requires user activation (a click or a key press). That is why `copyLink` must run synchronously inside the click handler, and a keyboard shortcut handler starts the copy synchronously inside the `keydown` handler. The `execCommand('copy')` fallback in `@shared/services` covers the rest, with a limitation: when the Clipboard API exists but `write` rejects, the fallback runs after an `await`, and Firefox may refuse `execCommand('copy')` because the user gesture has ended. When the API is missing, the fallback runs synchronously inside the gesture.
- **Temporary install.** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `dist-firefox/manifest.json`. The add-on is removed when Firefox restarts.
- **Popup.** `action.default_popup` works the same as in Chrome. Popups close when they lose focus, in both browsers, so keep unsaved state minimal (the settings popup saves on change). **The Firefox popup also closes when the download panel or the OS file picker opens**, so a download started from the popup can be cut off and a `change` event on a file input never arrives: **both Export and Import** open `options.html#general` (the General tab) in a tab with `chrome.tabs.create({ url: chrome.runtime.getURL('options.html#general') })`, which needs no permission; `options_ui` with `open_in_tab` stays in both manifests for the extensions manager. In the tab they work normally (Blob download, no `downloads` permission). In Chrome both work directly in the popup.
- **Store.** AMO needs a source archive and build steps because the code is bundled (see "Store submission notes" in `README.md`); the 4 expected `web-ext lint` warnings come from bundled React/Primer/lodash in `options.js`. Listing happens on addons.mozilla.org; the zip created by `npm run zip` (`hyperfriend-build-firefox_*.zip`) has files at the archive root as AMO requires.

## Checklist before shipping a Firefox change

1. Both manifests updated (`public/manifest.json`, `public/manifest.firefox.json`).
2. `npm run build:firefox` and `npm run lint:firefox` pass.
3. Loaded in Firefox 140+ and checked on a GitHub PR page, an Issue page and a list page, in light and dark themes.
