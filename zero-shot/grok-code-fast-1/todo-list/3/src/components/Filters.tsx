import type { Filter } from '../types';
import { getFilterCounts } from '../utils';

interface FiltersProps {
  tasks: any[];
  currentFilter: Filter;
  onFilterChange: (filter: Filter) => void;
}

export const Filters: React.FC<FiltersProps> = ({ tasks, currentFilter, onFilterChange }) => {
  const counts = getFilterCounts(tasks);

  const filters: Filter[] = ['all', 'pending', 'completed', 'late'];

  return (
    <div className="filters">
      {filters.map(filter => (
        <button
          key={filter}
          data-testid={`filter-${filter}`}
          aria-pressed={currentFilter === filter}
          onClick={() => onFilterChange(filter)}
          className={currentFilter === filter ? 'active' : ''}
        >
          {filter.charAt(0).toUpperCase() + filter.slice(1)}
          <span data-testid={`filter-count-${filter}`}>{counts[filter]}</span>
        </button>
      ))}
    </div>
  );
};