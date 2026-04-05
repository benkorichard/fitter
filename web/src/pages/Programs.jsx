import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../api'

export default function Programs() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.getPrograms().then(setPrograms).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this program?')) return
    await api.deleteProgram(id)
    setPrograms(prev => prev.filter(p => p.id !== id))
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString()
  }

  if (loading) return <div className="loading">Loading programs…</div>

  return (
    <div>
      <div className="page-actions">
        <h1>Training Programs</h1>
        <Link to="/programs/new">
          <button className="btn-primary">+ New Program</button>
        </Link>
      </div>

      {programs.length === 0 && (
        <div className="empty">No programs yet. Create your first training program to start tracking progress.</div>
      )}

      {programs.map(prog => (
        <div key={prog.id} className="plan-card">
          <div className="plan-card-info">
            <h2>{prog.name}</h2>
            {prog.description && <p>{prog.description}</p>}
            <p className="plan-card-meta">
              {prog.exercise && <span>Exercise: <strong>{prog.exercise}</strong></span>}
              {prog.goal && <span> — Goal: <strong>{prog.goal}</strong></span>}
            </p>
            <p className="plan-card-meta" style={{ marginTop: '0.25rem' }}>
              Started {formatDate(prog.created_at)} — Status: <span style={{ textTransform: 'capitalize' }}>{prog.status}</span>
            </p>
          </div>
          <div className="plan-card-actions">
            <button className="btn-secondary" onClick={() => navigate(`/programs/${prog.id}/progress`)}>
              View Progress
            </button>
            <Link to={`/programs/${prog.id}/edit`}>
              <button className="btn-secondary">Edit</button>
            </Link>
            <button className="btn-danger" onClick={() => handleDelete(prog.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
