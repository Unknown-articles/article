import type { Task, Filter } from './types';

export const isLate = (task: Task) => !task.completed && new Date(task.date) < new Date();

export const filterTasks = (tasks: Task[], filter: Filter) => {
  switch (filter) {
    case 'all':
      return tasks;
    case 'completed':
      return tasks.filter(t => t.completed);
    case 'pending':
      return tasks.filter(t => !t.completed);
    case 'late':
      return tasks.filter(isLate);
  }
};

export const getFilterCounts = (tasks: Task[]) => ({
  all: tasks.length,
  completed: tasks.filter(t => t.completed).length,
  pending: tasks.filter(t => !t.completed).length,
  late: tasks.filter(isLate).length
});

export const loadTasks = (): Task[] => {
  const stored = localStorage.getItem('tasks');
  return stored ? JSON.parse(stored) : [];
};

export const saveTasks = (tasks: Task[]) => {
  localStorage.setItem('tasks', JSON.stringify(tasks));
};