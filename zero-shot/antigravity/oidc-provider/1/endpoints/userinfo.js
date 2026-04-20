import express from 'express';
import * as jose from 'jose';
import { getJWKS } from '../utils/keystore.js';

const router = express.Router();

router.get('/userinfo', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', error_description: 'Bearer token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const jwks = await getJWKS();
    const jwk = jwks.keys[0];
    const publicKey = await jose.importJWK(jwk, 'RS256');

    const { payload } = await jose.jwtVerify(token, publicKey, {
      audience: 'api',
      algorithms: ['RS256'],
    });

    res.json({
      sub: payload.sub,
      name: 'Mock User',
      email: payload.sub + '@example.com',
      preferred_username: payload.sub
    });

  } catch (error) {
    console.error('Userinfo validation error:', error);
    res.status(401).json({ error: 'invalid_token' });
  }
});

export default router;
