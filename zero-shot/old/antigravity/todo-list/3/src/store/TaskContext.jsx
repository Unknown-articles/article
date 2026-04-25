import React, { createContext, useReducer, useEffect, useContext } from 'react';

export const TaskContext = createContext();

const loadTasks = () => {
  try {
    const saved = localStorage.getItem('tasks');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load tasks', e);
  }
  return [];
};

const initialState = {
  tasks: loadTasks(),
  filter: 'All',
  past: [],
  future: [],
  log: []
};

function createLogEntry(type, description, payload) {
  return {
    type,
    description,
    timestamp: new Date().toISOString(),
    payload
  };
}

function taskReducer(state, action) {
  const { type, payload } = action;

  // Helper to save history
  const saveHistory = (newTasks, description) => {
    return {
      ...state,
      past: [...state.past, state.tasks],
      future: [],
      tasks: newTasks,
      log: [createLogEntry(type, description, payload), ...state.log]
    };
  };

  switch (type) {
    case 'ADD_TASK': {
      const newTask = {
        ...payload,
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        createdAt: new Date().toISOString()
      };
      const newTasks = [...state.tasks, newTask];
      return saveHistory(newTasks, `Added task: "${payload.title}"`);
    }
    case 'EDIT_TASK': {
      const newTasks = state.tasks.map(t => 
        t.id === payload.id ? { ...t, title: payload.title } : t
      );
      return saveHistory(newTasks, `Edited task: "${payload.title}"`);
    }
    case 'DELETE_TASK': {
      const taskToDelete = state.tasks.find(t => t.id === payload.id);
      const newTasks = state.tasks.filter(t => t.id !== payload.id);
      return saveHistory(newTasks, `Deleted task: "${taskToDelete?.title}"`);
    }
    case 'TOGGLE_TASK': {
      const taskToToggle = state.tasks.find(t => t.id === payload.id);
      const newTasks = state.tasks.map(t =>
        t.id === payload.id ? { ...t, completed: !t.completed } : t
      );
      const status = taskToToggle.completed ? 'incomplete' : 'completed';
      return saveHistory(newTasks, `Marked task "${taskToToggle?.title}" as ${status}`);
    }
    case 'REORDER': {
      const newTasks = [...payload.tasks];
      return saveHistory(newTasks, `Reordered tasks`);
    }
    case 'SET_FILTER': {
      return {
        ...state,
        filter: payload.filter,
        log: [createLogEntry(type, `Set filter to ${payload.filter}`, payload), ...state.log]
      };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previousTasks = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        ...state,
        past: newPast,
        future: [state.tasks, ...state.future],
        tasks: previousTasks,
        log: [createLogEntry(type, 'Undo last action', null), ...state.log]
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const nextTasks = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        ...state,
        past: [...state.past, state.tasks],
        future: newFuture,
        tasks: nextTasks,
        log: [createLogEntry(type, 'Redo action', null), ...state.log]
      };
    }
    default:
      return state;
  }
}

export const TaskProvider = ({ children }) => {
  const [state, dispatch] = useReducer(taskReducer, initialState);

  // Persistence
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
  }, [state.tasks]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); // Prevent browser undo
        dispatch({ type: 'UNDO' });
      } else if (e.ctrlKey && e.key === 'Z') { // Ctrl+Shift+Z
        e.preventDefault();
        dispatch({ type: 'REDO' });
      } else if (e.ctrlKey && e.key === 'y') { // Alternative Ctrl+Y for Redo
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TaskContext.Provider value={{ state, dispatch }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTaskContext = () => useContext(TaskContext);
