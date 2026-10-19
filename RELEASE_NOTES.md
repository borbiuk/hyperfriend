# Release Notes

## 1.0.0

Initial release.

- Copy button next to every Pull Request and Issue on github.com, in list views and on the detail pages.
- Rich hyperlink in the clipboard (`text/html` link plus `text/plain` fallback), ready to paste into Microsoft Teams, Slack and other chats.
- Customizable link templates for Pull Requests and Issues with the placeholders `{{pr_number}}`, `{{pr_name}}`, `{{issue_number}}`, `{{issue_name}}`, `{{owner}}`, `{{repo}}` and `{{url}}`.
- Visual feedback after a click: a check mark ("Copied!") or a cross ("Copy failed").
- Works on repository and global Pull Request / Issue lists, search results, and Pull Request and Issue pages, including GitHub's in-page navigation.
- Settings popup in GitHub style (Primer) with light and dark themes, a live preview of both templates, autosave and a "Reset to defaults" button.
- Settings are stored in the browser sync storage; no data collection and no network requests.
- Support for Chrome and Firefox (Manifest V3).
