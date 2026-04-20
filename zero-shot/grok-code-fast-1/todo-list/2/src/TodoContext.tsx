import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { State, ActionType, reducer, initialState } from './store';
import { Task } from './types';

interface TodoContextType {
  state: State;
  dispatch: React.Dispatch<ActionType>;
  filteredTasks: Task[];
  taskCounts: { all: number; completed: number; pending: number; late: number };
}

const TodoContext = createContext<TodoContextType | undefined>(undefined);

export const TodoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load from localStorage
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      const tasks: Task[] = JSON.parse(savedTasks);
      dispatch({ type: 'LOAD_TASKS', payload: tasks });
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
  }, [state.tasks]);

  // Filtered tasks
  const filteredTasks = state.tasks.filter(task => {
    const now = new Date();
    const dueDate = new Date(task.date);
    const isLate = dueDate < now && !task.completed;
    switch (state.filter) {
      case 'completed':
        return task.completed;
      case 'pending':
        return !task.completed;
      case 'late':
        return isLate;
      default:
        return true;
    }
  });

  // Task counts
  const taskCounts = {
    all: state.tasks.length,
    completed: state.tasks.filter(t => t.completed).length,
    pending: state.tasks.filter(t => !t.completed).length,
    late: state.tasks.filter(t => {
      const dueDate = new Date(t.date);
      return dueDate < new Date() && !t.completed;
    }).length,
  };

  return (
    <TodoContext.Provider value={{ state, dispatch, filteredTasks, taskCounts }}>
      {children}
    </TodoContext.Provider>
  );
};

export const useTodo = () => {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodo must be used within TodoProvider');
  }
  return context;
};