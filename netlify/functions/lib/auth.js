// Auth service — validates the admin bearer token against ADMIN_PASSWORD.
//
// Used by every admin-only function (pool, suggestions, approve, manage).
// Public functions (state, suggest) do not call this.

export function checkAuth(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // no password configured → deny by default
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  return token.length > 0 && token === expected;
}
