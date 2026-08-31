#!/usr/bin/env python3
"""Build the V39 HUD glyph overlay from the canonical V21 atlas.

The V21 atlas is treated as immutable input. Only glyph column 1 (``buy``) is
replaced, using the authored V39 shopping-cart master for all five state rows.
The generated WebP is lossless, and decoded pixels outside that column must be
byte-identical to the decoded V21 source before output is committed.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageOps, __version__ as PILLOW_VERSION


SCRIPT_PATH = Path(__file__).resolve()
APP_ROOT = SCRIPT_PATH.parent.parent
REPOSITORY_ROOT = APP_ROOT.parents[1]

SOURCE_ATLAS_PATH = APP_ROOT / "static/assets/blacksite/v21/ui-kit/atlas/glyphs.webp"
CART_MASTER_PATH = APP_ROOT / "art/generated/v39/ui-kit/source/shop-cart-master.png"
OUTPUT_ROOT = APP_ROOT / "static/assets/blacksite/v39/ui-kit"
OUTPUT_ATLAS_PATH = OUTPUT_ROOT / "atlas/glyphs.webp"
OUTPUT_MANIFEST_PATH = OUTPUT_ROOT / "manifest.json"

EXPECTED_SOURCE_BYTES = 101_978
EXPECTED_SOURCE_SHA256 = "b4a274be327929ec5c1a3afeb99c53ee7ddac4b255c154687584faebb107b614"
ATLAS_SIZE = (1_536, 480)
CELL_SIZE = 96
GLYPH_COLUMNS = 16
STATE_ROWS = (
    "idle",
    "hover-focus",
    "pressed-selected",
    "disabled",
    "danger",
)
BUY_COLUMN = 1
SAFE_INSET = 12
SOURCE_COLOR_RETENTION = (0.82, 0.72, 0.42, 0.0, 0.12)


class BuildError(RuntimeError):
    """Raised for an actionable, user-facing asset build failure."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def repository_path(path: Path) -> str:
    return path.resolve().relative_to(REPOSITORY_ROOT).as_posix()


def require_file(path: Path, role: str) -> bytes:
    if not path.is_file():
        raise BuildError(f"missing {role}: {repository_path(path)}")
    return path.read_bytes()


def open_rgba(data: bytes, role: str, expected_format: str | None = None) -> Image.Image:
    try:
        with Image.open(io.BytesIO(data)) as source:
            source.load()
            if expected_format is not None and source.format != expected_format:
                raise BuildError(
                    f"{role} must be {expected_format}, got {source.format or 'unknown'}"
                )
            return source.convert("RGBA")
    except BuildError:
        raise
    except Exception as error:  # Pillow raises several format-specific errors.
        raise BuildError(f"cannot decode {role}: {error}") from error


def alpha_bbox(image: Image.Image, role: str) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise BuildError(f"{role} contains no visible pixels")
    return bounds


def weighted_rgb(samples: list[tuple[int, int, int, int, int]]) -> tuple[int, int, int]:
    weight = sum(alpha for _, _, _, _, alpha in samples)
    if weight <= 0:
        raise BuildError("state donor palette contains no visible pixels")
    return tuple(
        round(sum(sample[channel] * sample[4] for sample in samples) / weight)
        for channel in (1, 2, 3)
    )


def donor_palette(donor: Image.Image) -> tuple[tuple[int, int, int], ...]:
    samples: list[tuple[int, int, int, int, int]] = []
    pixels = (
        donor.get_flattened_data()
        if hasattr(donor, "get_flattened_data")
        else donor.getdata()
    )
    for red, green, blue, alpha in pixels:
        if alpha < 16:
            continue
        luminance = round(0.2126 * red + 0.7152 * green + 0.0722 * blue)
        samples.append((luminance, red, green, blue, alpha))
    if len(samples) < 32:
        raise BuildError("V21 buy state does not contain enough donor pixels")
    samples.sort(key=lambda sample: sample[0])

    def percentile_band(center: float, radius: float = 0.08) -> tuple[int, int, int]:
        start = max(0, round((center - radius) * (len(samples) - 1)))
        end = min(len(samples), round((center + radius) * (len(samples) - 1)) + 1)
        return weighted_rgb(samples[start:end])

    return percentile_band(0.10), percentile_band(0.50), percentile_band(0.90)


