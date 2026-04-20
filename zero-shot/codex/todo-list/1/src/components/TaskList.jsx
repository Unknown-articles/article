import { useState } from 'react';
import { TaskItem } from './TaskItem';

export function TaskList({
  onDeleteTask,
  onEditTask,
  onReorderTasks,
  onToggleTask,
  tasks,
}) {
  const [draggingTaskId, setDraggingTaskId] = useState(null);

  if (!tasks.length) {
    return (
      <div className="empty-state task-empty-state">
        <p>No tasks match this filter yet. Add one above to get started.</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <TaskItem
          draggingTaskId={draggingTaskId}
          key={task.id}
          onDragEnd={() => setDraggingTaskId(null)}
          onDragOverTask={(targetTaskId) => {
            if (draggingTaskId && draggingTaskId !== targetTaskId) {
              onReorderTasks(
                draggingTaskId,
                targetTaskId,
                tasks.map((item) => item.id),
              );
            }
          }}
          onDragStart={() => setDraggingTaskId(task.id)}
          onDeleteTask={onDeleteTask}
          onEditTask={onEditTask}
          onToggleTask={onToggleTask}
          task={task}
        />
      ))}
    </div>
  );
}
