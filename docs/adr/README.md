# Architecture decision records

Short records of **why** a decision was made. The current rules (the **what**) live in [AGENTS.md](../../AGENTS.md) and [.claude/rules/](../../.claude/rules/); these records do not repeat them.

Each record has a status, the context, the decision and the consequences. They were written on 2026-10-25, after the decisions, from the git history, the release notes and the rules; a date in a record is the date of the commit or release that made the decision.

| Record                                    | Decision                                                              |
| ----------------------------------------- | --------------------------------------------------------------------- |
| [0001](0001-github-enterprise-access.md)  | `*.ghe.com` in the manifest, Enterprise Server by optional permission |
| [0002](0002-exact-dependency-versions.md) | Exact dependency versions and a 7-day update cooldown                 |
| [0003](0003-two-typescript-versions.md)   | TypeScript 7 for type checks, TypeScript 6 for the loaders            |
| [0004](0004-tests-on-github-snapshots.md) | End-to-end tests on saved GitHub pages, plus a daily live check       |
| [0005](0005-build-and-manifest-layout.md) | Single-file bundles, two manifests and a version-syncing commit hook  |

New record: copy the format of an existing one, number it next, add it to the table.
