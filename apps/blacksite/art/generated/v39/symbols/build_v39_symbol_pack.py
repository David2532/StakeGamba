from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import (
    Image,
    ImageChops,
    ImageDraw,
    ImageEnhance,
    ImageFilter,
    ImageFont,
    ImageOps,
    ImageStat,
    __version__ as PILLOW_VERSION,
    features,
)


SCRIPT = Path(__file__).resolve()
AUTHORING_ROOT = SCRIPT.parent
BLACKSITE_ROOT = SCRIPT.parents[4]
SOURCE_ROOT = AUTHORING_ROOT / "source"
STATIC_BLACKSITE_ROOT = BLACKSITE_ROOT / "static" / "assets" / "blacksite"
RUNTIME_ROOT = BLACKSITE_ROOT / "static" / "assets" / "blacksite" / "v39"
SYMBOL_RUNTIME_ROOT = RUNTIME_ROOT / "symbols"
REEL_RUNTIME_ROOT = RUNTIME_ROOT / "ui" / "reel-strips"
BUILD_REPORT_PATH = AUTHORING_ROOT / "build-report.generated.json"
PROOF_PATH = AUTHORING_ROOT / "proof-v39-symbols.webp"

SYMBOL_SIZE = (512, 512)
SYMBOL_CONTENT_LIMIT = 420
SYMBOL_VISUAL_CENTER_Y = 246
STOP_SIZE = (320, 240)
STOP_COUNT = 16
REEL_SIZE = (STOP_SIZE[0], STOP_SIZE[1] * STOP_COUNT)
REEL_COUNT = 5
STATE_WEBP_QUALITY = 86
REEL_WEBP_QUALITY = 84
V39_RUNTIME_BUDGET_BYTES = 2_000_000
SUPERSEDED_STATE_BYTES = 1_359_552
SUPERSEDED_REEL_BYTES = 2_793_632
SUPERSEDED_RUNTIME_BYTES = SUPERSEDED_STATE_BYTES + SUPERSEDED_REEL_BYTES
MAX_DECODED_TAIL_RMS = 3.0


@dataclass(frozen=True)
class SymbolSpec:
    symbol_id: str
    code: str
    runtime_directory: str
    master_name: str | None = None
    retained_state_root: str | None = None
    retained_state_template: str = "{state}.webp"
    extra_states: tuple[str, ...] = ()

    @property
    def states(self) -> tuple[str, ...]:
        return ("base", "win", "dim", *self.extra_states)

    @property
    def input_kind(self) -> str:
        return "master_png" if self.master_name is not None else "retained_state_pack"


SYMBOLS = (
    SymbolSpec(
        "operative",
        "SYM_01",
        "sym_01_operative",
        retained_state_root="v22/symbols/operative",
    ),
    SymbolSpec(
        "encrypted_drive",
        "SYM_02",
        "sym_02_encrypted_drive",
        retained_state_root="symbols/sym_02_encrypted_drive/states-v4",
        retained_state_template="{state}-v4.webp",
    ),
    SymbolSpec(
        "tactical_radio",
        "SYM_03",
        "sym_03_tactical_radio",
        master_name="sym_03_tactical_radio-master-v39.png",
    ),
    SymbolSpec(
        "classified_folder",
        "SYM_04",
        "sym_04_classified_folder",
        master_name="sym_04_classified_folder-master-v39.png",
    ),
    SymbolSpec(
        "night_vision_goggles",
        "SYM_05",
        "sym_05_night_vision_goggles",
        master_name="sym_05_night_vision_goggles-master-v39.png",
    ),
    SymbolSpec(
        "supply_crate",
        "SYM_06",
        "sym_06_supply_crate",
        master_name="sym_06_supply_crate-master-v39.png",
    ),
    SymbolSpec(
        "ghost_wild",
        "SYM_07",
        "sym_07_ghost_wild",
        retained_state_root="symbols/sym_07_ghost_wild/states-v4",
        retained_state_template="{state}-v4.webp",
    ),
    SymbolSpec(
        "breach",
        "SYM_08",
        "sym_08_breach_vault",
        master_name="sym_08_breach-master-v39.png",
        extra_states=("anticipation", "triggered"),
    ),
    SymbolSpec(
        "a",
        "SYM_09",
        "sym_09_a",
        master_name="sym_09_a-master-v39.png",
    ),
    SymbolSpec(
        "k",
        "SYM_10",
        "sym_10_k",
        retained_state_root="symbols/sym_10_k/states-v4",
        retained_state_template="{state}-v4.webp",
    ),
    SymbolSpec(
        "q",
        "SYM_11",
        "sym_11_q",
        master_name="sym_11_q-master-v39.png",
    ),
    SymbolSpec(
        "j",
        "SYM_12",
        "sym_12_j",
        retained_state_root="symbols/sym_12_j/states-v4",
        retained_state_template="{state}-v4.webp",
    ),
    SymbolSpec(
        "ten",
        "SYM_13",
        "sym_13_ten",
        master_name="sym_13_ten-master-v39.png",
    ),
)

