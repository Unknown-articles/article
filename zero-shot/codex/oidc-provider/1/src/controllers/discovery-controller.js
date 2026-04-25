import { config } from '../config/index.js';
import { buildUrl } from '../utils/http.js';

export function getDiscoveryDocument(req, res) {
  res.json({
    issuer: config.issuer,
    authorization_endpoint: buildUrl(config.issuer, '/oauth2/authorize'),
    token_endpoint: buildUrl(config.issuer, '/oauth2/token'),
    userinfo_endpoint: buildUrl(config.issuer, '/userinfo'),
    jwks_uri: buildUrl(config.issuer, '/.well-known/jwks.json'),
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  });
}
