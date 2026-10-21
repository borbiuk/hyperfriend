---
name: store-assets
description: Regenerates the Chrome Web Store images of Hyperfriend (promo tiles and screenshots) from the current build and checks their sizes and formats. Use when the popup, the copy button, the icon or the promo text changed, before a release, or when the user asks to update the store images, promo tiles or screenshots ("онови скріншоти", "картинки для стору").
argument-hint: '[popup | promo | pages | all]'
allowed-tools: Bash(npm run build) Bash(./design/store/render.sh) Bash(node design/store/capture-screenshots.mjs *) Bash(magick identify *)
---

Regenerate the store images for `$ARGUMENTS` (default: `popup` and `promo`). File list, dashboard fields and script details are in [design/store/README.md](../../../design/store/README.md).

## Steps

1. **Build**: `npm run build`. The screenshots load `dist/`, so a stale build gives stale images.
2. **Promo tiles** (`promo`, `all`): `./design/store/render.sh` renders `promo.html` into the four `promo-*.png` files. Edit `promo.html` first if the demo content no longer matches the extension (for example the default template or the pasted link in the chat bubble).
3. **Popup screenshots** (`popup`, `all`): `node design/store/capture-screenshots.mjs popup` writes `3-popup-templates-light.jpg`, `4-popup-shortcuts-dark.jpg` and `5-popup-general-light.jpg` from `popup-screenshot.html`. The popup shows the default settings and the keys of the machine that runs it (⇧C on a Mac).
4. **Page screenshots** (`pages`, `all`; only when the user asks): they need open Pull Requests #1 to #3 in `borbiuk/hyperfriend`. Creating, closing or deleting demo Pull Requests and branches changes the public repository, so ask the user first and clean up afterwards. Then run `node design/store/capture-screenshots.mjs pages`.
5. **Check formats**: `magick identify design/store/*.png design/store/screenshots/*.jpg`. Promo tiles are 440×280 and 1400×560 24-bit PNG without alpha; screenshots are 1280×800 JPEG. The store accepts up to 5 screenshots.
6. **Look at every changed image** (open it) before reporting: cut-off popup, wrong theme, missing fonts or an outdated default template are the usual problems.
7. **Docs**: if file names change, update [design/store/README.md](../../../design/store/README.md) and the screenshot `<img>` at the top of `README.md` (it shows `4-popup-shortcuts-dark.jpg` and the dark marquee banner).

## Notes

- Fonts load from Google Fonts, so the scripts need network access.
- Both scripts run headless Google Chrome from its macOS path (set `CHROME` to use another binary) and need ImageMagick (`magick`). `capture-screenshots.mjs` also uses ports 9333 (DevTools) and 9334 (local file server).
- Report which images changed and which store dashboard fields need a new upload.
