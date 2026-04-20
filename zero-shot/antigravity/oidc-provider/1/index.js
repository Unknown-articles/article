import express from 'express';
import cors from 'cors';
import dbPromise from './db.js';

import discoveryRouter from './endpoints/discovery.js';
import jwksRouter from './endpoints/jwks.js';
import authorizeRouter from './endpoints/authorize.js';
import tokenRouter from './endpoints/token.js';
import userinfoRouter from './endpoints/userinfo.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', discoveryRouter);
app.use('/', jwksRouter);
app.use('/', authorizeRouter);
app.use('/', tokenRouter);
app.use('/', userinfoRouter);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('OIDC Provider API is running');
});

async function startServer() {
  try {
    await dbPromise; // ensure db is initialized
    console.log('Database initialized.');
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

startServer();
