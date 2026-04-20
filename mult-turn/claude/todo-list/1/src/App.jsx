import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import './App.css'

// ─── helpers ────────────────────────────────────────────────────────────────

function isLate(task) {
  if (!task.date || task.completed) return false
  const due = new Date(task.date + 'T23:59:59')
  return due < new Date()
}

function loadTasks() {
  try {
    const raw = localStorage.getItem('tasks')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function makeEntry(type, description, payload = null) {
  return { type, description, payload, timestamp: new Date().toISOString() }
}

// Reorder within the visible subset while keeping hidden tasks in their slots.
function reorderWithFilter(allTasks, visibleTasks, fromIdx, toIdx) {
  const reordered = [...visibleTasks]
  const [moved] = reordered.splice(fromIdx, 1)
  reordered.splice(toIdx, 0, moved)
  const visibleIds = new Set(visibleTasks.map((t) => t.id))
  let vi = 0
  return allTasks.map((t) => (visibleIds.has(t.id) ? reordered[vi++] : t))
}

// ─── filter config ──────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',       testid: 'filter-all',       label: 'All',       countTestid: 'filter-count-all' },
  { key: 'pending',   testid: 'filter-pending',    label: 'Pending',   countTestid: 'filter-count-pending' },
  { key: 'completed', testid: 'filter-completed',  label: 'Completed', countTestid: 'filter-count-completed' },
  { key: 'late',      testid: 'filter-late',       label: 'Late',      countTestid: 'filter-count-late' },
]

function matchesFilter(task, filter) {
  switch (filter) {
    case 'pending':   return !task.completed && !isLate(task)
    case 'completed': return task.completed
    case 'late':      return isLate(task)
    default:          return true
  }
}

// ─── FilterBar ──────────────────────────────────────────────────────────────

function FilterBar({ filter, counts, onFilterChange }) {
  return (
    <div className="filter-bar" role="group" aria-label="Filter tasks">
      {FILTERS.map(({ key, testid, label, countTestid }) => (
        <button
          key={key}
          type="button"
          data-testid={testid}
          aria-pressed={String(filter === key)}
          onClick={() => onFilterChange(key)}
          className={`btn-filter${filter === key ? ' active' : ''}`}
        >
          {label}
          <span data-testid={countTestid} className="filter-count">
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── ActionLog ──────────────────────────────────────────────────────────────

function ActionLog({ entries }) {
  return (
    <section className="action-log-section">
      <h2 className="action-log-title">Action Log</h2>
      <ol data-testid="action-log" className="action-log">
        {entries.map((entry, i) => (
          <li key={i} data-testid="log-entry" className={`log-entry log-type-${entry.type.toLowerCase()}`}>
            <span data-testid="log-type" className="log-type">{entry.type}</span>
            <span className="log-description">{entry.description}</span>
            <time data-testid="log-timestamp" className="log-timestamp" dateTime={entry.timestamp}>
              {new Date(entry.timestamp).toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ─── TaskForm ───────────────────────────────────────────────────────────────

function TaskForm({ onAdd }) {
  const titleRef = useRef(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const trimmed = title.trim()
      if (!trimmed) return
      onAdd({
        id: crypto.randomUUID(),
        title: trimmed,
        completed: false,
        date,
        createdAt: new Date().toISOString(),
      })
      setTitle('')
      setDate('')
      titleRef.current?.focus()
    },
    [title, date, onAdd]
  )

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} className="task-form">
      <input
        ref={titleRef}
        data-testid="task-input"
        type="text"
        placeholder="Task title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="input-title"
      />
      <input
        data-testid="task-date-input"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="input-date"
      />
      <button data-testid="task-submit" type="submit" className="btn-submit">
        Add
      </button>
    </form>
  )
}

// ─── InlineEditor ────────────────────────────────────────────────────────────

function InlineEditor({ initialValue, onSave, onCancel }) {
  const [draft, setDraft] = useState(initialValue)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const save = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onSave(trimmed)
  }, [draft, onSave])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save() }
      if (e.key === 'Escape') onCancel()
    },
    [save, onCancel]
  )

  return (
    <>
      <input
        ref={inputRef}
        data-testid="inline-edit-input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        className="inline-edit-input"
      />
      <button
        type="button"
        data-testid="inline-edit-save"
        onClick={save}
        className="btn-inline btn-inline-save"
      >
        Save
      </button>
      <button
        type="button"
        data-testid="inline-edit-cancel"
        onClick={onCancel}
        className="btn-inline btn-inline-cancel"
      >
        Cancel
      </button>
    </>
  )
}

// ─── TaskItem ────────────────────────────────────────────────────────────────

// CSS selector matching all interactive controls inside a task card.
const INTERACTIVE =
  '[data-testid="task-checkbox"],[data-testid="task-edit-btn"],' +
  '[data-testid="task-delete-btn"],[data-testid="task-drag-handle"],' +
  '[data-testid="inline-edit-input"],[data-testid="inline-edit-save"],' +
  '[data-testid="inline-edit-cancel"]'

function TaskItem({
  task, visibleIndex, isDragOver,
  editingId, onDragStart, onDragEnter, onDrop, onDragEnd,
  onToggle, onDelete, onEditStart, onEditSave, onEditCancel,
}) {
  const liRef = useRef(null)
  const late = isLate(task)
  const isEditing = editingId === task.id

  // Stable refs so the touch-listener closure never goes stale.
  const onDeleteRef = useRef(onDelete)
  const onToggleRef = useRef(onToggle)
  const taskIdRef   = useRef(task.id)
  const editingIdRef = useRef(editingId)
  onDeleteRef.current  = onDelete
  onToggleRef.current  = onToggle
  taskIdRef.current    = task.id
  editingIdRef.current = editingId

  // Attach non-passive touchmove listener once (React makes it passive by default).
  useEffect(() => {
    const li = liRef.current
    if (!li) return

    // Per-gesture session state (null when no active touch).
    let g = null

    const onTouchStart = (e) => {
      // Skip when card is being edited or touch starts on a control.
      if (editingIdRef.current === taskIdRef.current) return
      if (e.touches.length !== 1) return
      if (e.target.closest(INTERACTIVE)) return
      const t = e.touches[0]
      g = { x: t.clientX, y: t.clientY, time: Date.now(), isScroll: false, committed: false }
    }

    const onTouchMove = (e) => {
      if (!g || g.isScroll || g.committed) return
      const t = e.touches[0]
      const dx = t.clientX - g.x
      const dy = t.clientY - g.y

      // Vertical movement first → treat as scroll; release all control.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
        g.isScroll = true
        li.style.transform = ''
        li.style.opacity = ''
        return
      }

      if (Math.abs(dx) <= 5) return

      // Horizontal swipe confirmed — suppress scroll.
      e.preventDefault()

      // Threshold crossed: animate off-screen and schedule deletion.
      if (Math.abs(dx) > 100) {
        g.committed = true
        const dir = dx > 0 ? '120%' : '-120%'
        li.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out'
        li.style.transform = `translateX(${dir})`
        li.style.opacity = '0'
        setTimeout(() => onDeleteRef.current(taskIdRef.current), 250)
        return
      }

      // Visual drag feedback.
      li.style.transform = `translateX(${dx}px)`
      li.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 200))
    }

    const onTouchEnd = (e) => {
      if (!g) return
      const state = g
      g = null
      if (state.isScroll || state.committed) return

      const t = e.changedTouches[0]
      const dx = t.clientX - state.x
      const dy = t.clientY - state.y
      const dt = Date.now() - state.time

      // Snap back for partial swipes.
      li.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
      li.style.transform = ''
      li.style.opacity = ''
      setTimeout(() => { li.style.transition = '' }, 200)

      // Short tap on card body → toggle complete.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) {
        onToggleRef.current(taskIdRef.current)
      }
    }

    li.addEventListener('touchstart', onTouchStart, { passive: true })
    li.addEventListener('touchmove',  onTouchMove,  { passive: false })
    li.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      li.removeEventListener('touchstart', onTouchStart)
      li.removeEventListener('touchmove',  onTouchMove)
      li.removeEventListener('touchend',   onTouchEnd)
    }
  }, []) // intentionally empty — handlers read live values via refs

  const activateDrag = () => {
    if (!liRef.current) return
    liRef.current.draggable = true
    const cleanup = () => {
      if (liRef.current) liRef.current.draggable = false
      window.removeEventListener('mouseup', cleanup)
    }
    window.addEventListener('mouseup', cleanup)
  }

  return (
    <li
      ref={liRef}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={String(task.completed)}
      data-late={String(late)}
      className={`task-item${task.completed ? ' completed' : ''}${late ? ' late' : ''}${isDragOver ? ' drag-over' : ''}`}
      onDragStart={(e) => onDragStart(e, visibleIndex)}
      onDragEnter={(e) => onDragEnter(e, visibleIndex)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, visibleIndex)}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        data-testid="task-drag-handle"
        onMouseDown={activateDrag}
        aria-label="Drag to reorder"
        className="task-drag-handle"
      >
        ⠿
      </button>

      <button
        type="button"
        data-testid="task-checkbox"
        role="checkbox"
        aria-checked={String(task.completed)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        onClick={() => onToggle(task.id)}
        className="task-checkbox-btn"
      >
        <span className={`checkbox-icon${task.completed ? ' checked' : ''}`} aria-hidden="true" />
      </button>

      {isEditing ? (
        <InlineEditor
          initialValue={task.title}
          onSave={(newTitle) => onEditSave(task.id, newTitle)}
          onCancel={onEditCancel}
        />
      ) : (
        <>
          <span data-testid="task-title" className="task-title">
            {task.title}
          </span>
          {task.date && (
            <span className="task-date">
              {new Date(task.date + 'T00:00:00').toLocaleDateString()}
              {late && <span className="badge-late">Late</span>}
            </span>
          )}
          <button
            type="button"
            data-testid="task-edit-btn"
            onClick={() => onEditStart(task.id)}
            aria-label={`Edit "${task.title}"`}
            className="btn-edit"
          >
            ✎
          </button>
          <button
            type="button"
            data-testid="task-delete-btn"
            onClick={() => onDelete(task.id)}
            aria-label={`Delete "${task.title}"`}
            className="btn-delete"
          >
            ✕
          </button>
        </>
      )}
    </li>
  )
}

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [editingId, setEditingId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [log, setLog] = useState([])

  // Ref mirrors tasks synchronously so undo/redo callbacks are never stale.
  const tasksRef = useRef(tasks)

  // History stacks hold { tasks, description } entries.
  const undoStack = useRef([])
  const redoStack = useRef([])

  // Drag state
  const dragFromIdx = useRef(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const visibleTasksRef = useRef([])

  const pushEntry = useCallback((entry) => {
    setLog((prev) => [entry, ...prev])
  }, [])

  // Apply an undoable mutation: snapshot → mutate → update stacks → commit.
  const applyUndoable = useCallback((mutate, description) => {
    const snapshot = tasksRef.current
    const next = mutate(snapshot)
    undoStack.current = [...undoStack.current, { tasks: snapshot, description }]
    redoStack.current = []
    tasksRef.current = next
    setTasks(next)
  }, [])

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks))
  }, [tasks])

  // Keep ref in sync after any external set (e.g. undo/redo calls setTasks directly).
  useEffect(() => { tasksRef.current = tasks }, [tasks])

  const counts = useMemo(() => ({
    all:       tasks.length,
    pending:   tasks.filter((t) => !t.completed && !isLate(t)).length,
    completed: tasks.filter((t) => t.completed).length,
    late:      tasks.filter((t) => isLate(t)).length,
  }), [tasks])

  const visibleTasks = useMemo(
    () => tasks.filter((t) => matchesFilter(t, filter)),
    [tasks, filter]
  )

  // Keep ref current for drag callbacks (avoids stale closure on drop).
  useEffect(() => { visibleTasksRef.current = visibleTasks }, [visibleTasks])

  const addTask = useCallback((task) => {
    const description = `Added task: ${task.title}`
    applyUndoable((prev) => [task, ...prev], description)
    pushEntry(makeEntry('ADD_TASK', description, task))
  }, [applyUndoable, pushEntry])

  const toggleTask = useCallback((id) => {
    const task = tasksRef.current.find((t) => t.id === id)
    const nextCompleted = !task.completed
    const description = `Marked "${task.title}" ${nextCompleted ? 'complete' : 'incomplete'}`
    applyUndoable(
      (prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
      description
    )
    pushEntry(makeEntry('TOGGLE_TASK', description, { id, completed: nextCompleted }))
  }, [applyUndoable, pushEntry])

  const deleteTask = useCallback((id) => {
    const task = tasksRef.current.find((t) => t.id === id)
    if (!task) return  // guard: swipe timeout may fire after task was already removed
    const description = `Deleted task: ${task.title}`
    applyUndoable((prev) => prev.filter((t) => t.id !== id), description)
    pushEntry(makeEntry('DELETE_TASK', description, { id, title: task.title }))
    setEditingId((prev) => (prev === id ? null : prev))
  }, [applyUndoable, pushEntry])

  const startEdit = useCallback((id) => {
    setEditingId(id)
  }, [])

  const saveEdit = useCallback((id, newTitle) => {
    const oldTitle = tasksRef.current.find((t) => t.id === id)?.title ?? ''
    const description = `Edited task: "${oldTitle}" → "${newTitle}"`
    applyUndoable(
      (prev) => prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t)),
      description
    )
    pushEntry(makeEntry('EDIT_TASK', description, { id, oldTitle, newTitle }))
    setEditingId(null)
  }, [applyUndoable, pushEntry])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  const handleDragStart = useCallback((e, idx) => {
    dragFromIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragEnter = useCallback((e, idx) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }, [])

  const handleDrop = useCallback((e, toIdx) => {
    e.preventDefault()
    const fromIdx = dragFromIdx.current
    dragFromIdx.current = null
    setDragOverIdx(null)
    if (fromIdx === null || fromIdx === toIdx) return
    const snapshot = visibleTasksRef.current
    const description = 'Reordered tasks'
    applyUndoable((allTasks) => reorderWithFilter(allTasks, snapshot, fromIdx, toIdx), description)
    pushEntry(makeEntry('REORDER', description, { fromIndex: fromIdx, toIndex: toIdx }))
  }, [applyUndoable, pushEntry])

  const handleDragEnd = useCallback(() => {
    dragFromIdx.current = null
    setDragOverIdx(null)
  }, [])

  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter)
    pushEntry(makeEntry('SET_FILTER', `Filter set to: ${newFilter}`, { filter: newFilter }))
  }, [pushEntry])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const stack = undoStack.current
    const { tasks: snapshot, description } = stack[stack.length - 1]
    undoStack.current = stack.slice(0, -1)
    redoStack.current = [{ tasks: tasksRef.current, description }, ...redoStack.current]
    tasksRef.current = snapshot
    setTasks(snapshot)
    pushEntry(makeEntry('UNDO', `Undo: ${description}`, null))
  }, [pushEntry])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    const [{ tasks: snapshot, description }, ...rest] = redoStack.current
    redoStack.current = rest
    undoStack.current = [...undoStack.current, { tasks: tasksRef.current, description }]
    tasksRef.current = snapshot
    setTasks(snapshot)
    pushEntry(makeEntry('REDO', `Redo: ${description}`, null))
  }, [pushEntry])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.ctrlKey) return
      if (e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo() }
      else if (!e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  return (
    <div className="app">
      <h1 className="app-title">To-Do List</h1>
      <TaskForm onAdd={addTask} />
      <FilterBar filter={filter} counts={counts} onFilterChange={handleFilterChange} />
      <ul data-testid="task-list" className="task-list">
        {visibleTasks.map((task, idx) => (
          <TaskItem
            key={task.id}
            task={task}
            visibleIndex={idx}
            isDragOver={dragOverIdx === idx}
            editingId={editingId}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onEditStart={startEdit}
            onEditSave={saveEdit}
            onEditCancel={cancelEdit}
          />
        ))}
      </ul>
      <ActionLog entries={log} />
    </div>
  )
}
