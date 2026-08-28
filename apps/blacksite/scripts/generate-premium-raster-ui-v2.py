"""Build the BLACKSITE premium raster UI v2 package.

The source HUD controls are faithful crops from the approved 1672x941 target.
This script turns each crop into explicit normal/hover/pressed/active/disabled
rasters and builds the remaining text-free chrome as deterministic RGBA PNGs.
Runtime CSS therefore never has to synthesize a material or interaction state.
"""

from __future__ import annotations

from pathlib import Path
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


APP_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = APP_ROOT / "art/generated/ui-v1/legacy-hud-crops"
OUTPUT_ROOT = APP_ROOT / "static/assets/blacksite/ui/premium-hud-v2"
SCALE = 2
STATES = ("normal", "hover", "pressed", "active", "disabled")
CONTROL_NAMES = ("menu", "buy", "auto", "minus", "plus", "spin", "turbo", "info", "settings")


def lerp(a: int, b: int, amount: float) -> int:
    return round(a + (b - a) * amount)


def gradient(size: tuple[int, int], top: tuple[int, int, int, int], bottom: tuple[int, int, int, int]) -> Image.Image:
    width, height = size
    result = Image.new("RGBA", size)
    pixels = result.load()
    denominator = max(1, height - 1)
    for y in range(height):
        amount = y / denominator
        color = tuple(lerp(top[index], bottom[index], amount) for index in range(4))
        for x in range(width):
            pixels[x, y] = color
    return result


