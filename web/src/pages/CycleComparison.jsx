import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'

function safeMax(arr) {
  return arr.length > 0 ? Math.max(...arr) : 0
}

function CycleStats({ progress, title }) {
  if (!progress) return null

  function getSetProgress(setNumber) {
    return safeMax(progress.progress_entries
      .filter(e => e.set_number === setNumber)
      .map(e => e.reps_done))
  }

  function getWeightProgress(setNumber) {
    return safeMax(progress.progress_entries
      .filter(e => e.set_number === setNumber)
      .map(e => e.weight_used))
  }

  return (
    <div style={{ flex: 1, minWidth: '300px' }}>
      <div className="card">
        <h2>{title}</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
          {progress.exercise_name && <><strong>{progress.exercise_name}</strong> — </>}
          Goal: <strong>{progress.goal || 'Not set'}</strong>
        </p>

        <div className="summary-stats" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <span className="stat-value">{progress.total_sessions}</span>
            <span className="stat-label">Workouts</span>
          </div>
          {progress.progress_entries.length > 0 && (
            <>
              <div className="stat-card">
                <span className="stat-value">{safeMax(progress.progress_entries.map(e => e.set_number))}</span>
                <span className="stat-label">Sets</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{safeMax(progress.progress_entries.map(e => e.reps_done))}</span>
                <span className="stat-label">Peak reps</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{safeMax(progress.progress_entries.map(e => e.weight_used))} kg</span>
                <span className="stat-label">Peak weight</span>
              </div>
            </>
          )}
        </div>

        {progress.progress_entries.length > 0 && (
          <table style={{ width: '100%', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th>Set</th>
                <th>Max reps</th>
                <th>Max weight</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: safeMax(progress.progress_entries.map(e => e.set_number)) }).map((_, i) => {
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
        )}
      </div>
    </div>
  )
}

export default function CycleComparison() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [cycle1Id, setCycle1Id] = useState(null)
  const [cycle2Id, setCycle2Id] = useState(null)
  const [progress1, setProgress1] = useState(null)
  const [progress2, setProgress2] = useState(null)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    api.getPrograms().then(setPrograms).finally(() => setLoading(false))
  }, [])

  function handleCompare() {
    if (!cycle1Id || !cycle2Id) {
      alert('Select two programs to compare')
      return
    }
    if (cycle1Id === cycle2Id) {
      alert('Select different programs')
      return
    }

    setComparing(true)
    Promise.all([
      api.getProgramProgress(cycle1Id),
      api.getProgramProgress(cycle2Id)
    ])
      .then(([p1, p2]) => {
        setProgress1(p1)
        setProgress2(p2)
      })
      .catch(e => alert('Error loading progress: ' + e.message))
      .finally(() => setComparing(false))
  }

  if (loading) return <div className="loading">Loading programs…</div>

  return (
    <div>
      <h1>Cycle Comparison</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>View two training cycles side-by-side to see your progress</p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
          <label>
            Cycle 1
            <select
              value={cycle1Id || ''}
              onChange={e => setCycle1Id(e.target.value ? parseInt(e.target.value) : null)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text)',
                marginTop: '0.35rem',
              }}
            >
              <option value="">Select a program…</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Cycle 2
            <select
              value={cycle2Id || ''}
              onChange={e => setCycle2Id(e.target.value ? parseInt(e.target.value) : null)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text)',
                marginTop: '0.35rem',
              }}
            >
              <option value="">Select a program…</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={handleCompare} disabled={comparing}>
            {comparing ? 'Loading…' : 'Compare'}
          </button>
        </div>
      </div>

      {progress1 && progress2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <CycleStats progress={progress1} title={progress1.program_name} />
          <CycleStats progress={progress2} title={progress2.program_name} />
        </div>
      )}

      {progress1 && progress2 && (
        <div className="card mt-2">
          <h2>Performance Delta (Cycle 2 vs Cycle 1)</h2>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Set</th>
                <th>Cycle 1 reps</th>
                <th>Cycle 2 reps</th>
                <th>Difference</th>
                <th>Cycle 1 weight</th>
                <th>Cycle 2 weight</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(
                safeMax(progress1.progress_entries.map(e => e.set_number)),
                safeMax(progress2.progress_entries.map(e => e.set_number))
              ) }).map((_, i) => {
                const setNum = i + 1
                const c1Reps = safeMax(progress1.progress_entries.filter(e => e.set_number === setNum).map(e => e.reps_done))
                const c2Reps = safeMax(progress2.progress_entries.filter(e => e.set_number === setNum).map(e => e.reps_done))
                const repDiff = c2Reps - c1Reps

                const c1Weight = safeMax(progress1.progress_entries.filter(e => e.set_number === setNum).map(e => e.weight_used))
                const c2Weight = safeMax(progress2.progress_entries.filter(e => e.set_number === setNum).map(e => e.weight_used))
                const weightDiff = c2Weight - c1Weight

                return (
                  <tr key={setNum}>
                    <td style={{ fontWeight: 500 }}>Set {setNum}</td>
                    <td>{c1Reps}</td>
                    <td>{c2Reps}</td>
                    <td style={{ color: repDiff >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {repDiff > 0 ? '+' : ''}{repDiff}
                    </td>
                    <td>{c1Weight} kg</td>
                    <td>{c2Weight} kg</td>
                    <td style={{ color: weightDiff >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(1)} kg
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex-gap mt-3">
        <Link to="/programs"><button className="btn-secondary">← Back to Programs</button></Link>
      </div>
    </div>
  )
}
