const express = require('express');
const config = require('./config');
const authRouter = require('./routes/auth');
const dynamicRouter = require('./routes/dynamic');
const ApiError = require('./errors/ApiError');

const app = express();
app.use(express.json());

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth routes (must come before dynamic catch-all)
app.use('/auth', authRouter);

// Dynamic resource routes
app.use('/', dynamicRouter);

// Global error handler
app.use((err, _req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

module.exports = app;
