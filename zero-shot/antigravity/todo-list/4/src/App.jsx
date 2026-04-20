import React, { useReducer, useEffect } from 'react';
import { reducer, initialState, initStore } from './store';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import Filters from './components/Filters';
import ActionLog from './components/ActionLog';
import { CheckSquare } from 'lucide-react';

export const TodoContext = React.createContext();

function App() {
  const [state, dispatch] = useReducer(reducer, initialState, initStore);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO', description: 'Undo last action' });
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'REDO', description: 'Redo last undone action' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TodoContext.Provider value={{ state, dispatch }}>
      <div className="app-container">
        <main>
          <div className="header">
            <h1><CheckSquare size={36} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '8px' }} />Tasks</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Manage your daily goals</p>
          </div>
          
          <TaskForm />
          <Filters />
          <TaskList />
        </main>
        
        <aside>
          <ActionLog />
        </aside>
      </div>
    </TodoContext.Provider>
  );
}

export default App;
