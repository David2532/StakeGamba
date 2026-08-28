#!/usr/bin/env python3
"""Build the deterministic BLACKSITE // BREACH V28 audio bank.

The builder uses only the archived CC0 Mechanical Sounds recordings and
deterministic authored synthesis.  It never copies an unmodified library file
into the runtime tree.  Source masters are 48 kHz / 24-bit mono PCM WAV;
browser runtime derivatives are compact 24 kHz / 16-bit mono PCM WAV.
"""

from __future__ import annotations

import hashlib
import json
import math
import platform
import shutil
import struct
import sys
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np


APP_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = APP_ROOT / "art/audio/sources/2026-08-21-oga-mechanical-cc0"
MASTER_ROOT = APP_ROOT / "art/v28/audio/masters"
ART_ROOT = APP_ROOT / "art/v28/audio"
RUNTIME_ROOT = APP_ROOT / "static/assets/blacksite/v28/audio"
MASTER_RATE = 48_000
RUNTIME_RATE = 24_000
MASTER_PEAK = 10 ** (-3.2 / 20)  # conservative headroom under the -1 dBTP ceiling
RUNTIME_BUDGET = 8 * 1024 * 1024
CRITICAL_BUDGET = 1_500 * 1024
PINNED_PYTHON = "3.12.13"
PINNED_NUMPY = "2.3.5"
RUNTIME_LOOP_SLOPE_MAX = 1 / 32_768
RUNTIME_FADE_ENDPOINT_MAX = 1 / 32_768
BUILDER_RELATIVE_PATH = "apps/blacksite/scripts/build-blacksite-v28-audio.py"
PROOF_RELATIVE_PATH = "apps/blacksite/art/v28/audio/DETERMINISTIC_REBUILD_PROOF.json"
RUNTIME_MANIFEST_RELATIVE_PATH = "apps/blacksite/static/assets/blacksite/v28/audio/audio-manifest.json"
PRODUCTION_MANIFEST_RELATIVE_PATH = "apps/blacksite/art/v28/audio/audio-production-manifest.json"

SOURCE_FILES = (
    "clank1.wav",
    "lightclunk1.wav",
    "lightclunk2.wav",
    "mechanical1.wav",
    "mechanical2.wav",
    "rattle1.wav",
    "squeakyclick1.wav",
    "squeakyclick2.wav",
)


@dataclass(frozen=True)
class Cue:
    cue_id: str
    bus: str
    variants: int = 1
    bank: str = "extended"
    priority: int = 50
    duration: float = 0.25
    loop: bool = False
    pan: float = 0.0
    protected: bool = False
    duck: str | None = None


def cue(cue_id: str, bus: str, variants: int = 1, bank: str = "extended", priority: int = 50,
        duration: float = 0.25, loop: bool = False, pan: float = 0.0,
        protected: bool = False, duck: str | None = None) -> Cue:
    return Cue(cue_id, bus, variants, bank, priority, duration, loop, pan, protected, duck)


