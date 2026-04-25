'use strict';

const RESERVED = new Set(['_sort', '_order', '_limit', '_offset', '_or']);

// Ordered longest-first so __startswith is tested before a hypothetical __start
const SUFFIXES = [
  '__between',
  '__startswith',
  '__endswith',
  '__contains',
  '__gte',
  '__lte',
  '__gt',
  '__lt',
  '__ne',
  '__in',
];

function parseFilters(query) {
  const filters = [];
  for (const [key, raw] of Object.entries(query)) {
    if (RESERVED.has(key)) continue;
    let field = key;
    let op = 'eq';
    for (const suffix of SUFFIXES) {
      if (key.endsWith(suffix)) {
        field = key.slice(0, -suffix.length);
        op = suffix.slice(2); // strip '__'
        break;
      }
    }
    filters.push({ field, op, raw });
  }
  return filters;
}

function coerceFor(raw, itemVal) {
  if (typeof itemVal === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  }
  if (typeof itemVal === 'number') {
    const n = Number(raw);
    if (!isNaN(n)) return n;
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (!isNaN(n) && raw.trim() !== '') return n;
  return raw;
}

function matchesFilter(item, { field, op, raw }) {
  const iv = item[field];

  switch (op) {
    case 'eq': {
      const v = coerceFor(raw, iv);
      return iv === v || String(iv) === String(v);
    }
    case 'ne': {
      const v = coerceFor(raw, iv);
      return iv !== v && String(iv) !== String(v);
    }
    case 'gt':  return Number(iv) > Number(raw);
    case 'gte': return Number(iv) >= Number(raw);
    case 'lt':  return Number(iv) < Number(raw);
    case 'lte': return Number(iv) <= Number(raw);
    case 'between': {
      const parts = raw.split(',');
      const lo = Number(parts[0]);
      const hi = Number(parts[1]);
      return Number(iv) >= lo && Number(iv) <= hi;
    }
    case 'contains':
      return typeof iv === 'string' && iv.toLowerCase().includes(raw.toLowerCase());
    case 'startswith':
      return typeof iv === 'string' && iv.toLowerCase().startsWith(raw.toLowerCase());
    case 'endswith':
      return typeof iv === 'string' && iv.toLowerCase().endsWith(raw.toLowerCase());
    case 'in': {
      const vals = raw.split(',').map(v => v.trim());
      return vals.some(v => {
        const coerced = coerceFor(v, iv);
        return iv === coerced || String(iv) === v;
      });
    }
    default:
      return true;
  }
}

function applyQuery(items, query) {
  const filters = parseFilters(query);
  const useOr = query._or === 'true';
  const sortField = query._sort;
  const sortOrder = (query._order || 'asc').toLowerCase();
  const usePagination = query._limit !== undefined || query._offset !== undefined;
  const limit  = query._limit  !== undefined ? parseInt(query._limit,  10) : undefined;
  const offset = query._offset !== undefined ? parseInt(query._offset, 10) : 0;

  // Apply filters
  let result = items;
  if (filters.length > 0) {
    result = items.filter(item =>
      useOr
        ? filters.some(f  => matchesFilter(item, f))
        : filters.every(f => matchesFilter(item, f))
    );
  }

  const total = result.length;

  // Sort
  if (sortField) {
    result = [...result].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ?  1 : -1;
      return 0;
    });
  }

  // Pagination
  if (usePagination) {
    const sliced = result.slice(offset, limit !== undefined ? offset + limit : undefined);
    return {
      data:   sliced,
      total,
      limit:  limit !== undefined ? limit : result.length,
      offset,
    };
  }

  return result;
}

module.exports = { applyQuery };
