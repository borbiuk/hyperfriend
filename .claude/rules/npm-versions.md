---
paths:
    - 'package.json'
    - 'package-lock.json'
    - '.npmrc'
    - 'scripts/check-versions.mjs'
---

# npm versions policy

> Exact versions only.

- **Every** entry in `dependencies` and `devDependencies` is an exact version such as `19.3.1`. Never use `^`, `~`, `*`, `latest` or other ranges.
- npm aliases are allowed with an exact version: `"typescript7": "npm:typescript@7.0.2"`.
- `.npmrc` sets `save-exact=true` and `engine-strict=true` (Node >= 22).
- Add or update dependencies only when the task needs it, and say so explicitly; `npm install` asks for confirmation (see `.claude/settings.json`).

## Updating

```bash
npm install -E <package>@latest      # dependency
npm install -D -E <package>@latest   # dev dependency
npm run check:versions               # fails if anything is not exact
npm run check:outdated               # npm outdated; local use, not run in CI
```

- DO review `package.json` after installing: aliases and overrides must stay exact.
- DON'T hand-edit versions in `package-lock.json`; let npm regenerate it.
- After updates run `npm run build`, `npm run build:firefox` and `npm run lint`.

## TypeScript aliases

- `typescript7` → `npm:typescript@7.0.2`: the compiler used by `npm run typecheck` (`node node_modules/typescript7/bin/tsc --noEmit`).
- `typescript` → `npm:@typescript/typescript6@6.0.2`: the TypeScript 6 package that provides the JavaScript API still required by `ts-loader` and `typescript-eslint`. Do not remove it and do not point it to version 7.
- `ts-loader` runs with `transpileOnly`; type errors surface only in `npm run typecheck` / `npm run lint`.
- When updating either alias, keep the other one in mind and run `npm run lint`.

## Overrides

- `overrides` in `package.json` pin peer relationships (for example `eslint-plugin-react` to the root `eslint` via `$eslint`). Keep them when updating.

## CI

- `.github/workflows/build.yml` runs `npm ci` and `npm run check:versions` on every push and pull request. `check:outdated` is for local use only because new releases would break CI at random.
