import type { ActionLogEntry } from '../types';

interface ActionLogProps {
  log: ActionLogEntry[];
}

export const ActionLog: React.FC<ActionLogProps> = ({ log }) => {
  return (
    <div data-testid="action-log" className="action-log">
      <h3>Action Log</h3>
      {log.map((entry, index) => (
        <div key={index} data-testid="log-entry" className="log-entry">
          <span data-testid="log-type" className="log-type">{entry.type}</span>
          <span className="log-description">{entry.description}</span>
          <span data-testid="log-timestamp" className="log-timestamp">
            {new Date(entry.timestamp).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};