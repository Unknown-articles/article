import { useState, useEffect } from 'react';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import ActionLog from './components/ActionLog';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [actions, setActions] = useState([]);
  const [filter, setFilter] = useState('all');

  const logAction = (type, description, payload = null) => {
    const newAction = {
      type,
      description,
      timestamp: new Date().toISOString(),
      payload
    };
    setActions(prev => [newAction, ...prev]);
  };

  // Load from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error("Failed to parse tasks from local storage");
      }
    }
  }, []);

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const applyWithHistory = (newTasks, description) => {
    setUndoStack(prev => [...prev, { tasks, description }]);
    setRedoStack([]);
    setTasks(newTasks);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const lastItem = undoStack[undoStack.length - 1];
    
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, { tasks, description: lastItem.description }]);
    setTasks(lastItem.tasks);
    
    logAction('UNDO', `Undo: ${lastItem.description}`);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextItem = redoStack[redoStack.length - 1];

    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, { tasks, description: nextItem.description }]);
    setTasks(nextItem.tasks);
    
    logAction('REDO', `Redo: ${nextItem.description}`);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, tasks]);

  // Save to localStorage when tasks change
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = ({ title, date }) => {
    const newTask = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      date: date || '', // store empty string if no date
      createdAt: new Date().toISOString()
    };
    
    const desc = `Added task: ${title}`;
    applyWithHistory([newTask, ...tasks], desc);
    logAction('ADD_TASK', desc, newTask);
  };

  const toggleTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const desc = `Toggled task: ${task.title}`;
    const newTasks = tasks.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    applyWithHistory(newTasks, desc);
    logAction('TOGGLE_TASK', desc, { id, completed: !task.completed });
  };

  const updateTaskTitle = (id, newTitle) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const desc = `Edited task: ${task.title} -> ${newTitle}`;
    const newTasks = tasks.map(t => 
      t.id === id ? { ...t, title: newTitle } : t
    );
    applyWithHistory(newTasks, desc);
    logAction('EDIT_TASK', desc, { id, oldTitle: task.title, newTitle });
  };

  const deleteTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const desc = `Deleted task: ${task.title}`;
    applyWithHistory(tasks.filter(t => t.id !== id), desc);
    logAction('DELETE_TASK', desc, { id, title: task.title });
  };

  const updateFilter = (newFilter) => {
    setFilter(newFilter);
    logAction('SET_FILTER', `Changed filter to: ${newFilter}`, { filter: newFilter });
  };

  const isLate = (task) => {
    if (!task.date || task.completed) return false;
    const today = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const localToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return task.date < localToday;
  };

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => !t.completed && !isLate(t)).length,
    completed: tasks.filter(t => t.completed).length,
    late: tasks.filter(t => isLate(t)).length,
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !task.completed && !isLate(task);
    if (filter === 'completed') return task.completed;
    if (filter === 'late') return isLate(task);
    return true;
  });

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Task Master</h1>
        <p className="app-subtitle">Stay organized, focused, and on schedule.</p>
      </header>
      
      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <TaskForm addTask={addTask} />

        <div className="filters-container glass-panel">
          <button 
            data-testid="filter-all" 
            aria-pressed={filter === 'all' ? "true" : "false"}
            onClick={() => updateFilter('all')}
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          >
            All <span data-testid="filter-count-all" className="badge">{counts.all}</span>
          </button>
          <button 
            data-testid="filter-pending" 
            aria-pressed={filter === 'pending' ? "true" : "false"}
            onClick={() => updateFilter('pending')}
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          >
            Pending <span data-testid="filter-count-pending" className="badge">{counts.pending}</span>
          </button>
          <button 
            data-testid="filter-completed" 
            aria-pressed={filter === 'completed' ? "true" : "false"}
            onClick={() => updateFilter('completed')}
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          >
            Completed <span data-testid="filter-count-completed" className="badge">{counts.completed}</span>
          </button>
          <button 
            data-testid="filter-late" 
            aria-pressed={filter === 'late' ? "true" : "false"}
            onClick={() => updateFilter('late')}
            className={`filter-btn ${filter === 'late' ? 'active' : ''}`}
          >
            Late <span data-testid="filter-count-late" className="badge">{counts.late}</span>
          </button>
        </div>

        <TaskList 
          tasks={filteredTasks} 
          toggleTask={toggleTask} 
          deleteTask={deleteTask}
          updateTaskTitle={updateTaskTitle}
        />
        
        <ActionLog actions={actions} />
      </main>
    </div>
  );
}

export default App;
