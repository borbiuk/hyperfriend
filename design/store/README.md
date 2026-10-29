# Store assets

Images for the Chrome Web Store listing (the store text is in [LISTING.md](../../LISTING.md)). The icon is described in [design/icon](../icon/README.md). In Claude Code, the `/store-assets` skill runs the steps below and checks the results.

## Files

| File                                        | What it is                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `promo.html`                                | Source of the promo images (`?size=small\|marquee&theme=dark\|light`)                   |
| `render.sh`                                 | Renders the four promo PNGs from `promo.html`                                           |
| `capture-screenshots.mjs`                   | Captures the screenshots into `screenshots/`                                            |
| `popup-screenshot.html`                     | Page for the popup screenshots (`?tab=templates\|shortcuts\|general&theme=dark\|light`) |
| `promo-small-440x280-dark.png`              | Small promo tile, dark                                                                  |
| `promo-small-440x280-light.png`             | Small promo tile, light                                                                 |
| `promo-marquee-1400x560-dark.png`           | Marquee promo tile, dark                                                                |
| `promo-marquee-1400x560-light.png`          | Marquee promo tile, light                                                               |
| `screenshots/1-pull-request-list-light.jpg` | Pull Request list with the copy button tooltip (light)                                  |
| `screenshots/2-pull-request-page-dark.jpg`  | Pull Request page after a click, "Copied!" (dark)                                       |
| `screenshots/3-popup-templates-light.jpg`   | Popup, Templates tab (light)                                                            |
| `screenshots/4-popup-shortcuts-dark.jpg`    | Popup, Shortcuts tab (dark)                                                             |
| `screenshots/5-popup-general-light.jpg`     | Popup, General tab (light)                                                              |

The owner picks the dark or the light promo variant.

## Which file goes where in the Chrome Web Store dashboard

Store listing tab:

| Dashboard field       | Size and format                | File                                                                    |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Store icon            | 128×128 PNG                    | `public/assets/logo-128.png` (the same icon as in the package)          |
| Screenshots (up to 5) | 1280×800 JPEG                  | `screenshots/1-…` to `screenshots/5-…`, in this order                   |
| Small promo tile      | 440×280, 24-bit PNG, no alpha  | `promo-small-440x280-dark.png` or `promo-small-440x280-light.png`       |
| Marquee promo tile    | 1400×560, 24-bit PNG, no alpha | `promo-marquee-1400x560-dark.png` or `promo-marquee-1400x560-light.png` |
| Description           | text                           | `LISTING.md`                                                            |

The package itself (`artifacts/hyperfriend-*_build_*_chrome.zip`) comes from `npm run zip` and already contains the extension icons.

## Promo images

`promo.html` uses Mona Sans (loaded from Google Fonts), GitHub's brand neutrals and a green accent. The size and theme come from the query string: `promo.html?size=small&theme=dark`, `size=marquee`, `theme=light`.

```bash
./design/store/render.sh
```

The script renders four PNGs with headless Chrome and ImageMagick (24-bit, without transparency) and writes them next to `promo.html`. It needs Google Chrome and ImageMagick (`magick`), like the [icon script](../icon/README.md). It needs network access for the font.

## Screenshots

```bash
npm run build
node design/store/capture-screenshots.mjs          # all five
node design/store/capture-screenshots.mjs popup    # only 3-5 (popup)
node design/store/capture-screenshots.mjs pages    # only 1-2 (GitHub pages)
```

The script uses headless Chrome through the DevTools protocol (no npm dependencies) and writes 1280×800 JPEGs into `screenshots/`.

- **Pages (1–2)**: it opens pages of `github.com/borbiuk/hyperfriend`, injects the built `dist/content.js` and hovers and clicks to show the tooltips.
- **Popup (3–5)**: it serves the repository on a local http server and opens `popup-screenshot.html`, which shows the built `dist/options.html` (one tab per image) at 1.25× next to a short headline, in the style of the promo images. No GitHub pages or demo Pull Requests are needed.

Notes:

- The page screenshots need **open demo Pull Requests #1 to #3** in the repository. They were closed after the 1.0.0 screenshots were taken, so re-capturing them needs open Pull Requests again.
- The clipboard is stubbed in headless Chrome, so "Copied!" is shown without a real copy.
- The scale is set with `--force-device-scale-factor`. A device-metrics override makes `captureScreenshot` fire `mouseleave`, which would hide the tooltip.
- `prefers-reduced-motion: reduce` is emulated, so the tooltip has no fade-in animation in the image.
- The popup shows the default settings (the page has no `chrome.storage`) and the platform of the machine that runs the script (⇧C on a Mac).
- Rebuild (`npm run build`) first: the script uses the files in `dist/`.
