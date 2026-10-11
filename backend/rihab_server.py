"""RiHab local server: Arduino (USB serial) -> analysis -> database -> React (WebSocket + REST).

    python rihab_server.py --sim              simulated patient, no hardware needed
    python rihab_server.py                    real Arduino, port auto-detected
    python rihab_server.py --port COM5        or name the port

API docs: http://localhost:8000/docs   WebSocket: ws://localhost:8000/ws
"""

from __future__ import annotations

import argparse
import asyncio
import math
import random
import threading
import time
from collections import deque
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Any, Callable, Literal, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import analysis
import db

BAUD = 115200
SAMPLE_BROADCAST_HZ = 30
LOG_HISTORY = 50  # recent log lines sent to each new browser, so boot messages like '# ERROR: no accelerometer' aren't missed
KNEE_CODES = {"H": "healthy", "I": "injured"}
KNEE_TO_CODE = {v: k for k, v in KNEE_CODES.items()}


# ---------------------------------------------------------------- serial line protocol

def parse_line(text: str) -> Optional[dict]:
    """Parse one line from the Arduino. Returns None for blank lines; raises ValueError for bad ones.

        D,<seq>,<ms>,<angle_x10>,<emg_x10>,<temp_x100>,<battery>,<flags>
                                                  Uno firmware sample (docs/serial-protocol.md)
        # <text>                                  Uno firmware log line
        S,<ms>,<angle>,<ax>,<ay>,<az>             live sample
        R,<H|I>,<rom_deg>,<duration_ms>,<flux>    one rep measured on the Arduino
        B,1 / B,0                                 button started / stopped tracking
        I,<text>                                  info message
    """
    text = text.strip()
    if not text:
        return None
    if text.startswith("#"):
        return {"kind": "info", "text": text[1:].strip()}
    kind, _, rest = text.partition(",")
    kind = kind.upper()
    if kind == "I":
        return {"kind": "info", "text": rest}
    parts = rest.split(",") if rest else []
    try:
        if kind == "D":
            if len(parts) != 7:
                raise ValueError
            seq, ms, angle, emg, temp, battery, flags = (int(p) for p in parts)
            # emg/temp are 0 until those sensors exist; report "no reading" rather than 0% / 0 °C.
            return {"kind": "sample", "ms": ms, "angle": angle / 10.0, "accel": None, "seq": seq,
                    "emg": emg / 10.0 if emg else None, "temp": temp / 100.0 if temp else None,
                    "battery": battery, "flags": flags}
        if kind == "S":
            if len(parts) == 2:  # angle only, no accelerometer
                return {"kind": "sample", "ms": int(float(parts[0])), "angle": float(parts[1]), "accel": None}
            if len(parts) != 5:
                raise ValueError
            ms, angle, ax, ay, az = parts
            return {"kind": "sample", "ms": int(float(ms)), "angle": float(angle),
                    "accel": (float(ax), float(ay), float(az))}
        if kind == "R":
            if len(parts) != 4 or parts[0].upper() not in KNEE_CODES:
                raise ValueError
            flux = parts[3].strip()
            return {"kind": "rep", "knee": KNEE_CODES[parts[0].upper()], "rom_deg": float(parts[1]),
                    "duration_s": float(parts[2]) / 1000.0,
                    "flux": None if flux in ("", "nan", "NaN") else float(flux)}
        if kind == "B":
            if len(parts) != 1 or parts[0] not in ("0", "1"):
                raise ValueError
            return {"kind": "button", "on": parts[0] == "1"}
    except ValueError:
        pass
    raise ValueError(f"unreadable line: {text!r}")


# ---------------------------------------------------------------- sources

Emit = Callable[[str, Any], None]  # emit("line", text) / emit("status", dict) / emit("log", text)


