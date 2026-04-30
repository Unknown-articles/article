const express = require('express');
const { initDB } = require('./db');
const auth = require('./auth');
const teams = require('./teams');

const app = express();
app.use(express.json());

app.use('/auth/teams', teams);
app.use('/auth', auth.router);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/', require('./resource'));

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize DB', err);
  process.exit(1);
});
