import { useReducer, useEffect, useCallback } from 'react';
import { Task, Action as ActionType, Filter } from '../types';
import { arrayMove } from '@dnd-kit/sortable';

interface State {
  tasks: Task[];
  actionLog: ActionType[];
  history: State[];
  historyIndex: number;
}

type Action =
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'createdAt'> }
  | { type: 'EDIT_TASK'; payload: { id: string; updates: Partial<Task> } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'TOGGLE_COMPLETE'; payload: string }
  | { type: 'REORDER_TASKS'; payload: { activeIndex: number; overIndex: number } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD_STATE'; payload: State };

const initialState: State = {
  tasks: [],
  actionLog: [],
  history: [],
  historyIndex: -1,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_TASK': {
      const newTask: Task = {
        ...action.payload,
        id: Date.now().toString(),
        createdAt: new Date(),
      };
      const newTasks = [...state.tasks, newTask];
      const newActionLog = [...state.actionLog, { type: 'ADD_TASK', timestamp: new Date(), payload: newTask }];
      const newState = { ...state, tasks: newTasks, actionLog: newActionLog };
      return addToHistory(newState);
    }
    case 'EDIT_TASK': {
      const newTasks = state.tasks.map(task =>
        task.id === action.payload.id ? { ...task, ...action.payload.updates } : task
      );
      const newActionLog = [...state.actionLog, { type: 'EDIT_TASK', timestamp: new Date(), payload: action.payload }];
      const newState = { ...state, tasks: newTasks, actionLog: newActionLog };
      return addToHistory(newState);
    }
    case 'DELETE_TASK': {
      const newTasks = state.tasks.filter(task => task.id !== action.payload);
      const newActionLog = [...state.actionLog, { type: 'DELETE_TASK', timestamp: new Date(), payload: action.payload }];
      const newState = { ...state, tasks: newTasks, actionLog: newActionLog };
      return addToHistory(newState);
    }
    case 'TOGGLE_COMPLETE': {
      const newTasks = state.tasks.map(task =>
        task.id === action.payload ? { ...task, completed: !task.completed } : task
      );
      const newActionLog = [...state.actionLog, { type: 'TOGGLE_COMPLETE', timestamp: new Date(), payload: action.payload }];
      const newState = { ...state, tasks: newTasks, actionLog: newActionLog };
      return addToHistory(newState);
    }
    case 'REORDER_TASKS': {
      const newTasks = arrayMove(state.tasks, action.payload.activeIndex, action.payload.overIndex);
      const newActionLog = [...state.actionLog, { type: 'REORDER_TASKS', timestamp: new Date(), payload: action.payload }];
      const newState = { ...state, tasks: newTasks, actionLog: newActionLog };
      return addToHistory(newState);
    }
    case 'UNDO': {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return { ...state.history[newIndex], history: state.history, historyIndex: newIndex };
      }
      return state;
    }
    case 'REDO': {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return { ...state.history[newIndex], history: state.history, historyIndex: newIndex };
      }
      return state;
    }
    case 'LOAD_STATE':
      return action.payload;
    default:
      return state;
  }
}

function addToHistory(state: State): State {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({ ...state });
  return { ...state, history: newHistory, historyIndex: newHistory.length - 1 };
}

export function useTasks() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const saved = localStorage.getItem('todo-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Parse dates
        parsed.tasks = parsed.tasks.map((task: any) => ({
          ...task,
          date: new Date(task.date),
          createdAt: new Date(task.createdAt),
        }));
        parsed.actionLog = parsed.actionLog.map((action: any) => ({
          ...action,
          timestamp: new Date(action.timestamp),
        }));
        dispatch({ type: 'LOAD_STATE', payload: parsed });
      } catch (e) {
        console.error('Failed to load state', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('todo-state', JSON.stringify(state));
  }, [state]);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>) => {
    dispatch({ type: 'ADD_TASK', payload: task });
  }, []);

  const editTask = useCallback((id: string, updates: Partial<Task>) => {
    dispatch({ type: 'EDIT_TASK', payload: { id, updates } });
  }, []);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TASK', payload: id });
  }, []);

  const toggleComplete = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_COMPLETE', payload: id });
  }, []);

  const reorderTasks = useCallback((activeIndex: number, overIndex: number) => {
    dispatch({ type: 'REORDER_TASKS', payload: { activeIndex, overIndex } });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const filteredTasks = (filter: Filter) => {
    const now = new Date();
    return state.tasks.filter(task => {
      const isLate = !task.completed && task.date < now;
      switch (filter) {
        case 'all':
          return true;
        case 'completed':
          return task.completed;
        case 'pending':
          return !task.completed;
        case 'late':
          return isLate;
        default:
          return true;
      }
    });
  };

  return {
    tasks: state.tasks,
    actionLog: state.actionLog,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
    addTask,
    editTask,
    deleteTask,
    toggleComplete,
    reorderTasks,
    undo,
    redo,
    filteredTasks,
  };
}