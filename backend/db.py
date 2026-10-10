"""Phase 4: the database. SQLAlchemy models plus every query the server needs.

One row per workout (with its comparison results), one row per rep (with its own timestamp).
All times are stored as UTC and returned as ISO strings with a timezone offset.

Pick the database with DATABASE_URL. Default is the Postgres from docker-compose.yml;
`DATABASE_URL=sqlite:///rihab.db` runs the same code on a local file.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Iterator, Optional

from sqlalchemy import (
    DateTime, Float, ForeignKey, Integer, String, Text, TypeDecorator, create_engine, delete, select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

import analysis

DEFAULT_URL = "postgresql+psycopg://rihab:rihab_local@localhost:5433/rihab"
BACKDATED_AFTER = timedelta(minutes=5)  # performed_at further in the past than this = backdated
KNEES = ("healthy", "injured")


class UTCDateTime(TypeDecorator):
    """timestamptz that always comes back timezone-aware, even on SQLite (which drops the zone)."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            value = to_utc(value)
            if dialect.name == "sqlite":
                value = value.replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class Base(DeclarativeBase):
    pass


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    injury: Mapped[Optional[str]] = mapped_column(String(200))
    workouts: Mapped[list["Workout"]] = relationship(back_populates="patient", cascade="all, delete-orphan")


class Workout(Base):
    __tablename__ = "workouts"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    performed_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime)
    is_backdated: Mapped[bool] = mapped_column(default=False)
    healthy_reps: Mapped[int] = mapped_column(Integer, default=0)
    injured_reps: Mapped[int] = mapped_column(Integer, default=0)
    angle_pct: Mapped[Optional[float]] = mapped_column(Float)
    speed_pct: Mapped[Optional[float]] = mapped_column(Float)
    flux_pct: Mapped[Optional[float]] = mapped_column(Float)
    score: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[Optional[str]] = mapped_column(String(40))
    summary: Mapped[Optional[str]] = mapped_column(Text)
    baseline_from: Mapped[Optional[datetime]] = mapped_column(UTCDateTime)  # set when healthy reps were borrowed
    patient: Mapped[Patient] = relationship(back_populates="workouts")
    measurements: Mapped[list["Measurement"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan", order_by="Measurement.measured_at"
    )


class Measurement(Base):
    __tablename__ = "measurements"
    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id", ondelete="CASCADE"), index=True)
    measured_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    knee: Mapped[str] = mapped_column(String(10))           # healthy | injured
    rom_deg: Mapped[float] = mapped_column(Float)
    duration_s: Mapped[float] = mapped_column(Float)
    flux: Mapped[Optional[float]] = mapped_column(Float)
    vision_rom_deg: Mapped[Optional[float]] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(10), default="python")  # device | python | manual
    workout: Mapped[Workout] = relationship(back_populates="measurements")


# ---------------------------------------------------------------- engine / sessions

_engine = None
_Session: Optional[sessionmaker] = None


def init_db(url: Optional[str] = None) -> str:
    """Connect and create any missing tables. Returns the URL used, with the password hidden."""
    global _engine, _Session
    url = url or os.environ.get("DATABASE_URL") or DEFAULT_URL
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    if _engine is not None:
        _engine.dispose()
    _engine = create_engine(url, **kwargs)
    _Session = sessionmaker(_engine, expire_on_commit=False)
    Base.metadata.create_all(_engine)
    return _engine.url.render_as_string(hide_password=True)


@contextmanager
def session() -> Iterator[Session]:
    if _Session is None:
        init_db()
    with _Session() as s:
        yield s


# ---------------------------------------------------------------- time helpers

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_utc(dt: datetime) -> datetime:
    """Naive datetimes are treated as the laptop's local time."""
    if dt.tzinfo is None:
        dt = dt.astimezone()  # attaches the local zone
    return dt.astimezone(timezone.utc)


