const path = require('path');
const express = require('express');
const JsonDB = require('./db');
const createAuthRouter = require('./auth');
const createResourceRouter = require('./resource');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
const app = express();
const database = new JsonDB(DB_PATH);

app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', createAuthRouter(database));
app.use(createResourceRouter(database));

async function start() {
  await database.init();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Startup error', err);
  process.exit(1);
});
