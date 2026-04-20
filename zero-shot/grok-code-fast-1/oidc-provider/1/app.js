import express from 'express';
import cors from 'cors';
import discoveryRoutes from './routes/discovery.js';
import jwksRoutes from './routes/jwks.js';
import authRoutes from './routes/auth.js';
import tokenRoutes from './routes/token.js';
import userinfoRoutes from './routes/userinfo.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', discoveryRoutes);
app.use('/', jwksRoutes);
app.use('/oauth2', authRoutes);
app.use('/oauth2', tokenRoutes);
app.use('/', userinfoRoutes);

export default app;