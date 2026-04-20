import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { get, run } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "development-chat-secret";
const TOKEN_EXPIRATION = "7d";

function buildTokenPayload(user) {
  return {
    userId: user.id,
    username: user.username,
  };
}

export function signToken(user) {
  return jwt.sign(buildTokenPayload(user), JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function registerUser(username, password) {
  const existingUser = await get("SELECT id FROM users WHERE username = ?", [
    username,
  ]);

  if (existingUser) {
    return { error: "Username already taken", status: 409 };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, passwordHash],
  );

  return {
    user: {
      id: result.lastID,
      username,
    },
  };
}

export async function loginUser(username, password) {
  const user = await get(
    "SELECT id, username, password FROM users WHERE username = ?",
    [username],
  );

  if (!user) {
    return null;
  }

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
  };
}
