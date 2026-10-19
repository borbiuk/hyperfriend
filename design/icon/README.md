# Hyperfriend icon

The extension icon is a 3×3 grid of rounded tiles, like the contribution graph on a GitHub profile. The green tiles form the letter **H** (for Hyperfriend): the left and right columns plus the middle row. The two empty tiles (top and bottom middle) stay light gray. The background is transparent.

## Why it is an original mark

The icon is drawn from scratch for this project. It does not use the GitHub logo, the Octocat or any other GitHub mascot, which GitHub's brand guidelines do not allow in third-party marks. It only borrows the idea of a contribution-graph grid and the public GitHub green palette, so the extension feels at home on github.com without pretending to be a GitHub product.

## Palette

GitHub 2026 brand colors:

| Name    | Hex       | Used for                         |
| ------- | --------- | -------------------------------- |
| Green 4 | `#0FBF3E` | Main green tiles (all sizes)     |
| Green 5 | `#08872B` | Darker green tiles (all sizes)   |
| Green 3 | `#5FED83` | Lighter green tiles (48 and 128) |
| Gray 2  | `#D2D9D4` | Empty tiles (all sizes)          |

Small sizes (16 and 32 px) use only the two stronger greens (Green 4 and Green 5), to keep enough contrast with the empty tiles.

## Sizes and files

| Size   | Source                    | Grid                                | Output                       |
| ------ | ------------------------- | ----------------------------------- | ---------------------------- |
| 128 px | `hyperfriend-icon.svg`    | 28 px tiles, 6 px gaps, corner 7 px | `public/assets/logo-128.png` |
| 48 px  | `hyperfriend-icon-48.svg` | 12 px tiles, 3 px gaps, corner 3 px | `public/assets/logo-48.png`  |
| 32 px  | `hyperfriend-icon-32.svg` | 8 px tiles, 2 px gaps, corner 2 px  | `public/assets/logo-32.png`  |
| 16 px  | `hyperfriend-icon-16.svg` | 4 px tiles, 1 px gaps, corner 1 px  | `public/assets/logo-16.png`  |

- The 128 px canvas holds 96 px of artwork with a 16 px transparent margin on each side (Chrome Web Store guideline).
- Every size has its own source, aligned to the pixel grid, instead of scaling the master down. This keeps the tiles sharp at 16 and 32 px.
- The PNGs are referenced by `icons` and `action.default_icon` in both manifests and are included in the zip packages by `zip.sh`.

## Regenerating the PNGs

Requirements: Google Chrome (headless rendering) and ImageMagick (`magick`).

```bash
./design/icon/render.sh
```

The script renders each SVG with headless Chrome and writes `public/assets/logo-{16,32,48,128}.png`. On macOS it uses `/Applications/Google Chrome.app`; set the `CHROME` environment variable to use another binary:

```bash
CHROME=/path/to/chrome ./design/icon/render.sh
```

After changing an SVG, run the script and commit the SVGs together with the updated PNGs.
