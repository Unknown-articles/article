import express from 'express';
import cors from 'cors';
import { initDb } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

import discoveryRouter from './src/routes/discovery.js';
import jwksRouter from './src/routes/jwks.js';
import authorizeRouter from './src/routes/authorize.js';
import tokenRouter from './src/routes/token.js';
import userinfoRouter from './src/routes/userinfo.js';

app.use(discoveryRouter);
app.use(jwksRouter);
app.use(authorizeRouter);
app.use(tokenRouter);
app.use(userinfoRouter);

if (process.env.NODE_ENV !== 'test') {
  initDb()
    .then(() => {
      console.log('Database initialized with seed data.');
      app.listen(PORT, () => {
        console.log(`OIDC Provider server listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}

export default app;
