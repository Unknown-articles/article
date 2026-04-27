const TYPE_COLORS = {
  ADD_TASK: '#22c55e',
  EDIT_TASK: '#3b82f6',
  DELETE_TASK: '#ef4444',
  TOGGLE_TASK: '#a855f7',
  REORDER: '#f59e0b',
  SET_FILTER: '#6b7280',
  UNDO: '#ec4899',
  REDO: '#ec4899',
}

export default function ActionLog({ log }) {
  return (
    <div data-testid="action-log" className="action-log">
      <h3 className="log-title">Action Log</h3>
      {log.length === 0 && <p className="log-empty">No actions yet.</p>}
      <ul className="log-list">
        {log.map((entry, i) => (
          <li key={i} data-testid="log-entry" className="log-entry">
            <span
              data-testid="log-type"
              className="log-type"
              style={{ color: TYPE_COLORS[entry.type] ?? '#6b7280' }}
            >
              {entry.type}
            </span>
            <span className="log-description">{entry.description}</span>
            <span data-testid="log-timestamp" className="log-timestamp">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
