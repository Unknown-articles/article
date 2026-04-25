function applyFilters(items, query) {
  let filtered = items;
  for (const [key, value] of Object.entries(query)) {
    if (key === 'sort') continue;
    if (key === 'limit' || key === 'offset') continue;
    if (key === 'q') continue; // For general search, but skip for now

    const [field, op] = key.split('__');
    const operator = op || 'eq';
    filtered = filtered.filter(item => {
      const itemValue = item[field];
      switch (operator) {
        case 'eq': return itemValue == value;
        case 'ne': return itemValue != value;
        case 'gt': return itemValue > value;
        case 'lt': return itemValue < value;
        case 'gte': return itemValue >= value;
        case 'lte': return itemValue <= value;
        case 'contains': return itemValue && itemValue.includes(value);
        case 'between': return itemValue >= value[0] && itemValue <= value[1];
        default: return true;
      }
    });
  }
  return filtered;
}

function applySorting(items, sort) {
  if (!sort) return items;
  const [field, order] = sort.split(':');
  return items.sort((a, b) => {
    if (order === 'desc') {
      return a[field] > b[field] ? -1 : a[field] < b[field] ? 1 : 0;
    }
    return a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0;
  });
}

function applyPagination(items, limit, offset) {
  const start = offset || 0;
  const end = limit ? start + parseInt(limit) : items.length;
  return items.slice(start, end);
}

module.exports = { applyFilters, applySorting, applyPagination };