import { Router } from "express";
import { loginUser, registerUser, signToken } from "../auth.js";

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;

function validateCredentials(username, password) {
  if (!username || username.trim().length < MIN_USERNAME_LENGTH) {
    return "Username must be at least 3 characters long";
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return "Password must be at least 6 characters long";
  }

  return null;
}

export function createAuthRouter() {
  const router = Router();

  router.post("/register", async (request, response, next) => {
    try {
      const username = request.body?.username?.trim();
      const password = request.body?.password;
      const validationError = validateCredentials(username, password);

      if (validationError) {
        response.status(400).json({ error: validationError });
        return;
      }

      const result = await registerUser(username, password);

      if (result.error) {
        response.status(result.status).json({ error: result.error });
        return;
      }

      const token = signToken(result.user);
      response.status(201).json({
        token,
        userId: result.user.id,
        username: result.user.username,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (request, response, next) => {
    try {
      const username = request.body?.username?.trim();
      const password = request.body?.password;
      const validationError = validateCredentials(username, password);

      if (validationError) {
        response.status(400).json({ error: validationError });
        return;
      }

      const user = await loginUser(username, password);

      if (!user) {
        response.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const token = signToken(user);
      response.status(200).json({
        token,
        userId: user.id,
        username: user.username,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
