import { useState, useRef, useEffect } from 'react'
import './App.css'

interface Task {
  id: string
  title: string
  completed: boolean
  date: string
  createdAt: string
}

interface LogEntry {
  type: string
  description: string
  timestamp: string
  payload: any
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed' | 'late'>('all')
  const [actionLog, setActionLog] = useState<LogEntry[]>([])
  const titleRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const undoStack = useRef<Task[][]>([])
  const redoStack = useRef<Task[][]>([])
  const undoableTypes = ['ADD_TASK', 'EDIT_TASK', 'DELETE_TASK', 'TOGGLE_TASK']
  const [touchState, setTouchState] = useState<{ [id: string]: { startX: number, startY: number, startTime: number, isSwipe: boolean } }>({})

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('tasks')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setTasks(parsed)
        }
      } catch {
        // invalid, start empty
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    if (editingId) {
      editRef.current?.focus()
    }
  }, [editingId])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    pushHistory()
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      date,
      createdAt: new Date().toISOString(),
    }
    setTasks(prev => [...prev, newTask])
    addLog('ADD_TASK', `Added task: ${newTask.title}`, newTask)
    setTitle('')
    setDate('')
    titleRef.current?.focus()
  }

  const toggleComplete = (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    pushHistory()
    const newCompleted = !task.completed
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted } : t))
    addLog('TOGGLE_TASK', `Toggled task: ${task.title} to ${newCompleted ? 'completed' : 'incomplete'}`, { id, completed: newCompleted })
  }

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    pushHistory()
    setTasks(prev => prev.filter(t => t.id !== id))
    addLog('DELETE_TASK', `Deleted task: ${task.title}`, { id, title: task.title })
  }

  const updateTitle = (id: string, newTitle: string) => {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, title: newTitle } : task))
  }

  const startEdit = (id: string, currentTitle: string) => {
    setEditingId(id)
    setEditTitle(currentTitle)
  }

  const handleSave = () => {
    if (!editTitle.trim()) return
    const task = tasks.find(t => t.id === editingId)
    if (!task) return
    pushHistory()
    const newTitle = editTitle.trim()
    updateTitle(editingId!, newTitle)
    addLog('EDIT_TASK', `Edited task: "${task.title}" to "${newTitle}"`, { id: editingId, oldTitle: task.title, newTitle })
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const isLate = (task: Task) => {
    if (!task.date || task.completed) return false
    return new Date(task.date) < new Date()
  }

  const getCounts = () => {
    const total = tasks.length
    const completed = tasks.filter(t => t.completed).length
    const late = tasks.filter(t => isLate(t)).length
    const pending = total - completed - late
    return { total, pending, completed, late }
  }

  const getFilteredTasks = () => {
    switch (activeFilter) {
      case 'all': return tasks
      case 'pending': return tasks.filter(t => !t.completed && !isLate(t))
      case 'completed': return tasks.filter(t => t.completed)
      case 'late': return tasks.filter(t => isLate(t))
      default: return tasks
    }
  }

  const addLog = (type: string, description: string, payload: any) => {
    const entry: LogEntry = {
      type,
      description,
      timestamp: new Date().toISOString(),
      payload
    }
    setActionLog(prev => [entry, ...prev])
  }

  const pushHistory = () => {
    undoStack.current.push([...tasks])
    redoStack.current.length = 0
  }

  const undo = () => {
    if (undoStack.current.length === 0) return
    const snapshot = undoStack.current.pop()!
    redoStack.current.push([...tasks])
    setTasks(snapshot)
    localStorage.setItem('tasks', JSON.stringify(snapshot))
    const lastUndoable = actionLog.find(entry => undoableTypes.includes(entry.type))
    const desc = lastUndoable ? lastUndoable.description : 'Unknown action'
    addLog('UNDO', `Undo: ${desc}`, null)
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
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (!(e.target as HTMLElement).closest('[data-testid="task-drag-handle"]')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', task.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId === targetTask.id) return
    const filtered = getFilteredTasks()
    const fromIndex = filtered.findIndex(t => t.id === draggedId)
    const toIndex = filtered.findIndex(t => t.id === targetTask.id)
    if (fromIndex === -1 || toIndex === -1) return
    const newFiltered = [...filtered]
    const [removed] = newFiltered.splice(fromIndex, 1)
    newFiltered.splice(toIndex, 0, removed)
    const filteredIds = filtered.map(t => t.id)
    const newFilteredIds = newFiltered.map(t => t.id)
    const newTasks = [...tasks].sort((a, b) => {
      const aInFiltered = filteredIds.indexOf(a.id)
      const bInFiltered = filteredIds.indexOf(b.id)
      if (aInFiltered !== -1 && bInFiltered !== -1) {
        return newFilteredIds.indexOf(a.id) - newFilteredIds.indexOf(b.id)
      } else if (aInFiltered !== -1) {
        return -1
      } else if (bInFiltered !== -1) {
        return 1
      } else {
        return 0
      }
    })
    pushHistory()
    setTasks(newTasks)
    localStorage.setItem('tasks', JSON.stringify(newTasks))
    addLog('REORDER', 'Reordered tasks', { fromIndex, toIndex })
  }

  const handleTouchStart = (e: React.TouchEvent, task: Task) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-testid="task-checkbox"], [data-testid="task-edit-btn"], [data-testid="task-delete-btn"], [data-testid="task-drag-handle"]')) {
      return
    }
    const touch = e.touches[0]
    setTouchState(prev => ({
      ...prev,
      [task.id]: { startX: touch.clientX, startY: touch.clientY, startTime: Date.now(), isSwipe: false }
    }))
  }

  const handleTouchMove = (e: React.TouchEvent, task: Task) => {
    const state = touchState[task.id]
    if (!state) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - state.startX
    const deltaY = touch.clientY - state.startY
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault()
        setTouchState(prev => ({ ...prev, [task.id]: { ...state, isSwipe: true } }))
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent, task: Task) => {
    const state = touchState[task.id]
    if (!state) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - state.startX
    const deltaY = touch.clientY - state.startY
    const deltaTime = Date.now() - state.startTime
    if (state.isSwipe && Math.abs(deltaX) > 100 && Math.abs(deltaX) > Math.abs(deltaY)) {
      // swipe to delete
      setTimeout(() => {
        pushHistory()
        setTasks(prev => prev.filter(t => t.id !== task.id))
        addLog('DELETE_TASK', `Deleted task: ${task.title}`, { id: task.id, title: task.title })
      }, 300)
    } else if (!state.isSwipe && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime < 200) {
      // tap to complete
      pushHistory()
      const newCompleted = !task.completed
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted } : t))
      addLog('TOGGLE_TASK', `Toggled task: ${task.title} to ${newCompleted ? 'completed' : 'incomplete'}`, { id: task.id, completed: newCompleted })
    }
    setTouchState(prev => {
      const newState = { ...prev }
      delete newState[task.id]
      return newState
    })
  }

  const redo = () => {
    if (redoStack.current.length === 0) return
    const snapshot = redoStack.current.pop()!
    undoStack.current.push([...tasks])
    setTasks(snapshot)
    localStorage.setItem('tasks', JSON.stringify(snapshot))
    const lastUndoable = actionLog.find(entry => undoableTypes.includes(entry.type))
    const desc = lastUndoable ? lastUndoable.description : 'Unknown action'
    addLog('REDO', `Redo: ${desc}`, null)
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
