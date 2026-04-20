// A lightweight read-only card used only inside DragOverlay (no sortable hooks)
export default function TaskDragOverlay({ task }) {
  if (!task) return null
  return (
    <div
      className={`task-item${task.completed ? ' completed' : ''}${task.late ? ' late' : ''} dragging`}
      style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.7)', cursor: 'grabbing' }}
    >
      <span className="drag-handle">⠿</span>
      <div className={`task-checkbox${task.completed ? ' checked' : ''}`}>
        {task.completed && '✓'}
      </div>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
      </div>
    </div>
  )
}
