// Resolves the public site origin used to build absolute links.
// For request-driven flows such as Stripe redirects, prefer the actual host
// serving the request so preview/custom domains work without stale env vars.
export function getConfiguredAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.NODE_ENV === "production" ? "https://www.alps3dp.ch" : "http://localhost:3000")
  );
}

export function getRequestBaseUrl(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) {
    return null;
  }

  const protocol =
    request.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

export function getAppBaseUrl(request?: Request) {
  if (request) {
    const requestBaseUrl = getRequestBaseUrl(request);
    if (requestBaseUrl) {
      return requestBaseUrl;
    }
  }

  return getConfiguredAppBaseUrl();
}
