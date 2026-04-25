import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDB() {
  const dbPath = path.join(__dirname, '..', 'oidc.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schema, (err) => {
        if (err) return reject(err);
        const seedQueries = [
          `INSERT INTO users (username, password, email) VALUES ('testuser', 'password123', 'testuser@example.com')`,
          `INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES ('test-client', 'test-secret', '["http://localhost:8080/callback", "http://localhost:3001/callback"]')`
        ];
        let completed = 0;
        seedQueries.forEach(query => {
          db.run(query, (err) => {
            if (err) return reject(err);
            completed++;
            if (completed === seedQueries.length) {
              db.close();
              resolve();
            }
          });
        });
      });
    });
  });
}