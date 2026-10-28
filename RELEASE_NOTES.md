# Release Notes

<!--
Format of a release (checked by `npm run lint:docs`, read by scripts/tag-releases.sh):
- One `## x.y.z` heading per release, newest first. Nothing else uses that heading pattern.
- One summary sentence, then bullets that start with a bold lead and are written for users.
- A bullet starting with **Permissions** whenever the manifest permissions or content script matches change
  (for example Chrome disables the extension on update until the user accepts the new access).
- End with a line about the settings and the settings file when they are unchanged.
-->

## 3.0.0

Quick filters on Pull Request lists.

- **Filter chips**: a row of chips under the search box of every Pull Request list (repository lists, `/pulls` and its tabs, on github.com and `*.ghe.com`) puts the right search words into GitHub's own search. Each chip has an icon and can have a colour. The first four are named after the groups of the Reviews page of Linear: **Needs your review**, **Needs review from your GitHub team**, **Created by you** and **Ready to merge**. **Drafts** goes from all Pull Requests to no drafts, to only drafts and back. **CI passing**, **CI failing** and **CI running** filter by the checks. **Mine, waiting for review** and **Mine, changes requested** show your own Pull Requests by their review state. A chip that is on is highlighted, and a click on it turns it off; chips about the same thing replace each other. The list updates in place, without reloading the page, and the chips stay where they are.
- **Filters tab**: the popup has a fourth tab with two lists. Drag the chips of the bar to change their order (or use the arrow buttons, which also work with the keyboard and screen readers), hide a chip with the cross, and add the ones that are off by default with the plus button: **Approved**, **No reviewer**, **Involves me**, **Mentions me**, **Reviewed by me** and **Not reviewed by me**.
- **Your own chips**: **Add a custom chip** opens an editor with a name, one of 36 icons, a colour and a filter (GitHub search words such as `label:bug -label:wip` or `base:main`) and a preview. A custom chip works like the built-in ones, never clashes with the words of the same kind already in the search, and can be edited, hidden, moved or deleted. Up to 10 chips.
- **Remember your choice**: a switch makes the **Drafts** chip sticky. A list you open without a search text then starts with your last choice (for example without drafts). It is off by default.
- **Settings file**: schema version 5 adds the filters, with the order of the chips and your own chips. Files of versions 1 to 4 still import and leave the filters as they are. Hyperfriend 2.9.x and older do not read version 5 files.
- No new permissions. The chips change the search text of GitHub's own list; nothing is requested from any server.

## 2.9.0

A redesigned settings popup.

- **Templates tab**: a switch picks the link type (**PR**, **Issue**, **Discussion** or **Run**), so all four templates are one click away and no longer hidden in a closed section. A dot on the switch marks a template you changed.
- **Template editor**: placeholders show as chips (one Backspace removes a whole chip) and the part in `[square brackets]` that becomes the link is highlighted. Click a quick placeholder, or open **All placeholders** (grouped by Item, Repository, Branches and Details), to insert one at the caret. **Reset to default** appears when a template differs from the default, and a failed save shows **Try again**.
- **You will paste**: the preview now says which format is pasted (rich link or Markdown).
- **General tab**: the copy format is a switch with a preview made from your Pull Request template. Author avatars sit under **Options**. **Enterprise Server domains** is a row that opens its own screen (with a **General** button to go back) and shows how many domains are added. **Export**, **Import** and **Reset all settings** share one row.
- The settings, the settings file and the copy behavior on GitHub are unchanged.

## 2.8.0

Fixes and more reliable settings.

- **Templates**: a template you type right before the popup closes is now always saved. Before, closing the popup quickly could lose the last change.
- **Keyboard shortcut**: Shift+C now also works on the summary of one attempt of a workflow run (`/actions/runs/123/attempts/2`).
- **More browser shortcuts are reserved**: developer tools and bookmarks (`Ctrl/⌘+I`, `Ctrl/⌘+B`, `⌥⌘I`, `⌥⌘J`, `⌥⌘C`) and clear browsing data (`Ctrl+Shift+Delete`, `⇧⌘Backspace`). A saved shortcut that uses one of them goes back to Shift+C.
- **Import**: a settings file with a shortcut the browser uses still imports. The shortcut keeps its current keys and the rest of the file is applied. Exported templates are always single-line text.
- **Copy buttons**: a title button that GitHub was busy with (hover or focus) moves to its place once you leave it, instead of staying in the wrong spot.
- **GitHub Enterprise**: when the browser already gives access to all sites, **Add** now says the domain was not added and keeps the typed domain in the field.
- **Popup**: an unexpected error now shows a short message instead of an empty popup.
- The extension description in the store and the browser now mentions Discussions, workflow runs and Markdown.
- Settings and settings files are unchanged.

