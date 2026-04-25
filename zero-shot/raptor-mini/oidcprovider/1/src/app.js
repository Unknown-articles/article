import express from 'express';
import discoveryRouter from './routes/discovery.js';
import jwksRouter from './routes/jwks.js';
import authorizeRouter from './routes/authorize.js';
import tokenRouter from './routes/token.js';
import userinfoRouter from './routes/userinfo.js';
import { json, urlencoded } from 'express';

const app = express();

app.use(json());
app.use(urlencoded({ extended: true }));

app.use('/.well-known', discoveryRouter);
app.use('/.well-known', jwksRouter);
app.use('/oauth2', authorizeRouter);
app.use('/oauth2', tokenRouter);
app.use('/', userinfoRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', error_description: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
});

export default app;
