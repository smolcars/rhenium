# APK installation review fixture

This small Android app demonstrates Rhenium handing a downloaded APK to the real
Android installer. It has no requested permissions, native libraries, network
access, accounts, or background services. Its only activity displays installation
confirmation and a Close button. It is a review fixture, separate from Rhenium.

Build with the existing Chromium SDK and the project's JDK. The output, synthetic
test signing key, and APK stay outside Git:

```sh
ANDROID_SDK_ROOT="$HOME/.cache/brave-tv/workspace/src/third_party/android_sdk/public" \
  nix develop --command bash tests/device/install-demo/build.sh \
  "$HOME/.cache/brave-tv/install-demo"
```

The build verifies its APK signature and prints its permissions; the output
contains only the package name, because the manifest requests no permissions.
The test key is independent of Rhenium's private upload and Google signing keys.

Serve `download.html` as `index.html` alongside `RheniumInstallDemo.apk` on a
local test website. Open that website in the production browser, select the
download link, approve the download and Chromium's file warning, then choose
**Browser controls → Downloads → RheniumInstallDemo.apk → Open file**.
Approve the source in Android's **Install unknown apps** settings and confirm
**Install** in Android's installer. **Open** starts the confirmation activity.
This exercises the actual browser download and installation consent flow.

After recording, delete the fixture downloads through the browser, uninstall the
demo, restore the original installation-source setting, and remove the owned
test-server/ADB mapping. Preserve the browser and other apps' data.
