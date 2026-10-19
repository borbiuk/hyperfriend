---
name: chrome-extension-docs
description: Use when implementing or debugging browser extension APIs (storage, content scripts, action popup, manifest, permissions, etc.) for Chrome or Firefox. Provides local offline Chrome extension documentation plus Firefox MV3 notes.
---

# Chrome extension API — local docs

Use this skill when the task involves Chrome extension APIs, manifest, permissions, or MV3 behavior (and the Firefox differences). Do **not** load all doc files: read only the specific API or topic files relevant to the current task.

## When to use

- Implementing or changing code that uses `chrome.*` APIs (e.g. `chrome.storage`, `chrome.runtime`, `chrome.action`).
- Editing `public/manifest.json` or `public/manifest.firefox.json` (permissions, content scripts, action, Gecko settings).
- Debugging extension behavior, content scripts, or the toolbar popup.
- Checking API types, permissions, or official examples.
- Checking whether something works the same way in Firefox: read [`references/firefox-notes.md`](references/firefox-notes.md).

## Where the docs are

Local offline copies of Chrome extension docs (developer.chrome.com) live next to this file at:

**`references/developer.chrome.com/docs/extensions/`**

A full file index is in **`references/index.md`**. Path structure mirrors the site, for example:

- API reference: `reference/api/<apiName>.md` (e.g. `reference/api/storage.md`, `reference/api/action.md`).
- Manifest: `reference/manifest/<key>.md` (e.g. `reference/manifest/content-scripts.md`, `reference/manifest/web-accessible-resources.md`).
- Concepts: `develop/concepts/<topic>.md` (e.g. `develop/concepts/content-scripts.md`, `develop/concepts/storage-and-cookies.md`).
- How-to: `how-to/...`, `reference/permissions.md`, `messaging.md`, etc.

Firefox is not mirrored; the short notes in `references/firefox-notes.md` list what differs from Chrome for this project. For anything else, cite MDN (`developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions`) from the web.

## Instructions

1. **Identify the relevant doc**: From the task, determine which API or topic is needed (e.g. settings → `reference/api/storage.md`).
2. **Read only that file (or a small set)**: Use the `Read` tool to open the specific `.md` file under `references/developer.chrome.com/docs/extensions/`. Do not read the whole directory or many files at once.
3. **Prefer local docs over web search**: When the doc exists locally, use it instead of searching the web to avoid wrong or outdated snippets.
4. **Keep architecture rules in mind**: Project-specific rules (entry points, manifests, `@shared/*`, GitHub selectors) live in `.claude/rules/` and `AGENTS.md`; this skill is only for browser API/manifest reference.

## Quick path reference

| Topic                         | Path (under `references/developer.chrome.com/docs/extensions/`)                           |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Storage API                   | `reference/api/storage.md`, `reference/api/storage/StorageArea.md`                        |
| Action (toolbar popup)        | `reference/api/action.md`                                                                 |
| Runtime                       | `reference/api/runtime.md`                                                                |
| Manifest (content scripts)    | `reference/manifest/content-scripts.md`, `reference/manifest/web-accessible-resources.md` |
| Permissions                   | `reference/permissions.md`, `develop/concepts/declare-permissions.md`                     |
| Content scripts               | `develop/concepts/content-scripts.md`                                                     |
| Firefox differences (project) | `references/firefox-notes.md` (next to this file, not in the mirror)                      |

When in doubt, check `references/index.md` or search under `references/` to find the right file by name (e.g. `storage.md`, `action.md`).
