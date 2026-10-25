# 0002. Exact dependency versions and a 7-day update cooldown

- **Status**: accepted (exact versions since the first commit, 2026-10-19; Dependabot with a cooldown since 2026-10-23)

## Context

The extension ships bundled third-party code (React, Primer) to the browser stores and runs on GitHub pages. A range such as `^1.2.0` lets a fresh, possibly broken or malicious release enter a build without a visible change in the repository, and a build is no longer reproducible from the lockfile and `package.json` alone.

## Decision

- Every entry in `dependencies` and `devDependencies` is an exact version. `.npmrc` sets `save-exact=true`, and `npm run check:versions` fails otherwise (it runs in CI).
- Dependabot opens weekly update pull requests for npm and GitHub Actions with a 7-day cooldown, so a release that is pulled in its first days never arrives. GitHub Actions are pinned to a full commit SHA with the tag in a comment.
- `npm audit signatures` runs in CI to check the registry signatures of what is installed.

## Consequences

- Updates are deliberate pull requests, not silent drift. Someone has to review and merge them.
- A brand-new release is not installed for a week, even by hand (the rule for new dependencies is: pick the newest version at least 7 days old).
- `check:outdated` is not run in CI, because new upstream releases would break CI at random.
