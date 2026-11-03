#!/usr/bin/env python3
"""Generate the animated README banner and a static PNG fallback.

Optional dev tool only. Requires Pillow:
    python3 -m pip install Pillow
    python3 scripts/generate_banner.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
WIDTH, HEIGHT = 960, 320
FRAMES = 24
DURATION_MS = 90

VIOLET = (139, 92, 246)
CYAN = (34, 211, 238)
PINK = (236, 72, 153)
BG_TOP = (10, 10, 24)
BG_BOTTOM = (20, 12, 40)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for directory in (Path("/usr/share/fonts/truetype/dejavu"), Path("/usr/share/fonts")):
        candidate = directory / name
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def background() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)
    for y in range(HEIGHT):
        draw.line([(0, y), (WIDTH, y)], fill=lerp(BG_TOP, BG_BOTTOM, y / HEIGHT))
    return image


def gradient_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, size: int, shift: float) -> None:
    face = font(size)
    x, y = xy
    for index, character in enumerate(text):
        wave = (math.sin(index * 0.45 + shift) + 1) / 2
        color = lerp(VIOLET, CYAN, wave)
        draw.text((x, y), character, font=face, fill=color)
        x += round(draw.textlength(character, font=face))


def frame(index: int, mascot: Image.Image) -> Image.Image:
    phase = index / FRAMES * math.tau
    image = background()
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    pulse = (math.sin(phase) + 1) / 2
    glow_draw.ellipse((590, -80, 1040, 370), fill=(*VIOLET, round(45 + 35 * pulse)))
    glow_draw.ellipse((680, 10, 980, 310), fill=(*CYAN, round(25 + 25 * pulse)))
    glow = glow.filter(ImageFilter.GaussianBlur(45))
    image = Image.alpha_composite(image.convert("RGBA"), glow)

    draw = ImageDraw.Draw(image)
    gradient_text(draw, (48, 62), "NULLX", 76, phase)
    gradient_text(draw, (50, 146), "OPENCODE ZEN", 34, phase + 1.2)
    draw.text((52, 200), "local-first companion  •  mobile-ready  •  private budgets", font=font(17, False), fill=(203, 213, 225))

    bar_x, bar_y, bar_w = 52, 242, 360
    draw.rounded_rectangle((bar_x, bar_y, bar_x + bar_w, bar_y + 8), radius=4, fill=(30, 27, 55))
    sweep = (math.sin(phase) + 1) / 2
    highlight = round(bar_x + sweep * (bar_w - 90))
    draw.rounded_rectangle((highlight, bar_y, highlight + 90, bar_y + 8), radius=4, fill=lerp(VIOLET, CYAN, sweep))

    dots = "".join("●" if (index // 3) % 4 > i else "○" for i in range(4))
    draw.text((52, 266), f"preparing OpenCode {dots}", font=font(15, False), fill=lerp(VIOLET, CYAN, pulse))

    bob = round(math.sin(phase) * 5)
    image.alpha_composite(mascot, (660, 28 + bob))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((660, 28 + bob, 939, 307 + bob), radius=28, outline=(*lerp(VIOLET, CYAN, pulse), 160), width=2)
    return image.convert("RGB")


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    source = Image.open(ASSETS / "nullx-scythe.png").convert("RGBA")
    source.thumbnail((280, 280), Image.Resampling.LANCZOS)
    mascot = Image.new("RGBA", (280, 280), (0, 0, 0, 0))
    mascot.alpha_composite(source, ((280 - source.width) // 2, (280 - source.height) // 2))
    mask = Image.new("L", (280, 280), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 279, 279), radius=28, fill=255)
    mascot.putalpha(mask)

    frames = [frame(i, mascot) for i in range(FRAMES)]
    frames[0].save(ASSETS / "nullx-banner.png", optimize=True)
    frames[0].save(
        ASSETS / "nullx-banner.gif",
        save_all=True,
        append_images=frames[1:],
        duration=DURATION_MS,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"Wrote {ASSETS / 'nullx-banner.gif'} and {ASSETS / 'nullx-banner.png'}")


if __name__ == "__main__":
    main()
