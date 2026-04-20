import fs from 'node:fs/promises';
import sqlite3 from 'sqlite3';
import { config } from '../config/index.js';

sqlite3.verbose();

let dbPromise;

function openDatabase(filename) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filename, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(db);
    });
  });
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      await fs.mkdir(config.dataDir, { recursive: true });
      return openDatabase(config.databasePath);
    })();
  }

  return dbPromise;
}

export async function run(sql, params = []) {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

export async function get(sql, params = []) {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row ?? null);
    });
  });
}

export async function all(sql, params = []) {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}
