const { nextId } = require("./auth");

function canAddTeamMember(user, team) {
  return user.role === "admin" || team.ownerId === user.id;
}

function publicTeam(team) {
  return {
    id: team.id,
    name: team.name,
    ownerId: team.ownerId,
    members: team.members || [],
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

function createTeamsRouter(store, requireAuth) {
  const router = require("express").Router();
  router.use(requireAuth);

  router.post("/", async (req, res, next) => {
    try {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ error: "name is required" });
      const team = await store.transaction(async (db) => {
        const now = new Date().toISOString();
        const created = {
          id: nextId("team"),
          name,
          ownerId: req.user.id,
          members: [req.user.id],
          createdAt: now,
          updatedAt: now,
        };
        db._teams.push(created);
        return publicTeam(created);
      });
      res.status(201).json(team);
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const teams = await store.view((db) =>
        db._teams.filter((team) => (team.members || []).includes(req.user.id)).map(publicTeam)
      );
      res.json(teams);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const team = await store.view((db) => db._teams.find((item) => item.id === req.params.id));
      if (!team) return res.status(404).json({ error: "Team not found" });
      if (!(team.members || []).includes(req.user.id)) {
        return res.status(403).json({ error: "Team access denied" });
      }
      res.json(publicTeam(team));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ error: "name is required" });
      const team = await store.transaction(async (db) => {
        const found = db._teams.find((item) => item.id === req.params.id);
        if (!found) {
          const error = new Error("Team not found");
          error.status = 404;
          throw error;
        }
        if (found.ownerId !== req.user.id) {
          const error = new Error("Team owner role required");
          error.status = 403;
          throw error;
        }
        found.name = name;
        found.updatedAt = new Date().toISOString();
        return publicTeam(found);
      });
      res.json(team);
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      await store.transaction(async (db) => {
        const index = db._teams.findIndex((item) => item.id === req.params.id);
        if (index === -1) {
          const error = new Error("Team not found");
          error.status = 404;
          throw error;
        }
        if (db._teams[index].ownerId !== req.user.id) {
          const error = new Error("Team owner role required");
          error.status = 403;
          throw error;
        }
        db._teams.splice(index, 1);
      });
      res.status(204).send();
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });

  router.post("/:id/members", async (req, res, next) => {
    try {
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const team = await store.transaction(async (db) => {
        const found = db._teams.find((item) => item.id === req.params.id);
        if (!found) {
          const error = new Error("Team not found");
          error.status = 404;
          throw error;
        }
        if (!canAddTeamMember(req.user, found)) {
          const error = new Error("Team owner role required");
          error.status = 403;
          throw error;
        }
        if (!db._users.some((user) => user.id === userId)) {
          const error = new Error("User not found");
          error.status = 404;
          throw error;
        }
        found.members = Array.from(new Set([...(found.members || []), userId]));
        found.updatedAt = new Date().toISOString();
        return publicTeam(found);
      });
      res.json(team);
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });

  router.delete("/:id/members/:userId", async (req, res, next) => {
    try {
      const team = await store.transaction(async (db) => {
        const found = db._teams.find((item) => item.id === req.params.id);
        if (!found) {
          const error = new Error("Team not found");
          error.status = 404;
          throw error;
        }
        if (found.ownerId !== req.user.id) {
          const error = new Error("Team owner role required");
          error.status = 403;
          throw error;
        }
        found.members = (found.members || []).filter((id) => id !== req.params.userId);
        found.updatedAt = new Date().toISOString();
        return publicTeam(found);
      });
      res.json(team);
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });

  return router;
}

module.exports = { canAddTeamMember, createTeamsRouter };
