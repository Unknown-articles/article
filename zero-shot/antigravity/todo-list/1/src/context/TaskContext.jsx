import React, { createContext, useContext, useReducer, useEffect } from 'react';

const TaskContext = createContext();

const initialState = {
  past: [],
  present: {
    tasks: [],
    actionLog: []
  },
  future: []
};

function taskReducer(state, action) {
  if (action.type === 'RESTORE_STATE') {
    return { ...state, present: action.payload };
  }

  const { past, present, future } = state;

  if (action.type === 'UNDO') {
    if (past.length === 0) return state;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    return {
      past: newPast,
      present: previous,
      future: [present, ...future]
    };
  }

  if (action.type === 'REDO') {
    if (future.length === 0) return state;
    const next = future[0];
    const newFuture = future.slice(1);
    
    return {
      past: [...past, present],
      present: next,
      future: newFuture
    };
  }

  // Handle present state mutation
  let newPresent = { ...present };
  const timestamp = Date.now();
  
  if (action.type === 'ADD_TASK') {
     newPresent.tasks = [...present.tasks, action.payload];
  } else if (action.type === 'UPDATE_TASK') {
     newPresent.tasks = present.tasks.map(t => t.id === action.payload.id ? { ...t, ...action.payload.updates } : t);
  } else if (action.type === 'DELETE_TASK') {
     newPresent.tasks = present.tasks.filter(t => t.id !== action.payload);
  } else if (action.type === 'TOGGLE_TASK') {
     newPresent.tasks = present.tasks.map(t => t.id === action.payload ? { ...t, completed: !t.completed } : t);
  } else if (action.type === 'REORDER_TASKS') {
     newPresent.tasks = action.payload; // Receives the fully reordered array
  } else {
     return state;
  }

  // Prepend to Action Log
  newPresent.actionLog = [
    {
      id: crypto.randomUUID(),
      type: action.type,
      timestamp,
      payload: action.payload
    },
    ...present.actionLog
  ].slice(0, 100); // Keep last 100 actions

  return {
    past: [...past, present],
    present: newPresent,
    future: []
  };
}

export const TaskProvider = ({ children }) => {
  const [state, dispatch] = useReducer(taskReducer, initialState);

  // Load from local storage exclusively on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('todoState');
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'RESTORE_STATE', payload: parsed });
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
  }, []);

  // Save to local storage on present state changes
  useEffect(() => {
    // Avoid overwriting on the first initial empty render if we are waiting for restore
    // Using a simple flag wouldn't hurt but saving an empty array is harmless if it's the real state
    localStorage.setItem('todoState', JSON.stringify(state.present));
  }, [state.present]);

  // Global Keybindings for Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if trying to type in an input
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TaskContext.Provider value={{
      tasks: state.present.tasks,
      actionLog: state.present.actionLog,
      dispatch,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = () => useContext(TaskContext);
