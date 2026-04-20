'use strict';

/**
 * Thin HTTP client wrapper around axios.
 * Returns the full response (including status) without throwing on 4xx/5xx.
 *
 * Base URL is read from API_BASE env var (set by run.js) so tests can run
 * against any port without code changes.
 */

const axios = require('axios');

const BASE = process.env.API_BASE || 'http://localhost:3000';

const http = axios.create({
  baseURL: BASE,
  validateStatus: () => true,   // never throw on HTTP errors — let tests assert
  timeout: 8000,
});

/**
 * Return a pre-configured client that automatically injects the Bearer token.
 */
function authed(token) {
  return {
    get:    (url, cfg)       => http.get(url,    { ...cfg, headers: { Authorization: `Bearer ${token}`, ...(cfg?.headers) } }),
    post:   (url, data, cfg) => http.post(url,   data, { ...cfg, headers: { Authorization: `Bearer ${token}`, ...(cfg?.headers) } }),
    put:    (url, data, cfg) => http.put(url,    data, { ...cfg, headers: { Authorization: `Bearer ${token}`, ...(cfg?.headers) } }),
    patch:  (url, data, cfg) => http.patch(url,  data, { ...cfg, headers: { Authorization: `Bearer ${token}`, ...(cfg?.headers) } }),
    delete: (url, cfg)       => http.delete(url, { ...cfg, headers: { Authorization: `Bearer ${token}`, ...(cfg?.headers) } }),
  };
}

module.exports = { http, authed };
