import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import './App.css'

// ─── helpers ────────────────────────────────────────────────────────────────

function isPastDue(item) {
  if (!item.date || item.completed) return false
  const due = new Date(item.date + 'T23:59:59')
  return due < new Date()
}

function loadItems() {
  try {
    const raw = localStorage.getItem('todo-items')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function buildRecord(type, description, payload = null) {
  return { type, description, payload, timestamp: new Date().toISOString() }
}

// Reorder within the visible subset while keeping hidden items in their slots.
function repositionFiltered(allItems, visibleItems, fromIdx, toIdx) {
  const reordered = [...visibleItems]
  const [moved] = reordered.splice(fromIdx, 1)
  reordered.splice(toIdx, 0, moved)
  const visibleIds = new Set(visibleItems.map((t) => t.id))
  let vi = 0
  return allItems.map((t) => (visibleIds.has(t.id) ? reordered[vi++] : t))
}

// ─── filter config ──────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { key: 'all',       testid: 'filter-all',       label: 'All',       countTestid: 'filter-count-all' },
  { key: 'pending',   testid: 'filter-pending',    label: 'Pending',   countTestid: 'filter-count-pending' },
  { key: 'completed', testid: 'filter-completed',  label: 'Completed', countTestid: 'filter-count-completed' },
  { key: 'late',      testid: 'filter-late',       label: 'Late',      countTestid: 'filter-count-late' },
]

function passesFilter(item, activeFilter) {
  switch (activeFilter) {
    case 'pending':   return !item.completed && !isPastDue(item)
    case 'completed': return item.completed
    case 'late':      return isPastDue(item)
    default:          return true
  }
}

// ─── TabBar ─────────────────────────────────────────────────────────────────

function TabBar({ activeFilter, totals, onTabChange }) {
  return (
    <div className="tab-bar" role="group" aria-label="Filter tasks">
      {FILTER_OPTIONS.map(({ key, testid, label, countTestid }) => (
        <button
          key={key}
          type="button"
          data-testid={testid}
          aria-pressed={String(activeFilter === key)}
          onClick={() => onTabChange(key)}
          className={`tab-btn${activeFilter === key ? ' active' : ''}`}
        >
          {label}
          <span data-testid={countTestid} className="tab-count">
            {totals[key]}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── EventLog ───────────────────────────────────────────────────────────────

function EventLog({ records }) {
  return (
    <section className="log-panel">
      <h2 className="log-heading">Action Log</h2>
      <ol data-testid="action-log" className="log-list">
        {records.map((entry, i) => (
          <li key={i} data-testid="log-entry" className={`log-row log-kind-${entry.type.toLowerCase()}`}>
            <span data-testid="log-type" className="log-kind">{entry.type}</span>
            <span className="log-text">{entry.description}</span>
            <time data-testid="log-timestamp" className="log-time" dateTime={entry.timestamp}>
              {new Date(entry.timestamp).toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ─── ItemForm ───────────────────────────────────────────────────────────────

function ItemForm({ onCreate }) {
  const nameRef = useRef(null)
  const [inputName, setInputName] = useState('')
  const [inputDate, setInputDate] = useState('')

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const cleanName = inputName.trim()
      if (!cleanName) return
      onCreate({
        id: crypto.randomUUID(),
        title: cleanName,
        completed: false,
        date: inputDate,
        createdAt: new Date().toISOString(),
      })
      setInputName('')
      setInputDate('')
      nameRef.current?.focus()
    },
    [inputName, inputDate, onCreate]
  )

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} className="item-form">
      <input
        ref={nameRef}
        data-testid="task-input"
        type="text"
        placeholder="Task title…"
        value={inputName}
        onChange={(e) => setInputName(e.target.value)}
        className="name-input"
      />
      <input
        data-testid="task-date-input"
        type="date"
        value={inputDate}
        onChange={(e) => setInputDate(e.target.value)}
        className="date-input"
      />
      <button data-testid="task-submit" type="submit" className="add-btn">
        Add
      </button>
    </form>
  )
}

// ─── TitleEditor ─────────────────────────────────────────────────────────────

function TitleEditor({ initialValue, onSave, onCancel }) {
  const [editValue, setEditValue] = useState(initialValue)
  const fieldRef = useRef(null)

  useEffect(() => {
    fieldRef.current?.focus()
    fieldRef.current?.select()
  }, [])

  const confirm = useCallback(() => {
    const cleanValue = editValue.trim()
    if (!cleanValue) return
    onSave(cleanValue)
  }, [editValue, onSave])

  const onKey = useCallback(
    (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirm() }
      if (e.key === 'Escape') onCancel()
    },
    [confirm, onCancel]
  )

  return (
    <>
      <input
        ref={fieldRef}
        data-testid="inline-edit-input"
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={onKey}
        className="edit-input"
      />
      <button
        type="button"
        data-testid="inline-edit-save"
        onClick={confirm}
        className="inline-btn inline-save"
      >
        Save
      </button>
      <button
        type="button"
        data-testid="inline-edit-cancel"
        onClick={onCancel}
        className="inline-btn inline-cancel"
      >
        Cancel
      </button>
    </>
  )
}

// ─── ItemCard ────────────────────────────────────────────────────────────────

// CSS selector matching all interactive controls inside an item card.
const CONTROL_SELECTORS =
  '[data-testid="task-checkbox"],[data-testid="task-edit-btn"],' +
  '[data-testid="task-delete-btn"],[data-testid="task-drag-handle"],' +
  '[data-testid="inline-edit-input"],[data-testid="inline-edit-save"],' +
  '[data-testid="inline-edit-cancel"]'

function ItemCard({
  task, visibleIndex, isDragOver,
  activeEditId, onDragStart, onDragEnter, onDrop, onDragEnd,
  onToggle, onDelete, onEditStart, onEditSave, onEditCancel,
}) {
  const cardRef = useRef(null)
  const pastDue = isPastDue(task)
  const editing = activeEditId === task.id

  // Stable refs so the touch-listener closure never goes stale.
  const removeRef = useRef(onDelete)
  const checkRef  = useRef(onToggle)
  const itemIdRef    = useRef(task.id)
  const activeEditRef = useRef(activeEditId)
  removeRef.current    = onDelete
  checkRef.current     = onToggle
  itemIdRef.current    = task.id
  activeEditRef.current = activeEditId

  // Attach non-passive touchmove listener once (React makes it passive by default).
  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    // Per-gesture session state (null when no active touch).
    let gesture = null

    const handleTouchStart = (e) => {
      // Skip when card is being edited or touch starts on a control.
      if (activeEditRef.current === itemIdRef.current) return
      if (e.touches.length !== 1) return
      if (e.target.closest(CONTROL_SELECTORS)) return
      const t = e.touches[0]
      gesture = { x: t.clientX, y: t.clientY, time: Date.now(), isScroll: false, committed: false }
    }

    const handleTouchMove = (e) => {
      if (!gesture || gesture.isScroll || gesture.committed) return
      const t = e.touches[0]
      const dx = t.clientX - gesture.x
      const dy = t.clientY - gesture.y

      // Vertical movement first → treat as scroll; release all control.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
        gesture.isScroll = true
        card.style.transform = ''
        card.style.opacity = ''
        return
      }

      if (Math.abs(dx) <= 5) return

      // Horizontal swipe confirmed — suppress scroll.
      e.preventDefault()

      // Threshold crossed: animate off-screen and schedule deletion.
      if (Math.abs(dx) > 100) {
        gesture.committed = true
        const dir = dx > 0 ? '120%' : '-120%'
        card.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out'
        card.style.transform = `translateX(${dir})`
        card.style.opacity = '0'
        setTimeout(() => removeRef.current(itemIdRef.current), 250)
        return
      }

      // Visual drag feedback.
      card.style.transform = `translateX(${dx}px)`
      card.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 200))
    }

    const handleTouchEnd = (e) => {
      if (!gesture) return
      const state = gesture
      gesture = null
      if (state.isScroll || state.committed) return

      const t = e.changedTouches[0]
      const dx = t.clientX - state.x
      const dy = t.clientY - state.y
      const dt = Date.now() - state.time

      // Snap back for partial swipes.
      card.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
      card.style.transform = ''
      card.style.opacity = ''
      setTimeout(() => { card.style.transition = '' }, 200)

      // Short tap on card body → toggle complete.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) {
        checkRef.current(itemIdRef.current)
      }
    }

    card.addEventListener('touchstart', handleTouchStart, { passive: true })
    card.addEventListener('touchmove',  handleTouchMove,  { passive: false })
    card.addEventListener('touchend',   handleTouchEnd,   { passive: true })
    return () => {
      card.removeEventListener('touchstart', handleTouchStart)
      card.removeEventListener('touchmove',  handleTouchMove)
      card.removeEventListener('touchend',   handleTouchEnd)
    }
  }, []) // intentionally empty — handlers read live values via refs

  const enableDrag = () => {
    if (!cardRef.current) return
    cardRef.current.draggable = true
    const cleanup = () => {
      if (cardRef.current) cardRef.current.draggable = false
      window.removeEventListener('mouseup', cleanup)
    }
    window.addEventListener('mouseup', cleanup)
  }

  return (
    <li
      ref={cardRef}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={String(task.completed)}
      data-late={String(pastDue)}
      className={`item-card${task.completed ? ' done' : ''}${pastDue ? ' overdue' : ''}${isDragOver ? ' drop-here' : ''}`}
      onDragStart={(e) => onDragStart(e, visibleIndex)}
      onDragEnter={(e) => onDragEnter(e, visibleIndex)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, visibleIndex)}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        data-testid="task-drag-handle"
        onMouseDown={enableDrag}
        aria-label="Drag to reorder"
        className="drag-grip"
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
        className="check-btn"
      >
        <span className={`check-icon${task.completed ? ' ticked' : ''}`} aria-hidden="true" />
      </button>

      {editing ? (
        <TitleEditor
          initialValue={task.title}
          onSave={(newTitle) => onEditSave(task.id, newTitle)}
          onCancel={onEditCancel}
        />
      ) : (
        <>
          <span data-testid="task-title" className="item-label">
            {task.title}
          </span>
          {task.date && (
            <span className="item-due">
              {new Date(task.date + 'T00:00:00').toLocaleDateString()}
              {pastDue && <span className="overdue-badge">Late</span>}
            </span>
          )}
          <button
            type="button"
            data-testid="task-edit-btn"
            onClick={() => onEditStart(task.id)}
            aria-label={`Edit "${task.title}"`}
            className="edit-btn"
          >
            ✎
          </button>
          <button
            type="button"
            data-testid="task-delete-btn"
            onClick={() => onDelete(task.id)}
            aria-label={`Delete "${task.title}"`}
            className="delete-btn"
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
  const [items, setItems] = useState(loadItems)
  const [activeEditId, setActiveEditId] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [records, setRecords] = useState([])

  // Ref mirrors items synchronously so undo/redo callbacks are never stale.
  const itemsRef = useRef(items)

  // History stacks hold { tasks, description } entries.
  const pastStates = useRef([])
  const futureStates = useRef([])

  // Drag state
  const dragSourceIdx = useRef(null)
  const [dropTargetIdx, setDropTargetIdx] = useState(null)
  const visibleItemsRef = useRef([])

  const addRecord = useCallback((entry) => {
    setRecords((prev) => [entry, ...prev])
  }, [])

  // Apply an undoable mutation: prevState → mutate → update stacks → commit.
  const applyChange = useCallback((mutate, description) => {
    const prevState = itemsRef.current
    const next = mutate(prevState)
    pastStates.current = [...pastStates.current, { tasks: prevState, description }]
    futureStates.current = []
    itemsRef.current = next
    setItems(next)
  }, [])

  useEffect(() => {
    localStorage.setItem('todo-items', JSON.stringify(items))
  }, [items])

  // Keep ref in sync after any external set (e.g. undo/redo calls setItems directly).
  useEffect(() => { itemsRef.current = items }, [items])

  const totals = useMemo(() => ({
    all:       items.length,
    pending:   items.filter((t) => !t.completed && !isPastDue(t)).length,
    completed: items.filter((t) => t.completed).length,
    late:      items.filter((t) => isPastDue(t)).length,
  }), [items])

  const visibleItems = useMemo(
    () => items.filter((t) => passesFilter(t, activeFilter)),
    [items, activeFilter]
  )

  // Keep ref current for drag callbacks (avoids stale closure on drop).
  useEffect(() => { visibleItemsRef.current = visibleItems }, [visibleItems])

  const createItem = useCallback((item) => {
    const description = `Added task: ${item.title}`
    applyChange((prev) => [item, ...prev], description)
    addRecord(buildRecord('ADD_TASK', description, item))
  }, [applyChange, addRecord])

  const checkItem = useCallback((id) => {
    const item = itemsRef.current.find((t) => t.id === id)
    const nextCompleted = !item.completed
    const description = `Marked "${item.title}" ${nextCompleted ? 'complete' : 'incomplete'}`
    applyChange(
      (prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
      description
    )
    addRecord(buildRecord('TOGGLE_TASK', description, { id, completed: nextCompleted }))
  }, [applyChange, addRecord])

  const removeItem = useCallback((id) => {
    const item = itemsRef.current.find((t) => t.id === id)
    if (!item) return  // guard: swipe timeout may fire after item was already removed
    const description = `Deleted task: ${item.title}`
    applyChange((prev) => prev.filter((t) => t.id !== id), description)
    addRecord(buildRecord('DELETE_TASK', description, { id, title: item.title }))
    setActiveEditId((prev) => (prev === id ? null : prev))
  }, [applyChange, addRecord])

  const beginEdit = useCallback((id) => {
    setActiveEditId(id)
  }, [])

  const commitEdit = useCallback((id, newTitle) => {
    const oldTitle = itemsRef.current.find((t) => t.id === id)?.title ?? ''
    const description = `Edited task: "${oldTitle}" → "${newTitle}"`
    applyChange(
      (prev) => prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t)),
      description
    )
    addRecord(buildRecord('EDIT_TASK', description, { id, oldTitle, newTitle }))
    setActiveEditId(null)
  }, [applyChange, addRecord])

  const abortEdit = useCallback(() => {
    setActiveEditId(null)
  }, [])

  const onDragBegin = useCallback((e, idx) => {
    dragSourceIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onDragHover = useCallback((e, idx) => {
    e.preventDefault()
    setDropTargetIdx(idx)
  }, [])

  const onDragDrop = useCallback((e, toIdx) => {
    e.preventDefault()
    const fromIdx = dragSourceIdx.current
    dragSourceIdx.current = null
    setDropTargetIdx(null)
    if (fromIdx === null || fromIdx === toIdx) return
    const prevState = visibleItemsRef.current
    const description = 'Reordered tasks'
    applyChange((allItems) => repositionFiltered(allItems, prevState, fromIdx, toIdx), description)
    addRecord(buildRecord('REORDER', description, { fromIndex: fromIdx, toIndex: toIdx }))
  }, [applyChange, addRecord])

  const onDragFinish = useCallback(() => {
    dragSourceIdx.current = null
    setDropTargetIdx(null)
  }, [])

  const onTabChange = useCallback((newFilter) => {
    setActiveFilter(newFilter)
    addRecord(buildRecord('SET_FILTER', `Filter set to: ${newFilter}`, { filter: newFilter }))
  }, [addRecord])

  const undo = useCallback(() => {
    if (pastStates.current.length === 0) return
    const stack = pastStates.current
    const { tasks: prevState, description } = stack[stack.length - 1]
    pastStates.current = stack.slice(0, -1)
    futureStates.current = [{ tasks: itemsRef.current, description }, ...futureStates.current]
    itemsRef.current = prevState
    setItems(prevState)
    addRecord(buildRecord('UNDO', `Undo: ${description}`, null))
  }, [addRecord])

  const redo = useCallback(() => {
    if (futureStates.current.length === 0) return
    const [{ tasks: prevState, description }, ...rest] = futureStates.current
    futureStates.current = rest
    pastStates.current = [...pastStates.current, { tasks: itemsRef.current, description }]
    itemsRef.current = prevState
    setItems(prevState)
    addRecord(buildRecord('REDO', `Redo: ${description}`, null))
  }, [addRecord])

  useEffect(() => {
    const handleKey = (e) => {
      if (!e.ctrlKey) return
      if (e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo() }
      else if (!e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undo, redo])

  return (
    <div className="wrapper">
      <h1 className="page-title">My Tasks</h1>
      <ItemForm onCreate={createItem} />
      <TabBar activeFilter={activeFilter} totals={totals} onTabChange={onTabChange} />
      <ul data-testid="task-list" className="item-list">
        {visibleItems.map((item, idx) => (
          <ItemCard
            key={item.id}
            task={item}
            visibleIndex={idx}
            isDragOver={dropTargetIdx === idx}
            activeEditId={activeEditId}
            onDragStart={onDragBegin}
            onDragEnter={onDragHover}
            onDrop={onDragDrop}
            onDragEnd={onDragFinish}
            onToggle={checkItem}
            onDelete={removeItem}
            onEditStart={beginEdit}
            onEditSave={commitEdit}
            onEditCancel={abortEdit}
          />
        ))}
      </ul>
      <EventLog records={records} />
    </div>
  )
}
