import { useState, useRef } from 'react';
import TaskItem from './TaskItem.jsx';

export default function TaskList({ tasks, allTasks, dispatch }) {
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const dragSourceId = useRef(null);

  function handleDragStart(id) {
    dragSourceId.current = id;
    setDraggingId(id);
  }

  function handleDragOver(e, id) {
    e.preventDefault();
    // Only update state when the target changes to avoid thrashing
    setDragOverId((prev) => (prev === id ? prev : id));
  }

  function handleDrop(e, targetId) {
    e.preventDefault();
    const sourceId = dragSourceId.current;
    if (!sourceId || sourceId === targetId) {
      cleanup();
      return;
    }

    // tasks is the currently-filtered view; allTasks is the full list.
    // We reorder only within the filtered subset but keep non-filtered items
    // in their original positions inside allTasks.
    const filteredIds = tasks.map((t) => t.id);
    const srcIdx = filteredIds.indexOf(sourceId);
    const tgtIdx = filteredIds.indexOf(targetId);
    if (srcIdx === -1 || tgtIdx === -1) { cleanup(); return; }

    // New order for the filtered subset
    const newFilteredIds = [...filteredIds];
    newFilteredIds.splice(srcIdx, 1);
    newFilteredIds.splice(tgtIdx, 0, sourceId);

    // Positions inside allTasks that belong to the filtered subset
    const filteredPositions = allTasks.reduce((acc, task, idx) => {
      if (filteredIds.includes(task.id)) acc.push(idx);
      return acc;
    }, []);

    // Place filtered tasks in the same slots, in new order
    const newAllTasks = [...allTasks];
    newFilteredIds.forEach((id, i) => {
      newAllTasks[filteredPositions[i]] = allTasks.find((t) => t.id === id);
    });

    dispatch({ type: 'REORDER', tasks: newAllTasks });
    cleanup();
  }

  function handleDragEnd() {
    cleanup();
  }

  function cleanup() {
    dragSourceId.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }

  if (tasks.length === 0) {
    return (
      <>
        <ul data-testid="task-list" className="task-list" />
        <p className="task-list-empty">No tasks to show.</p>
      </>
    );
  }

  return (
    <ul data-testid="task-list" className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          dispatch={dispatch}
          isDragOver={dragOverId === task.id}
          isDragging={draggingId === task.id}
          onDragStart={() => handleDragStart(task.id)}
          onDragOver={(e) => handleDragOver(e, task.id)}
          onDrop={(e) => handleDrop(e, task.id)}
          onDragEnd={handleDragEnd}
        />
      ))}
    </ul>
  );
}
