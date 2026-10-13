#!/usr/bin/env python3
"""Crée le manifeste electron-updater pour le Setup NSIS Windows.

Il doit correspondre au même exécutable et à la même version que la Release.
"""
import base64
import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path

VERSION = os.environ["YT_RELEASE_VERSION"]
PACK = Path("pack")
SETUP = PACK / "YT-Music-Setup-Windows-x64.exe"
MANIFEST = PACK / "latest.yml"

if not SETUP.is_file():
    raise SystemExit(f"Installateur introuvable : {SETUP}")

digest = hashlib.sha512()
with SETUP.open("rb") as exe:
    for part in iter(lambda: exe.read(1024 * 1024), b""):
        digest.update(part)

checksum = base64.b64encode(digest.digest()).decode("ascii")
size = SETUP.stat().st_size
date = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

MANIFEST.write_text(
    "\n".join(
        [
            f"version: {VERSION}",
            "files:",
            f"  - url: {SETUP.name}",
            f"    sha512: {checksum}",
            f"    size: {size}",
            f"path: {SETUP.name}",
            f"sha512: {checksum}",
            f"releaseDate: '{date}'",
            "",
        ]
    ),
    encoding="utf-8",
)
print(f"Manifeste généré : {MANIFEST} pour {VERSION}, taille {size}")
