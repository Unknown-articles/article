const express = require("express");
const { HttpError } = require("./errors");
const { authenticateOptional, requireAuth, resolveCurrentUser } = require("./middleware/auth");

function createApp({ dataService, authService }) {
  const app = express();

  app.use(express.json());
  app.use(authenticateOptional);
  app.use(resolveCurrentUser(authService));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/auth/register", async (request, response, next) => {
    try {
      const authResult = await authService.register(request.body);
      response.status(201).json(authResult);
    } catch (error) {
      next(error);
    }
  });

  app.post("/auth/login", async (request, response, next) => {
    try {
      const authResult = await authService.login(request.body);
      response.json(authResult);
    } catch (error) {
      next(error);
    }
  });

  app.get("/auth/teams", requireAuth, async (request, response, next) => {
    try {
      const teams = await authService.listTeams(request.user);
      response.json(teams);
    } catch (error) {
      next(error);
    }
  });

  app.post("/auth/teams", requireAuth, async (request, response, next) => {
    try {
      const team = await authService.createTeam(request.user, request.body);
      response.status(201).json(team);
    } catch (error) {
      next(error);
    }
  });

  app.post("/auth/teams/:teamId/members", requireAuth, async (request, response, next) => {
    try {
      const team = await authService.addTeamMember(request.user, request.params.teamId, request.body);
      response.json(team);
    } catch (error) {
      next(error);
    }
  });

  app.get("/:resource", requireAuth, async (request, response, next) => {
    try {
      const result = await dataService.list(request.params.resource, request.user, request.query);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/:resource/:id", requireAuth, async (request, response, next) => {
    try {
      const item = await dataService.get(request.params.resource, request.params.id, request.user);
      response.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.post("/:resource", requireAuth, async (request, response, next) => {
    try {
      const item = await dataService.create(request.params.resource, request.body, request.user);
      response.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  app.put("/:resource/:id", requireAuth, async (request, response, next) => {
    try {
      const item = await dataService.replace(
        request.params.resource,
        request.params.id,
        request.body,
        request.user,
      );
      response.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/:resource/:id", requireAuth, async (request, response, next) => {
    try {
      const item = await dataService.patch(
        request.params.resource,
        request.params.id,
        request.body,
        request.user,
      );
      response.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/:resource/:id", requireAuth, async (request, response, next) => {
    try {
      const item = await dataService.remove(request.params.resource, request.params.id, request.user);
      response.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.post("/:resource/:id/share", requireAuth, async (request, response, next) => {
    try {
      const item = await dataService.share(request.params.resource, request.params.id, request.body, request.user);
      response.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, _response, next) => {
    next(new HttpError(404, "Route not found"));
  });

  app.use((error, _request, response, _next) => {
    const status = error.statusCode || 500;

    response.status(status).json({
      error: error.message || "Internal server error",
    });
  });

  return app;
}

module.exports = {
  createApp,
};
