"""Transactionally convert the BLACKSITE runtime raster tree from PNG to WebP.

The source PNGs remain the authoring masters in ``apps/blacksite/art``. This
tool touches only the deployable ``static/assets/blacksite`` tree. It renders
the complete replacement into a sibling staging directory, verifies every
image (including byte-identical alpha), and only then swaps the directories.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import uuid

sys.dont_write_bytecode = True

from PIL import Image, features


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROOT = REPO_ROOT / "apps" / "blacksite" / "static" / "assets" / "blacksite"
ASSET_MANIFEST = REPO_ROOT / "apps" / "blacksite" / "art" / "asset-manifest.json"
EXPECTED_PNG_COUNT = 353
EXPECTED_RUNTIME_FILE_COUNT = 354
RUNTIME_QUALITY = 90
STATIC_QUALITY = 92
WEBP_METHOD = 6
WEBP_ALPHA_QUALITY = 100


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="swap the validated WebP tree into place; without this flag only preflight is run",
    )
    parser.add_argument(
        "--refresh-manifest-only",
        action="store_true",
        help="refresh the tracked asset manifest after an already completed WebP swap",
    )
    return parser.parse_args()


def fail(message: str) -> None:
    raise RuntimeError(message)


def assert_production_root(root: Path) -> None:
    expected = DEFAULT_ROOT.resolve()
    if root != expected or root.name != "blacksite" or root.parent != expected.parent:
        fail(f"refusing to operate outside the exact BLACKSITE static root: {root}")


def assert_safe_sibling(path: Path, root: Path, prefix: str) -> None:
    resolved_parent = path.parent.resolve()
    if resolved_parent != root.parent or not path.name.startswith(prefix):
        fail(f"unsafe transactional sibling path: {path}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_runtime_sequence(path: Path, root: Path) -> bool:
    return path.relative_to(root).as_posix().startswith("runtime-rgba-v1/")


def assert_webp(path: Path, expected_size: tuple[int, int]) -> None:
    header = path.read_bytes()[:16]
    if len(header) < 16 or header[:4] != b"RIFF" or header[8:12] != b"WEBP":
        fail(f"not a WebP RIFF asset: {path}")
    if header[12:16] not in {b"VP8 ", b"VP8L", b"VP8X"}:
        fail(f"unsupported WebP first chunk {header[12:16]!r}: {path}")
    with Image.open(path) as image:
        image.load()
        if image.format != "WEBP" or image.size != expected_size:
            fail(f"WebP decode mismatch for {path}: {image.format} {image.size}")


def convert_one(source: Path, target: Path, root: Path) -> dict[str, object]:
    quality = RUNTIME_QUALITY if is_runtime_sequence(source, root) else STATIC_QUALITY
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        source_rgba = opened.convert("RGBA")
        expected_size = source_rgba.size
        source_alpha = source_rgba.getchannel("A").tobytes()
        source_rgba.save(
            target,
            "WEBP",
            quality=quality,
            method=WEBP_METHOD,
            alpha_quality=WEBP_ALPHA_QUALITY,
            exact=True,
        )
    assert_webp(target, expected_size)
    with Image.open(target) as opened:
        target_alpha = opened.convert("RGBA").getchannel("A").tobytes()
    if source_alpha != target_alpha:
        fail(f"alpha channel changed during conversion: {source}")
    return {
        "source": source.relative_to(root).as_posix(),
        "target": source.relative_to(root).with_suffix(".webp").as_posix(),
        "quality": quality,
        "pngBytes": source.stat().st_size,
        "webpBytes": target.stat().st_size,
        "webpSha256": sha256(target),
    }


def rewrite_runtime_manifest(source: Path, target: Path) -> None:
    text = source.read_text(encoding="utf-8")
    payload = json.loads(text)

    def rewrite(value: object) -> object:
        if isinstance(value, str):
            return value[:-4] + ".webp" if value.endswith(".png") else value
        if isinstance(value, list):
            return [rewrite(entry) for entry in value]
        if isinstance(value, dict):
            return {key: rewrite(entry) for key, entry in value.items()}
        return value

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(rewrite(payload), indent=2) + "\n", encoding="utf-8")


def package_tree_fact(root: Path, paths: list[Path] | None = None) -> dict[str, object]:
    files = sorted(paths if paths is not None else [path for path in root.rglob("*") if path.is_file()])
    digest = hashlib.sha256()
    for path in files:
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\n")
        digest.update(sha256(path).encode("ascii"))
        digest.update(b"\n")
    return {
        "files": len(files),
        "webps": sum(path.suffix.lower() == ".webp" for path in files),
        "bytes": sum(path.stat().st_size for path in files),
        "tree": digest.hexdigest(),
    }


def runtime_rgba_fact(root: Path) -> dict[str, object]:
    manifest_path = root / "animation_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    paths: list[str] = []
    for section_name in ("runtime_sequences", "standalone_fx"):
        for entry in manifest[section_name].values():
            paths.extend(entry["frames"])
    paths.extend(entry["rgba"] for entry in manifest["static_keyposes"].values())
    paths = sorted(paths)
    if len(paths) != 215 or len(set(paths)) != 215 or any(not path.endswith(".webp") for path in paths):
        fail("runtime animation manifest must declare exactly 215 unique WebP paths")
    digest = hashlib.sha256()
    total = 0
    for relative in paths:
        path = root / Path(relative)
        if not path.is_file():
            fail(f"runtime animation manifest references a missing WebP: {relative}")
        data = path.read_bytes()
        total += len(data)
        relative_bytes = relative.encode("utf-8")
        digest.update(str(len(relative_bytes)).encode("ascii"))
        digest.update(b"\0")
        digest.update(relative_bytes)
        digest.update(b"\0")
        digest.update(str(len(data)).encode("ascii"))
        digest.update(b"\0")
        digest.update(data)
    return {
        "webps": len(paths),
        "bytes": total,
        "tree": digest.hexdigest(),
        "manifestBytes": manifest_path.stat().st_size,
        "manifestSha256": sha256(manifest_path),
    }


def rename_count_field(record: dict[str, object]) -> None:
    if "runtimePngCount" not in record:
        return
    rewritten: dict[str, object] = {}
    for key, value in record.items():
        rewritten["runtimeWebpCount" if key == "runtimePngCount" else key] = value
    record.clear()
    record.update(rewritten)


def refresh_asset_manifest(root: Path) -> None:
    assert_production_root(root)
    if not ASSET_MANIFEST.is_file() or ASSET_MANIFEST.parent.resolve() != (
        REPO_ROOT / "apps" / "blacksite" / "art"
    ).resolve():
        fail(f"unexpected asset manifest path: {ASSET_MANIFEST}")
    manifest = json.loads(ASSET_MANIFEST.read_text(encoding="utf-8"))
    manifest["lifecycle"] = "V5_PRODUCTION_WEBP_INTEGRATION"
    manifest["symbolStateDelivery"] = (
        "dedicated 512x512 alpha WebP state packs; every symbol has base, win and dim, "
        "while ghost_wild and breach also have anticipation and triggered"
    )

    responsive = manifest["responsiveEnvironmentShellSet"]
    rename_count_field(responsive)
    responsive_files = [
        root / "environment" / "premium-machine-shell-portrait-v1.webp",
        root / "environment" / "premium-machine-shell-phone-v1.webp",
        root / "environment" / "premium-machine-shell-short-landscape-v1.webp",
    ]
    responsive_fact = package_tree_fact(root / "environment", responsive_files)
    responsive["runtimeWebpCount"] = responsive_fact["webps"]
    responsive["runtimeBytes"] = responsive_fact["bytes"]
    responsive["runtimeTreeSha256"] = responsive_fact["tree"]

    runtime_root_prefix = "apps/blacksite/static/assets/blacksite/"
    for asset in manifest["assets"]:
        rename_count_field(asset)
        for key in ("path", "runtimePath"):
            value = asset.get(key)
            if isinstance(value, str) and value.endswith(".png") and (
                key == "runtimePath" or value.startswith(runtime_root_prefix)
            ):
                asset[key] = value[:-4] + ".webp"
        format_name = asset.get("format")
        if isinstance(format_name, str):
            asset["format"] = format_name.replace("png", "webp")
        if asset.get("type") == "character-and-fx-png-sequence-package":
            asset["type"] = "character-and-fx-webp-sequence-package"

        path_value = asset["path"]
        absolute = REPO_ROOT / path_value
        if not absolute.exists():
            fail(f"asset manifest path is missing after WebP conversion: {path_value}")
        if absolute.is_file():
            asset["sha256"] = sha256(absolute)
            if "runtimeBytes" in asset:
                asset["runtimeBytes"] = absolute.stat().st_size
        else:
            if asset["id"] == "character.operative.runtime_rgba.v1":
                fact = runtime_rgba_fact(absolute)
                asset["runtimeWebpCount"] = fact["webps"]
                asset["runtimeFileCountIncludingManifest"] = fact["webps"] + 1
                asset["runtimeBytesIncludingManifest"] = fact["bytes"] + fact["manifestBytes"]
                asset["manifestSha256"] = fact["manifestSha256"]
                asset["runtimeTreeSha256"] = fact["tree"]
                asset["runtimeTreeAlgorithm"] = (
                    "SHA-256 of sorted path UTF-8 byte length, NUL, relative path, NUL, "
                    "file byte length, NUL and raw WebP bytes"
                )
                asset["source"] = (
                    "User-supplied generated BLACKSITE animation package "
                    "Blacksite_Breach_ALLES_WAS_DU_BRAUCHST_v1.zip; manifest-declared alpha PNG "
                    "sources were validated, then deterministically converted to alpha-preserving "
                    "WebP runtime frames"
                )
            else:
                fact = package_tree_fact(absolute)
                asset["runtimeWebpCount"] = fact["webps"]
                asset["runtimeBytes"] = fact["bytes"]
                asset["runtimeTreeSha256"] = fact["tree"]

        files = asset.get("files")
        if isinstance(files, list):
            for file_record in files:
                name = file_record["name"]
                if name.endswith(".png"):
                    name = name[:-4] + ".webp"
                    file_record["name"] = name
                runtime_file = absolute / name
                if not runtime_file.is_file():
                    fail(f"nested manifest file is missing: {runtime_file}")
                file_record["bytes"] = runtime_file.stat().st_size
                file_record["sha256"] = sha256(runtime_file)

    manifest["uiAssetDelivery"]["mode"] = (
        "dedicated alpha WebP control, panel, symbol-state and payline packs with live DOM text "
        "and authoritative interaction state"
    )
    encoded = (json.dumps(manifest, indent=2) + "\n").encode("utf-8")
    json.loads(encoded)
    temporary = ASSET_MANIFEST.with_name(f".{ASSET_MANIFEST.name}.webp-{uuid.uuid4().hex}.tmp")
    if temporary.parent.resolve() != ASSET_MANIFEST.parent.resolve():
        fail(f"unsafe asset-manifest temporary path: {temporary}")
    temporary.write_bytes(encoded)
    os.replace(temporary, ASSET_MANIFEST)


def verify_source(root: Path) -> list[Path]:
    if not root.is_dir():
        fail(f"runtime root is not a directory: {root}")
    if any(path.is_symlink() for path in root.rglob("*")):
        fail("runtime tree must not contain symlinks")
    files = sorted(path for path in root.rglob("*") if path.is_file())
    pngs = [path for path in files if path.suffix.lower() == ".png"]
    if len(files) != EXPECTED_RUNTIME_FILE_COUNT or len(pngs) != EXPECTED_PNG_COUNT:
        fail(
            f"expected {EXPECTED_PNG_COUNT} PNGs and {EXPECTED_RUNTIME_FILE_COUNT} total files; "
            f"received {len(pngs)} PNGs and {len(files)} files"
        )
    unexpected = [path for path in files if path.suffix.lower() not in {".png", ".json"}]
    if unexpected:
        fail(f"unexpected runtime file type: {unexpected[0]}")
    return pngs


def verify_stage(stage: Path, expected_alpha_sources: dict[str, Path]) -> None:
    files = sorted(path for path in stage.rglob("*") if path.is_file())
    webps = [path for path in files if path.suffix.lower() == ".webp"]
    if len(files) != EXPECTED_RUNTIME_FILE_COUNT or len(webps) != EXPECTED_PNG_COUNT:
        fail(
            f"staged tree must contain {EXPECTED_PNG_COUNT} WebPs and one manifest; "
            f"received {len(webps)} WebPs and {len(files)} files"
        )
    if any(path.suffix.lower() == ".png" for path in files):
        fail("staged runtime tree still contains PNG files")
    for target in webps:
        relative = target.relative_to(stage).as_posix()
        source = expected_alpha_sources.get(relative)
        if source is None:
            fail(f"unexpected staged WebP: {relative}")
        with Image.open(source) as original, Image.open(target) as converted:
            original_rgba = original.convert("RGBA")
            converted_rgba = converted.convert("RGBA")
            if original_rgba.size != converted_rgba.size:
                fail(f"staged geometry mismatch: {relative}")
            if original_rgba.getchannel("A").tobytes() != converted_rgba.getchannel("A").tobytes():
                fail(f"staged alpha mismatch: {relative}")


def swap_transactionally(root: Path, stage: Path) -> None:
    backup = root.with_name(f".{root.name}-png-backup-{uuid.uuid4().hex}")
    assert_production_root(root)
    assert_safe_sibling(stage, root, ".blacksite-webp-stage-")
    assert_safe_sibling(backup, root, ".blacksite-png-backup-")
    os.replace(root, backup)
    try:
        os.replace(stage, root)
    except BaseException:
        os.replace(backup, root)
        raise
    try:
        assert_safe_sibling(backup, root, ".blacksite-png-backup-")
        shutil.rmtree(backup)
    except BaseException:
        # The production tree is already valid. Keep the recoverable backup and
        # fail loudly rather than touching the new tree.
        raise RuntimeError(f"converted tree installed but backup cleanup failed: {backup}")


def main() -> None:
    args = parse_args()
    root = DEFAULT_ROOT.resolve()
    assert_production_root(root)
    if not features.check("webp"):
        fail("Pillow was built without WebP support")
    if args.refresh_manifest_only:
        refresh_asset_manifest(root)
        print(json.dumps({"status": "MANIFEST_REFRESH_PASS", "root": str(root)}, indent=2))
        return
    pngs = verify_source(root)
    if not args.apply:
        print(
            json.dumps(
                {
                    "status": "PREFLIGHT_PASS",
                    "root": str(root),
                    "pngCount": len(pngs),
                    "runtimeQuality": RUNTIME_QUALITY,
                    "staticQuality": STATIC_QUALITY,
                    "method": WEBP_METHOD,
                    "alphaQuality": WEBP_ALPHA_QUALITY,
                    "exact": True,
                },
                indent=2,
            )
        )
        return

    stage = root.with_name(f".{root.name}-webp-stage-{uuid.uuid4().hex}")
    assert_safe_sibling(stage, root, ".blacksite-webp-stage-")
    stage.mkdir(parents=False)
    records: list[dict[str, object]] = []
    alpha_sources: dict[str, Path] = {}
    try:
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(root)
            if path.suffix.lower() == ".png":
                target = stage / relative.with_suffix(".webp")
                records.append(convert_one(path, target, root))
                alpha_sources[relative.with_suffix(".webp").as_posix()] = path
            else:
                target = stage / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                if relative.as_posix() == "runtime-rgba-v1/animation_manifest.json":
                    rewrite_runtime_manifest(path, target)
                else:
                    shutil.copy2(path, target)
        verify_stage(stage, alpha_sources)
        png_bytes = sum(int(record["pngBytes"]) for record in records)
        webp_bytes = sum(int(record["webpBytes"]) for record in records)
        swap_transactionally(root, stage)
        refresh_asset_manifest(root)
        print(
            json.dumps(
                {
                    "status": "PASS",
                    "root": str(root),
                    "files": len(records) + 1,
                    "webpCount": len(records),
                    "pngBytes": png_bytes,
                    "webpBytes": webp_bytes,
                    "savedBytes": png_bytes - webp_bytes,
                    "savedPercent": round((1 - webp_bytes / png_bytes) * 100, 4),
                },
                indent=2,
            )
        )
    finally:
        if stage.exists():
            assert_safe_sibling(stage, root, ".blacksite-webp-stage-")
            shutil.rmtree(stage)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"BLACKSITE WebP conversion: FAIL: {error}", file=sys.stderr)
        raise SystemExit(1) from error
