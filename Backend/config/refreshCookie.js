/**
 * Refresh-token cookie settings for split frontend/backend hosts.
 *
 * When the SPA is on app.example.com and the API on api.example.com, browsers treat
 * credentialed XHR/fetch as cross-site. Safari (ITP) and Chrome require
 * SameSite=None and Secure so the httpOnly refresh cookie is sent with axios
 * (withCredentials: true). SameSite=strict breaks login/session refresh on iOS.
 *
 * Set REFRESH_COOKIE_CROSS_SITE=false if frontend and API share the same site
 * (e.g. same origin / reverse-proxy) and you want Lax cookies only.
 */

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseEnvBool(value, defaultWhenUnset) {
  if (value == null || String(value).trim() === "") return defaultWhenUnset;
  const v = String(value).toLowerCase().trim();
  if (["false", "0", "no", "off"].includes(v)) return false;
  if (["true", "1", "yes", "on"].includes(v)) return true;
  return defaultWhenUnset;
}

/**
 * @returns {boolean}
 */
export function shouldUseCrossSiteRefreshCookie() {
  const prod = process.env.NODE_ENV === "production";
  if (!prod) return false;
  return parseEnvBool(process.env.REFRESH_COOKIE_CROSS_SITE, true);
}

/**
 * @param {number} [maxAgeMs]
 */
export function getRefreshTokenCookieOptions(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const prod = process.env.NODE_ENV === "production";
  const crossSite = shouldUseCrossSiteRefreshCookie();

  const domain = process.env.REFRESH_COOKIE_DOMAIN?.trim() || undefined;

  if (crossSite && prod) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "none", // Reverted to "none" to support cross-origin background fetch in mobile apps
      path: "/",
      maxAge: maxAgeMs,
      ...(domain ? { domain } : {}),
    };
  }

  return {
    httpOnly: true,
    secure: prod,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
    ...(domain ? { domain } : {}),
  };
}

/** Options must match set cookie (path, domain, sameSite, secure) or clear may fail. */
export function getClearRefreshTokenCookieOptions() {
  const opts = getRefreshTokenCookieOptions(0);
  return {
    path: opts.path,
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    ...(opts.domain ? { domain: opts.domain } : {}),
  };
}
