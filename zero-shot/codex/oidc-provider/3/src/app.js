import express from "express";
import { jsonError } from "./http.js";
import { discoveryRouter } from "./routes/discovery.js";
import { jwksRouter } from "./routes/jwks.js";
import { authorizeRouter } from "./routes/authorize.js";
import { tokenRouter } from "./routes/token.js";
import { userinfoRouter } from "./routes/userinfo.js";

export function createApp() {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.use(discoveryRouter());
  app.use(jwksRouter());
  app.use(authorizeRouter());
  app.use(tokenRouter());
  app.use(userinfoRouter());

  app.get("/health", (req, res) => {
    res.type("application/json").json({ status: "ok" });
  });

  app.use((req, res) => {
    jsonError(res, 404, "not_found");
  });

  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    return jsonError(res, 500, "server_error");
  });

  return app;
}
