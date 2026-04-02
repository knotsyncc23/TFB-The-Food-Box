import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { ensureFirebaseInitialized, getFirebaseVapidKey } from "@/lib/firebase";
import { adminAPI, authAPI, deliveryAPI, restaurantAPI } from "@/lib/api";

const FCM_SW_PATH = "/firebase-messaging-sw.js";
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope/";

/** Dispatched on `window` when an FCM message arrives in the foreground (single Firebase listener). */
export const TFB_FCM_FOREGROUND_EVENT = "tfb-fcm-foreground";

let foregroundMessageInitialized = false;

function detectFcmPlatform() {
  try {
    const ua = navigator?.userAgent || "";
    if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "web";
  } catch {
    return "web";
  }
}

export function getWebNotificationPermission() {
  try {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission; // "default" | "granted" | "denied"
  } catch {
    return "unsupported";
  }
}

// Internal helper to get a browser FCM token (shared by user/restaurant/delivery/admin)
async function getBrowserFcmToken({ forcePrompt = false } = {}) {
  console.log("[FCM] Starting web FCM registration flow");

  // Ensure Firebase app is initialized
  const app = await ensureFirebaseInitialized();
  if (!app) {
    console.warn("[FCM] Firebase app not initialized, skipping FCM registration");
    return null;
  }

  // Check if Messaging is supported in this browser
  const supported = await isSupported();
  if (!supported) {
    console.warn("[FCM] Firebase messaging is not supported in this browser");
    return null;
  }

  // Request notification permission (only prompt on explicit user gesture)
  if (typeof Notification === "undefined") {
    console.warn("[FCM] Notification API not available");
    return null;
  }
  const currentPerm = Notification.permission;
  if (currentPerm === "denied") {
    console.warn("[FCM] Notification permission denied at browser level");
    return null;
  }
  if (currentPerm === "default") {
    if (!forcePrompt) {
      console.warn("[FCM] Permission is default; not prompting without user gesture");
      return null;
    }
    const permission = await Notification.requestPermission();
    console.log("[FCM] Notification permission:", permission);
    if (permission !== "granted") return null;
  }

  const messaging = getMessaging(app);
  const vapidKey = getFirebaseVapidKey();
  if (!vapidKey) {
    console.warn(
      "[FCM] No VAPID key. Set FIREBASE_VAPID_KEY in Admin → Environment Variables, or VITE_FIREBASE_VAPID_KEY in .env",
    );
    return null;
  }

  // Register our service worker so Firebase does not try to use the non-existent default path
  const registration = await navigator.serviceWorker.register(FCM_SW_PATH, {
    scope: FCM_SW_SCOPE,
  });
  await registration.ready;

  // Ensure the SW has Firebase config for background notifications
  try {
    registration.active?.postMessage({
      type: "FIREBASE_CONFIG",
      payload: {
        apiKey: app.options?.apiKey,
        authDomain: app.options?.authDomain,
        projectId: app.options?.projectId,
        storageBucket: app.options?.storageBucket,
        messagingSenderId: app.options?.messagingSenderId,
        appId: app.options?.appId,
      },
    });
  } catch (e) {
    console.warn("[FCM] Failed to post Firebase config to service worker:", e?.message || e);
  }

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  console.log("[FCM] getToken result length:", token?.length || 0);

  if (!token) {
    console.warn(
      "[FCM] No FCM token from getToken. Ensure notification permission is granted and VAPID key is set.",
    );
    return null;
  }

  return token;
}

/**
 * Subscribe to foreground FCM payloads without registering another Firebase `onMessage` listener.
 * Requires `initializePushNotifications()` to be run once at app startup (see main.jsx).
 */
export function subscribeToForegroundFcmMessages(onPayload) {
  const handler = (event) => {
    try {
      onPayload?.(event.detail);
    } catch {
      // ignore consumer errors
    }
  };
  window.addEventListener(TFB_FCM_FOREGROUND_EVENT, handler);
  return () => window.removeEventListener(TFB_FCM_FOREGROUND_EVENT, handler);
}

/**
 * Initialize a single global foreground FCM handler (bakalacart-style: OS notification + event for toasts).
 * Safe to call multiple times; only registers once.
 */
