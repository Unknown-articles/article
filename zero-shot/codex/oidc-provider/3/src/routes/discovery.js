import { Router } from "express";
import { ISSUER } from "../config.js";

export function discoveryRouter() {
  const router = Router();

  router.get("/.well-known/openid-configuration", (req, res) => {
    res.type("application/json").json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/oauth2/authorize`,
      token_endpoint: `${ISSUER}/oauth2/token`,
      userinfo_endpoint: `${ISSUER}/userinfo`,
      jwks_uri: `${ISSUER}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "email", "profile"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      claims_supported: ["sub", "email", "name"]
    });
  });

  return router;
}
