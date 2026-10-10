// LiveSession.jsx — a working example screen. Copy pieces into the real app.

import { useState } from "react";
import { useRihab } from "./useRihab";

const fmt = (v, digits = 0, suffix = "") => (v == null ? "—" : v.toFixed(digits) + suffix);
const signed = (v, suffix) => (v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(0) + suffix);

export default function LiveSession() {
  const r = useRihab();
  const [patient, setPatient] = useState("Alex");
  const [backdate, setBackdate] = useState(""); // "" = now
  const s = r.state;
  const inWorkout = !!s?.workout_id;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <p style={{ color: r.connected && s?.connected ? "green" : "crimson" }}>
        {!r.connected ? "Server offline (is rihab_server.py running?)"
          : !s?.connected ? "Server up, waiting for the Arduino…"
          : `Live from ${s.source === "sim" ? "simulator" : s.port} · reps measured by ${s.rep_mode}`}
      </p>

      {!inWorkout ? (
        <section style={row}>
          <input value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="Patient" />
          <input type="datetime-local" value={backdate} onChange={(e) => setBackdate(e.target.value)} title="Leave empty for now" />
          <button onClick={() => r.startWorkout(patient, { performedAt: backdate })}>New workout</button>
        </section>
      ) : (
        <section style={row}>
          <strong>{s.patient}</strong>
          <span>{new Date(s.performed_at).toLocaleString()}</span>
          {["healthy", "injured"].map((k) => (
            <button key={k} onClick={() => r.setKnee(k)} style={{ fontWeight: s.knee === k ? 700 : 400 }}>
              {k === "healthy" ? "Healthy knee" : "Injured knee"}
            </button>
          ))}
          {s.tracking ? <button onClick={r.stop}>Stop</button> : <button onClick={r.start}>Start</button>}
          <button onClick={r.endWorkout}>End workout</button>
        </section>
      )}

      <section style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ fontSize: 48, fontVariantNumeric: "tabular-nums" }}>{fmt(r.latest?.angle, 0, "°")}</div>
        <AngleTrace samples={r.samples} />
      </section>

      {r.comparison && (
        <section style={card}>
          <div style={{ fontSize: 28 }}>{r.comparison.score.toFixed(0)} / 100 · {r.comparison.status}</div>
          <p>{r.comparison.summary}</p>
          <div style={row}>
            <Stat label="Range vs healthy" value={fmt(r.comparison.angle_pct, 0, "%")} />
            <Stat label="Time per rep" value={signed(r.comparison.speed_pct, "%")} />
            <Stat label="Shakiness" value={signed(r.comparison.flux_pct, "%")} />
          </div>
          {r.comparison.baseline_from && (
            <small>Healthy baseline from {new Date(r.comparison.baseline_from).toLocaleDateString()}</small>
          )}
        </section>
      )}

      <h3>Reps this workout</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th align="left">Time</th><th align="left">Knee</th><th>ROM</th><th>Duration</th><th>Flux</th></tr></thead>
        <tbody>
          {[...r.reps].reverse().map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.measured_at).toLocaleTimeString()}</td>
              <td>{m.knee}</td>
              <td align="center">{fmt(m.rom_deg, 1, "°")}</td>
              <td align="center">{fmt(m.duration_s, 2, " s")}</td>
              <td align="center">{fmt(m.flux, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Recovery so far ({r.progress.length} workouts)</h3>
      <ProgressBars rows={r.progress} />

      <details>
        <summary>Log</summary>
        <pre style={{ fontSize: 12 }}>{r.logs.map((l) => `${l.level}: ${l.text}`).join("\n")}</pre>
      </details>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 22 }}>{value}</div>
      <small>{label}</small>
    </div>
  );
}

function AngleTrace({ samples, width = 480, height = 90, maxDeg = 150 }) {
  if (samples.length < 2) return <svg width={width} height={height} />;
  const t0 = samples[0].t, span = samples[samples.length - 1].t - t0 || 1;
  const points = samples
    .map((p) => `${((p.t - t0) / span) * width},${height - (Math.max(0, p.angle) / maxDeg) * height}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ background: "#f6f6f6" }}>
      <polyline points={points} fill="none" stroke="#3366cc" strokeWidth="2" />
    </svg>
  );
}

function ProgressBars({ rows }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
      {rows.map((p) => (
        <div
          key={p.id}
          title={`${new Date(p.performed_at).toLocaleDateString()}: ${p.angle_pct}% range, score ${p.score}`}
          style={{ flex: 1, height: `${Math.min(100, p.angle_pct)}%`, background: "#3366cc", opacity: p.is_backdated ? 0.6 : 1 }}
        />
      ))}
    </div>
  );
}

const row = { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "12px 0" };
const card = { border: "1px solid #ddd", borderRadius: 8, padding: 16, margin: "16px 0" };
