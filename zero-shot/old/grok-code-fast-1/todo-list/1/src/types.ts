export interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: Date;
  createdAt: Date;
}

export interface Action {
  type: string;
  timestamp: Date;
  payload?: any;
}

export type Filter = 'all' | 'completed' | 'pending' | 'late';