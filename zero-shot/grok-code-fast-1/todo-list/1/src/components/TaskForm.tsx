import { useState, FormEvent, RefObject } from 'react';
import { useTodo } from '../TodoContext';

interface TaskFormProps {
  inputRef: RefObject<HTMLInputElement>;
}

const TaskForm: React.FC<TaskFormProps> = ({ inputRef }) => {
  const { dispatch } = useTodo();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      dispatch({
        type: 'ADD_TASK',
        payload: { title: title.trim(), completed: false, date },
      });
      setTitle('');
      setDate('');
      inputRef.current?.focus();
    }
  };

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-col space-y-4">
        <input
          ref={inputRef}
          data-testid="task-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task title..."
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          data-testid="task-date-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button
          data-testid="task-submit"
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add Task
        </button>
      </div>
    </form>
  );
};

export default TaskForm;