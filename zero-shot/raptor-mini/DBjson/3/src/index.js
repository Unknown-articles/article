const express = require('express');
const db = require('./db');
const authRouter = require('./auth');
const resourceRouter = require('./resource');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/', resourceRouter);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await db.ensureDatabaseFile();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize database', error);
    process.exit(1);
  }
}

startServer();
