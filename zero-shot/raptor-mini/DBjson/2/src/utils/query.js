function parseValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (typeof raw !== 'string') return raw;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return Number(raw);
  }
  return raw;
}

function parseQueryOptions(query) {
  const filters = [];
  const options = {
    or: false,
    sort: null,
    order: 'asc',
    limit: null,
    offset: 0
  };

  Object.entries(query).forEach(([key, rawValue]) => {
    if (key === '_or') {
      options.or = String(rawValue).toLowerCase() === 'true';
      return;
    }
    if (key === '_sort') {
      options.sort = rawValue;
      return;
    }
    if (key === '_order') {
      const order = String(rawValue).toLowerCase();
      options.order = order === 'desc' ? 'desc' : 'asc';
      return;
    }
    if (key === '_limit') {
      options.limit = Number(rawValue) || null;
      return;
    }
    if (key === '_offset') {
      options.offset = Number(rawValue) || 0;
      return;
    }

    const [field, op = 'eq'] = key.split('__');
    const value = String(rawValue);
    const filter = { field, op, value };

    if (op === 'between') {
      filter.value = value.split(',').map((item) => parseValue(item.trim()));
    } else if (op === 'in') {
      filter.value = value.split(',').map((item) => parseValue(item.trim()));
    } else {
      filter.value = parseValue(value);
    }

    filters.push(filter);
  });

  return { filters, options };
}

function getFieldValue(item, field) {
  return Object.prototype.hasOwnProperty.call(item, field) ? item[field] : undefined;
}

function matchesFilter(item, filter) {
  const current = getFieldValue(item, filter.field);
  const target = filter.value;

  switch (filter.op) {
    case 'ne':
      return current !== target;
    case 'gt':
      return Number(current) > Number(target);
    case 'gte':
      return Number(current) >= Number(target);
    case 'lt':
      return Number(current) < Number(target);
    case 'lte':
      return Number(current) <= Number(target);
    case 'between':
      if (!Array.isArray(target) || target.length !== 2) return false;
      return Number(current) >= Number(target[0]) && Number(current) <= Number(target[1]);
    case 'contains':
      return typeof current === 'string' && current.toLowerCase().includes(String(target).toLowerCase());
    case 'startswith':
      return typeof current === 'string' && current.toLowerCase().startsWith(String(target).toLowerCase());
    case 'endswith':
      return typeof current === 'string' && current.toLowerCase().endsWith(String(target).toLowerCase());
    case 'in':
      return Array.isArray(target) && target.some((value) => value === current);
    case 'eq':
    default:
      return current === target;
  }
}

function applyQueryFilters(items, filters, isOr) {
  if (!filters.length) return items;
  return items.filter((item) => {
    const results = filters.map((filter) => matchesFilter(item, filter));
    return isOr ? results.some(Boolean) : results.every(Boolean);
  });
}

function sortItems(items, sortField, order) {
  if (!sortField) return items;
  return [...items].sort((a, b) => {
    const left = a[sortField];
    const right = b[sortField];
    if (left === undefined && right === undefined) return 0;
    if (left === undefined) return order === 'asc' ? 1 : -1;
    if (right === undefined) return order === 'asc' ? -1 : 1;
    if (left < right) return order === 'asc' ? -1 : 1;
    if (left > right) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

function paginateItems(items, limit, offset) {
  const total = items.length;
  const safeOffset = Math.max(0, offset || 0);
  const safeLimit = limit == null ? total : Math.max(0, limit);
  const data = items.slice(safeOffset, safeOffset + safeLimit);
  return { data, total, limit: limit == null ? undefined : safeLimit, offset: safeOffset };
}

module.exports = {
  parseQueryOptions,
  applyQueryFilters,
  sortItems,
  paginateItems
};
