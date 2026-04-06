import datetime
from typing import List, Optional
from pydantic import BaseModel


# ---------- Exercise ----------

class ExerciseCreate(BaseModel):
    name: str
    muscle_group: str = ""
    description: str = ""


class Exercise(ExerciseCreate):
    id: int
    model_config = {"from_attributes": True}


# ---------- Plan Exercise ----------

class PlanExerciseCreate(BaseModel):
    exercise_id: int
    sets: int = 3
    reps: int = 10
    weight: float = 0.0
    scheme_type: str = "straight"
    superset_group: str = ""
    superset_order: int = 0
    order: int = 0


class PlanExercise(PlanExerciseCreate):
    id: int
    exercise: Exercise
    model_config = {"from_attributes": True}


# ---------- Workout Plan ----------

class WorkoutPlanCreate(BaseModel):
    name: str
    description: str = ""
    rest_time: int = 60
    scheme_type: str = "straight"


class WorkoutPlan(WorkoutPlanCreate):
    id: int
    plan_exercises: List[PlanExercise] = []
    model_config = {"from_attributes": True}


# ---------- Session ----------

class TrainingProgramCreate(BaseModel):
    name: str
    description: str = ""
    goal: str = ""
    exercise: str = ""


class TrainingProgram(TrainingProgramCreate):
    id: int
    status: str = "active"
    created_at: datetime.datetime
    model_config = {"from_attributes": True}


class WorkoutSessionCreate(BaseModel):
    plan_id: int
    program_id: Optional[int] = None
    notes: str = ""


class WorkoutSession(WorkoutSessionCreate):
    id: int
    started_at: datetime.datetime
    finished_at: Optional[datetime.datetime] = None
    model_config = {"from_attributes": True}


# ---------- Session Set ----------

class SessionSetCreate(BaseModel):
    plan_exercise_id: int
    set_number: int
    reps_done: int
    weight_used: float
    rpe: Optional[float] = None
    rir: Optional[float] = None
    is_warmup: bool = False


class SessionSet(SessionSetCreate):
    id: int
    session_id: int
    model_config = {"from_attributes": True}


# ---------- Summary ----------

class ExerciseSummary(BaseModel):
    exercise_name: str
    muscle_group: str
    total_sets: int
    total_reps: int
    total_weight_moved: float


class SessionSummary(BaseModel):
    session_id: int
    plan_name: str
    started_at: datetime.datetime
    finished_at: Optional[datetime.datetime] = None
    duration_seconds: Optional[int] = None
    notes: str = ""
    exercises: List[ExerciseSummary]
    grand_total_weight: float


class SetProgressEntry(BaseModel):
    session_id: int
    session_date: datetime.datetime
    exercise_name: str = ""
    set_number: int
    reps_done: int
    weight_used: float
    rpe: Optional[float] = None
    rir: Optional[float] = None


class ProgramProgress(BaseModel):
    program_id: int
    program_name: str
    goal: str
    exercise_name: str
    status: str
    total_sessions: int
    progress_entries: List[SetProgressEntry]
    model_config = {"from_attributes": True}
