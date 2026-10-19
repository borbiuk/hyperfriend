# Extension architecture (MV3, Chrome + Firefox)

> Architecture rules for the Hyperfriend MV3 extension and its build constraints.
> Applies to: `src/**`, `public/**`, `webpack/**`, `tsconfig.json`.

- **Entry points and responsibilities**
    - `src/content/content.ts`: content script injected into `https://github.com/*`. Adds copy buttons. Must not import React. Structure: `services/` (`page-detector`, `link-target-parser`, `button-injector`, `page-observer`, `config-store`), `components/copy-button.ts`, `icons/octicons.ts`, `styles/copy-button.css`. Details: [github-dom-selectors.md](github-dom-selectors.md).
    - `src/options/options.tsx`: toolbar popup (`public/options.html`), React + Primer React, `ThemeProvider` with `colorMode="auto"` (light/dark) and the `@primer/primitives` light/dark CSS; `options.html` sets `data-color-mode="auto"` on `<html>` and a 400 px body. Components: `options-app.tsx`, `settings-section.tsx`, `template-field.tsx`; hook `use-config.ts`. A new setting is a new field inside a `SettingsSection`.
    - `src/types/global.d.ts`: ambient declarations (`declare module '*.css';` for side-effect CSS imports).
    - `src/shared/`: models, constants, services and utils used by both entrypoints.
    - **No background script, no service worker.** Do not add one without a real need; both entrypoints read and write `chrome.storage.sync` through `configService`.

- **Shared API (`@shared/*`)**
    - `@shared/models`: `LinkType`, `LinkTargetModel`, `ConfigModel`.
    - `@shared/constants`: `DEFAULT_CONFIG`, `TEMPLATE_PLACEHOLDERS`, `CONFIG_STORAGE_KEY` (`hyperfriend-config`).
    - `@shared/services`: `renderTemplate`, `configService` (`get`, `setTemplate`, `reset`, `subscribe`), `buildLinkPayload`, `copyLink`.
    - `@shared/utils`: `escapeHtml`.
    - `copyLink` must be called synchronously inside the click handler (user activation). The content script preloads the config in `ConfigStore` and keeps it fresh with `configService.subscribe`.
    - Debounce `configService.setTemplate` while typing (about 300 ms) to respect `chrome.storage.sync` write quotas; the popup flushes a pending save on blur, `pagehide`, `visibilitychange` and unmount, and Reset cancels pending saves first.
    - `copyLink` falls back to `execCommand('copy')` with a one-shot `copy` listener on `window` (capture phase, `stopImmediatePropagation`) so page handlers cannot override the payload. The fallback runs synchronously when the Clipboard API is missing.

- **Manifests**
    - Two manifests: `public/manifest.json` (Chrome) and `public/manifest.firefox.json` (Firefox). Keep them identical except `browser_specific_settings` (`gecko` and `gecko_android`) in the Firefox one. Any change goes into both.
    - Firefox only: `browser_specific_settings.gecko` with `id` `hyperfriend@borbiuk`, `strict_min_version` `140.0` and `data_collection_permissions` `{ "required": ["none"] }` (this key needs Firefox 140+), plus `browser_specific_settings.gecko_android.strict_min_version` `142.0` (Firefox for Android).
    - Permissions: `storage` only, no `host_permissions`. Content script `matches`: `https://github.com/*`.
    - Version 1.0.0 has no icon: no `icons` or `default_icon` keys.
    - The version is edited only in `public/manifest.json`; the pre-commit hook syncs it to `package.json` and `manifest.firefox.json`.

- **Bundles**
    - Fixed file names (`content.js`, `options.js`), no hashes, no vendor or runtime chunks: manifests and `options.html` reference exact names.
    - `*.css` imports work in both entries (`style-loader` + `css-loader`), including CSS from `node_modules` (Primer).
    - Production builds drop `console.log`, `console.info` and `console.debug` (Terser `drop_console`); `console.warn` and `console.error` are kept, so use them for messages that must survive.

- **Imports**
    - Prefer the `@shared/*` alias for cross-area shared code (see `webpack/webpack.common.js` and `tsconfig.json`).
    - Avoid deep cross-area relative imports like `../../shared/...` when `@shared/...` exists.

- **Browser APIs**
    - Use the `chrome.*` namespace (Firefox MV3 supports it); no `browser.*` polyfill.
    - Verify API behavior in the [chrome-extension-docs](../skills/chrome-extension-docs/SKILL.md) skill; Firefox differences are in its `references/firefox-notes.md`.
