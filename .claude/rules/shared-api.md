---
paths:
    - 'src/shared/**'
---

# Shared API (`src/shared/`)

> Contract of the code used by both the content script and the popup. The export list is in [extension-architecture.md](extension-architecture.md).

- **Signatures are a contract**: `src/content/**` and `src/options/**` consume them through `@shared/*`. When a signature changes, update every caller in the same change.
- **No React and no page DOM structure** here; the code must run in a content script and in the popup. No background script exists.
- **Clipboard payload** ([clipboard-service.ts](../../src/shared/services/clipboard-service.ts)): `text/html` is `<a href="ESCAPED_URL">ESCAPED_TEXT</a>`, `text/plain` is `TEXT — URL` (em dash with spaces). Primary path: `navigator.clipboard.write` with `ClipboardItem`; fallback: `document.execCommand('copy')` with a one-shot `copy` listener. Both must be reachable from a user click.
- **Templates** ([template-service.ts](../../src/shared/services/template-service.ts)): `{{placeholder}}` tokens, whitespace inside the braces allowed, unknown placeholders left as is, an empty template falls back to the default for the link type. The result is plain text; escaping happens only in `buildLinkPayload`. Besides the advertised placeholders, the aliases `{{number}}` and `{{title}}` work for every type (not shown in the popup hints).
- **Config** ([config-service.ts](../../src/shared/services/config-service.ts)): stored in `chrome.storage.sync` under `hyperfriend-config`, merged over `DEFAULT_CONFIG`; `get` never rejects; `setTemplate` writes one template, `setTemplates` several in a single write.
- **Settings import/export** ([settings-transfer-service.ts](../../src/shared/services/settings-transfer-service.ts), model `SettingsFileModel`): `serializeSettings(config, now?)` writes pretty JSON (2 spaces, trailing newline) `{ app: "hyperfriend", schemaVersion: 1, exportedAt, templates }`; the file name is `SETTINGS_FILE_NAME` (`hyperfriend-settings.json`). `parseSettings(text)` returns `{ ok: true, templates }` or `{ ok: false, error }` with a short user-facing message: at most 64 KB (the popup also checks `file.size` before reading), valid JSON object, `app` must be `hyperfriend`, `schemaVersion` the integer `1` (a higher one means "created by a newer version"), `templates` an object, only known `LinkType` keys read, each value trimmed and then a single line of text (no line breaks or control characters) of at most 500 characters (error: `Template "<key>" must be a single line of text up to 500 characters.`), at least one template present. Templates missing from the file keep their value; `configService.setTemplates` applies them with one merged storage write. When the schema changes, bump `schemaVersion` and keep reading older versions.
- **Edge cases to keep handled**: missing `chrome.storage`, storage errors, empty or odd templates, titles with HTML special characters, rejected clipboard writes.
