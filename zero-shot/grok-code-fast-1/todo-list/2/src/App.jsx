import { useState, useEffect } from 'react';
import TaskForm from './components/TaskForm.jsx';
import Filters from './components/Filters.jsx';
import TaskList from './components/TaskList.jsx';
import ActionLog from './components/ActionLog.jsx';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [actionLog, setActionLog] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('tasks');
    if (saved) {
      const loadedTasks = JSON.parse(saved);
      setTasks(loadedTasks);
      setHistory([loadedTasks]);
      setHistoryIndex(0);
    }
  }, []);

  useEffect(() => {
    if (!isUndoing) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks, isUndoing]);

  const saveState = (newTasks) => {
    setTasks(newTasks);
    if (!isUndoing) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newTasks);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const addAction = (type, description, payload) => {
    const action = { type, description, timestamp: new Date().toISOString(), payload };
    setActionLog(prev => [...prev, action]);
  };

  const addTask = (title, date) => {
    const newTask = {
      id: Date.now().toString(),
      title,
      completed: false,
      date: date.toISOString(),
      createdAt: new Date().toISOString()
    };
    const newTasks = [...tasks, newTask];
    saveState(newTasks);
    addAction('ADD_TASK', `Added task "${title}"`, newTask);
  };

  const editTask = (id, title, date) => {
    const newTasks = tasks.map(task => task.id === id ? { ...task, title, date: date.toISOString() } : task);
    saveState(newTasks);
    addAction('EDIT_TASK', `Edited task "${title}"`, { id, title, date });
  };

  const deleteTask = (id) => {
    const task = tasks.find(t => t.id === id);
    const newTasks = tasks.filter(t => t.id !== id);
    saveState(newTasks);
    addAction('DELETE_TASK', `Deleted task "${task.title}"`, { id });
  };

  const toggleTask = (id) => {
    const task = tasks.find(t => t.id === id);
    const newTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveState(newTasks);
    addAction('TOGGLE_TASK', `Toggled task "${task.title}"`, { id });
  };

  const reorderTasks = (from, to) => {
    const newTasks = [...tasks];
    const [removed] = newTasks.splice(from, 1);
    newTasks.splice(to, 0, removed);
    saveState(newTasks);
    addAction('REORDER', 'Reordered tasks', { from, to });
  };

  const undo = () => {
    if (historyIndex > 0) {
      setIsUndoing(true);
      setTasks(history[historyIndex - 1]);
      setHistoryIndex(historyIndex - 1);
      setIsUndoing(false);
      addAction('UNDO', 'Undid last action', null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setIsUndoing(true);
      setTasks(history[historyIndex + 1]);
      setHistoryIndex(historyIndex + 1);
      setIsUndoing(false);
      addAction('REDO', 'Redid last action', null);
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [historyIndex, history.length]);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'completed') return task.completed;
    if (filter === 'pending') return !task.completed;
    if (filter === 'late') return !task.completed && new Date(task.date) < new Date();
  });

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    addAction('SET_FILTER', `Filtered by ${newFilter}`, { filter: newFilter });
  };

  const counts = {
    all: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    pending: tasks.filter(t => !t.completed).length,
    late: tasks.filter(t => !t.completed && new Date(t.date) < new Date()).length
  };

  return (
    <div className="app">
      <h1>To-Do List</h1>
      <TaskForm onSubmit={addTask} />
      <Filters filter={filter} onFilterChange={handleFilterChange} counts={counts} />
      <TaskList tasks={filteredTasks} onEdit={editTask} onDelete={deleteTask} onToggle={toggleTask} onReorder={reorderTasks} />
      <ActionLog actionLog={actionLog} />
    </div>
  );
}

export default App;

