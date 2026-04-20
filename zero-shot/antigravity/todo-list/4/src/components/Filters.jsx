import React, { useContext } from 'react';
import { TodoContext } from '../App';
import { isTaskLate } from '../utils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'late', label: 'Late' }
];

export default function Filters() {
  const { state, dispatch } = useContext(TodoContext);
  const { tasks, filter } = state;

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
    late: tasks.filter(t => isTaskLate(t)).length
  };

  return (
    <div className="filters">
      {FILTERS.map(f => {
        const isSelected = filter.toLowerCase() === f.id;
        return (
          <button
            key={f.id}
            className="filter-btn"
            data-testid={`filter-${f.id}`}
            aria-pressed={isSelected}
            onClick={() => {
              dispatch({
                type: 'SET_FILTER',
                payload: { filter: f.label },
                description: `Changed filter to ${f.label}`
              });
            }}
          >
            {f.label}
            <span className="filter-count" data-testid={`filter-count-${f.id}`}>
              {counts[f.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
