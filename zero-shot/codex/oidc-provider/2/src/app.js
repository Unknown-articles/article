import express from 'express';
import authorizationRoutes from './routes/authorization-routes.js';
import discoveryRoutes from './routes/discovery-routes.js';
import { errorHandler } from './middleware/error-handler.js';
import jwksRoutes from './routes/jwks-routes.js';
import tokenRoutes from './routes/token-routes.js';
import userinfoRoutes from './routes/userinfo-routes.js';

export function createApp() {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.use(authorizationRoutes);
  app.use(discoveryRoutes);
  app.use(jwksRoutes);
  app.use(tokenRoutes);
  app.use(userinfoRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: 'not_found',
      error_description: `No route registered for ${req.method} ${req.path}`,
    });
  });

  app.use(errorHandler);

  return app;
}