class SerialSource:
    """Reads the Arduino over USB on a background thread. Reconnects if it's unplugged."""
    kind = "serial"
    KNOWN_VIDS = {0x2341, 0x2A03, 0x1A86, 0x10C4, 0x0403, 0x239A}  # Arduino, CH340, CP210x, FTDI, Adafruit
    KNOWN_WORDS = ("arduino", "ch340", "ch910", "usb serial", "usb-serial", "cp210", "ftdi", "usbmodem", "ttyacm")

    def __init__(self, port: Optional[str] = None) -> None:
        self.port = port
        self.connected_port: Optional[str] = None
        self._ser = None
        self._stop = threading.Event()
        self._emit: Optional[Emit] = None

    @classmethod
    def autodetect(cls) -> Optional[str]:
        from serial.tools import list_ports
        for p in list_ports.comports():
            text = " ".join(filter(None, [p.description, p.manufacturer, p.device])).lower()
            if p.vid in cls.KNOWN_VIDS or any(w in text for w in cls.KNOWN_WORDS):
                return p.device
        return None

    def start(self, emit: Emit) -> None:
        self._emit = emit
        threading.Thread(target=self._run, name="serial-reader", daemon=True).start()

    def stop(self) -> None:
        self._stop.set()

    def send(self, cmd: str) -> None:
        ser = self._ser
        if ser is None:
            return
        try:
            ser.write((cmd + "\n").encode("ascii"))
        except Exception as e:  # unplugged mid-write; the reader thread will notice and reconnect
            self._emit("log", f"Couldn't send {cmd!r} to the Arduino: {e}")

    def _run(self) -> None:
        import serial
        warned = False
        while not self._stop.is_set():
            port = self.port or self.autodetect()
            if not port:
                if not warned:
                    self._emit("log", "No Arduino found. Plug it in, or start with --port COMx. Retrying...")
                    warned = True
                self._stop.wait(2)
                continue
            try:
                with serial.Serial(port, BAUD, timeout=1) as ser:
                    self._ser, self.connected_port, warned = ser, port, False
                    self._emit("status", {"connected": True, "port": port})
                    self._emit("log", f"Connected to Arduino on {port}")
                    while not self._stop.is_set():
                        raw = ser.readline()
                        if raw:
                            self._emit("line", raw.decode("ascii", errors="replace"))
            except serial.SerialException as e:
                if not warned:
                    hint = " (close the Arduino IDE Serial Monitor?)" if "denied" in str(e).lower() or "busy" in str(e).lower() else ""
                    self._emit("log", f"Serial error on {port}: {e}{hint}. Retrying...")
                    warned = True
            finally:
                if self._ser is not None:
                    self._emit("status", {"connected": False, "port": None})
                self._ser, self.connected_port = None, None
            self._stop.wait(2)


class SimSource:
    """A pretend Arduino. Produces the same S lines the real one prints, at 30 samples/s of device time.

    speed > 1 runs device time faster than real time (used by the tests).
    """
    kind = "sim"
    RATE_HZ = 30
    PROFILES = {  # rom degrees, seconds per rep, accelerometer jitter in g
        "healthy": {"rom": 130.0, "rep_s": 3.0, "jitter": 0.012},
        "injured": {"rom": 95.0, "rep_s": 3.9, "jitter": 0.032},
    }
    REST_S = 1.2

    def __init__(self, speed: float = 1.0, seed: Optional[int] = None) -> None:
        self.speed = speed
        self.connected_port = "simulator"
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
        emit("line", "I,Simulator ready")

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


# ---------------------------------------------------------------- live session

class Hub:
    """Everyone connected to /ws."""

    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def broadcast(self, msg: dict) -> None:
        for ws in list(self.clients):
            try:
                await asyncio.wait_for(ws.send_json(msg), timeout=1.0)
            except Exception:
                self.clients.discard(ws)


