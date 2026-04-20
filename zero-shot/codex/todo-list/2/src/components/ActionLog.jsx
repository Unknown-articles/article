export function ActionLog({ actionLog }) {
  return (
    <section className="action-log" data-testid="action-log">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Action Log</p>
          <h2>Recent changes</h2>
        </div>
      </div>

      {actionLog.length === 0 ? (
        <p className="log-empty">Your task actions will appear here.</p>
      ) : (
        <div className="log-list">
          {actionLog.map((entry) => (
            <article className="log-entry" data-testid="log-entry" key={entry.timestamp + entry.type}>
              <div className="log-topline">
                <strong data-testid="log-type">{entry.type}</strong>
                <time data-testid="log-timestamp" dateTime={entry.timestamp}>
                  {entry.timestamp}
                </time>
              </div>
              <p>{entry.description}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