CANONICAL_SYMBOL_IDS = tuple(spec.symbol_id for spec in SYMBOLS)
SYMBOL_BY_ID = {spec.symbol_id: spec for spec in SYMBOLS}
MASTER_SYMBOL_IDS = (
    "tactical_radio",
    "classified_folder",
    "night_vision_goggles",
    "supply_crate",
    "breach",
    "a",
    "q",
    "ten",
)
RETAINED_SYMBOL_IDS = ("operative", "encrypted_drive", "ghost_wild", "k", "j")

# Presentation-only stop order copied from the existing registered 13-stop
# strips. Each logical 13-stop reel contains every symbol exactly once. The
# final three cells repeat the first three cells for seamless visual wrapping.
# This does not define or mutate RGS/math probabilities.
REEL_SYMBOLS = (
    (
        "operative", "supply_crate", "q", "tactical_radio", "breach", "ten",
        "night_vision_goggles", "k", "encrypted_drive", "ghost_wild", "j",
        "classified_folder", "a", "operative", "supply_crate", "q",
    ),
    (
        "classified_folder", "a", "operative", "supply_crate", "q",
        "tactical_radio", "breach", "ten", "night_vision_goggles", "k",
        "encrypted_drive", "ghost_wild", "j", "classified_folder", "a", "operative",
    ),
    (
        "ghost_wild", "j", "classified_folder", "a", "operative", "supply_crate",
        "q", "tactical_radio", "breach", "ten", "night_vision_goggles", "k",
        "encrypted_drive", "ghost_wild", "j", "classified_folder",
    ),
    (
        "k", "encrypted_drive", "ghost_wild", "j", "classified_folder", "a",
        "operative", "supply_crate", "q", "tactical_radio", "breach", "ten",
        "night_vision_goggles", "k", "encrypted_drive", "ghost_wild",
    ),
    (
        "ten", "night_vision_goggles", "k", "encrypted_drive", "ghost_wild", "j",
        "classified_folder", "a", "operative", "supply_crate", "q",
        "tactical_radio", "breach", "ten", "night_vision_goggles", "k",
    ),
)

EXPECTED_OPERATIVE_STOPS = ((0, 13), (2, 15), (4,), (6,), (8,))
EXPECTED_WILD_STOPS = ((9,), (11,), (0, 13), (2, 15), (4,))
EXPECTED_VAULT_STOPS = ((4,), (6,), (8,), (10,), (12,))


def relative_to_blacksite(path: Path) -> str:
    return path.resolve().relative_to(BLACKSITE_ROOT).as_posix()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def decoded_sha256(image: Image.Image) -> str:
    mode = "RGBA" if "A" in image.getbands() else "RGB"
    return hashlib.sha256(image.convert(mode).tobytes()).hexdigest()


def validate_contract() -> None:
    if len(SYMBOLS) != 13 or len(set(CANONICAL_SYMBOL_IDS)) != 13:
        raise ValueError("V39 requires exactly thirteen unique canonical symbol IDs")
    if tuple(spec.code for spec in SYMBOLS) != tuple(f"SYM_{index:02d}" for index in range(1, 14)):
        raise ValueError("V39 symbol codes must remain the contiguous SYM_01..SYM_13 contract")
    if len({spec.runtime_directory for spec in SYMBOLS}) != 13:
        raise ValueError("V39 runtime symbol directories must be unique")
    if tuple(spec.symbol_id for spec in SYMBOLS if spec.master_name is not None) != MASTER_SYMBOL_IDS:
        raise ValueError("V39 generated-master symbol ownership drifted")
    if tuple(spec.symbol_id for spec in SYMBOLS if spec.retained_state_root is not None) != RETAINED_SYMBOL_IDS:
        raise ValueError("V39 retained-pack symbol ownership drifted")
    master_names = tuple(spec.master_name for spec in SYMBOLS if spec.master_name is not None)
    if len(master_names) != 8 or len(set(master_names)) != 8:
        raise ValueError("V39 requires exactly eight uniquely named new master PNGs")
    for spec in SYMBOLS:
        if (spec.master_name is None) == (spec.retained_state_root is None):
            raise ValueError(f"{spec.code} must own exactly one input kind")
        if spec.retained_state_root is not None and spec.extra_states:
            raise ValueError(f"{spec.code} retained packs may only provide base/win/dim")
    if SYMBOL_BY_ID["breach"].extra_states != ("anticipation", "triggered"):
        raise ValueError("Only the canonical Vault/BREACH symbol owns V39 anticipation and triggered states")

    if len(REEL_SYMBOLS) != REEL_COUNT:
        raise ValueError("V39 requires exactly five visual reel strips")
    for reel_index, stops in enumerate(REEL_SYMBOLS):
        if len(stops) != STOP_COUNT:
            raise ValueError(f"Reel {reel_index + 1} must contain exactly sixteen visual stops")
        if tuple(stops[-3:]) != tuple(stops[:3]):
            raise ValueError(f"Reel {reel_index + 1} does not preserve the three-stop seamless tail")
        if set(stops[:13]) != set(CANONICAL_SYMBOL_IDS) or len(set(stops[:13])) != 13:
            raise ValueError(f"Reel {reel_index + 1} logical stops must contain every canonical symbol once")

    positions = lambda symbol_id: tuple(  # noqa: E731 - compact invariant helper
        tuple(index for index, value in enumerate(reel) if value == symbol_id)
        for reel in REEL_SYMBOLS
    )
    if positions("operative") != EXPECTED_OPERATIVE_STOPS:
        raise ValueError("V39 operative stops drifted from the registered presentation order")
    if positions("ghost_wild") != EXPECTED_WILD_STOPS:
        raise ValueError("V39 WILD stops drifted from the registered presentation order")
    if positions("breach") != EXPECTED_VAULT_STOPS:
        raise ValueError("V39 Vault stops drifted from the registered presentation order")

    for path in (SOURCE_ROOT, STATIC_BLACKSITE_ROOT, RUNTIME_ROOT, BUILD_REPORT_PATH, PROOF_PATH):
        if not path.resolve().is_relative_to(BLACKSITE_ROOT):
            raise ValueError(f"V39 path escapes the BLACKSITE app root: {path}")
    for spec in SYMBOLS:
        for path in symbol_input_paths(spec):
            if not path.resolve().is_relative_to(BLACKSITE_ROOT):
                raise ValueError(f"{spec.code} input path escapes the BLACKSITE app root: {path}")


