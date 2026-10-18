# Microphone foreground-service release gate

The Google-signed Rhenium 0.1.0 / 1003 release on the physical Android 14
Chromecast captures microphone input while the browser is open. It does not
start a microphone foreground service in the verified flows, and Android
silences capture after the browser leaves the foreground. Do not describe this
as working background microphone capture in the Play declaration.

The other permission demonstrations passed: an external custom-scheme link
opens an installed receiver app, downloads continue after leaving the browser,
and audio playback owns an active `MEDIA_PLAYBACK` foreground service.

## Repeatable check

Start a real, unmuted website call in Rhenium, grant its microphone permissions,
and keep the browser in the foreground. Then run:

```sh
python3 tests/device/permission-review/check-background-microphone.py \
  SERIAL /absolute/external/evidence/path
```

The check first requires unsilenced foreground capture. It presses Android Home,
waits 12 seconds, and checks both the Android foreground-service type and audio
capture state before restoring Rhenium. A passing result requires the browser
to be in the background, an active service with the `0x80` microphone type, and
`silenced:false` capture. Permission presence or increasing MediaRecorder chunk
counters alone cannot pass it: Android can keep emitting silent chunks.

Both a local `getUserMedia`/MediaRecorder page and a real two-participant Brave
Talk call reproduced silencing. The second call participant sent a generated
440 Hz Web Audio track through Jitsi; no host microphone was accessed. WebRTC
reported connected P2P transport and increasing inbound/outbound audio packet
counters. This distinguishes the failure from a missing second participant or
failed audio connection. Private runtime evidence is under
`~/.cache/brave-tv/evidence/remaining-permissions-20261018/`.

## Implementation choices

The owner selected option 1: remove the unused background microphone service
capability. The replacement release will be 0.1.1, codes 1005 (ARM32) and 1006
(ARM64). Existing 0.1.0 public artifacts remain unchanged.

Both choices require replacement bundles with new version codes, validation,
and replacement of the applicable Play draft releases. Existing published APKs
and their version codes must remain unchanged.

1. **Remove the unused background microphone service capability.** Keep
   `RECORD_AUDIO` and normal foreground website microphone permission prompts.
   Remove `FOREGROUND_SERVICE_MICROPHONE` and microphone service-type entries
   from the final merged manifests; remove the corresponding runtime microphone
   type addition in `BraveForegroundServiceUtils`, so no retained path requests
   an undeclared type. Verify foreground calls still work and document that
   background microphone capture is unsupported. This is the smaller release
   change for a TV browser.
2. **Implement supported background capture.** First isolate why the declared
   Brave Talk playback/microphone service does not activate. The generic
   Chromium capture foreground service is gated by
   `AndroidEnableBackgroundMediaCapturing`, which is disabled by default.
   `BraveMediaSessionTabHelper` selects the specialized microphone playback
   service only on approved HTTPS Brave Talk hosts, and
   `BraveForegroundServiceUtils` adds the microphone type to that service.
   Trace capture/session notification ownership and start the appropriate
   microphone foreground service while the activity is visible and microphone
   permission is granted. Keep a visible, stoppable notification, stop ownership
   when the last capture ends, and handle permission denial/revocation. Do not
   simply enable the global capture flag: Chromium's type selection can also
   add camera/media-projection types, which need a separate manifest and policy
   audit. Require the physical checker to pass, then record a fresh review clip.

No production browser source, feature flag, build, Play track, or declaration
was changed while collecting this evidence. Implementation and replacement
build verification follow this evidence collection. The current microphone
declaration remains unresolved until the retained Play bundles are replaced.
