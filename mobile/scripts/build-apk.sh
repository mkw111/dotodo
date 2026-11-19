#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$project_root"
case "${1:-demo}" in
  deployed)
    export DOTODO_EMBED_WEB=0
    export EXPO_PUBLIC_DOTODO_DEPLOYED=1
    export EXPO_PUBLIC_WEB_URL=https://www.save-time.kro.kr/dotodo/
    export DOTODO_HTTPS_ONLY=1
    ;;
  demo)
    VITE_DATA_MODE=demo npm run build
    node mobile/scripts/embed-web.mjs
    export DOTODO_EMBED_WEB=1
    export EXPO_PUBLIC_DOTODO_DEPLOYED=0
    export DOTODO_HTTPS_ONLY=0
    ;;
  *)
    echo "Usage: $0 [demo|deployed]" >&2
    exit 1
    ;;
esac
cd mobile
./node_modules/.bin/expo prebuild --platform android --no-install
# Gradle does not track Expo's public environment variables as bundle inputs.
# Remove the generated bundle when switching between demo and deployed builds.
rm -rf android/app/build/generated/assets/createBundleReleaseJsAndAssets \
  android/app/build/generated/res/createBundleReleaseJsAndAssets
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
