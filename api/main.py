import datetime
import csv
import io
import json
import logging
import time
import uuid
from collections import defaultdict
from typing import Any, Dict, List

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
import schemas
from database import Base, engine, get_db

Base.metadata.create_all(bind=engine)


def _sqlite_add_missing_columns():
    """Best-effort schema patching for SQLite deployments without Alembic migrations."""
    if engine.url.get_backend_name() != "sqlite":
        return

    table_column_sql = {
        "workout_plans": {
            "scheme_type": "ALTER TABLE workout_plans ADD COLUMN scheme_type VARCHAR(20) DEFAULT 'straight'",
            "archived": "ALTER TABLE workout_plans ADD COLUMN archived INTEGER DEFAULT 0",
        },
        "plan_exercises": {
            "scheme_type": "ALTER TABLE plan_exercises ADD COLUMN scheme_type VARCHAR(20) DEFAULT 'straight'",
            "superset_group": "ALTER TABLE plan_exercises ADD COLUMN superset_group VARCHAR(50) DEFAULT ''",
            "superset_order": "ALTER TABLE plan_exercises ADD COLUMN superset_order INTEGER DEFAULT 0",
        },
        "workout_sessions": {
            "notes": "ALTER TABLE workout_sessions ADD COLUMN notes VARCHAR(1000) DEFAULT ''",
            "exclude_from_analytics": "ALTER TABLE workout_sessions ADD COLUMN exclude_from_analytics INTEGER DEFAULT 0",
        },
        "session_sets": {
            "rpe": "ALTER TABLE session_sets ADD COLUMN rpe FLOAT",
            "rir": "ALTER TABLE session_sets ADD COLUMN rir FLOAT",
            "is_warmup": "ALTER TABLE session_sets ADD COLUMN is_warmup INTEGER DEFAULT 0",
        },
    }

    with engine.begin() as conn:
        for table_name, columns in table_column_sql.items():
            table_exists = conn.execute(
                text("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = :name"),
                {"name": table_name},
            ).first()
            if not table_exists:
                continue

            existing_cols = {
                row[1] for row in conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            }
            for col_name, alter_sql in columns.items():
                if col_name not in existing_cols:
                    conn.exec_driver_sql(alter_sql)


_sqlite_add_missing_columns()

