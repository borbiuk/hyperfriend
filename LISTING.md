Hyperfriend — Copy GitHub Pull Request, Issue, Discussion and workflow run links as rich hyperlinks

One click on GitHub copies a clean, readable link, ready to paste into Microsoft Teams, Slack and other chats. Lightweight, private, and open source.

✨ Key features

- 🔗 Copy button: Added next to every Pull Request, Issue, Discussion and GitHub Actions workflow run, in lists and on the detail pages
- 💬 Rich hyperlink: Pastes as a clickable link with readable text, e.g. "PR 12" as the link followed by ": Add copy button to PR list", not a bare URL (plain-text apps get "text — URL")
- 📝 Markdown mode: Switch the copy format to Markdown to get [PR 12](https://github.com/…): Add copy button to PR list as plain text, ready for GitHub comments, Notion and docs
- ✏️ Customizable templates: Set your own link text for Pull Requests, Issues, Discussions and workflow runs with placeholders such as {{pr_number}}, {{pr_name}}, {{issue_number}}, {{issue_name}}, {{owner}}, {{repo}}, {{url}}, {{ref}}, {{author}}, {{state}}, {{labels}}, {{assignees}}, {{milestone}}, {{base_branch}}, {{head_branch}}, {{discussion_number}}, {{category}}, {{run_number}}, {{workflow}}, {{branch}} and {{status}}. Put the link part in [square brackets], so only that part is clickable and chats like Teams don't shorten a long link
- 📋 Copy several at once: Shift+click the buttons of several items in a list, then copy them all as one bulleted list (rich links or Markdown), in the order of the page
- ⌨️ Keyboard shortcut: Press Shift+C (⇧C on Mac) on an open Pull Request, Issue, Discussion or workflow run to copy its link. Change it or turn it off in the settings; it never works while you type in a text field
- 🔎 Quick filters: A row of chips with icons under the search box of Pull Request lists, named like the groups of Linear Reviews: needs your review, needs review from your GitHub team, created by you, ready to merge, drafts, CI passing or failing, and your own Pull Requests waiting for review or with changes requested. Choose, reorder and add your own chips (name, icon, colour and any GitHub search filter) in the settings, and let the drafts filter stay on for every list
- 🖼️ Author avatars: A small avatar before the author in Pull Request lists; turn it off with one switch in the settings
- 🤝 Share with your team: Export your templates, copy format, shortcuts, display and filter settings to a JSON file and import them on another computer, so the whole team pastes links in one format
- ✅ Clear feedback: The button shows "Copied!" or "Copy failed" right after a click
- 🌗 Light and dark: Matches the GitHub theme; the settings popup (Templates, Shortcuts, Filters and General tabs) follows your system theme, with a template editor that shows placeholders as chips, a live preview of what you paste and automatic saving
- 🏢 GitHub Enterprise: Works on GitHub Enterprise Cloud (ghe.com sites) right away; for a GitHub Enterprise Server, add its domain in the settings and allow the access in the browser prompt
- 🔄 Works with GitHub navigation: Buttons show up after in-page navigation too, no refresh needed

🔒 Privacy

- No data collection. No analytics. The extension sends nothing anywhere and has no servers of its own.
- The only network traffic it causes: author avatar images in Pull Request lists, loaded from GitHub's own avatar server (avatars.githubusercontent.com), the same images GitHub itself shows.
- Your settings (templates, shortcuts, display options and quick filter choices) are stored in the browser sync storage, so they follow your browser account. Your last choice for drafts is kept in this browser's local extension storage. Export and import use local files only.
- Privacy policy: https://github.com/borbiuk/hyperfriend/blob/master/PRIVACY.md
- Open source: https://github.com/borbiuk/hyperfriend

🧾 Permissions (what and why)

- 💾 Storage — Save your link templates, shortcuts, display and filter settings, and the last drafts choice
- 🌐 Access to github.com — The content script runs on github.com to add the copy buttons and run the keyboard shortcut.
- 🏢 Access to ghe.com sites — GitHub Enterprise Cloud with data residency lives on ghe.com subdomains, so the extension runs there like on github.com, without any setup.
- 🏢 Optional access to your GitHub Enterprise Server — Only when you add its domain in the settings, the browser asks you to allow that one site, and the extension then runs there like on github.com. It never asks for any other site, and you can remove the access at any time.
- 🧩 Scripting — Starts the copy buttons on the GitHub Enterprise domains you added (it registers the content script for them and starts it in the tabs that are already open).

🆘 Support

- 🐛 Report issues or request features: https://github.com/borbiuk/hyperfriend/issues
