import React from 'react';
import { useTodo } from '../context/TodoContext.jsx';

export default function ActionLog() {
  const { actionLog } = useTodo();
  return (
    <div className="action-log">
      <h3>Action Log</h3>
      {actionLog.length === 0 && <p className="empty">No actions yet.</p>}
      <ul>
        {actionLog.map((entry, i) => (
          <li key={i} className="log-entry">
            <span className="log-type">{entry.type}</span>
            <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span className="log-payload">{JSON.stringify(entry.payload)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
