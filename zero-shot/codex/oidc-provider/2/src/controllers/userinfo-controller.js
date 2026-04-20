export function getUserInfo(req, res) {
  const scopes = req.accessToken.scope.split(/\s+/);
  const payload = {
    sub: req.accessToken.sub,
  };

  if (scopes.includes('email')) {
    payload.email = req.accessToken.email;
  }

  if (scopes.includes('profile')) {
    payload.name = req.accessToken.name;
  }

  res.json(payload);
}

export function postUserInfoNotAllowed(_req, res) {
  res.status(405).json({
    error: 'method_not_allowed',
    error_description: 'POST /userinfo is not supported.',
  });
}
