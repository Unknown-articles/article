import { Clock } from 'lucide-react';
import { format } from 'date-fns';

export function ActionLog({ log }) {
  return (
    <div className="action-log-container" data-testid="action-log">
      <div className="action-log-header">
        Action Log
        <Clock size={20} className="text-secondary" />
      </div>
      <div className="action-log-list">
        {log.map((entry) => (
          <div key={entry.id} className="log-entry" data-testid="log-entry">
            <span className="log-type" data-testid="log-type">{entry.type}</span>
            <div className="log-desc">{entry.description}</div>
            <div className="log-time" data-testid="log-timestamp">
              {entry.timestamp}
            </div>
          </div>
        ))}
        {log.length === 0 && (
          <div className="text-secondary" style={{ textAlign: 'center', marginTop: '2rem' }}>
            No actions recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
