import math

import pytest

import analysis
from rihab_server import parse_line


def reps(rom, t, flux, n=5):
    return [{"rom_deg": rom, "duration_s": t, "flux": flux} for _ in range(n)]


def test_compare_matches_hand_calculation():
    c = analysis.compare(reps(130, 3.0, 10.0), reps(95, 3.9, 27.0))
    assert c.angle_pct == 73.1                  # 95 / 130
    assert c.speed_pct == 30.0                  # (3.9 - 3.0) / 3.0
    assert c.flux_pct == 170.0                  # (27 - 10) / 10
    # 0.5*73.08 + 0.25*76.92 + 0.25*37.04
    assert c.score == pytest.approx(65.0, abs=0.1)
    assert c.status == "Early recovery"
    assert c.summary == "Reaches 73% of healthy range, 30% slower per rep, 2.7x shakier."


def test_compare_uses_median_of_last_five():
    healthy = reps(50, 1.0, 1.0, n=3) + reps(130, 3.0, 10.0, n=5)  # old junk reps fall out of the window
    injured = reps(120, 3.0, 10.0, n=4) + [{"rom_deg": 10, "duration_s": 3.0, "flux": 10.0}]  # one outlier
    c = analysis.compare(healthy, injured)
    assert c.healthy_rom_deg == 130 and c.injured_rom_deg == 120


def test_compare_symmetric_and_caps_at_100():
    c = analysis.compare(reps(130, 3.0, 10.0), reps(140, 2.5, 5.0))
    assert c.score == 100 and c.status == "Near symmetric"


def test_compare_needs_both_knees_and_handles_missing_flux():
    assert analysis.compare([], reps(90, 3, 10)) is None
    assert analysis.compare(reps(130, 3, 10), []) is None
    c = analysis.compare(reps(130, 3.0, None), reps(117, 3.0, None))
    assert c.flux_pct is None
    assert c.score == pytest.approx((0.5 * 90 + 0.25 * 100) / 0.75, abs=0.1)


def test_flux_definition():
    assert analysis.flux_milli_g([1.0] * 10) == 0
    assert analysis.flux_milli_g([1.0] * 3) is None
    shaky = analysis.flux_milli_g([1.0, 1.05] * 10)
    smooth = analysis.flux_milli_g([1.0, 1.01] * 10)
    assert shaky > 4 * smooth


def wave(rom, rep_s, n_reps, rest_s=1.0, hz=30, jitter=0.0):
    """Synthetic bend-and-straighten samples: (t, angle, accel)."""
    out, t = [], 0.0
    for _ in range(n_reps):
        for i in range(int(rest_s * hz)):
            out.append((t, 1.0, (0.0, 0.0, 1.0)))
            t += 1 / hz
        for i in range(int(rep_s * hz)):
            a = 1.0 + rom * (1 - math.cos(2 * math.pi * i / (rep_s * hz))) / 2
            out.append((t, a, (math.sin(math.radians(a)) + jitter * (-1) ** i, 0.0, math.cos(math.radians(a)))))
            t += 1 / hz
    for i in range(int(rest_s * hz)):
        out.append((t, 1.0, (0.0, 0.0, 1.0)))
        t += 1 / hz
    return out


def test_rep_detector_counts_and_measures():
    det = analysis.RepDetector()
    found = [r for s in wave(120, 3.0, 4) if (r := det.feed(*s))]
    assert len(found) == 4
    for r in found:
        assert r.rom_deg == pytest.approx(120, abs=1)
        assert 2.4 < r.duration_s < 3.2
        assert r.flux is not None


def test_rep_detector_shakier_rep_has_more_flux():
    det_c, det_s = analysis.RepDetector(), analysis.RepDetector()
    calm = [r for s in wave(100, 3.0, 2) if (r := det_c.feed(*s))]
    shaky = [r for s in wave(100, 3.0, 2, jitter=0.04) if (r := det_s.feed(*s))]
    assert shaky[0].flux > 3 * calm[0].flux


def test_rep_detector_ignores_small_wiggles():
    det = analysis.RepDetector()
    assert not [r for s in wave(16, 0.5, 3) if (r := det.feed(*s))]


def test_parse_lines():
    assert parse_line("S,1200,45.5,0.1,0.0,0.98\r\n") == {
        "kind": "sample", "ms": 1200, "angle": 45.5, "accel": (0.1, 0.0, 0.98)}
    assert parse_line("S,1200,45.5")["accel"] is None
    assert parse_line("R,I,92.5,3100,40.2") == {
        "kind": "rep", "knee": "injured", "rom_deg": 92.5, "duration_s": 3.1, "flux": 40.2}
    assert parse_line("R,H,130,3000,")["flux"] is None
    assert parse_line("B,1") == {"kind": "button", "on": True}
    assert parse_line("I,hello, world") == {"kind": "info", "text": "hello, world"}
    assert parse_line("   ") is None
    for bad in ("S,abc,1,2,3,4", "S,1,2,3", "R,X,1,2,3", "B,2", "Q,1", "garbage"):
        with pytest.raises(ValueError):
            parse_line(bad)
