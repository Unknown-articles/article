const KEY = 'tasks';

export const loadTasks = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveTasks = (tasks) => {
  localStorage.setItem(KEY, JSON.stringify(tasks));
};
