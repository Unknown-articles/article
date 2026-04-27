export const isLate = (task) => {
  if (task.completed || !task.date) return false;
  return new Date(task.date) < new Date(new Date().toDateString());
};
