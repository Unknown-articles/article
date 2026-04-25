const path = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { DataStore } = require("./datastore");
const { RESERVED_COLLECTIONS, SHARE_ACCESS, SYSTEM_FIELDS, USER_ROLES } = require("./constants");
const { applyQuery } = require("./query");
const { canAccessCollectionItem, ensureSharing } = require("./access");
const { createId, normalizeCollectionName, nowIso, sanitizeUser } = require("./utils");

function createApp(options = {}) {
  const app = express();
  const dataFile = options.dataFile || path.join(process.cwd(), "data", "db.json");
  const jwtSecret = options.jwtSecret || "dev-secret";
  const store = options.store || new DataStore(dataFile);

  app.locals.store = store;
  app.locals.jwtSecret = jwtSecret;
  app.locals.ready = store.init();

  app.use(express.json());
  app.use(async (_req, _res, next) => {
    await app.locals.ready;
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.post("/auth/register", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const result = await store.transact(async (data) => {
      if (data._users.some((user) => user.username === username)) {
        return { error: { status: 409, body: { error: "username already exists" } } };
      }

      const role = data._users.length === 0 ? "admin" : "user";
      const user = {
        id: createId(),
        username,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        createdAt: nowIso(),
      };
      data._users.push(user);
      return { status: 201, body: sanitizeUser(user) };
    });

    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(result.status).json(result.body);
  });

  app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body || {};
    const data = await store.read();
    const user = data._users.find((entry) => entry.username === username);

    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const valid = await bcrypt.compare(password || "", user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = jwt.sign({ sub: user.id, role: user.role, username: user.username }, jwtSecret, { expiresIn: "1h" });
    return res.status(200).json({ token });
  });

  app.use(async (req, _res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      const data = await store.read();
      req.user = data._users.find((user) => user.id === payload.sub) || null;
    } catch {
      req.user = null;
    }

    return next();
  });

  app.get("/auth/me", requireAuth, (req, res) => {
    res.status(200).json(sanitizeUser(req.user));
  });

  app.get("/auth/users", requireAuth, requireAdmin, async (_req, res) => {
    const data = await store.read();
    res.status(200).json(data._users.map(sanitizeUser));
  });

  app.patch("/auth/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    const { role } = req.body || {};
    if (!USER_ROLES.has(role)) {
      return res.status(400).json({ error: "invalid role" });
    }

    const result = await store.transact(async (data) => {
      const user = data._users.find((entry) => entry.id === req.params.id);
      if (!user) {
        return { error: { status: 404, body: { error: "user not found" } } };
      }
      user.role = role;
      return { status: 200, body: sanitizeUser(user) };
    });

    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(result.status).json(result.body);
  });

  app.post("/auth/teams", requireAuth, async (req, res) => {
    const { name } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const result = await store.transact(async (data) => {
      const team = {
        id: createId(),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
        createdAt: nowIso(),
      };
      data._teams.push(team);
      return { status: 201, body: team };
    });

    return res.status(result.status).json(result.body);
  });

  app.get("/auth/teams", requireAuth, async (req, res) => {
    const data = await store.read();
    const teams = data._teams.filter((team) => team.ownerId === req.user.id || team.members.includes(req.user.id));
    res.status(200).json(teams);
  });

  app.get("/auth/teams/:id", requireAuth, async (req, res) => {
    const data = await store.read();
    const team = data._teams.find((entry) => entry.id === req.params.id);
    if (!team) {
      return res.status(404).json({ error: "team not found" });
    }
    if (!(team.ownerId === req.user.id || team.members.includes(req.user.id) || req.user.role === "admin")) {
      return res.status(403).json({ error: "forbidden" });
    }
    res.status(200).json(team);
  });

  app.patch("/auth/teams/:id", requireAuth, async (req, res) => {
    const result = await store.transact(async (data) => {
      const team = data._teams.find((entry) => entry.id === req.params.id);
      if (!team) {
        return { error: { status: 404, body: { error: "team not found" } } };
      }
      if (team.ownerId !== req.user.id) {
        return { error: { status: 403, body: { error: "forbidden" } } };
      }
      if (!req.body || !req.body.name) {
        return { error: { status: 400, body: { error: "name is required" } } };
      }
      team.name = req.body.name;
      return { status: 200, body: team };
    });

    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(result.status).json(result.body);
  });

  app.delete("/auth/teams/:id", requireAuth, async (req, res) => {
    const result = await store.transact(async (data) => {
      const index = data._teams.findIndex((entry) => entry.id === req.params.id);
      if (index === -1) {
        return { error: { status: 404, body: { error: "team not found" } } };
      }
      if (data._teams[index].ownerId !== req.user.id) {
        return { error: { status: 403, body: { error: "forbidden" } } };
      }
      data._teams.splice(index, 1);
      return { status: 204, body: null };
    });

    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(204).send();
  });

  app.post("/auth/teams/:id/members", requireAuth, async (req, res) => {
    const result = await store.transact(async (data) => {
      const team = data._teams.find((entry) => entry.id === req.params.id);
      if (!team) {
        return { error: { status: 404, body: { error: "team not found" } } };
      }
      if (!(req.user.role === "admin" || team.ownerId === req.user.id)) {
        return { error: { status: 403, body: { error: "forbidden" } } };
      }

      const user = data._users.find((entry) => entry.id === req.body.userId);
      if (!user) {
        return { error: { status: 404, body: { error: "user not found" } } };
      }

      if (!team.members.includes(user.id)) {
        team.members.push(user.id);
      }

      return { status: 200, body: team };
    });

    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(result.status).json(result.body);
  });

  app.delete("/auth/teams/:id/members/:userId", requireAuth, async (req, res) => {
    const result = await store.transact(async (data) => {
      const team = data._teams.find((entry) => entry.id === req.params.id);
      if (!team) {
        return { error: { status: 404, body: { error: "team not found" } } };
      }
      if (team.ownerId !== req.user.id) {
        return { error: { status: 403, body: { error: "forbidden" } } };
      }
      team.members = team.members.filter((memberId) => memberId !== req.params.userId);
      if (!team.members.includes(team.ownerId)) {
        team.members.unshift(team.ownerId);
      }
      return { status: 200, body: team };
    });

    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(result.status).json(result.body);
  });

  app.post("/:resource", requireAuth, async (req, res, next) => {
    const resource = normalizeCollectionName(req.params.resource);
    if (resource === "auth") {
      return next();
    }
    if (!validateCollectionName(resource, res)) {
      return undefined;
    }

    const result = await store.transact(async (data) => {
      const collection = ensureCollection(data, resource);
      const payload = sanitizeIncomingBody(req.body);
      const item = {
        ...payload,
        id: createId(),
        ownerId: req.user.id,
        createdAt: nowIso(),
      };
      ensureSharing(item);
      collection.push(item);
      return { status: 201, body: item };
    });

    return res.status(result.status).json(result.body);
  });

  app.get("/:resource", requireAuth, async (req, res, next) => {
    const resource = normalizeCollectionName(req.params.resource);
    if (resource === "auth") {
      return next();
    }
    if (!validateCollectionName(resource, res)) {
      return undefined;
    }

    const data = await store.read();
    const collection = Array.isArray(data[resource]) ? data[resource] : [];
    const visible = collection.filter((item) => canAccessCollectionItem(item, req.user, data, "canRead"));
    res.status(200).json(applyQuery(visible, req.query));
  });

  app.get("/:resource/:id", requireAuth, async (req, res, next) => {
    const resource = normalizeCollectionName(req.params.resource);
    if (resource === "auth") {
      return next();
    }
    if (!validateCollectionName(resource, res)) {
      return undefined;
    }

    const data = await store.read();
    const collection = Array.isArray(data[resource]) ? data[resource] : [];
    const item = collection.find((entry) => entry.id === req.params.id);
    if (!item) {
      return res.status(404).json({ error: "not found" });
    }
    if (!canAccessCollectionItem(item, req.user, data, "canRead")) {
      return res.status(403).json({ error: "forbidden" });
    }
    return res.status(200).json(item);
  });

  app.put("/:resource/:id", requireAuth, async (req, res, next) => {
    await upsertResource(req, res, next, { replace: true });
  });

  app.patch("/:resource/:id", requireAuth, async (req, res, next) => {
    await upsertResource(req, res, next, { replace: false });
  });

  app.delete("/:resource/:id", requireAuth, async (req, res, next) => {
    const resource = normalizeCollectionName(req.params.resource);
    if (resource === "auth") {
      return next();
    }
    if (!validateCollectionName(resource, res)) {
      return undefined;
    }

    const result = await store.transact(async (data) => {
      const collection = Array.isArray(data[resource]) ? data[resource] : [];
      const index = collection.findIndex((entry) => entry.id === req.params.id);
      if (index === -1) {
        return { error: { status: 404, body: { error: "not found" } } };
      }
      const item = collection[index];
      if (!canAccessCollectionItem(item, req.user, data, "canDelete")) {
        return { error: { status: 403, body: { error: "forbidden" } } };
      }
      collection.splice(index, 1);
      data[resource] = collection;
      return { status: 204, body: null };
    });

    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(204).send();
  });

  app.use((req, res) => {
    res.status(404).json({ error: `route not found: ${req.method} ${req.path}` });
  });

  async function upsertResource(req, res, next, { replace }) {
    const resource = normalizeCollectionName(req.params.resource);
    if (resource === "auth") {
      return next();
    }
    if (!validateCollectionName(resource, res)) {
      return undefined;
    }

    const result = await store.transact(async (data) => {
      const collection = Array.isArray(data[resource]) ? data[resource] : [];
      const index = collection.findIndex((entry) => entry.id === req.params.id);
      const item = index === -1 ? null : collection[index];
      if (!item) {
        return { error: { status: 404, body: { error: "not found" } } };
      }

      if (!canAccessCollectionItem(item, req.user, data, "canWrite")) {
        return { error: { status: 403, body: { error: "forbidden" } } };
      }

      const sanitized = sanitizeIncomingBody(req.body);
      const currentSharing = ensureSharing(item);
      const nextData = replace
        ? { ...sanitized, id: item.id, ownerId: item.ownerId, createdAt: item.createdAt, sharing: currentSharing }
        : { ...item, ...sanitized };

      nextData.id = item.id;
      nextData.ownerId = item.ownerId;
      nextData.createdAt = item.createdAt;

      const sharingPayload = req.body && req.body.sharing;
      if (sharingPayload !== undefined) {
        if (!(req.user.role === "admin" || item.ownerId === req.user.id)) {
          return { error: { status: 403, body: { error: "forbidden" } } };
        }
        const sharingResult = normalizeSharing(sharingPayload, data);
        if (sharingResult.error) {
          return { error: { status: 400, body: { error: sharingResult.error } } };
        }
        nextData.sharing = sharingResult.value;
      } else if (!nextData.sharing) {
        nextData.sharing = currentSharing;
      }

      ensureSharing(nextData);
      const updatedItem = nextData;

      if (replace) {
        collection[index] = updatedItem;
      } else {
        Object.assign(item, updatedItem);
      }

      return { status: 200, body: collection[index] };
    });

    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(result.status).json(result.body);
  }

  return app;
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "authentication required" });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
}

