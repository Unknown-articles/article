import { buildOidcMetadata } from '../services/metadata-service.js';

export function getDiscoveryMetadata(request, response) {
  response.json(buildOidcMetadata(request.app.locals.config.issuer));
}
