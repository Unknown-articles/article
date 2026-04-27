const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'late', label: 'Late' },
];

export default function Filters({ current, counts, onSelect }) {
  return (
    <div className="filters">
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          data-testid={`filter-${id}`}
          type="button"
          aria-pressed={String(current === id)}
          onClick={() => onSelect(id)}
          className={`filter-btn ${current === id ? 'filter-active' : ''}`}
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
