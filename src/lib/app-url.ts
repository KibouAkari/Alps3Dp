export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.NODE_ENV === "production" ? "https://alps3dp.ch" : "http://localhost:3000")
  );
}
