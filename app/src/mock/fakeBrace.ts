// fakeBrace.ts — a pretend brace so the app team can build without hardware.
//
// Important: it doesn't hand the app nice JS objects directly. It builds REAL 16-byte packets
// with encodeSensorPacket(), then decodes them with decodeSensorPacket() — the exact same
// path real Bluetooth data takes. If the decoder has a bug, you'll find it here first.

import { Emitter, type BraceSource, type ConnectionState } from "../lib/braceSource";
import {
  decodeSensorPacket,
  encodeSensorPacket,
  type BraceReading,
  type CommandName,
} from "../lib/protocol";

export type Scenario = "healthy" | "stiff" | "weakQuad";

export interface FakeBraceOptions {
  scenario?: Scenario;  // shape of the simulated knee
  rateHz?: number;      // packets per second (default 25, same as firmware)
  dropRate?: number;    // 0–1, chance a packet is "lost in the air" (default 0.02)
  seed?: number;        // same seed → same data every run (great for tests/demos)
}

// How each scenario behaves. Numbers are rough & for demo only — not clinical.
const PROFILES: Record<Scenario, { maxBend: number; emgPeak: number; repSeconds: number }> = {
  healthy:  { maxBend: 130, emgPeak: 70, repSeconds: 3 },
  stiff:    { maxBend: 85,  emgPeak: 60, repSeconds: 4 },   // limited range of motion
  weakQuad: { maxBend: 120, emgPeak: 30, repSeconds: 3.5 }, // low muscle activation
};

export class FakeBrace implements BraceSource {
  readonly kind = "mock" as const;
  private readings = new Emitter<BraceReading>();
  private states = new Emitter<ConnectionState>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private startedAt = 0;
  private battery = 100;
  private angleCalibrated = false;
  private emgCalibrated = false;
  private rand: () => number;

  /** Every packet's raw bytes, for debugging (e.g. print with toHex). */
  onRawPacket?: (bytes: Uint8Array) => void;

  constructor(private opts: FakeBraceOptions = {}) {
    this.rand = mulberry32(opts.seed ?? Date.now());
  }

  async connect() {
    this.states.emit("connecting");
    await sleep(300); // pretend pairing takes a moment
    this.startedAt = Date.now();
    this.states.emit("connected");
  }

  async disconnect() {
    this.stop();
    this.states.emit("disconnected");
  }

  async sendCommand(name: CommandName, rateHz?: number) {
    switch (name) {
      case "startStream": return this.start();
      case "stopStream":  return this.stop();
      case "calStraight":
      case "calBent":     this.angleCalibrated = true; return;
      case "calEmgMax":   await sleep(3000); this.emgCalibrated = true; return;
      case "setRate":     this.opts.rateHz = rateHz; if (this.timer) { this.stop(); this.start(); } return;
    }
  }

  onReading(cb: (r: BraceReading) => void) { return this.readings.on(cb); }
  onStateChange(cb: (s: ConnectionState) => void) { return this.states.on(cb); }

  /** Change scenario mid-demo, e.g. to show the "stiff knee" advice. */
  setScenario(s: Scenario) { this.opts.scenario = s; }

  // ---- internals ----

  private start() {
    if (this.timer) return;
    const intervalMs = 1000 / (this.opts.rateHz ?? 25);
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick() {
    const t = (Date.now() - this.startedAt) / 1000;
    const p = PROFILES[this.opts.scenario ?? "healthy"];
    const noise = (amp: number) => (this.rand() - 0.5) * 2 * amp;

    // Knee bends and straightens like slow squats: smooth 0 → maxBend → 0 wave.
    const phase = (t % p.repSeconds) / p.repSeconds;
    const bend = (1 - Math.cos(phase * 2 * Math.PI)) / 2; // 0..1
    const kneeAngleDeg = bend * p.maxBend + noise(1.5);

    // Quad works hardest when the knee is most bent.
    const emgPercent = Math.max(0, 5 + bend * p.emgPeak + noise(4));

    // Skin warms slowly during exercise.
    const skinTempC = 32.5 + Math.min(1.5, t / 120) + noise(0.05);

    this.battery = Math.max(0, this.battery - 0.0005);

    const reading: BraceReading = {
      seq: this.seq,
      timestampMs: Math.round(t * 1000),
      kneeAngleDeg,
      emgPercent,
      skinTempC,
      batteryPct: this.battery,
      angleCalibrated: this.angleCalibrated,
      emgCalibrated: this.emgCalibrated,
      emgPoorContact: this.rand() < 0.01, // occasional electrode glitch
      batteryLow: this.battery < 15,
    };
    this.seq = (this.seq + 1) & 0xffff;

    // Simulate radio loss: seq still advances, packet never arrives.
    if (this.rand() < (this.opts.dropRate ?? 0.02)) return;

    const bytes = encodeSensorPacket(reading);   // → 16 bytes, like the C firmware sends
    this.onRawPacket?.(bytes);
    this.readings.emit(decodeSensorPacket(bytes)); // ← same decoder the real brace uses
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Small seeded random generator so demos are repeatable.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
