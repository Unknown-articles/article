import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLate(task) {
  if (!task.date || task.completed) return false
  const due = new Date(task.date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

function logEntry(type, description, payload = null) {
  return { id: uuidv4(), type, description, payload, timestamp: new Date().toISOString() }
}

const STORAGE_KEY = 'tasks'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveToStorage(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {}
}

// ─── Initial State ─────────────────────────────────────────────────────────

const saved = loadFromStorage()

const initialState = {
  tasks: saved ?? [],
  filter: 'all',
  actionLog: [],
  past: [],    // undo history (array of task arrays)
  future: [],  // redo stack
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'ADD_TASK': {
      const task = {
        id: uuidv4(),
        title: action.payload.title.trim(),
        completed: false,
        date: action.payload.date || null,
        createdAt: new Date().toISOString(),
      }
      const tasks = [task, ...state.tasks]
      return {
        ...state,
        tasks,
        past: [...state.past, state.tasks],
        future: [],
        actionLog: [
          logEntry('ADD_TASK', `Added "${task.title}"`, { id: task.id, title: task.title }),
          ...state.actionLog,
        ],
      }
    }

    case 'DELETE_TASK': {
      const target = state.tasks.find(t => t.id === action.payload.id)
      const tasks = state.tasks.filter(t => t.id !== action.payload.id)
      return {
        ...state,
        tasks,
        past: [...state.past, state.tasks],
        future: [],
        actionLog: [
          logEntry('DELETE_TASK', `Deleted "${target?.title}"`, { id: action.payload.id }),
          ...state.actionLog,
        ],
      }
    }

    case 'EDIT_TASK': {
      const tasks = state.tasks.map(t =>
        t.id === action.payload.id
          ? { ...t, title: action.payload.title.trim(), date: action.payload.date ?? t.date }
          : t
      )
      return {
        ...state,
        tasks,
        past: [...state.past, state.tasks],
        future: [],
        actionLog: [
          logEntry('EDIT_TASK', `Edited "${action.payload.title}"`, action.payload),
          ...state.actionLog,
        ],
      }
    }

    case 'TOGGLE_TASK': {
      const tasks = state.tasks.map(t =>
        t.id === action.payload.id ? { ...t, completed: !t.completed } : t
      )
      const task = tasks.find(t => t.id === action.payload.id)
      return {
        ...state,
        tasks,
        past: [...state.past, state.tasks],
        future: [],
        actionLog: [
          logEntry('TOGGLE_TASK', `${task.completed ? 'Completed' : 'Uncompleted'} "${task.title}"`, { id: task.id }),
          ...state.actionLog,
        ],
      }
    }

    case 'REORDER': {
      return {
        ...state,
        tasks: action.payload.tasks,
        past: [...state.past, state.tasks],
        future: [],
        actionLog: [
          logEntry('REORDER', 'Reordered tasks'),
          ...state.actionLog,
        ],
      }
    }

    case 'SET_FILTER': {
      return {
        ...state,
        filter: action.payload.filter,
        actionLog: [
          logEntry('SET_FILTER', `Filter → ${action.payload.filter}`),
          ...state.actionLog,
        ],
      }
    }

    case 'CLEAR_COMPLETED': {
      const tasks = state.tasks.filter(t => !t.completed)
      const count = state.tasks.length - tasks.length
      if (count === 0) return state
      return {
        ...state,
        tasks,
        past: [...state.past, state.tasks],
        future: [],
        actionLog: [
          logEntry('CLEAR_COMPLETED', `Cleared ${count} completed task${count !== 1 ? 's' : ''}`),
          ...state.actionLog,
        ],
      }
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        ...state,
        tasks: previous,
        past: state.past.slice(0, -1),
        future: [state.tasks, ...state.future],
        actionLog: [
          logEntry('UNDO', 'Undo'),
          ...state.actionLog,
        ],
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        ...state,
        tasks: next,
        past: [...state.past, state.tasks],
        future: state.future.slice(1),
        actionLog: [
          logEntry('REDO', 'Redo'),
          ...state.actionLog,
        ],
      }
    }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TaskContext = createContext(null)

export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Persist tasks to localStorage on change
  useEffect(() => {
    saveToStorage(state.tasks)
  }, [state.tasks])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'UNDO' })
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        dispatch({ type: 'REDO' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Derived: filtered tasks with late flag
  const tasksWithLate = state.tasks.map(t => ({ ...t, late: isLate(t) }))

  const filteredTasks = tasksWithLate.filter(t => {
    if (state.filter === 'completed') return t.completed
    if (state.filter === 'pending')   return !t.completed && !t.late
    if (state.filter === 'late')      return t.late
    return true
  })

  const counts = {
    all:       tasksWithLate.length,
    completed: tasksWithLate.filter(t => t.completed).length,
    pending:   tasksWithLate.filter(t => !t.completed && !t.late).length,
    late:      tasksWithLate.filter(t => t.late).length,
  }

  const addTask       = useCallback(payload => dispatch({ type: 'ADD_TASK',       payload }), [])
  const deleteTask    = useCallback(id      => dispatch({ type: 'DELETE_TASK',    payload: { id } }), [])
  const editTask      = useCallback(payload => dispatch({ type: 'EDIT_TASK',      payload }), [])
  const toggleTask    = useCallback(id      => dispatch({ type: 'TOGGLE_TASK',    payload: { id } }), [])
  const reorder       = useCallback(tasks   => dispatch({ type: 'REORDER',        payload: { tasks } }), [])
  const setFilter     = useCallback(filter  => dispatch({ type: 'SET_FILTER',     payload: { filter } }), [])
  const clearCompleted= useCallback(()      => dispatch({ type: 'CLEAR_COMPLETED' }), [])
  const undo          = useCallback(()      => dispatch({ type: 'UNDO' }), [])
  const redo          = useCallback(()      => dispatch({ type: 'REDO' }), [])

  return (
    <TaskContext.Provider value={{
      tasks: tasksWithLate,
      filteredTasks,
      filter: state.filter,
      counts,
      actionLog: state.actionLog,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      addTask, deleteTask, editTask, toggleTask,
      reorder, setFilter, clearCompleted, undo, redo,
    }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used inside TaskProvider')
  return ctx
}
