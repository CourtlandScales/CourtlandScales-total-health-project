# Backend: Arduino → analysis → Postgres → React

```
Sensors -> Arduino --USB--> FastAPI server (Python, on your laptop) --WebSocket/REST--> app/
                                   |  SQLAlchemy ORM
                                   v
                      PostgreSQL 16 in Docker (localhost only)
```

## Quick start

From the **repo root** (not `backend/` or `app/`), with Python 3.10+ and Node 22 installed:

```
npm start         # Arduino, port auto-detected (npm start -- --port COM5 to name it)
```

The first run creates `backend/.venv`, installs the Python and npm packages, then starts the server and the
dashboard together (http://localhost:8443). Ctrl+C stops both. If Docker isn't running, the data goes to
`backend/rihab.db` (SQLite) instead of Postgres, and the server says so when it starts.

The rest of this file is the manual way, plus the details.

## Setup (one time)

1. Install Docker Desktop and start it, then from the repo root: `docker compose up -d`.
   Postgres runs on `localhost:5433` (user `rihab`, password `rihab_local`, database `rihab`), bound to
   127.0.0.1 so nobody on the Wi-Fi can reach it. Tables are created the first time the server runs.
2. Install the Python side (3.10 or newer):
   ```
   cd backend
   python -m venv .venv
   .venv\Scripts\activate             # Mac/Linux: source .venv/bin/activate
   pip install -r requirements.txt
   ```
   If PowerShell says "running scripts is disabled", run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
   once, or skip activation and call `.venv\Scripts\python.exe` directly.

No Docker? Nothing to do: if Postgres isn't reachable and `DATABASE_URL` isn't set, the server falls back to
`backend/rihab.db`. Set `DATABASE_URL` to choose explicitly (it then fails instead of falling back).

## Run

Run these from `backend/` with the venv's Python (plain `python` won't have the packages), then start the app
in a second terminal: `cd app`, `npm install`, `npm run dev`, and open http://localhost:8443.
The dashboard connects to `http://localhost:8000` by default; set `VITE_RIHAB_SERVER` in `app/.env.local` to change it.

```
python rihab_server.py                # real Arduino, port auto-detected
python rihab_server.py --port COM5    # or name it
```

- API docs: http://localhost:8000/docs
- Browse tables: `docker compose --profile tools up -d`, then http://localhost:8080 (System PostgreSQL, Server `db`)
- Tests: `python -m pytest tests`

Close the Arduino IDE Serial Monitor first; only one program can hold the port. FastAPI isn't in Docker
by default because Docker Desktop on Windows/Mac can't pass a USB device into a container.
`docker compose --profile api up -d --build` runs it containerized, on Linux only (it passes `/dev/ttyACM0` in).

Everything on the dashboard comes from the plugged-in brace: there is no simulator or demo data. Tracking
won't start until the Arduino is connected, and if it stops sending for 3 s the Device log says so.

## The database (Phase 4)

| Table | One row per | Key columns |
| --- | --- | --- |
| `patients` | patient | name, injury |
| `workouts` | workout | `performed_at` (backdatable), `recorded_at`, `is_backdated`, rep counts, `angle_pct`, `speed_pct`, `flux_pct`, `score`, `status`, `summary`, `baseline_from`, `feeling` (post-workout check-in, 1–10) |
| `measurements` | rep | `measured_at`, knee, `rom_deg`, `duration_s`, `flux`, `vision_rom_deg`, `source` (device / python / manual) |
| `samples` | raw reading while tracking (~30/s) | `offset_s` (seconds since the workout started), knee, `angle`, `ax`/`ay`/`az` (g, null if the accelerometer skipped it) |

Every rep is saved the moment it happens; raw readings are written in batches once a second. The healthy knee is measured once; later workouts borrow the most
recent earlier healthy baseline (`baseline_from`). Times are stored in UTC and returned as ISO strings with
a timezone; a time sent without a zone is read as the laptop's local time.

**Backdating:** pass `performed_at` to `start_workout`; or `POST /api/workouts` with a past `performed_at`
and its measurements; or `PATCH /api/workouts/{id}` with a new `performed_at` (measurements shift with it
and comparisons are recomputed). `DELETE /api/workouts/{id}` removes typos.

**Data:** survives `docker compose down`; `down -v` deletes it.
Back up with `docker compose exec db pg_dump -U rihab rihab > rihab_backup.sql`.

