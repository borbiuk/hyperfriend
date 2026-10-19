#!/bin/bash

# Get the version from manifest.json
version=$(jq -r '.version' public/manifest.json)

# Update the version in package.json
jq --arg new_version "$version" '.version = $new_version' package.json > package.json.tmp
mv package.json.tmp package.json

# Keep the Firefox manifest version in sync with manifest.json
jq --arg new_version "$version" '.version = $new_version' public/manifest.firefox.json > public/manifest.firefox.json.tmp
mv public/manifest.firefox.json.tmp public/manifest.firefox.json

# Restore tab indentation of the updated files
npx prettier --write package.json public/manifest.firefox.json --config ./.prettierrc.json > /dev/null

echo "Version updated to: $version"
