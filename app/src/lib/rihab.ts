// rihab.ts — connects the app to the RiHab server (backend/rihab_server.py).
//
//   const rihab = useRihab();            // live state over ws://localhost:8000/ws
//   rihab.startWorkout("Alex");          // or startWorkout("Alex", { performedAt: "2026-09-30T18:00" })
//   rihab.start(); rihab.setKnee("injured"); rihab.stop(); rihab.endWorkout();
//
// Times from the server are ISO strings with a timezone; `new Date(x)` shows them in local time.
// Point the app at another server with VITE_RIHAB_SERVER=http://host:port in app/.env.local.

import { useCallback, useEffect, useRef, useState } from "react";

export const SERVER: string = import.meta.env.VITE_RIHAB_SERVER ?? "http://localhost:8000";
const WS_URL = SERVER.replace(/^http/, "ws") + "/ws";
const SAMPLE_HISTORY = 30 * 20; // ~20 s of live angle at 30 samples/s
const LOG_HISTORY = 50;
// The displayed angle is smoothed, and only changes once it has moved a whole degree. At rest the sensor
// jitters by about ±0.5° (the simulator models this too), which otherwise makes the number flicker 0 -> 1 -> 2.
const ANGLE_SMOOTHING = 0.25;   // 0..1 per sample, lower = steadier but slower (0.25 at 30/s ≈ 0.1 s lag)
const ANGLE_STEP_DEG = 1;

/** Next displayed angle: keep the current one unless the smoothed angle has moved at least ANGLE_STEP_DEG. */
export function steadyAngle(shown: number | null, smoothed: number): number {
  return shown != null && Math.abs(smoothed - shown) < ANGLE_STEP_DEG ? shown : Math.round(smoothed);
}

export type Knee = "healthy" | "injured";

// Bits in Sample.flags (same as the BLE protocol)
export const FLAG_ANGLE_CAL = 0x01;
export const FLAG_EMG_POOR = 0x04;
export const FLAG_BATT_LOW = 0x08;

export interface ServerState {
  source: "serial" | "sim";
  connected: boolean;        // is the Arduino (or simulator) attached
  port: string | null;
  patient: string;
  workout_id: number | null;
  performed_at: string | null;
  knee: Knee;
  tracking: boolean;
  rep_mode: "device" | "python";
}

export interface Sample {
  t: number;                 // device seconds
  angle: number;             // degrees, 0 = straight
  ax: number | null;
  ay: number | null;
  az: number | null;
  emg: number | null;        // muscle activation %, null without an EMG sensor
  temp: number | null;       // skin °C, null without a temperature sensor
  battery: number | null;    // %, null when the source doesn't report it
  flags: number | null;
  knee: Knee;
  tracking: boolean;
}

export interface Measurement {
  id: number;
  workout_id: number;
  measured_at: string;
  knee: Knee;
  rom_deg: number;
  duration_s: number;
  flux: number | null;
  vision_rom_deg: number | null;
  source: "device" | "python" | "manual";
}

export interface Workout {
  id: number;
  patient: string;
  patient_id: number;
  injury: string | null;
  performed_at: string;
  recorded_at: string;
  is_backdated: boolean;
  healthy_reps: number;
  injured_reps: number;
  angle_pct: number | null;
  speed_pct: number | null;
  flux_pct: number | null;
  score: number | null;
  status: string | null;
  summary: string | null;
  baseline_from: string | null;
  feeling: number | null;    // post-workout check-in, 1 (very uncomfortable) to 10 (felt great)
  measurements?: Measurement[];
}

export interface Comparison {
  workout_id: number;
  healthy_rom_deg: number;
  injured_rom_deg: number;
  healthy_time_s: number;
  injured_time_s: number;
  healthy_flux: number | null;
  injured_flux: number | null;
  angle_pct: number;
  speed_pct: number;
  flux_pct: number | null;
  score: number;
  status: string;
  summary: string;
  healthy_reps_used: number;
  injured_reps_used: number;
  baseline_from: string | null;
}

export type ProgressRow = Pick<
  Workout,
  "id" | "performed_at" | "is_backdated" | "angle_pct" | "speed_pct" | "flux_pct" | "score" | "status" | "injured_reps" | "baseline_from" | "feeling"
>;

export interface LogEntry {
  level: "info" | "warn" | "error";
  text: string;
  at: string;
}

type ServerMessage =
  | { type: "snapshot"; state: ServerState; workout: Workout | null; comparison: Comparison | null; progress: ProgressRow[]; logs?: LogEntry[] }
  | ({ type: "state" } & ServerState)
  | ({ type: "sample" } & Sample)
  | ({ type: "rep" } & Measurement)
  | ({ type: "comparison" } & Comparison)
  | ({ type: "log" } & LogEntry);

