import { useTodo } from '../TodoContext';

const ActionLog: React.FC = () => {
  const { state } = useTodo();

  return (
    <div data-testid="action-log" className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Action Log</h2>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {state.history.slice().reverse().map((action, index) => (
          <div key={index} data-testid="log-entry" className="flex justify-between items-center p-2 border rounded">
            <div>
              <span data-testid="log-type" className="font-medium">{action.type}</span>
              <span className="ml-2 text-gray-600">{action.description}</span>
            </div>
            <span data-testid="log-timestamp" className="text-sm text-gray-500">
              {new Date(action.timestamp).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionLog;