function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function ActionLog({ actions }) {
  return (
    <aside className="panel action-log-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Action log</p>
          <h2>Timeline of state changes</h2>
        </div>
      </div>
      {!actions.length ? (
        <div className="log-empty-state">
          <p>Actions will appear here as you create, update, and organize tasks.</p>
        </div>
      ) : (
        <div className="action-log-list">
          {actions.map((action) => (
            <article className="action-log-item" key={action.id}>
              <div className="action-log-meta">
                <strong>{action.type}</strong>
                <span>{formatTimestamp(action.timestamp)}</span>
              </div>
              {action.payload ? (
                <pre>{JSON.stringify(action.payload, null, 2)}</pre>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
