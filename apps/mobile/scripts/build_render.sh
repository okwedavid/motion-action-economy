#!/usr/bin/env bash

set -euo pipefail

FLUTTER_VERSION="3.47.2"

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
