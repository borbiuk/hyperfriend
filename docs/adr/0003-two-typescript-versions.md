# 0003. TypeScript 7 for type checks, TypeScript 6 for the loaders

- **Status**: accepted (type check on TypeScript 7 since the first commit, 2026-10-19; the two aliases may be revisited when the loaders support 7)

## Context

TypeScript 7 is the native compiler and is much faster for `tsc --noEmit`. `ts-loader` and `typescript-eslint` still need the JavaScript API of TypeScript 6, which version 7 does not provide in the same form.

## Decision

- `typescript7` (an npm alias of TypeScript 7) runs the type check: `node node_modules/typescript7/bin/tsc --noEmit` for `src/` and `tests/`.
- `typescript` (an alias of the TypeScript 6 compat package) stays for `ts-loader` and `typescript-eslint`, and never gets a major update (Dependabot ignores it).
- `ts-loader` runs with `transpileOnly`, so type errors surface only in `npm run typecheck` and `npm run lint`.

## Consequences

- Two compilers are installed. Updating one means keeping the other in mind and running `npm run lint`.
- Tools that look for `typescript` find version 6 and tools that call the type check find 7. `knip` is told that both aliases are used on purpose.
- Webpack builds do not fail on a type error; `lint` is the gate for types.
