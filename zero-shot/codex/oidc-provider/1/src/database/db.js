import fs from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';

export async function openDatabase(filename) {
  await fs.mkdir(path.dirname(filename), { recursive: true });

  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(filename, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(database);
    });
  });
}

export function run(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
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

export function get(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row ?? null);
    });
  });
}

export function all(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

export async function withTransaction(database, work) {
  await run(database, 'BEGIN TRANSACTION');

  try {
    const result = await work();
    await run(database, 'COMMIT');
    return result;
  } catch (error) {
    await run(database, 'ROLLBACK');
    throw error;
  }
}
