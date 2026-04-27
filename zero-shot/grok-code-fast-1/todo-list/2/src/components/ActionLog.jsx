const ActionLog = ({ actionLog }) => {
  return (
    <div data-testid="action-log">
      <h3>Action Log</h3>
      {actionLog.map((action, index) => (
        <div key={index} data-testid="log-entry">
          <span data-testid="log-type">{action.type}</span>
          <span data-testid="log-timestamp">{new Date(action.timestamp).toLocaleString()}</span>
          <span>{action.description}</span>
        </div>
      ))}
    </div>
  );
};

export default ActionLog;