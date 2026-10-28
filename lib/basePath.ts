/**
 * The path the app is served under: "/ct-manuf" on the shared Kubernetes host
 * (https://poros-staging.paradev.io/ct-manuf), "" at the root (Vercel, local dev). Baked in at
 * build time from NEXT_PUBLIC_BASE_PATH, like next.config's basePath, which reads the same variable.
 *
 * next/link, router.push/replace and redirect() add it themselves. Everything else that writes a
 * root-relative URL (fetch, <a href>, <img src>, signIn/signOut callbackUrl) goes through
 * withBase(), or it points at another dashboard on the same host.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}

/**
 * next-auth redirect callback: only back into this app. The default allows any URL on the same
 * origin, which on the shared host includes every other dashboard. URL parsing also resolves
 * "..", "\" and %2e tricks. Check: npx tsx scripts/check-base-path.ts
 */
export function safeRedirect(url: string, baseUrl: string): string {
  const origin = new URL(baseUrl).origin;
  const home = `${origin}${withBase("/dashboard")}`;
  let target: URL;
  try { target = new URL(url, origin); } catch { return home; }
  const inApp = !BASE_PATH || target.pathname === BASE_PATH || target.pathname.startsWith(`${BASE_PATH}/`);
  return target.origin === origin && inApp ? target.href : home;
}

/**
 * next-auth cookies. The shared host serves several dashboards; next-auth's default names are the
 * same in every app and sent to the whole host (path "/"), so another dashboard's sign-in would
 * overwrite ours and our session token would travel with every request to the others. Ours get
 * their own names and only go to this app's path. Here (not in lib/auth.ts) because middleware
 * needs the session cookie name and must not import the Azure AD provider.
 */
const SECURE = (process.env.NEXTAUTH_URL ?? "").startsWith("https:");

function cookie(key: string) {
  // __Host- needs path "/", so the CSRF cookie takes __Secure- like the rest.
  return {
    name: `${SECURE ? "__Secure-" : ""}ct-manuf.${key}`,
    options: { httpOnly: true, sameSite: "lax" as const, path: BASE_PATH || "/", secure: SECURE },
  };
}

export const AUTH_COOKIES = {
  sessionToken: cookie("session-token"),
  callbackUrl: cookie("callback-url"),
  csrfToken: cookie("csrf-token"),
  pkceCodeVerifier: cookie("pkce.code_verifier"),
  state: cookie("state"),
  nonce: cookie("nonce"),
};

/** For getToken({ req, secret, cookieName: SESSION_COOKIE }) — it would look for the default name. */
export const SESSION_COOKIE = AUTH_COOKIES.sessionToken.name;

/** Marks the next Microsoft sign-in as "connect this account as the Teams sender" (Settings). */
export const CONNECT_SENDER_COOKIE = cookie("connect-sender");
