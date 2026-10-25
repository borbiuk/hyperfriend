# Repository agents (Hyperfriend)

This file orients human and AI contributors to the **Hyperfriend** browser extension for Chrome and Firefox (Manifest V3). Prefer **small, focused changes**; do not refactor unless asked. Topic rules live in [`.claude/rules/`](.claude/rules/).

## Product

- **Hyperfriend** — adds a copy-link button to every GitHub Pull Request, Issue, Discussion and Actions workflow run (lists and detail pages). A click copies a rich hyperlink: `text/html` `BEFORE<a href="URL">LINK</a>AFTER` (the link part is marked with `[square brackets]` in the template; the whole text when there are none) and `text/plain` `TEXT — URL`; with the copy format `markdown` only `text/plain` `BEFORE[LINK](URL)AFTER`. In a list, Shift+click on the row buttons collects items that a bottom bar copies as one list (`<ul>` plus `- text — url` lines, or Markdown `- [text](url)` lines). The keyboard shortcut `copy-link` (default Shift+C) copies the link of the open Issue, Discussion, workflow run (summary page only) or Pull Request (Conversation tab only).
- **GitHub Enterprise** — `*.ghe.com` (GitHub Enterprise Cloud with data residency) works without setup, because the manifest content script matches it; for a GitHub Enterprise Server the user adds the exact domain in the General tab; the browser asks for the access, the background script registers the content script there and starts it in open tabs. The granted origins are the only state (not in the settings file); avatars stay github.com only.
- **Settings** — four link templates (Pull Request, Issue, Discussion, workflow run) with `{{placeholders}}`, the copy format (rich link or Markdown), the keyboard shortcuts (key combination + on/off) and display settings (author avatars on/off). Edited in the toolbar popup (tabs Templates, Shortcuts, General), stored in `chrome.storage.sync` (`ConfigModel`: `templates`, `format`, `shortcuts`, `display`), and shareable as a JSON file (Export / Import, schema version 4; files of versions 1 to 3 still import, the templates of versions 1 and 2 are converted to the `[link]` syntax).
- **Build output** — `dist/` (Chrome, Load unpacked) and `dist-firefox/` (Firefox, `about:debugging`).
- **Source manifests** — `public/manifest.json` (Chrome) and `public/manifest.firefox.json` (Firefox); copied to `manifest.json` in the matching build directory.
- **Icon** — `public/assets/logo-{16,32,48,128}.png`, referenced by `icons` and `action.default_icon` in both manifests and included by `zip.sh`. Sources and the render script are in `design/icon/` ([README](design/icon/README.md)); regenerate with `./design/icon/render.sh`.

## Architecture (MV3)

| Area           | Path                           | Role                                                                                                                                                                                                                              |
| -------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content script | `src/content/content.ts`       | Runs on `https://github.com/*`, `https://*.ghe.com/*` and on the Enterprise Server domains the user granted; injects copy buttons and PR author avatars (github.com only), runs keyboard shortcuts; limited `chrome.*` (storage). |
| Background     | `src/background/background.ts` | Service worker (Chrome) / event page (Firefox): keeps the content scripts of the granted GitHub Enterprise domains registered (`syncEnterpriseScripts`).                                                                          |
| Popup          | `src/options/options.tsx`      | Toolbar popup and options page (`public/options.html`): React + Primer React settings UI with three tabs.                                                                                                                         |
| Shared code    | `src/shared/`                  | Models, constants, services, utils — reuse via **`@shared/*`** alias.                                                                                                                                                             |

Ambient type declarations live in `src/types/global.d.ts`. The background script does one thing: it registers the content script for the GitHub Enterprise domains the user granted (after install, update, browser start and every permission change). The content script and the popup use `chrome.storage.sync` through `configService`.

Adding a keyboard shortcut touches five places (enum value, default in `DEFAULT_CONFIG`, handler in `src/content/shortcut/`, row in `SHORTCUT_ITEMS`, docs); the checklist is in [extension-architecture.md](.claude/rules/extension-architecture.md).

