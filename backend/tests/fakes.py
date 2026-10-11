"""Test double for the Arduino: tests drive the server with it instead of a real USB port."""

from __future__ import annotations

import asyncio
import math
import random
from typing import Optional

from rihab_server import KNEE_CODES


class SimSource:
    """A pretend brace for the tests. Produces the same S lines the real one prints, at 30 samples/s of device time.

    speed > 1 runs device time faster than real time; speed=0.001 is effectively silent, for injecting lines by hand.
    """
    kind = "serial"
    RATE_HZ = 30
    PROFILES = {  # rom degrees, seconds per rep, accelerometer jitter in g
        "healthy": {"rom": 130.0, "rep_s": 3.0, "jitter": 0.012},
        "injured": {"rom": 95.0, "rep_s": 3.9, "jitter": 0.032},
    }
    REST_S = 1.2

    def __init__(self, speed: float = 1.0, seed: Optional[int] = None) -> None:
        self.speed = speed
        self.connected_port = "test-brace"
        self.knee = "healthy"
        self.tracking = False
        self._rand = random.Random(seed)
        self._task: Optional[asyncio.Task] = None
        self._t = 0.0          # device time, seconds
        self._rep_t0 = None    # when the current rep began
        self._rep = None       # this rep's randomized profile

    def start(self, emit: Emit) -> None:
        self._emit = emit
        self._task = asyncio.get_running_loop().create_task(self._run())
        emit("status", {"connected": True, "port": self.connected_port})
        emit("line", "I,Test brace ready")

    def stop(self) -> None:
        if self._task:
            self._task.cancel()

    def send(self, cmd: str) -> None:
        if cmd.startswith("K,"):
            self.knee = KNEE_CODES.get(cmd[2:].strip().upper(), self.knee)
        elif cmd == "START":
            self.tracking = True
        elif cmd == "STOP":
            self.tracking = False

    async def _run(self) -> None:
        dt = 1.0 / self.RATE_HZ
        carry = 0.0
        while True:
            await asyncio.sleep(dt)
            carry += self.speed
            while carry >= 1:
                carry -= 1
                self._t += dt
                self._emit("line", self._sample())

    def _sample(self) -> str:
        angle = self._angle()
        p = self.PROFILES[self.knee]
        j = p["jitter"] if self.tracking else 0.004
        tremor = j * 0.8 * math.sin(2 * math.pi * 7 * self._t) if self.knee == "injured" else 0.0
        th = math.radians(angle)
        g = self._rand.gauss
        ax, ay, az = math.sin(th) + g(0, j) + tremor, g(0, j), math.cos(th) + g(0, j)
        return f"S,{int(self._t * 1000)},{angle:.1f},{ax:.3f},{ay:.3f},{az:.3f}"

    def _angle(self) -> float:
        noise = self._rand.gauss(0, 0.4)
        if not self.tracking:
            self._rep_t0 = None
            return max(0.0, 1.0 + noise)
        if self._rep_t0 is None or self._t - self._rep_t0 > self._rep["rep_s"] + self.REST_S:
            base = self.PROFILES[self.knee]
            self._rep_t0 = self._t
            self._rep = {"rom": base["rom"] * self._rand.uniform(0.96, 1.04),
                         "rep_s": base["rep_s"] * self._rand.uniform(0.95, 1.05)}
        phase = (self._t - self._rep_t0) / self._rep["rep_s"]
        if phase >= 1:
            return max(0.0, 1.0 + noise)
        return max(0.0, 1.0 + self._rep["rom"] * (1 - math.cos(2 * math.pi * phase)) / 2 + noise)
