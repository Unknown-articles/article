import { TaskItem } from './TaskItem';

export function TaskList({ tasks, onDeleteTask, onEditTask, onReorderTasks, onToggleTask }) {
  if (tasks.length === 0) {
    return (
      <section className="empty-state" data-testid="task-list">
        <p>No tasks yet. Add your first one above.</p>
      </section>
    );
  }

  return (
    <section className="task-list" data-testid="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          onDeleteTask={onDeleteTask}
          onEditTask={onEditTask}
          onReorderTasks={onReorderTasks}
          onToggleTask={onToggleTask}
          task={task}
        />
      ))}
    </section>
  );
}