export function useRihab({ url = WS_URL } = {}) {
  const [connected, setConnected] = useState(false);   // is the browser connected to the server
  const [state, setState] = useState<ServerState | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [reps, setReps] = useState<Measurement[]>([]);  // reps in the current workout, oldest first
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [history, setHistory] = useState<Workout[]>([]); // every workout for this patient, newest first
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [angle, setAngle] = useState<number | null>(null); // live knee angle for display, whole degrees
  const wsRef = useRef<WebSocket | null>(null);
  const sampleBuf = useRef<Sample[]>([]);
  const smoothed = useRef<number | null>(null);
  const patientRef = useRef<string | null>(null);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Rep counts per workout live in the database; refetch shortly after anything changes them.
  const refreshHistory = useCallback(() => {
    clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => {
      const patient = patientRef.current;
      if (!patient) return;
      api.workouts(patient).then(setHistory).catch((e) => console.warn("RiHab: couldn't load workouts", e));
    }, 300);
  }, []);

  useEffect(() => {
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let frame: number;
    let closed = false;
    let delay = 500;

    // Samples arrive up to 30 times a second; push them to React once per animation frame.
    const flush = () => {
      frame = requestAnimationFrame(flush);
      if (sampleBuf.current.length) {
        const fresh = sampleBuf.current;
        sampleBuf.current = [];
        setSamples((s) => s.concat(fresh).slice(-SAMPLE_HISTORY));
        let ema = smoothed.current;
        for (const { angle: a } of fresh) ema = ema == null ? a : ema + ANGLE_SMOOTHING * (a - ema);
        smoothed.current = ema;
        setAngle((shown) => steadyAngle(shown, ema!));
      }
    };
    frame = requestAnimationFrame(flush);

    const onState = (s: ServerState) => {
      setState(s);
      if (s.patient !== patientRef.current) {
        patientRef.current = s.patient;
        refreshHistory();
      }
    };

    const connect = () => {
      ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        delay = 500;
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, (delay = Math.min(delay * 2, 5000)));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as ServerMessage;
        switch (msg.type) {
          case "snapshot":
            onState(msg.state);
            setWorkout(msg.workout);
            setReps(msg.workout?.measurements ?? []);
            setComparison(msg.comparison);
            setProgress(msg.progress);
            setLogs(msg.logs ?? []); // includes anything logged before we connected (older servers don't send it)
            refreshHistory();
            break;
          case "state":
            onState(msg);
            break;
          case "sample":
            sampleBuf.current.push(msg);
            break;
          case "rep":
            setReps((r) => [...r, msg]);
            refreshHistory();
            break;
          case "comparison":
            setComparison(msg);
            break;
          case "log":
            setLogs((l) => [...l.slice(-(LOG_HISTORY - 1)), msg]);
            break;
        }
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimeout(historyTimer.current);
      cancelAnimationFrame(frame);
      ws?.close();
    };
  }, [url, refreshHistory]);

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else console.warn("RiHab server not connected; dropped", msg);
  }, []);

  return {
    connected, state, workout, reps, comparison, progress, history, logs, samples, refreshHistory, angle,
    latest: samples[samples.length - 1] ?? null,
    /** performedAt: optional past date-time to backdate, e.g. "2026-09-30T18:00" (local time). */
    startWorkout: (patient: string, { injury, performedAt }: { injury?: string; performedAt?: string } = {}) =>
      send({ type: "start_workout", patient, injury, performed_at: performedAt || undefined }),
    endWorkout: () => send({ type: "end_workout" }),
    setKnee: (knee: Knee) => send({ type: "set_knee", knee }),
    start: () => send({ type: "start" }),
    stop: () => send({ type: "stop" }),
    /** Leg is straight right now: the brace re-zeroes its angle. */
    calibrate: () => send({ type: "calibrate" }),
    vision: (angle: number) => send({ type: "vision", angle }),
  };
}

export type Rihab = ReturnType<typeof useRihab>;

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(SERVER + "/api" + path, {
    method: options.method,
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

const q = (patient?: string) => (patient ? `?patient=${encodeURIComponent(patient)}` : "");

/** REST helpers for history / progress screens. */
export const api = {
  progress: (patient?: string) => request<ProgressRow[]>("/progress" + q(patient)),
  workouts: (patient?: string) => request<Workout[]>("/workouts" + q(patient)),
  workout: (id: number) => request<Workout>(`/workouts/${id}`),
  patients: () => request<{ id: number; name: string; injury: string | null }[]>("/patients"),
  /** Enter a past workout by hand. */
  createWorkout: (body: { patient: string; performed_at: string; injury?: string; measurements: Partial<Measurement>[] }) =>
    request<Workout>("/workouts", { method: "POST", body }),
  moveWorkout: (id: number, performedAt: string) =>
    request<Workout>(`/workouts/${id}`, { method: "PATCH", body: { performed_at: performedAt } }),
  /** Post-workout check-in, 1-10. Posting again overwrites it. */
  checkin: (id: number, score: number) =>
    request<Workout>(`/workouts/${id}/checkin`, { method: "POST", body: { score } }),
  deleteWorkout: (id: number) => request<null>(`/workouts/${id}`, { method: "DELETE" }),
};
