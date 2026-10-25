# Development

## Requirements

- Node.js 22 or newer (enforced by `engines` and `engine-strict`).
- `jq` and `zip` for `zip.sh` (packaging) and the pre-commit hook, which builds and zips both browsers on every commit.

## Installation

### Chrome

1. Open the Google Chrome browser.
2. Navigate to `chrome://extensions/` and enable Developer Mode by toggling the switch in the top right corner.
3. Run `npm install` in the root of repository.
4. Run `npm run build` in the root of repository.
5. Click on `Load unpacked` and select the `dist` directory created after previous step.
6. The extension should now appear in your list of installed extensions and is ready to use.

### Firefox

Firefox 140 or newer is required (Firefox for Android: 142 or newer).

1. Run `npm install` in the root of repository.
2. Run `npm run build:firefox` in the root of repository.
3. Navigate to `about:debugging#/runtime/this-firefox`.
4. Click on `Load Temporary Add-on...` and select the `manifest.json` file inside the `dist-firefox` directory.
5. The extension should now appear in your list of installed extensions and is ready to use.

> **Note:** Temporary add-ons in Firefox are removed when the browser restarts. Load it again after a restart.

## npm scripts

| Script                   | Description                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `npm run watch`          | Development build for Chrome into `dist/`, rebuilt on every change.                                  |
| `npm run build`          | Production build for Chrome into `dist/`.                                                            |
| `npm run build:firefox`  | Production build for Firefox into `dist-firefox/`.                                                   |
| `npm run clean`          | Remove `dist/` and `dist-firefox/`.                                                                  |
| `npm run zip`            | Rebuild both browsers and create `.zip` packages for publishing (runs `zip.sh`).                     |
| `npm run typecheck`      | TypeScript 7 type check of `src/` and `tests/` without emitting files.                               |
| `npm run lint`           | ESLint for the whole repository (code, tests, scripts, webpack config), followed by the type check.  |
| `npm run lint:fix`       | ESLint with automatic fixes.                                                                         |
| `npm run lint:firefox`   | `web-ext lint` for the Firefox build (run `npm run build:firefox` first).                            |
| `npm run lint:docs`      | Markdown lint, relative links and the `RELEASE_NOTES.md` headings.                                   |
| `npm run lint:unused`    | knip: unused files, exports and dependencies.                                                        |
| `npm test`               | The `unit` and `e2e` tests; `dist/` is built first when `e2e` runs (see [Testing](#testing)).        |
| `npm run test:unit`      | Unit tests of `src/shared` (no browser, no build needed).                                            |
| `npm run test:e2e`       | End-to-end tests of the extension in Chromium (builds `dist/` first).                                |
| `npm run test:live`      | Smoke tests against real github.com (on demand and in the daily markup check; builds `dist/` first). |
| `npm run test:snapshots` | Refresh the GitHub page snapshots the e2e tests use (needs network).                                 |
| `npm run format`         | Prettier for `.ts`, `.tsx`, `.js`, `.mjs`, `.json`, `.md`, `.yml`, `.css` and `.html` files.         |
| `npm run format:check`   | Fail if any of these files is not formatted (Prettier `--check`; run in CI).                         |
| `npm run check:versions` | Fail if any dependency in `package.json` is not pinned to an exact version.                          |
| `npm run check:outdated` | Fail if any dependency is outdated (`npm outdated`). For local use, not run in CI.                   |

CI runs on GitHub Actions:

- `.github/workflows/build.yml` runs on pushes and pull requests to `master`. Job `build` (Node 22, 24 and 26): `npm ci`, `npm audit signatures`, `check:versions`, `format:check`, both builds, both lint scripts and `npm run test:unit`. A newer push to the same branch cancels the older run. Actions are pinned to commit SHAs; Dependabot (`.github/dependabot.yml`) opens weekly update pull requests for npm packages and actions. Job `e2e` (Node 24): installs Playwright's Chromium (`npx --no playwright install --with-deps chromium`) and runs `npm run test:e2e`; on failure it uploads the artifact `playwright-report-e2e` (`playwright-report/` and `test-results/`, kept 14 days).
- `.github/workflows/markup.yml` (workflow `github-markup`) checks every day at 05:17 UTC (and on manual dispatch) that the tests still pass on GitHub's current markup. It captures fresh snapshots with `npm run test:snapshots`; when they changed it commits them to `master` as `github-actions[bot]` ("Refresh GitHub page snapshots"; that push does not start `build.yml`, so the workflow runs the tests itself): `npm run test:e2e` on the fresh snapshots, then `npm run test:live` (also when the e2e tests failed, with its own report folders). On any failure it uploads `playwright-report-markup` (14 days) and opens one issue labelled `markup-drift` ("Tests fail on the current GitHub markup"); while that issue is open, later failures are added to it as comments. Fix the selectors in `src/content` and the tests; the first daily run where everything passes closes the issue itself. No AI agents are involved. Because the snapshots are committed before the tests run, after a markup change `master` holds snapshots the tests fail on, and every push to `master` and every pull request stays red in `build.yml` until the selectors or tests are fixed. That is intended.

## Testing

The tests use [Playwright](https://playwright.dev) and live in `tests/`. Three projects (`playwright.config.ts`):

- **`unit`** (`npm run test:unit`): pure logic from `src/shared`, no browser.
- **`e2e`** (`npm run test:e2e`): the built extension (`dist/`) loaded into Playwright's bundled Chromium, headless. GitHub pages come from saved snapshots and every other host is blocked, so the tests need no network and no GitHub account.
- **`live`** (`npm run test:live`): a short smoke check against real `github.com/react/react`. It runs on demand and in the daily markup check in CI (`markup.yml`), and is not part of `npm test`.

`npm test` runs `unit` and `e2e`. A setup project (`dist`) runs `npm run build` before `e2e` and `live`, so the tests always load the current sources; `unit` does not build. The `live` project exists only when `HYPERFRIEND_LIVE` is set (`npm run test:live` does that), so a plain `npx playwright test` never reaches the network.

First time on a machine, install the browser Playwright uses: `npx playwright install chromium`.

The tests cover **Chromium only**: Playwright cannot load extensions into Firefox, so Firefox stays covered by `npm run lint:firefox` and manual checks. Retries are off, so a flaky test is a bug to fix; a trace is kept for every failed test in `test-results/`, and the HTML report is written to `playwright-report/` (open it with `npx playwright show-report`).

**Snapshots.** The e2e tests run on saved copies of public pages: `react/react` (pull request list, pull request 9713 with its Files changed and Commits tabs, issue list, issue 10, a pull request and an issue search, the workflow run list and the first finished run of that list at capture time) and `vercel/next.js` (the discussion list and the pinned discussion 10640) in `tests/e2e/fixtures/pages/`. Scripts, comment and description bodies, tokens, nonces and email addresses are stripped, and the capture fails if any of that remains; the snapshots are excluded from Prettier. Expected item numbers, titles and authors are read from `pages/index.json`. They are refreshed automatically every day by `markup.yml`, and by hand with `npm run test:snapshots` (needs network; review the diff for personal data). The capture waits until the page is stable and numbers GitHub's random ids in document order, so an unchanged page gives an unchanged file. Specs pick their data from the snapshot instead of fixed rows, so a refresh changes titles but not the tests. When a refresh makes tests fail, GitHub changed its markup: update the selectors in `src/content` and the tests.

How to write tests and the review standard: [.claude/skills/playwright/SKILL.md](../.claude/skills/playwright/SKILL.md) and [.claude/rules/testing.md](../.claude/rules/testing.md).

## File Structure

- `public/`: Contains `manifest.json` (Chrome), `manifest.firefox.json` (Firefox) and `options.html` (popup and settings page).
    - `assets/`: The extension icon PNGs (`logo-16.png`, `logo-32.png`, `logo-48.png`, `logo-128.png`).
- `design/icon/`: Icon sources (SVG for each size) and `render.sh` that renders them into `public/assets/`, see [design/icon/README.md](../design/icon/README.md).
- `src/`:
    - `background/`: The background script (`background.ts`) that registers the content script for GitHub Enterprise domains.
    - `content/`: Content script that adds copy buttons, author avatars and the keyboard shortcut on GitHub pages (plain DOM, no React).
        - `components/`: The copy button (`copy-button.ts`), the shared tooltip (`tooltip.ts`) and the toast (`toast.ts`).
        - `icons/`: Inline SVG Octicons (copy, check, x).
        - `services/`: Page detection, link target parsing, button injection, author avatar injection, the keyboard shortcut service, DOM observer and the config store.
        - `shortcut/`: The shortcut handler interface and one handler per shortcut (`copy-link-shortcut-handler.ts`).
        - `styles/`: CSS of the button, tooltip, toast and avatar (uses GitHub's Primer CSS variables).
        - `content.ts`: The entry of the content script.
    - `options/`: Toolbar popup (settings), a React app built with Primer React.
        - `components/`: React components of the popup (`options-app.tsx` with the tabs, `templates-panel.tsx`, `shortcuts-panel.tsx` and `general-panel.tsx` for the tab contents, `template-field.tsx`, `token-editor.tsx`, `shortcut-row.tsx`, `key-chips.tsx`, `settings-section.tsx`, `settings-actions.tsx` with export, import and reset).
        - `constants/`: `shortcut-items.ts`, the rows of the Shortcuts tab.
        - `hooks/`: React hooks (`use-config.ts` loads the config and keeps it fresh, `use-view-mode.ts` tells popup from tab).
        - `styles/`: CSS of the tabs, of the Templates tab (`templates.css`) and of the General tab (`general.css`).
        - `utils/`: Helpers (`download-text.ts` saves a file without the `downloads` permission, `options-hash.ts` reads the URL hash, `template-tokens.ts` splits a template into text and placeholder chips and finds the link part, `describe-shortcut.ts` spells a shortcut for screen readers).
        - `options.tsx`: The entry of the popup.
    - `shared/`: Models, constants, services (templates, config, clipboard, settings import/export) and utils (including the shortcut helpers), imported via `@shared/*`.
    - `types/`: Ambient type declarations (`global.d.ts` allows `*.css` imports).
- `webpack/`: Configuration of webpack for the Chrome (`dist/`) and Firefox (`dist-firefox/`) builds.
- `tests/`: Playwright tests, see [Testing](#testing).
    - `unit/`: Unit tests of `src/shared` (templates, clipboard payload, shortcuts, settings file, config) and a guard for the manifests and versions.
    - `setup/`: The `dist` setup project that builds `dist/` before `e2e` and `live`.
    - `e2e/`: End-to-end specs (copy button, keyboard shortcut, avatars, navigation, search, settings upgrade and the popup tabs); `seed.spec.ts` is the seed for the Playwright test agents.
        - `fixtures/`: The `test` / `expect` fixtures that load the extension (`extension.ts`), the GitHub routing and snapshot lookups (`github.ts`), the literal default settings (`defaults.ts`), the snapshot capture script (`capture-pages.mjs`) and the snapshots with their index (`pages/`, also the item numbers and titles the tests expect).
    - `live/`: Smoke tests against real github.com (`smoke.spec.ts`).
    - `tsconfig.json`: Type check config of the tests.
- `playwright.config.ts`: Playwright projects (`unit`, `e2e`, `live`).
- `specs/`: Test plans written by the Playwright planner agent.
- `scripts/`: Maintenance scripts (`check-versions.mjs`, `check-docs.mjs` for relative links and the release notes headings, `check-pr-title.mjs` for pull request titles, `tag-releases.sh` for tagging released versions).
- `docs/`: The reference documentation (usage, templates and settings files, GitHub Enterprise, this development guide) and `docs/adr/`, the [decision records](adr/README.md) that explain why.
- `.github/`: Issue and pull request templates, `CONTRIBUTING.md`, `SUPPORT.md`, `CODEOWNERS`, Dependabot config and the CI workflows (`build.yml`: build, lint, docs and unused-code checks and tests on pushes and pull requests to `master`; `markup.yml`: daily snapshot refresh and check against github.com; `codeql.yml`, `dependency-review.yml`, `scorecard.yml`: security checks; `pr-title.yml`: pull request titles).
- `.husky/`: Git pre-commit hook: syncs the version, formats files, stages changes of tracked files and builds both browsers into `.zip` packages (see [AGENTS.md](../AGENTS.md)).
- `.claude/`: Agent context for AI-assisted development (rules, skills, subagents, shared settings; the Playwright planner, generator and healer agents are generated), see [AGENTS.md](../AGENTS.md).
- `.mcp.json`: Project MCP servers for AI-assisted development (Chrome DevTools MCP and the Playwright test MCP server).
- `artifacts/`: The `.zip` packages made by `zip.sh` (gitignored, created on demand).
- `knip.jsonc`, `.markdownlint-cli2.jsonc`, `.editorconfig`: Configuration of the unused-code check, the Markdown lint and the editors.
- `PRIVACY.md`, `SECURITY.md`, `LISTING.md`, `RELEASE_NOTES.md`: The privacy policy, the security policy, the store text and the release history.
- `zip.sh`: A script for creating `.zip` files with builds for publishing; it writes them to `artifacts/` (gitignored).

The only background code is `src/background/background.ts` (a service worker in Chrome, an event page in Firefox): it keeps the content script registered for the GitHub Enterprise Server domains the user added (`*.ghe.com` sites are covered by the manifest). The content script talks to `chrome.storage` directly.

## Tooling notes

### Exact dependency versions

Every dependency in `package.json` is pinned to an exact version: no `^`, no `~`, no ranges. `.npmrc` sets
`save-exact=true`, so `npm install <package>` saves an exact version.

- Add or update a package with `npm install -E <package>@latest` (or `-D -E` for dev dependencies).
- `npm run check:versions` verifies the pins (npm aliases like `npm:typescript@7.0.2` are accepted when the version is exact).
- `npm run check:outdated` lists everything that has a newer version. Run it locally from time to time.

### TypeScript 7

- `typescript7` is an alias of the TypeScript 7 package. `npm run typecheck` runs its compiler
  (`node node_modules/typescript7/bin/tsc --noEmit`), and `npm run lint` runs the type check after ESLint.
- `typescript` is an alias of `@typescript/typescript6`, the TypeScript 6 package that keeps the JavaScript API
  which `ts-loader` and `typescript-eslint` still need.
- `ts-loader` runs with `transpileOnly`, so webpack builds do not type check. Use `npm run typecheck` or `npm run lint`.

### Versions

The version lives in `public/manifest.json`. The pre-commit hook copies it to `package.json` and
`public/manifest.firefox.json`, so change only `public/manifest.json`.

## Store submission notes

- **Store assets** (promo tiles, screenshots and their sources) live in `design/store/`; see [design/store/README.md](../design/store/README.md) for which file goes where in the Chrome Web Store dashboard and how to regenerate them.
- **Chrome Web Store**: upload `hyperfriend-chrome-x.y.z.zip` from the GitHub Release of the version (built by the release workflow; `npm run zip` makes the same package locally in `artifacts/`). The 128×128 icon the store requires is part of the package (`assets/logo-128.png`; see [design/icon](../design/icon/README.md)).
- **Firefox Add-ons (AMO)**: upload `hyperfriend-firefox-x.y.z.zip` from the same GitHub Release. Because the code is bundled and minified, AMO also needs a **source archive**: the repository without `node_modules/`, `dist/`, `dist-firefox/` and `artifacts/`. Build steps for the reviewer:
    1. Use Node.js 22 or newer.
    2. Run `npm ci`.
    3. Run `npm run build:firefox`.
    4. The result is in `dist-firefox/`, and its `content.js`, `options.js`, `options.html` and `manifest.json` are the submitted files.
- **Reviewer notes for `web-ext lint`**: `npm run lint:firefox` reports 4 warnings, all in `options.js` and all from bundled third-party code (React, Primer and lodash): one `DANGEROUS_EVAL` (a `Function` constructor) and three `UNSAFE_VAR_ASSIGNMENT` (`innerHTML`). The extension's own code does not use `eval`, `innerHTML` or remote code, and `content.js` (the only script that runs on web pages) has none of these warnings.
