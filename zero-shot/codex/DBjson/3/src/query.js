const CONTROL_PARAMS = new Set(["_sort", "_order", "_limit", "_offset", "_or"]);
const OPERATORS = new Set([
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "contains",
  "startswith",
  "endswith",
  "in",
]);

function coerce(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

function conditionFromParam(key, rawValue) {
  const parts = key.split("__");
  const possibleOperator = parts[parts.length - 1];
  const operator = OPERATORS.has(possibleOperator) ? possibleOperator : "eq";
  const field = operator === "eq" ? key : parts.slice(0, -1).join("__");
  return { field, operator, rawValue: String(rawValue) };
}

function compare(itemValue, condition) {
  const expected = coerce(condition.rawValue);
  switch (condition.operator) {
    case "eq":
      return itemValue === expected;
    case "ne":
      return itemValue !== expected;
    case "gt":
      return Number(itemValue) > Number(expected);
    case "gte":
      return Number(itemValue) >= Number(expected);
    case "lt":
      return Number(itemValue) < Number(expected);
    case "lte":
      return Number(itemValue) <= Number(expected);
    case "between": {
      const [lo, hi] = condition.rawValue.split(",").map(Number);
      return Number(itemValue) >= lo && Number(itemValue) <= hi;
    }
    case "contains":
      return String(itemValue ?? "").toLowerCase().includes(condition.rawValue.toLowerCase());
    case "startswith":
      return String(itemValue ?? "").toLowerCase().startsWith(condition.rawValue.toLowerCase());
    case "endswith":
      return String(itemValue ?? "").toLowerCase().endsWith(condition.rawValue.toLowerCase());
    case "in":
      return condition.rawValue.split(",").map(coerce).includes(itemValue);
    default:
      return false;
  }
}

function sortItems(items, field, order) {
  if (!field) return items;
  const direction = order === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    if (a[field] === b[field]) return 0;
    if (a[field] === undefined) return 1;
    if (b[field] === undefined) return -1;
    return a[field] > b[field] ? direction : -direction;
  });
}

function applyQuery(items, query) {
  const conditions = Object.entries(query)
    .filter(([key]) => !CONTROL_PARAMS.has(key))
    .map(([key, value]) => conditionFromParam(key, value));

  const useOr = query._or === "true";
  const filtered =
    conditions.length === 0
      ? items
      : items.filter((item) => {
          const matches = conditions.map((condition) => compare(item[condition.field], condition));
          return useOr ? matches.some(Boolean) : matches.every(Boolean);
        });

  const sorted = sortItems(filtered, query._sort, query._order);
  const hasPagination = query._limit !== undefined || query._offset !== undefined;
  if (!hasPagination) return sorted;

  const total = sorted.length;
  const limit = query._limit !== undefined ? Math.max(0, Number(query._limit) || 0) : total;
  const offset = query._offset !== undefined ? Math.max(0, Number(query._offset) || 0) : 0;
  return {
    data: sorted.slice(offset, offset + limit),
    total,
    limit,
    offset,
  };
}

module.exports = { applyQuery };
