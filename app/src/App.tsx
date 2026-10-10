import { useState, type ReactNode } from "react";
import { FLAG_ANGLE_CAL, FLAG_BATT_LOW, api, type Knee, type Rihab, type Workout, useRihab } from "./lib/rihab";

type IconName =
  | "activity"
  | "bell"
  | "bluetooth"
  | "chevron"
  | "cloud"
  | "dashboard"
  | "device"
  | "flame"
  | "heart"
  | "joint"
  | "moon"
  | "play"
  | "settings"
  | "shoe"
  | "spark"
  | "stop"
  | "target"
  | "thermometer"
  | "trend"
  | "user";

const iconPaths: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l2.2-7 4.4 14 2.2-7H21" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  bluetooth: <path d="m7 7 10 10-5 4V3l5 4L7 17" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  cloud: <path d="M17.5 19H7a5 5 0 1 1 1.8-9.7A7 7 0 0 1 22 12.5 6.5 6.5 0 0 1 17.5 19Z" />,
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  device: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="4" />
      <path d="M10 6h4M11 18h2" />
    </>
  ),
  flame: <path d="M12.5 2.5c.7 3.6-.8 5.1-2.1 6.4-1.2 1.2-2.2 2.4-1.2 4.6.5-1.7 1.6-2.7 2.9-3.8.2 2.1 1.7 3.2 2.4 4.7.8 1.7.1 3.8-1.5 4.7 3.7-.5 6-3.1 6-6.4 0-4.2-3.2-7.9-6.5-10.2ZM9.8 21c-3-.8-4.8-3.1-4.8-5.8 0-2.4 1.2-4.7 3.1-6.5-.2 2.5.7 3.7 1.4 4.6.8 1 1.3 1.7.3 3.4-.7 1.2-.6 3 .1 4.3Z" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  joint: (
    <>
      <path d="M7 3v5.5a3.5 3.5 0 0 0 3.5 3.5H14a3 3 0 0 1 3 3v6" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" />,
  play: <path d="M7 4.5v15l12-7.5-12-7.5Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  shoe: <path d="M4 6v7c0 1.1.9 2 2 2h3l2 3h8.5a2.5 2.5 0 0 0 0-5H15l-4-2-2-5H4Z" />,
  spark: <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Zm6 13 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  thermometer: (
    <>
      <path d="M14 14.8V5a4 4 0 0 0-8 0v9.8a6 6 0 1 0 8 0Z" />
      <path d="M10 9v7" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22a8 8 0 0 1 16 0" />
    </>
  ),
};

