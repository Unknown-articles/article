import { useRef, useState } from 'react';
import TaskItem from './TaskItem';

export default function TaskList({ tasks, onToggle, onEdit, onDelete, onReorder }) {
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (index) => (e) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (index) => (e) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) {
      setDragOverIndex(null);
      return;
    }
    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    onReorder(next);
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  return (
    <ul data-testid="task-list" className="task-list">
      {tasks.length === 0 && (
        <li className="task-empty">No tasks here.</li>
      )}
      {tasks.map((task, index) => (
        <li
          key={task.id}
          className={`task-list-item ${dragOverIndex === index ? 'drag-over' : ''}`}
          onDragOver={handleDragOver(index)}
          onDrop={handleDrop(index)}
        >
          <TaskItem
            task={task}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            isDragging={dragIndex.current === index}
            dragHandleProps={{
              draggable: true,
              onDragStart: handleDragStart(index),
              onDragEnd: handleDragEnd,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
