import { Task, Action, Filter } from './types';

export interface State {
  tasks: Task[];
  filter: Filter;
  history: Action[];
  historyIndex: number;
}

export type ActionType =
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'createdAt'> }
  | { type: 'EDIT_TASK'; payload: { id: string; title: string } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'TOGGLE_TASK'; payload: string }
  | { type: 'REORDER'; payload: Task[] }
  | { type: 'SET_FILTER'; payload: Filter }
  | { type: 'LOAD_TASKS'; payload: Task[] }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const initialState: State = {
  tasks: [],
  filter: 'all',
  history: [],
  historyIndex: -1,
};

function applyAction(state: State, action: ActionType): State {
  switch (action.type) {
    case 'ADD_TASK':
      const newTask: Task = {
        ...action.payload,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        tasks: [...state.tasks, newTask],
      };
    case 'EDIT_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, title: action.payload.title }
            : task
        ),
      };
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
      };
    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? { ...task, completed: !task.completed }
            : task
        ),
      };
    case 'REORDER':
      return {
        ...state,
        tasks: action.payload,
      };
    case 'SET_FILTER':
      return {
        ...state,
        filter: action.payload,
      };
    case 'LOAD_TASKS':
      return {
        ...state,
        tasks: action.payload,
      };
    case 'UNDO':
      if (state.historyIndex > 0) {
        const prevIndex = state.historyIndex - 1;
        const prevAction = state.history[prevIndex];
        return undoAction(state, prevAction);
      }
      return state;
    case 'REDO':
      if (state.historyIndex < state.history.length - 1) {
        const nextIndex = state.historyIndex + 1;
        const nextAction = state.history[nextIndex];
        return redoAction(state, nextAction);
      }
      return state;
    default:
      return state;
  }
}

function undoAction(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload.id),
      };
    case 'EDIT_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, title: action.payload.oldTitle }
            : task
        ),
      };
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: [...state.tasks, action.payload.task],
      };
    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, completed: !task.completed }
            : task
        ),
      };
    case 'REORDER':
      return {
        ...state,
        tasks: action.payload.oldOrder,
      };
    case 'SET_FILTER':
      return {
        ...state,
        filter: action.payload.oldFilter,
      };
    default:
      return state;
  }
}

function redoAction(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_TASK':
      return {
        ...state,
        tasks: [...state.tasks, action.payload],
      };
    case 'EDIT_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, title: action.payload.newTitle }
            : task
        ),
      };
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload.id),
      };
    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, completed: !task.completed }
            : task
        ),
      };
    case 'REORDER':
      return {
        ...state,
        tasks: action.payload.newOrder,
      };
    case 'SET_FILTER':
      return {
        ...state,
        filter: action.payload.newFilter,
      };
    default:
      return state;
  }
}

export function reducer(state: State, action: ActionType): State {
  let newState = applyAction(state, action);

  if (action.type !== 'UNDO' && action.type !== 'REDO' && action.type !== 'LOAD_TASKS') {
    const logAction: Action = {
      type: action.type,
      description: getDescription(action),
      timestamp: new Date().toISOString(),
      payload: getPayload(action, state, newState),
    };

    newState = {
      ...newState,
      history: [...state.history.slice(0, state.historyIndex + 1), logAction],
      historyIndex: state.historyIndex + 1,
    };
  } else {
    newState = {
      ...newState,
      historyIndex: action.type === 'UNDO' ? state.historyIndex - 1 : action.type === 'REDO' ? state.historyIndex + 1 : state.historyIndex,
    };
  }

  return newState;
}

function getDescription(action: ActionType): string {
  switch (action.type) {
    case 'ADD_TASK':
      return `Added task "${action.payload.title}"`;
    case 'EDIT_TASK':
      return `Edited task title`;
    case 'DELETE_TASK':
      return `Deleted task`;
    case 'TOGGLE_TASK':
      return `Toggled task completion`;
    case 'REORDER':
      return `Reordered tasks`;
    case 'SET_FILTER':
      return `Set filter to ${action.payload}`;
    case 'UNDO':
      return `Undid last action`;
    case 'REDO':
      return `Redid last action`;
    default:
      return '';
  }
}

function getPayload(action: ActionType, oldState: State, newState: State): any {
  switch (action.type) {
    case 'ADD_TASK':
      return newState.tasks.find(task => task.title === action.payload.title);
    case 'EDIT_TASK':
      const oldTask = oldState.tasks.find(task => task.id === action.payload.id);
      return {
        id: action.payload.id,
        oldTitle: oldTask?.title,
        newTitle: action.payload.title,
      };
    case 'DELETE_TASK':
      return {
        id: action.payload,
        task: oldState.tasks.find(task => task.id === action.payload),
      };
    case 'TOGGLE_TASK':
      return {
        id: action.payload,
        completed: newState.tasks.find(task => task.id === action.payload)?.completed,
      };
    case 'REORDER':
      return {
        oldOrder: oldState.tasks,
        newOrder: action.payload,
      };
    case 'SET_FILTER':
      return {
        oldFilter: oldState.filter,
        newFilter: action.payload,
      };
    default:
      return null;
  }
}

export { initialState };