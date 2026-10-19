---
name: verify
description: Runs the full Hyperfriend check suite (exact versions, Chrome and Firefox builds, ESLint, TypeScript 7 type check, web-ext lint) and reports failures grouped by file. Use after code, manifest or dependency changes, or when the user asks to build, lint or check the project.
allowed-tools: Bash(npm run check:versions) Bash(npm run build) Bash(npm run build:firefox) Bash(npm run lint) Bash(npm run lint:firefox)
---

Run in order and stop at the first failing step:

1. `npm run check:versions`
2. `npm run build` (Chrome, `dist/`)
3. `npm run build:firefox` (Firefox, `dist-firefox/`)
4. `npm run lint` (ESLint, then the TypeScript 7 type check)
5. `npm run lint:firefox` (`web-ext lint`; 4 warnings from bundled React/Primer/lodash in `options.js` are expected)

Report each step as pass or fail with the relevant output. For failures, group errors by file and propose minimal fixes; do not apply them unless asked.
