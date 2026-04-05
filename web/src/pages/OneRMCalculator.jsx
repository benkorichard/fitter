import { useEffect, useState } from 'react'
import * as api from '../api'

// 1RM estimation formulas
function epley(weight, reps) {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

function brzycki(weight, reps) {
  if (reps === 1) return weight
  if (reps >= 37) return null // Formula breaks down
  return weight * 36 / (37 - reps)
}

function lander(weight, reps) {
  if (reps === 1) return weight
  return (100 * weight) / (101.3 - 2.67123 * reps)
}

function orm(weight, reps) {
  const e = epley(weight, reps)
  const b = brzycki(weight, reps)
  const l = lander(weight, reps)
  const valid = [e, b, l].filter(v => v !== null)
  return {
    epley: e,
    brzycki: b,
    lander: l,
    average: valid.reduce((a, v) => a + v, 0) / valid.length,
  }
}

function fmt(val) {
  if (val === null) return '—'
  return val.toFixed(1) + ' kg'
}

export default function OneRMCalculator() {
  const [bestSets, setBestSets] = useState([])
  const [loading, setLoading] = useState(true)

  // Manual calculator state
  const [manualWeight, setManualWeight] = useState('')
  const [manualReps, setManualReps] = useState('')

  useEffect(() => {
    api.getBestSets()
      .then(data => setBestSets(data.sort((a, b) => a.exercise_name.localeCompare(b.exercise_name))))
      .finally(() => setLoading(false))
  }, [])

  const manualW = parseFloat(manualWeight)
  const manualR = parseInt(manualReps)
  const manualValid = !isNaN(manualW) && !isNaN(manualR) && manualW > 0 && manualR >= 1 && manualR <= 40
  const manualResult = manualValid ? orm(manualW, manualR) : null

  return (
    <div>
      <h1>1RM Calculator</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        Estimate your one-rep max using the Epley, Brzycki, and Lander formulas.
        Warmup sets are excluded from logged estimates.
      </p>

      {/* Manual calculator */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>Manual Calculator</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <label>
            Weight (kg)
            <input
              type="number"
              min="0"
              step="0.5"
              value={manualWeight}
              onChange={e => setManualWeight(e.target.value)}
              placeholder="e.g. 100"
            />
          </label>
          <label>
            Reps
            <input
              type="number"
              min="1"
              max="40"
              value={manualReps}
              onChange={e => setManualReps(e.target.value)}
              placeholder="e.g. 5"
            />
          </label>
        </div>

        {manualResult && (
          <table>
            <thead>
              <tr>
                <th>Formula</th>
                <th>Estimated 1RM</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Epley</td>
                <td style={{ fontWeight: 500 }}>{fmt(manualResult.epley)}</td>
              </tr>
              <tr>
                <td>Brzycki</td>
                <td style={{ fontWeight: 500 }}>{fmt(manualResult.brzycki)}</td>
              </tr>
              <tr>
                <td>Lander</td>
                <td style={{ fontWeight: 500 }}>{fmt(manualResult.lander)}</td>
              </tr>
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td><strong>Average</strong></td>
                <td style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>{fmt(manualResult.average)}</td>
              </tr>
            </tbody>
          </table>
        )}
        {!manualResult && (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Enter weight and reps above to see your estimated 1RM.</p>
        )}
      </div>

      {/* From logged data */}
      <div className="card">
        <h2>From Your Logged Data</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Based on your heaviest logged set per exercise (warmup sets excluded).
        </p>

        {loading && <p className="loading">Loading…</p>}

        {!loading && bestSets.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>No workout data yet. Log some sets to see estimates here.</p>
        )}

        {!loading && bestSets.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Best set</th>
                  <th>Epley</th>
                  <th>Brzycki</th>
                  <th>Lander</th>
                  <th style={{ color: 'var(--accent)' }}>Average</th>
                </tr>
              </thead>
              <tbody>
                {bestSets.map(s => {
                  const est = orm(s.weight, s.reps)
                  return (
                    <tr key={s.exercise_id}>
                      <td style={{ fontWeight: 500 }}>
                        {s.exercise_name}
                        {s.muscle_group && (
                          <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 400 }}>{s.muscle_group}</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.9rem' }}>{s.reps} × {s.weight} kg</td>
                      <td>{fmt(est.epley)}</td>
                      <td>{fmt(est.brzycki)}</td>
                      <td>{fmt(est.lander)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(est.average)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-2" style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        <strong>Formula notes:</strong>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
          <li><strong>Epley</strong>: weight × (1 + reps/30) — most widely used</li>
          <li><strong>Brzycki</strong>: weight × 36 / (37 − reps) — more conservative at higher reps</li>
          <li><strong>Lander</strong>: (100 × weight) / (101.3 − 2.67 × reps) — good middle ground</li>
        </ul>
        <p style={{ marginTop: '0.5rem' }}>All formulas are most accurate for 1–10 reps. Treat estimates as guidelines, not absolutes.</p>
      </div>
    </div>
  )
}
