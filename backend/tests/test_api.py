from fastapi.testclient import TestClient

import rihab_server
from rihab_server import SimSource, create_app


def collect(ws, kind, count, limit=20000):
    """Read WebSocket messages until `count` of type `kind` have arrived."""
    got, other = [], []
    for _ in range(limit):
        msg = ws.receive_json()
        if msg["type"] == kind:
            got.append(msg)
            if len(got) == count:
                return got, other
        else:
            other.append(msg)
    raise AssertionError(f"only {len(got)} {kind} messages")


def test_simulated_workout_end_to_end(fresh_db):
    app = create_app(SimSource(speed=25, seed=1), database_url=fresh_db)
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        snap = ws.receive_json()
        assert snap["type"] == "snapshot" and snap["state"]["source"] == "sim"

        ws.send_json({"type": "start_workout", "patient": "Alex", "injury": "ACL"})
        ws.send_json({"type": "start"})
        healthy, _ = collect(ws, "rep", 3)
        assert all(r["knee"] == "healthy" and 115 < r["rom_deg"] < 145 for r in healthy)

        ws.send_json({"type": "set_knee", "knee": "injured"})
        injured, _ = collect(ws, "rep", 4)
        injured = [r for r in injured if r["knee"] == "injured"]  # a healthy rep may finish just after the switch
        assert injured and all(80 < r["rom_deg"] < 110 for r in injured)

        comparisons, _ = collect(ws, "comparison", 1)
        c = comparisons[0]
        assert 60 < c["angle_pct"] < 85
        assert c["speed_pct"] > 10 and c["flux_pct"] > 50
        ws.send_json({"type": "end_workout"})

        workout_id = c["workout_id"]
        w = client.get(f"/api/workouts/{workout_id}").json()
        assert w["healthy_reps"] >= 3 and w["injured_reps"] >= 1 and w["score"] is not None
        assert w["measurements"][0]["source"] == "python"
        assert [p["id"] for p in client.get("/api/progress", params={"patient": "Alex"}).json()] == [workout_id]


def test_rest_backdating_and_errors(fresh_db):
    app = create_app(SimSource(seed=2), database_url=fresh_db)
    with TestClient(app) as client:
        body = {"patient": "Alex", "performed_at": "2026-09-30 18:00", "measurements": [
            {"knee": "healthy", "rom_deg": 130, "duration_s": 3.0, "flux": 10},
            {"knee": "injured", "rom_deg": 88, "duration_s": 3.1, "flux": 40},
            {"knee": "injured", "rom_deg": 91, "duration_s": 3.0, "flux": 42, "measured_at": "2026-09-30 18:02"},
        ]}
        r = client.post("/api/workouts", json=body)
        assert r.status_code == 201, r.text
        w = r.json()
        assert w["is_backdated"] and w["angle_pct"] == 68.8

        moved = client.patch(f"/api/workouts/{w['id']}", json={"performed_at": "2026-10-01 09:00"}).json()
        assert moved["performed_at"] != w["performed_at"]

        assert client.post("/api/workouts", json={**body, "performed_at": "whenever"}).status_code == 400
        assert client.post("/api/workouts", json={**body, "measurements": [{"knee": "left", "rom_deg": 1, "duration_s": 1}]}).status_code == 422
        assert client.get("/api/workouts/999").status_code == 404
        assert client.delete(f"/api/workouts/{w['id']}").status_code == 204
        assert client.get("/api/workouts").json() == []

        assert client.post("/api/vision", json={"angle": 92.5}).json() == {"ok": True}
        assert client.get("/api/state").json()["vision_angle"] == 92.5
        assert client.post("/api/command", json={"type": "nope"}).status_code == 400
        assert client.post("/api/command", json={"type": "set_knee", "knee": "injured"}).json()["knee"] == "injured"


def test_device_rep_lines_and_bad_lines(fresh_db):
    """Lines from a real Arduino: R lines switch rep detection to the device, junk is skipped."""
    source = SimSource(speed=0.001, seed=3)  # effectively silent; we inject lines by hand
    app = create_app(source, database_url=fresh_db)
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        ws.receive_json()
        session = app.state.session
        for line in ["B,1", "garbage!!", "R,H,131,2950,9.5", "R,I,90,3900,26"]:
            source._emit("line", line)
        collect(ws, "comparison", 1)
        state = client.get("/api/state").json()
        assert state["tracking"] and state["rep_mode"] == "device"
        assert session._bad_lines == 1
        w = client.get(f"/api/workouts/{state['workout_id']}").json()
        assert [m["source"] for m in w["measurements"]] == ["device", "device"]
