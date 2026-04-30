const { authMiddleware } = require("./auth");
const { newId } = require("./utils");

const RESERVED_COLLECTIONS = new Set(["_users", "_teams"]);
const CONTROL_QUERY_PARAMS = new Set(["_sort", "_order", "_limit", "_offset", "_or"]);
const OPERATORS = new Set([
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "contains",
  "like",
  "startswith",
  "endswith",
  "in",
]);

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function cleanSystemFields(payload) {
  const source = isPlainObject(payload) ? payload : {};
  const { id, ownerId, createdAt, updatedAt, ...clean } = source;
  return clean;
}

function nextTimestamp(previous) {
  const now = new Date();
  const previousTime = Date.parse(previous);
  if (!Number.isNaN(previousTime) && now.getTime() <= previousTime) {
    return new Date(previousTime + 1).toISOString();
  }
  return now.toISOString();
}

function sharedAccess(item, user, teams) {
  if (!item || !user) return null;
  if (user.role === "admin" || item.ownerId === user.id) return "owner";

  const userShare = Array.isArray(item.sharedWith)
    ? item.sharedWith.find((share) => share.userId === user.id)
    : null;
  if (userShare?.access === "write") return "write";
  if (userShare?.access === "read") return "read";

  const memberships = new Set(
    teams.filter((team) => team.members.includes(user.id)).map((team) => team.id),
  );
  const teamShares = Array.isArray(item.sharedWithTeams) ? item.sharedWithTeams : [];
  if (teamShares.some((share) => memberships.has(share.teamId) && share.access === "write")) {
    return "write";
  }
  if (teamShares.some((share) => memberships.has(share.teamId) && share.access === "read")) {
    return "read";
  }

  return null;
}

function canRead(item, user, teams) {
  return Boolean(sharedAccess(item, user, teams));
}

function canWrite(item, user, teams) {
  const access = sharedAccess(item, user, teams);
  return access === "owner" || access === "write";
}

function canDelete(item, user) {
  return user.role === "admin" || item.ownerId === user.id;
}

function parseScalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw !== "" && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

function compare(value, operator, raw) {
  if (operator === "ne") return value !== parseScalar(raw);
  if (operator === "gt") return Number(value) > Number(raw);
  if (operator === "gte") return Number(value) >= Number(raw);
  if (operator === "lt") return Number(value) < Number(raw);
  if (operator === "lte") return Number(value) <= Number(raw);
  if (operator === "between") {
    const [lo, hi] = String(raw).split(",").map(Number);
    return Number(value) >= lo && Number(value) <= hi;
  }
  if (operator === "contains" || operator === "like") {
    return String(value ?? "").toLowerCase().includes(String(raw).toLowerCase());
  }
  if (operator === "startswith") {
    return String(value ?? "").toLowerCase().startsWith(String(raw).toLowerCase());
  }
  if (operator === "endswith") {
    return String(value ?? "").toLowerCase().endsWith(String(raw).toLowerCase());
  }
  if (operator === "in") {
    const options = String(raw).split(",").map(parseScalar);
    return options.includes(value);
  }
  return value === parseScalar(raw);
}

function buildConditions(query) {
  return Object.entries(query)
    .filter(([key]) => !CONTROL_QUERY_PARAMS.has(key))
    .map(([key, value]) => {
      const parts = key.split("__");
      const maybeOperator = parts[parts.length - 1];
      const operator = OPERATORS.has(maybeOperator) ? maybeOperator : "eq";
      const field = operator === "eq" ? key : parts.slice(0, -1).join("__");
      return { field, operator, value };
    });
}

function applyQuery(items, query) {
  const conditions = buildConditions(query);
  const useOr = String(query._or).toLowerCase() === "true";
  let result = items;

  if (conditions.length > 0) {
    result = result.filter((item) => {
      const checks = conditions.map((condition) =>
        compare(item[condition.field], condition.operator, condition.value),
      );
      return useOr ? checks.some(Boolean) : checks.every(Boolean);
    });
  }

  if (query._sort) {
    const direction = String(query._order || "asc").toLowerCase() === "desc" ? -1 : 1;
    const field = query._sort;
    result = [...result].sort((a, b) => {
      if (a[field] === b[field]) return 0;
      if (a[field] === undefined) return 1;
      if (b[field] === undefined) return -1;
      return a[field] > b[field] ? direction : -direction;
    });
  }

  const total = result.length;
  const hasPagination = query._limit !== undefined || query._offset !== undefined;
  if (!hasPagination) return result;

  const limit = query._limit === undefined ? total : Math.max(0, Number(query._limit));
  const offset = query._offset === undefined ? 0 : Math.max(0, Number(query._offset));
  return {
    data: result.slice(offset, offset + limit),
    total,
    limit,
    offset,
  };
}

