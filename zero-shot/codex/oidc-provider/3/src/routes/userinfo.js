import { Router } from "express";
import { database } from "../db.js";
import { asyncHandler, jsonError } from "../http.js";
import { now, parseScopes } from "../oauth.js";

function bearerToken(header = "") {
  const [scheme, token, extra] = header.split(" ");
  if (scheme !== "Bearer" || !token || extra) return undefined;
  return token;
}

async function findValidToken(accessToken) {
  return database.get(
    `SELECT tokens.*, users.sub, users.email, users.name
     FROM tokens
     JOIN users ON users.id = tokens.user_id
     WHERE tokens.access_token = ?`,
    [accessToken]
  );
}

function claimsForToken(token) {
  const scopes = parseScopes(token.scope);
  const claims = { sub: token.sub };

  if (scopes.includes("email")) claims.email = token.email;
  if (scopes.includes("profile")) claims.name = token.name;

  return claims;
}

export function userinfoRouter() {
  const router = Router();

  router.get(
    "/userinfo",
    asyncHandler(async (req, res) => {
      const accessToken = bearerToken(req.get("authorization"));
      if (!accessToken) return jsonError(res, 401, "invalid_token");

      const token = await findValidToken(accessToken);
      if (!token || token.expires_at <= now()) return jsonError(res, 401, "invalid_token");

      return res.status(200).type("application/json").json(claimsForToken(token));
    })
  );

  router.post("/userinfo", (req, res) => {
    res.status(405).type("application/json").json({ error: "method_not_allowed" });
  });

  return router;
}
