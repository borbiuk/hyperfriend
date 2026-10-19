---
description: Run ESLint and the TypeScript 7 type check for the whole project
allowed-tools: Bash(npm run lint), Bash(npm run lint:firefox), Bash(npm run check:versions)
---

Run `npm run lint` (ESLint followed by the type check) and `npm run check:versions`. If `dist-firefox/` exists, also run `npm run lint:firefox`. If there are errors or warnings, summarize them grouped by file and propose minimal fixes.
