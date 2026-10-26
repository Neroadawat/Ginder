"""Inspect release ZIP contents, 64-bit ELF alignment and bundled JS inputs.

This static check is not a substitute for running on a 16 KB device. Verify APK
ZIP alignment separately with Android build-tools zipalign -c -P 16 4 app.apk.
"""

import argparse
import hashlib
import json
import struct
import zipfile
from pathlib import Path


def check_elf(data: bytes, name: str) -> None:
    assert data[:4] == b"\x7fELF", f"Not ELF: {name}"
    assert data[4] == 2 and data[5] == 1, f"Expected ELF64 little-endian: {name}"
    phoff = struct.unpack_from("<Q", data, 32)[0]
    entsize, count = struct.unpack_from("<HH", data, 54)
    loads = 0
    for index in range(count):
        offset = phoff + index * entsize
        kind, _, file_offset, virtual, _, _, _, align = struct.unpack_from("<IIQQQQQQ", data, offset)
        if kind == 1:
            loads += 1
            assert align >= 16384 and align & (align - 1) == 0, f"ELF alignment: {name}"
            assert (virtual - file_offset) % 16384 == 0, f"ELF offset: {name}"
    assert loads, f"No LOAD segments: {name}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact", type=Path)
    parser.add_argument("--source-map", type=Path)
    args = parser.parse_args()
    inspected = 0
    with zipfile.ZipFile(args.artifact) as archive:
        names = archive.namelist()
        bundle_name = (
            "base/assets/index.android.bundle" if args.artifact.suffix == ".aab"
            else "assets/index.android.bundle"
        )
        assert bundle_name in names, "Missing offline JavaScript bundle"
        # react-native-config exposes native BuildConfig constants at runtime;
        # its actual URLs live in DEX/resources, not necessarily Hermes bytecode.
        expected_urls = {
            b"https://ginder-app.duckdns.org/api/v1": False,
            b"wss://ginder-app.duckdns.org/ws": False,
        }
        for name in names:
            assert not name.endswith((".jks", ".keystore", ".pem", "keystore.properties",
                                      "firebase-credentials.json")), f"Private file: {name}"
            if "/arm64-v8a/" in name or "/x86_64/" in name:
                if name.endswith(".so"):
                    check_elf(archive.read(name), name)
                    inspected += 1
            if name.endswith((".json", ".bundle", ".xml", ".dex", ".properties", ".arsc", ".pb")):
                content = archive.read(name)
                assert b"-----BEGIN PRIVATE KEY-----" not in content, f"Private key: {name}"
                for expected in expected_urls:
                    expected_urls[expected] |= expected in content
        assert inspected, "No 64-bit native libraries found"
        assert all(expected_urls.values()), "Expected production URL missing from artifact"
    source_count = None
    if args.source_map:
        sources = json.loads(args.source_map.read_text(encoding="utf-8"))["sources"]
        source_count = len(sources)
        for package in ("body-parser", "braces", "metro", "@react-native-community/cli"):
            assert not any(f"node_modules/{package}/" in source.replace("\\", "/")
                           for source in sources), f"Build-only package bundled: {package}"
    print(json.dumps({
        "artifact": args.artifact.name,
        "sha256": hashlib.file_digest(args.artifact.open("rb"), "sha256").hexdigest(),
        "size_bytes": args.artifact.stat().st_size,
        "aligned_64bit_libraries": inspected,
        "bundled_sources": source_count,
        "offline_bundle_and_production_urls": True,
        "private_file_and_key_marker_checks": "pass",
        "runtime_16kb_test": "not_performed",
    }, indent=2))


if __name__ == "__main__":
    main()
