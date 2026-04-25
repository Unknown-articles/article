import express from 'express';
import discoveryRoutes    from './routes/discovery.js';
import authorizationRoutes from './routes/authorization.js';
import tokenRoutes        from './routes/token.js';
import userinfoRoutes     from './routes/userinfo.js';
import { errorHandler }   from './middleware/errorHandler.js';

const app = express();

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/.well-known', discoveryRoutes);
app.use('/oauth2',      authorizationRoutes);
app.use('/oauth2',      tokenRoutes);
app.use('/',            userinfoRoutes);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'not_found', error_description: 'Endpoint not found' });
});

app.use(errorHandler);

export default app;
