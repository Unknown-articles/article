import { useReducer, useEffect } from 'react';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';
import FilterBar from './components/FilterBar.jsx';
import ActionLog from './components/ActionLog.jsx';
import { filterTasks, getCounts } from './utils/taskUtils.js';
import './App.css';

const STORAGE_KEY = 'tasks';

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function makeLogEntry(type, description, payload = null) {
  return { type, description, timestamp: new Date().toISOString(), payload };
}

const initialState = {
  past: [],
  present: loadTasks(),
  future: [],
  filter: 'all',
  actionLog: [],
};

function reducer(state, action) {
  function pushHistory(newPresent, logEntry) {
    return {
      ...state,
      past: [...state.past, state.present],
      present: newPresent,
      future: [],
      actionLog: [logEntry, ...state.actionLog],
    };
  }

  switch (action.type) {
    case 'ADD_TASK': {
      const newTasks = [...state.present, action.task];
      return pushHistory(
        newTasks,
        makeLogEntry('ADD_TASK', `Added task: "${action.task.title}"`, { task: action.task })
      );
    }
    case 'EDIT_TASK': {
      const newTasks = state.present.map((t) =>
        t.id === action.task.id ? action.task : t
      );
      return pushHistory(
        newTasks,
        makeLogEntry('EDIT_TASK', `Edited task: "${action.task.title}"`, { task: action.task })
      );
    }
    case 'DELETE_TASK': {
      const task = state.present.find((t) => t.id === action.id);
      const newTasks = state.present.filter((t) => t.id !== action.id);
      return pushHistory(
        newTasks,
        makeLogEntry('DELETE_TASK', `Deleted task: "${task?.title}"`, { id: action.id })
      );
    }
    case 'TOGGLE_TASK': {
      const task = state.present.find((t) => t.id === action.id);
      const newTasks = state.present.map((t) =>
        t.id === action.id ? { ...t, completed: !t.completed } : t
      );
      const verb = task?.completed ? 'Uncompleted' : 'Completed';
      return pushHistory(
        newTasks,
        makeLogEntry('TOGGLE_TASK', `${verb} task: "${task?.title}"`, { id: action.id })
      );
    }
    case 'REORDER': {
      return pushHistory(
        action.tasks,
        makeLogEntry('REORDER', 'Reordered tasks', { order: action.tasks.map((t) => t.id) })
      );
    }
    case 'SET_FILTER': {
      return {
        ...state,
        filter: action.filter,
        actionLog: [
          makeLogEntry('SET_FILTER', `Filter set to: ${action.filter}`, { filter: action.filter }),
          ...state.actionLog,
        ],
      };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        actionLog: [makeLogEntry('UNDO', 'Undo', null), ...state.actionLog],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        actionLog: [makeLogEntry('REDO', 'Redo', null), ...state.actionLog],
      };
    }
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.present));
  }, [state.present]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      } else if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredTasks = filterTasks(state.present, state.filter);
  const counts = getCounts(state.present);

  return (
    <div className="app">
      <header className="app-header">
        <h1>To-Do List</h1>
        <p className="shortcut-hint">Ctrl+Z · Ctrl+Shift+Z to undo/redo</p>
      </header>
      <TaskForm dispatch={dispatch} />
      <FilterBar filter={state.filter} counts={counts} dispatch={dispatch} />
      <TaskList tasks={filteredTasks} allTasks={state.present} dispatch={dispatch} />
      <ActionLog log={state.actionLog} />
    </div>
  );
}
