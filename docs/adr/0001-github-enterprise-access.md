# 0001. `*.ghe.com` in the manifest, Enterprise Server by optional permission

- **Status**: accepted (2.6.0 on 2026-10-22 added the optional flow, 2.7.0 on 2026-10-22 added the static match)

## Context

GitHub Enterprise has two shapes. Enterprise Cloud with data residency lives on `*.ghe.com` subdomains. Enterprise Server runs on any domain the company chooses, so the manifest cannot list it. A browser extension can only inject a content script into a site it has access to. The first version (2.6.0) asked the user to add every Enterprise domain in the settings, and a user reported no copy buttons on a `ghe.com` site: the setup step was the problem. The requirement became: users of `*.ghe.com` must not configure anything.

## Decision

- List `https://*.ghe.com/*` in the manifest content script `matches`. The browser grants it at install, so `*.ghe.com` works with no setup.
- Keep the optional flow for Enterprise Server: optional host permission `https://*/*`, one exact `https://HOST/*` requested per domain the user adds, and a background script that registers the content script for those domains (`scripting`). Domains under `ghe.com` are refused in that flow, because they do not need it.

## Consequences

- `*.ghe.com` is the only wildcard host in the manifest. It is a new install warning, and Chrome disables the extension on update until the user accepts the new access. The release notes of 2.7.0 say so. The store review may ask for a justification.
- Enterprise Server stays opt-in and exact: nothing is accessed before the user allows one domain.
- The background script stays minimal: it only reconciles the registered scripts with the granted origins.
- Tests cover `*.ghe.com` with a fake host served from snapshots. The browser prompt, a real removal of the permission and a real Enterprise Server are not covered ([testing rules](../../.claude/rules/testing.md)).
