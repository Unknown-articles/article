import { useRef, useState } from 'react'
import InlineEditForm from './InlineEditForm'
import { isTaskLate } from '../utils/taskHelpers'

export default function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
  dragHandleProps,
  isDragging,
}) {
  const [editing, setEditing] = useState(false)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const deleted = useRef(false)

  const late = isTaskLate(task)

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    deleted.current = false
  }

  function handleTouchMove(e) {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      e.preventDefault()
    }
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null || deleted.current) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 100) {
      deleted.current = true
      setTimeout(() => onDelete(task.id), 300)
      return
    }

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      onToggle(task.id)
    }
  }

  function handleSave(title, date) {
    onEdit(task.id, title, date)
    setEditing(false)
  }

  const cardClasses = [
    'task-item',
    task.completed ? 'task-completed' : '',
    late ? 'task-late' : '',
    isDragging ? 'task-dragging' : '',
  ].filter(Boolean).join(' ')

  return (
    <li
      className={cardClasses}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={String(task.completed)}
      data-late={String(late)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <span
        data-testid="task-drag-handle"
        className="drag-handle"
        {...dragHandleProps}
        aria-label="Drag to reorder"
      >
        ⠿
      </span>

      <input
        data-testid="task-checkbox"
        type="checkbox"
        className="task-checkbox"
        checked={task.completed}
        onChange={() => onToggle(task.id)}
        aria-checked={String(task.completed)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      />

      {editing ? (
        <InlineEditForm
          task={task}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="task-content">
          <span data-testid="task-title" className="task-title">
            {task.title}
          </span>
          {task.date && (
            <span className="task-date">
              {new Date(task.date + 'T00:00:00').toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {!editing && (
        <div className="task-actions">
          <button
            data-testid="task-edit-btn"
            type="button"
            className="btn btn-icon"
            onClick={() => setEditing(true)}
            aria-label="Edit task"
          >
            ✏️
          </button>
          <button
            data-testid="task-delete-btn"
            type="button"
            className="btn btn-icon btn-danger"
            onClick={() => onDelete(task.id)}
            aria-label="Delete task"
          >
            🗑️
          </button>
        </div>
      )}
    </li>
  )
}
