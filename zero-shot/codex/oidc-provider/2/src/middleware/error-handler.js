export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode ?? 500;

  res.status(status).json({
    error: error.error ?? 'server_error',
    error_description:
      error.message ?? 'An unexpected error occurred while processing the request.',
  });
}
