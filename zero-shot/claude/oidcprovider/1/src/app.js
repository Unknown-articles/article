import express from 'express';
import discoveryRoutes from './routes/discovery.js';
import authorizationRoutes from './routes/authorization.js';
import tokenRoutes from './routes/token.js';
import userinfoRoutes from './routes/userinfo.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensureActiveKey } from './keys/keyManager.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

ensureActiveKey();

app.use(discoveryRoutes);
app.use(authorizationRoutes);
app.use(tokenRoutes);
app.use(userinfoRoutes);

app.use(errorHandler);

export default app;
