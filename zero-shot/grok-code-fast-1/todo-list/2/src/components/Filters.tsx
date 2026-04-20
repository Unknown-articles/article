import { useTodo } from '../TodoContext';
import { Filter } from '../types';

const Filters: React.FC = () => {
  const { state, dispatch, taskCounts } = useTodo();

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'late', label: 'Late' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          data-testid={`filter-${key}`}
          onClick={() => dispatch({ type: 'SET_FILTER', payload: key })}
          aria-pressed={state.filter === key}
          className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            state.filter === key
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {label} <span data-testid={`filter-count-${key}`}>({taskCounts[key]})</span>
        </button>
      ))}
    </div>
  );
};

export default Filters;