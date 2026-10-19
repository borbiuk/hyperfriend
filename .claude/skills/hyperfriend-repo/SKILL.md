---
name: hyperfriend-repo
description: Hyperfriend browser extension (MV3, Chrome and Firefox)—read AGENTS.md, respect architecture, manifest, GitHub selector and exact-version rules before editing TypeScript, manifests or package.json.
---

# Hyperfriend repo (Claude Code)

Hyperfriend adds a copy-link button to GitHub Pull Requests and Issues and copies a rich hyperlink (`text/html` + `text/plain`) for pasting into Teams, Slack and other chats.

1. Read **[AGENTS.md](../../../AGENTS.md)** at the repository root for entrypoints, build commands, MV3 boundaries, the dependency policy, and the multi-agent file ownership.
2. Where things live:
    - `src/content/` — content script: page detection, DOM scanning, button injection and SPA observer ([github-dom-selectors.md](../../rules/github-dom-selectors.md)).
    - `src/options/` — toolbar popup (React + Primer React, light/dark).
    - `src/shared/` — models, constants, services (`renderTemplate`, `configService`, `copyLink`), utils; import via `@shared/*`.
    - `public/manifest.json` and `public/manifest.firefox.json` — two manifests kept in sync ([extension-architecture.md](../../rules/extension-architecture.md)).
    - `webpack/` — builds for `dist/` (Chrome) and `dist-firefox/` (Firefox); fixed bundle names, no hashes.
3. No background script or service worker. Settings are in `chrome.storage.sync` under `hyperfriend-config`.
4. Dependencies are exact versions only ([npm-versions.md](../../rules/npm-versions.md)); run `npm run check:versions` after changing them.
5. Project skills live under `.claude/skills/`: use **`chrome-extension-docs`** for API, manifest and Firefox questions. Subagents live in `.claude/agents/`; the **`technical-writer`** agent handles documentation work.
6. Verify with `npm run build`, `npm run build:firefox` and `npm run lint` (details in the `.claude/commands/`).
7. Keep changes minimal unless the user explicitly asks for a broad refactor (see working rules in [CLAUDE.md](../../../CLAUDE.md)).
