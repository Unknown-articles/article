export class HttpError extends Error {
  constructor(statusCode, error, message) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
  }
}

export function badRequest(error, message) {
  return new HttpError(400, error, message);
}

export function unauthorized(error, message) {
  return new HttpError(401, error, message);
}