function validateCollectionName(name, res) {
  if (!name || name.startsWith("_") || RESERVED_COLLECTIONS.has(name)) {
    res.status(400).json({ error: "reserved collection" });
    return false;
  }
  return true;
}

function ensureCollection(data, name) {
  if (!Array.isArray(data[name])) {
    data[name] = [];
  }
  return data[name];
}

function sanitizeIncomingBody(body) {
  const payload = body && typeof body === "object" && !Array.isArray(body) ? { ...body } : {};
  for (const field of SYSTEM_FIELDS) {
    delete payload[field];
  }
  return payload;
}

function normalizeSharing(value, data) {
  if (!value || typeof value !== "object") {
    return { error: "invalid sharing payload" };
  }

  const users = {};
  const teams = {};

  for (const [userId, access] of Object.entries(value.users || {})) {
    if (!SHARE_ACCESS.has(access)) {
      return { error: "invalid share access" };
    }
    if (!data._users.some((user) => user.id === userId)) {
      return { error: "unknown shared user" };
    }
    users[userId] = access;
  }

  for (const [teamId, access] of Object.entries(value.teams || {})) {
    if (!SHARE_ACCESS.has(access)) {
      return { error: "invalid share access" };
    }
    if (!data._teams.some((team) => team.id === teamId)) {
      return { error: "unknown shared team" };
    }
    teams[teamId] = access;
  }

  return { value: { users, teams } };
}

module.exports = {
  createApp,
};
