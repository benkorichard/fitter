import datetime
from collections import defaultdict
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas
from database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fitter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────── Exercises ────────────────────────────

@app.get("/api/exercises", response_model=List[schemas.Exercise])
def list_exercises(db: Session = Depends(get_db)):
    return db.query(models.Exercise).order_by(models.Exercise.name).all()


@app.post("/api/exercises", response_model=schemas.Exercise, status_code=201)
def create_exercise(body: schemas.ExerciseCreate, db: Session = Depends(get_db)):
    ex = models.Exercise(**body.model_dump())
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex


@app.put("/api/exercises/{exercise_id}", response_model=schemas.Exercise)
def update_exercise(exercise_id: int, body: schemas.ExerciseCreate, db: Session = Depends(get_db)):
    ex = db.get(models.Exercise, exercise_id)
    if not ex:
        raise HTTPException(404, "Exercise not found")
    for k, v in body.model_dump().items():
        setattr(ex, k, v)
    db.commit()
    db.refresh(ex)
    return ex


@app.delete("/api/exercises/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    ex = db.get(models.Exercise, exercise_id)
    if not ex:
        raise HTTPException(404, "Exercise not found")
    db.delete(ex)
    db.commit()


# ─────────────────────────── Workout Plans ────────────────────────

@app.get("/api/plans", response_model=List[schemas.WorkoutPlan])
def list_plans(db: Session = Depends(get_db)):
    return db.query(models.WorkoutPlan).all()


@app.get("/api/plans/{plan_id}", response_model=schemas.WorkoutPlan)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(models.WorkoutPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    return plan


@app.post("/api/plans", response_model=schemas.WorkoutPlan, status_code=201)
def create_plan(body: schemas.WorkoutPlanCreate, db: Session = Depends(get_db)):
    plan = models.WorkoutPlan(**body.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@app.put("/api/plans/{plan_id}", response_model=schemas.WorkoutPlan)
def update_plan(plan_id: int, body: schemas.WorkoutPlanCreate, db: Session = Depends(get_db)):
    plan = db.get(models.WorkoutPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    for k, v in body.model_dump().items():
        setattr(plan, k, v)
    db.commit()
    db.refresh(plan)
    return plan


@app.delete("/api/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(models.WorkoutPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    db.delete(plan)
    db.commit()


# ─────────────────────────── Plan Exercises ───────────────────────

@app.post("/api/plans/{plan_id}/exercises", response_model=schemas.PlanExercise, status_code=201)
def add_plan_exercise(plan_id: int, body: schemas.PlanExerciseCreate, db: Session = Depends(get_db)):
    if not db.get(models.WorkoutPlan, plan_id):
        raise HTTPException(404, "Plan not found")
    pe = models.PlanExercise(plan_id=plan_id, **body.model_dump())
    db.add(pe)
    db.commit()
    db.refresh(pe)
    return pe


@app.put("/api/plan-exercises/{pe_id}", response_model=schemas.PlanExercise)
def update_plan_exercise(pe_id: int, body: schemas.PlanExerciseCreate, db: Session = Depends(get_db)):
    pe = db.get(models.PlanExercise, pe_id)
    if not pe:
        raise HTTPException(404, "Plan exercise not found")
    for k, v in body.model_dump().items():
        setattr(pe, k, v)
    db.commit()
    db.refresh(pe)
    return pe


@app.delete("/api/plan-exercises/{pe_id}", status_code=204)
def delete_plan_exercise(pe_id: int, db: Session = Depends(get_db)):
    pe = db.get(models.PlanExercise, pe_id)
    if not pe:
        raise HTTPException(404, "Plan exercise not found")
    db.delete(pe)
    db.commit()


# ─────────────────────────── Programs ───────────────────────────

@app.get("/api/programs", response_model=List[schemas.TrainingProgram])
def list_programs(db: Session = Depends(get_db)):
    return db.query(models.TrainingProgram).order_by(models.TrainingProgram.created_at.desc()).all()


@app.get("/api/programs/{program_id}", response_model=schemas.TrainingProgram)
def get_program(program_id: int, db: Session = Depends(get_db)):
    program = db.get(models.TrainingProgram, program_id)
    if not program:
        raise HTTPException(404, "Program not found")
    return program


@app.post("/api/programs", response_model=schemas.TrainingProgram, status_code=201)
def create_program(body: schemas.TrainingProgramCreate, db: Session = Depends(get_db)):
    program = models.TrainingProgram(**body.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


@app.put("/api/programs/{program_id}", response_model=schemas.TrainingProgram)
def update_program(program_id: int, body: schemas.TrainingProgramCreate, db: Session = Depends(get_db)):
    program = db.get(models.TrainingProgram, program_id)
    if not program:
        raise HTTPException(404, "Program not found")
    for k, v in body.model_dump().items():
        setattr(program, k, v)
    db.commit()
    db.refresh(program)
    return program


@app.delete("/api/programs/{program_id}", status_code=204)
def delete_program(program_id: int, db: Session = Depends(get_db)):
    program = db.get(models.TrainingProgram, program_id)
    if not program:
        raise HTTPException(404, "Program not found")
    db.delete(program)
    db.commit()


@app.get("/api/programs/{program_id}/progress", response_model=schemas.ProgramProgress)
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
            progress_entries.append(
                schemas.SetProgressEntry(
                    session_id=session.id,
                    session_date=session.started_at,
                    set_number=s.set_number,
                    reps_done=s.reps_done,
                    weight_used=s.weight_used,
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

@app.post("/api/sessions", response_model=schemas.WorkoutSession, status_code=201)
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


@app.post("/api/sessions/{session_id}/finish", response_model=schemas.WorkoutSession)
def finish_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.WorkoutSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.finished_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@app.post("/api/sessions/{session_id}/sets", response_model=schemas.SessionSet, status_code=201)
def log_set(session_id: int, body: schemas.SessionSetCreate, db: Session = Depends(get_db)):
    if not db.get(models.WorkoutSession, session_id):
        raise HTTPException(404, "Session not found")
    logged = models.SessionSet(session_id=session_id, **body.model_dump())
    db.add(logged)
    db.commit()
    db.refresh(logged)
    return logged


@app.get("/api/sessions/{session_id}/summary", response_model=schemas.SessionSummary)
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
        exercises=exercise_summaries,
        grand_total_weight=grand_total,
    )
