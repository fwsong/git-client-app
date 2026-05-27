#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS packaging must run on macOS."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js LTS first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js LTS first."
  exit 1
fi

node -e "const v=process.versions.node.split('.').map(Number); process.exit(v[0]>22 || (v[0]===22 && v[1]>=12) ? 0 : 1)" || {
  echo "Node.js >= 22.12.0 is required. Current: $(node -v)"
  echo "Use a newer Node before packaging, for example: nvm use 22"
  exit 1
}

if ! command -v sips >/dev/null 2>&1 || ! command -v iconutil >/dev/null 2>&1; then
  echo "sips and iconutil are required. They are included with macOS."
  exit 1
fi

APP_VERSION="$(node -p "require('./package.json').version")"
ICON_SOURCE="build/icon.png"
ICONSET_DIR="build/icon.iconset"
ICNS_PATH="build/icon.icns"

echo "==> GitX macOS packaging"
echo "    version: $APP_VERSION"

if [[ "${INSTALL_DEPS:-1}" == "1" ]]; then
  echo "==> Installing dependencies"
  npm ci
fi

if [[ ! -f "$ICON_SOURCE" ]]; then
  echo "Missing $ICON_SOURCE. Add a 1024x1024 PNG icon before packaging."
  exit 1
fi

echo "==> Generating macOS icon"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

sips -z 16 16     "$ICON_SOURCE" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32     "$ICON_SOURCE" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32     "$ICON_SOURCE" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64     "$ICON_SOURCE" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128   "$ICON_SOURCE" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256   "$ICON_SOURCE" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$ICON_SOURCE" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512   "$ICON_SOURCE" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$ICON_SOURCE" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET_DIR" -o "$ICNS_PATH"
rm -rf "$ICONSET_DIR"

if [[ "${CLEAN_DIST:-1}" == "1" ]]; then
  echo "==> Cleaning dist"
  rm -rf dist
fi

if [[ -z "${CSC_NAME:-}" && -z "${CSC_LINK:-}" ]]; then
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  echo "==> Building unsigned DMG and ZIP"
else
  echo "==> Building signed DMG and ZIP"
fi

npm run dist:mac

echo "==> Done"
find dist -maxdepth 1 \( -name "*.dmg" -o -name "*-mac.zip" \) -print | sort | sed 's/^/    /'
