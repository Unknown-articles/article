import { useTasks } from '../context/TaskContext'

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'late',      label: 'Late' },
]

export default function FilterBar() {
  const { filter, setFilter, counts, clearCompleted, tasks } = useTasks()
  const completedCount = counts.completed
  const doneRatio = tasks.length > 0 ? completedCount / tasks.length : 0

  return (
    <>
      <div className="stats-bar">
        <span className="stats-text">
          {completedCount} / {tasks.length} done
        </span>
        <div className="stats-progress">
          <div className="stats-progress-fill" style={{ width: `${doneRatio * 100}%` }} />
        </div>
        {completedCount > 0 && (
          <button className="btn-clear" onClick={clearCompleted} title="Remove all completed tasks">
            Clear done
          </button>
        )}
      </div>
      <nav className="filter-bar" aria-label="Task filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`filter-btn ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            data-testid={`filter-${f.id}`}
          >
            {f.label}
            <span className="count" data-testid={`filter-count-${f.id}`}>{counts[f.id]}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
