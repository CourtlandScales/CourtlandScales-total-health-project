"""Live terminal view of the RiHab server: knee angle, reps and comparison, as they happen.

    python rihab_server.py                 # terminal 1, with the brace plugged in
    python tools/live_monitor.py           # terminal 2

Keys: s start  x stop  h healthy knee  i injured knee  n new workout  e end workout  q quit
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import termios
import tty
from typing import Optional

import websockets

BAR_MAX_DEG = 150
BAR_WIDTH = 40
KEYS = {
    "s": {"type": "start"},
    "x": {"type": "stop"},
    "h": {"type": "set_knee", "knee": "healthy"},
    "i": {"type": "set_knee", "knee": "injured"},
    "e": {"type": "end_workout"},
}


def fmt(v: Optional[float], digits: int = 0, suffix: str = "") -> str:
    return "—" if v is None else f"{v:.{digits}f}{suffix}"


class Monitor:
    def __init__(self, patient: str) -> None:
        self.patient = patient
        self.state: dict = {}
        self.sample: dict = {}

    # ---- output

    def status_line(self) -> str:
        s, smp = self.state, self.sample
        if not s.get("connected"):
            link = "waiting for Arduino"
        else:
            link = s.get("port") or "?"
        angle = smp.get("angle")
        filled = 0 if angle is None else max(0, min(BAR_WIDTH, round(angle / BAR_MAX_DEG * BAR_WIDTH)))
        bar = "#" * filled + "." * (BAR_WIDTH - filled)
        accel = "" if smp.get("ax") is None else f"  g=({smp['ax']:+.2f},{smp['ay']:+.2f},{smp['az']:+.2f})"
        track = "TRACKING" if s.get("tracking") else "stopped "
        return f"[{link}] {track} {s.get('knee', '?'):7} {fmt(angle, 1, '°'):>7} |{bar}|{accel}"

    def redraw(self) -> None:
        sys.stdout.write("\r\x1b[2K" + self.status_line())
        sys.stdout.flush()

    def event(self, text: str) -> None:
        """Print a line above the status line."""
        sys.stdout.write("\r\x1b[2K" + text + "\r\n")
        self.redraw()

    # ---- input

    def handle(self, msg: dict) -> None:
        t = msg.get("type")
        if t == "snapshot":
            self.state = msg["state"]
            w = msg.get("workout")
            self.event(f"-- connected · patient {self.state['patient']} · "
                       f"workout {'#' + str(w['id']) if w else 'none'} · {len(msg.get('progress') or [])} past workouts")
        elif t == "state":
            self.state = msg
            self.redraw()
        elif t == "sample":
            self.sample = msg
            self.redraw()
        elif t == "rep":
            self.event(f"REP  {msg['knee']:7}  ROM {fmt(msg['rom_deg'], 1, '°')}  "
                       f"{fmt(msg['duration_s'], 2, ' s')}  flux {fmt(msg.get('flux'), 1)}  ({msg.get('source', '')})")
        elif t == "comparison":
            self.event(f"SCORE {msg['score']:.0f}/100 · {msg['status']} · {msg['summary']}")
        elif t == "log":
            self.event(f"{msg.get('level', 'info').upper():5} {msg['text']}")


async def read_keys(queue: asyncio.Queue) -> None:
    loop = asyncio.get_running_loop()
    fd = sys.stdin.fileno()
    loop.add_reader(fd, lambda: queue.put_nowait(sys.stdin.read(1)))


async def run(url: str, patient: str) -> None:
    mon = Monitor(patient)
    keys: asyncio.Queue = asyncio.Queue()
    await read_keys(keys)
    mon.event(__doc__.strip().splitlines()[-1])

    while True:
        try:
            async with websockets.connect(url) as ws:
                async def receive() -> None:
                    async for raw in ws:
                        mon.handle(json.loads(raw))

                async def send() -> None:
                    while True:
                        k = (await keys.get()).lower()
                        if k == "q":
                            return
                        if k == "n":
                            await ws.send(json.dumps({"type": "start_workout", "patient": patient}))
                        elif k in KEYS:
                            await ws.send(json.dumps(KEYS[k]))

                rx, tx = asyncio.create_task(receive()), asyncio.create_task(send())
                done, pending = await asyncio.wait({rx, tx}, return_when=asyncio.FIRST_COMPLETED)
                for task in pending:
                    task.cancel()
                if tx in done:
                    return  # q pressed
                rx.result()  # re-raise if the connection broke
        except (OSError, websockets.ConnectionClosed) as e:
            mon.state = {}
            mon.event(f"-- server not reachable at {url} ({e.__class__.__name__}); retrying in 2 s (q to quit)")
            try:
                k = await asyncio.wait_for(keys.get(), timeout=2)
                if k.lower() == "q":
                    return
            except asyncio.TimeoutError:
                pass


def main() -> None:
    ap = argparse.ArgumentParser(description="Live terminal view of the RiHab server")
    ap.add_argument("--url", default="ws://localhost:8000/ws")
    ap.add_argument("--patient", default="Alex", help="patient for the n (new workout) key")
    args = ap.parse_args()

    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    tty.setcbreak(fd)  # one key at a time, no Enter needed
    try:
        asyncio.run(run(args.url, args.patient))
    except KeyboardInterrupt:
        pass
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
        print()


if __name__ == "__main__":
    main()
