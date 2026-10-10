"""Fill the database with backdated demo history so the progress chart isn't empty.

    python seed.py                 6 weeks for "Alex", 3 workouts a week
    python seed.py --weeks 8
    python seed.py --wipe          delete that patient's workouts first

The first workout measures the healthy knee; later ones borrow it as their baseline,
just like a real patient who only re-tests the good knee once in a while.
Numbers are made up for the demo and are not clinical.
"""

import argparse
import random
from datetime import datetime, time, timedelta

import db

HEALTHY = {"rom": 130.0, "time": 3.0, "flux": 10.0}
START = {"angle": 0.53, "slower": 0.45, "shakier": 3.5}   # week 0: 53% range, 45% slower, 3.5x shakier
END = {"angle": 0.93, "slower": 0.08, "shakier": 1.3}


def lerp(a: float, b: float, f: float) -> float:
    return a + (b - a) * f


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--patient", default="Alex")
    ap.add_argument("--injury", default="ACL reconstruction, left knee")
    ap.add_argument("--weeks", type=int, default=6)
    ap.add_argument("--reps", type=int, default=8, help="injured-knee reps per workout")
    ap.add_argument("--wipe", action="store_true")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    print(f"Database: {db.init_db()}")
    rnd = random.Random(args.seed)
    if args.wipe:
        print(f"Deleted {db.delete_patient_workouts(args.patient)} workouts for {args.patient}")

    # Mon / Wed / Fri at 18:00 local time, ending before today.
    today = datetime.now().date()
    days = [today - timedelta(days=d) for d in range(args.weeks * 7, 0, -1)]
    dates = [datetime.combine(d, time(18, 0)) for d in days if d.weekday() in (0, 2, 4)]

    for n, when in enumerate(dates):
        f = n / max(1, len(dates) - 1)
        f = min(1.0, max(0.0, f + rnd.uniform(-0.06, 0.06)))  # real recovery isn't a straight line
        measurements = []
        t = when
        if n == 0:
            for _ in range(5):
                measurements.append({
                    "knee": "healthy", "measured_at": t,
                    "rom_deg": round(HEALTHY["rom"] * rnd.uniform(0.97, 1.03), 1),
                    "duration_s": round(HEALTHY["time"] * rnd.uniform(0.95, 1.05), 2),
                    "flux": round(HEALTHY["flux"] * rnd.uniform(0.9, 1.1), 2),
                })
                t += timedelta(seconds=rnd.uniform(5, 8))
            t += timedelta(minutes=1)
        for _ in range(args.reps):
            measurements.append({
                "knee": "injured", "measured_at": t,
                "rom_deg": round(HEALTHY["rom"] * lerp(START["angle"], END["angle"], f) * rnd.uniform(0.96, 1.04), 1),
                "duration_s": round(HEALTHY["time"] * (1 + lerp(START["slower"], END["slower"], f)) * rnd.uniform(0.95, 1.05), 2),
                "flux": round(HEALTHY["flux"] * lerp(START["shakier"], END["shakier"], f) * rnd.uniform(0.85, 1.15), 2),
            })
            t += timedelta(seconds=rnd.uniform(5, 9))
        for m in measurements:
            m["measured_at"] = m["measured_at"].isoformat()
        w = db.create_manual_workout(args.patient, when, measurements, args.injury)
        print(f"  {when:%a %Y-%m-%d %H:%M}  workout #{w['id']:<4} range {w['angle_pct']:5.1f}%  score {w['score']:5.1f}  {w['status']}")

    print(f"Added {len(dates)} backdated workouts for {args.patient}.")


if __name__ == "__main__":
    main()
