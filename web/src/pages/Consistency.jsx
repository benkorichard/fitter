import { useEffect, useMemo, useState } from 'react'
import * as api from '../api'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HEAT_COLORS = ['#1f2937', '#14532d', '#166534', '#15803d', '#22c55e']
const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

function monthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function Consistency() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const yearOptions = Array.from({ length: 9 }, (_, i) => currentYear - 6 + i)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getWorkoutHeatmap(year, month)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [year, month])

  const gridCells = useMemo(() => {
    if (!data?.month_days?.length) return []

    const first = new Date(year, month - 1, 1)
    const startOffset = (first.getDay() + 6) % 7 // Monday = 0

    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    data.month_days.forEach(day => cells.push(day))

    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [data, year, month])

  function previousMonth() {
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  if (loading) return <div className="loading">Loading consistency…</div>
  if (error) return <div className="error">{error}</div>

  const weeklyMax = Math.max(1, ...(data?.weekly_counts || []).map(w => w.count))

  return (
    <div>
      <div className="page-actions">
        <h1>Consistency</h1>
        <div className="flex-gap">
          <button className="btn-secondary" onClick={previousMonth}>← Prev</button>
          <span className="tag" style={{ minWidth: 170, textAlign: 'center' }}>{monthLabel(year, month)}</span>
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value, 10))}
            style={{ minWidth: 130 }}
          >
            {MONTH_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value, 10))}
            style={{ minWidth: 92 }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={nextMonth}>Next →</button>
        </div>
      </div>

      <div className="summary-stats">
        <div className="stat-card">
          <span className="stat-value">{data.month_total_sessions}</span>
          <span className="stat-label">Sessions this month</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.active_streak}</span>
          <span className="stat-label">Current streak (days)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.best_streak}</span>
          <span className="stat-label">Best streak (days)</span>
        </div>
      </div>

      <div className="card mt-2">
        <h2>Monthly workout heatmap</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Darker green means more sessions on that day.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(32px, 1fr))', gap: 6, maxWidth: 360 }}>
          {WEEKDAYS.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>{day}</div>
          ))}

          {gridCells.map((day, idx) => (
            day ? (
              <div
                key={`${day.date}-${idx}`}
                title={`${day.date}: ${day.count} workout${day.count === 1 ? '' : 's'}`}
                style={{
                  height: 32,
                  borderRadius: 6,
                  background: HEAT_COLORS[Math.max(0, Math.min(4, day.level))],
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  color: day.level >= 2 ? '#fff' : 'var(--muted)',
                  fontWeight: 600,
                }}
              >
                {day.day}
              </div>
            ) : (
              <div key={`empty-${idx}`} style={{ height: 32 }} />
            )
          ))}
        </div>
      </div>

      <div className="card mt-2">
        <h2>Weekly totals (last 12 weeks)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data.weekly_counts || []).map(week => (
            <div key={week.week_start} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 28px', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{week.label}</span>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-input)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(week.count / weeklyMax) * 100}%`,
                    height: '100%',
                    background: 'var(--accent)',
                  }}
                />
              </div>
              <span style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.82rem' }}>{week.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
