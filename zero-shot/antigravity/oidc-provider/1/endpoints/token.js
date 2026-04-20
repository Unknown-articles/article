import express from 'express';
import * as jose from 'jose';
import dbPromise from '../db.js';
import { getKeyPair } from '../utils/keystore.js';

const router = express.Router();

router.post('/oauth2/token', async (req, res) => {
  const { grant_type, code, client_id, redirect_uri } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!code || !client_id || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  try {
    const db = await dbPromise;

    const row = await db.get('SELECT * FROM codes WHERE code = ?', [code]);

    if (!row) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    if (row.client_id !== client_id || row.redirect_uri !== redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    if (row.expires_at < Date.now()) {
      await db.run('DELETE FROM codes WHERE code = ?', [code]);
      return res.status(400).json({ error: 'invalid_grant', error_description: 'authorization code expired' });
    }

    // Code is valid and used
    await db.run('DELETE FROM codes WHERE code = ?', [code]);

    const { privateKey } = await getKeyPair();
    const issuer = `${req.protocol}://${req.get('host')}`;

    const accessToken = await new jose.SignJWT({ "client_id": client_id })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience('api')
      .setExpirationTime('1h')
      .setSubject(row.user_id)
      .sign(privateKey);

    const idToken = await new jose.SignJWT({
      nonce: row.nonce || undefined
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(client_id)
      .setExpirationTime('1h')
      .setSubject(row.user_id)
      .sign(privateKey);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: idToken
    });

  } catch (error) {
    console.error('Token error:', error);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;
