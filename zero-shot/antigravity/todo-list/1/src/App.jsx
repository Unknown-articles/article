import React, { useState, useMemo } from 'react';
import TaskInput from './components/TaskInput';
import TaskList from './components/TaskList';
import FilterBar from './components/FilterBar';
import { useTask } from './context/TaskContext';

function App() {
  const { tasks } = useTask();
  const [filter, setFilter] = useState('All');

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filter === 'All') return true;
      if (filter === 'Pending') return !task.completed;
      if (filter === 'Completed') return task.completed;
      if (filter === 'Late') {
        if (task.completed || !task.date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = task.date.split('-');
        const dueDate = new Date(year, month - 1, day);
        return dueDate < today;
      }
      return true;
    });
  }, [tasks, filter]);

  return (
    <div className="app-container animate-slide-in">
      <h1>Todo List</h1>
      <TaskInput />
      <FilterBar filter={filter} setFilter={setFilter} />
      <TaskList tasks={filteredTasks} />
    </div>
  );
}

export default App;