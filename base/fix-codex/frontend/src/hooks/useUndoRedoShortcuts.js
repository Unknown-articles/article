import { useEffect } from 'react';

export function useUndoRedoShortcuts(undo, redo) {
  useEffect(() => {
    const handler = event => {
      if (event.ctrlKey && event.shiftKey && event.key === 'Z') {
        event.preventDefault();
        redo();
      } else if (event.ctrlKey && event.key === 'z') {
        event.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [redo, undo]);
}
