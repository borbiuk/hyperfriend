---
paths:
    - 'README.md'
    - 'LISTING.md'
    - 'RELEASE_NOTES.md'
    - '.github/**'
    - 'scripts/tag-releases.sh'
---

# Docs, CI and releases

> Conventions for the user-facing docs, GitHub automation and release tagging.

## Docs

- Describe the code as it is: read `package.json`, `public/manifest*.json`, `src/**` and `webpack/**` before writing about them. Every command, script name, path, placeholder and manifest value must match the code.
- `README.md`: features (copy button, keyboard shortcut, avatars, templates, shortcut settings, settings file format v2 with the v1 note), popup tabs, placeholder table, supported pages, development setup (Chrome Load unpacked `dist/`, Firefox `about:debugging` with `dist-firefox/manifest.json`), npm scripts, file structure, tooling notes. Store links stay "coming soon" until the extension is published.
- `LISTING.md`: store text with privacy (no data collection, no analytics; the only network traffic is the author avatar images from GitHub's own avatar server) and the permissions explained (`storage`; content script on github.com). Plain text with emoji bullets: no Markdown tables or code blocks.
- A user-visible change (shortcut, popup tab, setting, settings file field) goes into `README.md`, `LISTING.md` and `RELEASE_NOTES.md` together.
- `RELEASE_NOTES.md`: one `## x.y.z` heading per release, newest first. `scripts/tag-releases.sh` reads that heading pattern, so do not use it for anything else.

## CI and releases

- [build.yml](../../.github/workflows/build.yml) runs on pushes and pull requests to `master`. Job `build` (Node 22, 24 and 26): `npm ci`, `check:versions`, both builds, `lint`, `lint:firefox`, `test:unit`. Job `e2e` (Node 24, 15-minute timeout): `npm ci`, `npx --no playwright install --with-deps chromium`, `npm run test:e2e`; on failure it uploads `playwright-report/` and `test-results/` as artifact `playwright-report-e2e` (14 days). Do not add `check:outdated` (new upstream releases would break CI at random).
- [markup.yml](../../.github/workflows/markup.yml) (workflow `github-markup`) runs daily at 05:00 UTC and on `workflow_dispatch`, never on push or pull request. Permissions `contents: write` (it commits and pushes snapshots) and `issues: write` (the drift issue); `concurrency` group `github-markup` allows one run at a time. Steps: `npm ci`, Playwright Chromium, `npm run test:snapshots`; if `tests/e2e/fixtures/pages` changed, commit "Refresh GitHub page snapshots" as `github-actions[bot]` (Husky disabled with `HUSKY=0`) and push to `master`; then `npm run test:e2e` on the fresh snapshots and `npm run test:live`. A push made with the workflow token does not trigger `build.yml`, which is why the workflow runs the tests itself. On any failure it uploads `playwright-report-markup` (14 days) and opens one issue labelled `markup-drift` ("Tests fail on the current GitHub markup"), or comments on the open one; close the issue after fixing the selectors. No AI agents are involved.
- **By design**, snapshots that make tests fail are already on `master`: every following push and pull request stays red in `build.yml` until the selectors in `src/content` and the tests are fixed ([github-dom-selectors.md](github-dom-selectors.md), [testing.md](testing.md)).
- Workflows use least-privilege `permissions` (`contents: read`; `markup.yml` adds the write scopes it needs and nothing else) and reference only existing npm scripts. The Playwright browser is installed with `npx --no playwright install`, so it is the version of the installed `@playwright/test` package (a Playwright bump needs no workflow change). With `CI` set, `playwright.config.ts` forbids `test.only` and adds the `github` reporter.
- `scripts/tag-releases.sh` finds the commit by the `version` in `public/manifest.json` and creates tags only locally. Test it with `DRY_RUN=1` only.
- The whole release flow (version bump, release notes, commit and zips, push, CI, annotated tag, GitHub Release with `hyperfriend-{chrome,firefox}-x.y.z.zip`) is the `/release` skill: [release/SKILL.md](../skills/release/SKILL.md). Update it when this process changes.
