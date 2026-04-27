import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Task, Action, Filter } from '../types';
import { filterTasks } from '../utils';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  filter: Filter;
  dispatch: (action: Action) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, filter, dispatch }) => {
  const filteredTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((task) => task.id === active.id);
      const newIndex = tasks.findIndex((task) => task.id === over.id);

      const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
      dispatch({ type: 'REORDER_TASKS', payload: reorderedTasks });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div data-testid="task-list" className="task-list">
          {filteredTasks.map((task) => (
            <TaskItem key={task.id} task={task} dispatch={dispatch} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};