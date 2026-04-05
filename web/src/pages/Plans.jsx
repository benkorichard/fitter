import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../api'

export default function Plans() {
  const [plans, setPlans] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selectedProgram, setSelectedProgram] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.getPlans(), api.getPrograms()])
      .then(([plansData, programsData]) => {
        setPlans(plansData)
        setPrograms(programsData.filter(p => p.status === 'active'))
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this plan?')) return
    await api.deletePlan(id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  function startWorkout(planId) {
    setSelectedPlan(planId)
    if (programs.length === 0) {
      navigate(`/workout/${planId}`)
    }
  }

  function confirmStart() {
    navigate(`/workout/${selectedPlan}?program=${selectedProgram || ''}`)
    setSelectedPlan(null)
    setSelectedProgram(null)
  }

  if (loading) return <div className="loading">Loading plans…</div>

  const showModal = selectedPlan !== null && programs.length > 0

  return (
    <div>
      <div className="page-actions">
        <h1>Workout Sessions</h1>
        <Link to="/plans/new">
          <button className="btn-primary">+ New Session</button>
        </Link>
      </div>

      {plans.length === 0 && (
        <div className="empty">No sessions yet. Create your first workout session template to get started.</div>
      )}

      {plans.map(plan => (
        <div key={plan.id} className="plan-card">
          <div className="plan-card-info">
            <h2>{plan.name}</h2>
            {plan.description && <p>{plan.description}</p>}
            <p className="plan-card-meta">
              {plan.plan_exercises.length} exercise{plan.plan_exercises.length !== 1 ? 's' : ''}
              {plan.plan_exercises.length > 0 && (
                <> — {plan.plan_exercises.map(pe => pe.exercise.name).join(', ')}</>
              )}
            </p>
          </div>
          <div className="plan-card-actions">
            <button
              className="btn-primary"
              onClick={() => startWorkout(plan.id)}
              disabled={plan.plan_exercises.length === 0}
            >
              ▶ Start
            </button>
            <Link to={`/plans/${plan.id}/edit`}>
              <button className="btn-secondary">Edit</button>
            </Link>
            <button className="btn-danger" onClick={() => handleDelete(plan.id)}>Delete</button>
          </div>
        </div>
      ))}

      {/* Modal: Select program */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '2rem',
            maxWidth: 400,
          }}>
            <h2 style={{ marginBottom: '1rem' }}>Track for program?</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Link this session to a training program to track long-term progress.
            </p>
            <div className="form-group">
              <select
                value={selectedProgram || ''}
                onChange={e => setSelectedProgram(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">None (skip tracking)</option>
                {programs.map(prog => (
                  <option key={prog.id} value={prog.id}>{prog.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-gap">
              <button className="btn-primary" onClick={confirmStart}>Start Workout</button>
              <button className="btn-secondary" onClick={() => setSelectedPlan(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
