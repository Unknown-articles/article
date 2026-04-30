const { nextId } = require("./auth");
const { applyQuery } = require("./query");

const RESERVED_COLLECTIONS = new Set(["_users", "_teams"]);
const SYSTEM_FIELDS = new Set(["id", "ownerId", "createdAt"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanPayload(body) {
  const payload = isPlainObject(body) ? { ...body } : { value: body };
  for (const field of SYSTEM_FIELDS) delete payload[field];
  delete payload.updatedAt;
  return payload;
}

function normalizeShares(value, keyName) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && ["read", "write"].includes(entry.access) && entry[keyName])
    .map((entry) => ({ [keyName]: entry[keyName], access: entry.access }));
}

function normalizeItemShares(item) {
  item.sharedWith = normalizeShares(item.sharedWith, "userId");
  item.sharedWithTeams = normalizeShares(item.sharedWithTeams, "teamId");
}

function userTeamIds(userId, db) {
  return db._teams.filter((team) => (team.members || []).includes(userId)).map((team) => team.id);
}

function accessFor(user, item, db) {
  if (user.role === "admin") return "admin";
  if (item.ownerId === user.id) return "owner";

  const userShare = (item.sharedWith || []).find((share) => share.userId === user.id);
  const teamIds = new Set(userTeamIds(user.id, db));
  const teamShare = (item.sharedWithTeams || []).find((share) => teamIds.has(share.teamId));
  const grants = [userShare?.access, teamShare?.access];
  if (grants.includes("write")) return "write";
  if (grants.includes("read")) return "read";
  return null;
}

function canRead(user, item, db) {
  return Boolean(accessFor(user, item, db));
}

function canWrite(user, item, db) {
  return ["admin", "owner", "write"].includes(accessFor(user, item, db));
}

function canDelete(user, item) {
  return user.role === "admin" || item.ownerId === user.id;
}

function rejectReserved(req, res, next) {
  const resource = req.params.resource;
  if (!resource || resource.startsWith("_") || RESERVED_COLLECTIONS.has(resource)) {
    return res.status(403).json({ error: "Reserved collection name" });
  }
  if (resource === "auth" || resource === "health") {
    return res.status(403).json({ error: "Reserved route" });
  }
  return next();
}

function createResourceRouter(store, requireAuth) {
  const router = require("express").Router();
  router.use("/:resource", requireAuth, rejectReserved);
  router.use("/:resource/:id", requireAuth, rejectReserved);

  router.post("/:resource", async (req, res, next) => {
    try {
      const created = await store.transaction(async (db) => {
        if (!Array.isArray(db[req.params.resource])) db[req.params.resource] = [];
        const now = new Date().toISOString();
        const item = {
          ...cleanPayload(req.body),
          id: nextId(req.params.resource),
          ownerId: req.user.id,
          createdAt: now,
          updatedAt: now,
        };
        normalizeItemShares(item);
        db[req.params.resource].push(item);
        return item;
      });
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:resource", async (req, res, next) => {
    try {
      const items = await store.view((db) => {
        const collection = Array.isArray(db[req.params.resource]) ? db[req.params.resource] : [];
        return collection.filter((item) => canRead(req.user, item, db));
      });
      res.json(applyQuery(items, req.query));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:resource/:id", async (req, res, next) => {
    try {
      const result = await store.view((db) => {
        const item = (db[req.params.resource] || []).find((entry) => entry.id === req.params.id);
        if (!item) return { status: 404, error: "Resource not found" };
        if (!canRead(req.user, item, db)) return { status: 403, error: "Resource access denied" };
        return { item };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json(result.item);
    } catch (error) {
      next(error);
    }
  });

  router.put("/:resource/:id", async (req, res, next) => {
    try {
      const result = await store.transaction(async (db) => {
        const collection = db[req.params.resource] || [];
        const index = collection.findIndex((entry) => entry.id === req.params.id);
        if (index === -1) return { status: 404, error: "Resource not found" };
        const existing = collection[index];
        if (!canWrite(req.user, existing, db)) return { status: 403, error: "Resource access denied" };
        const updated = {
          ...cleanPayload(req.body),
          id: existing.id,
          ownerId: existing.ownerId,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        };
        normalizeItemShares(updated);
        collection[index] = updated;
        return { item: updated };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json(result.item);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:resource/:id", async (req, res, next) => {
    try {
      const result = await store.transaction(async (db) => {
        const collection = db[req.params.resource] || [];
        const item = collection.find((entry) => entry.id === req.params.id);
        if (!item) return { status: 404, error: "Resource not found" };
        if (!canWrite(req.user, item, db)) return { status: 403, error: "Resource access denied" };
        Object.assign(item, cleanPayload(req.body), { updatedAt: new Date().toISOString() });
        normalizeItemShares(item);
        return { item };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json(result.item);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:resource/:id", async (req, res, next) => {
    try {
      const result = await store.transaction(async (db) => {
        const collection = db[req.params.resource] || [];
        const index = collection.findIndex((entry) => entry.id === req.params.id);
        if (index === -1) return { status: 404, error: "Resource not found" };
        if (!canDelete(req.user, collection[index])) return { status: 403, error: "Resource access denied" };
        collection.splice(index, 1);
        return {};
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { accessFor, createResourceRouter };
