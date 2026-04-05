import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from '../api'

export default function ProgramEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [exercise, setExercise] = useState('')
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) {
      api.getProgram(id).then(prog => {
        setName(prog.name)
        setDescription(prog.description || '')
        setExercise(prog.exercise || '')
        setGoal(prog.goal || '')
        setStatus(prog.status || 'active')
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [id, isEdit])

  async function handleSave() {
    if (!name.trim()) return alert('Program name is required')
    setSaving(true)
    try {
      const data = { name, description, exercise, goal, status }
      if (isEdit) {
        await api.updateProgram(id, data)
      } else {
        await api.createProgram(data)
      }
      navigate('/programs')
    } catch (e) {
      alert('Error saving: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <h1>{isEdit ? 'Edit Program' : 'New Training Program'}</h1>

      <div className="card">
        <div className="form-group">
          <label htmlFor="prog-name">Program name</label>
          <input
            id="prog-name"
            type="text"
            placeholder="e.g. Chinup Strength Cycle"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', maxWidth: 400 }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="prog-exercise">Primary exercise</label>
          <input
            id="prog-exercise"
            type="text"
            placeholder="e.g. Weighted Chinup"
            value={exercise}
            onChange={e => setExercise(e.target.value)}
            style={{ width: '100%', maxWidth: 400 }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="prog-goal">Goal</label>
          <input
            id="prog-goal"
            type="text"
            placeholder="e.g. 5x8 @ 50kg"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            style={{ width: '100%', maxWidth: 400 }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="prog-desc">Description (optional)</label>
          <textarea
            id="prog-desc"
            placeholder="Training notes, periodization, etc…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ maxWidth: 400 }}
          />
        </div>

        {isEdit && (
          <div className="form-group">
            <label htmlFor="prog-status">Status</label>
            <select
              id="prog-status"
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ width: '100%', maxWidth: 200 }}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex-gap mt-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update Program' : 'Create Program'}
        </button>
        <button className="btn-secondary" onClick={() => navigate('/programs')}>Cancel</button>
      </div>
    </div>
  )
}
