const { HttpError } = require("../errors");

function applyListQuery(records, query) {
  const filtered = applyFilter(records, query.filter);
  const sorted = applySort(filtered, query.sort);
  const offset = parseNumber(query.offset, 0, "offset");
  const limit = parseOptionalNumber(query.limit, "limit");

  return {
    items: sorted.slice(offset, limit === null ? undefined : offset + limit),
    meta: {
      total: sorted.length,
      limit,
      offset,
    },
  };
}

function applyFilter(records, rawFilter) {
  if (!rawFilter) {
    return records;
  }

  let filterTree;

  try {
    filterTree = JSON.parse(rawFilter);
  } catch (error) {
    throw new HttpError(400, "filter must be valid JSON");
  }

  return records.filter((record) => evaluateFilter(filterTree, record));
}

function evaluateFilter(node, record) {
  if (node.and) {
    return node.and.every((entry) => evaluateFilter(entry, record));
  }

  if (node.or) {
    return node.or.some((entry) => evaluateFilter(entry, record));
  }

  if (!node.field) {
    throw new HttpError(400, "Each filter must include a field");
  }

  const actual = getFieldValue(record, node.field);
  const operator = normalizeOperator(node.op || "=");
  const expected = node.value;

  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "between":
      return evaluateBetween(actual, expected);
    case "contains":
    case "like":
      return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    default:
      throw new HttpError(400, `Unsupported operator ${node.op}`);
  }
}

function applySort(records, rawSort) {
  if (!rawSort) {
    return [...records];
  }

  const directives = rawSort.split(",").map((entry) => {
    const [field, direction = "asc"] = entry.split(":");
    return {
      field: field.trim(),
      direction: direction.trim().toLowerCase() === "desc" ? "desc" : "asc",
    };
  });

  return [...records].sort((left, right) => {
    for (const directive of directives) {
      const leftValue = getFieldValue(left, directive.field);
      const rightValue = getFieldValue(right, directive.field);

      if (leftValue === rightValue) {
        continue;
      }

      const comparison = leftValue > rightValue ? 1 : -1;
      return directive.direction === "desc" ? comparison * -1 : comparison;
    }

    return 0;
  });
}

function getFieldValue(record, field) {
  const direct = resolvePath(record, field);

  if (direct !== undefined) {
    return direct;
  }

  return resolvePath(record.data, field);
}

function resolvePath(source, path) {
  return path.split(".").reduce((value, key) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    return value[key];
  }, source);
}

function normalizeOperator(operator) {
  const map = {
    "=": "eq",
    "!=": "neq",
    ">": "gt",
    ">=": "gte",
    "<": "lt",
    "<=": "lte",
    eq: "eq",
    neq: "neq",
    gt: "gt",
    gte: "gte",
    lt: "lt",
    lte: "lte",
    between: "between",
    contains: "contains",
    like: "like",
  };

  return map[operator];
}

function evaluateBetween(actual, expected) {
  const values = Array.isArray(expected) ? expected : String(expected).split(",");

  if (values.length !== 2) {
    throw new HttpError(400, "between filters require two values");
  }

  return actual >= values[0] && actual <= values[1];
}

function parseNumber(value, defaultValue, label) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new HttpError(400, `${label} must be a non-negative integer`);
  }

  return parsed;
}

function parseOptionalNumber(value, label) {
  if (value === undefined) {
    return null;
  }

  return parseNumber(value, 0, label);
}

module.exports = {
  applyListQuery,
};
