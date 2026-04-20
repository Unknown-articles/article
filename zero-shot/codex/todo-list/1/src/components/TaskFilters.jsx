import { FILTERS } from '../lib/tasks';

const filterOptions = [
  { id: FILTERS.ALL, label: 'All' },
  { id: FILTERS.COMPLETED, label: 'Completed' },
  { id: FILTERS.PENDING, label: 'Pending' },
  { id: FILTERS.LATE, label: 'Late' },
];

export function TaskFilters({ activeFilter, onFilterChange }) {
  return (
    <div className="filter-row" role="tablist" aria-label="Task filters">
      {filterOptions.map((filterOption) => {
        const isActive = filterOption.id === activeFilter;

        return (
          <button
            aria-pressed={isActive}
            className={`filter-chip ${isActive ? 'filter-chip-active' : ''}`}
            key={filterOption.id}
            onClick={() => onFilterChange(filterOption.id)}
            type="button"
          >
            {filterOption.label}
          </button>
        );
      })}
    </div>
  );
}
