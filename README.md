# Fitter - Workout Tracker

A web application for tracking workout progress through training programs, with set-level logging, progression analytics, and export tools.

## Features

- **Sessions**: Create reusable workout session templates with custom exercises, sets, reps, and weights
- **Programs**: Organize sessions into training programs to track long-term progression
- **Progress Tracking**: View detailed progression data across all sessions in a program, including reps/weight progression charts
- **Cycle Comparison**: Compare two program cycles side-by-side with per-set performance deltas
- **Warmup Set Handling**: Mark sets as warmup so they are excluded from progression/PR metrics
- **Active Workout**: Log sets during workouts with configurable rest timers and audio cues
- **Session Notes**: Save notes per workout session and edit them from the summary view
- **1RM Calculator**: Estimate one-rep max from manual input and from logged workout data
- **Data Export**: Export all logged sets as CSV or JSON for backup and analysis
- **Session History**: Access past workout summaries with total reps, weight moved, and duration
- **Exercise Library**: Manage your exercise database with muscle groups and descriptions

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Python + FastAPI
- **Web Serving (Prod)**: Nginx (serving built static files)
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
- Frontend: http://localhost
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

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

## Deployment Notes

- The web container uses a production build (Vite build output) served by Nginx.
- Nginx proxies `/api/*` traffic to the API container.
- API hostname is configurable through `API_HOST` (defaults to `api`).

Example `.env` override for custom API container hostname:

```env
API_HOST=my-fitter-api
```

## Notes

- No authentication required - designed for personal use
- All data is stored locally in the SQLite database
- Database volume persists between container restarts
- Reset database: `docker compose down -v && docker compose up --build`
