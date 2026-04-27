export interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string; // ISO date string
  createdAt: string; // ISO date string
}

export type Filter = 'all' | 'completed' | 'pending' | 'late';

export interface ActionLogEntry {
  type: 'ADD_TASK' | 'EDIT_TASK' | 'DELETE_TASK' | 'TOGGLE_TASK' | 'REORDER' | 'SET_FILTER' | 'UNDO' | 'REDO';
  description: string;
  timestamp: string;
  payload: any;
}

export interface AppState {
  tasks: Task[];
  filter: Filter;
  history: { tasks: Task[]; filter: Filter }[];
  historyIndex: number;
  actionLog: ActionLogEntry[];
}

export type Action =
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'createdAt'> }
  | { type: 'EDIT_TASK'; payload: { id: string; title: string; date: string } }
  | { type: 'DELETE_TASK'; payload: string } // id
  | { type: 'TOGGLE_TASK'; payload: string } // id
  | { type: 'REORDER_TASKS'; payload: Task[] }
  | { type: 'SET_FILTER'; payload: Filter }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD_STATE'; payload: { tasks: Task[]; filter: Filter } };