## 2.7.0

GitHub Enterprise Cloud works without setup.

- **`*.ghe.com` sites** (GitHub Enterprise Cloud with data residency, for example `mycompany.ghe.com`) get the copy buttons, Shift+C and the list selection right away. You do not add them in the settings any more.
- Because of this the extension now lists `https://*.ghe.com/*` next to `https://github.com/*` as the sites its content script runs on. Chrome shows a new permission warning ("all ghe.com sites") and **turns the extension off after the update until you accept it**; Firefox may ask too (check the Permissions tab of the add-on in `about:addons` if the buttons are missing on a ghe.com site). Nothing is sent anywhere: the extension still has no network traffic of its own.
- The **GitHub Enterprise** section of the **General** tab is now for GitHub Enterprise Server sites on their own domain. It says so, and refuses a `*.ghe.com` domain, because that needs no entry. A `*.ghe.com` domain you added in 2.6.0 keeps working and is no longer registered separately; it no longer shows in the list, and the browser keeps the old access, which you can remove in the extension's site access settings.
- Author avatars still show on github.com only.
- Settings and settings files are unchanged.

## 2.6.0

GitHub Enterprise.

- New **GitHub Enterprise** section in the **General** tab (closed at first). Type the domain of your GitHub Enterprise Server or GitHub Enterprise Cloud site (`github.example.com`, `mycompany.ghe.com`; a pasted URL works too) and click **Add**. The browser asks you to allow Hyperfriend to access that one site; after you agree, the copy buttons, Shift+C and the list selection work there, also in tabs of that site that are already open. **Remove** takes the access back.
- Pull Requests, Issues, Discussions and workflow runs work as on github.com, and the links point to your site. Author avatars stay on github.com only, because the avatar server does not know the users of an Enterprise site.
- Only `https` sites, one exact domain at a time (no wildcards, no ports); `github.com` and its subdomains are refused. The added domains belong to this browser and are not part of the settings file.
- How it works: the extension now asks for the `scripting` permission and lists `https://*/*` as an **optional** host permission, so the browser can ask for one domain when you add it. Nothing is accessed before you allow it. A small background script registers the content script for the domains you added again after an extension update and after the browser starts.
- In Firefox the popup closes when the permission prompt opens, so **Add** opens the settings page in a tab, where you add the domain.
- Enterprise Server versions that are older than the current github.com can have other markup: the buttons may be missing on some pages.
- Settings and settings files are unchanged.

## 2.5.0

Copy several items as one list.

- **Shift+click** on the copy buttons of a list (pull requests, issues, discussions, workflow runs, search results) selects items instead of copying them. A selected button is highlighted and a small bar at the bottom of the page shows how many items are selected, with **Copy links** and **Clear**.
- **Copy links** puts all selected items on the clipboard as one list, in the order they have on the page, in your copy format. With **Rich link**: an HTML bulleted list with one link per item, and plain-text lines `- TEXT — URL`. With **Markdown**: plain text only, one `- [LINK](URL)` line per item. Every item uses the template of its own type.
- The selection is cleared after a successful copy, with **Clear** or **Esc** (not while you type in a text field or a dialog is open), when you move to another page, and when GitHub replaces the rows. A plain click on a button still copies one item and keeps the selection; **Shift+Enter** on a focused button works like Shift+click. The tooltip of a list button now says "Shift+click to select several".
- Detail pages are unchanged: Shift+click on a title button copies that item like a click.
- Settings and settings files are unchanged. The extension still needs only the `storage` permission and has no new network traffic.

## 2.4.0

Copy links to Discussions and GitHub Actions workflow runs.

