export function jsonOnly(_req, res, next) {
  res.type('application/json');
  next();
}
