export const FILTERS = {
  ALL: 'all',
  COMPLETED: 'completed',
  PENDING: 'pending',
  LATE: 'late',
};

export const STORAGE_KEY = 'momentum-tasks-state';

export function isTaskLate(task) {
  if (task.completed || !task.date) {
    return false;
  }

  return new Date(`${task.date}T23:59:59`).getTime() < Date.now();
}

export function createTask({ date, title }) {
  const createdAt = createTimestamp();

  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
    date,
    createdAt,
    isLate: isTaskLate({ completed: false, date }),
  };
}

export function normalizeTask(task) {
  return {
    ...task,
    isLate: isTaskLate(task),
  };
}

export function createTimestamp() {
  return new Date().toISOString();
}

export function filterTasks(tasks, activeFilter) {
  switch (activeFilter) {
    case FILTERS.COMPLETED:
      return tasks.filter((task) => task.completed);
    case FILTERS.PENDING:
      return tasks.filter((task) => !task.completed);
    case FILTERS.LATE:
      return tasks.filter((task) => task.isLate);
    case FILTERS.ALL:
    default:
      return tasks;
  }
}

export function reorderTasks(tasks, visibleTaskIds, sourceTaskId, targetTaskId) {
  const visibleSet = new Set(visibleTaskIds);
  const visibleTasks = tasks.filter((task) => visibleSet.has(task.id));
  const sourceIndex = visibleTasks.findIndex((task) => task.id === sourceTaskId);
  const targetIndex = visibleTasks.findIndex((task) => task.id === targetTaskId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return tasks;
  }

  const reorderedVisibleTasks = [...visibleTasks];
  const [movedTask] = reorderedVisibleTasks.splice(sourceIndex, 1);
  reorderedVisibleTasks.splice(targetIndex, 0, movedTask);

  let visibleCursor = 0;

  return tasks.map((task) => {
    if (!visibleSet.has(task.id)) {
      return task;
    }

    const nextTask = reorderedVisibleTasks[visibleCursor];
    visibleCursor += 1;
    return nextTask;
  });
}

export function readStoredAppState() {
  const emptyState = {
    history: {
      past: [],
      present: {
        tasks: [],
        activeFilter: FILTERS.ALL,
      },
      future: [],
    },
    actionLog: [],
  };

  const rawState = localStorage.getItem(STORAGE_KEY);

  if (!rawState) {
    return emptyState;
  }

  try {
    const parsed = JSON.parse(rawState);
    const parsedHistory = parsed.history;
    const present = parsedHistory?.present ?? {
      tasks: parsed.tasks ?? [],
      activeFilter: parsed.activeFilter ?? FILTERS.ALL,
    };

    return {
      history: {
        past: Array.isArray(parsedHistory?.past)
          ? parsedHistory.past.map((entry) => ({
              tasks: Array.isArray(entry.tasks) ? entry.tasks.map(normalizeTask) : [],
              activeFilter: Object.values(FILTERS).includes(entry.activeFilter)
                ? entry.activeFilter
                : FILTERS.ALL,
            }))
          : [],
        present: {
          tasks: Array.isArray(present.tasks) ? present.tasks.map(normalizeTask) : [],
          activeFilter: Object.values(FILTERS).includes(present.activeFilter)
            ? present.activeFilter
            : FILTERS.ALL,
        },
        future: Array.isArray(parsedHistory?.future)
          ? parsedHistory.future.map((entry) => ({
              tasks: Array.isArray(entry.tasks) ? entry.tasks.map(normalizeTask) : [],
              activeFilter: Object.values(FILTERS).includes(entry.activeFilter)
                ? entry.activeFilter
                : FILTERS.ALL,
            }))
          : [],
      },
      actionLog: Array.isArray(parsed.actionLog) ? parsed.actionLog : [],
    };
  } catch (error) {
    return emptyState;
  }
}
