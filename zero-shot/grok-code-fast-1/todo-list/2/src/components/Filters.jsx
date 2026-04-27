const Filters = ({ filter, onFilterChange, counts }) => {
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'late', label: 'Late' },
  ];

  return (
    <div>
      {filters.map(({ key, label }) => (
        <button
          key={key}
          data-testid={`filter-${key}`}
          aria-pressed={filter === key}
          onClick={() => onFilterChange(key)}
        >
          {label} <span data-testid={`filter-count-${key}`}>{counts[key]}</span>
        </button>
      ))}
    </div>
  );
};

export default Filters;