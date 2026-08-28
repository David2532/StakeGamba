from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SYMBOL_ROOT = ROOT / "apps" / "blacksite" / "static" / "assets" / "blacksite" / "symbols"
PAYLINE_ROOT = ROOT / "apps" / "blacksite" / "static" / "assets" / "blacksite" / "ui" / "paylines-v1"
REEL_STRIP_ROOT = ROOT / "apps" / "blacksite" / "static" / "assets" / "blacksite" / "ui" / "reel-strips-v1"
ART_SOURCE_ROOT = ROOT / "apps" / "blacksite" / "art" / "generated" / "symbols-v4"

SYMBOL_SOURCES = {
    "operative": ART_SOURCE_ROOT / "source-masters-v3" / "sym_01_operative-master-v3.png",
    "encrypted_drive": ART_SOURCE_ROOT / "source-masters-v3" / "sym_02_encrypted_drive-master-v3.png",
    "tactical_radio": ART_SOURCE_ROOT / "source-masters-v3" / "sym_03_tactical_radio-master-v3.png",
    "classified_folder": ART_SOURCE_ROOT / "source-masters-v3" / "sym_04_classified_folder-master-v3.png",
    "night_vision_goggles": ART_SOURCE_ROOT / "source-masters-v3" / "sym_05_night_vision_goggles-master-v3.png",
    "supply_crate": ART_SOURCE_ROOT / "source-masters-v3" / "sym_06_supply_crate-master-v3.png",
    "ghost_wild": ART_SOURCE_ROOT / "source-masters-v3" / "sym_07_ghost_wild-master-v3.png",
    "breach": ART_SOURCE_ROOT / "source-masters-v3" / "sym_08_breach_scatter-master-v3.png",
    "a": ART_SOURCE_ROOT / "objects" / "sym_09_a-object-v4.png",
    "k": ART_SOURCE_ROOT / "objects" / "sym_10_k-object-v4.png",
    "q": ART_SOURCE_ROOT / "objects" / "sym_11_q-object-v4.png",
    "j": ART_SOURCE_ROOT / "objects" / "sym_12_j-object-v4.png",
    "ten": ART_SOURCE_ROOT / "objects" / "sym_13_ten-object-v4.png",
}

SYMBOL_DIRECTORIES = {
    "operative": "sym_01_operative",
    "encrypted_drive": "sym_02_encrypted_drive",
    "tactical_radio": "sym_03_tactical_radio",
    "classified_folder": "sym_04_classified_folder",
    "night_vision_goggles": "sym_05_night_vision_goggles",
    "supply_crate": "sym_06_supply_crate",
    "ghost_wild": "sym_07_ghost_wild",
    "breach": "sym_08_breach_scatter",
    "a": "sym_09_a",
    "k": "sym_10_k",
    "q": "sym_11_q",
    "j": "sym_12_j",
    "ten": "sym_13_ten",
}

PAYLINES = (
    (1, 1, 1, 1, 1),
    (0, 0, 0, 0, 0),
    (2, 2, 2, 2, 2),
    (0, 1, 2, 1, 0),
    (2, 1, 0, 1, 2),
    (0, 0, 1, 2, 2),
    (2, 2, 1, 0, 0),
    (1, 0, 0, 0, 1),
    (1, 2, 2, 2, 1),
    (0, 1, 0, 1, 0),
)

REEL_COUNT = 5
VISIBLE_ROWS = 3
REEL_STOP_SIZE = (320, 240)
SYMBOL_DELIVERY_SIZE = (512, 512)


def normalize_symbol(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"symbol has no visible pixels: {source}")
    cropped = image.crop(bbox)
    width, height = cropped.size
    scale = min(840 / width, 840 / height)
    resized = cropped.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    x = (1024 - resized.width) // 2
    y = 486 - resized.height // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def tinted_alpha(alpha: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    layer = Image.new("RGBA", alpha.size, color)
    layer.putalpha(ImageChops.multiply(alpha, Image.new("L", alpha.size, color[3])))
    return layer