def brushed_metal(size: tuple[int, int], seed: int = 77) -> Image.Image:
    width, height = size
    base = gradient(size, (28, 35, 36, 255), (3, 6, 7, 255))
    rng = random.Random(seed + width * 31 + height * 17)
    texture = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(texture)
    for _ in range(max(50, height // 2)):
        y = rng.randrange(0, height)
        alpha = rng.randrange(3, 14)
        tone = rng.choice(((255, 255, 255, alpha), (0, 0, 0, alpha + 2), (205, 160, 77, alpha // 2)))
        draw.line((0, y, width, y), fill=tone, width=rng.choice((1, 1, 2)))
    for _ in range(max(24, width // 12)):
        x = rng.randrange(0, width)
        alpha = rng.randrange(2, 7)
        draw.line((x, 0, x, height), fill=(255, 255, 255, alpha), width=1)
    return Image.alpha_composite(base, texture.filter(ImageFilter.GaussianBlur(0.45)))


def chamfer_polygon(box: tuple[int, int, int, int], chamfer: int) -> list[tuple[int, int]]:
    left, top, right, bottom = box
    return [
        (left + chamfer, top),
        (right - chamfer, top),
        (right, top + chamfer),
        (right, bottom - chamfer),
        (right - chamfer, bottom),
        (left + chamfer, bottom),
        (left, bottom - chamfer),
        (left, top + chamfer),
    ]


def framed_panel(
    size: tuple[int, int],
    *,
    accent: tuple[int, int, int, int] = (170, 121, 50, 255),
    accent_side: str | None = None,
    state: str = "normal",
    seed: int = 77,
) -> Image.Image:
    width, height = size
    unit = max(2, min(width, height) // 38)
    chamfer = max(8, min(width, height) // 12)
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    mask = Image.new("L", size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.polygon(chamfer_polygon((1, 1, width - 2, height - 2), chamfer), fill=255)
    surface = brushed_metal(size, seed=seed)
    if state == "hover":
        surface = ImageEnhance.Brightness(surface).enhance(1.16)
        surface = ImageEnhance.Color(surface).enhance(1.12)
        accent = (230, 175, 74, 255)
    elif state == "selected" or state == "active":
        surface = Image.alpha_composite(surface, Image.new("RGBA", size, (96, 23, 17, 68)))
        accent = (236, 68, 48, 255)
    elif state == "pressed":
        surface = ImageEnhance.Brightness(surface).enhance(0.72)
        accent = (196, 72, 43, 255)
    elif state == "disabled":
        surface = ImageOps.grayscale(surface).convert("RGBA")
        surface = ImageEnhance.Brightness(surface).enhance(0.48)
        surface.putalpha(220)
        accent = (74, 80, 79, 255)
    image.paste(surface, (0, 0), mask)

    draw = ImageDraw.Draw(image)
    outer = chamfer_polygon((1, 1, width - 2, height - 2), chamfer)
    middle = chamfer_polygon((unit + 1, unit + 1, width - unit - 2, height - unit - 2), max(3, chamfer - unit))
    inner = chamfer_polygon((unit * 3, unit * 3, width - unit * 3 - 1, height - unit * 3 - 1), max(2, chamfer - unit * 3))
    draw.line(outer + [outer[0]], fill=(57, 64, 65, 255), width=max(2, unit))
    draw.line(middle + [middle[0]], fill=(7, 9, 10, 255), width=max(2, unit))
    draw.line(inner + [inner[0]], fill=accent, width=max(1, unit // 2))
    highlight = (224, 190, 115, 150) if state not in {"disabled", "pressed"} else (94, 97, 94, 95)
    draw.line((chamfer + unit, unit, width - chamfer - unit, unit), fill=highlight, width=max(1, unit // 2))
    draw.line((unit, chamfer + unit, unit, height - chamfer - unit), fill=(255, 255, 255, 30), width=1)
    if accent_side == "left":
        draw.rectangle((unit, chamfer, unit * 2, height - chamfer), fill=accent)
    elif accent_side == "right":
        draw.rectangle((width - unit * 2, chamfer, width - unit, height - chamfer), fill=accent)
    elif accent_side == "both":
        draw.rectangle((unit, chamfer, unit * 2, height - chamfer), fill=accent)
        draw.rectangle((width - unit * 2, chamfer, width - unit, height - chamfer), fill=accent)

    # Corner bolts are rasterized into the panel instead of synthesized in CSS.
    bolt_r = max(1, unit)
    for x, y in ((chamfer, chamfer), (width - chamfer, chamfer), (chamfer, height - chamfer), (width - chamfer, height - chamfer)):
        draw.ellipse((x - bolt_r, y - bolt_r, x + bolt_r, y + bolt_r), fill=(16, 18, 18, 255), outline=(116, 103, 72, 220), width=1)
        draw.line((x - bolt_r // 2, y, x + bolt_r // 2, y), fill=(5, 5, 5, 255), width=1)
    return image


def radial_glow(size: tuple[int, int], color: tuple[int, int, int], alpha: int, radius: float = 0.62) -> Image.Image:
    width, height = size
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    pixels = glow.load()
    cx, cy = width / 2, height / 2
    max_distance = math.hypot(width * radius, height * radius)
    for y in range(height):
        for x in range(width):
            distance = math.hypot(x - cx, y - cy)
            strength = max(0.0, 1.0 - distance / max_distance) ** 2
            pixels[x, y] = (*color, round(alpha * strength))
    return glow


def control_state(source: Image.Image, state: str) -> Image.Image:
    source = source.convert("RGBA").resize((source.width * SCALE, source.height * SCALE), Image.Resampling.LANCZOS)
    source = source.filter(ImageFilter.UnsharpMask(radius=1.4, percent=125, threshold=3))
    if state == "normal":
        return ImageEnhance.Contrast(source).enhance(1.045)
    if state == "hover":
        image = ImageEnhance.Brightness(source).enhance(1.09)
        image = ImageEnhance.Color(image).enhance(1.14)
        return Image.alpha_composite(image, radial_glow(image.size, (255, 183, 58), 50))
    if state == "active":
        image = ImageEnhance.Contrast(source).enhance(1.13)
        image = Image.alpha_composite(image, radial_glow(image.size, (239, 52, 39), 76))
        draw = ImageDraw.Draw(image)
        inset = max(2, min(image.size) // 34)
        draw.rounded_rectangle((inset, inset, image.width - inset - 1, image.height - inset - 1), radius=max(8, min(image.size) // 5), outline=(255, 124, 73, 190), width=max(2, inset // 2))
        return image
    if state == "pressed":
        base = ImageEnhance.Brightness(source).enhance(0.62)
        inset_x = max(3, source.width // 42)
        inset_y = max(3, source.height // 42)
        reduced = source.resize((source.width - inset_x * 2, source.height - inset_y * 2), Image.Resampling.LANCZOS)
        reduced = ImageEnhance.Brightness(reduced).enhance(0.88)
        base.alpha_composite(reduced, (inset_x, inset_y + max(2, inset_y // 2)))
        shadow = Image.new("RGBA", source.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((1, 1, source.width - 2, source.height - 2), radius=max(8, min(source.size) // 5), outline=(0, 0, 0, 175), width=max(4, min(source.size) // 18))
        return Image.alpha_composite(base, shadow)
    grayscale = ImageOps.grayscale(source).convert("RGBA")
    grayscale = ImageEnhance.Contrast(grayscale).enhance(0.7)
    grayscale = ImageEnhance.Brightness(grayscale).enhance(0.47)
    grayscale = Image.alpha_composite(grayscale, Image.new("RGBA", source.size, (2, 6, 7, 72)))
    return grayscale


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        Path(r"C:/Windows/Fonts/bahnschrift.ttf"),
        Path(r"C:/Windows/Fonts/arialbd.ttf"),
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def draw_centered_text(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, text_font: ImageFont.ImageFont, fill: tuple[int, int, int, int], stroke_fill: tuple[int, int, int, int] = (0, 0, 0, 210), stroke_width: int = 2) -> None:
    left, top, right, bottom = box
    bounds = draw.textbbox((0, 0), text, font=text_font, stroke_width=stroke_width)
    x = left + (right - left - (bounds[2] - bounds[0])) / 2
    y = top + (bottom - top - (bounds[3] - bounds[1])) / 2 - bounds[1]
    draw.text((x, y), text, font=text_font, fill=fill, stroke_fill=stroke_fill, stroke_width=stroke_width)


def close_button(state: str) -> Image.Image:
    image = framed_panel((128, 128), state=state, accent=(192, 133, 55, 255), seed=113)
    draw = ImageDraw.Draw(image)
    color = (255, 221, 154, 255) if state not in {"disabled", "pressed"} else (126, 127, 120, 255)
    width = 9
    inset = 40 if state != "pressed" else 42
    offset = 2 if state == "pressed" else 0
    draw.line((inset, inset + offset, 128 - inset, 128 - inset + offset), fill=(0, 0, 0, 200), width=width + 5)
    draw.line((128 - inset, inset + offset, inset, 128 - inset + offset), fill=(0, 0, 0, 200), width=width + 5)
    draw.line((inset, inset + offset, 128 - inset, 128 - inset + offset), fill=color, width=width)
    draw.line((128 - inset, inset + offset, inset, 128 - inset + offset), fill=color, width=width)
    return image


def resume_button(state: str) -> Image.Image:
    image = framed_panel((640, 184), state=state, accent=(190, 135, 56, 255), accent_side="left", seed=149)
    draw = ImageDraw.Draw(image)
    color = (255, 219, 142, 255) if state not in {"disabled", "pressed"} else (131, 132, 124, 255)
    icon_center = (92, 92 + (4 if state == "pressed" else 0))
    radius = 38
    draw.arc((icon_center[0] - radius, icon_center[1] - radius, icon_center[0] + radius, icon_center[1] + radius), 32, 325, fill=(0, 0, 0, 210), width=18)
    draw.arc((icon_center[0] - radius, icon_center[1] - radius, icon_center[0] + radius, icon_center[1] + radius), 32, 325, fill=color, width=10)
    draw.polygon(((129, 60), (144, 88), (112, 86)), fill=color)
    draw_centered_text(draw, (150, 0, 620, 184), "RESUME", font(44), color, stroke_width=3)
    return image


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


def build_controls() -> None:
    for name in CONTROL_NAMES:
        source = Image.open(SOURCE_ROOT / f"{name}.png")
        for state in STATES:
            save(control_state(source, state), OUTPUT_ROOT / "controls" / name / f"{state}.png")
    for state in STATES:
        save(close_button(state), OUTPUT_ROOT / "controls" / "close" / f"{state}.png")
        save(resume_button(state), OUTPUT_ROOT / "controls" / "resume" / f"{state}.png")


def build_panels() -> None:
    panels: tuple[tuple[str, tuple[int, int], str | None], ...] = (
        ("meter-bet", (480, 240), None),
        ("meter-total", (420, 240), None),
        ("meter-win", (420, 240), None),
        ("meter-balance", (720, 220), None),
        ("how-to", (620, 180), None),
        ("ticker", (1600, 144), "both"),
    )
    for index, (name, size, accent_side) in enumerate(panels):
        panel = framed_panel(size, accent_side=accent_side, seed=211 + index * 17)
        if name == "ticker":
            draw = ImageDraw.Draw(panel)
            badge = chamfer_polygon((430, 31, 502, 113), 12)
            draw.polygon(badge, fill=(31, 5, 5, 255), outline=(180, 44, 34, 255))
            draw.line((440, 39, 492, 39), fill=(250, 100, 54, 150), width=2)
            draw_centered_text(
                draw,
                (430, 31, 502, 113),
                "///",
                font(25),
                (241, 70, 49, 255),
                stroke_width=1,
            )
        save(panel, OUTPUT_ROOT / "panels" / f"{name}.png")

    for state in ("normal", "hover", "selected", "disabled"):
        save(
            framed_panel((960, 360), state=state, accent_side="left", seed=307),
            OUTPUT_ROOT / "panels" / "mode-card" / f"{state}.png",
        )

    for state in ("normal", "active", "disabled"):
        save(
            framed_panel((128, 128), state=state, seed=401),
            OUTPUT_ROOT / "panels" / "marker" / f"{state}.png",
        )


def main() -> None:
    build_controls()
    build_panels()
    print(f"wrote raster UI assets to {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
