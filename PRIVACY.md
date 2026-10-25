# Privacy policy

Hyperfriend is a browser extension that adds copy-link buttons to GitHub pages. **It collects no data, has no analytics and no servers of its own, and sends nothing anywhere.**

## What the extension reads

When you click a copy button or press the keyboard shortcut, the extension reads the details of that item from the GitHub page you are looking at, in your browser: the number, title, address, repository, author, state, labels, assignees, milestone, branches, category and workflow run details. It uses them only to fill the placeholders of your link template. The result is written to your clipboard.

- The extension **writes** to the clipboard. It never **reads** the clipboard.
- The content script listens to key presses on GitHub pages only to detect your shortcut. Nothing is recorded or stored.

## What the extension stores

Your settings (link templates, copy format, keyboard shortcuts and display options) are stored with the browser's extension storage (`chrome.storage.sync`). If you use browser sync, your browser (Google or Mozilla account) syncs them between your devices; the extension does not control that. The extension stores nothing else on your device.

**Export** creates a file on your computer and **Import** reads a file you pick. Nothing is uploaded.

## Network traffic

The only network requests the extension causes are the small author pictures shown in Pull Request lists on github.com. They load from GitHub's own avatar server (`avatars.githubusercontent.com`) and are the same images GitHub shows; GitHub sees these requests like any other image request from its pages. You can turn the pictures off with **Show author avatars** in the **General** tab of the settings (they are on by default). The extension does not load remote code.

## Where the extension runs

- on `github.com` and on GitHub Enterprise Cloud sites (`*.ghe.com`), because the manifest lists them;
- on a GitHub Enterprise Server domain only after you add that exact domain in the settings and the browser asks you to allow it. The browser stores that permission; you can remove it at any time. The extension never asks for any other site.

## Firefox

The Firefox add-on declares that it collects no data (`data_collection_permissions`: none).

## Changes and contact

If this policy changes, the change is listed in the [release notes](RELEASE_NOTES.md). Questions: open an [issue](https://github.com/borbiuk/hyperfriend/issues). The source code is open: <https://github.com/borbiuk/hyperfriend>.