CUES = (
    cue("ui.hover", "UI", 2, "critical", 15, .075),
    cue("ui.press", "UI", 3, "critical", 40, .11),
    cue("ui.confirm", "UI", 2, "critical", 55, .16),
    cue("ui.cancel", "UI", 2, "critical", 45, .12),
    cue("ui.toggle.on", "UI", 1, "critical", 50, .18),
    cue("ui.toggle.off", "UI", 1, "critical", 50, .16),
    cue("ui.modal.open", "UI", 1, "critical", 45, .19),
    cue("ui.modal.close", "UI", 1, "critical", 45, .14),
    cue("ui.error", "UI", 2, "critical", 100, .24, protected=True),
    cue("ui.deny", "UI", 2, "critical", 98, .18, protected=True),
    cue("spin.press", "UI", 2, "critical", 45, .11),
    cue("spin.confirmed", "Reels", 4, "critical", 65, .27),
    cue("reels.motor.loop", "Reels", 1, "critical", 50, 1.5, loop=True),
    cue("reels.turbo.attack", "Reels", 3, "critical", 65, .17),
    cue("reel.stop.1", "Reels", 4, "critical", 70, .16, pan=-.8),
    cue("reel.stop.2", "Reels", 4, "critical", 70, .16, pan=-.4),
    cue("reel.stop.3", "Reels", 4, "critical", 70, .16, pan=0),
    cue("reel.stop.4", "Reels", 4, "critical", 70, .16, pan=.4),
    cue("reel.stop.5", "Reels", 4, "critical", 72, .19, pan=.8),
    cue("spin.complete", "Reels", 2, "critical", 55, .18),
    cue("symbol.land.regular", "Reels", 5, "critical", 35, .16),
    cue("symbol.land.high", "Reels", 4, "critical", 62, .24),
    cue("symbol.land.ghost_wild", "Reels", 3, "critical", 86, .34),
    cue("breach.land.1", "Reels", 2, "critical", 78, .28),
    cue("breach.land.2", "Reels", 2, "critical", 84, .38),
    cue("breach.trigger", "Reels", 1, "critical", 100, .85, protected=True, duck="vault"),
    cue("anticipation.confirmed", "Reels", 1, "base", 75, .9, loop=True),
    cue("anticipation.release", "Reels", 1, "base", 58, .26),
    cue("mode.deep_access", "Reels", 1, "base", 65, .35),
    cue("blackout.direct.prep", "Reels", 1, "blackout", 62, .4),
    cue("blackout.enter", "Wins", 2, "blackout", 96, .95, protected=True, duck="vault"),
    cue("feature.target.confirm", "UI", 3, "blackout", 72, .28),
    cue("feature.spin.count", "UI", 2, "blackout", 45, .12),
    cue("feature.expand.attack", "Reels", 1, "blackout", 82, .42),
    cue("feature.expand.reel", "Reels", 4, "blackout", 74, .32),
    cue("feature.expand.settle", "Reels", 1, "blackout", 68, .27),
    cue("feature.summary.open", "Wins", 2, "blackout", 88, .9, duck="win"),
    cue("feature.summary.close", "UI", 1, "blackout", 45, .2),
    cue("win.micro", "Wins", 3, "critical", 40, .15),
    cue("win.small", "Wins", 2, "critical", 58, .3),
    cue("win.medium", "Wins", 2, "extended", 72, .48),
    cue("win.big", "Wins", 2, "extended", 88, .9, duck="win"),
    cue("win.top", "Wins", 2, "extended", 94, 1.25, protected=True, duck="win"),
    cue("win.rollup.loop", "Wins", 1, "extended", 68, 1.0, loop=True),
    cue("win.rollup.end", "Wins", 2, "extended", 86, .34),
    cue("win.max", "Wins", 1, "extended", 100, 1.8, protected=True, duck="win"),
    cue("round.loss", "Reels", 2, "critical", 42, .22),
    cue("round.complete", "Wins", 1, "critical", 50, .16),
    cue("ambience.base", "Ambience", 1, "critical", 10, 3.0, loop=True),
    cue("music.base", "Music", 1, "base", 10, 3.0, loop=True),
    cue("ambience.tension", "Ambience", 1, "base", 45, 1.5, loop=True),
    cue("ambience.blackout", "Ambience", 1, "blackout", 35, 3.0, loop=True),
    cue("music.blackout", "Music", 1, "blackout", 35, 3.0, loop=True),
    cue("vault.hold", "Reels", 2, "vault", 75, .42, duck="vault"),
    cue("vault.focus", "Reels", 1, "vault", 78, .55, duck="vault"),
    cue("vault.lock.1", "Reels", 1, "vault", 82, .28, pan=-.75, duck="vault"),
    cue("vault.lock.2", "Reels", 1, "vault", 82, .3, pan=-.45, duck="vault"),
    cue("vault.lock.3", "Reels", 1, "vault", 82, .32, pan=-.15, duck="vault"),
    cue("vault.lock.4", "Reels", 1, "vault", 82, .34, pan=.15, duck="vault"),
    cue("vault.lock.5", "Reels", 1, "vault", 82, .36, pan=.45, duck="vault"),
    cue("vault.lock.6", "Reels", 1, "vault", 84, .4, pan=.75, duck="vault"),
    cue("vault.wheel", "Reels", 1, "vault", 86, 1.2, duck="vault"),
    cue("vault.pressure", "Reels", 1, "vault", 84, .8, duck="vault"),
    cue("vault.bolts", "Reels", 1, "vault", 88, .75, duck="vault"),
    cue("vault.door", "Reels", 1, "vault", 98, 1.5, protected=True, duck="vault"),
    cue("vault.door.impact", "Reels", 1, "vault", 100, .65, protected=True, duck="vault"),
    cue("vault.gold", "Wins", 1, "vault", 98, 1.2, protected=True, duck="vault"),
    cue("vault.camera", "Ambience", 1, "vault", 72, .8, duck="vault"),
    cue("vault.handoff", "Wins", 1, "vault", 100, 1.35, protected=True, duck="vault"),
    cue("operative.gear", "Voice", 4, "base", 20, .28),
    cue("operative.spin", "Voice", 3, "critical", 45, .25, duck="voice"),
    cue("operative.anticipation", "Voice", 2, "base", 55, .38, duck="voice"),
    cue("operative.loss", "Voice", 3, "extended", 35, .28),
    cue("operative.loss_streak", "Voice", 2, "extended", 38, .32),
    cue("operative.win", "Voice", 4, "extended", 55, .32, duck="voice"),
    cue("operative.big_win", "Voice", 3, "extended", 78, .48, duck="voice"),
    cue("operative.bonus", "Voice", 3, "vault", 82, .5, duck="voice"),
    cue("operative.rage", "Voice", 2, "extended", 60, .45, duck="voice"),
    cue("operative.recover", "Voice", 1, "critical", 25, .3),
)


