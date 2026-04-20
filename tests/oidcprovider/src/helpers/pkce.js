import { createHash, randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically random PKCE code_verifier (43–128 chars, URL-safe).
 */
export function generateCodeVerifier() {
  return randomBytes(32).toString('base64url');
}

/**
 * Derive the code_challenge from a code_verifier using S256 method.
 */
export function generateCodeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate a complete PKCE pair.
 */
export function generatePKCE() {
  const code_verifier = generateCodeVerifier();
  const code_challenge = generateCodeChallenge(code_verifier);
  return { code_verifier, code_challenge, code_challenge_method: 'S256' };
}
