# Play listing assets

English descriptions reflect the shipped README and browser behavior. The
publishing helper fills missing descriptions without replacing owner-written
text. Its `images` operation fills empty image groups and preserves existing
groups; it does not change release tracks.

- `images/icon.png`: approved Mint Orbit mark from `assets/icon.svg`, 512×512 RGBA.
- `images/tv-banner.png`: approved `assets/rhenium-tv-banner.svg`, 1280×720 RGB.
- `feature-graphic.svg` and its 1024×500 RGB PNG reuse the same outlined wordmark
  and approved colors, without adding fonts or new logo artwork.
- `images/tv-home.png` and `tv-menu.png`: unaltered 1920×1080 captures of the
  Google Play-signed ARM32 release 0.1.0 / 1003 on an Android 14 Chromecast.
  Opaque RGBA captures were exported as RGB PNG for Play; every RGB pixel was
  compared with the original capture and matched. Raw originals and checks
  remain under `~/.cache/brave-tv/evidence/play-store-preflight-20261018/`.

Vector exports used librsvg 2.62.4 from the repository's locked Nixpkgs input.
The wordmark font attribution is recorded in `assets/rhenium-artwork.md`.
The actual Home screenshot retains its background-photo attribution.

Google's [preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
define the image dimensions, formats and screenshot requirements. Successful
uploads do not establish policy approval or a public production release.

## APK-installation permission declaration

[`install-packages-declaration.txt`](install-packages-declaration.txt) is the
paste-ready feature explanation for `REQUEST_INSTALL_PACKAGES`. Select **Web
browsing or search** where offered and **App functionality** for usage. The
full description in `en-US.json` also explains APK download/installation, as
required for prominently documenting this feature. The earlier fill-missing
listing operation preserves existing text, so this paragraph must also be added
to the saved Play listing rather than assuming the source edit updates it.

[`tests/device/install-demo`](../../tests/device/install-demo/README.md) contains
the no-permission sample app and download webpage used for the review video.
The actual production APK hands it to Android's installer; the recording shows
both source approval and installation confirmation. Video evidence and public
link are recorded in `docs/play-release.md`.

## App links and foreground-service declarations

[`remaining-permissions-declarations.md`](remaining-permissions-declarations.md)
contains verified app-link, download and playback videos and paste-ready form
answers. The microphone service failed physical verification; the owner chose
to remove that unused background capability in replacement builds, while
retaining foreground website microphone access. Do not use the other videos
as microphone evidence or claim the currently uploaded bundles omit it.
