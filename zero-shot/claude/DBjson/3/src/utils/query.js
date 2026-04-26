const RESERVED = new Set(['_sort', '_order', '_limit', '_offset', '_or']);

/**
 * Coerce a query-string value to a JS primitive.
 * Allows `?active=false` to match boolean false stored in DB.
 */
function coerce(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  const n = Number(val);
  if (val !== '' && !isNaN(n)) return n;
  return val;
}

function coerceNum(val) {
  const n = Number(val);
  if (isNaN(n)) throw new Error(`Expected number, got "${val}"`);
  return n;
}

/**
 * Parse query params into an array of filter condition objects.
 * Each condition: { field, op, value }
 */
function parseFilters(query) {
  const filters = [];
  const OPS = ['__between', '__contains', '__startswith', '__endswith',
               '__gte', '__lte', '__gt', '__lt', '__ne', '__in'];

  for (const [key, raw] of Object.entries(query)) {
    if (RESERVED.has(key)) continue;

    let matched = false;
    for (const op of OPS) {
      if (key.endsWith(op)) {
        const field = key.slice(0, -op.length);
        filters.push({ field, op: op.slice(2), value: raw });
        matched = true;
        break;
      }
    }
    if (!matched) {
      filters.push({ field: key, op: 'eq', value: raw });
    }
  }
  return filters;
}

function applyCondition(item, { field, op, value }) {
  const stored = item[field];
  switch (op) {
    case 'eq':
      return stored === coerce(value);
    case 'ne':
      return stored !== coerce(value);
    case 'gt':
      return stored > coerceNum(value);
    case 'gte':
      return stored >= coerceNum(value);
    case 'lt':
      return stored < coerceNum(value);
    case 'lte':
      return stored <= coerceNum(value);
    case 'between': {
      const [lo, hi] = value.split(',').map(coerceNum);
      return stored >= lo && stored <= hi;
    }
    case 'contains':
      return typeof stored === 'string' &&
             stored.toLowerCase().includes(value.toLowerCase());
    case 'startswith':
      return typeof stored === 'string' &&
             stored.toLowerCase().startsWith(value.toLowerCase());
    case 'endswith':
      return typeof stored === 'string' &&
             stored.toLowerCase().endsWith(value.toLowerCase());
    case 'in': {
      const list = value.split(',').map(coerce);
      return list.includes(stored);
    }
    default:
      return true;
  }
}

function matchesFilters(item, filters, useOr) {
  if (!filters.length) return true;
  if (useOr) return filters.some(f => applyCondition(item, f));
  return filters.every(f => applyCondition(item, f));
}

/**
 * Apply filters, sorting, and pagination to an array of items.
 * Returns { items, total, limit, offset, paginated }
 */
function applyQuery(items, query) {
  const filters = parseFilters(query);
  const useOr = query._or === 'true';

  let result = items.filter(item => matchesFilters(item, filters, useOr));

  const total = result.length;

  // Sorting
  if (query._sort) {
    const field = query._sort;
    const dir = (query._order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    result = result.slice().sort((a, b) => {
      if (a[field] < b[field]) return -dir;
      if (a[field] > b[field]) return dir;
      return 0;
    });
  }

  // Pagination
  const paginated = query._limit !== undefined || query._offset !== undefined;
  const offset = query._offset !== undefined ? parseInt(query._offset, 10) : 0;
  const limit  = query._limit  !== undefined ? parseInt(query._limit,  10) : undefined;

  if (offset) result = result.slice(offset);
  if (limit !== undefined) result = result.slice(0, limit);

  return { items: result, total, limit, offset, paginated };
}

module.exports = { applyQuery };
