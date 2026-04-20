import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { createTodoApi } from '../services/todoApi.js';
import { useUndoHistory } from '../hooks/useUndoHistory.js';

const TodoContext = createContext(null);

export function isLate(task) {
  return task.date && !task.completed && new Date(task.date) < new Date();
}

export function TodoProvider({ children }) {
  const { accessToken, user } = useAuth();
  
  const api = useMemo(() => createTodoApi(accessToken), [accessToken]);
  
  const { state: tasks, setInitial, pushState, undo: historyUndo, redo: historyRedo } = useUndoHistory([]);
  const [actionLog, setActionLog] = useState([]);

  const logAction = useCallback((type, payload) => {
    setActionLog(log => [{ type, payload, timestamp: new Date().toISOString() }, ...log].slice(0, 100));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    api.fetchTasks().then(data => {
      setInitial(Array.isArray(data) ? data : []);
    });
  }, [api, accessToken, setInitial]);

  const addTask = useCallback(async (title, date) => {
    const order = tasks.length;
    const task = await api.addTask(title, date, order, user.sub);
    pushState([...tasks, task]);
    logAction('ADD_TASK', { title });
  }, [tasks, user, api, pushState, logAction]);

  const updateTask = useCallback(async (id, updates) => {
    const updated = await api.updateTask(id, updates);
    pushState(tasks.map(t => t.id === id ? updated : t));
    logAction('UPDATE_TASK', { id, updates });
  }, [tasks, api, pushState, logAction]);

  const deleteTask = useCallback(async (id) => {
    await api.deleteTask(id);
    pushState(tasks.filter(t => t.id !== id));
    logAction('DELETE_TASK', { id });
  }, [tasks, api, pushState, logAction]);

  const toggleTask = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await updateTask(id, { completed: !task.completed });
    logAction('TOGGLE_TASK', { id, completed: !task.completed });
  }, [tasks, updateTask, logAction]);

  const reorderTasks = useCallback(async (newOrder) => {
    pushState(newOrder);
    
    const updates = newOrder.map((t, i) => ({ id: t.id, order: i }));
    await api.bulkPatchTasks(updates);
    
    logAction('REORDER_TASKS', {});
  }, [api, pushState, logAction]);

  const undo = useCallback(async () => {
    const prev = historyUndo();
    if (!prev) return;
    logAction('UNDO', {});
    const updates = prev.map(t => ({ id: t.id, order: t.order, completed: t.completed, title: t.title, date: t.date }));
    await api.bulkPatchTasks(updates);
  }, [historyUndo, logAction, api]);

  const redo = useCallback(async () => {
    const next = historyRedo();
    if (!next) return;
    logAction('REDO', {});
    const updates = next.map(t => ({ id: t.id, order: t.order, completed: t.completed, title: t.title, date: t.date }));
    await api.bulkPatchTasks(updates);
  }, [historyRedo, logAction, api]);

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
