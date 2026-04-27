import TaskItem from './TaskItem.jsx';

const TaskList = ({ tasks, onEdit, onDelete, onToggle, onReorder }) => {
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'));
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const itemHeight = rect.height / tasks.length;
    let to = Math.floor(y / itemHeight);
    to = Math.max(0, Math.min(tasks.length - 1, to));
    if (to !== from) {
      onReorder(from, to);
    }
  };

  return (
    <div
      data-testid="task-list"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {tasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          index={index}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          onReorder={onReorder}
        />
      ))}
    </div>
  );
};

export default TaskList;