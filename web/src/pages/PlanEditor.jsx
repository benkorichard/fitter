import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from '../api'

export default function PlanEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [allExercises, setAllExercises] = useState([])
  const [planExercises, setPlanExercises] = useState([])
  const [deletedPeIds, setDeletedPeIds] = useState([])
  const [selectedExId, setSelectedExId] = useState('')
  const [restTime, setRestTime] = useState(60)
  const [schemeType, setSchemeType] = useState('straight')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const exercises = await api.getExercises()
      setAllExercises(exercises)

      if (isEdit) {
        const plan = await api.getPlan(id)
        setName(plan.name)
        setDescription(plan.description || '')
        setRestTime(plan.rest_time || 60)
        setSchemeType(plan.scheme_type || 'straight')
        setPlanExercises(
          plan.plan_exercises.map(pe => ({
            id: pe.id,
            exercise_id: pe.exercise_id,
            exercise: pe.exercise,
            sets: pe.sets,
            reps: pe.reps,
            weight: pe.weight,
            order: pe.order,
          }))
        )
      }
      setLoading(false)
    }
    load()
  }, [id, isEdit])

  function addExercise() {
    const ex = allExercises.find(e => e.id === parseInt(selectedExId))
    if (!ex) return
    if (planExercises.find(pe => pe.exercise_id === ex.id)) return
    setPlanExercises(prev => [
      ...prev,
      {
        exercise_id: ex.id,
        exercise: ex,
        sets: 3,
        reps: 10,
        weight: 0,
        order: prev.length,
      },
    ])
  }

  function removeExercise(index) {
    const pe = planExercises[index]
    if (pe.id) setDeletedPeIds(prev => [...prev, pe.id])
    setPlanExercises(prev => prev.filter((_, i) => i !== index))
  }

  function updateField(index, field, value) {
    setPlanExercises(prev =>
      prev.map((pe, i) =>
        i === index
          ? {
              ...pe,
              [field]: (
                field === 'weight'
                  ? parseFloat(value) || 0
                  : field === 'sets' || field === 'reps' || field === 'order'
                    ? parseInt(value) || 0
                    : value
              ),
            }
          : pe
      )
    )
  }

  async function handleSave() {
    if (!name.trim()) return alert('Session name is required')
    setSaving(true)
    try {
      let planId
      if (isEdit) {
        await api.updatePlan(id, { name, description, rest_time: restTime, scheme_type: schemeType })
        planId = parseInt(id)
      } else {
        const plan = await api.createPlan({ name, description, rest_time: restTime, scheme_type: schemeType })
        planId = plan.id
      }

      for (const peId of deletedPeIds) {
        await api.deletePlanExercise(peId)
      }

      for (let i = 0; i < planExercises.length; i++) {
        const pe = planExercises[i]
        const body = {
          exercise_id: pe.exercise_id,
          sets: pe.sets,
          reps: pe.reps,
          weight: pe.weight,
          order: i,
        }
        if (pe.id) {
          await api.updatePlanExercise(pe.id, body)
        } else {
          await api.addPlanExercise(planId, body)
        }
      }

      navigate('/')
    } catch (e) {
      alert('Error saving: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Loading…</div>

  const availableToAdd = allExercises.filter(
    ex => !planExercises.find(pe => pe.exercise_id === ex.id)
  )

  return (
    <div>
      <h1>{isEdit ? 'Edit Session Template' : 'New Workout Session'}</h1>

      <div className="card">
        <div className="form-group">
          <label htmlFor="plan-name">Session name</label>
          <input
            id="plan-name"
            type="text"
            placeholder="e.g. Upper Body Push"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', maxWidth: 400 }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="plan-desc">Description (optional)</label>
          <textarea
            id="plan-desc"
            placeholder="Short description…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ maxWidth: 400 }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="plan-rest">Rest time between sets (seconds)</label>
          <input
            id="plan-rest"
            type="number"
            min="10"
            step="5"
            value={restTime}
            onChange={e => setRestTime(parseInt(e.target.value) || 60)}
            style={{ width: '100px' }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem', display: 'block' }}>
            {restTime} seconds
          </span>
        </div>
        <div className="form-group">
          <label htmlFor="plan-scheme">Set programming</label>
          <select
            id="plan-scheme"
            value={schemeType}
            onChange={e => setSchemeType(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="straight">Straight sets</option>
            <option value="superset">Supersets (adjacent exercise pairs)</option>
          </select>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem', display: 'block' }}>
            In superset mode, workout auto-switches between adjacent exercise pairs (1-2, 3-4, ...).
          </span>
        </div>
      </div>

      <div className="card mt-2">
        <h2>Exercises</h2>

        {planExercises.length > 0 && (
          <>
            <div className="pe-header">
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Exercise</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center' }}>Sets</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center' }}>Reps</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center' }}>Weight (kg)</span>
              <span />
            </div>
            {planExercises.map((pe, i) => (
              <div className="pe-row" key={i}>
                <div>
                  <div className="pe-name">{pe.exercise.name}</div>
                  {pe.exercise.muscle_group && (
                    <div className="pe-group">{pe.exercise.muscle_group}</div>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  value={pe.sets}
                  onChange={e => updateField(i, 'sets', e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  value={pe.reps}
                  onChange={e => updateField(i, 'reps', e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={pe.weight}
                  onChange={e => updateField(i, 'weight', e.target.value)}
                />
                <button className="btn-icon" title="Remove" onClick={() => removeExercise(i)}>✕</button>
              </div>
            ))}
          </>
        )}

        {availableToAdd.length > 0 ? (
          <div className="pe-add-row">
            <select value={selectedExId} onChange={e => setSelectedExId(e.target.value)}>
              <option value="">Select an exercise…</option>
              {availableToAdd.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}{ex.muscle_group ? ` — ${ex.muscle_group}` : ''}
                </option>
              ))}
            </select>
            <button className="btn-secondary" onClick={addExercise} disabled={!selectedExId}>+ Add</button>
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
            {allExercises.length === 0
              ? 'No exercises in library yet. Go to Exercises to add some.'
              : 'All available exercises have been added.'}
          </p>
        )}
      </div>

      <div className="flex-gap mt-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update Session' : 'Create Session'}
        </button>
        <button className="btn-secondary" onClick={() => navigate('/')}>Cancel</button>
      </div>
    </div>
  )
}
