# Permission review fixtures

These pages exercise the production browser. They do not change Rhenium, inject
behavior into its pages, or grant permissions through a test interface.

- `/handoff`: a custom-scheme link opens the separate installed Link Demo app.
- `/download`: an explicitly selected, paced 12 MB synthetic text download.
- `/media`: user-started generated audio with a playback clock.
- `/microphone`: a diagnostic page that requests real microphone permission and
  counts MediaRecorder chunks. It discards audio chunks; no audio is saved or
  uploaded. **Increasing counters do not prove unsilenced background capture.**
  This page exposed Android silencing in release 1003 and is not microphone FGS
  review evidence. In 0.1.1 it verifies foreground website capture only; the
  microphone foreground-service permission/type have been removed.

Create an external evidence directory, generate a test tone, and start the
loopback-only server:

```sh
ffmpeg -f lavfi -i 'sine=frequency=330:duration=180' -af volume=0.06 \
  -c:a libmp3lame -b:a 48k /external/evidence/review-tone.mp3
python3 tests/device/permission-review/server.py /external/evidence
adb -s SERIAL reverse tcp:18094 tcp:18094
```

Browse to `http://127.0.0.1:18094/FEATURE`. The server records feature events,
download progress, and capture counters in `server-events.jsonl`. It never
receives microphone audio. Loopback is a secure context for the microphone API;
this does not bypass Android or website permission prompts.

With the project JDK and pinned Android SDK available, build the link receiver:

```sh
bash tests/device/permission-review/build-link-demo.sh /external/link-demo
adb -s SERIAL install /external/link-demo/RheniumLinkDemo.apk
```

The receiver requests no permissions, performs no network access, displays the
received `rhenium-review://open` link, and offers a return button. Its test key
and APK stay outside Git; it is not part of Rhenium's APK or AAB. The browser's
normal app-link policy is preserved, including its YouTube-in-browser setting.

The [microphone background checker](check-background-microphone.py) requires
an already user-started, unmuted call/capture with unsilenced foreground input.
It checks Android 14 service/audio output after 12 seconds on Android Home and
restores the browser. The actual 1003 release failed with no microphone service
and silenced capture. See the [release plan](../../../docs/microphone-service-release-plan.md).

After recording, end calls/audio, remove only the synthetic review download and
receiver app, restore any changed permission state, close owned test tabs, remove
only reverse 18094, and stop the server and device automation session. Preserve
other app data, downloaded files, and device settings.