class Session:
    """The one workout happening right now. All methods run on the asyncio loop."""

    def __init__(self, source, hub: Hub, default_patient: str) -> None:
        self.source = source
        self.hub = hub
        self.patient = default_patient
        self.injury: Optional[str] = None
        self.workout: Optional[dict] = None
        self.workout_started = 0.0      # time.monotonic() when the workout began
        self.knee = "healthy"
        self.tracking = False
        self.device_reps = False        # True once the Arduino sends its own R lines
        self.connected = False
        self.port: Optional[str] = None
        self.detector = analysis.RepDetector()
        self.comparison: Optional[dict] = None
        self.vision_angle: Optional[float] = None
        self.vision_peak: Optional[float] = None
        self._last_sample_sent = 0.0
        self._last_t = 0.0              # device time of the last sample, to notice Arduino resets
        self._bad_lines = 0
        self.logs: deque[dict] = deque(maxlen=LOG_HISTORY)

    # ---- outgoing

    def state(self) -> dict:
        return {
            "type": "state", "source": self.source.kind, "connected": self.connected, "port": self.port,
            "patient": self.patient, "workout_id": self.workout["id"] if self.workout else None,
            "performed_at": self.workout["performed_at"] if self.workout else None,
            "knee": self.knee, "tracking": self.tracking,
            "rep_mode": "device" if self.device_reps else "python",
        }

    def snapshot(self) -> dict:
        return {
            "type": "snapshot", "state": self.state(),
            "workout": db.get_workout(self.workout["id"]) if self.workout else None,
            "comparison": self.comparison,
            "progress": db.progress(self.patient),
            "logs": list(self.logs),
        }

    async def log(self, text: str, level: str = "info") -> None:
        entry = {"type": "log", "level": level, "text": text, "at": db.iso(db.now_utc())}
        self.logs.append(entry)
        await self.hub.broadcast(entry)

    async def send_state(self) -> None:
        await self.hub.broadcast(self.state())

    # ---- from the hardware

    async def handle(self, kind: str, payload: Any) -> None:
        if kind == "status":
            self.connected, self.port = payload["connected"], payload["port"]
            await self.send_state()
        elif kind == "log":
            await self.log(payload, "warn")
        elif kind == "line":
            try:
                msg = parse_line(payload)
            except ValueError as e:
                self._bad_lines += 1
                if self._bad_lines <= 5 or self._bad_lines % 100 == 0:
                    await self.log(f"{e} (#{self._bad_lines})", "warn")
                return
            if msg:
                await self.handle_message(msg)

    async def handle_message(self, msg: dict) -> None:
        kind = msg["kind"]
        if kind == "sample":
            t = msg["ms"] / 1000.0
            if t < self._last_t:  # the Arduino rebooted (opening the port resets an Uno) and its clock restarted
                self.detector.reset()
            self._last_t = t
            if self.tracking and not self.device_reps:
                rep = self.detector.feed(t, msg["angle"], msg["accel"])
                if rep:
                    await self.record_rep(self.knee, rep.rom_deg, rep.duration_s, rep.flux, "python")
            now = time.monotonic()
            if now - self._last_sample_sent >= 1.0 / SAMPLE_BROADCAST_HZ:
                self._last_sample_sent = now
                ax, ay, az = msg["accel"] or (None, None, None)
                await self.hub.broadcast({"type": "sample", "t": t, "angle": msg["angle"], "ax": ax, "ay": ay,
                                          "az": az, "emg": msg.get("emg"), "temp": msg.get("temp"),
                                          "battery": msg.get("battery"), "flags": msg.get("flags"),
                                          "knee": self.knee, "tracking": self.tracking})
        elif kind == "rep":
            if not self.device_reps:
                self.device_reps = True
                await self.log("Arduino is measuring reps itself (R lines); Python rep detection is off.")
                await self.send_state()
            await self.record_rep(msg["knee"], msg["rom_deg"], msg["duration_s"], msg["flux"], "device")
        elif kind == "button":
            await (self.start() if msg["on"] else self.stop())
        elif kind == "info":
            await self.log(f"Arduino: {msg['text']}")

    async def record_rep(self, knee: str, rom: float, duration: float, flux: Optional[float], source: str) -> None:
        if self.workout is None:
            await self.start_workout(self.patient)
        measured_at = db.parse_time(self.workout["performed_at"]) + timedelta(seconds=time.monotonic() - self.workout_started)
        m = db.add_measurement(self.workout["id"], knee, rom, duration, flux, measured_at, self.vision_peak, source)
        self.vision_peak = None
        await self.hub.broadcast({"type": "rep", **m})
        self.comparison = db.recompute(self.workout["id"])
        if self.comparison:
            await self.hub.broadcast({"type": "comparison", **self.comparison})

    # ---- from the app

    async def start_workout(self, patient: Optional[str] = None, injury: Optional[str] = None, performed_at=None) -> None:
        self.patient = (patient or self.patient).strip() or self.patient
        self.injury = injury
        self.workout = db.start_workout(self.patient, injury, performed_at)
        self.workout_started = time.monotonic()
        self.comparison = None
        self.detector.reset()
        await self.set_knee("healthy", announce=False)
        when = " (backdated)" if self.workout["is_backdated"] else ""
        await self.log(f"Workout #{self.workout['id']} started for {self.patient}{when}")
        await self.hub.broadcast(self.snapshot())

    async def end_workout(self) -> None:
        if self.tracking:
            await self.stop()
        if self.workout:
            self.comparison = db.recompute(self.workout["id"])
            await self.log(f"Workout #{self.workout['id']} saved")
        self.workout = None
        await self.hub.broadcast(self.snapshot())

    async def set_knee(self, knee: str, announce: bool = True) -> None:
        if knee not in KNEE_TO_CODE:
            raise ValueError("knee must be 'healthy' or 'injured'")
        self.knee = knee
        self.detector.reset()
        self.source.send(f"K,{KNEE_TO_CODE[knee]}")
        if announce:
            await self.send_state()

    async def start(self) -> None:
        if self.workout is None:
            await self.start_workout(self.patient)
        self.tracking = True
        self.detector.reset()
        self.source.send("START")
        await self.send_state()

    async def stop(self) -> None:
        self.tracking = False
        self.source.send("STOP")
        await self.send_state()

    async def calibrate(self) -> None:
        """Tell the brace the leg is straight right now (Uno firmware command 'c')."""
        self.detector.reset()
        self.source.send("c")
        await self.log("Calibrating: hold the leg straight")

    def vision(self, angle: float) -> None:
        """Latest knee angle from the skeleton-tracking script; the peak is attached to the next rep."""
        self.vision_angle = angle
        self.vision_peak = angle if self.vision_peak is None else max(self.vision_peak, angle)

    async def command(self, msg: dict) -> None:
        t = msg.get("type")
        if t == "start_workout":
            await self.start_workout(msg.get("patient"), msg.get("injury"), msg.get("performed_at"))
        elif t == "end_workout":
            await self.end_workout()
        elif t == "set_knee":
            await self.set_knee(msg.get("knee"))
        elif t == "start":
            await self.start()
        elif t == "stop":
            await self.stop()
        elif t == "calibrate":
            await self.calibrate()
        elif t == "vision":
            self.vision(float(msg["angle"]))
        else:
            raise ValueError(f"unknown command {t!r}")


