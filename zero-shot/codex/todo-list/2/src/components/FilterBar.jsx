const FILTER_CONFIG = [
  { id: 'all', label: 'All', testId: 'filter-all' },
  { id: 'pending', label: 'Pending', testId: 'filter-pending' },
  { id: 'completed', label: 'Completed', testId: 'filter-completed' },
  { id: 'late', label: 'Late', testId: 'filter-late' },
];

export function FilterBar({ counts, currentFilter, onRedo, onSetFilter, onUndo }) {
  return (
    <section className="filters-panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Filters</p>
          <h2>Focus the list</h2>
        </div>
        <div className="history-actions">
          <button className="secondary-btn history-btn" onClick={onUndo} type="button">
            Undo
          </button>
          <button className="secondary-btn history-btn" onClick={onRedo} type="button">
            Redo
          </button>
        </div>
      </div>

      <div className="filter-row">
        {FILTER_CONFIG.map((filter) => {
          const active = currentFilter === filter.id;

          return (
            <button
              aria-pressed={active ? 'true' : 'false'}
              className={`filter-btn${active ? ' active' : ''}`}
              data-testid={filter.testId}
              key={filter.id}
              onClick={() => onSetFilter(filter.id)}
              type="button"
            >
              <span>{filter.label}</span>
              <span className="filter-count" data-testid={`filter-count-${filter.id}`}>
                {counts[filter.id]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
