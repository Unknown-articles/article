import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const BACKEND = 'http://localhost:3001';

function generateRandomString(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Base64url(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accessToken) {
      fetch(`${BACKEND}/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { setUser(u); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [accessToken]);

  const login = useCallback(async () => {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await sha256Base64url(codeVerifier);
    const state = generateRandomString(16);

    sessionStorage.setItem('pkce_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: 'default-client',
      redirect_uri: 'http://localhost:5173/callback',
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${BACKEND}/oauth2/authorize?${params}`;
  }, []);

  const handleCallback = useCallback(async (code, state) => {
    const savedState = sessionStorage.getItem('oauth_state');
    const codeVerifier = sessionStorage.getItem('pkce_verifier');

    if (state !== savedState) throw new Error('State mismatch');

    const resp = await fetch(`${BACKEND}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:5173/callback',
        client_id: 'default-client',
        code_verifier: codeVerifier,
      }),
    });

    if (!resp.ok) throw new Error('Token exchange failed');
    const { access_token } = await resp.json();

    localStorage.setItem('access_token', access_token);
    setAccessToken(access_token);
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('oauth_state');

    const userInfo = await fetch(`${BACKEND}/userinfo`, { headers: { Authorization: `Bearer ${access_token}` } }).then(r => r.json());
    setUser(userInfo);
  }, []);

  const register = useCallback(async (username, email, password) => {
    const resp = await fetch(`${BACKEND}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.error); }
    return resp.json();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, handleCallback, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
