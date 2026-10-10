# Knee Brace BLE Protocol — v1

This file is the **contract** between the firmware team (C) and the app team (TypeScript).
If you change anything here, bump `PROTOCOL_VERSION` and update **both** `firmware/src/packet.h`
and `app/src/lib/protocol.ts` in the same commit.

---

## 1. Device

| Item | Value |
|---|---|
| Advertised name | `KneeBrace` (app filters by this prefix) |
| Protocol version | `1` |
| Byte order | **Little-endian** for every multi-byte number |
| Default stream rate | 25 packets / second (every 40 ms) |

## 2. GATT Service & Characteristics

All UUIDs share one base so they're easy to recognize: `9750XXXX-6e89-41d9-a349-c37ec4c16ea3`

| Name | UUID | Properties | Direction | Purpose |
|---|---|---|---|---|
| **Brace Service** | `97500001-6e89-41d9-a349-c37ec4c16ea3` | — | — | Groups everything below |
| **Sensor Data** | `97500002-6e89-41d9-a349-c37ec4c16ea3` | Notify | Brace → App | 16-byte reading packet (§3) |
| **Control** | `97500003-6e89-41d9-a349-c37ec4c16ea3` | Write | App → Brace | Commands (§4) |
| **Status** | `97500004-6e89-41d9-a349-c37ec4c16ea3` | Read, Notify | Brace → App | 4-byte status (§5) |

## 3. Sensor Data packet (16 bytes)

16 bytes fits inside the default BLE payload limit of 20 bytes (MTU 23 − 3 header bytes),
so no MTU negotiation is needed.

| Offset | Size | Type | Field | Units / scaling | Example |
|---|---|---|---|---|---|
| 0 | 1 | `uint8` | `version` | always `1` for this spec | `0x01` |
| 1 | 1 | `uint8` | `flags` | bit field, see below | `0x03` |
| 2 | 2 | `uint16` | `seq` | packet counter, wraps 65535 → 0 | `1042` |
| 4 | 4 | `uint32` | `timestampMs` | ms since brace powered on | `61250` |
| 8 | 2 | `int16` | `kneeAngle` | degrees × 10 (0 = straight leg) | `452` → 45.2° |
| 10 | 2 | `uint16` | `emgLevel` | ‰ of calibrated max effort, 0–1000 | `375` → 37.5 % |
| 12 | 2 | `int16` | `skinTemp` | °C × 100 | `3312` → 33.12 °C |
| 14 | 1 | `uint8` | `battery` | percent 0–100 | `87` |
| 15 | 1 | `uint8` | `reserved` | send `0`, ignore on read | `0` |

**Why scaled integers instead of floats?** Floats are 4 bytes and their layout can differ between
compilers. An `int16` storing "angle × 10" is 2 bytes and gives 0.1° precision — plenty.

### `flags` bits

| Bit | Mask | Meaning when set |
|---|---|---|
| 0 | `0x01` | Angle is calibrated |
| 1 | `0x02` | EMG is calibrated (has a max-effort reference) |
| 2 | `0x04` | EMG electrode contact is poor — ignore `emgLevel` |
| 3 | `0x08` | Battery low (< 15 %) |
| 4–7 | — | Reserved, send `0` |

## 4. Control commands (App → Brace)

First byte = command ID. Some commands take extra bytes.

| ID | Name | Extra bytes | What the brace does |
|---|---|---|---|
| `0x01` | `START_STREAM` | — | Begin sending Sensor Data notifications |
| `0x02` | `STOP_STREAM` | — | Stop sending |
| `0x10` | `CAL_STRAIGHT` | — | Current leg position = 0° |
| `0x11` | `CAL_BENT` | — | Record max bend (for range-of-motion baseline) |
| `0x12` | `CAL_EMG_MAX` | — | Record next 3 s of EMG; peak = 100 % |
| `0x20` | `SET_RATE` | 1 byte: Hz (1–50) | Change stream rate |

## 5. Status packet (4 bytes)

| Offset | Size | Type | Field |
|---|---|---|---|
| 0 | 1 | `uint8` | `version` |
| 1 | 1 | `uint8` | `state` — 0 idle, 1 streaming, 2 calibrating, 3 error |
| 2 | 1 | `uint8` | `battery` % |
| 3 | 1 | `uint8` | `lastError` code (0 = none) |

## 6. Worked example

Bytes on the wire (hex):

```
01 03 12 04 42 EF 00 00 C4 01 77 01 F0 0C 57 00
```

| Bytes | Field | Decoded |
|---|---|---|
| `01` | version | 1 |
| `03` | flags | angle + EMG calibrated |
| `12 04` | seq | 0x0412 = 1042 |
| `42 EF 00 00` | timestampMs | 0x0000EF42 = 61250 ms |
| `C4 01` | kneeAngle | 0x01C4 = 452 → **45.2°** |
| `77 01` | emgLevel | 0x0177 = 375 → **37.5 %** |
| `F0 0C` | skinTemp | 0x0CF0 = 3312 → **33.12 °C** |
| `57` | battery | **87 %** |
| `00` | reserved | — |

Notice little-endian: `12 04` means 0x**04**12, low byte first.

## 7. Rules both sides follow

1. **Reject** any packet whose length ≠ 16 or `version` ≠ 1 (log it, don't crash).
2. Use `seq` to **detect dropped packets** (gap > 1 = drops). Don't treat drops as errors.
3. Use the brace's `timestampMs` for charts, not the phone's clock — BLE delivers in bursts.
4. Never add a field by changing an existing offset. Use `reserved`, or make v2.
