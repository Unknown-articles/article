import express from 'express';
import crypto from 'crypto';
import dbPromise from '../db.js';

const router = express.Router();

router.get('/oauth2/authorize', async (req, res) => {
  const { response_type, client_id, redirect_uri, state, nonce, user_id } = req.query;

  if (response_type !== 'code') {
    return res.status(400).json({ error: 'unsupported_response_type' });
  }

  if (!client_id || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'client_id and redirect_uri are required' });
  }

  // To simulate a logged in user in this API-only flow, we use user_id query param
  const subject = user_id || 'mock_user_123';

  try {
    const db = await dbPromise;
    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await db.run(
      'INSERT INTO codes (code, client_id, redirect_uri, user_id, nonce, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [code, client_id, redirect_uri, subject, nonce || null, expiresAt]
    );

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.append('code', code);
    if (state) {
      redirectUrl.searchParams.append('state', state);
    }

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;
