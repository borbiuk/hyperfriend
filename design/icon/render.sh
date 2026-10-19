#!/bin/bash
set -euo pipefail

# Renders the Hyperfriend icon SVG sources into the PNGs used by the manifests.
# Requires Google Chrome (headless rendering) and ImageMagick (`magick`).
# Output: public/assets/logo-{16,32,48,128}.png

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="${ROOT_DIR}/design/icon"
OUT_DIR="${ROOT_DIR}/public/assets"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

mkdir -p "${OUT_DIR}"

for size in 16 32 48 128; do
	src="${SRC_DIR}/hyperfriend-icon-${size}.svg"
	if [[ "${size}" == "128" ]]; then
		src="${SRC_DIR}/hyperfriend-icon.svg"
	fi

	page="${TMP_DIR}/render-${size}.html"
	printf '<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}img{display:block;width:%spx;height:%spx}</style></head><body><img src="file://%s"></body></html>' \
		"${size}" "${size}" "${src}" > "${page}"

	"${CHROME}" --headless=new --disable-gpu --hide-scrollbars \
		--force-device-scale-factor=1 --default-background-color=00000000 \
		--allow-file-access-from-files --window-size="${size},${size}" \
		--screenshot="${TMP_DIR}/logo-${size}.png" "file://${page}" > /dev/null 2>&1

	magick "${TMP_DIR}/logo-${size}.png" -crop "${size}x${size}+0+0" +repage -strip \
		"PNG32:${OUT_DIR}/logo-${size}.png"
	echo "'${OUT_DIR}/logo-${size}.png' was created."
done
