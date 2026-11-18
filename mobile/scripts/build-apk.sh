#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$project_root"
VITE_DATA_MODE=demo npm run build
node mobile/scripts/embed-web.mjs

export DOTODO_EMBED_WEB=1
cd mobile
./node_modules/.bin/expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
