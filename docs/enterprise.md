# GitHub Enterprise

Hyperfriend works on **GitHub Enterprise Cloud with data residency** (`mycompany.ghe.com` and every other `*.ghe.com` site) without any setup: open a Pull Request list and the buttons are there.

For a **GitHub Enterprise Server** on its own domain, you allow the site once:

1. Open the popup, go to the **General** tab and click the **Enterprise Server domains** row.
2. Type the domain of your site (for example `github.example.com`; a pasted URL works too) and click **Add**.
3. The browser asks you to allow Hyperfriend to access that site. After you agree, the copy buttons, the keyboard shortcut and the list selection work there, also in the tabs of that site that are already open.

Remove a domain with **Remove** in the same section; the browser then takes the access back. Notes:

- Only `https` sites, one exact domain each (no wildcards, no port); `*.ghe.com` sites need no entry and are refused here. Nothing else is accessed: the extension asks for one domain at a time, only after you typed it.
- The links point to your site (`https://github.example.com/OWNER/REPO/pull/12`), and Pull Requests, Issues, Discussions and workflow runs work as on github.com. Author avatars are shown on github.com only.
- The added domains belong to this browser and are not part of the settings file. The browser may keep the access when you remove the extension's data; remove it in the extension's site access settings.
- The buttons depend on the markup of your GitHub version: Enterprise Server versions that are older than the current github.com can look different, and the buttons may be missing on some pages.
- In Firefox the popup closes when the permission prompt opens, so **Add** there opens the settings page in a browser tab, where you type the domain again and add it.
- After **Remove**, pages of that site that are already open keep their buttons until you reload them (the section says so). The browser's own site access settings (Chrome: the extension's details page, Firefox: `about:addons`) also show these grants; any `https` site granted there, not only the ones you typed here, gets the content script (except `*.ghe.com`, which the manifest covers), and a site with a different layout simply shows no buttons. The broad `https://*/*` entry that Firefox lists as optional does nothing by itself; while it is turned on, the browser accepts a new domain without storing it, so **Add** says the domain was not added and asks you to turn that access off first.
- The domain is a plain host: `github.com`, `ghe.com` and their subdomains are refused (they need no entry), international names are converted to their ASCII form.