def stable_u32(value: str) -> int:
    return int.from_bytes(hashlib.sha256(value.encode("utf-8")).digest()[:4], "big")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_pcm16_mono(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as source:
        if source.getnchannels() != 1 or source.getsampwidth() != 2:
            raise ValueError(f"unsupported source PCM shape: {path}")
        rate = source.getframerate()
        data = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(np.float64)
    return data / 32768.0, rate


def resample(signal: np.ndarray, source_rate: int, target_rate: int) -> np.ndarray:
    if source_rate == target_rate:
        return signal.copy()
    size = max(1, round(len(signal) * target_rate / source_rate))
    source_axis = np.arange(len(signal), dtype=np.float64)
    target_axis = np.linspace(0, max(0, len(signal) - 1), size, endpoint=True)
    return np.interp(target_axis, source_axis, signal)


def fit(signal: np.ndarray, length: int) -> np.ndarray:
    if len(signal) >= length:
        return signal[:length].copy()
    output = np.zeros(length, dtype=np.float64)
    output[:len(signal)] = signal
    return output


def lowpass(signal: np.ndarray, width: int) -> np.ndarray:
    width = max(1, width)
    if width == 1:
        return signal.copy()
    kernel = np.ones(width, dtype=np.float64) / width
    return np.convolve(signal, kernel, mode="same")


def envelope(length: int, decay: float = 7.0, attack_ms: float = 3.0) -> np.ndarray:
    axis = np.linspace(0.0, 1.0, length, endpoint=False)
    env = np.exp(-decay * axis)
    attack = min(length, max(1, round(attack_ms * MASTER_RATE / 1000)))
    env[:attack] *= np.linspace(0.0, 1.0, attack, endpoint=True)
    return env


def oscillator(length: int, start_hz: float, end_hz: float | None = None,
               harmonics: tuple[float, ...] = (1.0,), phase: float = 0.0) -> np.ndarray:
    end_hz = start_hz if end_hz is None else end_hz
    frequencies = np.linspace(start_hz, end_hz, length, endpoint=True)
    angle = 2 * np.pi * np.cumsum(frequencies) / MASTER_RATE + phase
    output = np.zeros(length, dtype=np.float64)
    for index, amplitude in enumerate(harmonics, start=1):
        output += amplitude * np.sin(angle * index)
    return output / max(1.0, sum(abs(value) for value in harmonics))


def transformed_source(sources: list[np.ndarray], seed: int, length: int,
                       low_width: int = 2, playback: float = 1.0) -> tuple[np.ndarray, str]:
    source_index = seed % len(sources)
    source = sources[source_index]
    desired = max(8, round(len(source) / max(.45, min(1.8, playback))))
    warped = np.interp(
        np.linspace(0, len(source) - 1, desired, endpoint=True),
        np.arange(len(source), dtype=np.float64),
        source,
    )
    warped = fit(warped, length)
    if low_width > 1:
        warped = lowpass(warped, low_width)
    warped -= lowpass(warped, max(8, low_width * 8)) * .3
    return warped, SOURCE_FILES[source_index]


def loop_texture(length: int, rng: np.random.Generator, base_hz: float, warm: bool) -> np.ndarray:
    # Entire oscillators use integer cycles, and wrapped smoothing makes the
    # noise boundary continuous enough for a zero-crossing-safe loop.
    duration = length / MASTER_RATE
    cycles = max(1, round(base_hz * duration))
    axis = np.arange(length, dtype=np.float64) / length
    tonal = .55 * np.sin(2 * np.pi * cycles * axis)
    tonal += .18 * np.sin(2 * np.pi * cycles * (2 if warm else 3) * axis + .7)
    noise = rng.normal(0, 1, length)
    extended = np.concatenate((noise[-256:], noise, noise[:256]))
    smooth = lowpass(extended, 61)[256:-256]
    smooth /= max(1e-9, np.max(np.abs(smooth)))
    output = tonal + .18 * smooth
    seam = min(512, length // 8)
    blend = np.linspace(0, 1, seam, endpoint=False)
    common = output[:seam] * (1 - blend) + output[-seam:] * blend
    output[:seam] = common
    output[-seam:] = common
    return output


def estimated_true_peak(signal: np.ndarray) -> float:
    """Return a conservative four-point cubic 4x intersample peak estimate."""
    padded = np.pad(signal, (1, 2), mode="edge")
    p0 = padded[:-3]
    p1 = padded[1:-2]
    p2 = padded[2:-1]
    p3 = padded[3:]
    peak = float(np.max(np.abs(signal)))
    for fraction in (.25, .5, .75):
        t2 = fraction * fraction
        t3 = t2 * fraction
        interpolated = .5 * (
            2 * p1
            + (-p0 + p2) * fraction
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        )
        peak = max(peak, float(np.max(np.abs(interpolated))))
    return peak


def close_loop(signal: np.ndarray, sample_rate: int = MASTER_RATE) -> None:
    """Replace the final 8 ms with a cubic bridge matching the first slope."""
    bridge = min(len(signal) // 8, round(sample_rate * .008))
    if bridge < 4:
        return
    start_index = len(signal) - bridge - 1
    y0 = float(signal[start_index])
    m0 = float(signal[start_index + 1] - signal[start_index]) * bridge
    y1 = float(2 * signal[0] - signal[1])
    m1 = float(signal[1] - signal[0]) * bridge
    t = np.arange(1, bridge + 1, dtype=np.float64) / bridge
    t2 = t * t
    t3 = t2 * t
    signal[start_index + 1:] = (
        (2 * t3 - 3 * t2 + 1) * y0
        + (t3 - 2 * t2 + t) * m0
        + (-2 * t3 + 3 * t2) * y1
        + (t3 - t2) * m1
    )


def render(cue_spec: Cue, variant: int, sources: list[np.ndarray]) -> tuple[np.ndarray, list[str], str]:
    seed = stable_u32(f"{cue_spec.cue_id}|{variant}|blacksite-v28")
    rng = np.random.default_rng(seed)
    length = max(128, round(cue_spec.duration * MASTER_RATE))
    cue_id = cue_spec.cue_id
    source_names: list[str] = []

    if cue_spec.loop:
        warm = "blackout" in cue_id or "music" in cue_id or "rollup" in cue_id
        frequency = 27 + (seed % 11) + (12 if warm else 0)
        signal = loop_texture(length, rng, frequency, warm)
        source_layer, source_name = transformed_source(sources, seed, length, low_width=31, playback=.63 + variant * .07)
        # Heavily filtered source material becomes a low-level industrial texture.
        signal = .68 * signal + .08 * lowpass(source_layer, 55)
        source_names.append(source_name)
        edit = "periodic authored synthesis; wrapped noise; filtered/time-warped CC0 texture; seamless boundary blend"
    else:
        playback = .62 + ((seed >> 8) % 90) / 100
        source_layer, source_name = transformed_source(sources, seed, length, low_width=2 + seed % 9, playback=playback)
        source_names.append(source_name)
        signal = .48 * source_layer
        base_frequency = 72 + seed % 180

        if cue_id.startswith("ui.") or cue_id == "spin.press" or cue_id.startswith("feature.spin"):
            signal += .38 * oscillator(length, base_frequency * 2.2, base_frequency * 2.7, (1, .28)) * envelope(length, 10)
            edit = "tight crop; time/pitch warp; high-pass mechanical transient; authored two-stage system tone"
        elif cue_id.startswith("reel.stop") or "land" in cue_id or cue_id.startswith("spin."):
            signal += .42 * oscillator(length, base_frequency, base_frequency * .52, (1, .45, .18)) * envelope(length, 12)
            signal += .08 * rng.normal(0, 1, length) * envelope(length, 18)
            edit = "time/pitch warp; filtered impact body; authored servo chirp and bounded grit"
        elif cue_id.startswith("operative."):
            signal = .62 * lowpass(source_layer, 5) + .1 * rng.normal(0, 1, length) * envelope(length, 8)
            edit = "time/pitch warp; band-limited cloth/gear shaping; authored friction tail; no voice content"
        elif cue_id.startswith("vault.") or cue_id in {"breach.trigger", "blackout.direct.prep"}:
            signal += .55 * oscillator(length, max(34, base_frequency * .55), max(28, base_frequency * .28), (1, .55, .2)) * envelope(length, 5)
            if cue_id in {"vault.gold", "vault.handoff"}:
                signal += .28 * oscillator(length, 196, 294, (1, .35)) * envelope(length, 2)
                signal += .2 * oscillator(length, 294, 440, (1, .25), .5) * envelope(length, 2)
            edit = "layered/transformed CC0 mechanics; authored sub-safe chirp, pressure body and damped tail"
        elif cue_id.startswith("win.") or cue_id.startswith("blackout.") or cue_id.startswith("feature.summary"):
            tier = {"win.micro": 0, "win.small": 1, "win.medium": 2, "win.big": 3, "win.top": 4, "win.max": 5}.get(cue_id, 2)
            root = 146.83 * (1 + tier * .05)
            signal += .38 * oscillator(length, root, root * 1.02, (1, .25)) * envelope(length, 2.6)
            signal += .26 * oscillator(length, root * 1.5, root * 1.52, (1, .2), .3) * envelope(length, 2.2)
            edit = "transformed impact bed; authored restrained harmonic identity; tier-scaled decay; no casino sample"
        elif cue_id.startswith("feature.expand"):
            signal += .42 * oscillator(length, 88, 310, (1, .3)) * envelope(length, 4)
            edit = "time/pitch-warped mechanical layer; authored electrical expansion sweep"
        else:
            signal += .32 * oscillator(length, base_frequency, base_frequency * .72, (1, .3)) * envelope(length, 8)
            edit = "time/pitch warp; filtered mechanical layer; authored bounded tonal transient"

        fade_in = min(length // 4, max(8, round(MASTER_RATE * .003)))
        fade_out = min(length // 3, max(16, round(MASTER_RATE * .025)))
        signal[:fade_in] *= np.linspace(0, 1, fade_in, endpoint=True)
        signal[-fade_out:] *= np.linspace(1, 0, fade_out, endpoint=True)

    signal -= float(np.mean(signal))
    if cue_spec.loop:
        close_loop(signal)
        signal -= float(np.mean(signal))
    else:
        fade_in = min(length // 4, max(8, round(MASTER_RATE * .003)))
        fade_out = min(length // 3, max(16, round(MASTER_RATE * .025)))
        signal[:fade_in] *= np.linspace(0, 1, fade_in, endpoint=True)
        signal[-fade_out:] *= np.linspace(1, 0, fade_out, endpoint=True)
        # Remove the tiny fade-induced DC term with a zero-at-edges window so
        # the bounded click-free endpoints remain exactly silent.
        correction_window = np.sin(np.linspace(0, np.pi, length, endpoint=True)) ** 2
        signal -= (float(np.mean(signal)) / float(np.mean(correction_window))) * correction_window
    peak = float(np.max(np.abs(signal)))
    if peak > 1e-12:
        signal *= MASTER_PEAK / peak
    intersample_peak = estimated_true_peak(signal)
    if intersample_peak > MASTER_PEAK:
        signal *= MASTER_PEAK / intersample_peak
    return signal.astype(np.float64), sorted(set(source_names)), edit


def write_pcm24(path: Path, signal: np.ndarray, rate: int) -> np.ndarray:
    path.parent.mkdir(parents=True, exist_ok=True)
    scaled = np.clip(np.rint(signal * 8_388_607), -8_388_608, 8_388_607).astype(np.int32)
    packed = bytearray(len(scaled) * 3)
    for index, value in enumerate(scaled):
        unsigned = int(value) & 0xFFFFFF
        offset = index * 3
        packed[offset:offset + 3] = bytes((unsigned & 0xFF, (unsigned >> 8) & 0xFF, (unsigned >> 16) & 0xFF))
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(3)
        target.setframerate(rate)
        target.writeframes(packed)
    return scaled.astype(np.float64) / 8_388_608.0


def write_pcm16(path: Path, signal: np.ndarray, rate: int, seed: int, *, loop: bool) -> np.ndarray:
    path.parent.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    dither = (rng.random(len(signal)) - rng.random(len(signal))) / 65536
    scaled = np.clip(np.rint((signal + dither) * 32767), -32768, 32767).astype("<i2")
    if loop and len(scaled) >= 2:
        # The shipped derivative is the authority for seam QA.  Enforce exact
        # first-slope continuity after resampling, dithering and quantization.
        scaled[-1] = np.int16(np.clip(2 * int(scaled[0]) - int(scaled[1]), -32768, 32767))
    elif len(scaled) >= 2:
        # Runtime DC correction can otherwise lift a faded endpoint by dozens
        # of PCM values.  The actual delivered one-shot must end at digital zero.
        scaled[0] = 0
        scaled[-1] = 0
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(rate)
        target.writeframes(scaled.tobytes())
    return scaled.astype(np.float64) / 32768.0


def boundary_metrics(signal: np.ndarray, *, loop: bool) -> tuple[float | None, float | None, float | None]:
    if loop:
        step = float(abs(signal[0] - signal[-1]))
        slope_delta = float(abs((signal[1] - signal[0]) - (signal[0] - signal[-1])))
        return step, slope_delta, None
    endpoint = float(max(abs(signal[0]), abs(signal[-1])))
    return None, None, endpoint


def filename(cue_id: str, variant: int, count: int) -> str:
    stem = cue_id.replace("_", "-").replace(".", "-")
    return f"{stem}-v{variant:02d}.wav" if count > 1 else f"{stem}.wav"


def pinned_toolchain() -> dict[str, str]:
    actual_python = platform.python_version()
    actual_numpy = np.__version__
    if actual_python != PINNED_PYTHON or actual_numpy != PINNED_NUMPY:
        raise RuntimeError(
            f"pinned toolchain required: Python {PINNED_PYTHON} / NumPy {PINNED_NUMPY}; "
            f"got Python {actual_python} / NumPy {actual_numpy}"
        )
    return {
        "python": actual_python,
        "pythonImplementation": platform.python_implementation(),
        "numpy": actual_numpy,
        "byteOrder": sys.byteorder,
    }


def load_verified_sources() -> tuple[dict, list[np.ndarray], dict[str, str], dict[str, str], str, str]:
    report_path = SOURCE_ROOT / "SOURCE_REPORT.json"
    evidence_path = SOURCE_ROOT / "LICENSE_EVIDENCE.md"
    source_report = json.loads(report_path.read_text(encoding="utf-8"))
    if source_report.get("status") != "PASS" or source_report.get("license") != "CC0 1.0":
        raise RuntimeError("verified CC0 source report is missing or not PASS")
    rows = {entry["name"]: entry for entry in source_report["files"]}
    if set(rows) != set(SOURCE_FILES):
        raise RuntimeError("source report must contain exactly the eight approved source WAVs")
    source_arrays: list[np.ndarray] = []
    source_hashes: dict[str, str] = {}
    source_urls: dict[str, str] = {}
    for source_name in SOURCE_FILES:
        row = rows[source_name]
        expected_url = f"https://opengameart.org/sites/default/files/{source_name}"
        if row.get("originalUrl") != expected_url:
            raise RuntimeError(f"exact source URL missing or invalid: {source_name}")
        source_path = SOURCE_ROOT / source_name
        actual = sha256(source_path)
        if actual != row.get("sha256"):
            raise RuntimeError(f"source hash mismatch: {source_name}")
        source, source_rate = read_pcm16_mono(source_path)
        source_arrays.append(resample(source, source_rate, MASTER_RATE))
        source_hashes[source_name] = actual
        source_urls[source_name] = expected_url
    return source_report, source_arrays, source_hashes, source_urls, sha256(report_path), sha256(evidence_path)


def runtime_file_row(entry: dict) -> dict:
    return {
        "path": entry["runtimePath"].split("static/", 1)[1],
        "cueId": entry["cueId"],
        "bus": entry["bus"],
        "bank": entry["bank"],
        "variant": entry["variant"],
        "bytes": entry["runtimeBytes"],
        "sha256": entry["sha256Runtime"],
        "format": entry["runtimeFormat"],
        "durationSeconds": entry["durationSeconds"],
        "samplePeakDbfs": entry["runtimeSamplePeakDbfs"],
        "estimatedTruePeakDbtp": entry["runtimeEstimatedTruePeakDbtp"],
        "dcOffset": entry["runtimeDcOffset"],
        "loopBoundaryStep": entry["runtimeLoopBoundaryStep"],
        "loopBoundarySlopeDelta": entry["runtimeLoopBoundarySlopeDelta"],
        "fadeEndpointPeak": entry["runtimeFadeEndpointPeak"],
    }


def build_package(
    master_root: Path,
    runtime_root: Path,
    production_manifest_path: Path,
    source_report: dict,
    source_arrays: list[np.ndarray],
    source_hashes: dict[str, str],
    source_urls: dict[str, str],
    source_report_sha: str,
    license_evidence_sha: str,
    toolchain: dict[str, str],
    builder_sha: str,
) -> dict:
    for target in (master_root, runtime_root):
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True, exist_ok=True)

    entries = []
    total_runtime = 0
    critical_runtime = 0
    for cue_spec in CUES:
        for variant in range(1, cue_spec.variants + 1):
            signal, source_names, edit = render(cue_spec, variant, source_arrays)
            bus_folder = cue_spec.bus.lower()
            asset_name = filename(cue_spec.cue_id, variant, cue_spec.variants)
            master_path = master_root / bus_folder / asset_name
            runtime_path = runtime_root / bus_folder / asset_name
            canonical_master_path = f"apps/blacksite/art/v28/audio/masters/{bus_folder}/{asset_name}"
            canonical_runtime_path = f"apps/blacksite/static/assets/blacksite/v28/audio/{bus_folder}/{asset_name}"

            master_pcm = write_pcm24(master_path, signal, MASTER_RATE)
            runtime_signal = resample(master_pcm, MASTER_RATE, RUNTIME_RATE)
            if cue_spec.loop:
                runtime_signal -= float(np.mean(runtime_signal))
                close_loop(runtime_signal, RUNTIME_RATE)
                runtime_signal -= float(np.mean(runtime_signal))
            else:
                correction_window = np.sin(np.linspace(0, np.pi, len(runtime_signal), endpoint=True)) ** 2
                runtime_signal -= (
                    float(np.mean(runtime_signal)) / float(np.mean(correction_window))
                ) * correction_window
            runtime_peak_before = estimated_true_peak(runtime_signal)
            if runtime_peak_before > MASTER_PEAK:
                runtime_signal *= MASTER_PEAK / runtime_peak_before
            runtime_pcm = write_pcm16(
                runtime_path,
                runtime_signal,
                RUNTIME_RATE,
                stable_u32(f"dither|{cue_spec.cue_id}|{variant}"),
                loop=cue_spec.loop,
            )

            with wave.open(str(runtime_path), "rb") as built:
                if (built.getnchannels(), built.getsampwidth(), built.getframerate()) != (1, 2, RUNTIME_RATE):
                    raise RuntimeError(f"runtime format mismatch: {runtime_path}")

            runtime_bytes = runtime_path.stat().st_size
            total_runtime += runtime_bytes
            if cue_spec.bank == "critical":
                critical_runtime += runtime_bytes
            master_peak = float(np.max(np.abs(master_pcm)))
            master_true_peak = estimated_true_peak(master_pcm)
            runtime_peak = float(np.max(np.abs(runtime_pcm)))
            runtime_true_peak = estimated_true_peak(runtime_pcm)
            master_step, master_slope, master_endpoint = boundary_metrics(master_pcm, loop=cue_spec.loop)
            runtime_step, runtime_slope, runtime_endpoint = boundary_metrics(runtime_pcm, loop=cue_spec.loop)
            entries.append({
                "id": f"bsb-audio-{cue_spec.cue_id.replace('.', '-')}-{variant:02d}-v28",
                "cueId": cue_spec.cue_id,
                "bus": cue_spec.bus,
                "bank": cue_spec.bank,
                "priority": cue_spec.priority,
                "variant": variant,
                "variantCount": cue_spec.variants,
                "loop": cue_spec.loop,
                "pan": cue_spec.pan,
                "protected": cue_spec.protected,
                "duck": cue_spec.duck,
                "sourcePaths": [f"apps/blacksite/art/audio/sources/2026-08-21-oga-mechanical-cc0/{name}" for name in source_names],
                "sourceOriginalUrls": {name: source_urls[name] for name in source_names},
                "sourceHashes": {name: source_hashes[name] for name in source_names},
                "masterPath": canonical_master_path,
                "runtimePath": canonical_runtime_path,
                "masterFormat": {"container": "WAV", "codec": "PCM", "sampleRate": MASTER_RATE, "sampleWidthBits": 24, "channels": 1},
                "runtimeFormat": {"container": "WAV", "codec": "PCM", "sampleRate": RUNTIME_RATE, "sampleWidthBits": 16, "channels": 1},
                "durationSeconds": round(len(master_pcm) / MASTER_RATE, 6),
                "samplePeakDbfs": round(20 * math.log10(max(master_peak, 1e-12)), 6),
                "estimatedTruePeakDbtp": round(20 * math.log10(max(master_true_peak, 1e-12)), 6),
                "dcOffset": round(float(np.mean(master_pcm)), 12),
                "runtimeSamplePeakDbfs": round(20 * math.log10(max(runtime_peak, 1e-12)), 6),
                "runtimeEstimatedTruePeakDbtp": round(20 * math.log10(max(runtime_true_peak, 1e-12)), 6),
                "runtimeDcOffset": round(float(np.mean(runtime_pcm)), 12),
                "loopBoundaryStep": round(master_step, 12) if master_step is not None else None,
                "loopBoundarySlopeDelta": round(master_slope, 12) if master_slope is not None else None,
                "fadeEndpointPeak": round(master_endpoint, 12) if master_endpoint is not None else None,
                "runtimeLoopBoundaryStep": round(runtime_step, 12) if runtime_step is not None else None,
                "runtimeLoopBoundarySlopeDelta": round(runtime_slope, 12) if runtime_slope is not None else None,
                "runtimeFadeEndpointPeak": round(runtime_endpoint, 12) if runtime_endpoint is not None else None,
                "masterBytes": master_path.stat().st_size,
                "runtimeBytes": runtime_bytes,
                "sha256Master": sha256(master_path),
                "sha256Runtime": sha256(runtime_path),
                "license": "CC0 1.0 plus internal deterministic authored synthesis",
                "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
                "authorProvider": "BMacZero / Brian MacIntosh; BLACKSITE authored synthesis",
                "attribution": "optional",
                "commercialUse": True,
                "editChain": f"{edit}; DC removal; 48 kHz render; boundary fade/seam treatment; normalized against a 4x cubic intersample estimate at -3.2 dBTP; TPDF-dithered 24 kHz/16-bit runtime derivative; post-quantization runtime seam/endpoint enforcement",
            })

    if total_runtime > RUNTIME_BUDGET:
        raise RuntimeError(f"runtime bank {total_runtime} exceeds {RUNTIME_BUDGET}")
    if critical_runtime > CRITICAL_BUDGET:
        raise RuntimeError(f"critical bank {critical_runtime} exceeds {CRITICAL_BUDGET}")
    if max(entry["estimatedTruePeakDbtp"] for entry in entries) > -1.0:
        raise RuntimeError("master true-peak ceiling exceeded")
    if max(entry["runtimeEstimatedTruePeakDbtp"] for entry in entries) > -1.0:
        raise RuntimeError("runtime true-peak ceiling exceeded")
    if max(abs(entry["dcOffset"]) for entry in entries) > 1e-7:
        raise RuntimeError("master DC audit exceeded")
    if max(abs(entry["runtimeDcOffset"]) for entry in entries) > 1e-4:
        raise RuntimeError("runtime DC audit exceeded")
    if max(entry["loopBoundarySlopeDelta"] or 0 for entry in entries) > 1e-5:
        raise RuntimeError("master loop boundary slope audit exceeded")
    if max(entry["runtimeLoopBoundarySlopeDelta"] or 0 for entry in entries) > RUNTIME_LOOP_SLOPE_MAX:
        raise RuntimeError("runtime loop boundary slope audit exceeded")
    if max(entry["fadeEndpointPeak"] or 0 for entry in entries) > 1e-7:
        raise RuntimeError("master one-shot fade endpoint audit exceeded")
    if max(entry["runtimeFadeEndpointPeak"] or 0 for entry in entries) > RUNTIME_FADE_ENDPOINT_MAX:
        raise RuntimeError("runtime one-shot fade endpoint audit exceeded")
    source_digest_set = set(source_hashes.values())
    if any(entry["sha256Runtime"] in source_digest_set for entry in entries):
        raise RuntimeError("raw source recording copied into runtime")

    cue_rows = []
    for cue_spec in CUES:
        cue_entries = [entry for entry in entries if entry["cueId"] == cue_spec.cue_id]
        cue_rows.append({
            "cueId": cue_spec.cue_id,
            "bus": cue_spec.bus,
            "bank": cue_spec.bank,
            "priority": cue_spec.priority,
            "loop": cue_spec.loop,
            "pan": cue_spec.pan,
            "protected": cue_spec.protected,
            "duck": cue_spec.duck,
            "runtimeFiles": [entry["runtimePath"].split("static/", 1)[1] for entry in cue_entries],
            "runtimeHashes": [entry["sha256Runtime"] for entry in cue_entries],
        })

    quality = {
        "master": "mono WAV PCM, 48 kHz, 24-bit",
        "runtime": "mono WAV PCM, 24 kHz, 16-bit; broad local browser decode target",
        "masterPeakTargetDbfs": -3.2,
        "maxMasterEstimatedTruePeakDbtp": max(entry["estimatedTruePeakDbtp"] for entry in entries),
        "maxRuntimeEstimatedTruePeakDbtp": max(entry["runtimeEstimatedTruePeakDbtp"] for entry in entries),
        "maxEstimatedTruePeakDbtp": max(
            max(entry["estimatedTruePeakDbtp"] for entry in entries),
            max(entry["runtimeEstimatedTruePeakDbtp"] for entry in entries),
        ),
        "maxMasterAbsoluteDcOffset": max(abs(entry["dcOffset"]) for entry in entries),
        "maxRuntimeAbsoluteDcOffset": max(abs(entry["runtimeDcOffset"]) for entry in entries),
        "maxAbsoluteDcOffset": max(abs(entry["dcOffset"]) for entry in entries),
        "maxMasterLoopBoundarySlopeDelta": max(entry["loopBoundarySlopeDelta"] or 0 for entry in entries),
        "maxRuntimeLoopBoundarySlopeDelta": max(entry["runtimeLoopBoundarySlopeDelta"] or 0 for entry in entries),
        "maxLoopBoundarySlopeDelta": max(
            max(entry["loopBoundarySlopeDelta"] or 0 for entry in entries),
            max(entry["runtimeLoopBoundarySlopeDelta"] or 0 for entry in entries),
        ),
        "maxMasterFadeEndpointPeak": max(entry["fadeEndpointPeak"] or 0 for entry in entries),
        "maxRuntimeFadeEndpointPeak": max(entry["runtimeFadeEndpointPeak"] or 0 for entry in entries),
        "maxFadeEndpointPeak": max(
            max(entry["fadeEndpointPeak"] or 0 for entry in entries),
            max(entry["runtimeFadeEndpointPeak"] or 0 for entry in entries),
        ),
        "runtimeLoopSlopeGate": RUNTIME_LOOP_SLOPE_MAX,
        "runtimeFadeEndpointGate": RUNTIME_FADE_ENDPOINT_MAX,
        "rawSourceRuntimeCopies": 0,
        "audibleHumanQa": "PROVISIONAL_NOT_PERFORMED",
    }
    budgets = {
        "runtimeBytes": total_runtime,
        "runtimeBytesScope": "WAV_FILES_ONLY_MANIFEST_EXCLUDED_TO_AVOID_SELF_REFERENCE",
        "runtimeHardMaxBytes": RUNTIME_BUDGET,
        "criticalRuntimeBytes": critical_runtime,
        "criticalHardMaxBytes": CRITICAL_BUDGET,
        "pass": total_runtime <= RUNTIME_BUDGET and critical_runtime <= CRITICAL_BUDGET,
    }
    deterministic_build = {
        "builderSha256Strategy": "SHA-256 of the exact builder file bytes being executed; digest is written only to outputs",
        "proofPath": PROOF_RELATIVE_PATH,
        "proofArtifactScope": "153 masters + 153 runtime WAVs + runtime manifest + production manifest; proof file excluded",
    }
    runtime_manifest = {
        "schema": "blacksite-audio-runtime-manifest-v28",
        "status": "TECHNICAL_VERTICAL_SLICE_PASS_AUDIBLE_QA_PROVISIONAL",
        "builder": {"path": BUILDER_RELATIVE_PATH, "sha256": builder_sha},
        "toolchain": toolchain,
        "deterministicBuild": deterministic_build,
        "budgets": budgets,
        "quality": quality,
        "cues": cue_rows,
        "files": [runtime_file_row(entry) for entry in entries],
    }
    runtime_manifest_path = runtime_root / "audio-manifest.json"
    runtime_manifest_path.write_text(json.dumps(runtime_manifest, indent=2) + "\n", encoding="utf-8")
    runtime_manifest_fact = {
        "path": RUNTIME_MANIFEST_RELATIVE_PATH,
        "bytes": runtime_manifest_path.stat().st_size,
        "sha256": sha256(runtime_manifest_path),
    }
    manifest = {
        "schema": "blacksite-audio-production-manifest-v28",
        "status": "TECHNICAL_VERTICAL_SLICE_PASS_AUDIBLE_QA_PROVISIONAL",
        "generatedBy": BUILDER_RELATIVE_PATH,
        "builder": {"path": BUILDER_RELATIVE_PATH, "sha256": builder_sha},
        "toolchain": toolchain,
        "deterministicBuild": deterministic_build,
        "sourceCollection": {
            "title": source_report["title"],
            "author": source_report["author"],
            "sourcePage": source_report["sourcePage"],
            "license": source_report["license"],
            "licenseUrl": source_report["licenseUrl"],
            "downloadedAt": source_report["downloadedAt"],
            "archivedEvidence": "apps/blacksite/art/audio/sources/2026-08-21-oga-mechanical-cc0/LICENSE_EVIDENCE.md",
            "sourceReportSha256": source_report_sha,
            "licenseEvidenceSha256": license_evidence_sha,
            "sourceOriginalUrls": source_urls,
            "sourceHashes": source_hashes,
        },
        "budgets": budgets,
        "quality": quality,
        "runtimeManifest": runtime_manifest_fact,
        "cues": cue_rows,
        "assets": entries,
    }
    production_manifest_path.parent.mkdir(parents=True, exist_ok=True)
    production_manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def build_snapshot(master_root: Path, runtime_root: Path, production_manifest_path: Path) -> dict:
    records = []
    for path in sorted(master_root.rglob("*.wav")):
        logical = f"apps/blacksite/art/v28/audio/masters/{path.relative_to(master_root).as_posix()}"
        records.append({"path": logical, "bytes": path.stat().st_size, "sha256": sha256(path)})
    for path in sorted(item for item in runtime_root.rglob("*") if item.is_file()):
        logical = f"apps/blacksite/static/assets/blacksite/v28/audio/{path.relative_to(runtime_root).as_posix()}"
        records.append({"path": logical, "bytes": path.stat().st_size, "sha256": sha256(path)})
    records.append({
        "path": PRODUCTION_MANIFEST_RELATIVE_PATH,
        "bytes": production_manifest_path.stat().st_size,
        "sha256": sha256(production_manifest_path),
    })
    records.sort(key=lambda row: row["path"])
    payload = "".join(f'{row["path"]}\0{row["bytes"]}\0{row["sha256"]}\n' for row in records)
    return {
        "artifactCount": len(records),
        "totalBytes": sum(row["bytes"] for row in records),
        "treeSha256": hashlib.sha256(payload.encode("utf-8")).hexdigest(),
        "artifacts": records,
    }


def main() -> None:
    toolchain = pinned_toolchain()
    builder_sha = sha256(Path(__file__).resolve())
    source_report, source_arrays, source_hashes, source_urls, source_report_sha, license_evidence_sha = load_verified_sources()
    production_manifest_path = ART_ROOT / "audio-production-manifest.json"
    manifest = build_package(
        MASTER_ROOT,
        RUNTIME_ROOT,
        production_manifest_path,
        source_report,
        source_arrays,
        source_hashes,
        source_urls,
        source_report_sha,
        license_evidence_sha,
        toolchain,
        builder_sha,
    )
    first_build = build_snapshot(MASTER_ROOT, RUNTIME_ROOT, production_manifest_path)
    with tempfile.TemporaryDirectory(prefix="blacksite-v28-audio-double-rebuild-") as temp_dir:
        temp_root = Path(temp_dir)
        second_master = temp_root / "art/masters"
        second_runtime = temp_root / "static/audio"
        second_manifest = temp_root / "art/audio-production-manifest.json"
        build_package(
            second_master,
            second_runtime,
            second_manifest,
            source_report,
            source_arrays,
            source_hashes,
            source_urls,
            source_report_sha,
            license_evidence_sha,
            toolchain,
            builder_sha,
        )
        second_build = build_snapshot(second_master, second_runtime, second_manifest)
    if first_build != second_build:
        raise RuntimeError("deterministic double rebuild produced different bytes")

    proof = {
        "schema": "blacksite-audio-deterministic-rebuild-proof-v28",
        "status": "PASS_BYTE_IDENTICAL_DOUBLE_REBUILD",
        "audibleHumanQa": "PROVISIONAL_NOT_PERFORMED",
        "strategy": {
            "builderSha256": builder_sha,
            "builderSha256Definition": "SHA-256 of exact builder file bytes; proof/output digests are never embedded back into the builder",
            "artifactDigestDefinition": "SHA-256 of sorted logicalPath\\0bytes\\0fileSha256\\n records",
            "artifactScope": manifest["deterministicBuild"]["proofArtifactScope"],
        },
        "toolchain": toolchain,
        "sourceInputs": {
            "sourceReportSha256": source_report_sha,
            "licenseEvidenceSha256": license_evidence_sha,
            "sourceHashes": source_hashes,
        },
        "firstBuild": first_build,
        "secondBuild": second_build,
        "identical": True,
    }
    proof_path = ART_ROOT / "DETERMINISTIC_REBUILD_PROOF.json"
    proof_path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": manifest["status"],
        "cues": len(CUES),
        "runtimeFiles": len(manifest["assets"]),
        "runtimeBytes": manifest["budgets"]["runtimeBytes"],
        "criticalRuntimeBytes": manifest["budgets"]["criticalRuntimeBytes"],
        "maxRuntimeLoopBoundarySlopeDelta": manifest["quality"]["maxRuntimeLoopBoundarySlopeDelta"],
        "maxRuntimeFadeEndpointPeak": manifest["quality"]["maxRuntimeFadeEndpointPeak"],
        "doubleRebuildTreeSha256": first_build["treeSha256"],
        "builderSha256": builder_sha,
    }, indent=2))


if __name__ == "__main__":
    main()
