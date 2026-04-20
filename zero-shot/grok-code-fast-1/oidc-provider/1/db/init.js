import { initDb } from '../services/db.js';

await initDb();
console.log('Database initialized.');