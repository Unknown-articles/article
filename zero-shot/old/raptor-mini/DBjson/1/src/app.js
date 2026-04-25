const path = require('path');
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const dynamicRoutes = require('./routes/dynamicRoutes');
const DataStore = require('./dataStore');

const dbFile = process.env.DB_FILE || path.resolve(__dirname, '../data/db.json');
const dataStore = new DataStore(dbFile);

const app = express();
app.locals.dataStore = dataStore;
app.use(express.json());
app.use('/auth', authRoutes(dataStore));

app.get('/health', (req, res) => {
  res.status(200).json({status: 'ok'});
});

app.use(dynamicRoutes(dataStore));

app.use((err, req, res, next) => {
  if (err && err.status) {
    return res.status(err.status).json({error: err.message});
  }
  console.error(err);
  res.status(500).json({error: 'Internal server error'});
});

module.exports = app;
