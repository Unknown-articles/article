import { useReducer, useEffect, useCallback } from 'react';

const initialState = {
  past: [],
  present: [], // tasks
  future: [],
  actionLog: [],
  filter: 'All'
};

function initStore() {
  const savedTasks = localStorage.getItem('tasks');
  let present = [];
  try {
    if (savedTasks) {
      present = JSON.parse(savedTasks);
    }
  } catch (e) {
    console.error('Failed to parse tasks from localStorage', e);
  }
  return { ...initialState, present };
}

function reducer(state, action) {
  const logEntry = (type, payload, description) => ({
    id: Date.now() + Math.random(),
    type,
    payload,
    description,
    timestamp: new Date().toISOString()
  });

  const saveToHistory = (newPresent) => {
    return {
      past: [...state.past, state.present],
      present: newPresent,
      future: []
    };
  };

  switch (action.type) {
    case 'ADD_TASK': {
      const newPresent = [...state.present, action.payload];
      const historyState = saveToHistory(newPresent);
      return {
        ...state,
        ...historyState,
        actionLog: [logEntry('ADD_TASK', action.payload, `Added task: "${action.payload.title}"`), ...state.actionLog]
      };
    }
    case 'EDIT_TASK': {
      const newPresent = state.present.map(t => t.id === action.payload.id ? { ...t, ...action.payload.updates } : t);
      const historyState = saveToHistory(newPresent);
      return {
        ...state,
        ...historyState,
        actionLog: [logEntry('EDIT_TASK', action.payload, `Edited task: "${action.payload.updates.title || action.payload.id}"`), ...state.actionLog]
      };
    }
    case 'DELETE_TASK': {
      const taskToDelete = state.present.find(t => t.id === action.payload);
      const newPresent = state.present.filter(t => t.id !== action.payload);
      const historyState = saveToHistory(newPresent);
      return {
        ...state,
        ...historyState,
        actionLog: [logEntry('DELETE_TASK', action.payload, `Deleted task: "${taskToDelete?.title || action.payload}"`), ...state.actionLog]
      };
    }
    case 'TOGGLE_TASK': {
      const taskToToggle = state.present.find(t => t.id === action.payload);
      const newPresent = state.present.map(t => t.id === action.payload ? { ...t, completed: !t.completed } : t);
      const historyState = saveToHistory(newPresent);
      return {
        ...state,
        ...historyState,
        actionLog: [logEntry('TOGGLE_TASK', action.payload, `Toggled task: "${taskToToggle?.title || action.payload}"`), ...state.actionLog]
      };
    }
    case 'REORDER': {
      const historyState = saveToHistory(action.payload);
      return {
        ...state,
        ...historyState,
        actionLog: [logEntry('REORDER', null, `Reordered tasks`), ...state.actionLog]
      };
    }
    case 'SET_FILTER': {
      return {
        ...state,
        filter: action.payload,
        actionLog: [logEntry('SET_FILTER', action.payload, `Changed filter to ${action.payload}`), ...state.actionLog]
      };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        ...state,
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
        actionLog: [logEntry('UNDO', null, `Undid last action`), ...state.actionLog]
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        ...state,
        past: [...state.past, state.present],
        present: next,
        future: newFuture,
        actionLog: [logEntry('REDO', null, `Redid last action`), ...state.actionLog]
      };
    }
    default:
      return state;
  }
}

export function useTodoStore() {
  const [state, dispatch] = useReducer(reducer, initialState, initStore);

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(state.present));
  }, [state.present]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          dispatch({ type: 'REDO' });
        } else {
          e.preventDefault();
          dispatch({ type: 'UNDO' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { state, dispatch };
}
