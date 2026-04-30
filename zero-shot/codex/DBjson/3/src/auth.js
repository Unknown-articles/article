const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";
const VALID_ROLES = new Set(["admin", "user"]);

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function nextId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createAuthMiddleware(store) {
  return async function requireAuth(req, res, next) {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Bearer token required" });

    try {
      const payload = jwt.verify(match[1], JWT_SECRET);
      const user = await store.view((db) => db._users.find((item) => item.id === payload.sub));
      if (!user) return res.status(401).json({ error: "Invalid token" });
      req.user = publicUser(user);
      return next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin role required" });
  }
  return next();
}

function createAuthRouter(store, requireAuth) {
  const router = require("express").Router();

  router.post("/register", async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: "username and password are required" });
      }

      const user = await store.transaction(async (db) => {
        const exists = db._users.some((item) => item.username === username);
        if (exists) {
          const error = new Error("Username already taken");
          error.status = 409;
          throw error;
        }

        const now = new Date().toISOString();
        const role = db._users.length === 0 ? "admin" : "user";
        const created = {
          id: nextId("usr"),
          username,
          role,
          passwordHash: await bcrypt.hash(password, 10),
          createdAt: now,
          updatedAt: now,
        };
        db._users.push(created);
        return publicUser(created);
      });

      return res.status(201).json(user);
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      return next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: "username and password are required" });
      }

      const user = await store.view((db) => db._users.find((item) => item.username === username));
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
      return res.json({ token });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json(req.user);
  });

  router.get("/users", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const users = await store.view((db) => db._users.map(publicUser));
      res.json({ users });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/users/:id/role", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { role } = req.body || {};
      if (!VALID_ROLES.has(role)) return res.status(400).json({ error: "Invalid role" });

      const user = await store.transaction(async (db) => {
        const found = db._users.find((item) => item.id === req.params.id);
        if (!found) {
          const error = new Error("User not found");
          error.status = 404;
          throw error;
        }
        found.role = role;
        found.updatedAt = new Date().toISOString();
        return publicUser(found);
      });
      return res.json(user);
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createAuthMiddleware,
  createAuthRouter,
  nextId,
  publicUser,
  requireAdmin,
};
