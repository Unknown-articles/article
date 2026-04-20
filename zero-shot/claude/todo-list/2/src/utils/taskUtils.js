export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function isLate(task) {
  if (task.completed || !task.date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.date);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

export function filterTasks(tasks, filter) {
  switch (filter) {
    case 'completed':
      return tasks.filter((t) => t.completed);
    case 'pending':
      return tasks.filter((t) => !t.completed && !isLate(t));
    case 'late':
      return tasks.filter((t) => isLate(t));
    default:
      return tasks;
  }
}

export function getCounts(tasks) {
  return {
    all: tasks.length,
    completed: tasks.filter((t) => t.completed).length,
    pending: tasks.filter((t) => !t.completed && !isLate(t)).length,
    late: tasks.filter((t) => isLate(t)).length,
  };
}
