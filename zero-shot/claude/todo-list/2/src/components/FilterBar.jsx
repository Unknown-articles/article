const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'late', label: 'Late' },
];

export default function FilterBar({ filter, counts, dispatch }) {
  return (
    <div className="filter-bar" role="group" aria-label="Filter tasks">
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          data-testid={`filter-${id}`}
          aria-pressed={filter === id ? 'true' : 'false'}
          className="filter-btn"
          onClick={() => dispatch({ type: 'SET_FILTER', filter: id })}
        >
          {label}
          <span data-testid={`filter-count-${id}`} className="filter-count">
            {counts[id]}
          </span>
        </button>
      ))}
    </div>
  );
}
