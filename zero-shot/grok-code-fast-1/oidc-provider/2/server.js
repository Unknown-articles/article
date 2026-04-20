import express from 'express';
import cors from 'cors';
import routes from './src/routes/index.js';
import { initDB } from './database/init.js';

const app = express();

await initDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', routes);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`OIDC Provider listening on port ${port}`);
});