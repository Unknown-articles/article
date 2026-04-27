export default function ActionLog({ entries }) {
  return (
    <section className="action-log-section">
      <h2 className="action-log-title">Action Log</h2>
      <div data-testid="action-log" className="action-log">
        {entries.length === 0 && <p className="log-empty">No actions yet.</p>}
        {entries.map((entry) => (
          <div key={entry.id} data-testid="log-entry" className="log-entry">
            <span data-testid="log-type" className={`log-type log-type-${entry.type.toLowerCase()}`}>
              {entry.type}
            </span>
            <span className="log-description">{entry.description}</span>
            <span data-testid="log-timestamp" className="log-timestamp">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
