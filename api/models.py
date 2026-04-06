import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    muscle_group = Column(String(100), default="")
    description = Column(String(500), default="")


class WorkoutPlan(Base):
    __tablename__ = "workout_plans"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    rest_time = Column(Integer, default=60)  # seconds between sets
    plan_exercises = relationship(
        "PlanExercise",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanExercise.order",
    )


class PlanExercise(Base):
    __tablename__ = "plan_exercises"

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("workout_plans.id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    sets = Column(Integer, default=3)
    reps = Column(Integer, default=10)
    weight = Column(Float, default=0.0)
    order = Column(Integer, default=0)

    plan = relationship("WorkoutPlan", back_populates="plan_exercises")
    exercise = relationship("Exercise")


class TrainingProgram(Base):
    __tablename__ = "training_programs"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    goal = Column(String(200), default="")  # e.g. "5x8 @ 50kg"
    exercise = Column(String(100), default="")  # primary exercise being progressed
    status = Column(String(20), default="active")  # active, completed, paused
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    sessions = relationship(
        "WorkoutSession",
        back_populates="program",
        cascade="all, delete-orphan",
    )


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("workout_plans.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("training_programs.id"), nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    notes = Column(String(1000), default="")  # Session notes
    logged_sets = relationship(
        "SessionSet",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    program = relationship("TrainingProgram", back_populates="sessions")


class SessionSet(Base):
    __tablename__ = "session_sets"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False)
    plan_exercise_id = Column(Integer, ForeignKey("plan_exercises.id"), nullable=False)
    set_number = Column(Integer, nullable=False)
    reps_done = Column(Integer, nullable=False)
    weight_used = Column(Float, nullable=False)
    rpe = Column(Float, nullable=True)
    rir = Column(Float, nullable=True)
    is_warmup = Column(Integer, default=False)  # 0=False, 1=True for warmup sets

    session = relationship("WorkoutSession", back_populates="logged_sets")
    plan_exercise = relationship("PlanExercise")
