#!/bin/sh
# Build the web game for the app and copy it into the Android assets. Run from anywhere.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
(cd "$HERE/.." && node tools/build.mjs --target app)
rm -rf "$HERE/app/src/main/assets"
mkdir -p "$HERE/app/src/main/assets"
cp "$HERE/../dist/app/index.html" "$HERE/app/src/main/assets/index.html"
echo "synced -> app/src/main/assets/index.html"
