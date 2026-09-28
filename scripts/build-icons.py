#!/usr/bin/env python3
"""Genererar PNG-ikoner från assets/icons/icon.svg.

Kör om du bytt ikon:

    python3 scripts/build-icons.py

SVG:n rasteriseras med headless Chrome (Google Chrome eller Playwrights
chrome-headless-shell) till 1024×1024 och skalas sedan ned med Pillow (LANCZOS).

Producerar i assets/icons/:
    icon-512.png          manifest (Android, splash)
    icon-192.png          manifest (Android)
    icon-maskable.png     Android adaptiv ikon (full-bleed, 512×512)
    apple-touch-icon.png  iOS hemskärm (180×180)
    favicon.png           reserv för äldre webbläsare (64×64)
"""

import glob
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow saknas: pip3 install pillow")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "icons" / "icon.svg"
OUT = SRC.parent
RENDER_SIZE = 1024

VARIANTS = [
    ("icon-512.png", 512),
    ("icon-maskable.png", 512),
    ("icon-192.png", 192),
    ("apple-touch-icon.png", 180),
    ("favicon.png", 64),
]


def find_chrome() -> str:
    candidates = [
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        *glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell")),
        *glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell")),
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    sys.exit("Hittade ingen Chrome/Chromium att rendera SVG:n med.")


def render_svg(chrome: str, svg: Path, size: int) -> Image.Image:
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / "icon.html"
        png = Path(tmp) / "icon.png"
        html.write_text(
            "<!doctype html><html><head><meta charset='utf-8'>"
            "<style>html,body{margin:0;background:transparent}img{display:block}</style></head>"
            f"<body><img src='{svg.as_uri()}' width='{size}' height='{size}'></body></html>",
            encoding="utf-8",
        )
        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--default-background-color=00000000",
            f"--window-size={size},{size}",
            f"--screenshot={png}",
            html.as_uri(),
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
        img = Image.open(png).convert("RGBA")
        img.load()
        return img


def main() -> None:
    if not SRC.exists():
        sys.exit(f"FEL: {SRC} saknas")

    chrome = find_chrome()
    print(f"Renderar {SRC.name} med {chrome}")
    master = render_svg(chrome, SRC, RENDER_SIZE)

    for name, size in VARIANTS:
        out = OUT / name
        master.resize((size, size), Image.LANCZOS).save(out, "PNG", optimize=True)
        print(f"  ✓ {name:<22} {size}×{size}  ({out.stat().st_size / 1024:.1f} KB)")

    print("\nKlart. Commit + push så uppdateras ikonen i installerade appar vid nästa start.")


if __name__ == "__main__":
    main()
