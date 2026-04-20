export const isTaskLate = (task) => {
  if (!task.date || task.completed) return false;
  const dueDate = new Date(task.date);
  // Set to end of the day for due date comparison, or just local date
  // Assuming task.date is "YYYY-MM-DD"
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.date + 'T00:00:00');
  return due < today;
};
