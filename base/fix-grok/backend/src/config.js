export const config = {
  port: process.env.PORT || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  issuer: process.env.ISSUER || `http://localhost:${process.env.PORT || 3001}`,
  clientId: 'default-client',
  redirectUri: process.env.REDIRECT_URI || `http://localhost:5173/callback`,
  dbPath: './data/oidc.db',
  jsonDbPath: './data/db.json'
};