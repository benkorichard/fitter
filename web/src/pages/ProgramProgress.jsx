import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as api from '../api'

export default function ProgramProgress() {
  const { id } = useParams()
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getProgramProgress(id)
      .then(setProgress)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading">Loading progress…</div>
  if (error) return <div className="error">{error}</div>
  if (!progress) return <div className="empty">No progress data</div>

  const entriesBySession = {}
  progress.progress_entries.forEach(entry => {
    if (!entriesBySession[entry.session_id]) {
      entriesBySession[entry.session_id] = {
        session_date: entry.session_date,
        sets: [],
      }
    }
    entriesBySession[entry.session_id].sets.push(entry)
  })

  const sessions = Object.entries(entriesBySession).sort((a, b) => 
    new Date(a[1].session_date) - new Date(b[1].session_date)
  )

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function getSetProgress(setNumber) {
    const reps = progress.progress_entries
      .filter(e => e.set_number === setNumber)
      .map(e => e.reps_done)
    return reps.length > 0 ? Math.max(...reps) : 0
  }

  function getWeightProgress(setNumber) {
    const weights = progress.progress_entries
      .filter(e => e.set_number === setNumber)
      .map(e => e.weight_used)
    return weights.length > 0 ? Math.max(...weights) : 0
  }

  function buildChartData() {
    const chartBySession = {}
    
    // Group by session, get date
    progress.progress_entries.forEach(entry => {
      if (!chartBySession[entry.session_id]) {
        chartBySession[entry.session_id] = {
          session_id: entry.session_id,
          session_date: entry.session_date,
          date_label: formatDate(entry.session_date),
        }
      }
    })

    // For each session, add reps/weight for each set
    progress.progress_entries.forEach(entry => {
      const sessionData = chartBySession[entry.session_id]
      sessionData[`set${entry.set_number}_reps`] = entry.reps_done
      sessionData[`set${entry.set_number}_weight`] = entry.weight_used
    })

    // Return sorted by date
    return Object.values(chartBySession).sort((a, b) => 
      new Date(a.session_date) - new Date(b.session_date)
    )
  }

  function getSetNumbers() {
    return Array.from(
      new Set(progress.progress_entries.map(e => e.set_number))
    ).sort((a, b) => a - b)
  }

  return (
    <div>
      <h1>{progress.program_name}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        {progress.exercise_name && <><strong>{progress.exercise_name}</strong> — </>}
        Goal: <strong>{progress.goal || 'Not set'}</strong>
      </p>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-card">
          <span className="stat-value">{progress.total_sessions}</span>
          <span className="stat-label">Workouts logged</span>
        </div>
        {progress.progress_entries.length > 0 && (
          <>
            <div className="stat-card">
              <span className="stat-value">{Math.max(...progress.progress_entries.map(e => e.set_number))}</span>
              <span className="stat-label">Highest set</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.max(...progress.progress_entries.map(e => e.reps_done))}</span>
              <span className="stat-label">Max reps (1 set)</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.max(...progress.progress_entries.map(e => e.weight_used))} kg</span>
              <span className="stat-label">Max weight</span>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      {progress.progress_entries.length > 0 && (
        <>
          <div className="card mt-2">
            <h2>Reps progression</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={buildChartData()} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date_label" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis label={{ value: 'Reps', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {getSetNumbers().map((setNum, idx) => (
                  <Line
                    key={setNum}
                    type="monotone"
                    dataKey={`set${setNum}_reps`}
                    name={`Set ${setNum}`}
                    stroke={['#ff7300', '#82ca9d', '#8884d8', '#ffc658', '#ff7c7c', '#a4de6c'][idx % 6]}
                    connectNulls
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card mt-2">
            <h2>Weight progression</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={buildChartData()} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date_label" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {getSetNumbers().map((setNum, idx) => (
                  <Line
                    key={setNum}
                    type="monotone"
                    dataKey={`set${setNum}_weight`}
                    name={`Set ${setNum}`}
                    stroke={['#ff7300', '#82ca9d', '#8884d8', '#ffc658', '#ff7c7c', '#a4de6c'][idx % 6]}
                    connectNulls
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* 
  return (
    <div>
      <h1>{progress.program_name}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        {progress.exercise_name && <><strong>{progress.exercise_name}</strong> — </>}
        Goal: <strong>{progress.goal || 'Not set'}</strong>
      </p>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-card">
          <span className="stat-value">{progress.total_sessions}</span>
          <span className="stat-label">Workouts logged</span>
        </div>
        {progress.progress_entries.length > 0 && (
          <>
            <div className="stat-card">
              <span className="stat-value">{Math.max(...progress.progress_entries.map(e => e.set_number))}</span>
              <span className="stat-label">Highest set</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.max(...progress.progress_entries.map(e => e.reps_done))}</span>
              <span className="stat-label">Max reps (1 set)</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{Math.max(...progress.progress_entries.map(e => e.weight_used))} kg</span>
              <span className="stat-label">Max weight</span>
            </div>
          </>
        )}
      </div>

      {/* Progression by set */}
      {progress.progress_entries.length > 0 && (
        <div className="card mt-2">
          <h2>Progression by set</h2>
          <table>
            <thead>
              <tr>
                <th>Set</th>
                <th>Max reps</th>
                <th>Max weight</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(...progress.progress_entries.map(e => e.set_number)) }).map((_, i) => {
                const setNum = i + 1
                const maxReps = getSetProgress(setNum)
                const maxWeight = getWeightProgress(setNum)
                return (
                  <tr key={setNum}>
                    <td style={{ fontWeight: 500 }}>Set {setNum}</td>
                    <td>{maxReps} reps</td>
                    <td>{maxWeight} kg</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Session history */}
      {sessions.length > 0 && (
        <div className="card mt-2">
          <h2>Session history</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '100%' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  {Array.from({ length: Math.max(...progress.progress_entries.map(e => e.set_number)) }).map((_, i) => (
                    <th key={i + 1} style={{ textAlign: 'center' }}>Set {i + 1}</th>
                  ))}
                  <th style={{ width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {sessions.map(([sessionId, data]) => (
                  <tr key={sessionId}>
                    <td style={{ fontWeight: 500 }}>{formatDate(data.session_date)}</td>
                    {Array.from({ length: Math.max(...progress.progress_entries.map(e => e.set_number)) }).map((_, i) => {
                      const setNum = i + 1
                      const set = data.sets.find(s => s.set_number === setNum)
                      return (
                        <td key={setNum} style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                          {set ? `${set.reps_done}×${set.weight_used}kg` : '—'}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <Link to={`/session/${sessionId}/summary`}>
                        <button className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.82rem' }}>
                          View
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {progress.progress_entries.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--muted)' }}>No workouts logged yet for this program.</p>
        </div>
      )}

      <div className="flex-gap mt-3">
        <Link to="/programs"><button className="btn-secondary">← Back to Programs</button></Link>
      </div>
    </div>
  )
}