## What the Arduino must print (115200 baud, one line each)

| Line | Meaning |
| --- | --- |
| `D,<seq>,<ms>,<angle_x10>,<emg_x10>,<temp_x100>,<battery>,<flags>` | What `firmware/knee_brace_uno` prints, 25/s (see `docs/serial-protocol.md`). EMG/temp of 0 = no sensor |
| `# <text>` | Firmware log line, shown in the app log |
| `S,<ms>,<angle>,<ax>,<ay>,<az>` | Live sample, 20–50/s. Angle in degrees (0 = straight), accel in g. `S,<ms>,<angle>` also works (no smoothness score then) |
| `R,<H or I>,<rom_deg>,<duration_ms>,<flux>` | Optional: one rep measured on the Arduino. H = healthy, I = injured |
| `B,1` / `B,0` | Button started / stopped tracking |
| `I,<text>` | Any message, shown in the app log |

Python sends back `K,H` / `K,I` (which knee), `START` / `STOP`, and `c` (calibrate: leg straight now).
Two sketches speak this protocol:
- `firmware/src/ArduinoFirmware` (rotary angle sensor on A0, MMA7660 accelerometer, button on D2) prints `S`, `B` and `I`
  lines and acts on every command. It re-zeroes the angle whenever tracking starts, so start with the leg straight.
- `firmware/knee_brace_uno` (accelerometer + LCD) prints `D` and `#` lines and only acts on `c`.

Opening the port resets an Uno. The server ignores the half-lines left over from before the reset, and once the
board is talking again it resends the knee and, if tracking, `START`. If the angle stays near 0° for 15 s of
tracking, the Device log says so (unplugged sensor, or flip `FLEX_SIGN` in the sketch). Until an `R` line arrives, Python finds
reps itself from the `S` lines. Flux = RMS deviation of accel magnitude from a 5-sample moving average, in milli-g.

## What the numbers mean (Phase 3)

Median of the last 5 reps per knee. A rep runs from the leg leaving 10° to returning below 10°.

| Comparison | Formula | Reads as |
| --- | --- | --- |
| Angle | injured ROM / healthy ROM × 100 | "Reaches 73% of healthy range" |
| Speed | (injured time − healthy time) / healthy time × 100 | "+30% = 30% slower per rep" |
| Flux | (injured flux − healthy flux) / healthy flux × 100 | "+171% = 2.7x shakier" |

Score = 50% range + 25% speed + 25% smoothness, each capped at 100. Status: 90+ Near symmetric,
75+ Progressing, 50+ Early recovery. Demo thresholds, not clinical ones.

## Frontend contract

The dashboard uses `app/src/lib/rihab.ts` (typed `useRihab()` hook + REST helpers).

**WebSocket** `ws://localhost:8000/ws`
- Server → app: `snapshot` (on connect and each new workout; includes the last 50 `logs`), `state`, `sample` (every reading, capped at 40/s; `emg`, `temp`, `battery`, `flags` are null when the source doesn't report them), `rep`, `comparison`, `log`
- App → server: `start_workout {patient, injury?, performed_at?}`, `end_workout`, `set_knee {knee}`, `start`, `stop`, `calibrate`, `vision {angle}`

**REST** `http://localhost:8000/api`
- `GET /progress?patient=Alex` (one row per analysed workout, oldest first), `GET /workouts?patient=`, `GET /workouts/{id}` (workouts include `sample_count`)
- `GET /workouts/{id}/samples?max_points=4000`: the raw angle trace as parallel `offset_s` / `knee` / `angle` lists; longer traces are thinned keeping each stretch's min and max
- `POST /workouts`, `PATCH /workouts/{id}`, `DELETE /workouts/{id}`
- `POST /workouts/{id}/checkin {"score": 1-10}`: post-workout check-in (1 = very uncomfortable, 10 = felt great); posting again overwrites it
- `POST /vision {"angle": 92.5}`, `GET /state`, `GET /patients`, `POST /command`

## Files

```
package.json         (repo root) npm start -> scripts/start.mjs
docker-compose.yml   (repo root) Postgres + optional Adminer / API container
.env.example         (repo root) database login
backend/
  rihab_server.py    FastAPI app, serial reader, WebSocket
  analysis.py        rep detection + healthy vs injured comparison
  db.py              SQLAlchemy models + every query
  tests/             pytest suite (tests/fakes.py stands in for the Arduino)
```
