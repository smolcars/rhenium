#!/usr/bin/env bash
# Only the separate link receiver is built; Rhenium is not modified.
set -euo pipefail
sdk=${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT}
out=${1:?Pass an external output directory}
fixture=$(cd -- "$(dirname -- "$0")" && pwd)
platform="$sdk/platforms/${ANDROID_TEST_PLATFORM:-android-37.0}/android.jar"
tools="$sdk/build-tools/${ANDROID_TEST_BUILD_TOOLS:-37.0.0}"
mkdir -p "$out/classes"
javac --release 8 -classpath "$platform" -d "$out/classes" "$fixture/MainActivity.java"
jar cf "$out/classes.jar" -C "$out/classes" .
"$tools/d8" --min-api 29 --lib "$platform" --output "$out" "$out/classes.jar"
"$tools/aapt" package -f -M "$fixture/AndroidManifest.xml" -I "$platform" -F "$out/unsigned.apk"
(cd "$out" && zip -q unsigned.apk classes.dex)
"$tools/zipalign" -f 4 "$out/unsigned.apk" "$out/RheniumLinkDemo.apk"
if [ ! -f "$out/test.keystore" ]; then
  keytool -genkeypair -keystore "$out/test.keystore" -storepass android -keypass android -alias test -dname CN=RheniumLinkDemo -keyalg RSA -validity 365
fi
"$tools/apksigner" sign --ks "$out/test.keystore" --ks-pass pass:android "$out/RheniumLinkDemo.apk"
"$tools/apksigner" verify "$out/RheniumLinkDemo.apk"
"$tools/aapt" dump permissions "$out/RheniumLinkDemo.apk"
