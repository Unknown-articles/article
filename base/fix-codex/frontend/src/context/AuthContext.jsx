import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiBaseUrl, oidcClientId, oidcRedirectUri } from '../config.js';

const AuthContext = createContext(null);

function generateRandomString(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Base64url(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    fetch(`${apiBaseUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(response => (response.ok ? response.json() : null))
      .then(currentUser => {
        setUser(currentUser);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accessToken]);

  const login = useCallback(async () => {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await sha256Base64url(codeVerifier);
    const state = generateRandomString(16);

    sessionStorage.setItem('pkce_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: oidcClientId,
      redirect_uri: oidcRedirectUri,
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${apiBaseUrl}/oauth2/authorize?${params}`;
  }, []);

  const handleCallback = useCallback(async (code, state) => {
    const savedState = sessionStorage.getItem('oauth_state');
    const codeVerifier = sessionStorage.getItem('pkce_verifier');

    if (state !== savedState) throw new Error('State mismatch');

    const response = await fetch(`${apiBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: oidcRedirectUri,
        client_id: oidcClientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) throw new Error('Token exchange failed');

    const { access_token } = await response.json();
    localStorage.setItem('access_token', access_token);
    setAccessToken(access_token);
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('oauth_state');

    const userInfo = await fetch(`${apiBaseUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    }).then(result => result.json());
    setUser(userInfo);
  }, []);

  const register = useCallback(async (username, email, password) => {
    const response = await fetch(`${apiBaseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) {
      const errorPayload = await response.json();
      throw new Error(errorPayload.error);
    }

    return response.json();
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
