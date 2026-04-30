import { useTodo, SET_FILTER } from '../TodoContext';

export default function Filters() {
  const { state, dispatch } = useTodo();
  const { filter, tasks } = state;

  const counts = {
    ALL: tasks.length,
    COMPLETED: tasks.filter(t => t.completed).length,
    PENDING: tasks.filter(t => !t.completed).length,
    LATE: tasks.filter(t => !t.completed && t.date && new Date(t.date) < new Date(new Date().setHours(0, 0, 0, 0))).length,
  };

  const filters = [
    { id: 'ALL', label: 'All', testId: 'filter-all' },
    { id: 'PENDING', label: 'Pending', testId: 'filter-pending' },
    { id: 'COMPLETED', label: 'Completed', testId: 'filter-completed' },
    { id: 'LATE', label: 'Late', testId: 'filter-late' },
  ];

  return (
    <div className="filters">
      {filters.map(f => (
        <button
          key={f.id}
          className={`filter-btn ${filter === f.id ? 'active' : ''}`}
          onClick={() => dispatch({ type: SET_FILTER, payload: { filter: f.id } })}
          data-testid={f.testId}
          aria-pressed={filter === f.id}
        >
          {f.label}
          <span className="filter-count" data-testid={`filter-count-${f.id.toLowerCase()}`}>
            {counts[f.id]}
          </span>
        </button>
      ))}
    </div>
  );
}
