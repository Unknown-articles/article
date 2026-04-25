export function getUserInfo(request, response) {
  response.json({
    sub: request.auth.subject,
    email: request.auth.email,
    email_verified: true,
    name: request.auth.name,
  });
}
