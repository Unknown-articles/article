import express from 'express';
import discoveryRouter from './routes/discovery.js';
import authorizeRouter from './routes/authorize.js';
import tokenRouter from './routes/token.js';
import userinfoRouter from './routes/userinfo.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(discoveryRouter);
app.use(authorizeRouter);
app.use(tokenRouter);
app.use(userinfoRouter);

export default app;
