#!/usr/bin/env python3
"""Génère toutes les icônes locales YT Music à partir du symbole 2024.

Usage :
    python -m pip install pillow
    python tools/generate_ytmusic_icons.py

Aucune ressource distante n'est utilisée. La version SVG se trouve dans
assets/icon.svg. Les tailles sont produites en PNG sans dépendance à un dépôt
historique ou à un service externe.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
RED = "#FF0033"
WHITE = "#FFFFFF"
SIZE = 2048
FACTOR = SIZE / 512
SIZES = (16, 24, 32, 48, 64, 128, 256, 512, 1024)


def scaled_rect(cx: float, cy: float, radius: float) -> tuple[int, int, int, int]:
    return tuple(
        round(value * FACTOR)
        for value in (cx - radius, cy - radius, cx + radius, cy + radius)
    )


def make_icon() -> Image.Image:
    icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)
    draw.ellipse(scaled_rect(256, 256, 256), fill=RED)

    # Cercle annulaire officiel, intégré dans le fond rouge.
    draw.ellipse(scaled_rect(256, 256, 156), fill=WHITE)
    draw.ellipse(scaled_rect(256, 256, 134), fill=RED)

    # Triangle de lecture blanc.
    draw.polygon(
        [
            (round(209 * FACTOR), round(186 * FACTOR)),
            (round(326 * FACTOR), round(256 * FACTOR)),
            (round(209 * FACTOR), round(326 * FACTOR)),
        ],
        fill=WHITE,
    )
    return icon


def main() -> None:
    base = make_icon()
    output = ASSETS / "generated" / "icons" / "png"
    output.mkdir(parents=True, exist_ok=True)
    versions: dict[int, Image.Image] = {}
    for size in SIZES:
        img = base.resize((size, size), Image.Resampling.LANCZOS)
        versions[size] = img
        dest = output / f"{size}x{size}.png"
        img.save(dest, format="PNG", optimize=True)
        print(f"PNG: {dest.relative_to(ROOT)}")

    versions[1024].save(ASSETS / "icon.png", optimize=True)
    versions[256].save(ASSETS / "tray.png", optimize=True)

    ico = ASSETS / "generated" / "icons" / "win" / "icon.ico"
    ico.parent.mkdir(parents=True, exist_ok=True)
    versions[256].save(
        ico,
        format="ICO",
        sizes=[(size, size) for size in SIZES if size <= 256],
    )
    print(f"Windows ICO: {ico.relative_to(ROOT)}")

    with Image.open(ico) as check:
        assert check.format == "ICO", "Format ICO invalide"
        assert (256, 256) in check.info["sizes"], "Résolution 256 absente"
    assert versions[1024].getpixel((512, 512))[0] == 255
    print("Icônes vérifiées : PNG et ICO valides.")


if __name__ == "__main__":
    main()
