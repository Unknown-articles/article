import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import { useTasks } from '../context/TaskContext'
import TaskItem from './TaskItem'
import TaskDragOverlay from './TaskDragOverlay'

export default function TaskList() {
  const { filteredTasks, tasks, reorder, filter } = useTasks()
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(e) {
    setActiveId(e.active.id)
  }

  function handleDragEnd(e) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return

    // Reorder within the full task list (not filtered)
    const oldIdx = tasks.findIndex(t => t.id === active.id)
    const newIdx = tasks.findIndex(t => t.id === over.id)
    if (oldIdx !== -1 && newIdx !== -1) {
      reorder(arrayMove(tasks, oldIdx, newIdx))
    }
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  if (filteredTasks.length === 0) {
    const msgs = {
      all:       { icon: '📋', text: 'No tasks yet — add one above!' },
      completed: { icon: '🎉', text: 'No completed tasks.' },
      pending:   { icon: '✅', text: 'No pending tasks.' },
      late:      { icon: '🕐', text: 'No late tasks. Great job!' },
    }
    const { icon, text } = msgs[filter] ?? msgs.all
    return (
      <div className="task-list-empty">
        <span className="empty-icon">{icon}</span>
        {text}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="task-list" role="list" data-testid="task-list">
          {filteredTasks.map(task => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        <TaskDragOverlay task={activeTask} />
      </DragOverlay>
    </DndContext>
  )
}
