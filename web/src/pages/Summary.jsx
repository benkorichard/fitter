import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [analyticsBusy, setAnalyticsBusy] = useState(false)

  useEffect(() => {
    api.getSessionSummary(sessionId)
      .then(data => {
        setSummary(data)
        setNotes(data.notes || '')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  async function saveNotes() {
    setSaving(true)
    try {
      await api.updateSessionNotes(sessionId, notes)
      setSummary(prev => ({ ...prev, notes }))
      setEditing(false)
    } catch (e) {
      alert('Error saving notes: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteCurrentSession() {
    const confirmed = window.confirm('Delete this session? This will remove its logged sets from history and analytics.')
    if (!confirmed) return

    try {
      await api.deleteSession(sessionId)
      navigate('/programs')
    } catch (e) {
      alert('Error deleting session: ' + e.message)
    }
  }

  async function toggleAnalyticsExclusion() {
    setAnalyticsBusy(true)
    try {
      const nextValue = !summary.exclude_from_analytics
      await api.setSessionAnalyticsExclusion(sessionId, nextValue)
      setSummary(prev => ({ ...prev, exclude_from_analytics: nextValue }))
    } catch (e) {
      alert('Error updating analytics flag: ' + e.message)
    } finally {
      setAnalyticsBusy(false)
    }
  }

  if (loading) return <div className="loading">Loading summary…</div>
  if (error) return <div className="error">{error}</div>

  const totalSets = summary.exercises.reduce((a, e) => a + e.total_sets, 0)
  const totalReps = summary.exercises.reduce((a, e) => a + e.total_reps, 0)

  return (
    <div>
      <h1>Workout Complete 🎉</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>{summary.plan_name}</p>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>Analytics inclusion</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
          {summary.exclude_from_analytics
            ? 'This session is excluded from analytics (progress, 1RM, consistency).'
            : 'This session is included in analytics.'}
        </p>
        <button className="btn-secondary" onClick={toggleAnalyticsExclusion} disabled={analyticsBusy}>
          {analyticsBusy
            ? 'Updating…'
            : (summary.exclude_from_analytics ? 'Include in analytics' : 'Mark as aborted (exclude)')}
        </button>
      </div>

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

      {editing ? (
        <div className="card">
          <h2>Session notes</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did you feel? Any observations?"
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
              marginBottom: '1rem',
              resize: 'vertical',
            }}
          />
          <div className="flex-gap">
            <button className="btn-primary" onClick={saveNotes} disabled={saving}>
              {saving ? 'Saving…' : 'Save notes'}
            </button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        summary.notes && (
          <div className="card">
            <h2>Session notes</h2>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{summary.notes}</p>
            <button className="btn-secondary" onClick={() => setEditing(true)}>Edit notes</button>
          </div>
        )
      )}

      <div className="flex-gap mt-3">
        <Link to="/"><button className="btn-primary">Back to Sessions</button></Link>
        <button className="btn-danger" onClick={deleteCurrentSession}>Delete Session</button>
      </div>
    </div>
  )
}
