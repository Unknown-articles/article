const RESERVED_COLLECTIONS = new Set(['_users', '_teams']);
const SYSTEM_FIELDS = new Set(['id', 'ownerId', 'createdAt', 'updatedAt']);

function isReservedResource(name) {
  return RESERVED_COLLECTIONS.has(name);
}

function normalizeValue(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const lower = value.toLowerCase();
  if (lower === 'true') {
    return true;
  }

  if (lower === 'false') {
    return false;
  }

  const numberValue = Number(value);
  if (!Number.isNaN(numberValue) && String(numberValue) === value) {
    return numberValue;
  }

  return value;
}

function parseQueryParams(query) {
  const filters = [];
  let or = false;
  let sort = null;
  let order = 'asc';
  let limit = null;
  let offset = 0;
  let hasPagination = false;

  for (const [key, rawValue] of Object.entries(query)) {
    if (key === '_or') {
      or = String(rawValue).toLowerCase() === 'true';
      continue;
    }

    if (key === '_sort') {
      sort = rawValue;
      continue;
    }

    if (key === '_order') {
      order = String(rawValue).toLowerCase() === 'desc' ? 'desc' : 'asc';
      continue;
    }

    if (key === '_limit') {
      limit = Number.parseInt(rawValue, 10);
      hasPagination = true;
      continue;
    }

    if (key === '_offset') {
      offset = Number.parseInt(rawValue, 10) || 0;
      hasPagination = true;
      continue;
    }

    const [field, opSuffix] = String(key).split('__');
    let operator = 'eq';

    if (opSuffix) {
      switch (opSuffix) {
        case 'ne':
          operator = 'ne';
          break;
        case 'gt':
          operator = 'gt';
          break;
        case 'gte':
          operator = 'gte';
          break;
        case 'lt':
          operator = 'lt';
          break;
        case 'lte':
          operator = 'lte';
          break;
        case 'between':
          operator = 'between';
          break;
        case 'contains':
          operator = 'contains';
          break;
        case 'startswith':
          operator = 'startswith';
          break;
        case 'endswith':
          operator = 'endswith';
          break;
        case 'in':
          operator = 'in';
          break;
        default:
          operator = 'eq';
      }
    }

    filters.push({ field, operator, value: rawValue });
  }

  return { filters, or, sort, order, limit, offset, hasPagination };
}

function getFieldValue(item, field) {
  return item == null ? undefined : item[field];
}

function matchesCondition(item, condition) {
  const rawValue = getFieldValue(item, condition.field);
  const itemValue = normalizeValue(rawValue);
  const queryValue = normalizeValue(condition.value);

  switch (condition.operator) {
    case 'eq':
      return itemValue === queryValue;
    case 'ne':
      return itemValue !== queryValue;
    case 'gt':
      return itemValue > queryValue;
    case 'gte':
      return itemValue >= queryValue;
    case 'lt':
      return itemValue < queryValue;
    case 'lte':
      return itemValue <= queryValue;
    case 'between': {
      const [lo, hi] = String(condition.value)
        .split(',')
        .map((value) => normalizeValue(value.trim()));
      return itemValue >= lo && itemValue <= hi;
    }
    case 'contains':
      return (
        rawValue != null &&
        String(rawValue).toLowerCase().includes(String(queryValue).toLowerCase())
      );
    case 'startswith':
      return (
        rawValue != null &&
        String(rawValue).toLowerCase().startsWith(String(queryValue).toLowerCase())
      );
    case 'endswith':
      return (
        rawValue != null &&
        String(rawValue).toLowerCase().endsWith(String(queryValue).toLowerCase())
      );
    case 'in': {
      const list = String(condition.value).split(',').map((value) => normalizeValue(value.trim()));
      return list.some((candidate) => candidate === itemValue);
    }
    default:
      return false;
  }
}

function filterItems(items, params) {
  if (!params.filters.length) {
    return items;
  }

  return items.filter((item) => {
    const matches = params.filters.map((condition) => matchesCondition(item, condition));
    return params.or ? matches.some(Boolean) : matches.every(Boolean);
  });
}

function buildComparator(field, order) {
  return (a, b) => {
    const aValue = getFieldValue(a, field);
    const bValue = getFieldValue(b, field);

    if (aValue === bValue) {
      return 0;
    }

    if (aValue === undefined) {
      return 1;
    }

    if (bValue === undefined) {
      return -1;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const result = aValue.localeCompare(bValue);
      return order === 'desc' ? -result : result;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return order === 'desc' ? bValue - aValue : aValue - bValue;
    }

    const result = String(aValue).localeCompare(String(bValue));
    return order === 'desc' ? -result : result;
  };
}

function applyQuery(items, query) {
  const params = parseQueryParams(query);
  let result = filterItems(items, params);

  if (params.sort) {
    result = [...result].sort(buildComparator(params.sort, params.order));
  }

  const total = result.length;

  if (params.hasPagination) {
    const paged = result.slice(params.offset, params.limit != null ? params.offset + params.limit : undefined);
    return {
      data: paged,
      total,
      limit: params.limit != null ? params.limit : undefined,
      offset: params.offset,
      envelope: true,
    };
  }

  return { data: result, total, envelope: false };
}

function omitFields(item, fields) {
  const copy = { ...item };
  for (const field of fields) {
    delete copy[field];
  }
  return copy;
}

function removeSystemFields(obj) {
  const result = { ...obj };
  for (const field of SYSTEM_FIELDS) {
    delete result[field];
  }
  return result;
}

function validateShareEntries(entries, type) {
  if (!Array.isArray(entries)) {
    return undefined;
  }

  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const idField = type === 'team' ? 'teamId' : 'userId';
      return {
        [idField]: entry[idField],
        access: entry.access === 'write' ? 'write' : 'read',
      };
    });
}

module.exports = {
  isReservedResource,
  parseQueryParams,
  applyQuery,
  omitFields,
  normalizeValue,
  removeSystemFields,
  validateShareEntries,
};
