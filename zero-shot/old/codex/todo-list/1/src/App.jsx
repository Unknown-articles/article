import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { TaskBoard } from './components/TaskBoard';
import { ActionLog } from './components/ActionLog';
import {
  STORAGE_KEY,
  createTask,
  createTimestamp,
  filterTasks,
  normalizeTask,
  readStoredAppState,
  reorderTasks,
} from './lib/tasks';

function App() {
  const [storedState] = useState(() => readStoredAppState());
  const [history, setHistory] = useState(storedState.history);
  const [actionLog, setActionLog] = useState(storedState.actionLog);
  const historyRef = useRef(history);
  const { activeFilter, tasks } = history.present;

  const visibleTasks = useMemo(
    () => filterTasks(tasks, activeFilter),
    [activeFilter, tasks],
  );

  const completedCount = tasks.filter((task) => task.completed).length;
  const lateCount = tasks.filter((task) => !task.completed && task.isLate).length;

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        history,
        actionLog,
      }),
    );
  }, [actionLog, history]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isUndo = event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'z';
      const isRedo = event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z';

      if (isUndo) {
        event.preventDefault();
        if (historyRef.current.past.length) {
          handleUndo();
        }
      }

      if (isRedo) {
        event.preventDefault();
        if (historyRef.current.future.length) {
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pushAction = (type, payload) => {
    setActionLog((currentLog) => [
      {
        id: crypto.randomUUID(),
        type,
        timestamp: createTimestamp(),
        payload,
      },
      ...currentLog,
    ].slice(0, 24));
  };

  const commitChange = (updater, actionType, payload) => {
    setHistory((currentHistory) => {
      const nextPresent = updater(currentHistory.present);

      if (JSON.stringify(nextPresent) === JSON.stringify(currentHistory.present)) {
        return currentHistory;
      }

      return {
        past: [...currentHistory.past, currentHistory.present].slice(-40),
        present: nextPresent,
        future: [],
      };
    });

    pushAction(actionType, payload);
  };

  const handleCreateTask = (values) => {
    const task = createTask(values);
    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: [task, ...currentPresent.tasks],
      }),
      'ADD_TASK',
      {
      id: task.id,
      title: task.title,
      date: task.date,
      },
    );
  };

  const handleUpdateTask = (taskId, values) => {
    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: currentPresent.tasks.map((task) =>
          task.id === taskId
            ? normalizeTask({
                ...task,
                ...values,
              })
            : task,
        ),
      }),
      'UPDATE_TASK',
      {
        id: taskId,
        title: values.title,
        date: values.date,
      },
    );
  };

  const handleDeleteTask = (taskId) => {
    const taskToDelete = tasks.find((task) => task.id === taskId);
    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: currentPresent.tasks.filter((task) => task.id !== taskId),
      }),
      'DELETE_TASK',
      taskToDelete ? { id: taskId, title: taskToDelete.title } : { id: taskId },
    );
  };

  const handleToggleTask = (taskId) => {
    const taskToToggle = tasks.find((task) => task.id === taskId);
    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: currentPresent.tasks.map((task) =>
          task.id === taskId
            ? normalizeTask({
                ...task,
                completed: !task.completed,
              })
            : task,
        ),
      }),
      'TOGGLE_TASK',
      {
        id: taskId,
        completed: taskToToggle ? !taskToToggle.completed : undefined,
      },
    );
  };

  const handleFilterChange = (filterId) => {
    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        activeFilter: filterId,
      }),
      'SET_FILTER',
      {
        filter: filterId,
      },
    );
  };

  const handleUndo = () => {
    if (!historyRef.current.past.length) {
      return;
    }

    setHistory((currentHistory) => {
      const previousPresent = currentHistory.past[currentHistory.past.length - 1];
      const nextPast = currentHistory.past.slice(0, -1);

      return {
        past: nextPast,
        present: previousPresent,
        future: [currentHistory.present, ...currentHistory.future].slice(0, 40),
      };
    });
    pushAction('UNDO', {
      remainingPast: Math.max(historyRef.current.past.length - 1, 0),
    });
  };

  const handleRedo = () => {
    if (!historyRef.current.future.length) {
      return;
    }

    setHistory((currentHistory) => {
      const nextPresent = currentHistory.future[0];

      return {
        past: [...currentHistory.past, currentHistory.present].slice(-40),
        present: nextPresent,
        future: currentHistory.future.slice(1),
      };
    });
    pushAction('REDO', {
      remainingFuture: Math.max(historyRef.current.future.length - 1, 0),
    });
  };

  const handleReorderTasks = (sourceTaskId, targetTaskId, visibleTaskIds) => {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) {
      return;
    }

    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: reorderTasks(currentPresent.tasks, visibleTaskIds, sourceTaskId, targetTaskId),
      }),
      'REORDER_TASKS',
      {
        sourceTaskId,
        targetTaskId,
      },
    );
  };

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />
      <main className="app-layout">
        <Header />
        <section className="workspace-grid">
          <TaskBoard
            activeFilter={activeFilter}
            completedCount={completedCount}
            lateCount={lateCount}
            onCreateTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
            onFilterChange={handleFilterChange}
            onReorderTasks={handleReorderTasks}
            onToggleTask={handleToggleTask}
            onRedo={handleRedo}
            onUndo={handleUndo}
            onUpdateTask={handleUpdateTask}
            redoDisabled={!history.future.length}
            tasks={visibleTasks}
            totalCount={tasks.length}
            undoDisabled={!history.past.length}
          />
          <ActionLog actions={actionLog} />
        </section>
      </main>
    </div>
  );
}

export default App;
