export default function Export() {
  function download(format) {
    window.location.href = `/api/export/${format}`
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
    </div>
  )
}
