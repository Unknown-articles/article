function parseValue(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => parseValue(item));
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (!Number.isNaN(Number(raw)) && String(raw).trim() !== '') return Number(raw);
  return String(raw);
}

function buildFilter(key, rawValue) {
  const [field, op = 'eq'] = key.split('__');
  const value = parseValue(rawValue);

  return {field, op, value};
}

function getFieldValue(item, field) {
  return field.split('.').reduce((obj, segment) => (obj && obj[segment] !== undefined ? obj[segment] : undefined), item);
}

function matchesCondition(item, filter) {
  const actual = getFieldValue(item, filter.field);
  const expected = filter.value;

  switch (filter.op) {
    case 'eq':
      return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
    case 'ne':
      return Array.isArray(expected) ? !expected.includes(actual) : actual !== expected;
    case 'gt':
      return typeof actual === 'number' && actual > expected;
    case 'gte':
      return typeof actual === 'number' && actual >= expected;
    case 'lt':
      return typeof actual === 'number' && actual < expected;
    case 'lte':
      return typeof actual === 'number' && actual <= expected;
    case 'between': {
      if (!Array.isArray(expected) || expected.length !== 2) return false;
      return typeof actual === 'number' && actual >= expected[0] && actual <= expected[1];
    }
    case 'contains':
      return actual != null && String(actual).toLowerCase().includes(String(expected).toLowerCase());
    case 'startswith':
      return actual != null && String(actual).toLowerCase().startsWith(String(expected).toLowerCase());
    case 'endswith':
      return actual != null && String(actual).toLowerCase().endsWith(String(expected).toLowerCase());
    case 'in': {
      const list = Array.isArray(expected) ? expected : String(expected).split(',').map(parseValue);
      return list.includes(actual);
    }
    default:
      return false;
  }
}

function parseFilters(query) {
  const filters = [];
  for (const [key, value] of Object.entries(query)) {
    if (['_limit', '_offset', '_sort', '_or'].includes(key)) continue;
    if (key.endsWith('__between')) {
      const [field] = key.split('__');
      const values = String(value).split(',').map((part) => parseValue(part.trim()));
      filters.push({field, op: 'between', value: values});
    } else {
      filters.push(buildFilter(key, value));
    }
  }
  return filters;
}

function applyFilters(items, query) {
  const filters = parseFilters(query);
  if (!filters.length) return items;

  const useOr = query._or === 'true' || query._or === true;
  return items.filter((item) => {
    const results = filters.map((filter) => matchesCondition(item, filter));
    return useOr ? results.some(Boolean) : results.every(Boolean);
  });
}

function applySort(items, sortParam) {
  if (!sortParam) return items;
  const keys = String(sortParam).split(',').map((token) => token.trim()).filter(Boolean);
  if (!keys.length) return items;

  return [...items].sort((a, b) => {
    for (const key of keys) {
      const desc = key.startsWith('-');
      const field = desc ? key.slice(1) : key;
      const left = getFieldValue(a, field);
      const right = getFieldValue(b, field);
      if (left === right) continue;
      if (left === undefined || left === null) return desc ? 1 : -1;
      if (right === undefined || right === null) return desc ? -1 : 1;
      if (typeof left === 'number' && typeof right === 'number') {
        return desc ? right - left : left - right;
      }
      const leftText = String(left).toLowerCase();
      const rightText = String(right).toLowerCase();
      if (leftText < rightText) return desc ? 1 : -1;
      if (leftText > rightText) return desc ? -1 : 1;
    }
    return 0;
  });
}

function applyPagination(items, query) {
  const limit = Number(query._limit);
  const offset = Number(query._offset) || 0;
  const start = Number.isNaN(offset) ? 0 : Math.max(offset, 0);
  if (Number.isNaN(limit) || limit <= 0) {
    return items.slice(start);
  }
  return items.slice(start, start + limit);
}

function queryCollection(items, query) {
  let results = applyFilters(items, query);
  results = applySort(results, query._sort);
  results = applyPagination(results, query);
  return results;
}

module.exports = {
  queryCollection,
  parseFilters,
  applySort,
  applyPagination,
  parseValue
};
