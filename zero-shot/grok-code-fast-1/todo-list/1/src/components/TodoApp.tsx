import { useEffect, useRef } from 'react';
import { useTodo } from '../TodoContext';
import TaskForm from './TaskForm';
import TaskList from './TaskList';
import Filters from './Filters';
import ActionLog from './ActionLog';

const TodoApp: React.FC = () => {
  const { dispatch } = useTodo();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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
  }, [dispatch]);

  return (
    <div className="space-y-8">
      <TaskForm inputRef={inputRef} />
      <Filters />
      <TaskList />
      <ActionLog />
    </div>
  );
};

export default TodoApp;