# ---------------------------------------------------------------- web app

class MeasurementIn(BaseModel):
    knee: Literal["healthy", "injured"]
    rom_deg: float = Field(ge=0, le=200)
    duration_s: float = Field(gt=0, le=120)
    flux: Optional[float] = Field(default=None, ge=0)
    measured_at: Optional[str] = None
    vision_rom_deg: Optional[float] = None


class WorkoutIn(BaseModel):
    patient: str
    injury: Optional[str] = None
    performed_at: str
    measurements: list[MeasurementIn] = []


class WorkoutPatch(BaseModel):
    performed_at: str


class CheckInIn(BaseModel):
    score: int = Field(ge=1, le=10)  # 1 = very uncomfortable, 10 = felt great


class VisionIn(BaseModel):
    angle: float


def create_app(source=None, database_url: Optional[str] = None, default_patient: str = "Alex") -> FastAPI:
    source = source or SimSource()
    hub = Hub()
    session = Session(source, hub, default_patient)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        print(f"Database: {db.init_db(database_url)}")
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def emit(kind: str, payload: Any) -> None:  # safe to call from the serial thread
            loop.call_soon_threadsafe(queue.put_nowait, (kind, payload))

        async def pump() -> None:
            while True:
                kind, payload = await queue.get()
                try:
                    await session.handle(kind, payload)
                except Exception as e:  # one bad message must never stop the stream
                    await session.log(f"Error handling {kind}: {e!r}", "error")

        pump_task = asyncio.create_task(pump())
        source.start(emit)
        yield
        source.stop()
        pump_task.cancel()

    app = FastAPI(title="RiHab", version="1.0", lifespan=lifespan)
    app.state.session = session
    app.add_middleware(
        CORSMiddleware, allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_methods=["*"], allow_headers=["*"],
    )

    def bad_request(e: Exception):
        raise HTTPException(400, str(e))

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket):
        await ws.accept()
        hub.clients.add(ws)
        await ws.send_json(session.snapshot())
        try:
            while True:
                msg = await ws.receive_json()
                try:
                    await session.command(msg)
                except (ValueError, KeyError, TypeError) as e:
                    await ws.send_json({"type": "log", "level": "error", "text": str(e), "at": db.iso(db.now_utc())})
        except WebSocketDisconnect:
            pass
        finally:
            hub.clients.discard(ws)

    @app.get("/api/state")
    def get_state():
        return {**session.state(), "comparison": session.comparison, "vision_angle": session.vision_angle}

    @app.get("/api/patients")
    def get_patients():
        return db.list_patients()

    @app.get("/api/progress")
    def get_progress(patient: Optional[str] = None):
        return db.progress(patient)

    @app.get("/api/workouts")
    def get_workouts(patient: Optional[str] = None):
        return db.list_workouts(patient)

    @app.get("/api/workouts/{workout_id}")
    def get_workout(workout_id: int):
        w = db.get_workout(workout_id)
        if w is None:
            raise HTTPException(404, "workout not found")
        return w

    @app.post("/api/workouts", status_code=201)
    async def post_workout(body: WorkoutIn):
        try:
            w = db.create_manual_workout(body.patient, body.performed_at,
                                         [m.model_dump() for m in body.measurements], body.injury)
        except ValueError as e:
            bad_request(e)
        await hub.broadcast(session.snapshot())
        return w

    @app.patch("/api/workouts/{workout_id}")
    async def patch_workout(workout_id: int, body: WorkoutPatch):
        try:
            w = db.move_workout(workout_id, body.performed_at)
        except KeyError:
            raise HTTPException(404, "workout not found")
        except ValueError as e:
            bad_request(e)
        if session.workout and session.workout["id"] == workout_id:
            session.workout = w
            session.comparison = db.recompute(workout_id)
        await hub.broadcast(session.snapshot())
        return w

    @app.post("/api/workouts/{workout_id}/checkin")
    async def post_checkin(workout_id: int, body: CheckInIn):
        """Post-workout check-in: how the patient felt, 1-10. Posting again overwrites it."""
        try:
            w = db.set_feeling(workout_id, body.score)
        except KeyError:
            raise HTTPException(404, "workout not found")
        await hub.broadcast(session.snapshot())
        return w

    @app.delete("/api/workouts/{workout_id}", status_code=204)
    async def remove_workout(workout_id: int):
        if not db.delete_workout(workout_id):
            raise HTTPException(404, "workout not found")
        if session.workout and session.workout["id"] == workout_id:
            session.workout, session.comparison, session.tracking = None, None, False
        await hub.broadcast(session.snapshot())

    @app.post("/api/vision")
    def post_vision(body: VisionIn):
        session.vision(body.angle)
        return {"ok": True}

    @app.post("/api/command")
    async def post_command(body: dict):
        try:
            await session.command(body)
        except (ValueError, KeyError, TypeError) as e:
            bad_request(e)
        return session.state()

    return app


def main() -> None:
    ap = argparse.ArgumentParser(description="RiHab local server")
    ap.add_argument("--sim", action="store_true", help="simulated patient instead of a real Arduino")
    ap.add_argument("--port", help="serial port, e.g. COM5 or /dev/ttyACM0 (default: auto-detect)")
    ap.add_argument("--patient", default="Alex", help="patient used when the button starts a workout")
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to allow other devices (not recommended)")
    ap.add_argument("--http-port", type=int, default=8000)
    ap.add_argument("--sim-speed", type=float, default=1.0, help=argparse.SUPPRESS)
    args = ap.parse_args()

    import uvicorn
    source = SimSource(speed=args.sim_speed) if args.sim else SerialSource(args.port)
    print(f"RiHab: {'simulator' if args.sim else 'Arduino on ' + (args.port or 'auto-detected port')}")
    print(f"API docs: http://localhost:{args.http_port}/docs   WebSocket: ws://localhost:{args.http_port}/ws")
    uvicorn.run(create_app(source, default_patient=args.patient), host=args.host, port=args.http_port, log_level="warning")


if __name__ == "__main__":
    main()
