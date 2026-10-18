"""Sign and inspect archived Play bundles using an upload key outside Git."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import struct
import subprocess
import tempfile
from typing import Any
from xml.etree import ElementTree as ET
import zipfile

from build_play_release import read_config
from checkout import PROJECT


ALIAS = "rhenium-upload"
ANDROID = "{http://schemas.android.com/apk/res/android}"
SIGNATURE = re.compile(r"META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC)|SIG-[^/]+)$", re.I)


def fingerprint(java: Path, signing: Path) -> str:
    certificate = subprocess.check_output([
        str(java / "keytool"), "-exportcert", "-alias", ALIAS,
        "-keystore", str(signing / "upload.p12"),
        "-storepass:file", str(signing / "upload.password"),
    ])
    return hashlib.sha256(certificate).hexdigest()


def init_key(java: Path, signing: Path) -> str:
    if signing.is_relative_to(PROJECT):
        raise ValueError("Keep the private upload key outside the repository")
    signing.mkdir(parents=True, exist_ok=True, mode=0o700)
    if signing.stat().st_mode & 0o077:
        raise ValueError("The signing directory must be private (mode 0700)")
    password = signing / "upload.password"
    keystore = signing / "upload.p12"
    if keystore.exists() and not password.exists():
        raise ValueError("Existing keystore has no password file; do not replace it")
    if not password.exists():
        descriptor = os.open(password, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            stream.write(secrets.token_urlsafe(48) + "\n")
    if password.stat().st_mode & 0o077:
        raise ValueError("The password file must be private (mode 0600)")
    if not keystore.exists():
        subprocess.run([
            str(java / "keytool"), "-genkeypair", "-noprompt", "-alias", ALIAS,
            "-keyalg", "RSA", "-keysize", "4096", "-sigalg", "SHA256withRSA",
            "-validity", "10000", "-dname", "CN=Rhenium Upload",
            "-storetype", "PKCS12", "-keystore", str(keystore),
            "-storepass:file", str(password), "-keypass:file", str(password),
        ], check=True)
        keystore.chmod(0o600)
    if keystore.stat().st_mode & 0o077:
        raise ValueError("The keystore must be private (mode 0600)")
    public_hash = fingerprint(java, signing)
    (signing / "upload-cert.sha256").write_text(public_hash + "\n")
    subprocess.run([
        str(java / "keytool"), "-exportcert", "-rfc", "-alias", ALIAS,
        "-keystore", str(keystore), "-storepass:file", str(password),
        "-file", str(signing / "upload-cert.pem"),
    ], check=True, stdout=subprocess.DEVNULL)
    return public_hash


def strip_signatures(source: Path, destination: Path) -> None:
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(destination, "x", allowZip64=True) as output:
        if len(original.namelist()) != len(set(original.namelist())):
            raise ValueError("Duplicate bundle entries")
        for info in original.infolist():
            if SIGNATURE.fullmatch(info.filename):
                continue
            with original.open(info) as reader, output.open(info, "w", force_zip64=info.file_size >= zipfile.ZIP64_LIMIT) as writer:
                shutil.copyfileobj(reader, writer, length=1024 * 1024)


def check_elf(header: bytes, abi: str) -> list[int]:
    if header[:4] != b"\x7fELF" or len(header) < 64 or header[5] != 1:
        raise ValueError("Invalid little-endian ELF header")
    elf64 = abi == "arm64-v8a"
    if header[4] != (2 if elf64 else 1):
        raise ValueError("ELF class does not match the packaged ABI")
    fields = struct.unpack_from("<16sHHIQQQIHHHHHH" if elf64 else "<16sHHIIIIIHHHHHH", header)
    if fields[1] != 3 or fields[2] != (183 if elf64 else 40):
        raise ValueError("ELF library architecture does not match its ABI directory")
    offset, entry_size, count = fields[5], fields[9], fields[10]
    expected_size = 56 if elf64 else 32
    if entry_size != expected_size or not count or offset + entry_size * count > len(header):
        raise ValueError("Invalid ELF program header table")
    alignments = []
    for index in range(count):
        segment = struct.unpack_from("<IIQQQQQQ" if elf64 else "<IIIIIIII", header, offset + index * entry_size)
        if segment[0] != 1:
            continue
        alignment = segment[7]
        file_offset, address = (segment[2], segment[3]) if elf64 else (segment[1], segment[2])
        minimum = 16384 if elf64 else 4096
        if alignment < minimum or alignment & (alignment - 1) or (address - file_offset) % minimum:
            raise ValueError(f"ELF LOAD segment is not {minimum}-byte compatible")
        alignments.append(alignment)
    if not alignments:
        raise ValueError("ELF has no LOAD segments")
    return alignments


def check_manifest(xml: str, chrome_xml: str, config: dict[str, Any], arch: str) -> dict[str, Any]:
    root = ET.fromstring(xml)
    chrome = ET.fromstring(chrome_xml)
    if any(manifest.get("package") != config["packageName"] for manifest in (root, chrome)):
        raise ValueError("Unexpected package name")
    if root.get(ANDROID + "versionCode") != str(config["versionCodes"][arch]) or root.get(ANDROID + "versionName") != config["versionName"]:
        raise ValueError("Unexpected release version")
    application = root.find("application")
    if application is None or application.get(ANDROID + "debuggable", "false") != "false" or application.get(ANDROID + "testOnly", "false") != "false":
        raise ValueError("Release application is missing or marked debug/test-only")
    launchers = [item for item in chrome.findall("application/activity-alias")
                 if item.get(ANDROID + "name") == "org.chromium.chrome.browser.tv.TvLauncher"]
    if len(launchers) != 1 or launchers[0].get(ANDROID + "exported") != "true" or not any(
        intent.find(f"action[@{ANDROID}name='android.intent.action.MAIN']") is not None
        and intent.find(f"category[@{ANDROID}name='android.intent.category.LEANBACK_LAUNCHER']") is not None
        for intent in launchers[0].findall("intent-filter")
    ):
        raise ValueError("Exported TV launcher is missing from the chrome module")
    touch = root.find(f"uses-feature[@{ANDROID}name='android.hardware.touchscreen']")
    if touch is None or touch.get(ANDROID + "required") != "false":
        raise ValueError("Release must not require a touchscreen")
    permissions = {item.attrib[ANDROID + "name"] for manifest in (root, chrome)
                   for item in manifest if item.tag in ("uses-permission", "uses-permission-sdk-23")}
    if "android.permission.FOREGROUND_SERVICE_MICROPHONE" in permissions:
        raise ValueError("Release must not request background microphone service access")
    if "android.permission.RECORD_AUDIO" not in permissions:
        raise ValueError("Foreground website microphone permission must be preserved")
    for manifest in (root, chrome):
        for service in manifest.findall("application/service"):
            types = service.get(ANDROID + "foregroundServiceType", "")
            if "microphone" in types.split("|") or (types.startswith("0x") and int(types, 16) & 0x80):
                raise ValueError("Release service still declares a microphone foreground type")
    return {
        "packageName": config["packageName"], "versionName": config["versionName"],
        "versionCode": config["versionCodes"][arch], "debuggable": False,
        "launcherModule": "chrome",
        "permissions": sorted(permissions),
    }


def check_install_set(command: list[str], source: Path, bundle: Path,
                      archive: Path, arch: str, abi: str, signing: Path) -> dict[str, Any]:
    config = (source / "build/config/android/config.gni").read_text()
    version = re.search(r'public_android_sdk_build_tools_version = "([\d.]+)"', config)
    if not version:
        raise ValueError("Cannot locate the pinned Android build tools")
    build_tools = source / "third_party/android_sdk/public/build-tools" / version[1]
    spec = archive / f"device-{arch}.json"
    spec.write_text(json.dumps({"supportedAbis": [abi], "supportedLocales": ["en-US"],
                                "screenDensity": 320, "sdkVersion": 36}) + "\n")
    apks = archive / f"rhenium-{arch}.apks"
    subprocess.run([
        *command, "build-apks", f"--bundle={bundle}", f"--output={apks}",
        f"--device-spec={spec}", f"--ks={signing / 'upload.p12'}",
        f"--ks-pass=file:{signing / 'upload.password'}",
        f"--key-pass=file:{signing / 'upload.password'}", f"--ks-key-alias={ALIAS}",
    ], check=True)
    checked = []
    with zipfile.ZipFile(apks) as install_set, tempfile.TemporaryDirectory(prefix="rhenium-apks-") as temporary:
        for index, name in enumerate(install_set.namelist()):
            if not name.endswith(".apk"):
                continue
            apk = Path(temporary) / f"split-{index}.apk"
            with install_set.open(name) as reader, apk.open("xb") as writer:
                shutil.copyfileobj(reader, writer, length=1024 * 1024)
            alignment = ["-P", "16"] if arch == "arm64" else []
            subprocess.run([str(build_tools / "zipalign"), "-c", *alignment, "4", str(apk)], check=True)
            subprocess.run([str(build_tools / "apksigner"), "verify", str(apk)], check=True)
            checked.append(name)
    if not checked:
        raise ValueError("The device install set contains no APKs")
    size = subprocess.check_output([*command, "get-size", "total", f"--apks={apks}", f"--device-spec={spec}"], text=True)
    (archive / f"download-size-{arch}.csv").write_text(size)
    return {"installSet": apks.name, "verifiedApks": checked,
            "zipAlignment": 16384 if arch == "arm64" else 4096}


def package(workspace: Path, archive: Path, signing: Path) -> None:
    source = workspace / "src"
    java = source / "third_party/jdk/current/bin"
    bundletool = source / "third_party/android_build_tools/bundletool/cipd/bundletool.jar"
    config = read_config(PROJECT / "release/android.json")
    public_hash = fingerprint(java, signing)
    archive.mkdir(parents=True, exist_ok=True)
    (archive / "release.json").write_text(json.dumps(config, indent=2) + "\n")
    shutil.copyfile(signing / "upload-cert.pem", archive / "upload-cert.pem")
    for arch, abi in (("arm", "armeabi-v7a"), ("arm64", "arm64-v8a")):
        output_dir = source / "out" / f"android_Play_{arch}"
        original = output_dir / "apks" / f"BraveMono{arch}.aab"
        output = archive / f"rhenium-{config['versionName']}-{arch}.aab"
        if not original.is_file() or output.exists():
            raise ValueError(f"Missing source bundle or existing destination: {arch}")
        with tempfile.TemporaryDirectory(prefix="rhenium-sign-") as temporary:
            unsigned = Path(temporary) / "unsigned.aab"
            strip_signatures(original, unsigned)
            subprocess.run([
                str(java / "jarsigner"), "-keystore", str(signing / "upload.p12"),
                "-storepass:file", str(signing / "upload.password"),
                "-keypass:file", str(signing / "upload.password"),
                "-sigalg", "SHA256withRSA", "-digestalg", "SHA-256",
                "-signedjar", str(output), str(unsigned), ALIAS,
            ], check=True)
        subprocess.run([str(java / "jarsigner"), "-verify", str(output)], check=True)
        actual_certificate = subprocess.check_output([str(java / "keytool"), "-printcert", "-jarfile", str(output)])
        actual_fingerprints = re.findall(rb"SHA256:\s*([A-Fa-f0-9:]+)", actual_certificate)
        if [value.decode().replace(":", "").lower() for value in actual_fingerprints] != [public_hash]:
            raise ValueError("The signed bundle certificate does not match the upload key")
        command = [str(java / "java"), "-jar", str(bundletool)]
        subprocess.run([*command, "validate", f"--bundle={output}"], check=True)
        xml = subprocess.check_output([*command, "dump", "manifest", f"--bundle={output}", "--module=base"], text=True)
        (archive / f"manifest-{arch}.xml").write_text(xml)
        chrome_xml = subprocess.check_output([*command, "dump", "manifest", f"--bundle={output}", "--module=chrome"], text=True)
        (archive / f"manifest-{arch}-chrome.xml").write_text(chrome_xml)
        result = check_manifest(xml, chrome_xml, config, arch)
        with zipfile.ZipFile(output) as bundle:
            native = {}
            for name in bundle.namelist():
                match = re.fullmatch(r"[^/]+/lib/([^/]+)/([^/]+\.so)", name)
                if match:
                    if match[1] != abi:
                        raise ValueError(f"Unexpected native ABI: {name}")
                    with bundle.open(name) as library:
                        native[name] = check_elf(library.read(1024 * 1024), abi)
            if not any(name.endswith("/libchrome.so") for name in native):
                raise ValueError("Browser native library is missing")
        with output.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        result.update({"nativeLoadAlignments": native, "uploadCertificateSha256": public_hash,
                       "sha256": digest})
        result.update(check_install_set(command, source, output, archive, arch, abi, signing))
        (archive / f"validation-{arch}.json").write_text(json.dumps(result, indent=2) + "\n")
        for filename in ("args.gn", "args_generated.gni"):
            shutil.copyfile(output_dir / filename, archive / f"{arch}-{filename}")
        mapping = output_dir / "apks/ChromePublic.aab.mapping"
        if not mapping.is_file():
            raise ValueError("The optimized Java mapping file is missing")
        shutil.copyfile(mapping, archive / f"rhenium-{arch}.mapping")
        print(f"Signed and validated {output.name}: {result['sha256']}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("signing", type=Path)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    workspace, signing = args.workspace.expanduser().resolve(), args.signing.expanduser().resolve()
    java = workspace / "src/third_party/jdk/current/bin"
    print(f"Upload certificate SHA-256: {init_key(java, signing)}")
    if args.archive:
        archive = args.archive.expanduser().resolve()
        if archive.is_relative_to(PROJECT) or archive == signing or archive.is_relative_to(signing):
            raise ValueError("Archive artifacts separately from Git and private signing files")
        package(workspace, archive, signing)


if __name__ == "__main__":
    main()