export async function initializePushNotifications() {
  try {
    const app = await ensureFirebaseInitialized();
    if (!app) return;

    const supported = await isSupported().catch(() => false);
    if (!supported) return;

    if (foregroundMessageInitialized) return;

    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      try {
        window.dispatchEvent(
          new CustomEvent(TFB_FCM_FOREGROUND_EVENT, { detail: payload }),
        );
      } catch {
        // ignore
      }

      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      const title =
        payload.notification?.title ||
        payload.data?.title ||
        "The Food Box";
      const body =
        payload.notification?.body || payload.data?.body || "";
      const icon =
        payload.notification?.icon || payload.data?.icon || "/favicon.ico";
      const tag =
        payload.data?.tag || payload.data?.orderId || title;

      // Cross-tab dedupe (same as bakalacart push flow)
      const debounceKey = `fcm_notif_shown_${tag}`;
      const lastShown = localStorage.getItem(debounceKey);
      if (lastShown && Date.now() - parseInt(lastShown, 10) < 5000) {
        return;
      }
      localStorage.setItem(debounceKey, Date.now().toString());

      try {
        new Notification(title, {
          body,
          icon,
          data: payload.data,
          tag,
        });
      } catch (error) {
        console.warn(
          "[FCM] Foreground notification failed:",
          error?.message || error,
        );
      }
    });

    foregroundMessageInitialized = true;
    console.log("[FCM] Global foreground handler initialized");
  } catch (error) {
    console.warn(
      "[FCM] initializePushNotifications failed:",
      error?.message || error,
    );
  }
}

export async function registerFcmTokenForLoggedInUser({ forcePrompt = false } = {}) {
  try {
    const token = await getBrowserFcmToken({ forcePrompt });
    if (!token) return;
    const platform = detectFcmPlatform();

    console.log("[FCM] Token to send (user):", token.substring(0, 30) + "...", "platform:", platform);
    const res = await authAPI.registerFcmToken(platform, token);
    const saved =
      res?.data?.data?.fcmTokenWeb ?? res?.data?.data?.fcmtokenWeb;
    console.log(
      "[FCM] Backend saved user fcmTokenWeb:",
      saved ? saved.substring(0, 30) + "..." : "null",
    );
  } catch (error) {
    console.error(
      "[FCM] Error during user web FCM registration:",
      error?.message || error,
    );
    if (error?.code === "messaging/permission-blocked") {
      console.warn(
        "[FCM] User denied notification permission. Token will stay null until permission is granted.",
      );
    } else if (error?.code === "messaging/invalid-vapid-key") {
      console.warn("[FCM] Invalid VAPID key. Check VITE_FIREBASE_VAPID_KEY in .env.");
    }
  }
}

export async function registerFcmTokenForRestaurant({ forcePrompt = false } = {}) {
  try {
    const token = await getBrowserFcmToken({ forcePrompt });
    if (!token) return;
    const platform = detectFcmPlatform();

    console.log(
      "[FCM][Restaurant] Token to send:",
      token.substring(0, 30) + "...",
      "platform:",
      platform,
    );
    const res = await restaurantAPI.registerFcmToken(platform, token);
    const saved =
      res?.data?.data?.fcmTokenWeb ?? res?.data?.data?.fcmtokenWeb;
    console.log(
      "[FCM][Restaurant] Backend saved fcmTokenWeb:",
      saved ? saved.substring(0, 30) + "..." : "null",
    );
  } catch (error) {
    console.error(
      "[FCM][Restaurant] Error during web FCM registration:",
      error?.message || error,
    );
  }
}

export async function registerFcmTokenForDelivery({ forcePrompt = false } = {}) {
  try {
    const token = await getBrowserFcmToken({ forcePrompt });
    if (!token) return;
    const platform = detectFcmPlatform();
    const res = await deliveryAPI.registerFcmToken?.(platform, token);
    return res?.data;
  } catch (error) {
    console.error("[FCM][Delivery] Error during web FCM registration:", error?.message || error);
  }
}

export async function registerFcmTokenForAdmin({ forcePrompt = false } = {}) {
  try {
    const token = await getBrowserFcmToken({ forcePrompt });
    if (!token) return;
    const platform = detectFcmPlatform();
    const res = await adminAPI.registerFcmToken?.(platform, token);
    return res?.data;
  } catch (error) {
    console.error("[FCM][Admin] Error during web FCM registration:", error?.message || error);
  }
}

export async function removeFcmTokenForLoggedInUser() {
  try {
    await authAPI.removeFcmToken("web");
  } catch (error) {
    console.error("[FCM] Error removing FCM token for web:", error);
  }
}

export async function removeFcmTokenForRestaurant() {
  try {
    await restaurantAPI.removeFcmToken("web");
  } catch (error) {
    console.error("[FCM][Restaurant] Error removing FCM token for web:", error);
  }
}

export async function removeFcmTokenForDelivery() {
  try {
    await deliveryAPI.removeFcmToken?.("web");
  } catch (error) {
    console.error("[FCM][Delivery] Error removing FCM token for web:", error);
  }
}

export async function removeFcmTokenForAdmin() {
  try {
    await adminAPI.removeFcmToken?.("web");
  } catch (error) {
    console.error("[FCM][Admin] Error removing FCM token for web:", error);
  }
}

