#!/usr/bin/env bash
# Run in nix develop; the test signing key and APK stay outside Git.
set -euo pipefail
sdk=${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT}
platform=${ANDROID_TEST_PLATFORM:-android-37.0}
build_tools=${ANDROID_TEST_BUILD_TOOLS:-37.0.0}
out=${1:?Pass an external output directory}
fixture=$(cd -- "$(dirname -- "$0")" && pwd)
mkdir -p "$out/classes"
javac --release 8 -classpath "$sdk/platforms/$platform/android.jar" -d "$out/classes" "$fixture/MainActivity.java"
jar cf "$out/classes.jar" -C "$out/classes" .
"$sdk/build-tools/$build_tools/d8" --min-api 26 --lib "$sdk/platforms/$platform/android.jar" --output "$out" "$out/classes.jar"
"$sdk/build-tools/$build_tools/aapt" package -f -M "$fixture/AndroidManifest.xml" -I "$sdk/platforms/$platform/android.jar" -F "$out/unsigned.apk"
(cd "$out" && zip -q unsigned.apk classes.dex)
"$sdk/build-tools/$build_tools/zipalign" -f 4 "$out/unsigned.apk" "$out/RheniumInstallDemo.apk"
if [ ! -f "$out/test.keystore" ]; then
  keytool -genkeypair -keystore "$out/test.keystore" -storepass android -keypass android -alias test -dname CN=RheniumInstallDemo -keyalg RSA -validity 365
fi
"$sdk/build-tools/$build_tools/apksigner" sign --ks "$out/test.keystore" --ks-pass pass:android "$out/RheniumInstallDemo.apk"
"$sdk/build-tools/$build_tools/apksigner" verify "$out/RheniumInstallDemo.apk"
"$sdk/build-tools/$build_tools/aapt" dump permissions "$out/RheniumInstallDemo.apk"
