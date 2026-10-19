# Release Notes

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
- Support for Chrome and Firefox (Manifest V3).