See also [extension-architecture.md](.claude/rules/extension-architecture.md), [shared-api.md](.claude/rules/shared-api.md), [popup.md](.claude/rules/popup.md) and [github-dom-selectors.md](.claude/rules/github-dom-selectors.md).

## Build and manifest constraints

- **No hashed bundle filenames** — manifests reference fixed names; webpack uses **`[name].js`** and each entry is a single self-contained file (no vendor or runtime chunks). Do not introduce content hashes without updating both manifests and tooling.
- **Two manifests, kept in sync** — `public/manifest.json` and `public/manifest.firefox.json` must differ only by `browser_specific_settings` (Gecko ID `hyperfriend@borbiuk`, `strict_min_version` 140.0, `data_collection_permissions`) and `background` (`service_worker` in Chrome, `scripts` in Firefox). The version is set in `public/manifest.json`; the pre-commit hook (`.husky/set-version.sh`) copies it to `package.json` and `manifest.firefox.json`.
- **Permissions** — `storage` and `scripting`; no `host_permissions`; `optional_host_permissions` is `https://*/*`, but only the origins the user adds in the General tab are ever requested (one exact `https://HOST/*` each, never a wildcard host); content script `matches` is `https://github.com/*` and `https://*.ghe.com/*` (the only wildcard host; the manifest grants it at install), and the background script registers the same content script for the granted domains.
- **`chrome.*` namespace only** — Firefox MV3 supports it; do not add a `browser.*` polyfill.
- Cross-import shared code via **`@shared/...`** (see `webpack/webpack.common.js` and `tsconfig.json`).
- CSS imports (including from `node_modules`, e.g. Primer) go through `style-loader` + `css-loader`.

## Dependency policy

- **Only exact versions** in `package.json` — never `^`, `~` or ranges. `.npmrc` sets `save-exact=true`.
- Update with `npm install -E <package>@latest` (add `-D` for dev dependencies), then run `npm run check:versions`. Use `npm run check:outdated` locally to find updates.
- `typescript7` (alias of TypeScript 7) is the type checker (`npm run typecheck`); `typescript` is the TypeScript 6 compat package for `ts-loader` and `typescript-eslint`.
- Details: [npm-versions.md](.claude/rules/npm-versions.md).

## Commands

