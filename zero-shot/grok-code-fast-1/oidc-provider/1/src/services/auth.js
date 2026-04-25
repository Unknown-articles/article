import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { privateKey, kid } from '../utils/keys.js';
import { getUserById, getUserByUsername, getClientById, createAuthorizationCode, getAuthorizationCode, markCodeUsed, createToken } from '../models/db.js';

export async function authenticateUser(username, password) {
  const user = await getUserByUsername(username);
  if (user && user.password === password) { // in real, hash
    return user;
  }
  return null;
}

export async function validateClient(clientId, redirectUri) {
  const client = await getClientById(clientId);
  if (!client) return null;
  const uris = JSON.parse(client.redirect_uris);
  if (!uris.includes(redirectUri)) return null;
  return client;
}

export function generateAuthCode() {
  return crypto.randomBytes(32).toString('hex');
}

export async function storeAuthCode(code, clientId, userId, redirectUri, scope, state, codeChallenge, codeChallengeMethod) {
  return await createAuthorizationCode(code, clientId, userId, redirectUri, scope, state, codeChallenge, codeChallengeMethod);
}

export async function validateAuthCode(code, clientId, redirectUri) {
  const authCode = await getAuthorizationCode(code);
  if (!authCode || authCode.client_id !== clientId || authCode.redirect_uri !== redirectUri) {
    return null;
  }
  await markCodeUsed(code);
  return authCode;
}

export function generateAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function generateIdToken(user, clientId, issuer) {
  const payload = {
    sub: user.id.toString(),
    iss: issuer,
    aud: clientId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  };
  return jwt.sign(payload, privateKey, { algorithm: 'RS256', keyid: kid });
}

export async function createTokens(clientId, userId, scope) {
  const accessToken = generateAccessToken();
  const user = await getUserById(userId);
  const issuer = process.env.ISSUER || 'http://localhost:3000';
  const idToken = generateIdToken(user, clientId, issuer);
  await createToken(accessToken, idToken, clientId, userId, scope);
  return { accessToken, idToken };
}

export function verifyPKCE(codeVerifier, codeChallenge, method) {
  if (method !== 'S256') return false;
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const challenge = Buffer.from(hash).toString('base64url');
  return challenge === codeChallenge;
}