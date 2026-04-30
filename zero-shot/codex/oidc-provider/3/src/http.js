export function jsonError(res, status, error, description) {
  const body = description ? { error, error_description: description } : { error };
  return res.status(status).type("application/json").json(body);
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
