import { useReducer, useCallback } from 'react'
import { loadTasks, saveTasks } from '../utils/storage'
import { generateId, isTaskLate } from '../utils/taskHelpers'

const MAX_HISTORY = 50

function buildInitialState() {
  const tasks = loadTasks()
  return {
    tasks,
    filter: 'all',
    past: [],
    future: [],
    actionLog: [],
  }
}

function logEntry(type, description, payload = null) {
  return { type, description, timestamp: new Date().toISOString(), payload }
}

function pushHistory(state, nextTasks) {
  const past = [...state.past, state.tasks].slice(-MAX_HISTORY)
  return { ...state, tasks: nextTasks, past, future: [] }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK': {
      const task = {
        id: generateId(),
        title: action.title,
        completed: false,
        date: action.date || '',
        createdAt: new Date().toISOString(),
      }
      const nextTasks = [...state.tasks, task]
      saveTasks(nextTasks)
      const next = pushHistory(state, nextTasks)
      return {
        ...next,
        actionLog: [
          logEntry('ADD_TASK', `Added task "${task.title}"`, { task }),
          ...state.actionLog,
        ],
      }
    }

    case 'EDIT_TASK': {
      const nextTasks = state.tasks.map(t =>
        t.id === action.id ? { ...t, title: action.title, date: action.date ?? t.date } : t
      )
      saveTasks(nextTasks)
      const next = pushHistory(state, nextTasks)
      return {
        ...next,
        actionLog: [
          logEntry('EDIT_TASK', `Edited task "${action.title}"`, { id: action.id, title: action.title }),
          ...state.actionLog,
        ],
      }
    }

    case 'DELETE_TASK': {
      const deleted = state.tasks.find(t => t.id === action.id)
      const nextTasks = state.tasks.filter(t => t.id !== action.id)
      saveTasks(nextTasks)
      const next = pushHistory(state, nextTasks)
      return {
        ...next,
        actionLog: [
          logEntry('DELETE_TASK', `Deleted task "${deleted?.title}"`, { id: action.id }),
          ...state.actionLog,
        ],
      }
    }

    case 'TOGGLE_TASK': {
      const nextTasks = state.tasks.map(t =>
        t.id === action.id ? { ...t, completed: !t.completed } : t
      )
      const toggled = nextTasks.find(t => t.id === action.id)
      saveTasks(nextTasks)
      const next = pushHistory(state, nextTasks)
      return {
        ...next,
        actionLog: [
          logEntry('TOGGLE_TASK', `Marked "${toggled?.title}" as ${toggled?.completed ? 'completed' : 'pending'}`, { id: action.id, completed: toggled?.completed }),
          ...state.actionLog,
        ],
      }
    }

    case 'REORDER': {
      saveTasks(action.tasks)
      const next = pushHistory(state, action.tasks)
      return {
        ...next,
        actionLog: [
          logEntry('REORDER', 'Reordered tasks', null),
          ...state.actionLog,
        ],
      }
    }

    case 'SET_FILTER': {
      return {
        ...state,
        filter: action.filter,
        actionLog: [
          logEntry('SET_FILTER', `Filter set to "${action.filter}"`, { filter: action.filter }),
          ...state.actionLog,
        ],
      }
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const newPast = state.past.slice(0, -1)
      const newFuture = [state.tasks, ...state.future]
      saveTasks(previous)
      return {
        ...state,
        tasks: previous,
        past: newPast,
        future: newFuture,
        actionLog: [
          logEntry('UNDO', 'Undid last action', null),
          ...state.actionLog,
        ],
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      const newFuture = state.future.slice(1)
      const newPast = [...state.past, state.tasks]
      saveTasks(next)
      return {
        ...state,
        tasks: next,
        past: newPast,
        future: newFuture,
        actionLog: [
          logEntry('REDO', 'Redid last action', null),
          ...state.actionLog,
        ],
      }
    }

    default:
      return state
  }
}

export function useTaskState() {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState)

  const addTask = useCallback((title, date) => dispatch({ type: 'ADD_TASK', title, date }), [])
  const editTask = useCallback((id, title, date) => dispatch({ type: 'EDIT_TASK', id, title, date }), [])
  const deleteTask = useCallback((id) => dispatch({ type: 'DELETE_TASK', id }), [])
  const toggleTask = useCallback((id) => dispatch({ type: 'TOGGLE_TASK', id }), [])
  const reorderTasks = useCallback((tasks) => dispatch({ type: 'REORDER', tasks }), [])
  const setFilter = useCallback((filter) => dispatch({ type: 'SET_FILTER', filter }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  return {
    ...state,
    addTask,
    editTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    setFilter,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
