import { useState, useRef, useEffect } from 'react'
import './App.css'

interface Item {
  id: string
  label: string
  done: boolean
  dueDate: string
  createdAt: string
}

interface RecordEntry {
  type: string
  description: string
  timestamp: string
  payload: any
}

function App() {
  const [items, setItems] = useState<Item[]>([])
  const [label, setLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [currentFilter, setCurrentFilter] = useState<'all' | 'pending' | 'completed' | 'late'>('all')
  const [activityLog, setActivityLog] = useState<RecordEntry[]>([])
  const labelRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const undoHistory = useRef<Item[][]>([])
  const redoHistory = useRef<Item[][]>([])
  const reversibleActions = ['ADD_ITEM', 'EDIT_ITEM', 'DELETE_ITEM', 'TOGGLE_ITEM']
  const [swipeState, setSwipeState] = useState<{ [id: string]: { startX: number, startY: number, startTime: number, isSwipe: boolean } }>({})

  useEffect(() => {
    labelRef.current?.focus()
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('items')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setItems(parsed)
        }
      } catch {
        // invalid, start empty
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('items', JSON.stringify(items))
  }, [items])

  useEffect(() => {
    if (editingItemId) {
      editInputRef.current?.focus()
    }
  }, [editingItemId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        revert()
      } else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        forward()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    saveState()
    const newItem: Item = {
      id: crypto.randomUUID(),
      label: label.trim(),
      done: false,
      dueDate,
      createdAt: new Date().toISOString(),
    }
    setItems(prev => [...prev, newItem])
    logAction('ADD_ITEM', `Added item: ${newItem.label}`, newItem)
    setLabel('')
    setDueDate('')
    labelRef.current?.focus()
  }

  const markDone = (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    saveState()
    const newDone = !item.done
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: newDone } : i))
    logAction('TOGGLE_ITEM', `Toggled item: ${item.label} to ${newDone ? 'done' : 'undone'}`, { id, done: newDone })
  }

  const removeItem = (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    saveState()
    setItems(prev => prev.filter(i => i.id !== id))
    logAction('DELETE_ITEM', `Deleted item: ${item.label}`, { id, label: item.label })
  }

  const changeLabel = (id: string, newLabel: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, label: newLabel } : item))
  }

  const beginEdit = (id: string, currentLabel: string) => {
    setEditingItemId(id)
    setEditLabel(currentLabel)
  }

  const saveChanges = () => {
    if (!editLabel.trim()) return
    const item = items.find(i => i.id === editingItemId)
    if (!item) return
    saveState()
    const newLabel = editLabel.trim()
    changeLabel(editingItemId!, newLabel)
    logAction('EDIT_ITEM', `Edited item: "${item.label}" to "${newLabel}"`, { id: editingItemId, oldLabel: item.label, newLabel })
    setEditingItemId(null)
  }

  const cancelEdit = () => {
    setEditingItemId(null)
  }

  const onKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveChanges()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  const isOverdue = (item: Item) => {
    if (!item.dueDate || item.done) return false
    return new Date(item.dueDate) < new Date()
  }

  const getStats = () => {
    const total = items.length
    const done = items.filter(i => i.done).length
    const overdue = items.filter(i => isOverdue(i)).length
    const pending = total - done - overdue
    return { total, pending, done, overdue }
  }

  const getVisibleItems = () => {
    switch (currentFilter) {
      case 'all': return items
      case 'pending': return items.filter(i => !i.done && !isOverdue(i))
      case 'completed': return items.filter(i => i.done)
      case 'late': return items.filter(i => isOverdue(i))
      default: return items
    }
  }

  const logAction = (type: string, description: string, payload: any) => {
    const entry: RecordEntry = {
      type,
      description,
      timestamp: new Date().toISOString(),
      payload
    }
    setActivityLog(prev => [entry, ...prev])
  }

  const saveState = () => {
    undoHistory.current.push([...items])
    redoHistory.current.length = 0
  }

  const revert = () => {
    if (undoHistory.current.length === 0) return
    const snapshot = undoHistory.current.pop()!
    redoHistory.current.push([...items])
    setItems(snapshot)
    localStorage.setItem('items', JSON.stringify(snapshot))
    const lastReversible = activityLog.find(entry => reversibleActions.includes(entry.type))
    const desc = lastReversible ? lastReversible.description : 'Unknown action'
    logAction('UNDO', `Undo: ${desc}`, null)
  }
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const startDrag = (e: React.DragEvent, item: Item) => {
    if (!(e.target as HTMLElement).closest('[data-testid="item-drag-handle"]')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', item.id)
  }

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const dropItem = (e: React.DragEvent, targetItem: Item) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId === targetItem.id) return
    const visible = getVisibleItems()
    const fromIndex = visible.findIndex(i => i.id === draggedId)
    const toIndex = visible.findIndex(i => i.id === targetItem.id)
    if (fromIndex === -1 || toIndex === -1) return
    const newVisible = [...visible]
    const [removed] = newVisible.splice(fromIndex, 1)
    newVisible.splice(toIndex, 0, removed)
    const visibleIds = visible.map(i => i.id)
    const newVisibleIds = newVisible.map(i => i.id)
    const newItems = [...items].sort((a, b) => {
      const aInVisible = visibleIds.indexOf(a.id)
      const bInVisible = visibleIds.indexOf(b.id)
      if (aInVisible !== -1 && bInVisible !== -1) {
        return newVisibleIds.indexOf(a.id) - newVisibleIds.indexOf(b.id)
      } else if (aInVisible !== -1) {
        return -1
      } else if (bInVisible !== -1) {
        return 1
      } else {
        return 0
      }
    })
    saveState()
    setItems(newItems)
    localStorage.setItem('items', JSON.stringify(newItems))
    logAction('REORDER', 'Reordered items', { fromIndex, toIndex })
  }

  const touchBegin = (e: React.TouchEvent, item: Item) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-testid="item-checkbox"], [data-testid="item-edit-btn"], [data-testid="item-delete-btn"], [data-testid="item-drag-handle"]')) {
      return
    }
    const touch = e.touches[0]
    setSwipeState(prev => ({
      ...prev,
      [item.id]: { startX: touch.clientX, startY: touch.clientY, startTime: Date.now(), isSwipe: false }
    }))
  }

  const touchSlide = (e: React.TouchEvent, item: Item) => {
    const state = swipeState[item.id]
    if (!state) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - state.startX
    const deltaY = touch.clientY - state.startY
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault()
        setSwipeState(prev => ({ ...prev, [item.id]: { ...state, isSwipe: true } }))
      }
    }
  }

  const touchFinish = (e: React.TouchEvent, item: Item) => {
    const state = swipeState[item.id]
    if (!state) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - state.startX
    const deltaY = touch.clientY - state.startY
    const deltaTime = Date.now() - state.startTime
    if (state.isSwipe && Math.abs(deltaX) > 100 && Math.abs(deltaX) > Math.abs(deltaY)) {
      // swipe to delete
      setTimeout(() => {
        saveState()
        setItems(prev => prev.filter(i => i.id !== item.id))
        logAction('DELETE_ITEM', `Deleted item: ${item.label}`, { id: item.id, label: item.label })
      }, 300)
    } else if (!state.isSwipe && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime < 200) {
      // tap to complete
      saveState()
      const newDone = !item.done
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: newDone } : i))
      logAction('TOGGLE_ITEM', `Toggled item: ${item.label} to ${newDone ? 'done' : 'undone'}`, { id: item.id, done: newDone })
    }
    setSwipeState(prev => {
      const newState = { ...prev }
      delete newState[item.id]
      return newState
    })
  }

  const forward = () => {
    if (redoHistory.current.length === 0) return
    const snapshot = redoHistory.current.pop()!
    undoHistory.current.push([...items])
    setItems(snapshot)
    localStorage.setItem('items', JSON.stringify(snapshot))
    const lastReversible = activityLog.find(entry => reversibleActions.includes(entry.type))
    const desc = lastReversible ? lastReversible.description : 'Unknown action'
    logAction('REDO', `Redo: ${desc}`, null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const counts = getCounts()
  const filteredTasks = getFilteredTasks()

  return (
    <div className="app">
      <h1>Todo List</h1>
      <form data-testid="task-form" onSubmit={handleSubmit} className="task-form">
        <input
          data-testid="task-input"
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Enter task title"
          className="task-input"
        />
        <input
          data-testid="task-date-input"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="task-date-input"
        />
        <button data-testid="task-submit" type="submit" className="task-submit">Add Task</button>
      </form>
      <div className="filters">
        <button
          data-testid="filter-all"
          aria-pressed={activeFilter === 'all' ? 'true' : 'false'}
          onClick={() => { setActiveFilter('all'); addLog('SET_FILTER', 'Set filter to all', { filter: 'all' }) }}
          className="filter-btn"
        >
          All <span data-testid="filter-count-all" className="filter-count">{counts.total}</span>
        </button>
        <button
          data-testid="filter-pending"
          aria-pressed={activeFilter === 'pending' ? 'true' : 'false'}
          onClick={() => { setActiveFilter('pending'); addLog('SET_FILTER', 'Set filter to pending', { filter: 'pending' }) }}
          className="filter-btn"
        >
          Pending <span data-testid="filter-count-pending" className="filter-count">{counts.pending}</span>
        </button>
        <button
          data-testid="filter-completed"
          aria-pressed={activeFilter === 'completed' ? 'true' : 'false'}
          onClick={() => { setActiveFilter('completed'); addLog('SET_FILTER', 'Set filter to completed', { filter: 'completed' }) }}
          className="filter-btn"
        >
          Completed <span data-testid="filter-count-completed" className="filter-count">{counts.completed}</span>
        </button>
        <button
          data-testid="filter-late"
          aria-pressed={activeFilter === 'late' ? 'true' : 'false'}
          onClick={() => { setActiveFilter('late'); addLog('SET_FILTER', 'Set filter to late', { filter: 'late' }) }}
          className="filter-btn"
        >
          Late <span data-testid="filter-count-late" className="filter-count">{counts.late}</span>
        </button>
      </div>
      <div data-testid="task-list" className="task-list">
        {filteredTasks.map(task => (
          <div
            key={task.id}
            data-testid="task-item"
            data-task-id={task.id}
            data-completed={task.completed.toString()}
            data-late={isLate(task).toString()}
            className="task-item"
            draggable="true"
            onDragStart={(e) => handleDragStart(e, task)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, task)}
            onTouchStart={(e) => handleTouchStart(e, task)}
            onTouchMove={(e) => handleTouchMove(e, task)}
            onTouchEnd={(e) => handleTouchEnd(e, task)}
          >
            <div data-testid="task-drag-handle" className="task-drag-handle">⋮⋮</div>
            {editingId === task.id ? (
              <div className="inline-edit">
                <input
                  data-testid="inline-edit-input"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  ref={editRef}
                  className="inline-edit-input"
                />
                <button data-testid="inline-edit-save" onClick={handleSave} className="inline-edit-save">Save</button>
                <button data-testid="inline-edit-cancel" onClick={handleCancel} className="inline-edit-cancel">Cancel</button>
              </div>
            ) : (
              <>
                <span data-testid="task-title" className="task-title">{task.title}</span>
                <button data-testid="task-edit-btn" onClick={() => startEdit(task.id, task.title)} className="task-edit-btn">Edit</button>
              </>
            )}
            {task.date && <span className="task-date">Due: {task.date}</span>}
            {isLate(task) && <span className="late">Late</span>}
            <input
              type="checkbox"
              data-testid="task-checkbox"
              checked={task.completed}
              onChange={() => toggleComplete(task.id)}
              aria-checked={task.completed ? 'true' : 'false'}
              aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
              className="task-checkbox"
            />
            <button
              data-testid="task-delete-btn"
              onClick={() => deleteTask(task.id)}
              className="task-delete-btn"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <div data-testid="action-log" className="action-log">
        <h2>Action Log</h2>
        {actionLog.map((entry, index) => (
          <div key={index} data-testid="log-entry" className="log-entry">
            <span data-testid="log-type" className="log-type">{entry.type}</span>
            <span className="log-description">{entry.description}</span>
            <span data-testid="log-timestamp" className="log-timestamp">{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
