# Release Notes

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
