import { useState } from 'react';

export default function ActionLog({ log }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div data-testid="action-log" className="action-log">
      <div
        className="action-log-header"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setCollapsed((c) => !c)}
      >
        Action Log ({log.length})
        <span className="log-toggle">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="log-entries">
          {log.map((entry, i) => (
            <div key={i} data-testid="log-entry" className="log-entry">
              <span data-testid="log-type" className="log-type">
                {entry.type}
              </span>
              <span className="log-description">{entry.description}</span>
              <span data-testid="log-timestamp" className="log-timestamp">
                {entry.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
