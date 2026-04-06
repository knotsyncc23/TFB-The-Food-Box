/**
 * JWT Token Utilities
 * Decode and extract information from JWT tokens
 */

/**
 * Decode JWT token without verification (client-side only)
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
export function decodeToken(token) {
  if (!token) return null;

  try {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Decode base64url encoded payload
    const payload = parts[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );

    return decoded;
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
}

/**
 * Get user role from token
 * @param {string} token - JWT token
 * @returns {string|null} - User role or null if not found
 */
export function getRoleFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.role || null;
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} - True if expired or invalid
 */
export function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded) return true;
  if (!decoded.exp) return false;

  // exp is in seconds, Date.now() is in milliseconds
  return decoded.exp * 1000 < Date.now();
}

/**
 * Get user ID from token
 * @param {string} token - JWT token
 * @returns {string|null} - User ID or null if not found
 */
export function getUserIdFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.userId || decoded?.id || null;
}

/**
 * Check if user has access to a module based on role
 * @param {string} role - User role
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {boolean} - True if user has access
 */
export function hasModuleAccess(role, module) {
  const roleModuleMap = {
    admin: "admin",
    restaurant: "restaurant",
    delivery: "delivery",
    user: "user",
  };

  return roleModuleMap[role] === module;
}

/**
 * Get module-specific access token (checks localStorage then sessionStorage for user when Remember me was off)
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Access token or null
 */
export function getModuleToken(module) {
  const token = localStorage.getItem(`${module}_accessToken`);
  if (token) return token;
  if (module === "user" && typeof sessionStorage !== "undefined") {
    return sessionStorage.getItem("user_accessToken");
  }
  return null;
}

/**
 * Get current user's role from a specific module's token
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Current user role or null
 */
export function getCurrentUserRole(module = null) {
  // If module is specified, check that module's token
  if (module) {
    const token = getModuleToken(module);
    if (!token) return null;
    return getRoleFromToken(token);
  }

  // Legacy: check all modules and return the first valid role found
  // This is for backward compatibility but should be avoided
  const modules = ["user", "restaurant", "delivery", "admin"];
  for (const mod of modules) {
    const token = getModuleToken(mod);
    if (token) {
      return getRoleFromToken(token);
    }
  }

  return null;
}

/**
 * Check if user is authenticated for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {boolean} - True if authenticated
 */
export function isModuleAuthenticated(module) {
  const token = getModuleToken(module);
  // If we have any token, treat as authenticated and let
  // axios + refresh-token flow decide when to log out.
  return !!token;
}

/**
 * Clear authentication data for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 */
export function clearModuleAuth(module) {
  localStorage.removeItem(`${module}_accessToken`);
  localStorage.removeItem(`${module}_authenticated`);
  localStorage.removeItem(`${module}_user`);
  sessionStorage.removeItem(`${module}AuthData`);
  if (module === "user") {
    sessionStorage.removeItem("user_accessToken");
    sessionStorage.removeItem("user_authenticated");
    sessionStorage.removeItem("user_user");
  }
}

/**
 * Clear all authentication data for all modules
 */
export function clearAuthData() {
  const modules = ["admin", "restaurant", "delivery", "user"];
  modules.forEach((module) => {
    clearModuleAuth(module);
  });
  // Also clear legacy token if it exists
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
}

/**
 * Set authentication data for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @param {string} token - Access token
 * @param {Object} user - User data
 * @param {Object} [options] - { rememberMe: boolean } for user module; when false, use sessionStorage (session only)
 * @throws {Error} If storage is not available or quota exceeded
 */
export function setAuthData(module, token, user, options = {}) {
  try {
    if (typeof Storage === "undefined" || !localStorage) {
      throw new Error("localStorage is not available");
    }
    if (!module || !token) {
      throw new Error(`Invalid parameters: module=${module}, token=${!!token}`);
    }

    const rememberMe = options.rememberMe !== false;
    const useSession = module === "user" && !rememberMe;
    const storage = useSession && typeof sessionStorage !== "undefined" ? sessionStorage : localStorage;

    const tokenKey = `${module}_accessToken`;
    const authKey = `${module}_authenticated`;
    const userKey = `${module}_user`;

    if (useSession) {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(authKey);
      localStorage.removeItem(userKey);
    }

    storage.setItem(tokenKey, token);
    storage.setItem(authKey, "true");
    if (user) {
      try {
        storage.setItem(userKey, JSON.stringify(user));
      } catch (userError) {
        console.warn("Failed to store user data, but token was stored:", userError);
      }
    }

    const storedToken = storage.getItem(tokenKey);
    if (storedToken !== token) {
      throw new Error(`Token storage verification failed for module: ${module}`);
    }
    console.log(`[setAuthData] Successfully stored auth for ${module} (${useSession ? "session" : "persistent"})`);
  } catch (error) {
    // If quota exceeded, try to clear some space
    if (error.name === "QuotaExceededError" || error.code === 22) {
      console.warn(
        "localStorage quota exceeded. Attempting to clear old data...",
      );
      // Clear legacy tokens
      try {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        // Retry storing
        localStorage.setItem(`${module}_accessToken`, token);
        localStorage.setItem(`${module}_authenticated`, "true");
        if (user) {
          localStorage.setItem(`${module}_user`, JSON.stringify(user));
        }

        // Verify again after retry
        const storedToken = localStorage.getItem(`${module}_accessToken`);
        if (storedToken !== token) {
          throw new Error("Token storage failed even after clearing space");
        }
      } catch (retryError) {
        console.error(
          "Failed to store auth data after clearing space:",
          retryError,
        );
        throw new Error(
          "Unable to store authentication data. Please clear browser storage and try again.",
        );
      }
    } else {
      console.error("[setAuthData] Error storing auth data:", error);
      throw error;
    }
  }
}
