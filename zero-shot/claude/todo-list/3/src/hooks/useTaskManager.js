import { useReducer, useCallback, useEffect } from 'react';
import { generateId } from '../utils/id';
import { loadTasks, saveTasks } from '../utils/storage';
import { isLate } from '../utils/task';

const MAX_HISTORY = 50;

const log = (type, description, payload = null) => ({
  id: generateId(),
  type,
  description,
  timestamp: new Date().toISOString(),
  payload,
});

const initialState = {
  tasks: loadTasks(),
  filter: 'all',
  history: [],
  future: [],
  actionLog: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK': {
      const task = action.payload;
      const tasks = [...state.tasks, task];
      return {
        ...state,
        tasks,
        history: [...state.history.slice(-MAX_HISTORY), state.tasks],
        future: [],
        actionLog: [log('ADD_TASK', `Added task "${task.title}"`, task), ...state.actionLog],
      };
    }
    case 'EDIT_TASK': {
      const { id, changes } = action.payload;
      const tasks = state.tasks.map((t) => (t.id === id ? { ...t, ...changes } : t));
      return {
        ...state,
        tasks,
        history: [...state.history.slice(-MAX_HISTORY), state.tasks],
        future: [],
        actionLog: [log('EDIT_TASK', `Edited task "${changes.title ?? ''}"`, action.payload), ...state.actionLog],
      };
    }
    case 'DELETE_TASK': {
      const deleted = state.tasks.find((t) => t.id === action.payload);
      const tasks = state.tasks.filter((t) => t.id !== action.payload);
      return {
        ...state,
        tasks,
        history: [...state.history.slice(-MAX_HISTORY), state.tasks],
        future: [],
        actionLog: [log('DELETE_TASK', `Deleted task "${deleted?.title}"`, { id: action.payload }), ...state.actionLog],
      };
    }
    case 'TOGGLE_TASK': {
      const toggled = state.tasks.find((t) => t.id === action.payload);
      const tasks = state.tasks.map((t) =>
        t.id === action.payload ? { ...t, completed: !t.completed } : t
      );
      return {
        ...state,
        tasks,
        history: [...state.history.slice(-MAX_HISTORY), state.tasks],
        future: [],
        actionLog: [
          log('TOGGLE_TASK', `Marked "${toggled?.title}" as ${toggled?.completed ? 'incomplete' : 'complete'}`, { id: action.payload }),
          ...state.actionLog,
        ],
      };
    }
    case 'REORDER': {
      return {
        ...state,
        tasks: action.payload,
        history: [...state.history.slice(-MAX_HISTORY), state.tasks],
        future: [],
        actionLog: [log('REORDER', 'Reordered tasks', null), ...state.actionLog],
      };
    }
    case 'SET_FILTER': {
      return {
        ...state,
        filter: action.payload,
        actionLog: [log('SET_FILTER', `Filter set to "${action.payload}"`, { filter: action.payload }), ...state.actionLog],
      };
    }
    case 'UNDO': {
      if (!state.history.length) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        tasks: prev,
        history: state.history.slice(0, -1),
        future: [state.tasks, ...state.future.slice(0, MAX_HISTORY - 1)],
        actionLog: [log('UNDO', 'Undid last action', null), ...state.actionLog],
      };
    }
    case 'REDO': {
      if (!state.future.length) return state;
      const next = state.future[0];
      return {
        ...state,
        tasks: next,
        history: [...state.history.slice(-MAX_HISTORY), state.tasks],
        future: state.future.slice(1),
        actionLog: [log('REDO', 'Redid last action', null), ...state.actionLog],
      };
    }
    default:
      return state;
  }
}

export function useTaskManager() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    saveTasks(state.tasks);
  }, [state.tasks]);

  const addTask = useCallback((title, date) => {
    const task = {
      id: generateId(),
      title,
      completed: false,
      date: date || null,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_TASK', payload: task });
  }, []);

  const editTask = useCallback((id, changes) => {
    dispatch({ type: 'EDIT_TASK', payload: { id, changes } });
  }, []);

  const deleteTask = useCallback((id) => {
    dispatch({ type: 'DELETE_TASK', payload: id });
  }, []);

  const toggleTask = useCallback((id) => {
    dispatch({ type: 'TOGGLE_TASK', payload: id });
  }, []);

  const reorderTasks = useCallback((tasks) => {
    dispatch({ type: 'REORDER', payload: tasks });
  }, []);

  const setFilter = useCallback((filter) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const filteredTasks = state.tasks.filter((t) => {
    if (state.filter === 'completed') return t.completed;
    if (state.filter === 'pending') return !t.completed;
    if (state.filter === 'late') return isLate(t);
    return true;
  });

  const counts = {
    all: state.tasks.length,
    completed: state.tasks.filter((t) => t.completed).length,
    pending: state.tasks.filter((t) => !t.completed).length,
    late: state.tasks.filter((t) => isLate(t)).length,
  };

  return {
    tasks: filteredTasks,
    filter: state.filter,
    actionLog: state.actionLog,
    canUndo: state.history.length > 0,
    canRedo: state.future.length > 0,
    counts,
    addTask,
    editTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    setFilter,
    undo,
    redo,
  };
}
