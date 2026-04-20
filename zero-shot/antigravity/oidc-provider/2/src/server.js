import express from 'express';
import discoveryRoutes from './routes/discovery.js';
import oauth2Routes from './routes/oauth2.js';
import userinfoRoutes from './routes/userinfo.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(discoveryRoutes);
app.use(oauth2Routes);
app.use(userinfoRoutes);

app.get('/', (req, res) => res.json({ status: 'ok' }));

export default app;
