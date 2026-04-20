import { useState, useCallback } from 'react';

export function useUndoHistory(initialState) {
  const [state, setState] = useState(initialState);
  const [history, setHistory] = useState([initialState]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const setInitial = useCallback((newState) => {
    setState(newState);
    setHistory([newState]);
    setHistoryIdx(0);
  }, []);

  const pushState = useCallback((newState) => {
    setHistory(h => {
      const trimmed = h.slice(0, historyIdx + 1);
      return [...trimmed, newState];
    });
    setHistoryIdx(i => i + 1);
    setState(newState);
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return null;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    setState(history[newIdx]);
    return history[newIdx];
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return null;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    setState(history[newIdx]);
    return history[newIdx];
  }, [history, historyIdx]);

  return { state, setInitial, pushState, undo, redo };
}
