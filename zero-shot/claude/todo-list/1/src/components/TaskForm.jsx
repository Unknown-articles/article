import { useState } from 'react'
import { useTasks } from '../context/TaskContext'

export default function TaskForm() {
  const { addTask } = useTasks()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    addTask({ title, date })
    setTitle('')
    setDate('')
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} data-testid="task-form">
      <input
        type="text"
        placeholder="Add a new task…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
        data-testid="task-input"
      />
      <div className="form-row">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          title="Due date (optional)"
          data-testid="task-date-input"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={!title.trim()}
          data-testid="task-submit"
        >
          Add Task
        </button>
      </div>
    </form>
  )
}
