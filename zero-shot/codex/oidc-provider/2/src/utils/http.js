export function buildUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl).toString();
}
