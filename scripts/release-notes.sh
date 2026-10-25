#!/usr/bin/env bash
# Prints the GitHub Release notes of one version: the `## x.y.z` section of RELEASE_NOTES.md, an
# install block and a link to the changes since the previous tag.
# Usage: scripts/release-notes.sh <x.y.z> [<ref>]   (<ref> is the tagged commit, default HEAD)
set -euo pipefail

VERSION="${1:?Usage: scripts/release-notes.sh <x.y.z> [<ref>]}"
REF="${2:-HEAD}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_URL="https://github.com/borbiuk/hyperfriend"

# The lines after the version heading, up to the next `## ` heading, without blank lines at both ends
section="$(awk -v version="${VERSION}" '
  $0 == "## " version { found = 1; next }
  found && /^## / { exit }
  found { print }
' "${ROOT_DIR}/RELEASE_NOTES.md" | awk 'NF { started = 1 } started { print }' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')"

if [[ -z "${section}" ]]; then
  echo "Error: no '## ${VERSION}' section in RELEASE_NOTES.md" >&2
  exit 1
fi

previous_tag="$(git -C "${ROOT_DIR}" describe --tags --abbrev=0 "${REF}^" 2>/dev/null || true)"

printf '%s\n\n' "${section}"
cat <<INSTALL
### Install

Download \`hyperfriend-chrome-${VERSION}.zip\` (Chrome) or \`hyperfriend-firefox-${VERSION}.zip\` (Firefox) and unzip it.

- **Chrome**: open \`chrome://extensions\`, turn on **Developer mode**, click **Load unpacked** and pick the unzipped folder.
- **Firefox**: open \`about:debugging\`, **This Firefox**, **Load Temporary Add-on...** and pick \`manifest.json\` from the unzipped folder.
INSTALL

if [[ -n "${previous_tag}" ]]; then
  printf '\n**Full changelog:** %s/compare/%s...%s\n' "${REPO_URL}" "${previous_tag}" "${VERSION}"
fi
