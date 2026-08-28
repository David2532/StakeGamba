#!/usr/bin/env python3
"""Validate BLACKSITE V22 raster geometry, alpha, hashes, bytes, color guard, and closure."""

from __future__ import annotations

import colorsys
import hashlib
import json
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "manifest.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def visible_police_light_pixels(image: Image.Image) -> dict[str, int]:
    counts = {"red": 0, "cyan": 0, "blue": 0, "magenta": 0}
    pixels = image.convert("RGBA").load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 128:
                continue
            maximum = max(red, green, blue)
            minimum = min(red, green, blue)
            saturation = 0 if maximum == 0 else (maximum - minimum) / maximum
            value = maximum / 255
            if saturation < 0.72 or value < 0.55:
                continue
            hue = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)[0] * 360
            if hue < 12 or hue >= 348:
                counts["red"] += 1
            elif 160 <= hue < 200:
                counts["cyan"] += 1
            elif 200 <= hue < 260:
                counts["blue"] += 1
            elif 260 <= hue < 345:
                counts["magenta"] += 1
    return counts


def validate_opening_contract(image: Image.Image, entry: dict) -> dict:
    contract = entry["openingContract"]
    insets = entry["contentInsets"]
    width, height = image.size
    safe_left = insets["left"]
    safe_top = insets["top"]
    safe_right = width - insets["right"]
    safe_bottom = height - insets["bottom"]
    assert safe_left < safe_right and safe_top < safe_bottom, f"{entry['path']}: empty safe opening"

    alpha = image.getchannel("A")
    safe_alpha_maximum = alpha.crop((safe_left, safe_top, safe_right, safe_bottom)).getextrema()[1]
    assert safe_alpha_maximum <= contract["maximumSafeOpeningAlpha"], (
        f"{entry['path']}: safe opening contains authored pixels"
    )
    safe_fraction = ((safe_right - safe_left) * (safe_bottom - safe_top)) / (width * height)
    assert safe_fraction >= contract["minimumSafeOpeningCanvasFraction"], (
        f"{entry['path']}: safe opening is too small"
    )

    maximum_alpha = contract["maximumSafeOpeningAlpha"]
    pixels = alpha.load()
    seed = (width // 2, height // 2)
    assert pixels[seed] <= maximum_alpha, f"{entry['path']}: transparent opening seed is blocked"
    visited = bytearray(width * height)
    queue = deque([seed])
    visited[(seed[1] * width) + seed[0]] = 1
    count = 0
    left = right = seed[0]
    top = bottom = seed[1]
    while queue:
        x, y = queue.popleft()
        count += 1
        left = min(left, x)
        right = max(right, x)
        top = min(top, y)
        bottom = max(bottom, y)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= next_x < width and 0 <= next_y < height):
                continue
            offset = (next_y * width) + next_x
            if visited[offset] or pixels[next_x, next_y] > maximum_alpha:
                continue
            visited[offset] = 1
            queue.append((next_x, next_y))

    fraction = count / (width * height)
    assert fraction >= contract["minimumConnectedTransparentFraction"], (
        f"{entry['path']}: connected transparent opening is too small"
    )
    enclosed = left > 0 and top > 0 and right < width - 1 and bottom < height - 1
    if contract["mustBeEnclosed"]:
        assert enclosed, f"{entry['path']}: center opening leaks into the transparent exterior"

    return {
        "mode": image.mode,
        "safeOpeningAlphaMaximum": safe_alpha_maximum,
        "connectedTransparentPixels": count,
        "connectedTransparentFraction": fraction,
        "connectedTransparentBounds": {
            "left": left,
            "top": top,
            "right": right,
            "bottom": bottom,
        },
        "enclosed": enclosed,
    }


