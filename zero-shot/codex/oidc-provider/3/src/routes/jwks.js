import { Router } from "express";
import { asyncHandler } from "../http.js";
import { getPublicJwks, rotateSigningKey } from "../keys.js";

export function jwksRouter() {
  const router = Router();

  router.get(
    "/.well-known/jwks.json",
    asyncHandler(async (req, res) => {
      res.type("application/json").json(await getPublicJwks());
    })
  );

  router.post(
    "/admin/rotate-keys",
    asyncHandler(async (req, res) => {
      const key = await rotateSigningKey();
      res.status(201).type("application/json").json({ kid: key.kid, active: true });
    })
  );

  return router;
}
