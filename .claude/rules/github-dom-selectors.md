# GitHub DOM selectors

> How the content script finds Pull Requests and Issues on github.com without breaking on every GitHub release.
> Applies to: `src/content/**`.

GitHub renders pages with React and Turbo. Its CSS class names are **hashed** (for example `prc-Link-Link-9ZwDx`, `ListItems-module__...`) and change between releases. Treat the DOM as an unstable API and prefer stable signals.

- **DON'T** select by hashed or generated class names, or by element position (`div > div:nth-child(3)`).
- **DO** use, in this order of preference:
    1. **`href` patterns** on links: `/{owner}/{repo}/pull/{n}` and `/{owner}/{repo}/issues/{n}` (match the pathname, ignore query and hash). Owner, repo and number are parsed from the `href` by `parseItemUrl` in [link-target-parser.ts](../../src/content/services/link-target-parser.ts).
    2. **Semantic attributes**: `data-testid`, `data-component`, `role` and `aria-*` attributes.
    3. **Stable legacy hooks** that GitHub keeps for classic pages (`id^="issue_"`, `.search-title`, `.gh-header-title`, `.js-issue-title`). These are semantic names, not hashed ones.

## Page detection

[page-detector.ts](../../src/content/services/page-detector.ts) decides from the URL what to do (`PageKind`); on any other page nothing is injected and mutations are ignored.

| Kind          | Paths                                                                                                                                                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `List`        | Repo: `/{owner}/{repo}/pulls` and `/issues`, filters `assigned\|created_by\|mentioned\|review-requested/{user}`, and `/{owner}/{repo}/pulls/{user}`. Global: `/pulls`, `/issues` and the `assigned`, `created`, `mentioned`, `review-requested`, `recent-activity` tabs. Search: `/search?type=pullrequests` or `type=issues` |
| `PullRequest` | `/{owner}/{repo}/pull/{n}` including sub-tabs (`/files`, `/commits`, `/checks`)                                                                                                                                                                                                                                               |
| `Issue`       | `/{owner}/{repo}/issues/{n}`                                                                                                                                                                                                                                                                                                  |
| `Unsupported` | everything else, for example `/{owner}/{repo}/issues/new`                                                                                                                                                                                                                                                                     |

List paths are deliberately restricted: do not widen them to `.*`, or pages such as `/issues/new` get scanned.

## What the scanner looks for

[button-injector.ts](../../src/content/services/button-injector.ts):

- **List rows**: title links `a[data-testid="listitem-title-link"]`, `issue-pr-title-link`, `issue-listitem-title-link`, `a[id^="issue_"][id$="_link"]` and search result titles (`[data-testid="results-list"] .search-title a[href]`). If none is found, the fallback is a `a[href*="/pull/"], a[href*="/issues/"]` link inside `main` / `[role="main"]` that parses as an exact item link and has no hash or query (comment links like `#issuecomment-1` and filter links are not titles). Links inside dialogs, tooltips, menus, popovers, hovercards and the extension's own UI are ignored. The button is inserted **after the heading that wraps the title link** (or after the link itself), so it never becomes part of the title text.
- **Detail pages**: the title header (`h1[data-component="PH_Title"]`, `[data-testid="issue-title"]`, `.gh-header-title`, `bdi.js-issue-title`), skipping sticky scroll headers that repeat the title. The button goes right **after the `#123` number element** and is vertically centered on its line. Placement depends on the header:

    - React PR header: the number is in an inline-flex wrapper next to the `h1` (outside the heading); the button is added last inside that wrapper, so it stays outside the `h1`.
    - Issue page: the number is in an inline-flex wrapper **inside** the `h1`, together with GitHub's "Edit issue title" pencil when signed in; the button goes last in that wrapper, after the pencil, using the wrapper's gap.
    - Classic header (for example PR `/files`): the number is a plain span inside the `h1`; the button follows it.

    On the Issue page and the classic header the button is inside the `h1` on purpose: the `h1` wraps long titles and is followed by page actions, so a sibling would sit at the far right and read as a page action. Trade-off: there the heading's accessible name includes the button label.

