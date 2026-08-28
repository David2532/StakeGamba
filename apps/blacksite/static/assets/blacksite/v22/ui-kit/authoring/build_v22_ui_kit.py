#!/usr/bin/env python3
"""Normalize the approved V22 Imagegen masters into exact runtime WebP geometry."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "authoring" / "sources"

TARGETS = (
    (
        SOURCE_ROOT / "control-master-source.webp",
        ROOT / "nine-slice" / "control" / "master.webp",
        (768, 384),
        True,
    ),
    (
        SOURCE_ROOT / "panel-master-source.webp",
        ROOT / "nine-slice" / "panel" / "master.webp",
        (960, 640),
        True,
    ),
    (
        SOURCE_ROOT / "readout-master-source.webp",
        ROOT / "nine-slice" / "readout" / "master.webp",
        (960, 384),
        True,
    ),
    (
        SOURCE_ROOT / "reel-stage-source.webp",
        ROOT / "reel-stage" / "inner-bezel-depth-overlay.webp",
        (1280, 768),
        False,
    ),
    (
        SOURCE_ROOT / "cell-depth-overlay-source.webp",
        ROOT / "reel-stage" / "cell-depth-overlay.webp",
        (640, 512),
        False,
    ),
)


def normalize_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 2:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            normalized_alpha = 255 if alpha >= 250 else alpha
            if normalized_alpha < 96:
                luminance = round((red * 0.2126) + (green * 0.7152) + (blue * 0.0722))
                pixels[x, y] = (
                    luminance,
                    round(luminance * 0.96),
                    round(luminance * 0.9),
                    normalized_alpha,
                )
            else:
                pixels[x, y] = (red, green, blue, normalized_alpha)
    return rgba


def build(source: Path, target: Path, size: tuple[int, int], opaque_center: bool, replace: bool) -> None:
    if target.exists() and not replace:
        raise FileExistsError(f"refusing to overwrite existing runtime asset: {target}")
    with Image.open(source) as incoming:
        normalized = normalize_alpha(incoming)
        fitted = ImageOps.fit(
            normalized,
            size,
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        fitted = normalize_alpha(fitted)

    alpha = fitted.getchannel("A")
    width, height = fitted.size
    corner_alpha = tuple(
        alpha.getpixel(point)
        for point in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))
    )
    if max(corner_alpha) > 8:
        raise ValueError(f"{target.name}: corners must remain transparent, got {corner_alpha}")
    center_alpha = alpha.getpixel((width // 2, height // 2))
    if opaque_center and center_alpha < 248:
        raise ValueError(f"{target.name}: content field must remain opaque, got alpha {center_alpha}")
    if not opaque_center and center_alpha > 8:
        raise ValueError(f"{target.name}: reel opening must remain transparent, got alpha {center_alpha}")

    target.parent.mkdir(parents=True, exist_ok=True)
    fitted.save(target, "WEBP", lossless=True, method=6, exact=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--replace-generated",
        action="store_true",
        help="replace only the declared generated runtime outputs",
    )
    parser.add_argument(
        "--only",
        action="append",
        choices=tuple(target.stem for _, target, _, _ in TARGETS),
        help="build only a named runtime target; may be supplied more than once",
    )
    args = parser.parse_args()
    selected = set(args.only or ())
    for source, target, size, opaque_center in TARGETS:
        if selected and target.stem not in selected:
            continue
        build(source, target, size, opaque_center, args.replace_generated)
        print(f"built {target.relative_to(ROOT)} ({size[0]}x{size[1]})")


if __name__ == "__main__":
    main()