app = FastAPI(title="Fitter API", redoc_url=None)
logger = logging.getLogger("fitter.api")
if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log every request with status code and latency."""
    started = time.perf_counter()
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["x-request-id"] = request_id
        return response
    except Exception:
        logger.exception(
            "request_failed request_id=%s method=%s path=%s client=%s",
            request_id,
            request.method,
            request.url.path,
            request.client.host if request.client else "unknown",
        )
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "request request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
            request_id,
            request.method,
            request.url.path,
            status_code,
            duration_ms,
        )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "unhandled_exception method=%s path=%s",
        request.method,
        request.url.path,
    )
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


@app.get("/api/health", summary="Health check", description="Liveness probe for API process.")
def health_check():
    return {"status": "ok", "service": "fitter-api"}


@app.get("/redoc", include_in_schema=False)
def redoc_html():
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.3/bundles/redoc.standalone.js",
    )


@app.get("/api/health/ready", summary="Readiness check", description="Readiness probe with database ping.")
def readiness_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception as exc:
        logger.exception("readiness_check_failed")
        raise HTTPException(status_code=503, detail=f"Database not ready: {exc}")


def _is_analytics_session(session: models.WorkoutSession) -> bool:
    return not bool(getattr(session, "exclude_from_analytics", False))


# ─────────────────────────── Exercises ────────────────────────────

@app.get("/api/exercises", response_model=List[schemas.Exercise], summary="List exercises")
def list_exercises(db: Session = Depends(get_db)):
    return db.query(models.Exercise).order_by(models.Exercise.name).all()


@app.post("/api/exercises", response_model=schemas.Exercise, status_code=201, summary="Create exercise")
def create_exercise(body: schemas.ExerciseCreate, db: Session = Depends(get_db)):
    ex = models.Exercise(**body.model_dump())
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex


@app.put("/api/exercises/{exercise_id}", response_model=schemas.Exercise, summary="Update exercise")
def update_exercise(exercise_id: int, body: schemas.ExerciseCreate, db: Session = Depends(get_db)):
    ex = db.get(models.Exercise, exercise_id)
    if not ex:
        raise HTTPException(404, "Exercise not found")
    for k, v in body.model_dump().items():
        setattr(ex, k, v)
    db.commit()
    db.refresh(ex)
    return ex


@app.delete("/api/exercises/{exercise_id}", status_code=204, summary="Delete exercise")
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    ex = db.get(models.Exercise, exercise_id)
    if not ex:
        raise HTTPException(404, "Exercise not found")
    db.delete(ex)
    db.commit()


# ─────────────────────────── Workout Plans ────────────────────────

def _sanitize_plan_for_response(plan: models.WorkoutPlan) -> models.WorkoutPlan:
    """Drop orphan plan_exercise rows (missing exercise) to keep API responses valid."""
    if plan and getattr(plan, "plan_exercises", None):
        plan.plan_exercises = [pe for pe in plan.plan_exercises if pe.exercise is not None]
    return plan

@app.get("/api/plans", response_model=List[schemas.WorkoutPlan], summary="List workout plans", description="Returns active plans by default. Use include_archived=true to include archived plans.")
def list_plans(include_archived: bool = False, db: Session = Depends(get_db)):
    plans_query = db.query(models.WorkoutPlan)
    if not include_archived:
        plans_query = plans_query.filter(models.WorkoutPlan.archived == False)
    plans = plans_query.all()
    return [_sanitize_plan_for_response(p) for p in plans]


@app.get("/api/plans/{plan_id}", response_model=schemas.WorkoutPlan, summary="Get workout plan")
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(models.WorkoutPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    return _sanitize_plan_for_response(plan)


@app.post("/api/plans", response_model=schemas.WorkoutPlan, status_code=201, summary="Create workout plan")
def create_plan(body: schemas.WorkoutPlanCreate, db: Session = Depends(get_db)):
    plan = models.WorkoutPlan(**body.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _sanitize_plan_for_response(plan)


@app.put("/api/plans/{plan_id}", response_model=schemas.WorkoutPlan, summary="Update workout plan")
def update_plan(plan_id: int, body: schemas.WorkoutPlanCreate, db: Session = Depends(get_db)):
    plan = db.get(models.WorkoutPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    for k, v in body.model_dump().items():
        setattr(plan, k, v)
    db.commit()
    db.refresh(plan)
    return _sanitize_plan_for_response(plan)


@app.delete("/api/plans/{plan_id}", status_code=204, summary="Delete workout plan")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(models.WorkoutPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    db.delete(plan)
    db.commit()


@app.put("/api/plans/{plan_id}/archive", response_model=schemas.WorkoutPlan, summary="Archive workout plan")
def archive_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(models.WorkoutPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    plan.archived = True
    db.commit()
    db.refresh(plan)
    return _sanitize_plan_for_response(plan)


@app.put("/api/plans/{plan_id}/unarchive", response_model=schemas.WorkoutPlan, summary="Unarchive workout plan")
def unarchive_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(models.WorkoutPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    plan.archived = False
    db.commit()
    db.refresh(plan)
    return _sanitize_plan_for_response(plan)


# ─────────────────────────── Plan Exercises ───────────────────────

@app.post("/api/plans/{plan_id}/exercises", response_model=schemas.PlanExercise, status_code=201, summary="Add exercise to plan")
def add_plan_exercise(plan_id: int, body: schemas.PlanExerciseCreate, db: Session = Depends(get_db)):
    if not db.get(models.WorkoutPlan, plan_id):
        raise HTTPException(404, "Plan not found")
    pe = models.PlanExercise(plan_id=plan_id, **body.model_dump())
    db.add(pe)
    db.commit()
    db.refresh(pe)
    return pe


@app.put("/api/plan-exercises/{pe_id}", response_model=schemas.PlanExercise, summary="Update plan exercise")
def update_plan_exercise(pe_id: int, body: schemas.PlanExerciseCreate, db: Session = Depends(get_db)):
    pe = db.get(models.PlanExercise, pe_id)
    if not pe:
        raise HTTPException(404, "Plan exercise not found")
    for k, v in body.model_dump().items():
        setattr(pe, k, v)
    db.commit()
    db.refresh(pe)
    return pe


@app.delete("/api/plan-exercises/{pe_id}", status_code=204, summary="Remove exercise from plan")
def delete_plan_exercise(pe_id: int, db: Session = Depends(get_db)):
    pe = db.get(models.PlanExercise, pe_id)
    if not pe:
        raise HTTPException(404, "Plan exercise not found")
    db.delete(pe)
    db.commit()


# ─────────────────────────── Programs ───────────────────────────

@app.get("/api/programs", response_model=List[schemas.TrainingProgram], summary="List training programs")
def list_programs(db: Session = Depends(get_db)):
    return db.query(models.TrainingProgram).order_by(models.TrainingProgram.created_at.desc()).all()


@app.get("/api/programs/{program_id}", response_model=schemas.TrainingProgram, summary="Get training program")
def get_program(program_id: int, db: Session = Depends(get_db)):
    program = db.get(models.TrainingProgram, program_id)
    if not program:
        raise HTTPException(404, "Program not found")
    return program


@app.post("/api/programs", response_model=schemas.TrainingProgram, status_code=201, summary="Create training program")
def create_program(body: schemas.TrainingProgramCreate, db: Session = Depends(get_db)):
    program = models.TrainingProgram(**body.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


@app.put("/api/programs/{program_id}", response_model=schemas.TrainingProgram, summary="Update training program")
def update_program(program_id: int, body: schemas.TrainingProgramCreate, db: Session = Depends(get_db)):
    program = db.get(models.TrainingProgram, program_id)
    if not program:
        raise HTTPException(404, "Program not found")
    for k, v in body.model_dump().items():
        setattr(program, k, v)
    db.commit()
    db.refresh(program)
    return program


@app.delete("/api/programs/{program_id}", status_code=204, summary="Delete training program")
def delete_program(program_id: int, db: Session = Depends(get_db)):
    program = db.get(models.TrainingProgram, program_id)
    if not program:
        raise HTTPException(404, "Program not found")
    db.delete(program)
    db.commit()


@app.get("/api/programs/{program_id}/progress", response_model=schemas.ProgramProgress, summary="Get program progress")
def get_program_progress(program_id: int, db: Session = Depends(get_db)):
    program = db.get(models.TrainingProgram, program_id)
    if not program:
        raise HTTPException(404, "Program not found")

    # Get all sessions for this program, ordered chronologically
    sessions = (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.program_id == program_id)
        .order_by(models.WorkoutSession.started_at)
        .all()
    )

    progress_entries: list = []
    for session in sessions:
        for s in session.logged_sets:
            # Skip warmup sets from progression calculations
            if s.is_warmup:
                continue
            progress_entries.append(
                schemas.SetProgressEntry(
                    session_id=session.id,
                    session_date=session.started_at,
                    exercise_name=s.plan_exercise.exercise.name if s.plan_exercise and s.plan_exercise.exercise else "",
                    set_number=s.set_number,
                    reps_done=s.reps_done,
                    weight_used=s.weight_used,
                    rpe=s.rpe,
                    rir=s.rir,
                    exclude_from_analytics=bool(session.exclude_from_analytics),
                )
            )

    return schemas.ProgramProgress(
        program_id=program.id,
        program_name=program.name,
        goal=program.goal,
        exercise_name=program.exercise,
        status=program.status,
        total_sessions=len(sessions),
        progress_entries=progress_entries,
    )


# ─────────────────────────── Sessions ─────────────────────────────

@app.post("/api/sessions", response_model=schemas.WorkoutSession, status_code=201, summary="Start workout session")
def start_session(body: schemas.WorkoutSessionCreate, db: Session = Depends(get_db)):
    if not db.get(models.WorkoutPlan, body.plan_id):
        raise HTTPException(404, "Plan not found")
    if body.program_id and not db.get(models.TrainingProgram, body.program_id):
        raise HTTPException(404, "Program not found")
    session = models.WorkoutSession(plan_id=body.plan_id, program_id=body.program_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.post("/api/sessions/{session_id}/finish", response_model=schemas.WorkoutSession, summary="Finish workout session")
def finish_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.WorkoutSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.finished_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@app.put("/api/sessions/{session_id}", response_model=schemas.WorkoutSession, summary="Update workout session", description="Supports notes and exclude_from_analytics updates.")
def update_session(session_id: int, body: dict, db: Session = Depends(get_db)):
    session = db.get(models.WorkoutSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if "notes" in body:
        session.notes = body["notes"]
    if "exclude_from_analytics" in body:
        session.exclude_from_analytics = bool(body["exclude_from_analytics"])
    db.commit()
    db.refresh(session)
    return session


@app.delete("/api/sessions/{session_id}", status_code=204, summary="Delete workout session")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.WorkoutSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    db.delete(session)
    db.commit()


@app.post("/api/sessions/{session_id}/sets", response_model=schemas.SessionSet, status_code=201, summary="Log session set")
def log_set(session_id: int, body: schemas.SessionSetCreate, db: Session = Depends(get_db)):
    if not db.get(models.WorkoutSession, session_id):
        raise HTTPException(404, "Session not found")
    logged = models.SessionSet(session_id=session_id, **body.model_dump())
    db.add(logged)
    db.commit()
    db.refresh(logged)
    return logged


@app.get("/api/sessions/{session_id}/summary", response_model=schemas.SessionSummary, summary="Get session summary")
def get_summary(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.WorkoutSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    plan = db.get(models.WorkoutPlan, session.plan_id)

    duration = None
    if session.finished_at:
        duration = int((session.finished_at - session.started_at).total_seconds())

    grouped: dict = defaultdict(list)
    for s in session.logged_sets:
        grouped[s.plan_exercise_id].append(s)

    exercise_summaries = []
    grand_total = 0.0

    for pe_id, sets in grouped.items():
        pe = db.get(models.PlanExercise, pe_id)
        if not pe or not pe.exercise:  # Skip orphaned relations
            continue
        total_reps = sum(s.reps_done for s in sets)
        total_weight = sum(s.reps_done * s.weight_used for s in sets)
        grand_total += total_weight
        exercise_summaries.append(
            schemas.ExerciseSummary(
                exercise_name=pe.exercise.name,
                muscle_group=pe.exercise.muscle_group,
                total_sets=len(sets),
                total_reps=total_reps,
                total_weight_moved=total_weight,
            )
        )

    return schemas.SessionSummary(
        session_id=session.id,
        plan_name=plan.name,
        started_at=session.started_at,
        finished_at=session.finished_at,
        duration_seconds=duration,
        notes=session.notes,
        exclude_from_analytics=bool(session.exclude_from_analytics),
        exercises=exercise_summaries,
        grand_total_weight=grand_total,
    )


# ─────────────────────────── Stats ───────────────────────────────

@app.get("/api/stats/workout-heatmap", summary="Get workout heatmap and streaks")
def get_workout_heatmap(year: int = None, month: int = None, db: Session = Depends(get_db)):
    now = datetime.datetime.utcnow()
    target_year = year or now.year
    target_month = month or now.month

    if target_month < 1 or target_month > 12:
        raise HTTPException(400, "month must be between 1 and 12")
    if target_year < 2000 or target_year > 3000:
        raise HTTPException(400, "year out of supported range")

    month_start = datetime.datetime(target_year, target_month, 1)
    if target_month == 12:
        month_end = datetime.datetime(target_year + 1, 1, 1)
    else:
        month_end = datetime.datetime(target_year, target_month + 1, 1)

    monthly_sessions = (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.started_at >= month_start)
        .filter(models.WorkoutSession.started_at < month_end)
        .all()
    )
    monthly_sessions = [s for s in monthly_sessions if _is_analytics_session(s)]

    day_counts: Dict[str, int] = {}
    for s in monthly_sessions:
        key = s.started_at.date().isoformat()
        day_counts[key] = day_counts.get(key, 0) + 1

    days_in_month = (month_end - month_start).days
    max_count = max(day_counts.values()) if day_counts else 0

    def level_from_count(count: int) -> int:
        if count <= 0:
            return 0
        if max_count <= 1:
            return 4
        return min(4, 1 + int(((count - 1) * 4) / max(1, max_count - 1)))

    month_days = []
    for day in range(1, days_in_month + 1):
        d = datetime.date(target_year, target_month, day)
        iso = d.isoformat()
        count = day_counts.get(iso, 0)
        month_days.append({
            "date": iso,
            "day": day,
            "count": count,
            "level": level_from_count(count),
        })

    # Weekly consistency for last 12 weeks.
    today = now.date()
    current_week_start = today - datetime.timedelta(days=today.weekday())
    history_start = current_week_start - datetime.timedelta(weeks=11)
    history_start_dt = datetime.datetime.combine(history_start, datetime.time.min)

    weekly_sessions = (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.started_at >= history_start_dt)
        .all()
    )
    weekly_sessions = [s for s in weekly_sessions if _is_analytics_session(s)]

    weekly_counts_map: Dict[str, int] = {}
    for i in range(12):
        ws = current_week_start - datetime.timedelta(weeks=(11 - i))
        weekly_counts_map[ws.isoformat()] = 0

    for s in weekly_sessions:
        d = s.started_at.date()
        week_start = d - datetime.timedelta(days=d.weekday())
        key = week_start.isoformat()
        if key in weekly_counts_map:
            weekly_counts_map[key] += 1

    weekly_counts = []
    for i in range(12):
        ws = current_week_start - datetime.timedelta(weeks=(11 - i))
        key = ws.isoformat()
        weekly_counts.append({
            "week_start": key,
            "label": ws.strftime("%b %d"),
            "count": weekly_counts_map.get(key, 0),
        })

    # Streaks (across all historical session dates).
    all_sessions = db.query(models.WorkoutSession).all()
    analytics_sessions = [s for s in all_sessions if _is_analytics_session(s)]
    all_session_dates = sorted({s.started_at.date() for s in analytics_sessions})
    best_streak = 0
    current_streak = 0
    prev_date = None

    for d in all_session_dates:
        if prev_date is None or (d - prev_date).days == 1:
            current_streak += 1
        elif d == prev_date:
            pass
        else:
            current_streak = 1
        best_streak = max(best_streak, current_streak)
        prev_date = d

    active_streak = 0
    if all_session_dates:
        streak_date = all_session_dates[-1]
        active_streak = 1
        for i in range(len(all_session_dates) - 2, -1, -1):
            if (streak_date - all_session_dates[i]).days == 1:
                active_streak += 1
                streak_date = all_session_dates[i]
            else:
                break

    return {
        "year": target_year,
        "month": target_month,
        "month_days": month_days,
        "month_total_sessions": len(monthly_sessions),
        "weekly_counts": weekly_counts,
        "best_streak": best_streak,
        "active_streak": active_streak,
    }

@app.get("/api/stats/best-sets", summary="Get best sets per exercise")
def get_best_sets(db: Session = Depends(get_db)):
    """Return the best (heaviest non-warmup) set per exercise across all sessions."""
    analytics_session_ids = {
        s.id
        for s in db.query(models.WorkoutSession).all()
        if _is_analytics_session(s)
    }
    if not analytics_session_ids:
        return []

    sets = (
        db.query(models.SessionSet)
        .filter(models.SessionSet.session_id.in_(analytics_session_ids))
        .filter(models.SessionSet.is_warmup == False)
        .all()
    )

    # Group sets by exercise, tracking best (highest weight, then most reps)
    best: dict = {}
    for s in sets:
        pe = db.get(models.PlanExercise, s.plan_exercise_id)
        if not pe or not pe.exercise:
            continue
        ex = pe.exercise
        key = ex.id
        if key not in best or (s.weight_used, s.reps_done) > (best[key]["weight"], best[key]["reps"]):
            best[key] = {
                "exercise_id": ex.id,
                "exercise_name": ex.name,
                "muscle_group": ex.muscle_group,
                "reps": s.reps_done,
                "weight": s.weight_used,
            }

    return list(best.values())


# ─────────────────────────── Export ──────────────────────────────

def _build_export_rows(db: Session):
    """Return all logged sets as a flat list of dicts for export."""
    sets = db.query(models.SessionSet).order_by(models.SessionSet.session_id, models.SessionSet.set_number).all()
    rows = []
    for s in sets:
        session = db.get(models.WorkoutSession, s.session_id)
        pe = db.get(models.PlanExercise, s.plan_exercise_id)
        plan = db.get(models.WorkoutPlan, session.plan_id) if session else None
        program = db.get(models.TrainingProgram, session.program_id) if session and session.program_id else None
        rows.append({
            "session_id": s.session_id,
            "session_date": session.started_at.isoformat() if session else "",
            "session_notes": session.notes if session else "",
            "plan_name": plan.name if plan else "",
            "program_name": program.name if program else "",
            "exercise_name": pe.exercise.name if pe and pe.exercise else "",
            "muscle_group": pe.exercise.muscle_group if pe and pe.exercise else "",
            "set_number": s.set_number,
            "reps_done": s.reps_done,
            "weight_used": s.weight_used,
            "rpe": s.rpe,
            "rir": s.rir,
            "is_warmup": s.is_warmup,
        })
    return rows


@app.get("/api/export/csv", summary="Export all data as CSV")
def export_csv(db: Session = Depends(get_db)):
    rows = _build_export_rows(db)
    fieldnames = ["session_id", "session_date", "session_notes", "plan_name", "program_name",
                  "exercise_name", "muscle_group", "set_number", "reps_done", "weight_used", "rpe", "rir", "is_warmup"]

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)

    filename = f"fitter-export-{datetime.date.today()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/export/json", summary="Export all data as JSON")
def export_json(db: Session = Depends(get_db)):
    rows = _build_export_rows(db)
    payload = json.dumps(
        {
            "format_version": 1,
            "created_at": datetime.datetime.utcnow().isoformat(),
            "rows": rows,
        },
        indent=2,
    )
    filename = f"fitter-export-{datetime.date.today()}.json"
    return StreamingResponse(
        iter([payload]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return False


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_session_date(value: Any) -> datetime.datetime:
    if isinstance(value, str) and value.strip():
        try:
            return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.datetime.utcnow()


def _looks_like_set_row(item: Dict[str, Any]) -> bool:
    row_keys = {
        "session_id",
        "session_date",
        "plan_name",
        "program_name",
        "exercise_name",
        "set_number",
        "reps_done",
        "weight_used",
        "rpe",
        "rir",
        "is_warmup",
    }
    return any(k in item for k in row_keys)


def _extract_import_rows(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        rows = [r for r in payload if isinstance(r, dict) and _looks_like_set_row(r)]
    elif isinstance(payload, dict):
        rows = payload.get("rows", [])
    else:
        rows = []

    if not isinstance(rows, list):
        raise HTTPException(400, "Invalid payload. Expected a JSON array or { rows: [...] }.")

    normalized: List[Dict[str, Any]] = []
    for r in rows:
        if isinstance(r, dict) and _looks_like_set_row(r):
            normalized.append(r)
    return normalized


def _extract_import_exercises(payload: Any) -> List[Dict[str, str]]:
    if isinstance(payload, list):
        exercises = payload
    elif isinstance(payload, dict):
        exercises = payload.get("exercises", [])
    else:
        exercises = []

    if not isinstance(exercises, list):
        raise HTTPException(400, "Invalid payload. Expected exercises to be a list.")

    normalized: List[Dict[str, str]] = []
    for ex in exercises:
        if not isinstance(ex, dict):
            continue
        if _looks_like_set_row(ex):
            continue

        name = (ex.get("name") or ex.get("exercise_name") or "").strip()
        if not name:
            continue

        normalized.append(
            {
                "name": name,
                "muscle_group": (ex.get("muscle_group") or "").strip(),
                "description": (ex.get("description") or "").strip(),
            }
        )

    return normalized


@app.post("/api/import/json", summary="Import JSON data", description="Accepts rows-based exports and exercises-only payloads. Supports dry-run and clear-existing options.")
def import_json(payload: dict, db: Session = Depends(get_db)):
    rows = _extract_import_rows(payload)
    exercises = _extract_import_exercises(payload)
    if not rows and not exercises:
        raise HTTPException(400, "No rows or exercises found in import payload")

    dry_run = _to_bool(payload.get("dry_run", False))
    clear_existing = _to_bool(payload.get("clear_existing", False))

    # Caches to avoid duplicate lookups/creates during import.
    exercise_cache: Dict[str, models.Exercise] = {
        (e.name or "").strip().lower(): e for e in db.query(models.Exercise).all()
    }
    plan_cache: Dict[str, models.WorkoutPlan] = {
        (p.name or "").strip().lower(): p for p in db.query(models.WorkoutPlan).all()
    }
    program_cache: Dict[str, models.TrainingProgram] = {
        (p.name or "").strip().lower(): p for p in db.query(models.TrainingProgram).all()
    }
    plan_exercise_cache: Dict[tuple, models.PlanExercise] = {}
    session_cache: Dict[str, models.WorkoutSession] = {}

    created = {
        "exercises": 0,
        "plans": 0,
        "programs": 0,
        "sessions": 0,
        "sets": 0,
        "plan_exercises": 0,
    }

    try:
        if clear_existing:
            db.query(models.SessionSet).delete()
            db.query(models.WorkoutSession).delete()
            db.query(models.PlanExercise).delete()
            db.query(models.TrainingProgram).delete()
            db.query(models.WorkoutPlan).delete()
            db.query(models.Exercise).delete()
            db.flush()
            exercise_cache.clear()
            plan_cache.clear()
            program_cache.clear()

        for ex in exercises:
            ex_key = ex["name"].lower()
            if ex_key in exercise_cache:
                continue

            exercise = models.Exercise(
                name=ex["name"],
                muscle_group=ex["muscle_group"],
                description=ex["description"],
            )
            db.add(exercise)
            db.flush()
            exercise_cache[ex_key] = exercise
            created["exercises"] += 1

        for idx, row in enumerate(rows):
            exercise_name = (row.get("exercise_name") or "Unknown Exercise").strip()
            muscle_group = (row.get("muscle_group") or "").strip()

            ex_key = exercise_name.lower()
            exercise = exercise_cache.get(ex_key)
            if not exercise:
                exercise = models.Exercise(
                    name=exercise_name,
                    muscle_group=muscle_group,
                    description="",
                )
                db.add(exercise)
                db.flush()
                exercise_cache[ex_key] = exercise
                created["exercises"] += 1

            plan_name = (row.get("plan_name") or "Imported Plan").strip()
            plan_key = plan_name.lower()
            plan = plan_cache.get(plan_key)
            if not plan:
                plan = models.WorkoutPlan(
                    name=plan_name,
                    description="Imported from JSON",
                    rest_time=60,
                )
                db.add(plan)
                db.flush()
                plan_cache[plan_key] = plan
                created["plans"] += 1

            program_name = (row.get("program_name") or "").strip()
            program = None
            if program_name:
                program_key = program_name.lower()
                program = program_cache.get(program_key)
                if not program:
                    program = models.TrainingProgram(
                        name=program_name,
                        description="Imported from JSON",
                        goal="",
                        exercise=exercise.name,
                        status="active",
                    )
                    db.add(program)
                    db.flush()
                    program_cache[program_key] = program
                    created["programs"] += 1

            pe_key = (plan.id, exercise.id)
            plan_exercise = plan_exercise_cache.get(pe_key)
            if not plan_exercise:
                plan_exercise = (
                    db.query(models.PlanExercise)
                    .filter(
                        models.PlanExercise.plan_id == plan.id,
                        models.PlanExercise.exercise_id == exercise.id,
                    )
                    .first()
                )
                if not plan_exercise:
                    plan_exercise = models.PlanExercise(
                        plan_id=plan.id,
                        exercise_id=exercise.id,
                        sets=3,
                        reps=10,
                        weight=_to_float(row.get("weight_used"), 0.0),
                        order=0,
                    )
                    db.add(plan_exercise)
                    db.flush()
                    created["plan_exercises"] += 1
                plan_exercise_cache[pe_key] = plan_exercise

            source_session_id = row.get("session_id")
            source_session_key = str(source_session_id) if source_session_id is not None else f"generated-{idx}"
            session = session_cache.get(source_session_key)
            if not session:
                started_at = _parse_session_date(row.get("session_date"))
                session = models.WorkoutSession(
                    plan_id=plan.id,
                    program_id=program.id if program else None,
                    started_at=started_at,
                    finished_at=started_at,
                    notes=(row.get("session_notes") or "").strip(),
                )
                db.add(session)
                db.flush()
                session_cache[source_session_key] = session
                created["sessions"] += 1

            logged_set = models.SessionSet(
                session_id=session.id,
                plan_exercise_id=plan_exercise.id,
                set_number=max(1, _to_int(row.get("set_number"), 1)),
                reps_done=max(0, _to_int(row.get("reps_done"), 0)),
                weight_used=max(0.0, _to_float(row.get("weight_used"), 0.0)),
                rpe=_to_float(row.get("rpe"), None) if row.get("rpe") is not None else None,
                rir=_to_float(row.get("rir"), None) if row.get("rir") is not None else None,
                is_warmup=_to_bool(row.get("is_warmup", False)),
            )
            db.add(logged_set)
            created["sets"] += 1

        if dry_run:
            db.rollback()
            return {
                "ok": True,
                "dry_run": True,
                "clear_existing": clear_existing,
                "rows_received": len(rows),
                "exercises_received": len(exercises),
                "would_create": created,
            }

        db.commit()
        return {
            "ok": True,
            "dry_run": False,
            "clear_existing": clear_existing,
            "rows_received": len(rows),
            "exercises_received": len(exercises),
            "created": created,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(400, f"Import failed: {exc}") from exc
