'use strict';
const express = require('express');
const authRouter     = require('./routes/auth');
const resourceRouter = require('./routes/resource');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth routes (/auth/register, /auth/login, /auth/me, /auth/users, /auth/teams)
app.use('/auth', authRouter);

// Dynamic resource routes (/:resource, /:resource/:id)
app.use('/', resourceRouter);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
