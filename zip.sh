#!/bin/bash

# Files that will be included to .zip (paths are relative to the build directory)
include_files=(
	"assets/logo-16.png"
	"assets/logo-32.png"
	"assets/logo-48.png"
	"assets/logo-128.png"
	"content.js"
	"manifest.json"
	"options.html"
	"options.js"
)

# Re-create a build of extension by webpack and create a .zip file of the extension package.
# $1 - browser name used in the .zip file name (chrome | firefox)
# $2 - build directory created by webpack (dist | dist-firefox)
# $3 - npm script that builds the extension (build | build:firefox)
create_package() {
	local browser="$1"
	local build_dir="$2"
	local build_script="$3"

	# Re-create a build of extension by webpack to the build directory
	if [ -d "$build_dir" ]; then
		rm -r "$build_dir"
		echo "'$build_dir' removed"
	else
		echo "'$build_dir' not found"
	fi
	npm run "$build_script" || exit 1

	local current_date_time
	current_date_time=$(date +'%d-%m-%Y_%H:%M:%S')

	local version
	version=$(jq -r '.version' "$build_dir/manifest.json")

	local zip_filename="hyperfriend-build-${browser}_${current_date_time}_${version}.zip"
	local temp_dir="hyperfriend-build-${browser}"

	# Create a temporary directory
	rm -rf "$temp_dir"
	mkdir "$temp_dir"

	# Copy to the temporary directory
	for file in "${include_files[@]}"; do
		# Create the destination directory
		local destination_dir="$temp_dir/$(dirname "$file")"
		if [ ! -d "$destination_dir" ]; then
			mkdir -p "$destination_dir"
		fi

		# Copy the file to the temporary directory
		cp "$build_dir/$file" "$destination_dir/" || exit 1
	done

	# Create a .zip file with the extension files at the archive root
	# (required by addons.mozilla.org, accepted by Chrome Web Store)
	(cd "$temp_dir" && zip -r "../$zip_filename" .)

	# Clean up the temporary directory
	rm -r "$temp_dir"

	echo "'$zip_filename' was created."
}

###############################################################
# Create .zip files of Chrome and Firefox extension packages  #
###############################################################

create_package "chrome" "dist" "build"
create_package "firefox" "dist-firefox" "build:firefox"
