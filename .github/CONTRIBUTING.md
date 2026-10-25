# Contributing to Hyperfriend

Thanks for helping. Hyperfriend is a small browser extension for Chrome and Firefox (Manifest V3, TypeScript, React for the settings popup). Keep changes **small and focused**; do not refactor code that the change does not need.

## Set up

Requirements: Node.js 24.22.1 or newer, plus `jq` and `zip` (the pre-commit hook builds and zips both browsers).

```bash
npm install
npx playwright install chromium   # once, for the e2e tests
npm run build                     # Chrome, into dist/ (Load unpacked in chrome://extensions)
```

Firefox: `npm run build:firefox`, then load `dist-firefox/manifest.json` in `about:debugging`. More in [docs/development.md](../docs/development.md).

## Checks to run before a pull request

| Command                                     | What it checks                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run check:versions`                    | Every dependency has an exact version (no `^`, no `~`)                       |
| `npm run format:check`                      | Prettier (`npm run format` fixes it)                                         |
| `npm run lint`                              | ESLint and the TypeScript 7 type check                                       |
| `npm run lint:docs`                         | Markdown lint, relative links, `RELEASE_NOTES.md` headings                   |
| `npm run lint:unused`                       | Unused files, exports and dependencies (knip)                                |
| `npm run build` and `npm run build:firefox` | Both builds; `npm run lint:firefox` runs `web-ext lint` on the Firefox build |
| `npm run test:unit`                         | Logic of `src/shared` and the manifest guard (no browser)                    |
| `npm run test:e2e`                          | The built extension in Chromium on saved GitHub pages (no network)           |

CI runs the same checks on every push and pull request. The tests cover **Chromium only**; Firefox needs a manual check in `about:debugging`. `npm run test:live` (real github.com) and `npm run test:snapshots` need a network and are run on demand.

## Code and tests

- Follow the existing style: tabs, single quotes, block `if` with `return` (no one-line `if`), English comments. Prettier and ESLint enforce most of it.
- Reuse code from `src/shared` through the `@shared/*` alias.
- Every behavior change comes with tests, written to the standard in [.claude/skills/e2e-review/references/rules.md](../.claude/skills/e2e-review/references/rules.md). How to write and run them: [.claude/rules/testing.md](../.claude/rules/testing.md).
- **Dependencies**: exact versions only. Install with `npm install -E <package>@latest` (add `-D` for a development dependency), then run `npm run check:versions`.
- **Manifests**: `public/manifest.json` and `public/manifest.firefox.json` must differ only by `browser_specific_settings` and `background`. The unit test `tests/unit/manifest.spec.ts` guards this and the permissions. A new permission or site match is a user-visible change: explain why in the pull request.
- **New keyboard shortcut**: five places change (enum value, default, handler, row in the settings, docs). The checklist is in [.claude/rules/extension-architecture.md](../.claude/rules/extension-architecture.md).
- **GitHub changed its markup**: refresh the page snapshots with `npm run test:snapshots`, review the diff, then fix the selectors in `src/content`. See [.claude/rules/github-dom-selectors.md](../.claude/rules/github-dom-selectors.md).

## Documentation

A user-visible change (setting, shortcut, placeholder, permission) goes into `docs/`, `LISTING.md` and `RELEASE_NOTES.md` together. Describe the code as it is: every command, path and value must match the code. Docs are written in simple English.

## Commits and pull requests

- A pull request title (it becomes the commit title) starts with an upper case letter, is written in the imperative mood ("Add a copy button"), has at most 72 characters, does not end with a period and has no `WIP`, `fixup!` or `squash!`. CI checks everything except the imperative mood.
- One change per pull request. The maintainer pushes small changes straight to `master`; outside contributions come as pull requests.
- The Husky pre-commit hook syncs the version, formats the files, stages **every modified tracked file** and builds both browsers, so a commit takes a while and partial commits do not work. New files must be added with `git add` yourself.
- Do not change the version or `RELEASE_NOTES.md` for a repository-only change. A release has its own commit, `Release x.y.z: <summary>`; pushing the tag `x.y.z` makes the release workflow build the packages and create the GitHub Release.

## Reporting

- Bugs and ideas: [issues](https://github.com/borbiuk/hyperfriend/issues). More in [SUPPORT.md](SUPPORT.md).
- Security problems: **not** in a public issue, see [SECURITY.md](../SECURITY.md).
- Everyone follows the [Code of Conduct](../CODE_OF_CONDUCT.md).
