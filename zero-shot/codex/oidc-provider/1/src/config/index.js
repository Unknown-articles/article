import path from 'node:path';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const issuer = process.env.OIDC_ISSUER ?? `http://localhost:${port}`;

export const config = {
  port,
  issuer,
  accessTokenTtlSeconds: 3600,
  idTokenTtlSeconds: 3600,
  dataDir: path.resolve(process.cwd(), 'data'),
  databasePath: path.resolve(process.cwd(), 'data', 'oidc.sqlite'),
};
