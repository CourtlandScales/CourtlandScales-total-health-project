import { useEffect, useState, type ReactNode } from "react";
import {
  FLAG_ANGLE_CAL, FLAG_BATT_LOW, SERVER, api, type Knee, type Measurement, type Rihab, type SampleTrace, type Workout, useRihab,
} from "./lib/rihab";

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
  | "sun"
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
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
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
  current,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
  current?: boolean;
}) {
  const Component = "button";
  return (
    <Component
      type="button"
      className={`${className} disabled:cursor-not-allowed disabled:opacity-40`}
      onClick={onClick}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
    >
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
  if (rihab.feed.hz === 0) return { ok: false, label: "No data", detail: "Brace plugged in but not sending" };
  return { ok: true, label: "Connected", detail: s.port ?? "USB" };
}

// ---------------------------------------------------------------- layout

type ViewId = "overview" | "activity" | "coach" | "professionals" | "streak" | "devices" | "settings";

const navItems: { id: ViewId; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "coach", label: "Workout / Stretches Coach", icon: "spark" },
  { id: "professionals", label: "Professionals Near You", icon: "user" },
  { id: "streak", label: "Streak", icon: "flame" },
  { id: "devices", label: "Devices", icon: "device" },
];

const VIEW_TITLES: Record<ViewId, string> = {
  overview: "Health overview",
  activity: "Activity",
  coach: "Workout / stretches coach",
  professionals: "Professionals near you",
  streak: "Streak",
  devices: "Devices",
  settings: "Settings",
};

const viewFromHash = (): ViewId => {
  const id = window.location.hash.slice(1);
  return id in VIEW_TITLES ? (id as ViewId) : "overview";
};

/** The open page lives in the URL hash, so back/forward and reloads keep it. */
function useView() {
  const [view, setView] = useState(viewFromHash);
  useEffect(() => {
    const onHash = () => {
      setView(viewFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (id: ViewId) => {
    window.location.hash = id;
  };
  return [view, go] as const;
}

type Theme = "light" | "dark";

const THEME_KEY = "rihab-theme";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

const savedTheme = (): Theme | null => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
};

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

// Set before the first render so the page never flashes the wrong theme.
applyTheme(savedTheme() ?? (systemDark.matches ? "dark" : "light"));

/** Light/dark mode: follows the system setting until the user picks one, then remembers it. */
function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme as Theme);
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => {
      if (!savedTheme()) setTheme(e.matches ? "dark" : "light");
    };
    systemDark.addEventListener("change", onChange);
    return () => systemDark.removeEventListener("change", onChange);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing: the choice just won't survive a reload.
    }
    setTheme(next);
  };
  return [theme, toggle] as const;
}

function RiHabMark() {
  return (
    <span className="relative block h-6 w-3 text-white" aria-hidden="true">
      <span className="absolute bottom-0 left-1/2 h-4 w-1.5 -translate-x-1/2 rounded-full bg-current" />
      <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full border-2 border-current" />
    </span>
  );
}

