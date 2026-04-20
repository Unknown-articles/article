import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskItem } from './TaskItem';
import { Task, Filter } from '../types';

interface Props {
  tasks: Task[];
  filter: Filter;
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onReorder: (activeIndex: number, overIndex: number) => void;
}

export function TaskList({ tasks, filter, onToggle, onEdit, onDelete, onReorder }: Props) {
  const filteredTasks = tasks.filter(task => {
    const now = new Date();
    const isLate = !task.completed && task.date < now;
    switch (filter) {
      case 'all':
        return true;
      case 'completed':
        return task.completed;
      case 'pending':
        return !task.completed;
      case 'late':
        return isLate;
      default:
        return true;
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeIndex = tasks.findIndex(task => task.id === active.id);
      const overIndex = tasks.findIndex(task => task.id === over.id);
      onReorder(activeIndex, overIndex);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="task-list">
          {filteredTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}