function rejectReserved(req, res, next) {
  if (RESERVED_COLLECTIONS.has(req.params.resource)) {
    return res.status(403).json({ error: "Reserved collection" });
  }
  next();
}

function createResourceRouter(db) {
  const express = require("express");
  const router = express.Router();
  const requireAuth = authMiddleware(db);

  router.param("resource", (req, res, next, resource) => {
    req.collection = resource;
    next();
  });

  router.post("/:resource", requireAuth, rejectReserved, async (req, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "JSON object body required" });
    }

    const created = await db.transaction(async (data) => {
      if (!Array.isArray(data[req.collection])) data[req.collection] = [];
      const now = new Date().toISOString();
      const item = {
        ...cleanSystemFields(req.body),
        id: newId(),
        ownerId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      data[req.collection].push(item);
      return item;
    });

    res.status(201).json(created);
  });

  router.get("/:resource", requireAuth, rejectReserved, async (req, res) => {
    const data = await db.snapshot();
    const collection = Array.isArray(data[req.collection]) ? data[req.collection] : [];
    const visible =
      req.user.role === "admin"
        ? collection
        : collection.filter((item) => canRead(item, req.user, data._teams));
    res.json(applyQuery(visible, req.query));
  });

  router.get("/:resource/:id", requireAuth, rejectReserved, async (req, res) => {
    const data = await db.snapshot();
    const collection = Array.isArray(data[req.collection]) ? data[req.collection] : [];
    const item = collection.find((candidate) => candidate.id === req.params.id);
    if (!item) return res.status(404).json({ error: "Resource not found" });
    if (!canRead(item, req.user, data._teams)) return res.status(403).json({ error: "Forbidden" });
    res.json(item);
  });

  router.put("/:resource/:id", requireAuth, rejectReserved, async (req, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "JSON object body required" });
    }

    const updated = await db.transaction(async (data) => {
      const collection = Array.isArray(data[req.collection]) ? data[req.collection] : [];
      const index = collection.findIndex((candidate) => candidate.id === req.params.id);
      if (index === -1) {
        const error = new Error("Resource not found");
        error.status = 404;
        throw error;
      }
      const existing = collection[index];
      if (!canWrite(existing, req.user, data._teams)) {
        const error = new Error("Forbidden");
        error.status = 403;
        throw error;
      }
      collection[index] = {
        ...cleanSystemFields(req.body),
        id: existing.id,
        ownerId: existing.ownerId,
        createdAt: existing.createdAt,
        updatedAt: nextTimestamp(existing.updatedAt || existing.createdAt),
      };
      return collection[index];
    }).catch((error) => {
      res.status(error.status || 500).json({ error: error.message });
      return null;
    });

    if (updated) res.json(updated);
  });

  router.patch("/:resource/:id", requireAuth, rejectReserved, async (req, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "JSON object body required" });
    }

    const updated = await db.transaction(async (data) => {
      const collection = Array.isArray(data[req.collection]) ? data[req.collection] : [];
      const item = collection.find((candidate) => candidate.id === req.params.id);
      if (!item) {
        const error = new Error("Resource not found");
        error.status = 404;
        throw error;
      }
      if (!canWrite(item, req.user, data._teams)) {
        const error = new Error("Forbidden");
        error.status = 403;
        throw error;
      }
      Object.assign(item, cleanSystemFields(req.body), {
        updatedAt: nextTimestamp(item.updatedAt || item.createdAt),
      });
      return item;
    }).catch((error) => {
      res.status(error.status || 500).json({ error: error.message });
      return null;
    });

    if (updated) res.json(updated);
  });

  router.delete("/:resource/:id", requireAuth, rejectReserved, async (req, res) => {
    const deleted = await db.transaction(async (data) => {
      const collection = Array.isArray(data[req.collection]) ? data[req.collection] : [];
      const index = collection.findIndex((candidate) => candidate.id === req.params.id);
      if (index === -1) {
        const error = new Error("Resource not found");
        error.status = 404;
        throw error;
      }
      if (!canDelete(collection[index], req.user)) {
        const error = new Error("Forbidden");
        error.status = 403;
        throw error;
      }
      collection.splice(index, 1);
      return true;
    }).catch((error) => {
      res.status(error.status || 500).json({ error: error.message });
      return false;
    });

    if (deleted) res.json({ ok: true });
  });

  return router;
}

module.exports = { createResourceRouter };
