require('dotenv').config();
const express = require('express');
const { ensureDbInitialized } = require('./db');
const { authRouter } = require('./auth');
const { teamsRouter } = require('./teams');
const { dynamicRouter } = require('./dynamic');

const app = express();
app.use(express.json());

app.use('/auth/teams', teamsRouter);
app.use('/auth', authRouter);
app.use('/', dynamicRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await ensureDbInitialized();
    app.listen(PORT, () => {
      console.log(`running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
