'use strict';

const express  = require('express');
const config   = require('./config');
const authRouter    = require('./routes/auth');
const dynamicRouter = require('./routes/dynamic');
const { authenticate } = require('./middleware/auth');
const ApiError = require('./errors/ApiError');

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check  (unauthenticated)
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Auth routes  (public – login / register)
// ---------------------------------------------------------------------------
app.use('/auth', authRouter);

// ---------------------------------------------------------------------------
// Dynamic resource routes  (all protected)
//
// Express strips the /:resource prefix before handing off to dynamicRouter.
// Using mergeParams:true in dynamicRouter makes req.params.resource available.
//
// Example:  GET /products/123
//   → dynamicRouter sees  GET /123
//   → req.params = { resource: 'products', id: '123' }
// ---------------------------------------------------------------------------
app.use('/:resource', authenticate, dynamicRouter);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(config.PORT, () => {
  console.log(`Dynamic JSON API running on http://localhost:${config.PORT}`);
  console.log(`Database: ${config.DB_PATH}`);
});

module.exports = app;
