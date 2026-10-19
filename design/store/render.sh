#!/bin/bash
set -euo pipefail

# Renders the Chrome Web Store promo images from design/store/promo.html.
# Requires Google Chrome (headless rendering), ImageMagick (`magick`) and network access (Google Fonts).
# Output: 24-bit PNG files without transparency in design/store/.

STORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

# name, width, height, size param, theme, background color for flattening
render() {
	local name="$1" width="$2" height="$3" size="$4" theme="$5" bg="$6"

	"${CHROME}" --headless=new --disable-gpu --hide-scrollbars \
		--force-device-scale-factor=1 --allow-file-access-from-files \
		--virtual-time-budget=8000 --window-size="${width},${height}" \
		--screenshot="${TMP_DIR}/${name}.png" \
		"file://${STORE_DIR}/promo.html?size=${size}&theme=${theme}" > /dev/null 2>&1

	magick "${TMP_DIR}/${name}.png" -crop "${width}x${height}+0+0" +repage \
		-background "${bg}" -alpha remove -alpha off -strip "PNG24:${STORE_DIR}/${name}.png"
	echo "'${STORE_DIR}/${name}.png' was created."
}

render promo-small-440x280-dark 440 280 small dark '#121613'
render promo-small-440x280-light 440 280 small light '#f2f5f3'
render promo-marquee-1400x560-dark 1400 560 marquee dark '#121613'
render promo-marquee-1400x560-light 1400 560 marquee light '#f2f5f3'
