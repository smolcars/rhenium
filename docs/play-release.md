# Google Play release preparation

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
   First candidate: version `0.1.0`, codes `1001`/`1002`. The replacement uses
   codes `1003`/`1004` in
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
  "$HOME/.cache/brave-tv/evidence/play-release-20261017-r10"
python3 tools/package_play_release.py "$HOME/.cache/brave-tv/workspace" \
  "$HOME/.local/share/rhenium/signing" \
  --archive "$HOME/.cache/brave-tv/artifacts/rhenium-0.1.0-play"
```

Both release builds and signing completed successfully in
`rhenium-play-release-r10.service`. It used eight local/total Siso steps, ten
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
ARM64 and completed in 2 hours 55 minutes.
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
passed cryptographic and static checks, but failed sideload runtime acceptance
because Google added its installer check (details below).

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

The local archive is `~/.cache/brave-tv/artifacts/rhenium-0.1.0-play/`. It contains
both signed AABs, validation reports, exported manifests, separate R8 mappings,
build logs and arguments, source revisions, download sizes and physical-test
evidence. Private signing credentials are stored separately. Local `.apks` files
use the upload key for testing; they are not final public downloads.

| Bundle | Version code | SHA-256 |
| --- | --- | --- |
| ARM32 | 1001 | `04200f27b5edb9380ff499ee13d2eafeba25814b82954084b974676a208f943c` |
| ARM64 | 1002 | `5ead0e626efda8b24e7a673e03e1daba2af3eebc80219f12e3aa799fcc2eb07d` |

Both bundles have the production package, non-debuggable manifest and exported
TV entry. ARM64 native ELF and generated test APK ZIP alignment passed the 16 KB
checks. Estimated compressed downloads are 109 MB for ARM32 and 146 MB for ARM64;
actual Play delivery depends on the device. ARM64 hardware and 16 KB runtime
coverage remain unverified.

Both bundles and validation reports are attached to the existing GitHub draft
`v0.1.0`, with remote checksums verified. The first
[Play staging run](https://github.com/smolcars/rhenium/actions/runs/39082629444)
uploaded and verified both bundles, then Google rejected the commit parameter
`changesNotSentForReview=true` (HTTP 400). That option applies to rejected
changes; it is not a general draft switch. The failed edit was discarded, and a
read-only APK retrieval confirmed that its versions were not retained (404).
The corrected helper commits the explicit internal `draft`, retains
`ERROR_IF_IN_REVIEW`, then reads the release lifecycle and fails unless Google
confirms `RELEASE_LIFECYCLE_STATE_DRAFT`. A regression exercises the actual stage
flow, Google's exact parameter rejection, and rejection of an in-review result.
The rerun and final Play-signed APK checks must pass before public release.
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

## Current publication blocker

The [Play download run](https://github.com/smolcars/rhenium/actions/runs/39083512879)
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
describe these controls and fresh uploads with protection disabled. Prepare new
`0.1.0` bundles using version codes `1003`/`1004`, reusing the existing build
outputs. Preserve the original bundles and evidence separately. The staging
configuration explicitly permits replacing only the previous `Rhenium 0.1.0`
draft with codes `1001`/`1002`; unrelated drafts and non-draft releases remain
protected. Once an unprotected single-file APK is available, validate both APKs,
test the ARM32 APK on the TV, then publish the authorized GitHub prerelease and
replace the README's pending download status. No full clean build is required.

## Public-release gates

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
