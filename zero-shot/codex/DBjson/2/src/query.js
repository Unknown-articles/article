const { parseValue } = require("./utils");

const OPERATORS = new Set([
  "eq",
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

function buildPredicate(query) {
  const conditions = Object.entries(query)
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, rawValue]) => {
      const [field, operator = "eq"] = key.split("__");
      if (!OPERATORS.has(operator)) {
        return () => true;
      }
      return (item) => evaluateCondition(item[field], operator, rawValue);
    });

  const useOr = String(query._or || "false") === "true";

  return (item) => {
    if (conditions.length === 0) {
      return true;
    }
    return useOr ? conditions.some((condition) => condition(item)) : conditions.every((condition) => condition(item));
  };
}

function evaluateCondition(actual, operator, rawValue) {
  if (actual === undefined) {
    return false;
  }

  switch (operator) {
    case "eq":
      return actual === parseValue(rawValue);
    case "ne":
      return actual !== parseValue(rawValue);
    case "gt":
      return actual > parseValue(rawValue);
    case "gte":
      return actual >= parseValue(rawValue);
    case "lt":
      return actual < parseValue(rawValue);
    case "lte":
      return actual <= parseValue(rawValue);
    case "between": {
      const [low, high] = String(rawValue).split(",").map(parseValue);
      return actual >= low && actual <= high;
    }
    case "contains":
      return String(actual).toLowerCase().includes(String(rawValue).toLowerCase());
    case "startswith":
      return String(actual).toLowerCase().startsWith(String(rawValue).toLowerCase());
    case "endswith":
      return String(actual).toLowerCase().endsWith(String(rawValue).toLowerCase());
    case "in": {
      const values = String(rawValue)
        .split(",")
        .map((value) => parseValue(value.trim()));
      return values.includes(actual);
    }
    default:
      return true;
  }
}

function applyQuery(items, query) {
  const predicate = buildPredicate(query);
  let results = items.filter(predicate);

  const sortField = query._sort;
  const sortOrder = String(query._order || "asc").toLowerCase() === "desc" ? "desc" : "asc";

  if (sortField) {
    results = [...results].sort((left, right) => compareValues(left[sortField], right[sortField], sortOrder));
  }

  const offset = Math.max(0, Number(query._offset || 0));
  const limit = query._limit === undefined ? undefined : Math.max(0, Number(query._limit));

  if (offset) {
    results = results.slice(offset);
  }

  if (limit !== undefined && !Number.isNaN(limit)) {
    results = results.slice(0, limit);
  }

  return results;
}

function compareValues(left, right, direction) {
  let result = 0;

  if (left === right) {
    result = 0;
  } else if (left === undefined) {
    result = 1;
  } else if (right === undefined) {
    result = -1;
  } else if (typeof left === "string" && typeof right === "string") {
    result = left.localeCompare(right);
  } else {
    result = left > right ? 1 : -1;
  }

  return direction === "desc" ? result * -1 : result;
}

module.exports = {
  applyQuery,
};
