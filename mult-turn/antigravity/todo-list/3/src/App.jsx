import { useState, useEffect } from 'react';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import ActionLog from './components/ActionLog';
import './App.css';

function App() {
  const [todos, setTodos] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [viewFilter, setViewFilter] = useState('all');

  const appendAction = (type, description, payload = null) => {
    const newAction = {
      type,
      description,
      timestamp: new Date().toISOString(),
      payload
    };
    setActivityLog(prev => [newAction, ...prev]);
  };

  // Load from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      try {
        setTodos(JSON.parse(savedTasks));
      } catch (e) {
        console.error("Failed to parse tasks from local storage");
      }
    }
  }, []);

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const commitChange = (newTasks, description) => {
    setUndoStack(prev => [...prev, { todos, description }]);
    setRedoStack([]);
    setTodos(newTasks);
  };

  const undoLastChange = () => {
    if (undoStack.length === 0) return;
    const lastItem = undoStack[undoStack.length - 1];
    
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, { todos, description: lastItem.description }]);
    setTodos(lastItem.todos);
    
    appendAction('UNDO', `Undo: ${lastItem.description}`);
  };

  const redoLastChange = () => {
    if (redoStack.length === 0) return;
    const nextItem = redoStack[redoStack.length - 1];

    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, { todos, description: nextItem.description }]);
    setTodos(nextItem.todos);
    
    appendAction('REDO', `Redo: ${nextItem.description}`);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redoLastChange();
        } else {
          e.preventDefault();
          undoLastChange();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, todos]);

  // Save to localStorage when todos change
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(todos));
  }, [todos]);

  const createTodo = ({ title, date }) => {
    const newTask = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      date: date || '', // store empty string if no date
      createdAt: new Date().toISOString()
    };
    
    const desc = `Added todo: ${title}`;
    commitChange([newTask, ...todos], desc);
    appendAction('ADD_TODO', desc, newTask);
  };

  const toggleTodo = (id) => {
    const task = todos.find(t => t.id === id);
    if (!task) return;
    
    const desc = `Toggled todo: ${task.title}`;
    const newTasks = todos.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    commitChange(newTasks, desc);
    appendAction('TOGGLE_TODO', desc, { id, completed: !task.completed });
  };

  const renameTodo = (id, newTitle) => {
    const task = todos.find(t => t.id === id);
    if (!task) return;
    
    const desc = `Edited todo: ${task.title} -> ${newTitle}`;
    const newTasks = todos.map(t => 
      t.id === id ? { ...t, title: newTitle } : t
    );
    commitChange(newTasks, desc);
    appendAction('EDIT_TODO', desc, { id, oldTitle: task.title, newTitle });
  };

  const removeTodo = (id) => {
    const task = todos.find(t => t.id === id);
    if (!task) return;
    
    const desc = `Deleted todo: ${task.title}`;
    commitChange(todos.filter(t => t.id !== id), desc);
    appendAction('DELETE_TODO', desc, { id, title: task.title });
  };

  const applyFilter = (newFilter) => {
    setViewFilter(newFilter);
    appendAction('SET_FILTER', `Changed filter to: ${newFilter}`, { filter: newFilter });
  };

  const isOverdue = (task) => {
    if (!task.date || task.completed) return false;
    const today = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const localToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return task.date < localToday;
  };

  const summary = {
    all: todos.length,
    pending: todos.filter(t => !t.completed && !isOverdue(t)).length,
    completed: todos.filter(t => t.completed).length,
    late: todos.filter(t => isOverdue(t)).length,
  };

  const filteredTodos = todos.filter(task => {
    if (viewFilter === 'all') return true;
    if (viewFilter === 'pending') return !task.completed && !isOverdue(task);
    if (viewFilter === 'completed') return task.completed;
    if (viewFilter === 'late') return isOverdue(task);
    return true;
  });

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Task Master</h1>
        <p className="app-subtitle">Stay organized, focused, and on schedule.</p>
      </header>
      
      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <TaskForm createTodo={createTodo} />

        <div className="filters-container glass-panel">
          <button 
            data-testid="filter-all" 
            aria-pressed={viewFilter === 'all' ? "true" : "false"}
            onClick={() => applyFilter('all')}
            className={`filter-btn ${viewFilter === 'all' ? 'active' : ''}`}
          >
            All <span data-testid="filter-count-all" className="badge">{summary.all}</span>
          </button>
          <button 
            data-testid="filter-pending" 
            aria-pressed={viewFilter === 'pending' ? "true" : "false"}
            onClick={() => applyFilter('pending')}
            className={`filter-btn ${viewFilter === 'pending' ? 'active' : ''}`}
          >
            Pending <span data-testid="filter-count-pending" className="badge">{summary.pending}</span>
          </button>
          <button 
            data-testid="filter-completed" 
            aria-pressed={viewFilter === 'completed' ? "true" : "false"}
            onClick={() => applyFilter('completed')}
            className={`filter-btn ${viewFilter === 'completed' ? 'active' : ''}`}
          >
            Completed <span data-testid="filter-count-completed" className="badge">{summary.completed}</span>
          </button>
          <button 
            data-testid="filter-late" 
            aria-pressed={viewFilter === 'late' ? "true" : "false"}
            onClick={() => applyFilter('late')}
            className={`filter-btn ${viewFilter === 'late' ? 'active' : ''}`}
          >
            Late <span data-testid="filter-count-late" className="badge">{summary.late}</span>
          </button>
        </div>

        <TaskList 
          todos={filteredTodos} 
          toggleTodo={toggleTodo} 
          removeTodo={removeTodo}
          renameTodo={renameTodo}
        />
        
        <ActionLog activityLog={activityLog} />
      </main>
    </div>
  );
}

export default App;
