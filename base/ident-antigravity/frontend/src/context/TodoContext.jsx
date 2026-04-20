import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';

const TodoContext = createContext(null);
const BACKEND = 'http://localhost:3001';

function isLate(task) {
  return task.date && !task.completed && new Date(task.date) < new Date();
}

export function TodoProvider({ children }) {
  const { accessToken, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [actionLog, setActionLog] = useState([]);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

  const logAction = useCallback((type, payload) => {
    setActionLog(log => [{ type, payload, timestamp: new Date().toISOString() }, ...log].slice(0, 100));
  }, []);

  // Load tasks
  useEffect(() => {
    fetch(`${BACKEND}/tasks?_sort=order&_order=asc`, { headers })
      .then(r => r.json())
      .then(data => {
        const sorted = Array.isArray(data) ? data : [];
        setTasks(sorted);
        setHistory([sorted]);
        setHistoryIdx(0);
      });
  }, []);

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
    const resp = await fetch(`${BACKEND}/tasks`, {
      method: 'POST', headers,
      body: JSON.stringify({ title, date: date || null, completed: false, ownerId: user.sub, order }),
    });
    const task = await resp.json();
    const next = [...tasks, task];
    pushHistory(next);
    logAction('ADD_TASK', { title });
  }, [tasks, user, headers, historyIdx]);

  const updateTask = useCallback(async (id, updates) => {
    const resp = await fetch(`${BACKEND}/tasks/${id}`, {
      method: 'PATCH', headers, body: JSON.stringify(updates),
    });
    const updated = await resp.json();
    const next = tasks.map(t => t.id === id ? updated : t);
    pushHistory(next);
    logAction('UPDATE_TASK', { id, updates });
  }, [tasks, headers, historyIdx]);

  const deleteTask = useCallback(async (id) => {
    await fetch(`${BACKEND}/tasks/${id}`, { method: 'DELETE', headers });
    const next = tasks.filter(t => t.id !== id);
    pushHistory(next);
    logAction('DELETE_TASK', { id });
  }, [tasks, headers, historyIdx]);

  const toggleTask = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await updateTask(id, { completed: !task.completed });
    logAction('TOGGLE_TASK', { id, completed: !task.completed });
  }, [tasks, updateTask]);

  const reorderTasks = useCallback(async (newOrder) => {
    setTasks(newOrder);
    await Promise.all(newOrder.map((t, i) =>
      fetch(`${BACKEND}/tasks/${t.id}`, { method: 'PATCH', headers, body: JSON.stringify({ order: i }) })
    ));
    pushHistory(newOrder);
    logAction('REORDER_TASKS', {});
  }, [tasks, headers, historyIdx]);

  const undo = useCallback(async () => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const prev = history[newIdx];
    setTasks(prev);
    setHistoryIdx(newIdx);
    logAction('UNDO', {});
    // Sync to backend
    for (const task of prev) {
      await fetch(`${BACKEND}/tasks/${task.id}`, { method: 'PUT', headers, body: JSON.stringify(task) });
    }
  }, [history, historyIdx, headers]);

  const redo = useCallback(async () => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const next = history[newIdx];
    setTasks(next);
    setHistoryIdx(newIdx);
    logAction('REDO', {});
    for (const task of next) {
      await fetch(`${BACKEND}/tasks/${task.id}`, { method: 'PUT', headers, body: JSON.stringify(task) });
    }
  }, [history, historyIdx, headers]);

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
