import { useEffect, useState } from 'react'
import * as api from '../api'

const EMPTY = { name: '', muscle_group: '', description: '' }

export default function Exercises() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getExercises().then(setExercises).finally(() => setLoading(false))
  }, [])

  function startEdit(ex) {
    setEditingId(ex.id)
    setForm({ name: ex.name, muscle_group: ex.muscle_group, description: ex.description })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('Exercise name is required')
    setSaving(true)
    try {
      if (editingId) {
        const updated = await api.updateExercise(editingId, form)
        setExercises(prev => prev.map(e => (e.id === editingId ? updated : e)))
      } else {
        const created = await api.createExercise(form)
        setExercises(prev => [...prev, created])
      }
      setForm(EMPTY)
      setEditingId(null)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this exercise? It will be removed from all plans.')) return
    await api.deleteExercise(id)
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <h1>Exercise Library</h1>

      {/* Add / Edit form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>{editingId ? 'Edit Exercise' : 'Add Exercise'}</h2>
        <div className="exercise-form">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Name</label>
            <input
              type="text"
              placeholder="e.g. Bench Press"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Muscle group</label>
            <input
              type="text"
              placeholder="e.g. Chest"
              value={form.muscle_group}
              onChange={e => setForm(f => ({ ...f, muscle_group: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="Notes…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex-gap" style={{ alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '…' : editingId ? 'Update' : 'Add'}
            </button>
            {editingId && (
              <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>
            )}
          </div>
        </div>
      </div>

      {/* Exercise list */}
      {exercises.length === 0 ? (
        <div className="empty">No exercises yet. Add one above to get started.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Muscle group</th>
                <th>Description</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {exercises.map(ex => (
                <tr key={ex.id}>
                  <td style={{ fontWeight: 500 }}>{ex.name}</td>
                  <td>
                    {ex.muscle_group
                      ? <span className="tag">{ex.muscle_group}</span>
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{ex.description || '—'}</td>
                  <td>
                    <div className="flex-gap">
                      <button className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.82rem' }} onClick={() => startEdit(ex)}>
                        Edit
                      </button>
                      <button className="btn-danger" style={{ padding: '0.3rem 0.65rem', fontSize: '0.82rem' }} onClick={() => handleDelete(ex.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
