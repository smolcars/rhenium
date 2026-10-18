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
