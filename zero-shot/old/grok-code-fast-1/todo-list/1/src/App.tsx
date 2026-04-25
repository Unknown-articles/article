import { useState, useEffect } from 'react';
import { AddTaskForm } from './components/AddTaskForm';
import { TaskList } from './components/TaskList';
import { Filters } from './components/Filters';
import { ActionLog } from './components/ActionLog';
import { useTasks } from './hooks/useTasks';
import { Filter } from './types';
import './App.css';

function App() {
  const { tasks, actionLog, canUndo, canRedo, addTask, editTask, deleteTask, toggleComplete, reorderTasks, undo, redo } = useTasks();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey && canUndo) {
          e.preventDefault();
          undo();
        } else if ((e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  return (
    <div className="app">
      <h1>To-Do List</h1>
      <AddTaskForm onAdd={addTask} />
      <Filters currentFilter={filter} onFilterChange={setFilter} />
      <TaskList
        tasks={tasks}
        filter={filter}
        onToggle={toggleComplete}
        onEdit={editTask}
        onDelete={deleteTask}
        onReorder={reorderTasks}
      />
      <ActionLog actions={actionLog} />
    </div>
  );
}

export default App;
