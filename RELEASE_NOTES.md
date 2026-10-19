# Release Notes

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
