import type { AppState, Action, Task, ActionLogEntry } from './types';

const generateId = () => Math.random().toString(36).substr(2, 9);

const addToLog = (state: AppState, entry: Omit<ActionLogEntry, 'timestamp'>): AppState => ({
  ...state,
  actionLog: [...state.actionLog, { ...entry, timestamp: new Date().toISOString() }]
});

const saveToHistory = (state: AppState): AppState => {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({ tasks: state.tasks, filter: state.filter });
  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1
  };
};

export const initialState: AppState = {
  tasks: [],
  filter: 'all',
  history: [{ tasks: [], filter: 'all' }],
  historyIndex: 0,
  actionLog: []
};

export const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_TASK': {
      const newTask: Task = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date().toISOString()
      };
      const newState = {
        ...state,
        tasks: [...state.tasks, newTask]
      };
      return addToLog(saveToHistory(newState), {
        type: 'ADD_TASK',
        description: `Added task: ${newTask.title}`,
        payload: newTask
      });
    }
    case 'EDIT_TASK': {
      const updatedTasks = state.tasks.map(task =>
        task.id === action.payload.id
          ? { ...task, title: action.payload.title, date: action.payload.date }
          : task
      );
      const newState = { ...state, tasks: updatedTasks };
      return addToLog(saveToHistory(newState), {
        type: 'EDIT_TASK',
        description: `Edited task: ${action.payload.title}`,
        payload: action.payload
      });
    }
    case 'DELETE_TASK': {
      const taskToDelete = state.tasks.find(t => t.id === action.payload);
      const newState = {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload)
      };
      return addToLog(saveToHistory(newState), {
        type: 'DELETE_TASK',
        description: `Deleted task: ${taskToDelete?.title || 'Unknown'}`,
        payload: { id: action.payload }
      });
    }
    case 'TOGGLE_TASK': {
      const updatedTasks = state.tasks.map(task =>
        task.id === action.payload ? { ...task, completed: !task.completed } : task
      );
      const task = updatedTasks.find(t => t.id === action.payload);
      const newState = { ...state, tasks: updatedTasks };
      return addToLog(saveToHistory(newState), {
        type: 'TOGGLE_TASK',
        description: `Toggled task: ${task?.title || 'Unknown'}`,
        payload: { id: action.payload, completed: task?.completed }
      });
    }
    case 'REORDER_TASKS': {
      const newState = { ...state, tasks: action.payload };
      return addToLog(saveToHistory(newState), {
        type: 'REORDER',
        description: 'Reordered tasks',
        payload: action.payload
      });
    }
    case 'SET_FILTER': {
      const newState = { ...state, filter: action.payload };
      return addToLog(saveToHistory(newState), {
        type: 'SET_FILTER',
        description: `Set filter to ${action.payload}`,
        payload: action.payload
      });
    }
    case 'UNDO': {
      if (state.historyIndex > 0) {
        const prevState = state.history[state.historyIndex - 1];
        const newState = {
          ...state,
          tasks: prevState.tasks,
          filter: prevState.filter,
          historyIndex: state.historyIndex - 1
        };
        return addToLog(newState, {
          type: 'UNDO',
          description: 'Undid last action',
          payload: null
        });
      }
      return state;
    }
    case 'REDO': {
      if (state.historyIndex < state.history.length - 1) {
        const nextState = state.history[state.historyIndex + 1];
        const newState = {
          ...state,
          tasks: nextState.tasks,
          filter: nextState.filter,
          historyIndex: state.historyIndex + 1
        };
        return addToLog(newState, {
          type: 'REDO',
          description: 'Redid last action',
          payload: null
        });
      }
      return state;
    }
    case 'LOAD_STATE': {
      return {
        ...state,
        tasks: action.payload.tasks,
        filter: action.payload.filter,
        history: [{ tasks: action.payload.tasks, filter: action.payload.filter }],
        historyIndex: 0,
        actionLog: []
      };
    }
    default:
      return state;
  }
};