def normalize_cart(master: Image.Image) -> Image.Image:
    bounds = alpha_bbox(master, "V39 shopping-cart master")
    cropped = master.crop(bounds)
    available = CELL_SIZE - 2 * SAFE_INSET
    resized = ImageOps.contain(
        cropped,
        (available, available),
        method=Image.Resampling.LANCZOS,
    )
    # The generated master contains photographic metal grain that cannot be
    # resolved at HUD scale. A compact palette keeps the 96px authored glyph
    # crisp and avoids shipping hundreds of kilobytes of invisible texture.
    resized_alpha = resized.getchannel("A")
    resized = resized.convert("RGB").quantize(
        colors=64,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGBA")
    resized.putalpha(resized_alpha)
    cell = Image.new("RGBA", (CELL_SIZE, CELL_SIZE), (0, 0, 0, 0))
    offset = ((CELL_SIZE - resized.width) // 2, (CELL_SIZE - resized.height) // 2)
    cell.alpha_composite(resized, dest=offset)
    bounds = alpha_bbox(cell, "normalized V39 shopping-cart master")
    if (
        bounds[0] < SAFE_INSET
        or bounds[1] < SAFE_INSET
        or bounds[2] > CELL_SIZE - SAFE_INSET
        or bounds[3] > CELL_SIZE - SAFE_INSET
    ):
        raise BuildError(f"normalized shopping cart exceeds the {SAFE_INSET}px safe inset: {bounds}")
    return cell


def colorize_for_state(
    cart: Image.Image,
    donor: Image.Image,
    source_color_retention: float,
) -> Image.Image:
    shadow, midtone, highlight = donor_palette(donor)
    grayscale = ImageOps.grayscale(cart)
    state_rgb = ImageOps.colorize(
        grayscale,
        black=shadow,
        mid=midtone,
        white=highlight,
    ).convert("RGBA")
    state_rgb.putalpha(cart.getchannel("A"))
    if source_color_retention <= 0:
        return state_rgb
    authored = cart.copy()
    return Image.blend(state_rgb, authored, source_color_retention)


def canonical_rgba_bytes(image: Image.Image) -> bytes:
    """Return RGBA bytes with irrelevant RGB below fully transparent pixels zeroed."""
    raw = bytearray(image.tobytes())
    for index in range(0, len(raw), 4):
        if raw[index + 3] == 0:
            raw[index:index + 3] = b"\x00\x00\x00"
    return bytes(raw)


def pixels_outside_buy_column(image: Image.Image) -> bytes:
    left = BUY_COLUMN * CELL_SIZE
    right = left + CELL_SIZE
    raw = bytearray()
    for y in range(image.height):
        raw.extend(canonical_rgba_bytes(image.crop((0, y, left, y + 1))))
        raw.extend(canonical_rgba_bytes(image.crop((right, y, image.width, y + 1))))
    return bytes(raw)


def assert_only_buy_column_changed(source: Image.Image, candidate: Image.Image) -> None:
    left = BUY_COLUMN * CELL_SIZE
    right = left + CELL_SIZE
    for region_name, bounds in (
        ("left of buy column", (0, 0, left, source.height)),
        ("right of buy column", (right, 0, source.width, source.height)),
    ):
        if canonical_rgba_bytes(source.crop(bounds)) != canonical_rgba_bytes(candidate.crop(bounds)):
            raise BuildError(f"generated atlas changed pixels {region_name}")
    for row_index, state in enumerate(STATE_ROWS):
        bounds = (
            left,
            row_index * CELL_SIZE,
            right,
            (row_index + 1) * CELL_SIZE,
        )
        if ImageChops.difference(source.crop(bounds), candidate.crop(bounds)).getbbox() is None:
            raise BuildError(f"generated atlas did not replace the buy glyph for {state}")


def encode_lossless_webp(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(
        output,
        format="WEBP",
        lossless=True,
        quality=100,
        method=6,
        exact=False,
    )
    return output.getvalue()


def build_outputs() -> tuple[bytes, bytes]:
    source_bytes = require_file(SOURCE_ATLAS_PATH, "canonical V21 glyph atlas")
    if len(source_bytes) != EXPECTED_SOURCE_BYTES:
        raise BuildError(
            f"canonical V21 glyph atlas byte count drifted: "
            f"expected {EXPECTED_SOURCE_BYTES}, got {len(source_bytes)}"
        )
    source_sha256 = sha256_bytes(source_bytes)
    if source_sha256 != EXPECTED_SOURCE_SHA256:
        raise BuildError(
            "canonical V21 glyph atlas hash drifted: "
            f"expected {EXPECTED_SOURCE_SHA256}, got {source_sha256}"
        )
    source = open_rgba(source_bytes, "canonical V21 glyph atlas", "WEBP")
    if source.size != ATLAS_SIZE:
        raise BuildError(f"canonical V21 glyph atlas must be {ATLAS_SIZE}, got {source.size}")

    master_bytes = require_file(CART_MASTER_PATH, "V39 shopping-cart master")
    master = open_rgba(master_bytes, "V39 shopping-cart master", "PNG")
    master_bounds = alpha_bbox(master, "V39 shopping-cart master")
    cart = normalize_cart(master)

    candidate = source.copy()
    column_x = BUY_COLUMN * CELL_SIZE
    generated_row_hashes: dict[str, str] = {}
    for row_index, (state, retention) in enumerate(zip(STATE_ROWS, SOURCE_COLOR_RETENTION, strict=True)):
        donor_bounds = (
            column_x,
            row_index * CELL_SIZE,
            column_x + CELL_SIZE,
            (row_index + 1) * CELL_SIZE,
        )
        donor = source.crop(donor_bounds)
        state_cart = colorize_for_state(cart, donor, retention)
        candidate.paste(state_cart, (column_x, row_index * CELL_SIZE))
        generated_row_hashes[state] = sha256_bytes(state_cart.tobytes())

    assert_only_buy_column_changed(source, candidate)
    candidate = Image.frombytes("RGBA", candidate.size, canonical_rgba_bytes(candidate))
    output_bytes = encode_lossless_webp(candidate)
    decoded_output = open_rgba(output_bytes, "generated V39 glyph atlas", "WEBP")
    if decoded_output.size != ATLAS_SIZE:
        raise BuildError(f"generated V39 glyph atlas must be {ATLAS_SIZE}, got {decoded_output.size}")
    if canonical_rgba_bytes(candidate) != canonical_rgba_bytes(decoded_output):
        raise BuildError("lossless WebP round trip changed decoded atlas pixels")
    assert_only_buy_column_changed(source, decoded_output)

    source_outside_hash = sha256_bytes(pixels_outside_buy_column(source))
    output_outside_hash = sha256_bytes(pixels_outside_buy_column(decoded_output))
    if source_outside_hash != output_outside_hash:
        raise BuildError("decoded pixels outside the buy column do not match the V21 source")

    manifest = {
        "schema": "blacksite-ui-glyph-overlay-v39",
        "version": 39,
        "runtimeRoot": "assets/blacksite/v39/ui-kit",
        "provenance": {
            "builder": repository_path(SCRIPT_PATH),
            "baseAtlas": {
                "path": repository_path(SOURCE_ATLAS_PATH),
                "bytes": len(source_bytes),
                "sha256": source_sha256,
                "width": source.width,
                "height": source.height,
            },
            "authoredMaster": {
                "path": repository_path(CART_MASTER_PATH),
                "bytes": len(master_bytes),
                "sha256": sha256_bytes(master_bytes),
                "width": master.width,
                "height": master.height,
                "alphaBounds": list(master_bounds),
            },
            "toolchain": {
                "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
                "pillow": PILLOW_VERSION,
                "encoder": "Pillow WebP lossless quality=100 method=6 exact=false",
            },
        },
        "atlas": {
            "path": "atlas/glyphs.webp",
            "bytes": len(output_bytes),
            "sha256": sha256_bytes(output_bytes),
            "width": decoded_output.width,
            "height": decoded_output.height,
            "columns": GLYPH_COLUMNS,
            "rows": len(STATE_ROWS),
            "cellWidth": CELL_SIZE,
            "cellHeight": CELL_SIZE,
            "safeInset": SAFE_INSET,
        },
        "overlay": {
            "glyph": "buy",
            "column": BUY_COLUMN,
            "stateRows": list(STATE_ROWS),
            "generatedRowRgbaSha256": generated_row_hashes,
            "unchangedOutsideColumnRgbaSha256": output_outside_hash,
        },
        "files": [
            {
                "path": "atlas/glyphs.webp",
                "bytes": len(output_bytes),
                "sha256": sha256_bytes(output_bytes),
            }
        ],
        "totalBytes": len(output_bytes),
    }
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return output_bytes, manifest_bytes


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_bytes(data)
    os.replace(temporary, path)


def check_output(path: Path, expected: bytes) -> None:
    actual = require_file(path, "generated V39 output")
    if actual != expected:
        raise BuildError(
            f"generated output is stale: {repository_path(path)} "
            f"(run {repository_path(SCRIPT_PATH)})"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify committed V39 outputs without modifying them",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        atlas_bytes, manifest_bytes = build_outputs()
        if args.check:
            check_output(OUTPUT_ATLAS_PATH, atlas_bytes)
            check_output(OUTPUT_MANIFEST_PATH, manifest_bytes)
            action = "verified"
        else:
            write_atomic(OUTPUT_ATLAS_PATH, atlas_bytes)
            write_atomic(OUTPUT_MANIFEST_PATH, manifest_bytes)
            action = "wrote"
        print(
            f"[blacksite-v39-glyphs] {action} {repository_path(OUTPUT_ATLAS_PATH)} "
            f"({len(atlas_bytes)} bytes, sha256 {sha256_bytes(atlas_bytes)})"
        )
        return 0
    except BuildError as error:
        print(f"[blacksite-v39-glyphs] ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
