const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const authRouter = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRouter);

const dynamicRouter = require('./dynamic');
app.use('/', dynamicRouter);

const PORT = process.env.PORT || 3000;

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`running on port ${PORT}`);
  });
}

start();
