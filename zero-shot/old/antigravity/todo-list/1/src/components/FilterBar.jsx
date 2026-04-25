import React from 'react';

export default function FilterBar({ filter, setFilter }) {
  const filters = ['All', 'Pending', 'Completed', 'Late'];
  
  return (
    <div className="filter-bar animate-slide-in">
      {filters.map(f => (
        <button 
          key={f} 
          className={`filter-btn ${filter === f ? 'active' : ''}`}
          onClick={() => setFilter(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
