const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const DEFAULT_CLIENT_ID = 'default-client';

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

export const wsBaseUrl =
  import.meta.env.VITE_WS_BASE_URL ||
  apiBaseUrl.replace(/^http/i, match => (match.toLowerCase() === 'https' ? 'wss' : 'ws'));

export const oidcClientId =
  import.meta.env.VITE_OIDC_CLIENT_ID || DEFAULT_CLIENT_ID;

export const oidcRedirectUri =
  import.meta.env.VITE_OIDC_REDIRECT_URI ||
  `${window.location.origin}/callback`;
