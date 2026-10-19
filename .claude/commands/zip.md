---
description: Create .zip build artifacts for Chrome and Firefox (runs ./zip.sh)
allowed-tools: Bash(npm run zip)
---

Run `npm run zip`. It rebuilds both browsers (`dist/` and `dist-firefox/`) and creates `hyperfriend-build-chrome_*.zip` and `hyperfriend-build-firefox_*.zip`. Report the names of the created archives. The script needs `jq` and `zip`; if one is missing, say so instead of working around it.
