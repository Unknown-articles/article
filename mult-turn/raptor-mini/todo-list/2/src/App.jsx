import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function isOverdue(task) {
  if (!task.date || task.completed) {
    return false
  }

  const dueDate = new Date(`${task.date}T23:59:59.999`)
  return Date.now() > dueDate.getTime()
}

function TaskManager() {
  const [taskName, setTaskName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [todos, setTodos] = useState([])
  const titleInputRef = useRef(null)

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const enrichedTodos = useMemo(
    () =>
      todos.map((todo) => ({
        ...todo,
        late: isOverdue(todo),
      })),
    [todos],
  )

  const addTodo = (event) => {
    event.preventDefault()
    const trimmedTitle = taskName.trim()
    if (!trimmedTitle) {
      return
    }

    const newTodo = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      completed: false,
      date: deadline,
      createdAt: new Date().toISOString(),
    }

    setTodos((activeTodos) => [newTodo, ...activeTodos])
    setTaskName('')
    setDeadline('')
    titleInputRef.current?.focus()
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="hero-section">
          <p className="eyebrow">Task keeper</p>
          <h1>Keep your workflow easy to manage</h1>
          <p className="hero-copy">
            Add items with due dates, scan your list at a glance, and spot overdue
            entries instantly.
          </p>
        </header>

        <form className="task-form" data-testid="task-form" onSubmit={addTodo}>
          <div className="field-group">
            <label className="field-label" htmlFor="task-title-input">
              Task
            </label>
            <input
              id="task-title-input"
              ref={titleInputRef}
              data-testid="task-input"
              type="text"
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
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
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="text-input"
            />
          </div>

          <button type="submit" data-testid="task-submit" className="submit-button">
            Add item
          </button>
        </form>

        <section className="task-list-panel">
          <div className="task-list-header">
            <h2>Tasks</h2>
            <p>{enrichedTodos.length} item{enrichedTodos.length === 1 ? '' : 's'}</p>
          </div>

          <div className="task-list" data-testid="task-list">
            {enrichedTodos.length === 0 ? (
              <div className="empty-state">No tasks yet. Add one using the form above.</div>
            ) : (
              enrichedTodos.map((todo) => (
                <article
                  key={todo.id}
                  data-testid="task-item"
                  data-task-id={todo.id}
                  data-completed={todo.completed ? 'true' : 'false'}
                  data-late={todo.late ? 'true' : 'false'}
                  className={`task-card ${todo.late ? 'is-late' : ''}`}
                >
                  <div className="task-card-main">
                    <h3 data-testid="task-title" className="task-title">
                      {todo.title}
                    </h3>
                    <div className="task-meta">
                      {todo.date ? `Due ${todo.date}` : 'No due date'}
                    </div>
                  </div>

                  <span className={`task-badge ${todo.late ? 'late' : 'pending'}`}>
                    {todo.late ? 'Late' : 'Pending'}
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

export default TaskManager
