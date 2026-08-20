// Server errors don't always return a JSON body (empty body, an HTML error
// page, or - on Vercel - an auth/redirect challenge page), so parsing the
// response defensively avoids a confusing "Unexpected end of JSON input"
// crash and lets callers show a real error message instead.
export async function parseJsonSafely(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
