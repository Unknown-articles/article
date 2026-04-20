export interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string; // ISO date string
  createdAt: string; // ISO date string
}

export interface Action {
  type: 'ADD_TASK' | 'EDIT_TASK' | 'DELETE_TASK' | 'TOGGLE_TASK' | 'REORDER' | 'SET_FILTER' | 'UNDO' | 'REDO';
  description: string;
  timestamp: string;
  payload: any;
}

export type Filter = 'all' | 'completed' | 'pending' | 'late';