- `npm run build` / `npm run build:firefox` — production bundles for Chrome / Firefox.
- `npm run watch` — dev watch mode (Chrome, `dist/`).
- `npm run zip` — build both browsers and create `.zip` packages in `artifacts/` (see `zip.sh`; needs `jq` and `zip`).
- `npm run lint` — ESLint on the whole repository (`eslint .`; type-aware promise rules on `src/` and `tests/`) + TypeScript 7 type check (`src/` and `tests/`); `npm run lint:firefox` — `web-ext lint` on `dist-firefox/`; `npm run lint:docs` — markdownlint (`.markdownlint-cli2.jsonc`) plus `scripts/check-docs.mjs` (relative links, `RELEASE_NOTES.md` headings); `npm run lint:unused` — knip (`knip.jsonc`); both run in CI job `checks`.
- `npm run format` — Prettier. `npm run check:versions`, `npm run check:outdated` — dependency checks.
- `npm test` — Playwright `unit` + `e2e`; `npm run test:unit` (no browser), `npm run test:e2e` (Playwright's bundled Chromium, GitHub snapshots, no network), `npm run test:live` (real github.com `react/react`, on demand only; sets `HYPERFRIEND_LIVE`), `npm run test:snapshots` (refresh the page snapshots, needs network). A `dist` setup project builds `dist/` before `e2e` and `live`, so the scripts do not build themselves. First time: `npx playwright install chromium`. Chromium only. CI runs `test:unit` (job `build`) and `test:e2e` (job `e2e`) on pushes and pull requests, and `.github/workflows/markup.yml` refreshes the snapshots, runs `test:e2e` and `test:live` daily and opens a `markup-drift` issue on failure (snapshots that break the tests land on `master`, so push CI stays red until the selectors are fixed, by design). See [testing.md](.claude/rules/testing.md).

## Git hooks

The Husky pre-commit hook (`.husky/pre-commit`) runs on **every commit**:

1. Copies the version from `public/manifest.json` to `package.json` and `public/manifest.firefox.json` (`.husky/set-version.sh`).
2. Runs `npm run format`.
3. Runs `git add -u`, which **stages all modified tracked files** (formatting and version changes). **Partial commits (staging only some files or hunks) are therefore not supported**: everything modified is committed.
4. Runs `./zip.sh`, which rebuilds **both browsers** (`dist/`, `dist-firefox/`) and creates the `.zip` packages in `artifacts/` (gitignored). A commit needs `jq`, `zip` and a working build, and takes as long as two production builds.

## Documentation

- Chrome APIs: cite **`developer.chrome.com`**. Claude Code gets the official `chrome-extensions` skill from Google's `modern-web-guidance` plugin, enabled in [.claude/settings.json](.claude/settings.json). Firefox differences: [firefox.md](.claude/rules/firefox.md) and MDN.
- Release history: [RELEASE_NOTES.md](RELEASE_NOTES.md) (`## x.y.z` headings are read by `scripts/tag-releases.sh`). Store text: [LISTING.md](LISTING.md).

## AI tooling

- **Subagents** (`.claude/agents/`): `code-reviewer` reviews changes, `qa-engineer` runs builds, lint, tests and checks, `e2e-reviewer` reviews tests against the test standard. All are read-only and report findings; the main session applies fixes and is the only one that runs git.
- **Skills**: `/verify` (`.claude/skills/verify/`) runs the full check suite (including `test:unit` and `test:e2e`); `/release` (`.claude/skills/release/`) prepares and publishes a release (version, commit, push, CI, tag, GitHub Release with the zips); `/store-assets` (`.claude/skills/store-assets/`) regenerates the store images; `/playwright` (`.claude/skills/playwright/`) covers writing, running and debugging tests; `/e2e-review` (`.claude/skills/e2e-review/`) holds the test standard ([rules](.claude/skills/e2e-review/references/rules.md)) and reviews test changes.
- **Playwright test agents** (`.claude/agents/playwright-test-{planner,generator,healer}.md`): generated by `npx playwright init-agents --loop=claude --project=e2e`; regenerate them after every Playwright update and do not hand-edit them. The seed is `tests/e2e/seed.spec.ts`, plans go to `specs/`, and their output must pass `/e2e-review`.
- **MCP** ([.mcp.json](.mcp.json)): `chrome-devtools` (Chrome DevTools MCP with extension tools) loads `dist/` into Chrome for in-browser checks; see [github-dom-selectors.md](.claude/rules/github-dom-selectors.md#verifying-changes). `playwright-test` (`npx playwright run-test-mcp-server`) serves the Playwright test agents (it uses `playwright.config.ts`, where `live` is not defined without `HYPERFRIEND_LIVE`, so it never reaches the network). `init-agents` overwrites `.mcp.json`: re-add `chrome-devtools` afterwards.
- **Permissions** ([.claude/settings.json](.claude/settings.json)): npm scripts are pre-approved, state-changing git commands and `npm install` ask first, destructive git commands are denied.

## Rules of engagement

- Contributors: [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) (checks, commits, pull requests); privacy and security: [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md).
- English for code comments and technical docs in-repo (per project convention).
- Follow the working rules in [CLAUDE.md](CLAUDE.md) (minimal scope, no speculative refactors).
- Never add a `^` or `~` version range. Edit icon SVG sources, not the PNGs, and re-run `./design/icon/render.sh`.
- For AI-assisted work, see Google's [Extensions and AI](https://developer.chrome.com/docs/extensions/ai) page.
