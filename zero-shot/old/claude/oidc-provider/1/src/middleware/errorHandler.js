export function errorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'server_error',
    error_description: 'An unexpected error occurred',
  });
}
