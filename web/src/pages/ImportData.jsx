import { useState } from 'react'
import * as api from '../api'

export default function ImportData() {
  const [importFile, setImportFile] = useState(null)
  const [clearExisting, setClearExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function runImport(dryRun) {
    if (!importFile) {
      alert('Select a JSON file first.')
      return
    }

    setBusy(true)
    setResult(null)
    try {
      const text = await importFile.text()
      const payload = JSON.parse(text)

      const res = await api.importJsonData(payload, {
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

  const isDryRun = result?.dry_run
  const counts = result ? (isDryRun ? result.would_create : result.created) : null

  return (
    <div>
      <h1>Import Data</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        Import workout JSON exports or exercises-only JSON. Use dry-run first to validate.
      </p>

      <div className="card">
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

        {result && counts && (
          <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
            <p>
              <strong>{isDryRun ? 'Dry-run result' : 'Import result'}:</strong>{' '}
              {result.rows_received || 0} workout rows and {result.exercises_received || 0} exercise entries processed.
            </p>
            <p style={{ color: 'var(--muted)' }}>
              {isDryRun ? 'Would create' : 'Created'}: exercises {counts.exercises}, plans {counts.plans}, programs {counts.programs}, sessions {counts.sessions}, sets {counts.sets}.
            </p>
          </div>
        )}
      </div>

      <div className="card mt-2" style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        <strong>Supported JSON formats:</strong>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
          <li>Workout export rows: <code>{`{ "rows": [...] }`}</code> or raw array of rows</li>
          <li>Exercises-only: <code>{`{ "exercises": [...] }`}</code></li>
          <li>Raw exercise array: <code>{`[{ "name": "Pullup", "muscle_group": "Back" }]`}</code></li>
        </ul>
      </div>
    </div>
  )
}
