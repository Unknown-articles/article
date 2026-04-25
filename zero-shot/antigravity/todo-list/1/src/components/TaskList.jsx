import React, { useContext, useState } from 'react';
import { TodoContext } from '../App';
import TaskItem from './TaskItem';
import { isTaskLate } from '../utils';

export default function TaskList() {
  const { state, dispatch } = useContext(TodoContext);
  const { tasks, filter } = state;
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Filter logic
  const filteredTasks = tasks.filter(task => {
    if (filter === 'Completed') return task.completed;
    if (filter === 'Pending') return !task.completed;
    if (filter === 'Late') return isTaskLate(task);
    return true; // All
  });

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires some data to be set
    e.dataTransfer.setData('text/html', e.target.parentNode);
    e.dataTransfer.setDragImage(e.target.parentNode, 20, 20);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const sourceTask = filteredTasks[draggedIndex];
    const destinationTask = filteredTasks[index];

    // Find actual indices in the main tasks array
    const actualSourceIndex = tasks.findIndex(t => t.id === sourceTask.id);
    const actualDestIndex = tasks.findIndex(t => t.id === destinationTask.id);

    const newTasks = [...tasks];
    const [removed] = newTasks.splice(actualSourceIndex, 1);
    newTasks.splice(actualDestIndex, 0, removed);

    dispatch({
      type: 'REORDER',
      payload: { tasks: newTasks },
      description: `Reordered task "${removed.title}"`
    });

    setDraggedIndex(null);
  };

  if (filteredTasks.length === 0) {
    return (
      <div className="task-list" data-testid="task-list" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
        No tasks found.
      </div>
    );
  }

  return (
    <div className="task-list" data-testid="task-list">
      {filteredTasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          index={index}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
