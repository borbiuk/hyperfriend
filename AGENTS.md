# Repository agents (Hyperfriend)

This file orients human and AI contributors to the **Hyperfriend** browser extension for Chrome and Firefox (Manifest V3). Prefer **small, focused changes**; do not refactor unless asked. Topic rules live in [`.claude/rules/`](.claude/rules/).

## Product

- **Hyperfriend** — adds a copy-link button to every GitHub Pull Request and Issue (lists and detail pages). A click copies a rich hyperlink: `text/html` `<a href="URL">TEXT</a>` and `text/plain` `TEXT — URL`. The keyboard shortcut `copy-link` (default Shift+C) copies the link of the open Issue or of the open Pull Request (Conversation tab only).
- **Settings** — two link templates (Pull Request, Issue) with `{{placeholders}}`, the keyboard shortcuts (key combination + on/off) and display settings (author avatars on/off). Edited in the toolbar popup (tabs Templates, Shortcuts, General), stored in `chrome.storage.sync` (`ConfigModel`: `templates`, `shortcuts`, `display`), and shareable as a JSON file (Export / Import, schema version 2; version 1 files with templates only still import).
- **Build output** — `dist/` (Chrome, Load unpacked) and `dist-firefox/` (Firefox, `about:debugging`).
- **Source manifests** — `public/manifest.json` (Chrome) and `public/manifest.firefox.json` (Firefox); copied to `manifest.json` in the matching build directory.
- **Icon** — `public/assets/logo-{16,32,48,128}.png`, referenced by `icons` and `action.default_icon` in both manifests and included by `zip.sh`. Sources and the render script are in `design/icon/` ([README](design/icon/README.md)); regenerate with `./design/icon/render.sh`.

## Architecture (MV3)

| Area           | Path                      | Role                                                                                                                               |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Content script | `src/content/content.ts`  | Runs on `https://github.com/*`; injects copy buttons and PR author avatars, runs keyboard shortcuts; limited `chrome.*` (storage). |
| Popup          | `src/options/options.tsx` | Toolbar popup and options page (`public/options.html`): React + Primer React settings UI with three tabs.                          |
| Shared code    | `src/shared/`             | Models, constants, services, utils — reuse via **`@shared/*`** alias.                                                              |

Ambient type declarations live in `src/types/global.d.ts`. **There is no background script and no service worker.** Both entrypoints use `chrome.storage.sync` through `configService`.

Adding a keyboard shortcut touches five places (enum value, default in `DEFAULT_CONFIG`, handler in `src/content/shortcut/`, row in `SHORTCUT_ITEMS`, docs); the checklist is in [extension-architecture.md](.claude/rules/extension-architecture.md).

See also [extension-architecture.md](.claude/rules/extension-architecture.md), [shared-api.md](.claude/rules/shared-api.md), [popup.md](.claude/rules/popup.md) and [github-dom-selectors.md](.claude/rules/github-dom-selectors.md).

## Build and manifest constraints

- **No hashed bundle filenames** — manifests reference fixed names; webpack uses **`[name].js`** and each entry is a single self-contained file (no vendor or runtime chunks). Do not introduce content hashes without updating both manifests and tooling.
- **Two manifests, kept in sync** — `public/manifest.json` and `public/manifest.firefox.json` must differ only by `browser_specific_settings` (Gecko ID `hyperfriend@borbiuk`, `strict_min_version` 140.0, `data_collection_permissions`). The version is set in `public/manifest.json`; the pre-commit hook (`.husky/set-version.sh`) copies it to `package.json` and `manifest.firefox.json`.
- **Permissions** — `storage` only; no `host_permissions`; content script `matches` is `https://github.com/*`.
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
- `npm run zip` — build both browsers and create `.zip` packages (see `zip.sh`; needs `jq` and `zip`).
- `npm run lint` — ESLint + TypeScript 7 type check; `npm run lint:firefox` — `web-ext lint` on `dist-firefox/`.
- `npm run format` — Prettier. `npm run check:versions`, `npm run check:outdated` — dependency checks.

## Git hooks

The Husky pre-commit hook (`.husky/pre-commit`) runs on **every commit**:

1. Copies the version from `public/manifest.json` to `package.json` and `public/manifest.firefox.json` (`.husky/set-version.sh`).
2. Runs `npm run format`.
3. Runs `git add -u`, which **stages all modified tracked files** (formatting and version changes). **Partial commits (staging only some files or hunks) are therefore not supported**: everything modified is committed.
4. Runs `./zip.sh`, which rebuilds **both browsers** (`dist/`, `dist-firefox/`) and creates the `.zip` packages. A commit needs `jq`, `zip` and a working build, and takes as long as two production builds.

## Documentation

- Chrome APIs: cite **`developer.chrome.com`**. Claude Code gets the official `chrome-extensions` skill from Google's `modern-web-guidance` plugin, enabled in [.claude/settings.json](.claude/settings.json). Firefox differences: [firefox.md](.claude/rules/firefox.md) and MDN.
- Release history: [RELEASE_NOTES.md](RELEASE_NOTES.md) (`## x.y.z` headings are read by `scripts/tag-releases.sh`). Store text: [LISTING.md](LISTING.md).

## AI tooling

- **Subagents** (`.claude/agents/`): `code-reviewer` reviews changes, `qa-engineer` runs builds, lint and checks. Both are read-only and report findings; the main session applies fixes and is the only one that runs git.
- **Skill** `/verify` (`.claude/skills/verify/`) runs the full check suite.
- **MCP** ([.mcp.json](.mcp.json)): `chrome-devtools` (Chrome DevTools MCP with extension tools) loads `dist/` into Chrome for in-browser checks; see [github-dom-selectors.md](.claude/rules/github-dom-selectors.md#verifying-changes).
- **Permissions** ([.claude/settings.json](.claude/settings.json)): npm scripts are pre-approved, state-changing git commands and `npm install` ask first, destructive git commands are denied.

## Rules of engagement

- English for code comments and technical docs in-repo (per project convention).
- Follow the working rules in [CLAUDE.md](CLAUDE.md) (minimal scope, no speculative refactors).
- Never add a `^` or `~` version range. Edit icon SVG sources, not the PNGs, and re-run `./design/icon/render.sh`.
- For AI-assisted work, see Google's [Extensions and AI](https://developer.chrome.com/docs/extensions/ai) page.