def parse_time(value) -> Optional[datetime]:
    """Accepts a datetime, or strings like '2026-09-30 18:00', '2026-09-30T18:00:00Z', '...+02:00'."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return to_utc(value)
    text = str(value).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return to_utc(datetime.fromisoformat(text))
    except ValueError:
        raise ValueError(f"Can't read the time {value!r}. Use e.g. '2026-09-30 18:00'.") from None


def iso(dt: Optional[datetime]) -> Optional[str]:
    return None if dt is None else to_utc(dt).isoformat()


# ---------------------------------------------------------------- serializers

def patient_dict(p: Patient) -> dict:
    return {"id": p.id, "name": p.name, "injury": p.injury}


def measurement_dict(m: Measurement) -> dict:
    return {
        "id": m.id, "workout_id": m.workout_id, "measured_at": iso(m.measured_at), "knee": m.knee,
        "rom_deg": m.rom_deg, "duration_s": m.duration_s, "flux": m.flux,
        "vision_rom_deg": m.vision_rom_deg, "source": m.source,
    }


def workout_dict(w: Workout, with_measurements: bool = False) -> dict:
    d = {
        "id": w.id, "patient": w.patient.name, "patient_id": w.patient_id, "injury": w.patient.injury,
        "performed_at": iso(w.performed_at), "recorded_at": iso(w.recorded_at), "is_backdated": w.is_backdated,
        "healthy_reps": w.healthy_reps, "injured_reps": w.injured_reps,
        "angle_pct": w.angle_pct, "speed_pct": w.speed_pct, "flux_pct": w.flux_pct,
        "score": w.score, "status": w.status, "summary": w.summary, "baseline_from": iso(w.baseline_from),
    }
    if with_measurements:
        d["measurements"] = [measurement_dict(m) for m in w.measurements]
    return d


# ---------------------------------------------------------------- queries

def get_or_create_patient(s: Session, name: str, injury: Optional[str] = None) -> Patient:
    name = (name or "").strip() or "Patient"
    p = s.scalar(select(Patient).where(Patient.name == name))
    if p is None:
        p = Patient(name=name, injury=injury)
        s.add(p)
        s.flush()
    elif injury and injury != p.injury:
        p.injury = injury
    return p


def list_patients() -> list[dict]:
    with session() as s:
        return [patient_dict(p) for p in s.scalars(select(Patient).order_by(Patient.name))]


def _new_workout(s: Session, patient: str, injury: Optional[str], performed_at) -> Workout:
    now = now_utc()
    when = parse_time(performed_at) or now
    w = Workout(
        patient=get_or_create_patient(s, patient, injury),
        performed_at=when, recorded_at=now, is_backdated=(now - when) > BACKDATED_AFTER,
    )
    s.add(w)
    s.flush()
    return w


def start_workout(patient: str, injury: Optional[str] = None, performed_at=None) -> dict:
    """Open a new (empty) workout. performed_at=None means right now."""
    with session() as s:
        w = _new_workout(s, patient, injury, performed_at)
        s.commit()
        return workout_dict(w)


def add_measurement(workout_id: int, knee: str, rom_deg: float, duration_s: float, flux: Optional[float],
                    measured_at=None, vision_rom_deg: Optional[float] = None, source: str = "python") -> dict:
    """Save one rep immediately, so nothing is lost if the server crashes mid-workout."""
    if knee not in KNEES:
        raise ValueError(f"knee must be one of {KNEES}")
    with session() as s:
        w = s.get(Workout, workout_id)
        if w is None:
            raise KeyError(workout_id)
        m = Measurement(
            workout=w, knee=knee, rom_deg=rom_deg, duration_s=duration_s, flux=flux,
            measured_at=parse_time(measured_at) or now_utc(), vision_rom_deg=vision_rom_deg, source=source,
        )
        s.add(m)
        if knee == "healthy":
            w.healthy_reps += 1
        else:
            w.injured_reps += 1
        s.commit()
        return measurement_dict(m)


def _reps(measurements: list[Measurement], knee: str) -> list[dict]:
    return [measurement_dict(m) for m in sorted(measurements, key=lambda m: m.measured_at) if m.knee == knee]


def _recompute(s: Session, w: Workout) -> Optional[analysis.Comparison]:
    healthy = _reps(w.measurements, "healthy")
    baseline_from = None
    if not healthy:
        # Borrow the healthy-knee baseline from the most recent earlier workout that has one.
        donor = s.scalar(
            select(Workout)
            .where(Workout.patient_id == w.patient_id, Workout.id != w.id,
                   Workout.healthy_reps > 0, Workout.performed_at <= w.performed_at)
            .order_by(Workout.performed_at.desc())
            .limit(1)
        )
        if donor is not None:
            healthy = _reps(donor.measurements, "healthy")
            baseline_from = donor.performed_at

    c = analysis.compare(healthy, _reps(w.measurements, "injured"))
    w.healthy_reps = sum(m.knee == "healthy" for m in w.measurements)
    w.injured_reps = sum(m.knee == "injured" for m in w.measurements)
    w.baseline_from = baseline_from if c else None
    w.angle_pct = c.angle_pct if c else None
    w.speed_pct = c.speed_pct if c else None
    w.flux_pct = c.flux_pct if c else None
    w.score = c.score if c else None
    w.status = c.status if c else None
    w.summary = c.summary if c else None
    return c


def recompute(workout_id: int) -> Optional[dict]:
    """Recalculate a workout's comparison and save it on the row. Returns the full comparison."""
    with session() as s:
        w = s.get(Workout, workout_id)
        if w is None:
            raise KeyError(workout_id)
        c = _recompute(s, w)
        s.commit()
        if c is None:
            return None
        return {**c.to_dict(), "workout_id": w.id, "baseline_from": iso(w.baseline_from)}


