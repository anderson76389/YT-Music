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

from PIL import Image, ImageDraw, ImageFont

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

    # Aperçu GitHub 1280 x 640, indépendant de tout service d'images.
    preview = Image.new("RGB", (1280, 640), "#111323")
    canvas = ImageDraw.Draw(preview)
    for y in range(640):
        blend = y / 639
        canvas.line(
            [(0, y), (1279, y)],
            fill=(round(15 + 22 * blend), round(18 - 5 * blend), round(36 + 18 * blend)),
        )
    canvas.rounded_rectangle(
        (42, 42, 1238, 598),
        radius=42,
        outline="#514568",
        width=3,
    )
    logo = versions[256].resize((246, 246), Image.Resampling.LANCZOS)
    preview.paste(logo, (95, 194), logo)
    font_path = next(
        (path for path in (
            "C:/Windows/Fonts/segoeuib.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ) if Path(path).is_file()),
        None,
    )
    title_font = (
        ImageFont.truetype(font_path, 100)
        if font_path else ImageFont.load_default(size=100)
    )
    subtitle_font = (
        ImageFont.truetype(font_path, 33)
        if font_path else ImageFont.load_default(size=33)
    )
    tiny_font = (
        ImageFont.truetype(font_path, 23)
        if font_path else ImageFont.load_default(size=23)
    )
    canvas.text((400, 193), "YT MUSIC", fill="white", font=title_font)
    canvas.rounded_rectangle((405, 331, 792, 338), radius=4, fill=RED)
    canvas.text((400, 372), "Votre musique, vos reglages.", fill="#E4DCEE", font=subtitle_font)
    canvas.text(
        (402, 467),
        "CLIENT NON OFFICIEL  |  WINDOWS  |  EXTENSIONS",
        fill="#A6A5BD",
        font=tiny_font,
    )
    preview.save(ASSETS / "github-social-preview.png", optimize=True)
    print("Apercu GitHub: assets/github-social-preview.png")

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
