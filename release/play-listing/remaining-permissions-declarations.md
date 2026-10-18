# Remaining permission declarations

These videos show the Google-signed 0.1.1 / 1005 release on a physical Android 14
Chromecast. They demonstrate actual browser behavior using clearly labeled,
separate test fixtures. Preparing these answers does not submit a declaration
or establish Google approval.

## QUERY_ALL_PACKAGES

Video: https://github.com/smolcars/rhenium/releases/download/v0.1.1/rhenium-app-links-review.mp4

Choose **Web browsing or search** and **App functionality** where offered.

Feature description:

> Rhenium is a web browser for Android TV. When users follow website links to other apps or open downloaded files, it checks installed applications for a compatible handler and lets Android open the chosen destination. The video shows a user following a custom-scheme webpage link into a separately installed, permission-free test app, then returning to the browser.

Why broader visibility is needed:

> Users can browse arbitrary websites and install new destination apps. Rhenium cannot predefine every app package or custom URL scheme that those websites and downloads may use. Package visibility supports on-device matching of user-requested links and files to installed handlers. A fixed list of known app packages would exclude otherwise compatible apps installed by the user.

Prominently describe the feature in the saved Play listing:

> Open compatible website links and downloaded files in other installed apps.

The video is 17.10 seconds. Its SHA-256 is
`8a7fc47f515fea4861055cfac592e5f1225587d12ac6e156747321557f5a5b10`.

## DATA_SYNC

Video: https://github.com/smolcars/rhenium/releases/download/v0.1.1/rhenium-download-media-review.mp4

The download demonstration is **0:00–0:33.4**. Choose **Network transfer: Upload
or download**, describing downloads only.

Feature description:

> Users choose a file on a website and confirm its download. Rhenium keeps that user-started transfer running if they leave the browser and shows its status in Downloads. Chromium uses a dataSync foreground service on Android versions before Android 14; on Android 14 and later, it uses a user-initiated job instead. This Android 14 recording demonstrates that same user-visible download feature using the newer job path.

Impact of delay/interruption:

> Deferring the transfer delays a download the user explicitly requested. Interrupting it can leave an incomplete file and require resuming or restarting the transfer. Keeping the task active lets the user leave the browser while the file completes and return to check its status.

## MEDIA_PLAYBACK

Video: https://github.com/smolcars/rhenium/releases/download/v0.1.1/rhenium-download-media-review.mp4

The playback demonstration is **0:33.4–0:58.3**. Choose **Media playback**.

Feature description:

> Users explicitly start audio playback on a website. Rhenium uses a mediaPlayback foreground service and Android media controls to keep that playback active when the browser goes into the background. The video starts generated test audio, returns to Google TV Home, then resumes Rhenium and pauses playback. Android's service records independently confirmed the active mediaPlayback service during the background interval.

Impact of delay/interruption:

> Deferring or interrupting the service would delay or stop audio the user has chosen to play, particularly when switching to Google TV Home or another app. Continued playback is the expected result of leaving user-started audio playing until the user pauses or stops it.

The combined download/playback video is 58.27 seconds. Its SHA-256 is
`f5da52b84aa2cbb903c1c45cb2b5437379e0248a09a3cbb24c5f21f7cd065476`.
Recordings are silent and captioned; no microphone audio is included.

## MICROPHONE — removed from 0.1.1 foreground-service declarations

The replacement ARM32 **1005** and ARM64 **1006** bundles and Google-signed APKs
omit `FOREGROUND_SERVICE_MICROPHONE` and every microphone foreground-service type.
Both the internal and closed-testing drafts now contain those replacement codes.
Refresh the foreground-service declaration for that draft and leave **Microphone**
unselected. No background microphone review video is needed for these bundles.

`RECORD_AUDIO` remains for website microphone access while Rhenium is open.
Physical ARM32 testing approved the real website and Android permission prompts,
confirmed unsilenced foreground capture in Android, then stopped capture and
restored the original denied permission state. Background microphone capture is
unsupported. Do not describe the app as never using a microphone in other forms.
The earlier 1003/1004 artifacts still contain the permission and remain unchanged.
See the [implementation and verification record](../../docs/microphone-service-release-plan.md).

Google documents the [foreground-service declaration evidence](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en)
and [package-visibility eligibility](https://support.google.com/googleplay/android-developer/answer/10158779?hl=en).
