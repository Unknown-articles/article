export const initialState = {
  tasks: [],
  filter: 'All', // 'All', 'Completed', 'Pending', 'Late'
  history: [],
  future: [],
  actionLog: []
};

// Initializer to load from localStorage
export const initStore = (initial) => {
  try {
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
      return {
        ...initial,
        tasks: JSON.parse(storedTasks)
      };
    }
  } catch (e) {
    console.error('Failed to load tasks from local storage', e);
  }
  return initial;
};

// Helper to save to local storage
const saveTasks = (tasks) => {
  localStorage.setItem('tasks', JSON.stringify(tasks));
};

export const reducer = (state, action) => {
  const { type, payload, description, timestamp } = action;

  // Add to action log except for undo/redo if we want them logged? The prompt says "Each action must include: type: ... UNDO | REDO". So yes, they are actions.
  const newLogEntry = {
    type,
    description: description || type,
    timestamp: timestamp || new Date().toISOString(),
    payload: payload || null
  };

  const newLog = [newLogEntry, ...state.actionLog];
  
  let newState = state;

  switch (type) {
    case 'ADD_TASK': {
      const newTasks = [...state.tasks, payload];
      saveTasks(newTasks);
      newState = {
        ...state,
        tasks: newTasks,
        history: [...state.history, state.tasks],
        future: [],
        actionLog: newLog
      };
      break;
    }
    case 'EDIT_TASK': {
      const newTasks = state.tasks.map(t => t.id === payload.id ? { ...t, title: payload.title } : t);
      saveTasks(newTasks);
      newState = {
        ...state,
        tasks: newTasks,
        history: [...state.history, state.tasks],
        future: [],
        actionLog: newLog
      };
      break;
    }
    case 'DELETE_TASK': {
      const newTasks = state.tasks.filter(t => t.id !== payload.id);
      saveTasks(newTasks);
      newState = {
        ...state,
        tasks: newTasks,
        history: [...state.history, state.tasks],
        future: [],
        actionLog: newLog
      };
      break;
    }
    case 'TOGGLE_TASK': {
      const newTasks = state.tasks.map(t => t.id === payload.id ? { ...t, completed: !t.completed } : t);
      saveTasks(newTasks);
      newState = {
        ...state,
        tasks: newTasks,
        history: [...state.history, state.tasks],
        future: [],
        actionLog: newLog
      };
      break;
    }
    case 'REORDER': {
      saveTasks(payload.tasks);
      newState = {
        ...state,
        tasks: payload.tasks,
        history: [...state.history, state.tasks],
        future: [],
        actionLog: newLog
      };
      break;
    }
    case 'SET_FILTER': {
      // Doesn't affect history of tasks
      newState = {
        ...state,
        filter: payload.filter,
        actionLog: newLog
      };
      break;
    }
    case 'UNDO': {
      if (state.history.length === 0) {
        newState = { ...state, actionLog: newLog };
        break;
      }
      const previousTasks = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, -1);
      saveTasks(previousTasks);
      newState = {
        ...state,
        tasks: previousTasks,
        history: newHistory,
        future: [state.tasks, ...state.future],
        actionLog: newLog
      };
      break;
    }
    case 'REDO': {
      if (state.future.length === 0) {
        newState = { ...state, actionLog: newLog };
        break;
      }
      const nextTasks = state.future[0];
      const newFuture = state.future.slice(1);
      saveTasks(nextTasks);
      newState = {
        ...state,
        tasks: nextTasks,
        history: [...state.history, state.tasks],
        future: newFuture,
        actionLog: newLog
      };
      break;
    }
    default:
      return state;
  }

  return newState;
};
