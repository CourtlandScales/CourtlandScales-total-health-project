// useRihab.js — connects React to the RiHab server (backend/rihab_server.py).
//
//   const rihab = useRihab();            // live state over ws://localhost:8000/ws
//   rihab.startWorkout("Alex");          // or startWorkout("Alex", { performedAt: "2026-09-30T18:00" })
//   rihab.start(); rihab.setKnee("injured"); rihab.stop(); rihab.endWorkout();
//   const rows = await api.progress("Alex");   // REST helpers for history screens
//
// Times from the server are ISO strings with a timezone; `new Date(x)` shows them in local time.

import { useCallback, useEffect, useRef, useState } from "react";

export const SERVER = "http://localhost:8000";
const WS_URL = SERVER.replace(/^http/, "ws") + "/ws";
const SAMPLE_HISTORY = 30 * 20; // ~20 s of live angle at 30 samples/s
const LOG_HISTORY = 50;

export function useRihab({ url = WS_URL } = {}) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(null);           // source, connected, port, patient, workout_id, knee, tracking
  const [workout, setWorkout] = useState(null);       // current workout row (with measurements)
  const [reps, setReps] = useState([]);               // reps in the current workout, oldest first
  const [comparison, setComparison] = useState(null); // angle_pct, speed_pct, flux_pct, score, status, summary
  const [progress, setProgress] = useState([]);       // one row per analysed workout for this patient
  const [logs, setLogs] = useState([]);
  const [samples, setSamples] = useState([]);         // [{t, angle, ax, ay, az, knee, tracking}]
  const wsRef = useRef(null);
  const sampleBuf = useRef([]);

  useEffect(() => {
    let ws, retry, frame, closed = false, delay = 500;

    // Samples arrive up to 30 times a second; push them to React once per animation frame.
    const flush = () => {
      frame = requestAnimationFrame(flush);
      if (sampleBuf.current.length) {
        const fresh = sampleBuf.current;
        sampleBuf.current = [];
        setSamples((s) => s.concat(fresh).slice(-SAMPLE_HISTORY));
      }
    };
    frame = requestAnimationFrame(flush);

    const connect = () => {
      ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); delay = 500; };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, (delay = Math.min(delay * 2, 5000)));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case "snapshot":
            setState(msg.state);
            setWorkout(msg.workout);
            setReps(msg.workout?.measurements ?? []);
            setComparison(msg.comparison);
            setProgress(msg.progress);
            break;
          case "state":
            setState(msg);
            break;
          case "sample":
            sampleBuf.current.push(msg);
            break;
          case "rep":
            setReps((r) => [...r, msg]);
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
      cancelAnimationFrame(frame);
      ws?.close();
    };
  }, [url]);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else console.warn("RiHab server not connected; dropped", msg);
  }, []);

  return {
    connected, state, workout, reps, comparison, progress, logs, samples,
    latest: samples[samples.length - 1] ?? null,
    /** performedAt: optional past date-time to backdate, e.g. "2026-09-30T18:00" (local time). */
    startWorkout: (patient, { injury, performedAt } = {}) =>
      send({ type: "start_workout", patient, injury, performed_at: performedAt || undefined }),
    endWorkout: () => send({ type: "end_workout" }),
    setKnee: (knee) => send({ type: "set_knee", knee }), // "healthy" | "injured"
    start: () => send({ type: "start" }),
    stop: () => send({ type: "stop" }),
    vision: (angle) => send({ type: "vision", angle }),
  };
}

async function request(path, options = {}) {
  const res = await fetch(SERVER + "/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const q = (patient) => (patient ? `?patient=${encodeURIComponent(patient)}` : "");

/** REST helpers for history / progress screens. */
export const api = {
  progress: (patient) => request("/progress" + q(patient)),
  workouts: (patient) => request("/workouts" + q(patient)),
  workout: (id) => request(`/workouts/${id}`),
  patients: () => request("/patients"),
  state: () => request("/state"),
  /** Enter a past workout by hand: {patient, performed_at, measurements: [{knee, rom_deg, duration_s, flux?, measured_at?}]} */
  createWorkout: (body) => request("/workouts", { method: "POST", body }),
  moveWorkout: (id, performedAt) => request(`/workouts/${id}`, { method: "PATCH", body: { performed_at: performedAt } }),
  deleteWorkout: (id) => request(`/workouts/${id}`, { method: "DELETE" }),
};
