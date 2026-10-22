Hyperfriend — Copy GitHub Pull Request and Issue links as rich hyperlinks

One click on GitHub copies a clean, readable link, ready to paste into Microsoft Teams, Slack and other chats. Lightweight, private, and open source.

✨ Key features

- 🔗 Copy button: Added next to every Pull Request and Issue, in lists and on the detail pages
- 💬 Rich hyperlink: Pastes as a clickable link with readable text, e.g. "PR 12" as the link followed by ": Add copy button to PR list", not a bare URL (plain-text apps get "text — URL")
- ✏️ Customizable templates: Set your own link text for Pull Requests and Issues with placeholders such as {{pr_number}}, {{pr_name}}, {{issue_number}}, {{issue_name}}, {{owner}}, {{repo}}, {{url}}, {{ref}}, {{author}}, {{state}}, {{labels}}, {{assignees}}, {{milestone}}, {{base_branch}} and {{head_branch}}. Put the link part in [square brackets], so only that part is clickable and chats like Teams don't shorten a long link
- ⌨️ Keyboard shortcut: Press Shift+C (⇧C on Mac) on an open Pull Request or Issue to copy its link. Change it or turn it off in the settings; it never works while you type in a text field
- 🖼️ Author avatars: A small avatar before the author in Pull Request lists; turn it off with one switch in the settings
- 🤝 Share with your team: Export your templates, shortcuts and display settings to a JSON file and import them on another computer, so the whole team pastes links in one format
- ✅ Clear feedback: The button shows "Copied!" or "Copy failed" right after a click
- 🌗 Light and dark: Matches the GitHub theme; the settings popup (Templates, Shortcuts and General tabs) follows your system theme, with a live preview of your templates and automatic saving
- 🔄 Works with GitHub navigation: Buttons show up after in-page navigation too, no refresh needed

🔒 Privacy

- No data collection. No analytics. The extension sends nothing anywhere and has no servers of its own.
- The only network traffic it causes: author avatar images in Pull Request lists, loaded from GitHub's own avatar server (avatars.githubusercontent.com), the same images GitHub itself shows.
- Your settings (templates, shortcuts and display options) are stored in the browser sync storage, so they follow your browser account. Export and import use local files only.
- Open source: https://github.com/borbiuk/hyperfriend

🧾 Permissions (what and why)

- 💾 Storage — Save your link templates, shortcuts and display settings
- 🌐 Access to github.com — The content script runs only on github.com to add the copy buttons and run the keyboard shortcut. The extension has no other site access and requests no host permissions.

🆘 Support

- 🐛 Report issues or request features: https://github.com/borbiuk/hyperfriend/issues
