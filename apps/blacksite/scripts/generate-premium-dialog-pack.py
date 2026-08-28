"""Build the BLACKSITE premium dialog-shell raster pack.

The approved ``modal-frame.png`` is an Imagegen-authored RGBA frame.  Runtime
layouts have several very different aspect ratios, so stretching that complete
image with CSS visibly deforms its bevels and corners.  This generator crops the
transparent source bounds once, then performs a real nine-slice composition:

* corners are copied pixel-for-pixel;
* horizontal rails are scaled horizontally only;
* vertical rails are scaled vertically only;
* only the dark centre surface is scaled in both axes.

Every output is a text-free, production-size 2x PNG.  The contact sheet is a QA
artifact and is deliberately kept outside the runtime asset tree.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


APP_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_ROOT.parents[1]
SOURCE = APP_ROOT / "static/assets/blacksite/ui/premium-panels-v1/modal-frame.png"
OUTPUT_ROOT = APP_ROOT / "static/assets/blacksite/ui/premium-panels-v1"
CONTACT_SHEET = REPO_ROOT / "artifacts/blacksite-dialog-shells-contact-sheet.png"

# The alpha bounds of the Imagegen source are padded slightly so its soft outer
# shadow remains intact.  These fixed nine-slice rails include the complete
# bevel, corner hardware and inner gold keyline.
ALPHA_PADDING = 12
SLICE_LEFT = 154
SLICE_TOP = 128
SLICE_RIGHT = 154
SLICE_BOTTOM = 128


@dataclass(frozen=True)
class DialogSpec:
    filename: str
    size: tuple[int, int]
    # A restrained colour wash lives exclusively beneath the inner chrome.  It
    # differentiates context without baking labels or other dynamic content.
    interior_tint: tuple[int, int, int, int]


DIALOGS = (
    DialogSpec("dialog-mode.png", (1640, 640), (22, 37, 40, 22)),
    DialogSpec("dialog-menu.png", (1040, 480), (38, 31, 20, 18)),
    DialogSpec("dialog-confirmation.png", (1040, 680), (83, 21, 15, 34)),
    DialogSpec("dialog-rules.png", (1880, 1640), (12, 37, 43, 22)),
    DialogSpec("dialog-auto.png", (1080, 760), (23, 42, 43, 24)),
    DialogSpec("dialog-settings.png", (1040, 520), (27, 34, 39, 20)),
    DialogSpec("dialog-runtime-error.png", (880, 520), (104, 13, 10, 52)),
)


def alpha_trim_with_padding(image: Image.Image, padding: int) -> Image.Image:
    """Trim empty source canvas while retaining a transparent safety margin."""

    alpha_bounds = image.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError(f"Source has no visible alpha content: {SOURCE}")
    left, top, right, bottom = alpha_bounds
    bounds = (
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(image.height, bottom + padding),
    )
    return image.crop(bounds)


def resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    if image.size == size:
        return image.copy()
    return image.resize(size, Image.Resampling.LANCZOS)


def nine_slice(source: Image.Image, output_size: tuple[int, int]) -> Image.Image:
    """Compose ``source`` at ``output_size`` without deforming its corners."""

    source_width, source_height = source.size
    output_width, output_height = output_size
    left, top, right, bottom = SLICE_LEFT, SLICE_TOP, SLICE_RIGHT, SLICE_BOTTOM
    if source_width <= left + right or source_height <= top + bottom:
        raise ValueError("Nine-slice guides exceed the trimmed source bounds")
    if output_width <= left + right or output_height <= top + bottom:
        raise ValueError(f"Output {output_size} is too small for the nine-slice rails")

    source_x = (0, left, source_width - right, source_width)
    source_y = (0, top, source_height - bottom, source_height)
    output_x = (0, left, output_width - right, output_width)
    output_y = (0, top, output_height - bottom, output_height)

    result = Image.new("RGBA", output_size, (0, 0, 0, 0))
    for row in range(3):
        for column in range(3):
            source_box = (
                source_x[column],
                source_y[row],
                source_x[column + 1],
                source_y[row + 1],
            )
            destination_box = (
                output_x[column],
                output_y[row],
                output_x[column + 1],
                output_y[row + 1],
            )
            destination_size = (
                destination_box[2] - destination_box[0],
                destination_box[3] - destination_box[1],
            )
            patch = source.crop(source_box)
            # Corners remain exact.  Edges change on one axis only; the centre
            # is the sole patch permitted to change on both axes.
            if row == 1 or column == 1:
                patch = resize(patch, destination_size)
            result.alpha_composite(patch, (destination_box[0], destination_box[1]))
    return result


def tint_interior(image: Image.Image, tint: tuple[int, int, int, int]) -> Image.Image:
    """Apply a subtle context wash underneath, never over, the physical rails."""

    if tint[3] <= 0:
        return image
    width, height = image.size
    interior = Image.new(
        "RGBA",
        (width - SLICE_LEFT - SLICE_RIGHT, height - SLICE_TOP - SLICE_BOTTOM),
        tint,
    )
    output = image.copy()
    output.alpha_composite(interior, (SLICE_LEFT, SLICE_TOP))
    return output


def checkerboard(size: tuple[int, int], unit: int = 18) -> Image.Image:
    board = Image.new("RGBA", size, (29, 31, 32, 255))
    draw = ImageDraw.Draw(board)
    for y in range(0, size[1], unit):
        for x in range(0, size[0], unit):
            if (x // unit + y // unit) % 2:
                draw.rectangle((x, y, x + unit - 1, y + unit - 1), fill=(44, 47, 48, 255))
    return board


def build_contact_sheet(outputs: list[tuple[DialogSpec, Image.Image]]) -> Image.Image:
    sheet_width, sheet_height = 1800, 1840
    margin, header_height, gutter = 32, 70, 24
    columns, rows = 2, 4
    cell_width = (sheet_width - margin * 2 - gutter) // columns
    cell_height = (sheet_height - margin * 2 - header_height - gutter * (rows - 1)) // rows
    sheet = checkerboard((sheet_width, sheet_height), unit=24)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.rectangle((0, 0, sheet_width, header_height), fill=(8, 12, 13, 255))
    draw.text((margin, 22), "BLACKSITE // BREACH - 9-SLICE DIALOG SHELLS (2X RUNTIME RASTERS)", fill=(232, 197, 126, 255), font=font)

    for index, (spec, image) in enumerate(outputs):
        column = index % columns
        row = index // columns
        x = margin + column * (cell_width + gutter)
        y = header_height + margin + row * (cell_height + gutter)
        label_height = 28
        draw.rectangle((x, y, x + cell_width, y + cell_height), fill=(5, 8, 9, 205), outline=(101, 84, 54, 255), width=1)
        draw.text((x + 10, y + 9), f"{spec.filename}  |  {spec.size[0]} x {spec.size[1]} RGBA", fill=(220, 225, 218, 255), font=font)
        available = (cell_width - 20, cell_height - label_height - 18)
        scale = min(available[0] / image.width, available[1] / image.height)
        preview_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        preview = resize(image, preview_size)
        preview_x = x + (cell_width - preview.width) // 2
        preview_y = y + label_height + (cell_height - label_height - preview.height) // 2
        sheet.alpha_composite(preview, (preview_x, preview_y))
    return sheet


def verify_corner_integrity(source: Image.Image, output: Image.Image) -> None:
    width, height = output.size
    comparisons = (
        ((0, 0, SLICE_LEFT, SLICE_TOP), (0, 0, SLICE_LEFT, SLICE_TOP)),
        (
            (source.width - SLICE_RIGHT, 0, source.width, SLICE_TOP),
            (width - SLICE_RIGHT, 0, width, SLICE_TOP),
        ),
        (
            (0, source.height - SLICE_BOTTOM, SLICE_LEFT, source.height),
            (0, height - SLICE_BOTTOM, SLICE_LEFT, height),
        ),
        (
            (source.width - SLICE_RIGHT, source.height - SLICE_BOTTOM, source.width, source.height),
            (width - SLICE_RIGHT, height - SLICE_BOTTOM, width, height),
        ),
    )
    for source_box, output_box in comparisons:
        if source.crop(source_box).tobytes() != output.crop(output_box).tobytes():
            raise AssertionError("Nine-slice corner integrity check failed")


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Missing Imagegen dialog source: {SOURCE}")
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)

    source = alpha_trim_with_padding(Image.open(SOURCE).convert("RGBA"), ALPHA_PADDING)
    outputs: list[tuple[DialogSpec, Image.Image]] = []
    for spec in DIALOGS:
        image = tint_interior(nine_slice(source, spec.size), spec.interior_tint)
        verify_corner_integrity(source, image)
        if image.mode != "RGBA" or image.size != spec.size or image.getchannel("A").getextrema() != (0, 255):
            raise AssertionError(f"Invalid dialog raster: {spec.filename}")
        destination = OUTPUT_ROOT / spec.filename
        image.save(destination, "PNG", optimize=True, compress_level=9)
        outputs.append((spec, image))
        print(f"{destination.relative_to(APP_ROOT)}: {image.width}x{image.height} RGBA")

    contact_sheet = build_contact_sheet(outputs)
    contact_sheet.save(CONTACT_SHEET, "PNG", optimize=True, compress_level=9)
    print(f"{CONTACT_SHEET.relative_to(REPO_ROOT)}: {contact_sheet.width}x{contact_sheet.height} RGBA")


if __name__ == "__main__":
    main()
