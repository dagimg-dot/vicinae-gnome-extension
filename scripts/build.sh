#!/usr/bin/env bash

set -e

# ==============================================================================
# This script builds the zip package for the extension. It compiles translations
# and resources, if there are any. It also installs the extension, if requested.
# Use `--help` for more information.
# ==============================================================================

function compile_resources() {
	echo "Creating resource xml..."

	mkdir -p "$(dirname "$RESOURCE_XML")"

	cat <<-EOF > "$RESOURCE_XML"
		<?xml version='1.0' encoding='UTF-8'?>
		<gresources>
		  <gresource>
				$(find data/ -type f | while read -r FILE; do
					echo "    <file>${FILE#"data/"}</file>"
				done)
		  </gresource>
		</gresources>
	EOF

	echo "Resource xml created."
	echo "Compiling resources..."

	glib-compile-resources \
		--generate "$RESOURCE_XML" \
		--sourcedir="data" \
		--target="$RESOURCE_TARGET"

	echo "Resources compiled."
}

function compile_schemas(){
	echo "Compiling schemas..."

	glib-compile-schemas \
		"$JS_DIR/schemas"
}

function compile_translations() {
	echo "Compiling translations..."

	for PO_FILE in po/*.po; do
		LANG=$(basename "$PO_FILE" .po)
		mkdir -p "$JS_DIR/locale/$LANG/LC_MESSAGES"
		msgfmt -c "$PO_FILE" -o "$JS_DIR/locale/$LANG/LC_MESSAGES/$UUID.mo"
	done

	echo "Translations compiled."
}

function build_extension_package() {
	# Compile TypeScript files, if used
	if [ "$USING_TYPESCRIPT" = "true" ]; then
		if ! (command -v bun &> /dev/null); then
			echo "ERROR: bun isn't installed. Can't compile TypeScript files. Exiting..."

			exit 1
		fi

		if find . -maxdepth 1 -type d | grep -q "dist"; then
			echo "Removing old TypeScript dist/..."
			rm -rf $TYPESCRIPT_OUT_DIR
			echo "Done."
		fi

		if ! (find . -maxdepth 1 -type d | grep -q "node_modules"); then
			echo "Installing dependencies with Bun to compile TypeScript..."
			bun install > /dev/null
			echo "Dependencies installed."
		fi

		echo "Compiling TypeScript files..."
			if find scripts/ -type f | grep -q "esbuild.js"; then
				bun ./scripts/esbuild.js
			else
				bunx tsc
			fi
		echo "Done."

		if find src/ -type f | grep -qv ".ts"; then
			echo "Copying non-TypeScript src files to the dist directory..."
			(
				cd src/
				find . -type f ! -name '*.ts' | while read -r FILE; do
					cp --parents "$FILE" ../dist/
				done
			)
			echo "Done."
		fi
	fi

	# Compile translations, if there are any
	if (find po/ -type f | grep ".po$") &> /dev/null; then
		if command -v msgfmt &> /dev/null; then
			compile_translations
		else
			echo "WARNING: gettext isn't installed. Skipping compilation of translations..."
		fi
	fi

	# Compile resources, if there are any
	if (find data/ -type f | grep ".") &> /dev/null; then
		if command -v glib-compile-resources &> /dev/null; then
			compile_resources
		else
			echo "ERROR: glib-compile-resources isn't installed. Resources won't be compiled. This may cause errors for the extension. Please install glib-compile-resources and rebuild the extension. Exiting..."

			exit 1
		fi
	fi

	# Compile schemas (only if requested, not needed after GNOME 45)
	if [ "$COMPILE_SCHEMAS" = true ] && (find $JS_DIR/schemas/ -type f | grep ".") &> /dev/null; then
		if command -v glib-compile-schemas &> /dev/null; then
			compile_schemas
		else
			echo "ERROR: glib-compile-schemas isn't installed. Schemas won't be compiled. This may cause errors for the extension. Please install glib-compile-schemas and rebuild the extension. Exiting..."

			exit 1
		fi
	fi

	echo "Zipping files..."

	(
		mkdir -p "$BUILD_DIR"
		rm -f "$BUILD_DIR/$UUID.shell-extension-v$VERSION.zip"
		# Place the gresource at the root of the archive while keeping the built file under build/
		cp "$RESOURCE_TARGET" "$JS_DIR/"
		# Copy metadata.json and LICENSE to dist/ directory so they're at the root of the zip
		cp metadata.json "$JS_DIR/"
		cp LICENSE "$JS_DIR/"
		cd "$JS_DIR" && zip -qr "../$BUILD_DIR/$UUID.shell-extension-v$VERSION.zip" .
		# Clean up temporary files
		rm -f "$JS_DIR/$UUID.gresource"
		rm -f "$JS_DIR/metadata.json"
		rm -f "$JS_DIR/LICENSE"
	)

	echo "Extension package zipped."
}

function try_restarting_killall {
	killall -HUP gnome-shell
	echo "SUCCESS: Restart initiated using killall."
}

function try_restarting_gnome_shell() {
	# Initial check to see if we are running under Wayland. However, just cause
	# the session type isn't "wayland" doesn't mean we are running under X11.
	# We could be running something like a "tty" (e. g. via ssh).
	if [ "$XDG_SESSION_TYPE" = wayland ]; then
		echo "ERROR: Failed to restart GNOME Shell. You're on Wayland. Restarting GNOME Shell is not supported since it would also kill your entire session. Please use X11, or log out and log back in to apply the changes."

		return 1
	fi

	echo "Trying to restart GNOME Shell..."

	local js result

	js='if (Meta.is_wayland_compositor()) throw new Error("Wayland detected"); \
		else Meta.restart(_("Restarting…"), global.context);'

	result=$(gdbus call \
			--session \
			--dest org.gnome.Shell \
			--object-path /org/gnome/Shell \
			--method org.gnome.Shell.Eval string:"$js")

	if echo "$result" | grep -q "true"; then
		echo "SUCCESS: Restart initiated using gdbus."
	elif echo "$result" | grep -q "Wayland detected"; then
		echo "ERROR: Failed to restart GNOME Shell. You're on Wayland. Restarting GNOME Shell is not supported since it would also kill your entire session. Please use X11, or log out and log back in to apply the changes."
	elif echo "$result" | grep -q "false"; then
		echo "ERROR: Failed to restart GNOME Shell. It looks like you didn't enable GNOME's unsafe mode. Please make sure to enable it and that you're running GNOME on X11."
		echo "Trying to restart GNOME Shell using killall..."
		try_restarting_killall
	fi

	return 0
}

function install_extension_package() {
	echo "Installing the extension..."
	gnome-extensions install --force "$BUILD_DIR/$UUID.shell-extension-v$VERSION.zip"
	echo "Extension installed."

	if [ "$1" = "-r" ]; then
		try_restarting_gnome_shell
	else
		echo "Log out and log back in to apply the changes."
		echo "After that, if you haven't enabled the extension yet, do so to start using it."
	fi
}

function enable_extension() {
	echo "Enabling the extension..."
	gnome-extensions enable "$UUID"
	echo "Extension enabled."
}

function usage() {
	cat <<-EOF
	Build the zip package for this extension

	Usage:
	  $(basename "$0") [OPTION]

	Options:
	  -i, --install         Install the extension after building
	  -r, --unsafe-reload   Build and install the extension, then reload GNOME
	                        Shell. This is for development purposes as it restarts
	                        GNOME Shell with an X11 session by relying on the eval
	                        method. To use the eval method, you need to enable
	                        GNOME's unsafe mode. So this options is intended for
	                        safe environments. A dev workflow could look like this:
	                        Create a VM running GNOME on X11. Create a shared
	                        folder with your project in it. Develop on the host but
	                        run the build script within the VM using this option to
	                        quickly test your extension
	  --compile-schemas     Compile schemas (not needed after GNOME 45)
	  -h, --help            Display this help message
	EOF
}

###########################
# Main script starts here #
###########################

cd -- "$( dirname "$0" )/../"

UUID=$(grep -oP '"uuid": "\K[^"]+' metadata.json)
VERSION=$(grep -oP '"version": "\K[^"]+' package.json)
BUILD_DIR="build"
RESOURCE_XML="$BUILD_DIR/$UUID.gresource.xml"
RESOURCE_TARGET="$BUILD_DIR/$UUID.gresource"
USING_TYPESCRIPT=$(find . -maxdepth 1 -type f | grep -q "tsconfig.json" && echo "true" || echo "false")
TYPESCRIPT_OUT_DIR="dist"
COMPILE_SCHEMAS=false

if [ "$USING_TYPESCRIPT" = "true" ]; then
	JS_DIR="$TYPESCRIPT_OUT_DIR"
else
	JS_DIR="src"
fi

# Parse options
INSTALL=false
UNSAFE_RELOAD=false
BUILD=false

while [[ $# -gt 0 ]]; do
	case "$1" in
		--build | -b)
			BUILD=true
			shift
			;;
		--install | -i)
			INSTALL=true
			shift
			;;
		--unsafe-reload | -r)
			UNSAFE_RELOAD=true
			shift
			;;
		--compile-schemas)
			COMPILE_SCHEMAS=true
			shift
			;;
		--help | -h)
			usage
			exit 0
			;;
		*)
			echo "Invalid option: $1. Use --help for help."
			exit 1
			;;
	esac
done

# Default action is to build if no other action is specified
if [ "$BUILD" = false ] && [ "$INSTALL" = false ] && [ "$UNSAFE_RELOAD" = false ]; then
	BUILD=true
fi

if [ "$BUILD" = true ]; then
	build_extension_package
fi

if [ "$INSTALL" = true ]; then
	install_extension_package
	enable_extension
elif [ "$UNSAFE_RELOAD" = true ]; then
	install_extension_package -r
	enable_extension
fi
