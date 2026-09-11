// HTTP helpers — keep every function's responses consistent.

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Parse a JSON request body, returning null on malformed input instead of throwing.
export async function readJson(req) {
  try { return await req.json(); }
  catch { return null; }
}
