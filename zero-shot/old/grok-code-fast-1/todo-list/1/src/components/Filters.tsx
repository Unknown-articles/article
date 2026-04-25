import { Filter } from '../types';

interface Props {
  currentFilter: Filter;
  onFilterChange: (filter: Filter) => void;
}

export function Filters({ currentFilter, onFilterChange }: Props) {
  return (
    <div className="filters">
      {(['all', 'completed', 'pending', 'late'] as Filter[]).map(filter => (
        <button
          key={filter}
          className={currentFilter === filter ? 'active' : ''}
          onClick={() => onFilterChange(filter)}
        >
          {filter.charAt(0).toUpperCase() + filter.slice(1)}
        </button>
      ))}
    </div>
  );
}