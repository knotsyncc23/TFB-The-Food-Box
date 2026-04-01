import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase configuration - strict DB-only source (no frontend .env fallback).
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: "",
  vapidKey: "",
  databaseURL: "", // Realtime DB for live tracking
};

const FIREBASE_PUBLIC_ENV_CACHE_KEY = "firebase_public_env_cache_v1";

function safeLocalStorageGet(key) {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota / private mode failures; we can still operate without cache.
  }
}

function hydrateFirebaseConfigFromEnvPayload(envPayload) {
  const config = envPayload || {};
  // Backend/DB is the source of truth, but ignore obviously-invalid values
  const safeStr = (v) => (typeof v === "string" ? v.trim() : "");
  const looksLikeWebApiKey = (v) => /^AIza[0-9A-Za-z\-_]{10,}$/.test(v);
  const looksLikeSenderId = (v) => /^[0-9]{6,}$/.test(v);
  const looksLikeProjectId = (v) => /^[a-z0-9-]{3,}$/.test(v);

  const apiKey = safeStr(config.FIREBASE_API_KEY);
  const authDomain = safeStr(config.FIREBASE_AUTH_DOMAIN);
  const projectId = safeStr(config.FIREBASE_PROJECT_ID);
  const storageBucket = safeStr(config.FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = safeStr(config.FIREBASE_MESSAGING_SENDER_ID);
  const appId = safeStr(config.FIREBASE_APP_ID);
  const vapidKey = safeStr(config.FIREBASE_VAPID_KEY);
  const measurementId = safeStr(config.MEASUREMENT_ID);
  const databaseURL = safeStr(config.FIREBASE_DATABASE_URL);

  if (apiKey) {
    firebaseConfig.apiKey = apiKey;
    if (!looksLikeWebApiKey(apiKey)) {
      console.warn("⚠️ FIREBASE_API_KEY format looks unusual:", apiKey);
    }
  }
  if (authDomain) firebaseConfig.authDomain = authDomain;
  if (projectId) {
    firebaseConfig.projectId = projectId;
    if (!looksLikeProjectId(projectId)) {
      console.warn("⚠️ FIREBASE_PROJECT_ID format looks unusual:", projectId);
    }
  }
  if (storageBucket) firebaseConfig.storageBucket = storageBucket;
  if (messagingSenderId) {
    firebaseConfig.messagingSenderId = messagingSenderId;
    if (!looksLikeSenderId(messagingSenderId)) {
      console.warn(
        "⚠️ FIREBASE_MESSAGING_SENDER_ID format looks unusual:",
        messagingSenderId,
      );
    }
  }
  if (appId) firebaseConfig.appId = appId;
  if (vapidKey) firebaseConfig.vapidKey = vapidKey;
  if (measurementId) firebaseConfig.measurementId = measurementId;
  if (databaseURL) firebaseConfig.databaseURL = databaseURL;

  // Return whether we got enough to proceed.
  return true;
}

function loadCachedFirebasePublicEnv() {
  const raw = safeLocalStorageGet(FIREBASE_PUBLIC_ENV_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedFirebasePublicEnv(envPayload) {
  if (!envPayload || typeof envPayload !== "object") return;
  safeLocalStorageSet(
    FIREBASE_PUBLIC_ENV_CACHE_KEY,
    JSON.stringify({
      ...envPayload,
      _cachedAt: Date.now(),
    }),
  );
}

// Fetch config from backend and inject DB env values
const fetchFirebaseConfig = async () => {
  try {
    const { adminAPI } = await import("./api/index.js");
    const response = await adminAPI.getPublicEnvVariables();

    if (response.data.success && response.data.data) {
      const config = response.data.data;
      hydrateFirebaseConfigFromEnvPayload(config);
      saveCachedFirebasePublicEnv(config);

      console.log("✅ Firebase config loaded from backend env");
      return true;
    }
    return false;
  } catch (e) {
    console.warn(
      "⚠️ Failed to fetch firebase config from backend, using defaults/env",
      e,
    );
    return false;
  }
};

// Initialize Firebase app only once
let app;
let firebaseAuth;
let googleProvider;

// Function to ensure Firebase is initialized
async function ensureFirebaseInitialized() {
  const existingApps = getApps();
  // If Firebase was already initialized (e.g. before an iOS WebView redirect reload),
  // don't block auth flows just because config fetch is temporarily unavailable.
  if (existingApps.length > 0) {
    app = existingApps[0];
    if (!firebaseAuth) {
      firebaseAuth = getAuth(app);
    }
    if (!googleProvider) {
      googleProvider = new GoogleAuthProvider();
      googleProvider.addScope("email");
      googleProvider.addScope("profile");
    }
    // Best-effort refresh config in background (non-blocking)
    fetchFirebaseConfig().catch(() => {});
    return app;
  }

  const loadedFromBackend = await fetchFirebaseConfig();
  if (!loadedFromBackend) {
    const cached = loadCachedFirebasePublicEnv();
    if (cached) {
      console.warn(
        "⚠️ Firebase public env fetch failed; falling back to cached config",
      );
      hydrateFirebaseConfigFromEnvPayload(cached);
    } else {
      console.error(
        "❌ Firebase configuration could not be loaded from backend (/api/env/public) and no cache was found.",
      );
      return;
    }
  }

  // Validate Firebase configuration
  const requiredFields = [
    "apiKey",
    "authDomain",
    "projectId",
    "appId",
    "messagingSenderId",
  ];
  const missingFields = requiredFields.filter(
    (field) => !firebaseConfig[field] || firebaseConfig[field] === "undefined",
  );

  if (missingFields.length > 0) {
    console.warn(
      "⚠️ Firebase configuration is missing required fields:",
      missingFields,
    );
    console.warn(
      "💡 Firebase is running in DB-only strict mode. Configure all fields in Admin Panel.",
    );
    return;
  }

  try {
    if (existingApps.length === 0) {
      app = initializeApp(firebaseConfig);
      console.log(
        "🚀 Firebase initialized successfully with config from database",
      );
    } else {
      app = existingApps[0];
    }

    // Initialize Auth
    if (!firebaseAuth) {
      firebaseAuth = getAuth(app);
    }

    // Initialize Google Provider
    if (!googleProvider) {
      googleProvider = new GoogleAuthProvider();
      googleProvider.addScope("email");
      googleProvider.addScope("profile");
    }
  } catch (error) {
    console.error("❌ Firebase initialization error:", error);
  }

  return app;
}

export function getFirebaseVapidKey() {
  return firebaseConfig.vapidKey || "";
}

/** Realtime Database URL for live tracking (must match backend). Use with getDatabase(app, url). */
export function getFirebaseDatabaseURL() {
  return firebaseConfig.databaseURL || "";
}

export { firebaseAuth, googleProvider, ensureFirebaseInitialized };
