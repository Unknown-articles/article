import { useState } from 'react'
import { useTasks } from '../context/TaskContext'

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function ActionLog() {
  const { actionLog } = useTasks()
  const [open, setOpen] = useState(true)

  return (
    <div className="log-panel" data-testid="action-log">
      <div className="log-header" onClick={() => setOpen(o => !o)} role="button" aria-expanded={open} data-testid="log-header">
        <span>Action Log</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {actionLog.length} event{actionLog.length !== 1 ? 's' : ''}
          </span>
          <span>{open ? '▲' : '▼'}</span>
        </span>
      </div>

      {open && (
        <div className="log-entries" role="log" aria-live="polite" aria-label="Action log" data-testid="log-entries">
          {actionLog.length === 0 ? (
            <div className="log-empty">No actions yet.</div>
          ) : (
            actionLog.map(entry => (
              <div key={entry.id} className="log-entry" data-testid="log-entry">
                <span
                  className={`log-type log-type-${entry.type}`}
                  data-testid="log-type"
                >{entry.type}</span>
                <div className="log-info">
                  <div className="log-desc">{entry.description}</div>
                  <div className="log-ts" data-testid="log-timestamp">{formatTime(entry.timestamp)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
