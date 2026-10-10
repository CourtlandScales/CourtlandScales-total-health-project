# Backend: Arduino → analysis → Postgres → React

```
Sensors -> Arduino --USB--> FastAPI server (Python, on your laptop) --WebSocket/REST--> app/
                                   |  SQLAlchemy ORM
                                   v
                      PostgreSQL 16 in Docker (localhost only)
```

> **Known gap:** this server reads the `S,` / `R,` / `B,` / `I,` lines described below. The Uno firmware in
> `firmware/knee_brace_uno/` prints the `D,` lines from `docs/serial-protocol.md`, so the two don't talk
> to each other yet. Use `--sim` until the parser is updated.

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
3. Optional: 6 weeks of backdated demo history so the progress chart isn't empty:
   `python seed.py` (patient "Alex"; `--wipe` to redo, `--weeks 8` for more).

No Docker? Run `$env:DATABASE_URL="sqlite:///rihab.db"` (PowerShell) first to use a local file instead.

## Run

```
python rihab_server.py --sim          # simulated patient, no hardware needed
python rihab_server.py                # real Arduino, port auto-detected
python rihab_server.py --port COM5    # or name it
```

- API docs: http://localhost:8000/docs
- Browse tables: `docker compose --profile tools up -d`, then http://localhost:8080 (System PostgreSQL, Server `db`)
- Tests: `python -m pytest tests`

Close the Arduino IDE Serial Monitor first; only one program can hold the port. FastAPI isn't in Docker
by default because Docker Desktop on Windows/Mac can't pass a USB device into a container.
`docker compose --profile api up -d --build` runs it containerized with the simulator only.

## The database (Phase 4)

| Table | One row per | Key columns |
| --- | --- | --- |
| `patients` | patient | name, injury |
| `workouts` | workout | `performed_at` (backdatable), `recorded_at`, `is_backdated`, rep counts, `angle_pct`, `speed_pct`, `flux_pct`, `score`, `status`, `summary`, `baseline_from` |
| `measurements` | rep | `measured_at`, knee, `rom_deg`, `duration_s`, `flux`, `vision_rom_deg`, `source` (device / python / manual) |

Every rep is saved the moment it happens. The healthy knee is measured once; later workouts borrow the most
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
| `S,<ms>,<angle>,<ax>,<ay>,<az>` | Live sample, 20–50/s. Angle in degrees (0 = straight), accel in g. `S,<ms>,<angle>` also works (no smoothness score then) |
| `R,<H or I>,<rom_deg>,<duration_ms>,<flux>` | Optional: one rep measured on the Arduino. H = healthy, I = injured |
| `B,1` / `B,0` | Button started / stopped tracking |
| `I,<text>` | Any message, shown in the app log |

Python sends back `K,H` / `K,I` (which knee) and `START` / `STOP`. Until an `R` line arrives, Python finds
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

`client/useRihab.js` is a React hook wrapping all of this; `client/LiveSession.jsx` is a working example screen.

**WebSocket** `ws://localhost:8000/ws`
- Server → app: `snapshot` (on connect and each new workout), `state`, `sample` (≤30/s), `rep`, `comparison`, `log`
- App → server: `start_workout {patient, injury?, performed_at?}`, `end_workout`, `set_knee {knee}`, `start`, `stop`, `vision {angle}`

**REST** `http://localhost:8000/api`
- `GET /progress?patient=Alex` (one row per analysed workout, oldest first), `GET /workouts?patient=`, `GET /workouts/{id}`
- `POST /workouts`, `PATCH /workouts/{id}`, `DELETE /workouts/{id}`
- `POST /vision {"angle": 92.5}`, `GET /state`, `GET /patients`, `POST /command`

## Files

```
docker-compose.yml   (repo root) Postgres + optional Adminer / API container
.env.example         (repo root) database login
backend/
  rihab_server.py    FastAPI app, serial reader, simulator, WebSocket
  analysis.py        rep detection + healthy vs injured comparison
  db.py              SQLAlchemy models + every query
  seed.py            backdated demo history
  client/            useRihab.js hook + LiveSession.jsx example for app/
  tests/             pytest suite
```
