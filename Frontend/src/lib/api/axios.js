import axios from "axios";
import { toast } from "sonner";
import { API_BASE_URL } from "./config.js";
import {
  getRoleFromToken,
  getModuleToken,
  clearModuleAuth,
} from "../utils/auth.js";
import { normalizeObjectRatings } from "../utils/rating.js";

// Network error tracking to prevent spam
const networkErrorState = {
  lastErrorTime: 0,
  lastToastTime: 0,
  errorCount: 0,
  toastShown: false,
  COOLDOWN_PERIOD: 30000, // 30 seconds cooldown for console errors
  TOAST_COOLDOWN_PERIOD: 60000, // 60 seconds cooldown for toast notifications
};

/** Single in-flight refresh so parallel 401s share one refresh + new token */
let refreshAccessTokenPromise = null;

function pickAccessTokenFromResponseBody(body) {
  if (!body || typeof body !== "object") return null;
  const nested = body.data;
  if (nested && typeof nested === "object" && nested.accessToken) {
    return nested.accessToken;
  }
  if (typeof body.accessToken === "string") return body.accessToken;
  return null;
}

function isRefreshTokenRequestUrl(url) {
  if (!url || typeof url !== "string") return false;
  return (
    url.includes("/auth/refresh-token") ||
    url.includes("/admin/auth/refresh-token") ||
    url.includes("/restaurant/auth/refresh-token") ||
    url.includes("/delivery/auth/refresh-token")
  );
}

// Validate API base URL on import
if (import.meta.env.DEV) {
  const backendUrl = API_BASE_URL.replace("/api", "");
  const frontendUrl = window.location.origin;

  if (API_BASE_URL.includes("5173") || backendUrl.includes("5173")) {
    console.error(
      "❌ CRITICAL: API_BASE_URL is pointing to FRONTEND port (5173) instead of BACKEND port (5000)",
    );
    console.error("💡 Current API_BASE_URL:", API_BASE_URL);
    console.error("💡 Frontend URL:", frontendUrl);
    console.error("💡 Backend should be at: http://localhost:5000");
    console.error(
      "💡 Fix: Check .env file - VITE_API_BASE_URL should be http://localhost:5000/api",
    );
  } else {
    console.log("✅ API_BASE_URL correctly points to backend:", API_BASE_URL);
    console.log("✅ Backend URL:", backendUrl);
    console.log("✅ Frontend URL:", frontendUrl);
  }
}

/**
 * Create axios instance with default configuration
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies for refresh token
});

/**
 * Auth module for the current pathname — must stay in sync with getTokenForCurrentRoute
 * so refresh uses the same cookie/endpoint as the access token we send on requests.
 * @returns {{ tokenKey: string, expectedRole: string, refreshEndpoint: string }}
 */
function getAuthContextForPath(pathname) {
  const path = pathname || "";

  if (path.startsWith("/admin")) {
    return {
      tokenKey: "admin_accessToken",
      expectedRole: "admin",
      refreshEndpoint: "/admin/auth/refresh-token",
    };
  }

  if (
    path.startsWith("/restaurant") &&
    !path.startsWith("/restaurants") &&
    !path.startsWith("/restaurant/list") &&
    !path.startsWith("/restaurant/under-250")
  ) {
    return {
      tokenKey: "restaurant_accessToken",
      expectedRole: "restaurant",
      refreshEndpoint: "/restaurant/auth/refresh-token",
    };
  }

  if (path.startsWith("/delivery")) {
    return {
      tokenKey: "delivery_accessToken",
      expectedRole: "delivery",
      refreshEndpoint: "/delivery/auth/refresh-token",
    };
  }

  if (
    path.startsWith("/user") ||
    path.startsWith("/usermain") ||
    path === "/" ||
    (!path.startsWith("/admin") &&
      !(path.startsWith("/restaurant") && !path.startsWith("/restaurants")) &&
      !path.startsWith("/delivery"))
  ) {
    return {
      tokenKey: "user_accessToken",
      expectedRole: "user",
      refreshEndpoint: "/auth/refresh-token",
    };
  }

  return {
    tokenKey: "user_accessToken",
    expectedRole: "user",
    refreshEndpoint: "/auth/refresh-token",
  };
}

