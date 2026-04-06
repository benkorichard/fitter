import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ---------- Exercise ----------

class ExerciseCreate(BaseModel):
    name: str = Field(examples=["Barbell Back Squat"])
    muscle_group: str = Field(default="", examples=["Legs"])
    description: str = Field(default="", examples=["High-bar squat with full depth"])


class Exercise(ExerciseCreate):
    id: int
    model_config = {"from_attributes": True}


# ---------- Plan Exercise ----------

class PlanExerciseCreate(BaseModel):
    exercise_id: int = Field(examples=[3])
    sets: int = Field(default=3, examples=[4])
    reps: int = Field(default=10, examples=[8])
    weight: float = Field(default=0.0, examples=[80.0])
    scheme_type: str = Field(default="straight", examples=["straight"])
    superset_group: str = Field(default="", examples=["A"])
    superset_order: int = Field(default=0, examples=[1])
    order: int = Field(default=0, examples=[0])


class PlanExercise(PlanExerciseCreate):
    id: int
    exercise: Exercise
    model_config = {"from_attributes": True}


# ---------- Workout Plan ----------

class WorkoutPlanCreate(BaseModel):
    name: str = Field(examples=["Push Day"])
    description: str = Field(default="", examples=["Chest, shoulders, triceps focus"])
    rest_time: int = Field(default=60, examples=[90])
    scheme_type: str = Field(default="straight", examples=["straight"])


class WorkoutPlan(WorkoutPlanCreate):
    id: int
    plan_exercises: List[PlanExercise] = []
    archived: bool = False
    model_config = {"from_attributes": True}


# ---------- Session ----------

class TrainingProgramCreate(BaseModel):
    name: str = Field(examples=["8 Week Squat Cycle"])
    description: str = Field(default="", examples=["Linear progression block"])
    goal: str = Field(default="", examples=["5x5 @ 120kg"])
    exercise: str = Field(default="", examples=["Back Squat"])
    status: str = Field(default="active", examples=["active"])


class TrainingProgram(TrainingProgramCreate):
    id: int
    created_at: datetime.datetime
    model_config = {"from_attributes": True}


class WorkoutSessionCreate(BaseModel):
    plan_id: int = Field(examples=[1])
    program_id: Optional[int] = Field(default=None, examples=[2])
    notes: str = Field(default="", examples=["Felt strong today"])


class WorkoutSession(WorkoutSessionCreate):
    id: int
    started_at: datetime.datetime
    finished_at: Optional[datetime.datetime] = None
    exclude_from_analytics: bool = False
    model_config = {"from_attributes": True}


# ---------- Session Set ----------

class SessionSetCreate(BaseModel):
    plan_exercise_id: int = Field(examples=[5])
    set_number: int = Field(examples=[1])
    reps_done: int = Field(examples=[5])
    weight_used: float = Field(examples=[100.0])
    rpe: Optional[float] = Field(default=None, examples=[8.5])
    rir: Optional[float] = Field(default=None, examples=[1.0])
    is_warmup: bool = Field(default=False, examples=[False])


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
    exclude_from_analytics: bool = False
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
    exclude_from_analytics: bool = False


class ProgramProgress(BaseModel):
    program_id: int
    program_name: str
    goal: str
    exercise_name: str
    status: str
    total_sessions: int
    progress_entries: List[SetProgressEntry]
    model_config = {"from_attributes": True}
