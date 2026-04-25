import { listPublicJwks } from '../services/key-service.js';

export async function getJwks(_req, res) {
  const keys = await listPublicJwks();

  res.json({ keys });
}
