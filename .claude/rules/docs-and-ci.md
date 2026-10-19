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

- [build.yml](../../.github/workflows/build.yml) runs on pushes and pull requests to `master` with Node 22, 24 and 26: `npm ci`, `check:versions`, both builds, `lint`, `lint:firefox`. Do not add `check:outdated` (new upstream releases would break CI at random).
- Workflows use least-privilege `permissions` (`contents: read`) and reference only existing npm scripts.
- `scripts/tag-releases.sh` finds the commit by the `version` in `public/manifest.json` and creates tags only locally. Test it with `DRY_RUN=1` only.
