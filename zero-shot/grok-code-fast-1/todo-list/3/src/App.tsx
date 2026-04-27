import { useReducer, useEffect } from 'react';
import { reducer, initialState } from './reducer';
import { loadTasks, saveTasks } from './utils';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { Filters } from './components/Filters';
import { ActionLog } from './components/ActionLog';
import './App.css';

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load tasks on mount
  useEffect(() => {
    const tasks = loadTasks();
    dispatch({ type: 'LOAD_STATE', payload: { tasks, filter: 'all' } });
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    saveTasks(state.tasks);
  }, [state.tasks]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          dispatch({ type: 'UNDO' });
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          dispatch({ type: 'REDO' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFilterChange = (filter: any) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  };

  return (
    <div className="app">
      <h1>To-Do List</h1>
      <TaskForm dispatch={dispatch} />
      <Filters tasks={state.tasks} currentFilter={state.filter} onFilterChange={handleFilterChange} />
      <TaskList tasks={state.tasks} filter={state.filter} dispatch={dispatch} />
      <ActionLog log={state.actionLog} />
    </div>
  );
}

export default App;
