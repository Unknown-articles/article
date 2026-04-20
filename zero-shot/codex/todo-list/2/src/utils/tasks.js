export function createTask({ title, date }) {
  const createdAt = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title,
    completed: false,
    date,
    createdAt,
  };
}

export function isTaskLate(task) {
  if (!task.date || task.completed) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return new Date(`${task.date}T00:00:00`).getTime() < today.getTime();
}

export function loadStoredTasks(storageKey) {
  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(
      (task) =>
        task &&
        typeof task.id === 'string' &&
        typeof task.title === 'string' &&
        typeof task.completed === 'boolean' &&
        typeof task.createdAt === 'string' &&
        typeof task.date === 'string',
    );
  } catch {
    return [];
  }
}

export function reorderTasks(tasks, sourceTaskId, targetTaskId) {
  const sourceIndex = tasks.findIndex((task) => task.id === sourceTaskId);
  const targetIndex = tasks.findIndex((task) => task.id === targetTaskId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return tasks;
  }

  const nextTasks = [...tasks];
  const [movedTask] = nextTasks.splice(sourceIndex, 1);
  nextTasks.splice(targetIndex, 0, movedTask);
  return nextTasks;
}