def build_states(source: Path, output_dir: Path, special: str | None = None) -> None:
    base_object = normalize_symbol(source)
    alpha = base_object.getchannel("A")

    base = Image.new("RGBA", base_object.size, (0, 0, 0, 0))
    shadow_alpha = alpha.filter(ImageFilter.GaussianBlur(22))
    shadow_alpha = ImageChops.offset(shadow_alpha, 0, 18)
    base.alpha_composite(tinted_alpha(shadow_alpha, (0, 0, 0, 105)))
    base.alpha_composite(base_object)

    win = Image.new("RGBA", base_object.size, (0, 0, 0, 0))
    outer = alpha.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.GaussianBlur(28))
    inner = alpha.filter(ImageFilter.GaussianBlur(8))
    win.alpha_composite(tinted_alpha(outer, (255, 151, 22, 115)))
    win.alpha_composite(tinted_alpha(inner, (255, 226, 116, 72)))
    bright = ImageEnhance.Contrast(ImageEnhance.Color(ImageEnhance.Brightness(base_object).enhance(1.13)).enhance(1.12)).enhance(1.06)
    win.alpha_composite(bright)

    dim_rgb = ImageOps.grayscale(base_object.convert("RGB")).convert("RGB")
    dim_rgb = ImageEnhance.Brightness(dim_rgb).enhance(0.36)
    dim = dim_rgb.convert("RGBA")
    dim.putalpha(alpha.point(lambda value: round(value * 0.62)))

    output_dir.mkdir(parents=True, exist_ok=True)
    base.resize(SYMBOL_DELIVERY_SIZE, Image.Resampling.LANCZOS).save(
        output_dir / "base-v4.png", optimize=True,
    )
    win.resize(SYMBOL_DELIVERY_SIZE, Image.Resampling.LANCZOS).save(
        output_dir / "win-v4.png", optimize=True,
    )
    dim.resize(SYMBOL_DELIVERY_SIZE, Image.Resampling.LANCZOS).save(
        output_dir / "dim-v4.png", optimize=True,
    )

    if special:
        tint = (255, 48, 28, 150) if special == "breach" else (59, 214, 255, 145)
        anticipation = Image.new("RGBA", base_object.size, (0, 0, 0, 0))
        pulse = alpha.filter(ImageFilter.MaxFilter(35)).filter(ImageFilter.GaussianBlur(34))
        anticipation.alpha_composite(tinted_alpha(pulse, tint))
        anticipation.alpha_composite(base_object)
        anticipation.resize(SYMBOL_DELIVERY_SIZE, Image.Resampling.LANCZOS).save(
            output_dir / "anticipation-v4.png", optimize=True,
        )

        triggered = Image.new("RGBA", base_object.size, (0, 0, 0, 0))
        hot = alpha.filter(ImageFilter.MaxFilter(43)).filter(ImageFilter.GaussianBlur(24))
        triggered.alpha_composite(tinted_alpha(hot, (255, 190, 62, 190)))
        triggered.alpha_composite(ImageEnhance.Brightness(base_object).enhance(1.22))
        triggered.resize(SYMBOL_DELIVERY_SIZE, Image.Resampling.LANCZOS).save(
            output_dir / "triggered-v4.png", optimize=True,
        )


def build_paylines() -> None:
    PAYLINE_ROOT.mkdir(parents=True, exist_ok=True)
    for line_id, rows in enumerate(PAYLINES):
        size = (1000, 600)
        points = [(100 + column * 200, 100 + row * 200) for column, row in enumerate(rows)]
        glow_mask = Image.new("L", size, 0)
        glow_draw = ImageDraw.Draw(glow_mask)
        glow_draw.line(points, fill=235, width=24, joint="curve")
        glow_mask = glow_mask.filter(ImageFilter.GaussianBlur(18))

        image = Image.new("RGBA", size, (0, 0, 0, 0))
        image.alpha_composite(tinted_alpha(glow_mask, (255, 55, 18, 150)))
        draw = ImageDraw.Draw(image)
        draw.line(points, fill=(255, 77, 30, 220), width=15, joint="curve")
        draw.line(points, fill=(255, 186, 48, 255), width=8, joint="curve")
        draw.line(points, fill=(255, 245, 196, 255), width=3, joint="curve")
        for point in points:
            x, y = point
            draw.ellipse((x - 11, y - 11, x + 11, y + 11), fill=(255, 181, 42, 255), outline=(255, 248, 208, 255), width=3)
        image.save(PAYLINE_ROOT / f"line-{line_id + 1:02d}.png", optimize=True)


