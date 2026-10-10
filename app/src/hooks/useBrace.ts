"use client";
// useBrace.ts — React hook the UI uses. It doesn't know or care whether the brace is real or fake.
//
// Switch with an env var in app/.env.local:
//   NEXT_PUBLIC_USE_MOCK_BRACE=true    ← fake data (default while hardware isn't ready)
//   NEXT_PUBLIC_USE_MOCK_BRACE=false   ← real brace over Bluetooth

import { useCallback, useEffect, useRef, useState } from "react";
import type { BraceSource, ConnectionState } from "../lib/braceSource";
import { droppedBetween, type BraceReading, type CommandName } from "../lib/protocol";
import { WebBluetoothBrace } from "../lib/webBluetoothBrace";
import { FakeBrace } from "../mock/fakeBrace";

const HISTORY_SIZE = 25 * 30; // keep last ~30 s at 25 Hz for charts

function createSource(): BraceSource {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_BRACE !== "false";
  return useMock ? new FakeBrace({ scenario: "healthy" }) : new WebBluetoothBrace();
}

export function useBrace() {
  const sourceRef = useRef<BraceSource | null>(null);
  if (!sourceRef.current) sourceRef.current = createSource();
  const source = sourceRef.current;

  const [state, setState] = useState<ConnectionState>("disconnected");
  const [latest, setLatest] = useState<BraceReading | null>(null);
  const [history, setHistory] = useState<BraceReading[]>([]);
  const [dropped, setDropped] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastSeq = useRef<number | null>(null);

  useEffect(() => {
    const offState = source.onStateChange(setState);
    const offReading = source.onReading((r) => {
      if (lastSeq.current !== null) {
        const gap = droppedBetween(lastSeq.current, r.seq);
        if (gap > 0) setDropped((d) => d + gap);
      }
      lastSeq.current = r.seq;
      setLatest(r);
      setHistory((h) => (h.length >= HISTORY_SIZE ? [...h.slice(1), r] : [...h, r]));
    });
    return () => { offState(); offReading(); };
  }, [source]);

  /** Call from an onClick. Connects and starts streaming. */
  const connect = useCallback(async () => {
    setError(null);
    try {
      await source.connect();
      await source.sendCommand("startStream");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [source]);

  const disconnect = useCallback(() => source.disconnect(), [source]);
  const send = useCallback((c: CommandName, rateHz?: number) => source.sendCommand(c, rateHz), [source]);

  return { kind: source.kind, state, latest, history, dropped, error, connect, disconnect, send, source };
}

/* Example page usage (app/src/app/page.tsx):

"use client";
import { useBrace } from "@/hooks/useBrace";

export default function Page() {
  const { kind, state, latest, dropped, error, connect, send } = useBrace();
  return (
    <main>
      <p>Source: {kind} · {state} · dropped packets: {dropped}</p>
      {state !== "connected" && <button onClick={connect}>Connect brace</button>}
      <button onClick={() => send("calStraight")}>Calibrate: leg straight</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {latest && (
        <ul>
          <li>Knee angle: {latest.kneeAngleDeg.toFixed(1)}°</li>
          <li>Muscle activation: {latest.emgPercent.toFixed(1)}%</li>
          <li>Skin temp: {latest.skinTempC.toFixed(2)} °C</li>
          <li>Battery: {latest.batteryPct}%</li>
        </ul>
      )}
    </main>
  );
}
*/
