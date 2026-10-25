---
name: verify
description: Runs the full Hyperfriend check suite (exact versions, Chrome and Firefox builds, ESLint, TypeScript 7 type check, Playwright unit and e2e tests, web-ext lint) and reports failures grouped by file. Use after code, manifest or dependency changes, or when the user asks to build, lint or check the project.
allowed-tools: Bash(npm run check:versions) Bash(npm run format:check) Bash(npm run build) Bash(npm run build:firefox) Bash(npm run lint) Bash(npm run test:unit) Bash(npm run test:e2e) Bash(npm run lint:firefox) Bash(npm run lint:docs) Bash(npm run lint:unused)
---

Run in order and stop at the first failing step:

1. `npm run check:versions`
2. `npm run format:check` (Prettier `--check`, as in CI)
3. `npm run build` (Chrome, `dist/`)
4. `npm run build:firefox` (Firefox, `dist-firefox/`)
5. `npm run lint` (ESLint on the whole repository, then the TypeScript 7 type check of `src/` and `tests/`)
6. `npm run test:unit` (Playwright `unit` project: pure `src/shared` logic, no browser)
7. `npm run test:e2e` (Playwright `e2e` project: the `dist` setup project rebuilds `dist/` first, then runs the extension in Playwright's bundled Chromium against GitHub snapshots)
8. `npm run lint:firefox` (`web-ext lint`; 4 warnings from bundled React/Primer/lodash in `options.js` are expected)
9. `npm run lint:docs` (markdownlint, relative links and the `RELEASE_NOTES.md` headings; CI job `checks`)
10. `npm run lint:unused` (knip: unused files, exports and dependencies; config `knip.jsonc`; CI job `checks`)

`test:e2e` needs Playwright's Chromium: run `npx playwright install chromium` once per machine (or after a Playwright update). If the browser is missing, report that step as blocked and tell the user the command; do not install it unasked. `npm run test:live` (real github.com) is not part of verify; run it only on request. The tests cover Chromium only, not Firefox.

Report each step as pass or fail with the relevant output. For failures, group errors by file and propose minimal fixes; do not apply them unless asked.
