import { useRef, useEffect, useState } from 'react'

export default function InlineEditForm({ task, onSave, onCancel }) {
  const [title, setTitle] = useState(task.title)
  const [date, setDate] = useState(task.date || '')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  function save() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave(trimmed, date)
  }

  return (
    <div className="inline-edit-form">
      <input
        ref={inputRef}
        data-testid="inline-edit-input"
        className="task-input inline-input"
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        className="task-date-input inline-date"
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="inline-edit-actions">
        <button
          data-testid="inline-edit-save"
          type="button"
          className="btn btn-primary btn-sm"
          onClick={save}
        >
          Save
        </button>
        <button
          data-testid="inline-edit-cancel"
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
