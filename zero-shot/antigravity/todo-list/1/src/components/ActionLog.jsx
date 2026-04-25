import React, { useContext } from 'react';
import { TodoContext } from '../App';
import { Activity } from 'lucide-react';

export default function ActionLog() {
  const { state } = useContext(TodoContext);
  const { actionLog } = state;

  return (
    <div className="action-log-container" data-testid="action-log">
      <div className="action-log-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} /> Action Log
        </span>
        <span className="filter-count" style={{ background: 'var(--primary)', color: 'white' }}>
          {actionLog.length}
        </span>
      </div>
      <div className="action-log-list">
        {actionLog.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
            No actions recorded yet.
          </div>
        ) : (
          actionLog.map((log, index) => (
            <div key={index} className="log-entry" data-testid="log-entry">
              <div className="log-entry-header">
                <span className="log-type" data-testid="log-type">{log.type}</span>
                <span className="log-timestamp" data-testid="log-timestamp">{log.timestamp}</span>
              </div>
              <div className="log-desc">{log.description}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