def validate_webp(entry: dict, runtime: bool) -> tuple[int, dict[str, int], dict | None]:
    path = ROOT / entry["path"]
    raw = path.read_bytes()
    assert len(raw) == entry["bytes"], f"{entry['path']}: byte count drift"
    assert sha256(path) == entry["sha256"], f"{entry['path']}: SHA-256 drift"
    with Image.open(path) as incoming:
        assert incoming.format == "WEBP", f"{entry['path']}: expected WebP"
        assert incoming.size == (entry["width"], entry["height"]), f"{entry['path']}: geometry drift"
        assert "A" in incoming.getbands(), f"{entry['path']}: alpha channel missing"
        image = incoming.convert("RGBA")

    alpha = image.getchannel("A")
    assert alpha.getextrema()[0] == 0, f"{entry['path']}: transparent pixels missing"
    if not runtime:
        return len(raw), {"red": 0, "cyan": 0, "blue": 0, "magenta": 0}, None

    width, height = image.size
    corner_alpha = (
        alpha.getpixel((0, 0)),
        alpha.getpixel((width - 1, 0)),
        alpha.getpixel((0, height - 1)),
        alpha.getpixel((width - 1, height - 1)),
    )
    assert max(corner_alpha) <= 8, f"{entry['path']}: transparent corner contract failed"
    center_alpha = alpha.getpixel((width // 2, height // 2))
    if entry["centerMode"] == "opaque-empty":
        assert center_alpha >= 248, f"{entry['path']}: opaque content field contract failed"
    else:
        assert entry["centerMode"] == "transparent-opening"
        assert center_alpha <= 8, f"{entry['path']}: transparent reel opening contract failed"

    invisible_rgb = 0
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            red, green, blue, pixel_alpha = pixels[x, y]
            if pixel_alpha == 0 and (red != 0 or green != 0 or blue != 0):
                invisible_rgb += 1
    assert invisible_rgb == 0, f"{entry['path']}: invisible RGB fringe data remains"
    opening_metrics = validate_opening_contract(image, entry) if "openingContract" in entry else None
    return len(raw), visible_police_light_pixels(image), opening_metrics


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert manifest["schema"] == "blacksite-ui-kit-v22"
    assert manifest["version"] == 22
    assert manifest["devOnly"] is True
    assert manifest["integrationStatus"] == "asset-only-not-wired"
    assert set(manifest["stateDerivation"]["recipes"]) == set(manifest["states"])
    assert manifest["stateDerivation"]["recipes"]["danger"]["redOverlayOpacity"] == 0.0

    runtime_bytes = 0
    aggregate_spill = {"red": 0, "cyan": 0, "blue": 0, "magenta": 0}
    cell_depth_metrics = None
    for name, entry in manifest["masters"].items():
        if "sliceInsets" in entry:
            slices = entry["sliceInsets"]
            assert slices["left"] + slices["right"] < entry["width"], f"{name}: horizontal slice center missing"
            assert slices["top"] + slices["bottom"] < entry["height"], f"{name}: vertical slice center missing"
        byte_count, spill, opening_metrics = validate_webp(entry, runtime=True)
        runtime_bytes += byte_count
        for color, count in spill.items():
            aggregate_spill[color] += count
        if name == "reelCellDepthOverlay":
            cell_depth_metrics = opening_metrics

    authoring_bytes = 0
    for entry in manifest["authoringSources"]:
        byte_count, _, _ = validate_webp(entry, runtime=False)
        authoring_bytes += byte_count

    budgets = manifest["budgets"]
    assert len(manifest["masters"]) == budgets["runtimeWebpCount"]
    assert runtime_bytes == budgets["runtimeBytes"]
    assert runtime_bytes <= budgets["runtimeHardMaxBytes"]
    assert len(manifest["authoringSources"]) == budgets["authoringWebpCount"]
    assert authoring_bytes == budgets["authoringBytes"]
    assert authoring_bytes <= budgets["authoringHardMaxBytes"]
    assert runtime_bytes + authoring_bytes == budgets["totalRasterBytes"]
    assert budgets["totalRasterBytes"] <= budgets["totalRasterHardMaxBytes"]
    assert budgets["pass"] is True
    assert aggregate_spill == manifest["qa"]["visiblePoliceLightPixels"]
    assert all(value <= manifest["qa"]["visiblePoliceLightPixelThreshold"] for value in aggregate_spill.values())
    assert cell_depth_metrics is not None
    declared_cell_metrics = manifest["qa"]["cellDepthOverlay"]
    assert cell_depth_metrics["mode"] == "RGBA"
    assert cell_depth_metrics["safeOpeningAlphaMaximum"] == declared_cell_metrics["safeOpeningAlphaMaximum"]
    assert cell_depth_metrics["connectedTransparentPixels"] == declared_cell_metrics["connectedTransparentPixels"]
    assert abs(
        cell_depth_metrics["connectedTransparentFraction"]
        - declared_cell_metrics["connectedTransparentFraction"]
    ) < 1e-12
    assert cell_depth_metrics["connectedTransparentBounds"] == declared_cell_metrics["connectedTransparentBounds"]
    assert cell_depth_metrics["enclosed"] == declared_cell_metrics["enclosed"]

    declared = {
        *(entry["path"] for entry in manifest["masters"].values()),
        *(entry["path"] for entry in manifest["authoringSources"]),
        *manifest["metadataFiles"],
    }
    actual = {
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob("*")
        if path.is_file()
    }
    assert actual == declared, f"package closure drift: missing={sorted(declared - actual)}, extra={sorted(actual - declared)}"
    assert not any(path.lower().endswith((".png", ".svg")) for path in actual)

    print(json.dumps({
        "status": "PASS",
        "runtimeWebps": len(manifest["masters"]),
        "runtimeBytes": runtime_bytes,
        "authoringWebps": len(manifest["authoringSources"]),
        "authoringBytes": authoring_bytes,
        "visiblePoliceLightPixels": aggregate_spill,
        "files": len(actual),
    }, indent=2))


if __name__ == "__main__":
    main()
