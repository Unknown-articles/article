import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import './App.css'

// ─── helpers ────────────────────────────────────────────────────────────────

function isOverdue(todo) {
  if (!todo.date || todo.completed) return false
  const due = new Date(todo.date + 'T23:59:59')
  return due < new Date()
}

function fetchTodos() {
  try {
    const raw = localStorage.getItem('todos-store')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function createEvent(type, description, payload = null) {
  return { type, description, payload, timestamp: new Date().toISOString() }
}

// Reorder within the visible subset while keeping hidden todos in their slots.
function moveWithinView(allTodos, viewTodos, fromIdx, toIdx) {
  const reordered = [...viewTodos]
  const [moved] = reordered.splice(fromIdx, 1)
  reordered.splice(toIdx, 0, moved)
  const viewIds = new Set(viewTodos.map((t) => t.id))
  let vi = 0
  return allTodos.map((t) => (viewIds.has(t.id) ? reordered[vi++] : t))
}

// ─── filter config ──────────────────────────────────────────────────────────

const VIEW_OPTIONS = [
  { key: 'all',       testid: 'filter-all',       label: 'All',       countTestid: 'filter-count-all' },
  { key: 'pending',   testid: 'filter-pending',    label: 'Pending',   countTestid: 'filter-count-pending' },
  { key: 'completed', testid: 'filter-completed',  label: 'Completed', countTestid: 'filter-count-completed' },
  { key: 'late',      testid: 'filter-late',       label: 'Late',      countTestid: 'filter-count-late' },
]

function fitsFilter(todo, currentView) {
  switch (currentView) {
    case 'pending':   return !todo.completed && !isOverdue(todo)
    case 'completed': return todo.completed
    case 'late':      return isOverdue(todo)
    default:          return true
  }
}

// ─── ViewBar ────────────────────────────────────────────────────────────────

function ViewBar({ currentView, stats, onViewChange }) {
  return (
    <div className="view-bar" role="group" aria-label="Filter tasks">
      {VIEW_OPTIONS.map(({ key, testid, label, countTestid }) => (
        <button
          key={key}
          type="button"
          data-testid={testid}
          aria-pressed={String(currentView === key)}
          onClick={() => onViewChange(key)}
          className={`view-btn${currentView === key ? ' active' : ''}`}
        >
          {label}
          <span data-testid={countTestid} className="view-count">
            {stats[key]}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── ActivityFeed ────────────────────────────────────────────────────────────

function ActivityFeed({ events }) {
  return (
    <section className="feed-section">
      <h2 className="feed-title">Action Log</h2>
      <ol data-testid="action-log" className="feed">
        {events.map((entry, i) => (
          <li key={i} data-testid="log-entry" className={`feed-item event-tag-${entry.type.toLowerCase()}`}>
            <span data-testid="log-type" className="event-tag">{entry.type}</span>
            <span className="event-msg">{entry.description}</span>
            <time data-testid="log-timestamp" className="event-ts" dateTime={entry.timestamp}>
              {new Date(entry.timestamp).toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ─── AddForm ────────────────────────────────────────────────────────────────

function AddForm({ onInsert }) {
  const labelRef = useRef(null)
  const [taskName, setTaskName] = useState('')
  const [deadline, setDeadline] = useState('')

  useEffect(() => {
    labelRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const normalized = taskName.trim()
      if (!normalized) return
      onInsert({
        id: crypto.randomUUID(),
        title: normalized,
        completed: false,
        date: deadline,
        createdAt: new Date().toISOString(),
      })
      setTaskName('')
      setDeadline('')
      labelRef.current?.focus()
    },
    [taskName, deadline, onInsert]
  )

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} className="add-form">
      <input
        ref={labelRef}
        data-testid="task-input"
        type="text"
        placeholder="Task title…"
        value={taskName}
        onChange={(e) => setTaskName(e.target.value)}
        className="task-input"
      />
      <input
        data-testid="task-date-input"
        type="date"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
        className="due-input"
      />
      <button data-testid="task-submit" type="submit" className="submit-btn">
        Add
      </button>
    </form>
  )
}

// ─── EditField ────────────────────────────────────────────────────────────────

function EditField({ initialValue, onSave, onCancel }) {
  const [current, setCurrent] = useState(initialValue)
  const inputEl = useRef(null)

  useEffect(() => {
    inputEl.current?.focus()
    inputEl.current?.select()
  }, [])

  const apply = useCallback(() => {
    const normalized = current.trim()
    if (!normalized) return
    onSave(normalized)
  }, [current, onSave])

  const keyHandler = useCallback(
    (e) => {
      if (e.key === 'Enter') { e.preventDefault(); apply() }
      if (e.key === 'Escape') onCancel()
    },
    [apply, onCancel]
  )

  return (
    <>
      <input
        ref={inputEl}
        data-testid="inline-edit-input"
        type="text"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        onKeyDown={keyHandler}
        className="edit-box"
      />
      <button
        type="button"
        data-testid="inline-edit-save"
        onClick={apply}
        className="action-btn action-save"
      >
        Save
      </button>
      <button
        type="button"
        data-testid="inline-edit-cancel"
        onClick={onCancel}
        className="action-btn action-cancel"
      >
        Cancel
      </button>
    </>
  )
}

// ─── TodoRow ─────────────────────────────────────────────────────────────────

// CSS selector matching all interactive controls inside a todo row.
const FOCUSABLE =
  '[data-testid="task-checkbox"],[data-testid="task-edit-btn"],' +
  '[data-testid="task-delete-btn"],[data-testid="task-drag-handle"],' +
  '[data-testid="inline-edit-input"],[data-testid="inline-edit-save"],' +
  '[data-testid="inline-edit-cancel"]'

function TodoRow({
  task, visibleIndex, isDragOver,
  editTarget, onDragStart, onDragEnter, onDrop, onDragEnd,
  onToggle, onDelete, onEditStart, onEditSave, onEditCancel,
}) {
  const rowRef = useRef(null)
  const expired = isOverdue(task)
  const inEdit = editTarget === task.id

  // Stable refs so the touch-listener closure never goes stale.
  const eraseRef = useRef(onDelete)
  const flipRef  = useRef(onToggle)
  const todoIdRef    = useRef(task.id)
  const editTargetRef = useRef(editTarget)
  eraseRef.current    = onDelete
  flipRef.current     = onToggle
  todoIdRef.current   = task.id
  editTargetRef.current = editTarget

  // Attach non-passive touchmove listener once (React makes it passive by default).
  useEffect(() => {
    const row = rowRef.current
    if (!row) return

    // Per-gesture session state (null when no active touch).
    let swipe = null

    const touchBegin = (e) => {
      // Skip when row is being edited or touch starts on a control.
      if (editTargetRef.current === todoIdRef.current) return
      if (e.touches.length !== 1) return
      if (e.target.closest(FOCUSABLE)) return
      const t = e.touches[0]
      swipe = { x: t.clientX, y: t.clientY, time: Date.now(), isScroll: false, committed: false }
    }

    const touchMove = (e) => {
      if (!swipe || swipe.isScroll || swipe.committed) return
      const t = e.touches[0]
      const dx = t.clientX - swipe.x
      const dy = t.clientY - swipe.y

      // Vertical movement first → treat as scroll; release all control.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
        swipe.isScroll = true
        row.style.transform = ''
        row.style.opacity = ''
        return
      }

      if (Math.abs(dx) <= 5) return

      // Horizontal swipe confirmed — suppress scroll.
      e.preventDefault()

      // Threshold crossed: animate off-screen and schedule deletion.
      if (Math.abs(dx) > 100) {
        swipe.committed = true
        const dir = dx > 0 ? '120%' : '-120%'
        row.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out'
        row.style.transform = `translateX(${dir})`
        row.style.opacity = '0'
        setTimeout(() => eraseRef.current(todoIdRef.current), 250)
        return
      }

      // Visual drag feedback.
      row.style.transform = `translateX(${dx}px)`
      row.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 200))
    }

    const touchEnd = (e) => {
      if (!swipe) return
      const state = swipe
      swipe = null
      if (state.isScroll || state.committed) return

      const t = e.changedTouches[0]
      const dx = t.clientX - state.x
      const dy = t.clientY - state.y
      const dt = Date.now() - state.time

      // Snap back for partial swipes.
      row.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
      row.style.transform = ''
      row.style.opacity = ''
      setTimeout(() => { row.style.transition = '' }, 200)

      // Short tap on row body → toggle complete.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) {
        flipRef.current(todoIdRef.current)
      }
    }

    row.addEventListener('touchstart', touchBegin, { passive: true })
    row.addEventListener('touchmove',  touchMove,  { passive: false })
    row.addEventListener('touchend',   touchEnd,   { passive: true })
    return () => {
      row.removeEventListener('touchstart', touchBegin)
      row.removeEventListener('touchmove',  touchMove)
      row.removeEventListener('touchend',   touchEnd)
    }
  }, []) // intentionally empty — handlers read live values via refs

  const allowDrag = () => {
    if (!rowRef.current) return
    rowRef.current.draggable = true
    const cleanup = () => {
      if (rowRef.current) rowRef.current.draggable = false
      window.removeEventListener('mouseup', cleanup)
    }
    window.addEventListener('mouseup', cleanup)
  }

  return (
    <li
      ref={rowRef}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={String(task.completed)}
      data-late={String(expired)}
      className={`todo-item${task.completed ? ' finished' : ''}${expired ? ' expired' : ''}${isDragOver ? ' drag-target' : ''}`}
      onDragStart={(e) => onDragStart(e, visibleIndex)}
      onDragEnter={(e) => onDragEnter(e, visibleIndex)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, visibleIndex)}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        data-testid="task-drag-handle"
        onMouseDown={allowDrag}
        aria-label="Drag to reorder"
        className="handle"
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
        className="toggle"
      >
        <span className={`dot${task.completed ? ' marked' : ''}`} aria-hidden="true" />
      </button>

      {inEdit ? (
        <EditField
          initialValue={task.title}
          onSave={(newTitle) => onEditSave(task.id, newTitle)}
          onCancel={onEditCancel}
        />
      ) : (
        <>
          <span data-testid="task-title" className="todo-title">
            {task.title}
          </span>
          {task.date && (
            <span className="due-date">
              {new Date(task.date + 'T00:00:00').toLocaleDateString()}
              {expired && <span className="late-tag">Late</span>}
            </span>
          )}
          <button
            type="button"
            data-testid="task-edit-btn"
            onClick={() => onEditStart(task.id)}
            aria-label={`Edit "${task.title}"`}
            className="pencil-btn"
          >
            ✎
          </button>
          <button
            type="button"
            data-testid="task-delete-btn"
            onClick={() => onDelete(task.id)}
            aria-label={`Delete "${task.title}"`}
            className="trash-btn"
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
  const [todos, setTodos] = useState(fetchTodos)
  const [editTarget, setEditTarget] = useState(null)
  const [currentView, setCurrentView] = useState('all')
  const [activity, setActivity] = useState([])

  // Ref mirrors todos synchronously so undo/redo callbacks are never stale.
  const todosRef = useRef(todos)

  // History stacks hold { tasks, description } entries.
  const historyBack = useRef([])
  const historyForward = useRef([])

  // Drag state
  const dragOrigin = useRef(null)
  const [dragTarget, setDragTarget] = useState(null)
  const viewRef = useRef([])

  const logEvent = useCallback((entry) => {
    setActivity((prev) => [entry, ...prev])
  }, [])

  // Apply an undoable mutation: before → mutate → update stacks → commit.
  const applyMutation = useCallback((mutate, description) => {
    const before = todosRef.current
    const next = mutate(before)
    historyBack.current = [...historyBack.current, { tasks: before, description }]
    historyForward.current = []
    todosRef.current = next
    setTodos(next)
  }, [])

  useEffect(() => {
    localStorage.setItem('todos-store', JSON.stringify(todos))
  }, [todos])

  // Keep ref in sync after any external set (e.g. undo/redo calls setTodos directly).
  useEffect(() => { todosRef.current = todos }, [todos])

  const stats = useMemo(() => ({
    all:       todos.length,
    pending:   todos.filter((t) => !t.completed && !isOverdue(t)).length,
    completed: todos.filter((t) => t.completed).length,
    late:      todos.filter((t) => isOverdue(t)).length,
  }), [todos])

  const viewTodos = useMemo(
    () => todos.filter((t) => fitsFilter(t, currentView)),
    [todos, currentView]
  )

  // Keep ref current for drag callbacks (avoids stale closure on drop).
  useEffect(() => { viewRef.current = viewTodos }, [viewTodos])

  const insertTodo = useCallback((todo) => {
    const description = `Added task: ${todo.title}`
    applyMutation((prev) => [todo, ...prev], description)
    logEvent(createEvent('ADD_TASK', description, todo))
  }, [applyMutation, logEvent])

  const flipTodo = useCallback((id) => {
    const todo = todosRef.current.find((t) => t.id === id)
    const nextCompleted = !todo.completed
    const description = `Marked "${todo.title}" ${nextCompleted ? 'complete' : 'incomplete'}`
    applyMutation(
      (prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
      description
    )
    logEvent(createEvent('TOGGLE_TASK', description, { id, completed: nextCompleted }))
  }, [applyMutation, logEvent])

  const eraseTodo = useCallback((id) => {
    const todo = todosRef.current.find((t) => t.id === id)
    if (!todo) return  // guard: swipe timeout may fire after todo was already removed
    const description = `Deleted task: ${todo.title}`
    applyMutation((prev) => prev.filter((t) => t.id !== id), description)
    logEvent(createEvent('DELETE_TASK', description, { id, title: todo.title }))
    setEditTarget((prev) => (prev === id ? null : prev))
  }, [applyMutation, logEvent])

  const openEditor = useCallback((id) => {
    setEditTarget(id)
  }, [])

  const storeEdit = useCallback((id, newTitle) => {
    const oldTitle = todosRef.current.find((t) => t.id === id)?.title ?? ''
    const description = `Edited task: "${oldTitle}" → "${newTitle}"`
    applyMutation(
      (prev) => prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t)),
      description
    )
    logEvent(createEvent('EDIT_TASK', description, { id, oldTitle, newTitle }))
    setEditTarget(null)
  }, [applyMutation, logEvent])

  const closeEditor = useCallback(() => {
    setEditTarget(null)
  }, [])

  const startDrag = useCallback((e, idx) => {
    dragOrigin.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const enterDrag = useCallback((e, idx) => {
    e.preventDefault()
    setDragTarget(idx)
  }, [])

  const dropTodo = useCallback((e, toIdx) => {
    e.preventDefault()
    const fromIdx = dragOrigin.current
    dragOrigin.current = null
    setDragTarget(null)
    if (fromIdx === null || fromIdx === toIdx) return
    const before = viewRef.current
    const description = 'Reordered tasks'
    applyMutation((allTodos) => moveWithinView(allTodos, before, fromIdx, toIdx), description)
    logEvent(createEvent('REORDER', description, { fromIndex: fromIdx, toIndex: toIdx }))
  }, [applyMutation, logEvent])

  const endDrag = useCallback(() => {
    dragOrigin.current = null
    setDragTarget(null)
  }, [])

  const changeView = useCallback((newView) => {
    setCurrentView(newView)
    logEvent(createEvent('SET_FILTER', `Filter set to: ${newView}`, { filter: newView }))
  }, [logEvent])

  const undo = useCallback(() => {
    if (historyBack.current.length === 0) return
    const stack = historyBack.current
    const { tasks: before, description } = stack[stack.length - 1]
    historyBack.current = stack.slice(0, -1)
    historyForward.current = [{ tasks: todosRef.current, description }, ...historyForward.current]
    todosRef.current = before
    setTodos(before)
    logEvent(createEvent('UNDO', `Undo: ${description}`, null))
  }, [logEvent])

  const redo = useCallback(() => {
    if (historyForward.current.length === 0) return
    const [{ tasks: before, description }, ...rest] = historyForward.current
    historyForward.current = rest
    historyBack.current = [...historyBack.current, { tasks: todosRef.current, description }]
    todosRef.current = before
    setTodos(before)
    logEvent(createEvent('REDO', `Redo: ${description}`, null))
  }, [logEvent])

  useEffect(() => {
    const keyListener = (e) => {
      if (!e.ctrlKey) return
      if (e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo() }
      else if (!e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', keyListener)
    return () => window.removeEventListener('keydown', keyListener)
  }, [undo, redo])

  return (
    <div className="root">
      <h1 className="board-title">Task Board</h1>
      <AddForm onInsert={insertTodo} />
      <ViewBar currentView={currentView} stats={stats} onViewChange={changeView} />
      <ul data-testid="task-list" className="todo-list">
        {viewTodos.map((todo, idx) => (
          <TodoRow
            key={todo.id}
            task={todo}
            visibleIndex={idx}
            isDragOver={dragTarget === idx}
            editTarget={editTarget}
            onDragStart={startDrag}
            onDragEnter={enterDrag}
            onDrop={dropTodo}
            onDragEnd={endDrag}
            onToggle={flipTodo}
            onDelete={eraseTodo}
            onEditStart={openEditor}
            onEditSave={storeEdit}
            onEditCancel={closeEditor}
          />
        ))}
      </ul>
      <ActivityFeed events={activity} />
    </div>
  )
}
