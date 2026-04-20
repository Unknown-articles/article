import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function isTaskLate(task) {
  if (!task.date || task.completed) {
    return false
  }

  const dueDate = new Date(`${task.date}T23:59:59.999`)
  return Date.now() > dueDate.getTime()
}

function App() {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [tasks, setTasks] = useState([])
  const titleInputRef = useRef(null)

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const taskList = useMemo(
    () =>
      tasks.map((task) => ({
        ...task,
        late: isTaskLate(task),
      })),
    [tasks],
  )

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return
    }

    const newTask = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      completed: false,
      date,
      createdAt: new Date().toISOString(),
    }

    setTasks((currentTasks) => [newTask, ...currentTasks])
    setTitle('')
    setDate('')
    titleInputRef.current?.focus()
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="hero-section">
          <p className="eyebrow">Task manager</p>
          <h1>Keep tasks visible and on time</h1>
          <p className="hero-copy">
            Add tasks with due dates, review your list quickly, and spot late items
            at a glance.
          </p>
        </header>

        <form className="task-form" data-testid="task-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="task-title-input">
              Title
            </label>
            <input
              id="task-title-input"
              ref={titleInputRef}
              data-testid="task-input"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter task title"
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
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="text-input"
            />
          </div>

          <button type="submit" data-testid="task-submit" className="submit-button">
            Add task
          </button>
        </form>

        <section className="task-list-panel">
          <div className="task-list-header">
            <h2>Tasks</h2>
            <p>{taskList.length} item{taskList.length === 1 ? '' : 's'}</p>
          </div>

          <div className="task-list" data-testid="task-list">
            {taskList.length === 0 ? (
              <div className="empty-state">No tasks yet. Add one using the form above.</div>
            ) : (
              taskList.map((task) => (
                <article
                  key={task.id}
                  data-testid="task-item"
                  data-task-id={task.id}
                  data-completed={task.completed ? 'true' : 'false'}
                  data-late={task.late ? 'true' : 'false'}
                  className={`task-card ${task.late ? 'is-late' : ''}`}
                >
                  <div className="task-card-main">
                    <h3 data-testid="task-title" className="task-title">
                      {task.title}
                    </h3>
                    <div className="task-meta">
                      {task.date ? `Due ${task.date}` : 'No due date'}
                    </div>
                  </div>

                  <span className={`task-badge ${task.late ? 'late' : 'pending'}`}>
                    {task.late ? 'Late' : 'Pending'}
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

export default App
