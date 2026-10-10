// braceSource.ts — the one interface both the REAL brace and the FAKE brace implement.
// The UI only ever talks to a BraceSource, so swapping fake ↔ real is a one-line change.

import type { BraceReading, CommandName } from "./protocol";

export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface BraceSource {
  readonly kind: "real" | "mock";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(name: CommandName, rateHz?: number): Promise<void>;
  /** Subscribe to readings. Returns an unsubscribe function. */
  onReading(cb: (r: BraceReading) => void): () => void;
  onStateChange(cb: (s: ConnectionState) => void): () => void;
}

/** Tiny event helper shared by both implementations. */
export class Emitter<T> {
  private listeners = new Set<(v: T) => void>();
  on(cb: (v: T) => void) {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }
  emit(v: T) {
    this.listeners.forEach((cb) => cb(v));
  }
}
