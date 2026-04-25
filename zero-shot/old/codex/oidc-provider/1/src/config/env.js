const DEFAULT_PORT = 3000;
const DEFAULT_ISSUER = 'http://127.0.0.1:3000';
const DEFAULT_DATABASE_FILE = 'data/oidc-provider.sqlite';

export function getConfig() {
  const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
  const issuer = process.env.OIDC_ISSUER ?? DEFAULT_ISSUER;
  const databaseFile = process.env.DATABASE_FILE ?? DEFAULT_DATABASE_FILE;

  return {
    port,
    issuer,
    databaseFile,
  };
}
