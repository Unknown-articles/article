const express = require('express');
const Database = require('./db');
const authModule = require('./auth');
const teamsModule = require('./teams');
const dynamicModule = require('./dynamic');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './db.json';

const db = new Database(DB_PATH);

(async () => {
  await db.init();

  const { router: authRouter, authenticate, requireAdmin } = authModule(db);
  const teamsRouter = teamsModule(db, authenticate, requireAdmin);
  const dynamicRouter = dynamicModule(db, authenticate);

  app.use('/auth', authRouter);
  app.use('/auth/teams', teamsRouter);
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/', dynamicRouter);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();