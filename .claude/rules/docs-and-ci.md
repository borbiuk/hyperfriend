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
- [live.yml](../../.github/workflows/live.yml) runs `npm run test:live` against real github.com on a schedule (Mondays 06:00 UTC) and on `workflow_dispatch`, never on push or pull request, so it cannot block anything. A failed run uploads `playwright-report-live`; the failure notification is GitHub's own scheduled-workflow email. A failure means GitHub changed its markup: refresh the snapshots and the selectors ([testing.md](testing.md)).
- Workflows use least-privilege `permissions` (`contents: read`) and reference only existing npm scripts. The Playwright browser is installed with `npx --no playwright install`, so it is the version of the installed `@playwright/test` package (a Playwright bump needs no workflow change). With `CI` set, `playwright.config.ts` forbids `test.only` and adds the `github` reporter.
- `scripts/tag-releases.sh` finds the commit by the `version` in `public/manifest.json` and creates tags only locally. Test it with `DRY_RUN=1` only.
- The whole release flow (version bump, release notes, commit and zips, push, CI, annotated tag, GitHub Release with `hyperfriend-{chrome,firefox}-x.y.z.zip`) is the `/release` skill: [release/SKILL.md](../skills/release/SKILL.md). Update it when this process changes.
