import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTodo } from '../TodoContext';
import TaskItem from './TaskItem';

const TaskList: React.FC = () => {
  const { state, dispatch, filteredTasks } = useTodo();
  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = state.tasks.findIndex((task) => task.id === active.id);
      const newIndex = state.tasks.findIndex((task) => task.id === over.id);

      const newTasks = arrayMove(state.tasks, oldIndex, newIndex);
      dispatch({ type: 'REORDER', payload: newTasks });
    }
  };

  return (
    <div data-testid="task-list" className="bg-white p-6 rounded-lg shadow-md">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={state.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                isEditing={editingId === task.id}
                onEdit={() => setEditingId(task.id)}
                onCancelEdit={() => setEditingId(null)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default TaskList;