def master_path(spec: SymbolSpec) -> Path:
    if spec.master_name is None:
        raise ValueError(f"{spec.code} is a retained-pack symbol, not a new master")
    return SOURCE_ROOT / spec.master_name


def retained_state_path(spec: SymbolSpec, state: str) -> Path:
    if spec.retained_state_root is None:
        raise ValueError(f"{spec.code} is a generated-master symbol, not a retained pack")
    return (
        STATIC_BLACKSITE_ROOT
        / spec.retained_state_root
        / spec.retained_state_template.format(state=state)
    )


def retained_input_states(spec: SymbolSpec) -> tuple[str, ...]:
    states = ("base", "win", "dim")
    if spec.symbol_id == "ghost_wild":
        return (*states, "anticipation", "triggered")
    return states


def symbol_input_paths(spec: SymbolSpec) -> tuple[Path, ...]:
    if spec.master_name is not None:
        return (master_path(spec),)
    return tuple(retained_state_path(spec, state) for state in retained_input_states(spec))


def final_state_path(spec: SymbolSpec, state: str) -> Path:
    return SYMBOL_RUNTIME_ROOT / spec.runtime_directory / f"{state}.webp"


def expected_runtime_paths() -> tuple[Path, ...]:
    symbol_paths = tuple(
        final_state_path(spec, state)
        for spec in SYMBOLS
        if spec.master_name is not None
        for state in spec.states
    )
    reel_paths = tuple(REEL_RUNTIME_ROOT / f"reel-{index:02d}.webp" for index in range(1, REEL_COUNT + 1))
    return (*symbol_paths, *reel_paths)


def inspect_master(spec: SymbolSpec, path: Path) -> dict[str, object]:
    if path.suffix.lower() != ".png":
        raise ValueError(f"{spec.code} master must use the .png extension: {path}")
    with Image.open(path) as image:
        image.load()
        if image.format != "PNG":
            raise ValueError(f"{spec.code} master is not a decoded PNG: {path}")
        if image.width != image.height or image.width < 512:
            raise ValueError(
                f"{spec.code} master must be square and at least 512x512; got {image.size}"
            )
        if "A" not in image.getbands():
            raise ValueError(f"{spec.code} master must contain an alpha channel: {path}")
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        alpha_extrema = alpha.getextrema()
        visible_mask = alpha.point(lambda value: 255 if value > 4 else 0)
        visible_bbox = visible_mask.getbbox()
        if visible_bbox is None:
            raise ValueError(f"{spec.code} master has no visible pixels: {path}")
        if alpha_extrema[0] != 0:
            raise ValueError(f"{spec.code} master requires transparent background pixels: {path}")
        left, top, right, bottom = visible_bbox
        if left == 0 or top == 0 or right == image.width or bottom == image.height:
            raise ValueError(f"{spec.code} master subject touches the canvas edge: {path}")

        visible_magenta = 0
        pixel_data = (
            rgba.get_flattened_data()
            if hasattr(rgba, "get_flattened_data")
            else rgba.getdata()
        )
        for red, green, blue, opacity in pixel_data:
            if opacity > 8 and red > 225 and blue > 190 and green < 75:
                visible_magenta += 1
        if visible_magenta:
            raise ValueError(
                f"{spec.code} master contains {visible_magenta} visible chroma-magenta pixels: {path}"
            )

        return {
            "symbolId": spec.symbol_id,
            "code": spec.code,
            "inputKind": spec.input_kind,
            "path": relative_to_blacksite(path),
            "format": "png",
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "alphaExtrema": list(alpha_extrema),
            "visibleBounds": list(visible_bbox),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "decodedRgbaSha256": decoded_sha256(rgba),
        }


