import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function hasDuePassed(entry) {
  if (!entry.date || entry.completed) {
    return false
  }

  const dueDate = new Date(`${entry.date}T23:59:59.999`)
  return Date.now() > dueDate.getTime()
}

function TaskPlanner() {
  const [itemTitle, setItemTitle] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [entries, setEntries] = useState([])
  const titleInputRef = useRef(null)

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const visibleEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        late: hasDuePassed(entry),
      })),
    [entries],
  )

  const submitEntry = (event) => {
    event.preventDefault()
    const trimmedTitle = itemTitle.trim()
    if (!trimmedTitle) {
      return
    }

    const newEntry = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      completed: false,
      date: dueDay,
      createdAt: new Date().toISOString(),
    }

    setEntries((currentEntries) => [newEntry, ...currentEntries])
    setItemTitle('')
    setDueDay('')
    titleInputRef.current?.focus()
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="hero-section">
          <p className="eyebrow">Schedule planner</p>
          <h1>Track tasks with clarity</h1>
          <p className="hero-copy">
            Build a simple list with deadlines, review upcoming work fast, and see
            overdue items clearly.
          </p>
        </header>

        <form className="task-form" data-testid="task-form" onSubmit={submitEntry}>
          <div className="field-group">
            <label className="field-label" htmlFor="task-title-input">
              Task name
            </label>
            <input
              id="task-title-input"
              ref={titleInputRef}
              data-testid="task-input"
              type="text"
              value={itemTitle}
              onChange={(event) => setItemTitle(event.target.value)}
              placeholder="Enter task name"
              className="text-input"
              autoComplete="off"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="task-date-input">
              Due date
            </label>
            <input
              id="task-date-input"
              data-testid="task-date-input"
              type="date"
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value)}
              className="text-input"
            />
          </div>

          <button type="submit" data-testid="task-submit" className="submit-button">
            Add plan
          </button>
        </form>

        <section className="task-list-panel">
          <div className="task-list-header">
            <h2>Tasks</h2>
            <p>{visibleEntries.length} item{visibleEntries.length === 1 ? '' : 's'}</p>
          </div>

          <div className="task-list" data-testid="task-list">
            {visibleEntries.length === 0 ? (
              <div className="empty-state">No tasks yet. Add one using the form above.</div>
            ) : (
              visibleEntries.map((entry) => (
                <article
                  key={entry.id}
                  data-testid="task-item"
                  data-task-id={entry.id}
                  data-completed={entry.completed ? 'true' : 'false'}
                  data-late={entry.late ? 'true' : 'false'}
                  className={`task-card ${entry.late ? 'is-late' : ''}`}
                >
                  <div className="task-card-main">
                    <h3 data-testid="task-title" className="task-title">
                      {entry.title}
                    </h3>
                    <div className="task-meta">
                      {entry.date ? `Due ${entry.date}` : 'No due date'}
                    </div>
                  </div>

                  <span className={`task-badge ${entry.late ? 'late' : 'pending'}`}>
                    {entry.late ? 'Late' : 'Pending'}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default TaskPlanner
