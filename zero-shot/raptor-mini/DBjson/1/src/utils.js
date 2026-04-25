function parseQueryValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const lower = value.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (!Number.isNaN(Number(value)) && value.trim() !== '') {
    return Number(value);
  }
  return value;
}

function getFieldValue(item, field) {
  return field.split('.').reduce((current, key) => {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      return current[key];
    }
    return undefined;
  }, item);
}

function normalizeString(value) {
  if (value === undefined || value === null) return '';
  return String(value).toLowerCase();
}

function parseFilters(query) {
  const conditions = [];
  const reserved = new Set(['_sort', '_order', '_limit', '_offset', '_or', 'items']);

  for (const rawKey of Object.keys(query)) {
    if (reserved.has(rawKey)) continue;
    const rawValue = query[rawKey];
    const [field, opSuffix] = rawKey.split(/__(.+)$/);
    const operator = opSuffix || 'eq';
    const value = rawValue;
    conditions.push({ field, operator, value });
  }

  return conditions;
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function matchesCondition(item, condition) {
  const fieldValue = getFieldValue(item, condition.field);
  const rawValue = condition.value;
  const operator = condition.operator;

  switch (operator) {
    case 'eq': {
      const target = parseQueryValue(rawValue);
      return fieldValue === target;
    }
    case 'ne': {
      const target = parseQueryValue(rawValue);
      return fieldValue !== target;
    }
    case 'gt': {
      const target = Number(rawValue);
      return Number(fieldValue) > target;
    }
    case 'gte': {
      const target = Number(rawValue);
      return Number(fieldValue) >= target;
    }
    case 'lt': {
      const target = Number(rawValue);
      return Number(fieldValue) < target;
    }
    case 'lte': {
      const target = Number(rawValue);
      return Number(fieldValue) <= target;
    }
    case 'between': {
      const [lo, hi] = String(rawValue).split(',').map(Number);
      const numeric = Number(fieldValue);
      return numeric >= lo && numeric <= hi;
    }
    case 'contains': {
      return normalizeString(fieldValue).includes(normalizeString(rawValue));
    }
    case 'startswith': {
      return normalizeString(fieldValue).startsWith(normalizeString(rawValue));
    }
    case 'endswith': {
      return normalizeString(fieldValue).endsWith(normalizeString(rawValue));
    }
    case 'in': {
      const options = String(rawValue).split(',').map(parseQueryValue);
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((value) => options.includes(value));
      }
      return options.includes(fieldValue);
    }
    default:
      return false;
  }
}

function filterItems(items, query) {
  const conditions = parseFilters(query);
  const useOr = String(query._or).toLowerCase() === 'true';

  if (conditions.length === 0) {
    return items;
  }

  return items.filter((item) => {
    const matches = conditions.map((condition) => matchesCondition(item, condition));
    return useOr ? matches.some(Boolean) : matches.every(Boolean);
  });
}

function applySorting(items, sortField, order) {
  if (!sortField) return items;
  const direction = String(order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => compareValues(getFieldValue(a, sortField), getFieldValue(b, sortField)) * direction);
}

function applyPagination(items, limit, offset) {
  const normalizedLimit = Number.isNaN(Number(limit)) ? undefined : Number(limit);
  const normalizedOffset = Number.isNaN(Number(offset)) ? 0 : Number(offset);
  if (normalizedLimit === undefined) {
    return { results: items, limit: undefined, offset: normalizedOffset };
  }
  const sliced = items.slice(normalizedOffset, normalizedOffset + normalizedLimit);
  return { results: sliced, limit: normalizedLimit, offset: normalizedOffset };
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function getUserTeamIds(userId, teams) {
  if (!Array.isArray(teams)) return [];
  return teams.filter((team) => Array.isArray(team.members) && team.members.includes(userId)).map((team) => team.id);
}

module.exports = {
  parseQueryValue,
  filterItems,
  applySorting,
  applyPagination,
  sanitizeUser,
  getUserTeamIds,
};