def inspect_retained_state(spec: SymbolSpec, state: str, path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        image.load()
        if image.format != "WEBP" or image.size != SYMBOL_SIZE or "A" not in image.getbands():
            raise ValueError(
                f"{spec.code}/{state} retained input must be an alpha-preserving 512x512 WebP: {path}"
            )
        alpha = image.getchannel("A")
        if alpha.getextrema()[0] != 0 or alpha.getbbox() is None:
            raise ValueError(
                f"{spec.code}/{state} retained input must contain transparent and visible pixels: {path}"
            )
        return {
            "symbolId": spec.symbol_id,
            "code": spec.code,
            "state": state,
            "inputKind": spec.input_kind,
            "path": relative_to_blacksite(path),
            "format": "webp",
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "alphaExtrema": list(alpha.getextrema()),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "decodedRgbaSha256": decoded_sha256(image.convert("RGBA")),
        }


def normalize_master(path: Path) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 4 else 0).getbbox()
    if bbox is None:
        raise ValueError(f"Master has no visible subject: {path}")
    subject = source.crop(bbox)
    scale = min(SYMBOL_CONTENT_LIMIT / subject.width, SYMBOL_CONTENT_LIMIT / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", SYMBOL_SIZE, (0, 0, 0, 0))
    x = (SYMBOL_SIZE[0] - subject.width) // 2
    y = SYMBOL_VISUAL_CENTER_Y - subject.height // 2
    canvas.alpha_composite(subject, (x, y))
    return clear_invisible_rgb(canvas)


def clear_invisible_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    red, green, blue, alpha = rgba.split()
    visible = alpha.point(lambda value: 255 if value else 0)
    black = Image.new("L", rgba.size, 0)
    return Image.merge(
        "RGBA",
        (
            Image.composite(red, black, visible),
            Image.composite(green, black, visible),
            Image.composite(blue, black, visible),
            alpha,
        ),
    )


def colored_alpha(color: tuple[int, int, int], alpha: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", alpha.size, (*color, 0))
    layer.putalpha(alpha)
    return layer


def scaled_alpha(alpha: Image.Image, factor: float, maximum: int = 255) -> Image.Image:
    return alpha.point(lambda value: min(maximum, round(value * factor)))


def build_standard_states(master: Image.Image) -> dict[str, Image.Image]:
    base = clear_invisible_rgb(master)
    alpha = base.getchannel("A")

    glow_mask = alpha.filter(ImageFilter.MaxFilter(19)).filter(ImageFilter.GaussianBlur(18))
    glow_mask = scaled_alpha(glow_mask, 0.44, 112)
    inner_mask = alpha.filter(ImageFilter.GaussianBlur(5))
    inner_mask = scaled_alpha(inner_mask, 0.25, 58)
    win = Image.new("RGBA", SYMBOL_SIZE, (0, 0, 0, 0))
    win = Image.alpha_composite(win, colored_alpha((241, 176, 69), glow_mask))
    win = Image.alpha_composite(win, colored_alpha((74, 211, 229), inner_mask))
    bright = ImageEnhance.Contrast(
        ImageEnhance.Color(ImageEnhance.Brightness(base).enhance(1.12)).enhance(1.06)
    ).enhance(1.04)
    win = Image.alpha_composite(win, bright)

    grayscale = ImageOps.grayscale(base.convert("RGB")).convert("RGB")
    subdued = Image.blend(base.convert("RGB"), grayscale, 0.68)
    subdued = ImageEnhance.Contrast(ImageEnhance.Brightness(subdued).enhance(0.42)).enhance(0.92)
    dim = subdued.convert("RGBA")
    dim.putalpha(scaled_alpha(alpha, 0.72))

    return {
        "base": clear_invisible_rgb(base),
        "win": clear_invisible_rgb(win),
        "dim": clear_invisible_rgb(dim),
    }


def build_vault_special_states(base: Image.Image) -> dict[str, Image.Image]:
    alpha = base.getchannel("A")

    cyan_glow = alpha.filter(ImageFilter.MaxFilter(23)).filter(ImageFilter.GaussianBlur(22))
    anticipation = Image.new("RGBA", SYMBOL_SIZE, (0, 0, 0, 0))
    anticipation = Image.alpha_composite(
        anticipation,
        colored_alpha((37, 211, 236), scaled_alpha(cyan_glow, 0.54, 126)),
    )
    anticipation_base = ImageEnhance.Brightness(ImageEnhance.Color(base).enhance(1.05)).enhance(1.06)
    anticipation = Image.alpha_composite(anticipation, anticipation_base)
    arc_mask = Image.new("L", SYMBOL_SIZE, 0)
    arc_draw = ImageDraw.Draw(arc_mask)
    arc_draw.arc((38, 38, 474, 474), 205, 335, fill=210, width=6)
    arc_draw.arc((38, 38, 474, 474), 25, 155, fill=210, width=6)
    anticipation = Image.alpha_composite(
        anticipation,
        colored_alpha((111, 238, 250), arc_mask.filter(ImageFilter.GaussianBlur(5))),
    )

    gold_glow = alpha.filter(ImageFilter.MaxFilter(27)).filter(ImageFilter.GaussianBlur(20))
    triggered = Image.new("RGBA", SYMBOL_SIZE, (0, 0, 0, 0))
    triggered = Image.alpha_composite(
        triggered,
        colored_alpha((242, 167, 48), scaled_alpha(gold_glow, 0.62, 148)),
    )
    triggered_base = ImageEnhance.Contrast(
        ImageEnhance.Brightness(ImageEnhance.Color(base).enhance(1.08)).enhance(1.14)
    ).enhance(1.04)
    triggered = Image.alpha_composite(triggered, triggered_base)
    ring_mask = Image.new("L", SYMBOL_SIZE, 0)
    ring_draw = ImageDraw.Draw(ring_mask)
    ring_draw.ellipse((55, 55, 457, 457), outline=218, width=7)
    ring_draw.ellipse((193, 193, 319, 319), outline=238, width=7)
    triggered = Image.alpha_composite(
        triggered,
        colored_alpha((255, 213, 119), ring_mask.filter(ImageFilter.GaussianBlur(6))),
    )

    return {
        "anticipation": clear_invisible_rgb(anticipation),
        "triggered": clear_invisible_rgb(triggered),
    }


def save_runtime_webp(
    image: Image.Image,
    destination: Path,
    *,
    rgba: bool,
    quality: int,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    converted = clear_invisible_rgb(image) if rgba else image.convert("RGB")
    converted.save(
        destination,
        format="WEBP",
        lossless=False,
        quality=quality,
        alpha_quality=100,
        method=6,
        exact=True,
    )


def build_stop_background(column_index: int, stop_index: int) -> Image.Image:
    width, height = STOP_SIZE
    image = Image.new("RGBA", STOP_SIZE, (4, 9, 10, 255))
    pixels = image.load()
    light_x = width * (0.42 + column_index * 0.035)
    light_y = height * 0.42
    for y in range(height):
        for x in range(width):
            dx = (x - light_x) / width
            dy = (y - light_y) / height
            radial = max(0.0, 1.0 - (dx * dx * 2.9 + dy * dy * 2.2))
            pixels[x, y] = (
                round(5 + radial * 8),
                round(10 + radial * 15),
                round(12 + radial * 17),
                255,
            )

    draw = ImageDraw.Draw(image)
    draw.rectangle((1, 1, width - 2, height - 2), outline=(119, 86, 40, 150), width=2)
    draw.line((10, height - 3, width - 10, height - 3), fill=(197, 137, 51, 175), width=2)
    draw.line((18, 3, width - 18, 3), fill=(45, 76, 80, 135), width=1)
    vignette = Image.new("L", STOP_SIZE, 0)
    vignette_draw = ImageDraw.Draw(vignette)
    vignette_draw.rectangle((12, 10, width - 13, height - 12), fill=205)
    vignette = ImageOps.invert(vignette.filter(ImageFilter.GaussianBlur(28)))
    image.alpha_composite(colored_alpha((0, 0, 0), scaled_alpha(vignette, 95 / 255)))
    return image


def build_symbol_stop(base_state: Image.Image, column_index: int, stop_index: int) -> Image.Image:
    stop = build_stop_background(column_index, stop_index)
    fitted = base_state.convert("RGBA").copy()
    fitted.thumbnail((264, 226), Image.Resampling.LANCZOS)
    stop.alpha_composite(
        fitted,
        ((STOP_SIZE[0] - fitted.width) // 2, (STOP_SIZE[1] - fitted.height) // 2 - 2),
    )
    return stop.convert("RGB")


def image_record(path: Path, recorded_path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        image.load()
        has_alpha = "A" in image.getbands()
        record: dict[str, object] = {
            "path": relative_to_blacksite(recorded_path),
            "format": image.format.lower() if image.format else path.suffix.removeprefix("."),
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "hasAlpha": has_alpha,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "decodedSha256": decoded_sha256(image),
        }
        if has_alpha:
            record["alphaExtrema"] = list(image.getchannel("A").getextrema())
        return record


def validate_state(path: Path, label: str) -> None:
    with Image.open(path) as image:
        image.load()
        if image.format != "WEBP" or image.size != SYMBOL_SIZE or "A" not in image.getbands():
            raise ValueError(f"{label} must be an alpha-preserving 512x512 WebP")
        alpha = image.getchannel("A")
        if alpha.getextrema()[0] != 0 or alpha.getbbox() is None:
            raise ValueError(f"{label} must contain both transparent and visible pixels")


def validate_encoded_alpha(source: Image.Image, path: Path, label: str) -> None:
    expected = clear_invisible_rgb(source).getchannel("A").tobytes()
    with Image.open(path) as encoded:
        encoded.load()
        actual = encoded.convert("RGBA").getchannel("A").tobytes()
    if actual != expected:
        raise ValueError(f"{label} encoded WebP alpha is not pixel-exact to the generated state")


def validate_reel(path: Path, label: str) -> list[dict[str, object]]:
    with Image.open(path) as image:
        image.load()
        if image.format != "WEBP" or image.size != REEL_SIZE or "A" in image.getbands():
            raise ValueError(f"{label} must be an opaque 320x3840 WebP")
        metrics: list[dict[str, object]] = []
        for tail_offset in range(3):
            first = image.crop(
                (0, tail_offset * STOP_SIZE[1], STOP_SIZE[0], (tail_offset + 1) * STOP_SIZE[1])
            ).convert("RGB")
            tail_index = 13 + tail_offset
            tail = image.crop(
                (0, tail_index * STOP_SIZE[1], STOP_SIZE[0], (tail_index + 1) * STOP_SIZE[1])
            ).convert("RGB")
            difference = ImageChops.difference(first, tail)
            channel_rms = ImageStat.Stat(difference).rms
            maximum_rms = max(channel_rms)
            if maximum_rms > MAX_DECODED_TAIL_RMS:
                raise ValueError(
                    f"{label} decoded tail RMS {maximum_rms:.4f} exceeds {MAX_DECODED_TAIL_RMS:.1f} "
                    f"for cells {tail_offset}/{tail_index}"
                )
            metrics.append({
                "sourceStop": tail_offset,
                "tailStop": tail_index,
                "channelRms": [round(value, 6) for value in channel_rms],
                "maxChannelRms": round(maximum_rms, 6),
            })
        return metrics


def validate_source_tail(strip: Image.Image, label: str) -> None:
    for tail_offset in range(3):
        first = strip.crop(
            (0, tail_offset * STOP_SIZE[1], STOP_SIZE[0], (tail_offset + 1) * STOP_SIZE[1])
        )
        tail_index = 13 + tail_offset
        tail = strip.crop(
            (0, tail_index * STOP_SIZE[1], STOP_SIZE[0], (tail_index + 1) * STOP_SIZE[1])
        )
        if first.tobytes() != tail.tobytes():
            raise ValueError(
                f"{label} source tail cell {tail_index} is not pixel-equal to cell {tail_offset}"
            )


def proof_font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def build_proof_sheet(base_states: dict[str, Image.Image], destination: Path) -> None:
    canvas = Image.new("RGB", (1600, 1040), (6, 10, 12))
    draw = ImageDraw.Draw(canvas)
    title_font = proof_font(32)
    label_font = proof_font(18)
    draw.text((36, 24), "BLACKSITE V39 SYMBOL BASE PROOF / CANONICAL 13", fill=(236, 212, 158), font=title_font)
    for index, spec in enumerate(SYMBOLS):
        column = index % 5
        row = index // 5
        left = 28 + column * 314
        top = 84 + row * 310
        cell = build_stop_background(column, index)
        symbol = base_states[spec.symbol_id].copy()
        symbol.thumbnail((264, 226), Image.Resampling.LANCZOS)
        cell.alpha_composite(
            symbol,
            ((STOP_SIZE[0] - symbol.width) // 2, (STOP_SIZE[1] - symbol.height) // 2 - 2),
        )
        canvas.paste(cell.convert("RGB"), (left, top))
        draw.rectangle((left, top, left + 319, top + 239), outline=(127, 98, 49), width=2)
        draw.text((left + 8, top + 246), f"{spec.code} / {spec.symbol_id}", fill=(218, 225, 224), font=label_font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, format="WEBP", lossless=True, method=6, exact=True)


def ensure_no_unexpected_runtime_files() -> None:
    expected = {path.resolve() for path in expected_runtime_paths()}
    unexpected: list[Path] = []
    for owned_root in (SYMBOL_RUNTIME_ROOT, REEL_RUNTIME_ROOT):
        if not owned_root.exists():
            continue
        unexpected.extend(
            path
            for path in owned_root.rglob("*")
            if path.is_file() and path.resolve() not in expected
        )
    unexpected.sort()
    if unexpected:
        rendered = "\n".join(f"  - {relative_to_blacksite(path)}" for path in unexpected)
        raise ValueError(f"Unexpected files already exist under V39 symbol-builder-owned roots:\n{rendered}")


def missing_input_paths() -> tuple[Path, ...]:
    return tuple(
        path
        for spec in SYMBOLS
        for path in symbol_input_paths(spec)
        if not path.exists()
    )


def inspect_inputs() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    master_records: list[dict[str, object]] = []
    retained_records: list[dict[str, object]] = []
    for spec in SYMBOLS:
        if spec.master_name is not None:
            master_records.append(inspect_master(spec, master_path(spec)))
            continue
        for state in retained_input_states(spec):
            path = retained_state_path(spec, state)
            retained_records.append(inspect_retained_state(spec, state, path))
    return master_records, retained_records


def staged_runtime_path(staged_runtime_root: Path, final_path: Path) -> Path:
    return staged_runtime_root / final_path.relative_to(RUNTIME_ROOT)


def build_staged_package(staging: Path) -> tuple[dict[str, object], Path, Path, Path]:
    master_records, retained_records = inspect_inputs()
    staged_runtime_root = staging / "v39"
    staged_proof = staging / PROOF_PATH.name
    staged_report = staging / BUILD_REPORT_PATH.name

    base_states: dict[str, Image.Image] = {}
    state_records: list[dict[str, object]] = []

    for spec in SYMBOLS:
        if spec.master_name is None:
            with Image.open(retained_state_path(spec, "base")) as retained_base:
                retained_base.load()
                base_states[spec.symbol_id] = retained_base.convert("RGBA").copy()
            continue

        normalized = normalize_master(master_path(spec))
        states = build_standard_states(normalized)
        if spec.symbol_id == "breach":
            states.update(build_vault_special_states(states["base"]))
        if tuple(states) != spec.states:
            raise ValueError(f"{spec.code} state order drifted: {tuple(states)} != {spec.states}")
        base_states[spec.symbol_id] = states["base"]

        for state_name, state_image in states.items():
            final_path = final_state_path(spec, state_name)
            staged_path = staged_runtime_path(staged_runtime_root, final_path)
            save_runtime_webp(
                state_image,
                staged_path,
                rgba=True,
                quality=STATE_WEBP_QUALITY,
            )
            validate_state(staged_path, f"{spec.code}/{state_name}")
            validate_encoded_alpha(state_image, staged_path, f"{spec.code}/{state_name}")
            state_records.append({
                "symbolId": spec.symbol_id,
                "code": spec.code,
                "state": state_name,
                "sourcePath": relative_to_blacksite(master_path(spec)),
                **image_record(staged_path, final_path),
            })

    reel_records: list[dict[str, object]] = []
    for column_index, symbols in enumerate(REEL_SYMBOLS):
        logical_stops = [
            build_symbol_stop(base_states[symbol_id], column_index, stop_index)
            for stop_index, symbol_id in enumerate(symbols[:13])
        ]
        strip = Image.new("RGB", REEL_SIZE, (0, 0, 0))
        for stop_index, stop in enumerate(logical_stops):
            strip.paste(stop, (0, stop_index * STOP_SIZE[1]))
        for tail_offset, stop in enumerate(logical_stops[:3]):
            strip.paste(stop, (0, (13 + tail_offset) * STOP_SIZE[1]))
        validate_source_tail(strip, f"reel-{column_index + 1:02d}")

        final_path = REEL_RUNTIME_ROOT / f"reel-{column_index + 1:02d}.webp"
        staged_path = staged_runtime_path(staged_runtime_root, final_path)
        save_runtime_webp(
            strip,
            staged_path,
            rgba=False,
            quality=REEL_WEBP_QUALITY,
        )
        decoded_tail_metrics = validate_reel(staged_path, f"reel-{column_index + 1:02d}")
        reel_records.append({
            "reel": column_index + 1,
            "symbols": list(symbols),
            "seamlessTailSourcePixelExact": True,
            "decodedTailRms": decoded_tail_metrics,
            "decodedTailMaxChannelRmsGate": MAX_DECODED_TAIL_RMS,
            **image_record(staged_path, final_path),
        })

    build_proof_sheet(base_states, staged_proof)
    runtime_paths = tuple(path for path in staged_runtime_root.rglob("*") if path.is_file())
    runtime_bytes = sum(path.stat().st_size for path in runtime_paths)
    if runtime_bytes > V39_RUNTIME_BUDGET_BYTES:
        state_bytes = sum(
            path.stat().st_size
            for path in (staged_runtime_root / "symbols").rglob("*")
            if path.is_file()
        )
        reel_bytes = sum(
            path.stat().st_size
            for path in (staged_runtime_root / "ui" / "reel-strips").rglob("*")
            if path.is_file()
        )
        raise ValueError(
            f"V39 runtime package is {runtime_bytes} bytes "
            f"(states={state_bytes}, reels={reel_bytes}); "
            f"budget is {V39_RUNTIME_BUDGET_BYTES} bytes"
        )

    report: dict[str, object] = {
        "schema": "blacksite-v39-symbol-pack-build-v1",
        "generator": relative_to_blacksite(SCRIPT),
        "toolchain": {
            "python": platform.python_version(),
            "pillow": PILLOW_VERSION,
            "webp": features.version("webp"),
        },
        "policy": {
            "canonicalIdsPreserved": True,
            "mathRgsWalletPayoutUntouched": True,
            "registryTestsAndMainAssetManifestUntouchedByBuilder": True,
            "newVersionedRuntimeRoot": relative_to_blacksite(RUNTIME_ROOT),
            "redesignedSymbolsOnlyInV39StateRoot": list(MASTER_SYMBOL_IDS),
            "retainedSymbolsStayAtExistingRuntimePaths": list(RETAINED_SYMBOL_IDS),
            "runtimeWebp": {
                "states": {"quality": STATE_WEBP_QUALITY, "alphaQuality": 100, "method": 6},
                "reels": {"quality": REEL_WEBP_QUALITY, "method": 6},
            },
            "externalRuntimeDependencies": False,
            "fullStripRecompositionFromAllActiveBaseStates": True,
        },
        "budget": {
            "runtimeBytes": runtime_bytes,
            "runtimeBudgetBytes": V39_RUNTIME_BUDGET_BYTES,
            "withinBudget": True,
            "replacementContract": {
                "requiresSupersededRuntimePruning": True,
                "supersededRedesignedStateBytes": SUPERSEDED_STATE_BYTES,
                "supersededV22ReelBytes": SUPERSEDED_REEL_BYTES,
                "supersededRuntimeBytes": SUPERSEDED_RUNTIME_BYTES,
                "replacementDeltaBytes": runtime_bytes - SUPERSEDED_RUNTIME_BYTES,
                "finalCompleteBuildUnder64MiBIsAuthoritative": True,
            },
        },
        "geometry": {
            "symbol": list(SYMBOL_SIZE),
            "symbolContentLimit": SYMBOL_CONTENT_LIMIT,
            "reelStrip": list(REEL_SIZE),
            "reelStop": list(STOP_SIZE),
            "reelCount": REEL_COUNT,
            "stopsPerReel": STOP_COUNT,
            "logicalStopsPerReel": 13,
            "seamlessTailStops": 3,
        },
        "canonicalSymbolIds": list(CANONICAL_SYMBOL_IDS),
        "newMasters": master_records,
        "retainedStateInputs": retained_records,
        "generatedStates": state_records,
        "reels": reel_records,
        "proof": image_record(staged_proof, PROOF_PATH),
    }
    staged_report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report, staged_runtime_root, staged_proof, staged_report


def remove_promoted_path(path: Path) -> None:
    if not path.resolve().is_relative_to(BLACKSITE_ROOT):
        raise ValueError(f"Refusing to remove promotion path outside BLACKSITE root: {path}")
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def promote_package(staged_runtime_root: Path, staged_proof: Path, staged_report: Path) -> None:
    token = f"{os.getpid()}-{staged_runtime_root.parent.name}"
    runtime_moves = tuple(
        (staged_runtime_path(staged_runtime_root, final_path), final_path)
        for final_path in expected_runtime_paths()
    )
    moves = (*runtime_moves,
        (staged_proof, PROOF_PATH),
        (staged_report, BUILD_REPORT_PATH),
    )
    backups: list[tuple[Path, Path]] = []
    promoted: list[Path] = []

    for _, final_path in moves:
        final_path.parent.mkdir(parents=True, exist_ok=True)
        if not final_path.exists():
            continue
        backup = final_path.with_name(f".{final_path.name}.backup-{token}")
        if backup.exists():
            raise FileExistsError(f"Refusing to overwrite stale V39 promotion backup: {backup}")
        os.replace(final_path, backup)
        backups.append((backup, final_path))

    try:
        for staged_path, final_path in moves:
            os.replace(staged_path, final_path)
            promoted.append(final_path)
    except Exception:
        for final_path in reversed(promoted):
            remove_promoted_path(final_path)
        for backup, final_path in reversed(backups):
            os.replace(backup, final_path)
        raise
    else:
        for backup, _ in backups:
            remove_promoted_path(backup)


def execute(*, apply: bool) -> int:
    validate_contract()
    ensure_no_unexpected_runtime_files()
    missing = missing_input_paths()
    if missing:
        summary = {
            "status": "WAITING_FOR_INPUTS",
            "mode": "apply" if apply else "dry-run",
            "writesPerformed": False,
            "missingInputs": [relative_to_blacksite(path) for path in missing],
            "expectedRuntimeOutputs": [relative_to_blacksite(path) for path in expected_runtime_paths()],
        }
        print(json.dumps(summary, indent=2))
        if apply:
            raise FileNotFoundError("Cannot apply V39 build while required inputs are missing")
        return 2

    temporary_parent = RUNTIME_ROOT.parent if apply else None
    with tempfile.TemporaryDirectory(
        prefix="blacksite-v39-symbols-",
        dir=temporary_parent,
    ) as temporary:
        staging = Path(temporary)
        report, staged_runtime_root, staged_proof, staged_report = build_staged_package(staging)
        if apply:
            promote_package(staged_runtime_root, staged_proof, staged_report)

    print(json.dumps({
        "status": "BUILT" if apply else "VALIDATED_DRY_RUN",
        "mode": "apply" if apply else "dry-run",
        "writesPerformed": apply,
        "runtimeRoot": relative_to_blacksite(RUNTIME_ROOT),
        "redesignedStateCount": len(report["generatedStates"]),
        "retainedInputStateCount": len(report["retainedStateInputs"]),
        "reelCount": REEL_COUNT,
        "runtimeBytes": report["budget"]["runtimeBytes"],
        "runtimeBudgetBytes": V39_RUNTIME_BUDGET_BYTES,
        "buildReport": relative_to_blacksite(BUILD_REPORT_PATH),
        "proof": relative_to_blacksite(PROOF_PATH),
    }, indent=2))
    return 0


def dry_run() -> int:
    return execute(apply=False)


def build() -> int:
    return execute(apply=True)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the isolated BLACKSITE V39 symbol-state and full spin-strip package.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Atomically promote the fully staged and validated V39 package.",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Explicit alias for the default full no-promotion validation mode.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    return execute(apply=args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
