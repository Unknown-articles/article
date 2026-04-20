export function notFoundHandler(request, response) {
  response.status(404).json({
    error: 'not_found',
    error_description: `No route found for ${request.method} ${request.originalUrl}`,
  });
}

export function errorHandler(error, request, response, next) {
  void request;
  void next;

  response.status(error.statusCode ?? 500).json({
    error: error.error ?? 'server_error',
    error_description: error.message ?? 'An unexpected error occurred',
  });
}
