# Fitter - Workout Tracker

A web application for tracking workout progress through training programs with detailed exercise logging and progression tracking.

## Features

- **Sessions**: Create reusable workout session templates with custom exercises, sets, reps, and weights
- **Programs**: Organize sessions into training programs to track long-term progression
- **Progress Tracking**: View detailed progression data across all sessions in a program, including reps/weight progression by set
- **Active Workout**: Log sets during workouts with configurable rest timers and audio cues
- **Session History**: Access past workout summaries with total reps, weight moved, and duration
- **Exercise Library**: Manage your exercise database with muscle groups and descriptions

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Python + FastAPI
- **Database**: SQLite
- **Containerization**: Docker Compose

## Getting Started

### Prerequisites
- Docker and Docker Compose installed

### Run the Application

```bash
cd fitter
docker compose up --build
```

The app will be available at:
- Frontend: http://localhost:5173
- API: http://localhost:8000

### First Time Setup

1. Go to Exercises tab and create some exercises with muscle groups
2. Create a Session template with your chosen exercises
3. Create a Training Program to track a specific progression goal
4. Start workouts and link them to programs to track progress

## Workflow

1. **Build Exercise Library**: Add exercises you use (Chinup, Pushup, Deadlift, etc.)
2. **Create Session Template**: Design a workout with selected exercises, sets, reps, and rest time
3. **Create Program**: Set up a training program (e.g., "Chinup Strength - Goal: 5x8 at 50kg")
4. **Start Workout**: Select a session, link to program, log sets with reps and weight
5. **Track Progress**: View program progress to see your complete progression over time

## Database

SQLite database is stored in a Docker volume at `/data/fitter.db` inside the container.

To access the database file:
```bash
docker compose cp api:/data/fitter.db ./fitter.db
```

## Notes

- No authentication required - designed for personal use
- All data is stored locally in the SQLite database
- Database volume persists between container restarts
- Reset database: `docker compose down -v && docker compose up --build`
