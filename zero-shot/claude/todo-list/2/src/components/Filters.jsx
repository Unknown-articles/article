import { isTaskLate } from '../utils/taskHelpers'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'late', label: 'Late' },
]

export default function Filters({ tasks, current, onFilter }) {
  function countFor(filterId) {
    switch (filterId) {
      case 'all': return tasks.length
      case 'pending': return tasks.filter(t => !t.completed).length
      case 'completed': return tasks.filter(t => t.completed).length
      case 'late': return tasks.filter(t => isTaskLate(t)).length
      default: return 0
    }
  }

  return (
    <div className="filters">
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          data-testid={`filter-${id}`}
          type="button"
          className={`btn btn-filter ${current === id ? 'active' : ''}`}
          onClick={() => onFilter(id)}
          aria-pressed={String(current === id)}
        >
          {label}
          <span data-testid={`filter-count-${id}`} className="filter-count">
            {countFor(id)}
          </span>
        </button>
      ))}
    </div>
  )
}