def _recompute_patient(s: Session, patient_id: int) -> None:
    """Moving or deleting a workout can change which baseline the others borrow, so redo them all."""
    for w in s.scalars(select(Workout).where(Workout.patient_id == patient_id).order_by(Workout.performed_at)):
        _recompute(s, w)


def create_manual_workout(patient: str, performed_at, measurements: list[dict], injury: Optional[str] = None) -> dict:
    """Enter a past workout by hand. Each measurement may carry its own measured_at;
    otherwise they're spaced 30 s apart starting at performed_at."""
    when = parse_time(performed_at)
    if when is None:
        raise ValueError("performed_at is required")
    with session() as s:
        w = _new_workout(s, patient, injury, when)
        for i, m in enumerate(measurements):
            knee = m.get("knee")
            if knee not in KNEES:
                raise ValueError(f"measurement {i}: knee must be one of {KNEES}")
            s.add(Measurement(
                workout=w, knee=knee, rom_deg=float(m["rom_deg"]), duration_s=float(m["duration_s"]),
                flux=None if m.get("flux") is None else float(m["flux"]),
                vision_rom_deg=m.get("vision_rom_deg"),
                measured_at=parse_time(m.get("measured_at")) or when + timedelta(seconds=30 * i),
                source=m.get("source") or "manual",
            ))
        s.flush()
        _recompute_patient(s, w.patient_id)
        s.commit()
        return workout_dict(w, with_measurements=True)


def move_workout(workout_id: int, performed_at) -> dict:
    """Backdate (or forward-date) a workout. Its measurements shift by the same amount."""
    when = parse_time(performed_at)
    if when is None:
        raise ValueError("performed_at is required")
    with session() as s:
        w = s.get(Workout, workout_id)
        if w is None:
            raise KeyError(workout_id)
        delta = when - w.performed_at
        for m in w.measurements:
            m.measured_at = m.measured_at + delta
        w.performed_at = when
        w.is_backdated = (w.recorded_at - when) > BACKDATED_AFTER
        s.flush()
        _recompute_patient(s, w.patient_id)
        s.commit()
        return workout_dict(w, with_measurements=True)


def delete_workout(workout_id: int) -> bool:
    with session() as s:
        w = s.get(Workout, workout_id)
        if w is None:
            return False
        patient_id = w.patient_id
        s.delete(w)
        s.flush()
        _recompute_patient(s, patient_id)
        s.commit()
        return True


def delete_patient_workouts(patient: str) -> int:
    with session() as s:
        p = s.scalar(select(Patient).where(Patient.name == patient))
        if p is None:
            return 0
        ids = list(s.scalars(select(Workout.id).where(Workout.patient_id == p.id)))
        s.execute(delete(Measurement).where(Measurement.workout_id.in_(ids)))
        s.execute(delete(Workout).where(Workout.id.in_(ids)))
        s.commit()
        return len(ids)


def get_workout(workout_id: int) -> Optional[dict]:
    with session() as s:
        w = s.get(Workout, workout_id)
        return None if w is None else workout_dict(w, with_measurements=True)


def _patient_filter(stmt, patient: Optional[str]):
    return stmt.join(Workout.patient).where(Patient.name == patient) if patient else stmt


def list_workouts(patient: Optional[str] = None) -> list[dict]:
    """Newest first."""
    with session() as s:
        stmt = _patient_filter(select(Workout), patient).order_by(Workout.performed_at.desc())
        return [workout_dict(w) for w in s.scalars(stmt)]


def progress(patient: Optional[str] = None) -> list[dict]:
    """One row per analysed workout, oldest first. This is what the recovery chart plots."""
    with session() as s:
        stmt = (_patient_filter(select(Workout), patient)
                .where(Workout.score.is_not(None)).order_by(Workout.performed_at))
        return [
            {k: d[k] for k in ("id", "performed_at", "is_backdated", "angle_pct", "speed_pct",
                               "flux_pct", "score", "status", "injured_reps", "baseline_from")}
            for d in (workout_dict(w) for w in s.scalars(stmt))
        ]
