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
- **Data Import (JSON)**: Dry-run and import previously exported JSON to recover history after resets or migrations
- **Session History**: Access past workout summaries with total reps, weight moved, and duration
- **Exercise Library**: Manage your exercise database with muscle groups and descriptions

## Tech Stack

- **Frontend**: React + Vite (build tooling)
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

## Manual Backup and Restore

### Export via API

- JSON: `GET /api/export/json`
- CSV: `GET /api/export/csv`

Examples:

```bash
curl -L http://localhost:8000/api/export/json -o fitter-export.json
curl -L http://localhost:8000/api/export/csv -o fitter-export.csv
```

### Import via API

- JSON import endpoint: `POST /api/import/json`
- Supports:
	- `dry_run` (validate only, no writes)
	- `clear_existing` (wipe current data before import)

Example payload:

```json
{
	"rows": [
		{
			"session_id": 1,
			"session_date": "2026-04-06T10:00:00",
			"plan_name": "Push Day",
			"program_name": "Bench Cycle 1",
			"exercise_name": "Bench Press",
			"set_number": 1,
			"reps_done": 8,
			"weight_used": 62.5,
			"is_warmup": false
		}
	],
	"dry_run": true,
	"clear_existing": false
}
```

### Recommended upgrade safety flow

1. Export JSON backup.
2. Upgrade/redeploy.
3. If needed, reset DB and import JSON (dry-run first, then real import).

## Recovery and Compatibility

- Recommended safety flow before upgrades: export JSON, then upgrade.
- If the database must be reset, import your JSON backup from the Export page.
- Import supports both:
  - legacy exports (raw JSON array of rows)
  - current exports (`{ format_version, created_at, rows }`)
- Unknown/new fields are ignored during import, and missing fields use safe defaults.

This provides practical backward compatibility for historical workout data, even when schema changes require a fresh database.
