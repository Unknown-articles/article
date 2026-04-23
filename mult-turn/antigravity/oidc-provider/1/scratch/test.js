import crypto from 'crypto';

async function testFlow() {
  const baseUrl = 'http://localhost:4000';
  
  const getCode = async (challenge) => {
    const body = new URLSearchParams({
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3001/callback',
      response_type: 'code',
      scope: 'openid',
      username: 'testuser',
      password: 'password123'
    });
    if (challenge) {
      body.append('code_challenge', challenge);
      body.append('code_challenge_method', 'S256');
    }
    const res = await fetch(`${baseUrl}/oauth2/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'manual'
    });
    const loc = res.headers.get('location');
    if (!loc) throw new Error("No location header, got: " + res.status);
    const code = new URL(loc).searchParams.get('code');
    return code;
  };

  const getToken = async (code, verifier) => {
    const body = new URLSearchParams({
      client_id: 'test-client',
      client_secret: 'test-secret',
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:3001/callback'
    });
    if (verifier) {
      body.append('code_verifier', verifier);
    }
    const res = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json();
    return { status: res.status, headers: res.headers, data };
  };

  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  
  const code1 = await getCode(challenge);
  const t1 = await getToken(code1, verifier);
  if (t1.status !== 200) throw new Error("Valid PKCE failed: " + JSON.stringify(t1));
  console.log("Valid PKCE flow succeeded.");
  
  if (t1.headers.get('cache-control') !== 'no-store') throw new Error("Missing Cache-Control header");
  console.log("Cache-Control no-store header validated.");

  const t1_reuse = await getToken(code1, verifier);
  if (t1_reuse.status !== 400 || t1_reuse.data.error !== 'invalid_grant') throw new Error("Reuse prevention failed");
  console.log("Authorization code reuse correctly rejected.");

  const jwksRes = await fetch(`${baseUrl}/.well-known/jwks.json`);
  const jwks = await jwksRes.json();
  const jwk = jwks.keys[0];
  const pubPem = crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  
  const [headerB64, payloadB64, signatureB64] = t1.data.id_token.split('.');
  const isVerified = crypto.verify(
    'sha256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    pubPem,
    Buffer.from(signatureB64, 'base64url')
  );
  if (!isVerified) throw new Error("JWT Verification failed");
  console.log("JWT Signature successfully verified using public JWKS");

  const code2 = await getCode(challenge);
  const t2 = await getToken(code2, 'wrong_verifier_string_bla_bla_bla_bla');
  if (t2.status !== 400) throw new Error("Wrong verifier returned: " + t2.status);
  console.log("Wrong PKCE verifier correctly rejected.");

  const code3 = await getCode(challenge);
  const t3 = await getToken(code3, null);
  if (t3.status !== 400) throw new Error("Missing verifier returned: " + t3.status);
  console.log("Missing PKCE verifier correctly rejected.");
  
  console.log("\\nAll security assertions validated successfully!");
}

testFlow().catch(err => {
  console.error("Test Failed: ", err);
  process.exit(1);
});
