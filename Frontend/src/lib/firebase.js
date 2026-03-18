import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase configuration - primary source is backend env API; falls back to VITE_ only if needed.
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

// Fetch config from backend and inject DB env values
const fetchFirebaseConfig = async () => {
  try {
    const { adminAPI } = await import("./api/index.js");
    const response = await adminAPI.getPublicEnvVariables();

    if (response.data.success && response.data.data) {
      const config = response.data.data;
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

      if (apiKey && looksLikeWebApiKey(apiKey)) firebaseConfig.apiKey = apiKey;
      if (authDomain) firebaseConfig.authDomain = authDomain;
      if (projectId && looksLikeProjectId(projectId)) firebaseConfig.projectId = projectId;
      if (storageBucket) firebaseConfig.storageBucket = storageBucket;
      if (messagingSenderId && looksLikeSenderId(messagingSenderId)) {
        firebaseConfig.messagingSenderId = messagingSenderId;
      }
      if (appId) firebaseConfig.appId = appId;
      if (vapidKey) firebaseConfig.vapidKey = vapidKey;
      if (measurementId) firebaseConfig.measurementId = measurementId;
      if (databaseURL) firebaseConfig.databaseURL = databaseURL;

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
  const loadedFromBackend = await fetchFirebaseConfig(); // Try to load from backend/DB first

  // If backend didn't provide full config, fall back to VITE_ env for missing fields only
  if (!loadedFromBackend) {
    firebaseConfig.apiKey =
      firebaseConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "";
    firebaseConfig.authDomain =
      firebaseConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "";
    firebaseConfig.projectId =
      firebaseConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "";
    firebaseConfig.storageBucket =
      firebaseConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "";
    firebaseConfig.messagingSenderId =
      firebaseConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "";
    firebaseConfig.appId =
      firebaseConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || "";
    firebaseConfig.measurementId =
      firebaseConfig.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "";
    firebaseConfig.vapidKey =
      firebaseConfig.vapidKey ||
      import.meta.env.VITE_FIREBASE_VAPID_KEY ||
      import.meta.env.VITE_FCM_VAPID_KEY ||
      "";
    firebaseConfig.databaseURL =
      firebaseConfig.databaseURL || import.meta.env.VITE_FIREBASE_DATABASE_URL || "";
  }
  // If DB returned a bad/placeholder config, allow VITE_ env to fill missing fields too
  // (e.g. FIREBASE_API_KEY stored in DB but not a valid web API key)
  firebaseConfig.apiKey =
    firebaseConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "";
  firebaseConfig.authDomain =
    firebaseConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "";
  firebaseConfig.projectId =
    firebaseConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "";
  firebaseConfig.storageBucket =
    firebaseConfig.storageBucket ||
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "";
  firebaseConfig.messagingSenderId =
    firebaseConfig.messagingSenderId ||
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    "";
  firebaseConfig.appId =
    firebaseConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || "";
  firebaseConfig.measurementId =
    firebaseConfig.measurementId ||
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
    "";
  firebaseConfig.vapidKey =
    firebaseConfig.vapidKey ||
    import.meta.env.VITE_FIREBASE_VAPID_KEY ||
    import.meta.env.VITE_FCM_VAPID_KEY ||
    "";
  firebaseConfig.databaseURL =
    firebaseConfig.databaseURL || import.meta.env.VITE_FIREBASE_DATABASE_URL || "";

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
      "💡 Authentication features may not work until configured in Admin Panel.",
    );
    return;
  }

  try {
    const existingApps = getApps();
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
  return firebaseConfig.vapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY || import.meta.env.VITE_FCM_VAPID_KEY || "";
}

/** Realtime Database URL for live tracking (must match backend). Use with getDatabase(app, url). */
export function getFirebaseDatabaseURL() {
  return firebaseConfig.databaseURL || import.meta.env.VITE_FIREBASE_DATABASE_URL || "";
}

export { firebaseAuth, googleProvider, ensureFirebaseInitialized };
