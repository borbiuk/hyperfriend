# 0004. End-to-end tests on saved GitHub pages, plus a daily live check

- **Status**: accepted (2026-10-21, with the Playwright test suite)

## Context

The extension reads GitHub's markup, which GitHub changes without notice. Tests against the real site are slow, need a network and fail for reasons outside the code. Tests with hand-written HTML miss what the real pages look like. Playwright can load an unpacked extension into Chromium only.

## Decision

- The `e2e` tests run the built extension in Playwright's Chromium against **saved GitHub pages** (the page snapshots in `tests/e2e/fixtures/pages/`), with no network. They run in CI on every push and pull request.
- A daily workflow (`markup.yml`) captures fresh snapshots, commits them to `master`, runs the e2e tests on them and a small `live` smoke suite on real github.com. A failure opens one `markup-drift` issue.
- Retries are off. A flaky test is a bug to fix.

## Consequences

- A GitHub markup change shows up within a day as a red build and an issue, while normal CI stays deterministic.
- By design, snapshots that break the tests are already on `master`, so every following build stays red until the selectors are fixed.
- Only Chromium is covered; Firefox needs a manual check, and tests must never claim Firefox coverage.
- Snapshots are large and excluded from Prettier and from code scanning.
