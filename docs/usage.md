# Usage

## Copy button

- **Pull Requests, Issues, Discussions and workflow runs**: a button next to the title of every item in list views and next to the title on the detail pages. A workflow run is linked as `WORKFLOW #RUN_NUMBER` (for example `CI #20481`) with the run's name as the text after it.
- **Rich hyperlink** (the default copy format): the clipboard gets both formats at once, so every chat app picks the best one.
    - `text/html`: `<a href="https://github.com/OWNER/REPO/pull/12">PR 12</a>: Add copy button to PR list` (with the default template only `PR 12` is the link, see [Customizable templates](templates.md#customizable-templates))
    - `text/plain`: `PR 12: Add copy button to PR list — https://github.com/OWNER/REPO/pull/12`
- **Markdown** (optional): choose **Markdown** under **Copy format** in the **General** tab and the clipboard gets one `text/plain` format with a Markdown link: `[PR 12](https://github.com/OWNER/REPO/pull/12): Add copy button to PR list`. Only the part of the template in square brackets is the link text (the whole text without brackets). Inside the link text `[`, `]` and `\` get a backslash, so `[WIP] Fix` stays one link. There is no `text/html` format in this mode, so chats and editors paste the Markdown source, not a link. The button, the keyboard shortcut and the template preview all follow the setting.
- **Looks like GitHub**: styled like GitHub's own icon buttons (Primer "invisible" icon button, 24 px in lists and 32 px in page headers), with GitHub-style tooltips ("Copy link to pull request" / "Copy link to issue"). On detail pages it sits right after the `#number` of the title.
- **Clear feedback**: after a click the icon changes to a check mark and the tooltip shows "Copied!", or a cross and "Copy failed", for 1.5 seconds. Screen readers announce the result, and the accessible label is, for example, "Copy link to pull request #12".
- **Works with GitHub navigation**: buttons appear on pages that GitHub loads without a full page refresh and are never duplicated.
- **Light and dark**: the button uses GitHub's own theme colors, so it follows the GitHub theme you use.

## Copy several items as a list

In a list (pull requests, issues, discussions, workflow runs, search results) hold **Shift** and click the copy buttons of the items you want. Shift+click only selects: the button is highlighted and a small bar appears at the bottom of the page ("3 selected", **Copy links**, **Clear**). Click **Copy links** to put all selected items on the clipboard as one list, in the order they have on the page, in the copy format of the **General** tab (a template is applied to every item):

- **Rich link**: `text/html` is a bulleted list with one link per item, and `text/plain` has one line `- TEXT — URL` per item.
- **Markdown**: `text/plain` only, one `- [LINK](URL)` line per item (with the text around the link from the template).

The selection is cleared after a successful copy, with **Clear**, with **Esc** (not while you type in a text field or a dialog is open), when you move to another page and when GitHub replaces the rows. A plain click on a button still copies that one item and keeps the selection. **Shift+Enter** on a focused button works like Shift+click. The tooltip of a list button says "Shift+click to select several". The title button of a detail page has no selection: Shift+click copies like a click there.

## Keyboard shortcut

- **Copy the open item**: press **Shift+C** (⇧C on Mac) on an open Pull Request, Issue, Discussion or workflow run to copy its link. It copies exactly what the title copy button copies (same template, same clipboard formats).
- **Where it works**: on the Pull Request page, **Conversation tab only** (`/OWNER/REPO/pull/12`; not Files changed, Commits or Checks), on the Issue page (`/OWNER/REPO/issues/34`), on the Discussion page (`/OWNER/REPO/discussions/5`) and on the workflow run page (`/OWNER/REPO/actions/runs/123`, also the summary of one attempt, `/attempts/2`; not its job pages). Everywhere else the key press is left to GitHub.
- **It never gets in the way of typing**: it does nothing while the focus is in a text field (comment box, search, title editor and similar), while a dialog is open, while holding the key down or while an input method is composing text. Other GitHub shortcuts keep working.
- **Any keyboard layout**: the shortcut uses the physical key (for example the key that is `C` on a US keyboard), so it works with Cyrillic, Greek and other layouts too.
- **Feedback**: the title button shows the usual "Copied!" tooltip. If the button is scrolled out of view, a small "Link copied" toast appears at the bottom of the page for about 2 seconds ("Copy failed" if the copy did not work). Screen readers announce the result, and the title button carries `aria-keyshortcuts` while the shortcut is on.
- **Change or turn it off**: in the **Shortcuts** tab of the popup (see below).

## Author avatars

- **Who opened it**: in Pull Request lists a small round avatar (16 px) is shown before the author's login, like on other GitHub pages.
- **Light on requests**: avatars load lazily from GitHub's own avatar server (`avatars.githubusercontent.com`), the same images GitHub shows. If an avatar cannot be loaded, it is simply removed.
- **Only where it helps**: not shown in Issue lists or search results, and not added where GitHub already shows an avatar (for example Copilot rows).
- **Optional**: turn them off with **Show author avatars** in the **General** tab of the popup. It applies right away, without reloading GitHub.

## Customizing the shortcut

Open the **Shortcuts** tab of the popup. Each shortcut is a row with its name, a button showing the keys, an on/off switch and, once you changed the keys, a **Reset** button that restores the default.

1. Click the keys button. It reads "Press a shortcut…".
2. Press the new combination. It is checked and saved at once. **Escape** or moving the focus away cancels, and **Tab** still moves the focus.
3. Use the switch to turn the shortcut off. The keys are kept, so turning it on again restores your combination.

Rules for a combination:

- It needs at least one modifier (**Shift**, **Option / Alt**, **Control** or **Command / Win**) plus one key: a letter, digit, F-key, arrow, punctuation or editing key, or a numpad key.
- Combinations the browser or text fields use (for example Ctrl/Cmd+C, V, X, A, Z, F, T, W, R, L) are refused: "This shortcut is used by the browser."
- Combinations GitHub uses itself (for example Ctrl/Cmd+K for the command palette, or Shift+/ for the help) are accepted with the warning "GitHub also uses this shortcut."
- Two enabled Hyperfriend shortcuts can't share the same keys.

On Mac the keys are shown as symbols (⌃ ⌥ ⇧ ⌘); on Windows and Linux as `Ctrl`, `Alt`, `Shift` and `Win`.

## Settings popup

The popup has three tabs and a footer with a link to the GitHub repository. The URL hash of `options.html` can open a tab first: `#templates`, `#shortcuts` or `#general`.

- **GitHub look**: built with Primer React, the design system of GitHub.
- **Header**: the popup shows the extension icon next to the name.
- **Templates**: a switch picks the link type (Pull Request, Issue, Discussion or workflow run; a dot marks a template you changed). The template editor shows each placeholder as a chip and highlights the part in `[square brackets]` that becomes the link. Click a quick placeholder or open **All placeholders** to insert one at the caret; **Reset to default** appears when the template differs from the default. **You will paste** shows the resulting link text for a sample item (live preview). Changes are saved about 300 ms after you stop typing, with a "Saved" status.
- **Shortcuts**: change, turn off or reset the keyboard shortcut (see above). Shortcuts don't work while you type in a text field.
- **General**:
    - **Copy format**: a switch between **Rich link** (default) and **Markdown**, saved at once, with a preview of what is pasted (made with your Pull Request template). The Templates preview shows the same format.
    - **Show author avatars** (on by default), applied immediately.
    - **Enterprise Server domains**: a row that opens a screen to add the domain of your GitHub Enterprise Server (**Add**, **Remove**, a **General** button to go back); the row shows how many domains are added. See [GitHub Enterprise](enterprise.md).
    - **Export** and **Import** share the settings as a file (see above).
    - **Reset all settings** (at the right of the file buttons) restores the default templates, copy format, shortcuts and display settings after a confirmation ("Reset all settings?").
- **Light and dark themes**: the popup follows the operating system theme.

## Supported pages

All pages are on `github.com`.

| Page Type                 | URL                                                                                                                                 | What you get                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Repository PR list**    | `/OWNER/REPO/pulls`, filters `/pulls/assigned/USER`, `/created_by/USER`, `/mentioned/USER`, `/review-requested/USER`, `/pulls/USER` | Copy button after every item title                             |
| **Repository Issue list** | `/OWNER/REPO/issues`, filters `/issues/assigned/USER`, `/created_by/USER`, `/mentioned/USER`, `/review-requested/USER`              | Copy button after every item title                             |
| **Dashboards**            | `/pulls`, `/issues` and their `assigned`, `created`, `mentioned`, `review-requested`, `recent-activity` tabs \*                     | Copy button after every item title                             |
| **Search results**        | `/search?type=pullrequests`, `/search?type=issues`                                                                                  | Copy button after every result title                           |
| **Pull Request page**     | `/OWNER/REPO/pull/12`, including `/files`, `/commits`, `/checks`                                                                    | Copy button right after the `#number` of the title             |
| **Issue page**            | `/OWNER/REPO/issues/34`                                                                                                             | Copy button right after the `#number` of the title             |
| **Discussion list**       | `/OWNER/REPO/discussions`, `/discussions/categories/SLUG`                                                                           | Copy button after every discussion title (also the pinned one) |
| **Discussion page**       | `/OWNER/REPO/discussions/5`                                                                                                         | Copy button right after the `#number` of the title             |
| **Workflow run list**     | `/OWNER/REPO/actions`, `/actions/workflows/FILE.yml`                                                                                | Copy button after every run title                              |
| **Workflow run page**     | `/OWNER/REPO/actions/runs/123`, including its job and attempt pages                                                                 | Copy button right after the `#run number` of the title         |

The keyboard shortcut works on the Issue page, the Discussion page, the workflow run summary page (`/OWNER/REPO/actions/runs/123` and the summary of one attempt, `/attempts/2`; not its job pages) and on the main Pull Request page only (`/OWNER/REPO/pull/12`, the Conversation tab), not on the Pull Request sub-tabs `/files`, `/commits` and `/checks`, even though the copy button is shown there.

Author avatars are added to the Pull Request lists only (the repository and dashboard lists); Issue lists and search results do not get them. Other pages (for example `/OWNER/REPO/issues/new`) are left untouched.

\* The dashboards are supported by the code but have not been verified on live GitHub pages yet (they require signing in).
