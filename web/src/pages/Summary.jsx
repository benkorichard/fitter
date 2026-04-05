import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import * as api from '../api'

function formatDuration(seconds) {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function Summary() {
  const { sessionId } = useParams()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getSessionSummary(sessionId)
      .then(setSummary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return <div className="loading">Loading summary…</div>
  if (error) return <div className="error">{error}</div>

  const totalSets = summary.exercises.reduce((a, e) => a + e.total_sets, 0)
  const totalReps = summary.exercises.reduce((a, e) => a + e.total_reps, 0)

  return (
    <div>
      <h1>Workout Complete 🎉</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>{summary.plan_name}</p>

      <div className="summary-stats">
        <div className="stat-card">
          <span className="stat-value">{formatDuration(summary.duration_seconds)}</span>
          <span className="stat-label">Duration</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary.exercises.length}</span>
          <span className="stat-label">Exercises</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalSets}</span>
          <span className="stat-label">Total sets</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalReps}</span>
          <span className="stat-label">Total reps</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary.grand_total_weight.toLocaleString()} kg</span>
          <span className="stat-label">Total weight moved</span>
        </div>
      </div>

      <div className="card">
        <h2>Exercise breakdown</h2>
        {summary.exercises.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No sets were logged.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Muscle group</th>
                <th>Sets</th>
                <th>Total reps</th>
                <th>Weight moved</th>
              </tr>
            </thead>
            <tbody>
              {summary.exercises.map((ex, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{ex.exercise_name}</td>
                  <td style={{ color: 'var(--muted)' }}>{ex.muscle_group || '—'}</td>
                  <td>{ex.total_sets}</td>
                  <td>{ex.total_reps}</td>
                  <td>{ex.total_weight_moved.toLocaleString()} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex-gap mt-3">
        <Link to="/"><button className="btn-primary">Back to Sessions</button></Link>
      </div>
    </div>
  )
}
