"""RiHab local server: Arduino (USB serial) -> analysis -> database -> React (WebSocket + REST).

    python rihab_server.py                    Arduino, port auto-detected
    python rihab_server.py --port COM5        or name the port

API docs: http://localhost:8000/docs   WebSocket: ws://localhost:8000/ws
"""

from __future__ import annotations

import argparse
import asyncio
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
SAMPLE_BROADCAST_HZ = 40  # cap on live samples sent to browsers; the boards send 25-30/s, so normally all get through
SAMPLE_BURST = 5          # USB hands over several lines at once, so allow short bursts above the cap
LOG_HISTORY = 50  # recent log lines sent to each new browser, so boot messages like '# ERROR: no accelerometer' aren't missed
CONNECT_QUIET_S = 2.5   # opening the port resets an Uno; half-lines from before the reset aren't worth a warning
STILL_WARN_S = 15.0     # tracking this long with the angle stuck near 0 = probably a sensor problem
STILL_DEG = 3.0
SILENT_WARN_S = 3.0     # port open but no line for this long = sketch hung, wrong baud, or wrong sketch
SAMPLE_FLUSH_S = 1.0    # raw readings are written to the database in batches this often
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

Emit = Callable[[str, Any], None]  # emit("line", text) / emit("status", dict) / emit("log", text or (text, level))


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
                    ser.reset_input_buffer()  # drop whatever the OS buffered before the board reset
                    self._ser, self.connected_port, warned = ser, port, False
                    self._emit("status", {"connected": True, "port": port})
                    self._emit("log", (f"Connected to Arduino on {port}", "info"))
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
        self._sample_budget = float(SAMPLE_BURST)
        self._last_t = 0.0              # device time of the last sample, to notice Arduino resets
        self._bad_lines = 0
        self._quiet_until = 0.0         # time.monotonic() until which bad lines are counted but not logged
        self._sync_pending = False      # resend knee/tracking to the board once it's talking again
        self._track_t0: Optional[float] = None  # device time of the first sample since tracking started
        self._track_peak = 0.0
        self._still_warned = False
        self._samples: list[dict] = []  # raw readings waiting to be written
        self._last_flush = 0.0
        self.last_line_at: Optional[float] = None  # time.monotonic() of the last line from the brace
        self._silent_warned = False
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
            if self.connected:
                self._quiet_until = time.monotonic() + CONNECT_QUIET_S
                self._sync_pending = True
                self.last_line_at, self._silent_warned = time.monotonic(), False
            else:
                self.flush_samples()
            await self.send_state()
        elif kind == "log":
            text, level = payload if isinstance(payload, tuple) else (payload, "warn")
            await self.log(text, level)
        elif kind == "line":
            self.last_line_at = time.monotonic()
            if self._silent_warned:
                self._silent_warned = False
                await self.log("The brace is sending data again.")
            try:
                msg = parse_line(payload)
            except ValueError as e:
                self._bad_lines += 1
                if time.monotonic() < self._quiet_until:
                    return
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
                self._track_t0 = None
                self._sync_pending = True
            self._last_t = t
            if self._sync_pending:
                self.sync_device()
            if self.tracking:
                await self.check_still(t, msg["angle"])
                self.store_sample(msg)
            if self.tracking and not self.device_reps:
                rep = self.detector.feed(t, msg["angle"], msg["accel"])
                if rep:
                    await self.record_rep(self.knee, rep.rom_deg, rep.duration_s, rep.flux, "python")
            now = time.monotonic()
            self._sample_budget = min(SAMPLE_BURST, self._sample_budget + (now - self._last_sample_sent) * SAMPLE_BROADCAST_HZ)
            self._last_sample_sent = now
            if self._sample_budget >= 1:
                self._sample_budget -= 1
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

    def store_sample(self, msg: dict) -> None:
        """Keep every reading taken while tracking, so a workout's angle trace can be replayed later."""
        if self.workout is None:
            return
        ax, ay, az = msg["accel"] or (None, None, None)
        self._samples.append({"workout_id": self.workout["id"], "offset_s": round(time.monotonic() - self.workout_started, 3),
                              "knee": self.knee, "angle": msg["angle"], "ax": ax, "ay": ay, "az": az})
        if time.monotonic() - self._last_flush >= SAMPLE_FLUSH_S:
            self.flush_samples()

    def flush_samples(self) -> None:
        self._last_flush = time.monotonic()
        if self._samples:
            rows, self._samples = self._samples, []
            db.add_samples(rows)

    async def watch(self) -> None:
        """Runs once a second: tell the app when the brace is plugged in but has stopped sending."""
        self.flush_samples()
        if self.connected and not self._silent_warned and self.last_line_at is not None \
                and time.monotonic() - self.last_line_at > SILENT_WARN_S:
            self._silent_warned = True
            await self.log(f"No data from the brace for {SILENT_WARN_S:.0f} s. Is the RiHab sketch uploaded, "
                           f"at {BAUD} baud? Try unplugging it and plugging it back in.", "warn")

    def sync_device(self) -> None:
        """The board just (re)booted and forgot everything, including commands sent while it was booting."""
        self._sync_pending = False
        self.source.send(f"K,{KNEE_TO_CODE[self.knee]}")
        if self.tracking:
            self.source.send("START")

    async def check_still(self, t: float, angle: float) -> None:
        """Warn once per tracking run if the angle never leaves 0: unplugged sensor, or it turns the wrong way."""
        if self._track_t0 is None:
            self._track_t0, self._track_peak = t, angle
        self._track_peak = max(self._track_peak, angle)
        if not self._still_warned and self._track_peak < STILL_DEG and t - self._track_t0 > STILL_WARN_S:
            self._still_warned = True
            await self.log(f"Knee angle hasn't moved in {STILL_WARN_S:.0f} s of tracking. If you are bending the knee, "
                           "check the angle sensor's cable, or flip FLEX_SIGN in the firmware.", "warn")

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
        self.flush_samples()
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
            self.flush_samples()
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
        if not self.connected:
            raise ValueError("The brace isn't connected. Plug in the Arduino first.")
        if self.workout is None:
            await self.start_workout(self.patient)
        self.tracking = True
        self.detector.reset()
        self._track_t0, self._still_warned = None, False
        self.source.send("START")
        await self.send_state()

    async def stop(self) -> None:
        self.tracking = False
        self.flush_samples()
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
    source = source or SerialSource()
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

        async def watchdog() -> None:
            while True:
                await asyncio.sleep(1)
                try:
                    await session.watch()
                except Exception as e:
                    await session.log(f"Error saving readings: {e!r}", "error")

        pump_task, watch_task = asyncio.create_task(pump()), asyncio.create_task(watchdog())
        source.start(emit)
        yield
        source.stop()
        pump_task.cancel()
        watch_task.cancel()
        session.flush_samples()

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

    @app.get("/api/workouts/{workout_id}/samples")
    def get_samples(workout_id: int, max_points: int = 4000):
        """The raw angle readings recorded while tracking. Long workouts are thinned to about max_points,
        keeping each stretch's lowest and highest angle so no rep's peak is lost."""
        if workout_id == (session.workout or {}).get("id"):
            session.flush_samples()
        out = db.get_samples(workout_id, max(100, min(max_points, 50000)))
        if out is None:
            raise HTTPException(404, "workout not found")
        return out

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
            session._samples = []
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
    ap.add_argument("--port", help="serial port, e.g. COM5 or /dev/ttyACM0 (default: auto-detect)")
    ap.add_argument("--patient", default="Alex", help="patient used when the button starts a workout")
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to allow other devices (not recommended)")
    ap.add_argument("--http-port", type=int, default=8000)
    args = ap.parse_args()

    import uvicorn
    source = SerialSource(args.port)
    print(f"RiHab: Arduino on {args.port or 'auto-detected port'}")
    print(f"API docs: http://localhost:{args.http_port}/docs   WebSocket: ws://localhost:{args.http_port}/ws")
    uvicorn.run(create_app(source, default_patient=args.patient), host=args.host, port=args.http_port, log_level="warning")


if __name__ == "__main__":
    main()
