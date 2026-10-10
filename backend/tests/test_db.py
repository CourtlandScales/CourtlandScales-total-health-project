from datetime import datetime, timedelta, timezone

import pytest

import db

H = {"knee": "healthy", "rom_deg": 130, "duration_s": 3.0, "flux": 10}
I = {"knee": "injured", "rom_deg": 91, "duration_s": 3.9, "flux": 27}


def test_parse_time_rules():
    assert db.parse_time("2026-09-30T18:00:00Z") == datetime(2026, 9, 30, 18, tzinfo=timezone.utc)
    assert db.parse_time("2026-09-30T18:00:00+02:00") == datetime(2026, 9, 30, 16, tzinfo=timezone.utc)
    naive = db.parse_time("2026-09-30 18:00")  # laptop local time
    assert naive == datetime(2026, 9, 30, 18).astimezone().astimezone(timezone.utc)
    assert db.parse_time(None) is None
    with pytest.raises(ValueError):
        db.parse_time("last tuesday")


def test_live_workout_flow(fresh_db):
    w = db.start_workout("Alex", "ACL")
    assert not w["is_backdated"]
    db.add_measurement(w["id"], "healthy", 130, 3.0, 10)
    assert db.recompute(w["id"]) is None  # no injured reps yet
    db.add_measurement(w["id"], "injured", 91, 3.9, 27)
    c = db.recompute(w["id"])
    assert c["angle_pct"] == 70.0 and c["baseline_from"] is None
    row = db.get_workout(w["id"])
    assert row["healthy_reps"] == 1 and row["injured_reps"] == 1 and row["score"] == c["score"]
    assert row["measurements"][0]["measured_at"].endswith("+00:00")


def test_backdated_manual_workout_borrows_earlier_baseline(fresh_db):
    first = db.create_manual_workout("Alex", "2026-09-01 18:00", [H, I])
    assert first["is_backdated"] and first["baseline_from"] is None
    later = db.create_manual_workout("Alex", "2026-09-08 18:00", [I, {**I, "rom_deg": 104}])
    assert later["baseline_from"] == first["performed_at"]
    assert later["angle_pct"] == pytest.approx(97.5 / 130 * 100, abs=0.1)
    assert [m["measured_at"] for m in later["measurements"]] == [
        db.iso(db.parse_time("2026-09-08 18:00")),
        db.iso(db.parse_time("2026-09-08 18:00") + timedelta(seconds=30)),
    ]
    # A workout dated before any healthy baseline can't be scored.
    early = db.create_manual_workout("Alex", "2026-08-01 18:00", [I])
    assert early["score"] is None
    assert [p["id"] for p in db.progress("Alex")] == [first["id"], later["id"]]


def test_move_shifts_measurements_and_recomputes(fresh_db):
    base = db.create_manual_workout("Alex", "2026-09-10 18:00", [H])
    w = db.create_manual_workout("Alex", "2026-09-12 18:00", [I, {**I, "measured_at": "2026-09-12 18:05"}])
    assert w["score"] is not None
    moved = db.move_workout(w["id"], "2026-09-01 09:00")  # now before the baseline existed
    assert moved["score"] is None and moved["baseline_from"] is None
    assert moved["measurements"][1]["measured_at"] == db.iso(db.parse_time("2026-09-01 09:05"))
    back = db.move_workout(w["id"], "2026-09-11 09:00")
    assert back["baseline_from"] == base["performed_at"]


def test_delete_recomputes_dependents(fresh_db):
    base = db.create_manual_workout("Alex", "2026-09-10 18:00", [H])
    w = db.create_manual_workout("Alex", "2026-09-12 18:00", [I])
    assert db.get_workout(w["id"])["score"] is not None
    assert db.delete_workout(base["id"])
    assert db.get_workout(w["id"])["score"] is None
    assert not db.delete_workout(9999)


def test_patients_are_separate(fresh_db):
    db.create_manual_workout("Alex", "2026-09-10 18:00", [H])
    w = db.create_manual_workout("Sam", "2026-09-12 18:00", [I])
    assert w["score"] is None  # Alex's baseline doesn't leak to Sam
    assert {p["name"] for p in db.list_patients()} == {"Alex", "Sam"}
    assert len(db.list_workouts("Sam")) == 1
