const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const { HttpError } = require("../errors");

function authenticateOptional(request, _response, next) {
  const header = request.headers.authorization;

  if (!header) {
    request.user = null;
    next();
    return;
  }

  const [, token] = header.split(" ");

  if (!token) {
    next(new HttpError(401, "Invalid authorization header"));
    return;
  }

  try {
    request.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    next(new HttpError(401, "Invalid or expired token"));
  }
}

function requireAuth(request, _response, next) {
  if (!request.user) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  next();
}

function resolveCurrentUser(authService) {
  return async (request, _response, next) => {
    if (!request.user) {
      next();
      return;
    }

    try {
      const currentUser = await authService.getUserById(request.user.sub);
      request.user = currentUser;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  authenticateOptional,
  requireAuth,
  resolveCurrentUser,
};