def build_reel_stop_background(column_index: int, stop_index: int) -> Image.Image:
    width, height = REEL_STOP_SIZE
    image = Image.new("RGBA", REEL_STOP_SIZE, (4, 9, 10, 255))
    pixels = image.load()
    light_x = width * (0.42 + column_index * 0.035)
    light_y = height * 0.42
    for y in range(height):
        for x in range(width):
            dx = (x - light_x) / width
            dy = (y - light_y) / height
            radial = max(0.0, 1.0 - (dx * dx * 2.9 + dy * dy * 2.2))
            grain = ((x * 17 + y * 29 + stop_index * 31 + column_index * 47) % 23) / 23
            pixels[x, y] = (
                round(4 + radial * 8 + grain * 2),
                round(9 + radial * 15 + grain * 2),
                round(10 + radial * 17 + grain * 3),
                255,
            )

    draw = ImageDraw.Draw(image)
    draw.rectangle((1, 1, width - 2, height - 2), outline=(119, 86, 40, 150), width=2)
    draw.line((10, height - 3, width - 10, height - 3), fill=(197, 137, 51, 175), width=2)
    draw.line((18, 3, width - 18, 3), fill=(45, 76, 80, 135), width=1)
    vignette = Image.new("L", REEL_STOP_SIZE, 0)
    vignette_draw = ImageDraw.Draw(vignette)
    vignette_draw.rectangle((12, 10, width - 13, height - 12), fill=205)
    vignette = ImageOps.invert(vignette.filter(ImageFilter.GaussianBlur(28)))
    image.alpha_composite(tinted_alpha(vignette, (0, 0, 0, 95)))
    return image


def build_reel_strips() -> None:
    REEL_STRIP_ROOT.mkdir(parents=True, exist_ok=True)
    symbol_ids = tuple(SYMBOL_SOURCES)
    symbol_count = len(symbol_ids)
    stop_width, stop_height = REEL_STOP_SIZE

    for column_index in range(REEL_COUNT):
        ordered = tuple(
            symbol_ids[(symbol_index * REEL_COUNT + column_index * VISIBLE_ROWS) % symbol_count]
            for symbol_index in range(symbol_count)
        )
        strip_symbols = ordered + ordered[:VISIBLE_ROWS]
        strip = Image.new("RGBA", (stop_width, stop_height * len(strip_symbols)), (0, 0, 0, 255))
        for stop_index, symbol_id in enumerate(strip_symbols):
            stop = build_reel_stop_background(column_index, stop_index)
            symbol = Image.open(
                SYMBOL_ROOT / SYMBOL_DIRECTORIES[symbol_id] / "states-v4" / "base-v4.png",
            ).convert("RGBA")
            symbol.thumbnail((250, 220), Image.Resampling.LANCZOS)
            x = (stop_width - symbol.width) // 2
            y = (stop_height - symbol.height) // 2 - 2
            stop.alpha_composite(symbol, (x, y))
            strip.alpha_composite(stop, (0, stop_index * stop_height))
        strip.save(REEL_STRIP_ROOT / f"reel-{column_index + 1:02d}.png", optimize=True)


def main() -> None:
    missing = [str(path) for path in SYMBOL_SOURCES.values() if not path.exists()]
    if missing:
        raise SystemExit("Missing symbol sources:\n" + "\n".join(missing))
    for symbol_id, source in SYMBOL_SOURCES.items():
        special = symbol_id if symbol_id in {"ghost_wild", "breach"} else None
        build_states(source, SYMBOL_ROOT / SYMBOL_DIRECTORIES[symbol_id] / "states-v4", special)
    build_paylines()
    build_reel_strips()
    print(
        f"Built {len(SYMBOL_SOURCES)} symbol state packs, "
        f"{len(PAYLINES)} raster paylines and {REEL_COUNT} reel strips"
    )


if __name__ == "__main__":
    main()
