# Google Play release preparation

## Published prerelease — 0.1.1

[Rhenium 0.1.1](https://github.com/smolcars/rhenium/releases/tag/v0.1.1) contains
Google Play-signed ARM32/ARM64 APKs and signed AABs, codes **1005 / 1006**.
It removes the unused `FOREGROUND_SERVICE_MICROPHONE` permission, microphone
foreground-service types and the runtime type addition. An explicit permission
guard also prevents experimental background capture from requesting that type.
`RECORD_AUDIO` remains; website microphone access works while Rhenium is open.
Background microphone capture is unsupported.

Build root `9a764c7b4e3ed3965bfb5a107a8d5c5958202783`, Brave source
`d29273ea6c5949cf82e8cc32e3bff9b869b4ff38`. Both incremental builds passed blocking
Android analysis: ARM64 **5m07.08s**, ARM32 **3m42.25s**. Bundle and Play-APK guards
verify the removed permission/type, retained `RECORD_AUDIO`, package/version,
Google signing identity, TV launcher, ABI and ELF/ZIP alignment. Both public APKs
use the existing Google Play key; local upload-key test install sets remain private.

The physical Android 14 ARM32 Chromecast passed native Home/remote navigation,
foreground microphone access with real website and Android permission prompts,
unsilenced capture and stop, app-link handoff, background download/checksum,
background mediaPlayback service/pause, Shields off/on and a manual signed-filter
recheck. The update required `pm uninstall -k` after insufficient storage; data
inode **82184** and all profile install states were preserved. Test tabs/files,
fixture app, microphone grant/flags/app-op modes, ADB routes and automation session
were cleaned up; normal Rhenium Home was restored. ARM64 hardware, 16 KB runtime
and broad streaming/DRM compatibility remain unverified.

[Stage](https://github.com/smolcars/rhenium/actions/runs/39151332839) and
[signed-APK retrieval](https://github.com/smolcars/rhenium/actions/runs/39151590908)
passed. The [closed-track operation](https://github.com/smolcars/rhenium/actions/runs/39152182340)
saved **1005 / 1006** and confirmed `RELEASE_LIFECYCLE_STATE_DRAFT`, then reported
that Google requires the first submission in Console. Its failure result records
that owner action; it is not a compilation failure or a submitted review. Both
internal and closed drafts contain the replacement codes. No production rollout
or owner legal agreement was performed.

Fresh captioned 0.1.1 videos and paste-ready answers are in
[remaining permission declarations](../release/play-listing/remaining-permissions-declarations.md).
Refresh that draft's foreground-service declaration and leave Microphone
unselected. The saved APK-installation declaration/video remain applicable.
Archive: `~/.cache/brave-tv/artifacts/rhenium-0.1.1-play/`; detailed evidence:
`~/.cache/brave-tv/evidence/play-release-0.1.1-20261018-r1/`.

## 0.1.0 release history

[Rhenium 0.1.0](https://github.com/smolcars/rhenium/releases/tag/v0.1.0) remains
public and unchanged, codes **1003 / 1004**, with its original Google-signed APKs,
AABs, checksums and validation records. The sections below record that release's
original build and publishing work; current draft codes and downloads are above.

## Engineering plan — 17 October 2026

Prepare the user's approved package `com.nitesh.rhenium` from the committed
Brave/Chromium source lock. The user has tested the updated browser on the
emulator. This work adds release packaging; it does not change browser behavior
or replace the installed development app.

1. Build upstream's optimized `Release` configuration with blocking Android
   analysis, non-debuggable APKs, Java optimization, and the production package.
   Preserve the existing Debug and Static output directories. Use separate
   `android_Play_arm64` and `android_Play_arm` outputs and bounded host resources.
   The wrapper uses `Release`, with `is_official_build=false` because Brave's
   official mode requires its private services key. Explicitly keep ThinLTO,
   disable DCHECK/Java asserts, and retain Java/resource optimization. This is
   an independently signed Rhenium release, not an official Brave distribution.
2. Package the upstream standalone browser bundles for ARM64 and ARM32. These
   targets each contain one browser ABI. Use consecutive version codes in one
   release, with the ARM64 code higher so capable devices receive it. Do not
   combine independently generated native libraries or V8 snapshots by hand.
   First candidate: version `0.1.0`, codes `1001`/`1002`. Its installer-protection
   replacement used `1003`/`1004`. Current release codes are in
   [android.json](../release/android.json).
3. Generate an independent upload key outside the repository. Keep its password
   and keystore private and back them up in GitHub Actions secrets. Sign archived
   bundle copies after compilation, keeping signing passwords out of GN/Ninja
   files and build logs. Google Play's app signing key is a separate identity.
4. Validate bundle structure, package/version, non-debuggable manifest, TV entry,
   native ABI, native ELF alignment, and the upload certificate. Generate
   device-specific install sets with upstream's pinned bundletool and check
   16 KB ZIP alignment on the 64-bit APKs. Archive source, arguments, checksums,
   mappings, logs, and validation results with the artifacts.
5. Validate the saved service-account credential through GitHub Actions. Prepare
   an internal-testing **draft**, preserving existing releases. Do not roll out
   production or send changes for review as part of this build task. Initial
   Play App Signing enrollment and a first manual upload may require the account
   owner in Play Console. Report actual API responses rather than assuming the
   draft is already addressable by its package name.
6. Publish the requested GitHub release with signed ARM32/ARM64 APKs and
   checksums. Download the universal APK for each bundle from Google Play's
   generated-APK API, then verify its manifest, ABI and signing certificate.
   This keeps GitHub APKs on the Play app-signing identity; the upload key signs
   AABs and local test install sets only. Do not publish test-signed APKs as the
   final GitHub downloads.

## Build and signing commands

Run inside the project's Nix environment:

```sh
python3 tools/build_play_release.py "$HOME/.cache/brave-tv/workspace" \
  "$HOME/.cache/brave-tv/evidence/play-release-20261017-r11"
python3 tools/package_play_release.py "$HOME/.cache/brave-tv/workspace" \
  "$HOME/.local/share/rhenium/signing" \
  --archive "$HOME/.cache/brave-tv/artifacts/rhenium-0.1.0-play-unprotected"
```

The original release builds and signing completed successfully in
`rhenium-play-release-r10.service`; the final incremental refresh and signing
completed in `rhenium-play-release-r11.service`. Both used eight local/total Siso steps, ten
allowed CPUs, and 20/22 GiB soft/hard memory limits. Earlier setup
attempts stopped during GN generation without compiling a browser. No existing
Debug/Static output was removed. Native symbols use level zero to fit this
builder; retain Java mappings and report that full native debug information is
not available from this configuration.
The four-worker compile was gracefully interrupted after its measured peak of
10,554,679,296 bytes and zero memory-pressure events. A later user-requested
increase from six to eight workers preserved the same output directories.
All checkpoints and logs are retained.

The first ARM64 bundle reached its final packaging check, which rejected an
AndroidX startup provider inherited by the `chrome` feature module. Chromium
already removes that automatic initialization provider from its base manifest.
The Brave manifest fragment now applies the same removal when rendered into
the feature module. This keeps APK and bundle startup behavior consistent;
the isolated-split validation remains enabled. The saved packaging command
reproduced this exact failure before the source correction. Both final builds
passed the isolated-split check after this correction. ARM32 started automatically after
ARM64 and completed in 2 hours 55 minutes. After disabling Google's installer
check, refreshing the build codes required only 50 incremental steps per ABI:
3 minutes 16 seconds for ARM64 and 3 minutes 7 seconds for ARM32. All native
library bytes match the original validated candidate; no clean build was needed.
The archive validator reads release metadata from the base manifest and the TV
launcher from the install-time `chrome` module, where Chromium places activities.
It checks that both manifests have the release package and that the exported TV
alias has a MAIN/LEANBACK intent filter.

The generated upload key is RSA 4096, alias `rhenium-upload`. Its public
certificate is [upload-cert.pem](../release/upload-cert.pem), fingerprint
`57d9c5ea386c55957df00d056ce4de665d871d05d1816b52c9373f0b61974d94`.
The private keystore and password stay outside Git, under
`~/.local/share/rhenium/signing/`, and are backed up as encrypted repository
secrets `RHENIUM_UPLOAD_KEYSTORE_BASE64` and
`RHENIUM_UPLOAD_KEYSTORE_PASSWORD`. The [access workflow](../.github/workflows/play-access.yml)
verifies that the backup matches the pinned public certificate. The service
account JSON is a separate credential, used only for Play API authentication.

Play access has been verified for `com.nitesh.rhenium`: authentication and app
access succeed, and the temporary edit is discarded. The first inspection found
no uploaded bundles, APKs or releases. GitHub Actions also restored the encrypted
keystore backup and verified its public certificate fingerprint successfully.
The ARM32 and ARM64 bundles are built, signed and statically validated. Physical
ARM32 release acceptance passed on the Android 14 Chromecast. Play-signed APKs
from the original candidate passed cryptographic and static checks but failed
sideload runtime acceptance because Google added its installer check. The final
fresh-upload APKs passed both static checks and physical ARM32 runtime acceptance
with that check disabled (details below).

The [publishing workflow](../.github/workflows/play-release.yml) is manual. Its
`stage` operation downloads the candidate AABs and validation reports from the
GitHub draft `v0.1.0`, verifies their recorded checksums and upload certificate,
and commits only an internal-testing draft. It preserves existing releases,
refuses to overwrite another draft, and requires Google to report the saved
release lifecycle as `RELEASE_LIFECYCLE_STATE_DRAFT`. Its
`download` operation retrieves Play-signed universal APKs, verifies their actual
signatures, package, ABI and alignment, and attaches them to the GitHub draft.
The public GitHub release is published after the artifact and runtime checks.
The workflow must be available on the repository's default branch before its
manual dispatch. Production Play rollout is deliberately outside this workflow.

An interrupted resumable upload is reported as a failure and its edit is
discarded; the tool does not silently retry or change version codes. A later run
can reuse an already uploaded bundle only when Google's SHA-256 matches exactly.

## Shields and the Brave services key

The existing Debug and Static ARM generated headers already contain an empty
Brave services key. The recorded native Shields checks pass network blocking,
cosmetic hiding and scriptlet execution with that configuration. Rhenium ships
bundled filter data and its own signed GitHub filter-bundle updater, which does
not authenticate to Brave's component service. The release candidate passed
network blocking, native per-site disable/re-enable,
cosmetic filtering and scriptlet execution on the physical ARM32 TV. The cosmetic
and scriptlet checks used controlled HTML and shipped rules with the native
Shields toggle; no publisher content was fetched and no custom rules were added.
The native update control downloaded the signed snapshot published 10 October
2026, activated it after restart, and reported the latest snapshot on recheck.
Network blocking still passed after that restart. This does not establish
availability of other retained Brave-hosted services or every
component-update feed.

## Validated candidate artifacts

The final archive is `~/.cache/brave-tv/artifacts/rhenium-0.1.0-play-unprotected/`.
The original `~/.cache/brave-tv/artifacts/rhenium-0.1.0-play/` remains preserved,
including the rejected protected downloads. The final archive contains
both signed AABs, validation reports, exported manifests, separate R8 mappings,
build logs and arguments, source revisions, download sizes and physical-test
evidence. Private signing credentials are stored separately. Local `.apks` files
use the upload key for testing; they are not final public downloads.

| Bundle | Version code | SHA-256 |
| --- | --- | --- |
| ARM32 | 1003 | `f7742de7cf080e2e3cd0abab0f18f49f0b469857685dad2c8c77cb9ecaf9fe4a` |
| ARM64 | 1004 | `839039a29200d30ccf94572f045918aeaa5170ed85bb97b30d513f1ba4347d0b` |

Both bundles have the production package, non-debuggable manifest and exported
TV entry. ARM64 native ELF and generated test APK ZIP alignment passed the 16 KB
checks. Estimated compressed downloads are 109 MB for ARM32 and 146 MB for ARM64;
actual Play delivery depends on the device. ARM64 hardware and 16 KB runtime
coverage remain unverified.

Both final bundles, APKs, checksums, validation and runtime reports are attached
to the public GitHub prerelease `v0.1.0`, with remote digests verified. The first
[Play staging run](https://github.com/smolcars/rhenium/actions/runs/39082629444)
uploaded and verified both bundles, then Google rejected the commit parameter
`changesNotSentForReview=true` (HTTP 400). That option applies to rejected
changes; it is not a general draft switch. The failed edit was discarded, and a
read-only APK retrieval confirmed that its versions were not retained (404).
The corrected helper commits the explicit internal `draft`, retains
`ERROR_IF_IN_REVIEW`, then reads the release lifecycle and fails unless Google
confirms `RELEASE_LIFECYCLE_STATE_DRAFT`. A regression exercises the actual stage
flow, Google's exact parameter rejection, and rejection of an in-review result.
The corrected staging and final Play-signed APK checks subsequently passed.
See [commit parameters](https://developers.google.com/android-publisher/api-ref/rest/v3/edits/commit)
and [release lifecycle states](https://developers.google.com/android-publisher/api-ref/rest/v3/applications.tracks.releases).

The [corrected staging run](https://github.com/smolcars/rhenium/actions/runs/39082959826)
saved codes 1001 and 1002 on `internal`, and independently confirmed lifecycle
`RELEASE_LIFECYCLE_STATE_DRAFT`. No production rollout was requested.
Google's certificate fingerprints use colon-separated bytes; the helper now
strictly normalizes that representation to the lowercase hex used by apksigner.
SDK 37's hybrid signature reports also require Java 25 and use `V3.0 Signer`
labels alongside the Android 17 classical/PQC signers. The verifier checks the
API-pinned classical certificate and requires identical full signing identities
across ARM32 and ARM64. Captured-response regressions cover both formats.

## Installer-check issue and resolution

The original [Play download run](https://github.com/smolcars/rhenium/actions/runs/39083512879)
retrieved both universal APKs and passed signatures, package/version, TV launcher,
native ABI and alignment checks. Local SDK 37/JDK 25 verification also passed.
However, two physical TV launches of the ARM32 APK redirected to Google Play
and exited. App-only logs report `Local install check failed due to wrong
installer`; the generated manifest contains
`com.pairip.licensecheck.LicenseActivity` and a Play-added application wrapper.
Those components are absent from the submitted browser bundle.

Both APKs are signed by Google's classical app-signing certificate
`e1f1153df5390326ff766f1fccd176ff7e5d1d5074176fcb1bcab9999c09034b`, with
matching Android 17 hybrid signing identities. The downloaded universal APKs
declare minimum SDK 29; the earlier device-specific test variants used SDK 32.
Neither signature validation nor a successful AAB smoke test establishes that
the Play-added installer check will allow GitHub installs.

The [availability check](https://github.com/smolcars/rhenium/actions/runs/39083874584)
found 160 unprotected splits per architecture and **no unprotected standalone
APKs**. The available universal APKs still contain the installer check. Their
hashes and failure evidence are preserved locally under
`play-signed-protected/`; the protected APKs and their download records were
removed from the private GitHub draft. The current verifier rejects that
licensing activity before attaching GitHub downloads. It does not modify signed
APKs or simulate installation by Google Play.

The owner has now confirmed the saved setting with a refreshed Console capture:
**0 of 1 service active — Installer checks off**. A subsequent
[download attempt](https://github.com/smolcars/rhenium/actions/runs/39084273456)
still returned the protected APKs and correctly failed verification before
attaching them to GitHub. Google's
[installer-check guide](https://support.google.com/googleplay/android-developer/answer/15621622?hl=en)
and [unprotected-distribution guidance](https://support.google.com/googleplay/android-developer/answer/10183279?hl=en-GB)
describe these controls and fresh uploads with protection disabled. New `0.1.0`
bundles used codes `1003`/`1004`, preserving the original artifacts and reusing the
build outputs. The staging configuration permits replacing only the previous
`Rhenium 0.1.0` draft with codes `1001`/`1002`; unrelated drafts and non-draft
releases remain protected.

The [fresh staging run](https://github.com/smolcars/rhenium/actions/runs/39085073303)
confirmed `1003`/`1004` as `RELEASE_LIFECYCLE_STATE_DRAFT`. The
[final download run](https://github.com/smolcars/rhenium/actions/runs/39085301033)
passed both APKs, including installer-check exclusion and Google's classical and
hybrid signing identities. Independent local SDK 37/JDK 25 checks passed too.

The final Play-signed ARM32 APK passed TV launch, Home/search, network blocking,
native per-site off/on, shipped cosmetic and scriptlet off/on, signed filter
download/manual recheck, confirmed restart activation and post-restart blocking
on the Android 14 Chromecast. The active snapshot reports publication on
10 October 2026 and the latest published version after a manual recheck.
A normal keep-data update initially failed for insufficient storage. Removing
only the old app code with `pm uninstall -k` allowed installation; the browser's
Android data-directory inode and all profile install states stayed unchanged.
The TV was restored to normal browser Home, the automation session closed,
and the owned fixture server and ADB mappings removed.

The public release's `runtime-verification.json`, `verification.json`,
`play-apks.json`, `SHA256SUMS` and `BUNDLE-SHA256SUMS` record the final artifacts
and checks. APK hashes are:

| APK | SHA-256 |
| --- | --- |
| ARM32 | `f07b4c0dde7d17b10001bf3d12de00ed076b2414bb640a51d5cbe6b4d2931a0a` |
| ARM64 | `221ca0ce925787dc089028639c27217a1405685d4c383814d3a1ae19e7af6030` |

The final project source is `400e45bc131e0a44625ba21102b5c3da0b63c575`, browser
source `6292b815d455f5bcfcae7bd4e0da6cec67b56521`. Original full-build provenance,
final build provenance, arguments, logs and mappings remain archived separately.

## Remaining Play Store rollout gates

### Console setup on 18 October 2026

All 11 Dashboard app-information/store-listing tasks are now complete. Saved
changes include the public [privacy policy](privacy-policy.md), no in-app ads,
non-government status, a 13-and-older target audience, Communication category,
and a completed Data safety form. The content-rating questionnaire declares a
web browser with unrestricted internet access; its generated ratings include
ESRB Everyone and PEGI 3. The owner explicitly approved the IARC terms before
they were accepted.

The listing reuses the existing real TV Home/menu captures in the general
phone-screenshot gallery because Console requires two phone or tablet images
even with TV images present. These are unchanged TV captures and do not establish
phone compatibility. The icon, feature graphic and TV banner are declared as
AI-assisted assets; the real screenshots remain unaltered captures. Android TV
was added and opted in for review using the existing shared release track.
Closed Alpha targets all 177 selectable countries/regions plus rest of world.
These changes are saved in Publishing overview, not submitted or approved.

The existing Alpha release still contains codes **1003 / 1004**. Its Console
preview initially reported three blocking declarations:

- `QUERY_ALL_PACKAGES`, for installed-app matching when opening links/files.
- `REQUEST_INSTALL_PACKAGES`, for user-requested downloaded APK installation.
- Foreground services: `DATA_SYNC`, `MEDIA_PLAYBACK` and `MICROPHONE`.

The package visibility and installer forms require real demonstration-video
links before Save is enabled. The APK-installation video is now available in
the following section. Foreground services also require video links for the
selected features. No placeholder video or unsupported declaration was
submitted. Supply accessible recordings showing the actual shipped behavior,
or remove unneeded permissions/services and build replacement bundles. Removing
only package visibility/installation permissions does not remove the evidence
requirement for retained foreground services.

Publishing overview's **Send app for review** remains disabled. The owner is
still gathering testers; no tester list or group has been configured. The
Dashboard reports **0 opted-in testers** and requires 12 continuously opted in
for 14 days before production access. Release preview also warns that Java
deobfuscation mappings and native debug symbols have not been uploaded. No new
binary was built or uploaded during this Console setup.

### APK-installation permission review — 18 October 2026

The owner chose to retain `REQUEST_INSTALL_PACKAGES` for user-initiated APK
installation. The permission is inherited from Chromium's download support and
is present in the actual 1003/1004 manifests as `uses-permission-sdk-23`.
[`install-packages-declaration.txt`](../release/play-listing/install-packages-declaration.txt)
contains the feature explanation; usage is **App functionality**, and the
permitted functionality is **Web browsing or search** where offered. The full
description in `release/play-listing/en-US.json` now explains this feature too.
The feature paragraph has now been saved in the English Play listing through
Console. The APK-installation declaration was also saved with **web browsing**,
**App functionality**, the explanation above, and the public video link below.
A fresh release preview confirms that the installation-permission error has
cleared: **two errors remain**, for package visibility and foreground services.
These saves are not review approval or release submission.

The [57-second captioned review video](https://github.com/smolcars/rhenium/releases/download/v0.1.0/rhenium-apk-installation-review.mp4)
shows the production Google-signed ARM32 APK, build 1003, opening on the physical
Android 14 Chromecast. It demonstrates visiting an APK download webpage,
approving the download and file warning, **Downloads → Open file**, Android's
source permission and installation confirmation, then opening the installed
test app. Android records `com.nitesh.rhenium` as the originating package and
`com.google.android.packageinstaller` as the installer. The separate, locally
served [sample APK](../tests/device/install-demo/README.md) requests no permissions
and is not included in Rhenium's APK or AAB.

The continuous take is 52.7 seconds; scaling, captions below the actual UI, and a
four-second final-frame hold produce a 56.7-second H.264 MP4 (2,784,662 bytes).
There are no middle cuts, speed changes, reconstructed screens or voice-over.
The public GitHub asset was downloaded without authentication and its SHA-256
matched `746d56da507481b364bc121a03bb81ee61976a3f6f65f919ff0b64e05615c41a`.
Google [accepts cloud links to MP4 demonstrations](https://support.google.com/googleplay/android-developer/answer/9214102?hl=en).
Approval is determined by Google's permission review; preparing this evidence
does not submit or accept the owner's declaration.

The installed browser's SHA-256 matched the published ARM32 APK. After capture,
the sample app and downloaded file were removed, Downloads was empty, normal
Home was restored, and the original installation-source mode (`default`) was
restored. The owned fixture server, ADB reverse and agent-device session were
closed. The original browser data and installed release were preserved. Raw
takes, captions, per-step snapshots and verification remain under
`~/.cache/brave-tv/evidence/install-permission-video-20261018/`.

### App-link, download and playback permission evidence — 18 October 2026

The [19-second app-link video](https://github.com/smolcars/rhenium/releases/download/v0.1.0/rhenium-app-links-review.mp4)
shows a website custom-scheme link opening a separately installed, permission-free
receiver app and returning to Rhenium. The [61-second download/playback video](https://github.com/smolcars/rhenium/releases/download/v0.1.0/rhenium-download-media-review.mp4)
shows a user-started download continuing after Android Home (0:00–0:34), then
user-started audio continuing in the background and being paused (0:34–1:01).
These are actual, continuous per-feature takes of the Google-signed 1003 release
on the physical Chromecast. Only scaling, captions below the UI, a three-second
final-frame hold per take, and the cut between download and media were added.
There are no speed changes or reconstructed screens. Both public assets were
downloaded without authentication and matched their local SHA-256 hashes.

[`remaining-permissions-declarations.md`](../release/play-listing/remaining-permissions-declarations.md)
contains the hashes, links, timestamps and paste-ready form answers. The source
listing also documents opening links/files in installed apps; the owner must
copy that feature into the saved Play description because fill-missing preserves
nonempty descriptions. The separate [fixtures](../tests/device/permission-review/README.md)
are not included in Rhenium. Android confirmed an active mediaPlayback service
while backgrounded. On Android 14, downloads use a user-initiated job; the
retained dataSync foreground-service implementation supports older Android.

Microphone capture failed background verification both on a local recording
page and in a connected two-participant Brave Talk call. Android silenced
capture and no microphone foreground service activated. Neither video is
microphone-service evidence. The owner chose to remove the unused background
microphone capability while preserving foreground website microphone access.
The [replacement-build plan](microphone-service-release-plan.md) records the
reproducible failure and the 0.1.1 / 1005–1006 implementation and verification
scope. The currently uploaded 1003/1004 bundles still contain that permission.
No declaration or first submission was accepted during evidence collection.

Private raw takes, event/service records, peer connection checks and captions
are under `~/.cache/brave-tv/evidence/remaining-permissions-20261018/`. The call
and generated-audio peer were stopped; the browser preview was closed. The
separate receiver app and owned download file were removed, original microphone
permission denial/flags were restored, and reverse 18094, the fixture server and
agent-device session were closed. Owned browser test tabs/history remain for
the replacement build's verification and will be cleaned up after that check.
Other downloaded files and browser data were preserved.

### Closed testing and production access

The owner has authorized submitting the existing 0.1.0 builds to closed testing.
Run `play-release.yml` on `master` with `operation=closed`. It downloads the
public release's validation reports, matches both uploaded bundle hashes and
version codes, and submits only the existing `alpha` (or `tv:alpha`) track. It
preserves existing tester settings and refuses to replace another release.
The commit uses `ERROR_IF_IN_REVIEW` so an existing review is never canceled.
The saved release lifecycle must confirm review, approval, or publication;
`completed` in a track response alone does not establish review submission.
The first closed submission reached validation but Google returned
`Only releases with status draft may be created on draft app.` For that exact
response, the helper saves the same verified bundles as a closed-testing draft,
then reports the required first submission in Play Console as an unfinished
action. It never reports a saved draft as a submitted release. Other validation
errors still fail and discard the edit without committing anything.
This operation never updates production or open testing, uploads new bundles,
accepts legal agreements, or changes the GitHub release.
The tester API exposes Google Groups but not individual email lists; a zero group
count does not prove that no email-list testers are configured. Closed testing
still requires actual tester opt-in and use; submission does not start the
14-day period by itself.

The [closed-testing preparation run](https://github.com/smolcars/rhenium/actions/runs/39090323930)
saved `Rhenium 0.1.0` on `alpha` with codes **1003 / 1004** and independently
confirmed `RELEASE_LIFECYCLE_STATE_DRAFT`. Its failure status deliberately reports
that submission remains unfinished; the draft commit and lifecycle check passed.
The owner confirmed that testers have not been configured. In Play Console,
open **Test and release → Testing → Closed testing → Alpha → Manage track**,
configure the tester email list or Google Group on **Testers**, then edit the
existing release and complete the review/submission flow. Do not upload the
bundles again. Use Publishing overview to send changes for review if prompted.
The first publication and tester setup are still owner actions; no approval or
tester availability has been claimed. The [tester setup guide](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
explains the email-list and Google Group options.

Run `play-release.yml` with `operation=preflight` to test the already uploaded
bundle codes as a production candidate inside a temporary Play edit. It reports
store-listing field presence, calls Google's validation endpoint, and always
discards the edit. It never commits, uploads binaries, submits for review or
publishes. A successful validation is not policy approval. This follows Google's
[transactional edits model](https://developers.google.com/android-publisher/edits).

The first API check confirmed missing English short/full descriptions and rejected
the production candidate with `HTTP 400: Precondition check failed`. Use
`operation=listing` to save only missing descriptions from
[`en-US.json`](../release/play-listing/en-US.json). Existing owner-written fields
are preserved, and release tracks are not changed. Preflight also reports icon,
feature graphic, TV banner and TV screenshot counts.
`operation=images` uploads the approved exports and real TV captures in
[`release/play-listing`](../release/play-listing/README.md) only to empty image
groups, preserving existing images and release tracks.
The text update and all five image uploads have succeeded through the API.
The subsequent check confirmed both descriptions plus one icon, one feature
graphic, one TV banner and two TV screenshots. It also found missing support
contact details. `operation=contact`, with the owner's public `support_email`
workflow input, fills only missing email/website fields and does not change
release tracks. The owner-approved `rhenium-support@proton.me` and the project
website have now been saved; a fresh edit confirms both fields are present.
Production assignment still returns Google's generic HTTP 400 precondition error.
`operation=production-draft` can prepare an unsubmitted production draft using
the already uploaded bundles. It refuses to replace another production release,
uses only `draft` status, and verifies the saved draft lifecycle after committing.
It cannot submit for review, publish, or accept legal agreements.
The [production-draft attempt](https://github.com/smolcars/rhenium/actions/runs/39087151404)
also returned `HTTP 400: Precondition check failed`; it did not save a production
draft. The [post-contact preflight](https://github.com/smolcars/rhenium/actions/runs/39087079919)
confirms the saved descriptions, all five images, and both contact fields.
The existing internal draft remains intact. The owner's Production screenshot
then confirmed the blocker: **Rhenium does not have production access yet**.
The page directs the owner to apply for access on the Dashboard. The screenshot
does not show closed-test progress or account creation date. For personal accounts
created after 13 November 2023, Google's [production-access requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
include at least 12 testers continuously opted into a closed test for 14 days,
then a production-access application. Internal testing and GitHub sideloads do
not satisfy that closed-test requirement. Inspect the Dashboard for the account's
actual progress; do not repeat production API attempts before access is granted.
Google documents
initial publication and legal consents as [Console steps](https://developers.google.com/android-publisher/edits).
API access checks share the publishing concurrency group so
simultaneous checks cannot invalidate publishing edits.

Successful compilation is not a claim of Play approval. Before a public rollout,
complete the privacy policy, Data safety and permission declarations, listing
assets, TV distribution setup, and signing-key backup. Resolve the existing phone
remote's cleartext LAN transport before presenting it as secure. Clarify Google's TV-WB wording
for this embedded-Chromium browser; it currently specifies WebView for web
content. This is an eligibility question, not a confirmed rejection.

An x64 emulator run does not verify ARM64 hardware or a 16 KB runtime. Record
those checks separately from static ELF/ZIP validation. Keep both architecture
bundles together when checking release-wide architecture compliance.

Official references: [TV quality requirements](https://developer.android.com/docs/quality-guidelines/tv-app-quality),
[64-bit support](https://developer.android.com/google/play/requirements/64-bit),
[16 KB pages](https://developer.android.com/guide/practices/page-sizes),
[app signing](https://developer.android.com/studio/publish/app-signing),
[Play API setup](https://developers.google.com/android-publisher/getting_started).
