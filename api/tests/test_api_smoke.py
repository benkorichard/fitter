import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "smoke.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")

    # Reload modules so database engine picks up the test DATABASE_URL.
    import database
    import main

    importlib.reload(database)
    importlib.reload(main)

    # Guarantee schema exists for the test database after reload.
    main.Base.metadata.create_all(bind=main.engine)
    main.models.Base.metadata.create_all(bind=main.engine)

    with TestClient(main.app) as test_client:
        yield test_client


def test_core_workflow_smoke(client: TestClient):
    # 1) Create exercise.
    ex_resp = client.post(
        "/api/exercises",
        json={
            "name": "Bench Press",
            "muscle_group": "Chest",
            "description": "Flat barbell bench",
        },
    )
    assert ex_resp.status_code == 201
    exercise = ex_resp.json()

    # 2) Create plan.
    plan_resp = client.post(
        "/api/plans",
        json={"name": "Push Day", "description": "Main push session", "rest_time": 90},
    )
    assert plan_resp.status_code == 201
    plan = plan_resp.json()

    # 3) Add plan exercise.
    pe_resp = client.post(
        f"/api/plans/{plan['id']}/exercises",
        json={
            "exercise_id": exercise["id"],
            "sets": 3,
            "reps": 8,
            "weight": 60.0,
            "order": 1,
        },
    )
    assert pe_resp.status_code == 201
    plan_exercise = pe_resp.json()

    # 4) Create program.
    prog_resp = client.post(
        "/api/programs",
        json={
            "name": "Bench Cycle 1",
            "description": "5x8 progression",
            "goal": "5x8 @ 80kg",
            "exercise": "Bench Press",
        },
    )
    assert prog_resp.status_code == 201
    program = prog_resp.json()

    # 5) Start session linked to plan + program.
    session_resp = client.post(
        "/api/sessions",
        json={"plan_id": plan["id"], "program_id": program["id"]},
    )
    assert session_resp.status_code == 201
    session = session_resp.json()

    # 6) Update notes on session.
    notes_resp = client.put(
        f"/api/sessions/{session['id']}",
        json={"notes": "Felt strong today."},
    )
    assert notes_resp.status_code == 200
    assert notes_resp.json()["notes"] == "Felt strong today."

    # 7) Log warmup set.
    warmup_resp = client.post(
        f"/api/sessions/{session['id']}/sets",
        json={
            "plan_exercise_id": plan_exercise["id"],
            "set_number": 1,
            "reps_done": 10,
            "weight_used": 40.0,
            "is_warmup": True,
        },
    )
    assert warmup_resp.status_code == 201

    # 8) Log working set.
    work_resp = client.post(
        f"/api/sessions/{session['id']}/sets",
        json={
            "plan_exercise_id": plan_exercise["id"],
            "set_number": 2,
            "reps_done": 8,
            "weight_used": 62.5,
            "is_warmup": False,
        },
    )
    assert work_resp.status_code == 201

    # 9) Finish session.
    finish_resp = client.post(f"/api/sessions/{session['id']}/finish")
    assert finish_resp.status_code == 200
    assert finish_resp.json()["finished_at"] is not None

    # 10) Validate summary.
    summary_resp = client.get(f"/api/sessions/{session['id']}/summary")
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["session_id"] == session["id"]
    assert summary["notes"] == "Felt strong today."
    assert summary["exercises"]
    assert summary["grand_total_weight"] > 0

    # 11) Validate program progress excludes warmup sets.
    progress_resp = client.get(f"/api/programs/{program['id']}/progress")
    assert progress_resp.status_code == 200
    progress = progress_resp.json()
    assert progress["program_id"] == program["id"]
    assert progress["total_sessions"] == 1
    assert len(progress["progress_entries"]) == 1
    assert progress["progress_entries"][0]["reps_done"] == 8
    assert progress["progress_entries"][0]["weight_used"] == 62.5


def test_start_session_with_missing_plan_returns_404(client: TestClient):
    resp = client.post("/api/sessions", json={"plan_id": 9999, "program_id": None})
    assert resp.status_code == 404
    assert "Plan not found" in resp.text
