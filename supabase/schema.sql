-- schema.sql — paste this whole file into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.
--
-- Two tables + one function:
--   sessions        one row per exercise session (summary + advice filled in at the end)
--   readings        every knee-angle sample (25 per second), linked to a session
--   finish_session  runs INSIDE Supabase: crunches a session's readings into stats + advice
--
-- ⚠ HACKATHON SECURITY: anyone with your publishable/anon key can insert and read sessions.
--   Fine for a demo with fake/your own data. Real patient data needs login + per-user policies.

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  ended_at     timestamptz,
  source       text,                                            -- 'serial', 'ble' or 'mock'
  pain_before  smallint check (pain_before between 0 and 10),   -- self-reported, 0–10
  -- filled in by finish_session():
  samples      int,
  duration_s   real,
  max_angle    real,   -- deepest bend (degrees)
  min_angle    real,   -- straightest point (0 = fully straight)
  rom          real,   -- range of motion = max - min
  reps         int,
  avg_emg      real,
  advice       text[]
);

create table if not exists public.readings (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  seq         int not null,
  t_ms        bigint not null,   -- brace clock, ms since it powered on
  knee_angle  real not null,
  emg         real
);
create index if not exists readings_session_time on public.readings (session_id, t_ms);

-- Row Level Security: on, with demo-only open policies.
alter table public.sessions enable row level security;
alter table public.readings enable row level security;

drop policy if exists "demo insert sessions" on public.sessions;
create policy "demo insert sessions" on public.sessions for insert to anon, authenticated with check (true);
drop policy if exists "demo read sessions" on public.sessions;
create policy "demo read sessions" on public.sessions for select to anon, authenticated using (true);
drop policy if exists "demo insert readings" on public.readings;
create policy "demo insert readings" on public.readings for insert to anon, authenticated with check (true);

grant select, insert on public.sessions to anon, authenticated;
grant insert on public.readings to anon, authenticated;

-- ============================================================================
-- finish_session: the "processing" step. Called by the app when you press Stop.
-- ============================================================================
create or replace function public.finish_session(p_session_id uuid)
returns json
language plpgsql
security definer          -- runs with owner rights so it can update the session row
set search_path = public
as $$
declare
  cur     public.sessions;
  prev    public.sessions;
  tips    text[] := '{}';
  a       real;
  mid     boolean := false;
  n_reps  int := 0;
begin
  -- 0. Count reps exactly like the Arduino and the website do:
  --    a rep = bend past 60°, then straighten below 20°.
  for a in select knee_angle from readings where session_id = p_session_id order by t_ms loop
    if not mid and a > 60 then
      mid := true;
    elsif mid and a < 20 then
      mid := false;
      n_reps := n_reps + 1;
    end if;
  end loop;

  -- 1. Crunch the raw readings into summary numbers.
  with r as (
    select knee_angle, emg
    from readings
    where session_id = p_session_id
  ), s as (
    select count(*)::int                                   as samples,
           coalesce((select (max(t_ms) - min(t_ms)) / 1000.0
                     from readings where session_id = p_session_id), 0) as duration_s,
           max(knee_angle)                                  as max_angle,
           min(knee_angle)                                  as min_angle,
           avg(emg)                                         as avg_emg
    from r
  )
  update sessions
     set ended_at   = now(),
         samples    = s.samples,
         duration_s = s.duration_s,
         max_angle  = s.max_angle,
         min_angle  = s.min_angle,
         rom        = s.max_angle - s.min_angle,
         reps       = n_reps,
         avg_emg    = s.avg_emg
    from s
   where sessions.id = p_session_id;

  select * into cur from sessions where id = p_session_id;
  if not found then
    raise exception 'session % not found', p_session_id;
  end if;

  -- 2. Find the previous finished session to measure progress.
  select * into prev from sessions
   where ended_at is not null and id <> cur.id and created_at < cur.created_at and samples > 0
   order by created_at desc limit 1;

  -- 3. Rule-based advice. Wellness guidance only — tune the thresholds with your team.
  if coalesce(cur.samples, 0) < 25 then
    tips := array_append(tips, 'Not enough data recorded — try a session of at least 30 seconds.');
  else
    if cur.max_angle < 90 then
      tips := array_append(tips, format('Bend reached %s°. Below 90° suggests limited flexion: try gentle heel slides and seated knee bends.', round(cur.max_angle::numeric)));
    elsif cur.max_angle >= 120 then
      tips := array_append(tips, format('Great bend: %s°. That is in a healthy everyday range.', round(cur.max_angle::numeric)));
    end if;

    if cur.min_angle > 10 then
      tips := array_append(tips, format('Your knee did not fully straighten (closest: %s°). Try quad sets and heel props to work on extension.', round(cur.min_angle::numeric)));
    end if;

    if cur.reps = 0 then
      tips := array_append(tips, 'No full reps detected — a rep counts when you bend past 60° and straighten below 20°.');
    end if;

    if prev.id is not null and prev.rom is not null then
      if cur.rom - prev.rom >= 5 then
        tips := array_append(tips, format('Range of motion improved by %s° since your last session. Keep going!', round((cur.rom - prev.rom)::numeric)));
      elsif prev.rom - cur.rom >= 10 then
        tips := array_append(tips, format('Range of motion dropped %s° since last time. Take it easy and watch for swelling.', round((prev.rom - cur.rom)::numeric)));
      end if;
    end if;
  end if;

  if cur.pain_before >= 7 then
    tips := array_append(tips, 'You reported high pain (7+/10). Rest, and talk to a doctor or physiotherapist before pushing harder.');
  end if;

  tips := array_append(tips, 'This is general wellness information, not a medical diagnosis.');

  update sessions set advice = tips where id = p_session_id;

  -- 4. Hand the results back to the app.
  return json_build_object(
    'session_id', cur.id,
    'samples',    cur.samples,
    'duration_s', round(cur.duration_s::numeric, 1),
    'max_angle',  round(cur.max_angle::numeric, 1),
    'min_angle',  round(cur.min_angle::numeric, 1),
    'rom',        round(cur.rom::numeric, 1),
    'reps',       cur.reps,
    'prev_rom',   round(prev.rom::numeric, 1),
    'advice',     tips
  );
end;
$$;

grant execute on function public.finish_session(uuid) to anon, authenticated;

-- ============================================================================
-- Post-workout check-in (RiHab design): "How did you feel after your workout?" 1–10
-- ============================================================================
alter table public.sessions add column if not exists feel_after smallint check (feel_after between 1 and 10);

create or replace function public.set_session_feel(p_session_id uuid, p_score smallint)
returns void
language sql
security definer
set search_path = public
as $$
  update sessions set feel_after = p_score where id = p_session_id and ended_at is not null;
$$;

grant execute on function public.set_session_feel(uuid, smallint) to anon, authenticated;