- A copy button next to every discussion title in the discussion list (also the pinned one) and on the discussion page, and next to every workflow run in the Actions list (`/OWNER/REPO/actions` and one workflow's runs) and on the workflow run page.
- Shift+C (or your own combination) copies the link of an open discussion and of an open workflow run summary page, not of its job and attempt pages.
- Two new templates with their own defaults: `[Discussion {{discussion_number}}]: {{discussion_name}}` and `[{{workflow}} #{{run_number}}]: {{run_name}}`, so a run is linked as "CI #20481" followed by its name. They sit in a closed **Discussions and workflow runs** section of the **Templates** tab, with their own placeholder hints and live previews.
- New placeholders for Discussions: `{{discussion_number}}`, `{{discussion_name}}`, `{{category}}` (and `{{ref}}`, `{{author}}` as for other items). For workflow runs: `{{run_number}}` (the number shown as `#20481`, not the run id of the URL), `{{run_name}}`, `{{workflow}}`, `{{branch}}` and `{{status}}`. A placeholder without data on the page is replaced with nothing.
- The copy format (rich link or Markdown) applies to the new links too. The button of a run is named after its workflow and run number, for screen readers.
- The settings file stays at schema version 4: it now also holds the `discussion` and `workflow-run` templates. A file without them keeps your current ones, and 2.3.0 and older ignore them in newer files. **Reset all settings** resets them too.
- Older versions of the extension in other browsers on the same sync account don't know the two new templates and drop them the next time they save a setting. Discussions of an organization (`/orgs/ORG/discussions`) are not supported, only repository discussions.
- The extension still needs only the `storage` permission and has no new network traffic.

## 2.3.0

Copy links as Markdown.

- New **Copy format** setting in the **General** tab: **Rich link** (the default, as before) or **Markdown**. It applies at once to the copy buttons and to Shift+C.
- In Markdown mode the clipboard gets one `text/plain` format with a Markdown link, for example `[PR 12](https://github.com/OWNER/REPO/pull/12): Add copy button to PR list`. Only the part of the template in square brackets is the link text (the whole text when there are none). `[`, `]` and `\` inside the link text get a backslash, so a title such as `[WIP] Fix` stays one link. There is no `text/html` format in this mode, so chats and editors paste the Markdown source and not a link.
- The live preview in the **Templates** tab shows the text that will be pasted in the chosen format.
- Settings files are now schema version 4 (a new `format` field, `"rich"` or `"markdown"`). Files of versions 1 to 3 still import and keep the current copy format. Version 4 files can't be imported by 2.2.1 and older ("created by a newer version"). **Reset all settings** also resets the copy format.
- Older versions of the extension in other browsers on the same sync account don't know the copy format and reset it to **Rich link** the next time they save a setting.
- The extension still needs only the `storage` permission and has no new network traffic.

## 2.2.1

Dependency update.

- Updated `@primer/octicons-react` to 19.41.0 and `@types/chrome` to 0.3.6. There are no functional changes, and the extension still needs only the `storage` permission.

## 2.2.0

More placeholders for link templates.

- New placeholders: `{{ref}}` (`owner/repo#12`), `{{author}}`, `{{state}}` (`open`, `closed`, `merged` or `draft`), `{{labels}}`, `{{assignees}}`, `{{milestone}}`, and for Pull Requests `{{base_branch}}` and `{{head_branch}}`. Labels and assignees are joined with a comma and a space.
- The details are read from the page you copy on. List rows show the author, the state and the labels; Pull Request and Issue pages show all of them. Search results show none of them. A placeholder whose data the page does not show is replaced with nothing.
- The Templates tab lists the new placeholders, and the live preview fills them for a sample item.
- Existing templates and settings files are not changed: schema version 3 stays. The extension still needs only the `storage` permission and has no new network traffic.

## 2.1.1

Fix for GitHub's new pull request page.

- The copy button is back next to the pull request title on the Conversation and Commits tabs of GitHub's new pull request layout. GitHub moved the title into a new header there, so 2.1.0 added no button and Shift+C confirmed the copy with the bottom toast instead of "Copied!" on the button ([#4](https://github.com/borbiuk/hyperfriend/issues/4)).
- The button sits right after the pull request number, outside the heading, and announces the Shift+C shortcut to screen readers again.

## 2.1.0

Templates can mark which part of the text is the link.

- Put the link part of a template in square brackets: only that part becomes the hyperlink, the rest is plain text. The new defaults are `[PR {{pr_number}}]: {{pr_name}}` and `[Issue {{issue_number}}]: {{issue_name}}`, which paste as the link "PR 12" followed by ": Add copy button to PR list". In Microsoft Teams the whole pasted text used to be one blue link, and Teams shortens long link text.
- Rules: brackets are read in the template only (brackets in a title such as "[WIP] Fix" don't matter); the first `[`…`]` pair is the link and later brackets are plain text; a `[` without `]` is plain text; `\[` and `\]` are literal brackets; a bracket can't cut through a `{{placeholder}}`. Without brackets, or with an empty `[]`, the whole text is the link, exactly as before. Spaces at the edges of the bracketed part stay outside the link, and a template that renders to empty text falls back to the default.
- The plain-text format stays `PR 12: Add copy button to PR list — URL` (no brackets).
- The preview in the Templates tab underlines the part that will be the link, and a hint above the fields explains the square brackets.
- Your saved templates are converted once when you update: a template equal to the old default becomes the new bracketed default, and any other template has its `[` and `]` escaped, so it copies exactly as before. Add brackets to it to mark a shorter link, or use "Reset all settings" in General to get the new defaults.
- Settings files are now schema version 3 (templates with the bracket syntax). Files exported by 1.0.0 and 2.0.0 (versions 1 and 2) still import, and their templates are converted the same way. Version 3 files can't be imported by 2.0.0 ("created by a newer version").

## 2.0.0

Keyboard shortcut and a tabbed settings popup.

- Keyboard shortcut to copy the link of the open Pull Request or Issue, **Shift+C** by default (⇧C on Mac). It copies exactly what the title copy button copies and shows the same "Copied!" tooltip, or a "Link copied" toast at the bottom of the page when the button is scrolled out of view.
- The shortcut works on the Pull Request page (Conversation tab only, not Files changed, Commits or Checks) and on the Issue page. It does not work while you type in a text field or while a dialog is open, and it works with any keyboard layout (it uses the physical key).
- Change or turn off the shortcut in the new **Shortcuts** tab of the popup: click the keys, press a new combination, and it is saved at once. Combinations the browser uses (such as Ctrl+C) are refused, and a warning is shown when GitHub uses the same keys. A **Reset** button restores the default.
- The popup now has three tabs: **Templates**, **Shortcuts** and **General**.
- New **Show author avatars** switch in **General** (on by default). It applies right away, without reloading GitHub.
- **Reset all settings** (with a confirmation) in **General** restores the default templates, shortcuts and display settings. It replaces the "Reset to defaults" button, which only reset the templates.
- Export and import now include the shortcuts and display settings (settings file schema version 2). Files exported by 1.0.0 still import (templates only).
- The title copy button announces the shortcut to screen readers (`aria-keyshortcuts`) while it is enabled; the tooltip text is unchanged.
- Your templates from 1.0.0 are kept. The extension still needs only the `storage` permission and has no new network traffic.

## 1.0.0

Initial release.

- Copy button next to every Pull Request and Issue on github.com, in list views and on the detail pages.
- Rich hyperlink in the clipboard (`text/html` link plus `text/plain` fallback), ready to paste into Microsoft Teams, Slack and other chats.
- Customizable link templates for Pull Requests and Issues with the placeholders `{{pr_number}}`, `{{pr_name}}`, `{{issue_number}}`, `{{issue_name}}`, `{{owner}}`, `{{repo}}` and `{{url}}`.
- Visual feedback after a click: a check mark ("Copied!") or a cross ("Copy failed").
- Works on repository and global Pull Request / Issue lists, search results, and Pull Request and Issue pages, including GitHub's in-page navigation.
- Settings popup in GitHub style (Primer) with light and dark themes, a live preview of both templates, autosave and a "Reset to defaults" button.
- Author avatars (16 px, round) before the author login in Pull Request lists; they load from GitHub's own avatar server and are removed if they fail to load.
- Export and import of the templates as `hyperfriend-settings.json` (schema version 1, validated on import), so a team can share one link format. In Firefox, Export and Import open the settings page in a tab because the popup closes when the download panel or the file picker opens.
- Settings are stored in the browser sync storage; no data collection, no analytics and no servers of its own.
- Extension icon: a contribution-graph style grid of tiles that forms the letter H, in 16, 32, 48 and 128 px.
- Support for Chrome and Firefox (Manifest V3).
