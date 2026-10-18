# Remaining permission declarations

These videos show the Google-signed 0.1.0 / 1003 release on a physical Android 14
Chromecast. They demonstrate actual browser behavior using clearly labeled,
separate test fixtures. Preparing these answers does not submit a declaration
or establish Google approval.

## QUERY_ALL_PACKAGES

Video: https://github.com/smolcars/rhenium/releases/download/v0.1.0/rhenium-app-links-review.mp4

Choose **Web browsing or search** and **App functionality** where offered.

Feature description:

> Rhenium is a web browser for Android TV. When users follow website links to other apps or open downloaded files, it checks installed applications for a compatible handler and lets Android open the chosen destination. The video shows a user following a custom-scheme webpage link into a separately installed, permission-free test app, then returning to the browser.

Why broader visibility is needed:

> Users can browse arbitrary websites and install new destination apps. Rhenium cannot predefine every app package or custom URL scheme that those websites and downloads may use. Package visibility supports on-device matching of user-requested links and files to installed handlers. A fixed list of known app packages would exclude otherwise compatible apps installed by the user.

Prominently describe the feature in the saved Play listing:

> Open compatible website links and downloaded files in other installed apps.

The video is 19.23 seconds. Its SHA-256 is
`b2b3ca36f1071253730d469d4b32f8e0186a44324ad5deefb37ee1e638863fd9`.

## DATA_SYNC

Video: https://github.com/smolcars/rhenium/releases/download/v0.1.0/rhenium-download-media-review.mp4

The download demonstration is **0:00–0:34**. Choose **Network transfer: Upload
or download**, describing downloads only.

Feature description:

> Users choose a file on a website and confirm its download. Rhenium keeps that user-started transfer running if they leave the browser and shows its status in Downloads. Chromium uses a dataSync foreground service on Android versions before Android 14; on Android 14 and later, it uses a user-initiated job instead. This Android 14 recording demonstrates that same user-visible download feature using the newer job path.

Impact of delay/interruption:

> Deferring the transfer delays a download the user explicitly requested. Interrupting it can leave an incomplete file and require resuming or restarting the transfer. Keeping the task active lets the user leave the browser while the file completes and return to check its status.

## MEDIA_PLAYBACK

Video: https://github.com/smolcars/rhenium/releases/download/v0.1.0/rhenium-download-media-review.mp4

The playback demonstration is **0:34–1:01**. Choose **Media playback**.

Feature description:

> Users explicitly start audio playback on a website. Rhenium uses a mediaPlayback foreground service and Android media controls to keep that playback active when the browser goes into the background. The video starts generated test audio, returns to Google TV Home, then resumes Rhenium and pauses playback. Android's service records independently confirmed the active mediaPlayback service during the background interval.

Impact of delay/interruption:

> Deferring or interrupting the service would delay or stop audio the user has chosen to play, particularly when switching to Google TV Home or another app. Continued playback is the expected result of leaving user-started audio playing until the user pauses or stops it.

The combined download/playback video is 61.43 seconds. Its SHA-256 is
`22e892bd68a82a90932f3a10caecd8379f4e90144a954f438f43595be1be6608`.
Recordings are silent and captioned; no microphone audio is included.

## MICROPHONE — replacement build required

Do not use either video above as evidence for a microphone foreground service.
The current release did not start that service in the verified capture/call
flows, and Android silenced capture after backgrounding. The owner chose to
remove that unused background service capability while retaining foreground
website microphone access. See the [implementation and verification plan](../../docs/microphone-service-release-plan.md).

The replacement build must omit `FOREGROUND_SERVICE_MICROPHONE` and matching
service types/runtime requests before this declaration can be removed. Do not
answer that the currently uploaded 1003/1004 bundles lack the permission.

Google documents the [foreground-service declaration evidence](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en)
and [package-visibility eligibility](https://support.google.com/googleplay/android-developer/answer/10158779?hl=en).
