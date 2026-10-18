#!/usr/bin/env python3
"""Loopback-only, synthetic permission-review pages and paced download."""
import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PAGE = Path(__file__).with_name('index.html').read_bytes()
SIZE = 12 * 1024 * 1024
CHUNK = b'Rhenium synthetic review download.\n' * 2048
LOCK = threading.Lock()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence', type=Path)
    parser.add_argument('--port', type=int, default=18094)
    args = parser.parse_args()
    tone = (args.evidence / 'review-tone.mp3').read_bytes()
    assert tone and SIZE % 65536 == 0

    def log(value):
        with LOCK, (args.evidence / 'server-events.jsonl').open('a') as output:
            output.write(json.dumps({'serverTime': time.time(), **value}) + '\n')

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get('Content-Length', '0'))
            if self.path != '/event' or not 0 < length <= 4096:
                self.send_error(400)
                return
            try:
                value = json.loads(self.rfile.read(length))
                if not isinstance(value, dict):
                    raise ValueError()
            except (ValueError, UnicodeError):
                self.send_error(400)
                return
            log({'event': 'page', 'value': value})
            self.send_response(204)
            self.end_headers()

        def do_GET(self):
            if self.path in ('/', '/handoff', '/download', '/media', '/microphone'):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(PAGE)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(PAGE)
                return
            if self.path == '/review-tone.mp3':
                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Content-Length', str(len(tone)))
                self.end_headers()
                self.wfile.write(tone)
                return
            if self.path != '/RheniumReviewSample.txt':
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Disposition', 'attachment; filename="RheniumReviewSample.txt"')
            self.send_header('Content-Length', str(SIZE))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            log({'event': 'download-start'})
            sent = 0
            try:
                while sent < SIZE:
                    data = CHUNK[:min(65536, SIZE - sent)]
                    self.wfile.write(data)
                    self.wfile.flush()
                    sent += len(data)
                    log({'event': 'download-progress', 'bytes': sent})
                    time.sleep(0.125)
                log({'event': 'download-complete', 'bytes': sent})
            except (BrokenPipeError, ConnectionResetError):
                log({'event': 'download-disconnected', 'bytes': sent})

        def log_message(self, *_):
            pass

    print(f'Review fixture: http://127.0.0.1:{args.port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
