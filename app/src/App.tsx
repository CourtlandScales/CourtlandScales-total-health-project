import { useState, type ReactNode } from "react";

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
  | "settings"
  | "shoe"
  | "spark"
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
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  shoe: <path d="M4 6v7c0 1.1.9 2 2 2h3l2 3h8.5a2.5 2.5 0 0 0 0-5H15l-4-2-2-5H4Z" />,
  spark: <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Zm6 13 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />,
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
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  label?: string;
}) {
  const Component = "button";
  return (
    <Component type="button" className={className} onClick={onClick} aria-label={label}>
      {children}
    </Component>
  );
}

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

function Sidebar() {
  const [active, setActive] = useState("Overview");

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
            <span className="flex items-center gap-1.5 text-xs text-mint">
              <span className="size-1.5 rounded-full bg-mint" />
              Connected
            </span>
          </div>
          <Text className="mb-1 text-sm font-semibold">Pulse Band Pro</Text>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Battery</span>
            <span>84%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-5/6 rounded-full bg-mint" />
          </div>
        </div>
        <Action className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted hover:bg-canvas hover:text-ink">
          <Icon name="settings" />
          Settings
        </Action>
      </div>
    </aside>
  );
}

const metricData: { label: string; value: string; detail: string; trend: string; icon: IconName; tone: string }[] = [
  { label: "Muscle activation", value: "74%", detail: "quad activation", trend: "+5%", icon: "activity", tone: "bg-orange-soft text-orange" },
  { label: "Knee flexibility", value: "118°", detail: "range of motion", trend: "+6°", icon: "joint", tone: "bg-brand-soft text-brand" },
  { label: "Skin temperature", value: "33.4°", detail: "within range", trend: "Stable", icon: "thermometer", tone: "bg-rose-soft text-rose" },
];

function MetricCard({ item }: { item: (typeof metricData)[number] }) {
  return (
    <article className="group rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="mb-5 flex items-start justify-between">
        <div className={`flex size-10 items-center justify-center rounded-xl ${item.tone}`}>
          <Icon name={item.icon} />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-xs font-semibold text-success">
          <Icon name="trend" size="sm" />
          {item.trend}
        </div>
      </div>
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</Text>
      <div className="flex items-end gap-2">
        <Text className="font-display text-3xl font-bold tracking-tight text-ink">{item.value}</Text>
        <Text className="mb-1 text-xs text-muted">{item.detail}</Text>
      </div>
    </article>
  );
}

function WorkoutCheckIn() {
  const [score, setScore] = useState(7);
  const message = score <= 3 ? "Take it easy and prioritize recovery" : score <= 6 ? "A steady session—listen to your body" : "You are feeling strong after this session";
  const Range = "input";

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2 sm:p-6 xl:col-span-3">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4 lg:w-72 lg:shrink-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet">
            <Icon name="spark" />
          </div>
          <div>
            <Text as="h2" className="font-display text-lg font-bold text-ink">Post-workout check-in</Text>
            <Text className="mt-1 text-sm text-muted">How did you feel after your workout?</Text>
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
            onChange={(event) => setScore(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-violet"
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
      </div>
    </article>
  );
}

const activityPeriods = {
  Week: {
    total: "286",
    change: "+12.4%",
    comparison: "week",
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    values: [32, 38, 35, 44, 39, 46, 52],
  },
  Month: {
    total: "1,148",
    change: "+8.6%",
    comparison: "month",
    labels: ["W1", "W2", "W3", "W4"],
    values: [248, 276, 294, 330],
  },
  YTD: {
    total: "7,842",
    change: "+18.2%",
    comparison: "year",
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [420, 468, 512, 548, 590, 618, 642, 688, 720, 748, 824, 1064],
  },
};

function ActivityChart() {
  const [period, setPeriod] = useState<keyof typeof activityPeriods>("Week");
  const data = activityPeriods[period];
  const maximum = Math.max(...data.values);
  const minimum = Math.min(...data.values);
  const range = maximum - minimum || 1;
  const points = data.values.map((value, index) => {
    const x = (index / (data.values.length - 1)) * 500;
    const y = 130 - ((value - minimum) / range) * 110;
    return { x, y };
  });
  const linePoints = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPoints = `0,150 ${linePoints} 500,150`;
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
        <Text className="font-display text-3xl font-bold text-ink">{data.total}</Text>
        <Text className="text-sm text-muted">successful reps</Text>
        <Text className="ml-auto text-xs font-semibold text-success">{data.change} vs last {data.comparison}</Text>
      </div>

      <div className="relative h-44 w-full">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-line" />)}
        </div>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none" aria-label="Weekly activity line chart">
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

function GoalRing() {
  return (
    <article className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Text as="h2" className="font-display text-lg font-bold text-ink">Today&apos;s rehab goals</Text>
          <Text className="mt-1 text-sm text-muted">Knee strength and stretching</Text>
        </div>
        <Action className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink" label="View goal details">
          <Icon name="chevron" size="sm" />
        </Action>
      </div>
      <div className="relative mx-auto mb-6 flex size-40 items-center justify-center">
        <svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-label="83 percent of today's rehab exercises complete">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-canvas)" strokeWidth="10" />
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-brand)" strokeWidth="10" strokeLinecap="round" strokeDasharray="314" strokeDashoffset="53" />
        </svg>
        <div className="absolute text-center">
          <Text className="font-display text-3xl font-bold text-ink">5/6</Text>
          <Text className="text-xs text-muted">exercises done</Text>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-line border-t border-line pt-5 text-center">
        <div>
          <Text className="font-display font-bold text-ink">3/3</Text>
          <Text className="mt-1 text-xs text-muted">Knee strength</Text>
        </div>
        <div>
          <Text className="font-display font-bold text-ink">2/3</Text>
          <Text className="mt-1 text-xs text-muted">Stretches</Text>
        </div>
      </div>
    </article>
  );
}

