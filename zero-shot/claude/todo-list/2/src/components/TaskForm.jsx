import { useRef, useEffect, useState } from 'react'

export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed, date)
    setTitle('')
    setDate('')
    inputRef.current?.focus()
  }

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} className="task-form">
      <input
        ref={inputRef}
        data-testid="task-input"
        className="task-input"
        type="text"
        placeholder="Add a new task..."
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <input
        data-testid="task-date-input"
        className="task-date-input"
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
      />
      <button data-testid="task-submit" type="submit" className="btn btn-primary">
        Add Task
      </button>
    </form>
  )
}
