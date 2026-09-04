#!/usr/bin/env bash

set -euo pipefail

FLUTTER_VERSION="3.47.2"

# Default the backend base URL to the MOTION production API unless explicitly
# set in the build environment. This keeps the Render build deterministic:
# an unset or empty API_BASE_URL would otherwise bake an empty/invalid URL into
# the web build and the app would never reach the backend.
API_BASE_URL="${API_BASE_URL:-https://motion-action-economy.onrender.com}"

echo "==> Render working directory:"
pwd

echo "==> Installing Flutter ${FLUTTER_VERSION}..."

cd /tmp

curl -fL \
  "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz" \
  -o flutter.tar.xz

tar -xf flutter.tar.xz

export PATH="/tmp/flutter/bin:$PATH"

echo "==> Flutter version:"
flutter --version

# IMPORTANT:
# Render's root directory is apps/mobile.
# Return to the Flutter project before running pub/build commands.
cd "$OLDPWD"

echo "==> Flutter project directory:"
pwd

echo "==> Checking Flutter project..."

if [ ! -f "pubspec.yaml" ]; then
  echo "ERROR: pubspec.yaml not found."
  echo "Current directory: $(pwd)"
  exit 1
fi

echo "==> Getting Dart dependencies..."
flutter pub get

echo "==> Building Flutter Web..."
echo "    API_BASE_URL=${API_BASE_URL}"

flutter build web --release \
  --dart-define="API_BASE_URL=${API_BASE_URL}" \
  --dart-define="DEMO_MODE=${DEMO_MODE:-true}"

echo "==> Flutter Web build complete."

if [ ! -f "build/web/index.html" ]; then
  echo "ERROR: build/web/index.html was not generated."
  exit 1
fi

echo "==> Output:"
ls -lah build/web

echo "==> Render Flutter build successful."
