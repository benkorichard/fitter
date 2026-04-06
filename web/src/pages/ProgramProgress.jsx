import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as api from '../api'

const LINE_COLORS = ['#ff7300', '#82ca9d', '#8884d8', '#ffc658', '#ff7c7c', '#a4de6c']

function safeMax(values, fallback = 0) {
  if (!values || values.length === 0) return fallback
  return Math.max(...values)
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ProgramProgress() {
  const { id } = useParams()
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState('ALL')

  useEffect(() => {
    api.getProgramProgress(id)
      .then(setProgress)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!progress) return
    if (progress.exercise_name && (progress.exercise_name || '').trim()) {
      setSelectedExercise(progress.exercise_name)
    } else {
      setSelectedExercise('ALL')
    }
  }, [progress])

  const availableExercises = useMemo(() => {
    if (!progress) return []
    return Array.from(new Set(progress.progress_entries.map(e => (e.exercise_name || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [progress])

  const analysisEntries = useMemo(() => {
    if (!progress || progress.progress_entries.length === 0) return []

    const eligible = progress.progress_entries.filter(e => !e.exclude_from_analytics)

    if (selectedExercise === 'ALL') return eligible

    return eligible.filter(
      e => (e.exercise_name || '').trim().toLowerCase() === selectedExercise.trim().toLowerCase()
    )
  }, [progress, selectedExercise])

  const analytics = useMemo(() => {
    if (!progress || analysisEntries.length === 0) {
      return {
        sessions: [],
        setNumbers: [],
        chartData: [],
        maxSetNumber: 0,
        prHighlights: [],
        rollingBest: [],
        plateau: null,
      }
    }

    const entriesBySession = {}
    analysisEntries.forEach(entry => {
      if (!entriesBySession[entry.session_id]) {
        entriesBySession[entry.session_id] = {
          session_date: entry.session_date,
          sets: [],
        }
      }
      entriesBySession[entry.session_id].sets.push(entry)
    })

    const sessions = Object.entries(entriesBySession).sort(
      (a, b) => new Date(a[1].session_date) - new Date(b[1].session_date)
    )

    const setNumbers = Array.from(new Set(analysisEntries.map(e => e.set_number))).sort((a, b) => a - b)
    const maxSetNumber = safeMax(setNumbers)

    const chartData = sessions.map(([sessionId, data]) => {
      const row = {
        session_id: sessionId,
        session_date: data.session_date,
        date_label: formatDate(data.session_date),
      }

      let rpeValues = []
      data.sets.forEach(entry => {
        row[`set${entry.set_number}_reps`] = entry.reps_done
        row[`set${entry.set_number}_weight`] = entry.weight_used
        if (entry.rpe != null) rpeValues.push(entry.rpe)
      })

      row.session_best_weight = safeMax(data.sets.map(s => s.weight_used), 0)
      row.session_best_reps = safeMax(data.sets.map(s => s.reps_done), 0)
      row.avg_rpe = rpeValues.length ? (rpeValues.reduce((a, v) => a + v, 0) / rpeValues.length) : null
      return row
    })

    // PR highlights: detect each new all-time high for weight and reps.
    let bestWeight = -Infinity
    let bestReps = -Infinity
    const prHighlights = []

    chartData.forEach((row, index) => {
      if (row.session_best_weight > bestWeight) {
        bestWeight = row.session_best_weight
        prHighlights.push({
          type: 'Weight PR',
          value: `${row.session_best_weight} kg`,
          date: row.date_label,
          idx: index,
        })
      }

      if (row.session_best_reps > bestReps) {
        bestReps = row.session_best_reps
        prHighlights.push({
          type: 'Rep PR',
          value: `${row.session_best_reps} reps`,
          date: row.date_label,
          idx: index,
        })
      }
    })

    // Rolling best (3-session window) based on best session weight.
    const rollingBest = chartData.map((row, i) => {
      const start = Math.max(0, i - 2)
      const window = chartData.slice(start, i + 1)
      return {
        date_label: row.date_label,
        rolling_best_weight: safeMax(window.map(x => x.session_best_weight), 0),
      }
    })

    // Plateau heuristic: at least 6 sessions and no best-weight improvement in last 5.
    let plateau = null
    if (chartData.length >= 6) {
      const bestBeforeLastFive = safeMax(chartData.slice(0, -5).map(x => x.session_best_weight), 0)
      const bestLastFive = safeMax(chartData.slice(-5).map(x => x.session_best_weight), 0)
      if (bestLastFive <= bestBeforeLastFive) {
        plateau = {
          detected: true,
          message: `No best-weight improvement in the last 5 sessions (stuck at ${bestLastFive} kg).`,
        }
      }
    }

    return {
      sessions,
      setNumbers,
      chartData,
      maxSetNumber,
      prHighlights,
      rollingBest,
      plateau,
    }
  }, [progress, analysisEntries])

  const sessionHistory = useMemo(() => {
    if (!progress || progress.progress_entries.length === 0) return []

    const bySession = {}
    progress.progress_entries.forEach(entry => {
      if (!bySession[entry.session_id]) {
        bySession[entry.session_id] = {
          session_date: entry.session_date,
          exerciseBuckets: {},
        }
      }
      const exName = entry.exercise_name || 'Unknown Exercise'
      if (!bySession[entry.session_id].exerciseBuckets[exName]) {
        bySession[entry.session_id].exerciseBuckets[exName] = []
      }
      bySession[entry.session_id].exerciseBuckets[exName].push(entry)
    })

    return Object.entries(bySession)
      .sort((a, b) => new Date(a[1].session_date) - new Date(b[1].session_date))
      .map(([sessionId, data]) => {
        const allSets = Object.values(data.exerciseBuckets).flat()
        const isExcluded = allSets.some(s => s.exclude_from_analytics)
        const exercises = Object.entries(data.exerciseBuckets)
          .map(([exerciseName, sets]) => {
            const sortedSets = [...sets].sort((x, y) => x.set_number - y.set_number)
            return {
              exerciseName,
              details: sortedSets
                .map(s => `S${s.set_number}: ${s.reps_done}x${s.weight_used}kg${s.rpe != null ? ` / RPE ${s.rpe}` : ''}${s.rir != null ? ` / RIR ${s.rir}` : ''}`)
                .join(' | '),
            }
          })
          .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))

        return {
          sessionId,
          sessionDate: data.session_date,
          isExcluded,
          exercises,
        }
      })
  }, [progress])

  if (loading) return <div className="loading">Loading progress…</div>
  if (error) return <div className="error">{error}</div>
  if (!progress) return <div className="empty">No progress data</div>

  function getSetProgress(setNumber) {
    return safeMax(
      analysisEntries
        .filter(e => e.set_number === setNumber)
        .map(e => e.reps_done)
    )
  }

  function getWeightProgress(setNumber) {
    return safeMax(
      analysisEntries
        .filter(e => e.set_number === setNumber)
        .map(e => e.weight_used)
    )
  }

  return (
    <div>
      <h1>{progress.program_name}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        {progress.exercise_name && <><strong>{progress.exercise_name}</strong> - </>}
        Goal: <strong>{progress.goal || 'Not set'}</strong>
      </p>

      {availableExercises.length > 1 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Analytics exercise filter</label>
          <select
            value={selectedExercise}
            onChange={e => setSelectedExercise(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            <option value="ALL">All exercises in this program</option>
            {availableExercises.map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>
      )}

      <div className="summary-stats">
        <div className="stat-card">
          <span className="stat-value">{progress.total_sessions}</span>
          <span className="stat-label">Workouts logged</span>
        </div>
        {progress.progress_entries.length > 0 && (
          <>
            <div className="stat-card">
              <span className="stat-value">{analytics.maxSetNumber}</span>
              <span className="stat-label">Highest set</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{safeMax(analysisEntries.map(e => e.reps_done))}</span>
              <span className="stat-label">Max reps (1 set)</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{safeMax(analysisEntries.map(e => e.weight_used))} kg</span>
              <span className="stat-label">Max weight</span>
            </div>
          </>
        )}
      </div>

      {selectedExercise !== 'ALL' && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '-0.75rem', marginBottom: '1rem' }}>
          Analytics charts are currently focused on <strong>{selectedExercise}</strong>.
        </p>
      )}

      {analytics.plateau?.detected && (
        <div className="card mt-2" style={{ borderColor: 'var(--danger)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Plateau detected</h2>
          <p style={{ color: 'var(--muted)' }}>{analytics.plateau.message}</p>
        </div>
      )}

      {progress.progress_entries.length > 0 && (
        <>
          <div className="card mt-2">
            <h2>Reps progression</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.chartData} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date_label" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
                <YAxis label={{ value: 'Reps', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {analytics.setNumbers.map((setNum, idx) => (
                  <Line
                    key={setNum}
                    type="monotone"
                    dataKey={`set${setNum}_reps`}
                    name={`Set ${setNum}`}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
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
              <LineChart data={analytics.chartData} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date_label" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
                <YAxis label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {analytics.setNumbers.map((setNum, idx) => (
                  <Line
                    key={setNum}
                    type="monotone"
                    dataKey={`set${setNum}_weight`}
                    name={`Set ${setNum}`}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    connectNulls
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card mt-2">
            <h2>Rolling best (3-session)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.rollingBest} margin={{ top: 5, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date_label" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis label={{ value: 'Best weight (kg)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="rolling_best_weight"
                  name="Rolling best"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card mt-2">
            <h2>PR highlights</h2>
            {analytics.prHighlights.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No PR highlights yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.prHighlights.map((pr, i) => (
                    <tr key={`${pr.type}-${pr.idx}-${i}`}>
                      <td>{pr.date}</td>
                      <td>{pr.type}</td>
                      <td style={{ fontWeight: 600 }}>{pr.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

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
              {Array.from({ length: analytics.maxSetNumber }).map((_, i) => {
                const setNum = i + 1
                return (
                  <tr key={setNum}>
                    <td style={{ fontWeight: 500 }}>Set {setNum}</td>
                    <td>{getSetProgress(setNum)} reps</td>
                    <td>{getWeightProgress(setNum)} kg</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {sessionHistory.length > 0 && (
        <div className="card mt-2">
          <h2>Session history</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '100%' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Exercises in session</th>
                  <th style={{ width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {sessionHistory.map(({ sessionId, sessionDate, exercises, isExcluded }) => (
                  <tr key={sessionId}>
                    <td style={{ fontWeight: 500 }}>
                      {formatDate(sessionDate)}
                      {isExcluded && <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: '0.8rem' }}>(excluded)</span>}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {exercises.map(ex => (
                          <div key={ex.exerciseName}>
                            <strong>{ex.exerciseName}:</strong> {ex.details}
                          </div>
                        ))}
                      </div>
                    </td>
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
