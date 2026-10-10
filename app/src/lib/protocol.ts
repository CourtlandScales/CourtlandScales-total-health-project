// protocol.ts — app side of docs/ble-protocol.md (v1)
// Turns raw bytes from the brace into a typed object (decode), and back (encode, used by the mock).

export const PROTOCOL_VERSION = 1;
export const SENSOR_PACKET_SIZE = 16;

export const UUIDS = {
  service: "97500001-6e89-41d9-a349-c37ec4c16ea3",
  sensorData: "97500002-6e89-41d9-a349-c37ec4c16ea3",
  control: "97500003-6e89-41d9-a349-c37ec4c16ea3",
  status: "97500004-6e89-41d9-a349-c37ec4c16ea3",
} as const;

export const FLAGS = {
  angleCalibrated: 0x01,
  emgCalibrated: 0x02,
  emgPoorContact: 0x04,
  batteryLow: 0x08,
} as const;

export const COMMANDS = {
  startStream: 0x01,
  stopStream: 0x02,
  calStraight: 0x10,
  calBent: 0x11,
  calEmgMax: 0x12,
  setRate: 0x20,
} as const;
export type CommandName = keyof typeof COMMANDS;

/** One decoded reading, in human units. This is what the rest of the app uses. */
export interface BraceReading {
  seq: number;
  timestampMs: number;
  kneeAngleDeg: number;   // 0 = straight
  emgPercent: number;     // 0–100 % of calibrated max effort
  skinTempC: number;
  batteryPct: number;
  angleCalibrated: boolean;
  emgCalibrated: boolean;
  emgPoorContact: boolean;
  batteryLow: boolean;
}

export class ProtocolError extends Error {}

/**
 * Decode one 16-byte Sensor Data packet.
 * Accepts the DataView that Web Bluetooth gives you (characteristic.value),
 * or a Uint8Array / ArrayBuffer.
 */
export function decodeSensorPacket(input: DataView | ArrayBuffer | Uint8Array): BraceReading {
  const view =
    input instanceof DataView
      ? input
      : input instanceof Uint8Array
        ? new DataView(input.buffer, input.byteOffset, input.byteLength)
        : new DataView(input);

  if (view.byteLength !== SENSOR_PACKET_SIZE) {
    throw new ProtocolError(`Expected ${SENSOR_PACKET_SIZE} bytes, got ${view.byteLength}`);
  }
  const version = view.getUint8(0);
  if (version !== PROTOCOL_VERSION) {
    throw new ProtocolError(`Unsupported protocol version ${version}`);
  }

  const LE = true; // little-endian — the 2nd arg to every get* call below
  const flags = view.getUint8(1);
  return {
    seq: view.getUint16(2, LE),
    timestampMs: view.getUint32(4, LE),
    kneeAngleDeg: view.getInt16(8, LE) / 10,
    emgPercent: view.getUint16(10, LE) / 10,
    skinTempC: view.getInt16(12, LE) / 100,
    batteryPct: view.getUint8(14),
    angleCalibrated: (flags & FLAGS.angleCalibrated) !== 0,
    emgCalibrated: (flags & FLAGS.emgCalibrated) !== 0,
    emgPoorContact: (flags & FLAGS.emgPoorContact) !== 0,
    batteryLow: (flags & FLAGS.batteryLow) !== 0,
  };
}

/** Encode a reading into 16 bytes. Mirror of the C encoder — the mock brace uses this. */
export function encodeSensorPacket(r: BraceReading): Uint8Array {
  const buf = new Uint8Array(SENSOR_PACKET_SIZE);
  const view = new DataView(buf.buffer);
  const LE = true;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  let flags = 0;
  if (r.angleCalibrated) flags |= FLAGS.angleCalibrated;
  if (r.emgCalibrated) flags |= FLAGS.emgCalibrated;
  if (r.emgPoorContact) flags |= FLAGS.emgPoorContact;
  if (r.batteryLow) flags |= FLAGS.batteryLow;

  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, flags);
  view.setUint16(2, r.seq & 0xffff, LE);
  view.setUint32(4, r.timestampMs >>> 0, LE);
  view.setInt16(8, clamp(Math.round(r.kneeAngleDeg * 10), -32768, 32767), LE);
  view.setUint16(10, clamp(Math.round(r.emgPercent * 10), 0, 1000), LE);
  view.setInt16(12, clamp(Math.round(r.skinTempC * 100), -32768, 32767), LE);
  view.setUint8(14, clamp(Math.round(r.batteryPct), 0, 100));
  view.setUint8(15, 0);
  return buf;
}

/** Build the bytes to write to the Control characteristic. */
export function encodeCommand(name: CommandName, rateHz?: number): Uint8Array {
  if (name === "setRate") {
    if (rateHz === undefined || rateHz < 1 || rateHz > 50) throw new ProtocolError("rateHz must be 1–50");
    return new Uint8Array([COMMANDS.setRate, rateHz]);
  }
  return new Uint8Array([COMMANDS[name]]);
}

/** How many packets were lost between two sequence numbers (handles 65535 → 0 wrap). */
export function droppedBetween(prevSeq: number, seq: number): number {
  return ((seq - prevSeq + 0x10000) & 0xffff) - 1;
}

/** Handy for debugging: "01 03 12 04 ..." */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}
