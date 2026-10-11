// packet.h — firmware side of docs/ble-protocol.md (v1)
// The app side of BLE (app/src/lib/protocol.ts) isn't built yet; the Uno prototype uses USB serial instead
// (docs/serial-protocol.md, read by backend/rihab_server.py).
#pragma once
#include <stdint.h>
#include <string.h>

#define PROTOCOL_VERSION 1
#define SENSOR_PACKET_SIZE 16

// Paste these into your BLE library (NimBLE / ArduinoBLE / Bluefruit).
#define BRACE_SERVICE_UUID  "97500001-6e89-41d9-a349-c37ec4c16ea3"
#define SENSOR_DATA_UUID    "97500002-6e89-41d9-a349-c37ec4c16ea3"
#define CONTROL_UUID        "97500003-6e89-41d9-a349-c37ec4c16ea3"
#define STATUS_UUID         "97500004-6e89-41d9-a349-c37ec4c16ea3"

// flags bits
#define FLAG_ANGLE_CAL   0x01
#define FLAG_EMG_CAL     0x02
#define FLAG_EMG_POOR    0x04
#define FLAG_BATT_LOW    0x08

// control command IDs
#define CMD_START_STREAM 0x01
#define CMD_STOP_STREAM  0x02
#define CMD_CAL_STRAIGHT 0x10
#define CMD_CAL_BENT     0x11
#define CMD_CAL_EMG_MAX  0x12
#define CMD_SET_RATE     0x20

typedef struct {
  uint8_t  flags;
  uint16_t seq;
  uint32_t timestamp_ms;
  float    knee_angle_deg;  // e.g. 45.2
  float    emg_percent;     // 0..100
  float    skin_temp_c;     // e.g. 33.12
  uint8_t  battery_pct;
} SensorReading;

// Little-endian writers. We write byte-by-byte instead of memcpy'ing a struct
// so compiler padding / CPU endianness can never break the contract.
static inline void put_u16(uint8_t *p, uint16_t v) { p[0] = v & 0xFF; p[1] = v >> 8; }
static inline void put_u32(uint8_t *p, uint32_t v) {
  p[0] = v & 0xFF; p[1] = (v >> 8) & 0xFF; p[2] = (v >> 16) & 0xFF; p[3] = v >> 24;
}
static inline int16_t clamp_i16(float v) { return v > 32767 ? 32767 : v < -32768 ? -32768 : (int16_t)v; }

// Fill `out` (16 bytes) from a reading. Call this, then notify SENSOR_DATA_UUID with `out`.
static inline void encode_sensor_packet(const SensorReading *r, uint8_t out[SENSOR_PACKET_SIZE]) {
  memset(out, 0, SENSOR_PACKET_SIZE);
  out[0] = PROTOCOL_VERSION;
  out[1] = r->flags;
  put_u16(out + 2, r->seq);
  put_u32(out + 4, r->timestamp_ms);
  put_u16(out + 8, (uint16_t)clamp_i16(r->knee_angle_deg * 10.0f + (r->knee_angle_deg >= 0 ? 0.5f : -0.5f)));
  float emg = r->emg_percent < 0 ? 0 : r->emg_percent > 100 ? 100 : r->emg_percent;
  put_u16(out + 10, (uint16_t)(emg * 10.0f + 0.5f));
  put_u16(out + 12, (uint16_t)clamp_i16(r->skin_temp_c * 100.0f + 0.5f));
  out[14] = r->battery_pct;
  out[15] = 0; // reserved
}

/* Usage sketch (Arduino-style loop, 25 Hz):
 *
 *   static uint16_t seq = 0;
 *   SensorReading r = {
 *     .flags = FLAG_ANGLE_CAL, .seq = seq++, .timestamp_ms = millis(),
 *     .knee_angle_deg = readKneeAngle(), .emg_percent = readEmgPercent(),
 *     .skin_temp_c = readTemp(), .battery_pct = readBattery()
 *   };
 *   uint8_t buf[SENSOR_PACKET_SIZE];
 *   encode_sensor_packet(&r, buf);
 *   sensorDataChar.notify(buf, SENSOR_PACKET_SIZE);
 *   delay(40);
 */
