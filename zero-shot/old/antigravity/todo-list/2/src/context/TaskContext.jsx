import React, { createContext, useContext, useReducer, useEffect } from 'react';

const TaskContext = createContext();

const initialState = {
  tasks: [],
};

// We will add more actions like REORDER, SET_FILTER, UNDO, REDO later
function taskReducer(state, action) {
  switch (action.type) {
    case 'INIT_TASKS':
      return { ...state, tasks: action.payload };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'EDIT_TASK':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.id ? { ...task, ...action.payload.updates } : task
        ),
      };
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.payload.id),
      };
    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.id ? { ...task, completed: !task.completed } : task
        ),
      };
    default:
      return state;
  }
}

export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(taskReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem('tasks');
      if (storedTasks) {
        dispatch({ type: 'INIT_TASKS', payload: JSON.parse(storedTasks) });
      }
    } catch (e) {
      console.error('Failed to parse tasks from localStorage', e);
    }
  }, []);

  // Save to localStorage when tasks change
  // Note: Since INIT_TASKS sets the starting state, the first save 
  // might just overwrite identical state, which is fine.
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
  }, [state.tasks]);

  const value = {
    tasks: state.tasks,
    dispatch,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
