import React from 'react';

export default function ActionLog({ actions }) {
  return (
    <div className="action-log glass-panel" data-testid="action-log">
      <h3 className="section-title">Activity Log</h3>
      <div className="log-entries">
        {actions.length === 0 ? (
          <div className="log-empty">No actions recorded yet.</div>
        ) : (
          actions.map((action, index) => (
            <div key={index} className="log-entry" data-testid="log-entry">
              <div className="log-header">
                <span className={`log-type type-${action.type.toLowerCase()}`} data-testid="log-type">
                  {action.type}
                </span>
                <span className="log-timestamp" data-testid="log-timestamp">
                  {action.timestamp}
                </span>
              </div>
              <div className="log-desc">
                {action.description}
              </div>
              {action.payload && (
                <div className="log-payload">
                  {JSON.stringify(action.payload)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
