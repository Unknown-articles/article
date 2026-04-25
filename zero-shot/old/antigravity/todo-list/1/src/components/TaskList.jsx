import React from 'react';
import TaskItem from './TaskItem';

export default function TaskList({ tasks }) {
  if (tasks.length === 0) {
    return <div className="empty-state animate-slide-in">No tasks found. Relax! ✨</div>;
  }

  return (
    <div className="task-list">
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
