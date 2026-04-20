import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTasks } from '../context/TaskContext'

function formatDate(dateStr) {
  if (!dateStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Swipe-to-delete hook ─────────────────────────────────────────────────────
function useSwipeDelete(onDelete) {
  const touchStartX = useRef(null)
  const offsetRef = useRef(0)
  const itemRef = useRef(null)
  const [swiped, setSwiped] = useState(false)

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    setSwiped(false)
    offsetRef.current = 0
    if (itemRef.current) itemRef.current.style.transition = 'none'
  }

  function onTouchMove(e) {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    if (dx < 0) {
      offsetRef.current = dx
      if (itemRef.current) itemRef.current.style.transform = `translateX(${dx}px)`
    }
  }

  function onTouchEnd() {
    if (touchStartX.current === null) return
    const dx = offsetRef.current
    if (itemRef.current) itemRef.current.style.transition = ''

    if (dx < -100) {
      setSwiped(true)
      if (itemRef.current) itemRef.current.style.transform = 'translateX(-110%)'
      setTimeout(onDelete, 250)
    } else {
      if (itemRef.current) itemRef.current.style.transform = ''
    }
    touchStartX.current = null
    offsetRef.current = 0
  }

  return { itemRef, swiped, onTouchStart, onTouchMove, onTouchEnd }
}

// ─── Inline Edit ──────────────────────────────────────────────────────────────
function InlineEdit({ task, onDone }) {
  const { editTask } = useTasks()
  const [title, setTitle] = useState(task.title)
  const [date, setDate] = useState(task.date ?? '')

  function save() {
    if (!title.trim()) return
    editTask({ id: task.id, title, date })
    onDone()
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') onDone()
  }

  return (
    <div className="inline-edit" onClick={e => e.stopPropagation()}>
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={onKey}
        autoFocus
        data-testid="inline-edit-input"
      />
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        onKeyDown={onKey}
      />
      <div className="inline-edit-actions">
        <button
          className="btn-primary"
          style={{ padding: '5px 12px', fontSize: '0.85rem' }}
          onClick={save}
          data-testid="inline-edit-save"
        >Save</button>
        <button
          className="btn-secondary"
          style={{ padding: '5px 12px', fontSize: '0.85rem' }}
          onClick={onDone}
          data-testid="inline-edit-cancel"
        >Cancel</button>
      </div>
    </div>
  )
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────
export default function TaskItem({ task }) {
  const { toggleTask, deleteTask } = useTasks()
  const [editing, setEditing] = useState(false)

  const {
    attributes, listeners,
    setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id })

  const swipe = useSwipeDelete(() => deleteTask(task.id))

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div className="task-item-wrapper" ref={swipe.itemRef} data-testid="task-item-wrapper">
      {/* Swipe background (delete indicator) */}
      <div className="task-item-swipe-bg">🗑</div>

      {/* Actual card */}
      <div
        className={`task-item${task.completed ? ' completed' : ''}${task.late ? ' late' : ''}${isDragging ? ' dragging' : ''}`}
        ref={setNodeRef}
        style={style}
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
        data-testid="task-item"
        data-task-id={task.id}
        data-completed={task.completed}
        data-late={task.late}
      >
        {/* Drag handle */}
        <span
          className="drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          data-testid="task-drag-handle"
        >⠿</span>

        {/* Checkbox */}
        <button
          className={`task-checkbox${task.completed ? ' checked' : ''}`}
          onClick={() => toggleTask(task.id)}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          aria-checked={task.completed}
          title={task.completed ? 'Mark incomplete' : 'Mark complete'}
          data-testid="task-checkbox"
        >
          {task.completed && '✓'}
        </button>

        {/* Body */}
        <div className="task-body">
          {editing ? (
            <InlineEdit task={task} onDone={() => setEditing(false)} />
          ) : (
            <>
              <div className="task-title" data-testid="task-title">{task.title}</div>
              {task.date && (
                <div className="task-meta">
                  <span className={`task-date${task.late ? ' late' : ''}`}>
                    📅 {formatDate(task.date)}
                  </span>
                  {task.late && <span className="badge-late" data-testid="badge-late">Late</span>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        {!editing && (
          <div className="task-actions">
            <button
              className="btn-task-action"
              onClick={() => setEditing(true)}
              aria-label="Edit task"
              title="Edit"
              data-testid="task-edit-btn"
            >✏️</button>
            <button
              className="btn-task-action delete"
              onClick={() => deleteTask(task.id)}
              aria-label="Delete task"
              title="Delete"
              data-testid="task-delete-btn"
            >🗑</button>
          </div>
        )}
      </div>
    </div>
  )
}
