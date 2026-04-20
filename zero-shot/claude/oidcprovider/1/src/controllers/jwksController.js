import { getAllPublicKeys } from '../crypto/keys.js';

export async function getJwks(_req, res) {
  try {
    const jwks = await getAllPublicKeys();
    // Cache for 1 hour; clients should re-fetch on unknown kid
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(jwks);
  } catch (err) {
    console.error('JWKS error:', err);
    res.status(500).json({ error: 'server_error', error_description: 'Failed to retrieve JWKS' });
  }
}
