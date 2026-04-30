import { useTodo } from '../TodoContext';

export default function ActionLog() {
  const { state } = useTodo();
  const { actionLog } = state;

  if (actionLog.length === 0) return null;

  return (
    <div className="action-log" data-testid="action-log">
      <h2>Action Log</h2>
      <div className="log-entries">
        {actionLog.map(log => (
          <div key={log.id} className="log-entry" data-testid="log-entry">
            <span className="log-type" data-testid="log-type">{log.type}</span>
            <span className="log-desc">{log.description}</span>
            <span className="log-time" data-testid="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