function Icon({ name, size = "md" }: { name: IconName; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-4", md: "size-5", lg: "size-6" };
  return (
    <svg className={sizes[size]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

function Text({
  as = "div",
  className = "",
  children,
}: {
  as?: "div" | "span" | "h1" | "h2" | "p";
  className?: string;
  children: ReactNode;
}) {
  const Component = as;
  return <Component className={className}>{children}</Component>;
}

function Action({
  children,
  className = "",
  onClick,
  label,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const Component = "button";
  return (
    <Component type="button" className={`${className} disabled:cursor-not-allowed disabled:opacity-40`} onClick={onClick} aria-label={label} disabled={disabled}>
      {children}
    </Component>
  );
}

// ---------------------------------------------------------------- data helpers

const KNEE_LABEL: Record<Knee, string> = { healthy: "Healthy knee", injured: "Injured knee" };

const fmt = (v: number | null | undefined, digits = 0, suffix = "") => (v == null ? "—" : v.toFixed(digits) + suffix);
const signed = (v: number | null | undefined, suffix = "%") => (v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(0) + suffix);

function startOfDay(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

const totalReps = (w: Workout) => w.healthy_reps + w.injured_reps;

function repsBetween(history: Workout[], from: Date, to: Date) {
  return history.reduce((n, w) => {
    const d = new Date(w.performed_at);
    return d >= from && d < to ? n + totalReps(w) : n;
  }, 0);
}

/** Local-midnight timestamps of every day with at least one rep. */
function activeDays(history: Workout[]) {
  return new Set(history.filter((w) => totalReps(w) > 0).map((w) => startOfDay(new Date(w.performed_at)).getTime()));
}

function linkStatus(rihab: Rihab) {
  const s = rihab.state;
  if (!rihab.connected) return { ok: false, label: "Server offline", detail: "Start backend/rihab_server.py" };
  if (!s?.connected) return { ok: false, label: "Waiting for brace", detail: "Plug in the Arduino" };
  return { ok: true, label: "Connected", detail: s.source === "sim" ? "Simulator" : (s.port ?? "USB") };
}

// ---------------------------------------------------------------- layout

const navItems: { label: string; icon: IconName }[] = [
  { label: "Overview", icon: "dashboard" },
  { label: "Activity", icon: "activity" },
  { label: "Workout / Stretches Coach", icon: "spark" },
  { label: "Professionals Near You", icon: "user" },
  { label: "Streak", icon: "flame" },
  { label: "Devices", icon: "device" },
];

function RiHabMark() {
  return (
    <span className="relative block h-6 w-3 text-white" aria-hidden="true">
      <span className="absolute bottom-0 left-1/2 h-4 w-1.5 -translate-x-1/2 rounded-full bg-current" />
      <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full border-2 border-current" />
    </span>
  );
}

function Sidebar({ rihab }: { rihab: Rihab }) {
  const [active, setActive] = useState("Overview");
  const link = linkStatus(rihab);
  const battery = link.ok ? rihab.latest?.battery ?? null : null;
  const batteryLow = ((rihab.latest?.flags ?? 0) & FLAG_BATT_LOW) !== 0;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-line bg-surface px-5 py-7 lg:flex lg:flex-col">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-ink text-white shadow-brand">
          <RiHabMark />
        </div>
        <Text className="font-display text-xl font-bold tracking-tight text-ink">RiHab</Text>
      </div>

      <nav className="space-y-1.5" aria-label="Primary navigation">
        {navItems.map((item) => (
          <Action
            key={item.label}
            onClick={() => setActive(item.label)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold leading-5 transition ${
              active === item.label ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <Icon name={item.icon} />
            {item.label}
          </Action>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="mb-5 rounded-2xl bg-ink p-4 text-white">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-mint">
              <Icon name="device" />
            </div>
            <span className={`flex items-center gap-1.5 text-xs ${link.ok ? "text-mint" : "text-white/50"}`}>
              <span className={`size-1.5 rounded-full ${link.ok ? "bg-mint" : "bg-rose"}`} />
              {link.label}
            </span>
          </div>
          <Text className="mb-1 text-sm font-semibold">Knee brace</Text>
          {battery == null ? (
            <Text className="text-xs text-white/50">{link.detail}</Text>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Battery · {link.detail}</span>
                <span className={batteryLow ? "text-rose" : ""}>{battery}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${batteryLow ? "bg-rose" : "bg-mint"}`} style={{ width: `${battery}%` }} />
              </div>
            </>
          )}
        </div>
        <Action className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted hover:bg-canvas hover:text-ink">
          <Icon name="settings" />
          Settings
        </Action>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- metrics

type Metric = { label: string; value: string; detail: string; badge: string | null; icon: IconName; tone: string };

function MetricCard({ item }: { item: Metric }) {
  return (
    <article className="group rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="mb-5 flex items-start justify-between">
        <div className={`flex size-10 items-center justify-center rounded-xl ${item.tone}`}>
          <Icon name={item.icon} />
        </div>
        {item.badge && (
          <div className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-xs font-semibold text-success">
            <Icon name="trend" size="sm" />
            {item.badge}
          </div>
        )}
      </div>
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</Text>
      <div className="flex items-end gap-2">
        <Text className="font-display text-3xl font-bold tracking-tight text-ink">{item.value}</Text>
        <Text className="mb-1 text-xs text-muted">{item.detail}</Text>
      </div>
    </article>
  );
}

function metricsFor(rihab: Rihab): Metric[] {
  const latest = rihab.latest;
  const injured = rihab.reps.filter((r) => r.knee === "injured");
  const counted = injured.length ? injured : rihab.reps;
  const bestRom = counted.length ? Math.max(...counted.map((r) => r.rom_deg)) : null;
  return [
    {
      label: "Muscle activation",
      value: fmt(latest?.emg, 0, "%"),
      detail: latest?.emg == null ? "no EMG sensor yet" : "quad activation",
      badge: null,
      icon: "activity",
      tone: "bg-orange-soft text-orange",
    },
    {
      label: "Knee flexibility",
      value: fmt(bestRom, 0, "°"),
      detail: bestRom == null ? "no reps this workout" : `best ${injured.length ? "injured-knee " : ""}rep`,
      badge: rihab.angle != null ? `Now ${rihab.angle}°` : null,
      icon: "joint",
      tone: "bg-brand-soft text-brand",
    },
    {
      label: "Skin temperature",
      value: fmt(latest?.temp, 1, "°"),
      detail: latest?.temp == null ? "no temp sensor yet" : "°C at the knee",
      badge: null,
      icon: "thermometer",
      tone: "bg-rose-soft text-rose",
    },
  ];
}

function WorkoutCheckIn({ rihab }: { rihab: Rihab }) {
  // Check in on the open workout, or else the most recent one with reps.
  const target = rihab.state?.workout_id != null
    ? rihab.history.find((w) => w.id === rihab.state!.workout_id) ?? rihab.workout
    : rihab.history.find((w) => totalReps(w) > 0) ?? null;
  const [draft, setDraft] = useState<{ workoutId: number; score: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const saved = target?.feeling ?? null;
  const score = draft && draft.workoutId === target?.id ? draft.score : saved ?? 7;
  const dirty = target != null && score !== saved;
  const message = score <= 3 ? "Take it easy and prioritize recovery" : score <= 6 ? "A steady session—listen to your body" : "You are feeling strong after this session";
  const Range = "input";

  const save = async () => {
    if (!target) return;
    setStatus("saving");
    try {
      await api.checkin(target.id, score);
      setStatus("idle");
      rihab.refreshHistory();
    } catch (e) {
      console.warn("RiHab: couldn't save check-in", e);
      setStatus("error");
    }
  };

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2 sm:p-6 xl:col-span-3">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4 lg:w-72 lg:shrink-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet">
            <Icon name="spark" />
          </div>
          <div>
            <Text as="h2" className="font-display text-lg font-bold text-ink">Post-workout check-in</Text>
            <Text className="mt-1 text-sm text-muted">
              {target
                ? `How did you feel after workout #${target.id} (${new Date(target.performed_at).toLocaleDateString()})?`
                : "Finish a workout, then tell us how it felt."}
            </Text>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between">
            <Text className="text-xs font-semibold text-muted">Very uncomfortable</Text>
            <Text className="text-xs font-semibold text-muted">Felt great</Text>
          </div>
          <Range
            type="range"
            min="1"
            max="10"
            step="1"
            value={score}
            disabled={!target}
            onChange={(event) => target && setDraft({ workoutId: target.id, score: Number(event.target.value) })}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-violet disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="How you felt after your workout, from 1 to 10"
            aria-valuetext={`${score} out of 10`}
          />
          <div className="mt-2 flex justify-between px-0.5 text-xs font-medium text-muted">
            {Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-canvas px-4 py-3 lg:w-64 lg:shrink-0">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet text-white">
            <Text className="font-display text-xl font-bold">{score}</Text>
          </div>
          <div>
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Your response</Text>
            <Text className="mt-1 text-sm font-semibold leading-5 text-ink">{message}</Text>
          </div>
        </div>

        <Action
          onClick={save}
          disabled={!dirty || status === "saving"}
          className="shrink-0 rounded-xl bg-violet px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {status === "saving" ? "Saving…" : status === "error" ? "Retry" : dirty ? "Save check-in" : saved != null ? "Saved" : "Save check-in"}
        </Action>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- live session

function AngleTrace({ rihab }: { rihab: Rihab }) {
  const angles = rihab.samples.map((s) => s.angle);
  const top = Math.max(140, ...angles);
  const points = angles.map((a, i) => `${(i / Math.max(angles.length - 1, 1)) * 500},${140 - (Math.max(a, 0) / top) * 130}`).join(" ");

  return (
    <div className="relative h-36 w-full">
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-line" />)}
      </div>
      {angles.length > 1 ? (
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 500 140" preserveAspectRatio="none" aria-label="Live knee angle over the last 20 seconds">
          <polyline points={points} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">No live data yet</div>
      )}
    </div>
  );
}

function LiveSession({ rihab }: { rihab: Rihab }) {
  const s = rihab.state;
  const [patient, setPatient] = useState("");
  const link = linkStatus(rihab);
  const inWorkout = !!s?.workout_id;
  const uncalibrated = rihab.latest?.flags != null && (rihab.latest.flags & FLAG_ANGLE_CAL) === 0;
  const count = (knee: Knee) => rihab.reps.filter((r) => r.knee === knee).length;
  const button = "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition";

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Text as="h2" className="font-display text-lg font-bold text-ink">Live session</Text>
          <Text as="p" className="mt-1 text-sm text-muted">
            {!link.ok
              ? `${link.label}: ${link.detail.toLowerCase()}`
              : inWorkout
                ? `Workout #${s!.workout_id} · ${new Date(s!.performed_at!).toLocaleString()} · reps measured by ${s!.rep_mode === "device" ? "the brace" : "the server"}`
                : "No workout open. Starting tracking opens one."}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          {uncalibrated && <span className="rounded-full bg-orange-soft px-2.5 py-1 text-xs font-bold text-orange">Not calibrated</span>}
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s?.tracking ? "bg-success-soft text-success" : "bg-canvas text-muted"}`}>
            {s?.tracking ? "Tracking" : "Paused"}
          </span>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="sm:w-40 sm:shrink-0">
          <Text className="font-display text-5xl font-bold tabular-nums tracking-tight text-ink">{fmt(rihab.angle, 0, "°")}</Text>
          <Text className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{s ? KNEE_LABEL[s.knee] : "Knee angle"}</Text>
          <div className="mt-3 flex gap-3 text-xs text-muted">
            <span><b className="text-ink">{count("healthy")}</b> healthy</span>
            <span><b className="text-ink">{count("injured")}</b> injured</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <AngleTrace rihab={rihab} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <div className="flex rounded-lg bg-canvas p-1">
          {(["healthy", "injured"] as const).map((knee) => (
            <Action
              key={knee}
              disabled={!rihab.connected}
              onClick={() => rihab.setKnee(knee)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${s?.knee === knee ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {KNEE_LABEL[knee]}
            </Action>
          ))}
        </div>
        {s?.tracking ? (
          <Action className={`${button} bg-ink text-white`} onClick={rihab.stop} disabled={!rihab.connected}>
            <Icon name="stop" size="sm" /> Stop
          </Action>
        ) : (
          <Action className={`${button} bg-brand text-white hover:bg-brand-dark`} onClick={rihab.start} disabled={!link.ok}>
            <Icon name="play" size="sm" /> Start tracking
          </Action>
        )}
        <Action className={`${button} border border-line text-ink hover:bg-canvas`} onClick={rihab.calibrate} disabled={!link.ok} label="Calibrate: leg is straight now">
          <Icon name="target" size="sm" /> Calibrate straight
        </Action>
        <div className="ml-auto flex items-center gap-2">
          {inWorkout ? (
            <Action className={`${button} border border-line text-ink hover:bg-canvas`} onClick={rihab.endWorkout} disabled={!rihab.connected}>
              End workout
            </Action>
          ) : (
            <>
              <input
                value={patient}
                onChange={(e) => setPatient(e.target.value)}
                placeholder={s?.patient ?? "Patient"}
                aria-label="Patient name"
                className="w-32 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-brand"
              />
              <Action
                className={`${button} border border-line text-ink hover:bg-canvas`}
                onClick={() => rihab.startWorkout(patient.trim() || s?.patient || "Patient")}
                disabled={!rihab.connected}
              >
                New workout
              </Action>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function RecoveryScore({ rihab }: { rihab: Rihab }) {
  const c = rihab.comparison;
  const previous = rihab.progress.filter((p) => p.id !== c?.workout_id).at(-1);

  return (
    <article className="relative overflow-hidden rounded-2xl bg-brand p-6 text-white shadow-brand">
      <div className="absolute -right-10 -top-10 size-40 rounded-full border border-white/10" />
      <div className="absolute -right-2 -top-2 size-24 rounded-full border border-white/10" />
      <div className="relative">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/15">
            <Icon name="heart" size="lg" />
          </div>
          {c && <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-ink">{c.status}</span>}
        </div>
        <Text className="text-xs font-semibold uppercase tracking-wide text-white/60">Recovery score</Text>
        {c ? (
          <>
            <div className="mt-1 flex items-baseline gap-2">
              <Text className="font-display text-5xl font-bold">{c.score.toFixed(0)}</Text>
              <Text className="text-sm text-white/60">/ 100</Text>
              {previous?.score != null && (
                <Text className="ml-auto text-xs font-semibold text-mint">{signed(c.score - previous.score, " pts")} vs last</Text>
              )}
            </div>
            <Text className="mt-2 text-sm leading-6 text-white/80">{c.summary}</Text>
            <div className="mt-5 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-4 text-center">
              <div>
                <Text className="font-display font-bold">{fmt(c.angle_pct, 0, "%")}</Text>
                <Text className="mt-1 text-xs text-white/60">of healthy range</Text>
              </div>
              <div>
                <Text className="font-display font-bold">{signed(c.speed_pct)}</Text>
                <Text className="mt-1 text-xs text-white/60">time per rep</Text>
              </div>
              <div>
                <Text className="font-display font-bold">{signed(c.flux_pct)}</Text>
                <Text className="mt-1 text-xs text-white/60">shakiness</Text>
              </div>
            </div>
            {c.baseline_from && (
              <Text className="mt-3 text-xs text-white/50">Healthy baseline from {new Date(c.baseline_from).toLocaleDateString()}</Text>
            )}
          </>
        ) : (
          <Text className="mt-2 max-w-xs text-sm leading-6 text-white/70">
            Do a few reps with each knee and the injured knee is scored against the healthy one.
          </Text>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- history

type Period = "Week" | "Month" | "YTD";

function activitySeries(history: Workout[], period: Period) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  if (period === "Week") {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    return {
      labels: days.map((d) => d.toLocaleDateString("en-US", { weekday: "short" })),
      values: days.map((d) => repsBetween(history, d, addDays(d, 1))),
      previous: repsBetween(history, addDays(today, -13), addDays(today, -6)),
      comparison: "7 days",
    };
  }
  if (period === "Month") {
    const weeks = Array.from({ length: 4 }, (_, i) => addDays(today, i * 7 - 27));
    return {
      labels: weeks.map((d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })),
      values: weeks.map((d) => repsBetween(history, d, addDays(d, 7))),
      previous: repsBetween(history, addDays(today, -55), addDays(today, -27)),
      comparison: "4 weeks",
    };
  }
  const year = today.getFullYear();
  const months = Array.from({ length: today.getMonth() + 1 }, (_, m) => new Date(year, m, 1));
  return {
    labels: months.map((d) => d.toLocaleDateString("en-US", { month: "short" })),
    values: months.map((d) => repsBetween(history, d, new Date(year, d.getMonth() + 1, 1))),
    previous: repsBetween(history, new Date(year - 1, 0, 1), new Date(year - 1, tomorrow.getMonth(), tomorrow.getDate())),
    comparison: "year",
  };
}

function ActivityChart({ history }: { history: Workout[] }) {
  const [period, setPeriod] = useState<Period>("Week");
  const data = activitySeries(history, period);
  const total = data.values.reduce((a, b) => a + b, 0);
  const change = data.previous > 0 ? ((total - data.previous) / data.previous) * 100 : null;
  const maximum = Math.max(...data.values, 1);
  const points = data.values.map((value, index) => {
    const x = data.values.length > 1 ? (index / (data.values.length - 1)) * 500 : 250;
    const y = 140 - (value / maximum) * 120;
    return { x, y };
  });
  const linePoints = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPoints = `${points[0].x},150 ${linePoints} ${points.at(-1)!.x},150`;
  const latestPoint = points.at(-1)!;

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Text as="h2" className="font-display text-lg font-bold text-ink">Successful reps</Text>
          <Text as="p" className="mt-1 text-sm text-muted">Completed knee exercise repetitions</Text>
        </div>
        <div className="flex rounded-lg bg-canvas p-1">
          {(["Week", "Month", "YTD"] as const).map((item) => (
            <Action
              key={item}
              onClick={() => setPeriod(item)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                period === item ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {item}
            </Action>
          ))}
        </div>
      </div>

      <div className="mb-5 flex items-baseline gap-2">
        <Text className="font-display text-3xl font-bold text-ink">{total.toLocaleString()}</Text>
        <Text className="text-sm text-muted">successful reps</Text>
        {change != null && (
          <Text className={`ml-auto text-xs font-semibold ${change >= 0 ? "text-success" : "text-rose"}`}>
            {change >= 0 ? "+" : ""}{change.toFixed(1)}% vs previous {data.comparison}
          </Text>
        )}
      </div>

      <div className="relative h-44 w-full">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-line" />)}
        </div>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none" aria-label={`Reps per ${period === "YTD" ? "month" : period === "Month" ? "week" : "day"}`}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#chartFill)" />
          <polyline points={linePoints} fill="none" stroke="var(--color-brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={latestPoint.x} cy={latestPoint.y} r="5" fill="var(--color-surface)" stroke="var(--color-brand)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-3 flex justify-between text-xs font-medium text-muted">
        {data.labels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </article>
  );
}

function streaks(days: Set<number>) {
  const today = startOfDay(new Date());
  // A streak is still alive if today isn't done yet but yesterday was.
  let day = days.has(today.getTime()) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(day.getTime())) {
    current++;
    day = addDays(day, -1);
  }
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const t of [...days].sort((a, b) => a - b)) {
    run = prev != null && addDays(new Date(prev), 1).getTime() === t ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  return { current, longest };
}

function StreakSection({ history }: { history: Workout[] }) {
  const today = startOfDay(new Date());
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const days = activeDays(history);
  const { current, longest } = streaks(days);
  const doneToday = days.has(today.getTime());
  const weekDone = week.filter((d) => days.has(d.getTime())).length;

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Text as="h2" className="font-display text-lg font-bold text-ink">Exercise streak</Text>
          <Text className="mt-1 text-sm text-muted">Stay consistent with your stretches and exercises</Text>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-orange-soft px-3 py-2 text-orange">
          <Icon name="flame" />
          <Text className="font-display text-lg font-bold">{current} {current === 1 ? "day" : "days"}</Text>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {week.map((date) => {
          const isToday = date.getTime() === today.getTime();
          const isCompleted = days.has(date.getTime());
          return (
            <div key={date.toISOString()} className={`flex min-w-0 flex-col items-center rounded-xl py-2.5 ${isToday ? "bg-orange-soft" : "bg-canvas"}`}>
              <Text className={`mb-2 text-xs font-semibold uppercase ${isToday ? "text-orange" : "text-muted"}`}>
                {date.toLocaleDateString("en-US", { weekday: "narrow" })}
              </Text>
              <div className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
                isToday && isCompleted
                  ? "bg-orange text-white shadow-sm"
                  : isCompleted
                    ? "bg-brand-soft text-brand"
                    : "text-muted"
              }`}>
                {isToday && isCompleted ? <Icon name="flame" size="sm" /> : date.getDate()}
              </div>
              <span className={`mt-2 size-1.5 rounded-full ${isCompleted ? "bg-success" : "bg-line"}`} />
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <div>
          <Text className="text-sm font-semibold text-ink">{doneToday ? "Exercises logged today" : "No exercises logged yet today"}</Text>
          <Text className="mt-1 text-xs text-muted">Your longest streak is {longest} {longest === 1 ? "day" : "days"}</Text>
        </div>
        <Text className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">{weekDone} of 7 this week</Text>
      </div>
    </article>
  );
}

function DeviceLog({ rihab }: { rihab: Rihab }) {
  const link = linkStatus(rihab);
  const logs = rihab.logs.slice(-8).reverse();
  const tone = { info: "text-muted", warn: "text-orange", error: "text-rose" };

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Text as="h2" className="font-display text-lg font-bold text-ink">Device log</Text>
          <Text className="mt-1 text-sm text-muted">Messages from the brace and the server</Text>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${link.ok ? "bg-success-soft text-success" : "bg-rose-soft text-rose"}`}>
          <Icon name={rihab.state?.source === "sim" ? "spark" : "device"} size="sm" />
          {link.detail}
        </span>
      </div>
      {logs.length ? (
        <ul className="space-y-2 text-sm">
          {logs.map((l, i) => (
            <li key={`${l.at}-${i}`} className="flex gap-3">
              <span className="shrink-0 tabular-nums text-xs leading-5 text-muted">{new Date(l.at).toLocaleTimeString()}</span>
              <span className={`min-w-0 break-words leading-5 ${l.level === "info" ? "text-ink" : tone[l.level]}`}>{l.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Text className="text-sm text-muted">No messages yet.</Text>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- page

export default function App() {
  const rihab = useRihab();
  const link = linkStatus(rihab);
  const patient = rihab.state?.patient;
  const injury = rihab.workout?.injury ?? rihab.history.find((w) => w.injury)?.injury;

  return (
    <main className="flex min-h-screen bg-canvas text-ink">
      <Sidebar rihab={rihab} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-line bg-canvas/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-ink text-white">
              <RiHabMark />
            </div>
            <Text className="font-display font-bold">RiHab</Text>
          </div>
          <div className="hidden sm:block">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
            <Text className="mt-1 font-display text-lg font-bold text-ink">Health overview</Text>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Action className="relative flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink" label="Notifications">
              <Icon name="bell" />
              {rihab.logs.some((l) => l.level !== "info") && <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose ring-2 ring-surface" />}
            </Action>
            <div className="h-8 w-px bg-line" />
            <Action className="flex items-center gap-3 rounded-xl p-1.5 pr-2 hover:bg-surface">
              <div className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon name="user" />
              </div>
              <div className="hidden text-left sm:block">
                <Text className="text-sm font-bold text-ink">{patient ?? "—"}</Text>
                <Text className="text-xs text-muted">{injury ?? "Patient"}</Text>
              </div>
              <Icon name="chevron" size="sm" />
            </Action>
          </div>
        </header>

        <div className="mx-auto max-w-screen-2xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Text as="h1" className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Welcome back{patient ? `, ${patient}` : ""}</Text>
              <Text as="p" className="mt-2 text-sm text-muted sm:text-base">Your body is ready for a strong day. Here&apos;s your progress.</Text>
            </div>
            <div className="flex items-center gap-2 self-start rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted sm:self-auto">
              <span className={`size-2 rounded-full ${link.ok ? "bg-success shadow-status" : "bg-rose"}`} />
              {link.ok ? `Brace connected · ${link.detail}` : `${link.label} · ${link.detail}`}
            </div>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Live health metrics">
            {metricsFor(rihab).map((item) => <MetricCard key={item.label} item={item} />)}
            <WorkoutCheckIn rihab={rihab} />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.8fr)]" aria-label="Live session">
            <LiveSession rihab={rihab} />
            <RecoveryScore rihab={rihab} />
          </section>

          <section className="mt-5" aria-label="Activity details">
            <ActivityChart history={rihab.history} />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]" aria-label="Streak and device log">
            <StreakSection history={rihab.history} />
            <DeviceLog rihab={rihab} />
          </section>
        </div>
      </div>
    </main>
  );
}
