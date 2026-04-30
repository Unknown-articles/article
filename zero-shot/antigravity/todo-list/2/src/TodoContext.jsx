import { createContext, useContext, useReducer, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const TodoContext = createContext();

export const ADD_TASK = 'ADD_TASK';
export const EDIT_TASK = 'EDIT_TASK';
export const DELETE_TASK = 'DELETE_TASK';
export const TOGGLE_TASK = 'TOGGLE_TASK';
export const REORDER = 'REORDER';
export const SET_FILTER = 'SET_FILTER';
export const UNDO = 'UNDO';
export const REDO = 'REDO';

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
  past: [],
  future: [],
  filter: 'ALL', // 'ALL', 'COMPLETED', 'PENDING', 'LATE'
  actionLog: []
};

const createLogEntry = (type, description, payload) => ({
  id: uuidv4(),
  type,
  description,
  timestamp: new Date().toISOString(),
  payload
});

const saveTasks = (tasks) => {
  localStorage.setItem('tasks', JSON.stringify(tasks));
};

function taskReducer(state, action) {
  let newState = state;

  switch (action.type) {
    case ADD_TASK: {
      const newTask = {
        id: uuidv4(),
        title: action.payload.title,
        completed: false,
        date: action.payload.date,
        createdAt: new Date().toISOString(),
      };
      const newTasks = [...state.tasks, newTask];
      newState = {
        ...state,
        past: [...state.past, state.tasks],
        future: [],
        tasks: newTasks,
        actionLog: [createLogEntry(ADD_TASK, `Added task: "${newTask.title}"`, action.payload), ...state.actionLog]
      };
      break;
    }
    case EDIT_TASK: {
      const { id, title } = action.payload;
      const newTasks = state.tasks.map(t => t.id === id ? { ...t, title } : t);
      newState = {
        ...state,
        past: [...state.past, state.tasks],
        future: [],
        tasks: newTasks,
        actionLog: [createLogEntry(EDIT_TASK, `Edited task: "${title}"`, action.payload), ...state.actionLog]
      };
      break;
    }
    case DELETE_TASK: {
      const { id } = action.payload;
      const task = state.tasks.find(t => t.id === id);
      const newTasks = state.tasks.filter(t => t.id !== id);
      newState = {
        ...state,
        past: [...state.past, state.tasks],
        future: [],
        tasks: newTasks,
        actionLog: [createLogEntry(DELETE_TASK, `Deleted task: "${task?.title}"`, action.payload), ...state.actionLog]
      };
      break;
    }
    case TOGGLE_TASK: {
      const { id } = action.payload;
      const task = state.tasks.find(t => t.id === id);
      const newTasks = state.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
      newState = {
        ...state,
        past: [...state.past, state.tasks],
        future: [],
        tasks: newTasks,
        actionLog: [createLogEntry(TOGGLE_TASK, `${task?.completed ? 'Uncompleted' : 'Completed'} task: "${task?.title}"`, action.payload), ...state.actionLog]
      };
      break;
    }
    case REORDER: {
      const { startIndex, endIndex } = action.payload;
      const newTasks = Array.from(state.tasks);
      const [removed] = newTasks.splice(startIndex, 1);
      newTasks.splice(endIndex, 0, removed);
      newState = {
        ...state,
        past: [...state.past, state.tasks],
        future: [],
        tasks: newTasks,
        actionLog: [createLogEntry(REORDER, `Reordered task from ${startIndex} to ${endIndex}`, action.payload), ...state.actionLog]
      };
      break;
    }
    case SET_FILTER: {
      newState = {
        ...state,
        filter: action.payload.filter,
        actionLog: [createLogEntry(SET_FILTER, `Set filter to ${action.payload.filter}`, action.payload), ...state.actionLog]
      };
      break;
    }
    case UNDO: {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      newState = {
        ...state,
        past: newPast,
        future: [state.tasks, ...state.future],
        tasks: previous,
        actionLog: [createLogEntry(UNDO, `Undid last action`, null), ...state.actionLog]
      };
      break;
    }
    case REDO: {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      newState = {
        ...state,
        past: [...state.past, state.tasks],
        future: newFuture,
        tasks: next,
        actionLog: [createLogEntry(REDO, `Redid last action`, null), ...state.actionLog]
      };
      break;
    }
    default:
      return state;
  }

  if (newState.tasks !== state.tasks) {
    saveTasks(newState.tasks);
  }

  return newState;
}

export const TodoProvider = ({ children }) => {
  const [state, dispatch] = useReducer(taskReducer, initialState);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          dispatch({ type: REDO });
        } else {
          e.preventDefault();
          dispatch({ type: UNDO });
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: REDO });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TodoContext.Provider value={{ state, dispatch }}>
      {children}
    </TodoContext.Provider>
  );
};

export const useTodo = () => useContext(TodoContext);
