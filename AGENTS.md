# Repository agents (Hyperfriend)

This file orients human and AI contributors to the **Hyperfriend** browser extension for Chrome and Firefox (Manifest V3). Prefer **small, focused changes**; do not refactor unless asked.

## Product

- **Hyperfriend** — adds a copy-link button to every GitHub Pull Request and Issue (lists and detail pages). A click copies a rich hyperlink: `text/html` `<a href="URL">TEXT</a>` and `text/plain` `TEXT — URL`.
- **Settings** — two link templates (Pull Request, Issue) with `{{placeholders}}`, edited in the toolbar popup and stored in `chrome.storage.sync`.
- **Build output** — `dist/` (Chrome, Load unpacked) and `dist-firefox/` (Firefox, `about:debugging`).
- **Source manifests** — `public/manifest.json` (Chrome) and `public/manifest.firefox.json` (Firefox); copied to `manifest.json` in the matching build directory.
- **Version 1.0.0 has no icon**: no `icons` or `default_icon` keys.

## Architecture (MV3)

| Area           | Path                      | Role                                                                                |
| -------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| Content script | `src/content/content.ts`  | Runs on `https://github.com/*`; injects copy buttons; limited `chrome.*` (storage). |
| Popup          | `src/options/options.tsx` | Toolbar popup (`public/options.html`): React + Primer React settings UI.            |
| Shared code    | `src/shared/`             | Models, constants, services, utils — reuse via **`@shared/*`** alias.               |

Ambient type declarations live in `src/types/global.d.ts`. **There is no background script and no service worker.** Both entrypoints use `chrome.storage.sync` through `configService`.

See also [extension-architecture.md](.claude/rules/extension-architecture.md) and [github-dom-selectors.md](.claude/rules/github-dom-selectors.md).

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

- Official Chrome APIs: **`developer.chrome.com`** only when citing Chrome extension behavior; use the offline mirror in the [chrome-extension-docs skill](.claude/skills/chrome-extension-docs/SKILL.md) (`.claude/skills/chrome-extension-docs/references/`). Firefox notes live in the same skill.
- Release history: [RELEASE_NOTES.md](RELEASE_NOTES.md) (`## x.y.z` headings are read by `scripts/tag-releases.sh`). Store text: [LISTING.md](LISTING.md).

## Multi-agent workflow

Larger tasks can be split between the subagents defined in `.claude/agents/`. The **orchestrator** is the main Claude session; it plans, spawns agents, and integrates results.

| Agent              | Model  | Owns                                                                                                                                                                                                                                 |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `build-engineer`   | sonnet | `package.json`, `package-lock.json`, `.npmrc`, `tsconfig.json`, `webpack/**`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.husky/**`, `zip.sh`, `scripts/check-versions.mjs`, `public/manifest*.json` |
| `devops-engineer`  | sonnet | `.github/**`, `scripts/tag-releases.sh`, `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`                                                                                                                                              |
| `core-engineer`    | opus   | `src/shared/**`                                                                                                                                                                                                                      |
| `dom-engineer`     | opus   | `src/content/**`                                                                                                                                                                                                                     |
| `popup-engineer`   | sonnet | `src/options/**`, `public/options.html`                                                                                                                                                                                              |
| `technical-writer` | sonnet | root `*.md` (except `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`), `.claude/**`                                                                                                                                                    |
| `qa-engineer`      | sonnet | Nothing (read-only; runs builds, lint and checks, reports findings)                                                                                                                                                                  |
| `code-reviewer`    | opus   | Nothing (read-only; reviews code and reports findings)                                                                                                                                                                               |

Flow:

1. **Contracts first** — the orchestrator writes the shared contracts (types, API signatures, manifest keys, DOM markers) so agents can code against them in parallel.
2. **Wave 1: tooling** — `build-engineer` sets up package, webpack, lint, manifests and placeholder entry stubs; `devops-engineer` sets up `.github/` and repository files.
3. **Wave 2: code** — `core-engineer` implements `src/shared/**`; `dom-engineer` and `popup-engineer` build the content script and popup against the contracts; `technical-writer` documents from the contracts.
4. **Wave 3: sync and verify** — `technical-writer` syncs docs with the final code; `qa-engineer` runs build, lint and checks for both browsers; `code-reviewer` reviews the result. Findings go back to the owner of the file.
5. **Integrate** — the orchestrator resolves conflicts and re-runs the checks.

Rules:

- **File ownership is strict** — an agent edits only files it owns. If it needs a change elsewhere (for example a new dependency), it reports it to the orchestrator instead of editing.
- **Only the orchestrator runs git** — subagents never run `add`, `commit`, `push`, `stash`, `checkout`, `reset` or any other git command that changes state.
- Agents report what they changed, anything they were unsure about, and what must be synced once other agents finish.

## Rules of engagement

- English for code comments and technical docs in-repo (per project convention).
- Follow the working rules in [CLAUDE.md](CLAUDE.md) (minimal scope, no speculative refactors).
- Never add a `^` or `~` version range. Never add an icon in 1.0.0.
- For AI-assisted work, start from Google's [Build Chrome Extensions with AI](https://developer.chrome.com/docs/extensions/ai/build_with_ai), then verify against the local docs mirror in the [chrome-extension-docs skill](.claude/skills/chrome-extension-docs/SKILL.md).
