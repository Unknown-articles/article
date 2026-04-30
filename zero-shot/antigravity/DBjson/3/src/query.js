function evaluateFilters(items, query) {
  const isOr = query._or === 'true';
  const filterKeys = Object.keys(query).filter(k => !['_or', '_sort', '_order', '_limit', '_offset'].includes(k));

  if (filterKeys.length === 0) return items;

  return items.filter(item => {
    let matchAny = false;
    let matchAll = true;

    for (const key of filterKeys) {
      let field = key;
      let op = 'eq';

      const match = key.match(/__(ne|gt|gte|lt|lte|between|contains|startswith|endswith|in)$/);
      if (match) {
        op = match[1];
        field = key.replace(`__${op}`, '');
      }

      const val = query[key];
      const itemVal = item[field];
      let conditionMet = false;

      if (op === 'eq') {
        const checkVal = val === 'true' ? true : val === 'false' ? false : val;
        conditionMet = itemVal == checkVal;
      } else if (op === 'ne') {
        const checkVal = val === 'true' ? true : val === 'false' ? false : val;
        conditionMet = itemVal != checkVal;
      } else if (op === 'gt') conditionMet = Number(itemVal) > Number(val);
      else if (op === 'gte') conditionMet = Number(itemVal) >= Number(val);
      else if (op === 'lt') conditionMet = Number(itemVal) < Number(val);
      else if (op === 'lte') conditionMet = Number(itemVal) <= Number(val);
      else if (op === 'between') {
        const [lo, hi] = val.split(',').map(Number);
        conditionMet = Number(itemVal) >= lo && Number(itemVal) <= hi;
      } else if (op === 'contains') {
        conditionMet = String(itemVal).toLowerCase().includes(String(val).toLowerCase());
      } else if (op === 'startswith') {
        conditionMet = String(itemVal).toLowerCase().startsWith(String(val).toLowerCase());
      } else if (op === 'endswith') {
        conditionMet = String(itemVal).toLowerCase().endsWith(String(val).toLowerCase());
      } else if (op === 'in') {
        const arr = val.split(',');
        conditionMet = arr.includes(String(itemVal));
      }

      if (conditionMet) matchAny = true;
      else matchAll = false;
    }

    return isOr ? matchAny : matchAll;
  });
}

function applySortAndPagination(items, query) {
  let result = [...items];

  if (query._sort) {
    const field = query._sort;
    const order = query._order === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      if (a[field] < b[field]) return -1 * order;
      if (a[field] > b[field]) return 1 * order;
      return 0;
    });
  }

  const total = result.length;
  const limit = query._limit ? parseInt(query._limit, 10) : undefined;
  const offset = query._offset ? parseInt(query._offset, 10) : 0;

  if (limit !== undefined || offset > 0) {
    const start = offset;
    const end = limit !== undefined ? start + limit : undefined;
    result = result.slice(start, end);
    return { data: result, total, limit, offset };
  }

  return result;
}

module.exports = { evaluateFilters, applySortAndPagination };
