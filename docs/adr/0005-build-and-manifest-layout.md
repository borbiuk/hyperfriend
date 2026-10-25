# 0005. Single-file bundles, two manifests and a version-syncing commit hook

- **Status**: accepted (since the first commit, 2026-10-19)

## Context

Chrome and Firefox both run Manifest V3, but Firefox needs its own `browser_specific_settings` and an event page (`background.scripts`) where Chrome uses a service worker. The manifests name script files directly. The Firefox store reviews the source of bundled code.

## Decision

- Two source manifests, `public/manifest.json` (Chrome) and `public/manifest.firefox.json` (Firefox), that differ only by `browser_specific_settings` and `background`. The unit test `tests/unit/manifest.spec.ts` guards this.
- Webpack writes fixed file names (`[name].js`) and every entry is one self-contained file (no hashes, no vendor or runtime chunks), so the manifests can name them.
- The version is set in `public/manifest.json` only. The Husky pre-commit hook copies it to `package.json` and the Firefox manifest, formats the files, stages every modified tracked file and builds both browsers into `.zip` packages.
- Only the `chrome.*` namespace is used; Firefox MV3 supports it, so there is no `browser.*` polyfill.

## Consequences

- One source tree builds both browsers, and a version can not drift between the three files in a normal commit (the test catches commits made without the hook).
- A commit takes as long as two production builds, and partial commits do not work.
- Content hashes cannot be added without changing both manifests and the tooling.
- The packages can be uploaded to the stores as they are, and the Firefox review gets the source archive described in [development.md](../development.md).