function StreakSection() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Text as="h2" className="font-display text-lg font-bold text-ink">Exercise streak</Text>
          <Text className="mt-1 text-sm text-muted">Stay consistent with your stretches and exercises</Text>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-orange-soft px-3 py-2 text-orange">
          <Icon name="flame" />
          <Text className="font-display text-lg font-bold">12 days</Text>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {week.map((date) => {
          const isToday = date.getTime() === today.getTime();
          const isCompleted = date <= today;
          return (
            <div key={date.toISOString()} className={`flex min-w-0 flex-col items-center rounded-xl py-2.5 ${isToday ? "bg-orange-soft" : "bg-canvas"}`}>
              <Text className={`mb-2 text-xs font-semibold uppercase ${isToday ? "text-orange" : "text-muted"}`}>
                {date.toLocaleDateString("en-US", { weekday: "narrow" })}
              </Text>
              <div className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
                isToday
                  ? "bg-orange text-white shadow-sm"
                  : isCompleted
                    ? "bg-brand-soft text-brand"
                    : "text-muted"
              }`}>
                {isToday ? <Icon name="flame" size="sm" /> : date.getDate()}
              </div>
              <span className={`mt-2 size-1.5 rounded-full ${isCompleted ? "bg-success" : "bg-line"}`} />
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <div>
          <Text className="text-sm font-semibold text-ink">All exercises completed today</Text>
          <Text className="mt-1 text-xs text-muted">Your longest streak is 18 days</Text>
        </div>
        <Text className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">4 of 4</Text>
      </div>
    </article>
  );
}

function SyncStatus() {
  return (
    <article className="relative overflow-hidden rounded-2xl bg-brand p-6 text-white shadow-brand">
      <div className="absolute -right-10 -top-10 size-40 rounded-full border border-white/10" />
      <div className="absolute -right-2 -top-2 size-24 rounded-full border border-white/10" />
      <div className="relative">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/15">
            <Icon name="cloud" size="lg" />
          </div>
          <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-ink">Live</span>
        </div>
        <Text as="h2" className="font-display text-xl font-bold">Cloud sync is active</Text>
        <Text className="mt-2 max-w-xs text-sm leading-6 text-white/70">Your wearable data is encrypted and backed up in real time.</Text>
        <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4 text-xs text-white/60">
          <span>Last synced just now</span>
          <span className="flex items-center gap-1.5 text-white">
            <Icon name="bluetooth" size="sm" />
            Pulse Band
          </span>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  return (
    <main className="flex min-h-screen bg-canvas text-ink">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-line bg-canvas/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-ink text-white">
              <Icon name="activity" />
            </div>
            <Text className="font-display font-bold">Pulseform</Text>
          </div>
          <div className="hidden sm:block">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Thursday, May 23</Text>
            <Text className="mt-1 font-display text-lg font-bold text-ink">Health overview</Text>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Action className="relative flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink" label="Notifications">
              <Icon name="bell" />
              <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose ring-2 ring-surface" />
            </Action>
            <div className="h-8 w-px bg-line" />
            <Action className="flex items-center gap-3 rounded-xl p-1.5 pr-2 hover:bg-surface">
              <div className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon name="user" />
              </div>
              <div className="hidden text-left sm:block">
                <Text className="text-sm font-bold text-ink">Maya Chen</Text>
                <Text className="text-xs text-muted">Premium member</Text>
              </div>
              <Icon name="chevron" size="sm" />
            </Action>
          </div>
        </header>

        <div className="mx-auto max-w-screen-2xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Text as="h1" className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Welcome back</Text>
              <Text as="p" className="mt-2 text-sm text-muted sm:text-base">Your body is ready for a strong day. Here&apos;s your progress.</Text>
            </div>
            <div className="flex items-center gap-2 self-start rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted sm:self-auto">
              <span className="size-2 rounded-full bg-success shadow-status" />
              All systems operational
            </div>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Daily health metrics">
            {metricData.map((item) => <MetricCard key={item.label} item={item} />)}
            <WorkoutCheckIn />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.8fr)]" aria-label="Activity details">
            <ActivityChart />
            <GoalRing />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]" aria-label="Sync and recent activity">
            <StreakSection />
            <SyncStatus />
          </section>
        </div>
      </div>
    </main>
  );
}
