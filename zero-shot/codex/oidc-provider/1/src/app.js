import express from 'express';
import adminRoutes from './routes/admin-routes.js';
import oauthRoutes from './routes/oauth-routes.js';
import userinfoRoutes from './routes/userinfo-routes.js';
import wellKnownRoutes from './routes/well-known-routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export function createApp({ config, database }) {
  const app = express();

  app.locals.config = config;
  app.locals.database = database;

  app.use(express.json());
  app.use('/oauth2', adminRoutes);
  app.use('/oauth2', oauthRoutes);
  app.use('/userinfo', userinfoRoutes);
  app.use('/.well-known', wellKnownRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
