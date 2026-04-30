import crypto from "node:crypto";
import { exportJWK, generateKeyPair, importJWK } from "jose";
import { database } from "./db.js";

function now() {
  return Math.floor(Date.now() / 1000);
}

function newKid() {
  return crypto.randomBytes(16).toString("base64url");
}

async function createSigningKey(active = true) {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const kid = newKid();
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);

  privateJwk.kid = kid;
  privateJwk.use = "sig";
  privateJwk.alg = "RS256";
  publicJwk.kid = kid;
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";

  await database.run(
    `INSERT INTO signing_keys (kid, private_jwk, public_jwk, active, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [kid, JSON.stringify(privateJwk), JSON.stringify(publicJwk), active ? 1 : 0, now()]
  );

  return { kid, privateJwk, publicJwk };
}

export async function ensureSigningKey() {
  const key = await database.get("SELECT kid FROM signing_keys WHERE active = 1 ORDER BY created_at DESC LIMIT 1");
  if (!key) {
    await createSigningKey(true);
  }
}

export async function rotateSigningKey() {
  const timestamp = now();
  await database.run("UPDATE signing_keys SET active = 0, retired_at = ? WHERE active = 1", [timestamp]);
  return createSigningKey(true);
}

export async function getPublicJwks() {
  const rows = await database.all(
    `SELECT public_jwk FROM signing_keys
     WHERE active = 1 OR retired_at IS NULL
     ORDER BY created_at DESC`
  );

  return {
    keys: rows.map((row) => {
      const jwk = JSON.parse(row.public_jwk);
      return {
        kty: jwk.kty,
        use: "sig",
        alg: "RS256",
        kid: jwk.kid,
        n: jwk.n,
        e: jwk.e
      };
    })
  };
}

export async function getActiveSigningKey() {
  const row = await database.get(
    "SELECT kid, private_jwk FROM signing_keys WHERE active = 1 ORDER BY created_at DESC LIMIT 1"
  );
  if (!row) {
    await ensureSigningKey();
    return getActiveSigningKey();
  }

  const privateJwk = JSON.parse(row.private_jwk);
  const privateKey = await importJWK(privateJwk, "RS256");
  return { kid: row.kid, privateKey };
}
