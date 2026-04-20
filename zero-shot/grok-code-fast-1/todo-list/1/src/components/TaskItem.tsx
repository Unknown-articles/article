import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSwipeable } from 'react-swipeable';
import { Task } from '../types';
import { format } from 'date-fns';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onToggle, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDate, setEditDate] = useState(task.date.toISOString().split('T')[0]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => onDelete(task.id),
    onTap: () => onToggle(task.id),
    preventScrollOnSwipe: true,
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEdit(task.id, { title: editTitle.trim(), date: new Date(editDate) });
    setEditing(false);
  };

  const now = new Date();
  const isLate = !task.completed && task.date < now;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-item ${task.completed ? 'completed' : ''} ${isLate ? 'late' : ''} ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
      {...handlers}
    >
      {editing ? (
        <form onSubmit={handleEditSubmit} className="edit-form">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            required
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <>
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggle(task.id)}
          />
          <div className="task-content">
            <span className="title">{task.title}</span>
            <span className="date">{format(task.date, 'MMM dd, yyyy')}</span>
            {isLate && <span className="late-label">Late</span>}
          </div>
          <button onClick={() => setEditing(true)}>Edit</button>
          <button onClick={() => onDelete(task.id)}>Delete</button>
        </>
      )}
    </div>
  );
}