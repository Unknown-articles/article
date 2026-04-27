import { useRef, useState } from 'react'
import TaskItem from './TaskItem'

export default function TaskList({ tasks, onToggle, onEdit, onDelete, onReorder }) {
  const [draggingId, setDraggingId] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const dragIndexRef = useRef(null)

  function handleDragStart(e, index, id) {
    dragIndexRef.current = index
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, index) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIndex(index)
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === dropIndex) {
      reset()
      return
    }
    const next = [...tasks]
    const [moved] = next.splice(from, 1)
    next.splice(dropIndex, 0, moved)
    onReorder(next)
    reset()
  }

  function handleDragEnd() {
    reset()
  }

  function reset() {
    setDraggingId(null)
    setOverIndex(null)
    dragIndexRef.current = null
  }

  return (
    <ul data-testid="task-list" className="task-list">
      {tasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          isDragging={draggingId === task.id}
          dragHandleProps={{
            draggable: true,
            onDragStart: (e) => handleDragStart(e, index, task.id),
            onDragOver: (e) => handleDragOver(e, index),
            onDrop: (e) => handleDrop(e, index),
            onDragEnd: handleDragEnd,
          }}
        />
      ))}
    </ul>
  )
}
