#!/usr/bin/env python3
"""Check an already user-started, unmuted Rhenium call across Android Home."""
import argparse
import json
import re
import subprocess
import time
from pathlib import Path

PACKAGE = 'com.nitesh.rhenium'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('serial')
    parser.add_argument('evidence', type=Path)
    parser.add_argument('--adb', default='adb')
    args = parser.parse_args()
    args.evidence.mkdir(parents=True, exist_ok=True)

    def shell(*command):
        return subprocess.check_output(
            [args.adb, '-s', args.serial, 'shell', *command], text=True, timeout=20)

    def capture():
        activities = shell('dumpsys', 'activity', 'activities')
        services = shell('dumpsys', 'activity', 'services', PACKAGE)
        audio = shell('dumpsys', 'audio')
        return {
            'time': time.time(),
            'top': next((line.strip() for line in activities.splitlines()
                         if 'topResumedActivity=' in line), ''),
            'recording': [line.strip() for line in audio.splitlines()
                          if f'pack:{PACKAGE} -- format' in line],
            'foreground': [line.strip() for line in services.splitlines()
                           if 'isForeground=true' in line],
        }

    before = capture()
    assert PACKAGE in before['top'], 'Bring Rhenium to the foreground first.'
    assert any('silenced:false' in line for line in before['recording']), (
        'First start an unmuted website call/capture and grant its real permissions.')
    try:
        shell('input', 'dpad', 'keyevent', 'KEYCODE_HOME')
        time.sleep(12)
        background = capture()
    finally:
        shell('am', 'start', '-n', f'{PACKAGE}/com.google.android.apps.chrome.Main')

    has_microphone_fgs = any(
        int(match.group(1), 16) & 0x80
        for line in background['foreground']
        if (match := re.search(r'types=([0-9a-fA-F]+)', line)))
    unsilenced = any('silenced:false' in line for line in background['recording'])
    is_background = PACKAGE not in background['top']
    result = {'before': before, 'background': background,
              'microphoneForegroundService': has_microphone_fgs,
              'unsilencedCapture': unsilenced, 'browserBackground': is_background}
    (args.evidence / 'microphone-background-check.json').write_text(
        json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in (
        'microphoneForegroundService', 'unsilencedCapture', 'browserBackground')}))
    assert is_background and has_microphone_fgs and unsilenced, (
        'Background microphone requires an active MICROPHONE foreground service '
        'and unsilenced capture after 12 seconds.')


if __name__ == '__main__':
    main()
