# Knee Brace USB Serial Protocol (Arduino Uno prototype)

Used while the prototype is an **Arduino Uno**, which has no Bluetooth. Same fields and scaling as
the BLE packet in `ble-protocol.md`, sent as readable text so you can watch it in the Serial Monitor.

| Setting | Value |
|---|---|
| Baud rate | 115200 |
| Line ending | `\n` (a `\r` before it is OK) |
| Rate | 25 lines per second |

## Arduino → PC

```
D,<seq>,<ms>,<angle_x10>,<emg_x10>,<temp_x100>,<battery>,<flags>
```

| Field | Meaning | Example |
|---|---|---|
| `D` | data line marker | `D` |
| `seq` | packet counter (restarts at 0 when the Uno resets) | `1042` |
| `ms` | ms since the Uno started | `61250` |
| `angle_x10` | knee angle × 10, 0 = straight | `452` → 45.2° |
| `emg_x10` | muscle activation % × 10 (0 until an EMG sensor is added) | `0` |
| `temp_x100` | skin temp °C × 100 (0 until a temp sensor is added) | `0` |
| `battery` | percent (always 100 on USB) | `100` |
| `flags` | same bits as BLE: 1 = angle calibrated, 2 = EMG calibrated, 4 = EMG poor contact, 8 = battery low | `1` |

Lines starting with `#` are log messages (e.g. `# accelerometer: LIS3DHTR`). The server (`backend/rihab_server.py`) shows them in the dashboard's Device log, including ones printed before the dashboard was opened.

## PC → Arduino

One character, then a newline.

| Char | App command | Effect |
|---|---|---|
| `c` | `calStraight` | Current position = 0° (also resets max and reps) |
| `r` | — | Reset max and reps |
| `s` | `startStream` | Start sending data lines (on by default) |
| `x` | `stopStream` | Stop sending |

## How the angle is measured

One accelerometer is strapped to the **shin**. The knee angle is the angle between gravity now and gravity at calibration, when the leg was straight. This is accurate for movements where the thigh stays still, such as seated knee extensions, heel slides lying down or standing hamstring curls. For full squats, where the thigh also moves, you need a second accelerometer on the thigh.
