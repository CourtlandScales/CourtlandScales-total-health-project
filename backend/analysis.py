"""Phase 3: turn raw knee samples into reps, and reps into a healthy-vs-injured comparison.

Pure functions and small classes only. No serial, no database, no web, so it's easy to test.

Units used everywhere:
    angle      degrees, 0 = straight leg
    duration   seconds for one full bend-and-straighten
    flux       milli-g: RMS deviation of the accelerometer magnitude from its 5-sample moving
               average. Higher = shakier movement. If the Arduino computes flux itself (R lines),
               it must use this same definition so healthy and injured numbers are comparable.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from statistics import median
from typing import Iterable, Optional

# Rep detection thresholds (degrees / seconds). Tuned for slow seated knee extensions.
REP_START_DEG = 15.0    # angle must rise past this to count as "moving"
REP_END_DEG = 10.0      # ...and come back below this to finish the rep
MIN_REP_ROM_DEG = 20.0  # smaller wiggles are ignored
MIN_REP_S = 0.8
MAX_REP_S = 20.0        # longer than this = the leg was parked bent; throw it away

FLUX_WINDOW = 5
COMPARE_LAST_N = 5      # comparison uses the median of the last N reps per knee

# Score weights and status thresholds. Demo values, not clinical ones.
WEIGHT_ROM, WEIGHT_SPEED, WEIGHT_SMOOTH = 0.50, 0.25, 0.25
STATUS_LEVELS = [(90, "Near symmetric"), (75, "Progressing"), (50, "Early recovery")]
STATUS_LOWEST = "Getting started"


@dataclass
class Rep:
    rom_deg: float
    duration_s: float
    flux: Optional[float]   # None when there was no accelerometer data
    start_s: float          # device time the rep started, seconds
    peak_deg: float

    def to_dict(self) -> dict:
        return asdict(self)


def accel_magnitude(ax: float, ay: float, az: float) -> float:
    return math.sqrt(ax * ax + ay * ay + az * az)


def flux_milli_g(magnitudes: list[float], window: int = FLUX_WINDOW) -> Optional[float]:
    """RMS deviation of each sample from the trailing `window`-sample moving average, in milli-g."""
    if len(magnitudes) < window:
        return None
    total = 0.0
    count = 0
    running = sum(magnitudes[:window - 1])
    for i in range(window - 1, len(magnitudes)):
        running += magnitudes[i]
        avg = running / window
        total += (magnitudes[i] - avg) ** 2
        count += 1
        running -= magnitudes[i - window + 1]
    return math.sqrt(total / count) * 1000.0

class RepDetector:
    """Feeds on live samples and returns a Rep each time a full bend-and-straighten completes.

    A rep starts at the last moment the leg was resting (angle below REP_END_DEG) before it rose
    past REP_START_DEG, and ends when it drops back below REP_END_DEG.
    """

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self._moving = False
        self._rest_t: Optional[float] = None      # last time the leg was at rest
        self._rest_min = math.inf                 # lowest angle while resting
        self._peak = -math.inf
        self._start_t = 0.0
        self._start_angle = 0.0
        self._mags: list[float] = []
        self._last_rest_mag: Optional[float] = None

    def feed(self, t_s: float, angle: float, accel: Optional[tuple[float, float, float]] = None) -> Optional[Rep]:
        mag = accel_magnitude(*accel) if accel is not None else None

        if not self._moving:
            if angle < REP_END_DEG:
                self._rest_t = t_s
                self._rest_min = min(self._rest_min, angle)
                self._last_rest_mag = mag
            elif angle > REP_START_DEG:
                self._moving = True
                self._start_t = self._rest_t if self._rest_t is not None else t_s
                self._start_angle = self._rest_min if self._rest_min != math.inf else angle
                self._peak = angle
                self._mags = [m for m in (self._last_rest_mag, mag) if m is not None]
            return None

        self._peak = max(self._peak, angle)
        if mag is not None:
            self._mags.append(mag)

        if t_s - self._start_t > MAX_REP_S:
            self.reset()
            return None
        if angle >= REP_END_DEG:
            return None

        # Back at rest: the rep is over.
        rep = Rep(
            rom_deg=round(self._peak - self._start_angle, 1),
            duration_s=round(t_s - self._start_t, 3),
            flux=_round(flux_milli_g(self._mags), 2),
            start_s=self._start_t,
            peak_deg=round(self._peak, 1),
        )
        self.reset()
        self._rest_t = t_s
        self._rest_min = angle
        self._last_rest_mag = mag
        if rep.rom_deg < MIN_REP_ROM_DEG or rep.duration_s < MIN_REP_S:
            return None
        return rep


@dataclass
class Comparison:
    healthy_rom_deg: float
    injured_rom_deg: float
    healthy_time_s: float
    injured_time_s: float
    healthy_flux: Optional[float]
    injured_flux: Optional[float]
    angle_pct: float            # injured ROM as % of healthy ROM
    speed_pct: float            # + = injured knee slower per rep
    flux_pct: Optional[float]   # + = injured knee shakier
    score: float                # 0-100
    status: str
    summary: str
    healthy_reps_used: int
    injured_reps_used: int

    def to_dict(self) -> dict:
        return asdict(self)


def _round(v: Optional[float], nd: int = 1) -> Optional[float]:
    return None if v is None else round(v, nd)


def _median_last(values: Iterable[Optional[float]], n: int = COMPARE_LAST_N) -> Optional[float]:
    vals = [v for v in values if v is not None]
    return median(vals[-n:]) if vals else None


def status_for(score: float) -> str:
    for threshold, label in STATUS_LEVELS:
        if score >= threshold:
            return label
    return STATUS_LOWEST


def compare(healthy: list[dict], injured: list[dict]) -> Optional[Comparison]:
    """Compare the two knees. Each rep is a dict with rom_deg, duration_s and flux (flux may be None).

    Reps must be in time order; the median of the last COMPARE_LAST_N per knee is used.
    Returns None until both knees have at least one usable rep.
    """
    h_rom = _median_last(r["rom_deg"] for r in healthy)
    i_rom = _median_last(r["rom_deg"] for r in injured)
    h_t = _median_last(r["duration_s"] for r in healthy)
    i_t = _median_last(r["duration_s"] for r in injured)
    if not h_rom or i_rom is None or not h_t or not i_t:
        return None
    h_flux = _median_last(r.get("flux") for r in healthy)
    i_flux = _median_last(r.get("flux") for r in injured)

    angle_pct = i_rom / h_rom * 100
    speed_pct = (i_t - h_t) / h_t * 100
    rom_part = min(100.0, angle_pct)
    speed_part = min(100.0, h_t / i_t * 100)

    if h_flux and i_flux is not None:
        flux_pct: Optional[float] = (i_flux - h_flux) / h_flux * 100
        smooth_part = 100.0 if i_flux == 0 else min(100.0, h_flux / i_flux * 100)
        score = WEIGHT_ROM * rom_part + WEIGHT_SPEED * speed_part + WEIGHT_SMOOTH * smooth_part
    else:
        flux_pct = None  # no accelerometer data: score on range and speed only
        score = (WEIGHT_ROM * rom_part + WEIGHT_SPEED * speed_part) / (WEIGHT_ROM + WEIGHT_SPEED)

    return Comparison(
        healthy_rom_deg=round(h_rom, 1),
        injured_rom_deg=round(i_rom, 1),
        healthy_time_s=round(h_t, 2),
        injured_time_s=round(i_t, 2),
        healthy_flux=_round(h_flux, 2),
        injured_flux=_round(i_flux, 2),
        angle_pct=round(angle_pct, 1),
        speed_pct=round(speed_pct, 1),
        flux_pct=_round(flux_pct, 1),
        score=round(score, 1),
        status=status_for(score),
        summary=summarize(angle_pct, speed_pct, flux_pct),
        healthy_reps_used=min(len(healthy), COMPARE_LAST_N),
        injured_reps_used=min(len(injured), COMPARE_LAST_N),
    )


def summarize(angle_pct: float, speed_pct: float, flux_pct: Optional[float]) -> str:
    parts = [f"Reaches {angle_pct:.0f}% of healthy range"]
    if abs(speed_pct) < 5:
        parts.append("about the same speed")
    else:
        parts.append(f"{abs(speed_pct):.0f}% {'slower' if speed_pct > 0 else 'faster'} per rep")
    if flux_pct is not None:
        ratio = 1 + flux_pct / 100
        if abs(flux_pct) < 10:
            parts.append("about as smooth")
        elif ratio >= 1:
            parts.append(f"{ratio:.1f}x shakier")
        else:
            parts.append(f"{abs(flux_pct):.0f}% smoother")
    return ", ".join(parts) + "."
