import { useState } from 'react';
import { useTodo, REORDER } from './TodoContext';
import TaskForm from './components/TaskForm';
import TaskItem from './components/TaskItem';
import Filters from './components/Filters';
import ActionLog from './components/ActionLog';
import './App.css';

function App() {
  const { state, dispatch } = useTodo();
  const { tasks, filter } = state;
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const getFilteredTasks = () => {
    switch (filter) {
      case 'COMPLETED':
        return tasks.filter(t => t.completed);
      case 'PENDING':
        return tasks.filter(t => !t.completed);
      case 'LATE':
        return tasks.filter(t => !t.completed && t.date && new Date(t.date) < new Date(new Date().setHours(0, 0, 0, 0)));
      case 'ALL':
      default:
        return tasks;
    }
  };

  const filteredTasks = getFilteredTasks();

  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires dataTransfer data to be set
    e.dataTransfer.setData('text/html', e.target.parentNode);
    e.dataTransfer.setDragImage(e.target, 20, 20);
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null) return;
    if (draggedItemIndex === index) return;
    
    // Only allow reorder when viewing ALL tasks, or we could dispatch a reorder on the main task list.
    // For simplicity, we find the real index in the main tasks array.
    const draggedTask = filteredTasks[draggedItemIndex];
    const targetTask = filteredTasks[index];
    
    const realStartIndex = tasks.findIndex(t => t.id === draggedTask.id);
    const realEndIndex = tasks.findIndex(t => t.id === targetTask.id);

    if (realStartIndex !== -1 && realEndIndex !== -1) {
      dispatch({ 
        type: REORDER, 
        payload: { startIndex: realStartIndex, endIndex: realEndIndex } 
      });
      setDraggedItemIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Vite Tasks</h1>
        <p>A premium React To-Do List</p>
      </header>

      <main>
        <TaskForm />
        <Filters />

        <div className="task-list" data-testid="task-list">
          {filteredTasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              index={index}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
            />
          ))}
          {filteredTasks.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              No tasks found.
            </div>
          )}
        </div>

        <ActionLog />
      </main>
    </div>
  );
}

export default App;