function Sidebar({ rihab, active, onNavigate }: { rihab: Rihab; active: ViewId; onNavigate: (id: ViewId) => void }) {
  const link = linkStatus(rihab);
  const battery = link.ok ? rihab.latest?.battery ?? null : null;
  const batteryLow = ((rihab.latest?.flags ?? 0) & FLAG_BATT_LOW) !== 0;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-line bg-surface px-5 py-7 lg:flex lg:flex-col">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-night text-white shadow-brand">
          <RiHabMark />
        </div>
        <Text className="font-display text-xl font-bold tracking-tight text-ink">RiHab</Text>
      </div>

      <nav className="space-y-1.5" aria-label="Primary navigation">
        {navItems.map((item) => (
          <Action
            key={item.id}
            onClick={() => onNavigate(item.id)}
            current={active === item.id}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold leading-5 transition ${
              active === item.id ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <Icon name={item.icon} />
            {item.label}
          </Action>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="mb-5 rounded-2xl bg-night p-4 text-white">
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
        <Action
          onClick={() => onNavigate("settings")}
          current={active === "settings"}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
            active === "settings" ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
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
    <article className="group rounded-2xl border border-edge bg-surface shadow-soft p-5 transition hover:-translate-y-0.5 hover:shadow-card">
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
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted/80">{item.label}</Text>
      <div className="flex items-end gap-2">
        <Text className="font-mono text-3xl font-extrabold tabular-nums tracking-tight text-ink">{item.value}</Text>
        <Text className="mb-1 text-xs text-muted">{item.detail}</Text>
      </div>
    </article>
  );
}

function flexibilityMetric(rihab: Rihab): Metric {
  const injured = rihab.reps.filter((r) => r.knee === "injured");
  const counted = injured.length ? injured : rihab.reps;
  const bestRom = counted.length ? Math.max(...counted.map((r) => r.rom_deg)) : null;
  return {
    label: "Knee flexibility",
    value: fmt(bestRom, 0, "°"),
    detail: bestRom == null ? "no reps this workout" : `best ${injured.length ? "injured-knee " : ""}rep`,
    badge: rihab.angle != null ? `Now ${rihab.angle}°` : null,
    icon: "joint",
    tone: "bg-brand-soft text-brand",
  };
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
    <article className="rounded-2xl border border-edge bg-surface shadow-soft transition-shadow hover:shadow-card p-5 sm:p-6">
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
    <article className="rounded-2xl border border-edge bg-surface shadow-soft transition-shadow hover:shadow-card p-5 sm:p-6">
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
          {link.ok && (
            <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-bold tabular-nums text-muted" title="Readings per second arriving from the brace">
              Live · {rihab.feed.hz}/s
            </span>
          )}
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s?.tracking ? "bg-success-soft text-success glow-live" : "bg-canvas text-muted"}`}>
            {s?.tracking ? "Tracking · recording" : "Paused"}
          </span>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="sm:w-40 sm:shrink-0">
          <Text className="font-mono text-5xl font-extrabold tabular-nums tracking-tighter text-ink">{fmt(rihab.angle, 0, "°")}</Text>
          <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted/80">{s ? KNEE_LABEL[s.knee] : "Knee angle"}</Text>
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
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${s?.knee === knee ? "bg-surface text-ink shadow-selected" : "text-muted hover:text-ink"}`}
            >
              {KNEE_LABEL[knee]}
            </Action>
          ))}
        </div>
        {s?.tracking ? (
          <Action className={`${button} bg-night text-white`} onClick={rihab.stop} disabled={!rihab.connected}>
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
                disabled={!link.ok}
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
    <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-brand">
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
              <Text className="font-mono text-5xl font-extrabold tabular-nums">{c.score.toFixed(0)}</Text>
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
    <article className="rounded-2xl border border-edge bg-surface shadow-soft transition-shadow hover:shadow-card p-5 sm:p-6">
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
                period === item ? "bg-surface text-ink shadow-selected" : "text-muted hover:text-ink"
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
    <article className="rounded-2xl border border-edge bg-surface shadow-soft transition-shadow hover:shadow-card p-5 sm:p-6">
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
    <article className="rounded-2xl border border-edge bg-surface shadow-soft transition-shadow hover:shadow-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Text as="h2" className="font-display text-lg font-bold text-ink">Device log</Text>
          <Text className="mt-1 text-sm text-muted">Messages from the brace and the server</Text>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${link.ok ? "bg-success-soft text-success" : "bg-rose-soft text-rose"}`}>
          <Icon name="device" size="sm" />
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

// ---------------------------------------------------------------- recorded workout

const KNEE_COLOR: Record<Knee, string> = { healthy: "var(--color-brand)", injured: "var(--color-orange)" };
const BRACE_HZ = 30;

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** Seconds after the workout started when this rep finished. Readings are stored on the same clock. */
const repEnd = (m: Measurement, performedAt: string) => (new Date(m.measured_at).getTime() - new Date(performedAt).getTime()) / 1000;

/**
 * Where each reading goes on the x axis. Time spent not tracking (between knees, or paused) is squeezed out,
 * so the chart shows the movement rather than long flat gaps.
 */
function traceAxis(trace: SampleTrace) {
  const n = trace.offset_s.length;
  // Thinned traces have readings further apart, so a gap is "much longer than the usual spacing".
  const gap = Math.max(1, (3 * trace.total) / Math.max(n, 1) / BRACE_HZ);
  const pos = new Array<number>(n);
  const breaks: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const dt = i ? trace.offset_s[i] - trace.offset_s[i - 1] : 0;
    breaks[i] = dt > gap;
    pos[i] = i ? pos[i - 1] + (breaks[i] ? 0.5 : dt) : 0;
  }
  const at = (t: number) => {
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (trace.offset_s[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    const next = Math.min(lo + 1, n - 1);
    const room = next > lo && !breaks[next] ? pos[next] - pos[lo] : 0;
    return pos[lo] + Math.min(Math.max(t - trace.offset_s[lo], 0), room);
  };
  return { pos, breaks, at, length: n ? pos[n - 1] : 0 };
}

function SessionTrace({ trace, reps, performedAt, selected, onSelect }: {
  trace: SampleTrace; reps: Measurement[]; performedAt: string; selected: number | null; onSelect: (id: number) => void;
}) {
  const W = 600, H = 170;
  const axis = traceAxis(trace);
  const span = Math.max(axis.length, 1);
  const top = Math.max(90, ...trace.angle) * 1.05;
  const x = (p: number) => (p / span) * W;
  const y = (a: number) => H - (Math.max(a, 0) / top) * (H - 8);

  // One polyline per stretch of the same knee with no gap.
  const runs: { knee: Knee; points: string[] }[] = [];
  trace.angle.forEach((a, i) => {
    const last = runs.at(-1);
    const pt = `${x(axis.pos[i]).toFixed(1)},${y(a).toFixed(1)}`;
    if (last && last.knee === trace.knee[i] && !axis.breaks[i]) last.points.push(pt);
    else runs.push({ knee: trace.knee[i], points: [pt] });
  });

  return (
    <div>
      <div className="relative h-44 w-full">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-line" />)}
        </div>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Knee angle for the whole workout">
          {reps.map((m) => {
            const end = repEnd(m, performedAt);
            const x0 = x(axis.at(end - m.duration_s)), x1 = x(axis.at(end));
            return (
              <rect
                key={m.id}
                x={x0}
                y={0}
                width={Math.max(x1 - x0, 2)}
                height={H}
                fill={KNEE_COLOR[m.knee]}
                fillOpacity={selected === m.id ? 0.22 : 0.07}
                className="cursor-pointer"
                onClick={() => onSelect(m.id)}
              />
            );
          })}
          {runs.map((r, i) => (
            <polyline key={i} points={r.points.join(" ")} fill="none" stroke={KNEE_COLOR[r.knee]} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="pointer-events-none" />
          ))}
        </svg>
        <span className="pointer-events-none absolute left-1 top-0 text-xs tabular-nums text-muted">{top.toFixed(0)}°</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span className="tabular-nums">0:00 tracked</span>
        <span className="flex items-center gap-4">
          {(["healthy", "injured"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: KNEE_COLOR[k] }} />
              {KNEE_LABEL[k]}
            </span>
          ))}
          <span>Shaded = a counted rep (click one)</span>
        </span>
        <span className="tabular-nums">{clock(axis.length)} tracked</span>
      </div>
    </div>
  );
}

/** One rep's angle over time, next to a typical healthy rep from the same workout for comparison. */
function RepCurve({ trace, rep, reference, performedAt }: {
  trace: SampleTrace; rep: Measurement; reference: Measurement | null; performedAt: string;
}) {
  const W = 300, H = 140, PAD = 0.3;
  const slice = (m: Measurement) => {
    const end = repEnd(m, performedAt), start = end - m.duration_s;
    const pts: [number, number][] = [];
    trace.offset_s.forEach((t, i) => {
      if (t >= start - PAD && t <= end + PAD) pts.push([t - start, trace.angle[i]]);
    });
    return pts;
  };
  const mine = slice(rep);
  const ref = reference && reference.id !== rep.id ? slice(reference) : [];
  const all = [...mine, ...ref];
  if (mine.length < 2) return <Text className="text-sm text-muted">No readings were stored for this rep.</Text>;
  const tMin = Math.min(...all.map((p) => p[0])), tMax = Math.max(...all.map((p) => p[0]));
  const top = Math.max(60, ...all.map((p) => p[1])) * 1.05;
  const toPts = (pts: [number, number][]) =>
    pts.map(([t, a]) => `${(((t - tMin) / Math.max(tMax - tMin, 0.1)) * W).toFixed(1)},${(H - (Math.max(a, 0) / top) * (H - 6)).toFixed(1)}`).join(" ");

  return (
    <div>
      <div className="relative h-36 w-full">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2].map((line) => <div key={line} className="border-t border-dashed border-line" />)}
        </div>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="This rep's knee angle over time">
          {ref.length > 1 && (
            <polyline points={toPts(ref)} fill="none" stroke={KNEE_COLOR.healthy} strokeOpacity="0.6" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          )}
          <polyline points={toPts(mine)} fill="none" stroke={KNEE_COLOR[rep.knee]} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="pointer-events-none absolute left-1 top-0 text-xs tabular-nums text-muted">{top.toFixed(0)}°</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: KNEE_COLOR[rep.knee] }} />
          This rep
        </span>
        {ref.length > 1 && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: KNEE_COLOR.healthy }} />
            Typical healthy rep
          </span>
        )}
        <span className="ml-auto tabular-nums">{(tMax - tMin).toFixed(1)} s</span>
      </div>
    </div>
  );
}

function WorkoutDetail({ id, rihab, onClose }: { id: number; rihab: Rihab; onClose: () => void }) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [trace, setTrace] = useState<SampleTrace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const live = rihab.state?.workout_id === id;
  const liveReps = live ? rihab.reps.length : 0;

  // Reload when a rep lands in the workout being recorded right now.
  useEffect(() => {
    let stale = false;
    Promise.all([api.workout(id), api.samples(id)])
      .then(([w, t]) => {
        if (stale) return;
        setWorkout(w);
        setTrace(t);
        setError(null);
      })
      .catch((e) => !stale && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      stale = true;
    };
  }, [id, liveReps]);

  const remove = async () => {
    if (!window.confirm(`Delete workout #${id} and everything recorded in it? This can't be undone.`)) return;
    try {
      await api.deleteWorkout(id);
      rihab.refreshHistory();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const reps = workout?.measurements ?? [];
  const healthy = reps.filter((m) => m.knee === "healthy");
  const hRom = median(healthy.map((m) => m.rom_deg));
  const hTime = median(healthy.map((m) => m.duration_s));
  // The healthy rep closest to the median range stands in as "typical".
  const reference = hRom == null ? null : healthy.reduce((a, b) => (Math.abs(b.rom_deg - hRom) < Math.abs(a.rom_deg - hRom) ? b : a));
  const rep = reps.find((m) => m.id === selected) ?? null;

  const repNote = (m: Measurement) => {
    if (m.knee !== "injured" || hRom == null || hTime == null) return null;
    const slower = ((m.duration_s - hTime) / hTime) * 100;
    return `${((m.rom_deg / hRom) * 100).toFixed(0)}% of healthy range, ${Math.abs(slower) < 5 ? "about the same speed" : `${Math.abs(slower).toFixed(0)}% ${slower > 0 ? "slower" : "faster"}`}`;
  };

  return (
    <article className="rounded-2xl border border-edge bg-surface shadow-soft p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Text as="h2" className="font-display text-lg font-bold text-ink">
            Workout #{id}{live && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 align-middle text-xs font-bold text-success">Recording now</span>}
          </Text>
          <Text className="mt-1 text-sm text-muted">
            {workout
              ? `${workout.patient} · ${new Date(workout.performed_at).toLocaleString()} · ${workout.sample_count.toLocaleString()} readings from the brace`
              : "Loading…"}
          </Text>
        </div>
        <div className="flex gap-2">
          <Action onClick={remove} className="rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-rose transition hover:bg-rose-soft">
            Delete
          </Action>
          <Action onClick={onClose} className="rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-canvas">
            Close
          </Action>
        </div>
      </div>

      {error && <Text className="mb-4 text-sm text-rose">Couldn't load this workout: {error}</Text>}

      {workout?.summary && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-4 py-3">
          <Text className="font-mono text-2xl font-extrabold tabular-nums text-ink">{fmt(workout.score)}</Text>
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">score · {workout.status}</Text>
          <Text className="min-w-0 flex-1 text-sm text-ink">{workout.summary}</Text>
        </div>
      )}

      {trace && workout && (trace.total > 1 ? (
        <SessionTrace trace={trace} reps={reps} performedAt={workout.performed_at} selected={selected} onSelect={setSelected} />
      ) : (
        <Text className="text-sm text-muted">No raw readings were stored for this workout (it was entered by hand or recorded before readings were saved).</Text>
      ))}

      {workout && reps.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(16rem,1fr)]">
          <div className="-mx-5 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-semibold sm:px-2">Rep</th>
                  <th className="px-2 py-2 font-semibold">Knee</th>
                  <th className="px-2 py-2 font-semibold">Range</th>
                  <th className="px-2 py-2 font-semibold">Time</th>
                  <th className="px-2 py-2 font-semibold">Shakiness</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((m, i) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m.id)}
                    className={`cursor-pointer border-b border-line last:border-0 ${selected === m.id ? "bg-brand-soft" : "hover:bg-canvas"}`}
                  >
                    <td className="px-5 py-2.5 tabular-nums text-muted sm:px-2">
                      <Action onClick={() => setSelected(m.id)} label={`Show rep ${i + 1}`} className="tabular-nums">{i + 1}</Action>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-1.5 text-ink">
                        <span className="size-2 rounded-full" style={{ background: KNEE_COLOR[m.knee] }} />
                        {m.knee === "healthy" ? "Healthy" : "Injured"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums font-semibold text-ink">{fmt(m.rom_deg, 0, "°")}</td>
                    <td className="px-2 py-2.5 tabular-nums text-ink">{fmt(m.duration_s, 1, " s")}</td>
                    <td className="px-2 py-2.5 tabular-nums text-muted">{fmt(m.flux, 0, " mg")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            {rep && trace ? (
              <>
                <Text className="mb-1 text-sm font-semibold text-ink">
                  Rep {reps.indexOf(rep) + 1} · {KNEE_LABEL[rep.knee]} · {fmt(rep.rom_deg, 0, "°")} in {fmt(rep.duration_s, 1, " s")}
                </Text>
                <Text className="mb-3 text-xs text-muted">{repNote(rep) ?? (rep.knee === "healthy" ? "Healthy-knee baseline rep" : "No healthy reps in this workout to compare against")}</Text>
                <RepCurve trace={trace} rep={rep} reference={reference} performedAt={workout.performed_at} />
              </>
            ) : (
              <Text className="text-sm text-muted">Pick a rep in the table or on the chart to see its movement curve.</Text>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- views

function PageIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-8">
      <Text as="h1" className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</Text>
      <Text as="p" className="mt-2 text-sm text-muted sm:text-base">{children}</Text>
    </div>
  );
}

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <article className={`rounded-2xl border border-edge bg-surface shadow-soft transition-shadow hover:shadow-card p-5 sm:p-6 ${className}`}>
      <div className="mb-5">
        <Text as="h2" className="font-display text-lg font-bold text-ink">{title}</Text>
        {subtitle && <Text className="mt-1 text-sm text-muted">{subtitle}</Text>}
      </div>
      {children}
    </article>
  );
}

function OverviewView({ rihab }: { rihab: Rihab }) {
  const link = linkStatus(rihab);
  const patient = rihab.state?.patient;

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Text as="h1" className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Welcome back{patient ? `, ${patient}` : ""}</Text>
          <Text as="p" className="mt-2 text-sm text-muted sm:text-base">Your body is ready for a strong day. Here&apos;s your progress.</Text>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted sm:self-auto">
          <span className={`size-2 rounded-full ${link.ok ? "bg-success glow-live" : "bg-rose"}`} />
          {link.ok ? `Brace connected · ${link.detail}` : `${link.label} · ${link.detail}`}
        </div>
      </div>

      <section aria-label="Knee flexibility">
        <MetricCard item={flexibilityMetric(rihab)} />
      </section>

      <section className="mt-5" aria-label="Post-workout check-in">
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
    </>
  );
}

function WorkoutHistory({ history, selected, onSelect }: { history: Workout[]; selected: number | null; onSelect: (id: number) => void }) {
  return (
    <Card title="Workout history" subtitle="Every recorded workout, newest first. Pick one to see its angle trace and reps.">
      {history.length ? (
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-semibold sm:px-6">Date</th>
                <th className="px-3 py-2 font-semibold">Healthy reps</th>
                <th className="px-3 py-2 font-semibold">Injured reps</th>
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Felt</th>
                <th className="px-5 py-2 font-semibold sm:px-6"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {history.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => onSelect(w.id)}
                  className={`cursor-pointer border-b border-line last:border-0 ${selected === w.id ? "bg-brand-soft" : "hover:bg-canvas"}`}
                >
                  <td className="px-5 py-3 text-ink sm:px-6">
                    {new Date(w.performed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {w.is_backdated && <span className="ml-2 text-xs text-muted">backdated</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-ink">{w.healthy_reps}</td>
                  <td className="px-3 py-3 tabular-nums text-ink">{w.injured_reps}</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-ink">{fmt(w.score)}</td>
                  <td className="px-3 py-3 text-muted">{w.status ?? "—"}</td>
                  <td className="px-3 py-3 tabular-nums text-muted">{w.feeling == null ? "—" : `${w.feeling}/10`}</td>
                  <td className="px-5 py-3 text-right sm:px-6">
                    <Action onClick={() => onSelect(w.id)} label={`View workout ${w.id}`} className="text-xs font-semibold text-brand">
                      View
                    </Action>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Text className="text-sm text-muted">No workouts recorded yet.</Text>
      )}
    </Card>
  );
}

function ActivityView({ rihab }: { rihab: Rihab }) {
  const [selected, setSelected] = useState<number | null>(null);
  // Forget a workout that was deleted (here or elsewhere).
  const open = selected != null && rihab.history.some((w) => w.id === selected) ? selected : null;

  return (
    <>
      <PageIntro title="Activity">Your knee flexibility, reps over time and every workout you've logged.</PageIntro>
      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]" aria-label="Flexibility and reps over time">
        <MetricCard item={flexibilityMetric(rihab)} />
        <ActivityChart history={rihab.history} />
      </section>
      {open != null && (
        <section className="mt-5" aria-label="Workout details">
          <WorkoutDetail key={open} id={open} rihab={rihab} onClose={() => setSelected(null)} />
        </section>
      )}
      <section className="mt-5" aria-label="Workout history">
        <WorkoutHistory history={rihab.history} selected={open} onSelect={setSelected} />
      </section>
    </>
  );
}

type Exercise = { name: string; focus: "Range of motion" | "Strength" | "Control"; dose: string; how: string };

const EXERCISES: Exercise[] = [
  { name: "Heel slides", focus: "Range of motion", dose: "2 × 10", how: "Lying on your back, slide your heel toward you to bend the knee as far as is comfortable, then slide it back out." },
  { name: "Seated knee bends", focus: "Range of motion", dose: "2 × 10", how: "Sitting on a chair, slide your foot back under the seat to bend the knee, hold for 5 seconds, then return." },
  { name: "Quad sets", focus: "Strength", dose: "3 × 10, 5 s hold", how: "Legs straight, tighten the thigh to press the back of your knee into the floor and hold." },
  { name: "Straight leg raises", focus: "Strength", dose: "3 × 10", how: "Lock the knee straight, lift the leg to the height of the other bent knee, and lower it slowly." },
  { name: "Mini squats", focus: "Control", dose: "2 × 10", how: "Holding a counter, bend both knees a little with your weight even, keeping each knee over your toes." },
  { name: "Hamstring stretch", focus: "Range of motion", dose: "3 × 30 s", how: "Seated with the leg out straight, lean forward from the hips until you feel a gentle stretch behind the thigh." },
];

/** Which kind of exercise the latest comparison says to work on, if any. */
function suggestedFocus(rihab: Rihab): Exercise["focus"] | null {
  const c = rihab.comparison;
  if (!c) return null;
  if (c.angle_pct < 85) return "Range of motion";
  if (c.flux_pct != null && c.flux_pct > 15) return "Control";
  return "Strength";
}

// ---------------------------------------------------------------- exercise demos

type Pt = { x: number; y: number };

/** One frame of the stick figure, side view, facing right. The braced leg is the one drawn in front. */
type Pose = {
  head: Pt;
  shoulder: Pt;
  elbow: Pt;
  hand: Pt;
  hip: Pt;
  knee: Pt;
  ankle: Pt;
  toe: Pt;
  other: [knee: Pt, ankle: Pt, toe: Pt];
  /** 0-1: how hard the braced thigh is working, drawn as a glow. */
  effort?: number;
};

type Demo = {
  /** `s` runs 0 → 1 → 0 once per rep. */
  pose: (s: number) => Pose;
  seconds: number;
  /** Fraction of each rep spent holding at the top. */
  hold: number;
  /** Furniture outline, as an SVG path. */
  prop?: string;
};

const BONE = { torso: 34, neck: 10, thigh: 26, shin: 26, upperArm: 17, forearm: 16, foot: 8 };

const mix = (a: number, b: number, s: number) => a + (b - a) * s;
const toward = (p: Pt, deg: number, len: number): Pt => ({
  x: p.x + len * Math.cos((deg * Math.PI) / 180),
  y: p.y + len * Math.sin((deg * Math.PI) / 180),
});

/** Two-bone limb from `root` reaching for `target` (clamped to the limb's length); `side` picks which way the middle joint bends. */
function limb(root: Pt, target: Pt, l1: number, l2: number, side: 1 | -1): [mid: Pt, end: Pt] {
  const angle = Math.atan2(target.y - root.y, target.x - root.x);
  const d = Math.max(Math.min(Math.hypot(target.x - root.x, target.y - root.y), l1 + l2 - 0.01), Math.abs(l1 - l2) + 0.01);
  const bend = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const mid = { x: root.x + l1 * Math.cos(angle + side * bend), y: root.y + l1 * Math.sin(angle + side * bend) };
  return [mid, { x: root.x + d * Math.cos(angle), y: root.y + d * Math.sin(angle) }];
}

/** Lying on the back, head to the left, arms along the body. */
function lyingTop(hip: Pt) {
  const shoulder = toward(hip, 180, BONE.torso);
  const elbow = toward(shoulder, 4, BONE.upperArm);
  return { shoulder, head: toward(shoulder, 180, BONE.neck), elbow, hand: toward(elbow, 0, BONE.forearm) };
}

/** Lying on the back with the knee bent and the foot flat, as the resting leg in several exercises. */
function bentLeg(hip: Pt): Pose["other"] {
  const [knee, ankle] = limb(hip, { x: hip.x + 28, y: 105 }, BONE.thigh, BONE.shin, -1);
  return [knee, ankle, { x: ankle.x + BONE.foot, y: 106 }];
}

function straightLeg(hip: Pt, deg: number): Pose["other"] {
  const knee = toward(hip, deg, BONE.thigh);
  const ankle = toward(knee, deg, BONE.shin);
  return [knee, ankle, toward(ankle, deg - 90, BONE.foot)];
}

const DEMOS: Record<string, Demo> = {
  "Heel slides": {
    seconds: 3.2,
    hold: 0.1,
    pose: (s) => {
      const hip = { x: 95, y: 103 };
      const [knee, ankle] = limb(hip, { x: mix(147, 121, s), y: 105 }, BONE.thigh, BONE.shin, -1);
      return { ...lyingTop(hip), hip, knee, ankle, toe: toward(ankle, mix(-90, -5, s), BONE.foot), other: straightLeg({ x: 95, y: 104 }, 0) };
    },
  },
  "Seated knee bends": {
    seconds: 4.5,
    hold: 0.35,
    prop: "M68 44V110M64 80H100M96 80V110",
    pose: (s) => {
      const hip = { x: 80, y: 76 };
      const shoulder = toward(hip, -95, BONE.torso);
      const elbow = toward(shoulder, 75, BONE.upperArm);
      const knee = { x: 106, y: 76 };
      const ankle = toward(knee, mix(80, 128, s), BONE.shin);
      const otherAnkle = toward({ x: 104, y: 76 }, 84, BONE.shin);
      return {
        head: toward(shoulder, -95, BONE.neck),
        shoulder,
        elbow,
        hand: toward(elbow, 45, BONE.forearm),
        hip,
        knee,
        ankle,
        toe: { x: ankle.x + BONE.foot, y: Math.min(ankle.y + 5, 109) },
        other: [{ x: 104, y: 76 }, otherAnkle, { x: otherAnkle.x + BONE.foot, y: 109 }],
      };
    },
  },
  "Quad sets": {
    seconds: 4,
    hold: 0.4,
    pose: (s) => {
      const hip = { x: 95, y: 103 };
      const knee = { x: 121, y: 103 + 1.5 * s };
      const ankle = { x: 147, y: 104 - 2.5 * s };
      return { ...lyingTop(hip), hip, knee, ankle, toe: toward(ankle, -90, BONE.foot), other: bentLeg(hip), effort: s };
    },
  },
  "Straight leg raises": {
    seconds: 3.6,
    hold: 0.1,
    pose: (s) => {
      const hip = { x: 95, y: 103 };
      const [knee, ankle, toe] = straightLeg(hip, -38 * s);
      return { ...lyingTop(hip), hip, knee, ankle, toe, other: bentLeg(hip), effort: s };
    },
  },
  "Mini squats": {
    seconds: 3,
    hold: 0.05,
    prop: "M128 110V52H182",
    pose: (s) => {
      const hip = { x: 111 - 8 * s, y: 53 + 15 * s };
      const lean = -90 + 18 * s;
      const shoulder = toward(hip, lean, BONE.torso);
      const [elbow, hand] = limb(shoulder, { x: 129, y: 53 }, BONE.upperArm, BONE.forearm, 1);
      const [knee, ankle] = limb(hip, { x: 112, y: 104 }, BONE.thigh, BONE.shin, -1);
      const [otherKnee, otherAnkle] = limb(hip, { x: 108, y: 104 }, BONE.thigh, BONE.shin, -1);
      return {
        head: toward(shoulder, lean, BONE.neck),
        shoulder,
        elbow,
        hand,
        hip,
        knee,
        ankle,
        toe: { x: ankle.x + BONE.foot, y: 108 },
        other: [otherKnee, otherAnkle, { x: otherAnkle.x + BONE.foot, y: 108 }],
        effort: s,
      };
    },
  },
  "Hamstring stretch": {
    seconds: 6,
    hold: 0.5,
    pose: (s) => {
      const hip = { x: 72, y: 104 };
      const lean = mix(-95, -48, s);
      const shoulder = toward(hip, lean, BONE.torso);
      const [elbow, hand] = limb(shoulder, { x: mix(94, 116, s), y: mix(96, 100, s) }, BONE.upperArm, BONE.forearm, -1);
      const [knee, ankle, toe] = straightLeg(hip, 0);
      return { head: toward(shoulder, lean, BONE.neck), shoulder, elbow, hand, hip, knee, ankle, toe, other: straightLeg({ x: 72, y: 102.5 }, 0), effort: s };
    },
  },
};

/** 0 → 1 → 0 over one rep, eased, holding at 1 for `hold` and resting at 0 at the end. */
function repPhase(t: number, hold: number, rest = 0.15) {
  const move = (1 - hold - rest) / 2;
  const ease = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;
  if (t < move) return ease(t / move);
  if (t < move + hold) return 1;
  if (t < 2 * move + hold) return ease(1 - (t - move - hold) / move);
  return 0;
}

/** How far the knee is bent, as the brace would read it: 0° is straight. */
function kneeBend({ hip, knee, ankle }: Pose) {
  const a = Math.atan2(hip.y - knee.y, hip.x - knee.x);
  const b = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
  const inside = Math.abs(((((a - b) * 180) / Math.PI + 540) % 360) - 180);
  return 180 - inside;
}

const line = (...pts: Pt[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

function ExerciseDemo({ name, demo }: { name: string; demo: Demo }) {
  const [s, setS] = useState(0);

  useEffect(() => {
    // With reduced motion, hold the figure still at the top of the rep instead of animating.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setS(1);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setS(repPhase((((now - start) / 1000) % demo.seconds) / demo.seconds, demo.hold));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [demo]);

  const p = demo.pose(s);
  const thighDeg = (Math.atan2(p.knee.y - p.hip.y, p.knee.x - p.hip.x) * 180) / Math.PI;
  const stroke = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

  return (
    <div className="mt-4 rounded-xl bg-canvas p-3">
      <svg viewBox="0 0 200 116" className="h-auto w-full" role="img" aria-label={`Stick figure doing ${name.toLowerCase()} with the brace on the knee`}>
        <line x1="8" y1="110" x2="192" y2="110" stroke="var(--color-line)" strokeWidth="2" strokeLinecap="round" />
        {demo.prop && <path d={demo.prop} {...stroke} stroke="var(--color-muted)" strokeOpacity="0.5" strokeWidth="2.5" />}

        <polyline points={line(p.hip, ...p.other)} {...stroke} stroke="var(--color-muted)" strokeOpacity="0.6" strokeWidth="4" />
        {!!p.effort && <line x1={p.hip.x} y1={p.hip.y} x2={p.knee.x} y2={p.knee.y} stroke="var(--color-brand)" strokeOpacity={p.effort * 0.35} strokeWidth="11" strokeLinecap="round" />}
        <line x1={p.hip.x} y1={p.hip.y} x2={p.shoulder.x} y2={p.shoulder.y} {...stroke} stroke="var(--color-ink)" strokeWidth="4.5" />
        <polyline points={line(p.shoulder, p.elbow, p.hand)} {...stroke} stroke="var(--color-ink)" strokeWidth="3.5" />
        <circle cx={p.head.x} cy={p.head.y} r="6.5" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="3.5" />
        <polyline points={line(p.hip, p.knee, p.ankle, p.toe)} {...stroke} stroke="var(--color-ink)" strokeWidth="4" />

        {/* The brace: a sensor pod strapped across the knee with a blinking status light. */}
        <g transform={`translate(${p.knee.x} ${p.knee.y}) rotate(${thighDeg})`}>
          <rect x="-5.5" y="-4" width="11" height="8" rx="2.5" fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth="1.2" />
          <circle cx="2.2" cy="0" r="1.4" fill="var(--color-mint)" className="animate-pulse" />
        </g>
      </svg>
      <div className="mt-1 flex items-center justify-between px-1 text-xs font-semibold text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-brand" /> Brace reading
        </span>
        <span className="font-mono text-ink tabular-nums">knee bend {kneeBend(p).toFixed(0)}°</span>
      </div>
    </div>
  );
}

function CoachView({ rihab }: { rihab: Rihab }) {
  const focus = suggestedFocus(rihab);
  const [demo, setDemo] = useState<string | null>(null);
  const tone: Record<Exercise["focus"], string> = {
    "Range of motion": "bg-brand-soft text-brand",
    Strength: "bg-orange-soft text-orange",
    Control: "bg-violet-soft text-violet",
  };

  return (
    <>
      <PageIntro title="Workout / stretches coach">
        {focus
          ? `Based on your latest workout, today's focus is ${focus.toLowerCase()}. Track your reps with the brace below.`
          : "Do a few reps with each knee and the coach will suggest what to focus on."}
      </PageIntro>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Exercises">
        {EXERCISES.map((e) => (
          <article key={e.name} className={`flex flex-col rounded-2xl border bg-surface p-5 transition-shadow hover:shadow-card ${e.focus === focus ? "border-brand shadow-selected" : "border-edge shadow-soft"}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone[e.focus]}`}>{e.focus}</span>
              {e.focus === focus && <span className="text-xs font-bold text-brand">Suggested today</span>}
            </div>
            <Text as="h2" className="font-display text-lg font-bold text-ink">{e.name}</Text>
            <Text className="mt-1 text-sm font-semibold text-muted">{e.dose}</Text>
            <Text as="p" className="mt-3 text-sm leading-6 text-ink">{e.how}</Text>
            {DEMOS[e.name] && (
              <div className="mt-auto pt-4">
                <Action
                  onClick={() => setDemo(demo === e.name ? null : e.name)}
                  className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-canvas"
                >
                  <Icon name={demo === e.name ? "stop" : "play"} size="sm" />
                  {demo === e.name ? "Hide demo" : "Show demo"}
                </Action>
                {demo === e.name && <ExerciseDemo name={e.name} demo={DEMOS[e.name]} />}
              </div>
            )}
          </article>
        ))}
      </section>
      <Text as="p" className="mt-3 text-xs text-muted">General guidance only. Follow the plan from your physical therapist, and stop if anything causes sharp pain.</Text>

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.8fr)]" aria-label="Live session">
        <LiveSession rihab={rihab} />
        <RecoveryScore rihab={rihab} />
      </section>
      <section className="mt-5" aria-label="Check-in">
        <WorkoutCheckIn rihab={rihab} />
      </section>
    </>
  );
}

const PROFESSIONALS = [
  { label: "Physical therapists", query: "physical therapist", detail: "Guided rehab and exercise plans" },
  { label: "Orthopedic specialists", query: "orthopedic knee specialist", detail: "Diagnosis, imaging and surgery" },
  { label: "Sports medicine", query: "sports medicine clinic", detail: "Return-to-sport care" },
];

function progressSummary(rihab: Rihab) {
  const c = rihab.comparison;
  const today = startOfDay(new Date());
  const reps = repsBetween(rihab.history, addDays(today, -27), addDays(today, 1));
  const felt = rihab.history.filter((w) => w.feeling != null).slice(0, 5);
  const avgFelt = felt.length ? felt.reduce((n, w) => n + w.feeling!, 0) / felt.length : null;
  const lines = [
    `RiHab progress summary — ${rihab.state?.patient ?? "Patient"} (${new Date().toLocaleDateString()})`,
    c ? `Recovery score: ${c.score.toFixed(0)}/100 (${c.status})` : "Recovery score: not measured yet",
    c ? `Injured knee range: ${c.angle_pct.toFixed(0)}% of healthy (${c.injured_rom_deg.toFixed(0)}° vs ${c.healthy_rom_deg.toFixed(0)}°)` : null,
    `Reps in the last 4 weeks: ${reps}`,
    `Workouts logged: ${rihab.history.length}`,
    avgFelt != null ? `Average post-workout feeling (last ${felt.length}): ${avgFelt.toFixed(1)}/10` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

type Coords = { lat: number; lng: number };

/** Ask the browser for the user's location once; null if they decline or it's unavailable. */
function locate(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

function mapSearch(query: string, at: Coords | null) {
  return at ? `${query} near ${at.lat.toFixed(3)},${at.lng.toFixed(3)}` : `${query} near me`;
}

function ProfessionalsView({ rihab }: { rihab: Rihab }) {
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<(typeof PROFESSIONALS)[number] | null>(null);
  const [coords, setCoords] = useState<Coords | null | "pending">(null);
  const [asked, setAsked] = useState(false);
  const summary = progressSummary(rihab);
  const at = coords === "pending" ? null : coords;
  const search = selected ? mapSearch(selected.query, at) : "";

  const choose = (p: (typeof PROFESSIONALS)[number]) => {
    setSelected(p);
    if (!asked) {
      setAsked(true);
      setCoords("pending");
      locate().then(setCoords);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("RiHab: couldn't copy summary", e);
    }
  };

  return (
    <>
      <PageIntro title="Professionals near you">Find knee specialists nearby, and bring your progress to the appointment.</PageIntro>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Find a professional">
        {PROFESSIONALS.map((p) => (
          <Action
            key={p.label}
            onClick={() => choose(p)}
            current={selected?.label === p.label}
            className={`group flex items-center gap-4 rounded-2xl border bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:shadow-card ${
              selected?.label === p.label ? "border-brand shadow-selected" : "border-edge shadow-soft"
            }`}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Icon name="user" />
            </div>
            <div className="min-w-0 flex-1">
              <Text className="font-semibold text-ink">{p.label}</Text>
              <Text className="mt-0.5 text-xs text-muted">{p.detail}</Text>
            </div>
            <span className="text-muted transition group-hover:text-ink"><Icon name="chevron" size="sm" /></span>
          </Action>
        ))}
      </section>

      {selected ? (
        <section className="mt-5" aria-label="Map">
          <article className="overflow-hidden rounded-2xl border border-edge bg-surface shadow-soft transition-shadow hover:shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:px-6">
              <div>
                <Text as="h2" className="font-display text-lg font-bold text-ink">{selected.label} near you</Text>
                <Text className="mt-1 text-sm text-muted">
                  {coords === "pending" ? "Finding your location…" : at ? "Using your current location" : "Location not shared, so this is a rough area"}
                </Text>
              </div>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(search)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-canvas"
              >
                Open in Google Maps
              </a>
            </div>
            {coords !== "pending" && (
              <iframe
                key={search}
                title={`Map of ${selected.label.toLowerCase()} near you`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(search)}&z=12&output=embed`}
                className="block h-[28rem] w-full border-0 border-t border-line"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </article>
        </section>
      ) : (
        <Text as="p" className="mt-3 text-xs text-muted">Pick a type of professional to see a map of clinics near you.</Text>
      )}

      <section className="mt-5" aria-label="Progress summary">
        <Card title="Share your progress" subtitle="Copy this summary into a message or bring it to your appointment">
          <pre className="whitespace-pre-wrap rounded-xl bg-canvas p-4 font-sans text-sm leading-6 text-ink">{summary}</pre>
          <Action onClick={copy} className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark">
            {copied ? "Copied" : "Copy summary"}
          </Action>
        </Card>
      </section>
    </>
  );
}

function StreakCalendar({ history }: { history: Workout[] }) {
  const today = startOfDay(new Date());
  const monday = addDays(today, -((today.getDay() + 6) % 7) - 7 * 7);
  const days = activeDays(history);
  const grid = Array.from({ length: 8 * 7 }, (_, i) => addDays(monday, i));

  return (
    <Card title="Last 8 weeks" subtitle="Each filled square is a day with at least one rep">
      <div className="grid grid-cols-7 gap-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <Text key={i} className="text-center text-xs font-semibold text-muted">{d}</Text>
        ))}
        {grid.map((d) => {
          const future = d > today;
          const done = days.has(d.getTime());
          return (
            <div
              key={d.getTime()}
              title={d.toLocaleDateString()}
              className={`aspect-square rounded-md ${future ? "bg-transparent" : done ? "bg-brand" : "bg-canvas"} ${d.getTime() === today.getTime() ? "ring-2 ring-orange" : ""}`}
            />
          );
        })}
      </div>
    </Card>
  );
}

function StreakView({ rihab }: { rihab: Rihab }) {
  return (
    <>
      <PageIntro title="Streak">Exercising a little every day is what moves recovery forward.</PageIntro>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]" aria-label="Streak">
        <StreakSection history={rihab.history} />
        <StreakCalendar history={rihab.history} />
      </section>
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold text-ink">{children}</span>
    </div>
  );
}

function DevicesView({ rihab }: { rihab: Rihab }) {
  const link = linkStatus(rihab);
  const s = rihab.state;
  const latest = rihab.latest;
  const flags = latest?.flags;

  return (
    <>
      <PageIntro title="Devices">Your knee brace, its connection, and what it's reporting.</PageIntro>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.8fr)]" aria-label="Brace">
        <LiveSession rihab={rihab} />
        <Card title="Knee brace" subtitle={link.label}>
          <DetailRow label="Source">{s ? "Arduino (USB)" : "—"}</DetailRow>
          <DetailRow label="Port">{s?.port ?? "—"}</DetailRow>
          <DetailRow label="Readings">{s?.connected ? `${rihab.feed.hz} per second` : "—"}</DetailRow>
          <DetailRow label="Last reading">{rihab.feed.lastAt ? new Date(rihab.feed.lastAt).toLocaleTimeString() : "—"}</DetailRow>
          <DetailRow label="Battery">{fmt(latest?.battery, 0, "%")}</DetailRow>
          <DetailRow label="Calibrated">{flags == null ? "—" : flags & FLAG_ANGLE_CAL ? "Yes" : "No"}</DetailRow>
          <DetailRow label="Reps counted by">{s ? (s.rep_mode === "device" ? "The brace" : "The server") : "—"}</DetailRow>
        </Card>
      </section>
      <section className="mt-5" aria-label="Device log">
        <DeviceLog rihab={rihab} />
      </section>
    </>
  );
}

function SettingsView({ rihab }: { rihab: Rihab }) {
  const [patients, setPatients] = useState<{ id: number; name: string; injury: string | null }[] | null>(null);
  useEffect(() => {
    if (!rihab.connected) return;
    api.patients().then(setPatients).catch((e) => console.warn("RiHab: couldn't load patients", e));
  }, [rihab.connected]);

  return (
    <>
      <PageIntro title="Settings">Connection and account details for this dashboard.</PageIntro>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2" aria-label="Settings">
        <Card title="Server" subtitle="Change it with VITE_RIHAB_SERVER in app/.env.local">
          <DetailRow label="Address">{SERVER}</DetailRow>
          <DetailRow label="Status">{rihab.connected ? "Connected" : "Offline"}</DetailRow>
          <DetailRow label="Brace">{linkStatus(rihab).label}</DetailRow>
        </Card>
        <Card title="Patients" subtitle="Start a new workout from the live session to switch patient">
          {patients?.length ? (
            patients.map((p) => (
              <DetailRow key={p.id} label={p.name}>
                {p.name === rihab.state?.patient ? <span className="text-brand">Current</span> : (p.injury ?? "")}
              </DetailRow>
            ))
          ) : (
            <Text className="text-sm text-muted">{rihab.connected ? "No patients yet." : "Connect to the server to see patients."}</Text>
          )}
        </Card>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- page

export default function App() {
  const rihab = useRihab();
  const [view, go] = useView();
  const [theme, toggleTheme] = useTheme();
  const patient = rihab.state?.patient;
  const injury = rihab.workout?.injury ?? rihab.history.find((w) => w.injury)?.injury;

  return (
    <main className="flex min-h-screen bg-canvas text-ink">
      <Sidebar rihab={rihab} active={view} onNavigate={go} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-line bg-canvas/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-night text-white">
              <RiHabMark />
            </div>
            <Text className="font-display font-bold">RiHab</Text>
          </div>
          <div className="hidden sm:block">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
            <Text className="mt-1 font-display text-lg font-bold text-ink">{VIEW_TITLES[view]}</Text>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Action
              onClick={toggleTheme}
              className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink"
              label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </Action>
            <Action onClick={() => go("devices")} className="relative flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink" label="Notifications">
              <Icon name="bell" />
              {rihab.logs.some((l) => l.level !== "info") && <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose ring-2 ring-surface" />}
            </Action>
            <div className="h-8 w-px bg-line" />
            <Action onClick={() => go("settings")} className="flex items-center gap-3 rounded-xl p-1.5 pr-2 hover:bg-surface">
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

        <nav className="flex gap-1.5 overflow-x-auto border-b border-line px-5 py-2 sm:px-8 lg:hidden" aria-label="Primary navigation">
          {[...navItems, { id: "settings" as const, label: "Settings", icon: "settings" as const }].map((item) => (
            <Action
              key={item.id}
              onClick={() => go(item.id)}
              current={view === item.id}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                view === item.id ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface hover:text-ink"
              }`}
            >
              <Icon name={item.icon} size="sm" />
              {item.label}
            </Action>
          ))}
        </nav>

        <div className="mx-auto max-w-screen-2xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {view === "overview" && <OverviewView rihab={rihab} />}
          {view === "activity" && <ActivityView rihab={rihab} />}
          {view === "coach" && <CoachView rihab={rihab} />}
          {view === "professionals" && <ProfessionalsView rihab={rihab} />}
          {view === "streak" && <StreakView rihab={rihab} />}
          {view === "devices" && <DevicesView rihab={rihab} />}
          {view === "settings" && <SettingsView rihab={rihab} />}
        </div>
      </div>
    </main>
  );
}
