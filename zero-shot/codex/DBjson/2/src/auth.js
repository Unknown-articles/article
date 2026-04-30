const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { newId, publicUser, sanitizeUsers } = require("./utils");

const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";
const VALID_ROLES = new Set(["admin", "user"]);

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
}

function authMiddleware(db) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Bearer token required" });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const data = await db.snapshot();
      const user = data._users.find((candidate) => candidate.id === payload.sub);
      if (!user) return res.status(401).json({ error: "Invalid token" });
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin role required" });
  }
  next();
}

function createAuthRouter(db) {
  const express = require("express");
  const router = express.Router();
  const requireAuth = authMiddleware(db);

  router.post("/register", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    try {
      const user = await db.transaction(async (data) => {
        const taken = data._users.some((candidate) => candidate.username === username);
        if (taken) {
          const error = new Error("Username already taken");
          error.status = 409;
          throw error;
        }

        const now = new Date().toISOString();
        const role = data._users.length === 0 ? "admin" : "user";
        const created = {
          id: newId(),
          username,
          role,
          passwordHash: await bcrypt.hash(password, 10),
          createdAt: now,
          updatedAt: now,
        };
        data._users.push(created);
        return publicUser(created);
      });
      res.status(201).json(user);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const data = await db.snapshot();
    const user = data._users.find((candidate) => candidate.username === username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    res.json({ token: signToken(user) });
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json(publicUser(req.user));
  });

  router.get("/users", requireAuth, requireAdmin, async (req, res) => {
    const data = await db.snapshot();
    res.json({ users: sanitizeUsers(data._users) });
  });

  router.patch("/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    const { role } = req.body || {};
    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ error: "role must be admin or user" });
    }

    const user = await db.transaction(async (data) => {
      const target = data._users.find((candidate) => candidate.id === req.params.id);
      if (!target) {
        const error = new Error("User not found");
        error.status = 404;
        throw error;
      }
      target.role = role;
      target.updatedAt = new Date().toISOString();
      return publicUser(target);
    }).catch((error) => {
      res.status(error.status || 500).json({ error: error.message });
      return null;
    });

    if (user) res.json(user);
  });

  router.post("/teams", requireAuth, async (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });

    const team = await db.transaction(async (data) => {
      const now = new Date().toISOString();
      const created = {
        id: newId(),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
        createdAt: now,
        updatedAt: now,
      };
      data._teams.push(created);
      return created;
    });
    res.status(201).json(team);
  });

  router.get("/teams", requireAuth, async (req, res) => {
    const data = await db.snapshot();
    const teams = data._teams.filter((team) => team.members.includes(req.user.id));
    res.json({ teams });
  });

  router.get("/teams/:id", requireAuth, async (req, res) => {
    const data = await db.snapshot();
    const team = data._teams.find((candidate) => candidate.id === req.params.id);
    if (!team) return res.status(404).json({ error: "Team not found" });
    if (!team.members.includes(req.user.id)) {
      return res.status(403).json({ error: "Team membership required" });
    }
    res.json(team);
  });

  router.patch("/teams/:id", requireAuth, async (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });

    const team = await db.transaction(async (data) => {
      const target = data._teams.find((candidate) => candidate.id === req.params.id);
      if (!target) {
        const error = new Error("Team not found");
        error.status = 404;
        throw error;
      }
      if (target.ownerId !== req.user.id) {
        const error = new Error("Team owner required");
        error.status = 403;
        throw error;
      }
      target.name = name;
      target.updatedAt = new Date().toISOString();
      return target;
    }).catch((error) => {
      res.status(error.status || 500).json({ error: error.message });
      return null;
    });
    if (team) res.json(team);
  });

  router.delete("/teams/:id", requireAuth, async (req, res) => {
    const deleted = await db.transaction(async (data) => {
      const index = data._teams.findIndex((candidate) => candidate.id === req.params.id);
      if (index === -1) {
        const error = new Error("Team not found");
        error.status = 404;
        throw error;
      }
      if (data._teams[index].ownerId !== req.user.id) {
        const error = new Error("Team owner required");
        error.status = 403;
        throw error;
      }
      data._teams.splice(index, 1);
      return true;
    }).catch((error) => {
      res.status(error.status || 500).json({ error: error.message });
      return false;
    });
    if (deleted) res.json({ ok: true });
  });

  router.post("/teams/:id/members", requireAuth, async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const team = await db.transaction(async (data) => {
      const target = data._teams.find((candidate) => candidate.id === req.params.id);
      if (!target) {
        const error = new Error("Team not found");
        error.status = 404;
        throw error;
      }
      if (target.ownerId !== req.user.id && req.user.role !== "admin") {
        const error = new Error("Team owner or admin required");
        error.status = 403;
        throw error;
      }
      const userExists = data._users.some((candidate) => candidate.id === userId);
      if (!userExists) {
        const error = new Error("User not found");
        error.status = 404;
        throw error;
      }
      if (!target.members.includes(userId)) target.members.push(userId);
      target.updatedAt = new Date().toISOString();
      return target;
    }).catch((error) => {
      res.status(error.status || 500).json({ error: error.message });
      return null;
    });
    if (team) res.json(team);
  });

  router.delete("/teams/:id/members/:userId", requireAuth, async (req, res) => {
    const team = await db.transaction(async (data) => {
      const target = data._teams.find((candidate) => candidate.id === req.params.id);
      if (!target) {
        const error = new Error("Team not found");
        error.status = 404;
        throw error;
      }
      if (target.ownerId !== req.user.id) {
        const error = new Error("Team owner required");
        error.status = 403;
        throw error;
      }
      target.members = target.members.filter((member) => member !== req.params.userId);
      if (!target.members.includes(target.ownerId)) target.members.unshift(target.ownerId);
      target.updatedAt = new Date().toISOString();
      return target;
    }).catch((error) => {
      res.status(error.status || 500).json({ error: error.message });
      return null;
    });
    if (team) res.json(team);
  });

  return router;
}

module.exports = { authMiddleware, createAuthRouter };