function isProtectedUserPath(pathname) {
  const path = pathname || "";

  return (
    path.startsWith("/cart") ||
    path.startsWith("/orders") ||
    path.startsWith("/profile") ||
    path.startsWith("/notifications") ||
    path.startsWith("/wallet") ||
    path.startsWith("/bookings") ||
    path.startsWith("/complaints/submit") ||
    path.startsWith("/gift-card/checkout") ||
    path.startsWith("/collections/") ||
    path.startsWith("/dining/book-confirmation") ||
    path.startsWith("/dining/book-success") ||
    path.startsWith("/user/cart") ||
    path.startsWith("/user/orders") ||
    path.startsWith("/user/profile") ||
    path.startsWith("/user/notifications") ||
    path.startsWith("/user/wallet") ||
    path.startsWith("/user/bookings") ||
    path.startsWith("/user/complaints/submit") ||
    path.startsWith("/user/gift-card/checkout") ||
    path.startsWith("/user/collections/") ||
    path.startsWith("/user/dining/book-confirmation") ||
    path.startsWith("/user/dining/book-success")
  );
}

/**
 * Get the appropriate module token based on the current route
 * @returns {string|null} - Access token for the current module or null
 */
function getTokenForCurrentRoute() {
  const path = window.location.pathname;
  const ctx = getAuthContextForPath(path);

  if (ctx.tokenKey === "admin_accessToken") {
    return localStorage.getItem("admin_accessToken");
  }
  if (ctx.tokenKey === "restaurant_accessToken") {
    return localStorage.getItem("restaurant_accessToken");
  }
  if (ctx.tokenKey === "delivery_accessToken") {
    return localStorage.getItem("delivery_accessToken");
  }
  if (ctx.tokenKey === "user_accessToken") {
    const moduleToken = getModuleToken("user")
    if (moduleToken) return moduleToken

    // Legacy fallback: only use legacy `accessToken` if it is truly a `user` token.
    // This prevents role/token mismatches like attaching an admin/restaurant token to `/user/*` APIs.
    const legacyToken = localStorage.getItem("accessToken")
    if (legacyToken) {
      const legacyRole = getRoleFromToken(legacyToken)
      if (legacyRole === "user") return legacyToken
    }

    return null
  }

  return localStorage.getItem("accessToken");
}

/**
 * Request Interceptor
 * Adds authentication token to requests based on current route
 */
