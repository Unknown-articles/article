import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "./db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "change_this_secret";

function createToken(user) {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "12h",
  });
}

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      username,
      hashedPassword
    );

    const token = createToken({ id: result.lastID, username });
    return res.status(201).json({ token, userId: result.lastID, username });
  } catch (error) {
    if (error.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Username already taken" });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await db.get("SELECT id, username, password FROM users WHERE username = ?", username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createToken({ id: user.id, username: user.username });
  return res.status(200).json({ token, userId: user.id, username: user.username });
});

export default router;
