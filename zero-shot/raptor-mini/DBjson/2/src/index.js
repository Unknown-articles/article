const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const config = require('./config');
const db = require('./db');
const authRouter = require('./routes/auth');
const resourceRouter = require('./routes/resource');

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/', resourceRouter);

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

const port = config.port;

db.init()
  .then(() => {
    app.listen(port, () => {
      console.log(`server running on ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database', err);
    process.exit(1);
  });