- **Titles** come from the link text (lists) or the header title element (detail pages). Fallbacks for detail pages when the header yields nothing: `document.title`, then `meta[property="og:title"]`, parsed with the `… · Pull Request #n · owner/repo` / `… · Issue #n · owner/repo` suffixes removed.
- **Canonical URL** is built from owner, repo and number: `https://github.com/{owner}/{repo}/pull/{n}` or `/issues/{n}`. Never copy `location.href` as is (it can include tabs such as `/files`, queries or hashes).
- **Titles are data** — `title` is raw text; escaping is done by `buildLinkPayload` in `@shared/services`, not in the DOM code.

## SPA navigation and rescans

GitHub navigates without full page loads (Turbo), and React re-renders list rows. [page-observer.ts](../../src/content/services/page-observer.ts):

- A **`MutationObserver` on `document.documentElement`** (Turbo replaces `document.body`, so observing the body is not enough), `childList` + `subtree`.
- **Debounce 150 ms, at most 500 ms** of postponing while the DOM keeps changing.
- Also rescans on `turbo:load`, `turbo:render`, `popstate` and, where available (Chromium), the Navigation API `navigatesuccess` event.
- Mutations on unsupported pages are ignored (cheap observer) **unless the URL changed** since the last notification, so navigating from an unsupported page to a supported one still triggers a scan.
- A scan is cheap and **idempotent**; the initial scan runs after the config has loaded.

## Idempotent markers

- The injected button has **`data-hyperfriend="copy-button"`**.
- **`data-hyperfriend-processed`** is set on the host that got a button: the title link in lists, the title header on detail pages.
- Before inserting, the injector checks the real next sibling (not only a marker), because React may recreate nodes; an existing button is only updated (its label follows the current title and templates). A button left by an older instance of the script is replaced. Stale title buttons on detail pages are removed, and row buttons whose title link was replaced or moved (React may recreate only the link) are removed at the start of every scan and re-created.
- Never remove or change GitHub's own elements. Insert next to them. The only GitHub style touched: `.search-title > a[data-hyperfriend-processed]` gets `min-width: 0` and an ellipsis so the button stays visible in search rows.

## Styling and behavior

- [copy-button.css](../../src/content/styles/copy-button.css) styles the button like Primer `IconButton variant="invisible"`: 24×24 in list rows, 32×32 on detail headers, the icon stays muted on hover. Colors come from GitHub's Primer CSS variables that exist on the page (for example `--fgColor-muted`, `--bgColor-neutral-muted`, `--borderColor-default`) with light-theme fallbacks, so the button follows GitHub's light and dark themes.
- **Tooltip**: there is no native `title`. One shared GitHub-style tooltip (`.hyperfriend-tooltip`, `data-hyperfriend="tooltip"`, styles in [tooltip.css](../../src/content/styles/tooltip.css), logic in [tooltip.ts](../../src/content/components/tooltip.ts)) shows "Copy link to pull request" / "Copy link to issue" on hover and focus, then "Copied!" / "Copy failed" for 1.5 s. It is `aria-hidden`; a hidden polite live region (`data-hyperfriend="live-region"`) announces the result. Both are created on supported pages and removed on `turbo:before-cache` so they do not end up in Turbo snapshots.
- Icons are inline SVG (Octicons `copy`, `check`, `x`, 16 px) in [octicons.ts](../../src/content/icons/octicons.ts). Do not pull React into the content script.
- The click handler calls `copyLink` synchronously (no `await` before it) with the config from `ConfigStore`. States: copy icon, then "Copied!" (check icon) or "Copy failed" (x icon) for 1.5 s. `aria-label` is `Copy link to pull request #12` / `Copy link to issue #7` (not the rendered template text), so buttons in a list have distinct names.

## Verifying changes

- Test on: repository PR list, repository Issue list, a PR page (and its Files and Commits tabs), an Issue page, `/pulls` and `/issues` dashboards (needs sign-in), and `/search?type=pullrequests` / `type=issues`.
- Switch GitHub light and dark themes; navigate between pages without reloading; check there is exactly one button per item.
