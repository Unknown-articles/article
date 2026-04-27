export function isTaskLate(task) {
  if (task.completed || !task.date) return false
  const due = new Date(task.date)
  due.setHours(23, 59, 59, 999)
  return due < new Date()
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
