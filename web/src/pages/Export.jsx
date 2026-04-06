import { useState } from 'react'
import * as api from '../api'

export default function Export() {
  const [importFile, setImportFile] = useState(null)
  const [clearExisting, setClearExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  function download(format) {
    window.location.href = `/api/export/${format}`
  }

  async function runImport(dryRun) {
    if (!importFile) {
      alert('Select a JSON export file first.')
      return
    }

    setBusy(true)
    setResult(null)
    try {
      const text = await importFile.text()
      const payload = JSON.parse(text)
      const rows = Array.isArray(payload) ? payload : payload.rows
      if (!Array.isArray(rows)) {
        throw new Error('Invalid JSON format. Expected an array or { rows: [...] }.')
      }

      const res = await api.importJsonData(rows, {
        dryRun,
        clearExisting,
      })
      setResult(res)
    } catch (e) {
      alert(`Import failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>Export Data</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        Download all your logged workout data for backup or analysis in Excel / Google Sheets.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📊</div>
          <h2>CSV</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Best for Excel, Google Sheets, and data analysis tools.
            Each row is one logged set.
          </p>
          <button className="btn-primary" onClick={() => download('csv')}>
            Download CSV
          </button>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🗂️</div>
          <h2>JSON</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Best for developers or importing into other apps.
            Contains the same data as CSV in structured format.
          </p>
          <button className="btn-primary" onClick={() => download('json')}>
            Download JSON
          </button>
        </div>
      </div>

      <div className="card mt-2" style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        <strong>Exported fields:</strong>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
          <li><code>session_id</code>, <code>session_date</code>, <code>session_notes</code></li>
          <li><code>plan_name</code>, <code>program_name</code></li>
          <li><code>exercise_name</code>, <code>muscle_group</code></li>
          <li><code>set_number</code>, <code>reps_done</code>, <code>weight_used</code>, <code>is_warmup</code></li>
        </ul>
      </div>

      <div className="card mt-2">
        <h2>Import JSON</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Import a previously exported JSON file. Use dry-run first to validate before writing.
        </p>

        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          JSON file
          <input
            type="file"
            accept="application/json,.json"
            onChange={e => setImportFile(e.target.files?.[0] || null)}
            style={{ display: 'block', marginTop: '0.4rem' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={clearExisting}
            onChange={e => setClearExisting(e.target.checked)}
          />
          <span>Clear existing data before import (destructive)</span>
        </label>

        <div className="flex-gap">
          <button className="btn-secondary" onClick={() => runImport(true)} disabled={busy}>
            {busy ? 'Working…' : 'Dry-run validation'}
          </button>
          <button className="btn-primary" onClick={() => runImport(false)} disabled={busy}>
            {busy ? 'Working…' : 'Import now'}
          </button>
        </div>

        {result && (
          <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
            <p><strong>{result.dry_run ? 'Dry-run result' : 'Import result'}:</strong> {result.rows_received} rows processed.</p>
            <p style={{ color: 'var(--muted)' }}>
              {result.dry_run ? 'Would create' : 'Created'}: exercises {result.dry_run ? result.would_create.exercises : result.created.exercises}, plans {result.dry_run ? result.would_create.plans : result.created.plans}, programs {result.dry_run ? result.would_create.programs : result.created.programs}, sessions {result.dry_run ? result.would_create.sessions : result.created.sessions}, sets {result.dry_run ? result.would_create.sets : result.created.sets}.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
