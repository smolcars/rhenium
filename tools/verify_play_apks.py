"""Verify Play-generated APKs before attaching them to the public release."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from typing import Any
import zipfile

from build_play_release import read_config
from checkout import PROJECT
from package_play_release import check_elf


def check_apk_manifest(badging: str, tree: str, config: dict[str, Any], arch: str) -> None:
    package = re.search(r"^package: name='([^']*)' versionCode='([^']*)' versionName='([^']*)'", badging, re.M)
    if not package or package.groups() != (config["packageName"], str(config["versionCodes"][arch]), config["versionName"]):
        raise ValueError("Downloaded APK manifest identity does not match the release")
    if "application-debuggable" in badging:
        raise ValueError("APK is debuggable")
    lines = tree.splitlines()
    for index, line in enumerate(lines):
        if not line.lstrip().startswith("E: activity-alias "):
            continue
        indent = len(line) - len(line.lstrip())
        end = index + 1
        while end < len(lines) and len(lines[end]) - len(lines[end].lstrip()) > indent:
            end += 1
        block = "\n".join(lines[index:end])
        if all(f'"{value}"' in block for value in (
            "org.chromium.chrome.browser.tv.TvLauncher", "android.intent.action.MAIN",
            "android.intent.category.LEANBACK_LAUNCHER",
        )) and re.search(r":exported\(0x01010010\)=true", block):
            return
    raise ValueError("APK has no exported TV launcher")


def verify(sdk: Path, directory: Path) -> list[dict[str, Any]]:
    config = read_config(PROJECT / "release/android.json")
    candidates = [path for path in (sdk / "build-tools").iterdir()
                  if re.fullmatch(r"\d+\.\d+\.\d+", path.name)
                  and all((path / tool).is_file() for tool in ("aapt2", "apksigner", "zipalign"))]
    if not candidates:
        raise ValueError("Android SDK build tools are missing")
    tools = max(candidates, key=lambda path: tuple(map(int, path.name.split("."))))
    metadata = json.loads((directory / "play-apks.json").read_text())
    if not isinstance(metadata, list) or len(metadata) != 2 or {item.get("arch") for item in metadata} != {"arm", "arm64"}:
        raise ValueError("Expected metadata for exactly one ARM32 and one ARM64 APK")
    reports = []
    for item in metadata:
        arch = item["arch"]
        filename = f"rhenium-{config['versionName']}-{arch}.apk"
        if item["file"] != filename or item["packageName"] != config["packageName"] or item["versionCode"] != config["versionCodes"][arch]:
            raise ValueError("Unexpected APK release metadata")
        certificate = item["certificateSha256"]
        if not isinstance(certificate, str) or not re.fullmatch(r"[a-f0-9]{64}", certificate):
            raise ValueError("Invalid Play app-signing certificate fingerprint")
        apk = directory / filename
        with apk.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != item["sha256"]:
            raise ValueError("Downloaded APK checksum does not match its record")
        signatures = subprocess.check_output([str(tools / "apksigner"), "verify", "--print-certs", str(apk)], text=True)
        actual = re.findall(r"^Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]+)$", signatures, re.M)
        if [value.lower() for value in actual] != [certificate]:
            raise ValueError(f"APK signer does not match Google Play certificate {certificate}. Public certificate report:\n{signatures}")
        alignment = ["-P", "16"] if arch == "arm64" else []
        subprocess.run([str(tools / "zipalign"), "-c", *alignment, "4", str(apk)], check=True)
        badging = subprocess.check_output([str(tools / "aapt2"), "dump", "badging", str(apk)], text=True)
        tree = subprocess.check_output([str(tools / "aapt2"), "dump", "xmltree", str(apk), "--file", "AndroidManifest.xml"], text=True)
        check_apk_manifest(badging, tree, config, arch)
        abi = "arm64-v8a" if arch == "arm64" else "armeabi-v7a"
        native = {}
        with zipfile.ZipFile(apk) as archive:
            for name in archive.namelist():
                match = re.fullmatch(r"lib/([^/]+)/([^/]+\.so)", name)
                if match:
                    if match[1] != abi:
                        raise ValueError("APK includes an unexpected ABI")
                    with archive.open(name) as library:
                        native[name] = check_elf(library.read(1024 * 1024), abi)
        if not any(name.endswith("/libchrome.so") for name in native):
            raise ValueError("APK has no browser native library")
        reports.append({**item, "signatureVerified": True, "manifestVerified": True,
                        "nativeLoadAlignments": native, "zipAlignment": 16384 if arch == "arm64" else 4096})
    if len({item["certificateSha256"] for item in reports}) != 1:
        raise ValueError("The two APKs have different app-signing identities")
    (directory / "verification.json").write_text(json.dumps(reports, indent=2) + "\n")
    return reports


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sdk", type=Path)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    for report in verify(args.sdk, args.directory):
        print(f"Verified {report['file']}: {report['sha256']}")


if __name__ == "__main__":
    main()
