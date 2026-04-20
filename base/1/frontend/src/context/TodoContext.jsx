import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import * as todoService from '../services/todoService.js';

const TodoContext = createContext(null);

function isLate(task) {
  return task.date && !task.completed && new Date(task.date) < new Date();
}

export function TodoProvider({ children }) {
  const { accessToken, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [actionLog, setActionLog] = useState([]);

  const logAction = useCallback((type, payload) => {
    setActionLog(log => [{ type, payload, timestamp: new Date().toISOString() }, ...log].slice(0, 100));
  }, []);

  // Load tasks
  useEffect(() => {
    if (!accessToken) return;
    todoService.fetchTasks(accessToken)
      .then(data => {
        const sorted = Array.isArray(data) ? data : [];
        setTasks(sorted);
        setHistory([sorted]);
        setHistoryIdx(0);
      })
      .catch(() => {
        setTasks([]);
      });
  }, [accessToken]);

  function pushHistory(newTasks) {
    setHistory(h => {
      const trimmed = h.slice(0, historyIdx + 1);
      return [...trimmed, newTasks];
    });
    setHistoryIdx(i => i + 1);
    setTasks(newTasks);
  }

  const addTask = useCallback(async (title, date) => {
    const order = tasks.length;
    const task = await todoService.createTask({
      title,
      date: date || null,
      completed: false,
      ownerId: user.sub,
      order,
    }, accessToken);
    const next = [...tasks, task];
    pushHistory(next);
    logAction('ADD_TASK', { title });
  }, [tasks, user, accessToken, historyIdx]);

  const updateTask = useCallback(async (id, updates) => {
    const updated = await todoService.patchTask(id, updates, accessToken);
    const next = tasks.map(t => t.id === id ? updated : t);
    pushHistory(next);
    logAction('UPDATE_TASK', { id, updates });
  }, [tasks, accessToken, historyIdx]);

  const deleteTask = useCallback(async (id) => {
    await todoService.deleteTask(id, accessToken);
    const next = tasks.filter(t => t.id !== id);
    pushHistory(next);
    logAction('DELETE_TASK', { id });
  }, [tasks, accessToken, historyIdx]);

  const toggleTask = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await updateTask(id, { completed: !task.completed });
    logAction('TOGGLE_TASK', { id, completed: !task.completed });
  }, [tasks, updateTask]);

  const reorderTasks = useCallback(async (newOrder) => {
    const payload = newOrder.map((task, i) => ({ ...task, order: i }));
    setTasks(payload);
    await todoService.batchUpdateTasks('tasks', payload, accessToken);
    pushHistory(payload);
    logAction('REORDER_TASKS', {});
  }, [accessToken, historyIdx]);

  const undo = useCallback(async () => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const prev = history[newIdx];
    setTasks(prev);
    setHistoryIdx(newIdx);
    logAction('UNDO', {});
    await todoService.batchUpdateTasks('tasks', prev, accessToken);
  }, [history, historyIdx, accessToken]);

  const redo = useCallback(async () => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const next = history[newIdx];
    setTasks(next);
    setHistoryIdx(newIdx);
    logAction('REDO', {});
    await todoService.batchUpdateTasks('tasks', next, accessToken);
  }, [history, historyIdx, accessToken]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); }
      else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return (
    <TodoContext.Provider value={{ tasks, addTask, updateTask, deleteTask, toggleTask, reorderTasks, undo, redo, isLate, actionLog }}>
      {children}
    </TodoContext.Provider>
  );
}

export const useTodo = () => useContext(TodoContext);
