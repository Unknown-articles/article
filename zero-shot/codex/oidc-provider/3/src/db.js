import fs from "node:fs/promises";
import path from "node:path";
import sqlite3 from "sqlite3";
import { DB_PATH } from "./config.js";

sqlite3.verbose();

let db;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    db.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function seed() {
  const now = Math.floor(Date.now() / 1000);

  await run(
    `INSERT OR IGNORE INTO clients (client_id, client_secret, redirect_uris, created_at)
     VALUES (?, ?, ?, ?)`,
    [
      "test-client",
      "test-secret",
      JSON.stringify(["http://localhost:8080/callback", "http://localhost:3001/callback"]),
      now
    ]
  );

  await run(
    `INSERT OR IGNORE INTO users (sub, username, password, email, name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["user-testuser", "testuser", "password123", "testuser@example.com", "Test User", now]
  );
}

export async function initDb() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  db = new sqlite3.Database(DB_PATH);
  await run("PRAGMA foreign_keys = ON");
  const schema = await fs.readFile(new URL("../schema.sql", import.meta.url), "utf8");
  await exec(schema);
  await seed();
}

export const database = { run, get, all, exec, close };
