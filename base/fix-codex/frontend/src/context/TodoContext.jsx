import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  fetchTasks,
  createTask,
  patchTask,
  deleteTaskRequest,
  replaceTasks,
} from '../services/taskApi.js';
import { useUndoRedoShortcuts } from '../hooks/useUndoRedoShortcuts.js';

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

  useEffect(() => {
    if (!accessToken) return;

    fetchTasks(accessToken).then(data => {
      const sorted = Array.isArray(data) ? data : [];
      setTasks(sorted);
      setHistory([sorted]);
      setHistoryIdx(0);
    });
  }, [accessToken]);

  const pushHistory = useCallback((newTasks) => {
    setHistory(currentHistory => {
      const trimmed = currentHistory.slice(0, historyIdx + 1);
      return [...trimmed, newTasks];
    });
    setHistoryIdx(index => index + 1);
    setTasks(newTasks);
  }, [historyIdx]);

  const addTask = useCallback(async (title, date) => {
    const task = await createTask(accessToken, {
      title,
      date: date || null,
      completed: false,
      ownerId: user?.sub,
      order: tasks.length,
    });
    const next = [...tasks, task];
    pushHistory(next);
    logAction('ADD_TASK', { title });
  }, [accessToken, logAction, pushHistory, tasks, user]);

  const updateTask = useCallback(async (id, updates) => {
    const updated = await patchTask(accessToken, id, updates);
    const next = tasks.map(task => (task.id === id ? updated : task));
    pushHistory(next);
    logAction('UPDATE_TASK', { id, updates });
  }, [accessToken, logAction, pushHistory, tasks]);

  const deleteTask = useCallback(async (id) => {
    await deleteTaskRequest(accessToken, id);
    const next = tasks.filter(task => task.id !== id);
    pushHistory(next);
    logAction('DELETE_TASK', { id });
  }, [accessToken, logAction, pushHistory, tasks]);

  const toggleTask = useCallback(async (id) => {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    await updateTask(id, { completed: !task.completed });
    logAction('TOGGLE_TASK', { id, completed: !task.completed });
  }, [logAction, tasks, updateTask]);

  const reorderTasks = useCallback(async (newOrder) => {
    const reordered = newOrder.map((task, index) => ({ ...task, order: index }));
    setTasks(reordered);
    await replaceTasks(accessToken, reordered);
    pushHistory(reordered);
    logAction('REORDER_TASKS', {});
  }, [accessToken, logAction, pushHistory]);

  const undo = useCallback(async () => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const previous = history[newIdx];
    setTasks(previous);
    setHistoryIdx(newIdx);
    logAction('UNDO', {});
    await replaceTasks(accessToken, previous);
  }, [accessToken, history, historyIdx, logAction]);

  const redo = useCallback(async () => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const next = history[newIdx];
    setTasks(next);
    setHistoryIdx(newIdx);
    logAction('REDO', {});
    await replaceTasks(accessToken, next);
  }, [accessToken, history, historyIdx, logAction]);

  useUndoRedoShortcuts(undo, redo);

  return (
    <TodoContext.Provider value={{ tasks, addTask, updateTask, deleteTask, toggleTask, reorderTasks, undo, redo, isLate, actionLog }}>
      {children}
    </TodoContext.Provider>
  );
}

export const useTodo = () => useContext(TodoContext);
