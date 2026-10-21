# Hyperfriend test standard

> The rules `/e2e-review` applies to the Playwright tests of Hyperfriend (`unit`, `e2e`, `live`). Test writers follow the same rules (the `/playwright` skill).

Built from the Playwright docs, eslint-plugin-playwright and the ISTQB syllabi (CTFL, CTAL-TA, CTAL-TAE, CTAL-TTA, CT-TAS) for a browser extension with no backend. Rule IDs are stable because other files cite them: a removed ID is never reused.

Format: **ID — rule** · default severity, then what to look for and the fix.

## Contents

- [Test environment](#test-environment-facts-the-rules-rely-on): the projects, the extension setup, the oracle
- [SCN — Scenario design](#scn--scenario-design): SCN-1 to SCN-8
- [AST — Assertion depth](#ast--assertion-depth): AST-1 to AST-12
- [DATA — Settings, fixtures and isolation](#data--settings-fixtures-and-isolation): DATA-1 to DATA-10
- [SYNC — Synchronization and flakiness](#sync--synchronization-and-flakiness): SYNC-1 to SYNC-17
- [MIG — Replacing or restructuring tests](#mig--replacing-or-restructuring-tests): MIG-1 to MIG-4
- [STY — Code style](#sty--code-style): STY-1 to STY-6
- [PR — Pull-request hygiene](#pr--pull-request-hygiene): PR-1 to PR-7
- [EXT — Browser extension specifics](#ext--browser-extension-specifics): EXT-1 to EXT-10
- [UNIT — Unit tests](#unit--unit-tests): UNIT-1 to UNIT-7
- [Severity](#severity): levels, examples and the verdict
- [Top defects to check first](#top-defects-to-check-first)
- [Tool messages → rules](#tool-messages--rules): lint rule to rule ID map

## Test environment (facts the rules rely on)

Where things live: `playwright.config.ts`, `tests/unit/**`, `tests/setup/dist.setup.ts`, `tests/e2e/fixtures/{extension.ts,github.ts,defaults.ts,capture-pages.mjs}`, `tests/e2e/fixtures/pages/*.html` with `index.json`, `tests/e2e/*.spec.ts` (`seed.spec.ts` is the seed of the Playwright test agents), `tests/live/**`, `tests/tsconfig.json`. CI: `npm run test:unit` in job `build` and job `e2e` (Node 24) in `build.yml`, and `live.yml` (weekly and manual).

- **`unit`**: Node, no browser. Pure logic from `src/shared` imported through `@shared/*`; there is no `chrome` global, so a test that needs `chrome.storage.sync` builds a per-test fake.
- **`e2e`**: the built extension from `dist/` in Playwright's bundled Chromium (`channel: 'chromium'`, headless unless `--headed`) via `launchPersistentContext` with `--disable-extensions-except` / `--load-extension`. The `dist` setup project runs `npm run build` before it.
    - The extension id is computed from the absolute `dist/` path (there is no service worker to read it from).
    - `context.route('**/*')` serves script-stripped snapshots of public `react/react` pages (formerly `facebook/react`): pull request list, PR 9713 (Conversation, Files changed, Commits), issue list, issue 10, a pull request and an issue search page (looked up by path + query); avatar images get a tiny PNG (or a 404 with `avatars: 'error'`). A GitHub path without a snapshot gets a 404 and every other host is aborted (static asset hosts and static github.com paths such as `/images/`, `/assets/`, `/favicons/` quietly); both are reported and fail the test. Item numbers, titles and authors are in `pages/index.json` (`snapshotItems`); the literal default settings for expected stored values are `DEFAULT_STORED_CONFIG` in `defaults.ts`. A known product gap is a `test.fail()` test with an `issue` annotation linking the GitHub issue (SCN-6).
    - Clipboard permissions are granted and the clipboard is read for real. Settings are seeded with `storage.seedConfig` in `chrome.storage.sync` from an extension page. The popup is tested as `chrome-extension://<id>/options.html`.
- **`live`**: real github.com (`react/react`), anonymous, on demand (`npm run test:live`, which sets `HYPERFRIEND_LIVE`; the project does not exist without it); a weekly GitHub Actions run (`live.yml`, Mondays 06:00 UTC, plus manual dispatch). Never blocks CI.
- **Firefox is not covered**: Playwright cannot load extensions into Firefox. Firefox stays `npm run lint:firefox` plus manual checks (EXT-8).
- **The oracle** (what correct behaviour is) lives in [github-dom-selectors.md](../../../rules/github-dom-selectors.md) (pages, buttons, shortcut, toast, avatars, SPA rescans), [shared-api.md](../../../rules/shared-api.md) (payload, templates, config, shortcuts, settings file) and [popup.md](../../../rules/popup.md).

---

## SCN — Scenario design

**SCN-1 — One behaviour per test.** · Major

- _Detect_: one `test()` that mixes unrelated concerns: the list button and the keyboard shortcut, a copy and a popup setting, a positive case and an unrelated negative one.
- _Fix_: split; each test arranges its own state.
- _Not a finding_: one copy on one page state with its observable outcomes in steps (click → exact payload → "Copied!" tooltip); a positive control placed before a negative check on purpose (EXT-5).

**SCN-2 — One full-proof test per page kind and entry point; logic variations go to unit tests.** · Major

- _Full proof_: the exact clipboard payload (EXT-1), the user feedback (tooltip or toast text, AST-8) and the button's identity (accessible name with the number, AST-2). Needed once for each of: PR list, PR page (button), PR Conversation tab (Shift+C), Issue list, Issue page (button and Shift+C), search results.
- _Point e2e tests_ cover only what needs a browser: shortcut skipped in a text field or an open dialog, button out of view → toast, PR sub-tabs (button yes, shortcut no), SPA navigation (EXT-6), avatars on and off.
- Template rendering cases (brackets, escapes, unknown placeholders, HTML special characters, empty template fallback) are unit tests on `renderTemplateParts` / `buildLinkPayload`. One e2e test with a seeded custom template proves the content script uses the stored template.
- _Detect_: a page kind with only a presence check; template edge cases multiplied through the browser.

**SCN-3 — Parameterize independent cases; stay DAMP when the Arrange differs.** · Major

- _Detect_: `for (…) { await test.step(…) }` over independent cases (pages, templates, key combinations): it stops at the first failure and later cases do not start clean.
- _Fix_: one top-level `test()` per case, generated from a table; a missing precondition is `test.skip(condition, reason)` inside the generated test.
- _Not a finding_: one Arrange and Act followed by a loop of assertions (every row of a list has exactly one button); near-identical tests whose Arrange really differs (keep them explicit, do not force a config object).

**SCN-4 — Step and test titles match their assertions.** · Major

- A title that promises a check the body does not make is a false claim of coverage. Add the assertion or rename.

**SCN-5 — Arrange is visible.** · Minor

- Seeding, routing and permissions live in fixtures or in `test.step('setup: …')` steps that return what the test needs; outcome steps are named for what they prove.

**SCN-6 — Known gaps are explicit and removed when fixed.** · Minor

- `test.fixme(…)`, `test.skip(condition, '<reason>, <issue link>')` or `test.fail(…)` with an `issue` annotation; never a commented-out test or an emptied body. A gap comment left next to a check that now passes is a finding.
- Firefox is a stated scope limit (EXT-8), not a per-test skip.

**SCN-7 — Tests are independent and parallel-safe.** · Major

- _Detect_: an outer `let` shared between tests; a test that relies on a previous one; `describe.serial` / `mode: 'serial'` without a real reason; side effects at module or `describe` level (they run at collection time); a worker-scoped context handed to tests that change storage or the clipboard without a reset (DATA-3).

**SCN-8 — No branching on page content.** · Minor

- `if (await button.isVisible())` hides what the test proves. Snapshots are deterministic, so assert unconditionally; in `live`, use `test.skip(condition, reason)` at the top of the test.

---

## AST — Assertion depth

**AST-1 — The test owns its outcome assertions.** · Major

- Fixtures (`extension.ts`, `github.ts`) arrange and return data: the extension id, a page, `readClipboard(page)` → `{ html, text }`, `writeClipboardSentinel(page, text)`, `storage.seedConfig(overrides)`, `storage.getConfig()`. The spec asserts. A fixture that asserts the payload, the toast or the button hides coverage from the reader.

**AST-2 — Assert concrete values, not presence.** · Major

- After a copy: the exact payload (EXT-1), not "the clipboard is not empty".
- A button: its accessible name `Copy link to pull request #N` / `Copy link to issue #N` and its place (inside that item's row or after the detail header's number), not "a button exists".
- A test about one item proves it is that item's: the number in the name **and** the URL in the payload.

**AST-3 — List coverage proves every item, not one.** · Major

- _Detect_: "our row has a button" as the only list assertion.
- _Fix_: the button count equals the number of title links in the snapshot (a fixture constant, `toHaveCount`), each button's name matches its row, and after a rescan (mutation or SPA navigation) there is still exactly one per item. Where the snapshot has comment or filter links, assert they got no button.

**AST-4 — Accessible names and announcements are asserted.** · Minor

- _Why_: screen-reader users get the copy result only through the button's name, `aria-keyshortcuts` and the live region; a test that checks only the visible tooltip misses a broken announcement.
- _Look for_: tests of the copy button, the toast, the shortcut recorder or the popup switches that assert visuals only.
- _Fix_: assert the accessible name (`getByRole('button', { name: … })`), `aria-keyshortcuts` while the shortcut is enabled (and its absence when disabled), and the live-region text after a copy, a saved shortcut or "Reset all settings".

**AST-5 — UI state is behaviour.** · Major

- Content script: tooltip text ("Copy link to pull request" → "Copied!" / "Copy failed"), `aria-keyshortcuts` on the detail title button only while the shortcut is enabled and available on that page, no tooltip hint for the shortcut.
- Popup: switch state, the shortcut "Reset" button shown only when the keys differ from the default, messages in the `role="alert"` / `role="status"` regions, the "Saved" status.

**AST-6 — Downloads are verified as files.** · Major

- Export: `waitForEvent('download')` armed before the click (SYNC-4); `suggestedFilename()` is `hyperfriend-settings.json`; the file is saved under `testInfo.outputPath()` and parsed: `app`, `schemaVersion: 3`, and the seeded templates, shortcuts and display values.
- Import: `setInputFiles` with a file the test wrote under its output path or a committed fixture; assert "Settings imported." **and** the stored config.

**AST-7 — No assertion that cannot fail.** · **Critical** (Minor when a later assertion would catch the same defect)

- A vacuous assertion reports coverage that does not exist. Shapes to look for in this repo:
    - the clipboard read without a known starting value, so a payload left by an earlier step passes (EXT-2);
    - absence asserted right after an action (`toBeHidden()` on the toast right after a key press) — it passes before anything could happen (EXT-5);
    - the expected payload computed with `buildLinkPayload` / `renderTemplate`, or the title read from the page under test: the oracle is the system under test. Build it from the test's own constants;
    - `toContain('/pull/')` or a regex on the payload instead of equality;
    - `.first()` on `[data-hyperfriend="copy-button"]` in a list: passes when other rows have no button or two;
    - a seeded setting equal to the default: the test passes whether or not the seed was applied (DATA-2);
    - `expect(locator).toBeTruthy()`, `expect(x)` without a matcher, a matcher without `()`, `expect` inside `if` / `catch`, an empty `catch {}` or `.catch(() => {})` around an action;
    - an `expect.soft` that a later step depends on.
- _Fix_: scope to the specific item; exact equality with values from the test's data; positive control before absence (EXT-5); assert unconditionally.

**AST-8 — User feedback is asserted explicitly in the spec.** · Major

- Literal texts: tooltip "Copied!" / "Copy failed" (`[data-hyperfriend="tooltip"]` or the live region), toast "Link copied" / "Copy failed" (`[data-hyperfriend="toast"]`), popup "Saved", "Settings imported.". Never asserted inside a fixture.

**AST-9 — Time is compared through injected values.** · Major

- Unit: `serializeSettings(config, now)` with a fixed `Date`, then the exact `exportedAt`. E2E: `exportedAt` is a valid ISO timestamp; never compared with the test's own `new Date()`.

**AST-10 — Platform-dependent display strings follow one mirror.** · Minor

- Shortcut labels and some messages depend on `isMacPlatform()` (`⇧C` vs `Shift` + `C`, the "no modifier" wording). The expected value comes from one test helper keyed on the platform the page or process reports, never a literal from the author's machine (a Mac literal fails on Linux CI). Clipboard payloads are not display strings: they are exact literals (AST-7).

**AST-11 — Validation coverage is complete and scoped.** · Minor (one finding per form or function)

- Every user-visible message is covered somewhere, by its text: the shortcut recorder (no modifier, browser-reserved, already used by another Hyperfriend shortcut, the GitHub warning), template length, and every Import error.
- The logic that produces the messages (`validateShortcut`, `parseSettings`) is unit-tested at both sides of each limit (UNIT-6). In e2e, one message per region is enough when unit tests cover the rest.
- Several invalid inputs at once only while each message is asserted on its own; a form-level outcome proves nothing about a field unless that field is the only invalid one.

**AST-12 — Web-first assertions only.** · Major

- `expect(await loc.isVisible()).toBe(true)`, `expect(await loc.count())…`, `expect(await loc.textContent())…` → `toBeVisible()`, `toHaveCount()`, `toHaveText()`. Values that are not locators (clipboard, storage) are polled: `await expect.poll(() => readClipboard(page)).toEqual(expected)`.

_Good practice (do not flag)_: asserting `aria-keyshortcuts`; recording `event.defaultPrevented` with a page-side listener (EXT-5); counting buttons before and after a rescan.

---

## DATA — Settings, fixtures and isolation

There is no backend. "Data" is the extension's settings in `chrome.storage.sync`, the GitHub page snapshots, and sample `LinkTargetModel`s / config objects in unit tests.

**DATA-1 — Arrange through storage and fixtures; the popup UI only when the popup is under test.** · Major

- Seed `chrome.storage.sync` from an extension page (`page.evaluate` on `options.html`) and await the write **before** opening the GitHub page: the content script reads the config once at start. A change while the page is open is a different behaviour (live update, SYNC-13).
- _Detect_: popup clicks or typing used to set up a content-script test.

**DATA-2 — Seeded settings use the stored shape and differ from the defaults when they matter.** · Major

- The key is `CONFIG_STORAGE_KEY` (`hyperfriend-config`) from `@shared/constants`; the value starts from `cloneDefaultConfig()` with overrides and carries the internal `templateFormat: 2` marker. Without the marker `configService` treats the data as 1.x / 2.0.0 and escapes every `[` `]` in the templates, so a bracket template silently stops making a link (unless the test is about that migration).
- A seed that proves something must differ from the default, or the test passes without it.

**DATA-3 — Every test starts from a clean state.** · Major

- A new persistent context per test (its own temporary user data dir), or a worker context where every test clears storage, closes its pages, resets its routes and seeds a new clipboard sentinel. Do not flag the cost of a fresh launch.

**DATA-4 — No live network outside `live`.** · Major

- Every request from the e2e browser is routed: github.com to snapshots, the avatar host to a PNG, everything else aborted, and an unexpected request fails the test instead of passing silently. `unit` makes no network calls. `live` never runs on pushes or pull requests and never blocks a merge.

**DATA-5 — Inputs respect product limits unless they probe them.** · Major

- Templates: one line, at most 500 characters. Shortcuts: at least one modifier and not browser-reserved; otherwise `normalizeShortcut` drops the keys on read, the default applies and the test passes for the wrong reason. Settings files: at most 64 KB.

**DATA-6 — No signed-in GitHub session.** · **Critical**

- Snapshots are captured signed out; no cookies, `storageState`, tokens or credentials in tests, fixtures or workflows; `live` runs anonymous. Pages that need sign-in (`/pulls`, `/issues` dashboards) stay manual checks.

**DATA-7 — Parallel-safe resources.** · Major

- Each context has its own user data dir; downloads and generated files go under `testInfo.outputPath()`; no fixed ports or shared temporary paths; never assert the clipboard of a browser that another test is using.

**DATA-8 — Time-stable data.** · Major

- No current date or year in expectations. Relative times in snapshots ("3 days ago") are frozen text; do not assert them.

**DATA-9 — Act on the item the test names.** · Major

- `getByRole('button', { name: 'Copy link to pull request #123', exact: true })`, or a locator inside that item's row; not `.first()` / `.nth(i)` on all buttons.

**DATA-10 — Constants come from one place.** · Major

- Repository, item numbers, titles and snapshot files are fixture constants (`github.ts`: `REPOSITORY`, `PAGES`, `snapshotUrl`, `snapshotItems`); the extension id is computed (EXT-7); the `dist/` path comes from `extension.ts`. Expected payloads are built from those constants in the test. A `https://github.com/react/react/...` literal repeated across specs is a finding; the URL inside one exact expected payload is not.

---

## SYNC — Synchronization and flakiness

**SYNC-1 — No hard waits.** · **Critical**

- `page.waitForTimeout()` and sleep loops, including "let the 150 ms observer debounce settle" or "wait for the tooltip to reset". Wait for the state with a web-first assertion or `expect.poll`.

**SYNC-2 — No `networkidle`.** · **Critical** (bare) / Major (bounded)

- Also `{ waitUntil: 'networkidle' }` on `goto()`, `reload()`, `waitForURL()`. Wait for a specific element instead.

**SYNC-3 — Every async Playwright call is awaited.** · **Critical**

- Including `page.evaluate` (storage seeding, clipboard reads), `context.grantPermissions`, `page.route`, `test.step`. Exception: a wait promise armed before an action and awaited right after.

**SYNC-4 — Event waits are armed before the action.** · Major

- `waitForEvent('download')`, `context.waitForEvent('page')`, `waitForRequest`: in one `Promise.all` with the action, or stored in a variable before it. Never `await action; await page.waitForEvent(…)`.

**SYNC-5 — Explicit waits only for an objective race.** · Minor

- Auto-waiting covers most cases; an extra `waitForURL` or `waitFor()` before a normal action or assertion is clutter. A justified wait has a one-line comment naming the race.

**SYNC-6 — Wait for the extension to be ready before acting.** · Major

- The first scan and the shortcut listener start only after the config has loaded. The injected title button (`[data-hyperfriend="copy-button"]` in the header) is the readiness signal: pressing Shift+C right after `goto()` races the listener. In the popup, wait for the loaded state (a field showing the seeded value) before typing.

**SYNC-7 — Polling with `expect.poll` / `toPass`, with a timeout.** · Major

- No `Date.now()` deadlines, `for (;;)` loops or manual retry counters; `toPass()` always gets an explicit `timeout` (its default retries until the test times out).

**SYNC-8 — Overlays are gone before the next interaction.** · Major

- After closing the "Reset all settings?" dialog, cancelling the shortcut recorder or pressing Escape on a menu: `await expect(<the element that would intercept>).toBeHidden()` before the next step.

**SYNC-9 — The popup's save finishes before the result is read.** · Major

- Template fields save about 300 ms after typing. Wait for the "Saved" status or poll storage before reading storage, reloading or closing the page. Flush on blur or `pagehide` is its own behaviour with its own test.

**SYNC-10 — `.first()`, `:visible` and `{ force: true }` need a root cause; generic text needs a scope.** · Major

- Detail pages can repeat the title in a sticky header: scope to the main header instead of `.first()`. `dispatchEvent('click')` is `force` in disguise.
- Accessible names and text match as case-insensitive substrings by default: `name: 'Copy link to pull request #1'` also matches `#12` and `#123`. Use `exact: true` or an anchored regex.
- A kept `.first()` / `:visible` carries a one-line comment explaining why the duplicates are equivalent.

**SYNC-11 — A `has:` inner locator is not re-rooted outside the row.** · **Critical**

- `rows.filter({ has: page.locator('[data-hyperfriend="copy-button"]') })` is correct (resolved inside each row). Chained from another scope (`has: list.locator(…)`) or naming an ancestor outside the row, it matches nothing and every negative check on it passes. An attribute of the row itself goes in `.and(…)`.

**SYNC-12 — Route handlers are precise and fail loudly.** · Minor

- Snapshots are matched by exact pathname (and the query where it selects the page, as for `/search?type=…`); an unknown github.com path is aborted and reported, never answered with a fallback page or passed to the real network with `route.continue()`.

**SYNC-13 — Settings changed after load reach the page asynchronously.** · Major

- With a GitHub page open, a storage change (avatars off, shortcut disabled, new template) arrives through `storage.onChanged` and the next scan. Assert the resulting DOM with a web-first assertion; never assume it is immediate, and do not reload to "apply" it unless startup is the behaviour under test.

**SYNC-14 — Flakiness is not fixed with retries, fewer workers or bigger timeouts.** · **Critical**

- Raising `retries`, lowering `workers` or raising timeouts as a "fix" masks races; fix the race. `{ timeout: 0 }` disables a timeout (Major). A justified longer timeout is a named constant with a reason (Minor).
- Exception: the `live` project may have retries in its own config, with a comment (real network).

**SYNC-15 — Routes, permissions and listeners are set before navigation.** · Major

- `page.route` / `context.route`, `grantPermissions`, `addInitScript`, console and `pageerror` listeners come before `goto()`; otherwise the first requests and errors are missed.

**SYNC-16 — No legacy or redundant waits.** · Major (legacy) / Minor (redundant)

- `waitForNavigation()` → `expect(page).toHaveURL(…)`; `waitForSelector()` → a locator assertion; `waitFor()` / `isVisible()` right before `click()` on the same element adds nothing.
- `keyboard.press()` runs no actionability checks: the focus it relies on is established explicitly (document body for a positive shortcut test, the text field for the "skipped while typing" test).

**SYNC-17 — Mock only the third party; the extension's own paths stay real.** · Major

- github.com and the avatar host are the test environment: routing them is required in `e2e`.
- Never stub `navigator.clipboard`, `chrome.storage`, `document.execCommand` or the content script in a happy-path e2e test. The clipboard is read for real.
- An injected failure (avatar image error, a failing clipboard write to see "Copy failed") is allowed when the test is about that failure **and** asserts the failure state is rendered. A stub in the page's main world does not reach the content script's isolated world, so only the rendered result proves it took effect.
- The route is registered before the request and the test asserts the routed page rendered (for example its title heading), so an unmatched route cannot pass silently.

---

## MIG — Replacing or restructuring tests

**MIG-1 — Coverage parity is mandatory; extension is welcome.** · Major

- A rewritten spec, or one moved onto new fixtures, covers every scenario of the old one. Removing a check needs a reason in the PR description.

**MIG-2 — No coverage gap, no dead code.** · Major

- Do not delete the old spec before its replacement is merged. No fixture, helper or snapshot without a consumer "for the next PR".

**MIG-3 — Changed expectations are explained.** · Major

- Editing an expected payload, label or count to make a test pass needs the product change behind it (the matching `RELEASE_NOTES.md` entry or source change) named in the PR. Silent re-baselining drops coverage.

**MIG-4 — Superseded code is removed.** · Minor

- Once the replacement is merged, the old spec and its now-unused helpers go in the follow-up.

---

## STY — Code style

**STY-1 — Comments explain why, never what.** · Minor

- Allowed: a workaround, a browser quirk, a race, a snapshot detail the test relies on. Flag narration, AI provenance notes, `// TODO` in merged code, commented-out code, and comments the change made stale.

**STY-2 — TypeScript and repo conventions.** · Minor

- Block `if` statements, tabs, single quotes (ESLint and Prettier), explicit return types on exported helpers, no `any`, `async` / `await` instead of `.then()` chains, `@shared/*` to reach `src/shared` (never `../../src/...`).

**STY-3 — Reuse before writing.** · Minor

- Use the fixtures' helpers (clipboard read, storage seed, popup opening, snapshot routing) instead of inline copies; flag duplicated utilities.

**STY-4 — No debug leftovers or legacy page APIs.** · **Critical** for `test.only` / `page.pause()`; Major for `evaluate` closures; Minor otherwise

- `test.only`, `test.describe.only`, `page.pause()`; `console.log` stage logging in specs; `headless: false` committed in config.
- `page.$`, `page.$$`, `page.$eval`, `page.click(selector)` → the Locator API.
- `page.evaluate(() => outerVar)`: the callback runs in the browser; pass values as the argument.

**STY-5 — Labels and names are accurate.** · Minor

- Typos, or titles that contradict the data ("shortcut disabled" with `enabled: true`).

**STY-6 — Spec files export nothing and are never imported.** · Minor (export) / Major (a spec imports a spec)

- Playwright refuses to load a run where a test file imports another test file; `--list` shows it. Shared values live in fixture or constant modules.

---

## PR — Pull-request hygiene

**PR-1 — The description says what and why.** · Major (empty or missing what/why) · Minor (stale details)

- Use the repository's pull request template. For new coverage, name the scenarios covered and those left out (Firefox, sign-in pages, anything manual). For a flaky fix, the root cause.

**PR-2 — Evidence of a green run.** · Minor

- A CI run or a local `npx playwright test` result for the changed specs; a flaky fix shows `--repeat-each`. A change to a shared fixture shows the specs that use it, not only the new one.

**PR-3 — Config and tooling changes are justified; Playwright is pinned.** · Major (config, version) / Minor (otherwise)

- Every `playwright.config.ts` change (projects, retries, workers, timeouts, `use`) has its own justification.
- `@playwright/test` and `eslint-plugin-playwright` are exact versions ([npm-versions.md](../../../rules/npm-versions.md)); a Playwright bump goes in its own PR, and CI installs the browser from that same package (`npx --no playwright install --with-deps chromium`).
- Regenerated snapshots come from the capture script in their own commit, with the source URLs and the capture date in the PR. Hand edits to a snapshot are named and minimal.
- The `live` workflow runs only on a schedule or manual dispatch, with `permissions: contents: read`.

**PR-4 — Traceability.** · Minor

- Link the GitHub issue when there is one (the template's `Fixes` line).

**PR-5 — "Resolved" means fully changed.** · the original finding's severity

- A finding the author marks as fixed must have a change that covers all of it. A partial fix is reported as what is done plus what is still missing, at the original severity. A new problem introduced by the fix is a new finding.

**PR-6 — Docs follow the change.** · Minor

- Moving test paths, renaming npm scripts or changing a convention updates `README.md` (scripts, file structure), `AGENTS.md`, the matching `.claude/rules/` file, the [playwright skill](../../playwright/SKILL.md) and this standard in the same PR ([maintaining-agent-context.md](../../../rules/maintaining-agent-context.md)).

**PR-7 — Nothing secret or personal is committed, in any commit of the PR.** · **Critical**

- Tokens, cookies, `storageState` files, `.env`, credentials. Anything added in one commit and removed in a later one is still in the history: the fix is rotating the secret, not deleting the file.
- **Snapshots are synthetic-safe**: captured signed out, scripts removed, comment and review bodies stripped, no email addresses, no signed-in user data, no CSRF tokens or nonces. Public repository metadata the tests need (item titles, numbers, author logins for the avatar rows) is fine. Never quote the leaked value in a finding.

---

## EXT — Browser extension specifics

**EXT-1 — The clipboard payload is asserted exactly, in both flavours.** · Major (Critical when no clipboard assertion backs a "copies" claim, AST-7)

- `text/plain` equals `TEXT — URL` (em dash with spaces). `text/html` equals `BEFORE<a href="URL">LINK</a>AFTER` with HTML special characters escaped ([shared-api.md](../../../rules/shared-api.md)). The URL is canonical: no `/files`, query or hash.
- Chromium may wrap HTML on read (for example a `<meta charset>` prefix). One helper strips only that wrapper; then the whole fragment is compared exactly. `toContain` on a part of the payload is AST-7.

**EXT-2 — The clipboard is read for real, from a known starting value.** · Major

- Grant `clipboard-read` and `clipboard-write` for `https://github.com` on the context; read with `navigator.clipboard.read()` in a page.
- Before the action, write a sentinel unique to the test; a positive test polls until the clipboard equals the expected payload, a negative test proves it still holds the sentinel (EXT-5).

**EXT-3 — Keyboard tests use real key events.** · Major

- `page.keyboard.press('Shift+C')`, or `Input.dispatchKeyEvent` through a CDP session with `key` and `code` set separately for layout cases (a Cyrillic `С` on `KeyC`).
- Never `dispatchEvent(new KeyboardEvent(…))`: untrusted events carry no user activation, so the clipboard path differs and the test proves something else.
- Each skip case (text field, `[contenteditable]`, open dialog, key repeat, wrong page) is its own test with explicit focus.

**EXT-4 — Locators follow the product's selector rules.** · Major (hashed class, position, XPath) / Minor (a weaker but stable choice)

- Extension DOM: role and accessible name (`getByRole('button', { name: 'Copy link to issue #7', exact: true })`), and the `data-hyperfriend` markers (`copy-button`, `avatar`, `tooltip`, `live-region`, `toast`) for structure and counts. `data-hyperfriend-processed` is internal bookkeeping, not proof of behaviour: assert the button.
- GitHub DOM: the semantic hooks from [github-dom-selectors.md](../../../rules/github-dom-selectors.md): `href` patterns, `data-testid`, `data-component`, roles, the stable legacy hooks. Never hashed classes (`prc-…`, `…-module__…`) or `nth-child` paths.

**EXT-5 — "Does nothing" is proven after a positive control in the same page state.** · **Critical** (AST-7 shape)

- Applies to Shift+C on Files changed, Commits, Checks, lists and unsupported pages, inside a text field or an open dialog; to no button on unsupported pages; to no avatar on Issue lists or with avatars off.
- (1) A positive control in the same state shows the extension is live: the title button is injected, so the config loaded and the listener started. (2) The absence is checked only after the event has demonstrably been processed: for example a page-side `keydown` listener on `window` in the bubble phase records the event with `defaultPrevented === false` (on a match the extension calls `preventDefault()` and `stopPropagation()` in the capture phase, so the recorder would never see it). (3) Then the clipboard still holds the sentinel and no `[data-hyperfriend="toast"]` is visible.
- A bare `toBeHidden()` or `toHaveCount(0)` right after the action passes before anything could have happened.

**EXT-6 — SPA navigation is simulated in the page.** · Major

- `history.pushState`, swap in the next snapshot's content, then dispatch `turbo:load` / `turbo:render` (or `popstate` for back). `page.goto()` is a full load: a different code path.
- Assert: stale buttons removed, exactly one button per new item, the payload of the new item (the title must match the number in the URL after in-page navigation). Tooltip and toast cleanup on `turbo:before-cache` when that is the subject.

**EXT-7 — Tests run the current build, with the computed id.** · Major

- e2e loads `dist/` (never `src/`), built right before the run by the `dist` setup project (or a CI step); a stale build gives a false green.
- The extension id is computed from the absolute `dist/` path and checked by fetching its `manifest.json`; never hardcoded. The fixture fails fast when the extension did not load instead of letting every test time out.
- Extension pages log no errors: the fixture collects `console` errors and `pageerror` and the test fails on them.

**EXT-8 — Coverage claims match what ran.** · Major (a false claim) / Minor (an unstated limit)

- Chromium only. No `firefox` or `webkit` project for extension tests; titles, comments and PR text do not claim Firefox. Firefox-only behaviour (popup Export and Import open a tab) and sign-in pages are listed as manual checks. The `live` smoke is not a gate.

**EXT-9 — Popup tests prove persistence.** · Major

- A setting changed in the popup is asserted in `chrome.storage.sync` (stored shape) **and** after reloading `options.html`; a content-script effect is asserted on a GitHub page. The switch's visible state alone is optimistic UI (it rolls back on error) and proves nothing.

**EXT-10 — `live` is a smoke test, not a copy of e2e.** · Major

- Read-only and anonymous; a few tests: the button appears on a real PR list and PR page, and a copy gives the exact payload for a pinned, long-closed item whose title is stable. A failure means "GitHub changed its markup": refresh the snapshots and the selectors. Never part of the default test run or of push and PR CI.

---

## UNIT — Unit tests

**UNIT-1 — One `test()` per case when the Arrange differs.** · Major

- Table-driven: `for (const c of CASES) { test(c.title, …) }`, with the input in the title. No `test.step` loops over cases. One Arrange with many assertions is fine.

**UNIT-2 — Expected values are literals derived from the test's own inputs.** · Major (Critical when the function under test produces the expected value, AST-7)

- `renderTemplateParts('[PR {{pr_number}}]: {{pr_name}}', target)` is compared with `{ before: '', link: 'PR 12', after: ': Fix <b>' }` written in the test. Never compute the expected value with the function under test or a copy of its algorithm. Compare the whole result (`toEqual`), not one field.
- Sample `LinkTargetModel`s are built in the test or a small factory with explicit fields; titles with HTML special characters and brackets are included where escaping or brackets matter.

**UNIT-3 — No shared mutable fake storage between tests.** · Major

- A fresh fake `chrome` per test (fixture or `beforeEach`), restored afterwards; never a module-level fake mutated across tests.
- `config-service` keeps module-level state (the write queue and the "storage unavailable" warning flag). Tests either isolate it (for example a fresh module instance per test) or do not depend on it, and say which.

**UNIT-4 — Unit tests import from `@shared/*` and stay DOM-free unless the unit needs it.** · Minor

- `src/content` and `src/options` are covered through the build in e2e. Globals a unit needs (`navigator.clipboard`, `ClipboardItem`, `document.execCommand` for `copyLink`) are minimal per-test stubs, removed afterwards; no full DOM emulation for pure functions.

**UNIT-5 — The fake behaves like `chrome.storage.sync` where the code depends on it.** · Major

- Promise API (`get`, `set`, `remove`, `clear`); `onChanged` events with `newValue` / `oldValue` and area `sync`; values copied on write and read (`structuredClone`) so a test cannot pass through a shared reference. Failures are injected explicitly (a rejecting `set`, a missing `chrome.storage`) for the error paths (`get` never rejects).

**UNIT-6 — Untrusted input and limits are tested on both sides.** · Minor (one finding per function)

- `parseSettings`, `normalizeShortcut`, `validateShortcut`, template limits: exactly at the limit (500 characters, 64 KB) passes, one past it fails, and each user-facing message is asserted by its exact text. Every schema version (1, 2, 3, and a newer one) has a case. The boundary belongs here, not in e2e (AST-11).

**UNIT-7 — Time and platform are inputs.** · Major

- Pass `now` to `serializeSettings` and `isMac` to `formatShortcutParts`. Where the code reads `isMacPlatform()` itself (`validateShortcut` wording, display defaults), set the platform per test and restore it: Node exposes `navigator.platform` (`MacIntel` on macOS), so an unpinned test passes on a Mac and fails on Linux CI.

---

## Severity

| Severity     | Meaning                                                                                                                 | Examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Critical** | The test can pass while the feature is broken, hangs or flakes by construction, masks flakiness, or is unsafe to commit | vacuous assertion nothing later catches (incl. a stale clipboard, an absence check without a positive control, an expected value computed by the code under test), re-rooted `has:`, missing `await`, `waitForTimeout`, bare `networkidle`, flake "fixed" with retries or timeouts, signed-in session or secrets (also in intermediate commits), personal data in snapshots, `test.only` / `page.pause()`                                                                            |
| **Major**    | A convention break that makes tests slow, flaky, misleading or hard to maintain                                         | several behaviours in one test, presence-only or partial payload checks, settings arranged through the popup, seed without the format marker, live network in e2e, synthetic key events, hashed GitHub classes, `.first()` on buttons, shortcut pressed before the extension is ready, mocking the extension's own code, stale `dist/`, Firefox coverage claimed, shared fake storage, platform-dependent unit test, unjustified config change, suite no longer compiling or loading |
| **Minor**    | A local improvement                                                                                                     | titles, comments, duplication, redundant waits, magic timeouts, a substring match that hits nothing else today, a redundant assertion a later one covers, missing validation messages (one per form or function), stale PR description details                                                                                                                                                                                                                                       |
| Nit          | Formatting                                                                                                              | never reported (Prettier's job)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

A partial fix of an earlier finding (PR-5) keeps the original severity. Verdict: any Critical or Major → **changes needed**; only Minor → **ready, with suggestions**; nothing → **ready**.

## Top defects to check first

Expected for this suite (an extension with a clipboard, a keyboard shortcut and a snapshot-served site); each maps to a rule:

1. Payload checked partially: one flavour only, `toContain`, or a regex — **EXT-1, AST-7**.
2. Clipboard not seeded with a sentinel, so a stale payload passes — **EXT-2, AST-7**.
3. "Shortcut does nothing" asserted right after the key press, without a positive control — **EXT-5**.
4. Shift+C pressed before the title button exists — **SYNC-6**.
5. Synthetic `KeyboardEvent`s instead of `page.keyboard` / CDP — **EXT-3**.
6. Settings arranged through the popup, or seeded without the `templateFormat` marker or equal to the defaults — **DATA-1, DATA-2**.
7. Expected payload built with `buildLinkPayload` or from the page's own title — **AST-7, UNIT-2**.
8. A request escaping to the real network, or a stub of the clipboard or storage in a happy path — **DATA-4, SYNC-17**.
9. `.first()` or a substring name (`#1` matches `#12`) on copy buttons; hashed GitHub classes — **DATA-9, SYNC-10, EXT-4**.
10. List test proving one row instead of every row — **AST-3**.
11. `waitForTimeout` "for the debounce" — **SYNC-1**.
12. State shared between tests (one context, storage or clipboard not reset; module-level fake storage) — **DATA-3, SCN-7, UNIT-3**.
13. Unit tests depending on the machine's platform or the current time — **UNIT-7, AST-9/10**.
14. Snapshots with comment bodies, emails or signed-in data — **PR-7, DATA-6**.

## Tool messages → rules

`eslint-plugin-playwright` (`flat/recommended` plus errors for the rules rated Critical or Major here, such as `no-wait-for-timeout`, `no-networkidle`, `no-force-option`, `no-conditional-expect`, `prefer-web-first-assertions`; `no-nth-methods`, `require-to-pass-timeout`, `no-commented-out-tests` stay warnings) and the type-aware `@typescript-eslint/no-floating-promises` run on `tests/**` in `npm run lint`; check `eslint.config.mjs` for the current set. Map each message on a changed line to the skill rule, verify it like any other finding, and cite the rule ID, not the lint rule name. Rules set to `warn` are hints: check the documented exceptions.

| Lint rule                                                                                                                                     | Skill rule      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `@typescript-eslint/no-floating-promises`, `missing-playwright-await`                                                                         | SYNC-3          |
| `no-wait-for-timeout`                                                                                                                         | SYNC-1          |
| `no-networkidle`                                                                                                                              | SYNC-2          |
| `no-wait-for-selector`, `no-wait-for-navigation`                                                                                              | SYNC-16         |
| `no-force-option`, `no-nth-methods`                                                                                                           | SYNC-10, DATA-9 |
| `no-element-handle`, `no-eval`, `prefer-locator`, `no-unsafe-references`, `no-page-pause`, `no-focused-test`, `valid-describe-callback`       | STY-4           |
| `prefer-web-first-assertions`, `prefer-to-have-count`                                                                                         | AST-12          |
| `no-unused-locators`, `no-unnecessary-assertions`, `valid-expect`, `valid-expect-in-promise`, `no-conditional-expect`, `no-standalone-expect` | AST-7           |
| `require-to-pass-timeout`                                                                                                                     | SYNC-7          |
| `no-commented-out-tests`, `no-skipped-test`, `require-annotation-reason`                                                                      | SCN-6           |
| `no-duplicate-slow`                                                                                                                           | SYNC-14         |
| `no-export`                                                                                                                                   | STY-6           |
| `no-conditional-in-test`                                                                                                                      | SCN-8           |
| `expect-expect`                                                                                                                               | AST-1           |

The plugin catches narrow shapes only: `missing-playwright-await` misses calls on fixture helpers (`no-floating-promises` covers them), and most AST-7, EXT and SYNC rules stay a manual job.
