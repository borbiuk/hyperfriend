# Store assets

Images for the Chrome Web Store listing (the store text is in [LISTING.md](../../LISTING.md)). The icon is described in [design/icon](../icon/README.md).

## Files

| File                                        | What it is                                                            |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `promo.html`                                | Source of the promo images (`?size=small\|marquee&theme=dark\|light`) |
| `render.sh`                                 | Renders the four promo PNGs from `promo.html`                         |
| `capture-screenshots.mjs`                   | Captures the screenshots into `screenshots/`                          |
| `promo-small-440x280-dark.png`              | Small promo tile, dark                                                |
| `promo-small-440x280-light.png`             | Small promo tile, light                                               |
| `promo-marquee-1400x560-dark.png`           | Marquee promo tile, dark                                              |
| `promo-marquee-1400x560-light.png`          | Marquee promo tile, light                                             |
| `screenshots/1-pull-request-list-light.jpg` | Pull Request list with the copy button tooltip (light)                |
| `screenshots/2-pull-request-page-dark.jpg`  | Pull Request page after a click, "Copied!" (dark)                     |
| `screenshots/3-settings-popup-light.jpg`    | Settings popup (light)                                                |
| `screenshots/4-settings-popup-dark.jpg`     | Settings popup (dark)                                                 |

The owner picks the dark or the light promo variant.

## Which file goes where in the Chrome Web Store dashboard

Store listing tab:

| Dashboard field       | Size and format                | File                                                                    |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Store icon            | 128×128 PNG                    | `public/assets/logo-128.png` (the same icon as in the package)          |
| Screenshots (up to 5) | 1280×800 JPEG                  | `screenshots/1-…` to `screenshots/4-…`, in this order                   |
| Small promo tile      | 440×280, 24-bit PNG, no alpha  | `promo-small-440x280-dark.png` or `promo-small-440x280-light.png`       |
| Marquee promo tile    | 1400×560, 24-bit PNG, no alpha | `promo-marquee-1400x560-dark.png` or `promo-marquee-1400x560-light.png` |
| Description           | text                           | `LISTING.md`                                                            |

The package itself (`hyperfriend-build-chrome_*.zip`) comes from `npm run zip` and already contains the extension icons.

## Promo images

`promo.html` uses Mona Sans (loaded from Google Fonts), GitHub's brand neutrals and a green accent. The size and theme come from the query string: `promo.html?size=small&theme=dark`, `size=marquee`, `theme=light`.

```bash
./design/store/render.sh
```

The script renders four PNGs with headless Chrome and ImageMagick (24-bit, without transparency) and writes them next to `promo.html`. It needs Google Chrome and ImageMagick (`magick`), like the [icon script](../icon/README.md). It needs network access for the font.

## Screenshots

```bash
npm run build
node design/store/capture-screenshots.mjs
```

The script uses headless Chrome through the DevTools protocol (no npm dependencies). It opens pages of `github.com/borbiuk/hyperfriend`, injects the built `dist/content.js`, hovers and clicks to show the tooltips, renders `dist/options.html` and composites it as the open popup. It writes 1280×800 JPEGs into `screenshots/`.

Notes:

- The pages need **open demo Pull Requests #1 to #3** in the repository. They are closed after the screenshots are taken, so re-capturing later needs open Pull Requests again.
- The clipboard is stubbed in headless Chrome, so "Copied!" is shown without a real copy.
- The scale is set with `--force-device-scale-factor`. A device-metrics override makes `captureScreenshot` fire `mouseleave`, which would hide the tooltip.
- `prefers-reduced-motion: reduce` is emulated, so the tooltip has no fade-in animation in the image.
- Rebuild (`npm run build`) first: the script uses the files in `dist/`.