apiClient.interceptors.request.use(
  (config) => {
    // Get access token for the current module based on route
    let accessToken = getTokenForCurrentRoute();

    // Fallback to legacy token if module-specific token not found
    if (!accessToken || accessToken.trim() === "") {
      accessToken = localStorage.getItem("accessToken");
    }

    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {};
    }

    // Debug logging for FormData requests
    if (import.meta.env.DEV && config.data instanceof FormData) {
      console.log("[API Interceptor] FormData request detected:", {
        url: config.url,
        method: config.method,
        hasAuthHeader: !!config.headers.Authorization,
        authHeaderPrefix: config.headers.Authorization?.substring(0, 30),
        hasAccessToken: !!accessToken,
      });
    }

    // Determine if this is an authenticated route
    const path = window.location.pathname;
    const requestUrl = config.url || "";

    // Check if this is a public restaurant route (should not require authentication)
    const isPublicRestaurantRoute =
      requestUrl.includes("/restaurant/list") ||
      requestUrl.includes("/restaurant/under-250") ||
      (requestUrl.includes("/restaurant/") &&
        !requestUrl.includes("/restaurant/orders") &&
        !requestUrl.includes("/restaurant/auth") &&
        !requestUrl.includes("/restaurant/menu") &&
        !requestUrl.includes("/restaurant/profile") &&
        !requestUrl.includes("/restaurant/staff") &&
        !requestUrl.includes("/restaurant/offers") &&
        !requestUrl.includes("/restaurant/inventory") &&
        !requestUrl.includes("/restaurant/categories") &&
        !requestUrl.includes("/dining/") &&
        !requestUrl.includes("/restaurant/onboarding") &&
        !requestUrl.includes("/restaurant/delivery-status") &&
        !requestUrl.includes("/restaurant/finance") &&
        !requestUrl.includes("/restaurant/wallet") &&
        !requestUrl.includes("/restaurant/analytics") &&
        !requestUrl.includes("/restaurant/complaints") &&
        !requestUrl.includes("/restaurant/dining-config") &&
        !requestUrl.includes("/restaurant/dining-offers") &&
        !requestUrl.includes("/restaurant/dining-menu") &&
        (requestUrl.match(/\/restaurant\/[^/]+$/) ||
          requestUrl.match(/\/restaurant\/[^/]+\/menu/) ||
          requestUrl.match(/\/restaurant\/[^/]+\/addons/) ||
          requestUrl.match(/\/restaurant\/[^/]+\/inventory/) ||
          requestUrl.match(/\/restaurant\/[^/]+\/offers/)));

    const isAuthenticatedRoute =
      ((path.startsWith("/admin") && !path.startsWith("/admin/login")) ||
        (path.startsWith("/restaurant") &&
          !path.startsWith("/restaurants") &&
          !isPublicRestaurantRoute) ||
        path.startsWith("/delivery") ||
        path.startsWith("/user") ||
        path.startsWith("/usermain") ||
        path.startsWith("/orders")) &&
      !isPublicRestaurantRoute;

    // For authenticated routes, ALWAYS ensure Authorization header is set if we have a token
    // This ensures FormData requests and other requests always have the token
    if (isAuthenticatedRoute) {
      // If no Authorization header or invalid format, set it
      if (
        !config.headers.Authorization ||
        (typeof config.headers.Authorization === "string" &&
          !config.headers.Authorization.startsWith("Bearer "))
      ) {
        if (
          accessToken &&
          accessToken.trim() !== "" &&
          accessToken !== "null" &&
          accessToken !== "undefined"
        ) {
          config.headers.Authorization = `Bearer ${accessToken.trim()}`;
          if (import.meta.env.DEV && config.data instanceof FormData) {
            console.log(
              "[API Interceptor] Added Authorization header for authenticated FormData request",
            );
          }
        } else {
          // Log warning in development if token is missing for authenticated routes
          if (import.meta.env.DEV) {
            console.warn(
              `[API Interceptor] No access token found for authenticated route: ${path}. Request may fail with 401.`,
            );
            console.warn(`[API Interceptor] Available tokens:`, {
              admin: localStorage.getItem("admin_accessToken")
                ? "exists"
                : "missing",
              restaurant: localStorage.getItem("restaurant_accessToken")
                ? "exists"
                : "missing",
              delivery: localStorage.getItem("delivery_accessToken")
                ? "exists"
                : "missing",
              user: localStorage.getItem("user_accessToken")
                ? "exists"
                : "missing",
              legacy: localStorage.getItem("accessToken")
                ? "exists"
                : "missing",
            });
          }
        }
      } else {
        // Authorization header already set (from getAuthConfig), log in dev mode for FormData
        if (import.meta.env.DEV && config.data instanceof FormData) {
          console.log(
            "[API Interceptor] Authorization header already set, preserving it for FormData request",
          );
        }
      }
    } else {
      // For non-authenticated routes (including public restaurant routes), don't add token
      // Public routes like /restaurant/list should work without authentication
      if (isPublicRestaurantRoute) {
        // Remove any existing Authorization header for public routes
        delete config.headers.Authorization;
      } else if (
        !config.headers.Authorization &&
        accessToken &&
        accessToken.trim() !== "" &&
        accessToken !== "null" &&
        accessToken !== "undefined"
      ) {
        // For other non-authenticated routes, add token if available (for optional auth)
        config.headers.Authorization = `Bearer ${accessToken.trim()}`;
      }
    }

    // If data is FormData, remove Content-Type header to let axios set it with boundary
    // BUT: Make sure Authorization header is preserved
    if (config.data instanceof FormData) {
      // Preserve Authorization header before removing Content-Type
      const authHeader = config.headers.Authorization;
      // Remove Content-Type to let axios set it with proper boundary
      delete config.headers["Content-Type"];
      // Always restore Authorization header if it was set (critical for authentication)
      if (authHeader) {
        config.headers.Authorization = authHeader;
        if (import.meta.env.DEV) {
          console.log(
            "[API Interceptor] Preserved Authorization header for FormData request",
          );
        }
      } else if (
        accessToken &&
        accessToken.trim() !== "" &&
        accessToken !== "null" &&
        accessToken !== "undefined"
      ) {
        // If no auth header but we have a token, add it
        config.headers.Authorization = `Bearer ${accessToken.trim()}`;
        if (import.meta.env.DEV) {
          console.log(
            "[API Interceptor] Added Authorization header for FormData request",
          );
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Response Interceptor
 * Handles token refresh and error responses
 */
apiClient.interceptors.response.use(
  (response) => {
    // Reset network error state on successful response (backend is back online)
    if (networkErrorState.errorCount > 0) {
      networkErrorState.errorCount = 0;
      networkErrorState.lastErrorTime = 0;
      networkErrorState.toastShown = false;
      if (import.meta.env.DEV) {
        console.log("✅ Backend connection restored");
      }
    }

    // Normalize any rating fields returned by the backend
    if (response?.data) {
      normalizeObjectRatings(response.data);
    }

    // If response contains new access token, store it for the current module
    const tokenFromBody = pickAccessTokenFromResponseBody(response.data);
    if (tokenFromBody) {
      const { tokenKey, expectedRole } = getAuthContextForPath(
        window.location.pathname,
      );
      const token = tokenFromBody;
      const role = getRoleFromToken(token);

      // Only store the token if the role matches the current module
      if (!role || role !== expectedRole) {
        clearModuleAuth(tokenKey.replace("_accessToken", ""));
      } else if (tokenKey === "user_accessToken") {
        const currentUserToken = getModuleToken("user");
        if (
          currentUserToken &&
          sessionStorage.getItem("user_accessToken") === currentUserToken
        ) {
          sessionStorage.setItem("user_accessToken", token);
        } else {
          localStorage.setItem(tokenKey, token);
        }
      } else {
        localStorage.setItem(tokenKey, token);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      const reqUrl = originalRequest.url || "";
      if (isRefreshTokenRequestUrl(reqUrl)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const { tokenKey, expectedRole, refreshEndpoint } = getAuthContextForPath(
        window.location.pathname,
      );

      try {
        if (!refreshAccessTokenPromise) {
          refreshAccessTokenPromise = (async () => {
            const response = await axios.post(
              `${API_BASE_URL}${refreshEndpoint}`,
              {},
              { withCredentials: true },
            );
            const accessToken = pickAccessTokenFromResponseBody(response.data);
            if (!accessToken) {
              throw new Error("No access token in refresh response");
            }
            const role = getRoleFromToken(accessToken);
            if (!role || role !== expectedRole) {
              clearModuleAuth(tokenKey.replace("_accessToken", ""));
              throw new Error("Role mismatch on refreshed token");
            }
            if (tokenKey === "user_accessToken") {
              const currentUserToken = getModuleToken("user");
              if (
                currentUserToken &&
                sessionStorage.getItem("user_accessToken") === currentUserToken
              ) {
                sessionStorage.setItem("user_accessToken", accessToken);
              } else {
                localStorage.setItem(tokenKey, accessToken);
              }
            } else {
              localStorage.setItem(tokenKey, accessToken);
            }
            return accessToken;
          })().finally(() => {
            refreshAccessTokenPromise = null;
          });
        }

        const accessToken = await refreshAccessTokenPromise;
        if (!originalRequest.headers) {
          originalRequest.headers = {};
        }
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Show error toast in development mode for refresh errors
        if (import.meta.env.DEV) {
          const refreshErrorMessage =
            refreshError.response?.data?.message ||
            refreshError.response?.data?.error ||
            refreshError.message ||
            "Token refresh failed";

          toast.error(refreshErrorMessage, {
            duration: 3000,
            style: {
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              color: "#ffffff",
              border: "1px solid #b91c1c",
              borderRadius: "12px",
              padding: "16px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow:
                "0 10px 25px -5px rgba(239, 68, 68, 0.3), 0 8px 10px -6px rgba(239, 68, 68, 0.2)",
            },
            className: "error-toast",
          });
        }

        // Refresh failed, clear module-specific token and redirect to login
        // BUT: Don't auto-redirect on certain pages - let them handle errors gracefully
        const currentPath = window.location.pathname;
        const isOnboardingPage = currentPath.includes("/onboarding");
        const isLandingPageManagement =
          currentPath.includes("/hero-banner-management") ||
          currentPath.includes("/landing-page");

        // For landing page management, don't auto-logout on 401 - let component handle it
        // Only auto-logout for other pages after token refresh fails
        if (!isOnboardingPage && !isLandingPageManagement) {
          const { tokenKey: failedModuleKey } =
            getAuthContextForPath(currentPath);
          if (failedModuleKey === "admin_accessToken") {
            localStorage.removeItem("admin_accessToken");
            localStorage.removeItem("admin_authenticated");
            localStorage.removeItem("admin_user");
            window.location.href = "/admin/login";
          } else if (failedModuleKey === "restaurant_accessToken") {
            localStorage.removeItem("restaurant_accessToken");
            localStorage.removeItem("restaurant_authenticated");
            localStorage.removeItem("restaurant_user");
            window.location.href = "/restaurant/login";
          } else if (failedModuleKey === "delivery_accessToken") {
            localStorage.removeItem("delivery_accessToken");
            localStorage.removeItem("delivery_authenticated");
            localStorage.removeItem("delivery_user");
            window.location.href = "/delivery/sign-in";
          } else {
            clearModuleAuth("user");
            localStorage.removeItem("accessToken");
            // Public user pages and auth callbacks should not bounce to sign-in
            // if a background profile/refresh request fails during login completion.
            if (isProtectedUserPath(currentPath)) {
              window.location.href = "/user/auth/sign-in";
            }
          }
        }

        // For onboarding page, reject the promise so component can handle it
        return Promise.reject(refreshError);
      }
    }

    // Handle network errors specifically (backend not running)
    if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
      if (import.meta.env.DEV) {
        const now = Date.now();
        const timeSinceLastError = now - networkErrorState.lastErrorTime;
        const timeSinceLastToast = now - networkErrorState.lastToastTime;

        // Only log console errors if cooldown period has passed
        if (timeSinceLastError >= networkErrorState.COOLDOWN_PERIOD) {
          networkErrorState.errorCount++;
          networkErrorState.lastErrorTime = now;

          // Log error details (only once per cooldown period)
          if (networkErrorState.errorCount === 1) {
            // Network error logging removed - errors handled via toast notifications
          } else {
            // For subsequent errors, show a brief message
            console.warn(
              `⚠️ Network Error (${networkErrorState.errorCount}x) - Backend still not connected`,
            );
          }
        }

        // Only show toast if cooldown period has passed
        if (timeSinceLastToast >= networkErrorState.TOAST_COOLDOWN_PERIOD) {
          networkErrorState.lastToastTime = now;
          networkErrorState.toastShown = true;

          // Show helpful, user-facing error message (only once per minute)
          toast.error(
            "Server connection failed. Please check your internet",
            {
              duration: 10000,
              id: "network-error-toast", // Use ID to prevent duplicate toasts
              style: {
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                color: "#ffffff",
                border: "1px solid #b45309",
                borderRadius: "12px",
                padding: "16px",
                fontSize: "14px",
                fontWeight: "500",
                boxShadow:
                  "0 10px 25px -5px rgba(245, 158, 11, 0.3), 0 8px 10px -6px rgba(245, 158, 11, 0.2)",
              },
              className: "network-error-toast",
            },
          );
        }
      }
      return Promise.reject(error);
    }

    // Handle timeout errors (ECONNABORTED)
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      // Timeout errors are usually due to slow backend or network issues
      // Don't spam console with timeout errors, but handle them gracefully
      if (import.meta.env.DEV) {
        const now = Date.now();
        const timeSinceLastError = now - networkErrorState.lastErrorTime;
        const timeSinceLastToast = now - networkErrorState.lastToastTime;

        // Only log console errors if cooldown period has passed
        if (timeSinceLastError >= networkErrorState.COOLDOWN_PERIOD) {
          networkErrorState.errorCount++;
          networkErrorState.lastErrorTime = now;
        }

        // Only show toast if cooldown period has passed
        if (timeSinceLastToast >= networkErrorState.TOAST_COOLDOWN_PERIOD) {
          networkErrorState.lastToastTime = now;

          // Show helpful error message (only once per minute)
          toast.error(
            `Request timeout - Backend may be slow or not responding. Check server status.`,
            {
              duration: 8000,
              id: "timeout-error-toast", // Use ID to prevent duplicate toasts
              style: {
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                color: "#ffffff",
                border: "1px solid #b45309",
                borderRadius: "12px",
                padding: "16px",
                fontSize: "14px",
                fontWeight: "500",
                boxShadow:
                  "0 10px 25px -5px rgba(245, 158, 11, 0.3), 0 8px 10px -6px rgba(245, 158, 11, 0.2)",
              },
              className: "timeout-error-toast",
            },
          );
        }
      }
      return Promise.reject(error);
    }

    // Handle 404 errors (route not found)
    if (error.response?.status === 404) {
      if (import.meta.env.DEV) {
        const url = error.config?.url || "unknown";
        // 404 error logging removed - errors handled via toast notifications

        // Show toast for auth routes (important)
        if (
          url.includes("/auth/") ||
          url.includes("/send-otp") ||
          url.includes("/verify-otp")
        ) {
          toast.error(
            "Auth API endpoint not found. Make sure backend is running on port 5000.",
            {
              duration: 8000,
              style: {
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#ffffff",
                border: "1px solid #b91c1c",
                borderRadius: "12px",
                padding: "16px",
                fontSize: "14px",
                fontWeight: "500",
              },
            },
          );
        }
        // Show toast for restaurant routes (but not for getRestaurantById which can legitimately return 404)
        else if (url.includes("/restaurant/")) {
          // Only show error for critical restaurant endpoints like /restaurant/list
          // Individual restaurant lookups (like /restaurant/:id) can legitimately return 404 if restaurant doesn't exist
          // So we silently handle those 404s
          const isIndividualRestaurantLookup =
            /\/restaurant\/[a-f0-9]{24}$/i.test(url) ||
            (url.match(/\/restaurant\/[^/]+$/) &&
              !url.includes("/restaurant/list"));

          if (
            !isIndividualRestaurantLookup &&
            url.includes("/restaurant/list")
          ) {
            toast.error(
              "Restaurant API endpoint not found. Check backend routes.",
              {
                duration: 5000,
                style: {
                  background:
                    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  color: "#ffffff",
                  border: "1px solid #b91c1c",
                  borderRadius: "12px",
                  padding: "16px",
                  fontSize: "14px",
                  fontWeight: "500",
                },
              },
            );
          }
          // Silently handle 404 for individual restaurant lookups (getRestaurantById)
          // These are expected to fail if restaurant doesn't exist in DB
        }
      }
      return Promise.reject(error);
    }

    // Show error toast in development mode only
    if (import.meta.env.DEV) {
      // Extract error messages from various possible locations
      const errorData = error.response?.data;

      // Handle array of error messages (common in validation errors)
      let errorMessages = [];

      if (Array.isArray(errorData?.message)) {
        errorMessages = errorData.message;
      } else if (Array.isArray(errorData?.errors)) {
        errorMessages = errorData.errors.map((err) => err.message || err);
      } else if (errorData?.message) {
        errorMessages = [errorData.message];
      } else if (errorData?.error) {
        errorMessages = [errorData.error];
      } else if (errorData?.data?.message) {
        errorMessages = Array.isArray(errorData.data.message)
          ? errorData.data.message
          : [errorData.data.message];
      } else if (error.message) {
        errorMessages = [error.message];
      } else {
        errorMessages = ["An error occurred"];
      }

      // Show beautiful error toast for each error message
      errorMessages.forEach((errorMessage, index) => {
        // Add slight delay for multiple toasts to appear sequentially
        setTimeout(() => {
          toast.error(errorMessage, {
            duration: 5000,
            style: {
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              color: "#ffffff",
              border: "1px solid #b91c1c",
              borderRadius: "12px",
              padding: "16px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow:
                "0 10px 25px -5px rgba(239, 68, 68, 0.3), 0 8px 10px -6px rgba(239, 68, 68, 0.2)",
            },
            className: "error-toast",
          });
        }, index * 100); // Stagger multiple toasts by 100ms
      });
    }

    // Handle other errors
    return Promise.reject(error);
  },
);

export default apiClient;
