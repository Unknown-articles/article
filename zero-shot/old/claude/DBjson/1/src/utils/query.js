'use strict';

/**
 * Advanced query engine for in-memory collections.
 *
 * Filter operators (appended to the field name with "__"):
 *   eq           ?name=John                  (default, no suffix needed)
 *   ne           ?age__ne=5
 *   gt / gte     ?age__gt=18  ?age__gte=18
 *   lt / lte     ?price__lt=100
 *   between      ?age__between=18,65         (inclusive)
 *   contains     ?name__contains=oh          (case-insensitive substring)
 *   startswith   ?name__startswith=Jo
 *   endswith     ?name__endswith=hn
 *   in           ?status__in=active,draft    (comma-separated list)
 *
 * Logic:
 *   Default: all filter conditions are AND-ed.
 *   ?_or=true  switches to OR logic (any condition matches).
 *
 * Sorting:
 *   ?_sort=field&_order=asc|desc
 *
 * Pagination:
 *   ?_limit=20&_offset=0
 */

const RESERVED = new Set(['_sort', '_order', '_limit', '_offset', '_or']);
const OP_RE = /^(.+?)__(ne|gte?|lte?|between|contains|startswith|endswith|in)$/;

function parseFilters(rawQuery) {
  const filters = [];
  for (const [key, rawVal] of Object.entries(rawQuery)) {
    if (RESERVED.has(key)) continue;
    const match = key.match(OP_RE);
    if (match) {
      filters.push({ field: match[1], op: match[2], value: rawVal });
    } else {
      filters.push({ field: key, op: 'eq', value: rawVal });
    }
  }
  return filters;
}

function coerce(itemVal, filterVal) {
  if (itemVal === undefined || itemVal === null) return { iv: itemVal, fv: filterVal };
  if (typeof itemVal === 'number') return { iv: itemVal, fv: Number(filterVal) };
  if (typeof itemVal === 'boolean') return { iv: itemVal, fv: filterVal === 'true' };
  return { iv: String(itemVal), fv: String(filterVal) };
}

function matchFilter(item, { field, op, value }) {
  const raw = item[field];
  switch (op) {
    case 'eq': {
      const { iv, fv } = coerce(raw, value);
      return iv == fv; // loose equality handles number/string mismatch
    }
    case 'ne': {
      const { iv, fv } = coerce(raw, value);
      return iv != fv;
    }
    case 'gt':  return Number(raw) >  Number(value);
    case 'gte': return Number(raw) >= Number(value);
    case 'lt':  return Number(raw) <  Number(value);
    case 'lte': return Number(raw) <= Number(value);
    case 'between': {
      const [lo, hi] = value.split(',').map(Number);
      const n = Number(raw);
      return n >= lo && n <= hi;
    }
    case 'contains':
      return String(raw).toLowerCase().includes(String(value).toLowerCase());
    case 'startswith':
      return String(raw).toLowerCase().startsWith(String(value).toLowerCase());
    case 'endswith':
      return String(raw).toLowerCase().endsWith(String(value).toLowerCase());
    case 'in': {
      const list = String(value).split(',').map(v => v.trim());
      return list.includes(String(raw));
    }
    default:
      return true;
  }
}

/**
 * Filter, sort, and paginate an array of items.
 *
 * @param {object[]} items
 * @param {object}   rawQuery  Express `req.query`
 * @returns {{ data: object[], total: number, limit: number, offset: number }}
 */
function applyQuery(items, rawQuery) {
  const filters = parseFilters(rawQuery);
  const useOr   = rawQuery._or === 'true';

  // --- Filter ---
  let result = filters.length === 0
    ? items.slice()
    : items.filter(item =>
        useOr
          ? filters.some(f  => matchFilter(item, f))
          : filters.every(f => matchFilter(item, f))
      );

  const total = result.length;

  // --- Sort ---
  if (rawQuery._sort) {
    const field = rawQuery._sort;
    const dir   = rawQuery._order === 'desc' ? -1 : 1;
    result = result.slice().sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  // --- Pagination ---
  const offset = Math.max(0, parseInt(rawQuery._offset, 10) || 0);
  const limit  = rawQuery._limit ? Math.max(1, parseInt(rawQuery._limit, 10)) : undefined;
  result = result.slice(offset, limit !== undefined ? offset + limit : undefined);

  return { data: result, total, offset, limit: limit ?? total };
}

module.exports = { applyQuery };
